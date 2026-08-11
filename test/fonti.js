'use strict';
/**
 * I documenti che entrano in uno zaino (lib/fonti.js).
 *
 * Tre promesse:
 *  1. entrano DENTRO il contenitore — corso o zaino — perché il percorso lo
 *     chiede a `corsi.cartella()` come tutto il resto dei dati dell'utente;
 *  2. prendono un numero che non collide: è quel numero a rendere scrivibile un
 *     rimando `pdf:03#p=7`, e due documenti con lo stesso numero vorrebbero dire
 *     un rimando che apre l'altro — senza errore;
 *  3. quello che non entra lo dice, col motivo. Un import che ingoia in silenzio
 *     lascia l'utente a cercare un file che non c'è.
 *
 *   node test/fonti.js
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const F = require('../lib/fonti');
const Z = require('../lib/zaini');

let ko = 0, ok = 0;
function check(nome, atteso, avuto) {
  const a = JSON.stringify(atteso), b = JSON.stringify(avuto);
  if (a === b) { ok++; return; }
  ko++;
  console.log('  ✗ ' + nome + '\n      atteso: ' + a + '\n      avuto:  ' + b);
}
function sezione(t) { console.log('\n== ' + t); }

const VAULT = fs.mkdtempSync(path.join(os.tmpdir(), 'studia-fonti-'));
const FUORI = fs.mkdtempSync(path.join(os.tmpdir(), 'studia-scrivania-'));
Z.crea(VAULT, 'Diritto pubblico', '2026-08-10');
const ZAINO = 'diritto-pubblico';
const QUANDO = '2026-08-10T10:00:00.000Z';

/** Un finto PDF sulla scrivania: qui conta il nome e l'estensione, non il contenuto. */
function suScrivania(nome, contenuto) {
  const p = path.join(FUORI, nome);
  fs.writeFileSync(p, contenuto || '%PDF-1.4\n%finto\n');
  return p;
}

sezione('Il numero: si guarda il massimo, non quanti sono');
{
  check('un contenitore vuoto comincia da 1', 1, F.prossimoNumero([]));
  check('dopo il 03 viene il 04', 4, F.prossimoNumero(['01 a.pdf', '02 b.pdf', '03 c.pdf']));
  /* ⚠️ Il caso che il conteggio sbaglierebbe: tre file, ma il massimo è 7. */
  check('un buco non fa riusare un numero', 8, F.prossimoNumero(['01 a.pdf', '05 b.pdf', '07 c.pdf']));
  check('i file senza numero non contano', 1, F.prossimoNumero(['dispensa.pdf', 'note.pdf']));
}

sezione('Il nome con cui entra');
{
  check('prende il numero e resta leggibile', '04 dispensa.pdf', F.nomeDestinazione('dispensa.pdf', 4));
  /* Il numero di prima non si eredita, o si accumulerebbe a ogni passaggio. */
  check('un numero già davanti non si somma', '04 dispensa.pdf', F.nomeDestinazione('03 dispensa.pdf', 4));
  check('e nemmeno con altri separatori', '02 appunti.pdf', F.nomeDestinazione('12_appunti.pdf', 2));
  /* ⚠️ Il nome arriva da fuori. Due difese diverse, e vale la pena distinguerle:
     la barra la toglie `path.basename`, che di un percorso tiene solo l'ultimo
     pezzo — è la difesa contro «scrivi fuori dalla cartella»; gli altri
     caratteri li ripulisce la regex, ed è la difesa contro un file system che
     rifiuta il nome. */
  check('un percorso diventa il solo nome del file', '01 b c.pdf', F.nomeDestinazione('a/b:c.pdf', 1));
  check('e i caratteri che il disco rifiuta spariscono', '01 domande e.pdf',
    F.nomeDestinazione('domande? e*.pdf', 1));
  check('nemmeno con «..» si esce', '01 segreti.pdf', F.nomeDestinazione('../../segreti.pdf', 1));
  check('un nome vuoto non produce un file senza nome', '01 documento.pdf', F.nomeDestinazione('.pdf', 1));
}

