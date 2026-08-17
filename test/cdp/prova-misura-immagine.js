/* Quanto è larga un'immagine dentro un appunto, sull'app viva.
 *
 * La grammatica (`Titolo|60%`) la provano in Node i controlli di
 * `test/misura-immagini.js`, e la resa quelli di `test/figure.js`. Di qui non si
 * vedono: quello che solo l'app viva può dire è
 *
 *   1. che il TETTO ci sia davvero — un'immagine importata è larga fino a
 *      3000px, e nell'anteprima degli appunti non arrivava nessuna regola che
 *      la fermasse: sfondava il riquadro. È il difetto da cui nasce questo
 *      lavoro, e una misura a schermo è l'unica prova che sia chiuso;
 *   2. che il menu si apra sulla figura giusta e riscriva la riga giusta,
 *      contando le occorrenze DAL DOM — la sola parte che in Node non esiste.
 *
 * ⚠️ Il tasto destro via CDP NON genera `contextmenu` (trappola di
 * GUIDA-ARCHITETTO §8): l'evento si costruisce a mano.
 *
 *   ./test/cdp/con-vault-di-prova.sh prova-misura-immagine.js
 */
const S = require('path').join(__dirname, 'cdp.js');
const { collega, val, pausa, partiPulito, apriStrumento } = require(S);

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
    await pausa(220);
  }
}

/** Il tasto destro sulla figura numero `i` dell'anteprima. */
const TASTO_DESTRO = (i) => `(()=>{
  const f=document.querySelectorAll('#noteHost .figura')[${i}]; if(!f) return 0;
  const im=f.querySelector('img'); if(!im) return 0;
  const r=im.getBoundingClientRect();
  im.dispatchEvent(new MouseEvent('contextmenu', { bubbles:true, cancelable:true,
    clientX:Math.round(r.left+r.width/2), clientY:Math.round(r.top+r.height/2) }));
  return 1; })()`;

const PREMI = (az) => `(()=>{ const b=document.querySelector('#figMenu [data-fig="${az}"]');
  if(!b) return 0; b.click(); return 1; })()`;

/** L'immagine dell'anteprima e la colonna che la contiene, misurate. */
const MISURE = (i) => `(()=>{
  const f=document.querySelectorAll('#noteHost .figura')[${i}]; if(!f) return null;
  const im=f.querySelector('img'); if(!im || !im.naturalWidth) return null;
  return { img:Math.round(im.getBoundingClientRect().width),
           colonna:Math.round(f.getBoundingClientRect().width),
           naturale:im.naturalWidth,
           misurata:f.classList.contains('misurata') }; })()`;

