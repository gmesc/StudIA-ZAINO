/* Chi vince fra i tasti che si premono leggendo — senza aprire l'app.
 *
 * ⚠️ Che cosa difende, ed è il difetto che ha fatto nascere il file: **un tasto
 * che fa DUE cose**. Nel monolite ci sono 24 ascoltatori globali di `keydown`,
 * e a parità di nodo e di fase decide l'ordine di registrazione, cioè la
 * posizione del codice nel file. Nessuno lo dichiara, e nessuno lo può leggere:
 * lo si scopre premendo. Qui la domanda ha UNA risposta, e la risposta si
 * controlla in quaranta millisecondi invece che in quaranta secondi di Electron.
 *
 * ⚠️ Il controllo che vale il file è nella prima sezione: con il fuoco dentro
 * il Player, la freccia sinistra salta cinque secondi **e il capitolo non si
 * muove**. Oggi si muove: il gestore dei capitoli gira prima di quello del
 * Player, e quando decide `defaultPrevented` è ancora falso.
 *
 * ⚠️ Una prova scritta al positivo — «← nel Player salta di 5 secondi» — sarebbe
 * VERDE anche oggi, con il difetto dentro. È il motivo per cui la domanda posta
 * qui non è «fa la cosa giusta?» ma «fa UNA cosa?»: una funzione che restituisce
 * un'azione sola non può rispondere due volte, e il difetto diventa impossibile
 * invece che improbabile.
 *
 *   node test/tasti-lettura.js
 */
const T = require('../App/assets/tasti/lettura.js');

let ko = 0;
function ok(nome, atteso, avuto) {
  const a = JSON.stringify(atteso), b = JSON.stringify(avuto);
  if (a === b) { console.log('  ok  ' + nome); return; }
  ko++; console.log('  KO  ' + nome + '\n      atteso ' + a + '\n      avuto  ' + b);
}
function sezione(t) { console.log('\n== ' + t); }

/* Scorciatoie per non riscrivere l'oggetto a ogni riga. `t` è il tasto nudo;
   i modificatori si aggiungono solo dove sono il soggetto della prova. */
const t = (key, mod) => Object.assign({ key: key }, mod || {});
const SX = 'ArrowLeft', DX = 'ArrowRight', SU = 'ArrowUp', GIU = 'ArrowDown';

/* Le due situazioni di partenza, scritte per esteso una volta sola. */
const zaino = (extra) => Object.assign({ modo: 'zaino', fuoco: 'documento', pdf: true }, extra || {});
const corso = (extra) => Object.assign({ modo: 'corso', fuoco: 'documento' }, extra || {});

sezione('⭐ Il Player: un tasto, UNA cosa');
/* Il difetto misurato il 23 agosto 2026: col fuoco dentro il Player la freccia
   saltava 5 secondi E cambiava capitolo. Le due righe qui sotto dicono che la
   risposta è una sola — non «anche» il capitolo, non «anche» la pagina. */
ok('← nel Player salta indietro di 5, e basta',
  'player:indietro5', T.decidi(t(SX), corso({ fuoco: 'player', player: true })));
ok('→ nel Player salta avanti di 5, e basta',
  'player:avanti5', T.decidi(t(DX), corso({ fuoco: 'player', player: true })));
/* E lo stesso in uno zaino, dove il concorrente sarebbe la pagina del documento
   invece del capitolo: il difetto ha due facce, e questa è la seconda. */
ok('…e in uno zaino non volta nemmeno la pagina',
  'player:indietro5', T.decidi(t(SX), zaino({ fuoco: 'player', player: true })));

sezione('I tasti nudi del Player valgono ovunque, le frecce no');
/* Sono il gesto di chi ascolta mentre lavora da un'altra parte: mettere in pausa
   non deve costringere a tornare col fuoco dentro il riquadro. */
ok('«k» mette in pausa anche col fuoco sul documento',
  'player:pausa', T.decidi(t('k'), zaino({ player: true })));
ok('e lo spazio fa lo stesso', 'player:pausa', T.decidi(t(' '), zaino({ player: true })));
ok('«j» torna indietro di 10', 'player:indietro10', T.decidi(t('j'), zaino({ player: true })));
ok('«l» va avanti di 10', 'player:avanti10', T.decidi(t('l'), zaino({ player: true })));
/* ⚠️ Le maiuscole contano quanto le minuscole: con il BLOC MAIUSC acceso, o
   tenendo ⇧ senza accorgersene, il tasto è lo stesso tasto. */
