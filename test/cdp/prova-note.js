/* Il salto ai richiami di nota, nell'app viva.
 *
 * Il markup lo provano in Node i 47 controlli di `test/note.js`. Quello che di
 * qui non si vede è la sola cosa che poteva rompersi davvero: **che cosa
 * scorre**. Da quando c'è il banco la pagina non scorre più — scorre il corpo
 * del blocco (`.bcorpo`) — e un salto scritto per una pagina che scorre
 * porterebbe il riquadro delle note fuori vista senza muovere niente.
 *
 * ⚠️ Gira contro il vault della config: puntarlo a una COPIA (trappola ⑧).
 *   ./test/cdp/con-vault-di-prova.sh prova-note
 */
const S = require('path').join(__dirname, 'cdp.js');
const { collega, val, clicca, pausa, partiPulito, invia } = require(S);

let ko = 0;
/* Aspetta che una condizione diventi vera: il DOM di CodeMirror non è pronto
   al ritorno di `noteOpen` — le righe si disegnano dopo, e una pausa fissa è
   una scommessa. */
async function finoA(expr, quanto) {
  const fine = Date.now() + (quanto || 8000);
  for (;;) {
    const v = await val(expr);
    if (v) return v;
    if (Date.now() > fine) return null;
    await pausa(200);
  }
}
function ok(n, atteso, avuto) {
  const a = JSON.stringify(atteso), b = JSON.stringify(avuto);
  if (a === b) { console.log('  ok  ' + n); return; }
  ko++; console.log('  KO  ' + n + '\n      atteso ' + a + '\n      avuto  ' + b);
}

/**
 * Il primo capitolo CON NOTE, cercandolo anche negli altri corsi del vault.
 *
 * ⚠️ Non tutti i corsi ne hanno: il corso aperto per primo nel vault di prova
 * non ne ha nemmeno una, e cercarle solo lì faceva uscire la prova dicendo
 * «niente da provare» — che è un verde che non prova niente. Le note si
 * scrivono a mano nei materiali, quindi dipende dal corpus, non dal codice.
 */
async function capitoloConNote() {
  /* ⚠️ `LESSONS` sono le LEZIONI, non i corsi — ci ho sbattuto: chiamare
     `cambiaCorso()` con le sue chiavi non cambia niente e la ricerca gira a
     vuoto. Le lezioni di tutti i corsi caricati stanno lì dentro, quindi si
     scorrono e basta. */
  const lezioni = await val(`Object.keys(LESSONS||{})`);
  for (const lez of lezioni) {
    await val(`loadLesson(${JSON.stringify(lez)}), 1`);
    await pausa(420);
    const i = await val(`(async()=>{
      for(var i=0;i<(LESSON.chapters||[]).length;i++){
        go(i); await new Promise(r=>setTimeout(r,170));
        if(document.querySelector('#content sup.fnref a.fnsalta')) return i;
      }
      return -1; })()`);
    if (i >= 0) return { lezione: lez, capitolo: i };
  }
  return null;
}


