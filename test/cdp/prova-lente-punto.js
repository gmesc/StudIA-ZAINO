/* La lente porta al PUNTO della parola, non alla pagina che la contiene.
 *
 * ⚠️ Che cosa misura, e perché solo l'app viva può dirlo: **dove sta
 * l'occorrenza rispetto alla finestra**. È una posizione a schermo, e una
 * posizione a schermo esiste solo dentro un motore di rendering.
 *
 * ⚠️ IL CONTROLLO CHE VALE NON È «si è aperta la pagina giusta»: quello sarebbe
 * verde anche col difetto dentro, perché la pagina si apriva già. Quello che va
 * misurato è che **la parola cercata sia dentro il riquadro**, cioè che chi ha
 * cliccato la veda senza scorrere.
 *
 * ⚠️ Perché NON si passa dalla lente vera. Il vault di prova non ha gli indici
 * PDF: la lente indicizza 33 documenti, tutti capitoli, e cercando una parola
 * che nei PDF c'è restituisce zero risultati di tipo «pagina» (misurato il 23
 * agosto 2026). Costruire quel vault è un lavoro a sé — Q2.2 dell'handoff del
 * pacchetto «Quaderno». Qui si chiama `searchGoto` con un risultato fatto a
 * mano: quel ramo legge `r.d.materiale` e `r.d.pagina`, e sono esattamente le
 * due cose che la lente gli passerebbe. Si prova la strada, non il modo di
 * imboccarla.
 *
 *   ./test/cdp/con-vault-di-prova.sh prova-lente-punto.js
 */
const S = require('path').join(__dirname, 'cdp.js');
const { collega, val, pausa, partiPulito, apriStrumento } = require(S);

let ko = 0;
function ok(n, atteso, avuto) {
  const a = JSON.stringify(atteso), b = JSON.stringify(avuto);
  if (a === b) { console.log('  ok  ' + n); return; }
  ko++; console.log('  KO  ' + n + '\n      atteso ' + a + '\n      avuto  ' + b);
}
function sezione(t) { console.log('\n== ' + t); }

const PDF = 'Piano-di-studio-della-Scuola-dell-obbligo-ticinese.pdf';
const PAROLA = 'scuola';
const PAGINA = 30;

async function finoA(expr, quanto) {
  const fine = Date.now() + (quanto || 25000);
  for (;;) {
    const v = await val(expr);
    if (v) return v;
    if (Date.now() > fine) return null;
    await pausa(250);
  }
}

/* Dove sta l'occorrenza rispetto al riquadro del documento. `.selected` è quella
   su cui pdf.js si è fermato; se non c'è ancora si guarda la prima accesa. */
const DOVE = `(()=>{
  const host = document.getElementById('pdfHost');
  const h = document.querySelector('#pdfFrame .textLayer .highlight.selected')
         || document.querySelector('#pdfFrame .textLayer .highlight');
  const accese = document.querySelectorAll('#pdfFrame .textLayer .highlight').length;
  if (!host) return { errore: 'niente riquadro' };
  const r = host.getBoundingClientRect();
  if (!h) return { accese, pagina: ANTEPRIMA.page, nessunaAccesa: true };
  const b = h.getBoundingClientRect();
  return {
    accese, pagina: ANTEPRIMA.page,
    dentroLaFinestra: b.top >= r.top - 1 && b.bottom <= r.bottom + 1,
    testo: h.textContent,
    y: Math.round(b.top), riquadro: [Math.round(r.top), Math.round(r.bottom)],
    barra: document.getElementById('pdfFindPop').hasAttribute('open'),
    conto: (document.getElementById('pdfFindCount') || {}).textContent
  };
})()`;

