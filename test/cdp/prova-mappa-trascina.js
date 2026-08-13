/* Trascinare un nodo, e la cornice che non deve muoversi.
 *
 * ⚠️ Perché esiste. Il gesto centrale dell'editor — prendere una card e
 * metterla dove serve — non aveva NESSUNA prova, né qui né fra le unità. E
 * proprio lì stava un anello che si autoalimentava: il `viewBox` dell'SVG si
 * rifà dal rettangolo che contiene tutti i nodi, a ogni ridisegno, cioè a ogni
 * `pointermove`; ma il trascinamento campiona il punto di partenza in
 * coordinate di quel `viewBox`. Nodo che esce → cornice più grande → tutto
 * rimpicciolisce → lo stesso pixel di mouse vale più unità di mappa → il nodo
 * corre di più. Finiva con la mappa ridotta a un francobollo e nessuna strada
 * per tornare, perché ⤢ agisce sullo zoom dell'utente e il disastro era nella
 * cornice.
 *
 * Qui si misura la regola nuova: **la cornice si rifà quando cambia la
 * struttura, non quando la mano sistema le posizioni** — e ⤢ la rifà apposta.
 *
 *   ./test/cdp/con-vault-di-prova.sh prova-mappa-trascina.js
 */
const path = require('path');
const S = path.join(__dirname, 'cdp.js');
const { collega, invia, val, clicca, pausa, partiPulito, apriStrumento } = require(S);

let ko = 0;
function ok(n, atteso, avuto) {
  const a = JSON.stringify(atteso), b = JSON.stringify(avuto);
  if (a === b) { console.log('  ok  ' + n); return; }
  ko++; console.log('  KO  ' + n + '\n      atteso ' + a + '\n      avuto  ' + b);
}
function sezione(t) { console.log('\n== ' + t); }

async function finoA(expr, quanto) {
  const fine = Date.now() + (quanto || 10000);
  for (;;) {
    const v = await val(expr);
    if (v) return v;
    if (Date.now() > fine) return null;
    await pausa(200);
  }
}

/** La larghezza della cornice: è il numero che cresceva sotto la mano. */
const larghezzaRiquadro = () => val(`(()=>{ const s=document.getElementById('mappaSvg');
  const vb=(s.getAttribute('viewBox')||'').split(/[\\s,]+/).map(Number);
  return (vb.length===4 && vb[2]>0) ? vb[2] : 0; })()`);

/** Il centro di una card, in pixel di schermo. */
const centroNodo = (id) => val(`(()=>{ const n=document.querySelector('#mappaSvg .mnodo[data-id="'+${JSON.stringify(id)}+'"]');
  if(!n) return null; const r=n.getBoundingClientRect();
  return { x:Math.round(r.left+r.width/2), y:Math.round(r.top+r.height/2) }; })()`);

/** Un trascinamento vero, a passi: è il movimento continuo a innescare l'anello. */
async function trascina(da, aX, aY, passi) {
  await invia('Input.dispatchMouseEvent', { type: 'mousePressed', x: da.x, y: da.y, button: 'left', clickCount: 1 });
  const n = passi || 12;
  for (let i = 1; i <= n; i++) {
    await invia('Input.dispatchMouseEvent', {
      type: 'mouseMoved', button: 'left', buttons: 1,
      x: Math.round(da.x + (aX - da.x) * i / n), y: Math.round(da.y + (aY - da.y) * i / n)
    });
    await pausa(30);
  }
  await invia('Input.dispatchMouseEvent', { type: 'mouseReleased', x: aX, y: aY, button: 'left', clickCount: 1 });
  await pausa(400);
}

