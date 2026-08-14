/* L'album dei ritagli, dalla porta principale: si trascina un rettangolo sopra
 * la pagina e ne esce un'immagine.
 *
 * ⚠️ Il controllo che vale più di tutti è che il rettangolo si salvi in
 * coordinate della PAGINA e non dello schermo: a un altro zoom gli stessi pixel
 * indicano un altro punto del documento, e il ritaglio serve proprio a poter
 * tornare là. Qui si ritaglia la stessa area a due zoom diversi e si verifica
 * che l'album se ne accorga — cioè che riconosca lo stesso ritaglio.
 *
 *   ./test/cdp/con-vault-di-prova.sh prova-album.js
 */
const S = require('path').join(__dirname, 'cdp.js');
const { collega, val, invia, pausa, partiPulito, partiVuoto, apriStrumento } = require(S);
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

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

/** Trascina col mouse VERO, come farebbe una mano. */
async function trascina(x1, y1, x2, y2) {
  await invia('Input.dispatchMouseEvent', { type: 'mousePressed', x: x1, y: y1, button: 'left', clickCount: 1 });
  for (let i = 1; i <= 6; i++) {
    await invia('Input.dispatchMouseEvent', { type: 'mouseMoved',
      x: Math.round(x1 + (x2 - x1) * i / 6), y: Math.round(y1 + (y2 - y1) * i / 6), button: 'left' });
    await pausa(30);
  }
  await invia('Input.dispatchMouseEvent', { type: 'mouseReleased', x: x2, y: y2, button: 'left', clickCount: 1 });
}

/** La parte della pagina che si vede DAVVERO: l'incrocio fra il riquadro della
 *  pagina, quello del visualizzatore e la finestra. È da qui che si scelgono i
 *  punti di un trascinamento, perché il ritaglio parte da un `elementFromPoint`
 *  e un punto fuori vista non trova nessuna pagina. */
const VISIBILE = `(()=>{ const v=PDFJS.viewer, f=document.getElementById('pdfFrame');
  if(!v || !f) return null;
  const pv=v.getPageView(Math.max(0,(v.currentPageNumber||1)-1));
  if(!pv || !pv.div) return null;
  const p=pv.div.getBoundingClientRect(), r=f.getBoundingClientRect();
  const x=Math.max(p.left,r.left,0), y=Math.max(p.top,r.top,0);
  const x2=Math.min(p.right,r.right,innerWidth), y2=Math.min(p.bottom,r.bottom,innerHeight);
  if(x2-x<40 || y2-y<40) return null;
  return { x:Math.round(x), y:Math.round(y), w:Math.round(x2-x), h:Math.round(y2-y) }; })()`;

/** Il riquadro della pagina a schermo: da lì si scelgono i punti da trascinare. */
const RIQUADRO = `(()=>{ const v=PDFJS.viewer; if(!v) return null;
  const pv=v.getPageView(Math.max(0,(v.currentPageNumber||1)-1));
  if(!pv || !pv.div) return null;
  const r=pv.div.getBoundingClientRect();
  return { x:Math.round(r.left), y:Math.round(r.top), w:Math.round(r.width), h:Math.round(r.height) }; })()`;

