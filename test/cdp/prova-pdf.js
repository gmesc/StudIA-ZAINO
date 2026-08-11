/* Il viewer pdf.js nell'app vera: i PIXEL, non il caricamento.
 *
 * ⚠️ Perché questa prova esiste. Il viewer era stato misurato con l'anteprima
 * NASCOSTA: si sapeva che il documento si apriva (248 ms, 29 pezzi di testo
 * estratti) ma non che disegnasse. In un contenitore senza `offsetParent`
 * `requestAnimationFrame` non gira: pdf.js decide che cosa disegnare dalle
 * pagine visibili, quindi «il documento è aperto» e «la pagina è a schermo» sono
 * due fatti diversi, e il secondo non era mai stato verificato.
 *
 * Qui si guarda la tela: quanti pixel non sono bianchi. È l'unica domanda a cui
 * `getDocument().promise` non risponde.
 *
 *   ./test/cdp/con-vault-di-prova.sh prova-pdf.js
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

/* Aspetta che una condizione nella pagina diventi vera, invece di dormire un
   numero inventato di millisecondi: un `sleep` fisso o mente sulle macchine
   lente o spreca tempo su quelle veloci. */
async function finoA(expr, quanto) {
  const fine = Date.now() + (quanto || 20000);
  for (;;) {
    const v = await val(expr);
    if (v) return v;
    if (Date.now() > fine) return null;
    await pausa(250);
  }
}

