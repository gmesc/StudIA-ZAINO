/* La lente porta al PUNTO della parola, non alla pagina che la contiene.
 *
 * ⚠️ Che cosa misura, e perché solo l'app viva può dirlo: **dove sta
 * l'occorrenza rispetto alla finestra**. È una posizione a schermo, e una
 * posizione a schermo esiste solo dentro un motore di rendering.
 *
 * ⚠️ IL CONTROLLO CHE VALE NON È «si è aperta la pagina giusta»: quello c'è già
 * in `prova-import.js`, ed è verde anche col difetto dentro — la pagina si
 * apriva pure prima. Quello che qui va misurato è che **la parola cercata sia
 * dentro il riquadro**, cioè che chi ha cliccato la veda senza doverla cercare
 * una seconda volta.
 *
 * ⚠️ E SI PASSA DALLA LENTE VERA, non da un risultato costruito a mano. La
 * prima stesura fabbricava l'argomento di `searchGoto`, credendo che il vault
 * di prova non avesse indici PDF. La diagnosi era sbagliata due volte, e la
 * misura l'ha corretta: in modalità CORSO la lente cerca nei capitoli **per
 * progetto** — non è una lacuna, è il ramo giusto; e nello ZAINO l'indice non
 * va portato nel vault, **lo scrive l'app** con pdf.js all'import. La ricetta è
 * quella di `prova-import.js`: uno zaino nuovo, il documento importato dalla
 * porta vera, `fontiIndicizza` che scrive l'indice. Così quello che si misura è
 * la strada intera, dal testo battuto al punto sotto gli occhi.
 *
 *   ./test/cdp/con-vault-di-prova.sh prova-lente-punto.js
 */
const path = require('path');
const fs = require('fs');
const S = path.join(__dirname, 'cdp.js');
const { collega, val, pausa, partiPulito } = require(S);

let ko = 0;
function ok(n, atteso, avuto) {
  const a = JSON.stringify(atteso), b = JSON.stringify(avuto);
  if (a === b) { console.log('  ok  ' + n); return; }
  ko++; console.log('  KO  ' + n + '\n      atteso ' + a + '\n      avuto  ' + b);
}
function sezione(t) { console.log('\n== ' + t); }

const ZAINO = 'zaino-punto';
const PAROLA = 'competenza';

async function finoA(expr, quanto) {
  const fine = Date.now() + (quanto || 25000);
  for (;;) {
    const v = await val(expr);
    if (v) return v;
    if (Date.now() > fine) return null;
    await pausa(300);
  }
}

/* Dove sta l'occorrenza rispetto al riquadro del documento. `.selected` è quella
   su cui pdf.js si è fermato; se non c'è ancora si guarda la prima accesa. */
const DOVE = `(()=>{
  const host = document.getElementById('pdfHost');
  const h = document.querySelector('#pdfFrame .textLayer .highlight.selected')
         || document.querySelector('#pdfFrame .textLayer .highlight');
  const accese = document.querySelectorAll('#pdfFrame .textLayer .highlight').length;
  if (!host) return { errore: 'niente riquadro' };
  const r = host.getBoundingClientRect();
  if (!h) return { accese, pagina: ANTEPRIMA.page, nessunaAccesa: true };
  const b = h.getBoundingClientRect();
  return {
    accese, pagina: ANTEPRIMA.page,
    dentroLaFinestra: b.top >= r.top - 1 && b.bottom <= r.bottom + 1,
    testo: h.textContent,
    y: Math.round(b.top), riquadro: [Math.round(r.top), Math.round(r.bottom)],
    barra: document.getElementById('pdfFindPop').hasAttribute('open'),
    conto: (document.getElementById('pdfFindCount') || {}).textContent
  };
})()`;

