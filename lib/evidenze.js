'use strict';
/* =========================================================================
   evidenze — le parole chiave che lo studente evidenzia nel testo, su disco.

   Perché non stanno nell'HTML del capitolo: quell'HTML lo fabbrica la
   pipeline e domani lo rifabbrica. Un'evidenziatura scritta lì dentro
   sparirebbe alla prima rigenerazione, o — peggio — resterebbe attaccata a un
   testo che nel frattempo è cambiato. Vivono quindi in un file loro e si
   RIAPPLICANO a ogni apertura, cercando il proprio testo con i selettori di
   `App/assets/evidenze/ancoraggio.js`.

   Dove: `Corsi/<corso>/APPUNTI/_evidenze.json`, accanto agli appunti e non in
   una cartella sua. Non è pigrizia: un'evidenza è **una riga**, non un
   documento, e soprattutto condivide con gli appunti la stessa natura di
   annotazione personale — quindi anche lo stesso interruttore in
   `lib/pacchetto.js`, che lascia fuori `APPUNTI/` quando l'autore non vuole
   dare le proprie note. Chi non regala i suoi appunti non vuole regalare
   nemmeno le sue parole chiave.

   Accanto al JSON si scrive `_evidenze.md`, che è una VISTA: rigenerata a ogni
   scrittura, mai riletta dall'app, buona per chi apre il vault in Obsidian. La
   verità è il JSON. Due file che si possono leggere entrambi sono una trappola
   solo se qualcuno crede a tutti e due: qui il markdown dichiara in testa di
   essere generato, esattamente come fa `_indice.md` degli appunti.

   ⚠️ Niente DOM, niente Electron: gira in Node e si prova con `node
   test/evidenze.js`. La ricerca del testo nel capitolo non sta qui — sta nel
   modulo di ancoraggio, che è puro a sua volta. Questo file sa soltanto
   leggere e scrivere un elenco.
   ========================================================================= */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const appunti = require('./appunti');   // dir(), writeAtomic(): una copia sola, vedi sotto

const FILE = '_evidenze.json';
const VISTA = '_evidenze.md';

/* Il vocabolario del record. Enumerato qui e in un posto solo: un campo che
   non compare in questa lista non sopravvive a un salvataggio, ed è meglio
   saperlo scrivendo che scoprirlo fra un mese con un dato sparito.
   `materiale` e `pagina` sono l'indirizzo di un'evidenza fatta su un DOCUMENTO
   (quale file, quale pagina); su un capitolo restano vuoti e parlano invece
   `lezioneId`/`capitoloId`/`capitolo`. Un'evidenza ha sempre uno dei due
   indirizzi, mai tutti e due: è `evIndirizzo` nel renderer a sceglierlo dalla
   superficie su cui si è evidenziato.
   ⚠️ Fino al 12/8/26 questa nota diceva che i due campi «restano vuoti finché
   le evidenze non arriveranno anche sul PDF». Ci sono arrivate — capitolo e
   documento si evidenziano entrambi, e il fondo pieno funziona su tutti e due —
   ma il commento è rimasto indietro e ha fatto concludere il contrario a chi
   leggeva il file invece dell'app. */
const CAMPI = ['id', 'exact', 'prefix', 'suffix', 'colore', 'tratto', 'strato',
  'lezioneId', 'capitoloId', 'capitolo', 'materiale', 'pagina', 'creato'];

/* Lo STRATO: in quale lettura vive questa evidenza. Vuoto = lo strato base,
   che è dove stanno tutte quelle fatte prima che gli strati esistessero.
   ⚠️ A differenza di colore e tratto, lo strato ENTRA nell'identità — vedi
   `identita`. È l'unico modo per segnare le stesse parole due volte, che è
   esattamente ciò per cui gli strati esistono. */

/* Come si segna: sottolineatura spessa (`sotto`) o fondo pieno alla Stabilo
   (`overlay`). Sta accanto al colore perché è la stessa natura — aspetto, non
   identità — e infatti nessuno dei due entra nel semi da cui nasce l'`id`:
   cambiare tratto a un'evidenza non deve farne nascere un'altra.
   ⚠️ `sotto` è il default e lo resta: le evidenze scritte prima di questo campo
   non hanno un tratto, e devono continuare a vedersi come il giorno in cui sono
   state fatte. */
