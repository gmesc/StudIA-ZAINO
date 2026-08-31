/* Pilota l'app viva via CDP. Gli eventi di mouse passano da
   Input.dispatchMouseEvent, cioè dalla stessa porta del mouse vero: un evento
   sintetico mandato sull'elemento salta il rilevamento del bersaglio e passa
   anche quando per l'utente non funziona niente. */
const WS = require('ws');
let ws, id = 0, attesi = new Map();

/* La porta la decide chi lancia le prove (`STUDIA_PORTA`), non questo file: due
   sessioni di prova sulla stessa porta si contenderebbero la stessa app, e le
   misure dell'una arriverebbero all'altra. */
const PORTA = process.env.STUDIA_PORTA || '9333';

async function collega() {
  const r = await fetch('http://localhost:' + PORTA + '/json');
  const t = (await r.json()).find((x) => x.type === 'page');
  ws = new WS(t.webSocketDebuggerUrl, { perMessageDeflate: false });
  await new Promise((ok, ko) => { ws.on('open', ok); ws.on('error', ko); });
  ws.on('message', (raw) => {
    const m = JSON.parse(raw);
    if (m.id && attesi.has(m.id)) { attesi.get(m.id)(m); attesi.delete(m.id); }
  });
}
function invia(method, params) {
  const n = ++id;
  return new Promise((ok) => { attesi.set(n, ok); ws.send(JSON.stringify({ id: n, method, params })); });
}
async function val(expr) {
  const r = await invia('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.result && r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails.exception));
  return r.result && r.result.result ? r.result.result.value : undefined;
}
async function clicca(sel) {
  const p = await val(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});
    if(!e) return null; const r=e.getBoundingClientRect();
    if(!r.width||!r.height) return null;
    return {x:Math.round(r.left+r.width/2), y:Math.round(r.top+r.height/2)};})()`);
  if (!p) throw new Error('non cliccabile: ' + sel);
  for (const type of ['mousePressed', 'mouseReleased']) {
    await invia('Input.dispatchMouseEvent', { type, x: p.x, y: p.y, button: 'left', clickCount: 1 });
  }
  return p;
}
const pausa = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Mette uno strumento a schermo passando dalla porta VERA.
 *
 * ⚠️ Esiste perché la porta è cambiata: «Appunti» e «Mappe» non sono più due
 * bottoni della topbar — si scelgono dalla tendina di un blocco del banco,
 * `select.bsel`. Le prove che cliccavano `#mappaBtn` cercavano un bottone che
 * non c'è più, e fallivano dicendo «non cliccabile» invece di «la mappa non si
 * apre»: due cose diverse, e la seconda sarebbe stata una bugia.
 *
 * Si sceglie il blocco che ospita GIÀ quello strumento, se c'è; altrimenti il
 * primo che non tiene il capitolo — perché scacciare il capitolo per fare posto
 * alla mappa renderebbe cieca ogni prova che poi guarda il testo.
 */
async function apriStrumento(nome) {
  /* ⚠️ Si passa da `bancoMostra`, e la prima versione di questo aiutante
     sbagliava proprio qui. Cercava di essere fedele fino in fondo — scrivere
     nella tendina e mandare un `change`, come farebbe una mano — ma nella forma
     a due blocchi le tendine di B e D esistono con ZERO opzioni e invisibili:
     scriverci dentro «mappa» non fa niente, e la prova falliva dicendo «la
     mappa non si apre» quando in realtà nessuno gliel'aveva chiesto.
     `bancoMostra` è la funzione che TUTTE le porte chiamano — la tendina, il
     menu, i gesti — quindi non è una scorciatoia che salta la logica: è la
     logica. Che la tendina ci arrivi davvero lo prova `prova-b2.js`, che è il
     posto giusto per provarlo una volta invece che in ogni file. */
  const fatto = await val(`(()=>{ try{ bancoMostra(${JSON.stringify(nome)}); }catch(e){ return String(e); }
    return bancoVisibile(${JSON.stringify(nome)}) ? 'a schermo' : 'non montato'; })()`);
  await pausa(700);
  return fatto;
}

/**
 * Riporta l'app a uno stato noto prima di cominciare.
 *
 * ⚠️ Le prove girano tutte contro la STESSA istanza, una dopo l'altra: quello
 * che una lascia aperto — la barra della selezione, un pannellino, un menu —
 * resta lì per la successiva, e siccome sono riquadri `position:fixed` possono
 * coprire proprio il bottone che la prova dopo va a premere. Il click parte, non
 * arriva, e il rosso accusa una funzione che non ha nessuna colpa.
 */
async function partiPulito() {
  await val(`(()=>{ try{ closePops(); }catch(e){}
    try{ selBarraChiudi(); selMenuChiudi(); }catch(e){}
    try{ mapMenuChiudi(); }catch(e){}
    /* ⚠️ Le forbici dell'album restano accese finché non le si spegne, e con
       loro accese un trascinamento sul documento disegna un rettangolo invece
       di selezionare testo: la prova dopo trovava «nessuna selezione» e
       accusava l'evidenziatore per uno strumento che aveva lasciato acceso
       un'altra. Successo davvero fra prova-album e prova-evidenze-pdf.
       ⚠️⚠️ E niente apici inversi in questo commento: sta dentro un template
       letterale, e uno di quelli lo chiude a metà. È la quarta volta. */
    try{ if(typeof albumRitaglioModo==='function') albumRitaglioModo(false); }catch(e){}
    try{ getSelection().removeAllRanges(); }catch(e){}
    return 1; })()`);
  /* ⚠️ E la SOGLIA DELLA PIPELINE si dichiara già vista. Dal 31 agosto 2026,
     entrando nei corsi, l'app chiede motore AI e Python se mancano — e su
     un'istanza di prova mancano sempre, perché non ha chiavi. La card comparirebbe
     sopra l'app alla prima `cambiaModo('corso')` di qualunque prova, e i click
     finirebbero su di lei: successo davvero, tre prove rosse in un colpo. Chi
     quella soglia la vuole provare la riazzera da sé (`prova-primo-avvio`). */
  await val(`(async()=>{ try{ await window.vault.onboarding.pipelineVista(true); }catch(e){} return 1; })()`);
  await pausa(200);
}

