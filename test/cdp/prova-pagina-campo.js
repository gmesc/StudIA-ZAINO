/* «Aprite a pagina 142», sull'app viva: il CABLAGGIO.
 *
 * ⚠️ Che cosa NON si prova qui. Che cosa vuol dire quello che si scrive — «p.
 * 142», «iii», «142a», il campo vuoto, il numero più grande del documento — lo
 * decide `App/assets/fonti/pagina.js` e lo controlla `node
 * test/pagina-fonte.js`, in quaranta millisecondi. Duplicare quei casi qui
 * vorrebbe dire pagarli quaranta secondi l'uno e tenerne due copie che possono
 * discordare.
 *
 * Qui resta quello che solo l'app viva può dire: il contatore si apre davvero
 * come campo, quello che si scrive arriva alla pagina, Esc rinuncia SENZA
 * portarsi via altro, e — il controllo che vale il file — **la barra non si
 * muove** quando il contatore diventa campo. Un comando che salta di riga
 * nell'istante in cui uno sta per premerlo è peggio di un comando che non c'è.
 *
 *   ./test/cdp/con-vault-di-prova.sh prova-pagina-campo.js
 */
const S = require('path').join(__dirname, 'cdp.js');
const { collega, val, invia, pausa, partiPulito, apriStrumento, clicca } = require(S);

let ko = 0;
function ok(n, atteso, avuto) {
  const a = JSON.stringify(atteso), b = JSON.stringify(avuto);
  if (a === b) { console.log('  ok  ' + n); return; }
  ko++; console.log('  KO  ' + n + '\n      atteso ' + a + '\n      avuto  ' + b);
}
function sezione(t) { console.log('\n== ' + t); }

const PDF = 'Piano-di-studio-della-Scuola-dell-obbligo-ticinese.pdf';

async function finoA(expr, quanto) {
  const fine = Date.now() + (quanto || 20000);
  for (;;) {
    const v = await val(expr);
    if (v) return v;
    if (Date.now() > fine) return null;
    await pausa(250);
  }
}
async function tasto(key, vk) {
  await invia('Input.dispatchKeyEvent', { type: 'rawKeyDown', key, code: key, windowsVirtualKeyCode: vk });
  await invia('Input.dispatchKeyEvent', { type: 'keyUp', key, code: key, windowsVirtualKeyCode: vk });
  await pausa(300);
}
/* La misura della barra: quanti «piani» ha, dai CENTRI verticali dei figli —
   con `align-items:center` due elementi di altezze diverse hanno `top` diversi
   anche sulla stessa riga. */
const BARRA = `(()=>{ const b=document.querySelector('#pdfPane .tbar.pdfbar');
  const vis=Array.from(b.children).filter(c=>c.getBoundingClientRect().width>0);
  const c=vis.map(x=>{const r=x.getBoundingClientRect();return r.top+r.height/2;});
  const piani=c.reduce((a,y)=>a.some(v=>Math.abs(v-y)<6)?a:a.concat(y),[]);
  return { righe:piani.length, altezza:Math.round(b.getBoundingClientRect().height) }; })()`;