(async () => {
  await collega();
  await partiPulito();
  /* ⚠️ La mappa da SOLA nel banco: la sua barra nasconde i bottoni lunghi
     quando il blocco è stretto (container query), e ⤢ — che qui è metà della
     prova — sparirebbe. Il rosso direbbe «non cliccabile», cioè accuserebbe il
     bottone invece della larghezza. */
  await val(`(()=>{ try{ bancoForma('uno'); }catch(e){} return 1; })()`);
  await pausa(300);
  await apriStrumento('mappa');
  await pausa(600);

  sezione('Una mappa «Mie» con dentro qualcosa da spostare');
  await clicca('#mRegistro button[data-reg="mie"]'); await pausa(700);
  await clicca('#mNuova'); await pausa(400);
  await val("document.querySelector('#umInput').value='Prova trascinamento'");
  await clicca('#umOk'); await pausa(1400);
  const file = await val('MAPPA.mia.file');
  ok('la mappa di prova esiste', true, !!file);
  /* tre nodi, così la cornice ha una dimensione sua e il primo nodo non è
     tutta la mappa */
  await val(`(()=>{ const g=MAPPA.mia.grafo;
    g.nodi.push({ id:'t2', testo:'Secondo', x:220, y:0 });
    g.nodi.push({ id:'t3', testo:'Terzo', x:-220, y:0 });
    mappaTocca(); mappaRidisegna(); return 1; })()`);
  await pausa(600);
  const idPrimo = await val('MAPPA.mia.grafo.nodi[0].id');
  ok('ci sono tre nodi', 3, await val('MAPPA.mia.grafo.nodi.length'));

  sezione('⚠️ Trascinando, la cornice NON si allarga sotto la mano');
  const prima = await larghezzaRiquadro();
  ok('la cornice di partenza ha una misura', true, prima > 0);
  const c = await centroNodo(idPrimo);
  ok('la card si trova a schermo', true, !!c);
  /* verso il bordo destro-basso del riquadro della mappa: è il gesto che
     faceva esplodere tutto */
  const box = await val(`(()=>{ const r=document.getElementById('mappaSvg').getBoundingClientRect();
    return { x:Math.round(r.right-12), y:Math.round(r.bottom-12) }; })()`);
  await trascina(c, box.x, box.y, 16);
  const dopo = await larghezzaRiquadro();
  console.log('   cornice: ' + prima + ' → ' + dopo);
  ok('la cornice è rimasta quella di prima', prima, dopo);
  ok('e il nodo si è mosso davvero', true,
    await val(`(()=>{ const n=MAPPA.mia.grafo.nodi.filter(x=>x.id===${JSON.stringify(idPrimo)})[0];
      return !!n && Number.isFinite(n.x) && Math.abs(n.x)>10; })()`));
  ok('il nodo è ancora disegnato', true,
    await val(`!!document.querySelector('#mappaSvg .mnodo[data-id="'+${JSON.stringify(idPrimo)}+'"]')`));

  sezione('«Adatta alla vista» è la via di casa: la cornice si rifà, e tutto rientra');
  /* ⚠️ Si passa dal MENU e non dal bottone ⤢ in barra: la barra della mappa
     nasconde i bottoni lunghi sotto i 560px di blocco (`@container mappa`), e
     nella finestra di prova il bottone non è cliccabile. La voce di menu è
     l'altra porta vera dello stesso comando — «una voce senza gesto è
     legittima, un gesto senza voce no», dice il codice del menu — quindi la
     promessa si misura lo stesso, senza fingere di premere qualcosa. */
  await val(`(()=>{ const s=document.getElementById('mappaSvg');
    const r=s.getBoundingClientRect();
    const x=Math.round(r.left+18), y=Math.round(r.top+18);
    document.elementFromPoint(x,y).dispatchEvent(
      new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:x,clientY:y}));
    return 1; })()`);
  await pausa(400);
  ok('il menu della mappa si apre', true,
    await val(`!!document.querySelector('#mapMenu .ctx-item[data-az="adatta"]')`));
  await clicca('#mapMenu .ctx-item[data-az="adatta"]'); await pausa(700);
  const casa = await larghezzaRiquadro();
  console.log('   cornice dopo ⤢: ' + casa);
  ok('la cornice si è ricalcolata', true, casa !== dopo);
  ok('e adesso contiene tutti i nodi', true,
    await val(`(()=>{ const s=document.getElementById('mappaSvg');
      const vb=(s.getAttribute('viewBox')||'').split(/[\\s,]+/).map(Number);
      if(vb.length!==4) return false;
      return (MAPPA.mia.grafo.nodi||[]).every(function(n){
        const p=MAPPA.res && MAPPA.res.pos && MAPPA.res.pos[n.id];
        return !p || (p.x>=vb[0]-1 && p.x<=vb[0]+vb[2]+1 && p.y>=vb[1]-1 && p.y<=vb[1]+vb[3]+1); }); })()`));
  ok('e lo zoom dell\'utente è tornato a riposo', [1, 0, 0],
    await val('[MAPPA.z.k, MAPPA.z.x, MAPPA.z.y]'));

  sezione('Un nodo NUOVO invece riapre la cornice: la struttura è cambiata');
  const primaDelNodo = await larghezzaRiquadro();
  await val(`(()=>{ MAPPA.mia.grafo.nodi.push({ id:'t4', testo:'Quarto', x:1400, y:900 });
    mappaTocca(); mappaRidisegna(); return 1; })()`);
  await pausa(500);
  const conNodo = await larghezzaRiquadro();
  console.log('   cornice: ' + primaDelNodo + ' → ' + conNodo);
  ok('la cornice si è allargata per farlo entrare', true, conNodo > primaDelNodo);

  sezione('⚠️ Il VERSO cambia davvero anche su una mappa tua');
  /* Su una mappa «Mie» ogni nodo ha una posizione a mano — gliel'ha data chi
     l'ha creato o trascinato — e il motore non può muovere ciò che è fissato:
     premere TD/SX cambiava la leva e lasciava il disegno identico. Un comando
     acceso che non fa niente. Adesso il verso ridispone, come il cambio
     motore: azzera le posizioni a mano, lo dice, e ⌘Z le rimette. */
  const fissatiPrima = await val(`MAPPA.mia.grafo.nodi.filter(function(n){
    return Number.isFinite(n.x) && Number.isFinite(n.y); }).length`);
  ok('i nodi hanno posizioni a mano', true, fissatiPrima > 0);
  const posPrima = await val(`JSON.stringify(MAPPA.res.pos)`);
  const versoPrima = await val(`MAPPA.vista.orient`);
  /* si preme il verso OPPOSTO a quello attuale, dal bottone vero */
  /* i due versi si chiamano `td` (dall'alto) e `lr` (da sinistra): il secondo
     NON è «sx», e chiederlo col nome sbagliato faceva morire la prova su un
     bottone che non esiste */
  const altro = versoPrima === 'lr' ? 'td' : 'lr';
  await clicca('#mOrient button[data-orient="' + altro + '"]');
  await pausa(900);
  ok('il verso è cambiato', true, (await val('MAPPA.vista.orient')) !== versoPrima);
  ok('le posizioni a mano sono state azzerate, non ignorate', 0,
    await val(`MAPPA.mia.grafo.nodi.filter(function(n){
      return Number.isFinite(n.x) && Number.isFinite(n.y); }).length`));
  ok('e il disegno si è davvero ridisposto', true,
    (await val(`JSON.stringify(MAPPA.res.pos)`)) !== posPrima);
  /* ⌘Z: la sistemazione a mano si può riprendere, o il comando sarebbe una
     porta a senso unico su mezz'ora di lavoro */
  await val(`mappaAnnulla()`);
  await pausa(700);
  ok('⌘Z rimette le posizioni a mano', fissatiPrima,
    await val(`MAPPA.mia.grafo.nodi.filter(function(n){
      return Number.isFinite(n.x) && Number.isFinite(n.y); }).length`));

  sezione('Pulizia: quello che questa prova ha creato, questa prova lo toglie');
  await val(`(()=>{ if(window.vault && window.vault.mappe) window.vault.mappe.rimuovi(corsoAttivo(), ${JSON.stringify(file)}); return 1; })()`);
  await pausa(400);
  await val(`mappaRegistro('generata')`).catch(() => {});
  await pausa(300);

  console.log(ko ? '\n✗ ' + ko + ' controlli falliti' : '\n✓ tutti i controlli passati');
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error('la prova è morta:', e.message); process.exit(1); });