const TRATTI = ['sotto', 'overlay'];
const TRATTO_DEFAULT = 'sotto';
function trattoValido(t) {
  const v = str(t).trim().toLowerCase();
  return TRATTI.indexOf(v) >= 0 ? v : TRATTO_DEFAULT;
}

function str(v) { return typeof v === 'string' ? v : (v == null ? '' : String(v)); }

/**
 * Il corso è una cartella dentro `Corsi/`, e nient'altro.
 *
 * ⚠️ La stessa guardia di `mappe.nomeValido`, e per la stessa ragione già
 * pagata: là mancava su tre porte su quattro e `rimuovi(p, '../APPUNTI/…')`
 * cancellava un appunto rispondendo «fatto». Qui la porta è una sola — il
 * nome del file è fisso — ma l'identificatore del corso arriva comunque da
 * fuori, e con `..` uscirebbe dal vault.
 */
function corsoValido(id) {
  const s = str(id);
  return !!s && s.indexOf('/') < 0 && s.indexOf('\\') < 0 && s.indexOf('..') < 0;
}

function dir(vaultPath, courseId) { return appunti.dir(vaultPath, courseId); }
function percorso(vaultPath, courseId) { return path.join(dir(vaultPath, courseId), FILE); }
function percorsoVista(vaultPath, courseId) { return path.join(dir(vaultPath, courseId), VISTA); }

/**
 * L'identità di un'evidenza: il capitolo più il testo CON il suo contorno.
 *
 * Il contorno serve: «memoria di lavoro» compare nove lezioni e più volte
 * nello stesso capitolo, e senza prefisso e suffisso due occorrenze diverse
 * avrebbero lo stesso id — evidenziarne una spegnerebbe l'altra. Con il
 * contorno, invece, ri-evidenziare *lo stesso punto* produce lo stesso id, ed
 * è quello che rende `aggiungi` idempotente senza che nessuno debba cercare i
 * doppioni.
 */
function identita(ev) {
  /**
   * ⚠️ Due spazi di identità, e il perché è un guasto evitato.
   *
   * Su un documento il capitolo non esiste: `capitoloId` è vuoto. Con il
   * solo seme di prima, la stessa frase evidenziata a pagina 3 di un
   * documento e a pagina 9 di un altro avrebbe avuto **lo stesso id** — e
   * `aggiungi`, che è idempotente per id, avrebbe sovrascritto la prima con
   * la seconda: una parola chiave che sparisce mentre se ne aggiunge
   * un'altra, in silenzio.
   *
   * Perché non un seme unico che comprenda tutto: cambiare il seme cambia
   * gli id di ciò che è già nei vault. Le evidenze salvate conservano il
   * loro (`normalizzaVoce` tiene `v.id` quando c'è), ma ri-evidenziare lo
   * stesso punto di un capitolo produrrebbe un id nuovo — cioè un doppione
   * sulla stessa parola. Quindi: chi ha un materiale usa il seme del
   * materiale, chi non ce l'ha usa quello di sempre. Nessuna migrazione,
   * nessun doppione.
   *
   * Il separatore resta il byte NUL, per la ragione di prima: non può
   * comparire nel testo, quindi due semi diversi non possono coincidere
   * spostando un confine fra i campi.
   *
   * Il NUL è scritto come sequenza di escape ('\u0000') e non come byte
   * letterale: un NUL nel sorgente rende il file BINARIO per git — niente
   * `diff`, niente `blame`, e un merge concorrente non si può risolvere. Le
   * due forme danno lo stesso byte a runtime; il valore d'oro in
   * `test/evidenze-pdf.js` è lì per dimostrarlo.
   */
  const materiale = str(ev && ev.materiale);
  const semi = materiale
    ? ['pdf', materiale, str(ev && ev.pagina), str(ev && ev.prefix),
      str(ev && ev.exact), str(ev && ev.suffix)].join('\u0000')
    : [str(ev && ev.capitoloId), str(ev && ev.prefix),
      str(ev && ev.exact), str(ev && ev.suffix)].join('\u0000');
  /**
   * ⚠️ E LO STRATO, che è il terzo spazio di identità — ma solo quando c’è.
   *
   * Gli strati esistono per una ragione sola: segnare **le stesse parole** per
   * analisi diverse (la metrica, le figure retoriche). Col seme di prima non si
   * può, ed è la cosa da capire di questo file: le stesse parole danno lo
   * stesso id, quindi la seconda evidenza *sovrascriverebbe* la prima invece di
   * affiancarsi — che è il gesto «cambia colore», giusto finché la lettura è una.
   *
   * Lo strato entra in coda al seme, e **solo se non è vuoto**: la stessa
   * regola già usata qui sopra per il materiale, e per la stessa ragione. Le
   * evidenze scritte prima che gli strati esistessero conservano il loro id
   * byte per byte — nessuna migrazione, nessun doppione — e i
   * `[==testo==](ev:<id>)` già scritti negli appunti continuano a puntare dove
   * puntavano. Lo strato base non è «uno strato che si chiama base»: è
   * l’ASSENZA di strato, e l’assenza non si scrive nel seme.
   */
  const strato = str(ev && ev.strato).trim();
  const seme = strato ? (semi + '\u0000' + 'strato' + '\u0000' + strato) : semi;
  return crypto.createHash('sha1').update(seme).digest('hex').slice(0, 12);
}

