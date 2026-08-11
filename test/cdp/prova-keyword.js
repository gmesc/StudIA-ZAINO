/* Lotto 6 — lo strumento «Parole chiave» nel banco.
 *
 * Promette tre cose: che l'elenco sia uno STRUMENTO come gli altri (entra in
 * un blocco, aspetta in magazzino, non si distrugge); che i chip portino con
 * sé l'identità del record e non il solo testo, perché è ciò che permette a un
 * appunto e a un nodo di mappa di sapere da dove viene la parola; e che il
 * colore sia uno solo — cambiato dal chip, si muove anche sul testo.
 *
 * ⚠️ Gira contro il vault della config: puntarlo a una COPIA (trappola ⑧).
 *   ./node_modules/.bin/electron . --remote-debugging-port=9333
 *   node test/cdp/prova-keyword.js
 */
const S = require('path').join(__dirname, 'cdp.js');
const { collega, invia, val, clicca, pausa, partiPulito } = require(S);

let ko = 0;
function ok(n, atteso, avuto) {
  const a = JSON.stringify(atteso), b = JSON.stringify(avuto);
  if (a === b) { console.log('  ok  ' + n); return; }
  ko++; console.log('  KO  ' + n + '\n      atteso ' + a + '\n      avuto  ' + b);
}
const chips = () => val(`document.querySelectorAll('#kwLista .kwchip').length`);
const testi = () => val(`[...document.querySelectorAll('#kwLista .kwchip .kwtxt')].map(x=>x.textContent)`);