(async () => {
  await collega();
  await val('location.reload(), 1'); await pausa(1800);
  await collega(); await pausa(600);
  await partiPulito();
  await apriStrumento('fonte');

  sezione('Il documento si apre');
  const avvio = Date.now();
  await val(`openPdf(${JSON.stringify(PDF)}, 3, 'Piano di studio'), 1`);
  const doc = await finoA('(PDFJS.doc && PDFJS.doc.numPages) || 0');
  ok('il documento è caricato', true, doc > 0);
  console.log('   ' + doc + ' pagine');
  console.log('   aperto in ' + (Date.now() - avvio) + ' ms');
  ok('il viewer è quello vero, non un iframe', [true, null],
    await val("[!!(PDFJS.viewer), document.querySelector('#pdfPane iframe')]"));

  sezione('I PIXEL: la pagina è davvero disegnata');
  /* La tela di pdf.js è un `<canvas>` per pagina. Che esista e abbia una
     dimensione non basta — un canvas vuoto ha le stesse misure di uno pieno.
     Si contano i pixel non bianchi su una griglia campionata: se sono zero, la
     pagina è bianca, cioè non disegnata. */
  const MISURA = `(()=>{
    /* ⚠️ Si misurano TUTTE le tele, non la prima. pdf.js monta le pagine vicine
       a quella corrente, e quelle fuori vista restano legittimamente bianche:
       campionando solo canvas[0] si accuserebbe il viewer per una pagina che
       nessuno sta guardando. La domanda è «ce n'è ALMENO UNA disegnata». */
    const cs=[...document.querySelectorAll('#pdfFrame canvas')];
    if(!cs.length) return { tele:0, dettaglio:[] };
    const dettaglio=cs.map((c,idx)=>{
      const w=c.width, h=c.height;
      const pv=c.closest('.page');
      const pag=pv ? (pv.getAttribute('data-page-number')||'?') : '?';
      if(!w || !h) return { i:idx, pag:pag, w:w, h:h, inchiostro:0, letti:0 };
      let inchiostro=0, letti=0;
      try{
        const g=c.getContext('2d');
        const passo=Math.max(1, Math.floor(Math.min(w,h)/60));
        for(let y=0;y<h;y+=passo){
          const riga=g.getImageData(0,y,w,1).data;
          for(let x=0;x<w;x+=passo){
            const i=x*4; letti++;
            if(riga[i+3]>10 && (riga[i]<245 || riga[i+1]<245 || riga[i+2]<245)) inchiostro++;
          }
        }
      }catch(e){ return { i:idx, pag:pag, w:w, h:h, errore:String(e.message||e) }; }
      return { i:idx, pag:pag, w:w, h:h, letti:letti, inchiostro:inchiostro };
    });
    const migliore=dettaglio.reduce((a,b)=>((b.inchiostro||0)>(a.inchiostro||0)?b:a), dettaglio[0]);
    return { tele:cs.length, dettaglio:dettaglio, inchiostro:migliore.inchiostro||0,
             w:migliore.w, h:migliore.h, letti:migliore.letti,
             quota:migliore.letti?Math.round(migliore.inchiostro/migliore.letti*1000)/10:0 };
  })()`;
  const pix = await finoA(`(()=>{ const r=${MISURA}; return (r.inchiostro>0) ? r : null; })()`);
  if (!pix) {
    const grezzo = await val(MISURA);
    ok('almeno una pagina ha dell\'inchiostro', true, false);
    console.log('      tele: ' + grezzo.tele);
    (grezzo.dettaglio || []).forEach(function (d) { console.log('      ' + JSON.stringify(d)); });
  } else {
    ok('almeno una pagina ha dell\'inchiostro', true, pix.inchiostro > 0);
    console.log('   tela ' + pix.w + '×' + pix.h + ' px · ' + pix.inchiostro + '/' + pix.letti +
      ' campioni scritti (' + pix.quota + '%) · ' + pix.tele + ' pagine montate');
    (pix.dettaglio || []).forEach(function (d) { console.log('      p.' + d.pag + ' → ' + (d.inchiostro || 0) + ' campioni'); });
  }

  sezione('Il testo si può selezionare (metà del motivo di tutto questo lavoro)');
  const testo = await val(`(()=>{ const s=[...document.querySelectorAll('#pdfFrame .textLayer span')];
    return { pezzi:s.length, primi:s.slice(0,3).map(x=>x.textContent.trim()).filter(Boolean) }; })()`);
  ok('il layer di testo c\'è', true, testo.pezzi > 0);
  console.log('   ' + testo.pezzi + ' pezzi · ' + JSON.stringify(testo.primi));

  sezione('La direzione della pagina è invertita: la dice il viewer');
  ok('si è aperto alla pagina chiesta', 3, await val('ANTEPRIMA.page'));
  /* Sfogliare NON deve ricaricare il documento: prima ogni cambio di pagina
     ricostruiva l'iframe, e su ottanta pagine erano ottanta ricaricamenti. Il
     documento in memoria deve restare lo STESSO oggetto. */
  const prima = await val('PDFJS.seq');
  await val('vaiAPagina(5), 1');
  await finoA('ANTEPRIMA.page===5', 8000);
  ok('cambiando pagina si arriva alla 5', 5, await val('ANTEPRIMA.page'));
  ok('e il documento non è stato ricaricato', prima, await val('PDFJS.seq'));
  ok('il viewer e l\'app dicono la stessa pagina', true,
    await val('PDFJS.viewer.currentPageNumber===ANTEPRIMA.page'));

  sezione('Il CSS di pdf.js resta nel suo riquadro');
  /* Il foglio del viewer ha una sua `.sidebar` e 46 variabili in `:root`:
     incapsulato male, riscriverebbe l'indice dei capitoli dell'app. */
  const side = await val(`(()=>{ const t=document.querySelector('#toc') || document.querySelector('aside');
    if(!t) return null; const s=getComputedStyle(t);
    return { larghezza:Math.round(t.getBoundingClientRect().width), posizione:s.position }; })()`);
  console.log('   sidebar dell\'app: ' + JSON.stringify(side));
  ok('la sidebar dell\'app non è stata riscritta da pdf.js', true,
    !!side && side.larghezza > 180 && side.posizione !== 'relative');

  sezione('Riaprire lo stesso documento non lo ricarica');
  const seqPrima = await val('PDFJS.seq');
  await val(`openPdf(${JSON.stringify(PDF)}, 2, 'Piano di studio'), 1`);
  await finoA('ANTEPRIMA.page===2', 8000);
  ok('ci si sposta e basta', seqPrima, await val('PDFJS.seq'));
  ok('e la pagina è la 2', 2, await val('ANTEPRIMA.page'));

  sezione('Lo zoom: la percentuale è quella VERA del viewer');
  await val("pdfFindChiudi(), 1");
  const z0 = await val('({ scala:PDFJS.viewer.currentScale, valore:PDFJS.viewer.currentScaleValue, etichetta:document.getElementById("pdfZoomLvl").textContent })');
  console.log('   partenza: ' + JSON.stringify(z0));
  ok('la barra dello zoom è visibile con un documento aperto', false,
    await val("document.getElementById('pdfZoom').hidden"));
  ok('l\'etichetta è la scala del viewer, non un contatore nostro',
    Math.round(z0.scala * 100) + '%', z0.etichetta);

  /* ⚠️ La tela PRIMA, non un numero scritto a mano. La prima versione di questa
     prova pretendeva «più di 850 px», che era la larghezza del riquadro in quella
     corsa: girando in coda alle altre prove il banco è disposto diversamente, la
     pagina parte più piccola, e il rosso accusava lo zoom per una misura assoluta
     che non voleva dire niente. */
  /* ⚠️ La tela della pagina CORRENTE, non la prima del DOM. pdf.js ridisegna
     solo le pagine visibili: quella fuori vista conserva la sua tela alla scala
     di prima, e misurando `canvas[0]` — che è la pagina 1 — lo zoom sembrava non
     fare niente. `getPageView` prende un indice a base zero. */
  const TELA = "(()=>{ const v=PDFJS.viewer; if(!v) return 0;" +
    " const pv=v.getPageView(Math.max(0,(v.currentPageNumber||1)-1));" +
    " return (pv && pv.canvas) ? pv.canvas.width : 0; })()";
  /* ⚠️ Si misura quando la tela è FERMA. pdf.js ridisegna in modo asincrono, e
     leggere la larghezza mentre un ridisegno è in volo dà un numero di
     passaggio: questa prova è già stata rossa una volta per questo, cioè per
     colpa dello strumento e non del viewer. Due letture uguali di fila = quiete. */
  async function telaFerma(){
    var a=await val(TELA);
    for(var i=0;i<40;i++){
      await pausa(250);
      var b=await val(TELA);
      if(b && b===a) return b;
      a=b;
    }
    return a;
  }
  const telaPrima = await telaFerma();
  await val('pdfZoomPasso(true), 1'); await pausa(500);
  const zIn = await val('({ scala:PDFJS.viewer.currentScale, etichetta:document.getElementById("pdfZoomLvl").textContent })');
  ok('ingrandire aumenta la scala vera', true, zIn.scala > z0.scala);
  ok('e l\'etichetta lo segue', Math.round(zIn.scala * 100) + '%', zIn.etichetta);

  /* ⚠️ Il controllo che conta più degli altri: la tela deve ESSERE più grande.
     Una scala che cambia senza che i pixel cambino è uno zoom che non zooma. */
  const telaLarga = await finoA('(' + TELA + ' > ' + telaPrima + ') ? ' + TELA + ' : null', 20000) || await telaFerma();
  console.log('   tela: ' + telaPrima + ' px → ' + telaLarga + ' px');
  ok('la tela è stata ridisegnata più grande', true, telaLarga > telaPrima);

  await val('pdfZoomPasso(false), 1'); await pausa(400);
  ok('ridurre riporta indietro', true,
    (await val('PDFJS.viewer.currentScale')) < zIn.scala);

  await val("PDFJS.viewer.currentScaleValue='page-width', pdfZoomAggiorna(), 1"); await pausa(300);
  await val('pdfZoomAdatta(), 1'); await pausa(400);
  ok('il click sul numero alterna larghezza e pagina intera', 'page-fit',
    await val('PDFJS.viewer.currentScaleValue'));
  ok('e lo zoom si ricorda su disco', 'page-fit',
    await val("localStorage.getItem('studia.pdf.zoom')"));

  sezione('La ricerca dentro il documento');
  ok('il bottone della ricerca c\'è', false, await val("document.getElementById('pdfFindBtn').hidden"));
  await val('pdfFindApri(), 1'); await pausa(300);
  ok('il pannellino si apre', true, await val("document.getElementById('pdfFindPop').hasAttribute('open')"));
  ok('e il fuoco è nel campo', 'pdfFindInput', await val('document.activeElement.id'));

  await val("document.getElementById('pdfFindInput').value='scuola', pdfFindDispatch('',false), 1");
  const conto = await finoA(`(()=>{ const t=document.getElementById('pdfFindCount').textContent;
    return /\\d+ di \\d+/.test(t) ? t : null; })()`, 25000);
  ok('trova le occorrenze e le conta', true, !!conto);
  console.log('   conto: ' + conto);
  ok('e le evidenzia sulla pagina', true,
    (await val("document.querySelectorAll('#pdfFrame .textLayer .highlight').length")) > 0);

  const primo = await val("document.getElementById('pdfFindCount').textContent");
  await val("pdfFindDispatch('again', false), 1");
  const dopo = await finoA('(()=>{ const t=document.getElementById("pdfFindCount").textContent;' +
    ' return (t && t!==' + JSON.stringify(primo) + ') ? t : null; })()', 10000);
  ok('il risultato successivo cambia il conto', true, !!dopo && dopo !== primo);
  console.log('   ' + primo + ' → ' + dopo);

  await val("document.getElementById('pdfFindInput').value='qwertyzzz', pdfFindDispatch('',false), 1");
  const nulla = await finoA(`(()=>{ const e=document.getElementById('pdfFindCount');
    return /nessun risultato/.test(e.textContent) ? '1' : null; })()`, 20000);
  ok('e una parola che non c\'è lo dice', true, !!nulla);

  sezione('Esc chiude una cosa per volta');
  await val('pdfFindApri(), 1'); await pausa(250);
  await invia('Input.dispatchKeyEvent', { type:'keyDown', key:'Escape', code:'Escape', windowsVirtualKeyCode:27 });
  await invia('Input.dispatchKeyEvent', { type:'keyUp', key:'Escape', code:'Escape', windowsVirtualKeyCode:27 });
  await pausa(400);
  ok('Esc chiude la ricerca…', false, await val("document.getElementById('pdfFindPop').hasAttribute('open')"));
  ok('…e lascia il documento aperto', true, await val("!!PDFJS.doc && document.documentElement.dataset.pdf==='1'"));

  sezione('I guasti che la verifica ostile ha trovato, e che non devono tornare');

  /* ⚠️ La via di chiusura più naturale — un click sulla pagina per tornare a
     leggere — passava da `closePops()`, che toglieva l'attributo e basta: le
     evidenziazioni restavano accese e nessun comando visibile le spegneva. */
  await val(`openPdf(${JSON.stringify(PDF)}, 3, 'Piano di studio'), 1`);
  await finoA('!!PDFJS.doc', 15000);
  await val('pdfFindApri(), 1'); await pausa(200);
  await val("document.getElementById('pdfFindInput').value='scuola', pdfFindDispatch('again',false), 1");
  await finoA("document.querySelectorAll('#pdfFrame .textLayer .highlight').length>0", 25000);
  await val('closePops(), 1'); await pausa(600);
  ok('chiudendo col click fuori le evidenziazioni si spengono', 0,
    await val("document.querySelectorAll('#pdfFrame .textLayer .highlight').length"));

  /* Il colpo in canna del debounce partiva DOPO la chiusura e riaccendeva tutto. */
  await val('pdfFindApri(), 1'); await pausa(200);
  await val("(()=>{ const i=document.getElementById('pdfFindInput'); i.value='scuola';" +
    " i.dispatchEvent(new Event('input',{bubbles:true})); return 1; })()");
  await val('pdfFindChiudi(), 1');
  await pausa(1200);
  ok('e un Esc dato mentre si digita non le riaccende', 0,
    await val("document.querySelectorAll('#pdfFrame .textLayer .highlight').length"));

  /* ⌘F col fuoco in nessun posto: si sta guardando il documento, si cerca lì. */
  await val("document.body.focus && document.body.focus(), document.activeElement.blur && document.activeElement.blur(), 1");
  await invia('Input.dispatchKeyEvent', { type:'keyDown', key:'f', code:'KeyF', modifiers:4, windowsVirtualKeyCode:70 });
  await invia('Input.dispatchKeyEvent', { type:'keyUp', key:'f', code:'KeyF', modifiers:4, windowsVirtualKeyCode:70 });
  await pausa(400);
  ok('⌘F con il fuoco in nessun posto cerca NEL DOCUMENTO', 'pdfFindInput',
    await val('document.activeElement.id'));
  ok('e non ha aperto la ricerca del corso', false,
    await val("document.getElementById('searchPop').hasAttribute('open')"));
  await val('pdfFindChiudi(), 1');

  /* Lo zoom non deve invertirsi quando la scala arriva da un adattamento fuori
     dai nostri limiti: premere «+» a 600% faceva SCENDERE a 500%. */
  const oltre = await val(`(()=>{ PDFJS.viewer.currentScaleValue='6'; const p=PDFJS.viewer.currentScale;
    pdfZoomPasso(true); return { prima:p, dopo:PDFJS.viewer.currentScale }; })()`);
  ok('«+» oltre il tetto non rimpicciolisce', true, oltre.dopo >= oltre.prima);
  console.log('   ' + Math.round(oltre.prima * 100) + '% → ' + Math.round(oltre.dopo * 100) + '%');

  /* Un valore avvelenato in localStorage non deve spegnere lo zoom in silenzio:
     pdf.js non solleva, quindi il ripiego deve stare dalla nostra parte. */
  ok('un livello salvato illeggibile ripiega su «page-width»', 'page-width',
    await val("(()=>{ localStorage.setItem('studia.pdf.zoom','spazzatura'); return pdfZoomSalvato(); })()"));
  ok('e un numero fuori scala pure', 'page-width',
    await val("(()=>{ localStorage.setItem('studia.pdf.zoom','20'); return pdfZoomSalvato(); })()"));
  ok('mentre un numero valido si tiene', '1.5',
    await val("(()=>{ localStorage.setItem('studia.pdf.zoom','1.5'); return pdfZoomSalvato(); })()"));

  sezione('La pagina chiesta non può uscire dal documento');
  /* Senza clamp, «p. 9999 di 266» finiva nel titolo E dentro gli appunti. */
  await val(`openPdf(${JSON.stringify(PDF)}, 9999, 'Piano di studio'), 1`);
  await finoA('!!PDFJS.doc && ANTEPRIMA.page<=PDFJS.doc.numPages', 15000);
  const clamp = await val('({ pagina:ANTEPRIMA.page, tot:PDFJS.doc.numPages, barra:document.getElementById("pdfPagN").textContent })');
  ok('la pagina si stringe all\'ultima vera', 266, clamp.pagina);
  ok('e la barra non dichiara una pagina che non esiste', 'p. 266 di 266', clamp.barra);

  sezione('Chiudere l\'anteprima spegne i comandi, e smette di citare');
  await val('closePdf(), 1'); await pausa(400);
  const chiusa = await val(`({ doc:!!PDFJS.doc, tipo:ANTEPRIMA.tipo, zoom:document.getElementById('pdfZoom').hidden,
    find:document.getElementById('pdfFindBtn').hidden, titolo:document.getElementById('pdfTitle').textContent })`);
  ok('il documento è stato liberato', false, chiusa.doc);
  ok('l\'anteprima non indica più niente', null, chiusa.tipo);
  ok('i comandi dello zoom spariscono', true, chiusa.zoom);
  ok('e quello della ricerca pure', true, chiusa.find);
  ok('il titolo torna neutro', 'Fonte', chiusa.titolo);

  console.log('');
  console.log(ko ? '✗ ' + ko + ' controlli falliti' : '✓ tutti i controlli passati');
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('✗ ' + e.message); process.exit(1); });
