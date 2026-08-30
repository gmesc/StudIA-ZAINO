/* La barra delle fonti: le misure, la scelta del documento, il segno di lettura.
 *
 * Tre promesse, e la terza è l'unica che tocchi un dato dell'utente:
 *
 *  1. i bottoni della barra sono alti come quelli delle altre barre — il token
 *     `--tb-h` — perché è la stessa app;
 *  2. nello ZAINO si passa da un documento all'altro dalla barra, senza tornare
 *     alla sidebar; nei corsi quel bottone non c'è, perché lì i documenti si
 *     aprono dai rimandi del capitolo, che dicono anche la pagina;
 *  3. ⚠️ un documento si riapre DOVE LO SI ERA LASCIATO, e il segno vive nel
 *     vault — non nel `localStorage`: uno zaino copiato su un altro computer si
 *     riapre alla stessa pagina. Il controllo che conta è proprio sul FILE.
 *
 *   ./test/cdp/con-vault-di-prova.sh prova-fonti.js
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
  const fine = Date.now() + (quanto || 15000);
  for (;;) {
    const v = await val(expr);
    if (v) return v;
    if (Date.now() > fine) return null;
    await pausa(250);
  }
}
const PDF = 'Piano-di-studio-della-Scuola-dell-obbligo-ticinese.pdf';
const ZAINO = 'zaino-fonti';

/** Aspetta che il documento sia caricato e la pagina disegnata. */
async function apertoA(pagina) {
  await finoA(`(PDFJS.doc && PDFJS.doc.numPages) || 0`, 25000);
  return await finoA(`ANTEPRIMA.page===${pagina} ? 1 : 0`, 15000);
}

