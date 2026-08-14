/* Lo zoom della fonte: passo, ciclo, etichetta e punto fisso — senza aprire l'app.
 *
 * ⚠️ Che cosa difende. Tre di queste regole si potevano provare solo a occhio,
 * su un documento vero, e tutte e tre hanno un modo silenzioso di sbagliare: il
 * clamp che INVERTE il gesto («+» a 600% che rimpicciolisce), il livello salvato
 * illeggibile che pdf.js ignora senza sollevare, e la rotellata con SHIFT che su
 * macOS arriva su `deltaX` — cioè un gesto che su metà delle macchine non fa
 * niente. Qui si controllano in 40 millisecondi.
 *
 *   node test/zoom-fonte.js
 */
const Z = require('../App/assets/fonti/zoom.js');

let ko = 0;
function ok(nome, atteso, avuto) {
  const a = JSON.stringify(atteso), b = JSON.stringify(avuto);
  if (a === b) { console.log('  ok  ' + nome); return; }
  ko++; console.log('  KO  ' + nome + '\n      atteso ' + a + '\n      avuto  ' + b);
}
function sezione(t) { console.log('\n== ' + t); }

sezione('Il livello salvato: quello storto non deve spegnere lo zoom in silenzio');
ok('un modo si riconosce', 'page-width', Z.valido('page-width'));
ok('e anche quello della pagina intera', 'page-fit', Z.valido('page-fit'));
/* I due modi che il bottone non raggiunge più restano leciti in ARRIVO: un
   livello salvato da una versione precedente non si butta via. */
ok('un modo vecchio non si butta via', 'auto', Z.valido('auto'));
ok('un numero valido si tiene', '1.5', Z.valido('1.5'));
ok('spazzatura ripiega sulla larghezza', 'page-width', Z.valido('spazzatura'));
ok('un numero fuori scala pure', 'page-width', Z.valido('20'));
ok('e il vuoto anche', 'page-width', Z.valido(null));

sezione('Il passo: moltiplicativo, con un tetto che non inverte il gesto');
ok('«+» da 1 sale', 1.1, Z.passo(1, true));
ok('«−» da 1 scende', 0.91, Z.passo(1, false));
ok('«+» si ferma al tetto', Z.MAX, Z.passo(4.9, true));
ok('«−» si ferma al pavimento', Z.MIN, Z.passo(0.26, false));
/* ⚠️ Il difetto vero: una scala arrivata da un adattamento può stare FUORI dai
   nostri limiti. Un clamp cieco faceva scendere a 500% premendo «+». */
ok('«+» oltre il tetto non fa niente', null, Z.passo(6, true));
ok('ma «−» da lassù funziona', true, Z.passo(6, false) < 6);
ok('«−» sotto il pavimento non fa niente', null, Z.passo(0.1, false));
ok('e «+» da laggiù funziona', true, Z.passo(0.1, true) > 0.1);
ok('una scala assurda non propaga NaN', 1.1, Z.passo('cane', true));

sezione('Il ciclo del bottone: due modi, e da un numero si rientra dalla larghezza');
ok('dalla larghezza si va alla pagina', 'page-fit', Z.prossimoAdatta('page-width'));
ok('dalla pagina si torna alla larghezza', 'page-width', Z.prossimoAdatta('page-fit'));
ok('da un numero si entra dalla larghezza', 'page-width', Z.prossimoAdatta('1.44'));

sezione('L’etichetta: un segno quando è dinamica, la percentuale quando è a mano');
const larg = Z.etichetta('page-width', 1.44, true);
ok('la larghezza si dice con la freccia bidirezionale', '⟷', larg.testo);
/* ⚠️ I due segni devono cadere FUORI dagli intervalli dichiarati dal @font-face
   di OpenMoji (fra gli altri U+2190-21FF, dove stanno ↔ e ↕): dentro, in barra
   uscirebbero come pittogrammi colorati alti come un'emoji. */
