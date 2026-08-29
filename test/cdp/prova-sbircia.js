/* SBIRCIARE SENZA SALTARE: la bolla che mostra dall'altra parte di un rimando (Q4).
 *
 * ⚠️ Perché esiste. «Hover = anteprima; click = torni lì» è il principio
 * fondante di `PIANO-BRAYNR.md` §0, e nello zaino non c'era: rileggere un
 * appunto pieno di rimandi costava un salto per ciascuno, e ogni salto butta
 * via il filo. Per chi legge con una dislessia è il costo più alto.
 *
 * CHE COSA si mostra lo decide `rimandi/anteprima.js`, provato in Node
 * (`test/anteprima.js`). Qui si misura ciò che in Node non si vede: la bolla si
 * apre passandoci sopra col MOUSE VERO, dice la cosa giusta, si chiude, e — la
 * metà che conta — il CLICK resta quello di sempre.
 *
 *   ./test/cdp/con-vault-di-prova.sh prova-sbircia.js
 */
const path = require('path');
const S = path.join(__dirname, 'cdp.js');
const { collega, val, invia, pausa, partiPulito, apriStrumento } = require(S);

let ko = 0;
function ok(n, atteso, avuto) {
  const a = JSON.stringify(atteso), b = JSON.stringify(avuto);
  if (a === b) { console.log('  ok  ' + n); return; }
  ko++; console.log('  KO  ' + n + '\n      atteso ' + a + '\n      avuto  ' + b);
}
function sezione(t) { console.log('\n== ' + t); }
async function finoA(expr, q) { const f = Date.now() + (q || 15000);
  for (;;) { const v = await val(expr); if (v) return v; if (Date.now() > f) return null; await pausa(250); } }

/** Ferma il mouse sopra un elemento, come chi legge. */
async function sopra(sel) {
  const p = await val(`(()=>{ const e=document.querySelector(${JSON.stringify(sel)});
    if(!e) return null; e.scrollIntoView({ block:'center' });
    const r=e.getBoundingClientRect();
    return { x:Math.round(r.left+r.width/2), y:Math.round(r.top+r.height/2) }; })()`);
  if (!p) return false;
  await invia('Input.dispatchMouseEvent', { type: 'mouseMoved', x: p.x, y: p.y });
  return true;
}

