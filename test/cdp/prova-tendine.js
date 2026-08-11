/* Le tendine diventate bottoni, e la barra degli appunti che c'è sempre.
 *
 * ⚠️ Il `<select>` nativo NON è stato sostituito: resta lui a comandare — il suo
 * elenco, la sua tastiera, la sua spunta sulla voce corrente — e diventa
 * trasparente sopra un'etichetta. È la stessa scelta già fatta per la topbar, e
 * il controllo che conta è proprio questo: che sotto ci sia ancora il select
 * vero, o si sarebbe buttata via l'accessibilità per un bottone più bello.
 *
 *   ./test/cdp/con-vault-di-prova.sh prova-tendine.js
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
    await pausa(200);
  }
}

/** Che aspetto ha una tendina avvolta: guscio, etichetta, e il select sotto. */
const GUSCIO = (sel) => `(()=>{ const s=document.querySelector(${JSON.stringify(sel)});
  if(!s) return null;
  const g=s.closest('.tendina');
  if(!g) return { avvolta:false };
  const st=getComputedStyle(s), lab=g.querySelector('.tlab');
  return { avvolta:true, etichetta:lab?lab.textContent.trim():'',
           scelta:(s.options[s.selectedIndex]||{}).textContent||'',
           opzioni:s.options.length, trasparente:st.opacity==='0',
           tag:s.tagName, titolo:g.title||'' }; })()`;

