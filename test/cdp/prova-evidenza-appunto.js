/* Il colore di un'evidenza, dentro un appunto — sull'app viva.
 *
 * La grammatica (`ev:<id>`) e la resa (`[==testo==](ev:…)` → `<mark>`) le
 * provano in Node `test/rimandi.js` e `test/evidenze-appunti.js`. Di qui non si
 * vedono: quello che solo l'app viva può dire è
 *
 *   1. che il colore che il `<mark>` porta nell'appunto sia LO STESSO che
 *      l'evidenza ha sulla fonte — due strade diverse fino a due schermate
 *      diverse, e l'unico modo di sapere che arrivano allo stesso posto è
 *      misurarle tutt'e due;
 *   2. che ricolorando la parola chiave l'appunto SEGUA, che è la ragione per
 *      cui nel markdown c'è la citazione e non una copia del colore;
 *   3. che l'id scritto nell'appunto sia quello che l'evidenza ha davvero —
 *      cioè che `identita` (main) e `aggiungi` (main) dicano la stessa cosa
 *      attraverso l'IPC.
 *
 *   ./test/cdp/con-vault-di-prova.sh prova-evidenza-appunto.js
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
    const v = await val(expr); if (v) return v;
    if (Date.now() > fine) return null; await pausa(220);
  }
}

/* Il `<mark>` dell'anteprima, misurato COM'È DISEGNATO: non l'attributo, il
   colore calcolato. Un `--ev` scritto e non usato darebbe verde a un controllo
   sull'HTML e niente a chi guarda. */
const SEGNO = `(()=>{
  const m=document.querySelector('#noteHost mark.evid'); if(!m) return null;
  const s=getComputedStyle(m);
  return { tratto:m.getAttribute('data-tratto')||'',
           orfana:m.classList.contains('evorfana'),
           testo:m.textContent,
           fondo:s.backgroundColor, riga:s.textDecorationColor,
           spessore:s.textDecorationThickness,
           dentroLink:!!m.closest('a.evlink') }; })()`;

