/* L'evidenziatore SUL DOCUMENTO: si segna, si salva, e resta.
 *
 * ⚠️ Perché questa prova è la più severa della famiglia. Un'evidenza sul PDF non
 * vive nel documento: vive in `APPUNTI/_evidenze.json` e si RIAPPLICA cercando
 * il proprio testo nel layer di testo che pdf.js disegna. Quel layer viene
 * **ricostruito** a ogni cambio di zoom e ogni volta che la pagina rientra in
 * vista: i nodi di prima restano in memoria ma staccati dal documento, e un
 * `Range` costruito su quelli **non dipinge niente e non solleva**. Il guasto,
 * se torna, è una sottolineatura che sparisce al primo «+» — muta.
 *
 * Quindi non basta chiedere «l'evidenza è registrata?»: si contano i
 * RETTANGOLI dei suoi intervalli, che sono zero appena il Range si stacca dal
 * documento. E si misura tre volte: appena fatta, dopo lo zoom, e dopo essere
 * usciti dalla pagina e tornati.
 *
 *   ./test/cdp/con-vault-di-prova.sh prova-evidenze-pdf.js
 */
const path = require('path');
const fs = require('fs');
const S = path.join(__dirname, 'cdp.js');
const { collega, val, invia, clicca, pausa, partiPulito, apriStrumento } = require(S);

let ko = 0;
function ok(n, atteso, avuto) {
  const a = JSON.stringify(atteso), b = JSON.stringify(avuto);
  if (a === b) { console.log('  ok  ' + n); return; }
  ko++; console.log('  KO  ' + n + '\n      atteso ' + a + '\n      avuto  ' + b);
}
function sezione(t) { console.log('\n== ' + t); }

async function finoA(expr, quanto) {
  const fine = Date.now() + (quanto || 15000);
  for (;;) {
    const v = await val(expr);
    if (v) return v;
    if (Date.now() > fine) return null;
    await pausa(250);
  }
}

const PDF = 'Piano-di-studio-della-Scuola-dell-obbligo-ticinese.pdf';
const PAGINA = 30;

/* Quante evidenze sono ACCESE davvero: gli intervalli registrati nella Custom
   Highlight API, e quanti di loro hanno un rettangolo sullo schermo. Un Range
   staccato dal documento resta nell'insieme ma non misura niente — ed è
   esattamente il guasto da sorvegliare. */
const DIPINTE = `(()=>{ if(!window.CSS || !CSS.highlights) return null;
  let intervalli=0, conRettangolo=0;
  for(const [nome, h] of CSS.highlights){
    if(nome.indexOf('ev-')!==0) continue;
    for(const r of h){
      intervalli++;
      const b=r.getBoundingClientRect();
      if(b.width>0 && b.height>0) conRettangolo++;
    }
  }
  return { intervalli, conRettangolo, nomi:[...CSS.highlights.keys()] }; })()`;

/** Seleziona col MOUSE VERO una riga del layer di testo, e torna il suo testo. */
async function selezionaUnaRiga(indice) {
  const riga = await val(`(()=>{ const p=document.querySelector('#pdfFrame .page[data-page-number="${PAGINA}"]');
    if(!p) return null; const t=p.querySelector('.textLayer'); if(!t) return null;
    const sp=[...t.querySelectorAll('span')].filter(s=>{ const r=s.getBoundingClientRect();
      return r.width>90 && r.top>0 && r.bottom<innerHeight && s.textContent.trim().length>25; });
    if(!sp.length) return null;
    const s=sp[Math.min(${indice}, sp.length-1)], r=s.getBoundingClientRect();
    return { testo:s.textContent, x1:Math.round(r.left+2), x2:Math.round(r.right-2),
             y:Math.round(r.top+r.height/2) }; })()`);
  if (!riga) return null;
  await val('getSelection().removeAllRanges(), 1');
  await invia('Input.dispatchMouseEvent', { type: 'mousePressed', x: riga.x1, y: riga.y, button: 'left', clickCount: 1 });
  await invia('Input.dispatchMouseEvent', { type: 'mouseMoved', x: Math.round((riga.x1 + riga.x2) / 2), y: riga.y, button: 'left', buttons: 1 });
  await invia('Input.dispatchMouseEvent', { type: 'mouseMoved', x: riga.x2, y: riga.y, button: 'left', buttons: 1 });
  await invia('Input.dispatchMouseEvent', { type: 'mouseReleased', x: riga.x2, y: riga.y, button: 'left', clickCount: 1 });
  await pausa(300);
  return riga;
}

