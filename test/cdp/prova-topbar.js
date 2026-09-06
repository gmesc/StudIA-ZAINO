/* La topbar su una riga sola: dalla porta principale.
 *
 * Che cosa promette questo lavoro: tutti i comandi accanto al logo, su UNA riga,
 * e nessuna informazione persa per strada. Le tre tendine dicono la funzione
 * («Lezione»), non il contenuto — il titolo lo scrive già il capitolo nel suo
 * `.kicker` — e ciò che è scelto si legge nel `title`, passandoci sopra.
 *
 * ⚠️ Il controllo che conta più di tutti è che il click sul bottone della
 * ricerca **lasci aperto** il pannellino. È il guasto 10.3.3, già pagato due
 * volte in questo progetto: il gestore che chiude i pannellini quando si clicca
 * «fuori» corre prima, e senza nominare l'apritore lo chiuderebbe nello stesso
 * gesto che lo apre. Un controllo che guardasse solo «si apre?» passerebbe
 * anche con la barra rotta.
 *
 *   ./test/cdp/con-vault-di-prova.sh prova-topbar.js
 */
const S = require('path').join(__dirname, 'cdp.js');
const { collega, val, clicca, pausa } = require(S);

let ko = 0;
function ok(n, atteso, avuto) {
  const a = JSON.stringify(atteso), b = JSON.stringify(avuto);
  if (a === b) { console.log('  ok  ' + n); return; }
  ko++; console.log('  KO  ' + n + '\n      atteso ' + a + '\n      avuto  ' + b);
}
function sezione(t) { console.log('\n== ' + t); }