(async () => {
  await collega();
  await val('location.reload(), 1'); await pausa(2000);
  await collega(); await pausa(800);
  await partiPulito();

  /* ⚠️ Il banco si prende com'era e si rimette com'era: questa prova passa in
     modalità zaino, e senza rimettere le cose a posto il rosso lo prendono le
     prove dopo. È già successo (PIANO-FOTO §2). */
  const bancoPrima = await val('JSON.stringify(bancoStato())');
  const modoPrima = await val('modoAttivo()');

  await val(`(async()=>{ await cambiaModo('zaino'); await zainoCrea('Zaino misura'); return 1; })()`);
  await finoA(`zainoAttivo() ? 1 : 0`, 12000);
  await pausa(600);
  const corso = await val('corsoAttivo()');

  sezione('Un\'immagine grande entra nell\'appunto');
  await apriStrumento('foto');
  await pausa(400);
  /* 1400px di lato lungo: più larga di qualunque colonna, che è il caso vero —
     una foto da telefono entra a 3000. */
  await val(`(async()=>{
    const c=document.createElement('canvas'); c.width=1400; c.height=900;
    const g=c.getContext('2d'); g.fillStyle='#2f8f83'; g.fillRect(0,0,1400,900);
    const b=await new Promise(r=>c.toBlob(r,'image/png'));
    await fotoTrascinate([ new File([b], 'Panorama.png', { type:'image/png' }) ]);
    return 1; })()`);
  const voci = await finoA(`(()=>{ const v=(window.vault.album.elenco(${JSON.stringify(corso)},'foto').voci||[]);
    return v.length ? v : null; })()`, 25000);
  ok('l\'immagine è nell\'archivio', 1, (voci || []).length);
  const id = (voci || [{}])[0].id;

  await apriStrumento('appunti');
  await pausa(400);
  await val(`noteNew(null, null, ''), 1`);
  await pausa(900);
  const modale = await val(`(()=>{ const i=document.getElementById('umInput');
    if(!i || !document.querySelector('#uiModal[open]')) return 0; i.value='Prova misura'; return 1; })()`);
  if (modale) await val(`(()=>{ document.getElementById('umOk').click(); return 1; })()`);
  await finoA('(NOTES.cur && NOTES.mde) ? 1 : 0', 12000);
  await pausa(500);

  await val(`albumAzione('appunti', ${JSON.stringify(id)}), 1`);
  await pausa(700);
  await val('albumChiudiMenu(), 1');
  ok('nell\'appunto c\'è il rimando all\'immagine', true,
    (await val('NOTES.mde.codemirror.getValue()')).indexOf('album:' + id) >= 0);

  sezione('⚠️ Il tetto: l\'anteprima non si fa sfondare');
  await val('NOTES.mde.togglePreview(), 1');
  await pausa(500);
  await val('noteAnteprimaRidisegna(), 1');
  const m0 = await finoA(MISURE(0), 15000);
  ok('la figura c\'è, e l\'immagine è grande davvero', 1400, m0 && m0.naturale);
  console.log('   immagine ' + (m0 && m0.img) + 'px in una colonna da ' + (m0 && m0.colonna) + 'px');
  /* ⚠️ È QUESTO il difetto che il lavoro chiude: prima di oggi qui c'erano
     1400px dentro una colonna da poche centinaia. Un pixel di tolleranza per
     l'arrotondamento del bordo. */
  ok('l\'immagine non è più larga della colonna', true, !!m0 && m0.img <= m0.colonna + 1);
  ok('e non porta ancora nessuna misura', false, m0 && m0.misurata);

  sezione('Il menu si apre col tasto destro sulla figura');
  ok('l\'evento è arrivato a una figura', 1, await val(TASTO_DESTRO(0)));
  await pausa(300);
  const menu = await val(`(()=>{ const m=document.getElementById('figMenu');
    return { aperto:m.classList.contains('open'),
             voci:[...m.querySelectorAll('[data-fig]')].map(b=>b.getAttribute('data-fig')),
             testa:(m.querySelector('.ctx-head')||{}).textContent||'' }; })()`);
  ok('il menu è aperto', true, menu.aperto);
  ok('con le sue quattro voci', ['album', '-', '0', '+'], menu.voci);
  ok('e la testata dice che una misura non c\'è', true, /misura sua/.test(menu.testa));

  sezione('«Più stretta»: la misura si scrive, e si vede');
  ok('il tasto ha risposto', 1, await val(PREMI('-')));
  await pausa(400);
  const testo1 = await val('NOTES.mde.codemirror.getValue()');
  console.log('   markdown: ' + JSON.stringify(testo1.trim().split('\n').filter((r) => /album:/.test(r))[0]));
  ok('la didascalia porta la misura', true, /\|\d{1,3}%\]\(album:/.test(testo1));
  /* ⚠️ Il rimando esce identico: è la stringa con cui `album.usi` sa in quanti
     posti l'immagine è citata. Se cambiasse, cancellarla diventerebbe un gesto
     silenzioso. */
  ok('e il rimando non è stato toccato', true, testo1.indexOf('(album:' + id + ')') >= 0);
  /* ⚠️ Si salva e si guarda IL FILE, non l'editor. `album.usi` legge gli appunti
     da disco (è così che sa se cancellare un'immagine è un gesto silenzioso), e
     l'appunto in memoria non gli dice niente: chiedendoglielo prima
     dell'autosave rispondeva «nessun uso» — che qui sarebbe un verde mancato
     per un motivo che col lavoro non c'entra. */
  await val('noteSave(true), 1');
  const usi = await finoA(`(()=>{ const u=window.vault.album.usi(${JSON.stringify(corso)}, ${JSON.stringify(id)});
    return (u && u.appunti && u.appunti.length) ? u.appunti.length : null; })()`, 8000);
  ok('con la misura scritta, il file su disco dice ancora che l\'immagine è usata', 1, usi);

  const m1 = await finoA(MISURE(0), 8000);
  ok('la figura si dichiara misurata', true, !!m1 && m1.misurata);
  console.log('   → ' + (m1 && m1.img) + 'px su ' + (m1 && m1.colonna) + 'px di colonna');
  ok('ed è più stretta di prima', true, !!m1 && !!m0 && m1.img < m0.img);

  sezione('Il menu resta aperto e conta a ogni passo, come sulla mappa');
  const testa1 = await val("(document.querySelector('#figMenu .ctx-head')||{}).textContent||''");
  ok('la testata dice la misura di adesso', true, /\d+% della colonna/.test(testa1));
  await val(PREMI('-')); await pausa(400);
  const testo2 = await val('NOTES.mde.codemirror.getValue()');
  const p1 = parseInt((/\|(\d+)%\]/.exec(testo1) || [, 0])[1], 10);
  const p2 = parseInt((/\|(\d+)%\]/.exec(testo2) || [, 0])[1], 10);
  console.log('   ' + p1 + '% → ' + p2 + '%');
  ok('un secondo passo stringe ancora', true, p2 > 0 && p2 < p1);
  ok('e non se ne accodano due', 1, (testo2.match(/\|\d+%/g) || []).length);

  sezione('«Com\'era» toglie la misura, invece di scrivere 100%');
  await val(PREMI('0')); await pausa(400);
  const testo3 = await val('NOTES.mde.codemirror.getValue()');
  ok('la misura è sparita', false, /\|\d+%\]\(album:/.test(testo3));
  ok('e non è stata sostituita da un 100%', false, /100%/.test(testo3));
  ok('il rimando è ancora quello', true, testo3.indexOf('(album:' + id + ')') >= 0);

  sezione('⚠️ La stessa immagine due volte: si tocca quella che si è toccata');
  /* È il controllo che in Node non si può fare: l'occorrenza si conta DAL DOM,
     e il conto giusto è quello dentro il blocco. */
  await val(`(()=>{ const cm=NOTES.mde.codemirror;
    cm.setValue('![Panorama](album:${id}) e poi ![Panorama](album:${id})');
    return 1; })()`);
  await pausa(300);
  await val('noteAnteprimaRidisegna(), 1');
  await finoA(MISURE(1), 10000);
  ok('nell\'anteprima ci sono due figure', 2,
    await val("document.querySelectorAll('#noteHost .figura').length"));
  await val(TASTO_DESTRO(1)); await pausa(300);
  await val(PREMI('-')); await pausa(400);
  const due = await val('NOTES.mde.codemirror.getValue()');
  console.log('   ' + JSON.stringify(due));
  ok('la seconda ha preso la misura', true, /e poi !\[Panorama\|\d+%\]/.test(due));
  ok('e la prima è rimasta com\'era', true, /^!\[Panorama\]\(album:/.test(due));

  sezione('«Mostra nell\'album» è la stessa strada del click sull\'immagine');
  await val(TASTO_DESTRO(0)); await pausa(300);
  await val(PREMI('album')); await pausa(700);
  ok('il menu si è chiuso', false,
    await val("document.getElementById('figMenu').classList.contains('open')"));
  ok('e la griglia delle immagini è quella accesa', true, await val("bancoVisibile('foto')"));

  sezione('E si rimette tutto com\'era');
  await val(`(async()=>{ await cambiaModo(${JSON.stringify(modoPrima)}); return 1; })()`);
  await pausa(700);
  await val('(()=>{ BANCO.stato=JSON.parse(' + JSON.stringify(bancoPrima) + ');' +
    ' bancoSalva(); bancoDisegna(); bancoApplicaFrazioni(); bancoPosizionaDivisori();' +
    ' bancoDopoLayout(); return 1; })()');
  await pausa(600);
  ok('si torna da dove si era partiti', modoPrima, await val('modoAttivo()'));
  ok('e il banco è quello di prima', bancoPrima, await val('JSON.stringify(bancoStato())'));

  console.log(ko ? `\n✗ ${ko} controlli falliti` : '\n✓ tutti i controlli passati');
  process.exit(ko ? 1 : 0);
})();