ok('«K» maiuscolo è lo stesso tasto', 'player:pausa', T.decidi(t('K'), zaino({ player: true })));
ok('«J» maiuscolo pure', 'player:indietro10', T.decidi(t('J'), zaino({ player: true })));
ok('«<» rallenta', 'player:piuLento', T.decidi(t('<'), zaino({ player: true })));
ok('«>» accelera', 'player:piuVeloce', T.decidi(t('>'), zaino({ player: true })));
/* ⚠️ La distinzione che il Player dichiarava nel suo commento e che nessuno
   faceva rispettare: i tasti nudi ovunque, le FRECCE solo dentro il riquadro. */
ok('ma ← col fuoco sul documento è la PAGINA, non il player',
  'pagina:indietro', T.decidi(t(SX), zaino({ player: true })));
ok('senza media aperto «k» non è di nessuno', null, T.decidi(t('k'), zaino()));

sezione('Chi sta scrivendo sta scrivendo');
/* ⚠️ Vale PRIMA del Player: con un media in corsa, la «l» di chi batte una
   parola è una lettera. Un'app che mettesse in pausa scrivendo «pollo» sarebbe
   inutilizzabile, ed è il caso che rende la regola non negoziabile. */
ok('«l» nell\'editor è una lettera', null, T.decidi(t('l'), zaino({ fuoco: 'scrittura', player: true })));
ok('lo spazio pure', null, T.decidi(t(' '), zaino({ fuoco: 'scrittura', player: true })));
ok('e le frecce muovono il cursore', null, T.decidi(t(SX), zaino({ fuoco: 'scrittura' })));
ok('anche in un corso', null, T.decidi(t(DX), corso({ fuoco: 'scrittura' })));

sezione('Le frecce orizzontali: zaino → pagina, corso → capitolo');
ok('in uno zaino → volta pagina', 'pagina:avanti', T.decidi(t(DX), zaino()));
ok('e ← torna indietro', 'pagina:indietro', T.decidi(t(SX), zaino()));
/* ⚠️ IL DIFETTO CHE SI RIPARA: in uno zaino non ci sono capitoli da sfogliare.
   Oggi quelle frecce sfogliano in SILENZIO i capitoli del corso rimasto aperto
   dietro — non si vede niente, e tornando ai corsi il capitolo è cambiato.
   Senza un documento aperto la risposta è «nessuno», mai il capitolo. */
ok('in uno zaino SENZA documento non tocca il capitolo di nessuno',
  null, T.decidi(t(DX), zaino({ pdf: false })));
ok('in un corso → cambia capitolo', 'capitolo:avanti', T.decidi(t(DX), corso()));
ok('e ← torna al precedente', 'capitolo:indietro', T.decidi(t(SX), corso()));

sezione('La mappa: conta dove sta il FUOCO, non che sia a schermo');
/* ⚠️ Il vecchio rimedio guardava se una mappa fosse aperta, e per una ragione
   misurata: dentro un SVG il bersaglio è un `<g>`, e il controllo sul `tagName`
   non lo vede — sfiorare una freccia sulla tela cambiava la pagina sotto. Ma
   era grosso: con la mappa in un altro blocco del banco le frecce morivano
   ovunque, e il banco serve proprio a tenere documento e mappa affiancati. */
ok('col fuoco sulla tela le frecce sono sue', null, T.decidi(t(SX), zaino({ fuoco: 'mappa' })));
ok('anche in un corso', null, T.decidi(t(DX), corso({ fuoco: 'mappa' })));
ok('ma col fuoco sul documento la pagina si volta lo stesso',
  'pagina:avanti', T.decidi(t(DX), zaino()));

sezione('Il righello: ↑ ↓ solo da acceso');
ok('acceso, ↑ sale di una riga', 'righello:su', T.decidi(t(SU), zaino({ righello: true })));
ok('e ↓ scende', 'righello:giu', T.decidi(t(GIU), zaino({ righello: true })));
/* ⚠️ Da spento quelle due frecce sono lo SCORRIMENTO della pagina: prenderle
   comunque vorrebbe dire un documento che non si scorre più con la tastiera.
   `null` qui non è «non fa niente»: è «lascia fare al browser». */
