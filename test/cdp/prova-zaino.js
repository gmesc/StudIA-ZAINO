/* La sidebar dello ZAINO: fonti · appunti · mappe.
 *
 * ⚠️ Che cosa difende. Le tre sezioni non hanno canali loro: chiedono a
 * `corpus.list`, `notes.leggi` e `mappe.elenco` passando l'id dello ZAINO dove
 * quelli si aspettano un corso. Funziona per due ragioni sole — `corsoAttivo()`
 * risponde con lo zaino, e `corsi.cartella()` risolve le due radici — e nessuno
 * di quei tre canali sa che gli zaini esistono. Se uno dei due perni si
 * scollegasse, qui si vedrebbero tre sezioni vuote invece di un errore: il
 * guasto più silenzioso che questa modalità possa avere.
 *
 * Perciò ogni sezione si prova con un dato VERO messo sul disco, e si controlla
 * anche DOVE è finito: un appunto scritto nello zaino deve stare in
 * `Zaini/<id>/APPUNTI/`, non in `Corsi/`.
 *
 *   ./test/cdp/con-vault-di-prova.sh prova-zaino.js
 */
const path = require('path');
const fs = require('fs');
const S = path.join(__dirname, 'cdp.js');
const { collega, val, clicca, pausa, partiPulito, apriStrumento } = require(S);

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
    const v = await val(expr);
    if (v) return v;
    if (Date.now() > fine) return null;
    await pausa(200);
  }
}

/** Le sezioni della sidebar, come le vede chi guarda. */
const SIDEBAR = `(()=>{ const h=document.getElementById('zainoNav');
  if(!h) return null;
  const tit=[...h.querySelectorAll('.zs-tit span:first-child')].map(e=>e.textContent);
  function voci(cl){ return [...h.querySelectorAll('button.'+cl)].map(b=>b.textContent.trim()); }
  return { visibile:!h.hidden && h.getBoundingClientRect().height>0,
           sezioni:tit, fonti:voci('zn-fonte'), appunti:voci('zn-appunto'), mappe:voci('zn-mappa'),
           vuoti:[...h.querySelectorAll('.zs-vuoto')].map(e=>e.textContent.trim()) }; })()`;

const ZAINO = 'zaino-di-prova';