(async () => {
  await collega();
  await val('location.reload(), 1'); await pausa(2500);
  await collega(); await pausa(800);
  await partiPulito();
  await apriStrumento('appunti');
  await finoA(`(typeof corsoAttivo==='function' && corsoAttivo()) ? 1 : 0`, 15000);

  sezione('Un appunto con dentro dei rimandi, e la sua anteprima aperta');
  const evId = await val(`(()=>{ const api=window.vault.evidenze;
    const r=api.aggiungi(corsoAttivo(), { exact:'memoria di lavoro', prefix:'la ',
      suffix:' ha una capacità limitata', capitoloId:'c-prova', colore:'#fdf14d' });
    api.postilla(corsoAttivo(), r.evidenza.id, 'da chiedere al prof');
    evidenzeCarica(); return r.evidenza ? r.evidenza.id : ''; })()`);
  ok('c\'è un\'evidenza da citare', true, !!evId);

  const file = await val(`(()=>{ const md='Il punto [==memoria di lavoro==](ev:'+${JSON.stringify(evId)}+') non torna.';
    const r=window.vault.notes.save(corsoAttivo(), null, { title:'Con rimandi' }, md);
    notesReload(); return r.file||''; })()`);
  await val(`noteOpen(${JSON.stringify(file)}), 1`);
  await pausa(900);
  /* L'anteprima affiancata: è lì che i rimandi diventano link su cui fermarsi. */
  await val(`(()=>{ const b=document.querySelector('.editor-toolbar .fa-eye, #noteAnteprima');
    if(b) b.click(); return 1; })()`);
  await pausa(700);
  const link = await finoA(`document.querySelectorAll('#noteHost a.evlink').length`, 8000);
  ok('nell\'anteprima il rimando è un link', true, !!link);

  sezione('⚠️ Ci si ferma sopra, e dopo mezzo secondo la bolla dice che cosa c\'è');
  {
    ok('prima di fermarsi non c\'è nessuna bolla', true,
      await val(`document.getElementById('rimBolla').hidden`));
    await sopra('#noteHost a.evlink');
    /* ⚠️ Mezzo secondo: la bolla NON si costruisce in anticipo per tutti i
       rimandi della pagina — su un appunto lungo sarebbero cento letture per
       una pagina che magari nessuno sfiora. */
    await pausa(300);
    ok('a 300 ms non c\'è ancora: si aspetta', true,
      await val(`document.getElementById('rimBolla').hidden`));
    const aperta = await finoA(`document.getElementById('rimBolla').hidden ? 0 : 1`, 3000);
    ok('e poi si apre', 1, aperta);

    const dentro = await val(`(()=>{ const b=document.getElementById('rimBolla');
      return { testo:(b.textContent||'').trim(),
               esatto:(b.querySelector('.nt-ex')||{}).textContent||'',
               colore:((b.querySelector('.nt-ex')||{}).style||{}).getPropertyValue
                      ? b.querySelector('.nt-ex').style.getPropertyValue('--ev') : '',
               nota:(b.querySelector('.nt-nota')||{}).textContent||'',
               dentroLoSchermo:(()=>{ const r=b.getBoundingClientRect();
                 return r.left>=0 && r.top>=0 && r.right<=innerWidth && r.bottom<=innerHeight; })() }; })()`);
    ok('mostra la frase col suo contorno', true, /la memoria di lavoro ha una capacità limitata/.test(dentro.testo));
    /* ⚠️ `prefix` e `suffix` sono lì apposta: distinguono «la memoria» ripetuta
       in tre punti diversi. E l'ESATTO è acceso col colore dell'evidenza. */
    ok('con l\'esatto acceso', 'memoria di lavoro', dentro.esatto.trim());
    ok('e col suo colore', '#fdf14d', dentro.colore.trim());
    ok('e la postilla, se c\'è', 'da chiedere al prof', dentro.nota.trim());
    ok('la bolla sta dentro lo schermo', true, dentro.dentroLoSchermo);
  }

  sezione('Esc la chiude — ed è il primo gradino, non costa altro');
  {
    await invia('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await invia('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await pausa(300);
    ok('la bolla se n\'è andata', true, await val(`document.getElementById('rimBolla').hidden`));
    /* ⚠️ E l'appunto è ancora aperto: Esc si preme d'istinto e si preme due
       volte — nessuno dei suoi gradini può costare qualcosa. */
    ok('e l\'appunto è ancora lì', file, await val(`(NOTES.cur||{}).file||''`));
  }

  sezione('⚠️ IL CLICK RESTA QUELLO DI SEMPRE');
  {
    /* È la metà che conta: l'anteprima si aggiunge al gesto, non lo sostituisce.
       Se sbirciare rompesse il click, il lavoro sarebbe da buttare. */
    await val(`(()=>{ window.__andato=''; const v=evidenzaVai;
      window.evidenzaVai=function(ev){ window.__andato=(ev&&ev.id)||''; return v.apply(this, arguments); };
      return 1; })()`);
    await sopra('#noteHost a.evlink');
    await pausa(700);
    const p = await val(`(()=>{ const e=document.querySelector('#noteHost a.evlink');
      const r=e.getBoundingClientRect();
      return { x:Math.round(r.left+r.width/2), y:Math.round(r.top+r.height/2) }; })()`);
    await invia('Input.dispatchMouseEvent', { type: 'mousePressed', x: p.x, y: p.y, button: 'left', clickCount: 1 });
    await invia('Input.dispatchMouseEvent', { type: 'mouseReleased', x: p.x, y: p.y, button: 'left', clickCount: 1 });
    await pausa(600);
    ok('il click porta ancora dov\'era segnata', evId, await val(`window.__andato||''`));
  }

  sezione('Un rimando che non sa dire niente NON apre la bolla');
  {
    /* ⚠️ Una bolla che dice «non lo so» ruba il testo sotto senza dare niente
       in cambio. Chi clicca lo scopre lo stesso, con un messaggio. */
    await val(`(()=>{ const c=document.createElement('div'); c.id='provaMorto';
      c.style.cssText='position:fixed;left:40px;top:300px;z-index:5';
      c.innerHTML='<a href="#" class="evlink" data-ev="000000000000">sparita</a>';
      document.body.appendChild(c); return 1; })()`);
    await sopra('#provaMorto a.evlink');
    await pausa(1200);
    ok('resta chiusa', true, await val(`document.getElementById('rimBolla').hidden`));
    await val(`(()=>{ const c=document.getElementById('provaMorto'); if(c) c.remove(); return 1; })()`);
  }

  /* si lascia il contenitore com'era */
  await val(`(async()=>{ try{ await window.vault.notes.remove(corsoAttivo(), ${JSON.stringify(file)}); }catch(e){}
    const api=window.vault.evidenze;
    (api.leggi(corsoAttivo()).evidenze||[]).forEach(function(e){ api.rimuovi(corsoAttivo(), e.id); });
    NOTES.cur=null; notesReload(); evidenzeCarica(); evidenzeDisegna(); return 1; })()`);
  console.log('\n' + (ko ? '✗ ' + ko + ' controlli falliti' : '✓ tutti i controlli passati'));
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('✗ ' + (e && e.message ? e.message : e)); process.exit(1); });
