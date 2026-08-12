'use strict';
/**
 * ocr — Chandra, il lettore di documenti, come COMPONENTE OPZIONALE.
 *
 * Chandra legge una pagina come la leggerebbe una persona: riconosce le tabelle,
 * le formule e la scrittura a mano, e soprattutto ritaglia figure e schemi come
 * immagini a sé, dicendo a quale pagina appartengono. È la differenza fra un PDF
 * che nell'app è un muro di parole e un PDF di cui si vedono gli schemi.
 *
 * Ma pesa: il modello da solo è più di dieci gigabyte, e girare gli costa minuti
 * per pagina su un Mac. Chi usa StudIA solo per i video non deve pagarlo — né in
 * disco, né in attesa. Quindi non è una dipendenza: è qualcosa che si installa
 * se si vuole, e senza cui tutto il resto funziona come prima.
 *
 * Tre scelte di fondo, e il perché:
 *
 *  1. **Ambiente separato** (`pyenv-ocr`, non `pyenv`). Chandra porta con sé
 *     torch e transformers; la trascrizione vive su mlx e ctranslate2. Tenerli
 *     nello stesso ambiente vuol dire che installare l'OCR può rompere la
 *     trascrizione, che è la cosa che l'utente usa di più. Separati, installare
 *     non tocca niente e disinstallare è cancellare una cartella.
 *
 *  2. **Non si installa da solo.** Il resto delle dipendenze si installa al
 *     primo uso e va bene, perché sono decine di megabyte. Qui si parla di
 *     gigabyte e di un download lungo: una cosa così la si chiede, non la si fa
 *     mentre l'utente aspetta di vedere una lezione.
 *
 *  3. **Chi ha letto un documento si scrive nell'indice.** `motore: 'chandra'`
 *     oppure `'pypdf'`. Senza, un vault finisce per contenere indici fatti da
 *     due macchine diverse senza che si possa sapere quale: è la stessa cecità
 *     silenziosa che ha prodotto lezioni senza PDF (vedi HANDOFF §7).
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const TIMEOUT = 20000;

/** Il pacchetto e il modello: nominati una volta sola. */
const PACCHETTO = 'chandra-ocr[hf]';
const MODELLO = 'datalab-to/chandra-ocr-2';
/** Quanto scarica: pacchetti (torch & c.) + pesi del modello. Serve a dirlo PRIMA.
    Misurato su Apple Silicon: l'ambiente completo pesa 0,93 GB, i pesi 10,6. */
const GB_PACCHETTI = 1;
const GB_MODELLO = 10.6;
const GB_TOTALI = GB_PACCHETTI + GB_MODELLO;
/** Sotto questo margine non si comincia: un download interrotto a metà è peggio di un rifiuto. */
const GB_LIBERI_MINIMI = GB_TOTALI + 5;

// ------------------------------------------------------------------ percorsi

/** La cartella dell'ambiente OCR, dentro i dati dell'app. */
function venvDir(userData) { return path.join(userData || '', 'pyenv-ocr'); }

/** L'interprete di quell'ambiente. */
function python(userData) {
  const d = venvDir(userData);
  return process.platform === 'win32' ? path.join(d, 'Scripts', 'python.exe') : path.join(d, 'bin', 'python');
}

// ------------------------------------------------------- lettura del sistema

/** Vero se in quell'ambiente Chandra è importabile davvero (non solo presente). */
function importabile(py) {
  if (!py || !fs.existsSync(py)) return false;
  try {
    const r = spawnSync(py, ['-c', 'import chandra, torch'], { timeout: TIMEOUT });
    return !!r && r.status === 0;
  } catch (e) { return false; }
}

