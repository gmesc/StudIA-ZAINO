/* Il contenuto che torna, e il doppio click che ingrandisce.
 *
 * ⚠️ Che cosa questa prova difende davvero. Due patti nuovi del banco:
 *
 * 1) «L'app riapre come l'hai lasciata» vale anche per il CONTENUTO, e a ogni
 *    cambio di contenitore: la fonte aperta in uno zaino torna quando ci si
 *    rientra — da un corso, da un altro zaino, o riavviando — alla pagina in
 *    cui era. E nel contenitore nuovo il documento di quello vecchio NON resta
 *    a schermo (prima ci restava: era il documento di un altro zaino).
 *
 * 2) Il doppio click sulla testata porta il blocco a tutto banco, e lo stesso
 *    gesto riporta ESATTAMENTE alla disposizione di prima — anche dopo un
 *    riavvio, perché la memoria del ritorno è persistente. La tendina è
 *    esclusa dal gesto, e scegliere una forma dal pannello invalida il ritorno.
 *
 *   ./test/cdp/con-vault-di-prova.sh prova-banco-contenuto.js
 */
const path = require('path');
const fs = require('fs');
const S = path.join(__dirname, 'cdp.js');
const { collega, invia, val, clicca, pausa, partiPulito } = require(S);

let ko = 0;
function ok(n, atteso, avuto) {
  const a = JSON.stringify(atteso), b = JSON.stringify(avuto);
  if (a === b) { console.log('  ok  ' + n); return; }
  ko++; console.log('  KO  ' + n + '\n      atteso ' + a + '\n      avuto  ' + b);
}
function sezione(t) { console.log('\n== ' + t); }

async function finoA(expr, quanto) {
  const fine = Date.now() + (quanto || 12000);
  for (;;) {
    let v = null;
    try { v = await val(expr); } catch (e) { /* durante un reload l'app non risponde */ }
    if (v) return v;
    if (Date.now() > fine) return null;
    await pausa(200);
  }
}

/** Doppio click VERO: due pressioni dalla porta del mouse, la seconda col
 *  `clickCount` a 2 — com'è un doppio click per Chromium. Un `dblclick`
 *  sintetico sull'elemento salterebbe il rilevamento del bersaglio. */
