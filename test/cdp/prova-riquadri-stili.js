/* Gli stili dei riquadri: nome, emoji e colori, scelti da chi studia.
 *
 * Che cosa si promette qui:
 *   · si salvano SOLO le differenze, e nel VAULT (`.studia/prefs.json`), non
 *     nel `localStorage` — l'aspetto di un riquadro appartiene ai contenuti e
 *     deve viaggiare con loro;
 *   · `calloutDef` resta la porta unica: cambiata l'etichetta, cambiano il
 *     menu, la bolla e il markdown reso, senza che nessuno dei tre lo sappia;
 *   · «com'era» toglie la differenza invece di scrivere il valore di fabbrica —
 *     che sembra la stessa cosa e non lo è: un tema che cambia deve poter
 *     cambiare anche i riquadri di chi non li ha mai toccati.
 *
 * ⚠️ Gira contro il vault della config: puntarlo a una COPIA (trappola ⑧).
 *   ./test/cdp/con-vault-di-prova.sh prova-riquadri-stili
 */
const S = require('path').join(__dirname, 'cdp.js');
const { collega, val, pausa, partiPulito, apriStrumento } = require(S);

let ko = 0;
function ok(n, atteso, avuto) {
  const a = JSON.stringify(atteso), b = JSON.stringify(avuto);
  if (a === b) { console.log('  ok  ' + n); return; }
  ko++; console.log('  KO  ' + n + '\n      atteso ' + a + '\n      avuto  ' + b);
}
const prefs = () => val(`JSON.stringify((window.vault.prefs.read()||{}).riquadri||{})`);

