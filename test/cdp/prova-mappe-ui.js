/* Le mappe concettuali dalla porta principale: le due scale, le due potature
 * (profondità e focus), la bolla delle fonti, le due rinomine e la stampa.
 *
 * Perché via CDP e non in Node: tutto ciò che c'è qui è un GESTO. Le funzioni
 * pure hanno già i loro controlli (`test/grafo-focus.js`, `test/disegna-fonti.js`,
 * `test/appunti-rinomina.js`); quello che solo l'app viva può dire è se il
 * gesto arriva davvero dove deve — e in questo progetto è già successo due
 * volte che una funzione giusta fosse irraggiungibile col mouse vero
 * (`setPointerCapture` che ridirige il click, e il click che chiude il
 * pannellino che sta aprendo).
 *
 * ⚠️ Gira contro il vault indicato nella config, e CREA ED ELIMINA mappe e
 * appunti. Lanciala solo dalla copia di prova:
 *
 *   ./test/cdp/con-vault-di-prova.sh prova-mappe-ui.js
 */
const S = require('path').join(__dirname, 'cdp.js');
const { collega, invia, val, clicca, pausa, apriStrumento } = require(S);
const fs = require('fs'), path = require('path');

let ko = 0;
function ok(n, atteso, avuto) {
  const a = JSON.stringify(atteso), b = JSON.stringify(avuto);
  if (a === b) { console.log('  ok  ' + n); return; }
  ko++; console.log('  KO  ' + n + '\n      atteso ' + a + '\n      avuto  ' + b);
}
function sezione(t) { console.log('\n== ' + t); }
const conta = (sel) => val(`document.querySelectorAll(${JSON.stringify(sel)}).length`);
const visibile = (sel) => val(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});
  if(!e) return null; if(e.hidden) return false;
  const r=e.getBoundingClientRect(); return r.width>0 && r.height>0;})()`);

(async () => {
  await collega();

  /* Stato di fabbrica. Senza, il primo controllo misura l'uso di ieri invece
     della promessa di oggi: è il falso allarme costato tempo su `prova-b1`.
     ⚠️ `studia.aperto` ne fa parte da quando ci sta anche il segno di QUALE
     mappa si stava guardando: una prova passata prima che abbia aperto una
     mappa dell'utente la farebbe riaprire, e qui il primo controllo — la
     tendina della mappa GENERATA — misurerebbe l'altro registro. */
  await val(`Object.keys(localStorage).filter(function(k){ return k.indexOf('studia.banco')===0; })
               .forEach(function(k){ localStorage.removeItem(k); });
             localStorage.removeItem('studia.aperto');
             localStorage.removeItem('studia.mappa.'+(localStorage.getItem('studia.corso')||'-')); 1`);
  await val('location.reload(), 1'); await pausa(1600);
  await collega(); await pausa(600);

  const corso = await val('corsoAttivo()');
  /* ⚠️ Il vault si chiede all'APP, non alla config dell'utente. L'istanza di
     prova ha una cartella dati sua (`--user-data-dir`), quindi la config di
     casa direbbe il vault vero mentre l'app ne sta usando un altro: i controlli
     su disco cercherebbero i file nel posto sbagliato e, peggio, la pulizia
     finale guarderebbe la cartella dell'utente. */
  const vault = await val('window.vault && window.vault.vaultPath');
  if (!vault) { console.log('  KO  l\'app non dice dove sia il vault'); process.exit(1); }
  const DIR_MAPPE = path.join(vault, 'Corsi', corso, 'MAPPE');
  const DIR_NOTE = path.join(vault, 'Corsi', corso, 'APPUNTI');
  console.log('corso:', corso, '· vault:', vault);
  /* La rete della trappola ⑧, chiesta all'app e non allo script che l'ha
     lanciata: questa prova CREA ED ELIMINA mappe e appunti, e se stesse
     girando sul vault vero cancellerebbe roba dell'utente. Se la separazione
     non ha funzionato, qui ci si ferma prima di toccare qualunque cosa. */
  if (vault.indexOf('studia-prove-') < 0) {
    console.log('  KO  sto guardando il vault VERO (' + vault + '): mi fermo prima di creare qualcosa');
    process.exit(1);
  }

  await apriStrumento('mappa');
  ok('la mappa si apre', true, await val('mappaAperta()'));

  // ---------------------------------------------------------------- le scale
  sezione('Due scale, non tre: del capitolo non si genera più niente');
  ok('la tendina offre corso e lezione, e nient’altro', ['corso', 'lezione'],
    await val("Array.from(document.querySelectorAll('#mAmbito option')).map(o=>o.value)"));
  ok('e parte dalla lezione', 'lezione', await val('MAPPA.ambito'));
  const nLezione = await conta('#mappaSvg .mnodo');
  ok('la mappa della lezione ha dei nodi', true, nLezione > 1);

  await val("MAPPA.ambito='corso'; mappaAdatta(); mappaRidisegna(); 1"); await pausa(800);
  ok('la mappa di corso si costruisce', true, (await conta('#mappaSvg .mnodo')) > 1);
  ok('e nomina le lezioni', true,
    await val("MAPPA.res && Object.keys(MAPPA.res.pos).some(id=>(MAPPA.nodi[id]||{}).genere==='lezione')"));

  // --------------------------------------------------------- la profondità
  sezione('Lo slider della profondità toglie nodi, e lo zero vuol dire «tutta»');
  await clicca('#mVista'); await pausa(300);
  ok('il pannellino ⚙ si apre e ha lo slider', true, await visibile('#mProfondita'));
  ok('allo zero il numerino dice «tutta»', 'tutta', await val("document.querySelector('#mProfonditaV').textContent"));
  const nTutta = await conta('#mappaSvg .mnodo');
  await val("(()=>{const s=document.querySelector('#mProfondita'); s.value=1; s.dispatchEvent(new Event('input',{bubbles:true}));})(); 1"); await pausa(600);
  const nUno = await conta('#mappaSvg .mnodo');
  ok('a profondità 1 i nodi sono meno', true, nUno > 0 && nUno < nTutta);
  ok('e il numerino dice il numero', '1', await val("document.querySelector('#mProfonditaV').textContent"));
  await val("(()=>{const s=document.querySelector('#mProfondita'); s.value=0; s.dispatchEvent(new Event('input',{bubbles:true}));})(); 1"); await pausa(600);
  ok('tornando a zero torna tutta la mappa', nTutta, await conta('#mappaSvg .mnodo'));
  await val('closePops(), 1'); await pausa(200);

  // ---------------------------------------------------------------- il focus
  sezione('Il focus: un concetto con attorno solo ciò che lo tocca');
  const idNodo = await val(`(()=>{const e=document.querySelector('#mappaSvg .mnodo[data-id]');
    return e ? e.getAttribute('data-id') : null;})()`);
  ok('c’è un nodo da mettere a fuoco', true, !!idNodo);
  await val(`mappaFocus(${JSON.stringify(idNodo)}, 'vicini'), 1`); await pausa(600);
  const nFocus = await conta('#mappaSvg .mnodo');
  ok('a fuoco si vedono meno nodi', true, nFocus > 0 && nFocus < nTutta);
  ok('e una riga a schermo dice in che modo si è', true, await visibile('#mModo'));
  ok('il cursore però NON è quello di «collega»', '', await val('document.documentElement.dataset.mcollega'));
  /* ⚠️ UN solo Esc, e mandato sul documento. Il gestore vero è registrato in
     CATTURA su `window`, e la fase di cattura di un evento lanciato sul
     documento passa comunque da lì: due dispatch sarebbero due pressioni, e la
     seconda — col focus ormai spento — scenderebbe legittimamente allo strato
     sotto, che chiude la mappa. Il tasto è uno, la prova ne deve premere uno. */
  await val("document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})); 1");
  await pausa(500);
  ok('Esc esce dal focus e non chiude la mappa', [null, true], [await val('MAPPA.focus'), await val('mappaAperta()')]);
  ok('e la mappa torna intera', nTutta, await conta('#mappaSvg .mnodo'));

  /* ⚠️ ESC A VUOTO NON TOGLIE LA MAPPA DAL BLOCCO (23 agosto 2026). L'ultimo
     gradino della catena chiamava `bancoTogli('mappa')`, e non «chiudeva» —
     SVUOTAVA il blocco: tendina a «—» e «Scegli uno strumento qui sopra», col
     banco da ricomporre a mano. Trovato provando a mano con gli split aperti,
     dove era l'unica cosa che quel tasto facesse.
     Qui si preme TRE volte con niente aperto dentro la mappa: una sola sarebbe
     potuta passare per il motivo sbagliato — uno strato interno ancora acceso a
     fare da parafulmine. E la ✕ deve continuare a togliere la mappa: si toglie
     un gradino alla catena, non il gesto. */
  for (let i = 0; i < 3; i++) {
    await val("document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})); 1");
    await pausa(200);
  }
  ok('tre Esc a vuoto NON tolgono la mappa dal blocco', true, await val('mappaAperta()'));
  await clicca('#mChiudi'); await pausa(400);
  ok('ma la ✕ sì', false, await val('mappaAperta()'));
  /* Si rimette com'era: lo stato che una prova lascia è l'ingresso di quella dopo. */
  await apriStrumento('mappa'); await pausa(600);
  ok('e la mappa si riapre per le prove che seguono', true, await val('mappaAperta()'));

  // ------------------------------------------------- zoom, collasso, parentela
  sezione('Lo zoom arriva dove serve, e i rami si chiudono in un gesto');
  await val("MAPPA.ambito='corso'; mappaAdatta(); mappaRidisegna(); 1"); await pausa(1200);
  const lim = await val('mappaZoomLimiti()');
  const nCorso = await conta('#mappaSvg .mnodo');
  console.log('   mappa di corso: ' + nCorso + ' nodi · tetto dello zoom ' + Math.round(lim.max) + '×');
  /* ⚠️ Il controllo non è «il tetto è alto»: è «il tetto basta a leggere». Una
     mappa di corso è un nastro largo decine di migliaia di pixel, che il
     viewBox riduce a meno di un centesimo: col vecchio tetto fisso a 6 il
     massimo ingrandimento valeva il 5% della grandezza vera. */
  ok('il tetto dello zoom non è più il 6 fisso', true, lim.max > 6);
  ok('e arriva oltre la grandezza naturale del disegno', true,
    await val('mappaZoomLimiti().max >= (1/Math.min(document.querySelector("#mappaSvg").getBoundingClientRect().width/(document.querySelector("#mappaSvg").getAttribute("viewBox").split(" ")[2]), document.querySelector("#mappaSvg").getBoundingClientRect().height/(document.querySelector("#mappaSvg").getAttribute("viewBox").split(" ")[3])))'));
  // la rotella vera, dieci scatti in avanti sul centro della tela
  const centro = await val(`(()=>{const r=document.querySelector('#mappaSvg').getBoundingClientRect();
    return {x:Math.round(r.left+r.width/2), y:Math.round(r.top+r.height/2)};})()`);
  const k0 = await val('MAPPA.z.k');
  for (let i = 0; i < 10; i++) {
    await invia('Input.dispatchMouseEvent', { type: 'mouseWheel', x: centro.x, y: centro.y, deltaX: 0, deltaY: -120 });
  }
  await pausa(300);
  const k1 = await val('MAPPA.z.k');
  ok('la rotella ingrandisce davvero', true, k1 > k0 * 2);
  ok('e dieci scatti superano il vecchio tetto', true, k1 > 6);
  await val('mappaAdatta(), 1'); await pausa(200);

  ok('nel menu della mappa c’è «Collassa tutto»', true,
    await val(`(()=>{ mapMenuApri(200,200,{tipo:'vuoto',id:null});
      return !!document.querySelector('#mapMenu [data-az="chiuditutto"]'); })()`));
  await clicca('#mapMenu [data-az="chiuditutto"]'); await pausa(700);
  const nChiusa = await conta('#mappaSvg .mnodo');
  ok('collassando restano molti meno nodi', true, nChiusa > 0 && nChiusa < nCorso / 3);
  ok('ma la radice resta, con i suoi figli', true, nChiusa > 1);
  ok('e adesso il menu offre la strada del ritorno', true,
    await val(`(()=>{ mapMenuApri(200,200,{tipo:'vuoto',id:null});
      return !!document.querySelector('#mapMenu [data-az="apritutto"]'); })()`));
  await clicca('#mapMenu [data-az="apritutto"]'); await pausa(800);
  ok('espandendo torna la mappa di prima', nCorso, await conta('#mappaSvg .mnodo'));

  sezione('Passando sopra un nodo si accende la sua parentela');
  /* ⚠️ Non «il primo nodo del DOM», ma il primo che sta DAVVERO sotto il
     puntatore in quel punto: su una mappa di corso il primo nodo può finire
     dietro la barra degli strumenti o fuori dalla parte visibile del blocco, e
     allora il movimento del mouse arriva a quello che gli sta sopra. La prova
     accuserebbe l'evidenziazione di non accendersi per un motivo che con
     l'evidenziazione non c'entra niente — e un nodo che l'utente non può
     sfiorare non è il nodo di cui si sta provando il comportamento. */
  const puntoNodo = await val(`(()=>{
    for(const e of document.querySelectorAll('#mappaSvg .mnodo[data-id]')){
      const r=e.getBoundingClientRect();
      if(!(r.width>0 && r.height>0)) continue;
      const x=Math.round(r.left+r.width/2), y=Math.round(r.top+r.height/2);
      const sotto=document.elementFromPoint(x,y);
      if(sotto && e.contains(sotto)) return { id:e.getAttribute('data-id'), x, y };
    }
    return null; })()`);
  ok('c’è un nodo che si può sfiorare davvero', true, !!puntoNodo);
  /* ⚠️ DUE movimenti, e il primo è altrove. `pointerover` nasce quando il
     puntatore ENTRA in un elemento: senza una posizione di partenza diversa non
     c'è nessuna transizione da annunciare, e il gestore non viene mai chiamato —
     la prova accuserebbe l'evidenziazione di non accendersi mentre nessuno
     gliel'ha chiesto. Col mouse vero il problema non esiste, perché il puntatore
     da qualche parte viene sempre. */
  await invia('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 6, y: 300 });
  await pausa(120);
  await invia('Input.dispatchMouseEvent', { type: 'mouseMoved', x: puntoNodo.x, y: puntoNodo.y });
  await pausa(300);
  ok('l’evidenziazione si accende', '1', await val("document.querySelector('#mappaSvg').getAttribute('data-evid')"));
  /* Che cosa si accende non lo decide l'occhio: è esattamente `parentela` del
     modello — antenati e discendenti — e il controllo lo chiede al modello, non
     al disegno, altrimenti confermerebbe se stesso. */
  ok('e accende ESATTAMENTE la parentela che dice il modello', true,
    await val(`(()=>{ const attesa=MappaGrafo.parentela(MAPPA.gVisto, ${JSON.stringify(puntoNodo.id)}).sort();
      const accesi=Array.from(document.querySelectorAll('#mappaSvg .mnodo.mev')).map(e=>e.getAttribute('data-id')).sort();
      return JSON.stringify(attesa)===JSON.stringify(accesi); })()`));
  ok('anche i legami fra loro sono accesi', true,
    await val("document.querySelectorAll('#mappaSvg .marco.mev').length > 0"));
  await invia('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 5, y: 5 });
  await pausa(300);
  ok('e uscendo dalla mappa si spegne tutto', null,
    await val("document.querySelector('#mappaSvg').getAttribute('data-evid')"));

  // ---------------------------------------------------- la bolla delle fonti
  sezione('Il pallino delle fonti apre una bolla, col mouse VERO');
  /* Il grafo si prepara a mano — il registro «Mie» è il posto dove un nodo può
     avere le fonti che voglio — ma il resto è tutto dalla porta: il disegno lo
     fa `disegna.js`, il click lo manda `Input.dispatchMouseEvent`. */
  await clicca('#mRegistro button[data-reg="mie"]'); await pausa(700);
  await clicca('#mNuova'); await pausa(400);
  await val("document.querySelector('#umInput').value='Prova UI da cancellare'");
  await clicca('#umOk'); await pausa(1400);
  const fileMappa = await val('MAPPA.mia.file');
  ok('la mappa di prova esiste su disco', true, !!fileMappa && fs.existsSync(path.join(DIR_MAPPE, fileMappa)));

  await val(`(()=>{ const n=MAPPA.mia.grafo.nodi[0];
    n.fonti=[{type:'video',file:'v.mp4',t:90,label:'Prima fonte'},
             {type:'pdf',file:'d.pdf',page:4,label:'Seconda fonte'}];
    mappaRidisegna(); })(); 1`); await pausa(500);
  ok('il pallino compare e dichiara quante fonti sono', '2',
    await val("(document.querySelector('#mappaSvg .mfonte')||{getAttribute:()=>null}).getAttribute('data-fonti')"));
  await clicca('#mappaSvg .mfonte'); await pausa(400);
  ok('la bolla si apre', true, await visibile('#fontiBolla'));
  ok('e porta i NOMI delle fonti, cliccabili', ['Prima fonte', 'Seconda fonte'],
    await val("Array.from(document.querySelectorAll('#fontiBolla [data-fonte] .fb-eti')).map(e=>e.textContent)"));
  /* ⚠️ Il controllo che conta davvero: la bolla è ancora aperta DOPO il click
     che l'ha aperta. È il guasto 10.3.3 — l'apritore va nominato, non rincorso
     — e senza questa riga passerebbe anche una bolla che si richiude da sé. */
  await pausa(400);
  ok('e resta aperta: il click che l’ha aperta non la richiude', true, await visibile('#fontiBolla'));
  await val("openNote=function(n){ window.__aperta=n; }; 1");
  await clicca('#fontiBolla [data-fonte="1"]'); await pausa(300);
  ok('cliccando un nome si apre QUELLA fonte', ['pdf', 4], await val('[window.__aperta.type, window.__aperta.page]'));
  ok('e la bolla si chiude', false, await visibile('#fontiBolla'));

  // ------------------------------------------------------------- rinominare
  sezione('Rinominare una mappa: cambia il titolo E il nome del file');
  ok('il tasto c’è solo su una mappa che esiste come file', true, await visibile('#mRinomina'));
  await clicca('#mRinomina'); await pausa(400);
  await val("document.querySelector('#umInput').value='Prova UI rinominata'");
  await clicca('#umOk'); await pausa(1400);
  const fileNuovo = await val('MAPPA.mia.file');
  ok('il titolo è cambiato', 'Prova UI rinominata', await val('MAPPA.mia.titolo'));
  ok('e il nome del file lo segue', true, fileNuovo !== fileMappa);
  ok('il file vecchio non c’è più', false, fs.existsSync(path.join(DIR_MAPPE, fileMappa)));
  ok('quello nuovo sì', true, fs.existsSync(path.join(DIR_MAPPE, fileNuovo)));
  ok('e la tendina mostra il nome nuovo', true,
    await val("document.querySelector('#mAmbito').selectedOptions[0].textContent.indexOf('Prova UI rinominata')===0"));

  // ---------------------------------------------------------------- stampare
  sezione('Stampare: sul foglio finisce la cosa, non l’applicazione');
  await val("window.__foglio=null; window.print=function(){ window.__foglio=document.getElementById('stampaFoglio').outerHTML; }; 1");
  await clicca('#mStampa'); await pausa(500);
  const foglio = await val('window.__foglio');
  ok('la stampa della mappa riempie il foglio', true, !!foglio);
  ok('e ci mette la mappa intera, non la fetta a schermo', true, /<svg[^>]*viewBox=/.test(foglio || ''));
  ok('col titolo della mappa', true, (foglio || '').indexOf('Prova UI rinominata') > 0);
  ok('e la pagina coricata', true, /class="foglio-mappa"/.test(foglio || ''));
  ok('senza le maniglie, che su carta non si premono', false, /class="mporta"/.test(foglio || ''));

  // ------------------------------------------------- appunti: rinomina e stampa
  sezione('Gli appunti: stessa promessa, stesse due strade');
  const primaNote = fs.existsSync(DIR_NOTE) ? fs.readdirSync(DIR_NOTE) : [];
  await val(`(async()=>{ await noteNew(''); })(); 1`); await pausa(400);
  await val("document.querySelector('#umInput') && (document.querySelector('#umInput').value='Appunto di prova UI')");
  await clicca('#umOk'); await pausa(1200);
  const fileNota = await val('NOTES.cur && NOTES.cur.file');
  ok('l’appunto è nato', true, !!fileNota);
  await val("NOTES.mde.value('Una riga scritta a mano.'); 1");
  await clicca('#noteRen'); await pausa(400);
  await val("document.querySelector('#umInput').value='Appunto rinominato UI'");
  await clicca('#umOk'); await pausa(1200);
  ok('il titolo dell’appunto è cambiato', 'Appunto rinominato UI', await val('NOTES.cur.title'));
  ok('e il file lo segue', true, (await val('NOTES.cur.file')) !== fileNota);
  await val("window.__foglio=null; 1");
  await clicca('#noteStampa'); await pausa(500);
  const foglioNota = await val('window.__foglio');
  ok('la stampa dell’appunto porta il testo scritto', true, (foglioNota || '').indexOf('Una riga scritta a mano') > 0);
  ok('e NON è la pagina coricata della mappa', false, /class="foglio-mappa"/.test(foglioNota || ''));

  // ------------------------------------------------------------------ pulizia
  sezione('Pulizia: quello che questa prova ha creato, questa prova lo toglie');
  await val('window.confirm=()=>true; 1');
  await val('mappaEliminaMappa(), 1'); await pausa(1000);
  await val('noteDelete(), 1'); await pausa(800);
  const restano = (fs.existsSync(DIR_MAPPE) ? fs.readdirSync(DIR_MAPPE) : []).filter((f) => f.indexOf('Prova UI') === 0);
  /* ⚠️ Si saltano TUTTI i file di servizio, non solo `_indice.md`: in `APPUNTI/`
     cominciano per underscore, e dal 24 agosto ce n'è uno in più — `_riga.json`,
     il segno di dove eri rimasto (Q1), che nasce da solo appena si apre un
     appunto. Da sola questa prova era rossa dicendo «appunto di prova rimasto:
     _riga.json»; nella suite no, perché una prova precedente l'aveva già fatto
     nascere e finiva nel conto di partenza. Un rosso che dipende da chi ti
     precede è un rosso che non parla. */
  const noteRestano = (fs.existsSync(DIR_NOTE) ? fs.readdirSync(DIR_NOTE) : [])
    .filter((f) => primaNote.indexOf(f) < 0 && f.charAt(0) !== '_');
  ok('nessuna mappa di prova rimasta', [], restano);
  ok('nessun appunto di prova rimasto', [], noteRestano);

  console.log('\n' + (ko ? '✗ ' + ko + ' controlli falliti' : '✓ tutti i controlli passati'));
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
