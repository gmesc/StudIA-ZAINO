'use strict';
/**
 * Il registro dei costi: che quello che paghi ci finisca dentro.
 *
 * Il difetto da cui nasce questa suite non era una stima imprecisa: era uno
 * **zero**. `sommaUso` esisteva in due copie che ricostruivano l'oggetto campo
 * per campo, e il campo non elencato era `costoUsdDichiarato` — il costo che
 * Claude Code riporta già a listino. Perso quello, il ripiego cerca il modello
 * nel listino; ma per Claude Code il modello è `''` per costruzione, quindi non
 * c'è prezzo e il registro scriveva zero. Ogni capitolo e ogni scheda scritti
 * con Claude Code risultavano gratis.
 *
 *   node test/costi.js
 */

const provider = require('../lib/ai/provider');
const genera = require('../lib/genera');
const schede = require('../lib/schede');

let ko = 0, ok = 0;
function check(nome, atteso, avuto) {
  const a = JSON.stringify(atteso), b = JSON.stringify(avuto);
  if (a === b) { ok++; return; }
  ko++;
  console.log('  ✗ ' + nome + '\n      atteso: ' + a + '\n      avuto:  ' + b);
}
function sezione(t) { console.log('\n== ' + t); }

/* I costi sono numeri in virgola mobile: `0.1 + 0.2` non fa `0.3`. Si confronta
   al milionesimo di dollaro, che è già mille volte più fine di quanto un
   registro di spesa possa significare. */
function usd(x) { return Math.round(x * 1e6) / 1e6; }

/** Quello che `registraUso` scrive nel registro, senza toccare il disco. */
function costoRegistrato(uso) {
  return (typeof uso.costoUsdDichiarato === 'number' ? uso.costoUsdDichiarato : provider.costoUsd(uso)) || 0;
}

const CC = (n, costo) => ({ fornitore: 'claudecode', modello: '', inputTokens: n, outputTokens: n / 10, costoUsdDichiarato: costo });
const API = (n) => ({ fornitore: 'anthropic', modello: 'claude-opus-5', inputTokens: n, outputTokens: n / 10 });

sezione('Il costo dichiarato sopravvive alla somma');

check('due chiamate di Claude Code sommano i loro costi dichiarati', 0.2,
  provider.sommaUso([CC(100, 0.12), CC(50, 0.08)]).costoUsdDichiarato);
check('e i token si sommano come sempre', [150, 15],
  [provider.sommaUso([CC(100, 0.12), CC(50, 0.08)]).inputTokens,
   provider.sommaUso([CC(100, 0.12), CC(50, 0.08)]).outputTokens]);

/* ⚠️ Il controllo che conta: il numero che finisce nel registro. Prima di questa
   riparazione era 0 — non per un errore di calcolo, ma perché il costo veniva
   buttato via prima di arrivare qui. */
check('nel registro finisce il costo vero, non zero', 0.2,
  costoRegistrato(provider.sommaUso([CC(100, 0.12), CC(50, 0.08)])));

check('un capitolo: due giri sommati mantengono il costo', 0.3,
  usd(costoRegistrato(genera.sommaUso(CC(100, 0.1), CC(200, 0.2)))));
check('un materiale: N porzioni più la fusione, idem', 0.6,
  usd(costoRegistrato(schede.sommaUso([CC(10, 0.1), CC(10, 0.2), CC(10, 0.3)]))));

sezione('Chi non dichiara niente non si inventa uno zero');

/* Il campo deve restare ASSENTE, non valere 0: è la differenza fra «costa zero»
   e «il costo lo calcola il listino». Se comparisse come 0, vincerebbe sul
   calcolo e nasconderebbe il prezzo di ogni chiamata via API. */
check('senza dichiarazioni il campo non c\'è', undefined,
  provider.sommaUso([API(1000), API(2000)]).costoUsdDichiarato);
check('e il costo lo fa il listino', ((3000 * 5) + (300 * 25)) / 1e6,
  costoRegistrato(provider.sommaUso([API(1000), API(2000)])));

/* La ragione per cui lo zero usciva proprio con Claude Code, scritta come
   controllo: il suo modello è vuoto per scelta, e un modello vuoto non è a
   listino. Il ripiego non poteva funzionare. */
check('un modello vuoto non ha prezzo di listino', null, provider.costoUsd({ modello: '', inputTokens: 999 }));
check('quindi senza il dichiarato il registro direbbe zero', 0, costoRegistrato(CC(100, null)));

sezione('Le altre proprietà della somma non sono cambiate');

check('le chiamate si contano', 3, provider.sommaUso([API(1), API(1), API(1)]).chiamate);
check('un uso già sommato non riparte da uno', 5,
  provider.sommaUso([{ chiamate: 2 }, { chiamate: 3 }]).chiamate);
check('fornitore e modello restano', ['anthropic', 'claude-opus-5'],
  [provider.sommaUso([API(1)]).fornitore, provider.sommaUso([API(1)]).modello]);
check('i nulli non fanno danno', 1, provider.sommaUso([null, API(1), undefined]).chiamate);
check('una lista vuota non è un uso', null, provider.sommaUso([]));
check('ma per le schede resta un oggetto da cui partire a sommare',
  { inputTokens: 0, outputTokens: 0, chiamate: 0 }, schede.sommaUso([]));
check('e `genera.sommaUso` tollera ancora i nulli', 100,
  genera.sommaUso(null, API(100)).inputTokens);

console.log('\n' + (ko ? '✗ ' + ko + ' controlli falliti' : '✓ tutti i controlli passati') + ' (' + ok + ' ok)');
process.exit(ko ? 1 : 0);
