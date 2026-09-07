/* La voce sulla pagina, sull'app viva: il CABLAGGIO.
 *
 * ⚠️ Che cosa NON si prova qui. Come si taglia il testo in frasi lo controlla
 * già `test/roundtrip.js` sul segmentatore, e come si sceglie una voce di
 * sistema sta in `lib/voce.js`. Qui resta quello che solo l'app viva può dire:
 * il testo della PAGINA arriva ai segmenti, ogni frase sa dove sta nel DOM, e
 * la frase in lettura si accende davvero.
 *
 * ⚠️ E una cosa che questa prova NON PUÒ fare: sentire. Che la voce esca dagli
 * altoparlanti, e che dica le parole giuste, si verifica con le orecchie — la
 * lista dei gesti a mano lo dichiara. Qui si misura tutto quello che sta prima
 * del suono.
 *
 * ⚠️ SOLO macOS. `lib/voce.js` è `/usr/bin/say`: dove non c'è, il comando non
 * deve nemmeno comparire, ed è il primo controllo di questo file — su una
 * macchina senza sintesi la prova resta verde dichiarando che il resto non si
 * applica, invece di fallire per una cosa che non è un difetto.
 *
 *   ./test/cdp/con-vault-di-prova.sh prova-voce-pagina.js
 */
const S = require('path').join(__dirname, 'cdp.js');
const { collega, val, pausa, partiPulito, apriStrumento, clicca, pdfVisibile } = require(S);

let ko = 0;
function ok(n, atteso, avuto) {
  const a = JSON.stringify(atteso), b = JSON.stringify(avuto);
  if (a === b) { console.log('  ok  ' + n); return; }
  ko++; console.log('  KO  ' + n + '\n      atteso ' + a + '\n      avuto  ' + b);
}
function sezione(t) { console.log('\n== ' + t); }

const PDF = 'Piano-di-studio-della-Scuola-dell-obbligo-ticinese.pdf';

async function finoA(expr, quanto) {
  const fine = Date.now() + (quanto || 20000);
  for (;;) {
    const v = await val(expr);
    if (v) return v;
    if (Date.now() > fine) return null;
    await pausa(250);
  }
}