async function doppioClick(x, y) {
  for (const c of [1, 2]) {
    await invia('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: c });
    await invia('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: c });
  }
}

/** Un punto della TESTATA fuori dalla tendina: il bordo sinistro della barra.
 *  Il centro è la tendina stessa, che dal gesto è esclusa apposta. */
const ANGOLO_TESTATA = (b) => `(()=>{ const h=document.querySelector('.blocco[data-blocco="${b}"] .bhead');
  if(!h) return null; const r=h.getBoundingClientRect();
  if(!r.width||!r.height) return null;
  return { x:Math.round(r.left+10), y:Math.round(r.top+r.height/2) }; })()`;

const ZAINO = 'contenuto-di-prova';

(async () => {
  await collega();
  await partiPulito();

  sezione('Uno zaino con un documento dentro, aperto a pagina 2');
  await val(`(async()=>{ if(modoAttivo()!=='zaino') await cambiaModo('zaino');
    if(zainoAttivo()!=='${ZAINO}') await zainoCrea('Contenuto di prova'); return 1; })()`);
  await finoA(`zainoAttivo()==='${ZAINO}' ? 1 : 0`, 10000);
  const vault = await val('window.vault.path');
  const dirZaino = path.join(vault, 'Zaini', ZAINO);
  const corpusGlobale = path.join(vault, 'Fonti');
  const unPdf = fs.readdirSync(corpusGlobale).filter((f) => f.toLowerCase().endsWith('.pdf'))[0];
  ok('c\'è un PDF da mettere nello zaino', true, !!unPdf);
  fs.copyFileSync(path.join(corpusGlobale, unPdf), path.join(dirZaino, 'MATERIALI', 'PDF', unPdf));
  await val('(async()=>{ try{ await fontiIndiciCarica(); }catch(e){} await zainoNavAggiorna(); return 1; })()');
  await finoA(`document.querySelectorAll('#zainoNav .zn-fonte').length ? 1 : 0`, 10000);
  await pausa(300);                       // la sidebar si è appena riscritta: si aspetta che stia ferma
  await clicca('#zainoNav .zn-fonte');
  const aperto = await finoA(`(typeof PDFJS!=='undefined' && PDFJS.doc && ANTEPRIMA.file) ? 1 : 0`, 15000);
  ok('il documento si apre davvero', 1, aperto);
  await clicca('#pdfNext');
  const aPag2 = await finoA(`ANTEPRIMA.page===2 ? 1 : 0`, 6000);
  ok('e si sfoglia a pagina 2', 1, aPag2);
  await val('letturaFlush()');
  const segnato = await val(`(apertoLeggi()['${ZAINO}']||{}).fonte||''`);
  ok('il segno di ciò che è aperto è scritto', unPdf, segnato);

  sezione('Nel corso il documento dello zaino NON resta a schermo');
  await val(`(async()=>{ await cambiaModo('corso'); return 1; })()`);
  await pausa(600);
  ok('nessuna anteprima nel corso', '', await val('ANTEPRIMA.file||\'\''));
  /* Il riquadro parla solo se sta sul banco: nella disposizione dei corsi le
     Fonti possono essere in magazzino, e un magazzino non ha larghezza. Si
     porta lo strumento a schermo — la porta vera — e POI si guarda il vuoto. */
  ok('e il riquadro delle fonti, portato sul banco, dice il vuoto', true,
    await val(`(()=>{ try{ bancoMostra('fonte'); }catch(e){}
      const v=document.getElementById('pdfVuoto');
      return !!v && v.getBoundingClientRect().width>0; })()`));

  sezione('Tornando allo zaino il documento riapre da sé, alla sua pagina');
  await val(`(async()=>{ await cambiaModo('zaino'); return 1; })()`);
  const riaperto = await finoA(`(ANTEPRIMA.file===${JSON.stringify(unPdf)} && ANTEPRIMA.page===2) ? 1 : 0`, 15000);
  ok('stesso documento, stessa pagina', 1, riaperto);

  sezione('Fra due zaini: ognuno riapre il SUO contenuto');
  await val(`(async()=>{ await zainoCrea('Vuoto di prova'); return 1; })()`);
  await finoA(`zainoAttivo()==='vuoto-di-prova' ? 1 : 0`, 10000);
  await pausa(400);
  ok('nello zaino vuoto niente anteprima', '', await val('ANTEPRIMA.file||\'\''));
  await val(`(()=>{ cambiaZaino('${ZAINO}'); return 1; })()`);
  const diNuovo = await finoA(`(ANTEPRIMA.file===${JSON.stringify(unPdf)} && ANTEPRIMA.page===2) ? 1 : 0`, 15000);
  ok('rientrando, il documento torna con la pagina', 1, diNuovo);

  sezione('Il riavvio riporta disposizione E contenuto');
  try { await val(`(setTimeout(()=>location.reload(),80),1)`); } catch (e) {}
  await pausa(2500);
  await collega();
  const boot = await finoA(`(typeof bancoStato==='function' && document.documentElement.dataset.modo==='zaino') ? 1 : 0`, 20000);
  ok('si riapre nello zaino', 1, boot);
  const bootDoc = await finoA(`(typeof ANTEPRIMA!=='undefined' && ANTEPRIMA.file===${JSON.stringify(unPdf)} && ANTEPRIMA.page===2) ? 1 : 0`, 20000);
  ok('col documento di ieri, alla pagina di ieri', 1, bootDoc);

  sezione('Doppio click sulla testata: a tutto banco…');
  await partiPulito();
  await val(`(()=>{ bancoForma('quattro'); return 1; })()`);
  await pausa(400);
  const primaDiZoom = await val(`bancoStato().forma`);
  ok('si parte da quattro blocchi', 'quattro', primaDiZoom);
  const bloccoAppunti = await val(`bancoBloccoDi('appunti')`);
  ok('gli appunti hanno un blocco', true, !!bloccoAppunti);
  const p1 = await val(ANGOLO_TESTATA(bloccoAppunti));
  ok('la sua testata è a schermo', true, !!p1);
  await doppioClick(p1.x, p1.y);
  const ingrandito = await finoA(`(bancoStato().forma==='uno' && bancoStrumentoIn('A')==='appunti') ? 1 : 0`, 6000);
  ok('un blocco solo, con lo strumento del blocco premuto', 1, ingrandito);

  sezione('…e lo stesso gesto riporta ESATTAMENTE dov\'eri');
  const p2 = await val(ANGOLO_TESTATA('A'));
  await doppioClick(p2.x, p2.y);
  const tornato = await finoA(`(()=>{ const s=bancoStato();
    return (s.forma==='quattro' && bancoStrumentoIn('${bloccoAppunti}')==='appunti') ? 1 : 0; })()`, 6000);
  ok('forma e strumenti di prima', 1, tornato);
  ok('e la memoria del ritorno si è consumata', null,
    await val(`(()=>{ try{ return JSON.parse(localStorage.getItem(bancoZoomChiave())); }catch(e){ return 'illeggibile'; } })()`));

  sezione('La tendina è esclusa dal gesto');
  const pT = await val(`(()=>{ const t=document.querySelector('.blocco[data-blocco="A"] .bhead .tendina');
    if(!t) return null; const r=t.getBoundingClientRect();
    return { x:Math.round(r.left+r.width/2), y:Math.round(r.top+r.height/2) }; })()`);
  ok('la tendina di A è a schermo', true, !!pT);
  await doppioClick(pT.x, pT.y);
  await pausa(500);
  ok('doppio click sulla tendina: la forma non si muove', 'quattro', await val(`bancoStato().forma`));
  await val('closePops()');

  sezione('Scegliere una forma dal pannello invalida il ritorno');
  const pA = await val(ANGOLO_TESTATA(bloccoAppunti));
  await doppioClick(pA.x, pA.y);
  await finoA(`bancoStato().forma==='uno' ? 1 : 0`, 6000);
  await val(`(()=>{ bancoForma('due-col'); return 1; })()`);
  ok('il pannello ha parlato: niente memoria di ritorno', null,
    await val(`(()=>{ try{ return JSON.parse(localStorage.getItem(bancoZoomChiave())); }catch(e){ return 'illeggibile'; } })()`));

  /* Si lascia l'app in ordine per la prova successiva. */
  await val(`(()=>{ try{ closePdf(); }catch(e){} return 1; })()`);
  await val(`(async()=>{ await cambiaModo('corso'); return 1; })()`);

  console.log(ko ? `\n✗ ${ko} controlli falliti` : '\n✓ tutti i controlli passati');
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error('prova-banco-contenuto: ' + (e && e.message)); process.exit(1); });
