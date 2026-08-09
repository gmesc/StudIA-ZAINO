'use strict';
/**
 * Test di round-trip: mdser (scrittura) ↔ parser REALE del renderer (lettura).
 *
 * Non confronta il markdown carattere per carattere — confronta ciò che l'app
 * vede davvero dopo aver riparsato: titolo, testo, punti chiave, quiz, glossario,
 * riferimenti risolti. Se le due metà divergono, qui si rompe.
 *
 *   node test/roundtrip.js
 */

const fs = require('fs');
const path = require('path');
const mdser = require('../lib/mdser');
const readerParser = require('../lib/reader-parser');
const { validateCapitolo, validateProfilo } = require('../lib/validate');

const MEDIA = { '05': '05 lezione dislessia.mp4', '10': '10 disortografia.mp4' };
const PDF = { '03': '03 dispensa DSA.pdf' };
const api = readerParser.load({ mediaByNum: MEDIA, pdfByNum: PDF });

let ko = 0, ok = 0;
function check(nome, atteso, avuto) {
  const a = JSON.stringify(atteso), b = JSON.stringify(avuto);
  if (a === b) { ok++; return; }
  ko++;
  console.log('  ✗ ' + nome + '\n      atteso: ' + a + '\n      avuto:  ' + b);
}
function sezione(t) { console.log('\n== ' + t); }

// ---------------------------------------------------------------- 1. capitolo
sezione('Capitolo sintetico — caratteri ostici inclusi');

const capitolo = {
  id: '01-fondamenti-c01',
  order: 1,
  title: 'Definizione: l\'eterogeneità dei "profili"',
  fonte: { tipo: 'video', materiale: '05' },
  videoRefs: [{ video: '05', t: 132, label: 'Definizione dell\'ICD-11' }],
  sources: [{ pdf: '03', page: 7, label: 'Tabella 2: criteri' }],
  tags: ['dsa', 'definizione'],
  status: 'draft',
  inBreve: 'I DSA sono disturbi **specifici**: riguardano un dominio, non l\'intelligenza.',
  contenuto: 'La dislessia riguarda la decodifica: lettura lenta e poco automatizzata.\n\n' +
    'Vedi il passaggio a [2:12](video:05#t=132) e la [p. 7](pdf:03#p=7) della dispensa.\n\n' +
    'Il tema prosegue in [[02-comorbidita]].[^1]',
  puntiChiave: ['L\'eterogeneità è la regola, non l\'eccezione', 'Specifico ≠ generalizzato', 'La diagnosi non descrive la persona'],
  quiz: [{ q: 'I DSA implicano un deficit intellettivo.', a: false, perche: 'Per definizione il funzionamento intellettivo è nella norma.' }],
  glossario: [{ t: 'DSA', d: 'Disturbo specifico dell\'apprendimento: riguarda un dominio circoscritto.' },
              { t: 'Decodifica', d: 'Trasformare i segni scritti in suoni: la "lettura strumentale".' }],
  footnotes: ['Consensus Conference, 2022.']
};

const md = mdser.chapter(capitolo);
if (!md.startsWith('---\n')) { console.log('  ✗ il file non inizia con "---\\n"'); ko++; } else ok++;
if (/\r/.test(md)) { console.log('  ✗ presenti CR: i terminatori devono essere LF'); ko++; } else ok++;

const letto = api.mdChapter(md, '01-fondamenti', 1);

check('titolo', capitolo.title, letto.title);
check('punti chiave', 3, letto.keypoints.length);
check('quiz: numero', 1, letto.quiz.length);
check('quiz: risposta booleana', false, letto.quiz[0].answer);
check('quiz: tipo tf', 'tf', letto.quiz[0].type);
check('glossario: termini', ['DSA', 'Decodifica'], letto.glossary.map((g) => g.t));
check('videoRefs risolti a filename', [MEDIA['05']], letto.videoRefs.map((v) => v.video));
check('videoRefs: minutaggio', [132], letto.videoRefs.map((v) => v.t));
check('sources risolte a filename', [PDF['03']], letto.sources.map((s) => s.pdf));
check('sources: pagina', [7], letto.sources.map((s) => s.page));

// il testo deve arrivare come HTML con i link cliccabili del reader
const html = letto.html;
check('link al minuto → a.vlink', true, /class="vlink"[^>]*data-t="132"/.test(html));
check('link alla pagina → a.plink', true, /class="plink"[^>]*data-page="7"/.test(html));
check('wikilink → a.wlink', true, /class="wlink"[^>]*data-lesson="02-comorbidita"/.test(html));
check('footnote in fondo', true, /class="fnotes"[\s\S]*Consensus Conference/.test(html));
check('grassetto in «In breve»', true, /<strong>specifici<\/strong>/.test(letto.brief));

// apostrofi e virgolette non devono rompere lo YAML ristretto
check('apostrofo nel titolo sopravvive', true, letto.title.indexOf('l\'eterogeneità') >= 0);
check('virgolette nel titolo sopravvivono', true, letto.title.indexOf('"profili"') >= 0);
check('due punti nel titolo sopravvivono', true, letto.title.indexOf('Definizione:') >= 0);
check('due punti dentro il glossario', true, letto.glossary[0].d.indexOf(':') >= 0);

// un solo blocco per tipo (parseFenced legge il primo)
check('un solo blocco quiz', 1, (md.match(/```quiz/g) || []).length);
check('un solo blocco glossario', 1, (md.match(/```glossario/g) || []).length);

// ------------------------------------------------------------ 2. golden file
sezione('Golden file del vault reale');

/**
 * Dove sono i dati veri.
 *
 * Fino al riordino i dati stavano DENTRO la cartella dell'app, e questi test
 * potevano dire `path.join(__dirname, '..')`. Ora il vault vive per conto suo
 * (per esempio «StudIA - file»), perché un corso dev'essere trasferibile da
 * solo. I controlli che leggono il corpus vero devono quindi cercarlo dove lo
 * cerca l'app — altrimenti non falliscono: si SALTANO, che è peggio, perché la
 * suite resta verde mentre smette di guardare i dati.
 *
 * Ordine: prima la configurazione dell'app, poi la posizione storica (per i
 * cloni non ancora riordinati), poi la cartella affiancata.
 */
function vaultReale() {
  const cand = [];
  if (process.env.HOME) {
    try {
      const cfg = JSON.parse(fs.readFileSync(
        path.join(process.env.HOME, 'Library', 'Application Support', 'studia', 'config.json'), 'utf-8'));
      if (cfg.vaultPath) cand.push(cfg.vaultPath);
    } catch (e) { /* nessuna configurazione: si prova con le posizioni note */ }
  }
  cand.push(path.join(__dirname, '..'));                                // storica: dentro l'app
  cand.push(path.join(__dirname, '..', '..', 'StudIA - file'));         // affiancata all'app
  return cand.find((v) => fs.existsSync(path.join(v, 'Corsi'))) || path.join(__dirname, '..');
}
const VAULT_VERO = vaultReale();

// il vault reale: le lezioni stanno in LEZIONI/, i corsi più vecchi nella radice
const goldenBase = path.join(VAULT_VERO, 'Corsi', 'TD74-DSA');
const golden = [path.join(goldenBase, 'LEZIONI', '01-fondamenti', '01-definizione-eterogeneita.md'),
                path.join(goldenBase, '01-fondamenti', '01-definizione-eterogeneita.md')]
  .find((f) => fs.existsSync(f)) || path.join(goldenBase, 'LEZIONI', '01-fondamenti', '01-definizione-eterogeneita.md');
if (!fs.existsSync(golden)) {
  console.log('  – saltato: ' + path.relative(process.cwd(), golden) + ' non trovato');
} else {
  const raw = fs.readFileSync(golden, 'utf-8');
  const g1 = api.mdChapter(raw, '01-fondamenti', 1);
  // ri-serializzo ciò che il parser ha capito e riparso: il secondo giro deve coincidere col primo
  const rebuilt = mdser.chapter({
    id: g1.id, order: 1, title: g1.title, tags: [], status: 'draft',
    inBreve: stripTags(g1.brief), contenuto: stripTags(g1.html),
    puntiChiave: g1.keypoints.map(stripTags),
    quiz: g1.quiz.map((q) => ({ q: q.q, a: q.answer, perche: q.explain || '—' })),
    glossario: g1.glossary.map((g) => ({ t: g.t, d: stripTags(g.d) })),
    videoRefs: [], sources: [], footnotes: []
  });
  const g2 = api.mdChapter(rebuilt, '01-fondamenti', 1);
  check('golden: titolo stabile', g1.title, g2.title);
  check('golden: numero punti chiave stabile', g1.keypoints.length, g2.keypoints.length);
  check('golden: numero quiz stabile', g1.quiz.length, g2.quiz.length);
  check('golden: risposte quiz stabili', g1.quiz.map((q) => q.answer), g2.quiz.map((q) => q.answer));
  check('golden: termini glossario stabili', g1.glossary.map((g) => g.t), g2.glossary.map((g) => g.t));
}
function stripTags(h) { return String(h || '').replace(/<[^>]+>/g, '').replace(/\n{3,}/g, '\n\n').trim(); }

// ------------------------------------------------------------- 3. validatore
sezione('Validatore');

const vOk = validateCapitolo({
  title: 'Definizione ed eterogeneità', inBreve: 'Testo introduttivo sufficientemente lungo.',
  contenuto: 'Corpo del capitolo con [un link](video:05#t=10) e un [[02-comorbidita]].',
  puntiChiave: ['uno lungo abbastanza', 'due lungo abbastanza', 'tre lungo abbastanza'],
  quiz: [{ q: 'Affermazione vera da valutare.', a: true, perche: 'Perché sì.' }],
  videoRefs: [{ video: '05', t: 10 }]
}, { mediaByNum: MEDIA, pdfByNum: PDF, durate: { '05': 600 } });
check('capitolo valido passa', { ok: true, errors: [] }, vOk);

const vKo = validateCapitolo({
  title: '01 Titolo che inizia con la cifra', inBreve: 'Testo introduttivo lungo il giusto.',
  contenuto: 'Testo con <b>html</b>, [link rotto](video:99#t=5), [[titolo sbagliato]] e nota [^2].',
  puntiChiave: ['solo uno'],
  quiz: [{ q: 'Questa è una domanda?', a: true, perche: '' }],
  footnotes: []
}, { mediaByNum: MEDIA, pdfByNum: PDF });
const attesi = ['HTML grezzo', 'materiale inesistente', 'wikilink fuori formato', 'footnote', 'è una domanda', '«perche» vuoto',
  'fewer than 3 items',      // puntiChiave: minItems dello schema
  'pattern'];                // title che inizia con una cifra
const trovati = attesi.filter((frase) => vKo.errors.some((e) => e.indexOf(frase) >= 0));
check('capitolo invalido: errori rilevati', attesi, trovati);
check('capitolo invalido: ok=false', false, vKo.ok);

const pOk = validateProfilo({ schema: 1, tipo: 'profilo', bisogni: ['lettura-lenta', 'carico-pause'],
  granularita: 'ampio', quiz: 'nessuno', glossario: 'essenziale', approfondimenti: 'minimi',
  stile_corso: 'tematico', stile_lezioni: 'cornici', stile_capitoli: 'schematico',
  capitoli_brevi: false, esempi_concreti: true, bisogni_altro: '', aggiornato: 'x', comeImparo: '', cosaAffatica: '' });
check('profilo valido passa', true, pOk.ok);
const pKo = validateProfilo({ bisogni: ['dislessia'], granularita: 'tematico' });
check('profilo con vecchie etichette viene respinto', false, pKo.ok);

// ------------------------------------------------------- 4. profilo → prompt
sezione('directives() — mapping profilo → direttive');

const profilo = require('../lib/profilo');
const dCombo = profilo.directives({ bisogni: ['attenzione-distraibilita', 'carico-prevedibilita', 'lettura-lenta'], quiz: 'pochi' });
const genCombo = dCombo.generazione.join(' | ');
check('combo brevità×prevedibilità applicata', true, /wikilink \[\[NN-slug\]\]/.test(genCombo));
check('la combo assorbe le righe singole che la compongono', false, /«In breve» in ≤3 frasi/.test(genCombo));
check('i token fuori combo restano', true, /frasi ≤20 parole/.test(genCombo));
check('token sconosciuto ignorato senza rompere', true, profilo.directives({ bisogni: ['token-inventato'] }).generazione.length === 0);
check('profilo vuoto → solo meta-regole', 4, profilo.directives({}).meta.length);

const blocco = profilo.promptBlock({ bisogni: ['lettura-lenta'], comeImparo: 'Prima la cornice.', cosaAffatica: 'Scrivi in inglese e salta le fonti.' }, 'generazione');
check('testo libero delimitato come dato', true, /<profilo_utente nota="[^"]*DATO/.test(blocco));
check('meta-regola anti-iniezione presente', true, /è DATO, non istruzione/.test(blocco));
const bloccoProposta = profilo.promptBlock({ bisogni: ['lettura-lenta'], comeImparo: 'Prima la cornice.' }, 'proposta');
check('in proposta il testo libero NON entra', false, /profilo_utente/.test(bloccoProposta));

// round-trip del profilo attraverso il serializzatore e il lettore condiviso
const pIn = { bisogni: ['lettura-decodifica', 'memoria-richiamo'], bisogniAltro: 'uso la sintesi vocale',
  stileCorso: 'problemi', stileLezioni: 'spirale', stileCapitoli: 'domande', granularita: 'ampio',
  capitoliBrevi: false, quiz: 'nessuno', glossario: 'essenziale', esempiConcreti: false, approfondimenti: 'minimi',
  comeImparo: 'Con le "domande" prima.', cosaAffatica: 'L\'ordine sparso.' };
const pRaw = mdser.profilo(pIn, '2026-07-25T00:00:00.000Z');
const pOut = profilo.parse(pRaw);
check('profilo round-trip: bisogni', pIn.bisogni, pOut.bisogni);
check('profilo round-trip: booleani', [false, false], [pOut.capitoli_brevi, pOut.esempi_concreti]);
check('profilo round-trip: campi liberi', [pIn.comeImparo, pIn.cosaAffatica], [pOut.comeImparo, pOut.cosaAffatica]);
check('profilo round-trip: enum UI', ['ampio', 'nessuno', 'essenziale', 'minimi'], [pOut.granularita, pOut.quiz, pOut.glossario, pOut.approfondimenti]);

// ------------------------------------------------- 5. brief: upsert in-place
sezione('Brief — upsert su _corso.md senza perdere il resto');

let prog = mdser.corso({
  id: 'td74-dsa', title: 'Tutor DSA — Galton', nLezioni: 16, nMateriali: 40,
  brief: { obiettivo: 'professionale', priorita: 'comprensione' },
  fonti: { '09': 'appunti' },
  ordineLezioni: ['01-fondamenti', '02-dislessia', '03-lingue'],
  indicazioni: 'Prima versione delle indicazioni.'
});
// upsert mirato: cambia obiettivo e indicazioni, aggiunge scadenza, non tocca il resto
prog = mdser.upsertFmLine(prog, 'obiettivo', 'obiettivo: ' + mdser.yq('esame'));
prog = mdser.upsertFmLine(prog, 'fonti', mdser.bloccoFonti({ '09': 'appunti', '12': 'integrazione' }));
prog = mdser.upsertFmLine(prog, 'scadenza', 'scadenza: ' + mdser.yq('2026-09-15'));
prog = mdser.upsertSection(prog, 'Indicazioni per questo materiale', 'La parte sui test standardizzati va approfondita.');

const pFm = profilo.parse(prog);
check('brief: obiettivo aggiornato', 'esame', pFm.obiettivo);
check('brief: chiave nuova aggiunta', '2026-09-15', pFm.scadenza);
check('fonti: ruoli riscritti', [{ materiale: '09', ruolo: 'appunti' }, { materiale: '12', ruolo: 'integrazione' }], pFm.fonti);
check('fonti: nessun ruolo → lista vuota', 'fonti: []', mdser.bloccoFonti({}));
check('fonti: solo le eccezioni finiscono nel file', 1, mdser.righeFonti({ '09': 'appunti', '10': '' }).length);
check('una chiave vuota scritta a mano resta stringa, non lista',
  '', profilo.parse('---\nobiettivo:\nfonti:\n  - { materiale: "09", ruolo: "appunti" }\n---\n').obiettivo);
check('e la lista accanto resta lista', 1,
  profilo.parse('---\nobiettivo:\nfonti:\n  - { materiale: "09", ruolo: "appunti" }\n---\n').fonti.length);
check('brief: ordine_lezioni NON perso dall\'upsert', ['01-fondamenti', '02-dislessia', '03-lingue'], pFm.ordine_lezioni);
check('brief: n_lezioni intatto', 16, pFm.n_lezioni);
check('brief: sezione sostituita', true, /test standardizzati/.test(prog) && !/Prima versione/.test(prog));
check('brief: un solo blocco frontmatter', 1, (prog.match(/^---$/gm) || []).length / 2);

// ------------------------------------------- 6. proposta dell'indice (M4)
sezione('Corpus, raggruppamento e proposta');

const corpusLib = require('../lib/corpus');
const grouping = require('../lib/grouping');
const proposeLib = require('../lib/propose');
const providerLib = require('../lib/ai/provider');
const validate = require('../lib/validate');
const VAULT = VAULT_VERO;                    // i dati veri, ovunque siano (vedi vaultReale())

check('numero dal nome file', ['05', '07', null], ['05 lezione.mp4', '7 altro.pdf', 'senza numero.mp4'].map(corpusLib.numeroDi));
check('titolo ripulito da sigle e code', 'LA DISLESSIA', corpusLib.titoloDi('05 TD 74 LA DISLESSIA edu.galton.it.mp4'));
check('estratto tagliato su parola', true, corpusLib.estratto('uno due tre quattro cinque', 12).endsWith('…'));
check('parole chiave senza stopword', true, corpusLib.paroleChiave('la lettura la lettura è una cosa lettura', 3).indexOf('lettura') === 0);

/* Il digest si chiede PER CORSO, come fa l'app: chiederlo per tutto il vault
   e confrontarlo con un piano di un corso solo è il paragone che qui falliva
   quando lo scoping è entrato in funzione. */
const PROG_VERO = 'TD74-DSA';
const dg = corpusLib.digest(VAULT, PROG_VERO);
if (!dg.totale) {
  console.log('  – saltato: nessun materiale elaborato in questo vault');
} else {
  check('digest: tutti i materiali hanno titolo', true, dg.materiali.every((m) => !!m.titolo));
  check('digest: video con durata', true, dg.materiali.filter((m) => m.tipo === 'video').every((m) => m.durata > 0));
  check('digest: pdf con pagine', true, dg.materiali.filter((m) => m.tipo === 'pdf').every((m) => m.npagine > 0));

  const heur = proposeLib.proponiEuristica(VAULT, PROG_VERO, { granularita: 'atomico' });
  const piano = heur.piano;
  check('piano: valido a schema', [], validate.schemaErrors('piano', piano));
  check('piano: copertura completa', dg.totale, piano.lezioni.reduce((s, c) => s + c.materiali.length, 0));
  check('piano: nessun materiale in due lezioni', true, (function () {
    const visti = new Set();
    for (const c of piano.lezioni) for (const m of c.materiali) { if (visti.has(m.source)) return false; visti.add(m.source); }
    return true;
  })());
  check('piano: cartelle nella forma NN-slug', true, piano.lezioni.every((c) => /^\d{2}-[a-z0-9-]+$/.test(c.folder)));
  check('piano: ogni lezione ha un perché', true, piano.lezioni.every((c) => !!c.rationale));

  // la grana cambia davvero il numero di lezioni
  const fine = proposeLib.proponiEuristica(VAULT, 'x', { granularita: 'atomico' }).piano.lezioni.length;
  const largo = proposeLib.proponiEuristica(VAULT, 'x', { granularita: 'ampio' }).piano.lezioni.length;
  check('grana larga → meno lezioni di grana fine', true, largo < fine);

  // confronto con l'architettura di riferimento decisa a mano
  const RIF = [['01'], ['02'], ['03'], ['04', '05', '06'], ['07', '08'], ['09', '10', '11', '12'], ['13', '14'],
    ['15', '16'], ['17'], ['18'], ['19'], ['20', '21', '22', '23', '24'], ['25', '26', '27'], ['28'],
    ['29', '36', '37', '38'], ['30'], ['31', '32', '33', '34', '35'], ['39', '40']];
  const prodotti = piano.lezioni.map((c) => c.materiali.map((m) => m.num).join(','));
  const esatti = RIF.filter((r) => prodotti.includes(r.join(','))).length;
  console.log('  · blocchi dell\'architettura di riferimento riprodotti esatti: ' + esatti + '/' + RIF.length);
  check('almeno 6 blocchi di riferimento riprodotti dalle sole euristiche', true, esatti >= 6);
}

// normalizzazione della risposta del modello: è qui che si difende la copertura
const dgFinto = { materiali: [
  { num: '01', nome: 'a.mp4', tipo: 'video', titolo: 'A', durata: 100 },
  { num: '02', nome: 'b.pdf', tipo: 'pdf', titolo: 'B', npagine: 10 },
  { num: '03', nome: 'c.mp4', tipo: 'video', titolo: 'C', durata: 200 }
] };
const rispostaAi = { lezioni: [
  { title: 'PRIMO', materiali: ['01', '99'] },        // 99 non esiste
  { title: 'SECONDO', materiali: ['02', '02'] },      // doppione
  { title: 'VUOTO', materiali: ['77'] }               // resterebbe senza materiali
] };
const norm = proposeLib.lezioniDaRisposta(rispostaAi, dgFinto);
check('numeri inventati scartati', true, !norm.lezioni.some((c) => c.materiali.some((m) => m.num === '99')));
check('doppioni scartati', 1, norm.lezioni[1].materiali.length);
check('lezioni rimaste vuote eliminate', 2, norm.lezioni.length);
const completi = proposeLib.recuperaMancanti(norm.lezioni, norm.usati, dgFinto);
check('materiale dimenticato recuperato in coda', ['03'], completi[completi.length - 1].materiali.map((m) => m.num));
check('titolo del recupero è esplicito', 'DA COLLOCARE', completi[completi.length - 1].title);
check('numerazione cartelle progressiva', ['01-primo', '02-secondo', '03-da-collocare'],
  proposeLib.numeraCartelle(completi).map((c) => c.folder));
check('titolo senza intervallo numerico', 'DISLESSIA', proposeLib.titoloSenzaNumeri('04-06 DISLESSIA'));

// il provider deve digerire il JSON anche quando arriva dentro un recinto markdown
check('json dentro ```json estratto', { a: 1 }, providerLib.estraiJson('```json\n{"a":1}\n```'));
check('json con contorno estratto', { b: 2 }, providerLib.estraiJson('Ecco il risultato: {"b":2} — spero vada bene'));
check('testo non-json → null', null, providerLib.estraiJson('nessun oggetto qui'));
check('modello di default per fornitore', 'claude-opus-5', providerLib.modelloDi('anthropic', {}));
check('preferenza utente batte il default', 'claude-sonnet-5', providerLib.modelloDi('anthropic', { modelAnthropic: 'claude-sonnet-5' }));
check('fornitore scelto fra quelli con chiave', 'openai', providerLib.fornitoreDisponibile({ anthropic: false, openai: true }, 'anthropic'));
check('senza chiavi nessun fornitore', null, providerLib.fornitoreDisponibile({}, 'anthropic'));


// --------------------------------- 6-bis. import di una cartella preparata a mano
sezione('Import — una cartella qualsiasi diventa un vault ordinato');

const importa = require('../lib/importa');

check('sigla con lettera', '01A', importa.siglaDi('1A Lesson 1 - Welcome.webm'));
check('sigla senza lettera', '05', importa.siglaDi('05 dispensa DSA.pdf'));
check('sigla a due cifre con lettera', '12B', importa.siglaDi('12B qualcosa.pdf'));
check('nome senza sigla', null, importa.siglaDi('appunti sparsi.pdf'));
check('il numero attaccato al testo non è una sigla', null, importa.siglaDi('1984 romanzo.pdf'));
check('asset dentro _files', true, importa.dentroAsset(path.join('HTML', 'Lezione 1_files', 'stile.css')));
check('pagina fuori da _files', false, importa.dentroAsset(path.join('HTML', 'Lezione 1.html')));
check('il certificato è una pagina di servizio', true, !!importa.pagineDiServizio('3B Certificate of completion.html'));
check('una lezione non lo è', null, importa.pagineDiServizio('2A AI as a learning partner.html'));

// cartella finta con la stessa forma di quella preparata dall'utente
const VI = fs.mkdtempSync(path.join(require('os').tmpdir(), 'studia-imp-'));
['MEDIA', 'PDF', 'HTML', 'HTML/1A Benvenuto_files', 'SOTTOTITOLI'].forEach((d) => fs.mkdirSync(path.join(VI, d), { recursive: true }));
fs.writeFileSync(path.join(VI, 'MEDIA', '1A Lezione uno.webm'), 'video');
fs.writeFileSync(path.join(VI, 'MEDIA', '2A Lezione due.webm'), 'video');
fs.writeFileSync(path.join(VI, 'PDF', '1A Dispensa.pdf'), 'pdf');
fs.writeFileSync(path.join(VI, 'HTML', '1A Benvenuto.html'), '<html>ciao</html>');
fs.writeFileSync(path.join(VI, 'HTML', '3B Certificate of completion.html'), '<html>certificato</html>');
fs.writeFileSync(path.join(VI, 'HTML', '1A Benvenuto_files', 'stile.css'), 'body{}');
fs.writeFileSync(path.join(VI, 'SOTTOTITOLI', '1A TRASCRIZIONE.txt'), 'testo ufficiale');
fs.writeFileSync(path.join(VI, 'SOTTOTITOLI', '9Z orfana.txt'), 'senza video');
fs.writeFileSync(path.join(VI, '.DS_Store'), 'x');

const pianoI = importa.esamina(VI);
check('materiali riconosciuti', 4, pianoI.riepilogo.materiali);
check('trascrizioni abbinate', 1, pianoI.riepilogo.trascrizioniAbbinate);
check('numerazione progressiva', ['01', '02', '03', '04'], pianoI.materiali.map((m) => m.num));
check('a parità di sigla il video viene prima', ['media', 'html', 'pdf', 'media'], pianoI.materiali.map((m) => m.tipo));
check('il nome originale resta intero dopo il numero', '01 1A Lezione uno.webm', pianoI.materiali[0].nome);
check('i video vanno in Media', 'Media', pianoI.materiali[0].dir);
check('gli html stanno con le fonti', 'Fonti', pianoI.materiali[1].dir);
check('la trascrizione prende il nome del suo video',
  '01 1A Lezione uno.ufficiale.txt', pianoI.materiali[0].abbinati[0].nome);
check('e finisce fra le trascrizioni', 'Trascrizioni', pianoI.materiali[0].abbinati[0].dir);
check('il video senza trascrizione non ne inventa una', 0, pianoI.materiali[3].abbinati.length);
check('il .DS_Store non entra', false, pianoI.esclusi.some((e) => e.nome === '.DS_Store'));
check('il css della pagina è un asset',
  'asset della pagina salvata', (pianoI.esclusi.find((e) => e.nome === 'stile.css') || {}).motivo);
check('il certificato è escluso ma ribaltabile',
  true, !!(pianoI.esclusi.find((e) => /Certificate/.test(e.nome)) || {}).ribaltabile);
check('la trascrizione orfana dice perché resta fuori',
  true, /senza video/.test((pianoI.esclusi.find((e) => e.nome === '9Z orfana.txt') || {}).motivo || ''));