/**
 * Come `partiPulito`, ma si pretende anche uno SCHERMO VUOTO.
 *
 * ⚠️ Da quando l app riapre da sé quello che avevi aperto — documento, media,
 * appunto: `apertoRipristina`, col segno in `localStorage` sotto
 * `studia.aperto` — una prova non parte più da zero: si ritrova addosso lo
 * strascico di chi è passato prima, e per giunta DOPO il reload, quindi
 * nessun `location.reload()` la salva. Misurato il 13 agosto con una sonda fra
 * una prova e l altra: `prova-menu` lasciava un appunto aperto, e
 * `prova-selezione-menu` non vedeva più comparire la barra della selezione
 * perché quell appunto era tornato davanti.
 *
 * ⚠️ Sta QUI e non dentro `partiPulito` perché il ripristino non è sporcizia:
 * è una promessa dell app, e tre prove del banco la misurano apposta. Chi
 * chiama questa funzione dichiara di volere il caso vergine; le altre trovano
 * il mondo com era, che è quello che devono trovare.
 */
async function partiVuoto() {
  await partiPulito();
  await val(`(()=>{
    try{ if(typeof closePdf==='function') closePdf(); }catch(e){}
    try{ if(typeof playerChiudi==='function') playerChiudi(); }catch(e){}
    try{ if(typeof NOTES!=='undefined' && NOTES.cur){ NOTES.cur=null; NOTES.dirty=false;
      if(typeof refreshNoteUI==='function') refreshNoteUI(); } }catch(e){}
    try{ localStorage.removeItem('studia.aperto'); }catch(e){}
    /* il guardiano del ripristino torna a zero: la prova dopo deve poterlo
       provare da capo, se è il suo mestiere */
    try{ if(typeof APERTO!=='undefined') APERTO.ripristinato=''; }catch(e){}
    return 1; })()`);
  await pausa(250);
}


/* ---- media veri per le prove --------------------------------------------
 *
 * ⚠️ Il vault di prova è una copia magra SENZA `MATERIALI/` (23 GB → 13 MB),
 * quindi un media vero lì dentro non c'è: va fabbricato. Prima queste prove
 * usavano un NOME inventato, e reggeva finché un media che non si apriva
 * falliva in silenzio. Dal 24 agosto 2026 non è più così — il player dice
 * perché e si rimette vuoto — e un fantasma non regge una barra: i media di
 * prova sono veri.
 */

/** Un WAV vero: PCM 16 bit, mono, 8 kHz, un sinusoide. Zero dipendenze. */
function wavDiProva(secondi) {
  const rate = 8000, n = rate * (secondi || 1), dati = Buffer.alloc(n * 2);
  for (let i = 0; i < n; i++) dati.writeInt16LE(Math.round(3000 * Math.sin(i / 20)), i * 2);
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + dati.length, 4); h.write('WAVE', 8);
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36); h.writeUInt32LE(dati.length, 40);
  return Buffer.concat([h, dati]);
}

/**
 * Un file media vero, scritto in `dove`, con `ffmpeg`. Torna il percorso, o
 * `''` se ffmpeg non c'è — e allora chi chiama SALTA la sua sezione dicendolo,
 * invece di fallire: ffmpeg non è un requisito del progetto.
 *
 * Un `.wav` non passa da qui: quello si fabbrica senza nessuno (`wavDiProva`).
 */
function mediaConFfmpeg(percorso) {
  const ext = require('path').extname(percorso).toLowerCase();
  const args = {
    '.mp4': ['-f', 'lavfi', '-i', 'testsrc=d=2:s=64x64:r=10', '-f', 'lavfi', '-i', 'sine=f=440:d=2',
             '-c:v', 'libx264', '-c:a', 'aac', '-shortest'],
    '.m4a': ['-f', 'lavfi', '-i', 'sine=f=440:d=2', '-c:a', 'aac'],
    '.aiff': ['-f', 'lavfi', '-i', 'sine=f=440:d=1', '-c:a', 'pcm_s16be']
  }[ext];
  if (!args) throw new Error('mediaConFfmpeg: non so fare un ' + ext);
  try {
    require('fs').mkdirSync(require('path').dirname(percorso), { recursive: true });
    require('child_process').execFileSync('ffmpeg', ['-y'].concat(args, [percorso]), { stdio: 'ignore' });
    return require('fs').existsSync(percorso) ? percorso : '';
  } catch (e) { return ''; }
}

module.exports = { collega, invia, val, clicca, pausa, apriStrumento, partiPulito, partiVuoto,
  wavDiProva, mediaConFfmpeg, ws: () => ws };
