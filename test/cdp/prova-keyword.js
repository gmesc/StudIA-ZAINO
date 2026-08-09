/* Lotto 6 — lo strumento «Parole chiave» nel banco.
 *
 * Promette tre cose: che l'elenco sia uno STRUMENTO come gli altri (entra in
 * un blocco, aspetta in magazzino, non si distrugge); che i chip portino con
 * sé l'identità del record e non il solo testo, perché è ciò che permette a un
 * appunto e a un nodo di mappa di sapere da dove viene la parola; e che il
 * colore sia uno solo — cambiato dal chip, si muove anche sul testo.
 *
 * ⚠️ Gira contro il vault della config: puntarlo a una COPIA (trappola ⑧).
 *   ./node_modules/.bin/electron . --remote-debugging-port=9333
 *   node test/cdp/prova-keyword.js
 */
const S = require('path').join(__dirname, 'cdp.js');
const { collega, invia, val, clicca, pausa } = require(S);

let ko = 0;
function ok(n, atteso, avuto) {
  const a = JSON.stringify(atteso), b = JSON.stringify(avuto);
  if (a === b) { console.log('  ok  ' + n); return; }
  ko++; console.log('  KO  ' + n + '\n      atteso ' + a + '\n      avuto  ' + b);
}
const chips = () => val(`document.querySelectorAll('#kwLista .kwchip').length`);
const testi = () => val(`[...document.querySelectorAll('#kwLista .kwchip .kwtxt')].map(x=>x.textContent)`);

(async () => {
  await collega();
  await val('localStorage.removeItem("studia.banco"), 1');
  await val('location.reload(), 1');
  await pausa(1800); await collega(); await pausa(600);

  const corso = await val('corsoAttivo()');
  // si parte pulito: le prove precedenti possono aver lasciato qualcosa
  await val(`window.vault.evidenze.salva(corsoAttivo(), []), 1`);

  console.log('\n== è uno strumento del banco come gli altri');
  ok('è nel registro ed è disponibile', [true, 'Parole chiave'],
    [await val('bancoDisponibile("keyword")'), await val('bancoStrumenti().keyword.nome')]);
  ok('a freddo aspetta in magazzino, non distrutto', 'bancoMagazzino',
    await val(`document.getElementById('keywordPane').parentElement.id`));
  await val('bancoMostra("keyword"), 1'); await pausa(600);
  ok('chiamato, entra nel corpo di un blocco', 'bcorpo',
    await val(`document.getElementById('keywordPane').parentElement.className`));
  ok('e l\'elenco degli strumenti a schermo lo nomina', true,
    await val(`(document.documentElement.dataset.strumenti||'').split(' ').indexOf('keyword')>=0`));

  console.log('\n== l\'elenco mostra le parole chiave del CORSO, non del solo capitolo');
  await val(`(()=>{
    const c=corsoAttivo();
    window.vault.evidenze.aggiungi(c,{exact:'zebra', prefix:'la ', suffix:' corre',
      capitoloId:'01-fondamenti-c01', capitolo:'Primo', colore:'#a16207'});
    window.vault.evidenze.aggiungi(c,{exact:'alfabeto', prefix:'un ', suffix:' nuovo',
      capitoloId:'02-altro-c03', capitolo:'Un altro capitolo', colore:'#1d4ed8'});
    return 1;})()`);
  await val('evidenzeCarica(), keywordDisegna(), 1'); await pausa(300);
  ok('ci sono tutti e due, anche quello di un altro capitolo', 2, await chips());
  ok('in ordine alfabetico di fabbrica', ['alfabeto', 'zebra'], await testi());

  console.log('\n== la ricerca e l\'ordinamento');
  await val(`(()=>{const i=document.getElementById('kwCerca'); i.value='zeb';
    i.dispatchEvent(new Event('input',{bubbles:true})); return 1;})()`); await pausa(250);
  ok('la ricerca filtra', ['zebra'], await testi());
  await val(`(()=>{const i=document.getElementById('kwCerca'); i.value='';
    i.dispatchEvent(new Event('input',{bubbles:true})); return 1;})()`); await pausa(250);
  ok('svuotarla li rimette tutti', 2, await chips());
  await clicca('#kwOrdine'); await pausa(300);
  ok('il bottone dice in che ordine sono ADESSO', '📅',
    await val(`document.getElementById('kwOrdine').textContent`));
  ok('e per data viene prima l\'ultima aggiunta', 'alfabeto', (await testi())[0]);
  await clicca('#kwOrdine'); await pausa(300);
  ok('e si torna indietro', 'Aa', await val(`document.getElementById('kwOrdine').textContent`));

  console.log('\n== il chip porta l\'identità, non il testo nudo');
  ok('ogni chip dichiara l\'id del suo record', true,
    await val(`[...document.querySelectorAll('#kwLista .kwchip')].every(c=>!!c.dataset.kw)`));
  ok('ed è trascinabile', true,
    await val(`[...document.querySelectorAll('#kwLista .kwchip')].every(c=>c.draggable)`));
  /* Il markdown che cade porta il rimando: è ciò che rende l'appunto
     rileggibile fra un mese, e vale anche per il nodo di mappa. */
  ok('e il markdown che lascia cadere porta il rimando al capitolo', true,
    await val(`/^\\[alfabeto\\]\\(cap:02-altro-c03\\)$/.test(kwMarkdown(
      EVIDENZE.elenco.filter(e=>e.exact==='alfabeto')[0]))`));

  console.log('\n== un colore solo: il chip e il testo leggono lo stesso valore');
  const idZebra = await val(`EVIDENZE.elenco.filter(e=>e.exact==='zebra')[0].id`);
  await val(`kwRicolora(${JSON.stringify(idZebra)}, '#0f766e'), 1`); await pausa(500);
  ok('il colore è cambiato sul disco', '#0f766e',
    await val(`window.vault.evidenze.leggi(corsoAttivo()).evidenze.filter(e=>e.id===${JSON.stringify(idZebra)})[0].colore`));
  ok('e il chip lo mostra', '#0f766e',
    await val(`document.querySelector('#kwLista .kwchip[data-kw=${JSON.stringify(idZebra)}]').style.getPropertyValue('--kw')`));

  console.log('\n== togliere dal menu del chip');
  await val(`(()=>{const c=document.querySelector('#kwLista .kwchip[data-kw=${JSON.stringify(idZebra)}]');
    const r=c.getBoundingClientRect();
    c.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,
      clientX:Math.round(r.left+4), clientY:Math.round(r.top+4)})); return 1;})()`);
  await pausa(300);
  ok('il menu del chip si apre', true, await val(`kwMenuAperto()`));
  ok('con i cinque colori e il picker', [5, 1],
    await val(`[document.querySelectorAll('#kwMenu .ctx-col').length,
                document.querySelectorAll('#kwMenu input[type=color]').length]`));
  await clicca('#kwMenu .ctx-item[data-kwaz="togli"]'); await pausa(600);
  ok('la parola sparisce dall\'elenco', 1, await chips());
  ok('e dal disco', 1, await val('window.vault.evidenze.leggi(corsoAttivo()).evidenze.length'));

  // il vault di prova si lascia com'era
  await val(`window.vault.evidenze.salva(corsoAttivo(), []), 1`);
  await val('localStorage.removeItem("studia.banco"), 1');

  console.log('\n' + (ko ? '✗ ' + ko + ' controlli falliti' : '✓ strumento «Parole chiave» verde dalla porta principale'));
  process.exit(ko ? 1 : 0);
})();
