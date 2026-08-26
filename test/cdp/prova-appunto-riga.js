/* Il quaderno si riapre ALLA RIGA (Q1).
 *
 * ⚠️ Perché esiste. L'app ricordava dove eri in ogni documento e in ogni video;
 * l'appunto — il pezzo su cui si torna più spesso, e l'unico che l'utente ha
 * scritto lui — si riapriva sempre in cima. Su un appunto di un semestre vuol
 * dire scorrere ogni volta.
 *
 * Dove si apra DAVVERO lo decide `App/assets/appunti/segno.js`, provato in Node
 * (`test/riga.js`) insieme al file che lo scrive (`lib/riga.js`). Qui si misura
 * il CABLAGGIO, che in Node non si vede: il cursore ci va davvero, il segno si
 * scrive muovendosi, e sopravvive alla chiusura dell'appunto.
 *
 *   ./test/cdp/con-vault-di-prova.sh prova-appunto-riga.js
 */
const path = require('path');
const S = path.join(__dirname, 'cdp.js');
const { collega, val, pausa, partiPulito, apriStrumento } = require(S);

let ko = 0;
function ok(n, atteso, avuto) {
  const a = JSON.stringify(atteso), b = JSON.stringify(avuto);
  if (a === b) { console.log('  ok  ' + n); return; }
  ko++; console.log('  KO  ' + n + '\n      atteso ' + a + '\n      avuto  ' + b);
}
function sezione(t) { console.log('\n== ' + t); }
async function finoA(expr, q) { const f = Date.now() + (q || 15000);
  for (;;) { const v = await val(expr); if (v) return v; if (Date.now() > f) return null; await pausa(250); } }

/* Un appunto abbastanza lungo da rendere la riga un fatto visibile: su cinque
   righe «riaprire alla riga» non si distingue da «riaprire in cima». */
const CORPO = Array.from({ length: 60 }, (x, i) => 'riga numero ' + i).join('\n');