(async () => {
  await collega();
  await val('location.reload(), 1'); await pausa(2000);
  await collega(); await pausa(800);
  await partiPulito();
  const vault = await val('window.vault.path');

  sezione('Il filo è attaccato');
  /* ⚠️ `typeof X.y` SOLLEVA se `X` non esiste, e una prova che esplode invece di
     dire KO uccide il resto della corsa con un errore che parla
     dell'infrastruttura. Si chiede prima se il nome esista. */
  ok('l\'attesa è arrivata nella pagina', 'function',
    await val("(typeof FontiAttesa==='undefined') ? 'assente' : typeof FontiAttesa.attendi"));
  ok('e la lente aspetta una condizione, non un numero', true,
    await val("String(searchGoto).indexOf('FontiAttesa.attendi')>=0"));

  sezione('Uno zaino con dentro un documento vero');
  await val(`(async()=>{ await cambiaModo('zaino'); await zainoCrea('Zaino punto'); return 1; })()`);
  ok('lo zaino è aperto', ZAINO, await finoA(`zainoAttivo()==='${ZAINO}' ? zainoAttivo() : 0`, 12000));
  /* La scrivania è una cartella fuori dal vault: il documento deve ENTRARE,
     cioè essere copiato, non linkato. */
  const scrivania = fs.mkdtempSync(path.join(require('os').tmpdir(), 'studia-punto-'));
  const originale = fs.readdirSync(path.join(vault, 'Fonti')).filter((f) => f.toLowerCase().endsWith('.pdf'))[0];
  const sorgente = path.join(scrivania, 'Piano di studio.pdf');
  fs.copyFileSync(path.join(vault, 'Fonti', originale), sorgente);
  const esito = await val(`(async()=>{ const r=await window.vault.fonti.importa(corsoAttivo(),
    [${JSON.stringify(sorgente)}]); return (r.copiati||[]).map(function(x){ return x.nome; }); })()`);
  ok('il documento è entrato', 1, (esito || []).length);
  const nome = (esito || [])[0];
  /* L'indice lo scrive pdf.js DENTRO l'app: è quello che rende cercabile il
     documento, e non c'è niente da portare nel vault di prova. */
  const ind = await val(`(async()=>{ return await fontiIndicizza(${JSON.stringify(nome)}); })()`);
  ok('e l\'indice si è scritto', '', (ind && ind.error) || '');
  console.log('   ' + (ind && ind.npages) + ' pagine indicizzate');
  await val('fontiIndiciCarica()'); await pausa(600);

  sezione('⭐ Dalla lente al punto: la strada intera');
  const ris = await val(`(()=>{ const r=searchRun(${JSON.stringify(PAROLA)});
    return { quanti:r.length, materiale:r[0]&&r[0].d.materiale, pagina:r[0]&&r[0].d.pagina }; })()`);
  ok('la lente trova la parola dentro il documento', true, ris.quanti > 0);
  ok('e il risultato è una pagina di quel documento', nome, ris.materiale);
  console.log('   primo risultato: p. ' + ris.pagina);

  const avvio = Date.now();
  await val(`(()=>{ const r=searchRun(${JSON.stringify(PAROLA)}); searchGoto(r[0], ${JSON.stringify(PAROLA)}); return 1; })()`);
  await finoA('!!PDFJS.doc', 25000);
  /* Si aspetta con lo stesso criterio che usa l'app: una condizione, non un
     numero. Se la strada è rotta, qui si scade e i controlli sotto lo dicono. */
  const acceso = await finoA("document.querySelectorAll('#pdfFrame .textLayer .highlight').length>0", 25000);
  const d = await val(DOVE);
  console.log('   ' + JSON.stringify(d));
  console.log('   arrivato in ' + (Date.now() - avvio) + ' ms');

  ok('si apre alla pagina del risultato', ris.pagina, d.pagina);
  ok('la barra della ricerca è a schermo', true, d.barra);
  ok('c\'è almeno un\'occorrenza accesa', true, !!acceso && d.accese > 0);
  /* ⚠️ IL CONTROLLO CHE VALE IL FILE. Rimettendo un'attesa a tempo al posto
     della condizione, questo e i due qui sopra diventano rossi: non si accende
     niente, perché la ricerca parte prima che la pagina esista. Misurato. */
  ok('e l\'occorrenza è DENTRO la finestra, non fuori', true, d.dentroLaFinestra === true);
  /* ⚠️ NON si pretende l'uguaglianza, ed è un rosso pagato scrivendo questa
     prova: su un documento vero una parola può stare a cavallo di due righe, e
     pdf.js accende il pezzo che sta su quella riga («scuo-» per «scuola»).
     Chiedere la parola intera accuserebbe l'app per una proprietà della
     SILLABAZIONE, che è del documento e non sua. */
  const pezzo = String(d.testo || '').trim().toLowerCase().replace(/[-­]$/, '');
  ok('ed è la parola cercata, o il suo pezzo se va a capo', true,
    !!pezzo && PAROLA.indexOf(pezzo) === 0);
  console.log('   acceso: ' + JSON.stringify(d.testo));

  sezione('Su una macchina veloce non si aspetta per niente');
  /* ⚠️ Il difetto opposto a quello che si è tolto: sostituire un ritardo fisso
     con un'attesa che si prende comunque il suo tempo. */
  const subito = await val(`(async()=>{ const t=Date.now();
    const e=await FontiAttesa.attendi(()=>true); return { ms:Date.now()-t, sguardi:e.sguardi }; })()`);
  ok('chi è già pronto risponde al primo sguardo', 1, subito.sguardi);
  ok('e senza aspettare un battito', true, subito.ms < 50);

  sezione('E se il documento non arriva, lo dice');
  /* ⚠️ Una ricerca lanciata su una pagina che non c'è ancora non trova niente e
     non spiega: chi ha cliccato crede che la parola non ci sia, mentre la lente
     gli aveva appena detto il contrario. */
  const rinuncia = await val(`(async()=>{ const t=Date.now();
    const e=await FontiAttesa.attendi(()=>false,{tetto:300,passo:50});
    return { pronto:e.pronto, ms:Date.now()-t }; })()`);
  ok('la promessa si risolve invece di restare appesa', false, rinuncia.pronto);
  ok('e rinuncia al tetto, non prima né mai', true, rinuncia.ms >= 300 && rinuncia.ms < 2000);

  sezione('E si rimette com\'era');
  /* ⚠️ Lo zaino di prova NON si elimina, ed è la convenzione di casa (la stessa
     di `prova-import.js`, che lascia il suo). `zaino:elimina` passa da
     `shell.trashItem`: cancellarlo qui vorrebbe dire mettere una cartella nel
     CESTINO VERO di chi lancia le prove, a ogni corsa. Il vault di prova è una
     copia in una cartella temporanea, e sparisce tutto insieme quando il runner
     finisce. Si chiude il documento e si butta la scrivania, che sta fuori. */
  await val(`(()=>{ try{ closePdf(); }catch(e){} return 1; })()`);
  /* ⚠️ E SI TORNA AI CORSI, che è la parte che avevo dimenticato: `partiPulito`
     chiude pannellini e selezioni ma NON riporta la modalità, e una prova che
     finisce in zaino la consegna a quella dopo. Nella suite intera l'hanno
     detto due prove — `prova-evidenze-pdf` («la barra flottante compare»: la
     selezione era su un documento di un altro contenitore) e quella dell'Album
     Foto, che negli zaini una voce ce l'ha e nei corsi no. Da sole erano verdi.
     È la stessa lezione di sempre: lo stato che una prova lascia è l'ingresso
     di quella dopo. */
  await val(`(async()=>{ try{ await cambiaModo('corso'); }catch(e){} return 1; })()`);
  await pausa(800);
  ok('si torna ai corsi per la prova che segue', 'corso', await val('modoAttivo()'));
  try { fs.rmSync(scrivania, { recursive: true, force: true }); } catch (e) {}
  ok('la scrivania di prova è stata buttata', false, fs.existsSync(scrivania));

  console.log(ko ? `\n✗ ${ko} controlli falliti` : `\n✓ tutti i controlli passati`);
  process.exit(ko ? 1 : 0);
})();