/** La versione di Chandra e di torch, per poterle mostrare. '' se non si sa. */
function versioni(py) {
  try {
    // chandra non espone `__version__`: la versione la sa il gestore dei pacchetti
    const r = spawnSync(py, ['-c',
      'from importlib.metadata import version;import torch;print(version("chandra-ocr"));print(torch.__version__);' +
      'print("mps" if torch.backends.mps.is_available() else ("cuda" if torch.cuda.is_available() else "cpu"))'],
    { encoding: 'utf-8', timeout: TIMEOUT });
    if (!r || r.status !== 0) return {};
    const [chandra, torchV, dispositivo] = String(r.stdout || '').trim().split('\n');
    return { chandra, torch: torchV, dispositivo };
  } catch (e) { return {}; }
}

/**
 * I pesi sono già scaricati?
 *
 * La cache di Hugging Face nomina le cartelle `models--org--nome`. Si guarda lì
 * invece di chiederlo alla libreria perché la risposta serve **prima** di
 * caricare il modello: è il numero da mostrare a chi deve decidere se aspettare.
 */
/**
 * La cartella dei modelli **dell'app**: dentro i suoi dati, accanto all'ambiente.
 *
 * È dove il modello deve finire su un computer qualunque. Un'app che si
 * distribuisce non può appoggiarsi al magazzino condiviso di Hugging Face:
 * quello è di chi sviluppa in Python, non di chi si limita a studiare. Chi
 * disinstalla StudIA deve poter buttare una cartella sola e riprendersi tutti
 * i suoi gigabyte, senza sapere che cosa sia una cache di Hugging Face.
 */
function cartellaModelli(userData) { return path.join(userData || '', 'modelli-ocr'); }

function cartellaHub() {
  /* Le stesse variabili che guarda huggingface_hub, nello stesso ordine. Chi
     tiene i modelli in una cartella sua le imposta, e cercare a mano in
     ~/.cache direbbe «da scaricare» su un modello che c'è già — facendo
     riscaricare dieci gigabyte per niente. */
  if (process.env.HF_HUB_CACHE) return process.env.HF_HUB_CACHE;
  if (process.env.HF_HOME) return path.join(process.env.HF_HOME, 'hub');
  return path.join(os.homedir(), '.cache', 'huggingface', 'hub');
}

