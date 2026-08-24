/* Trascinare un ritaglio dell'album: sulla mappa e dentro un appunto.
 *
 * ⚠️ Che cosa difende. Il trascinamento è la TERZA porta di due verbi che
 * esistevano già («metti nella mappa», «metti nell'appunto»): se si rompe, i
 * due comandi del menu continuano a funzionare e nessuna prova se ne accorge —
 * si accorge solo chi trascina, e vede il ritaglio rimbalzare. In più
 * un'immagine trascinata porta con sé, per gentile concessione del browser, il
 * PERCORSO del file: se il nostro tipo non viaggia, negli appunti finisce un
 * `file:///…` che si rompe appena il vault cambia posto.
 *
 * ⚠️ Il gesto qui è SINTETICO: CDP non sa fare un trascinamento vero (nessun
 * `Input.dispatchDragEvent` in questa versione), quindi si costruisce un
 * `DataTransfer` e si mandano `dragstart` e `drop` come li manderebbe il
 * browser. Si misurano i nostri gestori, non il gesto del mouse — quello resta
 * da provare a mano, ed è dichiarato nell'handoff.
 *
 *   ./test/cdp/con-vault-di-prova.sh prova-album-trascina.js
 */
const S = require('path').join(__dirname, 'cdp.js');
const { collega, val, pausa, partiPulito, partiVuoto } = require(S);

let ko = 0;
function ok(n, atteso, avuto) {
  const a = JSON.stringify(atteso), b = JSON.stringify(avuto);
  if (a === b) { console.log('  ok  ' + n); return; }
  ko++; console.log('  KO  ' + n + '\n      atteso ' + a + '\n      avuto  ' + b);
}
function sezione(t) { console.log('\n== ' + t); }

/* Il gesto, in una funzione sola: `dragstart` sulla card e `drop` sul bersaglio,
   con lo STESSO `DataTransfer` — che è ciò che il browser fa davvero. */
const TRASCINA = (selBersaglio, x, y) => `(()=>{
  const card=document.querySelector('#albLista .alcard');
  if(!card) return 'nessuna card';
  const dt=new DataTransfer();
  card.dispatchEvent(new DragEvent('dragstart', { bubbles:true, cancelable:true, dataTransfer:dt }));
  const tipi=Array.from(dt.types);
  const bers=document.querySelector(${JSON.stringify(selBersaglio)});
  if(!bers) return 'nessun bersaglio';
  const r=bers.getBoundingClientRect();
  const px=${x === null ? 'Math.round(r.left+r.width/2)' : x};
  const py=${y === null ? 'Math.round(r.top+r.height/2)' : y};
  bers.dispatchEvent(new DragEvent('dragover', { bubbles:true, cancelable:true, dataTransfer:dt, clientX:px, clientY:py }));
  bers.dispatchEvent(new DragEvent('drop', { bubbles:true, cancelable:true, dataTransfer:dt, clientX:px, clientY:py }));
  return { tipi:tipi, testo:dt.getData('text/plain'), id:dt.getData('application/x-studia-album') };
})()`;

