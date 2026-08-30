/* Il Confronto: due documenti fianco a fianco, ognuno col suo motore.
 *
 * ⚠️ Che cosa difende. Il secondo visualizzatore non condivide NIENTE col
 * primo — né la pagina, né lo zoom, né il documento — e la selezione lì dentro
 * non apre il menu: le sue voci (evidenzia, appunta, keyword) sono ancorate
 * alla Fonte, e citerebbero il documento sbagliato. Un corredo a metà che
 * sembra intero è peggio di un riquadro che dice che cos'è.
 *
 *   ./test/cdp/con-vault-di-prova.sh prova-confronto.js
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
  const fine = Date.now() + (quanto || 20000);
  for (;;) {
    const v = await val(expr);
    if (v) return v;
    if (Date.now() > fine) return null;
    await pausa(250);
  }
}

const PDF = 'Piano-di-studio-della-Scuola-dell-obbligo-ticinese.pdf';

(async () => {
  await collega();
  await val('location.reload(), 1'); await pausa(2000);
  await collega(); await pausa(800);
  await partiPulito();
  const bancoPrima = await val('JSON.stringify(bancoStato())');

  sezione('Il Confronto è uno strumento del banco, in tutte le modalità');
  ok('è offerto nei corsi', true,
    await val("Object.keys(bancoStrumentiOfferti()).indexOf('fonte2')>=0"));
  await val("bancoForma('due-col'), 1");
  await val("bancoAssegna('A','fonte'), bancoAssegna('C','fonte2'), 1");
  await pausa(600);
  ok('fonte e confronto sono affiancati', ['fonte', 'fonte2'],
    await val("[bancoStrumentoIn('A'), bancoStrumentoIn('C')]"));
  ok('e il riquadro vuoto spiega da dove si comincia', true,
    /Documenti/.test(await val("document.getElementById('pdf2Vuoto').textContent")));

  sezione('Due documenti, due motori: pagina e zoom non si parlano');
  await val(`openPdf(${JSON.stringify(PDF)}, 3, 'Piano di studio'), 1`);
  await finoA('!!PDFJS.doc', 20000);
  await val(`fonte2Apri(${JSON.stringify(PDF)}), 1`);
  const doc2 = await finoA('FONTE2.doc ? FONTE2.doc.numPages : 0', 20000);
  ok('il confronto ha il suo documento', true, doc2 > 0);
  const dipinto = await finoA(`(()=>{ const c=[...document.querySelectorAll('#pdf2Frame canvas')].filter(x=>x.width>0);
    return c.length>0 ? c.length : null; })()`, 20000);
  ok('e la sua pagina è davvero disegnata', true, !!dipinto);

  /* Si sfoglia il confronto: la Fonte non si muove. */
  await val('fonte2Pagina(true), fonte2Pagina(true), 1'); await pausa(800);
  ok('il confronto è andato avanti', 3, await val('FONTE2.viewer.currentPageNumber'));
  ok('la Fonte è rimasta dov\'era', 3, await val('PDFJS.viewer.currentPageNumber'));
  ok('e la barra del confronto dice la sua pagina', 'p. 3 di 266',
    await val("document.getElementById('pdf2PagN').textContent"));

  /* Si zooma il confronto: la Fonte non cambia scala. */
  const scalaFonte = await val('PDFJS.viewer.currentScale');
  await val('fonte2ZoomPasso(true), 1'); await pausa(600);
  ok('lo zoom del confronto è a mano', true,
    /%$/.test(await val("document.getElementById('pdf2ZoomLvl').textContent")));
  ok('e la Fonte non si è mossa', scalaFonte, await val('PDFJS.viewer.currentScale'));
  /* E le due memorie sono separate anche su disco. */
  ok('le chiavi di zoom sono due', true,
    await val("localStorage.getItem('studia.pdf2.zoom') !== null && 'studia.pdf2.zoom' !== 'studia.pdf.zoom'"));

  sezione('⚠️ La selezione nel confronto non apre menu che citerebbero il documento sbagliato');
  const conMenu = await val(`(()=>{
    /* Si simula il giro vero: una selezione dentro il layer del confronto e il
       mouseup che aprirebbe la barra. */
    const span=[...document.querySelectorAll('#pdf2Frame .textLayer span')].filter(s=>s.textContent.trim())[0];
    if(!span) return 'niente testo';
    const r=document.createRange(); r.selectNodeContents(span);
    getSelection().removeAllRanges(); getSelection().addRange(r);
    span.dispatchEvent(new MouseEvent('mouseup', { bubbles:true, button:0 }));
    return 'fatto'; })()`);
  ok('c\'era del testo da selezionare', 'fatto', conMenu);
  await pausa(400);
  ok('la barra della selezione NON è comparsa', false,
    await val("document.getElementById('selBarra').classList.contains('aperta')"));
  await val('getSelection().removeAllRanges(), 1');

  sezione('⚠️ La barra del Confronto sta sul token, come tutte le altre');
  /* Le regole della `.pdfbar` erano ancorate a `#pdfPane`: nel Confronto la
     barra restava coi caratteri di fabbrica — titolo enorme, comandi fuori
     misura. Adesso `:is(#pdfPane,#pdfPane2)`, e qui si misura. */
  const misure = await val(`(()=>{
    function h(sel){ const e=[...document.querySelectorAll(sel)].filter(x=>x.getBoundingClientRect().height>0)[0];
      return e ? Math.round(e.getBoundingClientRect().height) : null; }
    return { token:parseInt(getComputedStyle(document.documentElement).getPropertyValue('--tb-h'),10),
             zoom:h('#pdf2ZoomIn'), livello:h('#pdf2ZoomLvl'), pagina:h('#pdf2Prev'), chiudi:h('#pdf2Close'),
             titolo:Math.round(parseFloat(getComputedStyle(document.getElementById('pdf2Doc')).fontSize)),
             corpo:Math.round(parseFloat(getComputedStyle(document.body).fontSize)) }; })()`);
  console.log('   ' + JSON.stringify(misure));
  ok('i comandi stanno tutti dentro il token',
    [misure.token, misure.token, misure.token, misure.token],
    [misure.zoom, misure.livello, misure.pagina, misure.chiudi]);
  /* La domanda vera di questa sezione: la regola della barra arriva fin qui, o
     i comandi sono coi caratteri di fabbrica? Lo si chiede al testo della
     pagina, che il carattere di fabbrica lo È: se la regola arriva, il
     selettore è più piccolo di lui; se non arriva, sono la stessa misura.
     Nessun numero scritto a mano. */
  ok('e il selettore non è rimasto coi caratteri di fabbrica', true, misure.titolo < misure.corpo);

  sezione('Il nome del documento sta nel selettore, non in un titolo a parte');
  /* Un titolo in barra ripeteva il nome dello strumento (già nella testata del
     blocco) e su un nome lungo spingeva i comandi fuori: il nome lo porta il
     selettore, che lo accorcia coi puntini perché è un comando. */
  ok('il titolo a parte non c\'è più', true,
    await val("document.getElementById('pdf2Title')===null"));
  ok('e il selettore porta il nome del documento a confronto', true,
    await val("document.getElementById('pdf2Doc').textContent.indexOf('Piano di studio')===0"));
  ok('lo dice anche a voce', true,
    /Piano di studio/.test(await val("document.getElementById('pdf2Doc').getAttribute('aria-label')")));

  sezione('La ✕ chiude solo il confronto');
  await val('fonte2Chiudi(), 1'); await pausa(400);
  ok('il confronto è vuoto', false, await val('fonte2Aperta()'));
  ok('e il selettore torna a invitare', 'Documenti \u25BE',
    await val("document.getElementById('pdf2Doc').textContent"));
  ok('e lo dice', false, await val("document.getElementById('pdf2Vuoto').hidden"));
  ok('la Fonte è ancora aperta', true, await val('!!PDFJS.doc'));

  /* Una prova lascia il banco come l'ha trovato. */
  await val('(()=>{ BANCO.stato=JSON.parse(' + JSON.stringify(bancoPrima) + ');' +
    ' bancoSalva(); bancoDisegna(); bancoApplicaFrazioni(); bancoPosizionaDivisori();' +
    ' bancoDopoLayout(); return 1; })()');
  await pausa(500);

  console.log(ko ? `\n✗ ${ko} controlli falliti` : '\n✓ tutti i controlli passati');
  process.exit(ko ? 1 : 0);
})();
