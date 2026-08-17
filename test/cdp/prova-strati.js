/* L'interruttore delle sottolineature, sull'app viva.
 *
 * La regola pura la prova `test/strati.js`. Di qui non si vede: quello che solo
 * l'app viva può dire è
 *
 *   1. che spegnere spenga DAVVERO il colore sul testo — si guarda il registro
 *      degli highlight, non l'attributo di un bottone;
 *   2. ⚠️ che spegnere NON cambi che cosa succede: con i segni nascosti,
 *      ri-evidenziare una frase già segnata deve ancora riconoscerla. È il
 *      motivo per cui il filtro sta dove si dipinge e non dentro `evidenzeDi`,
 *      che serve anche ai gesti;
 *   3. che le evidenze restino sul disco, e che l'elenco lo dica;
 *   4. che i due bottoni — barra della Fonte e barra delle Parole chiave —
 *      siano lo stesso interruttore, vestito col token della barra.
 *
 *   ./test/cdp/con-vault-di-prova.sh prova-strati.js
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
  const fine = Date.now() + (quanto || 12000);
  for (;;) {
    const v = await val(expr); if (v) return v;
    if (Date.now() > fine) return null; await pausa(220);
  }
}

/* Che cosa è ACCESO davvero: quanti intervalli il browser sta dipingendo. Un
   bottone premuto non prova niente — il colore sta nel registro. */
const ACCESI = `(()=>{ let n=0;
  (EVIDENZE.nomi||[]).forEach(function(k){ const h=CSS.highlights.get(k); if(h) n+=h.size; });
  return n; })()`;