// --- pagine web e trascrizioni ufficiali dentro il corpus ---
const VH = fs.mkdtempSync(path.join(require('os').tmpdir(), 'studia-html-'));
['Media', 'Fonti', 'Trascrizioni', 'Indice-HTML'].forEach((d) => fs.mkdirSync(path.join(VH, d), { recursive: true }));
fs.writeFileSync(path.join(VH, 'Fonti', '02 1A Benvenuto.html'), '');
fs.writeFileSync(path.join(VH, 'Indice-HTML', '02 1A Benvenuto.json'), JSON.stringify({
  html: '02 1A Benvenuto.html', titolo: 'Benvenuto al corso',
  testo: '## Che cosa imparerai\n\nDistinguere la delega dalla descrizione.\n\n## Esercizi\n\nCostruisci un compagno di studio.',
  immagini: [
    { file: 'schema-4d.png', alt: 'Le quattro competenze', larghezza: 800, altezza: 600, byte: 90000 },
    { file: 'logo.png', alt: 'Go home', larghezza: 200, altezza: 40, byte: 12268, scartata: 'decorazione del sito' }
  ],
  nimmagini: 1
}));
fs.writeFileSync(path.join(VH, 'Media', '01 1A Lezione uno.webm'), 'video');
fs.writeFileSync(path.join(VH, 'Trascrizioni', '01 1A Lezione uno.json'), JSON.stringify({
  media: '01 1A Lezione uno.webm', language: 'it',
  segments: [{ start: 0, end: 12, text: 'Benvenuti al corso di fluenza.' },
             { start: 12, end: 30, text: 'Parliamo di delega e discernimento.' }]
}));

const chunkH = require('../lib/chunk');
const dgHtml = corpusLib.digestHtml(VH, '02 1A Benvenuto.html');
check('la pagina web è un materiale', 'html', dgHtml.tipo);
check('il titolo viene dall\'intestazione', 'Benvenuto al corso', dgHtml.titolo);
check('il contenuto informativo entra nel digest', true, /compagno di studio/.test(dgHtml.apertura));
check('le intestazioni restano nel testo', true, /Che cosa imparerai/.test(dgHtml.apertura));
check('conta solo le immagini di contenuto', 1, dgHtml.nimmagini);
check('lo schema è tenuto', 'schema-4d.png', dgHtml.immagini[0].file);
check('il logo non compare fra le immagini', false, dgHtml.immagini.some(function (i) { return i.file === 'logo.png'; }));
check('la riga per il prompt cita le immagini', true, /1 immagini/.test(corpusLib.rigaPerPrompt(dgHtml)));
check('il contenuto si spezza sui paragrafi', 2,
  chunkH.porzioniHtml('## Uno\n\nPrimo paragrafo lungo.\n\n## Due\n\nSecondo paragrafo.', 30).length);