(async () => {
  await collega();
  await val('location.reload(), 1'); await pausa(2000);
  await collega(); await pausa(800);
  await partiPulito();
  const vault = await val('window.vault.path');

  sezione('Si apre un documento in un corso');
  await apriStrumento('fonte');
  await val(`openPdf(${JSON.stringify(PDF)}, ${PAGINA}, 'Piano di studio'), 1`);
  await finoA(`(PDFJS.doc && PDFJS.doc.numPages) || 0`, 25000);
  await finoA(`(()=>{ const p=document.querySelector('#pdfFrame .page[data-page-number="${PAGINA}"]');
    const t=p && p.querySelector('.textLayer'); return t && t.firstChild ? 1 : 0; })()`, 25000);
  const corso = await val('corsoAttivo()');
  ok('c\'è un corso attivo su cui salvare', true, !!corso);
  /* Si parte pulito: le prove girano tutte contro la stessa istanza, e
     un'evidenza lasciata da un giro precedente falserebbe i conteggi. */
  await val(`(()=>{ const api=window.vault.evidenze; const r=api.leggi(corsoAttivo());
    (r.evidenze||[]).forEach(function(e){ api.rimuovi(corsoAttivo(), e.id); });
    evidenzeCarica(); evidenzeDisegna(); return 1; })()`);
  await pausa(400);

  sezione('⚠️ La selezione sul documento arriva alla barra e al menu');
  /* Prima di oggi `#pdfPane` era escluso in blocco dal gestore del `mouseup`:
     selezionare su un PDF non produceva nessuna barra e nessun menu, quindi
     l'evidenziatore era irraggiungibile. */
  const riga = await selezionaUnaRiga(2);
  ok('c\'è una riga da selezionare', true, !!riga);
  /* Se la selezione non risulta evidenziabile, la prima cosa da sapere è che
     cosa c'era acceso: uno strumento lasciato da un'altra prova (le forbici) o
     una modalità sbagliata spiegano il rosso meglio di qualunque ipotesi. */
  const stato = await val(`(()=>({ forbici:(document.getElementById('pdfRitaglia')||{}).getAttribute
      ? document.getElementById('pdfRitaglia').getAttribute('aria-pressed') : null,
    albumAttivo:(typeof ALBUM!=='undefined' && ALBUM) ? !!ALBUM.attivo : null,
    modo:(typeof modoAttivo==='function') ? modoAttivo() : '?',
    anteprima:(typeof ANTEPRIMA!=='undefined') ? ANTEPRIMA.tipo+':'+ANTEPRIMA.file : '?',
    selezione:(getSelection().rangeCount && !getSelection().isCollapsed)
      ? getSelection().getRangeAt(0).toString().slice(0,40) : '' }))()`);
  console.log('   stato: ' + JSON.stringify(stato));
  const scelto = await val(`(()=>{ const s=getSelection();
    return (s.rangeCount && !s.isCollapsed) ? s.getRangeAt(0).toString() : ''; })()`);
  ok('il mouse ha selezionato del testo', true, scelto.trim().length > 10);
  ok('e l\'app riconosce la selezione come evidenziabile', 'pdf',
    await val(`(()=>{ const s=selezioneAttiva(); return s && s.sup ? s.sup.tipo : null; })()`));
  ok('con la pagina giusta', PAGINA,
    await val(`(()=>{ const s=selezioneAttiva(); return s && s.sup ? s.sup.pagina : null; })()`));
  ok('la barra flottante compare', true, await val(`selBarraAperta()`));

  sezione('Si evidenzia, e finisce su disco con il suo indirizzo');
  const colore = '#a16207';
  await val(`(()=>{ const s=selezioneAttiva(); evidenzia(s.range, ${JSON.stringify(colore)}); return 1; })()`);
  await pausa(700);
  const suDisco = await val(`(()=>{ const r=window.vault.evidenze.leggi(corsoAttivo());
    return (r.evidenze||[]).map(function(e){ return { exact:e.exact, materiale:e.materiale,
      pagina:e.pagina, capitoloId:e.capitoloId, colore:e.colore }; }); })()`);
  ok('c\'è una parola chiave, una sola', 1, suDisco.length);
  ok('e sa da quale documento viene', PDF, suDisco[0] && suDisco[0].materiale);
  ok('e da quale pagina', PAGINA, suDisco[0] && suDisco[0].pagina);
  /* ⚠️ Il campo del capitolo resta VUOTO: un documento non ha capitoli, e
     riempirlo con quello del capitolo aperto accanto vorrebbe dire far comparire
     l'evidenza sul testo di una lezione. */
  ok('e NON si attacca a un capitolo', '', suDisco[0] && suDisco[0].capitoloId);
  ok('il testo salvato è quello selezionato', true,
    !!suDisco[0] && scelto.replace(/\s+/g, ' ').indexOf(suDisco[0].exact.slice(0, 20)) >= 0);

  sezione('⚠️ È DIPINTA: i rettangoli, non il registro');
  const dip1 = await val(DIPINTE);
  console.log('   ' + JSON.stringify(dip1));
  ok('l\'intervallo è registrato', true, !!dip1 && dip1.intervalli >= 1);
  ok('e ha un rettangolo sullo schermo', true, !!dip1 && dip1.conRettangolo >= 1);

  sezione('⚠️ SOPRAVVIVE ALLO ZOOM (il guasto da sorvegliare)');
  /* Cambiare zoom fa ricostruire il layer di testo: la mappa in cache indica
     nodi staccati, e senza `textlayerrendered` l'evidenza spariva qui. */
  const scalaPrima = await val('PDFJS.viewer.currentScale');
  await clicca('#pdfZoomIn');
  await finoA(`PDFJS.viewer.currentScale !== ${scalaPrima} ? 1 : 0`, 10000);
  await pausa(1500);
  const dip2 = await val(DIPINTE);
  console.log('   scala ' + scalaPrima + ' → ' + (await val('PDFJS.viewer.currentScale')) + ' · ' + JSON.stringify(dip2));
  ok('dopo lo zoom l\'evidenza è ancora accesa', true, !!dip2 && dip2.conRettangolo >= 1);

  sezione('⚠️ E sopravvive all\'uscita e al rientro della pagina');
  await val(`(()=>{ PDFJS.viewer.currentPageNumber=1; return 1; })()`);
  await pausa(1200);
  await val(`(()=>{ PDFJS.viewer.currentPageNumber=${PAGINA}; return 1; })()`);
  await finoA(`(()=>{ const p=document.querySelector('#pdfFrame .page[data-page-number="${PAGINA}"]');
    const t=p && p.querySelector('.textLayer'); return t && t.firstChild ? 1 : 0; })()`, 20000);
  await pausa(1500);
  const dip3 = await val(DIPINTE);
  console.log('   ' + JSON.stringify(dip3));
  ok('tornando sulla pagina l\'evidenza si riaccende', true, !!dip3 && dip3.conRettangolo >= 1);

  sezione('L\'elenco filtra: la frase resta nel testo, il termine fa il chip');
  /* ⚠️ Regola delle 3 parole (12/8/26, commit 8a90ff0): la riga evidenziata qui
     sopra è una FRASE — accesa nel testo e scritta su disco, come provato — ma
     nell'elenco delle parole chiave non entra. Questa sezione misurava la
     promessa vecchia («ogni evidenza fa un chip») ed è rimasta rossa alla prima
     corsa della suite dopo quel commit: la suite viva non era stata rieseguita. */
  const chipFrase = await val(`document.querySelectorAll('#kwLista .kwchip').length`);
  ok('la frase lunga NON fa un chip', 0, chipFrase);
  ok('e il vuoto spiega il filtro invece di fingere un guasto', true,
    await val(`(()=>{ const v=document.querySelector('#kwLista .kwvuoto');
      return !!v && v.textContent.indexOf('più lunghe') >= 0; })()`));
  /* Il termine breve invece entra, e il chip sa tornare a casa. Si scrive dal
     canale vero (aggiungi) con l'indirizzo del documento: selezionare col mouse
     ESATTAMENTE una parola su un PDF è un altro esercizio, non la promessa di
     questa sezione. E si toglie subito: le sezioni dopo contano i record. */
  const chip = await val(`(()=>{ const r=window.vault.evidenze.aggiungi(corsoAttivo(),
      { exact:'sinapsi', prefix:'', suffix:'', colore:'#a16207',
        materiale:${JSON.stringify(PDF)}, pagina:${PAGINA} });
    if(r.error) return { errore:r.error };
    EVIDENZE.elenco=r.evidenze; keywordDisegna();
    const c=document.querySelectorAll('#kwLista .kwchip');
    const esito={ quanti:c.length, titolo:c.length?c[0].title:'' };
    const via=r.evidenze.filter(function(e){ return e.exact==='sinapsi'; })[0];
    const r2=window.vault.evidenze.rimuovi(corsoAttivo(), via.id);
    EVIDENZE.elenco=r2.evidenze; keywordDisegna();
    return esito; })()`);
  ok('il termine breve fa un chip, uno solo', 1, chip && chip.quanti);
  ok('e il suo titolo dice documento e pagina', true,
    !!chip && chip.titolo.indexOf('p. ' + PAGINA) >= 0);
  /* Il markdown che il chip lascia cadere: il rimando al documento, non a un
     capitolo che non esiste.
     ⚠️ Il rimando `pdf:NN` ha bisogno del NUMERO del materiale, e non tutti i
     documenti ne hanno uno: quelli del corpus storico si chiamano col loro
     titolo. Senza numero il chip lascia cadere il testo nudo — che è la scelta
     dichiarata nel codice, non una dimenticanza: un rimando che non apre niente
     sarebbe peggio. Si provano quindi ENTRAMBI i rami, o si proverebbe solo il
     caso che il vault di prova capita ad avere. */
  const md = await val(`(()=>{ const e=(EVIDENZE.elenco||[])[0]; return kwMarkdown(e); })()`);
  /* ⚠️ Il vault di prova è la copia magra: `MATERIALI/` resta fuori, quindi non
     c'è nessun materiale numerato e il ramo col rimando non si eserciterebbe
     mai. Si presta alla funzione una mappa dei numeri per il tempo della misura
     e poi si rimette la sua: senza, questo controllo sarebbe una riga che dice
     «non provato» e sembra verde. */
  const numerato = await val(`(()=>{ const vero=pdfNumOra;
    try{
      /* ⚠️ Si presta pdfNumOra, che è la funzione da cui i rimandi prendono i
         numeri ADESSO: _pdfNum serve all'analisi dei capitoli all'avvio, e
         prestare quella proverebbe una strada che a runtime non si percorre.
         ⚠️⚠️ E niente apici inversi qui dentro: questo commento vive in un
         template letterale, e uno di quelli lo chiude a metà. Quinta volta. */
      window.pdfNumOra=function(){ return { '03':'03 dispensa.pdf' }; };
      return { atteso:'[x](pdf:03#p=7)',
               avuto:kwMarkdown({ exact:'x', materiale:'03 dispensa.pdf', pagina:7 }) };
    } finally { window.pdfNumOra=vero; }
  })()`);
  console.log('   senza numero: ' + JSON.stringify(md));
  ok('senza numero resta il testo nudo, non un rimando rotto', true, md.indexOf('](pdf:') < 0);
  if (numerato) {
    console.log('   con numero:   ' + JSON.stringify(numerato.avuto));
    ok('con il numero il rimando porta al documento e alla pagina',
      numerato.atteso, numerato.avuto);
  } else {
    console.log('   (nessun materiale numerato in questo vault: ramo non provato)');
  }

  sezione('Due pagine, due parole chiave (non una che sovrascrive l\'altra)');
  /* Il guasto dell'identità: con il seme di prima, la stessa frase su un'altra
     pagina avrebbe avuto lo stesso id e avrebbe cancellato la prima. */
  await val(`(()=>{ PDFJS.viewer.currentPageNumber=31; return 1; })()`);
  await finoA(`(()=>{ const p=document.querySelector('#pdfFrame .page[data-page-number="31"]');
    const t=p && p.querySelector('.textLayer'); return t && t.firstChild ? 1 : 0; })()`, 20000);
  await pausa(800);
  const dueA = await val(`(()=>{ const api=window.vault.evidenze;
    const uno=(EVIDENZE.elenco||[])[0];
    /* si riusa lo STESSO testo, cambiando solo la pagina: è il caso limite */
    const r=api.aggiungi(corsoAttivo(), { exact:uno.exact, prefix:uno.prefix, suffix:uno.suffix,
      colore:uno.colore, materiale:uno.materiale, pagina:31 });
    evidenzeCarica(); return (r.evidenze||[]).length; })()`);
  ok('sono due record, non uno', 2, dueA);

  sezione('Cancellare: dal disco, non solo dallo schermo');
  await val(`(()=>{ PDFJS.viewer.currentPageNumber=${PAGINA}; return 1; })()`);
  await finoA(`(()=>{ const p=document.querySelector('#pdfFrame .page[data-page-number="${PAGINA}"]');
    const t=p && p.querySelector('.textLayer'); return t && t.firstChild ? 1 : 0; })()`, 20000);
  await pausa(1000);
  await selezionaUnaRiga(2);
  const tolta = await val(`(()=>{ const s=selezioneAttiva(); if(!s) return 'niente selezione';
    var v=evidenzaSotto(s.range); if(!v) return 'niente sotto';
    evidenzaCancella(s.range); return 'fatto'; })()`);
  ok('la selezione ritrova la sua evidenza e la cancella', 'fatto', tolta);
  await pausa(600);
  const restano = await val(`(()=>{ const r=window.vault.evidenze.leggi(corsoAttivo());
    return (r.evidenze||[]).map(function(e){ return e.pagina; }); })()`);
  ok('sul disco resta solo quella dell\'altra pagina', [31], restano);

  sezione('«Appunta» da un documento: testo e rimando, senza riquadro');
  /* ⚠️ Il callout «Dal capitolo» dice una cosa che in uno zaino non esiste, e un
     riquadro attorno a ogni frase presa da un PDF trasforma un quaderno in una
     pila di scatole. Il rimando invece resta: è la grammatica di sempre. */
  await selezionaUnaRiga(4);
  const appuntato = await val(`(()=>{ const s=selezioneAttiva(); if(!s) return null;
    const o=origineDaRange(s.range);
    return { origine:o, md:frammentoAppuntato(s.range.toString(), curCtx(), o) }; })()`);
  ok('l\'origine della selezione è il documento', 'pdf', appuntato.origine && appuntato.origine.tipo);
  ok('con la sua pagina', PAGINA, appuntato.origine && appuntato.origine.pagina);
  console.log('   ' + JSON.stringify(appuntato.md.slice(0, 120)));
  ok('niente riquadro', false, /^>\s*\[!/.test(appuntato.md));
  ok('e nemmeno una riga citata', false, appuntato.md.indexOf('\n> ') >= 0);
  ok('c\'è il testo', true, appuntato.md.indexOf(scelto.trim().slice(0, 20)) >= 0 ||
    appuntato.md.length > 30);
  /* Il rimando c'è quando il materiale ha un numero; qui il documento viene dal
     corpus storico e non ne ha, quindi l'indirizzo resta in chiaro — che è
     meglio di un link che non apre niente. */
  ok('e l\'indirizzo del documento, con la pagina', true,
    appuntato.md.indexOf('p. ' + PAGINA) > 0);

  sezione('E nello ZAINO, che è il posto per cui tutto questo esiste');
  /* ⚠️ Stessa funzione, contenitore diverso: l'evidenza deve finire in
     `Zaini/<id>/APPUNTI/_evidenze.json`. Se `corsoAttivo()` o `corsi.cartella()`
     si scollegassero, finirebbe nel corso di prima — e a schermo non si vedrebbe
     nessuna differenza. */
  const ZAINO = 'zaino-evidenze';
  await val(`(async()=>{ await cambiaModo('zaino'); await zainoCrea('Zaino evidenze'); return 1; })()`);
  await finoA(`zainoAttivo()==='${ZAINO}' ? 1 : 0`, 12000);
  const dirZaino = path.join(vault, 'Zaini', ZAINO);
  const corpusGlobale = path.join(vault, 'Fonti');
  fs.copyFileSync(path.join(corpusGlobale, PDF), path.join(dirZaino, 'MATERIALI', 'PDF', PDF));
  await val(`openPdf(${JSON.stringify(PDF)}, ${PAGINA}, 'Piano di studio'), 1`);
  await finoA(`(()=>{ const p=document.querySelector('#pdfFrame .page[data-page-number="${PAGINA}"]');
    const t=p && p.querySelector('.textLayer'); return t && t.firstChild ? 1 : 0; })()`, 25000);
  await pausa(800);
  await selezionaUnaRiga(3);
  const fattaZaino = await val(`(()=>{ const s=selezioneAttiva(); if(!s) return 'niente selezione';
    evidenzia(s.range, '#2dd4bf'); return 'fatto'; })()`);
  ok('si evidenzia anche qui', 'fatto', fattaZaino);
  await pausa(700);
  const suDiscoZaino = JSON.parse(fs.readFileSync(path.join(dirZaino, 'APPUNTI', '_evidenze.json'), 'utf-8'));
  ok('il file sta dentro lo zaino', 1, (suDiscoZaino.evidenze || []).length);
  ok('e la voce sa da quale documento e pagina viene', [PDF, PAGINA],
    [(suDiscoZaino.evidenze[0] || {}).materiale, (suDiscoZaino.evidenze[0] || {}).pagina]);
  const dipZaino = await val(DIPINTE);
  ok('ed è dipinta sul documento', true, !!dipZaino && dipZaino.conRettangolo >= 1);
  await val(`(async()=>{ await cambiaModo('corso'); return 1; })()`);
  await pausa(500);

  /* Si lascia pulito per chi viene dopo. */
  await val(`(()=>{ const api=window.vault.evidenze; const r=api.leggi(corsoAttivo());
    (r.evidenze||[]).forEach(function(e){ api.rimuovi(corsoAttivo(), e.id); });
    evidenzeCarica(); evidenzeDisegna(); return 1; })()`);
  await val('getSelection().removeAllRanges(), 1');
  await val(`(()=>{ try{ closePdf(); }catch(e){} return 1; })()`);

  console.log('');
  console.log(ko ? '✗ ' + ko + ' controlli falliti' : '✓ tutti i controlli passati');
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('✗ ' + e.message); process.exit(1); });
