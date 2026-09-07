/* Il pannellino della ricerca nel documento: la MISURA, non il colore.
 *
 * ⚠️ Perché questa prova esiste. Il campo di ricerca è `flex:1 1 auto`, quindi
 * la sua larghezza era «il pannellino meno tutto il resto» — e «tutto il resto»
 * è il conteggio, che cambia a ogni battuta: «1 di 2», «128 di 340», «nessun
 * risultato», con o senza «↻», con o senza «· intera». Il campo si allargava e
 * si stringeva sotto le dita di chi ci stava scrivendo dentro. E quando non ci
 * stava più, la barra andava a capo e la ✕ finiva da sola sotto: il comando di
 * chiusura sparito di sotto proprio nell'istante in cui uno lo cerca.
 *
 * ⚠️ Il taglio in righe del flexbox guarda la misura IDEALE degli elementi, non
 * quella a cui potrebbero ridursi: il campo si sarebbe stretto volentieri, ma la
 * riga si spezzava prima che glielo si chiedesse. Per questo non bastava
 * `min-width:0` sul campo — serviva `flex-wrap:nowrap` sulla barra.
 *
 * ⚠️ QUESTA PROVA VIVE IN CDP E NON IN NODE, ed è una delle poche che se lo
 * merita: qui si misura il FLEXBOX, cioè una cosa che esiste solo dentro un
 * motore di rendering. Non c'è nessuna regola pura da estrarre — la correzione è
 * CSS. Dove invece una regola si può decidere senza il DOM, va in un modulo con
 * la sua prova in Node (`node test/...`): quaranta millisecondi invece di
 * quaranta secondi.
 *
 * Il controllo che vale il file è l'ULTIMO: la larghezza del campo è la STESSA
 * in tutti gli stati. Non «abbastanza larga», non «una riga sola»: **la stessa**.
 * Una prova che guardasse un solo stato sarebbe stata verde anche prima.
 *
 *   ./test/cdp/con-vault-di-prova.sh prova-ricerca-pannellino.js
 */
const S = require('path').join(__dirname, 'cdp.js');
const { collega, val, pausa, partiPulito, apriStrumento, pdfVisibile } = require(S);

let ko = 0;
function ok(n, atteso, avuto) {
  const a = JSON.stringify(atteso), b = JSON.stringify(avuto);
  if (a === b) { console.log('  ok  ' + n); return; }
  ko++; console.log('  KO  ' + n + '\n      atteso ' + a + '\n      avuto  ' + b);
}
function sezione(t) { console.log('\n== ' + t); }

const PDF = 'Piano-di-studio-della-Scuola-dell-obbligo-ticinese.pdf';

async function finoA(expr, quanto) {
  const fine = Date.now() + (quanto || 10000);
  while (Date.now() < fine) {
    const v = await val(expr);
    if (v) return v;
    await pausa(200);
  }
  return null;
}

/* Tutti gli stati che `pdfFindConto` sa scrivere, ricavati dai suoi chiamanti:
   il vuoto fra due ricerche, l'attesa, il conteggio con una e con tre cifre, il
   giro completato (↻), il nulla di fatto. E ognuno può portarsi dietro
   « · intera», che la funzione appende da sé quando le virgolette sono attive:
   è la coda più lunga, cioè il caso peggiore. */
const STATI = [
  { nome: 'vuoto (fra due ricerche)', testo: '', esatta: false },
  { nome: 'cerco…', testo: 'cerco…', esatta: false },
  { nome: '1 di 2', testo: '1 di 2', esatta: false },
  { nome: '128 di 340', testo: '128 di 340', esatta: false },
  { nome: '1 di 2 ↻', testo: '1 di 2 ↻', esatta: false },
  { nome: '128 di 340 ↻', testo: '128 di 340 ↻', esatta: false },
  { nome: 'nessun risultato', testo: 'nessun risultato', esatta: false },
  { nome: '1 di 2 · intera', testo: '1 di 2', esatta: true },
  { nome: '128 di 340 ↻ · intera', testo: '128 di 340 ↻', esatta: true },
  { nome: 'nessun risultato · intera', testo: 'nessun risultato', esatta: true }
];

/* Che cosa si misura, e perché proprio questo:
   · `campo`   la larghezza del campo di testo — è la cosa che deve stare ferma;
   · `righe`   quanti «piani» ha la barra. ⚠️ Si ricava dai CENTRI verticali dei
               figli, non dai loro `top`: la barra è `align-items:center`, quindi
               un bottone alto 30 e un campo alto 24 hanno `top` diversi ANCHE
               sulla stessa riga. La prima stesura contava i `top` e diceva «tre
               righe» su una barra alta 35 pixel — cioè accusava il layout di un
               difetto della misura. Il righello prima del codice, sempre;
   · `chiusa`  se la ✕ sta sulla stessa riga del campo. È la domanda che l'utente
               ha posto guardando la foto, e si risponde con due `top`. */