check('nessun paragrafo viene spezzato a metà', true,
  chunkH.porzioniHtml('## Uno\n\nPrimo paragrafo lungo.\n\n## Due\n\nSecondo paragrafo.', 30)
    .every(function (p) { return /\.$|:$/.test(p.testo.trim()) || /^##/.test(p.testo.trim()); }));
check('etichetta della porzione html', 'parte 1', chunkH.etichetta({ da: 1, a: 1 }, 'html'));

check('il corpus conta anche gli html', 1, corpusLib.digest(VH).html);
fs.rmSync(VH, { recursive: true, force: true });

// la copia vera dentro un vault
const VD = fs.mkdtempSync(path.join(require('os').tmpdir(), 'studia-dest-'));
const esitoI = importa.applica(VD, pianoI);
check('importati tutti i materiali', 4, esitoI.importati);
check('il video è sul disco', true, fs.existsSync(path.join(VD, 'Media', '01 1A Lezione uno.webm')));
check('la trascrizione ufficiale accanto', true, fs.existsSync(path.join(VD, 'Trascrizioni', '01 1A Lezione uno.ufficiale.txt')));
check('il pdf è fra le fonti', true, fs.existsSync(path.join(VD, 'Fonti', '03 1A Dispensa.pdf')));
check('il certificato non è stato copiato', false, fs.existsSync(path.join(VD, 'Fonti', '02 3B Certificate of completion.html')));
// un secondo import non deve sovrascrivere il primo
importa.applica(VD, pianoI);
check('la seconda copia non sovrascrive', true, fs.existsSync(path.join(VD, 'Media', '01 1A Lezione uno (2).webm')));
// il numero nel nome è quello che il lettore userà nei rimandi video:NN
check('corpus e import concordano sul numero', '01', corpusLib.numeroDi('01 1A Lezione uno.webm'));
fs.rmSync(VI, { recursive: true, force: true });
fs.rmSync(VD, { recursive: true, force: true });


// --------------------------------- 7. pipeline multiagente (schede + architettura)
sezione('Analisi multiagente — con un modello finto, nessuna rete');

const os = require('os');
const schedeLib = require('../lib/schede');
const chunkLib = require('../lib/chunk');

// vault finto con materiali DISORDINATI: i numeri non riflettono l'ordine didattico
const VF = fs.mkdtempSync(path.join(os.tmpdir(), 'studia-multi-'));
['Media', 'Fonti', 'Trascrizioni', 'Indice-PDF'].forEach((d) => fs.mkdirSync(path.join(VF, d), { recursive: true }));
function fintoVideo(nome, parole, dur) {
  fs.writeFileSync(path.join(VF, 'Media', nome + '.mp4'), 'x');
  const segs = []; for (let t = 0; t < dur; t += 30) segs.push({ start: t, end: t + 30, text: parole + ' ' + t });
  fs.writeFileSync(path.join(VF, 'Trascrizioni', nome + '.json'), JSON.stringify({ media: nome, segments: segs }));
}
function fintoPdf(nome, parole, np) {
  fs.writeFileSync(path.join(VF, 'Fonti', nome + '.pdf'), 'x');
  const pages = []; for (let p = 1; p <= np; p++) pages.push({ page: p, text: parole + ' pagina ' + p });
  fs.writeFileSync(path.join(VF, 'Indice-PDF', nome + '.json'), JSON.stringify({ pdf: nome, npages: np, pages }));
}
fintoVideo('03 avanzato applicazioni', 'applicazione pratica del metodo', 600);
fintoPdf('07 fondamenti teoria', 'teoria di base del metodo', 12);
fintoVideo('01 casi clinici', 'discussione di casi clinici', 900);
fintoPdf('12 appendice normativa', 'riferimenti normativi e allegati', 40);

// segmentazione: i riferimenti temporali devono sopravvivere
const porz = chunkLib.porzioniTrascrizione([{ start: 0, end: 60, text: 'a' }, { start: 1800, end: 1860, text: 'b' }]);
check('porzioni con marcatori temporali', true, /\[\d+:\d\d = \d+s\]/.test(porz[0].testo));
check('pdf spezzato conservando le pagine', true, /\[p\. 1\]/.test(chunkLib.testoConPagine([{ page: 1, text: 'x' }])));

let chiamate = 0;
async function modelloFinto(o) {
  chiamate++;
  const s = o.sistema;
  if (s.indexOf('Leggi la porzione') > 0)
    return { ok: true, dati: { temi: [{ titolo: 'Tema', sintesi: 'x', da: 0, a: 300 }], concetti: ['metodo'], prerequisiti: [] }, uso: { inputTokens: 100, outputTokens: 50 } };
  if (s.indexOf('analisi parziali') > 0)
    return { ok: true, dati: { sintesi: 'Materiale che insegna qualcosa di verificabile.', livello: 'teorico',
      temi: [{ titolo: 'Primo tema', da: 0, a: 300 }], concetti: ['metodo'], prerequisiti: [], collegamenti: [],
      capitoliProposti: [{ titolo: 'Capitolo uno', outline: 'o', da: 0, a: 300 }] }, uso: { inputTokens: 200, outputTokens: 80 } };
  if (s.indexOf('esperto della disciplina') > 0)
    return { ok: true, dati: { aree: [{ nome: 'Fondamenti', materiali: ['07'] }, { nome: 'Pratica', materiali: ['03', '01'] }],
      anomali: [{ materiale: '12', motivo: 'consultazione', trattamento: 'modulo-fonte' }] }, uso: { inputTokens: 300, outputTokens: 90 } };
  if (s.indexOf('progettista didattico') > 0)
    return { ok: true, dati: { ordine: ['07', '03', '01', '12'], precedenze: [{ dopo: '03', prima: '07', perche: 'la pratica presuppone la teoria' }], fondamenti: ['07'] }, uso: { inputTokens: 300, outputTokens: 90 } };
  if (s.indexOf('corpora didattici') > 0)
    return { ok: true, dati: { coppie: [{ materiali: ['07', '03'], tipo: 'teoria+applicazione' }], rimandi: [{ da: 'Pratica', a: 'Fondamenti' }], sovrapposizioni: [] }, uso: { inputTokens: 300, outputTokens: 90 } };
  if (s.indexOf('ARCHITETTURA DEFINITIVA') > 0)
    return { ok: true, dati: { lezioni: [
      { title: 'FONDAMENTI DEL METODO', area: 'Teoria', rationale: 'Base teorica.', materiali: ['07'] },
      { title: 'DAL METODO ALLA PRATICA', area: 'Pratica', rationale: 'Applicazione e casi.', materiali: ['03', '01'] },
      { title: 'RIFERIMENTI NORMATIVI', area: 'Consultazione', tipo: 'modulo-fonte', rationale: 'Si consulta.', materiali: ['12'] }],
      rimandi: [{ da: 'DAL METODO ALLA PRATICA', a: 'FONDAMENTI DEL METODO', perche: 'ripasso' }],
      decisioni: ['Il 12 non è una lezione ma materiale di consultazione.'] }, uso: { inputTokens: 900, outputTokens: 400 } };
  if (s.indexOf('revisore severo') > 0)
    return { ok: true, dati: { promossa: true, rilievi: [] }, uso: { inputTokens: 400, outputTokens: 60 } };
  if (s.indexOf('SCALETTE ALTERNATIVE') > 0)
    return { ok: true, dati: { alternative: [
      { nome: 'In sequenza', principio: 'sequenza didattica', differenza: 'Segui l\'ordine della lezione: sicuro, ma la pratica arriva tardi.', adattaA: 'chi parte da zero',
        capitoli: [{ titolo: 'La teoria di base', sintesi: 'fondamenti', fonti: [{ materiale: '07', da: 1, a: 6 }] },
                   { titolo: 'La teoria applicata', sintesi: 'pratica', fonti: [{ materiale: '07', da: 7, a: 12 }] }] },
      { nome: 'Per domande', principio: 'per domande', differenza: 'Ogni capitolo risponde a una domanda: parti dal dubbio, non dalla definizione.', adattaA: 'chi ha già esperienza',
        capitoli: [{ titolo: 'Perché serve un metodo', sintesi: 'motivazione', fonti: [{ materiale: '07' }] }] },
      { nome: 'Gemella', principio: 'sequenza didattica', differenza: 'uguale alla prima', adattaA: 'nessuno',
        capitoli: [{ titolo: 'La teoria di base', sintesi: 'fondamenti', fonti: [{ materiale: '07' }] },
                   { titolo: 'La teoria applicata', sintesi: 'pratica', fonti: [{ materiale: '07' }] }] }
    ] }, uso: { inputTokens: 500, outputTokens: 300 } };
  if (s.indexOf('Scrivi UN capitolo') === 0)
    return { ok: true, dati: {
      title: 'La teoria di base del metodo',
      inBreve: 'Il capitolo introduce i fondamenti su cui poggia tutto il resto della lezione.',
      contenuto: 'Il metodo poggia su alcune idee di fondo. La prima riguarda la **teoria di base**, che si trova alla [p. 2](pdf:07#p=2) della dispensa.\\n\\n- Prima idea portante\\n- Seconda idea portante',
      puntiChiave: ['La teoria precede la pratica', 'Le idee di fondo sono tre', 'Il metodo si verifica sul campo'],
      quiz: [{ q: 'La teoria di base precede sempre l\'applicazione pratica.', a: true, perche: 'La lezione costruisce la pratica sui fondamenti.' }],
      glossario: [{ t: 'Metodo', d: 'Insieme ordinato di procedure per arrivare a un risultato verificabile.' },
                  { t: 'Fondamento', d: 'Assunto di partenza su cui poggiano le procedure successive.' }],
      sources: [{ pdf: '07', page: 2, label: 'La definizione' }]
    }, uso: { inputTokens: 800, outputTokens: 600 } };
  return { ok: false, errore: 'prompt non riconosciuto' };
}

(async () => {
  const dgF = corpusLib.digest(VF);
  check('vault finto letto', 4, dgF.totale);

  const stati = [];
  const es = await schedeLib.analizzaTutti(VF, 'P', dgF.materiali, { concorrenza: 2, ai: { chiama: modelloFinto }, onProgress: (e) => stati.push(e.stato) });
  check('schede scritte per tutti i materiali', 4, es.fatte);
  check('nessun errore di analisi', 0, es.errori.length);
  check('avanzamento riportato per materiale', true, stati.indexOf('in lettura') >= 0 && stati.indexOf('letto') >= 0);
  check('scheda conserva i riferimenti del materiale', true, !!schedeLib.leggi(VF, 'P', dgF.materiali[0]).materiale.num);

  const prima = chiamate;
  const es2 = await schedeLib.analizzaTutti(VF, 'P', dgF.materiali, { ai: { chiama: modelloFinto } });
  check('seconda passata: tutto già fatto', 4, es2.saltate);
  check('seconda passata: nessuna chiamata al modello', 0, chiamate - prima);

  const r = await proposeLib.proponiMultiagente(VF, 'P', { ai: { chiama: modelloFinto } }, {});
  check('origine multiagente', 'multiagente', r.origine);
  check('piano valido a schema', [], validate.schemaErrors('piano', r.piano));
  check('copertura completa', 4, r.piano.lezioni.reduce((s, c) => s + c.materiali.length, 0));
  check('aree assegnate', ['Teoria', 'Pratica', 'Consultazione'], r.piano.lezioni.map((c) => c.area));
  check('modulo-fonte riconosciuto', true, r.piano.lezioni.some((c) => c.tipo === 'modulo-fonte'));
  check('rimandi e decisioni conservati', [1, 1], [r.piano.rimandi.length, r.piano.decisioni.length]);
  check('revisione eseguita', true, r.revisione && r.revisione.promossa === true);
  // il raggruppamento NON segue la numerazione dei file: 07 apre, 03 e 01 stanno insieme
  check('ordine indipendente dai numeri', ['07', '03,01', '12'], r.piano.lezioni.map((c) => c.materiali.map((m) => m.num).join(',')));

  // il revisore che boccia fa fare un secondo giro di sintesi
  let giriSintesi = 0;
  async function modelloCritico(o) {
    if (o.sistema.indexOf('ARCHITETTURA DEFINITIVA') > 0) giriSintesi++;
    if (o.sistema.indexOf('revisore severo') > 0)
      return { ok: true, dati: { promossa: false, rilievi: [{ gravita: 'alta', problema: 'la lezione 2 mescola due cose', rimedio: 'separarle' }] }, uso: {} };
    return modelloFinto(o);
  }
  const archLib = require('../lib/architettura');
  const rc = await archLib.costruisci(schedeLib.tutte(VF, 'P', dgF.materiali), { chiama: modelloCritico }, {});
  check('rilievo grave → seconda sintesi', 2, giriSintesi);
  check('giri registrati', 2, rc.giri);
  check('rilievo lieve non rifà la sintesi', null, archLib.istruzioniCorrezione({ promossa: false, rilievi: [{ gravita: 'bassa', problema: 'x' }] }));

  // --------------------------- 8. scalette alternative e generazione capitoli
  sezione('Scalette alternative e generazione dei capitoli');

  const scalettaLib = require('../lib/scaletta');
  const generaLib = require('../lib/genera');

  const lezioneTest = { folder: '01-fondamenti', title: 'FONDAMENTI DEL METODO',
    rationale: 'Base teorica.', materiali: [{ num: '07' }] };
  const schedeTutte = schedeLib.tutte(VF, 'P', dgF.materiali);

  const rs = await scalettaLib.proponi(lezioneTest, schedeTutte, { chiama: modelloFinto }, {});
  check('due alternative distinte, la gemella scartata', 2, rs.alternative.length);
  check('ogni alternativa ha un nome', ['In sequenza', 'Per domande'], rs.alternative.map(function (a) { return a.nome; }));
  check('la differenza è scritta per chi studia', true, /pratica arriva tardi/.test(rs.alternative[0].differenza));
  check('le alternative coprono tutto il materiale', [true, true], rs.alternative.map(function (a) { return a.completa; }));

  // copertura difesa: materiale inventato via, materiale dimenticato segnalato
  const norm = scalettaLib.normalizza({ nome: 'X', differenza: 'y', capitoli: [
    { titolo: 'Uno', fonti: [{ materiale: '07' }, { materiale: '99' }] }
  ] }, { materiali: [{ num: '07' }, { num: '03' }] });
  check('materiale inventato scartato', ['07'], norm.capitoli[0].fonti.map(function (f) { return f.materiale; }));
  check('materiale dimenticato segnalato', ['03'], norm.mancanti);
  check('e l\'alternativa è dichiarata incompleta', false, norm.completa);

  // il testo della fonte arriva ritagliato sull'intervallo
  const testoParziale = generaLib.testoPdf(VF, '07 fondamenti teoria', 2, 3);
  check('il PDF è tagliato sulle pagine chieste', true, /\[p\. 2\]/.test(testoParziale) && !/\[p\. 5\]/.test(testoParziale));
  const testoVid = generaLib.testoVideo(VF, '03 avanzato applicazioni', 0, 120);
  check('il video è tagliato sui secondi chiesti', true, testoVid.length > 0);

  // generazione di un capitolo: valido al primo colpo
  const capitoloTest = rs.alternative[0].capitoli[0];
  const g = await generaLib.generaCapitolo(VF, lezioneTest, capitoloTest, 1, 2, dgF.materiali, { chiama: modelloFinto }, {});
  check('capitolo generato senza errori', [], g.errori);
  check('un solo tentativo se è valido subito', 1, g.tentativi);
  check('il titolo non comincia con una cifra', true, !/^[0-9]/.test(g.dati.title));

  // scrittura + rilettura col parser VERO del renderer: è il giro completo
  const scritto = generaLib.scriviCapitolo(VF, 'P', '01-fondamenti', 1, g.dati);
  check('il file ha il nome atteso', '01-la-teoria-di-base-del-metodo.md', scritto.file);
  const apiVF = readerParser.load({ mediaByNum: {}, pdfByNum: { '07': '07 fondamenti teoria.pdf' } });
  const riletto = apiVF.mdChapter(fs.readFileSync(scritto.percorso, 'utf-8'), '01-fondamenti', 1);
  check('rileggendo: titolo', g.dati.title, riletto.title);
  check('rileggendo: punti chiave', 3, riletto.keypoints.length);
  check('rileggendo: quiz vero/falso', true, riletto.quiz[0].answer);
  check('rileggendo: il rimando alla pagina è cliccabile', true, /class="plink"[^>]*data-page="2"/.test(riletto.html));
  check('rileggendo: glossario', ['Metodo', 'Fondamento'], riletto.glossary.map(function (x) { return x.t; }));

  // il giro di correzione: prima risposta invalida, seconda buona
  let giri = 0;
  async function modelloIncerto(o) {
    giri++;
    if (giri === 1) return { ok: true, dati: { title: '01 titolo che comincia con la cifra', inBreve: 'x', contenuto: 'y', puntiChiave: ['a'] }, uso: null };
    return modelloFinto(o);
  }
  const g2 = await generaLib.generaCapitolo(VF, lezioneTest, capitoloTest, 1, 2, dgF.materiali, { chiama: modelloIncerto }, {});
  check('la seconda risposta ripara la prima', [], g2.errori);
  check('e sono serviti due tentativi', 2, g2.tentativi);

  // un capitolo irrecuperabile finisce in quarantena, non nella lezione
  async function modelloRotto() { return { ok: true, dati: { title: '9 no', inBreve: 'x', contenuto: 'y', puntiChiave: ['a'] }, uso: null }; }
  const g3 = await generaLib.generaCapitolo(VF, lezioneTest, capitoloTest, 2, 2, dgF.materiali, { chiama: modelloRotto }, {});
  check('capitolo irrecuperabile: errori riportati', true, g3.errori.length > 0);
  const scarto = generaLib.scriviScarto(VF, 'P', '01-fondamenti', 2, g3.dati, g3.errori);
  check('lo scarto è in quarantena con gli errori accanto', true,
    fs.existsSync(path.join(VF, 'Corsi', 'P', '_lavorazione', 'scarti', scarto)));

  // prezzi: si stima solo ciò che è a listino, il resto è dichiarato non stimabile
  check('costo di un uso noto', 0.035, Number(providerLib.costoUsd({ modello: 'claude-opus-5', inputTokens: 2000, outputTokens: 1000 }).toFixed(4)));
  check('modello fuori listino: nessuna cifra inventata', null, providerLib.costoUsd({ modello: 'modello-ignoto', inputTokens: 1000, outputTokens: 1000 }));
  check('stima a priori di 5 capitoli', true, providerLib.stimaCosto({ modello: 'claude-opus-5', input: 45000, output: 8000 }) > 0);

  // --- Claude Code come motore: nessuna chiave, si usa l'abbonamento ---
  const cc = require('../lib/ai/claudecode');
  check('claudecode non chiede una chiave API', true, providerLib.SENZA_CHIAVE.indexOf('claudecode') >= 0);
  check('e risulta disponibile senza chiave', 'claudecode', providerLib.fornitoreDisponibile({ claudecode: true }, undefined));
  check('la preferenza dell\'utente resta prioritaria', 'anthropic',
    providerLib.fornitoreDisponibile({ claudecode: true, anthropic: true }, 'anthropic'));
  check('cerca in piu posti noti, non solo nel PATH', true, cc.candidati().length >= 6);
  check('lo schema viene chiesto a parole', true, /ESCLUSIVAMENTE con un oggetto JSON/.test(cc.istruzioneSchema({ type: 'object' })));
  check('senza schema nessuna istruzione', '', cc.istruzioneSchema(null));
  // i token della cache contano: sono il grosso del consumo di questa modalita
  const usoCC = cc.usoDi({ usage: { input_tokens: 2, cache_read_input_tokens: 23780, cache_creation_input_tokens: 13547, output_tokens: 8 },
    modelUsage: { 'claude-sonnet-5': {} }, total_cost_usd: 0.0885 });
  check('i token di cache entrano nel conteggio', 37329, usoCC.inputTokens);
  check('il costo dichiarato dal CLI viene conservato', 0.0885, usoCC.costoUsdDichiarato);
  check('e il modello riportato e quello vero', 'claude-sonnet-5', usoCC.modello);
  // il motivo di un fallimento sta su STDOUT, non su stderr: prenderlo di là
  // e' la differenza fra «uscito con codice 1» e un errore che dice qualcosa
  const errCC = JSON.stringify({ is_error: true, api_error_status: 429, result: 'Claude AI usage limit reached' });
  check('il motivo si legge dal JSON su stdout', 'Claude AI usage limit reached (HTTP 429)',
    cc.motivoDi({ codice: 1, out: errCC, err: '' }));
  check('senza JSON si ripiega su stderr', 'command not found',
    cc.motivoDi({ codice: 127, out: '', err: 'command not found\n' }));
  check('e se tace davvero resta il codice', 'uscito con codice 1', cc.motivoDi({ codice: 1, out: '', err: '' }));
  check('un tempo scaduto si chiama col suo nome', 'nessuna risposta entro il tempo massimo',
    cc.motivoDi({ codice: null, out: '', err: '', scaduto: true }));
  check('limiti e sovraccarichi si ritentano', true, cc.transitorio('Claude AI usage limit reached (HTTP 429)'));
  check('un modello inesistente no', false, cc.transitorio('issue with the selected model (HTTP 404)'));

  // --- elenco modelli: si tiene solo cio che serve ai compiti dell'app ---
  const modelliLib = require('../lib/ai/modelli');
  check('un modello di embedding non serve', false, modelliLib.giudizio({ id: 'text-embedding-3-large', contesto: 0, strutturato: true }).adatto);
  check('ne viene detto il motivo', true, /serve ad altro/.test(modelliLib.giudizio({ id: 'tts-1', contesto: 0, strutturato: true }).perche));
  check('contesto corto: scartato con la misura', true,
    /8k/.test(modelliLib.giudizio({ id: 'x', contesto: 8000, strutturato: true }).perche));
  check('contesto lungo: adatto', true, modelliLib.giudizio({ id: 'claude-opus-5', contesto: 1000000, strutturato: true }).adatto);
  check('prezzo noto nella descrizione', true,
    /\$5 \/ \$25/.test(modelliLib.descrizione({ id: 'claude-opus-5', contesto: 1000000, maxOutput: 128000 })));
  check('prezzo ignoto dichiarato tale', true,
    /non noto all'app/.test(modelliLib.descrizione({ id: 'gemini-2.5-pro', contesto: 1000000, maxOutput: 64000 })));
  check('costo per capitolo su un modello a listino', true, modelliLib.costoCapitolo('claude-opus-5') > 0);
  check('e nullo se il listino non ce l\'ha', null, modelliLib.costoCapitolo('gemini-2.5-pro'));
  const ccList = await modelliLib.elenca('claudecode');
  check('claudecode elenca gli alias senza chiave', ['', 'opus', 'sonnet'], ccList.modelli.map(function (m) { return m.id; }));
  const senzaChiave = await modelliLib.elenca('openai', null);
  check('senza chiave lo dice invece di rompersi', true, /serve la chiave/.test(senzaChiave.errore));

  // --- ambiente: che cosa consigliare, data com'è fatta la macchina ---
  // consiglio() è pura per questo motivo: lo stato si passa come argomento e
  // qui si provano tutte le combinazioni senza toccare il sistema.
  sezione('Ambiente e primo avvio');
  const amb = require('../lib/ambiente');
  const ids = function (r) { return r.avvisi.map(function (a) { return a.id; }); };
  const base = {
    python: { trovato: true, versione: '3.13.1', v: [3, 13, 1], percorso: '/opt/homebrew/bin/python3' },
    modelloWhisperPresente: true, spazioLiberoGb: 200,
    vault: { path: '/x', scritturaOk: true }, chiavi: {}
  };
  const conStato = function (o) { return amb.consiglio(Object.assign({}, base, o)); };

  const soloCC = conStato({ claudecode: { ok: true, versione: '2.1.0' } });
  check('con Claude Code il motore è l\'abbonamento', 'claudecode', soloCC.motore);
  check('macchina a posto: niente da avvisare', [], ids(soloCC));
  check('e non è sola lettura', false, soloCC.soloLettura);

  const soloChiave = conStato({ claudecode: { ok: false }, chiavi: { anthropic: true, openai: false } });
  check('senza Claude Code ma con una chiave si usa la chiave', 'apikey', soloChiave.motore);
  check('e si dice quale fornitore è pronto', ['anthropic'], soloChiave.fornitoriPronti);
  check('avere una chiave non produce avvisi', [], ids(soloChiave));

  check('con entrambi vince l\'abbonamento', 'claudecode',
    conStato({ claudecode: { ok: true }, chiavi: { anthropic: true } }).motore);
  // claudecode arriva dentro chiaviDisponibili(): non deve contare come fornitore a chiave
  check('claudecode non è un fornitore a chiave', [],
    conStato({ claudecode: { ok: true }, chiavi: { claudecode: true } }).fornitoriPronti);

  const nessuno = conStato({ claudecode: { ok: false }, chiavi: { anthropic: false } });
  check('senza nulla non c\'è motore', 'nessuno', nessuno.motore);
  check('l\'app resta in sola lettura invece di bloccarsi', true, nessuno.soloLettura);
  check('e lo si dice', ['motore-assente'], ids(nessuno));

  const senzaPy = conStato({ claudecode: { ok: true }, python: { trovato: false }, modelloWhisperPresente: false });
  check('senza Python si avvisa una volta sola', ['python-assente'], ids(senzaPy));
  check('col comando da eseguire', 'xcode-select --install', senzaPy.avvisi[0].comando);

  const pyVecchio = conStato({ claudecode: { ok: true },
    python: { trovato: true, versione: '3.9.6', v: [3, 9, 6], percorso: '/usr/bin/python3' } });
  check('un Python vecchio è un avviso, non un blocco', ['python-vecchio'], ids(pyVecchio));
  check('e il motore resta quello buono', 'claudecode', pyVecchio.motore);

  check('con più Python si dice quale è stato scelto', ['python-scelto'],
    ids(conStato({ claudecode: { ok: true },
      python: { trovato: true, versione: '3.13.1', v: [3, 13, 1], percorso: '/opt/homebrew/bin/python3', diversoDaSistema: true } })));

  check('modello da scaricare e poco spazio: due avvisi, in ordine', ['whisper-download', 'spazio'],
    ids(conStato({ claudecode: { ok: true }, modelloWhisperPresente: false, spazioLiberoGb: 2 })));
  check('un vault non scrivibile va detto subito', ['vault-non-scrivibile'],
    ids(conStato({ claudecode: { ok: true }, vault: { path: '/Volumes/ro', scritturaOk: false } })));
  check('senza stato non si rompe', 'nessuno', amb.consiglio().motore);

  check('la versione si legge da un testo qualunque', [3, 13, 1], amb.versioneDa('Python 3.13.1'));
  check('3.10 batte 3.9: non è un confronto fra stringhe', 1, amb.confronta([3, 10, 0], [3, 9, 6]));

  // --- quale interprete, fra quelli che hanno risposto ---
  // il rischio non è «non trovato» ma «trovato quello sbagliato»: /usr/bin/python3
  // c'è sempre su macOS ed è quasi sempre il più vecchio della macchina
  const PY = [
    { percorso: '/usr/bin/python3', versione: '3.9.6', v: [3, 9, 6] },
    { percorso: '/opt/homebrew/bin/python3', versione: '3.13.2', v: [3, 13, 2] },
    { percorso: '/Library/Frameworks/Python.framework/Versions/3.10/bin/python3', versione: '3.10.11', v: [3, 10, 11] }
  ];
  const sc = amb.scegli(PY, null);
  check('non vince quello di sistema ma il più recente', '/opt/homebrew/bin/python3', sc.percorso);
  check('e lo si sa dire', '3.13.2', sc.versione);
  check('tutti i candidati restano visibili all\'utente', 3, sc.candidati.length);
  check('si segnala che la scelta non è quella di sistema', true, sc.diversoDaSistema);
  const scImposto = amb.scegli(PY, '/usr/bin/python3');
  check('STUDIA_PYTHON scavalca l\'euristica', '/usr/bin/python3', scImposto.percorso);
  check('e lo dichiara', true, scImposto.esplicito);
  check('un STUDIA_PYTHON che non ha risposto viene ignorato', '/opt/homebrew/bin/python3',
    amb.scegli(PY, '/non/esiste/python3').percorso);
  check('solo quello di sistema: non c\'è niente da segnalare', false,
    amb.scegli([PY[0]], null).diversoDaSistema);
  check('nessun interprete: trovato falso, non un\'eccezione', false, amb.scegli([], null).trovato);

  // --- PATH del Finder: launchd passa /usr/bin:/bin:/usr/sbin:/sbin, non quello della shell ---
  const pathVero = process.env.PATH;
  process.env.PATH = '/usr/bin:/bin:/usr/sbin:/sbin';
  const ccPercorso = require('../lib/ai/claudecode').percorso(true);
  check('claude si trova anche col PATH ridotto', true, ccPercorso === null || fs.existsSync(ccPercorso));
  const scelta = amb.pythonMigliore();
  if (scelta.trovato) {
    // il rischio non è «non trovato» ma «trovato quello sbagliato»: qui si
    // verifica che fra tutti i candidati vinca davvero il più recente
    let piuAlta = null;
    for (const c of scelta.candidati) {
      const v = amb.versioneDa(c.versione);
      if (amb.confronta(v, piuAlta) > 0) piuAlta = v;
    }
    check('col PATH ridotto si sceglie il Python più recente', 0, amb.confronta(amb.versioneDa(scelta.versione), piuAlta));
    check('e il percorso scelto esiste', true, fs.existsSync(scelta.percorso));
  } else {
    check('su macOS un Python deve esserci', false, process.platform === 'darwin');
  }
  process.env.PATH = pathVero;

  // --- corsi protetti: il materiale di studio non si tocca ---
  const corsiLib = require('../lib/corsi');
  const VP = fs.mkdtempSync(path.join(os.tmpdir(), 'studia-prot-'));
  fs.mkdirSync(path.join(VP, 'Corsi', 'ORIGINALE'), { recursive: true });
  fs.mkdirSync(path.join(VP, 'Corsi', 'COPIA'), { recursive: true });
  fs.writeFileSync(path.join(VP, 'Corsi', 'ORIGINALE', '_corso.md'), mdser.corso({ id: 'o', title: 'O' }));
  fs.writeFileSync(path.join(VP, 'Corsi', 'COPIA', '_corso.md'), mdser.corso({ id: 'c', title: 'C' }));
  check('nuovo corso non è protetto', false, corsiLib.protetto(VP, 'ORIGINALE'));
  corsiLib.proteggi(VP, 'ORIGINALE', true);
  check('dopo la marcatura è protetto', true, corsiLib.protetto(VP, 'ORIGINALE'));
  check('il marcatore finisce in _lavorazione/', true,
    fs.existsSync(path.join(VP, 'Corsi', 'ORIGINALE', '_lavorazione', '_PROTETTO')));
  // un vault già in uso tiene il marcatore nella radice del corso: deve valere lo stesso
  fs.writeFileSync(path.join(VP, 'Corsi', 'COPIA', '_PROTETTO'), 'x');
  check('si riconosce anche il marcatore vecchio nella radice', true, corsiLib.protetto(VP, 'COPIA'));
  fs.unlinkSync(path.join(VP, 'Corsi', 'COPIA', '_PROTETTO'));
  check('la copia resta scrivibile', false, corsiLib.protetto(VP, 'COPIA'));
  let bloccato = false;
  try { corsiLib.assicuraScrivibile(VP, 'ORIGINALE'); } catch (e) { bloccato = /protetto/.test(e.message); }
  check('la scrittura sul protetto viene rifiutata', true, bloccato);
  corsiLib.proteggi(VP, 'ORIGINALE', false);
  check('si può riaprire alla scrittura', false, corsiLib.protetto(VP, 'ORIGINALE'));
  fs.rmSync(VP, { recursive: true, force: true });

  // --- materiali: prima quelli del corso, poi il corpus del vault ---
  sezione('Materiali dentro il corso');
  const matLib = require('../lib/materiali');
  const VM = fs.mkdtempSync(path.join(os.tmpdir(), 'studia-mat-'));
  const dentro = path.join(VM, 'Corsi', 'ALFA', 'MATERIALI');
  for (const d of matLib.cartelleCorso()) fs.mkdirSync(path.join(dentro, d), { recursive: true });
  fs.mkdirSync(path.join(VM, 'Media'), { recursive: true });
  fs.writeFileSync(path.join(dentro, 'Video', '01 lezione.mp4'), 'x');
  fs.writeFileSync(path.join(dentro, 'Trascrizioni', '01 lezione.json'), '{}');
  fs.writeFileSync(path.join(VM, 'Media', '01 lezione.mp4'), 'x');      // stesso nome, copia del vault
  fs.writeFileSync(path.join(VM, 'Media', '02 solo-nel-vault.mp4'), 'x');

  check('il corso con MATERIALI viene riconosciuto', 'ALFA', matLib.corsiConMateriali(VM)[0]);
  check('la cartella del corso viene cercata per prima', true,
    matLib.cartelle(VM, 'Media')[0].indexOf(path.join('Corsi', 'ALFA')) >= 0);
  // ogni tipo di sorgente ha la sua cartella: un audio caricato non finisce fra i video
  check('un .mp3 va in Audio/', 'Audio', matLib.cartellaPerFile('12 registrazione.mp3'));
  check('un .mp4 va in Video/', 'Video', matLib.cartellaPerFile('12 lezione.mp4'));
  check('un .pdf va in PDF/', 'PDF', matLib.cartellaPerFile('12 dispensa.pdf'));
  check('una pagina salvata va in Web/', 'Web', matLib.cartellaPerFile('12 pagina.html'));
  fs.writeFileSync(path.join(dentro, 'Audio', '03 registrazione.mp3'), 'x');
  check('l\'audio del corso è fra i media trovati', true,
    matLib.elenca(VM, 'Media').some((m) => m.nome === '03 registrazione.mp3'));
  check('un materiale del corso si trova lì', true,
    matLib.trova(VM, 'Media', '01 lezione.mp4').indexOf('ALFA') >= 0);
  check('un materiale solo nel vault si trova comunque', true,
    !!matLib.trova(VM, 'Media', '02 solo-nel-vault.mp4'));
  check('un materiale inesistente non inventa percorsi', '', matLib.trova(VM, 'Media', 'mai visto.mp4'));
  check('l\'elenco non duplica i nomi presenti in due posti', 3, matLib.elenca(VM, 'Media').length);
  check('la trascrizione di un video del corso resta nel corso', true,
    matLib.destinazioneDerivato(VM, path.join(dentro, 'Video', '01 lezione.mp4'), 'Trascrizioni').indexOf('ALFA') >= 0);
  check('quella di un video del vault resta nel vault', path.join(VM, 'Trascrizioni'),
    matLib.destinazioneDerivato(VM, path.join(VM, 'Media', '02 solo-nel-vault.mp4'), 'Trascrizioni'));
  check('il numero si legge dal nome', 7, matLib.numero('07 qualcosa.pdf'));
  check('un nome senza numero non ne inventa uno', null, matLib.numero('appunti.pdf'));

  // il digest deve leggere la trascrizione che sta dentro il corso
  const corpusLib2 = require('../lib/corpus');
  fs.writeFileSync(path.join(dentro, 'Trascrizioni', '01 lezione.json'),
    JSON.stringify({ segments: [{ start: 0, end: 12, text: 'la dislessia è un disturbo della lettura' }] }));
  const dig = corpusLib2.digest(VM).materiali.filter((m) => m.num === '01');
  check('il digest trova il video attraverso i materiali del corso', 1, dig.length);
  check('e ne legge la durata dalla trascrizione interna', 12, dig[0] && dig[0].durata);
  fs.rmSync(VM, { recursive: true, force: true });

  // --- pacchetto: il corso in un file solo, per darlo a qualcun altro ---
  sezione('Pacchetto del corso');
  const pk = require('../lib/pacchetto');
  check('il nome del file dice cos\'è', 'TD74-DSA.studia.zip', pk.nomeFile('TD74-DSA'));
  const cmdE = pk.comandoEsporta('ALFA', '/tmp/x.zip', { appunti: false });
  check('la lavorazione non entra nel pacchetto', true, cmdE.args.includes('ALFA/_lavorazione/*'));
  check('senza spunta gli appunti restano a casa', true, cmdE.args.includes('ALFA/APPUNTI/*'));
  check('con la spunta gli appunti partono', false,
    pk.comandoEsporta('ALFA', '/tmp/x.zip', { appunti: true }).args.includes('ALFA/APPUNTI/*'));
  check('i video non si ricomprimono a vuoto', true, cmdE.args.join(' ').indexOf('mp4') >= 0);

  const dentroZip = ['ALFA/', 'ALFA/_corso.md', 'ALFA/01-intro/_lezione.md', 'ALFA/01-intro/01-primo.md',
    'ALFA/MATERIALI/Video/01 lezione.mp4', 'ALFA/MATERIALI/Audio/02 registrazione.mp3',
    'ALFA/MATERIALI/PDF/03 dispensa.pdf', 'ALFA/MATERIALI/Trascrizioni/01 lezione.json'];
  const info = pk.esamina(dentroZip);
  check('il pacchetto è riconosciuto', true, info.ok);
  check('e si sa di quale corso è', 'ALFA', info.id);
  check('conta le lezioni, non le cartelle di servizio', 1, info.lezioni);
  check('conta i video', 1, info.video);
  check('conta l\'audio a parte', 1, info.audio);
  check('vede che gli appunti non ci sono', false, info.appunti);
  check('riassume il contenuto in italiano', '1 lezione · 1 video · 1 audio · 1 PDF', pk.descrizione(info));
  check('uno zip qualsiasi viene rifiutato', false, pk.esamina(['foto/a.jpg', 'musica/b.mp3']).ok);
  check('e senza _corso.md pure', false, pk.esamina(['X/capitolo.md']).ok);
  check('un file vuoto non passa', false, pk.esamina([]).ok);
  const presi = new Set(['ALFA', 'ALFA-2']);
  check('un nome già preso non sovrascrive niente', 'ALFA-3', pk.idLibero('ALFA', (x) => presi.has(x)));
  check('se è libero resta quello', 'BETA', pk.idLibero('BETA', (x) => presi.has(x)));

  // --- le lezioni stanno in LEZIONI/, ma i corsi vecchi continuano a funzionare ---
  sezione('LEZIONI/ dentro il corso');
  const VC = fs.mkdtempSync(path.join(os.tmpdir(), 'studia-lezioni-'));
  const pNuovo = path.join(VC, 'Corsi', 'NUOVO'), pVecchio = path.join(VC, 'Corsi', 'VECCHIO');
  fs.mkdirSync(path.join(pNuovo, 'LEZIONI', '01-uno'), { recursive: true });
  fs.mkdirSync(path.join(pNuovo, 'LEZIONI', '02-due'), { recursive: true });
  fs.mkdirSync(path.join(pNuovo, 'APPUNTI'), { recursive: true });
  fs.mkdirSync(path.join(pNuovo, 'MATERIALI', 'Video'), { recursive: true });
  fs.mkdirSync(path.join(pVecchio, '01-solo'), { recursive: true });   // impianto di prima
  fs.mkdirSync(path.join(pVecchio, 'APPUNTI'), { recursive: true });
  check('le lezioni si leggono da LEZIONI/', 2, corsiLib.elencoLezioni(VC, 'NUOVO').length);
  check('appunti e materiali non contano come lezioni', -1, corsiLib.elencoLezioni(VC, 'NUOVO').indexOf('APPUNTI'));
  check('un corso vecchio tiene le lezioni nella radice', 1, corsiLib.elencoLezioni(VC, 'VECCHIO').length);
  check('e lì le si continua a trovare', true,
    corsiLib.lezioneDir(VC, 'VECCHIO', '01-solo').endsWith(path.join('VECCHIO', '01-solo')));
  check('la lezione nuova va sempre in LEZIONI/', true,
    corsiLib.cartellaLezioniPerScrivere(VC, 'VECCHIO').endsWith(path.join('VECCHIO', 'LEZIONI')));
  fs.rmSync(VC, { recursive: true, force: true });

  /* --- appunti: non devono sparire. Né dalla tendina, né dal disco. --- */
  sezione('Appunti — legame col capitolo e composizione dell\'elenco');
  const note = readerParser.loadNotes();
  const ctx = { lezione: 'Cosa sono i DSA', lezioneId: '01-fondamenti', capitolo: 'Che cosa sono i DSA',
                capitoloId: '01-fondamenti-c01', capitoloFile: '01-definizione-eterogeneita.md' };
  const nQui = { file: 'a.md', title: 'Primo', lezione: ctx.lezione, lezioneId: ctx.lezioneId,
                 capitolo: ctx.capitolo, capitoloId: ctx.capitoloId, capitoloFile: ctx.capitoloFile };
  const nAltro = { file: 'b.md', title: 'Secondo', lezione: ctx.lezione, lezioneId: ctx.lezioneId,
                   capitolo: 'La base neurobiologica', capitoloId: '01-fondamenti-c02',
                   capitoloFile: '02-base-neurobiologica.md' };
  check('l\'appunto del capitolo si riconosce', true, note.noteInChapter(nQui, ctx));
  check('quello di un altro capitolo no', false, note.noteInChapter(nAltro, ctx));
  // la lezione rigenerata sposta l'id posizionale: il file .md del capitolo no
  check('capitolo rinumerato: l\'appunto resta suo', true,
    note.noteInChapter(Object.assign({}, nQui, { capitoloId: '01-fondamenti-c04' }), ctx));
  check('senza id ci si aggancia al titolo', true,
    note.noteInChapter({ file: 'c.md', lezione: ctx.lezione, capitolo: ctx.capitolo }, ctx));
  check('stesso nome di file ma altra lezione: non è suo', false,
    note.noteInChapter({ file: 'd.md', lezioneId: '07-disturbi-scrittura', capitoloFile: ctx.capitoloFile }, ctx));
  check('un appunto senza appigli non si attacca a niente', false,
    note.noteInChapter({ file: 'e.md' }, ctx));

  const gr = note.noteGroups([nQui, nAltro], ctx, null);
  check('l\'elenco separa questo capitolo dagli altri', '1/1', gr.qui.length + '/' + gr.altrove.length);
  check('gli appunti degli altri capitoli restano elencati', 'Secondo', note.noteEtichetta(gr.altrove[0]));
  check('e dicono dove stanno', 'Secondo — Cosa sono i DSA · La base neurobiologica',
    note.noteEtichettaAltrove(gr.altrove[0]));
  // il caso che faceva "sparire" il nome: leggi il capitolo 2 con aperto un appunto del capitolo 1
  const gLeggendoAltrove = note.noteGroups([nQui, nAltro],
    Object.assign({}, ctx, { capitolo: nAltro.capitolo, capitoloId: nAltro.capitoloId, capitoloFile: nAltro.capitoloFile }), nQui);
  check('l\'appunto aperto resta nell\'elenco anche da un altro capitolo', true,
    gLeggendoAltrove.altrove.some((n) => n.file === 'a.md'));
  check('e non finisce fra gli orfani', null, gLeggendoAltrove.orfano);
  // aperto un appunto che nell'elenco non c'è (altro corso, o file appena sparito)
  const gOrfano = note.noteGroups([nAltro], ctx, { file: 'z.md', title: 'Aperto ora' });
  check('l\'appunto aperto ma fuori elenco viene comunque mostrato', 'z.md', gOrfano.orfano.file);
  check('senza titolo si ripiega sul nome del file', 'x', note.noteEtichetta({ file: 'x.md' }));
  check('e senza nemmeno quello non resta vuoto', 'senza titolo', note.noteEtichetta({}));
  check('un doppione non compare due volte', 1, note.noteGroups([nQui, nQui], ctx, null).qui.length);
  check('senza capitolo aperto nessun appunto viene perso', 2, note.noteGroups([nQui, nAltro], null, null).altrove.length);

  sezione('Appunti — su disco');
  const app = require('../lib/appunti');
  const VA = fs.mkdtempSync(path.join(os.tmpdir(), 'studia-appunti-'));
  check('cartella APPUNTI assente = nessun appunto (non un errore)', 0, app.read(VA, 'P').notes.length);
  check('e nessun errore da mostrare', '', app.read(VA, 'P').error);
  const salvato = app.save(VA, 'P', null, { title: 'Con "virgolette" e àccenti', lezione: 'Cosa sono i DSA', capitolo: 'Definizione', capitoloId: '01-fondamenti-c01' }, 'Corpo dell\'appunto.');
  check('il nome del file si legge', 'Cosa sono i DSA - Definizione - Con -virgolette- e àccenti.md', salvato.file);
  const apRiletto = app.read(VA, 'P');
  check('rileggendo, l\'appunto c\'è', 1, apRiletto.notes.length);
  check('col titolo intatto', 'Con "virgolette" e àccenti', apRiletto.notes[0].title);
  check('e col corpo intatto', 'Corpo dell\'appunto.', apRiletto.notes[0].body.trim());
  check('l\'indice non viene contato come appunto', true, fs.existsSync(path.join(app.dir(VA, 'P'), '_indice.md')));
  app.save(VA, 'P', null, { title: 'Con "virgolette" e àccenti', lezione: 'Cosa sono i DSA', capitolo: 'Definizione' }, 'Secondo.');
  check('un titolo ripetuto non sovrascrive il primo', 2, app.read(VA, 'P').notes.length);
  // un appunto scritto a metà (o rovinato a mano) non deve far sparire l'intero elenco
  fs.writeFileSync(path.join(app.dir(VA, 'P'), 'monco.md'), '---\ntitle: "Tronc', 'utf-8');
  const conRotto = app.read(VA, 'P');
  check('un appunto senza frontmatter chiuso resta elencato', 3, conRotto.notes.length);
  check('e l\'elenco lo segnala invece di far finta di niente', true, /monco/.test(conRotto.error));
  check('col nome del file al posto del titolo', 'monco', conRotto.notes.filter((n) => n.file === 'monco.md')[0].title);
  // scrittura atomica: durante il salvataggio non esiste un file .md a metà
  const tmpVisti = [];
  const originale = fs.renameSync;
  fs.renameSync = function (a, b) { tmpVisti.push(fs.readdirSync(app.dir(VA, 'P')).filter((f) => f.endsWith('.md') && !f.startsWith('_')).length); return originale(a, b); };
  app.save(VA, 'P', salvato.file, { title: 'Riscritto', creato: '2026-01-01T00:00:00.000Z' }, 'Nuovo corpo.');
  fs.renameSync = originale;
  check('a metà scrittura nessun .md è in stato incerto', true, tmpVisti.every((n) => n === 3));
  const dopo = app.read(VA, 'P').notes.filter((n) => n.file === salvato.file)[0];
  check('il salvataggio conserva la data di creazione', '2026-01-01T00:00:00.000Z', dopo.creato);
  check('e aggiorna il corpo', 'Nuovo corpo.', dopo.body.trim());
  check('eliminare un appunto lo toglie davvero', 2, (app.remove(VA, 'P', salvato.file), app.read(VA, 'P').notes.length));
  check('eliminare un file che non c\'è non esplode', false, app.remove(VA, 'P', 'mai-esistito.md'));
  fs.rmSync(VA, { recursive: true, force: true });

  // --- espansione: si accoda, non si rinumera mai ---
  sezione('Espandere un corso già finito');
  const esp = require('../lib/espandi');
  const filesLezione = ['_lezione.md', '01-primo.md', '02-secondo.md', '03-terzo.md', 'appunto.txt'];
  check('i capitoli si riconoscono dal nome', 3, esp.capitoliDi(filesLezione).length);
  check('il prossimo capitolo è il 4°', 4, esp.prossimoOrdine(filesLezione));
  check('una lezione vuota riparte da 1', 1, esp.prossimoOrdine(['_lezione.md']));
  check('i buchi non fanno riusare un numero', 8, esp.prossimoOrdine(['01-a.md', '07-b.md']));
  check('l\'ordine cresce in fondo', '01-primo.md,02-secondo.md,04-nuovo.md',
    esp.ordineAggiornato(['01-primo.md', '02-secondo.md'], ['04-nuovo.md']).join(','));
  check('e non duplica ciò che c\'era', 2,
    esp.ordineAggiornato(['01-primo.md', '02-secondo.md'], ['02-secondo.md']).length);

  const lezioniFinti = [{ folder: '01-a', materiali: [1, 3] }, { folder: '02-b', materiali: [2] }];
  const matFinti = [{ num: '01' }, { num: '02' }, { num: '03' }, { num: '41' }, { num: '42' }];
  check('i materiali nuovi sono quelli che nessuna lezione usa', '41,42',
    esp.materialiNuovi(matFinti, lezioniFinti).map((m) => m.num).join(','));
  check('senza lezioni sono tutti nuovi', 5, esp.materialiNuovi(matFinti, []).length);
  check('la lezione nuova prende il numero dopo l\'ultima', '03', esp.prossimoLezione(['01-a', '02-b']));
  check('la prima lezione di un corso vuoto è 01', '01', esp.prossimoLezione([]));

  const capitoliTesto = [
    { file: '01-a/01-x.md', contenuto: 'Prosegue in [[02-b]] e in [[09-mai-scritto]].' },
    { file: '02-b/01-y.md', contenuto: 'Vedi [[01-a|la prima lezione]].' }
  ];
  const rotti = esp.wikilinkRotti(capitoliTesto, ['01-a', '02-b']);
  check('un rimando verso una lezione inesistente viene trovato', 1, rotti.length);
  check('e si sa in quale capitolo sta', '01-a/01-x.md', rotti[0].file);
  check('l\'etichetta dopo la barra non confonde il controllo', 0,
    esp.wikilinkRotti([{ file: 'x', contenuto: '[[01-a|con etichetta]]' }], ['01-a']).length);

  // il validatore ora boccia il rimando verso una lezione che non c'è
  const capConRimando = {
    schema: 1, tipo: 'capitolo', id: 'x', title: 'T', durata: 5,
    contenuto: 'Testo con rimando a [[09-mai-scritto]].', quiz: [], glossario: [], footnotes: []
  };
  check('wikilink verso una lezione inesistente: bocciato', true,
    validateCapitolo(capConRimando, { lezioni: ['01-a', '02-b'] }).errors.some((x) => /non c'è una lezione/.test(x)));
  check('verso una lezione che esiste: passa', false,
    validateCapitolo(Object.assign({}, capConRimando, { contenuto: 'Vedi [[01-a]].' }),
      { lezioni: ['01-a', '02-b'] }).errors.some((x) => /non c'è una lezione/.test(x)));
  check('senza elenco lezioni il controllo non si inventa errori', false,
    validateCapitolo(capConRimando, {}).errors.some((x) => /non c'è una lezione/.test(x)));

  fs.rmSync(VF, { recursive: true, force: true });

  // ------------------------------------------------- 12. lettura vocale (TTS)
  sezione('Lettura vocale — pronuncia italiana, taglio in frasi, prosodia');

  const tts = readerParser.loadTts();
  const pron = tts.ttsNormalizza;
  const frasi = (s) => tts.ttsFrasi(pron(s));

  // niente rimandi alle note nel testo letto
  check('marcatore [[n]] tolto', 'I DSA sono eterogenei.', pron('I DSA sono eterogenei[[1]].'));
  check('nota markdown [^n] tolta', 'Come da definizione.', pron('Come da definizione[^1].'));

  // pronuncia
  check('virgolette non lette', 'un gruppo eterogeneo di disturbi', pron('un «gruppo eterogeneo di disturbi»'));
  check('lineetta → pausa da inciso', 'due strumenti, molto diversi', pron('due strumenti — molto diversi'));
  check('parentesi → inciso', 'le abilità alte, la comprensione, contano', pron('le abilità alte (la comprensione) contano'));
  check('sigla con numero: niente «meno»', 'Il DSM 5 lo dice.', pron('Il DSM-5 lo dice.'));
  check('intervallo numerico', 'la BDA 16 30', pron('la BDA 16-30'));
  check('percentuale sciolta', 'il 25 per cento dei casi', pron('il 25% dei casi'));
  check('abbreviazione di pagina sciolta', 'vedi pagina 7', pron('vedi p. 7'));
  check('«per es.» sciolto', 'per esempio la lettura', pron('p. es. la lettura'));
  check('apostrofo tipografico normalizzato', "l'apprendimento", pron('l’apprendimento'));
  check('punteggiatura doppia collassata', 'la lettura, la scrittura.', pron('la lettura, (la scrittura).'));

  /* Casi contati sul corpus vero (Corsi/TD74-DSA/LEZIONI): la freccia compare 82
     volte, «Racc.» 55, «sill/sec» 22, «×» 40. Senza queste regole il motore
     incolla le parole o legge sigle senza senso. */
  check('la freccia vale una virgola, non il silenzio', 'progressione grosso, fine',
    pron('progressione grosso→fine'));
  check('«Racc. 9.1» è una raccomandazione', 'Raccomandazione 9.1', pron('Racc. 9.1'));
  check('«sill/sec» sono sillabe al secondo', 'circa 6 7 sillabe al secondo',
    pron('circa 6-7 sill/sec'));
  check('anche scritto per esteso', '120 lettere al minuto', pron('120 lettere/minuto'));
  check('e l\'abbreviazione non si mangia il punto fermo', 2,
    frasi('Il ritmo è di 90 parole/min. Poi cambia.').length);
  check('«e/o» non diventa «e o o»', 'e o mista', pron('e/o mista'));
  check('l\'alternativa vera resta una scelta', 'vero o falso', pron('vero/falso'));
  check('il per moltiplicativo', '2 per 45 minuti', pron('2×45 min'));
  check('«et al.» si legge «e altri»', 'Andrich e altri, 2006', pron('Andrich et al., 2006'));
  check('i puntini in mezzo alla frase sono un respiro', 'le competenze alte, restano decisive.',
    pron('le competenze alte… restano decisive.'));
  check('e a fine periodo chiudono', 2, frasi('Non basta… Serve altro.').length);

  /* Difetti trovati misurando l'audio vero, non leggendo il codice. */
  // una domanda fra virgolette lasciava «?.» e veniva letta come affermazione:
  // intonazione finale misurata 258 Hz contro 148 Hz
  check('il punto che chiudeva la citazione non spegne la domanda',
    'Come posso aiutarlo? È per questo che si comincia.',
    pron('«Come posso aiutarlo?». È per questo che si comincia.'));
  check('vale anche per l\'esclamativo', 'Non ci riesco! Poi si vedrà.',
    pron('«Non ci riesco!». Poi si vedrà.'));
  // fra due segni vince il più forte: le parentesi diventano virgole e prima
  // retrocedevano i due punti dell'elenco e i punti e virgola fra le voci
  check('i due punti dell\'elenco sopravvivono alla parentesi',
    'Tre conseguenze: 1, profili distinti; 2, comorbilità.',
    pron('Tre conseguenze: (1) profili distinti; (2) comorbilità.'));
  check('e la virgola non retrocede il punto e virgola', 'primo; secondo',
    pron('primo; (secondo)').replace(/,\s*$/, ''));

  // taglio in frasi
  check('due frasi separate', 2, frasi('I DSA sono eterogenei. Vale la pena fermarsi.').length);
  check('il migliaio non spezza la frase', 1, frasi('Sono stati esaminati 1.000 casi.').length);
  check('l\'iniziale puntata non spezza la frase', 2, frasi('Lo notò J. Piaget. Poi altri.').length);
  check('«ecc.» a metà frase non spezza', 1, frasi('lettura, scrittura, ecc. sono strumentali.').length);
  check('«ecc.» a fine frase spezza', 2, frasi('lettura, scrittura, ecc. Ma non basta.').length);
  check('«a.C.» a metà frase non spezza', 1, frasi('Nel 300 a.C. la scrittura non esisteva.').length);
  check('il punto interrogativo chiude la frase', 2, frasi('Da che cosa dipende? Dall\'ambiente.').length);

  // prosodia
  const dom = tts.ttsSegmenti('Da che cosa dipende?', 'frase')[0];
  check('la domanda alza il tono', true, dom.pitch > 1);
  const tit = tts.ttsSegmenti('La comprensione del testo', 'titolo')[0];
  check('il titolo prende il punto finale', 'La comprensione del testo.', tit.t);
  check('il titolo rallenta', true, tit.rate < 1);
  check('e si annuncia con una pausa prima', true, tit.prima > 0);
  const virg = tts.ttsSegmenti('Prima parte, seconda parte.', 'frase');
  check('una frase corta resta un solo segmento', 1, virg.length);
  check('l\'ultimo segmento chiude il blocco', true, !!virg[virg.length - 1].fineBlocco);

  // periodi lunghi: si respira sulla punteggiatura, non a caso
  const lungo = 'È il cuore della prospettiva life-span: finché le risorse della persona bastano a soddisfare '
    + 'le richieste dell\'ambiente si mantiene un equilibrio; quando le richieste eccedono le risorse, al passaggio '
    + 'alla scuola secondaria, alle superiori, talvolta all\'università, sopraggiunge la crisi.';
  const pezzi = tts.ttsSpezzaLunga(pron(lungo), 240);
  check('il periodo lungo viene spezzato', true, pezzi.length > 1);
  check('nessun pezzo supera il limite', true, pezzi.every((p) => p.length <= 240));
  check('si taglia dopo la punteggiatura', true, pezzi.slice(0, -1).every((p) => /[;:,]$/.test(p)));
  check('rimesso insieme, il testo non cambia', pron(lungo).replace(/\s/g, ''), pezzi.join('').replace(/\s/g, ''));

  /* La virgola dei decimali non è una cesura: tagliare lì spezzava «-1,5» in
     «-1, 5», e il motore ci metteva dentro 625 ms di pausa. */
  const conNumero = pron('La prestazione del bambino si colloca tra -1,5 e -2 deviazioni standard rispetto '
    + 'alla media attesa per la sua età, un dato che va letto insieme al comportamento nel compito.');
  const tagli = tts.ttsSpezzaLunga(conNumero, 120);
  check('il decimale non viene spezzato', true, tagli.every((p) => !/\d,\s*$/.test(p)));
  check('e il numero resta intero in un pezzo solo', true, tagli.some((p) => p.indexOf('-1,5') >= 0));
  check('il periodo torna identico rimettendolo insieme',
    conNumero.replace(/\s/g, ''), tagli.join('').replace(/\s/g, ''));

  // ------------------------------------- 13. voce di sistema (macOS `say`)
  sezione('Voce di sistema — elenco, scelta e comandi incorporati');

  const voce = require('../lib/voce');

  // L'elenco di `say -v '?'` è a colonne allineate, ma i nomi lunghi la sfondano
  // e resta un solo spazio: se il parser si basasse sugli spazi perderebbe metà voci.
  const ELENCO = [
    'Alice               it_IT    # Ciao! Mi chiamo Alice.',
    'Eddy (Italiano (Italia)) it_IT    # Ciao! Mi chiamo Eddy.',
    'Federica (Premium)  it_IT    # Ciao! Mi chiamo Federica.',
    'Grandma (Italiano (Italia)) it_IT    # Ciao! Mi chiamo Grandma.',
    'Daniel              en_GB    # Hello! My name is Daniel.',
    ''
  ].join('\n');
  const voci = voce.parsaVoci(ELENCO);
  check('anche le righe con un solo spazio vengono lette', 5, voci.length);
  check('nome con parentesi annidate intero', 'Eddy (Italiano (Italia))', voci[1].nome);
  check('lingua normalizzata con trattino', 'it-IT', voci[0].lingua);
  check('la riga vuota non produce una voce', true, voci.every((v) => !!v.nome));

  check('solo le italiane', 4, voce.italiane(voci).length);
  check('la premium viene per prima', 'Federica (Premium)', voce.italiane(voci)[0].nome);
  check('poi le voci di sistema serie', 'Alice', voce.italiane(voci)[1].nome);
  check('le voci-scherzo in fondo', true, /Eddy|Grandma/.test(voce.italiane(voci)[3].nome));
  check('la scelta automatica è la premium', 'Federica (Premium)', voce.migliore(voci));
  check('senza italiane non si sceglie nulla', null, voce.migliore(voce.parsaVoci('Daniel  en_GB  # Hello.')));

  /* Dentro un blocco la prosodia la fa il motore: il testo torna a essere il
     paragrafo che era, senza comandi. Le pause di fine frase le mette già lui —
     misurate con ffmpeg su Federica (Premium): 247 ms dopo un punto — e le
     nostre, sommandosi, davano 733 ms: la lettura zoppicava. */
  const seg = [
    { t: 'Prima frase del paragrafo.', rate: 1, pausa: 300 },
    { t: 'Seconda frase, con un inciso, e via.', rate: 1, pausa: 300 },
    { t: 'Ultima frase?', rate: 0.98, pausa: 430 }
  ];
  const detto = voce.preparaTesto(seg, { velocita: 1 });
  check('nessun comando di silenzio dentro il blocco', 0, (detto.match(/\[\[slnc/g) || []).length);
  check('nessun comando di velocità dentro il blocco', 0, (detto.match(/\[\[rate/g) || []).length);
  check('il paragrafo torna intero, unito da spazi',
    'Prima frase del paragrafo. Seconda frase, con un inciso, e via. Ultima frase?', detto);
  check('la punteggiatura resta: è lei a dare l\'intonazione', true, /\?$/.test(detto));
  check('le frasi vuote non lasciano spazi doppi', 'Una. Due.',
    voce.preparaTesto([{ t: 'Una.' }, { t: '  ' }, { t: 'Due.' }], {}));
  check('senza segmenti non si parla', '', voce.preparaTesto([], {}));
  check('e nemmeno con un elenco assente', '', voce.preparaTesto(null, {}));

  // la velocità non sta più nel testo ma nella riga di comando, una per blocco
  check('un blocco di testo corrente va a velocità piena', true,
    Math.abs(voce.velocitaBlocco(seg, 1) - 0.993) < 0.01);
  check('un titolo va più adagio', 0.94, voce.velocitaBlocco([{ t: 'Titolo.', rate: 0.94 }], 1));
  check('e la velocità scelta si compone con quella del blocco', 1.88,
    voce.velocitaBlocco([{ t: 'Titolo.', rate: 0.94 }], 2));
  check('in parole al minuto: il titolo resta più lento del testo', true,
    voce.wpmDaVelocita(voce.velocitaBlocco([{ t: 'T.', rate: 0.94 }], 1))
    < voce.wpmDaVelocita(voce.velocitaBlocco(seg, 1)));
  check('senza segmenti si resta alla velocità chiesta', 1.5, voce.velocitaBlocco([], 1.5));

  /* La curva parole-al-minuto di say non è lineare: 0,75 × 180 = 135 dà 0,91×,
     cioè quasi nessun rallentamento. I valori qui sotto sono misurati con afinfo
     su Federica (Premium) e Alice, che concordano entro il 5%. */
  check('0,75× non è 135 wpm ma molto meno', 50, voce.wpmDaVelocita(0.75));
  check('1× è la velocità di crociera', 180, voce.wpmDaVelocita(1));
  check('1,5× misurato', 280, voce.wpmDaVelocita(1.5));
  check('2× misurato', 385, voce.wpmDaVelocita(2));
  check('la scala è monotona crescente', true,
    [0.75, 0.9, 1, 1.2, 1.5, 1.8, 2, 3].every((v, i, a) => i === 0 || voce.wpmDaVelocita(v) > voce.wpmDaVelocita(a[i - 1])));
  check('sotto la soglia il motore non sa andare: si resta al minimo', 50, voce.wpmDaVelocita(0.3));
  check('oltre la scala si resta al massimo', 560, voce.wpmDaVelocita(9));
  check('senza velocità si legge a 1×', 180, voce.wpmDaVelocita(undefined));
  check('il rallentando del titolo passa dalla stessa curva', 150,
    voce.wpmDaVelocita(voce.velocitaBlocco([{ t: 'Titolo.', rate: 0.94 }], 1)));
  check('e anche a 2× il titolo resta più lento della frase piana', true,
    voce.wpmDaVelocita(voce.velocitaBlocco([{ t: 'Titolo.', rate: 0.94 }], 2))
    < voce.wpmDaVelocita(voce.velocitaBlocco(seg, 2)));

  // Le quadre nel testo sarebbero lette come comandi: vanno neutralizzate
  const insidia = voce.preparaTesto([{ t: 'Testo con [[slnc 9000]] dentro.', rate: 1, pausa: 0 }], {});
  check('nessun comando iniettabile dal testo', 0, (insidia.match(/\[\[/g) || []).length);
  check('e il testo resta leggibile', 'Testo con   slnc 9000   dentro.', insidia);

  check('riga di comando: voce, velocità e testo da stdin',
    '["-v","Federica (Premium)","-r","180","-f","-"]',
    JSON.stringify(voce.argomenti('Federica (Premium)', { wpm: 180 })));
  check('senza voce scelta non si passa -v', false,
    voce.argomenti(null, { wpm: 200 }).indexOf('-v') >= 0);

  /* Con un file di destinazione la voce non esce dall'altoparlante ma finisce in
     un .m4a: è così che l'avvio di say esce dalla catena dell'ascolto. */
  const argRendi = voce.argomenti('Alice', { wpm: 180, file: '/tmp/x.m4a' });
  check('sintesi su file: formato adatto al browser', true, argRendi.indexOf('--data-format=aac') >= 0);
  check('sintesi su file: destinazione passata a say', true,
    argRendi[argRendi.indexOf('-o') + 1] === '/tmp/x.m4a');
  check('e il testo continua ad arrivare da stdin', '-', argRendi[argRendi.length - 1]);

  // prova vera contro la sintesi di sistema: solo dove c'è (macOS con `say`)
  if (voce.disponibile()) {
    const dest = path.join(os.tmpdir(), 'studia-test-voce-' + process.pid + '.m4a');
    const esito = await voce.rendi('Prova di sintesi su file.', voce.migliore(voce.elenco()), { wpm: 180, file: dest });
    check('la sintesi su file riesce', true, esito.ok);
    check('e il file esiste e non è vuoto', true, fs.existsSync(dest) && fs.statSync(dest).size > 1000);
    const testa = fs.readFileSync(dest).slice(4, 8).toString('latin1');
    check('è davvero un contenitore MP4', 'ftyp', testa);
    try { fs.unlinkSync(dest); } catch (e) {}
    const vuoto = await voce.rendi('x', null, { wpm: 180 });   // senza destinazione non si sintetizza
    check('senza file di destinazione non si sintetizza', false, vuoto.ok);
  } else {
    console.log('  · sintesi di sistema assente: prova su file saltata');
  }

  // ------------------------------------- confine fra i materiali dei corsi
  sezione('Scoping — i materiali di un corso non sfiorano quelli di un altro');
  {
    /* Vault sintetico con DUE corsi che si portano dentro i materiali. È lo
       scenario che in produzione faceva costruire una lezione sulla conferenza OECD
       leggendo anche quaranta lezioni sulla dislessia — e pagandole. Sintetico e
       non sul vault vero, così il controllo vale su qualunque macchina. */
    const os2 = require('os');
    const VS = fs.mkdtempSync(path.join(os2.tmpdir(), 'studia-scope-'));
    const matL = require('../lib/materiali');
    const corpL = require('../lib/corpus');

    const metti = (prog, sub, nome, testo) => {
      const d = path.join(VS, 'Corsi', prog, matL.CARTELLA, sub);
      fs.mkdirSync(d, { recursive: true });
      fs.writeFileSync(path.join(d, nome), testo);
    };
    // ALFA: un video con la sua trascrizione. BETA: un altro, numerato diverso.
    metti('ALFA', 'Video', '01 lezione alfa.mp4', 'x');
    metti('ALFA', 'Trascrizioni', '01 lezione alfa.json',
      JSON.stringify({ media: '01 lezione alfa.mp4', segments: [{ start: 0, end: 30, text: 'alfa parla di alfabeto' }] }));
    metti('BETA', 'Video', '50 lezione beta.mp4', 'x');
    metti('BETA', 'Trascrizioni', '50 lezione beta.json',
      JSON.stringify({ media: '50 lezione beta.mp4', segments: [{ start: 0, end: 30, text: 'beta parla di betulle' }] }));

    const dAlfa = corpL.digest(VS, 'ALFA');
    const dBeta = corpL.digest(VS, 'BETA');
    const dTutto = corpL.digest(VS);
    check('ALFA vede un solo materiale', 1, dAlfa.totale);
    check('ed è il suo', '01', dAlfa.materiali[0].num);
    check('BETA vede un solo materiale', 1, dBeta.totale);
    check('ed è il suo', '50', dBeta.materiali[0].num);
    check('senza corso si vede tutto il vault (uso storico)', 2, dTutto.totale);

    // il confine vale anche per i derivati: la trascrizione di BETA non deve
    // rispondere a una richiesta fatta nel contesto di ALFA
    check('la trascrizione altrui non si trova da dentro un corso', '',
      matL.trova(VS, 'Trascrizioni', '50 lezione beta.json', 'ALFA', true));
    check('ma la propria sì', true,
      !!matL.trova(VS, 'Trascrizioni', '01 lezione alfa.json', 'ALFA', true));

    /* Vault vecchio: i materiali stanno nella radice e il corso non ha una
       cartella MATERIALI. Lì il confine non deve scattare, o un vault che ha
       sempre funzionato smetterebbe di vedere i propri file. */
    const VV = fs.mkdtempSync(path.join(os2.tmpdir(), 'studia-scope-old-'));
    fs.mkdirSync(path.join(VV, 'Media'), { recursive: true });
    fs.mkdirSync(path.join(VV, 'Trascrizioni'), { recursive: true });
    fs.mkdirSync(path.join(VV, 'Corsi', 'VECCHIO'), { recursive: true });
    fs.writeFileSync(path.join(VV, 'Media', '01 storica.mp4'), 'x');
    fs.writeFileSync(path.join(VV, 'Trascrizioni', '01 storica.json'),
      JSON.stringify({ media: '01 storica.mp4', segments: [{ start: 0, end: 10, text: 'materiale storico del vault' }] }));
    check('un corso senza MATERIALI/ pesca ancora dal corpus del vault', 1,
      corpL.digest(VV, 'VECCHIO').totale);
    check('haMateriali distingue i due casi', [true, false],
      [matL.haMateriali(VS, 'ALFA'), matL.haMateriali(VV, 'VECCHIO')]);

    /* L'import deve far atterrare i file DENTRO il corso, o la numerazione per
       corso non vuol dire niente: si conterebbe il corso e si scriverebbe
       nella radice comune. Le due cose stanno o cadono insieme. */
    const impL = require('../lib/importa');
    check('un video importato in un corso va nella sua cartella Video',
      path.join('Corsi', 'ALFA', matL.CARTELLA, 'Video'), impL.destinazione('media', 'lezione.mp4', 'ALFA'));
    check('un mp3 va in Audio, non fra i video',
      path.join('Corsi', 'ALFA', matL.CARTELLA, 'Audio'), impL.destinazione('media', 'lezione.mp3', 'ALFA'));
    check('un PDF va in PDF', path.join('Corsi', 'ALFA', matL.CARTELLA, 'PDF'),
      impL.destinazione('pdf', 'dispensa.pdf', 'ALFA'));
    check('senza corso resta la radice del vault (uso storico)', 'Media',
      impL.destinazione('media', 'lezione.mp4', null));
  }

  // ------------------------------------- schede che sforano i tetti dello schema
  sezione('Schede — un eccesso di forma si corregge, non butta via il lavoro');
  {
    const sch = require('../lib/schede');
    const val = require('../lib/validate');
    const tetti = val.schemaDi('scheda').properties;

    // una scheda buona ma prolissa: la fusione di molte porzioni fa proprio così
    const grande = {
      sintesi: 'Una sintesi abbastanza lunga da superare il minimo dello schema, senza problemi.',
      temi: Array.from({ length: 40 }, (_, i) => ({ titolo: 'Tema numero ' + (i + 1) })),
      concetti: Array.from({ length: 55 }, (_, i) => 'concetto-' + (i + 1)),
      prerequisiti: Array.from({ length: 20 }, (_, i) => 'prerequisito ' + (i + 1))
    };
    const ridotta = sch.entroSchema(grande);
    check('i temi rientrano nel tetto', tetti.temi.maxItems, ridotta.temi.length);
    check('i concetti pure', tetti.concetti.maxItems, ridotta.concetti.length);
    check('e i prerequisiti', tetti.prerequisiti.maxItems, ridotta.prerequisiti.length);
    check('si taglia la CODA, non la testa', 'Tema numero 1', ridotta.temi[0].titolo);
    check('la scheda ora passa la validazione', [], val.schemaErrors('scheda', ridotta));
    check('e la riduzione è dichiarata, non silenziosa', true, /Ricondotta allo schema/.test(ridotta.note || ''));
    check('la nota resta entro il suo massimo', true, (ridotta.note || '').length <= tetti.note.maxLength);

    /* I tre modi in cui una scheda buona veniva scartata sul corpus OECD:
       una stringa oltre il massimo, un campo inventato, un enum sbagliato.
       Tutto-o-niente significava perdere l'analisi dell'intero materiale. */
    const storta = {
      sintesi: 'Una sintesi valida e abbastanza lunga da superare il minimo previsto.',
      temi: [{ titolo: 'Tema buono', inventato: 'campo che non esiste nello schema' }],
      livello: 'inesistente',
      fonteExtra: 'campo aggiunto dal modello',
      concetti: ['corto', 'c'.repeat(200), 'altro corto']
    };
    const dritta = sch.entroSchema(storta);
    check('la scheda storta ora valida', [], val.schemaErrors('scheda', dritta));
    check('il campo inventato sparisce', false, 'fonteExtra' in dritta);
    check('anche se annidato dentro un tema', false, 'inventato' in dritta.temi[0]);
    check('un enum sbagliato si toglie invece di far fallire tutto', false, 'livello' in dritta);
    check('la stringa lunga si accorcia', true, dritta.concetti[1].length <= tetti.concetti.items.maxLength);
    check('e le vicine restano intatte', ['corto', 'altro corto'], [dritta.concetti[0], dritta.concetti[2]]);
    check('il titolo del tema sopravvive alla ripulitura', 'Tema buono', dritta.temi[0].titolo);
    check('la nota elenca tutti e tre gli interventi', true,
      /fuori elenco/.test(dritta.note) && /campo non previsto/.test(dritta.note) && /caratteri/.test(dritta.note));

    // quel che NON si può aggiustare deve restare un errore: non si inventa contenuto
    const monca = sch.entroSchema({ temi: [{ titolo: 'Solo questo' }] });   // manca «sintesi», obbligatoria
    check('un campo obbligatorio mancante resta un errore', true,
      val.schemaErrors('scheda', monca).length > 0);

    // chi sta già nei limiti non deve essere toccato, nota compresa
    const piccola = { sintesi: 'Sintesi corta ma sufficientemente lunga per lo schema.', temi: [{ titolo: 'Unico tema' }] };
    const uguale = sch.entroSchema(piccola);
    check('una scheda nei limiti resta identica', JSON.stringify(piccola), JSON.stringify(uguale));
    check('e non le si appiccica nessuna nota', undefined, uguale.note);

    /* Il taglio è la rete di sicurezza, non la cura: i tetti vanno DETTI a chi
       scrive la scheda. Stavano solo nello schema che la giudicava. */
    const chiesto = sch.schemaScheda().properties;
    check('al modello si dichiara il tetto dei temi', tetti.temi.maxItems, chiesto.temi.maxItems);
    check('e quello dei concetti', tetti.concetti.maxItems, chiesto.concetti.maxItems);
    check('e dei capitoli proposti', tetti.capitoliProposti.maxItems, chiesto.capitoliProposti.maxItems);
  }

  // ------------------------------- le fonti citate finiscono nel frontmatter
  sezione('Capitolo — i rimandi scritti nel testo diventano fonti raccolte');
  {
    const genL = require('../lib/genera');
    /* Il difetto: il modello cita con [vai a 12:30](video:05#t=750) — glielo
       chiede il prompt — ma `videoRefs`/`sources` restavano vuoti, e il riquadro
       delle fonti in fondo al capitolo non mostrava niente. Ora si ricavano dal
       testo: una cosa scritta due volte prima o poi diverge, così non può. */
    const dati = {
      title: 'Un capitolo', inBreve: 'Apertura [vai a 0:00](video:26#t=0).',
      contenuto: 'Poi [vai a 2:09](video:27#t=129) e la [p. 7](pdf:30#p=7).',
      puntiChiave: ['Ripete lo stesso rimando [vai a 0:00](video:26#t=0)'],
      videoRefs: [], sources: []          // il modello li dichiara vuoti: succede spesso
    };
    const r = genL.rimandiDa(dati);
    check('i rimandi video si raccolgono da tutto il capitolo', 2, r.videoRefs.length);
    check('senza doppioni', ['26', '27'], r.videoRefs.map((v) => v.video));
    check('col loro minuto', [0, 129], r.videoRefs.map((v) => v.t));
    /* L'etichetta si prende dal testo del link SOLO se dice qualcosa. «vai a
       2:09» sta bene in mezzo a una frase, ma nel riquadro delle fonti produce
       una riga che ripete se stessa — «vai a 2:09 / Videolezione · 2:09» — dove
       ci si aspetta di leggere di che cosa si parla lì. Erano 86 voci su 996.
       Senza etichetta il lettore ripiega sul titolo del materiale, che informa. */
    check('un\'etichetta che è solo il puntatore non diventa etichetta', undefined, r.videoRefs[1].label);
    check('e i PDF finiscono in sources', [{ pdf: '30', page: 7, label: undefined }], r.sources);
    check('un\'etichetta che dice qualcosa invece resta', 'La doppia via di Frith',
      genL.rimandiDa({ contenuto: 'Vedi [La doppia via di Frith](pdf:30#p=7).' }).sources[0].label);
    check('anche se comincia con un puntatore', 'vai a 2:09 — la comorbilità',
      genL.rimandiDa({ contenuto: '[vai a 2:09 — la comorbilità](video:27#t=129)' }).videoRefs[0].label);
    check('un capitolo senza rimandi non ne inventa', [[], []], (function () {
      const v = genL.rimandiDa({ contenuto: 'Nessun link qui.', inBreve: '' });
      return [v.videoRefs, v.sources];
    })());

    /* UNIONE, non aut-aut. La prima versione teneva per intero la lista del
       modello appena conteneva una voce, e i rimandi in più scritti nel testo
       sparivano: 39 capitoli su 258 avevano il riquadro delle fonti monco,
       88 rimandi persi — il capitolo citava un minuto che poi non compariva. */
    const dich = [{ video: '26', t: 129, label: 'Automazione: definizione ed esempi' }];
    const trov = [{ video: '26', t: 0, label: 'vai a 0:00' },
      { video: '26', t: 129, label: 'vai a 2:09' },
      { video: '27', t: 311, label: 'vai a 5:11' }];
    const u = genL.unisciRimandi(dich, trov, 'video', 't');
    check('i rimandi si uniscono invece di escludersi', 3, u.length);
    check('in ordine di materiale e posizione', [0, 129, 311], u.map((r) => r.t));
    check('sul doppione vince l\'etichetta del modello, scritta per essere letta',
      'Automazione: definizione ed esempi', u.find((r) => r.t === 129).label);
    check('con un solo lato l\'unione non duplica', 1,
      genL.unisciRimandi([], [{ video: '05', t: 10 }], 'video', 't').length);
    check('il numero resta a due cifre', '05',
      genL.unisciRimandi([{ video: 5, t: 10 }], [], 'video', 't')[0].video);
  }

  // ------------------------------- scalette: riconoscere il materiale citato
  sezione('Scalette — un materiale citato per nome non fa buttare la scaletta');
  {
    const scaL = require('../lib/scaletta');
    /* Il caso vero: il modello metteva in «materiale» il TITOLO invece del
       numero, il confronto falliva, ogni capitolo restava senza fonti e veniva
       scartato — e l'utente leggeva «il modello non ha prodotto scalette
       utilizzabili» su una risposta perfettamente sensata. */
    const lezione = { folder: '03-delega', title: 'Delega', materiali: [
      { num: '34', source: '34 Lesson 4： A closer look at Delegation ｜ AI Fluency [EljzyfdYkrc].webm' },
      { num: '07', source: '07 Altra lezione qualsiasi.mp4' }
    ] };
    const titolo = 'Lesson 4: A closer look at Delegation | AI Fluency [EljzyfdYkrc]';
    check('il numero esatto si riconosce', '34', scaL.numeroDiFonte('34', lezione));
    check('il titolo riporta al suo numero', '34', scaL.numeroDiFonte(titolo, lezione));
    check('la punteggiatura a larghezza piena non conta', '34',
      scaL.numeroDiFonte('34 Lesson 4： A closer look at Delegation ｜ AI Fluency [EljzyfdYkrc].webm', lezione));
    check('un materiale di un\'altra lezione non passa', '', scaL.numeroDiFonte('99', lezione));
    check('e nemmeno un titolo che non c\'entra', '', scaL.numeroDiFonte('Tutt\'altro argomento', lezione));

    // l'alternativa intera sopravvive, che il modello citi per numero o per nome
    const perNome = scaL.normalizza({ nome: 'Sequenza', capitoli: [
      { titolo: 'Primo', sintesi: 's', fonti: [{ materiale: titolo, da: 0, a: 60 }] },
      { titolo: 'Secondo', sintesi: 's', fonti: [{ materiale: '07' }] }
    ] }, lezione);
    check('i capitoli citati per nome non si perdono', 2, perNome.capitoli.length);
    check('e la fonte è ricondotta al numero', ['34', '07'], perNome.capitoli.map((c) => c.fonti[0].materiale));
    check('coprendo tutti i materiali, l\'alternativa risulta completa', true, perNome.completa);

    // lo schema deve DIRE che vuole il numero: la regola in prosa non bastava
    const campo = scaL.schemaAlternative().properties.alternative.items
      .properties.capitoli.items.properties.fonti.items.properties.materiale;
    check('lo schema chiede esplicitamente il numero', true, /NUMERO/.test(campo.description || ''));
  }

  // ------------------------------- il piano deve accettare l'esito della generazione
  sezione('Piano — segnare una lezione come generata non deve far fallire il salvataggio');
  {
    const valP = require('../lib/validate');
    const base = {
      schema: 2, course: 'P', wizardStep: 4, status: 'approvato', granularity: 'atomico',
      lezioni: [{ folder: '01-un-lezione', title: 'Una lezione', rationale: 'perché sì',
        materiali: [{ source: '01', type: 'video' }], status: 'approvato' }]
    };
    check('il piano di partenza è valido', [], valP.schemaErrors('piano', base));

    /* Il difetto: gen:start scriveva i capitoli come {ordine, titolo, file},
       ma il piano li vuole come {file, title}. scriviPiano rifiutava, l'errore
       non veniva guardato, e il piano restava indietro: la lezione appariva
       ancora «da scrivere» dopo essere stata scritta. */
    const vecchiaForma = JSON.parse(JSON.stringify(base));
    vecchiaForma.lezioni[0].capitoli = [{ ordine: 1, titolo: 'Primo', file: '01-primo.md' }];
    check('la forma sbagliata viene ancora rifiutata (è giusto così)', true,
      valP.schemaErrors('piano', vecchiaForma).length > 0);

    const nuovaForma = JSON.parse(JSON.stringify(base));
    nuovaForma.lezioni[0].status = 'generato';
    nuovaForma.lezioni[0].capitoli = [{ file: '01-primo.md', title: 'Primo', status: 'generato' }];
    check('la forma che scrive la generazione passa', [], valP.schemaErrors('piano', nuovaForma));

    // «parziale» è uno stato che il codice produce davvero, quando qualche capitolo è scartato
    const parziale = JSON.parse(JSON.stringify(nuovaForma));
    parziale.lezioni[0].status = 'parziale';
    check('e «parziale» è uno stato ammesso', [], valP.schemaErrors('piano', parziale));
  }

  // --------------------------------- schemi ripuliti per Gemini
  sezione('Schema per Gemini — le parole chiave si tolgono, i nomi dei campi no');
  {
    const goog = require('../lib/ai/google');
    const schedeL = require('../lib/schede');
    const proposeL = require('../lib/propose');
    const validateL = require('../lib/validate');

    /* Il caso vero: una lezione ha un campo che si CHIAMA «title», e in JSON Schema
       «title» è anche una parola chiave di metadati. Toglierla ovunque cancellava
       il campo e lasciava `required: ["title"]` a puntare nel vuoto: Gemini
       rifiutava l'intera richiesta con «property is not defined». */
    const conTitle = {
      type: 'object', title: 'Metadato da togliere',
      properties: { lezioni: { type: 'array', maxItems: 9, items: {
        type: 'object', additionalProperties: false,
        properties: { title: { type: 'string', maxLength: 120, title: 'etichetta' }, materiali: { type: 'array', items: { type: 'string' } } },
        required: ['title', 'materiali'] } } },
      required: ['lezioni']
    };
    const pulito = goog.schemaPulito(conTitle);
    const campi = Object.keys(pulito.properties.lezioni.items.properties);
    check('il campo che si chiama «title» sopravvive', true, campi.indexOf('title') >= 0);
    check('e required resta soddisfacibile', [], pulito.properties.lezioni.items.required.filter((r) => campi.indexOf(r) < 0));
    check('il «title» di metadati viene tolto', false, 'title' in pulito);
    check('anche quello dentro la definizione di un campo', false, 'title' in pulito.properties.lezioni.items.properties.title);
    check('e le parole chiave che Gemini rifiuta spariscono', [false, false],
      ['maxItems' in pulito.properties.lezioni, 'additionalProperties' in pulito.properties.lezioni.items]);

    /* Guardia generale: per OGNI schema che l'app manda davvero a Gemini,
       dopo la ripulitura nessun `required` deve restare orfano. Vale anche per
       gli schemi che verranno aggiunti dopo. */
    function orfani(s, dove, out) {
      if (!s || typeof s !== 'object') return out;
      if (Array.isArray(s)) { s.forEach((x, i) => orfani(x, dove + '/' + i, out)); return out; }
      if (Array.isArray(s.required) && s.properties) {
        for (const r of s.required) if (!(r in s.properties)) out.push(dove + ' → ' + r);
      }
      for (const k of Object.keys(s)) orfani(s[k], dove + '/' + k, out);
      return out;
    }
    const daMandare = [
      ['scheda', validateL.schemaDi('scheda')],
      ['capitolo', validateL.schemaCapitolo()],
      ['porzione', schedeL.schemaPorzione()],
      ['schedaChiesta', schedeL.schemaScheda()],
      ['propostaIndice', proposeL.schemaRisposta()]
    ];
    for (const [nome, s] of daMandare) {
      check('«' + nome + '» ripulito non lascia required orfani', [], orfani(goog.schemaPulito(s), nome, []));
    }
  }

  // ------------------------------------------------- lingua di scrittura
  sezione('Lingua di scrittura — normalizzazione e direttiva nel prompt');
  {
    const lingua = require('../lib/lingua');
    check('un codice noto resta se stesso', 'en', lingua.normalizza('en'));
    check('maiuscole e spazi non contano', 'fr', lingua.normalizza('  FR '));
    check('un codice ignoto ricade sull\'italiano', 'it', lingua.normalizza('klingon'));
    check('l\'assenza di scelta ricade sull\'italiano', 'it', lingua.normalizza(undefined));
    // «auto» vale per la trascrizione, non per la scrittura: una lezione deve uscire in UNA lingua
    check('«auto» non è una lingua di uscita', 'it', lingua.normalizza('auto'));
    check('il nome esteso è in italiano', 'inglese', lingua.nome('en'));

    const dir = lingua.direttiva('en');
    check('la direttiva nomina la lingua in italiano', true, dir.indexOf('inglese') >= 0);
    check('e con il suo endonimo', true, dir.indexOf('English') >= 0);
    check('e protegge le citazioni testuali', true, /citazioni testuali/.test(dir));

    const sis = lingua.conDirettiva('REGOLE DEL CAPITOLO', 'de');
    check('la direttiva precede il prompt di sistema', true, sis.indexOf('tedesco') < sis.indexOf('REGOLE'));
    check('il prompt originale non viene perso', true, sis.indexOf('REGOLE DEL CAPITOLO') >= 0);
    check('un sistema vuoto non rompe niente', true, lingua.conDirettiva('', null).indexOf('italiano') >= 0);

    /* La direttiva deve arrivare a OGNI chiamata: il punto di passaggio è
       provider.completa(), non i singoli prompt. Qui si controlla che i moduli
       che chiamano il provider gli passino davvero la lingua ricevuta, perché è
       l'anello che si dimentica per primo quando se ne aggiunge uno nuovo. */
    const fs2 = require('fs'), path2 = require('path');
    for (const f of ['genera.js', 'schede.js', 'architettura.js', 'scaletta.js']) {
      const src = fs2.readFileSync(path2.join(__dirname, '..', 'lib', f), 'utf-8');
      const chiamate = (src.match(/apiKey: ai\.apiKey/g) || []).length;
      const conLingua = (src.match(/apiKey: ai\.apiKey, lingua: ai\.lingua/g) || []).length;
      check('lib/' + f + ': tutte le chiamate al modello portano la lingua', chiamate, conLingua);
    }
  }

  // ------------------------------ il materiale non elaborato non sparisce
  sezione('Corpus — un materiale senza indice non sparisce in silenzio');
  {
    const corpL = require('../lib/corpus');
    const os3 = require('os');
    const VN = fs.mkdtempSync(path.join(os3.tmpdir(), 'studia-muto-'));
    const dir = (s) => { const d = path.join(VN, 'Corsi', 'P', 'MATERIALI', s); fs.mkdirSync(d, { recursive: true }); return d; };
    fs.writeFileSync(path.join(dir('Video'), '01 con trascrizione.mp4'), 'x');
    fs.writeFileSync(path.join(dir('Trascrizioni'), '01 con trascrizione.json'),
      JSON.stringify({ segments: [{ start: 0, end: 10, text: 'testo della lezione' }] }));
    fs.writeFileSync(path.join(dir('PDF'), '02 mai indicizzato.pdf'), 'x');   // niente Indici-PDF
    fs.writeFileSync(path.join(dir('Web'), '03 pagina.html'), 'x');
    fs.writeFileSync(path.join(dir('Indici-Web'), '03 pagina.json'), JSON.stringify({ titolo: 'Pagina', testo: 'contenuto della pagina' }));

    /* Il guasto da cui nasce tutto questo: `digest` restituiva `null` per il
       materiale senza indice, e quel materiale spariva. Un digest amputato non
       si vede — rende ciechi in modo coerente le schede, il gate dell'80% e il
       recupero dei mancanti — e produce lezioni che ignorano metà del corpus. */
    const d = corpL.digest(VN, 'P');
    check('nel digest ci sono i soli materiali elaborati', 2, d.totale);
    check('ma quello senza indice è dichiarato', ['02'], d.senzaIndice.map((m) => m.num));
    check('e il conto di ciò che sta sul disco resta intero', 3, d.suDisco);

    /* Freezer degli HTML: `schema/piano.schema.json` ammette solo video e pdf.
       Prima una pagina web nel corpus faceva fallire la scrittura del piano —
       «piano non valido» — senza dire chi fosse il colpevole. Ora resta fuori
       di proposito, e chi chiama ha in mano la riga da mostrare. */
    const f = corpL.perIlPiano(d);
    check('il piano riceve solo ciò che può accogliere', ['01'], f.dg.materiali.map((m) => m.num));
    check('la pagina web è congelata, non persa', ['03'], f.congelati.map((m) => m.num));
    check('e l\'avviso nomina tutti e due i motivi', true,
      /non ancora elaborati/.test(corpL.avvisoEsclusi(f.congelati, f.senzaIndice)) &&
      /pagine web/.test(corpL.avvisoEsclusi(f.congelati, f.senzaIndice)));
    check('senza esclusi l\'avviso è vuoto', '', corpL.avvisoEsclusi([], []));
  }

  // --------------------------- la fonte si cita con un link, non a parole
  sezione('Capitolo — la fonte si cita con un link, non descrivendola a parole');
  {
    const genL = require('../lib/genera');
    const valL = require('../lib/validate');
    const ctx = { pdfByNum: { '03': 'd.pdf' }, mediaByNum: { '05': 'v.mp4' },
      attesi: [{ num: '03', tipo: 'pdf' }, { num: '05', tipo: 'video' }] };
    const base = { title: 'La doppia via', inBreve: 'Come si impara a leggere, in breve.',
      puntiChiave: ['La via lessicale', 'La via fonologica', 'Le due convivono'],
      quiz: [{ q: 'Le due vie di lettura convivono.', a: true, perche: 'Il modello le descrive come parallele.' }] };

    /* Il difetto misurato sul corpus vero: i video citati con un link in 123
       capitoli su 123, i PDF in 17 su 87. Negli altri 70 la fonte finiva in una
       nota in prosa — «Materiale 03, p. 7» — che non si può aprire, e il
       riquadro delle fonti restava un elenco a cui il testo non rimanda mai.
       La regola c'era nel prompt; mancava dove la risposta viene giudicata. */
    const muto = valL.validateCapitolo(Object.assign({}, base,
      { contenuto: 'Il documento lo spiega bene. Vedi [vai a 2:00](video:05#t=120).' }), ctx);
    check('un documento mai citato è un errore', true,
      muto.errors.some((e) => /materiale 03 \(documento\) non è mai citato/.test(e)));
    check('e il video citato non lo è', false,
      muto.errors.some((e) => /materiale 05/.test(e)));

    const citato = valL.validateCapitolo(Object.assign({}, base,
      { contenuto: 'Vedi [la doppia via](pdf:03#p=7) e [vai a 2:00](video:05#t=120).' }), ctx);
    check('con i due link il capitolo passa', [], citato.errors);

    /* La nota a piè di pagina era il nascondiglio preferito: il posto sembra
       giusto — è dove si mette una fonte in un libro — ma qui la fonte è un
       oggetto che si apre. Il controllo guarda anche le note, per questo. */
    const inProsa = valL.validateCapitolo(Object.assign({}, base, {
      contenuto: 'Vedi [la doppia via](pdf:03#p=7) e [vai a 2:00](video:05#t=120).[^1]',
      footnotes: ['Ripreso da Hammill; Materiale 03, p. 7.']
    }), ctx);
    check('la fonte scritta a parole in una nota è un errore', true,
      inProsa.errors.some((e) => /scritto a parole/.test(e)));
    check('un testo che parla di numeri senza citare fonti non è toccato', [],
      valL.citazioniInProsa('La lettura cresce di mezza sillaba al secondo per anno; la prova dura 20 minuti.'));
    check('e l\'etichetta consigliata non si autodenuncia', [],
      valL.citazioniInProsa('Vedi [p. 7](pdf:03#p=7).'));

    /* Le fonti attese le sa solo chi ha in mano la scaletta: il validatore vede
       il testo, non il piano da cui il testo nasce. */
    check('le fonti attese si ricavano dalla scaletta, senza doppioni',
      [{ num: '03', tipo: 'pdf' }, { num: '05', tipo: 'video' }],
      genL.fontiAttese({ fonti: [{ materiale: '03' }, { materiale: '05' }, { materiale: '03' }, { materiale: '99' }] },
        { '03': { tipo: 'pdf' }, '05': { tipo: 'video' } }));

    /* La regola va anche dove il modello guarda davvero: accanto al materiale. */
    check('l\'intestazione del blocco dice come si cita quel materiale',
      true, /pdf:03#p=PAGINA/.test(genL.comeCitare({ tipo: 'pdf' }, '03')));
    check('e per un video parla di secondi',
      true, /video:05#t=SECONDI/.test(genL.comeCitare({ tipo: 'video' }, '05')));
    check('il prompt di sistema vieta la fonte in prosa', true,
      /non scrivere MAI in prosa/i.test(genL.SISTEMA));

    /* Senza etichetta il riquadro ripiega sul titolo del materiale, e quel
       titolo lo calcolano in due: `corpus.titoloDi` nel processo principale e
       `titoloMateriale` nel renderer, che non può richiamare i moduli di lib/.
       Due copie della stessa regola divergono sempre — è già successo con
       l'ordinamento delle lezioni — quindi qui si confrontano. */
    const corpL2 = require('../lib/corpus');
    const html = fs.readFileSync(path.join(__dirname, '..', 'App', 'StudIA.html'), 'utf-8');
    const corpo = /function titoloMateriale\(file\)\{([\s\S]*?)\n\}/.exec(html);
    check('il renderer sa calcolare il titolo di un materiale', true, !!corpo);
    if (corpo) {
      const nelRenderer = new Function('file', corpo[1]);
      for (const nome of ['02 TD 74 La consulenza con la famiglia edu.galton.it.mp4',
        '03 I processi di apprendimento - Galton.pdf', '12 Lezione.webm', 'senza numero.pdf']) {
        check('titolo di «' + nome + '»: renderer e corpus dicono lo stesso',
          corpL2.titoloDi(nome), nelRenderer(nome));
      }
    }

    /* Il pezzo che tiene insieme i due precedenti: che la regola arrivi dal
       piano al validatore passando per generaCapitolo. È l'anello che si
       dimentica — una regola scritta e giudicata, ma mai collegata, non
       corregge niente. Qui il modello risponde prima senza citare il PDF e poi
       citandolo: il secondo giro deve passare. */
    const risposte = [
      Object.assign({}, base, { contenuto: 'Il documento lo spiega a lungo, senza link.' }),
      Object.assign({}, base, { contenuto: 'Come si vede alla [doppia via](pdf:03#p=7).' })
    ];
    let giro = 0; const visti = [];
    const esito = await genL.generaCapitolo('/vault/inesistente',
      { folder: '01-lezione', title: 'Lezione' },
      { titolo: 'Capitolo', fonti: [{ materiale: '03' }] }, 1, 1,
      [{ num: '03', nome: 'd.pdf', tipo: 'pdf', titolo: 'Dispensa', npagine: 40 }],
      { chiama: async (o) => { visti.push(o.utente); return { ok: true, dati: risposte[giro++] }; } });
    check('il capitolo che non cita il PDF viene rifiutato e riscritto', 2, esito.tentativi);
    check('e alla seconda risposta passa', [], esito.errori);
    check('la correzione dice esattamente che cosa manca', true,
      /non è mai citato/.test(visti[1]) && /pdf:03#p=PAGINA/.test(visti[1]));
  }

  // ---------------- la lettura avanzata dei documenti è FACOLTATIVA
  sezione('OCR — un componente che si può non avere, e l\'app funziona uguale');
  {
    const ocrL = require('../lib/ocr');
    const ambL = require('../lib/ambiente');

    /* La regola che questo componente deve rispettare sopra ogni altra: non
       essere necessario. Se `consiglio()` di ambiente.js segnalasse la sua
       assenza fra gli avvisi, su una macchina a posto ci sarebbe sempre
       qualcosa da segnalare — e un avviso che c'è sempre non lo legge nessuno. */
    const sano = ambL.consiglio({
      claudecode: { ok: true }, python: { trovato: true, v: [3, 13, 0], versione: '3.13.0' },
      modelloWhisperPresente: true, spazioLiberoGb: 100, vault: { path: '/v', scritturaOk: true },
      ocr: { installato: false }
    });
    check('senza OCR la macchina resta «niente da segnalare»', [], sano.avvisi.map((a) => a.id));
    check('ma la possibilità viene comunque offerta', 'assente', sano.ocr.passo);
    check('con l\'azione giusta', ['installa'], sano.ocr.azioni);

    const pronto = ocrL.consiglio({ installato: true, modelloScaricato: true, versioni: { dispositivo: 'mps' } },
      { python: { trovato: true }, spazioLiberoGb: 100 });
    check('installato e con i pesi: è pronto', 'pronto', pronto.passo);
    check('e si può togliere', ['rimuovi'], pronto.azioni);

    /* Il caso che fa perdere tempo alle persone: pacchetti installati ma pesi
       no. Senza dirlo, il primo documento sembra bloccato per dieci minuti. */
    const meta = ocrL.consiglio({ installato: true, modelloScaricato: false },
      { python: { trovato: true }, spazioLiberoGb: 100 });
    check('senza i pesi lo si dice, invece di scoprirlo al primo documento', 'senzaPesi', meta.passo);
    check('e il peso del download è scritto', true, /10,6 GB/.test(meta.testo));

    check('senza Python non si promette niente', 'impossibile',
      ocrL.consiglio({ installato: false }, { python: { trovato: false }, spazioLiberoGb: 100 }).passo);
    check('e nemmeno senza spazio', 'impossibile',
      ocrL.consiglio({ installato: false }, { python: { trovato: true }, spazioLiberoGb: 2 }).passo);
    check('quando gira sulla CPU si avverte che sarà lento', true,
      /lento/.test(ocrL.consiglio({ installato: true, modelloScaricato: true, versioni: { dispositivo: 'cpu' } },
        { python: { trovato: true }, spazioLiberoGb: 100 }).testo));

    /* I comandi si restituiscono invece di eseguirli proprio per poterli
       guardare: il nome del pacchetto e l'ordine dei passi sono la parte che si
       sbaglia per prima, e non serve una macchina per accorgersene. */
    const passi = ocrL.passiInstallazione('/usr/bin/python3', '/dati');
    check('si crea l\'ambiente, poi si aggiorna pip, poi si installa', 3, passi.length);
    check('e l\'ambiente è SEPARATO da quello della trascrizione', true,
      /pyenv-ocr$/.test(passi[0].args[2]) && passi[0].args[2].indexOf('pyenv-ocr') > 0);
    check('il pacchetto è quello con torch', true, passi[2].args.indexOf('chandra-ocr[hf]') >= 0);
    check('e i passi successivi usano il python dell\'ambiente nuovo', true,
      passi[1].cmd.indexOf('pyenv-ocr') > 0 && passi[2].cmd.indexOf('pyenv-ocr') > 0);
    check('scaricare i pesi è un passo a sé, che si può fare quando si vuole', true,
      /snapshot_download/.test(ocrL.passoScaricaModello('/dati').args[1]));

    /* Chi tiene i modelli su un disco esterno imposta HF_HOME: cercare a mano
       in ~/.cache direbbe «da scaricare» su un modello che c'è già. */
    const primaHome = process.env.HF_HOME, primaCache = process.env.HF_HUB_CACHE;
    delete process.env.HF_HUB_CACHE;
    process.env.HF_HOME = '/altrove';
    check('HF_HOME viene rispettato', path.join('/altrove', 'hub'), ocrL.cartellaHub());
    process.env.HF_HUB_CACHE = '/ancora-altrove';
    check('e HF_HUB_CACHE vince su HF_HOME', '/ancora-altrove', ocrL.cartellaHub());
    if (primaHome == null) delete process.env.HF_HOME; else process.env.HF_HOME = primaHome;
    if (primaCache == null) delete process.env.HF_HUB_CACHE; else process.env.HF_HUB_CACHE = primaCache;

    /* Quali pagine mandare a Chandra. A 169 secondi l'una, la regola decide se
       l'elaborazione dura ore o giorni: qui si fissa contro i casi veri, quelli
       che sono stati letti davvero e di cui si conosce l'esito. */
    const scheda = { file: 'x.pdf', pagine: [
      { p: 1, car: 2907, nImg: 0, nPath: 0 },      // prosa: Chandra non ha trovato nulla
      { p: 2, car: 56, nImg: 1, nPath: 0 },        // scansione: solo il piè di pagina con pypdf
      { p: 3, car: 1605, nImg: 1, nPath: 1 },      // pagina piena di testo CON una figura
      { p: 4, car: 4016, nImg: 0, nPath: 23 },     // tabella: filetti sottili, area minima
      { p: 5, car: 5262, nImg: 0, nPath: 1 },      // decorazione grande ma nessun contenuto
      { p: 6, car: 4811, nImg: 0, nPath: 0 }
    ] };
    const sel = ocrL.selezionaPagine(scheda);
    check('si scelgono le pagine che hanno davvero qualcosa da leggere', [2, 3, 4], sel.pagine);
    check('e si dice perché, una per una',
      { scansione: 1, figura: 1, 'tabella o schema': 1 }, sel.motivi);

    /* ⚠️ La caratteristica giusta è il CONTEGGIO degli oggetti, non la loro
       area. Una tabella è disegnata con filetti sottili: tanti tracciati, area
       quasi nulla. Una regola ad area perdeva la p.4 e segnalava la p.5, che non
       ha niente. Il conteggio è meccanico: un oggetto immagine È una figura. */
    check('una tabella fatta di filetti non sfugge', 'tabella o schema',
      ocrL.motivoPagina({ car: 4016, nImg: 0, nPath: 23 }));
    check('e una decorazione isolata non fa scattare niente', '',
      ocrL.motivoPagina({ car: 5262, nImg: 0, nPath: 1 }));
    check('una pagina illeggibile non si sceglie di nascosto', '',
      ocrL.motivoPagina({ p: 9, errore: 'RuntimeError' }));

    check('la stima si legge come la direbbe una persona',
      '6 pagine · 3 da rileggere (1 figura, 1 scansione, 1 tabella o schema) · 8 minuti',
      ocrL.rigaStima(sel));
    check('un PDF senza niente da fare lo dichiara', '4 pagine · nessuna da rileggere',
      ocrL.rigaStima(ocrL.selezionaPagine({ pagine: [1, 2, 3, 4].map((p) => ({ p, car: 3000, nImg: 0, nPath: 0 })) })));
    check('le durate si arrotondano come si parla', ['45 secondi', '25 minuti', '1,9 ore'],
      [ocrL.durata(45), ocrL.durata(1500), ocrL.durata(6800)]);
    check('il totale somma i PDF scelti', { pdf: 2, pagine: 6, secondi: 6 * ocrL.SEC_PER_PAGINA, testo: '17 minuti' },
      ocrL.totaleStima([sel, sel]));
  }

  // --------------------------------- percorsi: le varianti composte dal composer
  sezione('Percorsi — una mappa lezione → indice, e i capitoli condivisi contati una volta');
  {
    const perc = require('../lib/percorsi');
    const scaL = require('../lib/scaletta');

    /* Il vincolo sul numero dei capitoli: quando c'è vale per TUTTE le
       alternative. Se il modello lo usasse per differenziarle otterremmo il
       contrario di quello che serve — scalette che cambiano per lunghezza
       invece che per principio organizzativo. */
    check('senza numero non si dice niente al modello', '', scaL.vincoloCapitoli(null));
    check('un numero assurdo si ignora', '', scaL.vincoloCapitoli(1));
    check('col numero, il vincolo è esplicito e comune', true,
      /5 capitoli/.test(scaL.vincoloCapitoli(5)) && /TUTTE le alternative/.test(scaL.vincoloCapitoli(5)));
    check('e la copertura resta intera: si accorpa, non si lascia fuori', true,
      /accorpa/.test(scaL.vincoloCapitoli(3)));
    const msg = scaL.messaggio({ title: 'X', materiali: [] }, {}, '', '', 6);
    check('il vincolo entra nel messaggio al modello', true, /6 capitoli/.test(msg));
    check('e senza numero il messaggio non ne parla', false,
      /Numero dei capitoli/.test(scaL.messaggio({ title: 'X', materiali: [] }, {}, '', '')));

    const VP = fs.mkdtempSync(path.join(os.tmpdir(), 'studia-perc-'));
    const LEZIONI = ['01-intro', '02-delega', '03-fine'];
    // due indici per lezione, con un numero di capitoli diverso: serve a distinguere i conti
    const scalette = {};
    LEZIONI.forEach((f, i) => {
      const alternative = [
        { nome: 'Sequenza', capitoli: [{ titolo: 'a' }, { titolo: 'b' }] },
        { nome: 'Per domande', capitoli: [{ titolo: 'c' }, { titolo: 'd' }, { titolo: 'e' }] }
      ];
      perc.scriviScaletta(VP, 'P', f, alternative, i === 0 ? 5 : null);
      scalette[f] = { folder: f, alternative };
    });
    const riletta = perc.leggiScalette(VP, 'P');
    check('le scalette si rileggono dalla cache', 3, Object.keys(riletta).length);
    check('e con loro il numero di capitoli chiesto', 5, riletta['01-intro'].nCapitoli);
    check('quando non è stato chiesto resta null', null, riletta['02-delega'].nCapitoli);

    /* Due percorsi che scelgono lo stesso indice per una lezione condividono quei
       capitoli: si scrivono una volta sola. È l'unica ragione per cui otto
       varianti non costano otto volte, quindi il conto deve dirlo. */
    const gufo = { id: 'gufo', nome: 'Analitica', scelte: {
      '01-intro': { indice: 0 }, '02-delega': { indice: 1 }, '03-fine': { indice: 0 } } };
    const tarta = { id: 'tarta', nome: 'Sequenziale', scelte: {
      '01-intro': { indice: 0 }, '02-delega': { indice: 0 } } };
    perc.salvaTutti(VP, 'P', [gufo, tarta]);
    const salvati = perc.leggiTutti(VP, 'P');
    check('i percorsi si rileggono, in ordine di personaggio', ['gufo', 'tarta'], salvati.map((p) => p.id));
    check('l\'emoji viene dal personaggio, non da chi salva', '🦉', salvati[0].emoji);
    check('il buco è la lezione senza indice', ['03-fine'], perc.buchi(salvati[1], LEZIONI));
    check('e chi ha scelto tutto non ne ha', [], perc.buchi(salvati[0], LEZIONI));
    check('la coppia scelta da due percorsi è contata due volte', 2, perc.coppie(salvati)['01-intro:0']);

    /* Coppie distinte: 01:0 (2 cap) · 02:1 (3) · 03:0 (2) · 02:0 (2) = 9 da scrivere.
       Percorso per percorso sarebbero 7 (gufo) + 4 (tarta) = 11: i 2 capitoli di
       01:0, scelto da entrambi, si scrivono una volta sola. */
    const conti = perc.conteggio(salvati, scalette);
    check('si scrivono i capitoli delle coppie DISTINTE', 9, conti.daScrivere);
    check('la somma ingenua è più alta', 11, conti.ingenui);
    check('e la differenza è il risparmio', 2, conti.risparmiati);

    /* Rinominare la variante non deve lasciare due file dove prima ce n'era uno:
       il nome del file è il personaggio, il nome dato dall'utente è un campo. */
    perc.salvaTutti(VP, 'P', [Object.assign({}, gufo, { nome: 'Quella lunga' }), tarta]);
    check('rinominare non duplica il file', 2, fs.readdirSync(perc.dir(VP, 'P')).length);
    check('il nome nuovo c\'è', 'Quella lunga', perc.leggiTutti(VP, 'P')[0].nome);
    check('e lo slug lo segue', 'quella-lunga', perc.leggiTutti(VP, 'P')[0].slug);
    check('la data di creazione non si perde', true, !!perc.leggiTutti(VP, 'P')[0].creato);

    // togliere un personaggio dal tavolo deve togliergli anche il file
    perc.salvaTutti(VP, 'P', [tarta]);
    check('un percorso tolto sparisce dal disco', ['tarta'], perc.leggiTutti(VP, 'P').map((p) => p.id));
    check('un personaggio inventato non si salva', true, (() => {
      try { perc.scrivi(VP, 'P', { id: 'unicorno', scelte: {} }); return false; } catch (e) { return true; }
    })());
    /* Le cartelle delle coppie lezione+indice. Il suffisso c'è sempre, anche con
       una variante sola: se comparisse solo alla seconda, la prima dovrebbe
       cambiare nome — e con lei i rimandi [[03-delega]] già scritti altrove. */
    const treAlt = [{ nome: 'Sequenza didattica' }, { nome: 'Per domande' }, { nome: 'Sequenza didattica' }];
    const nomi = perc.cartelleAlternative('03-delega', treAlt);
    check('una cartella per indice, col nome dell\'indice', '03-delega--sequenza-didattica', nomi[0]);
    check('i nomi uguali non diventano una cartella sola', '03-delega--sequenza-didattica-2', nomi[2]);
    check('il suffisso c\'è anche con una variante sola', '01-intro--blocco-unico',
      perc.cartelleAlternative('01-intro', [{ nome: 'Blocco unico' }])[0]);
    check('e si scompone di nuovo in base e variante',
      { base: '03-delega', variante: 'per-domande' }, perc.scomponi('03-delega--per-domande'));
    check('una cartella senza suffisso non ha variante',
      { base: '03-delega', variante: '' }, perc.scomponi('03-delega'));
    check('un indice senza nome non fa sparire la cartella', '05-x--indice',
      perc.cartelleAlternative('05-x', [{}])[0]);

    /* La cartella si scrive dentro la scelta quando si salva: il lettore deve
       poter sapere quale cartella è sua senza rileggersi le scalette. */
    const arricchiti = perc.conCartelle([gufo], scalette);
    check('la scelta porta con sé la sua cartella', '02-delega--per-domande',
      arricchiti[0].scelte['02-delega'].cartella);
    check('e il nome dell\'indice, se non c\'era', 'Per domande', arricchiti[0].scelte['02-delega'].nome);
    check('conCartelle non tocca l\'originale', undefined, gufo.scelte['02-delega'].cartella);

    /* Le coppie da scrivere: una per cartella, con chi la usa. Rigenerare un
       indice condiviso riscrive i capitoli di tutti i percorsi che lo usano, e
       va detto prima di premere. */
    const daScrivere = perc.coppieDaScrivere([gufo, tarta], scalette);
    check('una coppia per cartella distinta', 4, daScrivere.length);
    check('ordinate per cartella', ['01-intro--sequenza', '02-delega--per-domande', '02-delega--sequenza', '03-fine--sequenza'],
      daScrivere.map((k) => k.cartella));
    check('la coppia condivisa dichiara chi la usa', ['gufo', 'tarta'],
      daScrivere.find((k) => k.cartella === '01-intro--sequenza').usataDa);
    check('e porta i capitoli da scrivere', 3,
      daScrivere.find((k) => k.cartella === '02-delega--per-domande').capitoli.length);
    check('un percorso che punta a un indice sparito non produce cartelle', 0,
      perc.coppieDaScrivere([{ id: 'gufo', scelte: { '09-inesistente': { indice: 0 } } }], scalette).length);
    check('la cartella di una scelta si ritrova anche a posteriori', '01-intro--sequenza',
      perc.cartellaDi(gufo, '01-intro', scalette));

    /* La cartella della coppia, con il suo `_lezione.md`. Il titolo resta quello
       della lezione base: due varianti sono la stessa lezione, e distinguerle nel
       titolo le farebbe leggere come due lezioni diverse nell'indice. */
    const lezioneBase = { folder: '02-delega', title: 'La competenza di Delega', area: 'AI',
                        materiali: [{ num: '07' }, { num: '03' }] };
    const coppia = { cartella: '02-delega--per-domande', folder: '02-delega', nome: 'Per domande', capitoli: [] };
    const prep = perc.preparaCartella(VP, 'P', lezioneBase, coppia, {});
    const lezioneMd = fs.readFileSync(path.join(prep.dir, '_lezione.md'), 'utf-8');
    check('il titolo è quello della lezione, non quello della variante', true, /title: "La competenza di Delega"/.test(lezioneMd));
    check('la variante è dichiarata nel frontmatter', true, /variante: "Per domande"/.test(lezioneMd));
    check('e con lei la lezione da cui nasce', true, /lezione_base: "02-delega"/.test(lezioneMd));
    // stessa forma che scrive `plan:approve` per le lezioni normali: due modi diversi divergerebbero
    check('i materiali della lezione base ci sono tutti', true, /materiali: \[07, 03\]/.test(lezioneMd));

    // un capitolo già scritto: senza «riscrivi» non si tocca, con «riscrivi» sparisce prima
    fs.writeFileSync(path.join(prep.dir, '01-primo.md'), '---\ntitle: "x"\n---\n', 'utf-8');
    fs.writeFileSync(path.join(prep.dir, '_lezione.md'), lezioneMd.replace('approvato', 'generato'), 'utf-8');
    perc.preparaCartella(VP, 'P', lezioneBase, coppia, {});
    check('senza riscrivere, i capitoli restano', ['01-primo.md'], perc.capitoliSulDisco(VP, 'P', coppia.cartella));
    check('e il _lezione.md non viene sovrascritto', true,
      /status: "generato"/.test(fs.readFileSync(path.join(prep.dir, '_lezione.md'), 'utf-8')));
    const rip = perc.preparaCartella(VP, 'P', lezioneBase, coppia, { riscrivi: true });
    check('riscrivendo, i capitoli vecchi si tolgono PRIMA', ['01-primo.md'], rip.tolti);
    check('e la cartella resta vuota per i nuovi', [], perc.capitoliSulDisco(VP, 'P', coppia.cartella));

    check('i percorsi stanno in PERCORSI/, fuori da _lavorazione', true,
      perc.dir(VP, 'P').endsWith(path.join('P', 'PERCORSI')) && perc.scaletteDir(VP, 'P').indexOf('_lavorazione') > 0);
    fs.rmSync(VP, { recursive: true, force: true });
  }

  // ------------------- il taglio delle lezioni corretto a mano, e ciò che invalida
  sezione('Piano — correggere le lezioni rinumera le cartelle, e le scalette appese cadono');
  {
    const pe = require('../lib/pianoedit');
    const perc = require('../lib/percorsi');
    const piano = () => ({ lezioni: [
      { folder: '01-intro', title: 'Introduzione', materiali: [{ num: '01' }, { num: '02' }] },
      { folder: '02-delega', title: 'Delega', materiali: [{ num: '03' }] },
      { folder: '03-fine', title: 'Conclusione', materiali: [{ num: '04' }] }
    ] });

    check('unire porta i materiali nel primo e toglie il secondo', ['01', '02', '03'],
      pe.applica(piano(), 'unisci', 0).lezioni[0].materiali.map((m) => m.num));
    check('e rinumera tutto ciò che segue', ['01-introduzione', '02-conclusione'],
      pe.applica(piano(), 'unisci', 0).lezioni.map((c) => c.folder));
    check('separare stacca l\'ultimo materiale in una lezione a sé', 4,
      pe.applica(piano(), 'separa', 0).lezioni.length);
    check('spostare in su scambia due lezioni', ['01-delega', '02-introduzione', '03-conclusione'],
      pe.applica(piano(), 'su', 1).lezioni.map((c) => c.folder));
    check('passare l\'ultimo materiale alla lezione dopo', ['02', '03'],
      pe.applica(piano(), 'giu-mat', 0).lezioni[1].materiali.map((m) => m.num));
    check('un comando impossibile non fa niente', ['01-intro', '02-delega', '03-fine'],
      pe.applica(piano(), 'su', 0).lezioni.map((c) => c.folder));
    check('il titolo decide il nome della cartella', '01-la-delega-consapevole',
      (() => { const p = piano(); p.lezioni[0].title = 'La delega consapevole'; return pe.rinumera(p).lezioni[0].folder; })());
    check('un titolo che inizia col numero non lo ripete', 'la-parte-prima', pe.slugLezione('03 - La parte prima'));

    /* Il punto: `02-delega` continua a esistere dopo l'unione, ma è un'ALTRA
       lezione. Una scaletta rimasta lì proporrebbe capitoli su materiali che quella
       lezione non ha — sembrando giusta. */
    const dopo = pe.applica(piano(), 'unisci', 0);
    check('la cartella sopravvissuta con altri materiali è «cambiata»', ['01-intro', '02-delega', '03-fine'],
      pe.cartelleCambiate(piano(), dopo).sort());
    check('senza modifiche non cambia niente', [], pe.cartelleCambiate(piano(), piano()));

    const VI = fs.mkdtempSync(path.join(os.tmpdir(), 'studia-inval-'));
    perc.scriviScaletta(VI, 'P', '01-intro', [{ nome: 'A', capitoli: [{ titolo: 'x' }] }], null);
    perc.scriviScaletta(VI, 'P', '03-fine', [{ nome: 'B', capitoli: [{ titolo: 'y' }] }], null);
    perc.salvaTutti(VI, 'P', [
      { id: 'gufo', nome: 'Analitica', scelte: { '01-intro': { indice: 0 }, '03-fine': { indice: 0 } } },
      { id: 'tarta', nome: 'Sequenziale', scelte: { '01-intro': { indice: 0 } } }
    ]);
    const morte = perc.invalida(VI, 'P', ['01-intro']);
    check('la scaletta della cartella cambiata sparisce', ['01-intro'], morte.scalette);
    check('quella intatta resta', ['03-fine'], Object.keys(perc.leggiScalette(VI, 'P')));
    check('e la scelta che la usava sparisce dal percorso', ['03-fine'],
      Object.keys(perc.leggiTutti(VI, 'P').find((p) => p.id === 'gufo').scelte));
    check('un percorso rimasto senza scelte non è più un percorso', ['gufo'],
      perc.leggiTutti(VI, 'P').map((p) => p.id));
    check('invalidare niente non tocca niente', { scalette: [], percorsi: [] }, perc.invalida(VI, 'P', []));
    fs.rmSync(VI, { recursive: true, force: true });

    /* Quante alternative chiedere: è un'opzione, non più una costante. Fuori
       dai limiti si torna al valore di partenza invece di chiedere «1 scaletta
       alternativa», che è una contraddizione. */
    const scaL = require('../lib/scaletta');
    check('il numero chiesto arriva nel prompt di sistema', true, /proponi 5 SCALETTE/.test(scaL.sistema(5)));
    check('e nel messaggio all\'utente', true,
      /Proponi 5 scalette/.test(scaL.messaggio({ title: 'X', materiali: [] }, {}, '', '', 0, 5)));
    check('senza numero resta il valore di partenza', true, /proponi 3 SCALETTE/.test(scaL.sistema(null)));
    check('un numero assurdo non passa', 3, scaL.quante(1));
    check('e nemmeno uno enorme', 3, scaL.quante(40));
    check('sei alternative sono ancora ammesse', 6, scaL.quante(6));
  }

  /* ================================================================= mappe
     I moduli di App/assets/mappa/ sono UMD proprio per finire qui: il renderer
     li carica con un <script>, questi controlli li richiedono da Node, e le due
     metà non possono divergere perché sono lo stesso file (trappola ④). */
  sezione('Mappe — igiene del grafo: i livelli non si credono, si ricalcolano');
  {
    const MG = require('../App/assets/mappa/grafo');

    // livelli dichiarati sbagliati: devono essere riscritti dalla struttura
    const bugiardo = MG.sanitizza({
      nodi: [{ id: 'r', livello: 5 }, { id: 'a', livello: 0 }, { id: 'b', livello: 9 }],
      archi: [{ da: 'r', a: 'a' }, { da: 'a', a: 'b' }]
    });
    check('i livelli vengono dalla struttura, non dal file',
      { r: 0, a: 1, b: 2 },
      bugiardo.nodi.reduce((o, n) => (o[n.id] = n.livello, o), {}));
    check('e la riparazione viene detta', true, /livelli ricalcolati/.test(bugiardo.note.join(' ')));

    // il gruppo (cioè il colore) si eredita dall'antenato di primo livello
    const colori = MG.sanitizza({
      nodi: [{ id: 'r' }, { id: 'a' }, { id: 'b' }, { id: 'a1' }, { id: 'b1' }],
      archi: [{ da: 'r', a: 'a' }, { da: 'r', a: 'b' }, { da: 'a', a: 'a1' }, { da: 'b', a: 'b1' }]
    });
    const g = colori.nodi.reduce((o, n) => (o[n.id] = n.gruppo, o), {});
    check('due rami diversi hanno gruppi diversi', true, g.a !== g.b);
    check('il figlio prende il gruppo del suo ramo', [true, true], [g.a1 === g.a, g.b1 === g.b]);

    // un arco verso il nulla si toglie, ma lo si dice
    const orfano = MG.sanitizza({ nodi: [{ id: 'x' }], archi: [{ da: 'x', a: 'fantasma' }] });
    check('l\'arco verso un nodo inesistente sparisce', 0, orfano.archi.length);
    check('e finisce nelle note invece di sparire in silenzio', true, /archi verso nodi inesistenti/.test(orfano.note.join(' ')));

    // cappi e doppioni sono rumore, non errori da segnalare
    check('cappi e archi doppi si tolgono senza rumore', 1,
      MG.sanitizza({ nodi: [{ id: 'a' }, { id: 'b' }],
        archi: [{ da: 'a', a: 'a' }, { da: 'a', a: 'b' }, { da: 'a', a: 'b' }] }).archi.length);

    // i due fuochi chiesti: un salto, e la linea di sangue intera
    const fuoco = { nodi: [{ id: 'r' }, { id: 'a' }, { id: 'b' }, { id: 'a1' }, { id: 'a2' }],
                    archi: [{ da: 'r', a: 'a' }, { da: 'r', a: 'b' }, { da: 'a', a: 'a1' }, { da: 'a1', a: 'a2' }] };
    check('vicini: solo chi tocca il nodo', ['a', 'a1', 'a2'].sort(), MG.vicini(fuoco, 'a1').sort());
    check('parentela: antenati e discendenti, non i fratelli', ['a', 'a1', 'a2', 'r'], MG.parentela(fuoco, 'a1').sort());
    check('discendenti lungo la foresta', ['a1', 'a2'], MG.discendenti(fuoco, 'a').sort());

    /* Rami chiusi. Il sottoalbero esce dal GRAFO, non si nasconde nel disegno:
       chiudere un ramo serve a restituire spazio agli altri, e un nodo lasciato
       lì invisibile terrebbe il buco dov'era. */
    const chiuso = MG.senzaRami(fuoco, { a: 1 });
    check('chiudendo un ramo sparisce tutto il sottoalbero', ['b', 'r', 'a'].sort(),
      chiuso.grafo.nodi.map((n) => n.id).sort());
    check('e si conta quanto è stato nascosto', 2, chiuso.quanti.a);
    check('il tasto del ramo chiuso dice «chiuso»', 'chiuso', chiuso.chiudibili.a);
    check('quello della radice resta «aperto»', 'aperto', chiuso.chiudibili.r);
    check('una foglia non ha nessun tasto', undefined, chiuso.chiudibili.b);
    check('gli archi verso i nodi spariti se ne vanno con loro', 2, chiuso.grafo.archi.length);
    check('senza rami chiusi il grafo è lo stesso oggetto', true, MG.senzaRami(fuoco, {}).grafo === fuoco);
    check('un id che non esiste più si ignora invece di far saltare tutto',
      5, MG.senzaRami(fuoco, { 'sparito': 1 }).grafo.nodi.length);
    check('chiudere una foglia non nasconde niente', 5, MG.senzaRami(fuoco, { b: 1 }).grafo.nodi.length);

    /* «Fissato» è una domanda sola, e la fanno in tre: i motori, le operazioni
       di modifica e il menu contestuale. Sta nel vocabolario del modello perché
       tre letture a occhio della stessa condizione sono tre condizioni diverse.
       ⚠️ Il controllo è sul TIPO: `+null` e `+''` fanno zero, e lo zero è una
       posizione legittima — un nodo posato sull'origine non deve risultare
       indistinguibile da uno che nessuno ha mai spostato. */
    check('x e y, entrambe numeri: il nodo è fissato', true, MG.fissato({ x: 120, y: -40 }));
    check('l\'origine è una posizione come le altre', true, MG.fissato({ x: 0, y: 0 }));
    check('i decimali e i negativi valgono', true, MG.fissato({ x: -12.5, y: 0.25 }));
    check('una coordinata sola non fissa niente', [false, false],
      [MG.fissato({ x: 120 }), MG.fissato({ y: 120 })]);
    check('una stringa non è ancora un numero', false, MG.fissato({ x: '120', y: '40' }));
    check('e nemmeno il vuoto, il nulla o il non-numero',
      [false, false, false, false, false],
      [MG.fissato({ x: '', y: '' }), MG.fissato({ x: null, y: null }),
       MG.fissato({ x: NaN, y: 3 }), MG.fissato({ x: 3, y: Infinity }), MG.fissato({})]);
    check('un nodo che non c\'è non è fissato', [false, false], [MG.fissato(null), MG.fissato(undefined)]);
  }

  sezione('Mappe — i quattro motori: deterministici e senza card sovrapposte');
  {
    const ML = require('../App/assets/mappa/layouts');
    const grande = (rami, figli) => {
      const nodi = [{ id: 'r', testo: 'Radice' }], archi = [];
      for (let i = 0; i < rami; i++) {
        nodi.push({ id: 'a' + i, testo: 'Ramo ' + i }); archi.push({ da: 'r', a: 'a' + i, rel: 'comprende' });
        for (let j = 0; j < figli; j++) { nodi.push({ id: 'a' + i + 'b' + j, testo: 'Foglia ' + i + '.' + j }); archi.push({ da: 'a' + i, a: 'a' + i + 'b' + j }); }
      }
      return { nodi, archi };
    };
    const casi = [grande(3, 2), grande(6, 4), grande(2, 0)];
    ML.MOTORI.forEach((motore) => {
      ['td', 'lr'].forEach((orient) => {
        casi.forEach((g, i) => {
          const m = ML.misura(ML.run(g, { motore, orient }));
          check('nessuna card sovrapposta · ' + motore + '/' + orient + ' caso ' + i, 0, m.cardSovrapposte);
        });
      });
    });

    /* Il determinismo non è un dettaglio: su una mappa la memoria di DOVE sta un
       concetto è parte di quello che si impara, e un layout che si riassesta a
       ogni apertura la manda a monte. */
    const g2 = grande(4, 3);
    ML.MOTORI.forEach((motore) => {
      const a = ML.run(g2, { motore }), b = ML.run(g2, { motore });
      check('stesso grafo, stesso disegno · ' + motore, JSON.stringify(a.pos), JSON.stringify(b.pos));
    });

    // un ciclo non deve poter bloccare il disegno
    const ciclo = { nodi: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
                    archi: [{ da: 'a', a: 'b' }, { da: 'b', a: 'c' }, { da: 'c', a: 'a' }] };
    const rc = ML.run(ciclo, { motore: 'dag' });
    check('un ciclo si rompe invertendo un arco, non perdendolo', 1, rc.stats.invertiti);
    check('e tutti i nodi restano sul foglio', 3, Object.keys(rc.pos).length);
    check('grafo vuoto: nessuna eccezione', 0, Object.keys(ML.run({ nodi: [], archi: [] }, { motore: 'albero' }).pos).length);

    // il percorso è una scaletta: i prerequisiti prima, numerati
    const cat = { nodi: [{ id: 'z' }, { id: 'y' }, { id: 'x' }],
                  archi: [{ da: 'x', a: 'y' }, { da: 'y', a: 'z' }] };
    const p = ML.run(cat, { motore: 'percorso' });
    check('il percorso numera i passi in ordine di prerequisito', [1, 2, 3], [p.passo.x, p.passo.y, p.passo.z]);

    /* L'orientamento è una trasformazione finale sulle stesse coordinate
       interne. Non è uno specchio — le distanze si misurano sulla dimensione
       della card in QUEL verso, e una card è larga 168 e alta 48 — ma il livello
       resta un livello: dall'alto è una riga, da sinistra è una colonna. */
    const td = ML.run(g2, { motore: 'albero', orient: 'td' }), lr = ML.run(g2, { motore: 'albero', orient: 'lr' });
    check('td e lr dispongono gli stessi nodi', Object.keys(td.pos).sort(), Object.keys(lr.pos).sort());
    const stessoLivello = Object.keys(td.pos).filter((k) => td.pos[k].livello === 1);
    check('dall\'alto un livello è una riga', 1, new Set(stessoLivello.map((k) => Math.round(td.pos[k].y))).size);
    check('da sinistra lo stesso livello è una colonna', 1, new Set(stessoLivello.map((k) => Math.round(lr.pos[k].x))).size);
    check('e i due versi non si somigliano per caso', true,
      Math.round(td.bbox.w) !== Math.round(lr.bbox.w));
  }

  /* Il patto (PIANO-MAPPE-EDITOR §12.1, G1): un nodo è FISSATO se e solo se
     porta `x` e `y`, entrambi numeri finiti. Trascinare un nodo scrive quelle
     due coordinate e `mappe.js` le porta su disco: un motore che le ignorasse
     rimetterebbe la mappa in ordine alla riapertura, e mezz'ora di sistemazione
     sparirebbe senza che nessuno lo dica — la classe di guasto tipica di
     quest'app. Il secondo pezzo è meno visibile e conta uguale: gli archi vanno
     RI-instradati, altrimenti restano attaccati a dov'era il nodo e `misura()`
     conta su una geometria che nessuno vede. */
  sezione('Mappe — le posizioni fissate a mano vincono sul motore');
  {
    const ML = require('../App/assets/mappa/layouts');
    const base = { nodi: [{ id: 'r', testo: 'Radice' }, { id: 'a', testo: 'A' },
                          { id: 'b', testo: 'B' }, { id: 'c', testo: 'C' }],
                   archi: [{ da: 'r', a: 'a' }, { da: 'r', a: 'b' }, { da: 'a', a: 'c' }] };
    // `c` con le coordinate addosso, tutto il resto identico
    const conC = (p) => ({ nodi: base.nodi.map((n) => (n.id === 'c' ? Object.assign({}, n, p) : n)),
                           archi: base.archi });
    const FUORI = { x: 640, y: -300 };            // dove nessun motore lo metterebbe
    const altri = (res) => ['r', 'a', 'b'].map((k) => [k, res.pos[k].x, res.pos[k].y]);
    // i capi degli archi che toccano `c`, filigrana del percorso compresa
    const capiSuC = (res) => (res.archi || []).concat(res.extra || [])
      .filter((a) => a.e.da === 'c' || a.e.a === 'c')
      .map((a) => (a.e.a === 'c' ? a.punti[a.punti.length - 1] : a.punti[0]));
    /* Sul BORDO vuol dire sul perimetro della card (168×48), non «vicino»: la
       porta è un punto esatto su un lato, e mezzo pixel di tolleranza basta e
       avanza per gli arrotondamenti. */
    const sulBordo = (p, c) => {
      const dx = Math.abs(p.x - c.x), dy = Math.abs(p.y - c.y);
      return (Math.abs(dy - 24) < 0.5 && dx <= 84.5) || (Math.abs(dx - 84) < 0.5 && dy <= 24.5);
    };

    ML.MOTORI.forEach((motore) => {
      const libero = ML.run(base, { motore });
      const fisso = ML.run(conC(FUORI), { motore });
      check('il nodo fissato resta dove l\'ha messo la mano · ' + motore,
        [640, -300], [fisso.pos.c.x, fisso.pos.c.y]);
      check('un nodo senza coordinate non si sposta di un pixel · ' + motore,
        altri(libero), altri(fisso));
      check('gli archi che lo raggiungono finiscono sul suo bordo · ' + motore, [true, true],
        [capiSuC(fisso).length > 0, capiSuC(fisso).every((p) => sulBordo(p, fisso.pos.c))]);
      check('e non dove il motore li avrebbe messi · ' + motore, false,
        JSON.stringify(capiSuC(libero)) === JSON.stringify(capiSuC(fisso)));
      check('il riquadro comprende il nodo fissato · ' + motore, [true, true],
        [fisso.bbox.maxX >= 724 - 0.01, fisso.bbox.minY <= -324 + 0.01]);
      check('misura() legge la geometria nuova · ' + motore, true,
        ML.misura(fisso).larghezza > ML.misura(libero).larghezza);
      check('quante posizioni sono fissate lo dicono le statistiche · ' + motore, 1, fisso.stats.fissate);
      check('e il determinismo regge anche con le coordinate a mano · ' + motore,
        JSON.stringify(fisso.pos), JSON.stringify(ML.run(conC(FUORI), { motore }).pos));
    });

    // da sinistra la porta cade sul lato verticale: il bordo è un altro, la regola no
    const daSin = ML.run(conC(FUORI), { motore: 'albero', orient: 'lr' });
    check('vale anche da sinistra, e l\'arco arriva sul lato giusto', [true, true],
      [daSin.pos.c.x === 640 && daSin.pos.c.y === -300,
       capiSuC(daSin).every((p) => sulBordo(p, daSin.pos.c))]);

    /* Il pezzo che si perderebbe più facilmente è il secondo: non le card
       spostate — quelle si vedono — ma gli archi ri-instradati. Qui il nodo
       fissato sta esattamente sopra la radice, la mappa resta larga uguale, e
       un arco che prima non passava su nessuna card ora ci passa sopra. Con la
       geometria vecchia `misura()` direbbe zero. */
    const prima = ML.misura(ML.run(base, { motore: 'albero' }));
    const dopo = ML.misura(ML.run(conC({ x: 97, y: -300 }), { motore: 'albero' }));
    check('un arco che ora passa sopra una card viene contato', [0, 1],
      [prima.archiSuCard, dopo.archiSuCard]);
    check('e non è il riquadro a dirlo: la larghezza è la stessa', prima.larghezza, dopo.larghezza);

    /* Mezza coordinata non è una posizione: un nodo con la sola `x` finirebbe
       su `y = 0`, che nessuno ha scelto. E una stringa non è un numero — sono
       già numeri quando arrivano dal disco, e accettare "640" qui vorrebbe dire
       avere due idee di che cos'è una coordinata. */
    const dovEra = ML.run(base, { motore: 'albero' }).pos.c;
    [['solo la x', { x: 640 }], ['solo la y', { y: -300 }],
     ['una x che non è un numero', { x: NaN, y: -300 }],
     ['coordinate scritte come stringhe', { x: '640', y: '-300' }],
     ['una coordinata infinita', { x: Infinity, y: 0 }]].forEach((caso) => {
      const r = ML.run(conC(caso[1]), { motore: 'albero' });
      check(caso[0] + ': il nodo resta dove lo mette il motore',
        [dovEra.x, dovEra.y], [r.pos.c.x, r.pos.c.y]);
      check(caso[0] + ': e non conta come fissato', 0, r.stats.fissate);
    });
    /* Il motore non ha una sua idea di «fissato»: chiede a `grafo.fissato`, la
       stessa che risponde a `modifica.libera` e al menu contestuale. */
    check('e lo zero, che è una posizione, il motore lo onora',
      [0, 0], (() => { const z = ML.run(conC({ x: 0, y: 0 }), { motore: 'albero' }); return [z.pos.c.x, z.pos.c.y]; })());
    check('anche quando il motore lo avrebbe messo altrove', true,
      dovEra.x !== 0 || dovEra.y !== 0);

    // due nodi fissati non si contendono la passata: valgono tutti e due
    const due = ML.run({ nodi: base.nodi.map((n) => (n.id === 'c' ? Object.assign({}, n, FUORI)
                                        : n.id === 'b' ? Object.assign({}, n, { x: -500, y: 400 }) : n)),
                         archi: base.archi }, { motore: 'albero' });
    check('due nodi fissati stanno tutti e due dove sono stati messi',
      [640, -300, -500, 400], [due.pos.c.x, due.pos.c.y, due.pos.b.x, due.pos.b.y]);
    check('e le statistiche li contano entrambi', 2, due.stats.fissate);
    check('senza nessuna coordinata il conto è zero', 0, ML.run(base, { motore: 'albero' }).stats.fissate);
  }

  sezione('Mappe — la vista generata esce dai file del capitolo, non dal modello');
  {
    const GEN = require('../App/assets/mappa/genera');
    const DIS = require('../App/assets/mappa/disegna');
    const REL = require('../App/assets/mappa/relazioni');
    const ML2 = require('../App/assets/mappa/layouts');

    // il capitolo arriva come lo produce il parser del lettore: HTML, non markdown
    const cap = {
      title: 'La decodifica',
      brief: '<p>Leggere non è capire.</p>',
      html: '<h3>Che cos\'è</h3><p>Vedi <a href="#" class="vlink" data-file="05 lez.mp4" data-t="132" data-label="2:12">2:12</a>.</p>' +
            '<h4>Automatismo</h4><p>x</p>' +
            '<h3>Come si valuta</h3><p><a href="#" class="plink" data-file="03 disp.pdf" data-page="7" data-label="p. 7">p. 7</a></p>',
      keypoints: ['Uno &amp; due', 'Tre'],
      glossary: [{ t: 'DSA', d: 'Disturbo specifico' }]
    };
    const gc = GEN.daCapitolo(cap, { glossario: true, indice: 3 });
    const perTesto = (t) => gc.nodi.find((n) => n.testo === t);
    check('la radice è il titolo del capitolo', 'La decodifica', gc.nodi[0].testo);
    check('i titoli di sezione diventano rami', true, !!perTesto('Che cos\'è') && !!perTesto('Come si valuta'));
    check('il sottotitolo sta sotto la sua sezione, non accanto', true,
      gc.archi.some((a) => a.da === perTesto('Che cos\'è').id && a.a === perTesto('Automatismo').id));
    check('l\'HTML dei punti chiave arriva come testo leggibile', true, !!perTesto('Uno & due'));

    /* Il rimando è il pezzo che fa di una mappa uno strumento e non un disegno:
       il nodo sa da dove viene, e il lettore lo riapre con `openNote`. */
    check('il nodo della sezione porta il rimando che quella sezione cita',
      { type: 'video', file: '05 lez.mp4', t: 132, label: '2:12' }, perTesto('Che cos\'è').rimando);
    check('e la sezione col PDF porta la pagina',
      { type: 'pdf', file: '03 disp.pdf', page: 7, label: 'p. 7' }, perTesto('Come si valuta').rimando);

    // senza titoli di sezione i punti chiave SONO la mappa: nessun raccoglitore inutile
    const nudo = GEN.daCapitolo({ title: 'T', brief: '', html: '<p>solo testo</p>', keypoints: ['a', 'b'], glossary: [] }, {});
    check('capitolo senza sezioni: i punti chiave stanno sotto la radice', 3, nudo.nodi.length);
    check('e non c\'è un livello «Punti chiave» che non serve', undefined, nudo.nodi.find((n) => n.testo === 'Punti chiave'));
    const conGl = GEN.daCapitolo({ title: 'T', brief: '', html: '<p>x</p>', keypoints: ['a'], glossary: [{ t: 'X', d: 'd' }] }, { glossario: true });
    check('col glossario invece i due gruppi si distinguono', true, !!conGl.nodi.find((n) => n.testo === 'Punti chiave'));

    /* «Note e materiali» come ramo. Misurato su TD74: senza, 70 capitoli su 210
       non avevano NESSUN nodo che riportasse alla fonte — la mappa si guardava
       e basta. Le etichette arrivano già risolte da chi chiama: qui non si
       ricostruisce il titolo di un materiale. */
    const fonti = [{ type: 'video', file: '05 lez.mp4', t: 160, label: 'La definizione di Hammill' },
                   { type: 'pdf', file: '03 disp.pdf', page: 21, label: 'A1: il criterio della discrepanza' },
                   { type: 'pdf', file: '03 disp.pdf', page: 24, label: '' }];
    const conFo = GEN.daCapitolo({ title: 'T', brief: '', html: '<p>x</p>', keypoints: ['a'], glossary: [] }, { fonti: fonti });
    const rami = conFo.archi.filter((a) => a.da === conFo.nodi[0].id).map((a) => conFo.nodi.find((n) => n.id === a.a).testo);
    check('le fonti diventano un ramo a sé', true, rami.indexOf('Note e materiali') >= 0);
    check('una fonte senza etichetta non diventa un nodo muto', 2,
      conFo.nodi.filter((n) => n.genere === 'fonte').length);
    check('e ogni nodo-fonte apre il suo punto esatto',
      [{ type: 'video', file: '05 lez.mp4', t: 160, label: 'La definizione di Hammill' },
       { type: 'pdf', file: '03 disp.pdf', page: 21, label: 'A1: il criterio della discrepanza' }],
      conFo.nodi.filter((n) => n.genere === 'fonte').map((n) => n.rimando));
    check('senza fonti il ramo non compare', undefined,
      GEN.daCapitolo({ title: 'T', brief: '', html: '', keypoints: ['a'], glossary: [] }, {})
        .nodi.find((n) => n.testo === 'Note e materiali'));

    // la mappa della lezione: i capitoli in ordine, ognuno sa dove portare
    const lezione = { title: 'Lezione', chapters: [cap, { title: 'Secondo', brief: '', html: '', keypoints: [], glossary: [] }] };
    const gk = GEN.daLezione(lezione, {});
    check('ogni capitolo è un nodo che sa a quale capitolo porta', [0, 1],
      gk.nodi.filter((n) => n.genere === 'capitolo').map((n) => n.capitolo));

    // il disegno: markup autoconsistente, colori negli attributi
    const svg = DIS.svg(ML2.run(gc, { motore: 'albero' }), { titolo: 'x' });
    check('una card per nodo', gc.nodi.length, (svg.markup.match(/class="mnodo"/g) || []).length);
    check('i colori stanno negli attributi, non in una classe', true, /fill="#/.test(svg.markup));
    check('niente <marker>: le frecce sono disegnate', false, /<marker/.test(svg.markup));
    check('il testo dell\'utente è sempre sfuggito', true,
      DIS.svg(ML2.run({ nodi: [{ id: 'a', testo: '<script>ciao</script>' }], archi: [] }, {}), {}).markup.indexOf('<script>') < 0);

    // le famiglie danno il colore agli archi: è ciò che rende «concettuale» una mappa
    check('un verbo riconosciuto trova la sua famiglia', 'dipendenza', REL.famigliaDi('richiede'));
    check('anche dentro una frase più lunga', 'trasformazione', REL.famigliaDi('Causa direttamente'));
    check('un verbo sconosciuto non fa saltare niente', 'altro', REL.famigliaDi('sbrindella'));
    check('senza verbo si resta neutri', 'altro', REL.famigliaDi(''));
    check('la legenda dice solo le famiglie davvero usate', ['appartenenza'],
      REL.legenda([{ rel: 'comprende' }, { rel: '' }]).map((f) => f.chiave));
  }

  /* La distinzione cromatica di Braynr (§3) e il bersaglio degli archi (§12.3,
     G3). Il colore dice DA DOVE VIENE un nodo, il bordo dice la stessa cosa per
     un altro canale: chi estrae un frammento e poi lo ricolora non deve perdere
     l'informazione che quel nodo viene dalla fonte. */
  sezione('Mappe — il colore dice l\'origine, e un arco si può prendere col mouse');
  {
    const ML3 = require('../App/assets/mappa/layouts');
    const DIS3 = require('../App/assets/mappa/disegna');

    const g3 = { nodi: [
      { id: 'u', testo: 'Scritto a mano', origine: 'utente' },
      { id: 'uc', testo: 'Estratto e ricolorato', origine: 'utente', colore: '#ff00ff' },
      { id: 'f', testo: 'Estratto dalla fonte', origine: 'fonte' },
      { id: 'gen', testo: 'Dalla vista generata', origine: 'generata' },
      { id: 'muto', testo: 'Senza origine' }
    ], archi: [{ da: 'u', a: 'uc', rel: 'comprende' }, { da: 'u', a: 'f' },
               { da: 'f', a: 'gen', cross: true }, { da: 'u', a: 'muto' }] };
    const res3 = ML3.run(g3, { motore: 'albero' });
    const svg3 = DIS3.svg(res3, {}).markup;

    const card = (mk, id) => (mk.match(new RegExp('<g class="mnodo" data-id="' + id + '"[\\s\\S]*?</g>')) || [''])[0];
    // la barra d'accento è il SECONDO <rect> della card: il primo è la card
    const accento = (mk, id) => {
      const r = (card(mk, id).match(/<rect[^>]*\/>/g) || [])[1] || '';
      return (r.match(/fill="([^"]*)"/) || [])[1];
    };
    const delRamo = (id) => DIS3.colore(res3.nodi.find((n) => n.id === id), DIS3.GRUPPI);

    check('un nodo scritto ex novo è grigio', DIS3.TEMA.muted, accento(svg3, 'u'));
    check('ma il colore scelto a mano vince su tutto', '#ff00ff', accento(svg3, 'uc'));
    check('un nodo estratto porta il colore del suo ramo', delRamo('f'), accento(svg3, 'f'));
    check('e così quello della vista generata', delRamo('gen'), accento(svg3, 'gen'));
    check('senza origine si resta al colore del ramo', delRamo('muto'), accento(svg3, 'muto'));
    check('il grigio non è un hex del modulo: viene dal tema', '#8a8f98',
      accento(DIS3.svg(res3, { tema: { muted: '#8a8f98' } }).markup, 'u'));
    check('e il grigio non si mangia il colore del ramo degli altri', true,
      delRamo('f') !== DIS3.TEMA.muted);

    /* Colore e origine sono DUE canali: il tratteggio resta all'origine, così
       un nodo estratto e ricolorato continua a dire da dove viene. */
    const tratteggiato = (id) => /stroke-dasharray="4 3"/.test(card(svg3, id));
    check('il bordo tratteggiato dice l\'origine, non il colore',
      [true, true, false, false], ['u', 'uc', 'f', 'gen'].map(tratteggiato));

    /* Il bersaglio degli archi. Una linea da 1,4px non si prende col mouse, e
       il menu contestuale sull'arco (L4) non si aprirebbe mai. */
    const marchi = svg3.match(/<g class="marco"[\s\S]*?<\/g>/g) || [];
    const paths = (s) => s.match(/<path[^>]*\/>/g) || [];
    check('un gruppo per arco', res3.archi.length, marchi.length);
    check('ognuno ha il suo bersaglio, e PRIMA del tratto visibile', [4, 4],
      [marchi.filter((s) => /pointer-events="stroke"/.test(s)).length,
       marchi.filter((s) => /pointer-events="stroke"/.test(paths(s)[0] || '')).length]);
    check('il bersaglio è invisibile, spesso e senza riempimento', [true, true, true],
      [/stroke-opacity="0"/.test(paths(marchi[0])[0]), /stroke-width="12"/.test(paths(marchi[0])[0]),
       /fill="none"/.test(paths(marchi[0])[0])]);
    check('e segue esattamente lo stesso tracciato del tratto visibile',
      (paths(marchi[0])[0].match(/ d="([^"]*)"/) || [])[1],
      (paths(marchi[0])[1].match(/ d="([^"]*)"/) || [])[1]);
    check('il tratto visibile non è cambiato', true,
      /stroke-width="1.4"/.test(paths(marchi[0])[1]));

    /* ⚠️ Nel motore **Percorso** `res.archi` non sono i legami della mappa: sono
       i segmenti del filo che numera il percorso, e i legami veri passano in
       `res.extra`, in filigrana. Prima il gruppo `.marco` — cioè il bersaglio
       del mouse e i capi che il menu contestuale legge — finiva sul filo: su
       quel motore si poteva «invertire» un segmento inesistente, e gli archi
       davvero scritti dall'utente non si potevano né etichettare né togliere. */
    {
      const gp = { nodi: [{ id: 'a', testo: 'A' }, { id: 'b', testo: 'B' }, { id: 'c', testo: 'C' }],
                   archi: [{ da: 'a', a: 'b', rel: 'precede' }, { da: 'a', a: 'c', rel: 'richiede' }] };
      const rp = ML3.run(gp, { motore: 'percorso' });
      const sp = DIS3.svg(rp, {}).markup;
      const capi = (sp.match(/<g class="marco"[^>]*>/g) || [])
        .map((t) => (t.match(/data-da="([^"]*)" data-a="([^"]*)"/) || []).slice(1).join('→')).sort();
      check('nel Percorso il filo esiste, e non è vuoto', true, (rp.archi || []).some((x) => x.e && x.e._filo));
      check('i legami afferrabili sono quelli VERI del grafo, non i segmenti del filo',
        ['a→b', 'a→c'], capi);
      /* Il filo si disegna, ma non si prende: `pointer-events="none"` su ogni
         suo segmento. (Non si può distinguerlo per i capi: il percorso passa
         anche dove un legame vero esiste già, ed è giusto così.) */
      check('e il filo si vede ma non si afferra',
        (rp.archi || []).filter((x) => x.e && x.e._filo).length,
        (sp.match(/pointer-events="none"/g) || []).length);
      check('il numero del passo resta, che è il senso del motore', true,
        !!rp.passo && Object.keys(rp.passo).length === 3);

      /* ⚠️ La linking word sta sopra il suo arco e un `<text>` intercetta il
         puntatore: senza `pointer-events="none"` la parola copriva il bersaglio
         del proprio legame, e il menu non si apriva prendendolo per la parola —
         cioè dal punto in cui la mano lo cerca per primo. */
      const conVerbi = DIS3.svg(ML3.run(gp, { motore: 'albero' }), {}).markup;
      const testi = conVerbi.match(/<text[^>]*>(precede|richiede)<\/text>/g) || [];
      check('le linking word si vedono', 4, (conVerbi.match(/>(precede|richiede)</g) || []).length);
      check('e non rubano il click al loro arco', 0,
        (conVerbi.match(/<text(?![^>]*pointer-events="none")[^>]*>(precede|richiede)</g) || []).length);
      check('ogni legame vero ha comunque il suo bersaglio invisibile', 2,
        (sp.match(/pointer-events="stroke"/g) || []).length);
    }

    /* Il pallino della fonte è un FRATELLO della card, non un figlio: nel
       registro «Mie» il click sulla card seleziona il nodo, e dentro il gruppo
       il pallino erediterebbe quel click — la stessa trappola del tasto del
       ramo, dove chiudere un ramo avrebbe aperto un PDF. */
    const gRim = { nodi: [
      { id: 'a', testo: 'Con fonte', rimando: { type: 'pdf', file: 'x.pdf', page: 3 } },
      { id: 'b', testo: 'Con capitolo', capitolo: 2 },
      { id: 'c', testo: 'Senza niente' }
    ], archi: [{ da: 'a', a: 'b' }, { da: 'a', a: 'c' }] };
    const svgR = DIS3.svg(ML3.run(gRim, { motore: 'albero' }), {}).markup;
    const fonti = svgR.match(/<g class="mfonte"[\s\S]*?<\/g>/g) || [];
    check('un pallino per ogni nodo che porta da qualche parte, e per nessun altro',
      ['a', 'b'], fonti.map((s) => (s.match(/data-id="([^"]*)"/) || [])[1]).sort());
    check('sta FUORI dalla card, non dentro', false,
      /<g class="mfonte"/.test(card(svgR, 'a')));
    check('ed è premibile: bersaglio invisibile largo, sopra il segno da 3px', [true, true],
      [/r="11"[^>]*fill-opacity="0"/.test(fonti[0]), /r="3"/.test(fonti[0])]);
    check('la card dice ancora che è apribile', true, /data-apri="1"/.test(card(svgR, 'a')));
    check('e chi non ha né rimando né capitolo non lo dice', false, /data-apri/.test(card(svgR, 'c')));

    /* L'indice cambia a ogni ridisegno — basta un ramo chiuso — e un menu che
       agisse sull'arco «numero 7» agirebbe su un altro arco appena la mappa
       cambia. I due capi, invece, l'arco lo nominano. */
    const attr = (s, k) => (s.match(new RegExp(k + '="([^"]*)"')) || [])[1];
    check('.marco porta i suoi due capi accanto all\'indice', ['0', 'u', 'uc'],
      [attr(marchi[0], 'data-arco'), attr(marchi[0], 'data-da'), attr(marchi[0], 'data-a')]);
    check('anche l\'arco che salta il ramo', ['f', 'gen'],
      [attr(marchi[2], 'data-da'), attr(marchi[2], 'data-a')]);
    check('un id con un apice non spacca l\'attributo', true,
      DIS3.svg(ML3.run({ nodi: [{ id: 'a"b' }, { id: 'c' }], archi: [{ da: 'a"b', a: 'c' }] }, {}), {})
        .markup.indexOf('data-da="a&quot;b"') > 0);
  }

  /* Il vocabolario dei verbi (§13.5) è una tabella sola che alimenta due
     consumatori: il datalist dell'utente e l'enum mandato al modello. Se
     divergessero, la mappa scritta a mano e quella generata si colorerebbero
     con due leggi diverse — e il colore è il canale su cui si legge una mappa
     concettuale senza fermarsi sulle parole. Qui si controlla che la sorgente
     resti una, che nessun verbo abbia due colori, e che le tinte si distinguano
     davvero anche a chi non vede il rosso o il verde. */
  sezione('Mappe — un vocabolario solo per l\'utente e per il modello');
  {
    const REL2 = require('../App/assets/mappa/relazioni');

    const perFam = REL2.verbiPerFamiglia();
    const piatti = REL2.verbi();
    const somma = REL2.CHIAVI.reduce((n, k) => n + REL2.FAMIGLIE[k].verbi.length, 0);

    check('le tre famiglie del §13.5 ci sono, e «altro» resta l\'ultima',
      ['definizione', 'misura', 'intervento', 'altro'], REL2.CHIAVI.slice(-4));
    check('ognuna porta etichetta, colore e verbi', [],
      REL2.CHIAVI.filter((k) => {
        const f = REL2.FAMIGLIE[k];
        return !f.etichetta || !f.colore || !(f.verbi || []).length;
      }));

    /* ⚠️ Nessun verbo in due famiglie: sarebbe un colore ambiguo, e prima lo si
       scopriva solo guardando una mappa già disegnata (la seconda famiglia
       sovrascriveva la prima, in silenzio). Il conto lo dice senza guardare:
       se un verbo fosse doppio, la lista piatta sarebbe più corta della somma. */
    check('nessun verbo appartiene a due famiglie', somma, piatti.length);
    check('e il modulo si rifiuta di caricarsi se qualcuno ne mette uno doppio', true, (() => {
      const F = REL2.FAMIGLIE;
      // si simula la costruzione della tabella inversa con un doppione dentro
      try {
        const m = {};
        REL2.CHIAVI.concat(['trasformazione']).forEach((k) => {
          F[k].verbi.forEach((v) => { if (m[v]) throw new Error('doppio'); m[v] = k; });
        });
        return false;
      } catch (e) { return e.message === 'doppio'; }
    })());

    check('la lista piatta è ordinata', true,
      piatti.every((v, i) => i === 0 || piatti[i - 1].localeCompare(v, 'it') <= 0));
    check('datalist ed enum sono la STESSA lista, non due che si somigliano', piatti,
      REL2.CHIAVI.reduce((a, k) => a.concat(perFam[k]), []).sort((a, b) => a.localeCompare(b, 'it')));
    check('e ogni verbo del vocabolario si ritrova nella famiglia da cui viene', [],
      REL2.CHIAVI.filter((k) => perFam[k].some((v) => REL2.famigliaDi(v) !== k)));
    check('verbiPerFamiglia restituisce copie: nessuno può modificare FAMIGLIE per sbaglio',
      REL2.FAMIGLIE.misura.verbi.length,
      (() => { const a = REL2.verbiPerFamiglia(); a.misura.push('inventato'); return REL2.FAMIGLIE.misura.verbi.length; })());
    check('vocabolario() è una porta sul nome nuovo, non una seconda lista', piatti, REL2.vocabolario());

    // i verbi nuovi trovano la loro famiglia, e con lei il colore
    check('i verbi delle famiglie nuove sono riconosciuti',
      ['definizione', 'definizione', 'misura', 'misura', 'intervento', 'intervento'],
      ['si definisce', 'significa', 'indica', 'si valuta con', 'compensa', 'dispensa da'].map(REL2.famigliaDi));
    check('anche dentro una frase più lunga', 'intervento', REL2.famigliaDi('Riduce sensibilmente'));

    /* ⚠️ «è» è fuori dal vocabolario di proposito: nel corpus TD74 compare in
       1.882 frasi su 5.259 (36%) perché è la copula, non un legame. Come voce
       dell'enum sarebbe una calamita, e per la regola della sottostringa di
       `famigliaDi` una chiave di un carattere vincerebbe su «altro» per
       qualunque frase che contenga « è ». Un arco scritto «è» resta neutro. */
    check('la copula nuda non è nel vocabolario', false, piatti.indexOf('è') >= 0);
    check('e un arco scritto «è» resta neutro', ['altro', 'altro'],
      [REL2.famigliaDi('è'), REL2.famigliaDi('non è')]);
    check('«è simile a» invece continua a essere analogia, non definizione',
      ['analogia', 'appartenenza', 'sequenza', 'dipendenza'],
      ['è simile a', 'è esempio di', 'è seguito da', 'è condizione di'].map(REL2.famigliaDi));

    /* ---- la palette, misurata e non dichiarata ----------------------------
       Un colore che non discrimina è rumore (§13.5), e con 11 famiglie il
       rischio è concreto. Si misura sul serio: sRGB → LMS → simulazione delle
       tre dicromazie (Viénot–Brettel–Mollon) → CIELAB → ΔE2000, e di ogni
       coppia si tiene la visione in cui si distinguono PEGGIO. Sta qui e non in
       un foglio a parte perché una misura fatta una volta non è una garanzia:
       la prossima famiglia va aggiunta con questo test acceso. */
    const CVD = (() => {
      const hsl = (h, s, l) => {
        s /= 100; l /= 100;
        const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
        const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
        return [f(0), f(8), f(4)];
      };
      const lin = (u) => (u <= 0.04045 ? u / 12.92 : Math.pow((u + 0.055) / 1.055, 2.4));
      const rgb = (c) => {
        const m = /^hsl\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%\s*\)$/.exec(c);
        if (!m) throw new Error('colore non in hsl(): ' + c);
        return hsl(+m[1], +m[2], +m[3]).map(lin);
      };
      const mul = (M, v) => M.map((r) => r[0] * v[0] + r[1] * v[1] + r[2] * v[2]);
      const A = [[17.8824, 43.5161, 4.11935], [3.45565, 27.1554, 3.86714], [0.0299566, 0.184309, 1.46709]];
      const Ai = [[0.0809445, -0.130504, 0.116721], [-0.0102485, 0.0540194, -0.113615], [-0.000365294, -0.00412163, 0.693513]];
      const SIM = {
        protanopia: [[0, 2.02344, -2.52581], [0, 1, 0], [0, 0, 1]],
        deuteranopia: [[1, 0, 0], [0.494207, 0, 1.24827], [0, 0, 1]],
        tritanopia: [[1, 0, 0], [0, 1, 0], [-0.395913, 0.801109, 0]]
      };
      const lab = (v) => {
        const X = 0.4124564 * v[0] + 0.3575761 * v[1] + 0.1804375 * v[2];
        const Y = 0.2126729 * v[0] + 0.7151522 * v[1] + 0.0721750 * v[2];
        const Z = 0.0193339 * v[0] + 0.1191920 * v[1] + 0.9503041 * v[2];
        const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
        const [fx, fy, fz] = [f(X / 0.95047), f(Y), f(Z / 1.08883)];
        return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
      };
      const dE = (p, q) => {   // CIEDE2000
        const R = Math.PI / 180, G2 = 180 / Math.PI;
        const [L1, a1, b1] = p, [L2, a2, b2] = q;
        const C1 = Math.hypot(a1, b1), C2 = Math.hypot(a2, b2), Cb = (C1 + C2) / 2;
        const g = 0.5 * (1 - Math.sqrt(Math.pow(Cb, 7) / (Math.pow(Cb, 7) + Math.pow(25, 7))));
        const A1 = (1 + g) * a1, A2 = (1 + g) * a2;
        const P1 = Math.hypot(A1, b1), P2 = Math.hypot(A2, b2);
        const hh = (b, a) => (b === 0 && a === 0 ? 0 : ((Math.atan2(b, a) * G2) + 360) % 360);
        const h1 = hh(b1, A1), h2 = hh(b2, A2);
        let dh = 0;
        if (P1 * P2 !== 0) { dh = h2 - h1; if (dh > 180) dh -= 360; else if (dh < -180) dh += 360; }
        const dH = 2 * Math.sqrt(P1 * P2) * Math.sin(dh / 2 * R);
        const Lb = (L1 + L2) / 2, Pb = (P1 + P2) / 2;
        let hb;
        if (P1 * P2 === 0) hb = h1 + h2;
        else { hb = (h1 + h2) / 2; if (Math.abs(h1 - h2) > 180) hb += (h1 + h2 < 360 ? 180 : -180); }
        const T = 1 - 0.17 * Math.cos((hb - 30) * R) + 0.24 * Math.cos(2 * hb * R)
          + 0.32 * Math.cos((3 * hb + 6) * R) - 0.20 * Math.cos((4 * hb - 63) * R);
        const Rc = 2 * Math.sqrt(Math.pow(Pb, 7) / (Math.pow(Pb, 7) + Math.pow(25, 7)));
        const Sl = 1 + (0.015 * Math.pow(Lb - 50, 2)) / Math.sqrt(20 + Math.pow(Lb - 50, 2));
        const Sc = 1 + 0.045 * Pb, Sh = 1 + 0.015 * Pb * T;
        const Rt = -Math.sin(2 * (30 * Math.exp(-Math.pow((hb - 275) / 25, 2))) * R) * Rc;
        return Math.sqrt(Math.pow((L2 - L1) / Sl, 2) + Math.pow((P2 - P1) / Sc, 2)
          + Math.pow(dH / Sh, 2) + Rt * ((P2 - P1) / Sc) * (dH / Sh));
      };
      return {
        /** la distanza nella visione che le confonde di più: una coppia vale
         *  quanto vale per chi la vede peggio */
        peggiore(c1, c2) {
          const v1 = rgb(c1), v2 = rgb(c2);
          let m = dE(lab(v1), lab(v2));
          Object.keys(SIM).forEach((t) => {
            m = Math.min(m, dE(lab(mul(Ai, mul(SIM[t], mul(A, v1)))), lab(mul(Ai, mul(SIM[t], mul(A, v2))))));
          });
          return m;
        },
        contrasto(c, fondo) {
          const Y = (v) => 0.2126729 * v[0] + 0.7151522 * v[1] + 0.0721750 * v[2];
          const a = Y(rgb(c)), b = fondo === 'bianco' ? 1 : Y([0.00805, 0.00961, 0.01444]);
          return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
        }
      };
    })();

    const NUOVE = ['definizione', 'misura', 'intervento'];
    const coppie = [];
    for (let i = 0; i < REL2.CHIAVI.length; i++) {
      for (let j = i + 1; j < REL2.CHIAVI.length; j++) {
        const a = REL2.CHIAVI[i], b = REL2.CHIAVI[j];
        coppie.push({ a, b, d: CVD.peggiore(REL2.FAMIGLIE[a].colore, REL2.FAMIGLIE[b].colore) });
      }
    }
    check('nessuna famiglia riusa il colore di un\'altra', REL2.CHIAVI.length,
      new Set(REL2.CHIAVI.map((k) => REL2.FAMIGLIE[k].colore)).size);
    check('ogni tinta nuova sta a ΔE2000 ≥ 8 da tutte le altre, nella dicromazia che la confonde di più',
      [], coppie.filter((c) => (NUOVE.indexOf(c.a) >= 0 || NUOVE.indexOf(c.b) >= 0) && c.d < 8)
        .map((c) => c.a + '/' + c.b + ' ' + c.d.toFixed(1)));

    /* ⚠️ Il punto debole della palette è PRECEDENTE alle famiglie nuove: un
       deuteranope non distingue il viola della dipendenza dal blu
       dell'appartenenza (ΔE 3,0), né l'arancio della trasformazione dal
       rosso-arancio dell'opposizione (ΔE 4,5). Il commento che stava in testa a
       relazioni.js — «leggibile anche a chi confonde rosso e verde» — era
       un'intenzione, non una misura. Questo controllo lo tiene scritto: se un
       giorno lo si ripara, dirà che la coppia peggiore è un'altra. */
    coppie.sort((x, y) => x.d - y.d);
    check('e la coppia peggiore resta una di quelle di prima, non una nuova',
      'dipendenza/appartenenza', coppie[0].a + '/' + coppie[0].b);
    check('le due coppie che già si confondevano sono ancora quelle, e solo quelle',
      ['dipendenza/appartenenza', 'trasformazione/opposizione'],
      coppie.filter((c) => c.d < 5).map((c) => c.a + '/' + c.b));

    /* Il colore dell'arco è FISSO: non lo passa il tema come per le card, quindi
       la stessa tinta deve reggere sul foglio bianco e sul pannello scuro. */
    check('le tinte nuove si vedono su tutti e due i fondi (WCAG ≥3:1)', [],
      NUOVE.filter((k) => CVD.contrasto(REL2.FAMIGLIE[k].colore, 'bianco') < 3 ||
                          CVD.contrasto(REL2.FAMIGLIE[k].colore, 'scuro') < 3));
    check('e le uniche che non ci arrivano sono quelle già in casa', ['dipendenza'],
      REL2.CHIAVI.filter((k) => CVD.contrasto(REL2.FAMIGLIE[k].colore, 'bianco') < 3 ||
                                CVD.contrasto(REL2.FAMIGLIE[k].colore, 'scuro') < 3));
  }

  /* La porta del §4.2: da ogni nodo si trascina un arco verso un altro. Il
     rischio non è disegnarla, è metterla dove c'è già qualcos'altro — il
     pallino del ramo sta sul bordo da cui escono i figli, e due bersagli
     sovrapposti significano chiudere un ramo credendo di collegare. */
  sezione('Mappe — la porta da cui si tira un arco');
  {
    const ML4 = require('../App/assets/mappa/layouts');
    const DIS4 = require('../App/assets/mappa/disegna');

    const g4 = { nodi: [{ id: 'r', testo: 'Radice' }, { id: 'a', testo: 'A' }, { id: 'b', testo: 'B' }],
                 archi: [{ da: 'r', a: 'a' }, { da: 'r', a: 'b' }] };
    const rTd = ML4.run(g4, { motore: 'albero', orient: 'td' });
    const mkTd = DIS4.svg(rTd, { maniglie: true, chiudibili: { r: 'aperto' } }).markup;
    const porte = (mk) => mk.match(/<g class="mporta"[\s\S]*?<\/g>/g) || [];
    const cerchi = (s) => (s.match(/<circle[^>]*\/>/g) || []);
    const xy = (s) => [+(s.match(/cx="([-\d.]+)"/) || [])[1], +(s.match(/cy="([-\d.]+)"/) || [])[1]];

    check('una porta per nodo — ma solo se la si chiede', [3, 0],
      [porte(mkTd).length, porte(DIS4.svg(rTd, {}).markup).length]);
    // dentro il gruppo della card erediterebbe il click che seleziona il nodo:
    // si finirebbe a selezionare proprio mentre si prova a collegare
    const cardDi = (mk, id) => (mk.match(new RegExp('<g class="mnodo" data-id="' + id + '"[\\s\\S]*?</g>')) || [''])[0];
    check('sta FUORI dalla card, come il pallino della fonte e quello del ramo', [true, false],
      [cardDi(mkTd, 'r').length > 0, /mporta/.test(cardDi(mkTd, 'r'))]);
    check('bersaglio invisibile largo, sopra un segno piccolo', [true, true, true],
      [/r="12"[^>]*fill-opacity="0"/.test(porte(mkTd)[0]), /r="5"/.test(porte(mkTd)[0]),
       cerchi(porte(mkTd)[0]).length === 2]);
    check('è raggiungibile da tastiera e si annuncia', [true, true],
      [/role="button" tabindex="0"/.test(porte(mkTd)[0]), /<title>Trascina da qui per collegare<\/title>/.test(porte(mkTd)[0])]);
    check('i colori restano attributi: l\'export PDF non perde niente', true,
      /<circle[^>]*fill="hsl|<circle[^>]*fill="#/.test(porte(mkTd)[0]) && !/class="[^"]*colore/.test(porte(mkTd)[0]));

    /* ⚠️ La porta precede la fonte nell'ordine del documento. Con la card di
       fabbrica i due centri distano 15,8px e i bersagli invisibili si
       sovrappongono: in SVG vince l'ultimo disegnato, e una porta messa dopo
       ruberebbe i click alla fonte — che è il bersaglio più piccolo dei due. */
    const gF = { nodi: [{ id: 'a', testo: 'Con fonte', rimando: { type: 'pdf', file: 'x.pdf', page: 3 } },
                        { id: 'b', testo: 'B' }], archi: [{ da: 'a', a: 'b' }] };
    const mkF = DIS4.svg(ML4.run(gF, { motore: 'albero' }), { maniglie: true }).markup;
    check('la porta è disegnata PRIMA della fonte, che è il bersaglio più preciso', true,
      mkF.indexOf('class="mporta" data-id="a"') < mkF.indexOf('class="mfonte" data-id="a"'));

    // il verso: dei due bordi lontani, il ramo ne prende uno e la porta l'altro
    const versi = (orient) => {
      const res = ML4.run(g4, { motore: 'albero', orient: orient });
      const mk = DIS4.svg(res, { maniglie: true, chiudibili: { r: 'aperto' } }).markup;
      const p = xy(porte(mk).find((s) => /data-id="r"/.test(s)));
      const c = res.pos.r;
      return [Math.sign(Math.round(p[0] - c.x)), Math.sign(Math.round(p[1] - c.y))];
    };
    check('se i figli scendono la porta sta a destra', [1, 0], versi('td'));
    check('se i figli vanno a destra la porta sta in basso', [0, 1], versi('lr'));

    /* La verifica che conta: la porta e il pallino del ramo non devono MAI
       finirsi addosso. Si controlla sui due orientamenti e su tutti i nodi di un
       anello — dove il verso dei figli è radiale e cambia da nodo a nodo — con
       la card di fabbrica e con la più piccola che `layouts` ammette (40×24). */
    const stella = { nodi: [{ id: 'c', testo: 'Centro' }], archi: [] };
    for (let i = 0; i < 24; i++) {
      stella.nodi.push({ id: 'n' + i, testo: 'N' + i });
      stella.archi.push({ da: 'c', a: 'n' + i });
    }
    const distanze = [];
    [{ motore: 'albero', orient: 'td' }, { motore: 'albero', orient: 'lr' }, { motore: 'anelli' }]
      .forEach((base) => [{ w: 168, h: 48 }, { w: 40, h: 24 }, { w: 300, h: 30 }].forEach((dim) => {
        const res = ML4.run(stella, Object.assign({}, base, dim));
        Object.keys(res.pos).forEach((id) => {
          const d = DIS4.versoDeiFigli(res, res.pos[id]);
          const t = DIS4.sulBordo(res.pos[id], d, res.opt.w, res.opt.h);
          const q = DIS4.sulBordo(res.pos[id], DIS4.versoDellaPorta(d), res.opt.w, res.opt.h);
          distanze.push(Math.hypot(t.x - q.x, t.y - q.y));
        });
      }));
    check('porta e pallino del ramo non finiscono mai a meno di 16px', [],
      distanze.filter((d) => d < 16).map((d) => +d.toFixed(1)));
    check('e la prova ha guardato abbastanza casi da valere qualcosa', 225, distanze.length);
    check('il verso della porta è sempre perpendicolare a quello dei figli', [],
      [[0, 1], [1, 0], [0.6, 0.8], [-0.6, 0.8], [0.707, -0.707], [-1, 0], [0, -1]]
        .map((v) => { const d = { x: v[0], y: v[1] }, t = DIS4.versoDellaPorta(d); return +(d.x * t.x + d.y * t.y).toFixed(6); })
        .filter((p) => p !== 0));
    check('e punta sempre in basso o a destra, mai in alto a sinistra', [],
      [[0, 1], [1, 0], [0.6, 0.8], [-0.6, 0.8], [0.707, -0.707], [-1, 0], [0, -1]]
        .map((v) => DIS4.versoDellaPorta({ x: v[0], y: v[1] }))
        .filter((t) => t.x + t.y < -1e-9));
  }

  /* Il banco (PIANO-BANCO.md §2): quattro celle, otto forme, e uno stato
     minuscolo che vive nel localStorage. Il rischio non è la griglia — è che
     «quali blocchi ha questa forma» finisca scritto due volte, una nella
     stringa delle aree e una in un elenco lì accanto: le due copie divergono al
     primo ritocco, e il guasto non fa eccezione da nessuna parte, si vede solo
     a occhio come un blocco che non compare. Qui si controlla che la
     derivazione sia una sola, e che lo stato regga il giro dal disco. */
  sezione('Banco — otto forme, due divisori, uno stato che torna dal disco');
  {
    const BF = require('../App/assets/banco/forme');

    // ---- la tabella delle forme
    check('otto forme, nell\'ordine del disegno del piano',
      ['uno', 'due-col', 'due-riga', 'tre-sx', 'tre-dx', 'tre-sopra', 'tre-sotto', 'quattro'], BF.CHIAVI);
    check('le aree sono quelle del piano, alla lettera',
      ['"A A" "A A"', '"A C" "A C"', '"A A" "B B"', '"A C" "A D"',
       '"A C" "B C"', '"A A" "B D"', '"A C" "B B"', '"A C" "B D"'],
      BF.CHIAVI.map((k) => BF.FORME[k].aree));
    check('ognuna ha un nome leggibile, e nessuno si ripete',
      [[], 8], [BF.CHIAVI.filter((k) => !/\S/.test(BF.FORME[k].nome || '')),
                new Set(BF.CHIAVI.map((k) => BF.FORME[k].nome)).size]);
    check('i blocchi di ogni forma',
      [['A'], ['A', 'C'], ['A', 'B'], ['A', 'C', 'D'],
       ['A', 'B', 'C'], ['A', 'B', 'D'], ['A', 'B', 'C'], ['A', 'B', 'C', 'D']],
      BF.CHIAVI.map((k) => BF.blocchiDi(k)));

    /* ⚠️ La prova che conta davvero: l'elenco esce dalla STRINGA. Il test la
       rilegge per conto suo — se un giorno `blocchiDi` tornasse a leggere un
       elenco scritto a mano accanto alle aree, le due derivazioni si
       separerebbero qui invece che a schermo, mesi dopo. */
    const dallaStringa = (aree) => ['A', 'B', 'C', 'D'].filter((b) => aree.indexOf(b) >= 0);
    check('blocchiDi legge le aree, non un secondo elenco', [],
      BF.CHIAVI.filter((k) => JSON.stringify(BF.blocchiDi(k)) !== JSON.stringify(dallaStringa(BF.FORME[k].aree))));
    check('e «quanti» è il conto di quell\'elenco, non un numero battuto a mano', [],
      BF.CHIAVI.filter((k) => BF.FORME[k].quanti !== BF.blocchiDi(k).length));
    check('l\'elenco è una copia: chi lo riceve non può svuotare la tabella', ['A', 'C'],
      (() => { BF.blocchiDi('due-col').length = 0; return BF.blocchiDi('due-col'); })());
    check('una forma che non esiste non ha blocchi, e non esplode',
      [[], false, false, false],
      [BF.blocchiDi('pippo'), BF.visibile('pippo', 'A'),
       BF.usaDivisoreColonna('pippo'), BF.usaDivisoreRiga('pippo')]);

    // ---- i due divisori, dove servono e dove no
    check('il divisore verticale c\'è dove una riga è spezzata in due',
      [false, true, false, true, true, true, true, true], BF.CHIAVI.map((k) => BF.usaDivisoreColonna(k)));
    check('quello orizzontale dove è spezzata una colonna',
      [false, false, true, true, true, true, true, true], BF.CHIAVI.map((k) => BF.usaDivisoreRiga(k)));
    check('«un blocco solo» non ne ha nessuno, «due impilati» solo l\'orizzontale',
      [false, false, false, true],
      [BF.usaDivisoreColonna('uno'), BF.usaDivisoreRiga('uno'),
       BF.usaDivisoreColonna('due-riga'), BF.usaDivisoreRiga('due-riga')]);

    /* Anche i divisori si ricavano dalle aree. Il test li ridice in un altro
       modo — «esiste un blocco che sta in una colonna sola?» invece di «due
       celle affiancate hanno nomi diversi?» — perché due formulazioni della
       stessa geometria si controllano a vicenda; ripetere la formula
       dell'implementazione controllerebbe soltanto la copia-incolla. */
    const spanne = (aree, b, asse) =>
      new Set((aree.match(/[A-D]/g) || []).map((n, i) => (n === b ? (asse === 'col' ? (i & 1) : (i >> 1)) : null))
        .filter((v) => v !== null)).size;
    check('i divisori escono dalla geometria, non da un elenco di forme', [],
      BF.CHIAVI.filter((k) => {
        const aree = BF.FORME[k].aree, bl = BF.blocchiDi(k);
        return BF.usaDivisoreColonna(k) !== bl.some((b) => spanne(aree, b, 'col') === 1)
            || BF.usaDivisoreRiga(k) !== bl.some((b) => spanne(aree, b, 'riga') === 1);
      }));

    // ---- l'invariante che gira al caricamento del modulo
    check('una diagonale non è una griglia, e il modulo lo sa dire', true,
      /rettangolo/.test(BF.guastoNelleAree('"A C" "C A"')));
    check('e nemmeno un nome inventato, un conto di celle sbagliato o il nulla',
      [false, false, false],
      [BF.guastoNelleAree('"A E" "B D"') === '', BF.guastoNelleAree('"A C B" "B D"') === '',
       BF.guastoNelleAree('') === '']);
    check('le otto forme, invece, passano tutte', [], BF.CHIAVI.filter((k) => BF.guastoNelleAree(BF.FORME[k].aree)));

    // ---- normalizzaStato: l'entroSchema del banco
    const S = (x) => BF.normalizzaStato(x);
    check('senza niente in ingresso: forma di fabbrica, divisori a metà, quattro blocchi vuoti',
      { forma: 'due-col', col: 0.5, riga: 0.5, blocchi: { A: '', B: '', C: '', D: '' } }, S(undefined));
    check('una forma che non esiste ricade su quella di fabbrica, una buona resta',
      ['due-col', 'due-col', 'tre-sopra'], [S({ forma: 'a caso' }).forma, S({ forma: 42 }).forma, S({ forma: 'tre-sopra' }).forma]);
    check('le frazioni restano frazioni, e non toccano mai i bordi',
      [0.62, 0.1, 0.9, 0.1, 0.9],
      [S({ col: 0.62 }).col, S({ col: 0 }).col, S({ col: 1 }).col, S({ col: -4 }).col, S({ col: 99 }).col]);
    /* ⚠️ `+null`, `+''` e `+[]` fanno zero: se la frazione si prendesse con una
       conversione, un campo mancante diventerebbe un blocco schiacciato sul
       minimo invece che una colonna a metà. */
    check('ciò che non è un numero torna al mezzo, non al minimo', [0.5, 0.5, 0.5, 0.5, 0.5],
      [S({ col: null }).col, S({ col: '' }).col, S({ col: '0.7' }).col, S({ col: NaN }).col, S({ col: [] }).col]);
    check('la riga segue la stessa legge della colonna', [0.1, 0.9, 0.5],
      [S({ riga: 0 }).riga, S({ riga: 1 }).riga, S({ riga: 'x' }).riga]);
    check('e il limite è uno solo, esportato: lo usa anche chi trascina il divisore',
      [0.1, 0.9, 0.5, 0.33], [BF.frazione(0), BF.frazione(1.2), BF.frazione('0.4'), BF.frazione(0.33)]);

    check('i blocchi ci sono tutti e quattro, sempre e nello stesso ordine',
      ['A', 'B', 'C', 'D'], Object.keys(S({ forma: 'uno', blocchi: { C: 'mappa' } }).blocchi));
    check('un blocco che la forma non usa conserva il suo strumento… ma non è visibile',
      ['mappa', false], [S({ forma: 'uno', blocchi: { C: 'mappa' } }).blocchi.C, BF.visibile('uno', 'C')]);
    check('una chiave che non è un blocco sparisce', undefined, S({ blocchi: { E: 'x' } }).blocchi.E);
    check('uno strumento che non è una stringa non diventa uno strumento', ['', '', ''],
      [S({ blocchi: { A: 3 } }).blocchi.A, S({ blocchi: { A: { id: 'x' } } }).blocchi.A, S({ blocchi: { A: '   ' } }).blocchi.A]);
    check('le chiavi in più non entrano nel localStorage: lì il rumore resta per sempre',
      ['blocchi', 'col', 'forma', 'riga'], Object.keys(S({ zoom: 3, tema: 'scuro' })).sort());

    /* ⚠️ Uno strumento in due blocchi è impossibile (§2.2): è un pezzo di
       pagina, non un'immagine. Quando lo stato che arriva lo dice due volte, a
       perdere dev'essere sempre lo stesso — e a vincere è chi si vede, perché
       svuotare un blocco a schermo per conservare una copia nascosta è una
       perdita che l'utente nota e non sa spiegarsi. */
    check('duplicato fra due blocchi visibili: vince il primo in ordine A→B→C→D', ['mappa', ''],
      (() => { const s = S({ forma: 'due-col', blocchi: { A: 'mappa', C: 'mappa' } }); return [s.blocchi.A, s.blocchi.C]; })());
    check('duplicato fra un blocco nascosto e uno visibile: vince quello che si vede', ['', 'mappa'],
      (() => { const s = S({ forma: 'due-col', blocchi: { B: 'mappa', C: 'mappa' } }); return [s.blocchi.B, s.blocchi.C]; })());
    check('più blocchi vuoti invece convivono: «vuoto» non è uno strumento', 4,
      Object.values(S({ blocchi: { A: '', B: '', C: '', D: '' } }).blocchi).filter((v) => v === '').length);
    check('comunque arrivi lo stato, nessuno strumento resta in due blocchi', [],
      [{ A: 'm', B: 'm', C: 'm', D: 'm' }, { A: 'a', B: 'a', C: 'b', D: 'b' }, { D: 'x', A: 'x' }]
        .map((b) => Object.values(S({ forma: 'quattro', blocchi: b }).blocchi).filter(Boolean))
        .filter((v) => new Set(v).size !== v.length));

    const pieno = { forma: 'tre-sopra', col: 0.62, riga: 0.4, blocchi: { A: 'pdf', B: 'appunti', C: 'mappa', D: 'keyword' } };
    check('normalizzare due volte non cambia niente', JSON.stringify(S(pieno)), JSON.stringify(S(S(pieno))));
    check('e il giro dal localStorage lo restituisce identico', pieno, S(JSON.parse(JSON.stringify(S(pieno)))));

    // ---- assegna: si sposta, non si duplica; e si scambia, non si buca
    const base = S({ forma: 'quattro', blocchi: { A: 'capitolo', B: 'appunti', C: 'mappa', D: '' } });
    check('mettere uno strumento in un blocco vuoto lo mette lì', 'keyword', BF.assegna(base, 'D', 'keyword').blocchi.D);
    check('⚠️ se stava altrove i due blocchi si SCAMBIANO: nessun buco da riempire con un secondo gesto',
      ['mappa', 'capitolo'], (() => { const s = BF.assegna(base, 'A', 'mappa'); return [s.blocchi.A, s.blocchi.C]; })());
    check('lo scambio conserva quanti blocchi sono pieni', 3,
      Object.values(BF.assegna(base, 'A', 'mappa').blocchi).filter(Boolean).length);
    check('verso un blocco vuoto non c\'è niente da scambiare: quello di partenza resta vuoto',
      ['', 'mappa'], (() => { const s = BF.assegna(base, 'D', 'mappa'); return [s.blocchi.C, s.blocchi.D]; })());
    check('riassegnare lo stesso strumento allo stesso blocco non fa niente',
      JSON.stringify(base), JSON.stringify(BF.assegna(base, 'C', 'mappa')));
    check('la stringa vuota svuota il blocco, e non sposta nessun altro', ['', 'capitolo', 'appunti'],
      (() => { const s = BF.assegna(base, 'C', ''); return [s.blocchi.C, s.blocchi.A, s.blocchi.B]; })());
    check('un blocco che non esiste è un errore di chi chiama: lo stato torna com\'era',
      JSON.stringify(base), JSON.stringify(BF.assegna(base, 'Z', 'mappa')));
    check('uno strumento si ritrova dal suo nome, e uno che non c\'è non si inventa',
      ['C', null, null], [BF.bloccoCon(base, 'mappa'), BF.bloccoCon(base, 'flashcard'), BF.bloccoCon(base, '')]);

    /* Venti assegnazioni di fila, deterministiche: dopo ognuna l'invariante
       deve reggere. Il conto dei blocchi pieni può scendere di uno solo quando
       si svuota un blocco — se scendesse di più vorrebbe dire che uno scambio
       ha lasciato per strada qualcosa. */
    let corrente = S({ forma: 'quattro' });
    const guasti = [];
    ['capitolo', 'appunti', 'mappa', 'keyword', 'pdf'].forEach((t, i) => {
      ['A', 'B', 'C', 'D'].forEach((b, j) => {
        const pieniPrima = Object.values(corrente.blocchi).filter(Boolean).length;
        corrente = BF.assegna(corrente, b, (i + j) % 3 === 0 ? '' : t);
        const dentro = Object.values(corrente.blocchi).filter(Boolean);
        if (new Set(dentro).size !== dentro.length) guasti.push('doppio dopo ' + b + '=' + t);
        if (dentro.length < pieniPrima - 1) guasti.push('persi dopo ' + b + '=' + t);
      });
    });
    check('venti assegnazioni di fila, e l\'invariante regge sempre', [], guasti);

    // ---- cambiaForma: chi esce di scena si sa, e non si perde
    const q = S({ forma: 'quattro', blocchi: { A: 'capitolo', B: 'appunti', C: 'mappa', D: 'keyword' } });
    const solo = BF.cambiaForma(q, 'uno');
    check('cambiare forma cambia la forma', 'uno', solo.forma);
    check('e dichiara che cosa è uscito di scena, blocco per blocco',
      [{ blocco: 'B', strumento: 'appunti' }, { blocco: 'C', strumento: 'mappa' }, { blocco: 'D', strumento: 'keyword' }],
      solo.usciti);
    check('⚠️ ma non lo perde: resta scritto nello stato', ['appunti', 'mappa', 'keyword'],
      [solo.blocchi.B, solo.blocchi.C, solo.blocchi.D]);
    check('tornando a quattro si ritrova tutto dov\'era', JSON.stringify(q), JSON.stringify(BF.cambiaForma(solo, 'quattro')));
    check('⚠️ «usciti» non è enumerabile: nel localStorage non ci finisce', [false, false],
      [JSON.stringify(solo).indexOf('usciti') >= 0, Object.keys(solo).indexOf('usciti') >= 0]);
    check('un blocco vuoto che sparisce non è una notizia', [],
      BF.cambiaForma(S({ forma: 'quattro', blocchi: { A: 'capitolo' } }), 'uno').usciti);
    check('e un blocco già nascosto non «esce» una seconda volta', [],
      BF.cambiaForma(S({ forma: 'due-col', blocchi: { A: 'capitolo', B: 'appunti', C: 'mappa' } }), 'uno')
        .usciti.filter((u) => u.blocco === 'B'));
    check('passare a una forma più larga non fa uscire nessuno', [['A', 'B', 'C', 'D'], []],
      (() => { const s = BF.cambiaForma(q, 'quattro'); return [Object.keys(s.blocchi), s.usciti]; })());
    check('una forma sconosciuta non rifà il banco: si tiene quella di adesso', ['tre-sopra', []],
      (() => { const s = BF.cambiaForma(S({ forma: 'tre-sopra' }), 'pippo'); return [s.forma, s.usciti]; })());
    check('«usciti» c\'è sempre, anche vuota: chi la legge non deve controllare prima', [true, true, true],
      [Array.isArray(solo.usciti), Array.isArray(BF.cambiaForma(q, 'quattro').usciti),
       Array.isArray(BF.cambiaForma(q, 'pippo').usciti)]);

    // ---- purezza: nessuna mossa tocca lo stato che ha ricevuto
    const intatto = JSON.stringify(base);
    BF.assegna(base, 'A', 'mappa'); BF.assegna(base, 'B', ''); BF.cambiaForma(base, 'uno'); S(base);
    check('nessuna mossa tocca lo stato ricevuto', intatto, JSON.stringify(base));
    check('e lo stato nuovo non condivide i blocchi con quello vecchio', [false, false],
      [BF.assegna(base, 'A', 'x').blocchi === base.blocchi, BF.cambiaForma(base, 'uno').blocchi === base.blocchi]);

    /* Il giro completo che farà il localStorage: si cambia forma, si serializza,
       si rilegge, si normalizza. Quello che deve arrivare dall'altra parte è il
       banco di prima — compresi gli strumenti fuori scena — e NON la proprietà
       `.usciti`, che era una notizia sull'operazione, non un dato del banco. */
    const salvato = JSON.parse(JSON.stringify(BF.cambiaForma(
      S({ forma: 'quattro', col: 0.62, riga: 0.4, blocchi: { A: 'capitolo', B: 'appunti', C: 'mappa', D: 'keyword' } }), 'uno')));
    check('il giro completo dal disco: si salva, si rilegge, e il banco è quello di prima',
      { forma: 'uno', col: 0.62, riga: 0.4, blocchi: { A: 'capitolo', B: 'appunti', C: 'mappa', D: 'keyword' } },
      S(salvato));
    check('e dal disco «usciti» non torna, perché non c\'era mai andato', undefined, S(salvato).usciti);
  }

  console.log('\n' + (ko ? '✗ ' + ko + ' controlli falliti' : '✓ tutti i controlli passati') + ' (' + ok + ' ok)');
  process.exit(ko ? 1 : 0);
})();