(async () => {
  await collega();
  await val('location.reload(), 1'); await pausa(1800);
  await collega(); await pausa(600);
  /* le forbici si misurano SENZA documento: il ripristino ne riaprirebbe uno */
  await partiVuoto();
  await val(`(()=>{ try{ bancoForma('uno'); }catch(e){} return 1; })()`);
  await pausa(400);
  await apriStrumento('fonte');

  sezione('Le forbici compaiono solo con un documento aperto');
  ok('senza documento non ci sono', true, await val("document.getElementById('pdfRitaglia').hidden"));
  await val(`openPdf(${JSON.stringify(PDF)}, 3, 'Piano di studio'), 1`);
  await finoA('!!PDFJS.doc', 20000);
  await finoA(`(()=>{ const c=[...document.querySelectorAll('#pdfFrame canvas')].filter(x=>x.width>0); return c.length>0; })()`, 20000);
  ok('col documento sì', false, await val("document.getElementById('pdfRitaglia').hidden"));

  sezione('Si accende, si trascina, esce un ritaglio');
  const corso = await val('corsoAttivo()');
  const prima = await val(`(window.vault.album.elenco(${JSON.stringify(corso)}).voci||[]).length`);
  console.log('   album di partenza: ' + prima + ' ritagli · corso ' + corso);

  await val('albumRitaglioModo(true), 1'); await pausa(300);
  ok('il bottone si accende', 'true', await val("document.getElementById('pdfRitaglia').getAttribute('aria-pressed')"));

  const box = await val(RIQUADRO);
  console.log('   pagina a schermo: ' + JSON.stringify(box));
  const x1 = box.x + Math.round(box.w * 0.2), y1 = box.y + Math.round(box.h * 0.2);
  const x2 = box.x + Math.round(box.w * 0.6), y2 = box.y + Math.round(box.h * 0.45);
  await trascina(x1, y1, x2, y2);
  const dopo = await finoA(`(()=>{ const n=(window.vault.album.elenco(${JSON.stringify(corso)}).voci||[]).length;
    return n>${prima} ? n : null; })()`, 25000);
  ok('l\'album ha un ritaglio in più', prima + 1, dopo);

  const voce = await val(`(()=>{ const v=window.vault.album.elenco(${JSON.stringify(corso)}).voci||[];
    return v[v.length-1]||null; })()`);
  console.log('   ' + JSON.stringify({ materiale: voce.materiale, pagina: voce.pagina, rect: voce.rect, w: voce.w, h: voce.h }));
  ok('sa da quale documento viene', PDF, voce.materiale);
  ok('e da quale pagina', 3, voce.pagina);
  ok('il rettangolo ha una superficie vera', true, voce.rect.w > 20 && voce.rect.h > 20);
  /* ⚠️ Le coordinate sono della PAGINA: un A4 sta sotto i ~600×850 punti, mentre
     lo stesso rettangolo in pixel di schermo starebbe fra 300 e 900. Se qui
     comparissero i pixel, il ritaglio indicherebbe un punto diverso a ogni zoom. */
  ok('sono coordinate della pagina, non dello schermo', true,
    voce.rect.x < 700 && voce.rect.y < 900 && voce.rect.x !== x1);
  ok('l\'immagine è stata resa a risoluzione doppia', true, voce.w > voce.rect.w * 1.5);

  sezione('Lo stesso gesto a uno zoom diverso è lo STESSO ritaglio');
  /* È la prova che le coordinate non dipendono dallo schermo: si ingrandisce, si
     ritaglia di nuovo la stessa area della pagina, e l'album deve riconoscerla
     invece di aggiungere un doppione. */
  await val("PDFJS.viewer.currentScaleValue='1.4', 1"); await pausa(1200);
  await finoA(`(()=>{ const c=[...document.querySelectorAll('#pdfFrame canvas')].filter(x=>x.width>0); return c.length>0; })()`, 20000);
  const box2 = await val(RIQUADRO);
  await trascina(box2.x + Math.round(box2.w * 0.2), box2.y + Math.round(box2.h * 0.2),
                 box2.x + Math.round(box2.w * 0.6), box2.y + Math.round(box2.h * 0.45));
  await pausa(2500);
  const conta = await val(`(window.vault.album.elenco(${JSON.stringify(corso)}).voci||[]).length`);
  ok('nessun doppione: l\'area è la stessa', prima + 1, conta);

  sezione('⌥ tenuto premuto: forbici momentanee, senza accendere il modo');
  /* Il bottone in barra è comodo per dieci ritagli di fila; per uno solo è un
     viaggio. Con ⌥ giù si ritaglia e basta, e mollato il tasto torna la
     selezione del testo — un modo che dura quanto il dito non si dimentica
     acceso, che è il difetto di quello appiccicato. */
  await val('albumRitaglioModo(false), 1'); await pausa(300);
  const spente = await val(`({ croce:document.getElementById('pdfHost').classList.contains('ritaglio'),
    bottone:document.getElementById('pdfRitaglia').getAttribute('aria-pressed') })`);
  ok('si parte con le forbici spente', { croce: false, bottone: 'false' }, spente);

  async function alt(giu) {
    await invia('Input.dispatchKeyEvent', {
      type: giu ? 'rawKeyDown' : 'keyUp', key: 'Alt', code: 'AltLeft',
      windowsVirtualKeyCode: 18, nativeVirtualKeyCode: 18, modifiers: giu ? 1 : 0
    });
    await pausa(250);
  }

  await alt(true);
  const conAlt = await val(`({ croce:document.getElementById('pdfHost').classList.contains('ritaglio'),
    bottone:document.getElementById('pdfRitaglia').getAttribute('aria-pressed'),
    alt:ALBUM.alt, attivo:ALBUM.attivo })`);
  ok('con ⌥ giù il riquadro passa alle forbici', true, conAlt.croce);
  /* ⚠️ Il bottone NON deve premersi da sé: mollato ⌥ tornerebbe su, e un comando
     che si accende e si spegne da solo non si capisce più chi lo comanda. */
  ok('ma il bottone in barra non si preme da sé', 'false', conAlt.bottone);
  ok('e il modo appiccicato resta spento', { alt: true, attivo: false },
    { alt: conAlt.alt, attivo: conAlt.attivo });

  /* ⚠️ Il rettangolo si disegna dentro la parte VISIBILE della pagina, non
     dentro la pagina: a 1,4× la metà bassa sta fuori dal riquadro, e il
     ritaglio comincia con un `elementFromPoint` — un trascinamento che parte
     là non trova nessuna pagina e non succede niente. Prima stesura di questa
     prova: rossa per questo, con l'aria di dire che ⌥ non funziona.
     E l'area dev'essere DIVERSA da quella già ritagliata, o l'album la
     riconosce e non aggiunge niente — e il rosso non distinguerebbe «non ha
     ritagliato» da «era un doppione». */
  const box3 = await val(VISIBILE);
  console.log('   parte visibile della pagina: ' + JSON.stringify(box3));
  const conta2 = await val(`(window.vault.album.elenco(${JSON.stringify(corso)}).voci||[]).length`);
  await trascina(box3.x + Math.round(box3.w * 0.62), box3.y + Math.round(box3.h * 0.3),
                 box3.x + Math.round(box3.w * 0.92), box3.y + Math.round(box3.h * 0.55));
  const conta3 = await finoA(`(()=>{ const n=(window.vault.album.elenco(${JSON.stringify(corso)}).voci||[]).length;
    return n>${conta2} ? n : null; })()`, 25000);
  ok('trascinando con ⌥ giù esce un ritaglio', conta2 + 1, conta3);

  await alt(false);
  ok('mollato ⌥ il riquadro torna al testo', false,
    await val("document.getElementById('pdfHost').classList.contains('ritaglio')"));
  /* E adesso lo stesso gesto NON deve ritagliare più niente. */
  await trascina(box3.x + Math.round(box3.w * 0.1), box3.y + Math.round(box3.h * 0.6),
                 box3.x + Math.round(box3.w * 0.5), box3.y + Math.round(box3.h * 0.8));
  await pausa(2500);
  ok('e il trascinamento nudo non ritaglia più',
    conta3, await val(`(window.vault.album.elenco(${JSON.stringify(corso)}).voci||[]).length`));

  /* ⚠️ Su macOS ⌥ serve a comporre accenti e simboli: chi sta scrivendo non sta
     chiedendo le forbici. Con il fuoco in un campo di testo il tasto non deve
     fare niente. */
  await val('pdfFindApri(), 1'); await pausa(300);
  ok('il fuoco è nel campo della ricerca', 'pdfFindInput', await val('document.activeElement.id'));
  await alt(true);
  ok('scrivendo in un campo, ⌥ non accende niente', false,
    await val("document.getElementById('pdfHost').classList.contains('ritaglio')"));
  await alt(false);
  await val('pdfFindChiudi(), 1');
  await val('getSelection().removeAllRanges(), 1');

  sezione('La superficie mostra i ritagli');
  await val('albumRitaglioModo(false), 1');
  await apriStrumento('album');
  await pausa(500);
  const griglia = await val(`(()=>{ const c=[...document.querySelectorAll('#albLista .alcard')];
    return { card:c.length, conImmagine:c.filter(x=>x.querySelector('img')).length,
             conto:document.getElementById('albConto').textContent }; })()`);
  /* Due, non uno: quello del bottone e quello fatto con ⌥ giù. Il conto viene
     dal disco (`conta3`), non da un numero scritto qui — così una prova nuova
     che aggiunge un ritaglio non fa arrossare questa. */
  ok('c\'è una card per ogni ritaglio', conta3, griglia.card);
  ok('e ognuna mostra la sua immagine', conta3, griglia.conImmagine);
  console.log('   ' + griglia.conto);

  /* I pixel della miniatura: che il file sia stato scritto e sia leggibile. */
  const dipinta = await finoA(`(()=>{ const i=document.querySelector('#albLista .alcard img');
    return (i && i.complete && i.naturalWidth>0) ? i.naturalWidth : null; })()`, 15000);
  ok('l\'immagine sul disco si carica davvero', true, !!dipinta && dipinta > 0);
  console.log('   miniatura ' + dipinta + ' px di larghezza naturale');

  sezione('Il menu contestuale dell\'immagine');
  const id = voce.id;
  await val(`albumMenu(${JSON.stringify(id)}, 200, 200), 1`); await pausa(250);
  const menu = await val(`(()=>{ const m=document.getElementById('albMenu');
    return { aperto:m.classList.contains('open'),
             voci:[...m.querySelectorAll('.ctx-item')].map(b=>b.textContent.replace(/\\s+/g,' ').trim()),
             spente:[...m.querySelectorAll('.ctx-item[disabled]')].length }; })()`);
  ok('si apre', true, menu.aperto);
  console.log('   ' + menu.voci.join(' · '));
  ok('«Rivela nel Finder» non è più spenta', false,
    await val("!!document.querySelector('#albMenu .ctx-item[data-alb=\"finder\"][disabled]')"));
  ok('ha le voci promesse', true,
    /Alla fonte/.test(menu.voci.join('|')) && /Rinomina/.test(menu.voci.join('|')) &&
    /Finder/.test(menu.voci.join('|')) && /Copia/.test(menu.voci.join('|')) && /Elimina/.test(menu.voci.join('|')));

  sezione('«Alla fonte» riporta alla pagina da cui viene');
  await val('closePdf(), 1'); await pausa(300);
  await val(`albumAzione('fonte', ${JSON.stringify(id)}), 1`);
  await finoA('!!PDFJS.doc && ANTEPRIMA.tipo==="pdf"', 20000);
  ok('riapre il documento giusto', PDF, await val('ANTEPRIMA.file'));
  ok('alla pagina giusta', 3, await val('ANTEPRIMA.page'));

  sezione('La didascalia si cambia, l\'identità no');
  await val(`(()=>{ const r=window.vault.album.rinomina(corsoAttivo(), ${JSON.stringify(id)}, 'Prova di didascalia');
    return r.error||''; })()`);
  await val('albumAggiorna(), 1'); await pausa(300);
  const dopoRin = await val(`(()=>{ const v=(window.vault.album.elenco(corsoAttivo()).voci||[])
    .filter(x=>x.id===${JSON.stringify(id)})[0]; return v ? { did:v.didascalia, file:v.file } : null; })()`);
  ok('la didascalia è cambiata', 'Prova di didascalia', dopoRin.did);
  ok('e il nome del file no', voce.file, dopoRin.file);

  sezione('Rivelare nel Finder non può uscire dal vault');
  /* La porta apre il Finder su ciò che le si dice: deve rifiutare tutto quello
     che sta fuori dal vault, o diventa un modo per farsi aprire cartelle. */
  const fuori = await val("window.vault.reveal('file:///etc/hosts')");
  ok('un percorso fuori dal vault viene rifiutato', 'fuori dal vault', fuori && fuori.error);

  sezione('Un\'immagine usata non si cancella in silenzio');
  const usi = await val(`(()=>{ const u=window.vault.album.usi(corsoAttivo(), ${JSON.stringify(id)});
    return { quanti:u.quanti, err:u.error||'' }; })()`);
  ok('si sa dire in quanti posti è usata', '', usi.err);
  console.log('   usata in ' + usi.quanti + ' posti');

  sezione('L\'immagine appare DAVVERO nella mappa');
  /* ⚠️ `disegna.js` è puro e chiede l'indirizzo a chi lo chiama: senza
     `opt.srcImmagine` ogni nodo-immagine mostrava il segnaposto «immagine non
     disponibile», che è il suo ripiego dichiarato. Il difetto non era nel
     disegno — era il cavo mancante. Qui si controlla che l'`<image>` esista e
     abbia un indirizzo vero. */
  {
    const messa = await val(`(()=>{
      if(!mappaPronta()) return 'moduli non pronti';
      const g = MappaModifica.estrai({nodi:[],archi:[]}, { testo:'Prova immagine',
        immagine:{ id:${JSON.stringify(voce.id)}, w:${voce.w}, h:${voce.h} } });
      const res = MappaLayouts.run(MappaGrafo.sanitizza(g), { motore:'albero' });
      const out = MappaDisegna.svg(res, { tema:mappaTema(), srcImmagine:mappaSrcImmagine,
        font:'Helvetica' });
      const m = /<image[^>]*href="([^"]+)"/.exec(out.markup);
      return { immagini:(out.markup.match(/<image /g)||[]).length,
               segnaposto:/immagine non disponibile/.test(out.markup),
               href:m ? m[1].slice(0,7)+'…'+m[1].slice(-12) : '' };
    })()`);
    if (typeof messa === 'string') { console.log('  -- ' + messa); }
    else {
      ok('il nodo-immagine emette un <image>', 1, messa.immagini);
      ok('e NON il segnaposto', false, messa.segnaposto);
      console.log('   href: ' + messa.href);
      ok('con un indirizzo vero, non vuoto', 0, messa.href.indexOf('file://'));
    }
  }

  sezione('Il nodo-immagine: cornice tolta, barra a sinistra, e si ridimensiona');
  {
    /* Si legge il DOM, non il testo del markup: analizzare l'SVG con espressioni
       regolari vuol dire riscrivere un parser che il browser ha già — e le prime
       due volte che ci ho provato ho misurato le mie virgolette, non il disegno. */
    const misure = await val(`(()=>{
      if(!mappaPronta()) return 'moduli non pronti';
      const g = MappaModifica.estrai({nodi:[],archi:[]}, { testo:'Schema',
        immagine:{ id:${JSON.stringify(voce.id)}, w:${voce.w}, h:${voce.h} } });
      const id = g.nodi[0].id;
      function svg(gr){
        const res = MappaLayouts.run(MappaGrafo.sanitizza(gr), { motore:'albero', orient:'td', w:168, h:48 });
        const out = MappaDisegna.svg(res, { tema:mappaTema(), srcImmagine:mappaSrcImmagine, font:'Helvetica' });
        const host = document.createElementNS('http://www.w3.org/2000/svg','svg');
        host.innerHTML = out.markup;
        return host;
      }
      const h1 = svg(g);
      const rett = [...h1.querySelectorAll('rect')];
      /* Il rettangolo del nodo è il più grande: non si può più cercarlo per
         misura, perché la misura ormai la detta l'immagine. */
      const card = rett.slice().sort((a,b)=>
        (+b.getAttribute('width'))*(+b.getAttribute('height')) -
        (+a.getAttribute('width'))*(+a.getAttribute('height')))[0];
      const barra = rett.filter(r=>Math.round(+r.getAttribute('width'))===4)[0];
      const img = h1.querySelector('image');
      const h2 = svg(MappaModifica.ridimensionaImmagine(g, id, 2));
      const card2 = [...h2.querySelectorAll('rect')].slice().sort((a,b)=>
        (+b.getAttribute('width'))*(+b.getAttribute('height')) -
        (+a.getAttribute('width'))*(+a.getAttribute('height')))[0];
      const img2 = h2.querySelector('image');
      const nu = (el,a)=> el ? Math.round(+el.getAttribute(a)) : -1;
      return {
        cardStroke: card ? (card.getAttribute('stroke')||'') : 'niente card',
        barraW: nu(barra,'width'), barraDaSinistra: nu(barra,'x') - nu(card,'x'),
        barraH: nu(barra,'height'), cardH: nu(card,'height'),
        imgW: nu(img,'width'), imgH: nu(img,'height'),
        aspetto: img ? img.getAttribute('preserveAspectRatio') : '',
        imgDaSinistra: nu(img,'x') - nu(card,'x'),
        imgDallAlto: nu(img,'y') - nu(card,'y'),
        largaDopo: nu(card2,'width'), altaDopo: nu(card2,'height'),
        imgWDopo: nu(img2,'width'), imgHDopo: nu(img2,'height')
      };
    })()`);
    if (typeof misure === 'string') console.log('  -- ' + misure);
    else {
      console.log('   ' + JSON.stringify(misure));
      /* ⚠️ Tre lati nudi: la card di un nodo-immagine non ha tratto. Il rettangolo
         resta perché è il bersaglio del click, ma non disegna una cornice. */
      ok('la cornice non c\'è: tre lati nudi', 'none', misure.cardStroke);
      ok('la barra è a sinistra, dello spessore delle altre card', [4, 0],
        [misure.barraW, misure.barraDaSinistra]);
      ok('ed è alta quanto il nodo', misure.cardH, misure.barraH);
      /* Il ritaglio arriva a filo dei tre lati nudi: l'unico margine è la barra. */
      ok('il ritaglio comincia dopo la barra e non prima', 4, misure.imgDaSinistra);
      ok('e in alto è a filo, perché lassù non c\'è più niente da rispettare', 0, misure.imgDallAlto);
      ok('prende tutta la larghezza meno la barra', 164, misure.imgW);
      /* ⚠️ Il nodo prende la FORMA del ritaglio: l'altezza non è più quella
         della card, la detta il rapporto dell'immagine — e si vede tutto,
         invece di un pezzo. */
      ok('l\'altezza segue il rapporto del ritaglio, non la card', true,
        Math.abs(misure.imgH - Math.round(164 * voce.h / voce.w)) <= 2);
      ok('e l\'immagine non si taglia', 'xMidYMid meet', misure.aspetto);
      /* Ridimensionare è proporzionale: raddoppiando la scala raddoppiano
         entrambi i lati, o uno schema si deformerebbe. */
      /* Raddoppiando la scala raddoppia l'IMMAGINE, in proporzione su tutti e
         due i lati. ⚠️ Non il nodo intero: la fascia della didascalia resta
         alta quanto il testo, che è a corpo fisso — deve restare leggibile, non
         crescere col riquadro. Il primo controllo che ho scritto pretendeva il
         nodo esattamente doppio e accusava una cosa giusta. */
      ok('a scala 2 il NODO raddoppia in larghezza', 336, misure.largaDopo);
      /* ⚠️ L'immagine no, e di poco: la barra resta spessa 4 px a qualunque
         scala — è quello che la rende uguale a tutte le altre card — quindi
         all'immagine resta la larghezza meno quei quattro, una volta sola.
         Il primo controllo che ho scritto pretendeva il doppio esatto e
         accusava una cosa voluta. */
      ok('e all\'immagine resta la larghezza meno la barra, sempre quattro',
        332, misure.imgWDopo);
      /* Quello che non deve cambiare MAI è il rapporto: né ridimensionando né
         adattandosi al ritaglio. */
      ok('il rapporto resta identico', true,
        Math.abs((misure.imgWDopo / misure.imgHDopo) - (misure.imgW / misure.imgH)) < 0.02);
    }
  }

  sezione('Un\'immagine non può finire su una mappa GENERATA');
  /* ⚠️ È la regola che rende innocuo tutto il resto del disegno: i nodi-immagine
     hanno misure proprie e i motori non lo sanno, ma vivono solo dove la
     disposizione la fa la mano. Se un giorno questa porta si aprisse, la
     sovrapposizione coi vicini tornerebbe a essere un problema vero. */
  {
    const esito = await val(`(()=>{
      MAPPA.registro='generata';
      const prima = (MAPPA.mia.grafo && MAPPA.mia.grafo.nodi.length) || 0;
      mappaNodoImmagine({ id:'aa11bb22', w:100, h:80, materiale:'x.pdf', pagina:1 });
      const dopo = (MAPPA.mia.grafo && MAPPA.mia.grafo.nodi.length) || 0;
      const t = document.getElementById('toast');
      return { prima, dopo, detto:(t && /show/.test(t.className)) ? t.textContent : '' };
    })()`);
    ok('il nodo non viene aggiunto', esito.prima, esito.dopo);
    /* E lo DICE: un gesto che cade nel vuoto senza spiegazione insegna che l'app
       è imprevedibile. */
    ok('e il rifiuto è spiegato', true, /mappa tua/.test(esito.detto));
    console.log('   ' + esito.detto);
    await val("MAPPA.registro='mie', 1");
  }

  sezione('Il ritaglio sui VIDEO: un fermo immagine è un ritaglio come un altro');
  /* ⚠️ La condizione su cui poggia tutto questo è che una tela che ha disegnato
     un `<video>` con sorgente `file://` si possa ancora LEGGERE. Non era ovvio —
     la finestra non ha `webSecurity:false` né `allowFileAccessFromFileURLs` — ed
     è stato misurato prima di scrivere una riga: non contamina. Se un giorno
     Chromium cambia idea, è questa prova a doverlo dire. */
  const vault = await val('window.vault && window.vault.vaultPath');
  if (!vault || !/studia-prove-/.test(vault)) { console.log('  -- non è una copia di prova: salto'); }
  else {
    const ff = ['/opt/homebrew/bin/ffmpeg', '/usr/local/bin/ffmpeg']
      .filter((p) => fs.existsSync(p))[0];
    if (!ff) console.log('  -- ffmpeg non c\'è: salto il ritaglio video');
    else {
      /* Il video di prova lo fabbrica la prova stessa, dentro la COPIA: i video
         veri non entrano nel vault magro (sono il 99% del peso) e una prova che
         dipendesse da un file dell'utente girerebbe solo sulla sua macchina. */
      const dir = path.join(vault, 'Media');
      fs.mkdirSync(dir, { recursive: true });
      const nome = '00 prova ritaglio.mp4';
      const r = spawnSync(ff, ['-y', '-f', 'lavfi', '-i', 'testsrc=size=320x240:rate=10:duration=3',
        '-pix_fmt', 'yuv420p', path.join(dir, nome)], { encoding: 'utf-8' });
      if (r.status !== 0) console.log('  -- il video di prova non si è fatto: salto');
      else {
        const primaV = await val('(window.vault.album.elenco(corsoAttivo()).voci||[]).length');
        await val(`openVideo(${JSON.stringify(nome)}, 1, 'Prova'), 1`);
        const pronto = await finoA(`(()=>{ const v=document.getElementById('mediaVideo');
          return (v && v.videoWidth>0) ? v.videoWidth : null; })()`, 20000);
        ok('il video si carica', 320, pronto);
        ok('le forbici valgono anche qui', false, await val("document.getElementById('pdfRitaglia').hidden"));
        /* ⚠️ Questo controllo è cambiato con il PLAYER. Diceva «lo zoom sparisce
           quando è in scena un video», e valeva finché il media suonava DENTRO
           il riquadro del documento: aprirlo chiudeva il PDF, e con lui i suoi
           comandi. Ora sono due strumenti affiancabili — se un documento è
           aperto, il suo zoom deve restare acceso mentre il video va. La
           promessa vera è sempre la stessa, ed è questa: lo zoom appartiene al
           documento, e nella barra del player non c'è. */
        ok('lo zoom resta al documento: nella barra del player non c\'è', true,
          await val("!document.querySelector('#playerPane .pdfzoom, #playerPane #pdfZoom')"));

        await val('albumRitaglioModo(true), 1'); await pausa(300);
        /* ⚠️ Si trascina dentro l'IMMAGINE, non dentro l'elemento: un video sta
           in «contain» e le bande nere non sono fotogramma. La geometria la dà
           `albumVideoGeom`, che è la stessa che usa il gesto. */
        const g = await val("albumVideoGeom(document.getElementById('mediaVideo'))");
        console.log('   fotogramma a schermo: ' + JSON.stringify({ x: Math.round(g.x), y: Math.round(g.y),
          w: Math.round(g.w), h: Math.round(g.h), scala: Math.round(g.k * 100) / 100 }));
        await trascina(Math.round(g.x + g.w * 0.25), Math.round(g.y + g.h * 0.25),
                       Math.round(g.x + g.w * 0.75), Math.round(g.y + g.h * 0.7));
        const dopoV = await finoA(`(()=>{ const n=(window.vault.album.elenco(corsoAttivo()).voci||[]).length;
          return n>${primaV} ? n : null; })()`, 20000);
        ok('il fermo immagine è finito nell\'album', primaV + 1, dopoV);

        const vv = await val(`(()=>{ const v=window.vault.album.elenco(corsoAttivo()).voci||[];
          return v.filter(x=>x.t!=null)[0]||null; })()`);
        console.log('   ' + JSON.stringify({ materiale: vv.materiale, t: vv.t, rect: vv.rect, w: vv.w, h: vv.h }));
        ok('sa da quale video viene', nome, vv.materiale);
        ok('e da quale secondo, non da quale pagina', true, vv.t != null && vv.pagina === undefined);
        /* I pixel del FOTOGRAMMA: 320×240. Se qui comparissero i pixel dello
           schermo il rettangolo sarebbe molto più grande, e a un'altra misura
           della finestra indicherebbe un'altra porzione dell'immagine. */
        ok('il rettangolo è in pixel del fotogramma', true,
          vv.rect.x >= 0 && vv.rect.x + vv.rect.w <= 320 && vv.rect.y + vv.rect.h <= 240);
        ok('e l\'immagine è resa 1:1, non ingrandita', true, Math.abs(vv.w - Math.round(vv.rect.w)) <= 1);
        ok('la didascalia di ripiego parla in minuti', true, /\d:\d\d/.test(vv.didascalia));

        await val('albumRitaglioModo(false), 1');
        await val(`albumAzione('fonte', ${'`'}${'$'}{0}${'`'}), 1`.replace('`${0}`', JSON.stringify(vv.id)));
        await pausa(600);
        /* ⚠️ Si chiede al PLAYER, non ad `ANTEPRIMA`: da quando i riquadri sono
           due, `ANTEPRIMA` descrive il documento e il media ce l'ha `PLAYER`.
           Chiedere qui `ANTEPRIMA.tipo==='video'` vorrebbe dire una prova che
           non può più diventare verde — e la cosa da provare è un'altra: che il
           ritaglio riapra il MATERIALE da cui viene. */
        ok('«Alla fonte» riapre il VIDEO, non un documento', nome, await val('PLAYER.file'));
        /* ⚠️ Non si chiede «a che secondo sei ADESSO»: `openVideo` fa partire il
           video, quindi mezzo secondo dopo è già più avanti — e la prima
           versione di questo controllo accusava il salto per una cosa che è il
           comportamento voluto. Si guarda dove è ATTERRATO, con la tolleranza
           del tempo che passa fra il salto e la domanda. */
        const dove = await val('(()=>{ const v=document.getElementById("mediaVideo"); v.pause(); return v.currentTime; })()');
        console.log('   riaperto al secondo ' + Math.round(dove * 10) / 10 + ' (chiesto: 1)');
        ok('vicino al secondo da cui viene il ritaglio', true, dove >= 1 && dove < 3);
      }
    }
  }

  sezione('⚠️ IL RITAGLIO È QUEL PEZZO DI PAGINA: i pixel, non le coordinate');
  /* Il guasto che questo blocco esiste per impedire, successo davvero e
     riportato da chi usava l'app: selezionando il titolo in cima alla pagina
     usciva un ritaglio preso in fondo. Le coordinate erano giuste — `rect` è in
     spazio PDF, origine in basso a sinistra — ma il DISEGNO lavora nello spazio
     del viewport, origine in alto a sinistra: usare `rect.y` come distanza dal
     bordo superiore ribalta la pagina. Misurato su un documento vero: pagina
     alta 495 pt, selezione a 69 px dall'alto di un riquadro di 687, rect.y=371,
     e il disegno partiva a 371 pt dal bordo SUPERIORE — 321 pt più in basso.
     Le coordinate non se ne accorgono: se ne accorgono solo i PIXEL. Quindi si
     confronta il ritaglio con la stessa area ritagliata dalla pagina intera
     disegnata a parte. */
  await apriStrumento('fonte');
  await val(`openPdf(${JSON.stringify(PDF)}, 30, 'Piano di studio'), 1`);
  await finoA(`(PDFJS.doc && PDFJS.doc.numPages) || 0`, 25000);
  await pausa(1200);
  const confronto = await val(`(async()=>{
    const n=ANTEPRIMA.page;
    const pv=PDFJS.viewer.getPageView(n-1); if(!pv) return null;
    const box=pv.div.getBoundingClientRect();
    /* Una fascia in ALTO nella pagina: è lì che il ribaltamento si vede. */
    const a=pv.getPagePoint(box.width*0.15, box.height*0.10);
    const b=pv.getPagePoint(box.width*0.85, box.height*0.25);
    const rect={ x:Math.min(a[0],b[0]), y:Math.min(a[1],b[1]),
                 w:Math.abs(b[0]-a[0]), h:Math.abs(b[1]-a[1]) };
    const img=await albumRendi(n, rect, 2);

    const page=await PDFJS.doc.getPage(n);
    const vp=page.getViewport({ scale:2 });
    const full=document.createElement('canvas');
    full.width=Math.ceil(vp.width); full.height=Math.ceil(vp.height);
    const fg=full.getContext('2d');
    fg.fillStyle='#fff'; fg.fillRect(0,0,full.width,full.height);
    await page.render({ canvasContext:fg, viewport:vp }).promise;
    const p1=vp.convertToViewportPoint(rect.x, rect.y);
    const p2=vp.convertToViewportPoint(rect.x+rect.w, rect.y+rect.h);
    const rx=Math.round(Math.min(p1[0],p2[0])), ry=Math.round(Math.min(p1[1],p2[1]));

    const im=new Image(); im.src=img.dati;
    await new Promise(function(ok){ im.onload=ok; });
    const cc=document.createElement('canvas'); cc.width=im.width; cc.height=im.height;
    cc.getContext('2d').drawImage(im,0,0);
    const A=cc.getContext('2d').getImageData(0,0,im.width,im.height).data;
    const B=fg.getImageData(rx, ry, im.width, im.height).data;
    let uguali=0, letti=0, inchiostro=0;
    for(let i=0;i<Math.min(A.length,B.length);i+=4*37){
      letti++;
      if(A[i]<240||A[i+1]<240||A[i+2]<240) inchiostro++;
      if(Math.abs(A[i]-B[i])<24 && Math.abs(A[i+1]-B[i+1])<24 && Math.abs(A[i+2]-B[i+2])<24) uguali++;
    }
    return { larghezza:im.width, altezza:im.height, letti:letti, uguali:uguali,
             inchiostro:inchiostro, somiglianza:Math.round(100*uguali/letti) }; })()`);
  ok('il ritaglio si è prodotto', true, !!confronto && confronto.larghezza > 10);
  console.log('   ' + JSON.stringify(confronto));
  /* ⚠️ Non basta che combacino: due aree BIANCHE combaciano al 100%. Si chiede
     anche che ci sia inchiostro, o il controllo passerebbe su un ritaglio preso
     in un margine vuoto — che è esattamente ciò che il guasto produceva. */
  ok('e contiene inchiostro, non un margine bianco', true, confronto.inchiostro > 20);
  ok('ed è la stessa area della pagina, pixel per pixel', true, confronto.somiglianza >= 98);

  console.log('');
  console.log(ko ? '✗ ' + ko + ' controlli falliti' : '✓ tutti i controlli passati');
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('✗ ' + e.message); process.exit(1); });
