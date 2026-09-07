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
const { collega, val, invia, pausa, partiPulito, apriStrumento, clicca, pdfVisibile } = require(S);

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
  await pdfVisibile(PDF);
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

  sezione('⚠️ pdf.js non deve prendersi le immagini trascinate');
  /* Il valore di fabbrica di `annotationEditorMode` è NONE, che non vuol dire
     «niente»: monta comunque l'`annotationEditorLayer`, e quel layer accetta il
     `drop` di un'immagine e la incolla sulla pagina come «timbro». Misurato con
     una sonda il 15 agosto: una foto lasciata cadere sopra una fonte restava
     appiccicata lì, senza un modo per toglierla. L'app non offre l'annotazione
     dei PDF, quindi il layer non deve proprio esistere. */
  ok('il layer degli editor di annotazioni non c\'è', 0,
    await val("document.querySelectorAll('#pdfFrame .annotationEditorLayer').length"));

  sezione('Il foglio colorato: la tinta arriva alla pagina, non al testo');
  /* ⚠️ La REGOLA (quali tinte esistono, che cosa vuol dire un nome storto) sta
     in `aspetto/stanza.js` e si prova con `node test/stanza.js`. Qui resta il
     cablaggio: che il nome su `<html>` arrivi davvero alla pagina, e che sia la
     TELA a moltiplicarsi — è quello il meccanismo, e senza di esso un fondo
     colorato dietro un canvas opaco non si vedrebbe affatto. */
  const tinte = {};
  for (const t of ['nessuna', 'crema', 'azzurro', 'grigio']) {
    await val(`document.documentElement.dataset.tinta=${JSON.stringify(t)}, 1`);
    await pausa(120);
    /* ⚠️ Non la PRIMA .page del DOM: pdf.js smonta la tela delle pagine fuori vista, e in un
       riquadro stretto ne tiene meno — la pagina 1 restava senza canvas e il blend leggeva
       null in tutte e quattro le tinte (catena ZAINO del 7 settembre 2026). Si misura su
       una pagina che la tela ce l'ha: la regola CSS vale per tutte allo stesso modo. */
    tinte[t] = await val(`(()=>{ const p=[...document.querySelectorAll('#pdfFrame .page')].find(x=>x.querySelector('canvas'))
        || document.querySelector('#pdfFrame .page');
      if(!p) return null; const c=p.querySelector('canvas');
      return { fondo:getComputedStyle(p).backgroundColor,
               blend:c?getComputedStyle(c).mixBlendMode:null }; })()`);
  }
  console.log('   ' + JSON.stringify(tinte));
  ok('di fabbrica la pagina è bianca e la tela non si compone',
    ['rgb(255, 255, 255)', 'normal'], [tinte.nessuna.fondo, tinte.nessuna.blend]);
  /* ⚠️ Il `multiply` si accende SOLO con una tinta scelta: una proprietà di
     composizione accesa per tutti sarebbe un cambio di resa a carico anche di
     chi non ha chiesto niente. */
  ok('con una tinta la tela si moltiplica', ['multiply', 'multiply', 'multiply'],
    [tinte.crema.blend, tinte.azzurro.blend, tinte.grigio.blend]);
  ok('e le tre tinte sono tre fondi diversi, nessuno bianco', 3,
    new Set(['crema', 'azzurro', 'grigio'].map((t) => tinte[t].fondo)).size);
  ok('nessuna delle tre è il bianco', false,
    ['crema', 'azzurro', 'grigio'].some((t) => tinte[t].fondo === 'rgb(255, 255, 255)'));
  /* Il comando cicla e dice dove va: un bottone che gira senza dirlo obbliga a
     premerlo quattro volte per capire che cosa fa. */
  await val("document.documentElement.dataset.tinta='nessuna', tintaAggiorna(), 1");
  ok('il comando dice a che tinta si passa', true,
    await val("/passare a «crema»/.test(document.getElementById('pdfTinta').title)"));
  await clicca('#pdfTinta'); await pausa(200);
  ok('e premendolo ci si passa davvero', 'crema',
    await val('document.documentElement.dataset.tinta'));
  ok('la scelta è scritta dove si ricorda', 'crema',
    await val("localStorage.getItem('studia.pdf.tinta')"));
  await val("document.documentElement.dataset.tinta='nessuna', localStorage.removeItem('studia.pdf.tinta'), tintaAggiorna(), 1");

  sezione('Il CSS di pdf.js resta nel suo riquadro');
  /* Il foglio del viewer (`pdf_viewer.scoped.css`) è incapsulato sotto `#pdfPane`: fuori dal
     guscio le sue classi non devono vestire niente, o riscriverebbe l'indice dei capitoli
     dell'app, che ha una classe omonima. Si misura con una SONDA: un elemento con una classe
     del viewer (`.messageBar`, che porta una variabile sua) messo dentro `#pdfPane` prende lo
     stile — così si sa che il sensore sente — e lo stesso elemento fuori non lo prende.
     ⚠️ Prima si misurava l'indice dei capitoli (`#toc`, largo più di 180): sul fork quell'indice
     non c'è, e la prova diceva «riscritto» di un elemento nascosto. */
  const guscio = await val(`(()=>{ const sonda=(dove)=>{ const d=document.createElement('div');
      d.className='messageBar'; dove.appendChild(d);
      const v=(getComputedStyle(d).getPropertyValue('--closing-button-icon')||'').trim(); d.remove(); return v!==''; };
    return { dentro: sonda(document.querySelector('#pdfPane')), fuori: sonda(document.body) }; })()`);
  console.log('   una classe del viewer prende il suo stile: dentro ' + guscio.dentro + ' · fuori ' + guscio.fuori);
  ok('dentro il riquadro il viewer veste le sue classi', true, guscio.dentro);
  ok('fuori dal riquadro no: il CSS di pdf.js non esce', false, guscio.fuori);
  /* ⚠️ E le variabili dei blocchi `:root` del viewer NASCONO sul riquadro. Fino al 7 settembre 2026
     `bin/pdfjs-css.js` le riscriveva `#pdfPane` ma annidate sotto il guscio — `#pdfPane #pdfPane`,
     cioè niente — ed erano vuote anche dentro; nessuno se n'era accorto perché vestono cose che
     l'app non usa. Ora sono `&`, il guscio stesso: qui si misura che ci siano dentro e non fuori. */
  const radice = await val(`(()=>{ const v='--xfa-focus-outline';
    return { dentro:(getComputedStyle(document.querySelector('#pdfPane')).getPropertyValue(v)||'').trim(),
             fuori:(getComputedStyle(document.documentElement).getPropertyValue(v)||'').trim() }; })()`);
  console.log('   variabile di :root del viewer: ' + JSON.stringify(radice));
  ok('le variabili di :root del viewer nascono sul riquadro', 'auto', radice.dentro);
  ok('e non sulla radice dell\'app', '', radice.fuori);
  /* ⚠️ Ma NON `color-scheme`: il viewer lo dichiara `light dark` per il suo documento, e un riquadro
     che segue il sistema mentre l'app non lo fa si ritrova la barra di scorrimento scura su un Mac in
     modalità scura (misurato: grigio 249 → 47). Il tema lo decide StudIA: il generatore lo toglie. */
  const schemi = await val(`(()=>({ riquadro:getComputedStyle(document.querySelector('#pdfPane')).colorScheme,
    app:getComputedStyle(document.documentElement).colorScheme }))()`);
  console.log('   color-scheme: ' + JSON.stringify(schemi));
  ok('il riquadro non impone un suo color-scheme: segue l\'app', schemi.app, schemi.riquadro);

  sezione('Riaprire lo stesso documento non lo ricarica');
  const seqPrima = await val('PDFJS.seq');
  await val(`openPdf(${JSON.stringify(PDF)}, 2, 'Piano di studio'), 1`);
  await finoA('ANTEPRIMA.page===2', 8000);
  ok('ci si sposta e basta', seqPrima, await val('PDFJS.seq'));
  ok('e la pagina è la 2', 2, await val('ANTEPRIMA.page'));

  sezione('Lo zoom: la percentuale è quella VERA del viewer');
  await val("pdfFindChiudi(), 1");
  /* Si parte da una scala A MANO: è lì che l'etichetta deve essere un numero.
     Adattata, il bottone mostra il segno del modo — e la percentuale passa nel
     suggerimento (sezione dopo). */
  await val("PDFJS.viewer.currentScaleValue='1.2', pdfZoomAggiorna(), 1"); await pausa(400);
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

  sezione('⚠️ L\'adattamento è DINAMICO: la fonte segue il riquadro');
  /* `page-width` non è un abbonamento: pdf.js calcola la scala una volta sola,
     al momento in cui gliela si assegna. Senza il nostro riadattamento,
     allargare il divisore lasciava il documento della misura di prima con due
     bande bianche ai lati — ed è esattamente ciò che questa sezione misura. */
  const LARGO = "document.getElementById('pdfFrame').clientWidth";
  /* ⚠️ Lo «split» che conta è il divisore del BANCO, non `--pane-w`: da quando
     la fonte è uno strumento del banco, la colonna del dock non la tocca più.
     Prima versione di questa prova: muoveva `--pane-w` e misurava 465px prima e
     465px dopo, accusando il riadattamento per una leva scollegata.
     Il banco si mette in una forma NOTA — due affiancati, fonte a sinistra — e
     alla fine si rimette esattamente com'era, stato compreso. */
  const bancoPrima = await val('JSON.stringify(bancoStato())');
  await val(`(()=>{ bancoForma('due-col'); bancoAssegna('A','fonte'); return 1; })()`);
  await pausa(700);
  /* Si passa dal BOTTONE vero, non dalla funzione: è la porta che usa l'utente. */
  await clicca('#pdfZoomLvl'); await pausa(500);
  ok('un click sul bottone riporta alla larghezza', 'page-width',
    await val('PDFJS.viewer.currentScaleValue'));
  const segno = await val(`({ testo:document.getElementById('pdfZoomLvl').textContent,
                              titolo:document.getElementById('pdfZoomLvl').title })`);
  ok('e il bottone mostra il segno, non più una percentuale', '⟷', segno.testo);
  ok('la percentuale però non si perde: sta nel suggerimento', true, /\d+%/.test(segno.titolo));
  ok('che dice anche che la fonte segue il riquadro', true, /segue il riquadro/.test(segno.titolo));

  const wPrima = await val(LARGO);
  const sPrima = await val('PDFJS.viewer.currentScale');
  /* Si stringe la colonna della fonte spostando la frazione del divisore: è
     esattamente ciò che scrive il trascinamento su `.bdivcol`. */
  const colPrima = await val('bancoStato().col');
  async function muoviDivisore(v) {
    await val(`(()=>{ const s=bancoStato(); s.col=${v}; bancoSalva();
      bancoApplicaFrazioni(); bancoPosizionaDivisori(); bancoDopoLayout(); return 1; })()`);
  }
  await muoviDivisore(0.32);
  const wStretta = await finoA(LARGO + ' < ' + wPrima + ' ? ' + LARGO + ' : null', 8000);
  ok('il divisore stringe davvero il riquadro', true, !!wStretta);
  const sStretta = await finoA('PDFJS.viewer.currentScale < ' + sPrima + ' ? PDFJS.viewer.currentScale : null', 8000);
  console.log('   riquadro ' + wPrima + 'px → ' + (await val(LARGO)) + 'px · scala '
    + Math.round(sPrima * 100) + '% → ' + Math.round((sStretta || sPrima) * 100) + '%');
  ok('stringendo il riquadro la scala scende da sé', true, !!sStretta && sStretta < sPrima);
  ok('e il bottone resta sul segno', '⟷', await val("document.getElementById('pdfZoomLvl').textContent"));

  /* E nell'altro verso: allargando, la fonte torna a occupare la larghezza. */
  await muoviDivisore(0.72);
  const sLarga = await finoA('PDFJS.viewer.currentScale > ' + sStretta + ' ? PDFJS.viewer.currentScale : null', 8000);
  ok('allargandolo la scala risale', true, !!sLarga);
  console.log('   → ' + (await val(LARGO)) + 'px · scala ' + Math.round((sLarga || 0) * 100) + '%');

  /* ⚠️ Il ping-pong della barra di scorrimento: adattando, la barra verticale
     può comparire o sparire, la larghezza utile cambia di una quindicina di
     pixel e la scala rimbalza all'infinito. Due letture a distanza devono
     coincidere. */
  await pausa(900);
  const q1 = await val('PDFJS.viewer.currentScale'); await pausa(900);
  const q2 = await val('PDFJS.viewer.currentScale');
  ok('e poi si ferma: nessun ping-pong con la barra di scorrimento', q1, q2);

  /* Lo zoom a mano ESCE dall'adattamento: da qui in poi il riquadro può fare
     quello che vuole. */
  await clicca('#pdfZoomIn'); await pausa(600);
  const aMano = await val(`({ valore:PDFJS.viewer.currentScaleValue, scala:PDFJS.viewer.currentScale,
                              testo:document.getElementById('pdfZoomLvl').textContent })`);
  ok('«+» riporta il bottone alla percentuale', Math.round(aMano.scala * 100) + '%', aMano.testo);
  ok('e il modo non è più un adattamento', false, /^page-/.test(aMano.valore));
  await muoviDivisore(0.4);
  await pausa(1200);
  ok('spostando il divisore la scala scelta a mano non si muove',
    aMano.scala, await val('PDFJS.viewer.currentScale'));
  await muoviDivisore(colPrima);
  await pausa(600);

  sezione('SHIFT + rotella: si ingrandisce sotto il puntatore');
  /* Il pezzo di testo che sta sotto il mouse deve restare sotto il mouse. Si
     misura LUI, non i pixel della tela: con `drawingDelay` la pagina è
     ingrandita via CSS per qualche centinaio di millisecondi e la tela vera
     arriva dopo.
     ⚠️ E non si tiene il nodo: il layer di testo viene RICOSTRUITO a ogni
     cambio di scala (è la trappola delle evidenze), quindi lo stesso pezzo si
     ritrova per testo e posizione nell'elenco, non per riferimento. */
  await val("PDFJS.viewer.currentScaleValue='1', pdfZoomAggiorna(), 1"); await pausa(400);
  /* ⚠️ Si va a una pagina NOTA e piena di testo. Dopo i ridimensionamenti della
     sezione prima il viewer può trovarsi su una pagina qualunque — anche una di
     sole figure — e lì non c'è niente su cui puntare: una corsa su tre finiva
     con «non c'è un pezzo di testo», che accusava il gesto per un documento
     capitato male. */
  await val('vaiAPagina(5), 1');
  await finoA('ANTEPRIMA.page===5', 10000); await pausa(600);
  const SPAN = `(()=>{ const f=document.getElementById('pdfFrame'), r=f.getBoundingClientRect();
    const cx=r.left+r.width/2, cy=r.top+r.height*0.4;
    /* ⚠️ Solo i pezzi DAVVERO A SCHERMO. pdf.js monta anche le pagine vicine a
       quella corrente, che stanno fuori dal riquadro o fuori dalla finestra: il
       «più vicino al centro» poteva cadere là, e una rotellata mandata a quelle
       coordinate non arriva a nessuno. Sintomo: tutte e tre le rotellate della
       sezione perse insieme, compresa quella nuda. */
    /* Basta che il CENTRO cada dentro il riquadro e dentro la finestra: è il
       punto a cui si manderà la rotellata, e pretendere il rettangolo INTERO
       dentro scartava anche le righe solo sfiorate dal bordo — con documenti
       molto ingranditi non ne restava nessuna. */
    const vis=(b)=>{ const x=b.left+b.width/2, y=b.top+b.height/2;
      return x>Math.max(r.left,0)+8 && x<Math.min(r.right,innerWidth)-8
          && y>Math.max(r.top,0)+8 && y<Math.min(r.bottom,innerHeight)-8; };
    /* L'indice è quello dell'elenco INTERO, non dei visibili: dopo lo zoom la
       lista dei visibili cambia, quella di tutti no — ed è con l'indice che il
       pezzo si ritrova, visto che i nodi vengono ricostruiti. */
    const tutti=[...document.querySelectorAll('#pdfFrame .page[data-page-number="5"] .textLayer span')];
    let bi=-1, bd=1e9;
    tutti.forEach((s,i)=>{ const b=s.getBoundingClientRect();
      if(!(b.width>4 && b.height>4 && (s.textContent||'').trim() && vis(b))) return;
      const d=Math.hypot(b.left+b.width/2-cx, b.top+b.height/2-cy);
      if(d<bd){ bd=d; bi=i; } });
    if(bi<0) return null;
    const b=tutti[bi].getBoundingClientRect();
    return { i:bi, testo:(tutti[bi].textContent||'').trim().slice(0,24),
             x:Math.round(b.left+b.width/2), y:Math.round(b.top+b.height/2) }; })()`;
  const RITROVA = (i) => `(()=>{ const s=document.querySelectorAll('#pdfFrame .page[data-page-number="5"] .textLayer span')[${i}];
    if(!s) return null; const b=s.getBoundingClientRect();
    return { testo:(s.textContent||'').trim().slice(0,24),
             x:Math.round(b.left+b.width/2), y:Math.round(b.top+b.height/2) }; })()`;
  /* ⚠️ Si ASPETTA che un pezzo visibile ci sia, non lo si pretende subito: il
     layer di testo viene ricostruito dopo il disegno, e fra il cambio di scala
     e la sua comparsa passa qualche centinaio di millisecondi — in una corsa su
     due qui non c'era ancora niente, e il rosso diceva «non c'è testo» invece
     di «lo strumento è arrivato presto». */
  const bersaglio = await finoA(SPAN, 15000);
  ok('c\'è un pezzo di testo su cui puntare', true, !!bersaglio);
  if (!bersaglio) {
    console.log('      ' + JSON.stringify(await val(`(()=>{ const f=document.getElementById('pdfFrame');
      const r=f.getBoundingClientRect();
      return { riquadro:[Math.round(r.left),Math.round(r.top),Math.round(r.width),Math.round(r.height)],
               finestra:[innerWidth,innerHeight], scala:PDFJS.viewer.currentScale,
               pagina:ANTEPRIMA.page,
               pezzi:document.querySelectorAll('#pdfFrame .page[data-page-number="5"] .textLayer span').length }; })()`)));
    console.log('\n✗ senza bersaglio la sezione non ha senso'); process.exit(1);
  }
  /* ⚠️ Il puntatore si porta lì PRIMA di rotellare. Senza, una corsa su tre le
     rotellate sintetiche si perdevano tutte e tre — anche quella nuda, che col
     nostro codice non c'entra niente: senza un `mouseMoved` che dichiari dove
     sta il mouse, Chromium non sempre trova a chi consegnarle. Un rosso così
     accusa il gesto per un difetto dello strumento. */
  async function rotella(giu, conShift) {
    await invia('Input.dispatchMouseEvent', { type: 'mouseMoved', x: bersaglio.x, y: bersaglio.y });
    await pausa(120);
    await invia('Input.dispatchMouseEvent', {
      type: 'mouseWheel', x: bersaglio.x, y: bersaglio.y,
      deltaX: 0, deltaY: giu, modifiers: conShift ? 8 : 0
    });
  }
  const scalaPrima = await val('PDFJS.viewer.currentScale');
  await rotella(-120, true);
  await pausa(1200);
  const scalaDopo = await val('PDFJS.viewer.currentScale');
  ok('la rotellata con SHIFT ingrandisce', true, scalaDopo > scalaPrima);
  console.log('   ' + Math.round(scalaPrima * 100) + '% → ' + Math.round(scalaDopo * 100) + '%');
  ok('e il bottone torna alla percentuale', Math.round(scalaDopo * 100) + '%',
    await val("document.getElementById('pdfZoomLvl').textContent"));
  const ritrovato = await val(RITROVA(bersaglio.i));
  ok('il pezzo di testo è ancora quello', bersaglio.testo, ritrovato && ritrovato.testo);
  const scarto = ritrovato ? Math.round(Math.hypot(ritrovato.x - bersaglio.x, ritrovato.y - bersaglio.y)) : -1;
  console.log('   «' + bersaglio.testo + '» si è spostato di ' + scarto + ' px sotto il puntatore'
    + ' (dx ' + (ritrovato.x - bersaglio.x) + ' · dy ' + (ritrovato.y - bersaglio.y) + ')');
  /* ⚠️ Il controllo che distingue «sotto il puntatore» da «al centro»: zoomando
     sul centro questo scarto sarebbe di decine di pixel. Ed è quello che ha
     scoperto che `origin` di pdf.js NON è in coordinate di schermo: passandogli
     `clientX/clientY` la correzione veniva fatta a metà, e qui si leggeva 29px
     (dx −25 · dy −15) invece di 0. */
  ok('e non si è mosso da sotto il puntatore', true, scarto >= 0 && scarto <= 4);
  await rotella(120, true);
  await pausa(900);
  ok('e in giù si riduce', true, (await val('PDFJS.viewer.currentScale')) < scalaDopo);
  /* La rotella NUDA deve continuare a scorrere: è il gesto per cui esiste. */
  const yPrima = await val("document.getElementById('pdfFrame').scrollTop");
  await rotella(240, false);
  await pausa(500);
  ok('senza SHIFT la rotella scorre il documento, non lo zooma', true,
    (await val("document.getElementById('pdfFrame').scrollTop")) > yPrima);

  /* ⚠️ Una prova lascia il banco come l'ha trovato — forma, frazioni e
     strumenti nei blocchi — o il rosso lo prende un'altra. */
  await val(`(()=>{ BANCO.stato=JSON.parse(${JSON.stringify(bancoPrima)});
    bancoSalva(); bancoDisegna(); bancoApplicaFrazioni(); bancoPosizionaDivisori();
    bancoDopoLayout(); return 1; })()`);
  await pausa(700);

  sezione('La ricerca dentro il documento');
  ok('il bottone della ricerca c\'è', false, await val("document.getElementById('pdfFindBtn').hidden"));
  await val('pdfFindApri(), 1'); await pausa(300);
  ok('il pannellino si apre', true, await val("document.getElementById('pdfFindPop').hasAttribute('open')"));

  /* ⚠️ La barra della ricerca parla la lingua delle barre — `.tbar`, `.tbtn`,
     `.tbnota` — e non ha misure sue. Prima erano tre `.iconbtn` incorniciati e
     larghi 40px: in mezzo a un'app di bottoni nudi sembravano di un'altra
     applicazione. Come in `prova-impostazioni-token`, qui non si controlla che i
     bottoni esistano ma che siano la STESSA cosa: l'altezza dei token, una riga
     sola, e nessun dialetto sopravvissuto. */
  const barraRic = await val(`(()=>{
    const pop=document.getElementById('pdfFindPop');
    const h=(el)=>el?Math.round(el.getBoundingClientRect().height):null;
    const tb=getComputedStyle(document.documentElement).getPropertyValue('--tb-h').trim();
    const btn=[...pop.querySelectorAll('button')];
    return { dialetti:[...pop.querySelectorAll('.iconbtn')].map(x=>x.id),
             tbtn:btn.length && btn.every(b=>b.classList.contains('tbtn')),
             altezze:[...new Set(btn.map(h))],
             campo:h(document.getElementById('pdfFindInput')),
             token:tb, conto:document.getElementById('pdfFindCount').className,
             righe:Math.round(pop.getBoundingClientRect().height),
             larghezza:Math.round(pop.getBoundingClientRect().width) }; })()`);
  console.log('   ' + JSON.stringify(barraRic));
  ok('nessun dialetto di bottone nella barra della ricerca', [], barraRic.dialetti);
  ok('i comandi sono `.tbtn`', true, barraRic.tbtn);
  ok('e hanno tutti la stessa altezza, quella dei token', [parseInt(barraRic.token, 10)], barraRic.altezze);
  ok('il campo è alto come i bottoni', parseInt(barraRic.token, 10), barraRic.campo);
  ok('il conto usa il token della nota in barra', 'tbnota', barraRic.conto.trim());
  /* Una riga sola: il pannellino sta sopra la pagina, e la seconda riga copriva
     il primo risultato acceso. Il tetto è l'altezza dei token più l'imbottitura. */
  ok('è alta una riga sola', true, barraRic.righe <= parseInt(barraRic.token, 10) + 12);
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

  /* ⚠️ LE VIRGOLETTE: «la parola così com'è». `per` trova anche *perché* e
     *periodo*; `"per"` pretende i confini di parola. La regola pura sta in
     `RicercaIndice.interpreta` con le sue prove in Node — qui si misura che
     arrivi fino a pdf.js, e si misura nel solo modo che non mente: DUE CONTI a
     confronto sullo stesso documento.
     ⚠️ Il totale arriva a pezzi mentre le pagine vengono scandite, quindi si
     aspetta che si FERMI: leggerlo al primo lampo darebbe due numeri parziali,
     e il confronto sarebbe una monetina. */
  const contoStabile = async () => {
    let ultimo = null, fermo = 0;
    for (let i = 0; i < 80; i++) {
      const t = await val("document.getElementById('pdfFindCount').textContent");
      const m = /(\d+)\s+di\s+(\d+)/.exec(t || '');
      const tot = m ? parseInt(m[2], 10) : null;
      if (tot !== null && tot === ultimo) { if (++fermo >= 4) return tot; } else { fermo = 0; ultimo = tot; }
      await pausa(300);
    }
    return ultimo;
  };
  await val("(()=>{ const i=document.getElementById('pdfFindInput'); i.value='per'; pdfFindDispatch('',false); return 1; })()");
  const totLargo = await contoStabile();
  await val("(()=>{ const i=document.getElementById('pdfFindInput'); i.value='\"per\"'; pdfFindDispatch('',false); return 1; })()");
  const totEsatto = await contoStabile();
  console.log('   per: ' + totLargo + ' · "per": ' + totEsatto);
  ok('la parola intera trova meno della parola dentro le altre', true,
    !!totLargo && !!totEsatto && totEsatto < totLargo);
  ok('e trova comunque qualcosa', true, !!totEsatto && totEsatto > 0);
  ok('l\'app sa di essere in ricerca esatta', true, await val('PDFFIND.esatta'));
  /* Le virgolette cambiano i risultati senza cambiare niente che si veda: il
     conto lo dichiara, o «nessun risultato» sembrerebbe «la parola non c'è». */
  ok('il conto dichiara «intera»', true,
    /· intera/.test(await val("document.getElementById('pdfFindCount').textContent")));
  ok('e nel documento cerca il testo SENZA le virgolette', false,
    /"/.test(await val('PDFJS.find.state ? PDFJS.find.state.query : ""')));
  /* Togliendo le virgolette si torna larghi, e il marchio se ne va. */
  await val("(()=>{ const i=document.getElementById('pdfFindInput'); i.value='per'; pdfFindDispatch('',false); return 1; })()");
  await pausa(600);
  ok('e senza virgolette il marchio se ne va', false,
    /· intera/.test(await val("document.getElementById('pdfFindCount').textContent")));

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

  /* ⚠️ ESC A VUOTO NON CHIUDE IL LIBRO (23 agosto 2026). Fino a ieri l'ultimo
     anello della catena era `closePdf()`: chi premeva Esc una volta di troppo —
     e Esc si preme d'istinto, e si preme due volte — perdeva il punto in cui
     stava leggendo. Adesso la scala finisce alla ricerca; il documento si chiude
     con la ✕, che è un gesto esplicito.
     Qui si preme TRE volte con niente davanti: una sarebbe passata anche prima,
     se per caso c'era ancora un pannellino aperto a fare da parafulmine. E il
     fuoco si toglie da ogni campo, o la guardia dell'editor risponderebbe al
     posto della regola che si vuole misurare — cioè la prova direbbe verde per
     la ragione sbagliata.
     ⚠️ Questa è la parte CDP del lavoro, ed è tutta qui: il cablaggio. Che la
     priorità fra i tasti sia giusta lo dice `node test/tasti-lettura.js` in
     quaranta millisecondi. */
  await val("document.activeElement && document.activeElement.blur && document.activeElement.blur(), closePops(), 1");
  await pausa(200);
  for (let i = 0; i < 3; i++) {
    await invia('Input.dispatchKeyEvent', { type:'keyDown', key:'Escape', code:'Escape', windowsVirtualKeyCode:27 });
    await invia('Input.dispatchKeyEvent', { type:'keyUp', key:'Escape', code:'Escape', windowsVirtualKeyCode:27 });
    await pausa(150);
  }
  ok('tre Esc a vuoto NON chiudono il documento', true,
    await val("!!PDFJS.doc && document.documentElement.dataset.pdf==='1'"));
  /* E la ✕ lo chiude ancora: si toglie un anello alla catena, non il gesto. */
  await clicca('#pdfClose'); await pausa(400);
  ok('ma la ✕ sì', false, await val("document.documentElement.dataset.pdf==='1'"));
  /* Si rimette com'era: lo stato che una prova lascia è l'ingresso di quella dopo. */
  await val(`openPdf(${JSON.stringify(PDF)}, 3, 'Piano di studio'), 1`);
  await finoA('!!PDFJS.doc', 15000);

  sezione('I guasti che la verifica ostile ha trovato, e che non devono tornare');

  /* ⚠️ LA REGOLA SI È ROVESCIATA IL 17 AGOSTO, e questa prova con lei. Prima un
     click fuori spegneva la ricerca — e allora bastava premere «+» dello zoom per
     ingrandire la parola trovata per perderla. Adesso `closePops()` NON la
     tocca: la barra è visibile, quindi si esce per volontà (Esc, la ✕, il 🔍) e
     lo zoom si cambia senza danni. Ciò che va difeso qui è che il click fuori
     **non** lasci uno stato invisibile: la barra resta a schermo, e il colore
     con lei. */
  await val(`openPdf(${JSON.stringify(PDF)}, 3, 'Piano di studio'), 1`);
  await finoA('!!PDFJS.doc', 15000);
  await val('pdfFindApri(), 1'); await pausa(200);
  await val("document.getElementById('pdfFindInput').value='scuola', pdfFindDispatch('again',false), 1");
  await finoA("document.querySelectorAll('#pdfFrame .textLayer .highlight').length>0", 25000);
  await val('closePops(), 1'); await pausa(600);
  ok('un click fuori NON spegne la ricerca', true,
    (await val("document.querySelectorAll('#pdfFrame .textLayer .highlight').length")) > 0);
  ok('e la barra resta a schermo con lei', true,
    await val("document.getElementById('pdfFindPop').hasAttribute('open')"));
  /* Lo zoom si cambia con la ricerca accesa: è il gesto che l'ha motivata. */
  await val('pdfZoomPasso(true), 1'); await pausa(900);
  ok('si può ingrandire senza perdere la ricerca', true,
    (await val("document.querySelectorAll('#pdfFrame .textLayer .highlight').length")) > 0);
  /* La ✕ del pannellino: una via d'uscita che si VEDE. */
  await clicca('#pdfFindClose'); await pausa(600);
  ok('la ✕ chiude la barra…', false,
    await val("document.getElementById('pdfFindPop').hasAttribute('open')"));
  ok('…e spegne il colore', 0,
    await val("document.querySelectorAll('#pdfFrame .textLayer .highlight').length"));

  /* ⚠️ IL COLORE ACCESO SENZA BARRA A SCHERMO. È il giro della lente: apre il
     documento, scrive la parola nel campo e cerca. Fino al 17 agosto lo faceva
     con `pdfFindDispatch` e la barra restava chiusa — e allora nessuna via
     d'uscita spegneva più niente, perché tutte chiedevano se il pannellino era
     `open`. Il colore restava fino alla ricerca dopo, in ogni fonte aperta dalla
     lente. Qui si riproduce lo stato (colore acceso, pannellino chiuso) e si
     pretende che le due vie d'uscita funzionino comunque. */
  await val("(()=>{ pdfFindChiudi(); const i=document.getElementById('pdfFindInput'); i.value='scuola'; pdfFindDispatch('',false); return 1; })()");
  await finoA("document.querySelectorAll('#pdfFrame .textLayer .highlight').length>0", 25000);
  ok('il colore si accende anche a barra chiusa', false,
    await val("document.getElementById('pdfFindPop').hasAttribute('open')"));
  ok('e l\'app sa che c\'è qualcosa da spegnere', true, await val('pdfFindAccesa()'));
  /* Il 🔍 in questo stato CHIUDE invece di riaprire: è l'interruttore, e la
     domanda che si fa è «c'è del colore?», non «il pannellino è aperto?». */
  await clicca('#pdfFindBtn'); await pausa(600);
  ok('il 🔍 lo spegne lo stesso', 0,
    await val("document.querySelectorAll('#pdfFrame .textLayer .highlight').length"));

  /* E l'Esc: prima cadeva nel ramo `closePdf()` — spegneva il colore chiudendo
     il DOCUMENTO, cioè facendo perdere il punto in cui si stava leggendo. */
  await val("(()=>{ const i=document.getElementById('pdfFindInput'); i.value='scuola'; pdfFindDispatch('',false); return 1; })()");
  await finoA("document.querySelectorAll('#pdfFrame .textLayer .highlight').length>0", 25000);
  await val("document.body.focus && document.body.focus(), document.activeElement.blur && document.activeElement.blur(), 1");
  await invia('Input.dispatchKeyEvent', { type:'keyDown', key:'Escape', code:'Escape', windowsVirtualKeyCode:27 });
  await invia('Input.dispatchKeyEvent', { type:'keyUp', key:'Escape', code:'Escape', windowsVirtualKeyCode:27 });
  await pausa(600);
  ok('Esc spegne il colore…', 0,
    await val("document.querySelectorAll('#pdfFrame .textLayer .highlight').length"));
  ok('…senza chiudere il documento', true,
    await val("!!PDFJS.doc && document.documentElement.dataset.pdf==='1'"));

  /* La barra si apre anche SENZA prendere il cursore: chi arriva dalla lente la
     parola l'ha già scritta, e vuole leggere la pagina. */
  await val("document.getElementById('pdfFindInput').value='scuola', 1");
  await val("pdfFindApri({ fuoco:false }), 1"); await pausa(300);
  ok('la barra si apre', true, await val("document.getElementById('pdfFindPop').hasAttribute('open')"));
  ok('e il cursore NON è nel campo', false, await val("document.activeElement.id==='pdfFindInput'"));
  /* Il 🔍 è un interruttore: lo stesso bottone chiude quello che ha aperto. */
  await clicca('#pdfFindBtn'); await pausa(500);
  ok('il 🔍 richiude la ricerca', false, await val("document.getElementById('pdfFindPop').hasAttribute('open')"));
  ok('e spegne il colore', 0,
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

  /* ⚠️ Esc CON LA LENTE APERTA chiude la lente, e SOLO lei. I due gestori
     stanno entrambi sul documento, quindi `stopPropagation` non li separa:
     comanda l'ordine di registrazione, e quello del documento — registrato
     prima — deve farsi da parte. Senza, un Esc dato sui risultati chiudeva la
     lente E il documento sotto, con un colpo solo (riferito da Giacomo il 17
     agosto: «Esc chiude sia il pannellino sia il documento»). */
  await val('ricercaApri(), 1'); await pausa(400);
  await val("(()=>{ const i=document.getElementById('searchInput'); i.value='scuola'; i.dispatchEvent(new Event('input',{bubbles:true})); i.focus(); return 1; })()");
  await pausa(500);
  ok('la lente è aperta con i suoi risultati', true,
    await val("document.getElementById('searchPop').hasAttribute('open') && document.getElementById('searchRes').classList.contains('open')"));
  await invia('Input.dispatchKeyEvent', { type:'keyDown', key:'Escape', code:'Escape', windowsVirtualKeyCode:27 });
  await invia('Input.dispatchKeyEvent', { type:'keyUp', key:'Escape', code:'Escape', windowsVirtualKeyCode:27 });
  await pausa(500);
  ok('Esc chiude l\'elenco della lente…', false,
    await val("document.getElementById('searchRes').classList.contains('open')"));
  ok('…e il documento resta aperto', true,
    await val("!!PDFJS.doc && document.documentElement.dataset.pdf==='1'"));
  await val('closePops(), 1'); await pausa(200);

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
    find:document.getElementById('pdfFindBtn').hidden,
    sel:document.getElementById('pdfDoc').textContent,
    selVoce:document.getElementById('pdfDoc').getAttribute('aria-label') })`);
  ok('il documento è stato liberato', false, chiusa.doc);
  ok('l\'anteprima non indica più niente', null, chiusa.tipo);
  ok('i comandi dello zoom spariscono', true, chiusa.zoom);
  ok('e quello della ricerca pure', true, chiusa.find);
  /* Qui, fino al 23 agosto 2026, si controllava che «#pdfTitle» tornasse a dire
     «Fonte». Quel titolo non esiste più: in barra ripeteva il nome del documento
     e la pagina — già detti dal selettore e dal chip — e su un nome lungo si
     prendeva tutta la riga mandando i comandi a capo. La promessa non è sparita,
     ha cambiato posto: adesso è il SELETTORE l'unico che nomina il documento, e
     quindi è lui che, chiusa l'anteprima, non deve più nominarne uno. */
  ok('il selettore non nomina più il documento chiuso', 'Documenti ▾', chiusa.sel);
  // …e non lo nomina nemmeno a voce: il nome accessibile è vivo come l'etichetta
  ok('e nemmeno a chi ascolta lo schermo', 'Scegli il documento', chiusa.selVoce);

  console.log('');
  console.log(ko ? '✗ ' + ko + ' controlli falliti' : '✓ tutti i controlli passati');
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('✗ ' + e.message); process.exit(1); });
