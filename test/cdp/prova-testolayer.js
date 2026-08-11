/* Il layer di TESTO del viewer: si seleziona, ed è allineato ai glifi?
 *
 * ⚠️ Perché esiste, e perché viene prima di tutto il resto della modalità ZAINO.
 * Là dentro non ci sarà nessun capitolo generato: la superficie di lettura è il
 * PDF, quindi evidenziatore, keyword e appunti si ancorano al testo che pdf.js
 * stende SOPRA la pagina disegnata. Finora di quel layer sapevamo solo che
 * esiste — l'handoff del 10 agosto lo elenca fra i «non provati». Se la
 * selezione col mouse non funziona, o restituisce il testo di un'altra riga,
 * metà degli strumenti dello zaino non è costruibile, ed è meglio saperlo prima
 * di disegnare una sidebar.
 *
 * Che cosa si misura, in ordine di gravità:
 *   1. il layer c'è e contiene testo;
 *   2. un doppio click del MOUSE VERO sul centro di un pezzo di testo seleziona
 *      la parola che sta lì sotto — è la prova dell'allineamento, perché una
 *      griglia di testo spostata rispetto ai glifi restituirebbe un'altra
 *      parola, o niente;
 *   3. un trascinamento seleziona un intervallo continuo, e quel testo si
 *      ritrova nella pagina davvero (confronto con getTextContent).
 *
 * ⚠️ La selezione si legge con `range.toString()`, mai con
 * `getSelection().toString()`: la seconda torna maiuscola quando il CSS lo
 * impone (misurato il 9 agosto).
 *
 *   ./test/cdp/con-vault-di-prova.sh prova-testolayer.js
 */
const S = require('path').join(__dirname, 'cdp.js');
const { collega, val, invia, pausa, partiPulito, apriStrumento } = require(S);

let ko = 0;
function ok(n, atteso, avuto) {
  const a = JSON.stringify(atteso), b = JSON.stringify(avuto);
  if (a === b) { console.log('  ok  ' + n); return; }
  ko++; console.log('  KO  ' + n + '\n      atteso ' + a + '\n      avuto  ' + b);
}
function sezione(t) { console.log('\n== ' + t); }

const PDF = 'Piano-di-studio-della-Scuola-dell-obbligo-ticinese.pdf';
const PAGINA = 30;

async function finoA(expr, quanto) {
  const fine = Date.now() + (quanto || 20000);
  for (;;) {
    const v = await val(expr);
    if (v) return v;
    if (Date.now() > fine) return null;
    await pausa(250);
  }
}