ok('spento, ↑ resta lo scorrimento del browser', null, T.decidi(t(SU), zaino()));
ok('e ↓ pure', null, T.decidi(t(GIU), zaino()));
/* Il righello non ruba le frecce orizzontali: quelle restano della pagina. */
ok('acceso, ← è ancora la pagina', 'pagina:indietro', T.decidi(t(SX), zaino({ righello: true })));
/* ⚠️ E non ruba i tasti del Player: si legge col righello mentre si ascolta. */
ok('acceso, «k» è ancora del player',
  'player:pausa', T.decidi(t('k'), zaino({ righello: true, player: true })));

sezione('Il patto: chi ha già risposto ha già risposto');
/* `defaultPrevented`. È il primo controllo della tabella, perché un patto che
   si guarda per ultimo non è un patto — ed è il motivo per cui oggi il gestore
   dei capitoli agisce prima che il Player possa dichiararsi. */
ok('un tasto già gestito non è di nessuno', null, T.decidi(t(SX), zaino({ giaGestito: true })));
ok('nemmeno per il player', null, T.decidi(t('k'), zaino({ player: true, giaGestito: true })));
ok('nemmeno per il righello', null, T.decidi(t(SU), zaino({ righello: true, giaGestito: true })));

sezione('Le scorciatoie del sistema restano del sistema');
/* ⚠️ Il difetto silenzioso: il gestore dei capitoli non guarda i modificatori,
   quindi ⌘← — che su un Mac vuol dire «indietro» — oggi cambia capitolo. */
ok('⌘← non cambia capitolo', null, T.decidi(t(SX, { meta: true }), corso()));
ok('Ctrl← nemmeno', null, T.decidi(t(SX, { ctrl: true }), corso()));
ok('⌥← nemmeno', null, T.decidi(t(SX, { alt: true }), corso()));
ok('⌘← non volta nemmeno la pagina', null, T.decidi(t(SX, { meta: true }), zaino()));
/* ⇧ da solo NON è un modificatore di sistema: «>» si batte con ⇧ su quasi
   tutte le tastiere, e scartarlo spegnerebbe la velocità del player. */
ok('⇧ da solo non spegne niente: «>» accelera',
  'player:piuVeloce', T.decidi(t('>', { shift: true }), zaino({ player: true })));

sezione('Che cosa fa con quello che non conosce');
/* Un contesto arrivato storto non deve inventare un\'azione: una tabella che
   ripiega su «cambia capitolo» sposterebbe il lavoro di chi legge per un campo
   scritto male. Il ripiego è sempre «non è di nessuno». */
ok('un tasto qualunque non è di nessuno', null, T.decidi(t('q'), zaino()));
ok('un fuoco che non esiste vale «altro»', 'pagina:avanti', T.decidi(t(DX), zaino({ fuoco: 'inventato' })));
ok('senza contesto non succede niente', null, T.decidi(t(SX), null));
ok('senza tasto nemmeno', null, T.decidi(null, zaino()));
/* ⚠️ IL VALORE D'ORO, e l'ha trovato questa prova mentre veniva scritta: la
   prima stesura del modulo diceva «se non è uno zaino, allora è un corso», e
   con un contesto vuoto rispondeva `capitolo:indietro`. Cioè: un campo scritto
   male avrebbe SPOSTATO IL CAPITOLO di chi sta leggendo. Fra i due modi di
   sbagliare, «le frecce non fanno niente» si vede subito e non porta via nulla;
   «cambia capitolo» non si vede e porta via il segno. Il modo si dichiara. */
ok('un modo che non esiste non muove niente', null, T.decidi(t(DX), { modo: 'boh', fuoco: 'documento' }));
ok('e un modo mancante nemmeno', null, T.decidi(t(DX), { fuoco: 'documento' }));

sezione('La tabella si dichiara');
/* Chi chiama fa uno `switch` su queste stringhe: se una risposta non fosse
   nell\'elenco, il renderer la ignorerebbe in silenzio. */
const casi = [
  T.decidi(t(SX), zaino()), T.decidi(t(DX), corso()),
  T.decidi(t('k'), zaino({ player: true })), T.decidi(t(SU), zaino({ righello: true })),
  T.decidi(t(SX), corso({ fuoco: 'player', player: true }))
];
ok('ogni risposta è un\'azione dichiarata', true,
  casi.every((a) => a === null || T.AZIONI.indexOf(a) >= 0));
ok('e i fuochi sono cinque', 5, T.FUOCHI.length);

console.log(ko ? `\n✗ ${ko} controlli falliti` : `\n✓ tutti i controlli passati`);
process.exit(ko ? 1 : 0);