/** Dove cercare i pesi, in ordine: prima la cartella dell'app, poi quella di sistema. */
function cartelleModello(userData, nome) {
  const dir = 'models--' + String(nome || MODELLO).replace(/\//g, '--');
  const out = [];
  if (userData) out.push({ dove: path.join(cartellaModelli(userData), 'hub', dir), propria: true });
  out.push({ dove: path.join(cartellaHub(), dir), propria: false });
  return out;
}

function modelloScaricato(nome, userData) {
  for (const c of cartelleModello(userData, nome)) {
    try {
      if (!fs.statSync(c.dove).isDirectory()) continue;
      return { presente: true, dove: c.dove, propria: c.propria, gb: pesoGb(path.join(c.dove, 'blobs')) };
    } catch (e) {}
  }
  return { presente: false, dove: null, propria: false, gb: 0 };
}

/**
 * L'ambiente da passare ai processi dell'OCR.
 *
 * La regola in una riga: **si scarica in casa propria, ma non si riscarica ciò
 * che c'è già altrove.** Su un computer nuovo il modello finisce nella cartella
 * dell'app; su un computer dove esiste già nel magazzino condiviso — è il caso
 * di chi sviluppa — si usa quello, perché far riscaricare dieci gigabyte per
 * una questione di ordine sarebbe una scortesia.
 *
 * Pura di proposito: riceve dove sta il modello invece di andarlo a cercare,
 * così la regola si può provare senza avere undici gigabyte sul disco.
 */
function ambienteProcesso(userData, modello) {
  const m = modello || {};
  if (m.presente && !m.propria) return {};                 // c'è già nel magazzino condiviso: lo si usa
  return { HF_HOME: cartellaModelli(userData) };            // altrimenti tutto dentro l'app
}

/** Quanto occupa una cartella, in GB con un decimale. Non segue i link. */
function pesoGb(dir) {
  let byte = 0;
  const gira = (d) => {
    let voci = [];
    try { voci = fs.readdirSync(d, { withFileTypes: true }); } catch (e) { return; }
    for (const v of voci) {
      const p = path.join(d, v.name);
      if (v.isSymbolicLink()) continue;                 // i blob veri stanno una volta sola
      if (v.isDirectory()) { gira(p); continue; }
      try { byte += fs.statSync(p).size; } catch (e) {}
    }
  };
  gira(dir);
  return Math.round(byte / 1e9 * 10) / 10;
}

/**
 * Lo stato del componente, tutto in un colpo.
 * Guarda il sistema, quindi non si prova con un test: la decisione che ne segue
 * sta in `consiglio()`, che è pura.
 */
function stato(userData) {
  const py = python(userData);
  const installato = importabile(py);
  const modello = modelloScaricato(MODELLO, userData);
  return {
    installato,
    python: py,
    versioni: installato ? versioni(py) : {},
    modello: MODELLO,
    modelloScaricato: modello.presente,
    modelloDove: modello.dove,
    modelloNellApp: !!modello.propria,
    modelloGb: modello.gb,
    ambiente: ambienteProcesso(userData, modello),
    gbDaScaricare: (installato ? 0 : GB_PACCHETTI) + (modello.presente ? 0 : GB_MODELLO)
  };
}

// ---------------------------------------------------------- la parte pura

/**
 * Che cosa dire all'utente, dato lo stato. Nessun accesso al sistema.
 *
 * `passo` dice a che punto è il componente:
 *   'assente'    → mai installato
 *   'senzaPesi'  → pacchetti installati, modello da scaricare (il primo PDF ci mette)
 *   'pronto'     → si può usare
 *   'impossibile'→ manca il presupposto (Python, o spazio)
 */
function consiglio(s, ambiente) {
  const o = s || {};
  const amb = ambiente || {};
  const py = amb.python || {};
  const liberi = typeof amb.spazioLiberoGb === 'number' ? amb.spazioLiberoGb : null;

  if (o.installato && o.modelloScaricato) {
    return { passo: 'pronto', titolo: 'Lettura avanzata dei documenti attiva',
      testo: 'I PDF vengono letti da Chandra: tabelle, formule, scrittura a mano, e gli schemi ' +
             'ritagliati come immagini da mettere nei capitoli.' +
             (o.versioni && o.versioni.dispositivo === 'cpu'
               ? ' Attenzione: gira sulla CPU, quindi è molto lento.' : ''),
      azioni: ['rimuovi'] };
  }

  if (!py.trovato) {
    return { passo: 'impossibile', titolo: 'Lettura avanzata dei documenti non installabile',
      testo: 'Serve Python 3, che su questo computer non è stato trovato.', azioni: [] };
  }
  if (liberi != null && liberi < GB_LIBERI_MINIMI) {
    return { passo: 'impossibile', titolo: 'Spazio insufficiente per la lettura avanzata',
      testo: 'Servono circa ' + numero(GB_TOTALI) + ' GB fra programma e modello, e sul disco ne restano ' +
             numero(liberi) + '. Libera spazio e riprova.', azioni: [] };
  }

  if (o.installato && !o.modelloScaricato) {
    return { passo: 'senzaPesi', titolo: 'Manca solo il modello',
      testo: 'Il programma è installato; il modello (' + numero(GB_MODELLO) + ' GB) si scarica al primo ' +
             'documento letto. Succede una volta sola.', azioni: ['scarica', 'rimuovi'] };
  }

  return { passo: 'assente', titolo: 'Lettura avanzata dei documenti (facoltativa)',
    testo: 'Senza, i PDF vengono letti estraendone il testo: va bene per i documenti scritti al ' +
           'computer, male per le scansioni, le tabelle e gli schemi. Con Chandra si leggono anche ' +
           'quelli, e le figure entrano nei capitoli come immagini che aprono la pagina del PDF. ' +
           'Occupa circa ' + numero(GB_TOTALI) + ' GB e la prima installazione è lunga.',
    azioni: ['installa'] };
}

/** Un numero come lo scriverebbe una persona di lingua italiana. */
function numero(n) { return String(n).replace('.', ','); }

/**
 * I comandi dell'installazione, in ordine. Restituirli invece di eseguirli
 * permette di provarli: è la parte che si sbaglia per prima (il nome del
 * pacchetto, l'ordine, il `--upgrade` dimenticato) e non richiede una macchina.
 */
function passiInstallazione(sysPython, userData) {
  const py = python(userData);
  return [
    { msg: 'Creo l\'ambiente per la lettura dei documenti (una volta sola)…',
      cmd: sysPython, args: ['-m', 'venv', venvDir(userData)] },
    { msg: 'Aggiorno pip…', cmd: py, args: ['-m', 'pip', 'install', '--upgrade', 'pip'] },
    { msg: 'Scarico Chandra e torch: circa ' + numero(GB_PACCHETTI) + ' GB, ci vuole un po\'…',
      cmd: py, args: ['-m', 'pip', 'install', PACCHETTO] }
  ];
}

/** Il comando che scarica i pesi senza leggere niente: serve a farlo quando si vuole. */
function passoScaricaModello(userData, modello) {
  const env = ambienteProcesso(userData, modello);
  return { msg: 'Scarico il modello: ' + numero(GB_MODELLO) + ' GB, una volta sola…' +
      (env.HF_HOME ? ' Finisce nella cartella di StudIA.' : ''),
    cmd: python(userData), env,
    args: ['-c', 'from huggingface_hub import snapshot_download;snapshot_download("' + MODELLO + '")'] };
}

/**
 * Che cosa cancella «Rimuovi», e che cosa no.
 *
 * L'ambiente è sempre nostro e se ne va. I pesi solo se stanno nella cartella
 * dell'app: là li ha messi StudIA e nessun altro li usa. Se invece stanno nel
 * magazzino condiviso, cancellarli sarebbe entrare in casa d'altri — potrebbero
 * servire a un altro programma sullo stesso computer.
 */
function daRimuovere(userData, modello) {
  const m = modello || {};
  const out = [venvDir(userData)];
  if (m.presente && m.propria) out.push(cartellaModelli(userData));
  return { cartelle: out, restaFuori: (m.presente && !m.propria) ? m.dove : null, gb: m.gb || 0 };
}

// ------------------------------------------------- quali pagine vale la pena

/**
 * Le soglie della scelta, in un posto solo.
 *
 * Non sono tarate a occhio: vengono da un confronto con la lettura vera di
 * Chandra su sei pagine scelte a cavallo del confine. La prima versione
 * misurava l'AREA della grafica più grande e ne sbagliava due — perché una
 * tabella è fatta di filetti sottili (tanti tracciati, area minima) e su una
 * slide l'oggetto più grande è sempre il rettangolo di sfondo. Il conteggio le
 * ha prese tutte e sei, perché è meccanico invece che statistico: un oggetto
 * immagine È una figura, e venti tracciati SONO una tabella o un disegno.
 */
const CAR_SCANSIONE = 200;   // sotto: la pagina è un'immagine, non c'è testo da estrarre
const PATH_FIGURA = 10;      // da qui in su: una tabella o un disegno, non un filetto
const SEC_PER_PAGINA = 169;  // misurati su Apple Silicon con MPS

/** Perché questa pagina va letta, o '' se non serve. Il perché si mostra. */
function motivoPagina(p) {
  if (!p || p.errore) return '';
  if ((p.car || 0) < CAR_SCANSIONE) return 'scansione';
  if ((p.nImg || 0) >= 1) return 'figura';
  if ((p.nPath || 0) >= PATH_FIGURA) return 'tabella o schema';
  return '';
}

/**
 * Questo documento è una SCANSIONE — foto di un testo, senza layer di testo?
 *
 * Riceve le pagine come le scrive l'indice dello zaino (`{page, text}`) e
 * risponde con il conto, non solo col verdetto: «14 pagine su 15 senza testo»
 * si può contestare, «sembra una scansione» no.
 *
 * La soglia per pagina è `CAR_SCANSIONE`, la stessa già tarata per la lettura
 * avanzata dei corsi: una seconda soglia qui sarebbe la solita seconda copia
 * che diverge. Il verdetto scatta oltre la METÀ delle pagine: un PDF nativo
 * con la copertina-immagine e due divisori non è una scansione, un fascicolo
 * fotografato con una pagina di indice testuale sì.
 */
function eScansione(pagine) {
  const l = Array.isArray(pagine) ? pagine : [];
  const vuote = l.filter((p) =>
    String((p && p.text) || '').replace(/\s+/g, ' ').trim().length < CAR_SCANSIONE).length;
  return { scansione: l.length > 0 && vuote * 2 > l.length, pagineVuote: vuote, npagine: l.length };
}

/**
 * Le pagine di un PDF che vale la pena far leggere, con il conto e la stima.
 *
 * Restituisce anche `motivi`, perché «41 pagine su 109» senza il perché è un
 * numero che non si può contestare: chi guarda deve poter dire «no, quelle
 * tabelle non mi servono» e cambiare idea con cognizione.
 */
function selezionaPagine(scheda) {
  const pagine = (scheda && scheda.pagine) || [];
  const scelte = [];
  const motivi = {};
  for (const p of pagine) {
    const m = motivoPagina(p);
    if (!m) continue;
    scelte.push(p.p);
    motivi[m] = (motivi[m] || 0) + 1;
  }
  return {
    file: scheda && scheda.file,
    npagine: pagine.length,
    pagine: scelte,
    motivi,
    illeggibili: pagine.filter((p) => p.errore).length,
    secondi: scelte.length * SEC_PER_PAGINA
  };
}

/** «1,9 ore», «12 minuti»: una durata come la direbbe una persona. */
function durata(secondi) {
  const s = Math.max(0, Math.round(secondi || 0));
  if (s < 90) return s + ' secondi';
  if (s < 5400) return Math.round(s / 60) + ' minuti';
  return numero(Math.round(s / 360) / 10) + ' ore';
}

/** La riga da mostrare accanto a un PDF: quante pagine, quante da leggere, quanto ci vuole. */
function rigaStima(sel) {
  if (!sel || !sel.npagine) return '';
  if (!sel.pagine.length) return sel.npagine + ' pagine · nessuna da rileggere';
  const perche = Object.keys(sel.motivi).sort().map((k) => sel.motivi[k] + ' ' + k).join(', ');
  return sel.npagine + ' pagine · ' + sel.pagine.length + ' da rileggere (' + perche + ') · ' +
    durata(sel.secondi);
}

/** Il totale di una selezione di PDF, per la riga in fondo. */
function totaleStima(selezioni) {
  const l = (selezioni || []).filter(Boolean);
  const pagine = l.reduce((s, x) => s + x.pagine.length, 0);
  return { pdf: l.length, pagine, secondi: pagine * SEC_PER_PAGINA, testo: durata(pagine * SEC_PER_PAGINA) };
}

module.exports = {
  PACCHETTO, MODELLO, GB_PACCHETTI, GB_MODELLO, GB_TOTALI, GB_LIBERI_MINIMI,
  CAR_SCANSIONE, PATH_FIGURA, SEC_PER_PAGINA,
  motivoPagina, eScansione, selezionaPagine, durata, rigaStima, totaleStima, daRimuovere,
  venvDir, python, importabile, versioni, cartellaHub, cartellaModelli, cartelleModello,
  ambienteProcesso, modelloScaricato, pesoGb, stato,
  consiglio, numero, passiInstallazione, passoScaricaModello
};