(async () => {
  await collega();
  await val('location.reload(), 1'); await pausa(2000);
  await collega(); await pausa(800);
  await partiPulito();
  await pausa(400);

  /* Si dichiara lo stato invece di ereditarlo: il colore e il tratto correnti
     vivono in `localStorage` e sopravvivono alle prove di prima. */
  await val(`(function(){ try{ localStorage.removeItem('studia.evidenze.colore');
    localStorage.removeItem('studia.evidenze.tratto'); }catch(e){}
    EVIDENZE.colore=''; EVIDENZE.tratto=''; return 1; })()`);
  await val(`evidenzeTrattoScegli('overlay'), 1`);
  const COLORE = (await val('evidenzeColori()'))[2];   // il rosa: non è il default di nessuno
  await val(`evidenzeColoreScegli(${JSON.stringify(COLORE)}), 1`);

  sezione('Si evidenzia nel capitolo, e si appunta');
  await apriStrumento('appunti');
  await pausa(400);
  await val(`noteNew(null, null, ''), 1`);
  await pausa(900);
  const modale = await val(`(()=>{ const i=document.getElementById('umInput');
    if(!i || !document.querySelector('#uiModal[open]')) return 0; i.value='Prova evidenze'; return 1; })()`);
  if (modale) await val('document.getElementById("umOk").click(), 1');
  await finoA('(NOTES.cur && NOTES.mde) ? 1 : 0', 12000);
  await pausa(500);

  /* Si prende un pezzo di testo del capitolo e si passa dalla porta vera:
     `appuntaSelezione`, che è quella del menu della selezione. ⚠️ Corto — la
     regola delle tre parole piene decide se appuntare crea anche l'evidenza. */
  /* ⚠️ NON il primo paragrafo dai primi caratteri, ed è un rosso già pagato:
     `prova-evidenziatore` gira poco prima nella stessa suite e segna proprio
     `#content p` da 0 a 40, sul VAULT DI PROVA che resta scritto per tutte le
     prove dopo. Evidenziando lì sopra, `evidenzaPrepara` EREDITA il colore di
     quell'evidenza — è il gesto «cambia colore», e fa bene a farlo — e questa
     prova misurava il colore di un'altra. Da sola era verde, nella suite no.
     Si sceglie un punto suo: un paragrafo più in là, e non dal primo carattere. */
  const preso = await val(`(async()=>{
    const ps=document.querySelectorAll('#content p'); const p=ps[2]||ps[0]; if(!p) return '';
    const t=[...p.childNodes].find(n=>n.nodeType===3 && n.nodeValue.trim().length>60);
    if(!t) return '';
    const testo=t.nodeValue, i=testo.indexOf(' ', 24);
    const j=testo.indexOf(' ', i+1);
    if(i<0 || j<0) return '';
    const r=document.createRange(); r.setStart(t,i+1); r.setEnd(t, j);
    /* ⚠️ range.toString() e non getSelection(): dai titoli Chromium riporta il
       testo in maiuscolo, e il selettore non si ritroverebbe più. */
    const frase=r.toString();
    await appuntaSelezione(frase, r, '');
    return frase; })()`);
  ok('il frammento è stato preso', true, !!preso && preso.length > 2);
  console.log('   «' + preso + '»');

  const md = await finoA(`(()=>{ const t=NOTES.mde.codemirror.getValue();
    return /\\(ev:[0-9a-f]{6,40}\\)/.test(t) ? t : null; })()`, 10000);
  ok('nell\'appunto il frammento cita la sua evidenza', true, !!md);
  console.log('   ' + JSON.stringify((md || '').trim().split('\n')[0]));
  ok('col segno di Obsidian attorno al testo', true, /\[==[^\]]+==\]\(ev:/.test(md || ''));
  /* ⚠️ Nel markdown il colore NON c'è: se ci finisse, ricolorare lascerebbe
     indietro tutti gli appunti che citano quell'evidenza. */
  ok('e senza nessun colore scritto dentro', false, /#[0-9a-f]{6}/i.test(md || ''));

  const idScritto = (/\(ev:([0-9a-f]{6,40})\)/.exec(md || '') || [, ''])[1];
  const evidenza = await val(`(()=>{ const e=(EVIDENZE.elenco||[]).filter(x=>x.id===${JSON.stringify(idScritto)})[0];
    return e ? { id:e.id, colore:e.colore, tratto:e.tratto } : null; })()`);
  ok('l\'id scritto è quello di un\'evidenza che esiste davvero', idScritto,
    evidenza && evidenza.id);
  ok('col colore scelto', COLORE, evidenza && evidenza.colore);
  ok('e col tratto scelto', 'overlay', evidenza && evidenza.tratto);

  sezione('Nell\'anteprima si vede, e con LO STESSO colore');
  await val('NOTES.mde.togglePreview(), 1'); await pausa(400);
  await val('noteAnteprimaRidisegna(), 1');
  const seg = await finoA(SEGNO, 10000);
  ok('il segno c\'è', true, !!seg);
  ok('col fondo pieno, come sulla fonte', 'overlay', seg && seg.tratto);
  ok('e non è orfano', false, seg && seg.orfana);
  ok('il testo è quello appuntato', true, !!seg && preso.indexOf(seg.testo.trim()) >= 0);
  /* Il confronto si fa sul colore CALCOLATO, che il browser dà in rgb: si
     converte il preset invece di fidarsi della stringa. */
  const atteso = await val(`(()=>{ const d=document.createElement('div');
    d.style.color=${JSON.stringify(COLORE)}; document.body.appendChild(d);
    const c=getComputedStyle(d).color; d.remove(); return c; })()`);
  console.log('   fondo del segno: ' + (seg && seg.fondo) + '  ·  colore dell\'evidenza: ' + atteso);
  ok('il fondo è esattamente il colore dell\'evidenza', atteso, seg && seg.fondo);
  ok('e il segno riporta alla fonte', true, seg && seg.dentroLink);

  sezione('⚠️ Ricolorare la parola chiave cambia anche l\'appunto');
  const NUOVO = (await val('evidenzeColori()'))[4];   // l'azzurro
  await val(`kwRicolora(${JSON.stringify(idScritto)}, ${JSON.stringify(NUOVO)}), 1`);
  await pausa(600);
  const mdDopo = await val('NOTES.mde.codemirror.getValue()');
  ok('il file dell\'appunto NON è stato riscritto', md, mdDopo);
  const attesoNuovo = await val(`(()=>{ const d=document.createElement('div');
    d.style.color=${JSON.stringify(NUOVO)}; document.body.appendChild(d);
    const c=getComputedStyle(d).color; d.remove(); return c; })()`);
  const seg2 = await finoA(`(()=>{ const m=document.querySelector('#noteHost mark.evid');
    if(!m) return null; const c=getComputedStyle(m).backgroundColor;
    return c===${JSON.stringify(attesoNuovo)} ? { fondo:c } : null; })()`, 8000);
  ok('ma il segno nell\'appunto ha cambiato colore', attesoNuovo, seg2 && seg2.fondo);

  sezione('E cambiando tratto, cambia il modo di segnare');
  await val(`kwCambiaTratto(${JSON.stringify(idScritto)}, 'sotto'), 1`);
  await pausa(600);
  const seg3 = await finoA(`(()=>{ const m=document.querySelector('#noteHost mark.evid');
    return (m && m.getAttribute('data-tratto')==='sotto') ? (()=>{ const s=getComputedStyle(m);
      return { riga:s.textDecorationColor, fondo:s.backgroundColor, spessore:s.textDecorationThickness }; })() : null; })()`, 8000);
  ok('adesso è una sottolineatura', true, !!seg3);
  ok('del colore dell\'evidenza', attesoNuovo, seg3 && seg3.riga);
  ok('e il fondo è tornato trasparente', 'rgba(0, 0, 0, 0)', seg3 && seg3.fondo);
  /* ⚠️ Lo spessore viene da `--ev-spessore`, la stessa variabile che
     `evidenzeStile()` interpola nelle regole `::highlight()` della fonte. Se
     un giorno quel `var()` non risolvesse più, qui uscirebbe «auto». */
  console.log('   spessore della riga: ' + (seg3 && seg3.spessore));
  ok('con lo spessore che viene dalla variabile, non da «auto»', false,
    !seg3 || seg3.spessore === 'auto');

  sezione('Togliendo la parola chiave, il testo resta e il colore no');
  await val(`(()=>{ const r=window.vault.evidenze.rimuovi(corsoAttivo(), ${JSON.stringify(idScritto)});
    EVIDENZE.elenco=r.evidenze; evidenzeDisegna(); return 1; })()`);
  await pausa(600);
  const seg4 = await finoA(`(()=>{ const m=document.querySelector('#noteHost mark.evid');
    return (m && m.classList.contains('evorfana')) ? { testo:m.textContent,
      link:!!m.closest('a.evlink') } : null; })()`, 8000);
  ok('il segno si dichiara orfano', true, !!seg4);
  ok('il testo è ancora tutto lì', true, !!seg4 && preso.indexOf(seg4.testo.trim()) >= 0);
  ok('e non promette più un salto che non può fare', false, seg4 && seg4.link);
  ok('nell\'appunto il testo non è stato toccato', md, await val('NOTES.mde.codemirror.getValue()'));

  console.log('');
  console.log(ko ? '✗ ' + ko + ' controlli falliti' : '✓ tutti i controlli passati');
  process.exit(ko ? 1 : 0);
})();