(async () => {
  await collega();
  await val('location.reload(), 1'); await pausa(2000);
  await collega(); await pausa(800);
  await partiPulito();
  /* Si dichiara lo stato invece di ereditarlo: la memoria dell'interruttore è
     per contenitore e sopravvive alle prove di prima. */
  await val(`(function(){ try{ Object.keys(localStorage)
    .filter(function(k){ return k.indexOf('studia.evidenze.viste.')===0; })
    .forEach(function(k){ localStorage.removeItem(k); }); }catch(e){}
    EVIDENZE.strati=null; EVIDENZE.stratiCorso=''; return 1; })()`);
  await pausa(300);

  sezione('Si segna qualcosa, e si vede');
  /* ⚠️ CORTO: due parole piene, o l'evidenza non entra nell'elenco delle parole
     chiave (`KW_MAX_PAROLE`) e il controllo sui chip misurerebbe la regola
     sbagliata. È il metro dichiarato in `kwEParolaChiave`, non un caso. */
  const preso = await val(`(()=>{
    const ps=document.querySelectorAll('#content p'); const p=ps[1]||ps[0]; if(!p) return '';
    const t=[...p.childNodes].find(n=>n.nodeType===3 && n.nodeValue.trim().length>40);
    if(!t) return '';
    const testo=t.nodeValue, i=testo.indexOf(' ', 3), j=testo.indexOf(' ', i+1);
    if(i<0 || j<0) return '';
    const r=document.createRange(); r.setStart(t,0); r.setEnd(t, j);
    evidenzia(r, evidenzeColori()[1]);
    return r.toString(); })()`);
  ok('l\'evidenza è stata fatta', true, !!preso && preso.length > 8);
  const accesiPrima = await finoA(ACCESI, 8000);
  console.log('   intervalli accesi: ' + accesiPrima);
  ok('e qualcosa è acceso sul testo', true, accesiPrima > 0);
  const quante = await val('(EVIDENZE.elenco||[]).length');

  sezione('Il bottone è quello della barra, col token della barra');
  /* ⚠️ Il riquadro dev'essere A SCHERMO per misurarlo: il banco tiene in
     magazzino gli strumenti che non mostra, e là dentro un bottone è alto zero.
     Non è un difetto del bottone — è dove si stava guardando. */
  await apriStrumento('fonte');
  await pausa(400);
  const b = await val(`(()=>{ const e=document.getElementById('pdfEvid');
    if(!e) return null; const s=getComputedStyle(e);
    return { classe:e.className, alt:Math.round(e.getBoundingClientRect().height),
             premuto:e.getAttribute('aria-pressed'), nome:e.getAttribute('aria-label')||'',
             raggio:s.borderRadius }; })()`);
  ok('c\'è, sulla barra della Fonte', 'tbtn', b && b.classe);
  /* ⚠️ L'altezza viene dal token `--tb-h`, come ogni bottone di ogni barra: è
     la stessa misura che sorveglia `prova-tbar`. Un bottone nuovo con
     un'altezza sua sarebbe il vestito ricopiato (invariante 8). */
  ok('ed è alto quanto i suoi fratelli', 30, b && b.alt);
  ok('senza angoli tondi, come tutte le barre di StudIA', '0px', b && b.raggio);
  ok('di partenza non è premuto: i segni si vedono', 'false', b && b.premuto);
  ok('e il nome dice che cosa fa, non un\'icona muta', true, /ascondi/.test((b && b.nome) || ''));

  sezione('Premendolo, il colore si spegne — e le evidenze restano');
  await val(`document.getElementById('pdfEvid').click(), 1`);
  await pausa(600);
  ok('sul testo non è acceso più niente', 0, await val(ACCESI));
  /* ⚠️ È il controllo che conta: nascondere non è cancellare. */
  ok('ma le evidenze sono tutte lì', quante, await val('(EVIDENZE.elenco||[]).length'));
  ok('e sul disco pure', quante,
    await val('((window.vault.evidenze.leggi(corsoAttivo())||{}).evidenze||[]).length'));
  ok('il bottone lo dichiara', 'true',
    await val(`document.getElementById('pdfEvid').getAttribute('aria-pressed')`));

  sezione('⚠️ Nascondere cambia come si VEDE, non che cosa SUCCEDE');
  /* Se il filtro stesse dentro `evidenzeDi` — che serve anche ai gesti — con i
     segni spenti `evidenzaSotto` direbbe «qui non c'è niente», e ri-evidenziare
     quella frase le cambierebbe il colore di nascosto invece di riconoscerla. */
  const riconosce = await val(`(()=>{
    const ps=document.querySelectorAll('#content p'); const p=ps[1]||ps[0];
    const t=[...p.childNodes].find(n=>n.nodeType===3 && n.nodeValue.trim().length>40);
    const r=document.createRange(); r.setStart(t,2); r.setEnd(t,6);
    const v=evidenzaSotto(r);
    return v ? { trovata:true, colore:v.colore } : { trovata:false }; })()`);
  ok('con i segni spenti, l\'app sa ancora che lì c\'è un\'evidenza', true, riconosce.trovata);
  ok('e ne conosce il colore', await val('evidenzeColori()[1]'), riconosce.colore);

  sezione('L\'elenco delle parole chiave resta, e lo dice');
  await apriStrumento('keyword');
  await pausa(500);
  const elenco = await val(`(()=>{ const h=document.getElementById('kwLista');
    return { avviso:/nascoste sul testo/.test(h.textContent),
             chip:h.querySelectorAll('.kwchip').length }; })()`);
  ok('la riga che spiega c\'è', true, elenco.avviso);
  /* Spegnere serve a rileggere il testo pulito, non a mettere via le proprie
     parole chiave: l'elenco è anche il modo per ritrovarle. */
  ok('e i chip non sono spariti', true, elenco.chip > 0);

  sezione('I due bottoni sono lo stesso interruttore');
  const gemello = await val(`(()=>{ const e=document.getElementById('kwEvid');
    if(!e) return null; return { classe:e.className, alt:Math.round(e.getBoundingClientRect().height),
      premuto:e.getAttribute('aria-pressed') }; })()`);
  ok('il gemello c\'è nella barra delle Parole chiave', 'tbtn', gemello && gemello.classe);
  ok('con la stessa misura', 30, gemello && gemello.alt);
  ok('e mostra lo stesso stato', 'true', gemello && gemello.premuto);
  await val(`document.getElementById('kwEvid').click(), 1`);
  await pausa(600);
  ok('premendo lui, i segni tornano', true, (await val(ACCESI)) > 0);
  ok('e anche il bottone della Fonte lo dice', 'false',
    await val(`document.getElementById('pdfEvid').getAttribute('aria-pressed')`));

  sezione('La scelta si ricorda, e vale per QUESTO contenitore');
  await val(`document.getElementById('pdfEvid').click(), 1`);
  await pausa(400);
  const chiave = await val(`(()=>{ const k='studia.evidenze.viste.'+corsoAttivo();
    return localStorage.getItem(k)||''; })()`);
  console.log('   ' + JSON.stringify(chiave));
  ok('è scritta nella memoria di questo computer', true, /"tutte":false/.test(chiave));
  /* ⚠️ Per CONTENITORE: spegnere le sottolineature di un'antologia non deve
     spegnerle nel corso che si apre dopo — sono due letture diverse. */
  ok('e la chiave nomina il contenitore', true,
    chiave !== '' && (await val(`localStorage.getItem('studia.evidenze.viste.')===null`)));

  await val('location.reload(), 1'); await pausa(2200);
  await collega(); await pausa(900);
  /* ⚠️ Si aspetta che il contenitore sia CARICATO, non che l'oggetto esista:
     `EVIDENZE.elenco` è un array vuoto fin dalla prima riga del renderer, quindi
     è vero subito e non dice niente. Il segnale è `EVIDENZE.corso`, che si
     riempie quando le evidenze del contenitore sono state lette — ed è lo stesso
     momento in cui gli interruttori si rifanno. */
  const tornato = await finoA(`(typeof EVIDENZE!=='undefined' && EVIDENZE.corso) ? 1 : 0`, 15000);
  ok('il contenitore è tornato su', 1, tornato);
  ok('dopo un riavvio i segni sono ancora spenti', 'true',
    await val(`document.getElementById('pdfEvid').getAttribute('aria-pressed')`));

  sezione('E si rimette com\'era');
  await val(`(function(){ try{ Object.keys(localStorage)
    .filter(function(k){ return k.indexOf('studia.evidenze.viste.')===0; })
    .forEach(function(k){ localStorage.removeItem(k); }); }catch(e){}
    EVIDENZE.strati=null; EVIDENZE.stratiCorso=''; if(typeof evidenzeDisegna==='function') evidenzeDisegna();
    return 1; })()`);
  await pausa(500);
  ok('l\'interruttore torna a «si vedono»', 'false',
    await val(`document.getElementById('pdfEvid').getAttribute('aria-pressed')`));

  console.log('');
  console.log(ko ? '✗ ' + ko + ' controlli falliti' : '✓ tutti i controlli passati');
  process.exit(ko ? 1 : 0);
})();