/** Un colore è un'etichetta corta: si accetta com'è, ripulita da ciò che in un
 *  attributo di stile non ha senso. Quali siano i cinque preset lo sa il
 *  renderer, che li legge dalle variabili CSS e quindi segue il tema: una
 *  seconda tavolozza qui divergerebbe al primo cambio di chiaro/scuro. */
function coloreValido(c) {
  return str(c).replace(/[\x00-\x1f;"'<>]/g, '').trim().slice(0, 40);
}

/**
 * Raddrizza una voce che arriva da fuori. Torna `null` se non è un'evidenza:
 * senza `exact` non c'è niente da ritrovare nel testo, e una riga così
 * riempirebbe l'elenco di voci che non si accendono mai.
 */
function normalizzaVoce(v) {
  if (!v || typeof v !== 'object') return null;
  const exact = str(v.exact).trim();
  if (!exact) return null;
  const out = {
    id: str(v.id),
    exact,
    prefix: str(v.prefix),
    suffix: str(v.suffix),
    colore: coloreValido(v.colore),
    tratto: trattoValido(v.tratto),
    strato: str(v.strato).trim().slice(0, 40),
    lezioneId: str(v.lezioneId),
    capitoloId: str(v.capitoloId),
    capitolo: str(v.capitolo),
    materiale: str(v.materiale),
    pagina: Number.isFinite(+v.pagina) && str(v.pagina) !== '' ? Math.trunc(+v.pagina) : '',
    creato: str(v.creato)
  };
  if (!out.id) out.id = identita(out);
  return out;
}

/**
 * Legge l'elenco. Distingue «non ce n'è» da «non si riesce a leggere»: sono
 * due cose diverse, e dirle uguali vuol dire mostrare «nessuna parola chiave»
 * a chi sta guardando un errore di permessi. È la stessa lezione di
 * `mappe.elenco`, dove `error` va guardato PRIMA di `length`.
 */
function leggi(vaultPath, courseId) {
  /* ⚠️ Ogni uscita porta `strati`, anche quelle di guasto: chi legge fa
     `letto.strati.some(...)` senza chiedersi se c'è, e un `undefined` qui
     diventa un'eccezione in mezzo a un gesto dell'utente. È la stessa forma
     di `nessunUso()` per gli usi dell'album. */
  if (!corsoValido(courseId)) return { evidenze: [], strati: [], error: 'corso non valido' };
  const p = percorso(vaultPath, courseId);
  let grezzo;
  try { grezzo = fs.readFileSync(p, 'utf-8'); }
  catch (e) { return { evidenze: [], strati: [], error: e.code === 'ENOENT' ? '' : (e.message || 'lettura fallita') }; }
  let dati;
  try { dati = JSON.parse(grezzo); }
  catch (e) { return { evidenze: [], strati: [], error: 'il file non è JSON valido' }; }
  const lista = Array.isArray(dati) ? dati : (dati && Array.isArray(dati.evidenze) ? dati.evidenze : []);
  const viste = new Set();
  const evidenze = [];
  for (const v of lista) {
    const n = normalizzaVoce(v);
    if (!n || viste.has(n.id)) continue;   // i doppioni si potano in lettura, non si tramandano
    viste.add(n.id);
    evidenze.push(n);
  }
  return { evidenze, strati: leggiStrati(dati), error: '' };
}

/* ------------------------------------------------------------- gli strati */

/**
 * Il registro delle letture, accanto alle evidenze nello STESSO file.
 *
 * ⚠️ Nello stesso file e non in uno suo: uno strato esiste soltanto per le sue
 * evidenze, e due file vorrebbero dire due verità da tenere d'accordo (un
 * riferimento a una lettura che non c'è più, o viceversa) più una voce nuova in
 * `lib/pacchetto.js`, che oggi nomina un file solo.
 *
 * ⚠️ Un vault senza strati non ne guadagna uno: se il registro è vuoto la chiave
 * non si scrive, e `_evidenze.json` resta identico a com'era. La stessa regola
 * per cui non si semina un file per dire «zero».
 */
function strato(v) {
  if (!v || typeof v !== 'object') return null;
  const id = str(v.id).trim().slice(0, 40);
  const nome = str(v.nome).replace(/[\x00-\x1f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
  if (!id || !nome) return null;
  return { id, nome, creato: str(v.creato) };
}
function leggiStrati(dati) {
  const grezzi = (dati && Array.isArray(dati.strati)) ? dati.strati : [];
  const visti = new Set();
  const out = [];
  for (const v of grezzi) {
    const n = strato(v);
    if (!n || visti.has(n.id)) continue;
    visti.add(n.id);
    out.push(n);
  }
  return out;
}
/** Il registro che sta su disco adesso, senza passare dalle evidenze. Serve a
 *  `salva`, che deve poterlo CONSERVARE quando nessuno glielo passa. */
function stratiSuDisco(vaultPath, courseId) {
  try { return leggiStrati(JSON.parse(fs.readFileSync(percorso(vaultPath, courseId), 'utf-8'))); }
  catch (e) { return []; }
}

/** Scrive l'elenco intero. Torna quello che è stato scritto davvero — potato
 *  dei doppioni e delle voci senza testo — perché il chiamante adotti quello e
 *  non la sua idea di prima. */
function salva(vaultPath, courseId, elenco, strati) {
  if (!corsoValido(courseId)) return { evidenze: [], strati: [], error: 'corso non valido' };
  const viste = new Set();
  const evidenze = [];
  for (const v of (Array.isArray(elenco) ? elenco : [])) {
    const n = normalizzaVoce(v);
    if (!n || viste.has(n.id)) continue;
    viste.add(n.id);
    evidenze.push(n);
  }
  /**
   * ⚠️ IL REGISTRO SI CONSERVA, e la difesa sta QUI perché qui passano tutte.
   *
   * `aggiungi`, `rimuovi`, `colora` e `tratta` scrivono l'elenco da questa
   * funzione: se il registro delle letture non venisse riletto, il primo
   * cambio di colore lo cancellerebbe — e con lui il nome di ogni strato,
   * mentre le evidenze continuerebbero a citarne l'id. È la trappola delle
   * liste bianche («un campo che non è in questa lista non sopravvive a un
   * salvataggio») applicata a una chiave intera del file.
   *
   * Chi VUOLE cambiarlo lo passa; chi non lo nomina se lo ritrova intatto.
   */
  const registro = (strati === undefined) ? stratiSuDisco(vaultPath, courseId) : leggiStrati({ strati });
  const d = dir(vaultPath, courseId);
  /**
   * ⚠️ Niente evidenze e nessun file: non se ne crea uno per dire «zero».
   *
   * Sembrava innocuo e non lo era: un `salva(corso, [])` — che è quello che
   * fa qualunque pulizia, e quello che facevano le mie prove — seminava
   * `_evidenze.json` e `_evidenze.md` vuoti in ogni corso che sfiorava. Nel
   * vault di un utente sono due file che non ha chiesto, in una cartella che
   * apre in Obsidian. Un elenco vuoto e un elenco che non esiste sono la
   * stessa cosa per chi legge (`leggi` torna `[]` in entrambi i casi): la
   * differenza la sente solo chi guarda la cartella.
   * Se il file c'è, invece, lo si riscrive: lì «vuoto» è un fatto nuovo.
   */
  const p = path.join(d, FILE);
  if (!evidenze.length && !registro.length && !fs.existsSync(p)) return { evidenze: [], strati: [], error: '' };
  try { fs.mkdirSync(d, { recursive: true }); } catch (e) { /* c'è già */ }
  /* ⚠️ La chiave `strati` si scrive solo quando c'è qualcosa: un vault che non
     ha mai visto una lettura non deve trovarsi un `"strati": []` comparso dal
     nulla in un file che apre in Obsidian. */
  const corpo = JSON.stringify(registro.length ? { strati: registro, evidenze } : { evidenze }, null, 2) + '\n';
  try { appunti.writeAtomic(p, corpo); }
  catch (e) { return { evidenze: [], strati: [], error: e.message || 'scrittura fallita' }; }
  /* La vista non deve poter far fallire il salvataggio: se il markdown non si
     scrive, le evidenze sono comunque al sicuro. Stesso patto di
     `appunti.reindex`, che tace allo stesso modo. */
  try { appunti.writeAtomic(path.join(d, VISTA), indice(evidenze)); } catch (e) { /* la verità è il JSON */ }
  return { evidenze, strati: registro, error: '' };
}

/**
 * Crea una lettura. L'id nasce dal nome e dall'istante, e **non cambia più**:
 * entra nell'identità delle evidenze che ci vivranno dentro, quindi legarlo al
 * nome vorrebbe dire che rinominare una lettura ne stacca tutti i segni.
 */
function creaStrato(vaultPath, courseId, nome, quando) {
  const letto = leggi(vaultPath, courseId);
  if (letto.error) return { strato: null, strati: [], error: letto.error };
  const n = str(nome).replace(/[\x00-\x1f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
  if (!n) return { strato: null, strati: letto.strati, error: 'una lettura senza nome non si distingue' };
  const creato = str(quando) || new Date().toISOString();
  const id = crypto.createHash('sha1').update(n + ' ' + creato).digest('hex').slice(0, 8);
  const gia = letto.strati.some((s) => s.id === id);
  const registro = gia ? letto.strati : letto.strati.concat([{ id, nome: n, creato }]);
  const scritto = salva(vaultPath, courseId, letto.evidenze, registro);
  if (scritto.error) return { strato: null, strati: letto.strati, error: scritto.error };
  return { strato: { id, nome: n, creato }, strati: scritto.strati, error: '' };
}

/** Cambia il NOME di una lettura. L'id resta, quindi le sue evidenze restano
 *  sue: il nome è come si chiama, non chi è. */
function rinominaStrato(vaultPath, courseId, id, nome) {
  const letto = leggi(vaultPath, courseId);
  if (letto.error) return { strati: [], error: letto.error };
  const n = str(nome).replace(/[\x00-\x1f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
  if (!n) return { strati: letto.strati, error: 'una lettura senza nome non si distingue' };
  const i = letto.strati.findIndex((s) => s.id === str(id));
  if (i < 0) return { strati: letto.strati, error: 'quella lettura non c\'è' };
  const registro = letto.strati.slice();
  registro[i] = Object.assign({}, registro[i], { nome: n });
  const scritto = salva(vaultPath, courseId, letto.evidenze, registro);
  return { strati: scritto.strati, error: scritto.error };
}

/**
 * Toglie una lettura, e dice che cosa ne è stato dei suoi segni.
 *
 * ⚠️ `dove` decide, e non c'è un valore di comodo: `'via'` cancella anche le sue
 * evidenze, un id di un'altra lettura ce le sposta. Cancellare in silenzio le
 * annotazioni di qualcuno perché ha tolto un'etichetta sarebbe la perdita
 * silenziosa dell'invariante 4 — chi chiama deve aver chiesto.
 *
 * ⚠️ Spostandole, gli id CAMBIANO: lo strato è nel seme. Le evidenze si
 * riscrivono con l'id nuovo e la funzione lo dice (`rinati`), perché un rimando
 * `ev:<id>` scritto in un appunto punterà a un'evidenza che non esiste più — ed
 * è meglio saperlo che scoprirlo.
 */
function rimuoviStrato(vaultPath, courseId, id, dove) {
  const k = str(id).trim();
  if (!k) return { tolte: 0, spostate: 0, rinati: [], strati: [], error: 'quale lettura?' };
  const letto = leggi(vaultPath, courseId);
  if (letto.error) return { tolte: 0, spostate: 0, rinati: [], strati: [], error: letto.error };
  if (!letto.strati.some((s) => s.id === k)) {
    return { tolte: 0, spostate: 0, rinati: [], strati: letto.strati, error: 'quella lettura non c\'è' };
  }
  const verso = str(dove);
  if (verso !== 'via' && verso !== '' && !letto.strati.some((s) => s.id === verso)) {
    return { tolte: 0, spostate: 0, rinati: [], strati: letto.strati, error: 'la lettura di destinazione non c\'è' };
  }
  const sue = letto.evidenze.filter((e) => str(e.strato) === k);
  let evidenze;
  const rinati = [];
  if (verso === 'via') {
    evidenze = letto.evidenze.filter((e) => str(e.strato) !== k);
  } else {
    evidenze = letto.evidenze.map((e) => {
      if (str(e.strato) !== k) return e;
      /* Si toglie l'id vecchio e si lascia che `normalizzaVoce` ne calcoli uno
         nuovo dal seme aggiornato: ricalcolarlo qui sarebbe la seconda idea di
         che cosa sia l'identità di un'evidenza. */
      const m = Object.assign({}, e, { strato: verso });
      delete m.id;
      const n = normalizzaVoce(m);
      if (n) rinati.push({ prima: e.id, dopo: n.id });
      return n || e;
    });
  }
  const registro = letto.strati.filter((s) => s.id !== k);
  const scritto = salva(vaultPath, courseId, evidenze, registro);
  if (scritto.error) return { tolte: 0, spostate: 0, rinati: [], strati: letto.strati, error: scritto.error };
  return {
    tolte: verso === 'via' ? sue.length : 0,
    spostate: verso === 'via' ? 0 : sue.length,
    rinati, strati: scritto.strati, error: ''
  };
}

/** Aggiunge, senza duplicare: la stessa parola nello stesso punto ha lo stesso
 *  id, quindi ri-evidenziarla non allunga l'elenco. Se c'era già e arriva con
 *  un colore nuovo, vince il colore nuovo — è il gesto «cambia colore». */
function aggiungi(vaultPath, courseId, voce, quando) {
  const n = normalizzaVoce(voce);
  if (!n) return { evidenza: null, evidenze: [], error: 'evidenza senza testo' };
  if (!n.creato) n.creato = str(quando) || new Date().toISOString();
  const letto = leggi(vaultPath, courseId);
  if (letto.error) return { evidenza: null, evidenze: [], error: letto.error };
  const elenco = letto.evidenze.slice();
  const i = elenco.findIndex((x) => x.id === n.id);
  if (i >= 0) { n.creato = elenco[i].creato || n.creato; elenco[i] = n; }
  else elenco.push(n);
  const scritto = salva(vaultPath, courseId, elenco);
  if (scritto.error) return { evidenza: null, evidenze: [], error: scritto.error };
  return { evidenza: n, evidenze: scritto.evidenze, error: '' };
}

/** Toglie un'evidenza. Dice QUANTE ne ha tolte invece di un sì/no: «non c'era»
 *  e «l'ho tolta» sono due esiti diversi, e chi chiama può dirlo all'utente. */
function rimuovi(vaultPath, courseId, id) {
  const letto = leggi(vaultPath, courseId);
  if (letto.error) return { tolte: 0, evidenze: [], error: letto.error };
  const restano = letto.evidenze.filter((x) => x.id !== str(id));
  const tolte = letto.evidenze.length - restano.length;
  if (!tolte) return { tolte: 0, evidenze: letto.evidenze, error: '' };
  const scritto = salva(vaultPath, courseId, restano);
  if (scritto.error) return { tolte: 0, evidenze: [], error: scritto.error };
  return { tolte, evidenze: scritto.evidenze, error: '' };
}

/** Cambia il colore di un'evidenza. Sta qui e non nel renderer perché il chip
 *  nell'elenco e l'evidenziatura sul testo devono leggere lo stesso valore: se
 *  ognuno tenesse il suo, cambiarne uno lascerebbe l'altro indietro. */
function colora(vaultPath, courseId, id, colore) {
  const letto = leggi(vaultPath, courseId);
  if (letto.error) return { evidenza: null, evidenze: [], error: letto.error };
  const elenco = letto.evidenze.slice();
  const i = elenco.findIndex((x) => x.id === str(id));
  if (i < 0) return { evidenza: null, evidenze: letto.evidenze, error: 'evidenza non trovata' };
  elenco[i] = Object.assign({}, elenco[i], { colore: coloreValido(colore) });
  const scritto = salva(vaultPath, courseId, elenco);
  if (scritto.error) return { evidenza: null, evidenze: [], error: scritto.error };
  return { evidenza: elenco[i], evidenze: scritto.evidenze, error: '' };
}

/** Cambia il TRATTO di un'evidenza — gemello di `colora`, e per la stessa
 *  ragione: il testo evidenziato e il chip nell'elenco devono leggere lo stesso
 *  valore. Un tratto sconosciuto non è un errore: ricade sul default, come fa
 *  ogni voce letta da un file scritto a mano. */
function tratta(vaultPath, courseId, id, tratto) {
  const letto = leggi(vaultPath, courseId);
  if (letto.error) return { evidenza: null, evidenze: [], error: letto.error };
  const elenco = letto.evidenze.slice();
  const i = elenco.findIndex((x) => x.id === str(id));
  if (i < 0) return { evidenza: null, evidenze: letto.evidenze, error: 'evidenza non trovata' };
  elenco[i] = Object.assign({}, elenco[i], { tratto: trattoValido(tratto) });
  const scritto = salva(vaultPath, courseId, elenco);
  if (scritto.error) return { evidenza: null, evidenze: [], error: scritto.error };
  return { evidenza: elenco[i], evidenze: scritto.evidenze, error: '' };
}

/**
 * La vista leggibile, raggruppata per capitolo. Funzione pura e separata da
 * chi scrive: così si prova senza toccare il disco, ed è la stessa divisione
 * che `appunti.indice` ha già.
 */
function indice(evidenze, quando) {
  const lista = Array.isArray(evidenze) ? evidenze : [];
  const per = new Map();
  for (const e of lista) {
    /* Un'evidenza presa su un documento non appartiene a un capitolo: si
       raggruppa per documento e pagina, che è il suo indirizzo. */
    const k = e.materiale
      ? (e.materiale + (e.pagina !== '' && e.pagina != null ? ' — p. ' + e.pagina : ''))
      : (e.capitolo || e.capitoloId || 'Senza capitolo');
    if (!per.has(k)) per.set(k, []);
    per.get(k).push(e);
  }
  let out = '---\ntitle: Parole chiave\ngenerato: ' + (str(quando) || new Date().toISOString()) + '\n---\n\n';
  out += '# Parole chiave\n\n';
  out += '> File generato automaticamente da StudIA a ogni salvataggio. Non modificarlo a mano:\n';
  out += '> la verità è `' + FILE + '`, e questa pagina si riscrive da sola.\n\n';
  out += lista.length === 1 ? '1 parola chiave.\n\n' : lista.length + ' parole chiave.\n\n';
  for (const k of [...per.keys()].sort()) {
    out += '## ' + k + '\n\n';
    for (const e of per.get(k)) {
      out += '- **' + e.exact + '**';
      if (e.prefix || e.suffix) {
        out += ' — *«…' + String(e.prefix).slice(-24) + '[' + e.exact + ']' + String(e.suffix).slice(0, 24) + '…»*';
      }
      out += '\n';
    }
    out += '\n';
  }
  return out;
}

module.exports = {
  FILE, VISTA, CAMPI, TRATTI, TRATTO_DEFAULT,
  dir, percorso, percorsoVista, corsoValido,
  identita, coloreValido, trattoValido, normalizzaVoce,
  leggi, salva, aggiungi, rimuovi, colora, tratta, indice,
  creaStrato, rinominaStrato, rimuoviStrato
};