(async () => {
  await collega();
  await partiPulito();
  await apriStrumento('fonte');

  sezione('Il filo è attaccato');
  ok('l\'attesa è arrivata nella pagina', 'function',
    await val("(typeof FontiAttesa==='undefined') ? 'assente' : typeof FontiAttesa.attendi"));
  /* ⚠️ `typeof X.y` SOLLEVA se `X` non esiste, e una prova che esplode invece di
     dire KO uccide il resto della corsa con un errore che parla
     dell'infrastruttura. Si chiede prima se il nome esista. */

  sezione('⚠️ L\'attesa NON è più un numero');
  /* ⚠️ QUI NON C'È UN CONTROLLO SUL SORGENTE, e la ragione vale la pena di
     essere scritta perché ci sono passato. La prima stesura chiedeva che nel
     testo di `searchGoto` non comparisse `setTimeout(…, 600)`: nella controprova
     — dove l'attesa era stata rimessa a `0` — è rimasta VERDE mentre tutto il
     resto diventava rosso. Difendeva dal difetto di ieri, non dalla sua forma.
     Generalizzata a «un numero qualsiasi», è diventata il difetto opposto: ha
     accusato il `setTimeout` LEGITTIMO dell'altro ramo di questa stessa
     funzione, quello dei capitoli. Un controllo sul sorgente che non sa
     distinguere i rami grida al lupo, e un controllo che grida al lupo lo si
     finisce per spegnere.
     A difendere il lavoro sono i controlli sul COMPORTAMENTO qui sotto, e la
     controprova dice che bastano: rimettendo un'attesa a tempo diventano rossi
     in cinque. Resta il solo controllo positivo, che nomina la strada nuova. */
  ok('e c\'è invece un\'attesa a condizione', true,
    await val("String(searchGoto).indexOf('FontiAttesa.attendi')>=0"));

  sezione('⭐ Cliccando un risultato si atterra sulla PAROLA');
  const avvio = Date.now();
  await val(`searchGoto({ d:{ materiale:${JSON.stringify(PDF)}, pagina:${PAGINA} } }, ${JSON.stringify(PAROLA)}), 1`);
  await finoA('!!PDFJS.doc', 25000);
  /* Si aspetta che l'app abbia acceso qualcosa, con lo stesso criterio che usa
     lei: una condizione, non un numero. */
  const acceso = await finoA("document.querySelectorAll('#pdfFrame .textLayer .highlight').length>0", 25000);
  const d = await val(DOVE);
  console.log('   ' + JSON.stringify(d));
  console.log('   arrivato in ' + (Date.now() - avvio) + ' ms');

  ok('la pagina è quella chiesta', PAGINA, d.pagina);
  ok('la barra della ricerca è a schermo', true, d.barra);
  ok('c\'è almeno un\'occorrenza accesa', true, !!acceso && d.accese > 0);
  /* ⚠️ IL CONTROLLO CHE VALE IL FILE: non «si è aperta la pagina», ma «la parola
     si vede». Chi ha cliccato deve trovarla sotto gli occhi, non doverla
     cercare una seconda volta. */
  ok('e l\'occorrenza è DENTRO la finestra, non fuori', true, d.dentroLaFinestra === true);
  /* ⚠️ NON si pretende l'uguaglianza, ed è un rosso pagato scrivendo questa
     prova: sul documento vero «scuola» sta a cavallo di due righe, e pdf.js
     accende il pezzo che sta su quella riga — «scuo-». Chiedere la parola
     intera accuserebbe l'app per una proprietà della SILLABAZIONE, che è del
     documento e non sua. Quello che va difeso è che il pezzo acceso appartenga
     davvero alla parola cercata, non che sia tutta lì. */
  const acceso1 = String(d.testo || '').trim().toLowerCase().replace(/[-\u00ad]$/, '');
  ok('ed è la parola cercata (o il suo pezzo, se va a capo)', true,
    !!acceso1 && PAROLA.indexOf(acceso1) === 0);
  console.log('   acceso: ' + JSON.stringify(d.testo) + ' → pezzo di ' + JSON.stringify(PAROLA));

  sezione('Su una macchina veloce non si aspetta per niente');
  /* ⚠️ Il difetto opposto a quello che si è tolto: sostituire un ritardo fisso
     con un'attesa che si prende comunque il suo tempo. Il modulo guarda subito,
     e qui si controlla che l'attesa non sia diventata una tassa. */
  const subito = await val(`(async()=>{ const t=Date.now();
    const e=await FontiAttesa.attendi(()=>true); return { ms:Date.now()-t, sguardi:e.sguardi }; })()`);
  console.log('   ' + JSON.stringify(subito));
  ok('chi è già pronto risponde al primo sguardo', 1, subito.sguardi);
  ok('e senza aspettare un battito', true, subito.ms < 50);

  sezione('E se il documento non arriva, lo dice');
  /* ⚠️ Una ricerca lanciata su una pagina che non c'è ancora non trova niente e
     non spiega: chi ha cliccato crede che la parola non ci sia, mentre la lente
     gli aveva appena detto il contrario. Qui si misura che la rinuncia sia una
     RISPOSTA leggibile, non un silenzio. */
  const rinuncia = await val(`(async()=>{ const t=Date.now();
    const e=await FontiAttesa.attendi(()=>false,{tetto:300,passo:50});
    return { pronto:e.pronto, ms:Date.now()-t }; })()`);
  console.log('   ' + JSON.stringify(rinuncia));
  ok('la promessa si risolve invece di restare appesa', false, rinuncia.pronto);
  ok('e rinuncia al tetto, non prima né mai', true, rinuncia.ms >= 300 && rinuncia.ms < 2000);

  console.log(ko ? `\n✗ ${ko} controlli falliti` : `\n✓ tutti i controlli passati`);
  process.exit(ko ? 1 : 0);
})();
