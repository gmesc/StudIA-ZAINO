/* Pilota l'app viva via CDP. Gli eventi di mouse passano da
   Input.dispatchMouseEvent, cioè dalla stessa porta del mouse vero: un evento
   sintetico mandato sull'elemento salta il rilevamento del bersaglio e passa
   anche quando per l'utente non funziona niente. */
const WS = require('ws');
let ws, id = 0, attesi = new Map();

async function collega() {
  const r = await fetch('http://localhost:9333/json');
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

module.exports = { collega, invia, val, clicca, pausa, ws: () => ws };