sezione('L\'import vero, dentro lo zaino');
{
  const a = suScrivania('Dispensa di diritto.pdf');
  const b = suScrivania('02 sentenze.pdf');
  const r = F.importa(VAULT, ZAINO, [a, b], QUANDO);
  check('sono entrati tutti e due', 2, r.copiati.length);
  check('col numero in ordine', ['01 Dispensa di diritto.pdf', '02 sentenze.pdf'],
    r.copiati.map((x) => x.nome));
  const dentro = path.join(VAULT, 'Zaini', ZAINO, 'MATERIALI', 'PDF');
  check('e i file stanno dentro lo zaino', ['01 Dispensa di diritto.pdf', '02 sentenze.pdf'],
    fs.readdirSync(dentro).sort());
  check('non sotto Corsi/', false, fs.existsSync(path.join(VAULT, 'Corsi', ZAINO)));
  /* L'originale resta dov'era: si copia, non si sposta. */
  check('l\'originale sulla scrivania non si tocca', true, fs.existsSync(a));

  /* Una seconda ondata continua la numerazione invece di sovrascrivere. */
  const r2 = F.importa(VAULT, ZAINO, [suScrivania('manuale.pdf')], QUANDO);
  check('la seconda ondata continua a contare', '03 manuale.pdf', r2.copiati[0].nome);
  check('e i documenti sono tre', 3, F.elenco(VAULT, ZAINO).length);

  /* Lo stesso file due volte NON si sovrascrive: sono due copie, con due
     numeri. Sembra un difetto ed è una scelta — chi trascina due volte lo stesso
     documento se ne accorge dall'elenco, mentre una sovrascrittura silenziosa
     porterebbe via le evidenze ancorate al nome di prima. */
  const r3 = F.importa(VAULT, ZAINO, [suScrivania('manuale.pdf')], QUANDO);
  check('lo stesso nome due volte non sovrascrive', '04 manuale.pdf', r3.copiati[0].nome);
}

sezione('Che cosa NON entra, e perché lo dice');
{
  const testo = suScrivania('appunti.txt', 'ciao');
  const r = F.importa(VAULT, ZAINO, [testo, path.join(FUORI, 'mai-esistito.pdf')], QUANDO);
  check('niente è entrato', 0, r.copiati.length);
  check('e i due scarti sono dichiarati', 2, r.scartati.length);
  check('col motivo giusto', ['non è un PDF', 'non si legge'], r.scartati.map((x) => x.motivo));
  check('un contenitore con «..» è rifiutato', true,
    /contenitore/.test(F.importa(VAULT, '..', [suScrivania('x.pdf')], QUANDO).error));
}

sezione('L\'indice per pagina: la forma che la ricerca sa leggere');
{
  const nome = F.elenco(VAULT, ZAINO)[0];
  const r = F.scriviIndice(VAULT, ZAINO, nome, [
    { page: 1, text: '  La   competenza   è  ' },
    { page: 2, text: 'memoria di lavoro' }
  ]);
  check('l\'indice si scrive', '', r.error);
  check('con le sue pagine', 2, r.npages);
  const scritto = JSON.parse(fs.readFileSync(F.percorsoIndice(VAULT, ZAINO, nome), 'utf-8'));
  check('la forma è quella di sempre', ['pdf', 'npages', 'motore', 'pages'], Object.keys(scritto));
  /* ⚠️ Chi ha letto si scrive nell'indice: un vault non deve poter contenere
     indici di tre provenienze senza che si sappia quale. */
  check('e dice chi l\'ha letto', 'pdfjs', scritto.motore);
  check('gli spazi si normalizzano una volta sola', 'La competenza è', scritto.pages[0].text);
  check('`haIndice` lo vede', true, F.haIndice(VAULT, ZAINO, nome));
  check('e per un documento senza indice dice di no', false, F.haIndice(VAULT, ZAINO, 'mai-visto.pdf'));

  const letti = F.leggiIndici(VAULT, ZAINO);
  check('la ricerca lo trova', 1, letti.documenti.length);
  check('col nome del documento', nome, letti.documenti[0].pdf);
  check('e le pagine che hanno testo', [1, 2], letti.documenti[0].pagine.map((p) => p.page));
}

sezione('Un indice rotto non spegne la ricerca');
{
  fs.writeFileSync(path.join(F.dirIndici(VAULT, ZAINO), 'rotto.json'), '{ non json', 'utf-8');
  const letti = F.leggiIndici(VAULT, ZAINO);
  /* «Non lo so» non è «non c'è dentro»: il documento illeggibile si dichiara,
     e gli altri continuano a essere cercabili. */
  check('gli altri restano leggibili', 1, letti.documenti.length);
  check('e quello rotto è dichiarato', ['rotto.json'], letti.illeggibili.map((x) => x.file));
  check('senza far fallire tutto', '', letti.error);
}

sezione('Un contenitore senza indici');
{
  fs.mkdirSync(path.join(VAULT, 'Corsi', 'vuoto'), { recursive: true });
  const r = F.leggiIndici(VAULT, 'vuoto');
  check('nessun documento, nessun errore', [[], ''], [r.documenti, r.error]);
  check('e la cartella non viene creata per il solo fatto di guardare',
    false, fs.existsSync(F.dirIndici(VAULT, 'vuoto')));
}

