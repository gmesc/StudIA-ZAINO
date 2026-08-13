/* Riaprire NON ridispone il banco.
 *
 * ⚠️ Che cosa difende. Chiudendo l'app con la mappa a tutto banco («uno») e una
 * fonte aperta, all'avvio `apertoRipristina` chiamava `openPdf`, che chiama
 * `bancoMostra('fonte')`: non trovando le fonti a schermo, il banco CRESCEVA
 * per far posto — e `bancoAssegna` salvava la forma nuova. Con una fonte, un
 * media e un appunto aperti si riapriva in tre riquadri, e la disposizione
 * scelta era già sovrascritta sul disco. Dal lato di chi studia si vedevano due
 * cose insieme: «il banco non tiene la disposizione» e «la pagina del documento
 * invece sì» — perché la pagina sta nel vault e nessuno la riscriveva.
 *
 * La riapertura è vera: `location.reload()`, così passa dal boot — è lì che sta
 * il guasto, non nelle funzioni prese una per una.
 *
 *   ./test/cdp/con-vault-di-prova.sh prova-banco-ripristino.js
 */
const S = require('path').join(__dirname, 'cdp.js');
const { collega, val, pausa, partiVuoto } = require(S);

/* Il documento del vault globale, l'unico che la copia magra porta con sé
   (`con-vault-di-prova.sh` lascia fuori i `MATERIALI/`). Qui serve come
   SORGENTE da importare nel contenitore, non come fonte da aprire. */
const PDF_SORGENTE = 'Piano-di-studio-della-Scuola-dell-obbligo-ticinese.pdf';

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
    let v = null;
    try { v = await val(expr); } catch (e) { /* durante il reload l'app non risponde */ }
    if (v) return v;
    if (Date.now() > fine) return null;
    await pausa(200);
  }
}

(async () => {
  await collega();
  await partiVuoto();

  /* ⚠️ La fonte dev'essere DEL CONTENITORE, non una del vault globale: il
     ripristino controlla il segno contro `corpus.list(corso)`, e una fonte che
     non è in elenco non viene riaperta — la prova sarebbe verde senza aver
     misurato niente. Quindi la si porta dentro con lo stesso gesto dell'app
     (`fonti.importa`), e alla fine la si rimette via. */
  sezione('Una fonte DEL contenitore: il ripristino non ne riapre altre');
  const dentro = await val(`(async()=>{
    const corso=corsoAttivo();
    const gia=((await window.vault.corpus.list(corso))||[]).filter(m=>/\\.pdf$/i.test(m.name))[0];
    if(gia) return { nome: gia.name, importata:false };
    const r=await window.vault.fonti.importa(corso, [window.vault.vaultPath+'/Fonti/'+${JSON.stringify(PDF_SORGENTE)}]);
    const c=(r&&r.copiati&&r.copiati[0])||null;
    return c ? { nome:(c.nome||c.file||String(c)), importata:true } : { errore: JSON.stringify(r) };
  })()`);
  if (!dentro || !dentro.nome) {
    console.log('  ✗ nessuna fonte nel contenitore e nessuna importabile: ' + JSON.stringify(dentro));
    process.exit(1);
  }
  console.log('   fonte: ' + dentro.nome + (dentro.importata ? ' (importata adesso)' : ' (era già lì)'));
  const F = JSON.stringify(dentro.nome);

  sezione('Si lascia l\'app come la lascia chi studia: fonte aperta, mappa a tutto banco');
  await val(`(()=>{ openPdf(${F}, 3, 'Prova'); return 1; })()`);
  await pausa(900);
  ok('il segno della fonte è stato scritto', dentro.nome,
    await val(`(JSON.parse(localStorage.getItem('studia.aperto')||'{}')[corsoAttivo()]||{}).fonte`));
  /* Questo è un GESTO, quindi il banco DEVE cambiare: è la disposizione che
     dopo il riavvio va ritrovata. */
  await val(`(()=>{ bancoForma('uno'); bancoAssegna('A','mappa'); return 1; })()`);
  await pausa(400);
  const prima = await val(`JSON.stringify(bancoStato())`);
  /* ⚠️ La pagina si LEGGE, non si dà per scontata: `openPdf` la limita a quelle
     che il documento ha davvero, e il vault di prova può portare un PDF di una
     pagina sola. Un 3 scritto qui misurerebbe il documento, non il ripristino. */
  const paginaPrima = await val(`ANTEPRIMA.page`);
  ok('il banco è a un blocco solo, con la mappa', ['uno', 'mappa'],
    await val(`[bancoStato().forma, bancoStrumentoIn('A')]`));

  sezione('Si riapre: la disposizione è quella di prima, non una cresciuta per far posto');
  try { await val(`(setTimeout(()=>location.reload(),80),1)`); } catch (e) {}
  await pausa(2500);
  await collega();
  await finoA(`(typeof bancoStato==='function' && bancoStato().forma) ? 1 : 0`, 20000);
  /* ⚠️ Il ripristino è asincrono (legge i segni e l'elenco dal disco): si
     aspetta che ABBIA riaperto la fonte, o si misurerebbe un banco che nessuno
     ha ancora avuto occasione di scomporre — un verde per il motivo sbagliato. */
  const riaperta = await finoA(`(typeof ANTEPRIMA!=='undefined' && ANTEPRIMA && ANTEPRIMA.file===${F}) ? 1 : 0`, 15000);
  ok('la fonte è stata riaperta: il contenuto torna', 1, riaperta);
  ok('e con lei la pagina su cui si era', paginaPrima, await val(`ANTEPRIMA.page`));
  ok('il banco è rimasto quello che era', prima, await val(`JSON.stringify(bancoStato())`));
  ok('e sul disco non è stato riscritto', prima,
    await val(`JSON.stringify(BancoForme.normalizzaStato(JSON.parse(localStorage.getItem(bancoChiave())||'null')))`));
  ok('le fonti NON sono a schermo: la mappa ha ancora tutto il banco', [false, 'mappa'],
    await val(`[bancoVisibile('fonte'), bancoStrumentoIn('A')]`));

  sezione('E quando le fonti tornano a schermo, il documento è lì');
  await val(`(()=>{ bancoAssegna('A','fonte'); return 1; })()`);
  const disegnata = await finoA(`document.querySelectorAll('#pdfHost .page').length ? 1 : 0`, 20000);
  ok('il documento si disegna appena il suo strumento rientra', 1, disegnata);

  sezione('Pulizia: quello che questa prova ha portato dentro, questa prova lo toglie');
  await val(`(()=>{ try{ closePdf(); }catch(e){} bancoForma('due-col');
    bancoAssegna('A','capitolo'); return 1; })()`);
  if (dentro.importata) {
    await val(`window.vault.fonti.elimina(corsoAttivo(), ${F})`);
  }
  await partiVuoto();

  console.log(ko ? `\n✗ ${ko} controlli falliti` : '\n✓ tutti i controlli passati');
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error('prova-banco-ripristino: ' + (e && e.message)); process.exit(1); });
