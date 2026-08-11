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
  await pausa(200);
}

module.exports = { collega, invia, val, clicca, pausa, apriStrumento, partiPulito, ws: () => ws };