const MISURA = `(()=>{
  const bar = document.querySelector('#pdfFindPop .tbar');
  const inp = document.getElementById('pdfFindInput');
  const chi = document.getElementById('pdfFindClose');
  const cnt = document.getElementById('pdfFindCount');
  const r = (el) => { const b = el.getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width * 10) / 10 }; };
  const centri = Array.from(bar.children).map((c) => { const b = c.getBoundingClientRect(); return b.top + b.height / 2; });
  const piani = centri.reduce((acc, y) => (acc.some((v) => Math.abs(v - y) < 6) ? acc : acc.concat(y)), []);
  return {
    campo: r(inp).w,
    conto: r(cnt).w,
    righe: piani.length,
    chiusaInRiga: Math.abs(r(chi).y - r(inp).y) < 6,
    barra: Math.round(bar.getBoundingClientRect().height)
  };
})()`;

(async () => {
  await collega();
  await partiPulito();
  await apriStrumento('fonte');
  await pdfVisibile(PDF);
  await val(`openPdf(${JSON.stringify(PDF)}, 1, 'Piano di studio'), 1`);
  await finoA('!!PDFJS.doc', 20000);
  await val("pdfFindApri(), 1");
  await pausa(300);
  ok('il pannellino è aperto', true, await val("document.getElementById('pdfFindPop').hasAttribute('open')"));

  sezione('Ogni stato del conteggio, misurato');
  const viste = [];
  for (const s of STATI) {
    /* Si scrive passando dalla funzione VERA, non dal `textContent`: è lei che
       appende « · intera» e che compone il suggerimento, e una prova che
       scrivesse a mano nel nodo misurerebbe uno stato che l'app non produce. */
    await val(`(()=>{ PDFFIND.esatta=${s.esatta}; pdfFindConto(${JSON.stringify(s.testo)}, false); return 1; })()`);
    await pausa(120);
    const m = await val(MISURA);
    viste.push({ stato: s.nome, ...m });
    console.log('   ' + s.nome.padEnd(26) + ' campo ' + String(m.campo).padStart(6) +
      '  conto ' + String(m.conto).padStart(5) + '  righe ' + m.righe + '  barra ' + m.barra);
  }

  sezione('⭐ La larghezza del campo non dipende da che cosa gli sta accanto');
  const larghezze = [...new Set(viste.map((v) => v.campo))];
  ok('una sola larghezza in tutti gli stati', 1, larghezze.length);
  console.log('   larghezza del campo: ' + larghezze.join(' · ') + 'px');
  /* ⚠️ Il conto tiene la sua fessura ANCHE da vuoto. Prima spariva
     (`:empty{display:none}`), cioè restituiva al campo la sua larghezza
     nell'istante fra due ricerche: una casella vuota che tiene il posto si nota
     molto meno di un campo che si muove da solo. */
  const contiVuoti = viste.filter((v) => v.stato.startsWith('vuoto')).map((v) => v.conto);
  ok('e il conto tiene la fessura anche da vuoto', true, contiVuoti.every((w) => w > 0));

  sezione('Il pannellino sta su una riga sola, sempre');
  ok('nessuno stato manda la barra a capo', [1], [...new Set(viste.map((v) => v.righe))]);
  ok('la ✕ non finisce mai sotto', [true], [...new Set(viste.map((v) => v.chiusaInRiga))]);
  ok('e l\'altezza della barra non cambia', 1, new Set(viste.map((v) => v.barra)).size);

  sezione('Il campo resta usabile');
  /* ⚠️ Questo NON è un controllo estetico travestito: è il pavimento sotto cui
     un campo di ricerca smette di essere un campo di ricerca. Sotto i 60px non
     ci stanno nemmeno otto caratteri a 12px, e chi cerca «insegnamento» non
     vedrebbe mai che cosa ha scritto. Il numero è un pavimento, non un
     bersaglio: se un giorno la fessura del conto o la larghezza del pannellino
     cambiano, questo controllo dice solo che non si è scesi sotto il vivibile. */
  ok('il campo è largo almeno 60px', true, viste[0].campo >= 60);

  /* Si rimette com'era: lo stato che una prova lascia è l'ingresso di quella dopo. */
  await val("PDFFIND.esatta=false; pdfFindConto(''); pdfFindChiudi(); 1");

  console.log(ko ? `\n✗ ${ko} controlli falliti` : `\n✓ tutti i controlli passati`);
  process.exit(ko ? 1 : 0);
})();