(async () => {
  await collega();
  await partiPulito();
  await apriStrumento('fonte');
  await pdfVisibile(PDF);
  await val(`openPdf(${JSON.stringify(PDF)}, 1, 'Piano di studio'), 1`);
  await finoA('!!PDFJS.doc');
  await finoA(`(()=>{ const h=document.getElementById('pdfHost'); if(!h) return 0;
    const r=h.getBoundingClientRect();
    return [...document.querySelectorAll('#pdfFrame .textLayer span')]
      .filter(s=>{ const b=s.getBoundingClientRect();
        return b.height>0 && b.top>=r.top && b.bottom<=r.bottom; }).length; })()`, 25000);
  await pausa(400);

  sezione('Il comando esiste solo dove la voce esiste');
  const cè = await val('ttsSistema()');
  console.log('   sintesi di sistema: ' + (cè ? 'sì' : 'no'));
  ok('il bottone c\'è se e solo se c\'è la sintesi', cè,
    !(await val("document.getElementById('pdfVoce').hidden")));
  if (!cè) {
    console.log('   (questa macchina non ha /usr/bin/say: il resto non si applica,');
    console.log('    e non è un difetto — la voce dei capitoli è macOS-only dal primo giorno)');
    console.log(ko ? `\n✗ ${ko} controlli falliti` : `\n✓ tutti i controlli passati`);
    process.exit(ko ? 1 : 0);
  }
  ok('e da fermo si spiega', true,
    await val("/Leggi ad alta voce/.test(document.getElementById('pdfVoce').title)"));

  sezione('⭐ Il testo della PAGINA diventa frasi che sanno dove stanno');
  /* ⚠️ Si va su una pagina di PROSA. La prima è la copertina — un titolo e un
     ente, senza punteggiatura di chiusura — e ne esce UNA frase sola: giusto,
     ma non dice niente sul taglio in frasi. La prima stesura misurava lì e il
     rosso accusava il segmentatore di una scelta sbagliata della prova. */
  await val('vaiAPagina(20), 1');
  const righe = await finoA(`(()=>{ const h=document.getElementById('pdfHost'); if(!h) return 0;
    const r=h.getBoundingClientRect();
    const p=document.querySelector('#pdfFrame .page[data-page-number="20"] .textLayer');
    if(!p) return 0;
    return [...p.querySelectorAll('span')].filter(s=>{ const b=s.getBoundingClientRect();
      return b.height>0 && b.top>=r.top && b.bottom<=r.bottom; }).length; })()`, 25000);
  console.log('   righe di prosa a schermo: ' + righe);
  await pausa(400);
  const costr = await val(`(()=>{ TTS.motore='sistema';
    const fatto=voceCostruisciPagina();
    return { fatto, quanti:TTS.seg.length,
             conPorzione:TTS.seg.filter(s=>!!s.range).length,
             primo:(TTS.seg[0]||{}).t||'' }; })()`);
  console.log('   ' + JSON.stringify(costr).slice(0, 220));
  ok('la pagina si è lasciata leggere', true, costr.fatto);
  ok('e ne sono uscite delle frasi', true, costr.quanti > 2);
  /* ⚠️ IL CONTROLLO CHE VALE IL FILE: ogni frase sa dove sta nel DOM. Le frasi
     si tagliano sul testo GREZZO proprio per questo — `ttsSegmenti` normalizza
     prima di spezzare (scioglie «p. es.» in «per esempio»), e su un testo
     riscritto le posizioni non tornano più. Se anche una sola frase perdesse la
     sua porzione, quella si leggerebbe senza accendersi. */
  ok('OGNI frase sa dove sta nel documento', costr.quanti, costr.conPorzione);
  ok('e la prima dice qualcosa', true, String(costr.primo).length > 3);

  sezione('La porzione punta al testo vero, non a caso');
  const combacia = await val(`(()=>{
    let uguali=0, guardate=0;
    for(const s of TTS.seg.slice(0,6)){
      if(!s.range) continue;
      guardate++;
      const dom=s.range.toString().replace(/\\s+/g,' ').trim().toLowerCase();
      const detto=String(s.t||'').replace(/\\s+/g,' ').trim().toLowerCase();
      /* Il testo DETTO è normalizzato (le abbreviazioni sciolte), quello del DOM
         no: si confrontano le prime parole, che la normalizzazione non tocca
         quasi mai. */
      const a=dom.split(' ').slice(0,3).join(' '), b=detto.split(' ').slice(0,3).join(' ');
      if(a && b && (a===b || detto.indexOf(a)>=0 || dom.indexOf(b)>=0)) uguali++;
    }
    return { guardate, uguali }; })()`);
  console.log('   ' + JSON.stringify(combacia));
  ok('quello che si dice è quello che si accende', true,
    combacia.guardate > 0 && combacia.uguali >= Math.ceil(combacia.guardate * 0.8));

  sezione('La frase in lettura si accende davvero');
  await val('ttsEvidenzia(TTS.seg[0]), 1'); await pausa(200);
  ok('il registro degli highlight ha «voce»', true,
    await val("!!(window.CSS && CSS.highlights && CSS.highlights.get('voce'))"));
  /* ⚠️ Il registro dei nomi è CONDIVISO con le evidenze e la ricerca: «voce»
     deve stare accanto, non al posto di qualcun altro. */
  ok('e non ha rubato il posto alla ricerca', true,
    await val("!(CSS.highlights.get('ricerca') === CSS.highlights.get('voce'))"));
  await val('ttsEvidenzia({}), 1'); await pausa(150);
  ok('e si spegne quando la frase non ne ha una', false,
    await val("!!(CSS.highlights && CSS.highlights.get('voce'))"));

  sezione('Fermare è un gesto solo');
  await val('TTS.playing=true, voceAggiorna(), 1');
  ok('mentre legge, il bottone dice «ferma»', true,
    await val("/Ferma la lettura/.test(document.getElementById('pdfVoce').title)"));
  await val('voceFerma(), 1'); await pausa(200);
  ok('e fermando si spegne anche l\'evidenza', false,
    await val("!!(CSS.highlights && CSS.highlights.get('voce'))"));
  ok('il bottone torna a proporre la lettura', true,
    await val("/Leggi ad alta voce/.test(document.getElementById('pdfVoce').title)"));

  sezione('Chiudendo il documento la voce tace');
  await val('TTS.playing=true, TTS.seg=[{t:"x",range:document.createRange()}], 1');
  await val('closePdf(), 1'); await pausa(300);
  ok('non sta più leggendo', false, await val('voceInCorso()'));
  ok('e il comando sparisce col documento', true,
    await val("document.getElementById('pdfVoce').hidden"));

  console.log(ko ? `\n✗ ${ko} controlli falliti` : `\n✓ tutti i controlli passati`);
  process.exit(ko ? 1 : 0);
})();