(async () => {
  await collega();
  await val('location.reload(), 1'); await pausa(2000);
  await collega(); await pausa(800);
  await partiPulito();

  const vault = await val('window.vault.path');
  const dirZaino = path.join(vault, 'Zaini', ZAINO);

  sezione('Uno zaino nuovo: tre sezioni, tutte vuote, e ognuna dice perché');
  await val(`(async()=>{ await cambiaModo('zaino'); await zainoCrea('Zaino di prova'); return 1; })()`);
  await finoA(`zainoAttivo()==='${ZAINO}' ? 1 : 0`, 10000);
  await pausa(600);
  const vuota = await val(SIDEBAR);
  ok('la sidebar dello zaino è a schermo', true, !!vuota && vuota.visibile);
  ok('e ha le tre sezioni, in quest\'ordine', ['Fonti', 'Appunti', 'Mappe'], vuota.sezioni);
  ok('nessuna voce, per ora', [0, 0, 0],
    [vuota.fonti.length, vuota.appunti.length, vuota.mappe.length]);
  /* ⚠️ Tre sezioni vuote senza una riga di spiegazione sono indistinguibili da
     tre sezioni rotte. Ognuna dice che cosa manca e dove si comincia. */
  ok('e ognuna spiega il proprio vuoto', 3, vuota.vuoti.length);
  console.log('   ' + JSON.stringify(vuota.vuoti));
  /* L'indice dei capitoli non c'entra niente qui, e non deve restare sotto. */
  ok('l\'indice dei capitoli non è a schermo', false,
    await val(`(()=>{ const t=document.getElementById('toc'); return !!t && t.getBoundingClientRect().height>0; })()`));

  sezione('FONTI: un documento messo nello zaino compare, e si apre');
  /* Il PDF si copia sul disco come farebbe l'import (Z5): la sezione deve
     leggere la cartella dello zaino, non un elenco tenuto in memoria. */
  const corpusGlobale = path.join(vault, 'Fonti');
  const unPdf = fs.readdirSync(corpusGlobale).filter((f) => f.toLowerCase().endsWith('.pdf'))[0];
  ok('c\'è un PDF da mettere nello zaino', true, !!unPdf);
  fs.copyFileSync(path.join(corpusGlobale, unPdf), path.join(dirZaino, 'MATERIALI', 'PDF', unPdf));
  await val('zainoNavAggiorna()');
  const conFonte = await finoA(`(()=>{ const n=document.querySelectorAll('#zainoNav .zn-fonte').length;
    return n ? n : 0; })()`, 10000);
  ok('il documento compare fra le fonti', 1, conFonte);
  const etichetta = await val(`document.querySelector('#zainoNav .zn-fonte').textContent.trim()`);
  console.log('   ' + JSON.stringify(etichetta));
  ok('e il nome del file sta nel title, non nell\'etichetta', true,
    (await val(`document.querySelector('#zainoNav .zn-fonte').title`)) === unPdf);

  /* ⚠️ Si aspetta che la sidebar stia ferma prima di premere. Non è
     scaramanzia: `zainoNavAggiorna()` riscrive l'`innerHTML` della colonna, e
     un click calcolato su un bottone appena sostituito arriva a un nodo
     staccato dal documento — il gesto parte, non lo riceve nessuno, e il rosso
     accusa `openPdf` che non è mai stata chiamata. È la trappola «misurare
     mentre il disegno è in volo», qui applicata al click invece che alla
     misura. */
  await pausa(800);
  await clicca('#zainoNav .zn-fonte');
  const aperto = await finoA(`(PDFJS.doc && PDFJS.doc.numPages) || 0`, 20000);
  ok('il click lo apre davvero nel visualizzatore', true, (aperto || 0) > 0);
  ok('ed è quel documento', unPdf, await val('ANTEPRIMA.file'));
  /* ⚠️ Qui si prova il perno di `materiali.js`: `srcUrl` cerca il file nelle
     cartelle dei contenitori, e senza gli zaini fra quelli ripiegherebbe in
     silenzio su `<vault>/Fonti/`, cioè aprirebbe un ALTRO file con lo stesso
     nome — o niente, senza dire perché. */
  /* Dal 13 agosto `srcUrl` vuole il contenitore attivo: senza, un omonimo in
     un ALTRO zaino vince per ordine alfabetico — è successo qui, quando due
     prove hanno copiato lo stesso PDF in due zaini. */
  const url = await val(`window.vault.srcUrl(${JSON.stringify(unPdf)}, corsoAttivo())`);
  ok('e il file aperto è quello DELLO ZAINO', true, decodeURIComponent(url).indexOf('/Zaini/' + ZAINO + '/') > 0);
  ok('la voce si accende come aperta', true,
    await val(`!!document.querySelector('#zainoNav .zn-fonte.attivo')`));

  sezione('APPUNTI: si scrive nello zaino, e finisce nello zaino');
  await apriStrumento('appunti');
  await pausa(600);
  /* Si passa dalla porta vera: il «+» della barra degli appunti, con il suo
     riquadro per il titolo. */
  await clicca('#noteNew');
  await pausa(400);
  await val(`(()=>{ const i=document.getElementById('umInput'); i.value='Prima lettura'; return 1; })()`);
  await clicca('#umOk');
  const conAppunto = await finoA(`document.querySelectorAll('#zainoNav .zn-appunto').length || 0`, 12000);
  ok('l\'appunto compare nella sua sezione', 1, conAppunto);
  ok('col titolo che gli ho dato', 'Prima lettura',
    await val(`document.querySelector('#zainoNav .zn-appunto').textContent.trim()`));
  /* ⚠️ E soprattutto: su quale disco è finito. */
  const suDisco = fs.readdirSync(path.join(dirZaino, 'APPUNTI')).filter((f) => f.endsWith('.md'));
  ok('il file sta in Zaini/<id>/APPUNTI/', 1, suDisco.filter((f) => f !== '_indice.md').length);
  ok('e non è nato niente sotto Corsi/', false,
    fs.existsSync(path.join(vault, 'Corsi', ZAINO)));

  sezione('MAPPE: se ne disegna una, e si elenca');
  await apriStrumento('mappa');
  await pausa(700);
  await val(`(async()=>{ await mappaRegistro('mie'); return 1; })()`);
  await pausa(500);
  await val(`(()=>{ mappaNuova(); return 1; })()`);
  await pausa(400);
  const inp = await val(`(()=>{ const i=document.getElementById('umInput');
    if(!i || !document.querySelector('#uiModal[open]')) return 0;
    i.value='Mappa di prova'; return 1; })()`);
  if (inp) { await clicca('#umOk'); }
  const conMappa = await finoA(`document.querySelectorAll('#zainoNav .zn-mappa').length || 0`, 12000);
  ok('la mappa compare nella sua sezione', 1, conMappa);
  ok('e il documento sta in Zaini/<id>/MAPPE/', true,
    fs.existsSync(path.join(dirZaino, 'MAPPE')) &&
    fs.readdirSync(path.join(dirZaino, 'MAPPE')).some((f) => f.endsWith('.json')));

  sezione('Tornando ai corsi la sidebar torna quella dei capitoli');
  await val(`(async()=>{ await cambiaModo('corso'); return 1; })()`);
  await pausa(700);
  ok('le tre sezioni se ne vanno', false,
    await val(`(()=>{ const h=document.getElementById('zainoNav');
      return !!h && !h.hidden && h.getBoundingClientRect().height>0; })()`));
  ok('e l\'indice dei capitoli torna', 'Capitoli',
    await val(`document.getElementById('sidebarTitolo').textContent`));

  console.log('');
  console.log(ko ? '✗ ' + ko + ' controlli falliti' : '✓ tutti i controlli passati');
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('✗ ' + e.message); process.exit(1); });
