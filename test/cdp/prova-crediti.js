/* La schermata dei crediti e delle licenze, sull'app viva.
 *
 * Che cosa promette:
 *  · l'elenco NON è più una costante nel renderer: arriva dal disco via
 *    `vault.crediti.leggi()`, e quindi conta tutti i pacchetti spediti, non i
 *    quindici che qualcuno aveva scritto a mano;
 *  · ogni voce mostra licenza e copyright, e il testo integrale della licenza è
 *    dentro l'app (nessun link a internet al posto dell'attribuzione);
 *  · la ricerca filtra, gli obblighi ci sono, e i bottoni esistono.
 *
 * ⚠️ Gira contro il vault della config: puntarlo a una COPIA (trappola ⑧).
 *   ./test/cdp/con-vault-di-prova.sh prova-crediti.js
 */
const S = require('path').join(__dirname, 'cdp.js');
const { collega, invia, val, clicca, pausa, partiPulito } = require(S);

let ko = 0;
function ok(n, atteso, avuto) {
  const a = JSON.stringify(atteso), b = JSON.stringify(avuto);
  if (a === b) { console.log('  ok  ' + n); return; }
  ko++; console.log('  KO  ' + n + '\n      atteso ' + a + '\n      avuto  ' + b);
}
function vero(n, avuto) { ok(n, true, !!avuto); }


/* ⚠️ Le prove girano in coda ad altre trentasei, e ognuna eredita lo schermo
   dell'ultima: un modale rimasto aperto copre la topbar, e il click su ⚙
   finirebbe sul suo fondo. Si parte richiudendo le superfici, non sperando. */
async function schermoPulito() {
  await val(`(()=>{
    ['settingsModal','creditsModal','guidaModal','mediaModal','atlante'].forEach(function(id){
      var m=document.getElementById(id); if(m) m.hidden=true; });
    ['crediti','guida','media','atlante'].forEach(function(k){ delete document.documentElement.dataset[k]; });
    if(typeof closePops==='function') closePops();
    return 1;})()`);
}

(async () => {
  await collega();
  await partiPulito();
  await schermoPulito();

  // le impostazioni, e da lì il 🧙 dei crediti
  await clicca('#settingsBtn'); await pausa(200);
  await clicca('#creditsBtn');
  // l'inventario si legge dal disco: si aspetta che la lista si popoli
  for (let i = 0; i < 40; i++) {
    const n = await val(`document.querySelectorAll('#creditsBody li').length`);
    if (n > 20) break;
    await pausa(100);
  }

  vero('la finestra dei crediti è aperta', await val(`!document.getElementById('creditsModal').hidden`));

  const righe = await val(`document.querySelectorAll('#creditsBody li:not(.cred-gruppo)').length`);
  vero('l\'elenco ha più delle quindici voci scritte a mano di prima (' + righe + ')', righe > 50);

  vero('i gruppi sono intestati', await val(`document.querySelectorAll('#creditsBody li.cred-gruppo').length`) >= 4);
  vero('gli obblighi sono in testa', await val(`document.querySelectorAll('.cred-obb li').length`) >= 5);
  vero('il testo delle licenze è nell\'app', await val(`document.querySelectorAll('#creditsBody details').length`) > 50);
  vero('ogni voce dichiara una licenza', await val(
    `document.querySelectorAll('#creditsBody li:not(.cred-gruppo)').length === document.querySelectorAll('#creditsBody .c-lic').length`));
  vero('OpenMoji è dichiarata CC BY-SA', await val(
    `/CC BY-SA/.test(document.getElementById('creditsBody').textContent)`));
  vero('ffmpeg è dichiarato LGPL', await val(
    `/LGPL/.test(document.getElementById('creditsBody').textContent + document.getElementById('creditsTesta').textContent)`));
  vero('il bottone del NOTICE c\'è', await val(`!!document.getElementById('creditsNotice')`));

  // la ricerca: filtra e non perde il fuoco
  await val(`(()=>{const c=document.getElementById('creditsCerca');
    c.focus(); c.value='openmoji'; c.dispatchEvent(new Event('input',{bubbles:true})); return 1;})()`);
  await pausa(150);
  const filtrate = await val(`document.querySelectorAll('#creditsBody li:not(.cred-gruppo)').length`);
  /* «openmoji» trova DUE voci dal 15 agosto: la libreria di emoji e l'icona
     dell'app (graduation cap 1F393), che è una voce a sé perché ha un'altra
     storia di licenza. La prova era stata scritta quando la voce era una. */
  ok('la ricerca restringe alle voci OpenMoji', 2, filtrate);
  vero('la ricerca tiene il fuoco', await val(`document.activeElement.id === 'creditsCerca'`));

  await val(`(()=>{const c=document.getElementById('creditsCerca');
    c.value=''; c.dispatchEvent(new Event('input',{bubbles:true})); return 1;})()`);
  await pausa(150);
  vero('svuotare la ricerca rimette tutto', await val(`document.querySelectorAll('#creditsBody li:not(.cred-gruppo)').length`) > 50);

  // il NOTICE si scrive davvero (percorso esplicito: niente dialogo di sistema)
  const dest = require('path').join(require('os').tmpdir(), 'studia-notice-prova.txt');
  const esito = await val(`window.vault.crediti.notice(${JSON.stringify(dest)})`);
  vero('il NOTICE si esporta', esito && esito.ok);
  const fs = require('fs');
  vero('il NOTICE contiene i testi delle licenze',
    fs.existsSync(dest) && fs.readFileSync(dest, 'utf8').includes('Permission is hereby granted'));
  try { fs.unlinkSync(dest); } catch (e) {}

  // Esc chiude i crediti prima delle impostazioni
  await invia('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', windowsVirtualKeyCode: 27 });
  await pausa(200);
  vero('Esc chiude i crediti', await val(`document.getElementById('creditsModal').hidden`));
  vero('…e lascia aperte le impostazioni', await val(`!document.getElementById('settingsModal').hidden`));

  console.log(ko ? '\n' + ko + ' controlli falliti' : '\n✓ tutti i controlli passati');
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