sezione('Togliere una fonte, e il filo del lavoro che ci sta sopra');
{
  /* Una fonte non è un file: è il capo di un filo a cui sono legate evidenze,
     ritagli, appunti e nodi di mappa, e il legame è il NOME che compare nei
     rimandi `pdf:03#p=7`. Queste prove riguardano quel filo, non il file. */
  const Z2 = 'zaino-rimozioni';
  Z.crea(VAULT, { nome: 'Rimozioni' });
  fs.mkdirSync(F.dirPdf(VAULT, Z2), { recursive: true });
  const uno = path.join(FUORI, 'dispensa.pdf');
  const due = path.join(FUORI, 'altro.pdf');
  fs.writeFileSync(uno, '%PDF-1.4 il contenuto della dispensa');
  fs.writeFileSync(due, '%PDF-1.4 un altro documento');

  /* ⚠️ Da qui in poi la prova è asincrona (`elimina` cestina il file, e chi la
     chiama può farlo con una funzione che aspetta). Il `return` qui sotto
     interrompe l'esecuzione del modulo: è ciò che impedisce alle righe di
     pulizia in fondo al file di cancellare il vault mentre le promesse girano
     ancora. Chi aggiunge sezioni le metta PRIMA di questa. */
  F.importa(VAULT, Z2, [uno]);
  F.scriviIndice(VAULT, Z2, '01 dispensa.pdf', [{ n: 1, t: 'prima pagina' }], 'pdfjs');
  check('la fonte è entrata col suo numero', ['01 dispensa.pdf'], F.elenco(VAULT, Z2).map((m) => m.nome || m));

  return F.elimina(VAULT, Z2, '01 dispensa.pdf').then((r) => {
    check('togliendola non si sbaglia', '', r.error);
    check('il documento non c\'è più', false, fs.existsSync(path.join(F.dirPdf(VAULT, Z2), '01 dispensa.pdf')));
    /* L'indice va via col documento: lasciarlo vuol dire una lente che trova
       pagine di un documento che non c'è, e un click che non apre niente. */
    check('e nemmeno il suo indice', false, F.haIndice(VAULT, Z2, '01 dispensa.pdf'));
    const lapidi = F.rimossi(VAULT, Z2);
    check('resta una traccia, con il nome di allora', ['01 dispensa.pdf'], lapidi.map((x) => x.nome));
    check('e con l\'impronta del CONTENUTO', F.impronta(uno), lapidi[0].impronta);
    check('la traccia sa quante pagine aveva', 1, lapidi[0].pagine);

    /* ⚠️ Il numero di una fonte tolta resta prenotato. Senza, il documento
       importato subito dopo se lo prendeva, e al ritorno della dispensa il
       contenitore aveva due «01»: un rimando `pdf:01` non avrebbe più saputo
       chi aprire — cioè proprio il legame che la traccia esiste per salvare. */
    F.importa(VAULT, Z2, [due]);
    check('il numero della fonte tolta resta prenotato', ['02 altro.pdf'],
      F.elenco(VAULT, Z2).map((m) => m.nome || m));

    const rit = F.importa(VAULT, Z2, [uno]).copiati[0];
    check('lo stesso contenuto che torna riprende il nome di prima', '01 dispensa.pdf', rit.nome);
    check('e l\'importazione lo dichiara, invece di farlo di nascosto', true, rit.tornata);
    check('la traccia sparisce solo quando la fonte è tornata davvero', [], F.rimossi(VAULT, Z2).map((x) => x.nome));

    /* Il riaggancio è sul contenuto: un file DIVERSO con lo stesso nome non
       deve ereditare le evidenze di un altro documento. */
    F.elimina(VAULT, Z2, '02 altro.pdf').then((r2) => {
      check('anche la seconda lascia la sua traccia', '', r2.error);
      const finto = path.join(FUORI, 'altro.pdf');
      fs.writeFileSync(finto, '%PDF-1.4 tutt\'altra roba, stesso nome');
      const c = F.importa(VAULT, Z2, [finto]).copiati[0];
      check('stesso nome ma contenuto diverso: è un documento nuovo', false, c.tornata);
      check('e prende un numero nuovo', '03 altro.pdf', c.nome);

      const d = F.dimentica(VAULT, Z2, F.rimossi(VAULT, Z2)[0].impronta);
      check('una traccia si può dimenticare', [1, ''], [d.tolte, d.error]);
      check('e dimenticarne una che non c\'è lo dice', 'traccia non trovata',
        F.dimentica(VAULT, Z2, 'nessuna').error);

      for (const dd of [VAULT, FUORI]) { try { fs.rmSync(dd, { recursive: true, force: true }); } catch (e) {} }
      console.log('\n' + (ko ? '✗ ' + ko + ' controlli falliti' : '✓ tutti i controlli passati') + ' (' + ok + ' ok)');
      process.exit(ko ? 1 : 0);
    });
  });
}

for (const d of [VAULT, FUORI]) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (e) {} }

console.log('\n' + (ko ? '✗ ' + ko + ' controlli falliti' : '✓ tutti i controlli passati') + ' (' + ok + ' ok)');
process.exit(ko ? 1 : 0);