(async () => {
  await collega(); await partiPulito();
  await apriStrumento('appunti'); await pausa(800);
  await val(`(()=>{ ensureMde(); openEditor(); return 1; })()`); await pausa(400);
  /* Si parte da pulito: il vault di prova potrebbe portarsi dietro le scelte di
     una corsa precedente, e uno stato ereditato fa dire a un verde una cosa che
     non ha misurato. */
  await val(`(()=>{ CALLOUTS.forEach(function(c){ riquadriScrivi(c.k, null); }); RIQ.mem=null; return 1; })()`);
  await pausa(200);

  console.log('== Un vault che non ha mai aperto il pannello non ha la chiave');
  ok('nessuna differenza da salvare', '{}', await prefs());
  ok('e i difetti sono quelli del codice', ['Nota', '⭐'],
    await val(`[calloutDef('nota').label, calloutDef('importante').emoji]`));

  console.log('\n== Il pannello si apre dal menu dei riquadri');
  await val(`(()=>{ openCalloutMenu(document.querySelector('#noteHost .ncb-callout')); return 1; })()`);
  await pausa(200);
  ok('la voce «Personalizza» è in fondo al menu', true,
    await val(`!!document.querySelector('#calloutMenu .cal-stili')`));
  /* ⚠️ E non porta `data-cal`: le frecce della bolla scorrono le cose che si
     INSERISCONO, e una voce che apre una finestra fra quelle sarebbe un Invio
     che spalanca un dialogo mentre si scrive. */
  ok('…e non è una voce da frecce', false,
    await val(`document.querySelector('#calloutMenu .cal-stili').hasAttribute('data-cal')`));
  await val(`(()=>{ document.querySelector('#calloutMenu .cal-stili').click(); return 1; })()`);
  await pausa(300);
  ok('il pannello è aperto', true,
    await val(`!document.getElementById('riquadriModal').hidden`));
  ok('una riga per tipo', 7, await val(`document.querySelectorAll('#riquadriBody .riq-riga').length`));
  /* Il campione è un riquadro vero, con le classi che rendono un appunto. */
  ok('il campione è un riquadro vero', true,
    await val(`!!document.querySelector('#riquadriBody .riq-riga[data-k="nota"] .ucallout.uc-nota')`));
  ok('e il colore proposto non è nero', true,
    await val(`/^#[0-9a-f]{6}$/.test(document.querySelector('.riq-riga[data-k="nota"] .riq-c').value)
             && document.querySelector('.riq-riga[data-k="nota"] .riq-c').value !== '#000000'`));

  console.log('\n== Si cambia, e cambia dappertutto');
  await val(`(()=>{ const i=document.querySelector('.riq-riga[data-k="dubbio"] .riq-et');
    i.value='Da chiarire'; i.dispatchEvent(new Event('change',{bubbles:true})); return 1; })()`);
  await pausa(300);
  ok('l\'etichetta è nelle preferenze del vault', 'Da chiarire',
    await val(`((window.vault.prefs.read()||{}).riquadri||{}).dubbio.etichetta`));
  ok('…e `calloutDef` la usa', 'Da chiarire', await val(`calloutDef('dubbio').label`));
  /* La porta unica: il menu e il markdown reso non sanno niente delle
     sovrascritture, eppure le mostrano tutti e due. */
  await val(`(()=>{ openCalloutMenu(document.querySelector('#noteHost .ncb-callout')); return 1; })()`);
  await pausa(200);
  ok('il menu dice il nome nuovo', true,
    await val(`document.querySelector('#calloutMenu button[data-cal="dubbio"]').textContent.indexOf('Da chiarire')>=0`));
  ok('e un riquadro senza titolo lo prende dal nome nuovo', true,
    await val(`renderNoteMd('> [!dubbio]\\n> Corpo.').indexOf('Da chiarire')>=0`));
  ok('un riquadro col SUO titolo resta com\'è scritto', true,
    await val(`renderNoteMd('> [!dubbio] Il mio titolo\\n> Corpo.').indexOf('Il mio titolo')>=0`));

  console.log('\n== Il colore passa da un foglio di stile solo');
  await val(`(()=>{ const i=document.querySelector('.riq-riga[data-k="dubbio"] .riq-c');
    i.value='#7b2ff7'; i.dispatchEvent(new Event('change',{bubbles:true})); return 1; })()`);
  await pausa(300);
  ok('la regola è nel foglio generato', true,
    await val(`(document.getElementById('calloutStile').textContent||'').indexOf('.uc-dubbio')>=0`));
  /* ⚠️ Il foglio sta nell'`<head>`: `documentoStampabile()` clona il documento,
     quindi il PDF esce coi colori scelti. Un foglio appeso al corpo, o scritto
     negli elementi, non ci arriverebbe. */
  ok('…e il foglio sta nella testa del documento', 'HEAD',
    await val(`document.getElementById('calloutStile').parentElement.tagName`));
  ok('un riquadro a schermo prende la tinta scelta', 'rgb(123, 47, 247)',
    await val(`(()=>{ const d=document.createElement('div'); d.className='ucallout uc-dubbio';
      document.body.appendChild(d); const c=getComputedStyle(d).borderLeftColor; d.remove(); return c; })()`));

  console.log('\n== «com\'era» toglie la differenza, non la riscrive');
  await val(`(()=>{ document.querySelector('.riq-riga[data-k="dubbio"] .riq-reset').click(); return 1; })()`);
  await pausa(300);
  ok('la chiave del tipo è sparita', '{}', await prefs());
  ok('l\'etichetta torna quella del codice', 'Dubbio', await val(`calloutDef('dubbio').label`));
  ok('e il foglio generato torna vuoto', '',
    await val(`(document.getElementById('calloutStile').textContent||'').trim()`));

  console.log('\n== Quello che si sceglie resta scritto nel vault');
  await val(`(()=>{ const i=document.querySelector('.riq-riga[data-k="nota"] .riq-et');
    i.value='Appunto mio'; i.dispatchEvent(new Event('change',{bubbles:true})); return 1; })()`);
  await pausa(300);
  await val(`(()=>{ RIQ.mem=null; return 1; })()`);   // come se l'app fosse ripartita
  ok('riletto dal disco, il nome c\'è ancora', 'Appunto mio', await val(`calloutDef('nota').label`));
  await val(`(()=>{ riquadriScrivi('nota', null); riquadriChiudi(); return 1; })()`);
  await pausa(200);
  ok('e il vault di prova resta com\'era', '{}', await prefs());

  console.log(ko ? '\n✗ ' + ko + ' controlli falliti' : '\n✓ tutti i controlli passati');
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