/** Un click del mouse vero, alle coordinate della finestra. */
async function clickXY(x, y, quanti) {
  for (const type of ['mousePressed', 'mouseReleased']) {
    await invia('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: quanti || 1 });
  }
}

(async () => {
  await collega();
  await val('location.reload(), 1'); await pausa(1800);
  await collega(); await pausa(600);
  await partiPulito();
  await apriStrumento('fonte');

  sezione('Il documento si apre alla pagina voluta');
  await val(`openPdf(${JSON.stringify(PDF)}, ${PAGINA}, 'Piano di studio'), 1`);
  const pagine = await finoA('(PDFJS.doc && PDFJS.doc.numPages) || 0');
  ok('il documento è caricato', true, pagine > 0);

  sezione('Il layer di testo esiste e contiene testo');
  /* ⚠️ Si aspetta il layer della pagina CORRENTE, non «un layer qualsiasi»:
     pdf.js monta anche le pagine vicine, e la prima montata potrebbe essere
     un'altra. Il bersaglio è la pagina che l'utente sta guardando. */
  const SEL_PAG = `#pdfFrame .page[data-page-number="${PAGINA}"]`;
  const pezzi = await finoA(`(()=>{ const p=document.querySelector(${JSON.stringify(SEL_PAG)});
    if(!p) return 0;
    const t=p.querySelector('.textLayer'); if(!t) return 0;
    return [...t.querySelectorAll('span')].filter(s=>s.textContent.trim().length>2).length; })()`, 25000);
  ok('ci sono pezzi di testo sopra la pagina', true, (pezzi || 0) > 0);
  console.log('   ' + pezzi + ' pezzi di testo con almeno 3 caratteri');

  /* La misura che conta davvero: il layer copre la pagina o è largo zero? Un
     layer collassato esiste nel DOM e non si può selezionare con il mouse. */
  const copertura = await val(`(()=>{ const p=document.querySelector(${JSON.stringify(SEL_PAG)});
    if(!p) return null; const t=p.querySelector('.textLayer'); if(!t) return null;
    const rp=p.getBoundingClientRect(), rt=t.getBoundingClientRect();
    return { pagina:[Math.round(rp.width),Math.round(rp.height)],
             layer:[Math.round(rt.width),Math.round(rt.height)],
             visibile: rt.width>0 && rt.height>0 }; })()`);
  console.log('   pagina ' + JSON.stringify(copertura.pagina) + ' · layer ' + JSON.stringify(copertura.layer));
  ok('il layer copre la pagina, non è collassato', true, !!copertura.visibile);
  ok('e ha le stesse misure della pagina disegnata (± 2 px)', true,
    Math.abs(copertura.pagina[0] - copertura.layer[0]) <= 2 &&
    Math.abs(copertura.pagina[1] - copertura.layer[1]) <= 2);

  sezione('L\'ALLINEAMENTO: doppio click sul glifo, esce la parola che sta lì');
  /* Si prendono tre pezzi di testo sparsi per la pagina, si punta il MOUSE al
     centro di ciascuno e si fa doppio click. Il browser seleziona la parola che
     sta sotto il puntatore: se il layer fosse spostato rispetto ai glifi, la
     parola selezionata non sarebbe quella scritta nel pezzo. */
  const bersagli = await val(`(()=>{ const p=document.querySelector(${JSON.stringify(SEL_PAG)});
    const t=p.querySelector('.textLayer');
    const sp=[...t.querySelectorAll('span')].filter(s=>{
      const r=s.getBoundingClientRect();
      /* Solo pezzi VISIBILI nella finestra e larghi abbastanza da contenere una
         parola: puntare a un pezzo fuori dal riquadro manderebbe il click sul
         bordo del pannello, e il rosso accuserebbe il layer per colpa nostra. */
      return r.width>20 && r.height>4 && r.top>0 && r.bottom<innerHeight &&
             r.left>0 && r.right<innerWidth && /[A-Za-zÀ-ÿ]{4,}/.test(s.textContent); });
    const passo=Math.max(1, Math.floor(sp.length/4));
    return sp.filter((_,i)=>i%passo===0).slice(0,3).map(s=>{ const r=s.getBoundingClientRect();
      return { testo:s.textContent, x:Math.round(r.left+r.width/2), y:Math.round(r.top+r.height/2) }; }); })()`);
  ok('ci sono bersagli su cui puntare', true, Array.isArray(bersagli) && bersagli.length > 0);

  for (const b of (bersagli || [])) {
    await val('getSelection().removeAllRanges(), 1');
    await clickXY(b.x, b.y, 1);
    await clickXY(b.x, b.y, 2);
    await pausa(150);
    /* ⚠️ `range.toString()`, non `getSelection().toString()`. */
    const scelto = await val(`(()=>{ const s=getSelection();
      if(!s.rangeCount || s.isCollapsed) return '';
      return s.getRangeAt(0).toString(); })()`);
    const dentro = !!scelto && b.testo.toLowerCase().indexOf(scelto.trim().toLowerCase()) >= 0;
    ok('la parola selezionata sta nel pezzo puntato — ' + JSON.stringify(scelto.trim().slice(0, 24)),
      true, dentro);
    if (!dentro) console.log('      il pezzo diceva: ' + JSON.stringify(b.testo.slice(0, 60)));
  }

  sezione('Il trascinamento seleziona un intervallo continuo');
  const riga = await val(`(()=>{ const p=document.querySelector(${JSON.stringify(SEL_PAG)});
    const t=p.querySelector('.textLayer');
    const sp=[...t.querySelectorAll('span')].filter(s=>{ const r=s.getBoundingClientRect();
      return r.width>80 && r.top>0 && r.bottom<innerHeight && s.textContent.trim().length>20; });
    if(!sp.length) return null; const s=sp[Math.floor(sp.length/2)]; const r=s.getBoundingClientRect();
    return { testo:s.textContent, x1:Math.round(r.left+2), x2:Math.round(r.right-2),
             y:Math.round(r.top+r.height/2) }; })()`);
  ok('c\'è una riga lunga da trascinare', true, !!riga);
  if (riga) {
    await val('getSelection().removeAllRanges(), 1');
    await invia('Input.dispatchMouseEvent', { type: 'mousePressed', x: riga.x1, y: riga.y, button: 'left', clickCount: 1 });
    await invia('Input.dispatchMouseEvent', { type: 'mouseMoved', x: Math.round((riga.x1 + riga.x2) / 2), y: riga.y, button: 'left', buttons: 1 });
    await invia('Input.dispatchMouseEvent', { type: 'mouseMoved', x: riga.x2, y: riga.y, button: 'left', buttons: 1 });
    await invia('Input.dispatchMouseEvent', { type: 'mouseReleased', x: riga.x2, y: riga.y, button: 'left', clickCount: 1 });
    await pausa(200);
    const preso = await val(`(()=>{ const s=getSelection();
      if(!s.rangeCount || s.isCollapsed) return '';
      return s.getRangeAt(0).toString(); })()`);
    console.log('   trascinato: ' + JSON.stringify(preso.slice(0, 70)));
    ok('il trascinamento seleziona qualcosa', true, preso.trim().length > 3);
    /* Il testo preso col mouse deve ritrovarsi nel testo VERO della pagina —
       quello che pdf.js estrae dal documento, non quello del DOM: è il
       confronto che smaschera un layer che mostra una pagina e ne selezziona
       un'altra. */
    const nellaPagina = await val(`(async ()=>{ const pg=await PDFJS.doc.getPage(${PAGINA});
      const tc=await pg.getTextContent();
      const testo=tc.items.map(i=>i.str).join(' ').replace(/\\s+/g,' ');
      const s=getSelection(); if(!s.rangeCount) return null;
      const preso=s.getRangeAt(0).toString().replace(/\\s+/g,' ').trim();
      if(!preso) return null;
      return testo.indexOf(preso.slice(0, 40)) >= 0; })()`);
    ok('e quel testo sta davvero nella pagina ' + PAGINA, true, nellaPagina === true);
  }

  await val('getSelection().removeAllRanges(), 1');
  console.log('');
  console.log(ko ? '✗ ' + ko + ' controlli falliti' : '✓ tutti i controlli passati');
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('✗ ' + e.message); process.exit(1); });
