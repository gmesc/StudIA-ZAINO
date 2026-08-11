/* I documenti che entrano nello zaino, e la lente che li cerca.
 *
 * ⚠️ Il gesto vero è un trascinamento, e un trascinamento di FILE VERI non si
 * simula col CDP: `DataTransfer.files` non si può costruire dall'esterno con i
 * percorsi del disco, e `webUtils.getPathForFile` risponde solo a un `File`
 * arrivato davvero da fuori. Quindi qui si prova tutto quello che sta SOTTO il
 * gesto — la porta che il gestore del `drop` chiama con i percorsi — e in più
 * si verifica che quel gestore esista e sia quello giusto. È la trappola ①
 * dell'handoff («una prova che scavalca la porta vera passa mentre la funzione
 * è rotta») presa per il verso in cui si può: la porta scavalcata è l'ULTIMO
 * anello, non la logica.
 *
 * Quello che invece si misura per intero, perché è il punto:
 *   · il documento entra numerato e si apre;
 *   · l'indice per pagina viene scritto DAVVERO, con pdf.js, e dice chi l'ha
 *     letto;
 *   · la lente della topbar, in modalità zaino, trova una parola dentro il PDF
 *     e ci porta — alla pagina giusta.
 *
 *   ./test/cdp/con-vault-di-prova.sh prova-import.js
 */
const path = require('path');
const fs = require('fs');
const S = path.join(__dirname, 'cdp.js');
const { collega, val, clicca, pausa, partiPulito } = require(S);

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
    await pausa(300);
  }
}

const ZAINO = 'zaino-import';