(async () => {
  await collega();
  await val('location.reload(), 1'); await pausa(1600);
  await collega(); await pausa(600);

  sezione('Tutto su una riga con il logo');
  const barra = await val(`(()=>{ const h=document.querySelector('header.topbar');
    const pezzi=[...h.querySelectorAll('.brand, .controls > *')].filter(e=>e.getBoundingClientRect().width>0);
    /* ⚠️ Il CENTRO, non il bordo alto. Da quando la testata è una barra degli
       strumenti ci sono dentro pezzi di altezze diverse — le barrette fra i
       gruppi sono alte 16, i bottoni 33 — e allineati al centro il loro bordo
       superiore è diverso pur stando sulla stessa riga: misurato dai bordi,
       questo controllo contava due righe dove ce n'è una sola.
       (E niente apici inversi qui dentro: è un template letterale.) */
    const righe=new Set(pezzi.map(e=>{const r=e.getBoundingClientRect();
      return Math.round((r.top+r.bottom)/2/8);}));
    return { righe:righe.size, altezza:Math.round(h.getBoundingClientRect().height),
             pezzi:pezzi.map(e=>e.id||e.className) }; })()`);
  console.log('   ' + barra.pezzi.join(' · '));
  ok('una riga sola', 1, barra.righe);
  ok('e la barra resta bassa', true, barra.altezza < 90);

  sezione('Appunti e Mappe escono dalla barra, ma non dall’app');
  ok('i due bottoni non ci sono più', [null, null],
    await val("[document.querySelector('#editorBtn'), document.querySelector('#mappaBtn')]"));
  /* La porta che resta: la tendina di un blocco. Se un giorno sparisse anche
     quella, gli appunti e la mappa diventerebbero irraggiungibili — ed è il
     motivo per cui questo controllo sta qui e non nel commento di un commit. */
  ok('ogni blocco può ancora scegliere Appunti e Mappa', true,
    await val(`(()=>{ const s=document.querySelector('select.bsel'); if(!s) return false;
      const v=[...s.options].map(o=>o.value);
      return v.indexOf('appunti')>=0 && v.indexOf('mappa')>=0; })()`));

  sezione('Le tendine dicono la funzione; quel che è scelto sta nel title');
  /* ⚠️ …e quali siano le etichette lo decide la MODALITÀ, non il codice di
     ieri: nel fork ZAINO la fila visibile è una sola tendina, «Zaino». Il
     controllo resta lo stesso — le tendine dicono la FUNZIONE, non il titolo
     di ciò che è scelto — ma l'atteso se lo fa dire dall'app. */
  ok('le etichette sono le funzioni',
    await val(`modoAttivo()==='zaino' ? ['Zaino'] : ['Corso','Percorso','Lezione']`),
    /* ⚠️ Ristretto alla TOPBAR. `.tendina` non è più solo sua: lo stesso guscio
       avvolge ora le tendine del banco, della mappa e degli appunti, dove
       l'etichetta è VIVA e dice che cosa è scelto. Cercarlo in tutta la pagina
       vorrebbe dire misurare quelle e accusare questa.
       ⚠️ E ristretto a quelle A SCHERMO: nella topbar convivono due file di
       tendine — quella dei corsi e quella dello ZAINO — e ne è visibile una
       sola, secondo la modalità. Contarle tutte vorrebbe dire accusare questa
       fila per una tendina che appartiene all'altra metà dell'app. */
    await val(`Array.from(document.querySelectorAll('header.topbar .tendina'))
      .filter(t=>t.getBoundingClientRect().height>0)
      .map(t=>{ const l=t.querySelector('.tlab'); return l?l.textContent:''; })`));
  ok('il guscio del corso sparisce quando il suo menu è nascosto', true,
    await val(`(()=>{ const s=document.querySelector('#projTopSelect');
      s.hidden=true; const via=getComputedStyle(s.closest('.tendina')).display==='none';
      s.hidden=false; const torna=getComputedStyle(s.closest('.tendina')).display!=='none';
      s.hidden=!s.options.length; return via && torna; })()`));
  ok('la lezione scelta si legge nel title della sua tendina', true,
    await val(`(()=>{ const s=document.querySelector('#lessonSelect');
      return !!s.title && s.title===s.options[s.selectedIndex].text; })()`));
  /* Nel fork non ci sono lezioni da elencare: si prova che il menu è quello di
     SISTEMA (un `select` vero, non un pannellino disegnato), che è ciò che il
     controllo voleva dire. Dove le lezioni ci sono, si chiede anche quelle. */
  ok('e il menu che si apre è ancora quello di sistema', true,
    await val(`(()=>{ const s=document.querySelector('#lessonSelect');
      if(!s) return false;
      return modoAttivo()==='zaino' ? s.tagName==='SELECT' : s.options.length > 1; })()`));

  sezione('A− e A+ in un chip solo, delle misure di chiaro/scuro');
  const chip = await val(`(()=>{ const g=document.querySelector('.chipgroup'), t=document.querySelector('#themeToggle');
    const a=g.getBoundingClientRect(), b=t.getBoundingClientRect();
    return { unSoloChip: g.querySelectorAll('button').length===2,
             stessaAltezza: Math.round(a.height)===Math.round(b.height),
             stessaRiga: Math.round(a.top)===Math.round(b.top) }; })()`);
  ok('due bottoni dentro un chip', true, chip.unSoloChip);
  ok('stessa altezza del chip chiaro/scuro', true, chip.stessaAltezza);
  ok('e sulla stessa riga', true, chip.stessaRiga);
  /* ⚠️ Si misura il CORPO VERO del testo, non la stringa della variabile: la
     pagina parte con `--fs:17px` e i due tasti la riscrivono in `rem`, quindi
     tornare al punto di partenza dà «1.06rem» e non «17px» — stessa dimensione,
     stringa diversa. Misurato: 17px → 18,24px → 16,96px, dove lo 0,04 è
     l'arrotondamento del rem. Un controllo sulla stringa avrebbe accusato l'app
     di un guasto che non ha. */
  const corpo = () => val('getComputedStyle(document.body).fontSize');
  const fs0 = parseFloat(await corpo());
  await clicca('#fsPlus'); await pausa(200);
  const su = parseFloat(await corpo());
  ok('A+ ingrandisce ancora il testo', true, su > fs0);
  await clicca('#fsMinus'); await pausa(200);
  const giu = parseFloat(await corpo());
  ok('e A− lo riporta indietro', true, giu < su && Math.abs(giu - fs0) < 0.5);

  sezione('La ricerca: un bottone che apre il campo');
  ok('il campo non è più steso in barra', true,
    await val("!!document.querySelector('#searchPop #searchInput') && !document.querySelector('.controls #searchInput')"));
  await clicca('#searchBtn'); await pausa(400);
  ok('il pannellino si apre', true, await val("document.querySelector('#searchPop').hasAttribute('open')"));
  ok('con il fuoco già dentro il campo', true,
    await val("document.activeElement===document.querySelector('#searchInput')"));
  // ⚠️ il controllo del guasto 10.3.3: aperto, e ancora aperto un attimo dopo
  await pausa(400);
  ok('e RESTA aperto: il click che l’ha aperto non lo richiude', true,
    await val("document.querySelector('#searchPop').hasAttribute('open')"));
  ok('sta dentro la finestra', true,
    await val(`(()=>{ const r=document.querySelector('#searchPop').getBoundingClientRect();
      return r.left>=0 && r.top>=0 && r.right<=innerWidth && r.bottom<=innerHeight; })()`));

  // si cerca davvero: una parola che nel corpus c'è di sicuro
  await val(`(()=>{ const i=document.querySelector('#searchInput'); i.value='a';
    i.dispatchEvent(new Event('input',{bubbles:true})); })(); 1`);
  await pausa(500);
  ok('i risultati compaiono sotto il campo', true,
    await val(`(()=>{ const b=document.querySelector('#searchRes'); if(!b.classList.contains('open')) return false;
      const r=b.getBoundingClientRect(), i=document.querySelector('#searchInput').getBoundingClientRect();
      return r.top >= i.bottom - 1; })()`));
  ok('e non finiscono sotto il pannellino', true,
    await val(`(()=>{ const z=(s)=>+getComputedStyle(document.querySelector(s)).zIndex;
      return z('#searchRes') >= z('#searchPop'); })()`));
  await val("document.querySelector('#searchInput').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})); 1");
  await pausa(300);
  ok('Esc chiude i risultati', false,
    await val("document.querySelector('#searchRes').classList.contains('open')"));
  await clicca('#content'); await pausa(300);
  ok('e cliccando fuori si chiude anche il campo', [false, false],
    await val(`[document.querySelector('#searchPop').hasAttribute('open'),
                document.querySelector('#searchRes').classList.contains('open')]`));

  console.log('\n' + (ko ? '✗ ' + ko + ' controlli falliti' : '✓ tutti i controlli passati'));
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