(async () => {
  await collega(); await partiPulito(); await pausa(400);
  /* ⚠️ Dal 13 agosto la disposizione è del CONTENITORE: la prova prima di
     questa può aver lasciato il corso con un banco senza capitolo, e i
     richiami di nota vivono lì. Si chiede alla porta vera, come ogni gesto. */
  await val(`(async()=>{ if(modoAttivo()==='zaino') await cambiaModo('corso');
    try{ bancoMostra('capitolo'); }catch(e){} return 1; })()`);
  await pausa(400);

  const trovato = await capitoloConNote();
  if (!trovato) {
    /* ⚠️ Rosso, non verde. Se in tutto il vault di prova non c'è una nota, non
       è che il salto funziona: è che non lo si sta provando, e un verde che non
       prova niente è peggio di un rosso. */
    console.log('  ✗ nessun capitolo con note in tutto il vault di prova: la prova non può provare niente');
    process.exit(1);
  }
  console.log('  lezione «' + trovato.lezione + '» · capitolo ' + (trovato.capitolo + 1) +
    ': ha dei richiami di nota');

  console.log('\n== Il numeretto è un\'ancora, non un apice muto');
  ok('ha il bersaglio addosso', true,
    await val(`!!document.querySelector('#content sup.fnref a.fnsalta').dataset.nota`));
  ok('e il bersaglio esiste davvero', true,
    await val(`(()=>{const a=document.querySelector('#content sup.fnref a.fnsalta');
      return !!document.getElementById(a.dataset.nota);})()`));

  console.log('\n== Il salto muove il contenitore che scorre');
  /* Si guarda la posizione della VOCE sullo schermo prima e dopo: è la misura
     onesta, perché non presume chi sia a scorrere — pagina, dock o blocco. */
  const dove = () => val(`(()=>{const a=document.querySelector('#content sup.fnref a.fnsalta');
    const b=document.getElementById(a.dataset.nota);
    const r=b.getBoundingClientRect(), h=window.innerHeight;
    return { centro:Math.round(r.top+r.height/2), inVista:(r.top>=0 && r.bottom<=h) };})()`);
  /* ⚠️ Prima si porta il numeretto SOTTO GLI OCCHI, poi lo si preme. Il click di
     CDP arriva a coordinate dello schermo: con l'ancora a y=1103 in una finestra
     alta 848 il colpo cade nel vuoto, non succede niente, e il rosso accusa il
     gestore invece della prova. Misurato. */
  await val(`(()=>{document.querySelector('#content sup.fnref a.fnsalta')
    .scrollIntoView({block:'center'}); return 1;})()`);
  await pausa(300);
  const prima = await dove();
  await clicca('#content sup.fnref a.fnsalta');
  await pausa(900);
  const dopo = await dove();
  console.log('   la voce era a y=' + prima.centro + ', ora è a y=' + dopo.centro);
  ok('la nota è finita sotto gli occhi', true, dopo.inVista);
  ok('…e qualcosa si è mosso davvero', true, prima.centro !== dopo.centro || prima.inVista);
  ok('il fuoco è sulla nota (la tastiera segue)', true,
    await val(`(()=>{const a=document.activeElement; return !!a && a.matches('#content .fnotes li');})()`));
  ok('l\'indirizzo della finestra non si è sporcato di #', false,
    await val(`location.hash.length>1`));

  console.log('\n== E la freccia riporta indietro');
  ok('la voce ha la freccia del ritorno', true,
    await val(`!!document.querySelector('#content .fnotes a.fnback')`));
  const suY = () => val(`(()=>{const a=document.querySelector('#content sup.fnref a.fnsalta');
    const r=a.getBoundingClientRect(); return { centro:Math.round(r.top), inVista:(r.top>=0 && r.bottom<=window.innerHeight) };})()`);
  await val(`(()=>{document.querySelector('#content .fnotes a.fnback')
    .scrollIntoView({block:'center'}); return 1;})()`);
  await pausa(300);
  await clicca('#content .fnotes a.fnback');
  await pausa(900);
  ok('il richiamo nel testo è tornato in vista', true, (await suY()).inVista);

  console.log('\n== I titoli di un appunto: scritti e resi hanno la STESSA misura');
  /* ⚠️ Il guasto, visto a schermo: nell'editor «# sole» era alto 44px e
     nell'anteprima 24px — scrivere e rileggere sembravano due documenti. E
     «####», «#####», «######» arrivavano tutti alla stessa taglia, perché il
     renderer li schiacciava in h6.
     Qui non si controlla un numero fisso: si controlla che le DUE scale
     coincidano. I valori sono `calc(rem + vw)` — cambiano con la finestra, e
     devono cambiare insieme. */
  /* ⚠️ NIENTE cambio di modalità qui: le prove girano tutte contro la stessa
     istanza, una dopo l'altra, e una che esce lasciando l'app nello zaino fa
     fallire le nove che seguono con errori che non c'entrano — misurato.
     La scala dei titoli non dipende dalla modalità: si scrive l'appunto nel
     contenitore che c'è, qualunque sia. */
  /* `openEditor` e non `bancoMostra`: è la porta vera, e soprattutto è quella
     che rinfresca CodeMirror. Senza il refresh l'editor resta disegnato com'era
     — vuoto — e i titoli non esistono ancora nel DOM. */
  await val(`(()=>{ openEditor(); return 1; })()`);
  await pausa(500);
  const testoTit = ['# uno','## due','### tre','#### quattro','##### cinque','###### sei','corpo'].join('\n\n');
  /* ⚠️ `curMeta().courseId` e NON `corsoAttivo()`: questa prova apre un capitolo
     cercandolo anche negli ALTRI corsi del vault, quindi il corso attivo e il
     contenitore da cui l'editor legge gli appunti possono essere due. Salvando
     nel primo, `notesReload()` leggeva il secondo e `noteOpen` rispondeva
     «Appunto non trovato» — misurato. */
  const nato = await val(`(()=>{ const c=(curMeta()||{}).courseId;
    if(!c) return 'nessun contenitore aperto';
    const r=window.vault.notes.save(c, null, { title:'Sei livelli' }, ${JSON.stringify(testoTit)});
    if(!r || r.error) return 'non salvato: '+((r&&r.error)||'?');
    notesReload(); noteOpen(r.file);
    setTimeout(function(){ try{ NOTES.mde.codemirror.refresh(); }catch(e){} }, 60);
    return ''; })()`);
  ok('l\'appunto di prova è nato', '', nato);
  /* ⚠️ Si aspetta il DOM, non un tempo: le righe di CodeMirror si disegnano
     dopo. Senza questa attesa la misura trovava ZERO titoli da tutte e due le
     parti e il confronto passava — due elenchi vuoti sono uguali. Un verde che
     non prova niente è peggio di un rosso. */
  const pronti = await finoA(`document.querySelectorAll('#noteHost .cm-header-1').length ? 1 : 0`, 10000);
  /* Se non arriva, si dice PERCHÉ invece di un «atteso 1, avuto null» muto. */
  ok('e l\'editor lo mostra', 1, pronti || await val(`(()=>{ const h=document.querySelector('#noteHost');
    return JSON.stringify({ cur:(NOTES.cur&&NOTES.cur.title)||null, editor:document.documentElement.dataset.editor,
      mde:!!NOTES.mde, valore:NOTES.mde?NOTES.mde.value().slice(0,24):null,
      altezza:h?Math.round(h.getBoundingClientRect().height):-1,
      strumento:(function(){ try{ return bancoVisibile('appunti'); }catch(e){ return 'boh'; } })() }); })()`));
  const scale = await val(`(async()=>{
    const ed={}; for(let i=1;i<=6;i++){ const e=document.querySelector('#noteHost .cm-header-'+i);
      ed['h'+i]= e ? getComputedStyle(e).fontSize : null; }
    NOTES.mde.togglePreview();
    await new Promise(r=>setTimeout(r,500));
    const p=document.querySelector('#noteHost .editor-preview-active, #noteHost .editor-preview, #noteHost .editor-preview-side');
    const pv={}; for(let i=1;i<=6;i++){ const e=p&&p.querySelector('h'+i);
      pv['h'+i]= e ? getComputedStyle(e).fontSize : null; }
    NOTES.mde.togglePreview();
    return { ed:ed, pv:pv }; })()`);
  await pausa(400);
  ok('l\'editor mostra sei livelli distinti', 6,
    new Set(Object.values(scale.ed).filter(Boolean)).size);
  ok('e l\'anteprima ne rende sei', 6, Object.values(scale.pv).filter(Boolean).length);
  ok('nessun livello resta senza misura', false,
    Object.values(scale.ed).some(function (v) { return !v; }) ||
    Object.values(scale.pv).some(function (v) { return !v; }));
  ok('le due scale coincidono, livello per livello', scale.ed, scale.pv);
  /* E il titolo di un appunto non è l'h1 della pagina: niente MAIUSCOLO. */
  ok('senza il maiuscolo della testata', 'none', await val(`(()=>{
    const p=document.querySelector('#noteHost .editor-preview-active, #noteHost .editor-preview');
    const h=p&&p.querySelector('h1'); return h? getComputedStyle(h).textTransform : '(assente)'; })()`));
  console.log('\n== ⌘J accende e SPEGNE l\'anteprima');
  /* ⚠️ Il verso di ritorno è quello che mancava. Le scorciatoie di EasyMDE
     vivono nel keymap di CodeMirror, e in anteprima CodeMirror è NASCOSTO: il
     tasto accendeva la vista e poi non la spegneva più, perché non arrivava più
     a nessuno. Perciò ⌘J adesso lo possiede l'app, con un gestore sulla
     finestra — e questa prova preme QUATTRO volte, non una: una sola misurava
     esattamente la metà che funzionava già. */
  const vista = `(()=>{ const h=document.getElementById('noteHost');
    return h.querySelector('.editor-preview-active') ? 'anteprima' : 'markdown'; })()`;
  const cmdJ = async () => {
    await invia('Input.dispatchKeyEvent', { type:'keyDown', key:'j', code:'KeyJ', modifiers:4, windowsVirtualKeyCode:74 });
    await invia('Input.dispatchKeyEvent', { type:'keyUp', key:'j', code:'KeyJ', modifiers:4, windowsVirtualKeyCode:74 });
    await pausa(500);
  };
  await val(`(()=>{ const h=document.getElementById('noteHost');
    if(h.querySelector('.editor-preview-active')) NOTES.mde.togglePreview(); NOTES.mde.codemirror.focus(); return 1; })()`);
  const giro = [await val(vista)];
  for (let i = 0; i < 4; i++) { await cmdJ(); giro.push(await val(vista)); }
  console.log('   ' + giro.join(' → '));
  ok('⌘J commuta a ogni pressione', ['markdown', 'anteprima', 'markdown', 'anteprima', 'markdown'], giro);
  /* Uscendo si torna a poter scrivere: trovarsi a battere nel vuoto dopo aver
     chiuso l'anteprima è peggio che non averla chiusa. */
  ok('e uscendo il cursore torna nel testo', true,
    await val(`!!document.querySelector('#noteHost .CodeMirror-focused')`));
  /* Il suggerimento nomina il tasto: da quando la scorciatoia non è più di
     EasyMDE, l'etichetta non lo diceva più, e una scorciatoia che non si legge
     da nessuna parte è una scorciatoia che nessuno usa. */
  ok('il bottone dell\'anteprima dice il suo tasto', true,
    /⌘J|Ctrl-J|Ctrl\+J/.test(await val(`document.querySelector('#noteHost .editor-toolbar button.preview').title`)));
  /* L'icona dei riquadri è la pergamena, non le tre righe del «menu». */
  ok('i riquadri hanno l\'icona della pergamena', '📜',
    (await val(`document.querySelector('#noteHost .ncb-callout').textContent`) || '').trim());

  console.log('\n== ◫ affiancata: resta DENTRO il suo blocco');
  /* ⚠️ Di fabbrica EasyMDE, premendo ◫, chiama anche `toggleFullScreen`:
     l'editor si prendeva tutta la finestra, la sidebar spariva sotto e la
     maniglia — che è `position:fixed` — restava inchiodata accanto a una
     sidebar che non si vedeva più (riferito da Giacomo il 17 agosto). Qui il
     banco è il modello: uno strumento sta nel suo blocco. */
  const lato = `(()=>{ const h=document.getElementById('noteHost');
    const cm=h.querySelector('.CodeMirror'), pv=h.querySelector('.editor-preview-side');
    const sb=document.querySelector('.sidebar');
    const r=(el)=>{ if(!el) return null; const b=el.getBoundingClientRect();
      return { x:Math.round(b.x), w:Math.round(b.width), y:Math.round(b.y) }; };
    return { affiancata:!!h.querySelector('.editor-preview-active-side'),
             fullscreen:!!document.querySelector('.CodeMirror-fullscreen'),
             sidebarVisibile: sb ? getComputedStyle(sb).display!=='none' : null,
             testo:r(cm), anteprima:r(pv), sidebar:r(sb),
             barra:r(h.querySelector('.editor-toolbar')) }; })()`;
  const senza = await val(lato);
  await val(`NOTES.mde.toggleSideBySide(), 1`); await pausa(900);
  const con = await val(lato);
  console.log('   ' + JSON.stringify(con));
  ok('l\'affiancata si accende', true, con.affiancata);
  ok('ma NON in fullscreen', false, con.fullscreen);
  ok('la sidebar resta a schermo', true, con.sidebarVisibile);
  ok('e non si sposta di un pixel', senza.sidebar, con.sidebar);
  /* Le due metà stanno una accanto all'altra, e a destra del blocco — non
     appese al bordo della finestra, che è dove le mette il CSS di fabbrica. */
  ok('testo e anteprima sono affiancati', true, con.anteprima.x > con.testo.x + con.testo.w - 4);
  ok('e stanno dentro il blocco, non sulla finestra', true, con.testo.x >= con.sidebar.w);
  /* ⚠️ La barra resta in cima: col `flex-wrap` le due righe si dividevano
     l'altezza e la barra finiva a mezz'aria, con duecento pixel di vuoto sopra. */
  ok('la barra resta in cima, sopra le due metà', true, con.barra.y < con.testo.y);
  console.log('\n== Scrivere DENTRO l\'anteprima, un blocco per volta');
  /* ⚠️ Che cosa difende. L'anteprima non traduce mai l'HTML in markdown — il
     markdown resta l'unica verità — e riscrive SOLO le righe del blocco toccato.
     Se un giorno la mappa delle righe si sfasasse, una modifica fatta in
     anteprima mangerebbe il blocco accanto: qui si guarda il sorgente prima e
     dopo, non «l'anteprima è cambiata». */
  const TESTO = '# Titolo\n\nPrimo paragrafo.\n\n> [!nota]\n> Dentro un riquadro.\n\nUltimo paragrafo.\n';
  await val(`NOTES.mde.value(${JSON.stringify(TESTO)}), 1`); await pausa(500);
  const mappa = await val(`[...document.querySelectorAll('#noteHost .editor-preview-active-side .mdb')]
    .map(function(b){ return b.dataset.da+'-'+b.dataset.a; })`);
  console.log('   blocchi: ' + JSON.stringify(mappa));
  /* Quattro blocchi, e il riquadro ne occupa due di righe: è la mappa che rende
     possibile riscriverne uno senza toccare gli altri. */
  ok('ogni blocco sa da quali righe viene', ['0-0', '2-2', '4-5', '7-7'], mappa);

  /* Si clicca il TESTO, non l'involucro: `.mdb` è `display:contents` e non ha un
     riquadro proprio — esattamente come fa l'utente, che clicca il paragrafo. */
  await clicca('#noteHost .editor-preview-active-side .mdb[data-da="2"] p');
  await pausa(400);
  ok('il blocco cliccato torna a essere markdown', 'Primo paragrafo.',
    await val(`(document.querySelector('#noteHost .mdb-edit')||{}).value`));
  await val(`(()=>{ const t=document.querySelector('#noteHost .mdb-edit');
    t.value='Primo paragrafo **cambiato**.'; t.dispatchEvent(new Event('input',{bubbles:true})); return 1; })()`);
  await invia('Input.dispatchKeyEvent', { type:'keyDown', key:'Enter', code:'Enter', modifiers:4, windowsVirtualKeyCode:13 });
  await invia('Input.dispatchKeyEvent', { type:'keyUp', key:'Enter', code:'Enter', modifiers:4, windowsVirtualKeyCode:13 });
  await pausa(700);
  ok('⌘Invio scrive nel sorgente, e SOLO quelle righe',
    '# Titolo\n\nPrimo paragrafo **cambiato**.\n\n> [!nota]\n> Dentro un riquadro.\n\nUltimo paragrafo.\n',
    await val(`NOTES.mde.value()`));
  ok('il campo si chiude', false, await val(`!!document.querySelector('#noteHost .mdb-edit')`));
  ok('e il blocco si rirende', true,
    /<strong>cambiato<\/strong>/.test(await val(`document.querySelector('#noteHost .editor-preview-active-side .mdb[data-da="2"]').innerHTML`)));

  /* Esc ANNULLA: chi apre un blocco per guardare il markdown non deve
     ritrovarsi il testo cambiato per essere uscito. */
  const prima2 = await val(`NOTES.mde.value()`);
  await clicca('#noteHost .editor-preview-active-side .mdb[data-da="7"] p');
  await pausa(400);
  await val(`(()=>{ const t=document.querySelector('#noteHost .mdb-edit'); t.value='NON deve restare'; return 1; })()`);
  await invia('Input.dispatchKeyEvent', { type:'keyDown', key:'Escape', code:'Escape', windowsVirtualKeyCode:27 });
  await invia('Input.dispatchKeyEvent', { type:'keyUp', key:'Escape', code:'Escape', windowsVirtualKeyCode:27 });
  await pausa(600);
  ok('Esc non tocca il sorgente', prima2, await val(`NOTES.mde.value()`));
  ok('e chiude comunque il campo', false, await val(`!!document.querySelector('#noteHost .mdb-edit')`));

  await val(`NOTES.mde.toggleSideBySide(), 1`); await pausa(700);
  ok('e togliendola si torna com\'era', [false, senza.testo.w],
    [(await val(lato)).affiancata, (await val(lato)).testo.w]);

  /* E si richiude quello che si è aperto: l'editor lasciato a schermo con un
     appunto dentro è lo strascico che fa inciampare la prova dopo. */
  await val(`(()=>{ try{ closeEditor(); }catch(e){} return 1; })()`);
  await pausa(300);

  console.log('\n== Nell\'elenco della lente «Appunti» è la prima sezione');
  /* ⚠️ Ciò che l'utente ha SCRITTO viene prima di ciò che ha letto. Non è una
     preferenza: l'elenco scrive un'intestazione ogni volta che il gruppo
     cambia, e un appunto piazzato a metà classifica spezzava in due il
     documento attorno a lui — la stessa fonte compariva sotto due intestazioni
     identiche, come se fossero due cose diverse.
     La parola su cui si misura si prende dai CAPITOLI veri invece di
     scriverla qui: una inventata potrebbe non esserci da nessuna parte, e la
     prova diventerebbe verde senza aver misurato niente. */
  const comune = await val(`(()=>{ searchBuild();
    const cap=SEARCH.docs.filter(function(d){ return !d.appunto && !d.materiale; });
    const conta={};
    cap.forEach(function(d){ new Set(d.ntext.match(/[a-z]{6,}/g)||[]).forEach(function(w){ conta[w]=(conta[w]||0)+1; }); });
    return Object.keys(conta).filter(function(w){ return conta[w]>=2; })[0]||null; })()`);
  ok('una parola dei capitoli su cui misurare', true, !!comune);
  if (comune) {
    console.log('   «' + comune + '»');
    await val(`(()=>{ const c=(curMeta()||{}).courseId;
      window.vault.notes.save(c, null, { title:'Lente' }, 'Anche qui si parla di ${comune}.\\n');
      notesReload(); return 1; })()`);
    await pausa(400);
    const elenco = await val(`(()=>{ const q=${JSON.stringify(comune)};
      searchRender(searchRun(q), q);
      const box=document.getElementById('searchRes');
      const primo=box.firstElementChild;
      return { sezioni:[...box.querySelectorAll('.sr-lesson')].map(function(e){ return e.textContent; }),
               primoÈIntestazione:!!primo && primo.classList.contains('sr-lesson'),
               primoTesto:primo ? primo.textContent : null,
               voci:box.querySelectorAll('.sr-item').length }; })()`);
    console.log('   sezioni: ' + JSON.stringify(elenco && elenco.sezioni));
    ok('la lente trova nell\'appunto E nei capitoli', true, !!elenco && elenco.voci > 1);
    ok('l\'elenco comincia con un\'intestazione', true, !!elenco && elenco.primoÈIntestazione);
    ok('ed è quella degli appunti', 'Appunti', elenco && elenco.primoTesto);
    /* ⚠️ Una volta sola: due sezioni «Appunti» sono lo stesso difetto visto
       dall'altra parte — gli appunti davanti, ma non tutti. */
    ok('e compare una volta sola', 1,
      elenco ? elenco.sezioni.filter(function (t) { return t === 'Appunti'; }).length : 0);
    /* ⚠️ E dal 17 agosto vale per TUTTE le intestazioni, non solo per gli
       appunti: i risultati si raggruppano per fonte, e una fonte che torna dopo
       essere già comparsa fa credere a chi legge di essere passato a un'altra. */
    ok('e nessun\'altra intestazione si ripete', true,
      !!elenco && new Set(elenco.sezioni).size === elenco.sezioni.length);
    ok('sotto ci sono anche i capitoli', true, !!elenco && elenco.sezioni.length > 1);

    /* ⚠️ LA RIGA DICE DOVE SI VA, e nient'altro. Prima ripeteva la parola
       cercata (che l'utente ha appena scritto) e il titolo del documento (che
       sta nell'intestazione due centimetri più su): due terzi della larghezza
       per non dire niente, e l'elenco alto il doppio. E il frammento si ferma a
       due righe, o otto risultati riempiono lo schermo. */
    const forma = await val(`(()=>{ const q=${JSON.stringify(comune)};
      const box=document.getElementById('searchRes');
      const item=box.querySelector('.sr-item');
      const capo=item.querySelector('.sr-head'), fr=item.querySelector('.sr-snip');
      const app=box.querySelector('.sr-item[data-tipo="appunto"]');
      const acc=getComputedStyle(document.documentElement).getPropertyValue('--teal-strong').trim();
      const colore=(el)=>el?getComputedStyle(el).color:null;
      /* Il teal dichiarato è in esadecimale, quello calcolato in rgb: si
         confronta convertendo, non sperando che coincidano come stringhe. */
      const rgb=(hex)=>{ const m=/^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
        return m ? 'rgb('+parseInt(m[1],16)+', '+parseInt(m[2],16)+', '+parseInt(m[3],16)+')' : hex; };
      return { capo:capo.textContent, ripeteLaParola:capo.textContent.toLowerCase().indexOf(q.toLowerCase())>=0,
               righeFrammento:getComputedStyle(fr).webkitLineClamp,
               tipi:[...new Set([...box.querySelectorAll('.sr-item')].map(x=>x.dataset.tipo))],
               intestazione:colore(box.querySelector('.sr-lesson')),
               titoloAppunto:colore(app?app.querySelector('.sr-head'):null),
               accento:rgb(acc) }; })()`);
    console.log('   capo: ' + JSON.stringify(forma.capo) + ' · tipi: ' + JSON.stringify(forma.tipi));
    ok('la riga non ripete la parola cercata', false, forma.ripeteLaParola);
    /* ⚠️ La lista bianca è di prima di Q5 e non conosceva «mappa» né
       «ritaglio»: restava verde solo perché i nodi delle mappe non entravano
       nell'indice dei CORSI. Da quando `mappe.nodi` li legge dal disco entrano,
       ed è la promessa di Q5 — «mancavano nei corsi esattamente come negli
       zaini». Una lista bianca che non si aggiorna trasforma una funzione nuova
       in un rosso, e sembra un difetto. */
    ok('e ogni riga dichiara di che tipo è', true,
      forma.tipi.length > 0 && forma.tipi.every(function (t) {
        return ['appunto', 'pagina', 'capitolo', 'mappa', 'ritaglio'].indexOf(t) >= 0;
      }));
    ok('il frammento si ferma a due righe', '2', String(forma.righeFrammento));
    /* L'accento serve a leggere: l'intestazione dice «da qui in poi un'altra
       fonte», e il titolo di un appunto è ciò che l'utente ha scritto lui. */
    ok('l\'intestazione porta l\'accento dell\'app', forma.accento, forma.intestazione);
    ok('e anche il titolo di un appunto', forma.accento, forma.titoloAppunto);

    /* Si richiude ciò che si è aperto: un elenco di risultati lasciato a
       schermo è la tenda che fa cadere il click della prova dopo. */
    await val(`(()=>{ try{ searchClose(); }catch(e){} return 1; })()`);
    await pausa(200);
  }

  console.log(ko ? '\n✗ ' + ko + ' controlli falliti' : '\n✓ tutti i controlli passati');
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
