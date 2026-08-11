/* I rimandi fra lezioni, dalla porta principale: il mouse sul link, e vediamo
 * dove si finisce.
 *
 * Che cosa si prova. Una lezione ha due nomi — la base `04-delegation` e la
 * cartella che la contiene davvero, `04-delegation--scaletta-a`. Il testo cita
 * sempre la base, perché è l'identità che sopravvive al cambio di percorso; la
 * cartella la sceglie il percorso attivo. Fra i due c'era un buco, e otto
 * rimandi su dieci di questo corso morivano con «Lezione non trovata».
 *
 * ⚠️ Perché il click deve essere vero e non un `.click()` sull'elemento. Il
 * gestore è delegato sul documento e passa da `closest()`: un evento sintetico
 * mandato direttamente sul nodo lo raggiungerebbe comunque, e la prova
 * passerebbe anche se il link fosse coperto da un pannellino o dal binario di
 * avanzamento — che è esattamente il guasto 5.7 di ieri. Qui il puntatore va
 * dove va quello dell'utente, e prima si controlla che `elementFromPoint`
 * confermi il bersaglio: se sotto il dito c'è altro, questa prova lo dice invece
 * di accusare la risoluzione dei rimandi.
 *
 *   ./test/cdp/con-vault-di-prova.sh prova-wikilink.js
 */
const S = require('path').join(__dirname, 'cdp.js');
const { collega, val, invia, pausa, partiPulito } = require(S);

let ko = 0;
function ok(n, atteso, avuto) {
  const a = JSON.stringify(atteso), b = JSON.stringify(avuto);
  if (a === b) { console.log('  ok  ' + n); return; }
  ko++; console.log('  KO  ' + n + '\n      atteso ' + a + '\n      avuto  ' + b);
}
function sezione(t) { console.log('\n== ' + t); }

/* Il primo rimando che l'utente potrebbe davvero sfiorare: visibile, dentro la
   finestra, e con `elementFromPoint` che conferma il bersaglio. Torna anche il
   punto dove cliccare, così il click non ricalcola una geometria che nel
   frattempo può essere scorsa.
   ⚠️ `getClientRects()[0]`, non `getBoundingClientRect()`. Un rimando è lungo e
   va a capo: di un inline spezzato su due righe il riquadro complessivo UNISCE
   le due, e il suo centro cade nel bianco fra la fine della prima riga e
   l'inizio della seconda — cioè sul paragrafo. La prima volta questa prova ha
   accusato la risoluzione dei rimandi per un difetto della propria mira. */
const TROVA_LINK = `(()=>{
  const a=[...document.querySelectorAll('#content a.wlink')][0];
  if(!a) return null;
  const rs=[...a.getClientRects()].filter(r=>r.width>4 && r.height>4);
  const r=rs[0] || a.getBoundingClientRect();
  const x=Math.round(r.left+Math.min(r.width/2, 40)), y=Math.round(r.top+r.height/2);
  const sotto=document.elementFromPoint(x,y);
  return { target:a.getAttribute('data-lesson'), testo:a.textContent, righe:rs.length,
           x, y, coperto: !(sotto && sotto.closest && sotto.closest('a.wlink')===a),
           sotto: sotto ? (sotto.id || sotto.className || sotto.tagName) : null };
})()`;