(async () => {
  await collega();
  await val('location.reload(), 1'); await pausa(2000);
  await collega(); await pausa(800);
  await partiPulito();
  const vault = await val('window.vault.path');

  sezione('Uno zaino nuovo, e un PDF sulla «scrivania»');
  await val(`(async()=>{ await cambiaModo('zaino'); await zainoCrea('Zaino import'); return 1; })()`);
  await finoA(`zainoAttivo()==='${ZAINO}' ? 1 : 0`, 12000);
  /* La scrivania è una cartella fuori dal vault: il documento deve ENTRARE, cioè
     essere copiato, non linkato. */
  const scrivania = fs.mkdtempSync(path.join(require('os').tmpdir(), 'studia-scrivania-'));
  const originale = fs.readdirSync(path.join(vault, 'Fonti')).filter((f) => f.toLowerCase().endsWith('.pdf'))[0];
  const sorgente = path.join(scrivania, 'Piano di studio.pdf');
  fs.copyFileSync(path.join(vault, 'Fonti', originale), sorgente);

  sezione('Il gestore del trascinamento c\'è, e in modalità zaino porta qui');
  /* Non si può costruire un drop con file veri, ma si può verificare che la
     finestra ascolti il `drop` e che la funzione che chiama esista: se un
     giorno sparisse il gestore, il resto di questa prova passerebbe lo stesso. */
  ok('la finestra ha la funzione che riceve i documenti', 'function',
    await val(`typeof fontiTrascinate`));
  ok('e il preload sa dare il percorso di un file trascinato', 'function',
    await val(`typeof window.vault.fonti.percorsoDi`));

  sezione('Il documento entra: copiato, numerato, aperto');
  const esito = await val(`(async()=>{ const r=await window.vault.fonti.importa(corsoAttivo(),
    [${JSON.stringify(sorgente)}]);
    return { copiati:(r.copiati||[]).map(function(x){ return x.nome; }), scartati:r.scartati, error:r.error }; })()`);
  ok('è entrato', ['01 Piano di studio.pdf'], esito.copiati);
  ok('senza scarti', [], esito.scartati);
  const nome = esito.copiati[0];
  const dentro = path.join(vault, 'Zaini', ZAINO, 'MATERIALI', 'PDF', nome);
  ok('il file sta dentro lo zaino', true, fs.existsSync(dentro));
  /* ⚠️ Copiato, non spostato: l'originale di chi studia non si tocca. */
  ok('e l\'originale sulla scrivania è ancora lì', true, fs.existsSync(sorgente));

  sezione('⚠️ L\'INDICE: lo scrive pdf.js, dentro l\'app');
  /* È la parte che rende lo zaino leggero: nessun Python, nessun modello — il
     testo lo estrae il visualizzatore che è già qui. */
  const avvio = Date.now();
  const ind = await val(`(async()=>{ const r=await fontiIndicizza(${JSON.stringify(nome)}); return r; })()`);
  ok('l\'indice si scrive, senza errori', '', ind.error || '');
  console.log('   ' + ind.npages + ' pagine in ' + (Date.now() - avvio) + ' ms');
  const fileIndice = path.join(vault, 'Zaini', ZAINO, 'MATERIALI', 'Indici-PDF', nome.replace(/\.pdf$/, '.json'));
  ok('e il file è al suo posto', true, fs.existsSync(fileIndice));
  const dati = JSON.parse(fs.readFileSync(fileIndice, 'utf-8'));
  ok('con la forma che la ricerca conosce', ['pdf', 'npages', 'motore', 'pages'], Object.keys(dati));
  ok('e dice chi l\'ha letto', 'pdfjs', dati.motore);
  ok('le pagine ci sono tutte', true, dati.npages > 200);
  ok('e contengono testo vero', true,
    dati.pages.filter((p) => p.text.length > 200).length > 100);

  sezione('⚠️ LA LENTE: nello zaino cerca dentro i documenti');
  await val('fontiIndiciCarica()');
  await pausa(600);
  /* Una parola che nel documento c'è di sicuro, presa dall'indice appena
     scritto: cercarne una inventata proverebbe solo che la ricerca sa dire di
     no. */
  const pagina = dati.pages.filter((p) => /competenza/i.test(p.text))[0];
  ok('nel documento c\'è la parola da cercare', true, !!pagina);
  const risultati = await val(`(()=>{ const r=searchRun('competenza');
    return { quanti:r.length, primo:r[0] ? { materiale:r[0].d.materiale, pagina:r[0].d.pagina,
      titolo:r[0].d.lessonTitle } : null }; })()`);
  ok('la lente trova qualcosa', true, risultati.quanti > 0);
  ok('e il risultato è una PAGINA di un documento', nome, risultati.primo && risultati.primo.materiale);
  ok('col titolo leggibile del documento', 'Piano di studio',
    risultati.primo && risultati.primo.titolo);

  /* E ci si va: il click sul risultato apre il documento a quella pagina. */
  await val(`(()=>{ const r=searchRun('competenza'); searchGoto(r[0], 'competenza'); return 1; })()`);
  await finoA(`(PDFJS.doc && PDFJS.doc.numPages) || 0`, 25000);
  const dove = await val(`({ file:ANTEPRIMA.file, pagina:ANTEPRIMA.page })`);
  ok('il documento si apre', nome, dove.file);
  ok('e alla pagina del risultato', risultati.primo.pagina, dove.pagina);

  sezione('⚠️ Il numero del documento: senza, i rimandi non si scrivono');
  /* Il numero (`01 …pdf`) è ciò che rende scrivibile `pdf:01#p=7`, e quindi
     cliccabile una parola chiave portata negli appunti. La mappa NN→file la
     costruisce il preload leggendo il disco all'AVVIO: un documento importato
     adesso non ci sarebbe fino al riavvio — e il rimando resterebbe testo nudo,
     senza che si capisca perché. */
  /* I numeri si registrano quando il contenitore si guarda: la sidebar e gli
     indici li raccolgono, e l'import li aggiunge subito. Qui si passa di lì. */
  await val('fontiIndiciCarica()'); await pausa(500);
  /* ⚠️ E la mappa dei numeri dev'essere SCRIVIBILE: quella che arriva dal
     preload passa da `contextBridge`, che la consegna congelata — scriverci
     dentro non solleva e non fa niente. Il renderer ne tiene una copia. */
  ok('la mappa dei numeri accoglie il contenitore nuovo', true,
    await val(`!!(NUM_CORSI[corsoAttivo()] && NUM_CORSI[corsoAttivo()].pdf)`));
  ok('il documento appena importato ha un numero', '01',
    await val(`numDiFile(${JSON.stringify(nome)}, pdfNumOra())`));
  const parola = await val(`(()=>{ const api=window.vault.evidenze;
    const r=api.aggiungi(corsoAttivo(), { exact:'competenza', prefix:'la ', suffix:' situata',
      colore:'#a16207', materiale:${JSON.stringify(nome)}, pagina:12 });
    evidenzeCarica();
    const e=(r.evidenze||[]).filter(function(x){ return x.exact==='competenza'; })[0];
    return { md:kwMarkdown(e), reso:renderNoteMd(kwMarkdown(e)) }; })()`);
  console.log('   ' + JSON.stringify(parola.md));
  ok('la parola chiave porta il rimando al documento', true, /\]\(pdf:01#p=12\)$/.test(parola.md));
  /* ⚠️ E il rimando si SCIOGLIE: nell'appunto reso diventa un link con dentro
     il file vero. Un `pdf:01` che nessuna mappa sa risolvere darebbe un link
     con `data-file` vuoto — cliccabile e muto. */
  ok('e negli appunti diventa un link vivo', true,
    parola.reso.indexOf('class="plink"') >= 0 && parola.reso.indexOf('data-file="' + nome + '"') >= 0);

  sezione('Nei corsi la lente continua a cercare nei capitoli');
  await val(`(async()=>{ await cambiaModo('corso'); return 1; })()`);
  await pausa(700);
  const nelCorso = await val(`(()=>{ const r=searchRun('AI');
    return { quanti:r.length, primo:r[0] ? { materiale:r[0].d.materiale||null,
      lezione:r[0].d.lessonId||null } : null }; })()`);
  ok('trova ancora', true, nelCorso.quanti > 0);
  /* ⚠️ E i risultati sono CAPITOLI, non pagine: se la ricerca dello zaino
     invadesse i corsi, qui comparirebbe un `materiale`. */
  ok('e sono capitoli, non documenti', null, nelCorso.primo && nelCorso.primo.materiale);

  try { fs.rmSync(scrivania, { recursive: true, force: true }); } catch (e) {}
  await val(`(()=>{ try{ closePdf(); }catch(e){} return 1; })()`);

  console.log('');
  console.log(ko ? '✗ ' + ko + ' controlli falliti' : '✓ tutti i controlli passati');
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('✗ ' + e.message); process.exit(1); });