(async () => {
  await collega();
  await val('location.reload(), 1'); await pausa(2500);
  await collega(); await pausa(800);
  await partiPulito();
  await apriStrumento('appunti');
  await finoA(`(typeof corsoAttivo==='function' && corsoAttivo()) ? 1 : 0`, 15000);

  sezione('Un appunto lungo, aperto la prima volta');
  const file = await val(`(()=>{ const api=window.vault.notes;
    const r=api.save(corsoAttivo(), null, { title:'Appunto lungo' }, ${JSON.stringify(CORPO)});
    notesReload(); return r.file||''; })()`);
  ok('l\'appunto c\'è', true, !!file);
  await val(`noteOpen(${JSON.stringify(file)}), 1`);
  await finoA(`(NOTES.cur && NOTES.cur.file===${JSON.stringify(file)}) ? 1 : 0`, 10000);
  await pausa(400);
  /* ⚠️ 61 e non 60: `appunti.serialize` chiude il file con un a capo, e
     l'editor lo conta come riga. Ciò che conta qui è che le righe ci siano
     TUTTE — se il corpo non arrivasse intero, «riaprire alla riga 40» non
     proverebbe niente. */
  ok('le righe ci sono tutte', 61, await val(`NOTES.mde.codemirror.lineCount()`));
  /* La prima volta non c'è nessun segno: si apre in cima, come ha sempre fatto. */
  ok('senza segno si apre in cima', 0, await val(`NOTES.mde.codemirror.getCursor().line`));

  sezione('Si legge fino a metà: il segno si scrive da sé');
  {
    await val(`(()=>{ NOTES.mde.codemirror.setCursor({ line:40, ch:0 }); return 1; })()`);
    /* Il segno va col RESPIRO: scriverlo a ogni freccia riscriverebbe il vault
       trenta volte al minuto. Qui si aspetta che arrivi sul disco. */
    const sulDisco = await finoA(`(async()=>{ const r=await window.vault.riga.leggi(corsoAttivo());
      const v=(r.appunti||{})[${JSON.stringify(file)}]; return v ? v.riga : 0; })()`, 8000);
    ok('la riga finisce nel vault', 40, sulDisco);
    /* ⚠️ Nel VAULT, non nel localStorage: è un fatto del contenuto, e passando
       lo zaino a un altro computer viaggia con lui. La linea è quella del
       19 agosto. */
    ok('e il file sta dentro APPUNTI/', true,
      await val(`(async()=>{ const p=await window.vault.riga.leggi(corsoAttivo()); return !p.error; })()`));
  }

  sezione('⚠️ Si chiude e si riapre: il cursore è dove l\'avevi lasciato');
  {
    /* Si apre un ALTRO appunto e poi si torna: è il gesto vero, e obbliga
       l'editor a ricaricare il corpo da capo. */
    const altro = await val(`(()=>{ const r=window.vault.notes.save(corsoAttivo(), null,
      { title:'Un altro' }, 'poche righe\\nqui'); notesReload(); return r.file||''; })()`);
    await val('noteOpen(' + JSON.stringify(altro) + '), 1');
    await pausa(600);
    await val(`noteOpen(${JSON.stringify(file)}), 1`);
    await finoA(`(NOTES.cur && NOTES.cur.file===${JSON.stringify(file)}) ? 1 : 0`, 10000);
    await pausa(500);
    ok('il cursore è tornato alla riga 40', 40, await val(`NOTES.mde.codemirror.getCursor().line`));
    /* ⚠️ E la riga è A VISTA, non solo «selezionata»: un cursore su una riga
       fuori dallo schermo è un segno che non si vede, cioè nessun segno. */
    ok('ed è dentro la finestra', true,
      await val(`(()=>{ const cm=NOTES.mde.codemirror;
        const c=cm.charCoords({ line:40, ch:0 }, 'local');
        const s=cm.getScrollInfo();
        return c.top >= s.top && c.bottom <= s.top + s.clientHeight; })()`));
  }

  sezione('⚠️ L\'appunto si accorcia: il segno si stringe, non punta nel vuoto');
  {
    /* Qualcuno lo accorcia da fuori — un altro computer, Obsidian, o chi ha
       cancellato ieri sera. Il segno resta a 40, ma le righe sono 5. */
    await val(`(()=>{ window.vault.notes.save(corsoAttivo(), ${JSON.stringify(file)},
      { title:'Appunto lungo' }, 'a\\nb\\nc\\nd\\ne'); notesReload(); return 1; })()`);
    await val(`(()=>{ NOTES.cur=null; return 1; })()`);
    await val(`noteOpen(${JSON.stringify(file)}), 1`);
    await finoA(`(NOTES.cur && NOTES.cur.file===${JSON.stringify(file)}) ? 1 : 0`, 10000);
    await pausa(500);
    const righe = await val(`NOTES.mde.codemirror.lineCount()`);
    /* ⚠️ Sei e non cinque: `appunti.serialize` chiude il file con un a capo, e
       l'editor lo conta come riga. Il numero si MISURA e si usa quello — un
       atteso scritto a mano qui difenderebbe dal conto di ieri invece che dalla
       promessa (la trappola già pagata il 23 agosto). */
    ok('si è accorciato davvero', true, righe < 10);
    /* Si stringe all'ultima riga VERA — la stessa regola di `vaiAPagina` su un
       documento accorciato — invece di lasciare il cursore nel vuoto o di
       riportarlo in cima buttando via il segno. */
    ok('e il cursore si ferma sull\'ultima', righe - 1,
      await val(`NOTES.mde.codemirror.getCursor().line`));
  }

  sezione('Un appunto mai letto non si inventa un segno');
  {
    const nuovo = await val(`(()=>{ const r=window.vault.notes.save(corsoAttivo(), null,
      { title:'Mai letto' }, 'uno\\ndue\\ntre'); notesReload(); return r.file||''; })()`);
    await val(`(()=>{ NOTES.cur=null; return 1; })()`);
    await val('noteOpen(' + JSON.stringify(nuovo) + '), 1');
    await pausa(600);
    ok('si apre in cima, come ha sempre fatto', 0, await val(`NOTES.mde.codemirror.getCursor().line`));
  }

  /* si lascia il contenitore com'era */
  await val(`(async()=>{ const api=window.vault.notes; const l=api.list(corsoAttivo())||[];
    for(const n of l){ if(/Appunto lungo|Un altro|Mai letto/.test(n.title||'')) await api.remove(corsoAttivo(), n.file); }
    NOTES.cur=null; notesReload(); return 1; })()`);
  console.log('\n' + (ko ? '✗ ' + ko + ' controlli falliti' : '✓ tutti i controlli passati'));
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('✗ ' + (e && e.message ? e.message : e)); process.exit(1); });