(async () => {
  await collega();

  /* Il corso con le varianti è quello che serve: TD74-DSA non ne ha, e su di lui
     questa prova sarebbe verde senza provare niente. */
  await val(`(()=>{ try{ localStorage.setItem('studia.corso','ai-literacy-anthropic'); }catch(e){} return 1; })()`);
  await val('location.reload(), 1'); await pausa(1800);
  await collega(); await pausa(600);
  await partiPulito();
  /* ⚠️ Il banco a un blocco solo, che è come si legge un capitolo. Le prove
     girano una dopo l'altra sulla stessa istanza e quella prima lascia il banco
     come l'ha usato: con più blocchi il divisore (`bDivRiga`) è una maniglia
     stesa sopra il testo, e un rimando che gli capita sotto non riceve il
     click. Da sola questa prova passava, in coda alle altre no — e il rosso
     avrebbe accusato la risoluzione dei rimandi per una tenda altrui. */
  await val(`(()=>{ try{ bancoForma('uno'); }catch(e){} return 1; })()`);
  await pausa(500);

  sezione('Il corso a varianti è caricato, e le sue lezioni hanno due nomi');
  const stato = await val(`(()=>{
    const ids=Object.keys(LESSONS).filter(id=>(VAULT_META[id]||{}).courseId==='ai-literacy-anthropic');
    return { caricate:ids.length,
             conVariante:ids.filter(id=>(VAULT_META[id]||{}).variante).length,
             basiCaricate:ids.filter(id=>id===(VAULT_META[id]||{}).base).length }; })()`);
  if (!stato.caricate) {
    console.log('  -- corso «ai-literacy-anthropic» assente dalla copia di prova: niente da provare');
    process.exit(0);
  }
  ok('le lezioni caricate sono varianti', stato.caricate, stato.conVariante);
  /* Il fatto strutturale da cui nasce tutto: la cartella BASE non è caricata —
     `preload.js` scarta le cartelle senza capitoli. Cercarla per nome esatto,
     come faceva il gestore, non poteva funzionare. */
  ok('e nessuna cartella base è fra le chiavi di LESSONS', 0, stato.basiCaricate);

  sezione('Un rimando cliccato col mouse porta alla lezione giusta');
  /* Si cerca il primo capitolo che contiene un rimando, scorrendo dalla porta
     vera (`go`), non montando il DOM a mano. */
  const dove = await val(`(async()=>{
    for(const id of Object.keys(LESSONS)){
      if((VAULT_META[id]||{}).courseId!=='ai-literacy-anthropic') continue;
      loadLesson(id);
      for(let i=0;i<LESSON.chapters.length;i++){
        go(i); await new Promise(r=>setTimeout(r,60));
        const a=document.querySelector('#content a.wlink');
        if(a) return { lezione:id, capitolo:i, target:a.getAttribute('data-lesson') };
      }
    }
    return null; })()`);
  if (!dove) {
    console.log('  -- nessun rimando [[…]] in questo corso: niente da cliccare');
    process.exit(ko ? 1 : 0);
  }
  console.log('   ' + dove.lezione + ' · capitolo ' + (dove.capitolo + 1) + ' → [[' + dove.target + ']]');
  /* Prima si porta il link a schermo, POI lo si misura: misurare nello stesso
     giro in cui si chiede di scorrere dà le coordinate di prima dello scorrimento. */
  await val(`(()=>{ const a=document.querySelector('#content a.wlink');
    if(a) a.scrollIntoView({block:'center'}); return 1; })()`);
  await pausa(400);

  const link = await val(TROVA_LINK);
  ok('il rimando è a schermo e scoperto', false, link.coperto);
  if (link.coperto) console.log('      sotto il puntatore c\'è: ' + link.sotto);

  /* La destinazione attesa la si calcola dai dati, non la si scrive a mano: è
     la lezione caricata la cui BASE è il target. Se il corso cambia, la prova
     resta vera. */
  const atteso = await val(`(()=>{ const t=${JSON.stringify(dove.target)};
    return Object.keys(LESSONS).filter(id=>{ const m=VAULT_META[id]||{};
      return m.courseId==='ai-literacy-anthropic' && m.base===t; }); })()`);
  ok('sul disco quella lezione esiste, in una o più varianti', true, atteso.length > 0);

  await val(`(()=>{ const t=document.getElementById('toast'); if(t) t.className='toast'; return 1; })()`);
  const prima = await val('LESSON.id');
  for (const type of ['mousePressed', 'mouseReleased']) {
    await invia('Input.dispatchMouseEvent', { type, x: link.x, y: link.y, button: 'left', clickCount: 1 });
  }
  await pausa(700);

  const dopo = await val(`(()=>{ const t=document.getElementById('toast');
    return { lezione:LESSON.id, toast:(t&&/show/.test(t.className))?t.textContent:'' }; })()`);
  ok('la lezione aperta è cambiata', true, dopo.lezione !== prima);
  ok('ed è una variante della lezione citata', true, atteso.indexOf(dopo.lezione) >= 0);
  ok('nessun «Lezione non trovata»', '', dopo.toast);

  sezione('E la tendina non resta indietro');
  /* Se la lezione aperta non è fra le opzioni, l'app mostra un capitolo che il
     menu non contiene: è lo stesso difetto di `searchGoto`, e qui si vedrebbe. */
  ok('la tendina delle lezioni indica quella aperta', true,
    await val(`(()=>{ const s=document.getElementById('lessonSelect');
      return !!s && s.value===LESSON.id; })()`));

  sezione('La ricerca resta dentro il percorso che si sta studiando');
  /* Stessa regola dei rimandi: una lezione, una versione per volta. Se l'indice
     prendesse anche le varianti non scelte, la stessa lezione comparirebbe più
     volte con lo STESSO titolo — le varianti lo condividono per costruzione — e
     aprire il risultato sbagliato porterebbe su una lezione che la tendina non
     contiene. */
  const ric = await val(`(()=>{ searchBuild();
    const visibili=new Set(lezioniOrdinati().map(c=>c.id));
    const dentro=SEARCH.docs.map(d=>d.lessonId);
    return { doc:dentro.length, fuori:[...new Set(dentro.filter(id=>!visibili.has(id)))],
             lezioniIndicizzate:new Set(dentro).size, visibili:visibili.size }; })()`);
  ok('nessun capitolo di una variante fuori percorso', [], ric.fuori);
  ok('e le lezioni indicizzate non superano quelle visibili', true,
    ric.lezioniIndicizzate <= ric.visibili);

  sezione('Un rimando verso il nulla resta rotto, e lo dice');
  const finto = await val(`(()=>{
    const t=document.getElementById('toast'); if(t) t.className='toast';
    const lid=risolviLezione('99-mai-scritta',{ lezioni:LESSONS, meta:VAULT_META,
      scelte:cartellePercorso(), corso:corsoAttivo() });
    return lid; })()`);
  ok('nessuna lezione inventata per un nome che non esiste', null, finto);

  console.log('');
  console.log(ko ? '✗ ' + ko + ' controlli falliti' : '✓ tutti i controlli passati');
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('✗ ' + e.message); process.exit(1); });
