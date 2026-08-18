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
    EVIDENZE.viste=null; EVIDENZE.visteCorso=''; return 1; })()`);
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

  sezione('⚠️ LE LETTURE: le stesse parole, due analisi');
  /* È la ragione per cui gli strati esistono. Prima del 18 agosto 2026 segnare
     due volte le stesse parole cambiava il colore della prima evidenza: le
     stesse parole, lo stesso id. */
  await val(`(function(){ try{ Object.keys(localStorage)
    .filter(function(k){ return k.indexOf('studia.evidenze.')===0; })
    .forEach(function(k){ localStorage.removeItem(k); }); }catch(e){}
    EVIDENZE.viste=null; EVIDENZE.visteCorso=''; return 1; })()`);
  const corso = await val('corsoAttivo()');
  /* Si parte da un capitolo pulito: le prove di prima hanno segnato qui. */
  await val(`(function(){ var r=window.vault.evidenze.salva(corsoAttivo(), []);
    EVIDENZE.elenco=r.evidenze||[]; evidenzeDisegna(); return 1; })()`);
  await pausa(400);

  const met = await val(`(function(){ var r=window.vault.evidenze.creaStrato(corsoAttivo(), 'Metrica');
    EVIDENZE.strati=r.strati||[]; return r.strato ? r.strato.id : ''; })()`);
  const ret = await val(`(function(){ var r=window.vault.evidenze.creaStrato(corsoAttivo(), 'Retorica');
    EVIDENZE.strati=r.strati||[]; return r.strato ? r.strato.id : ''; })()`);
  ok('due letture create', true, !!met && !!ret && met !== ret);

  /* LO STESSO identico intervallo, segnato in due letture. */
  const SEGNA = (colore) => `(function(){
    var ps=document.querySelectorAll('#content p'); var p=ps[1]||ps[0];
    var t=[].slice.call(p.childNodes).filter(function(n){ return n.nodeType===3 && n.nodeValue.trim().length>40; })[0];
    var r=document.createRange(); r.setStart(t,0); r.setEnd(t,18);
    evidenzia(r, ${JSON.stringify(colore)});
    return r.toString(); })()`;
  const colori = await val('evidenzeColori()');
  await val(`evStratoAttivoScegli(${JSON.stringify(met)}), 1`);
  const testo1 = await val(SEGNA(colori[0]));
  await pausa(500);
  await val(`evStratoAttivoScegli(${JSON.stringify(ret)}), 1`);
  const testo2 = await val(SEGNA(colori[2]));
  await pausa(600);
  ok('si è segnato due volte lo stesso testo', true, !!testo1 && testo1 === testo2);

  /* ⚠️ Non si cerca la stringa che il `Range` ha restituito: quello che finisce
     su disco è il testo NORMALIZZATO del capitolo (gli spazi si riducono), e
     confrontarlo con quello del DOM fa fallire il controllo per un motivo che
     con gli strati non c'entra niente. Si chiede invece la cosa vera: c'è un
     testo segnato due volte? */
  const due = await val(`(function(){ var l=window.vault.evidenze.leggi(corsoAttivo());
    var per={}; (l.evidenze||[]).forEach(function(x){ (per[x.exact]=per[x.exact]||[]).push(x); });
    var doppi=Object.keys(per).filter(function(k){ return per[k].length>1; });
    return doppi.length ? per[doppi[0]].map(function(x){
      return { strato:x.strato, colore:x.colore, id:x.id }; }) : []; })()`);
  ok('sul disco ce ne sono DUE, non una ricolorata', 2, due.length);
  ok('una per lettura', [met, ret].sort(), due.map((x) => x.strato).sort());
  ok('con id diversi', 2, new Set(due.map((x) => x.id)).size);
  ok('e ognuna col suo colore', [colori[0], colori[2]].sort(), due.map((x) => x.colore).sort());

  sezione('Le letture si accendono e si spengono una per una');
  /* ⚠️ Fino al 18 agosto qui ne veniva dipinta UNA sola: `risolvi` eleggeva un
     vincitore fra i segni che si accavallano — regola giusta quando i segni si
     facevano marcando il DOM, dove due `<span>` sugli stessi caratteri non si
     annidano. Dal 19 si accendono tutti (vedi in fondo a questa prova); qui si
     misura l'altra metà: che ogni lettura si spenga per conto suo. */
  const accesiDue = await finoA(ACCESI, 8000);
  console.log('   accesi con tutt\'e due le letture: ' + accesiDue);
  ok('con due letture accese si dipingono due segni', 2, accesiDue);
  await val(`stratoCommuta(${JSON.stringify(met)}), 1`);
  await pausa(600);
  ok('spegnendo la metrica resta quello della retorica', 1, await val(ACCESI));
  await val(`stratoCommuta(${JSON.stringify(ret)}), 1`);
  await pausa(600);
  ok('spegnendo anche la retorica non resta acceso niente', 0, await val(ACCESI));
  await val(`stratoCommuta(${JSON.stringify(met)}), 1`);
  await pausa(600);
  ok('e riaccendendo la metrica torna il suo', 1, await val(ACCESI));
  await val(`stratoCommuta(${JSON.stringify(ret)}), 1`);
  await val(`stratoCommuta(${JSON.stringify(met)}), 1`);
  await pausa(400);
  ok('ma sul disco sono ancora due', 2,
    await val(`(function(){ var l=window.vault.evidenze.leggi(corsoAttivo());
      var per={}; (l.evidenze||[]).forEach(function(x){ per[x.exact]=(per[x.exact]||0)+1; });
      var conti=Object.keys(per).map(function(k){ return per[k]; });
      return conti.length ? Math.max.apply(null, conti) : 0; })()`));

  sezione('Il pannellino: una riga per lettura, col conto e con l\'occhio');
  await apriStrumento('fonte');
  await pausa(400);
  await val(`document.getElementById('pdfStrati').click(), 1`);
  await pausa(400);
  const pannello = await val(`(function(){ var p=document.getElementById('stratiPop');
    if(!p || !p.hasAttribute('open')) return null;
    var righe=[].slice.call(p.querySelectorAll('.stratoriga')).map(function(r){
      return { id:r.getAttribute('data-strato'),
               nome:r.querySelector('.stratonome').textContent,
               conto:r.querySelector('.tbnota').textContent,
               spenta:r.classList.contains('spenta'),
               attiva:r.classList.contains('attiva'),
               altBottone:Math.round(r.querySelector('.tbtn').getBoundingClientRect().height) };
    });
    return { aperto:true, righe:righe }; })()`);
  ok('il pannellino si apre', true, !!pannello && pannello.aperto);
  ok('con una riga per lettura', ['Metrica', 'Retorica'],
    (pannello.righe || []).map((r) => r.nome));
  ok('ognuna col suo conto', ['1', '1'], (pannello.righe || []).map((r) => r.conto));
  ok('la metrica si vede che è spenta', [true, false], (pannello.righe || []).map((r) => r.spenta));
  ok('e la retorica è quella che riceve i segni nuovi', [false, true],
    (pannello.righe || []).map((r) => r.attiva));
  /* ⚠️ I comandi del pannellino sono `.tbtn` come tutti gli altri: nessuna
     misura sua (invariante 8). È la stessa verifica di `prova-tbar`. */
  ok('e i suoi comandi sono alti quanto quelli di ogni barra', [30, 30],
    (pannello.righe || []).map((r) => r.altBottone));

  sezione('⚠️ Togliere una lettura non porta via i segni in silenzio');
  const prima = await val('(EVIDENZE.elenco||[]).length');
  const esito = await val(`(function(){ var r=window.vault.evidenze.rimuoviStrato(corsoAttivo(), ${JSON.stringify(met)}, '');
    return { err:r.error, spostate:r.spostate, tolte:r.tolte, rinati:r.rinati.length, strati:r.strati.length }; })()`);
  ok('la lettura si toglie', '', esito.err);
  ok('e i suoi segni si spostano nella base', 1, esito.spostate);
  ok('nessuno viene buttato', 0, esito.tolte);
  /* ⚠️ Spostandoli l'id CAMBIA — lo strato è nel seme — e la funzione lo dice,
     perché un `ev:<id>` scritto in un appunto non li ritrova più. */
  ok('e il cambio di identità è dichiarato', 1, esito.rinati);
  ok('nel registro ne resta una', 1, esito.strati);
  await val(`(function(){ var l=window.vault.evidenze.leggi(corsoAttivo());
    EVIDENZE.elenco=l.evidenze||[]; EVIDENZE.strati=l.strati||[]; evidenzeDisegna(); return 1; })()`);
  await pausa(500);
  ok('le evidenze sono ancora due', prima, await val('(EVIDENZE.elenco||[]).length'));

  sezione('⚠️ PIÙ LETTURE SULLA STESSA PAROLA: si vedono tutte');
  /* La misura che vale: quanti intervalli il browser sta dipingendo davvero.
     Prima del 19 agosto valeva 1 comunque — `risolvi` eleggeva un vincitore e
     il resto spariva dallo schermo pur restando contato nel pannellino. */
  await val(`(function(){ try{ Object.keys(localStorage)
    .filter(function(k){ return k.indexOf('studia.evidenze.viste.')===0; })
    .forEach(function(k){ localStorage.removeItem(k); }); }catch(e){}
    EVIDENZE.viste=null; EVIDENZE.visteCorso='';
    window.vault.evidenze.salva(corsoAttivo(), []);
    var l=window.vault.evidenze.leggi(corsoAttivo());
    (l.strati||[]).forEach(function(x){ window.vault.evidenze.rimuoviStrato(corsoAttivo(), x.id, 'via'); });
    var d=window.vault.evidenze.leggi(corsoAttivo());
    EVIDENZE.elenco=d.evidenze||[]; EVIDENZE.strati=d.strati||[]; evidenzeDisegna(); return 1; })()`);
  await pausa(400);

  /* Quattro letture sullo STESSO intervallo: due col fondo, due con la riga.
     ⚠️ Quattro letture DIVERSE, e non quattro segni nella stessa: dentro una
     lettura ri-segnare lo stesso punto è il gesto «cambia colore», e il tratto
     si eredita da quello che c'è già. */
  const conf = [['Fondo A', 'overlay', 0], ['Riga A', 'sotto', 2],
                ['Riga B', 'sotto', 3], ['Fondo B', 'overlay', 4]];
  const fatte = [];
  for (const [nome, tratto, ci] of conf) {
    const id = await val(`(function(){ var r=window.vault.evidenze.creaStrato(corsoAttivo(), ${JSON.stringify(nome)});
      EVIDENZE.strati=r.strati||[]; return r.strato ? r.strato.id : ''; })()`);
    fatte.push(id);
    await val(`evStratoAttivoScegli(${JSON.stringify(id)}), 1`);
    await val(`evidenzeTrattoScegli(${JSON.stringify(tratto)}), 1`);
    await val(SEGNA(colori[ci]));
    await pausa(450);
  }
  await pausa(500);
  ok('sul disco ce ne sono quattro', 4, await val('(EVIDENZE.elenco||[]).length'));
  /* ⚠️ IL CONTROLLO DI QUESTO LAVORO: quattro segni sulla stessa parola,
     quattro accesi. Ieri sarebbe stato 1. */
  ok('e sul testo si accendono tutti e quattro', 4, await val(ACCESI));

  const css = await val(`(document.getElementById('evStile')||{}).textContent||''`);
  console.log('   ' + css.split('\n').filter(function (r) {
    return /highlight\(ev-/.test(r) && !/#content/.test(r); }).join('\n   '));
  ok('la seconda riga è tratteggiata sopra la prima', true, /underline dashed/.test(css));
  /* ⚠️ I due fondi diventano semitrasparenti e il browser li MESCOLA: le bande
     orizzontali vorrebbero un `background-image`, che `::highlight()` non
     applica — misurato sull'app viva, con un gradiente semplicemente ignorato. */
  ok('i due fondi si mescolano', 2, (css.match(/color-mix\(in srgb/g) || []).length);
  ok('e nessuno dei due resta pieno a coprire l\'altro', false,
    /background-color: #[0-9a-f]{6};/i.test(css));

  sezione('Spegnendone una, chi resta torna com\'era da solo');
  await val(`stratoCommuta(${JSON.stringify(fatte[0])}), 1`);
  await pausa(600);
  ok('gli accesi scendono a tre', 3, await val(ACCESI));
  const css2 = await val(`(document.getElementById('evStile')||{}).textContent||''`);
  /* Rimasto un fondo solo, torna PIENO: non si cambia l'aspetto di ciò che è
     solo, ed è la regola che lascia identico tutto quello che c'era prima. */
  ok('il fondo rimasto torna pieno', 1, (css2.match(/background-color: #[0-9a-f]{6};/gi) || []).length);
  ok('e nessuna mescolanza resta accesa per sbaglio', 0, (css2.match(/color-mix\(in srgb/g) || []).length);
  await val(`stratoCommuta(${JSON.stringify(fatte[0])}), 1`);
  await pausa(300);

  sezione('E si rimette com\'era');
  await val(`(function(){ var l=window.vault.evidenze.leggi(corsoAttivo());
    (l.strati||[]).forEach(function(s){ window.vault.evidenze.rimuoviStrato(corsoAttivo(), s.id, 'via'); });
    window.vault.evidenze.salva(corsoAttivo(), []);
    var d=window.vault.evidenze.leggi(corsoAttivo());
    EVIDENZE.elenco=d.evidenze||[]; EVIDENZE.strati=d.strati||[];
    evidenzeDisegna(); return 1; })()`);
  await pausa(500);
  ok('il vault di prova torna senza letture', 0, await val('(EVIDENZE.strati||[]).length'));

  sezione('E l\'interruttore generale torna com\'era');
  await val(`(function(){ try{ Object.keys(localStorage)
    .filter(function(k){ return k.indexOf('studia.evidenze.viste.')===0; })
    .forEach(function(k){ localStorage.removeItem(k); }); }catch(e){}
    EVIDENZE.viste=null; EVIDENZE.visteCorso=''; if(typeof evidenzeDisegna==='function') evidenzeDisegna();
    return 1; })()`);
  await pausa(500);
  ok('l\'interruttore torna a «si vedono»', 'false',
    await val(`document.getElementById('pdfEvid').getAttribute('aria-pressed')`));

  console.log('');
  console.log(ko ? '✗ ' + ko + ' controlli falliti' : '✓ tutti i controlli passati');
  process.exit(ko ? 1 : 0);
})();