(async () => {
  await collega();
  await partiPulito();

  sezione('Si prepara il banco: album, mappa e appunti a schermo');
  await val(`(()=>{ bancoForma('tre-sx'); bancoAssegna('A','album');
    bancoAssegna('C','mappa'); bancoAssegna('D','appunti'); return 1; })()`);
  await pausa(1200);
  const quanti = await val(`(()=>{ albumAggiorna(); return document.querySelectorAll('#albLista .alcard').length; })()`);
  if (!quanti) { console.log('  ✗ nessun ritaglio nell’album del contenitore: la prova non può misurare niente'); process.exit(1); }
  console.log('   ' + quanti + ' ritagli nell’album');
  ok('le card si possono trascinare', 'true',
    await val(`document.querySelector('#albLista .alcard').getAttribute('draggable')`));

  sezione('Una mappa tua, che accolga il ritaglio');
  const file = await val(`(async()=>{
    let g={ nodi:[], archi:[] };
    g=MappaModifica.creaNodo(g,{ testo:'Radice' });
    const r=await window.vault.mappe.salva(corsoAttivo(), null,
      { titolo:'Prova trascina', corso:corsoAttivo(), nodi:g.nodi, archi:g.archi, vista:{} });
    if(r.error) return r.error;
    await mappaRegistro('mie'); await new Promise(s=>setTimeout(s,700));
    await mappaApriMia(r.file);
    return r.file; })()`);
  ok('la mappa tua è aperta', true, /Prova trascina/.test(String(file)) && await val(`mappaMie() && !!MAPPA.mia.grafo`));
  const prima = await val(`MAPPA.mia.grafo.nodi.length`);

  sezione('Il ritaglio cade sulla mappa: nasce un nodo-immagine, dove l’hai lasciato');
  const g1 = await val(TRASCINA('#mappaSvg', null, null));
  ok('il trascinamento porta l’identità del ritaglio, non il file',
    true, Array.isArray(g1.tipi) && g1.tipi.indexOf('application/x-studia-album') >= 0);
  /* ⚠️ E porta ANCHE il markdown, per chi capisce solo testo: è lo stesso che
     scrive «Metti nell'appunto», col rimando `album:<id>` e non un percorso. */
  ok('e il testo è il rimando dell’album', true, /^!\[.*\]\(album:.+\)$/.test(g1.testo || ''));
  await pausa(600);
  const dopo = await val(`(()=>{ const n=MAPPA.mia.grafo.nodi; const u=n[n.length-1];
    return { quanti:n.length, immagine:!!(u&&u.immagine&&u.immagine.id),
      posato: !!(u && Number.isFinite(u.x) && Number.isFinite(u.y)),
      rimando: !!(u && u.rimando) }; })()`);
  ok('un nodo in più', prima + 1, dopo.quanti);
  ok('ed è un nodo-immagine', true, dopo.immagine);
  ok('nato nel punto in cui è caduto', true, dopo.posato);
  /* Il rimando è ciò che rende il nodo navigabile fino alla pagina da cui il
     ritaglio viene: senza, l'immagine è un francobollo che non torna a casa. */
  ok('e sa da dove viene', true, dopo.rimando);

  sezione('Il ritaglio cade in un appunto: si scrive il rimando, non il percorso');
  const nota = await val(`(async()=>{
    const r=window.vault.notes.save(corsoAttivo(), 'prova-trascina.md', { titolo:'Prova trascina' }, 'Riga di partenza.\\n');
    if(r.error) return r.error;
    notesReload(); noteOpen('prova-trascina.md');
    await new Promise(s=>setTimeout(s,700));
    return NOTES.cur ? NOTES.cur.file : 'non aperto'; })()`);
  ok('l’appunto è aperto', 'prova-trascina.md', nota);
  await val(TRASCINA('#notePane .CodeMirror', null, null));
  await pausa(600);
  const testo = await val(`NOTES.mde ? NOTES.mde.value() : ''`);
  ok('nell’appunto c’è il rimando all’album', true, /!\[[^\]]*\]\(album:[^)]+\)/.test(testo || ''));
  /* ⚠️ Il percorso del file NON deve comparire: è quello che il browser offre
     da sé trascinando un'immagine, e si romperebbe al primo spostamento del
     vault (o aprendo il corso su un altro computer). */
  ok('e NON il percorso del file', false, /file:\/\//.test(testo || ''));

  sezione('Pulizia: quello che questa prova ha creato, questa prova lo toglie');
  await val(`(async()=>{
    try{ await window.vault.mappe.rimuovi(corsoAttivo(), MAPPA.mia.file); }catch(e){}
    /* Da quando appunti e mappe vanno nel Cestino di sistema, remove e'
       asincrona: senza await la prova dopo vedrebbe ancora l'appunto. E i due
       file finiscono nel Cestino VERO di chi lancia le prove — sono briciole,
       come gia' per zaino:elimina. (Niente apici inversi qui: siamo DENTRO un
       template literal.) */
    try{ await window.vault.notes.remove(corsoAttivo(), 'prova-trascina.md'); }catch(e){}
    try{ await mappaRegistro('generata'); }catch(e){}
    return 1; })()`);
  await pausa(600);
  /* ⚠️ E si rimette il BANCO com'era. Le prove girano tutte contro la stessa
     istanza, una dopo l'altra: questa aveva lasciato a schermo album, mappa e
     appunti al posto del capitolo e della fonte, e `prova-evidenze-pdf` — che
     arriva dopo e vuole il documento — cadeva su un controllo che col
     trascinamento non c'entra niente. Il difetto non era suo. */
  await val(`(()=>{ notesReload(); bancoForma('due-col');
    bancoAssegna('A','capitolo'); bancoAssegna('C','fonte'); return 1; })()`);
  await pausa(500);
  /* ⚠️ E si dichiara di voler lasciare lo SCHERMO VUOTO: questa prova apre un
     appunto e poi lo cancella, e il segno di "che cosa era aperto" resterebbe a
     puntare un file che non c'è più — la prova dopo ricarica la pagina e si
     ritrova quello strascico addosso. `partiVuoto` esiste per questo. */
  await partiVuoto();

  console.log(ko ? `\n✗ ${ko} controlli falliti` : '\n✓ tutti i controlli passati');
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error('prova-album-trascina: ' + (e && e.message)); process.exit(1); });