(async () => {
  await collega();
  await partiPulito();
  await val('localStorage.removeItem("studia.banco"), 1');
  await val('location.reload(), 1');
  await pausa(1800); await collega(); await pausa(600);

  const corso = await val('corsoAttivo()');
  // si parte pulito: le prove precedenti possono aver lasciato qualcosa
  await val(`window.vault.evidenze.salva(corsoAttivo(), []), 1`);

  console.log('\n== è uno strumento del banco come gli altri');
  ok('è nel registro ed è disponibile', [true, 'Parole chiave'],
    [await val('bancoDisponibile("keyword")'), await val('bancoStrumenti().keyword.nome')]);
  ok('a freddo aspetta in magazzino, non distrutto', 'bancoMagazzino',
    await val(`document.getElementById('keywordPane').parentElement.id`));
  await val('bancoMostra("keyword"), 1'); await pausa(600);
  ok('chiamato, entra nel corpo di un blocco', 'bcorpo',
    await val(`document.getElementById('keywordPane').parentElement.className`));
  ok('e l\'elenco degli strumenti a schermo lo nomina', true,
    await val(`(document.documentElement.dataset.strumenti||'').split(' ').indexOf('keyword')>=0`));

  console.log('\n== l\'elenco mostra le parole chiave del CORSO, non del solo capitolo');
  await val(`(()=>{
    const c=corsoAttivo();
    window.vault.evidenze.aggiungi(c,{exact:'zebra', prefix:'la ', suffix:' corre',
      capitoloId:'01-fondamenti-c01', capitolo:'Primo', colore:'#a16207'});
    window.vault.evidenze.aggiungi(c,{exact:'alfabeto', prefix:'un ', suffix:' nuovo',
      capitoloId:'02-altro-c03', capitolo:'Un altro capitolo', colore:'#1d4ed8'});
    return 1;})()`);
  await val('evidenzeCarica(), keywordDisegna(), 1'); await pausa(300);
  ok('ci sono tutti e due, anche quello di un altro capitolo', 2, await chips());
  ok('in ordine alfabetico di fabbrica', ['alfabeto', 'zebra'], await testi());

  console.log('\n== la ricerca e l\'ordinamento');
  await val(`(()=>{const i=document.getElementById('kwCerca'); i.value='zeb';
    i.dispatchEvent(new Event('input',{bubbles:true})); return 1;})()`); await pausa(250);
  ok('la ricerca filtra', ['zebra'], await testi());
  await val(`(()=>{const i=document.getElementById('kwCerca'); i.value='';
    i.dispatchEvent(new Event('input',{bubbles:true})); return 1;})()`); await pausa(250);
  ok('svuotarla li rimette tutti', 2, await chips());
  /* ⚠️ L'ordine di partenza NON è una costante: il bottone ricorda l'ultima
     scelta, e l'app di prova ha una cartella dati sua — quindi al primo avvio
     parte dal valore di fabbrica, mentre prima queste prove ereditavano di
     nascosto lo stato dell'utente. Si prova il GESTO (l'etichetta cambia, e
     torna) invece di due etichette assolute. */
  const etichetta = () => val(`document.getElementById('kwOrdine').textContent`);
  const ord0 = await etichetta();
  await clicca('#kwOrdine'); await pausa(300);
  const ord1 = await etichetta();
  ok('il bottone dice in che ordine sono ADESSO, e cambiando lo dice', true, ord1 !== ord0);
  ok('le due etichette sono le due che esistono', true, ['Aa', '📅'].indexOf(ord1) >= 0);
  await clicca('#kwOrdine'); await pausa(300);
  ok('e si torna indietro', ord0, await etichetta());

  console.log('\n== il chip porta l\'identità, non il testo nudo');
  ok('ogni chip dichiara l\'id del suo record', true,
    await val(`[...document.querySelectorAll('#kwLista .kwchip')].every(c=>!!c.dataset.kw)`));
  ok('ed è trascinabile', true,
    await val(`[...document.querySelectorAll('#kwLista .kwchip')].every(c=>c.draggable)`));
  /* Il markdown che cade porta il rimando: è ciò che rende l'appunto
     rileggibile fra un mese, e vale anche per il nodo di mappa. */
  ok('e il markdown che lascia cadere porta il rimando al capitolo', true,
    await val(`/^\\[alfabeto\\]\\(cap:02-altro-c03\\)$/.test(kwMarkdown(
      EVIDENZE.elenco.filter(e=>e.exact==='alfabeto')[0]))`));

  console.log('\n== ⚠️ il velo del trascinamento non riguarda i gesti interni');
  /* Il velo nero che dice «rilascia qui» serve a chi porta dei FILE dentro
     l'app. Si accendeva a ogni trascinamento — anche spostando una parola
     chiave sulla mappa o un ritaglio dell'album negli appunti — e copriva lo
     schermo con un cartello che prometteva un'altra cosa. */
  const veloInterno = await val(`(()=>{ const dt=new DataTransfer();
    dt.setData('text/plain', 'una parola');
    dt.setData('application/x-studia-evidenza', 'x');
    window.dispatchEvent(new DragEvent('dragover', { dataTransfer:dt, bubbles:true, cancelable:true }));
    return document.documentElement.dataset.drop || ''; })()`);
  ok('trascinando una parola chiave il velo resta spento', '', veloInterno);
  const veloFile = await val(`(()=>{ const dt=new DataTransfer();
    dt.items.add(new File(['%PDF-1.4'], 'x.pdf', { type:'application/pdf' }));
    window.dispatchEvent(new DragEvent('dragover', { dataTransfer:dt, bubbles:true, cancelable:true }));
    const v=document.documentElement.dataset.drop || '';
    delete document.documentElement.dataset.drop;
    return v; })()`);
  /* Con dei file invece si accende, e dice la cosa giusta per la modalità: qui
     si è in un corso, quindi la lezione. */
  ok('trascinando un file si accende', 'json', veloFile);

  console.log('\n== la parola chiave portata sulla mappa: colore e pallino');
  /* ⚠️ Una parola chiave gialla che sulla mappa diventa grigia ha perso l'unica
     cosa che la legava alle sue sorelle; e senza rimando il nodo è un'etichetta
     che non torna da nessuna parte. Il gesto deve portarsi dietro tutto quello
     che la parola sapeva: il colore, e l'indirizzo da cui viene.
     ⚠️ Che cosa NON è provato qui: l'ultimo anello, cioè il `drop` del mouse
     sulla tela — un `DataTransfer` con dentro un tipo nostro non si costruisce
     dall'esterno in modo affidabile. Si prova la funzione che quel gestore
     chiama, con le evidenze vere. */
  await val(`(async()=>{ bancoMostra('mappa'); return 1; })()`); await pausa(800);
  await val(`(async()=>{ if(!mappaMie()) await mappaRegistro('mie'); return 1; })()`); await pausa(1000);
  await val(`(()=>{ if(!MAPPA.mia.grafo) mappaNuova(); return 1; })()`); await pausa(600);
  /* Il titolo della mappa nuova lo chiede un riquadro: si risponde. */
  await val(`(()=>{ const i=document.getElementById('umInput');
    if(i && document.querySelector('#uiModal[open]')){ i.value='Mappa delle parole'; return 1; } return 0; })()`);
  await val(`(()=>{ const b=document.getElementById('umOk');
    if(b && document.querySelector('#uiModal[open]')) b.click(); return 1; })()`);
  await pausa(900);

  /** Porta un'evidenza sulla mappa come fa la caduta, e racconta il nodo nato. */
  const portaSullaMappa = (voce) => val(`(()=>{ const ev=${voce};
    if(!ev || !MAPPA.mia.grafo) return null;
    MAPPA.mia.grafo=MappaModifica.estrai(MAPPA.mia.grafo, {
      testo:ev.exact, nota:(ev.prefix+ev.exact+ev.suffix).trim(),
      colore:ev.colore||'', rimando:evidenzaRimando(ev), capitolo:evidenzaCapitolo(ev) });
    mappaTocca(); mappaRidisegna();
    const n=MAPPA.mia.grafo.nodi[MAPPA.mia.grafo.nodi.length-1];
    return { testo:n.testo, colore:n.colore||'', origine:n.origine,
             capitolo:(n.capitolo==null?null:n.capitolo), rimando:n.rimando||null }; })()`);

  /* (a) una parola chiave presa DAVVERO in questo capitolo: il nodo deve sapere
     a quale capitolo tornare. */
  const daCapitolo = await portaSullaMappa(`(()=>{ const c=curCtx();
    return { exact:'zebra viva', prefix:'la ', suffix:' corre', colore:'#0f766e',
             capitoloId:c.capitoloId }; })()`);
  ok('il nodo porta il testo della parola chiave', 'zebra viva', daCapitolo && daCapitolo.testo);
  ok('e il colore della sua sottolineatura', '#0f766e', daCapitolo && daCapitolo.colore);
  ok('nasce «dalla fonte», non «dell\'utente»', 'fonte', daCapitolo && daCapitolo.origine);
  ok('e sa a quale capitolo tornare', 0, daCapitolo && daCapitolo.capitolo);
  ok('il pallino della fonte è sulla tela', true,
    await val(`!!document.querySelector('#mappaSvg .mfonte')`));

  /* (b) una parola chiave presa su un DOCUMENTO: il nodo porta il rimando, che
     è autoportante — apre il file a quella pagina anche da un'altra lezione. */
  const daPdf = await portaSullaMappa(`({ exact:'competenza', prefix:'la ', suffix:' situata',
    colore:'#a16207', materiale:'03 dispensa.pdf', pagina:7 })`);
  ok('da un documento il nodo porta il rimando', 'pdf', daPdf && daPdf.rimando && daPdf.rimando.type);
  ok('col file e la pagina', ['03 dispensa.pdf', 7],
    [daPdf && daPdf.rimando && daPdf.rimando.file, daPdf && daPdf.rimando && daPdf.rimando.page]);
  ok('ed è anche lui «dalla fonte»', 'fonte', daPdf && daPdf.origine);

  /* (c) ⚠️ E una parola chiave di un capitolo che NON è di questa lezione non si
     inventa un numero: un numero sbagliato aprirebbe il capitolo di un'altra
     lezione, in silenzio. Meglio un nodo senza pallino. */
  const forestiera = await portaSullaMappa(`({ exact:'foresta', prefix:'la ', suffix:' fitta',
    colore:'#1d4ed8', capitoloId:'99-mai-vista-c07' })`);
  ok('un capitolo di un\'altra lezione non produce un numero a caso', null,
    forestiera && forestiera.capitolo);
  ok('e quel nodo resta «dell\'utente»', 'utente', forestiera && forestiera.origine);

  await val(`(async()=>{ bancoMostra('keyword'); return 1; })()`); await pausa(600);

  console.log('\n== un colore solo: il chip e il testo leggono lo stesso valore');
  const idZebra = await val(`EVIDENZE.elenco.filter(e=>e.exact==='zebra')[0].id`);
  await val(`kwRicolora(${JSON.stringify(idZebra)}, '#0f766e'), 1`); await pausa(500);
  ok('il colore è cambiato sul disco', '#0f766e',
    await val(`window.vault.evidenze.leggi(corsoAttivo()).evidenze.filter(e=>e.id===${JSON.stringify(idZebra)})[0].colore`));
  ok('e il chip lo mostra', '#0f766e',
    await val(`document.querySelector('#kwLista .kwchip[data-kw=${JSON.stringify(idZebra)}]').style.getPropertyValue('--kw')`));

  console.log('\n== togliere dal menu del chip');
  await val(`(()=>{const c=document.querySelector('#kwLista .kwchip[data-kw=${JSON.stringify(idZebra)}]');
    const r=c.getBoundingClientRect();
    c.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,
      clientX:Math.round(r.left+4), clientY:Math.round(r.top+4)})); return 1;})()`);
  await pausa(300);
  ok('il menu del chip si apre', true, await val(`kwMenuAperto()`));
  ok('con i cinque colori e il picker', [5, 1],
    await val(`[document.querySelectorAll('#kwMenu .ctx-col').length,
                document.querySelectorAll('#kwMenu input[type=color]').length]`));
  /* ⚠️ «Negli appunti» esiste perché il gesto c'era già — si trascina il chip
     nell'editor — ma un gesto che non si vede è un gesto che non esiste: chi
     non l'ha scoperto per caso non sa che c'è. La voce e il trascinamento
     lasciano cadere la STESSA riga (`kwMarkdown`), o un giorno uno dei due
     dimenticherebbe il rimando. */
  /* Serve un appunto APERTO: senza, «Negli appunti» ne creerebbe uno e
     chiederebbe il titolo — un riquadro modale in mezzo alla prova, che poi
     mangerebbe i click successivi. Qui interessa l'accodamento, non la
     creazione (che ha già la sua prova). */
  await val(`(()=>{ const api=window.vault.notes;
    const r=api.save(corsoAttivo(), null, { title:'Quaderno di prova' }, 'Prima riga.');
    notesReload(); refreshNoteUI(); noteOpen(r.file); return 1; })()`);
  await pausa(900);
  const vociMenu = await val(`[...document.querySelectorAll('#kwMenu .ctx-item')].map(b=>b.getAttribute('data-kwaz'))`);
  ok('il menu offre anche «Negli appunti»', true, vociMenu.indexOf('appunti') >= 0);
  const primaDelMd = await val(`(()=>{ const e=EVIDENZE.elenco.filter(x=>x.id===${JSON.stringify(idZebra)})[0];
    return kwMarkdown(e); })()`);
  await clicca('#kwMenu .ctx-item[data-kwaz="appunti"]'); await pausa(900);
  const nelQuaderno = await val(`(()=>{ if(!NOTES.mde) return null; return NOTES.mde.value(); })()`);
  ok('la parola chiave finisce nell\'appunto aperto', true,
    typeof nelQuaderno === 'string' && nelQuaderno.indexOf(primaDelMd) >= 0);
  /* Una parola chiave è una parola, non una citazione: niente riquadro. */
  ok('e ci finisce senza riquadro', false,
    typeof nelQuaderno === 'string' && /\[!nota\]/.test(nelQuaderno.slice(nelQuaderno.indexOf(primaDelMd) - 40)));

  await val(`(()=>{const c=document.querySelector('#kwLista .kwchip[data-kw=${JSON.stringify(idZebra)}]');
    const r=c.getBoundingClientRect();
    c.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,
      clientX:Math.round(r.left+4), clientY:Math.round(r.top+4)})); return 1;})()`);
  await pausa(300);
  await clicca('#kwMenu .ctx-item[data-kwaz="togli"]'); await pausa(600);
  ok('la parola sparisce dall\'elenco', 1, await chips());
  ok('e dal disco', 1, await val('window.vault.evidenze.leggi(corsoAttivo()).evidenze.length'));

  // il vault di prova si lascia com'era
  await val(`window.vault.evidenze.salva(corsoAttivo(), []), 1`);
  await val('localStorage.removeItem("studia.banco"), 1');

  console.log('\n' + (ko ? '✗ ' + ko + ' controlli falliti' : '✓ strumento «Parole chiave» verde dalla porta principale'));
  process.exit(ko ? 1 : 0);
})();
