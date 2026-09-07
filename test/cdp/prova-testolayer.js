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
const { collega, val, invia, pausa, partiPulito, apriStrumento, pdfVisibile } = require(S);

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
  await pdfVisibile(PDF);
  await val(`openPdf(${JSON.stringify(PDF)}, ${PAGINA}, 'Piano di studio'), 1`);
  const pagine = await finoA('(PDFJS.doc && PDFJS.doc.numPages) || 0');
  ok('il documento è caricato', true, pagine > 0);

  /* ⚠️ Lo zoom è RICORDATO, e questa prova non lo sceglieva: si prendeva quello
     lasciato dalla prova precedente. Con una scala alta la pagina è più larga
     del riquadro, e allora nessuna riga sta dentro la finestra: da sola la prova
     era verde, dentro la suite no. Qui si dichiara `page-width`, perché la
     domanda è «il layer di testo è allineato ai glifi», non «con che zoom era
     rimasto». */
  await val(`(PDFJS.viewer.currentScaleValue='page-width'), 1`);
  await pausa(700);
  /* ⚠️ Cambiare la scala rifà il layout, e pdf.js smonta le pagine lontane da
     quella corrente: se non si torna alla 30 il suo layer non esiste più, e la
     prova accuserebbe il layer di un'assenza che ha causato lei. */
  await val(`(PDFJS.viewer.currentPageNumber=${PAGINA}), 1`);
  await pausa(500);

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
  /* Si prendono tre pezzi di testo sparsi per la pagina, si punta il MOUSE su un
     glifo di ciascuno e si fa doppio click. Il browser seleziona la parola che
     sta sotto il puntatore: se il layer fosse spostato rispetto ai glifi, la
     parola selezionata non sarebbe quella scritta nel pezzo.

     ⚠️ SOLO PEZZI DI UNA PAROLA SOLA, e il perché è un rosso pagato il 23 agosto
     2026. Il filtro accettava qualunque pezzo con quattro lettere di fila, e il
     punto in cui puntare era il CENTRO del rettangolo: su un pezzo come
     «situazione problema» il centro cade nello SPAZIO fra le due parole, e un
     doppio click sullo spazio non seleziona niente. La prova diceva KO con la
     selezione vuota — accusando l'allineamento del layer per una scelta sbagliata
     del bersaglio. Restava verde per fortuna, finché la fortuna teneva: bastava
     che il documento scorresse di trenta pixel perché il pezzo con lo spazio
     entrasse nella terna. Una parola sola non ha spazi in mezzo, e il centro del
     suo rettangolo è per forza un glifo. */
  const bersagli = await val(`(()=>{ const p=document.querySelector(${JSON.stringify(SEL_PAG)});
    const t=p.querySelector('.textLayer');
    const sp=[...t.querySelectorAll('span')].filter(s=>{
      const r=s.getBoundingClientRect();
      /* Solo pezzi VISIBILI nella finestra e larghi abbastanza da contenere una
         parola: puntare a un pezzo fuori dal riquadro manderebbe il click sul
         bordo del pannello, e il rosso accuserebbe il layer per colpa nostra. */
      return r.width>20 && r.height>4 && r.top>0 && r.bottom<innerHeight &&
             r.left>0 && r.right<innerWidth && /^[A-Za-zÀ-ÿ]{4,}$/.test(s.textContent.trim()); });
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
    /* ⚠️ QUANDO FALLISCE, SI DICE CHI C'ERA SOTTO IL PUNTATORE. Senza, il rosso
       accusa l'allineamento del layer e non si distingue da un click finito
       sopra un pannello, un toast o un righello lasciato acceso da un'altra
       prova — che è la famiglia di guasti già pagata qui tre volte. */
    if (!dentro) {
      const chi = await val(`(()=>{ const e=document.elementFromPoint(${b.x}, ${b.y});
        if(!e) return 'niente';
        const dentroA=[]; let n=e;
        while(n && n!==document.body){ dentroA.push(n.tagName.toLowerCase()+(n.id?('#'+n.id):'')+
          (n.className && typeof n.className==='string' ? ('.'+n.className.trim().split(/\s+/).join('.')) : '')); n=n.parentElement; }
        return dentroA.slice(0,4).join(' < '); })()`);
      console.log('      sotto il puntatore c\'era: ' + chi);
    }
    ok('la parola selezionata sta nel pezzo puntato — ' + JSON.stringify(scelto.trim().slice(0, 24)),
      true, dentro);
    if (!dentro) console.log('      il pezzo diceva: ' + JSON.stringify(b.testo.slice(0, 60)));
  }

  sezione('Il trascinamento seleziona un intervallo continuo');
  /* ⚠️ I doppi click qui sopra lasciano una selezione, e sulla selezione l'app
     apre il suo menu (Appunta · Mappa · Keyword · …) con la sua barra. Quel menu
     COPRE il testo — misurato: sotto il punto di partenza c'era un
     `button.ctx-item` — e il trascinamento premerebbe lì invece che sul layer.
     Si chiudono con le funzioni dell'app, non con un Esc a mano: `closePops()`
     NON basta, perché il menu della selezione non è nel suo elenco (la stessa
     forma del pittore che restava aperto, handoff del 15 agosto). */
  await val(`(typeof closePops === 'function') && closePops(),
             (typeof selMenuChiudi === 'function') && selMenuChiudi(),
             (typeof selBarraChiudi === 'function') && selBarraChiudi(),
             getSelection().removeAllRanges(), 1`);
  await pausa(250);
  /* ⚠️ La riga da trascinare dev'essere dentro la FINESTRA anche in orizzontale,
     e non solo in verticale. Questo controllo guardava `top` e `bottom` e non
     `left` e `right`: quando il riquadro della Fonte è più stretto della pagina
     — cioè quasi sempre, appena il banco ospita altri blocchi — la riga esce a
     destra, e il punto di arrivo del trascinamento cade FUORI dalla finestra
     (misurato: da x=1243 a x=1759, con la finestra larga 1320).
     Lì il browser non trova nessun carattere e porta il fuoco all'inizio del
     contenitore: la selezione diventa all'indietro, dalla PAGINA 1 — che nel DOM
     c'è ancora, sei span, il frontespizio — fino al punto di partenza. Di qui il
     rosso «a corse alterne» dal 15 agosto: dipendeva dalla larghezza del
     riquadro, cioè da quali prove avevano lasciato il banco com'era.
     ⚠️ Che il press fosse giusto era già misurabile («caret alla pagina 30,
     collassato»): il guasto era tutto nel punto di ARRIVO. Una prova che
     trascina fuori dalla finestra non misura il layer di testo, misura il
     comportamento di Chrome ai bordi. */
  const misuraRiga = `(()=>{ const p=document.querySelector(${JSON.stringify(SEL_PAG)});
    if(!p) return null; const t=p.querySelector('.textLayer'); if(!t) return null;
    const sp=[...t.querySelectorAll('span')].filter(s=>{ const r=s.getBoundingClientRect();
      return r.width>80 && r.top>0 && r.bottom<innerHeight &&
             r.left>0 && r.right<innerWidth && s.textContent.trim().length>20; });
    if(!sp.length) return null; const s=sp[Math.floor(sp.length/2)]; const r=s.getBoundingClientRect();
    /* Non due pixel dentro il rettangolo: quello è ancora il bordo dello span, e
       il calcolo del caret non ci trova nessun glifo. Un decimo dentro la riga
       un carattere c'è di sicuro. */
    const x1=Math.round(r.left+Math.max(6, r.width*0.1)), y=Math.round(r.top+r.height/2);
    const sotto=document.elementFromPoint(x1,y);
    const pag=sotto && sotto.closest ? sotto.closest('.page') : null;
    return { testo:s.textContent, x1, x2:Math.round(r.right-2), y,
             fermo: !!(pag && pag.getAttribute('data-page-number')==='${PAGINA}'),
             sopra: pag ? pag.getAttribute('data-page-number') : null,
             chiCopre: sotto ? (sotto.tagName.toLowerCase()+'.'+String(sotto.className||'')) : 'niente' }; })()`;
  /* ⚠️ PRIMA SI PORTA LA PAGINA DAVANTI AGLI OCCHI, e non si spera che ci sia.
     Il filtro qui sopra vuole una riga lunga INTERAMENTE dentro la finestra:
     quali righe lo siano dipende da dove si è fermato lo scorrimento, cioè da
     quanto è alta la barra dei comandi e da che cosa hanno lasciato le prove di
     prima. Il 23 agosto 2026, tolto il titolo dalla barra, il documento è salito
     di una riga (~35 px) e su questa pagina NESSUNA riga lunga restava dentro:
     `misuraRiga` tornava `null` e il rosso diceva «c'è una riga lunga da
     trascinare — no», accusando il layer di testo per una questione di
     scorrimento. Portare la pagina al centro rende la misura una MISURA e non
     una fortuna: se dopo questo non c'è una riga lunga, allora è un fatto. */
  await val(`(()=>{ const p=document.querySelector(${JSON.stringify(SEL_PAG)});
    if(p) p.scrollIntoView({block:'center', behavior:'instant'}); return 1; })()`);
  await pausa(400);
  let riga = await finoA(`(()=>{ const m=${misuraRiga}; return m && m.fermo ? m : null; })()`, 5000);
  if (!riga) {                      // non si è fermato: si dice quello che si è visto
    const ultima = await val(misuraRiga);
    console.log('   ⚠️ il punto non è sulla pagina ' + PAGINA + ': ' + JSON.stringify(ultima));
    riga = ultima;
  }
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
    /* Dove ANCORA la selezione, non solo che cosa restituisce: un range che
       parte da un'altra pagina è la firma del press che ha mancato il testo, e
       senza questo controllo si presenta travestito da «il testo non sta nella
       pagina 30». */
    const daPagina = await val(`(()=>{ const s=getSelection();
      if(!s.rangeCount) return null; const r=s.getRangeAt(0);
      const el = r.startContainer.nodeType===1 ? r.startContainer : r.startContainer.parentElement;
      const pag = el && el.closest ? el.closest('.page') : null;
      return pag ? pag.getAttribute('data-page-number') : null; })()`);
    ok('la selezione parte dalla pagina ' + PAGINA, String(PAGINA), String(daPagina));
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
    /* ⚠️ Quando questo controllo è rosso, «non sta nella pagina 30» non dice
       DOVE sta — e questo rosso compare a corse alterne dal 15 agosto, con
       sintomi diversi ogni volta (una corsa non seleziona niente, un'altra
       restituisce testo del frontespizio). Provata da sola, e anche subito dopo
       prova-confronto, la sequenza è verde: quello che manca per capirlo non è
       un altro tentativo, è la provenienza del testo preso. Perciò il rosso se
       la porta dietro. */
    if (nellaPagina !== true) {
      const dove = await val(`(()=>{ const s=getSelection();
        if(!s.rangeCount) return null; const r=s.getRangeAt(0);
        const el = r.startContainer.nodeType===1 ? r.startContainer : r.startContainer.parentElement;
        const pag = el && el.closest ? el.closest('.page') : null;
        return { daPagina: pag ? pag.getAttribute('data-page-number') : null,
                 dentroTextLayer: !!(el && el.closest && el.closest('.textLayer')),
                 inQualeRiquadro: el && el.closest && el.closest('#pdfPane2') ? 'confronto' : 'fonte',
                 viewerAllaPagina: PDFJS.viewer && PDFJS.viewer.currentPageNumber,
                 pagineVisibili: (PDFJS.viewer && PDFJS.viewer._getVisiblePages
                                  ? PDFJS.viewer._getVisiblePages().views.map(v=>v.id) : null) }; })()`);
      console.log('      il testo preso viene da: ' + JSON.stringify(dove));
    }
  }

  await val('getSelection().removeAllRanges(), 1');
  console.log('');
  console.log(ko ? '✗ ' + ko + ' controlli falliti' : '✓ tutti i controlli passati');
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('✗ ' + e.message); process.exit(1); });
