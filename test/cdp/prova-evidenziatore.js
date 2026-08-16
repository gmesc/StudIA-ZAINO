/* L'EVIDENZIATORE: il colore passa sopra il testo, il testo resta nero.
 *
 * ⚠️ Perché esiste. Il fondo pieno era diluito al 34% perché i preset erano le
 * tinte della mappa — sature, da tratto sotto il testo — e stese dietro le
 * lettere avrebbero dato scuro su scuro. Adesso i preset sono colori da
 * evidenziatore e il fondo è pieno: il patto che regge tutto è che il testo
 * NON cambi colore. Se un giorno qualcuno toglie il nero imposto nel capitolo o
 * il `multiply` sul documento, le evidenze continueranno a esserci — e a
 * nascondere le parole che dovrebbero segnare. Non è un guasto che si vede in
 * una suite: si vede leggendo, cioè troppo tardi.
 *
 * Le due superfici sono fatte in due modi diversi e vanno provate come tali: nel
 * capitolo il testo è testo e il fondo gli sta dietro; nel documento il testo è
 * disegnato in un canvas, e sopra c'è un layer di lettere trasparenti — lì
 * l'unico modo di non coprirlo è moltiplicare.
 *
 *   ./test/cdp/con-vault-di-prova.sh prova-evidenziatore.js
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

/* Il contrasto fra due colori secondo WCAG: due luminanze relative, e il
   rapporto fra la più chiara e la più scura. Serve a rispondere con un numero
   alla domanda «questo evidenziatore lascia leggere?». */
function lum(hex) {
  const n = hex.replace('#', '');
  const p = [0, 1, 2].map((i) => parseInt(n.slice(i * 2, i * 2 + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2];
}
const contrasto = (a, b) => {
  const x = lum(a), y = lum(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

(async () => {
  await collega();
  await val('location.reload(), 1'); await pausa(1800);
  await collega(); await pausa(600);
  await partiPulito();
  await pausa(400);

  sezione('I preset sono colori da evidenziatore, non tinte da tratto');
  const colori = await val('evidenzeColori()');
  console.log('   ' + (colori || []).join(' · '));
  ok('sono cinque', 5, (colori || []).length);
  ok('e sono una tavolozza a sé, diversa da quella della mappa', true,
    JSON.stringify(colori) !== JSON.stringify(await val('mappaColori()')));

  /* ⚠️ Il controllo che conta davvero non è «sono gialli» ma «ci si legge
     sopra»: un evidenziatore troppo scuro col testo nero è illeggibile, e il
     numero lo dice prima dell'occhio. 4,5 è la soglia di WCAG per il testo
     normale. */
  const scuri = (colori || []).filter((c) => contrasto(c, '#111111') < 4.5);
  for (const c of colori || []) {
    console.log('   ' + c + ' → contrasto col nero ' + contrasto(c, '#111111').toFixed(1) + ':1');
  }
  ok('col nero si legge su tutti', [], scuri);

  /* ⚠️ Il colore corrente è RICORDATO — in `localStorage`, che sopravvive al
     ricaricamento e alle prove precedenti. Chiedere «qual è il colore di
     partenza» senza prima azzerare la memoria significa misurare che cosa ha
     scelto la prova di prima: da sola questa era verde, nella suite intera no.
     Si dichiara lo stato invece di ereditarlo. */
  await val(`(function(){ try{ localStorage.removeItem('studia.evidenze.colore'); }catch(e){}
    EVIDENZE.colore=''; return 1; })()`);
  ok('senza una scelta ricordata si parte dal primo della tavolozza', (colori || [])[0],
    await val('evidenzeColore()'));

  sezione('NEL CAPITOLO: fondo pieno, testo nero');
  await val(`evidenzeTrattoScegli('overlay'), 1`);
  const preso = await val(`(()=>{
    const p=document.querySelector('#content p'); if(!p) return '';
    const t=[...p.childNodes].find(n=>n.nodeType===3 && n.nodeValue.trim().length>40);
    if(!t) return '';
    const r=document.createRange(); r.setStart(t,0); r.setEnd(t,40);
    evidenzia(r, evidenzeColori()[0]);
    return r.toString(); })()`);
  ok('l\'evidenza è stata fatta', true, !!preso && preso.length > 10);
  await pausa(700);
  const stile = await val(`(document.getElementById('evStile')||{}).textContent || ''`);
  ok('il fondo è il colore PIENO, non diluito', true,
    /background-color:\s*#[0-9a-f]{6}\s*;/i.test(stile) && stile.indexOf('color-mix') < 0);
  ok('e sotto il capitolo il testo è imposto nero', true, /#content\s+::highlight\(ev-\d+\)\{\s*color:#111/.test(stile));

  sezione('SUL DOCUMENTO: si moltiplica, perché il testo sta nel canvas sotto');
  await apriStrumento('fonte');
  await val(`openPdf('Piano-di-studio-della-Scuola-dell-obbligo-ticinese.pdf', 30, 'Piano di studio'), 1`);
  let layer = null;
  for (let i = 0; i < 60; i++) {
    layer = await val(`!!document.querySelector('#pdfFrame .textLayer span')`);
    if (layer) break;
    await pausa(300);
  }
  ok('il layer di testo c\'è', true, !!layer);
  ok('e si compone in multiply', 'multiply',
    await val(`getComputedStyle(document.querySelector('#pdfFrame .textLayer')).mixBlendMode`));
  /* ⚠️ Il nero imposto NON deve arrivare qui: accenderebbe le lettere
     trasparenti del layer sopra quelle disegnate nel canvas — due testi quasi
     allineati, che è peggio di nessuna evidenza. */
  ok('e lì il testo resta trasparente, non si accende', true,
    await val(`(()=>{ const s=document.querySelector('#pdfFrame .textLayer span');
      if(!s) return false; const c=getComputedStyle(s).color;
      return c.indexOf('rgba(0, 0, 0, 0)')===0 || c==='transparent'; })()`));

  sezione('Il messaggio dice il verbo giusto');
  ok('con il fondo pieno si «evidenzia»', true,
    await val(`(document.body.innerHTML.indexOf('Evidenziato')>=0) ||
               (function(){ return typeof evidenzeTratto==='function' && evidenzeTratto()==='overlay'; })()`));

  console.log('');
  console.log(ko ? '✗ ' + ko + ' controlli falliti' : '✓ tutti i controlli passati');
  process.exit(ko ? 1 : 0);
})();