(async () => {
  await collega();
  await val('location.reload(), 1'); await pausa(1800);
  await collega(); await pausa(600);
  await partiPulito();
  await val(`(()=>{ try{ bancoForma('due'); }catch(e){} return 1; })()`);
  await pausa(500);

  sezione('I blocchi del banco: un bottone, non una tendina di sistema');
  /* ⚠️ I `.bsel` nel DOM sono sempre quattro — A, B, C, D — ma la forma a due
     blocchi ne mostra due, e la testata si aggiorna solo per quelli a schermo.
     Contarli tutti vorrebbe dire accusare il codice per due tendine che nessuno
     sta guardando: il conto giusto è sui blocchi VISIBILI. */
  const blocchi = await val(`(()=>{ const vis=bancoBlocchiVisibili();
    const b=vis.map(x=>document.querySelector('.bsel[data-blocco="'+x+'"]')).filter(Boolean);
    return { quanti:b.length, avvolti:b.filter(s=>!!s.closest('.tendina')).length,
             etichette:b.map(s=>{ const g=s.closest('.tendina'); const l=g&&g.querySelector('.tlab');
               return l?l.textContent.trim():''; }).filter(Boolean) }; })()`);
  ok('ogni blocco visibile ha la sua tendina avvolta', blocchi.quanti, blocchi.avvolti);
  ok('e i blocchi visibili sono quelli della forma scelta', true, blocchi.quanti >= 2);
  console.log('   ' + JSON.stringify(blocchi.etichette));
  /* ⚠️ L'etichetta è VIVA: dice che cosa è scelto. Nel blocco è l'unico posto in
     cui si legge che cosa si sta guardando — una scritta fissa lo cancellerebbe. */
  const primo = await val(GUSCIO('.bsel'));
  ok('l\'etichetta dice lo strumento scelto', primo.scelta.trim(), primo.etichetta);
  ok('e sotto c\'è ancora un <select> vero, trasparente', ['SELECT', true],
    [primo.tag, primo.trasparente]);
  ok('con tutte le sue voci', true, primo.opzioni >= 5);

  /* Cambiando strumento l'etichetta segue: senza, il bottone direbbe una cosa e
     il blocco ne mostrerebbe un'altra. */
  const dopo = await val(`(()=>{ const s=document.querySelector('.bsel');
    const alt=[...s.options].filter(o=>o.value!==s.value && !o.disabled)[0];
    if(!alt) return null;
    s.value=alt.value; s.dispatchEvent(new Event('change',{bubbles:true}));
    return alt.textContent; })()`);
  await pausa(500);
  const ora = await val(GUSCIO('.bsel'));
  ok('cambiando strumento l\'etichetta lo segue', (dopo || '').trim(), ora.etichetta);

  sezione('La barra della mappa');
  await apriStrumento('mappa');
  await pausa(600);
  const mappa = await val(GUSCIO('#mAmbito'));
  ok('anche la scelta della mappa è un bottone', true, !!mappa && mappa.avvolta);
  /* ⚠️ Etichetta FISSA: dice la funzione, non il nome della mappa aperta — che
     è lungo e tagliato non direbbe niente. Quello vive nel `title`. */
  ok('e si chiama «Mappe»', 'Mappe', mappa.etichetta);
  ok('mentre il nome della mappa aperta sta nel title', true,
    !!mappa && mappa.titolo.indexOf(mappa.scelta.trim().slice(0, 12)) >= 0);
  console.log('   title: ' + JSON.stringify(mappa.titolo));

  sezione('La barra degli appunti c\'è ANCHE senza appunti');
  /* ⚠️ Prima `ensureMde` girava solo aprendo un appunto: scegliendo «Appunti» in
     un blocco vuoto si vedeva «nessun appunto» e nessun comando — compreso il
     «+», che è l'unico modo di crearne uno. Un vicolo cieco: lo strumento che
     serve a cominciare non compariva finché non avevi già cominciato. */
  await val(`(()=>{ NOTES.cur=null; NOTES.list=[]; return 1; })()`);
  await apriStrumento('appunti');
  await pausa(800);
  const barra = await finoA(`(()=>{ const n=document.querySelector('#notePane .notectl');
    if(!n) return null;
    return { comandi:[...n.querySelectorAll('button')].map(b=>b.id).filter(Boolean),
             nuovo:!!document.getElementById('noteNew'),
             tendina:!!(document.getElementById('noteSelect')||{}).closest }; })()`, 12000);
  ok('la barra dei comandi c\'è', true, !!barra);
  if (barra) {
    console.log('   ' + barra.comandi.join(' · '));
    ok('e con lei il «+» per crearne uno', true, barra.nuovo);
  }
  ok('nessun appunto aperto, come previsto', true, await val('!NOTES.cur'));
  const tn = await val(GUSCIO('#noteSelect'));
  ok('anche la scelta dell\'appunto è un bottone', true, !!tn && tn.avvolta);
  ok('e si chiama «Quaderno»', 'Quaderno', tn.etichetta);

  sezione('Le due barre si somigliano, perché la misura è un token sola');
  /* ⚠️ Prima la barra della mappa aveva bottoni alti 30 e bordati, quella degli
     appunti 26 e senza bordo: due superfici che fanno lo stesso mestiere e
     sembravano di due app diverse. Adesso le misure stanno in `--tb-*`, in un
     posto solo, e questo controllo è ciò che impedisce che ricomincino a
     divergere una riga per volta. */
  const stili = await val(`(()=>{
    /* ⚠️ Il primo bottone della barra può essere NASCOSTO — «Parti da qui» e
       «+» si alternano secondo il registro — e un elemento nascosto misura zero.
       Si prende il primo che occupa spazio davvero, o si accusa il token per un
       bottone che nessuno sta guardando.
       ⚠️ E qui dentro NIENTE apici inversi: questo blocco vive in un template
       letterale, e un apice inverso in un commento lo chiude a metà. È il terzo
       inciampo dello stesso tipo in questa sessione. */
    function leggi(sel){ const e=[...document.querySelectorAll(sel)]
        .filter(x=>x.getBoundingClientRect().height>0)[0];
      if(!e) return null;
      const s=getComputedStyle(e);
      return { h:Math.round(e.getBoundingClientRect().height), fs:s.fontSize,
               peso:s.fontWeight, maiuscole:s.textTransform, tracking:s.letterSpacing }; }
    return { mappa:leggi('.mtoolbar .mbtn'),
             appunti:leggi('#noteHost .editor-toolbar .notectl .ncbtn'),
             tmappa:leggi('.mtoolbar .tendina'),
             tappunti:leggi('#noteHost .editor-toolbar .notectl .tendina'),
             seg:leggi('.mtoolbar .mseg'),
             token:getComputedStyle(document.documentElement).getPropertyValue('--tb-h').trim() }; })()`);
  console.log('   token --tb-h: ' + stili.token);
  console.log('   mappa:   ' + JSON.stringify(stili.mappa));
  console.log('   appunti: ' + JSON.stringify(stili.appunti));
  console.log('   tendina mappa:   ' + JSON.stringify(stili.tmappa));
  console.log('   tendina appunti: ' + JSON.stringify(stili.tappunti));
  console.log('   segmentato:      ' + JSON.stringify(stili.seg));
  ok('stessa altezza', stili.mappa.h, stili.appunti.h);
  ok('stesso corpo', stili.mappa.fs, stili.appunti.fs);
  ok('stesso peso', stili.mappa.peso, stili.appunti.peso);
  ok('tutte e due in maiuscole', ['uppercase', 'uppercase'],
    [stili.mappa.maiuscole, stili.appunti.maiuscole]);
  ok('e l\'altezza è quella del token, non un numero scritto a mano',
    stili.token, stili.mappa.h + 'px');

  /* ⚠️ Una tendina è un bottone della barra come gli altri: sta nella stessa
     fila e deve avere la stessa altezza. Prima `.tendina.piccola` teneva la sua
     misura a mano — `calc(--ctl-h - 16px)`, cioè 24px contro i 30 del token —
     e la riga risultava sfalsata: due misure per una cosa sola. */
  ok('la tendina della mappa è alta come i suoi bottoni', stili.mappa.h, stili.tmappa.h);
  ok('la tendina degli appunti è alta come i suoi bottoni', stili.appunti.h, stili.tappunti.h);
  ok('e anche il gruppo segmentato', stili.mappa.h, stili.seg.h);

  sezione('Lo stile delle barre: bottoni attaccati, e poche linee che dicono qualcosa');
  /* ⚠️ La barra del markdown era la più leggibile dell'app perché non incornicia
     ogni bottone: una cornice per comando moltiplica le linee — dieci comandi
     sono dieci scatolette con nove fessure in mezzo — e il raggruppamento lo
     perde chi guarda. Adesso vale per tutte: niente bordo, niente spazio fra i
     bottoni, e una barretta verticale dove cambia il mestiere dei comandi. */
  const stile = await val(`(()=>{
    function leggi(sel){ const e=[...document.querySelectorAll(sel)]
        .filter(x=>x.getBoundingClientRect().height>0)[0];
      if(!e) return null; const s=getComputedStyle(e);
      return { bordo:s.borderTopWidth+' '+s.borderLeftWidth, fondo:s.backgroundColor }; }
    function gap(sel){ const e=document.querySelector(sel);
      return e ? getComputedStyle(e).columnGap : null; }
    return { mappa:leggi('.mtoolbar .mbtn'), appunti:leggi('#noteHost .editor-toolbar .notectl .ncbtn'),
             fonti:leggi('#pdfPane .pdfbar .tbtn'), tendina:leggi('.tendina.piccola'),
             gapMappa:gap('.mtoolbar'), gapFonti:gap('#pdfPane .pdfbar'),
             gapAppunti:gap('#noteHost .editor-toolbar .notectl') }; })()`);
  console.log('   ' + JSON.stringify(stile));
  ok('i bottoni della mappa non hanno cornice', '0px 0px', stile.mappa.bordo);
  ok('e nemmeno quelli degli appunti', '0px 0px', stile.appunti.bordo);
  ok('né la tendina', '0px 0px', stile.tendina.bordo);
  ok('e i bottoni si toccano, in tutte e tre le barre', ['0px', '0px', '0px'],
    [stile.gapMappa, stile.gapFonti, stile.gapAppunti]);

  /* ⚠️ E le barrette non restano a separare il nulla: in queste barre metà dei
     comandi va e viene, e una scritta nel markup sopravvive al gruppo che
     doveva separare. */
  const sepAppesi = await val(`(()=>{ barreSeparatori();
    const barre=[...document.querySelectorAll('.mtoolbar, #pdfPane .pdfbar, #noteHost .editor-toolbar .notectl')];
    let appesi=0, vive=0;
    barre.forEach(function(bar){
      const figli=[...bar.children].filter(function(e){ return !e.hidden && getComputedStyle(e).display!=='none'; });
      figli.forEach(function(e,i){
        if(!e.classList.contains('tbsep') && !e.classList.contains('msep')) return;
        vive++;
        const prima=figli.slice(0,i).filter(x=>!x.classList.contains('tbsep')&&!x.classList.contains('msep')&&!x.classList.contains('mspazio'));
        const dopo=figli.slice(i+1).filter(x=>!x.classList.contains('tbsep')&&!x.classList.contains('msep')&&!x.classList.contains('mspazio'));
        if(!prima.length || !dopo.length) appesi++;
      });
    });
    return { appesi, vive }; })()`);
  console.log('   barrette a schermo: ' + sepAppesi.vive);
  ok('nessuna barretta separa il nulla', 0, sepAppesi.appesi);
  ok('ma qualcuna c\'è, o non separerebbero niente', true, sepAppesi.vive > 0);

  console.log('');
  console.log(ko ? '✗ ' + ko + ' controlli falliti' : '✓ tutti i controlli passati');
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('✗ ' + e.message); process.exit(1); });
