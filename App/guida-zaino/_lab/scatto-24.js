/* Rifà UNA sola figura della campagna: `24-confronto`.
 *
 * ⚠️ Perché non si rilancia `campagna.js`. I 43 passi riscrivono tutte e 117 le
 * immagini: un diff di soli PNG rifatti, dove l'unica che è davvero cambiata si
 * perde. Qui si ricostruisce a mano lo STATO che il passo 24 trova — ed è la
 * parte delicata, perché quello stato è eredità dei passi che lo precedono: la
 * pagina 9 viene dal 21, la ricerca «pianeti» aperta viene dal 22 (si vede nella
 * figura), lo zoom adattato alla larghezza dal 23. Chi tocca quei passi tocca
 * anche questo file.
 *
 *   GUIDA_VAULT=<vault di prova> node scatto-24.js
 */
const L = require('./lab.js');
const fs = require('fs');
const path = require('path');
const M = path.join(__dirname, 'materiali') + path.sep;
const VAULT = process.env.GUIDA_VAULT;
if (!VAULT) { console.error('Serve GUIDA_VAULT=<cartella del vault di prova>'); process.exit(1); }
const W = 1470, H = 956;

(async () => {
  await L.collega();
  fs.rmSync(VAULT + '/Zaini', { recursive: true, force: true });
  await L.val(`localStorage.clear(); 1`);
  await L.invia('Page.navigate', { url: 'file://' + path.join(__dirname, '..', '..', 'StudIA.html') });
  await L.pausa(3000);
  await L.collega();
  await L.invia('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 2, mobile: false });
  await L.pausa(700);
  console.log(await L.val(`({modo: document.documentElement.dataset.modo, w: innerWidth, h: innerHeight})`));

  console.log('== lo zaino «Sistema solare»');
  await L.clicca('button.brand'); await L.pausa(900);
  await L.clicca('#zainoNuovo'); await L.pausa(500);
  await L.clicca('#zainoNome'); await L.scrivi('Sistema solare'); await L.pausa(200);
  await L.clicca('#zainoCrea');
  await L.finoA(`zainoAttivo()==='sistema-solare' ? 1 : 0`, 8000); await L.pausa(700);

  console.log('== il documento');
  await L.rilascia([M + 'Sistema solare.pdf']); await L.pausa(1300);
  await L.finoA(`(()=>{const p=document.querySelector('#pdfPane .textLayer span'); return p?1:0})()`, 15000);
  await L.pausa(1200);
  await L.pulito(); await L.pausa(3600);   // l'avviso verde se ne va da solo

  console.log('== il banco come lo lascia il passo 40+45');
  await L.val(`bancoForma('quattro')`); await L.pausa(900);
  await L.val(`bancoAssegna('D','')`); await L.pausa(500);
  await L.val(`bancoAssegna('D','mappa'); bancoForma('due-col')`); await L.pausa(900);

  console.log('== pagina 9 (21), ricerca «pianeti» (22), zoom (23)');
  await L.val(`vaiAPagina(9)`); await L.pausa(1500);
  await L.val(`letturaFlush && letturaFlush()`);
  await L.pulito();
  await L.clicca('#pdfFindBtn'); await L.pausa(300);
  await L.clicca('#pdfFindInput'); await L.scrivi('pianeti'); await L.pausa(900);
  await L.val(`pdfZoomAdatta()`); await L.pausa(700);
  await L.val(`pdfZoomPasso(true)`); await L.pausa(700);
  await L.val(`pdfZoomAdatta()`); await L.pausa(500);

  console.log('== 24 confronto');
  await L.val(`bancoAssegna('C','fonte2')`); await L.pausa(700);
  await L.val(`fonte2Apri('01 Sistema solare.pdf')`); await L.pausa(2500);
  await L.val(`fonte2Pagina && fonte2Pagina(true)`); await L.pausa(800);
  console.log('   barra: ' + await L.val(`document.querySelector('#pdfPane2 .pdfbar').textContent.trim()`));
  await L.scatta('24-confronto');
  process.exit(0);
})();