(async () => {
  await collega();
  await partiPulito();
  await apriStrumento('fonte');
  await val(`openPdf(${JSON.stringify(PDF)}, 5, 'Piano di studio'), 1`);
  await finoA('!!PDFJS.doc');
  await pausa(400);

  sezione('Il contatore è un comando');
  ok('dice dove si è', 'p. 5 di 266', await val("document.getElementById('pdfPagN').textContent"));
  ok('ed è un bottone, non un\'insegna', 'BUTTON', await val("document.getElementById('pdfPagN').tagName"));
  ok('e il suo suggerimento dice che si può scrivere', true,
    await val("/scrivi il numero/.test(document.getElementById('pdfPagN').title)"));

  sezione('⭐ Aprendolo, la barra non si muove');
  /* ⚠️ Il controllo che vale il file. Il campo deve essere largo quanto il
     contatore che sostituisce: se fosse anche solo di dieci pixel diverso, su
     una barra che va a capo un comando potrebbe scendere di riga nell'istante in
     cui uno sta per premerlo. */
  const prima = await val(BARRA);
  await clicca('#pdfPagN'); await pausa(300);
  const dopo = await val(BARRA);
  ok('il campo ha preso il posto del contatore', [true, false],
    await val(`[!document.getElementById('pdfPagIn').hidden, !document.getElementById('pdfPagN').hidden]`));
  ok('la barra ha le stesse righe di prima', prima.righe, dopo.righe);
  ok('e la stessa altezza', prima.altezza, dopo.altezza);
  console.log('   barra: ' + JSON.stringify(prima) + ' → ' + JSON.stringify(dopo));
  ok('il cursore è nel campo', 'pdfPagIn', await val('document.activeElement.id'));
  ok('e dentro c\'è la pagina di adesso, già selezionata', '5',
    await val("document.getElementById('pdfPagIn').value"));

  sezione('Quello che si scrive arriva alla pagina');
  await val("(()=>{const i=document.getElementById('pdfPagIn'); i.value='142'; return 1;})()");
  await tasto('Enter', 13);
  await finoA('ANTEPRIMA.page===142', 8000);
  ok('scrivendo 142 si va a pagina 142', 142, await val('ANTEPRIMA.page'));
  ok('e il campo si richiude da sé', true, await val("document.getElementById('pdfPagIn').hidden"));
  ok('col contatore che dice il vero', 'p. 142 di 266',
    await val("document.getElementById('pdfPagN').textContent"));

  sezione('Un numero che non si capisce non muove niente');
  await clicca('#pdfPagN'); await pausa(300);
  await val("(()=>{const i=document.getElementById('pdfPagIn'); i.value='pinco'; return 1;})()");
  await tasto('Enter', 13);
  ok('la pagina resta dov\'era', 142, await val('ANTEPRIMA.page'));
  /* ⚠️ E il campo RESTA APERTO: chi ha battuto male deve poter correggere senza
     riaprire. Chiuderlo sarebbe punire un errore di battitura. */
  ok('e il campo resta aperto per correggere', false,
    await val("document.getElementById('pdfPagIn').hidden"));

  sezione('Esc rinuncia, e SOLO a questo');
  await tasto('Escape', 27);
  ok('il campo si chiude', true, await val("document.getElementById('pdfPagIn').hidden"));
  ok('il contatore torna', false, await val("document.getElementById('pdfPagN').hidden"));
  /* ⚠️ Il documento resta aperto: dal 23 agosto Esc non lo chiude più, ma qui
     conta anche che l'Esc del campo non SCENDA la catena a spegnere altro. */
  ok('e il documento è ancora lì', true,
    await val("!!PDFJS.doc && document.documentElement.dataset.pdf==='1'"));
  ok('la pagina non è cambiata', 142, await val('ANTEPRIMA.page'));

  sezione('Il sommario del documento, se ce l\'ha');
  await clicca('#pdfPagN'); await pausa(600);
  const som = await val(`(()=>{ const p=document.getElementById('pdfSommarioPop');
    return { aperto:p.hasAttribute('open'), voci:p.querySelectorAll('.so-voce').length,
             quante:(PDFPAG.sommario||[]).length }; })()`);
  console.log('   sommario: ' + JSON.stringify(som));
  if (som.quante > 0) {
    ok('il pannellino si apre col sommario dentro', true, som.aperto && som.voci === som.quante);
    const pagPrima = await val('ANTEPRIMA.page');
    await clicca('#pdfSommarioPop .so-voce'); await pausa(1500);
    ok('e una voce porta a una pagina', true, (await val('ANTEPRIMA.page')) !== pagPrima);
  } else {
    /* Un documento senza sommario non deve mostrare un pannellino vuoto: un
       menu senza voci è una promessa che non mantiene. */
    ok('senza sommario nel file, nessun pannellino vuoto', false, som.aperto);
    console.log('   (questo PDF non porta un sommario: il caso «con sommario» resta da provare');
    console.log('    su un file che ce l\'ha — la costruzione dell\'elenco è provata in Node)');
  }

  await val("(()=>{ try{ pagCampoChiudi(); }catch(e){} return 1; })()");
  console.log(ko ? `\n✗ ${ko} controlli falliti` : `\n✓ tutti i controlli passati`);
  process.exit(ko ? 1 : 0);
})();