(async () => {
  await collega();
  await val('location.reload(), 1'); await pausa(2000);
  await collega(); await pausa(800);
  await partiPulito();
  const vault = await val('window.vault.path');

  sezione('Le misure: la barra del documento è una barra come le altre');
  await apriStrumento('fonte');
  await val(`openPdf(${JSON.stringify(PDF)}, 5, 'Piano di studio'), 1`);
  await apertoA(5);
  await pausa(600);
  const misure = await val(`(()=>{
    function h(sel){ const e=[...document.querySelectorAll(sel)]
      .filter(x=>x.getBoundingClientRect().height>0)[0];
      return e ? Math.round(e.getBoundingClientRect().height) : null; }
    return { chiudi:h('#pdfClose'), zoom:h('#pdfZoomIn'), livello:h('#pdfZoomLvl'),
             forbici:h('#pdfRitaglia'), pagina:h('#pdfPrev'),
             token:getComputedStyle(document.documentElement).getPropertyValue('--tb-h').trim() }; })()`);
  console.log('   ' + JSON.stringify(misure));
  const tb = parseInt(misure.token, 10);
  ok('il token è quello che dice', true, tb > 0);
  ok('e tutti i bottoni della barra ci stanno dentro',
    [tb, tb, tb, tb, tb],
    [misure.chiudi, misure.zoom, misure.livello, misure.forbici, misure.pagina]);

  /* ⚠️ La LARGHEZZA del bottone del livello non deve cambiare con l'etichetta.
     Ne ha tre — «⟷», «⤢» e una percentuale — e senza una misura riservata al
     caso peggiore («500%», il tetto dello zoom) passare da un adattamento allo
     zoom a mano allargava il bottone di sedici pixel, spostando i due comandi
     accanto sotto le dita di chi stava premendo. */
  const larghezze = await val(`(()=>{ const e=document.getElementById('pdfZoomLvl');
    const prima=e.textContent, out=[];
    ['⟷','⤢','25%','100%','500%'].forEach(t=>{ e.textContent=t;
      out.push(Math.round(e.getBoundingClientRect().width)); });
    e.textContent=prima; return out; })()`);
  console.log('   livello: ' + JSON.stringify(larghezze));
  ok('il bottone del livello è largo uguale con tutte le sue etichette',
    [larghezze[0], larghezze[0], larghezze[0], larghezze[0], larghezze[0]], larghezze);
  /* E la misura riservata dev'essere quella VERA di «500%», non una a caso più
     grande: un bottone largo il doppio non oscilla, ma è un buco nella barra. */
  ok('e la misura è quella che «500%» chiede davvero', true,
    larghezze[0] >= 44 && larghezze[0] <= 50);
  /* Nei corsi il selettore del documento non c'è: lì un documento si apre dal
     rimando del capitolo, che dice anche a che pagina. */
  ok('nei corsi il selettore del documento non compare', false,
    await val(`(()=>{ const b=document.getElementById('pdfDoc');
      return !!b && b.getBoundingClientRect().height>0; })()`));

  sezione('⚠️ Il segno di lettura: si sfoglia, si chiude, si riapre lì');
  const corso = await val('corsoAttivo()');
  await val(`(()=>{ PDFJS.viewer.currentPageNumber=17; return 1; })()`);
  await finoA(`ANTEPRIMA.page===17 ? 1 : 0`, 12000);
  /* La scrittura ha un respiro (le pagine sfogliate sono venti, le scritture
     una): si aspetta il disco, non un numero inventato di millisecondi. */
  const segnato = await finoA(`(async()=>{ const r=await window.vault.lettura.leggi(corsoAttivo());
    const d=(r.documenti||{})[${JSON.stringify(PDF)}];
    return d && d.pagina===17 ? 1 : 0; })()`, 12000);
  ok('la pagina finisce nel vault', 1, segnato);
  /* ⚠️ E ci finisce DAVVERO, in un file: il controllo si fa da Node, non
     chiedendolo all'app che l'ha appena scritto. */
  const fileSegno = path.join(vault, 'Corsi', corso, '_lettura.json');
  ok('il file esiste dentro il contenitore', true, fs.existsSync(fileSegno));
  const dati = JSON.parse(fs.readFileSync(fileSegno, 'utf-8'));
  ok('e dice la pagina giusta', 17, dati.documenti[PDF].pagina);

  /* Si chiude e si riapre SENZA dire la pagina: è il gesto vero. */
  await val(`(()=>{ closePdf(); return 1; })()`);
  await pausa(600);
  await val(`openPdf(${JSON.stringify(PDF)}, null, 'Piano di studio'), 1`);
  ok('riaprendo si torna alla pagina lasciata', 1, await apertoA(17));

  /* Ma un rimando con la pagina dentro vince: è il senso del rimando. */
  await val(`openPdf(${JSON.stringify(PDF)}, 3, 'Piano di studio'), 1`);
  ok('un rimando con la pagina batte il segno', 1, await apertoA(3));

  sezione('Nello ZAINO: il selettore del documento nella barra');
  await val(`(async()=>{ await cambiaModo('zaino'); await zainoCrea('Zaino fonti'); return 1; })()`);
  await finoA(`zainoAttivo()==='${ZAINO}' ? 1 : 0`, 12000);
  const dirPdf = path.join(vault, 'Zaini', ZAINO, 'MATERIALI', 'PDF');
  const daCopiare = fs.readdirSync(path.join(vault, 'Fonti'))
    .filter((f) => f.toLowerCase().endsWith('.pdf')).slice(0, 2);
  daCopiare.forEach((f) => fs.copyFileSync(path.join(vault, 'Fonti', f), path.join(dirPdf, f)));
  await pausa(400);
  ok('qui il selettore c\'è', true,
    await val(`(()=>{ const b=document.getElementById('pdfDoc');
      return !!b && b.getBoundingClientRect().height>0; })()`));
  await clicca('#pdfDoc');
  const voci = await finoA(`(()=>{ const v=document.querySelectorAll('#pdfDocPop .pd-voce');
    return v.length ? v.length : 0; })()`, 10000);
  ok('il pannellino elenca i documenti dello zaino', daCopiare.length, voci);
  ok('e il bottone lo dichiara', 'true',
    await val(`document.getElementById('pdfDoc').getAttribute('aria-expanded')`));
  await clicca('#pdfDocPop .pd-voce');
  await finoA(`(PDFJS.doc && PDFJS.doc.numPages) || 0`, 25000);
  const apertoZaino = await val('ANTEPRIMA.file');
  ok('sceglierne uno lo apre', true, daCopiare.indexOf(apertoZaino) >= 0);
  /* ⚠️ L'etichetta del selettore è VIVA: nello zaino è l'unico posto in cui si
     legge quale documento si sta guardando — il titolo accanto si accorcia fino
     a sparire quando il riquadro è stretto. */
  /* ⚠️ Il confronto si fa col TITOLO come lo scrive l'app (`titoloMateriale`
     toglie il numero e rimette gli spazi al posto dei trattini), non col nome
     del file: chiedere il nome del file qui vorrebbe dire pretendere
     un'etichetta che nessuno vuole leggere. */
  const etichetta = await val(`(()=>({ testo:document.getElementById('pdfDoc').textContent,
    atteso:titoloMateriale(${JSON.stringify(apertoZaino)})||${JSON.stringify(apertoZaino)} }))()`);
  console.log('   ' + JSON.stringify(etichetta));
  ok('e il selettore porta il nome del documento aperto', true,
    etichetta.testo.indexOf(etichetta.atteso) >= 0);
  ok('e il pannellino si chiude', false,
    await val(`!!document.querySelector('#pdfDocPop[open]')`));

  sezione('⚠️ Il segno è del CONTENITORE, non della macchina');
  await val(`(()=>{ PDFJS.viewer.currentPageNumber=9; return 1; })()`);
  await finoA(`ANTEPRIMA.page===9 ? 1 : 0`, 12000);
  await finoA(`(async()=>{ const r=await window.vault.lettura.leggi(corsoAttivo());
    const d=(r.documenti||{})[${JSON.stringify(apertoZaino)}];
    return d && d.pagina===9 ? 1 : 0; })()`, 12000);
  const fileZaino = path.join(vault, 'Zaini', ZAINO, '_lettura.json');
  ok('il segno dello zaino sta dentro lo zaino', true, fs.existsSync(fileZaino));
  ok('e non ha toccato quello del corso', 3,
    JSON.parse(fs.readFileSync(fileSegno, 'utf-8')).documenti[PDF].pagina);
  /* Nel pannellino, accanto al nome, si legge dove si era arrivati: è l'unica
     cosa che distingue un documento cominciato da uno mai aperto. */
  await clicca('#pdfDoc');
  await pausa(600);
  ok('il pannellino mostra la pagina di ripresa', true,
    await val(`(()=>{ const v=[...document.querySelectorAll('#pdfDocPop .pd-voce')];
      return v.some(b=>b.textContent.indexOf('p. 9')>=0); })()`));
  await val(`(()=>{ closePops(); return 1; })()`);

  sezione('⚠️ Rinominare un documento: il numero resta, il lavoro sopra pure');
  {
    /* La logica sta in `lib/fonti.js` e la provano 20 controlli in Node
       (`test/fonti.js`): il nome riscritto nei sei posti che lo citano. Qui si
       prova il CABLAGGIO, cioè le tre cose che in Node non esistono — il
       bottone c'è solo dove il gesto ha senso, la finestra chiede, e dopo il
       documento resta APERTO col nome nuovo invece di lasciare l'anteprima
       appesa a un file che non c'è più. */
    ok('nello zaino il comando c\'è', false,
      await val("document.getElementById('pdfRinomina').hidden"));
    const vecchio = await val('ANTEPRIMA.file');
    const pagina = await val('ANTEPRIMA.page');
    await clicca('#pdfRinomina'); await pausa(300);
    ok('la finestra si apre col nome di adesso', true,
      await val(`document.getElementById('umInput').value === (titoloMateriale(${JSON.stringify(vecchio)})||'')`));
    await val("document.getElementById('umInput').value='Dispensa rinominata'; 1");
    await clicca('#umOk');
    const nuovo = await finoA(`ANTEPRIMA.file && ANTEPRIMA.file.indexOf('Dispensa rinominata')>=0 ? ANTEPRIMA.file : 0`, 15000);
    ok('il documento resta aperto col nome nuovo', true, !!nuovo);
    /* ⚠️ Il numero è la parte che i rimandi citano: se cambiasse, ogni
       `pdf:NN#p=7` scritto negli appunti aprirebbe un altro documento. */
    ok('e il numero è quello di prima', (vecchio.match(/^\d{1,3}/) || [''])[0],
      (String(nuovo).match(/^\d{1,3}/) || [''])[0]);
    ok('la pagina dov\'eri non si perde', pagina, await val('ANTEPRIMA.page'));
    ok('sul disco c\'è il nome nuovo, e il vecchio non c\'è più', [true, false],
      [fs.existsSync(path.join(dirPdf, nuovo)), fs.existsSync(path.join(dirPdf, vecchio))]);
    /* Si rimette com'era: la prova lascia il vault come l'ha trovato.
       ⚠️ Il titolo da ridare è la parte dopo il numero PRESA DAL NOME DEL FILE,
       non `titoloMateriale`: quella è la forma da leggere — trattini diventati
       spazi — e ridarla creerebbe un terzo nome invece di riportare il primo. */
    const titoloVero = vecchio.replace(/^\d{1,3}[\s._-]+/, '').replace(/\.pdf$/i, '');
    await val(`(async()=>{ await window.vault.fonti.rinomina(zainoAttivo(), ANTEPRIMA.file,
      ${JSON.stringify(titoloVero)}); return 1; })()`);
    await pausa(600);
    ok('e il nome di prima si può rimettere', true, fs.existsSync(path.join(dirPdf, vecchio)));
  }

  await val(`(async()=>{ await cambiaModo('corso'); return 1; })()`);
  await pausa(400);
  ok('nei corsi il comando sparisce', true,
    await val("document.getElementById('pdfRinomina').hidden"));
  await val(`(()=>{ try{ closePdf(); }catch(e){} return 1; })()`);

  console.log('');
  console.log(ko ? '✗ ' + ko + ' controlli falliti' : '✓ tutti i controlli passati');
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('✗ ' + e.message); process.exit(1); });