const dentroOpenMoji = c => (c >= 0x1F000 && c <= 0x1FAFF) || (c >= 0x2190 && c <= 0x21FF)
  || (c >= 0x2300 && c <= 0x23FF) || (c >= 0x2460 && c <= 0x27BF) || (c >= 0x2B00 && c <= 0x2BFF);
ok('e nessuno dei due segni finisce nel font delle emoji', [false, false],
  [Z.SEGNI['page-width'], Z.SEGNI['page-fit']].map(s => dentroOpenMoji(s.codePointAt(0))));
ok('la percentuale non sparisce: si sposta nel suggerimento', true, /144%/.test(larg.titolo));
ok('che dice anche che segue il riquadro', true, /segue il riquadro/.test(larg.titolo));
ok('e dove porta il click', true, /alla pagina intera/.test(larg.titolo));

const pag = Z.etichetta('page-fit', 0.8, true);
ok('la pagina intera si dice con la diagonale', '⤢', pag.testo);
ok('e il click di lì torna alla larghezza', true, /alla larghezza/.test(pag.titolo));

const mano = Z.etichetta('1.44', 1.44, true);
ok('a mano si legge la percentuale', '144%', mano.testo);
ok('e il click promette l’adattamento', true, /adattare alla larghezza/.test(mano.titolo));

/* Nella finestra fra `setDocument` e `pagesinit` il viewer risponde «1» a chi
   chiede la scala: dichiarare «100%» lì sarebbe una sicurezza inventata. */
ok('finché la scala non esiste non si inventa un numero', '—', Z.etichetta('1.44', 1, false).testo);
ok('ma il modo si mostra lo stesso', '⟷', Z.etichetta('page-width', 1, false).testo);
ok('senza la percentuale nel suggerimento', false, /100%/.test(Z.etichetta('page-width', 1, false).titolo));

/* Lo scorrimento che tiene il punto sotto il puntatore non si prova qui perché
   non è nostro: lo fa `updateScale({origin})` di pdf.js, e sta nella prova
   sull'app viva (`test/cdp/prova-pdf.js`). Nostro è di quanto ingrandire. */

sezione('⚠️ La rotellata con SHIFT arriva su deltaX, su macOS');
ok('in su si ingrandisce', 1, Z.verso({ deltaY: -120, deltaX: 0 }));
ok('in giù si riduce', -1, Z.verso({ deltaY: 120, deltaX: 0 }));
ok('col delta sull’asse orizzontale il gesto vale lo stesso', 1, Z.verso({ deltaY: 0, deltaX: -40 }));
ok('e nell’altro verso pure', -1, Z.verso({ deltaY: 0, deltaX: 40 }));
ok('una rotellata vuota non tocca la scala', 0, Z.verso({ deltaY: 0, deltaX: 0 }));
ok('e nemmeno un evento senza delta', 0, Z.verso({}));

sezione('⚠️ L’isteresi che rompe il ping-pong della barra di scorrimento');
ok('a mano non si riadatta mai', false, Z.daRiadattare('1.44', 800, 600));
ok('la prima volta si adatta sempre', true, Z.daRiadattare('page-width', 800, 0));
ok('un cambio vero fa riadattare', true, Z.daRiadattare('page-width', 800, 600));
/* Comparire e sparire della barra verticale = una quindicina di pixel: quella
   soglia va superata, o l’anello osservatore→scala→layout non si chiude mai. */
ok('un pixel non basta', false, Z.daRiadattare('page-width', 801, 800));
ok('nemmeno tre', false, Z.daRiadattare('page-width', 803, 800));
ok('quattro sì', true, Z.daRiadattare('page-width', 804, 800));
ok('la soglia si può alzare', false, Z.daRiadattare('page-width', 810, 800, 20));
ok('anche la pagina intera è dinamica', true, Z.daRiadattare('page-fit', 800, 600));
ok('un riquadro senza larghezza non fa lavorare nessuno', false, Z.daRiadattare('page-width', 0, 600));

console.log(ko ? `\n✗ ${ko} controlli falliti` : `\n✓ tutti i controlli passati`);
process.exit(ko ? 1 : 0);
