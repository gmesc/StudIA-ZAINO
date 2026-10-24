'use strict';
/**
 * ripasso — lo stato di apprendimento, su disco.
 *
 * ⚠️ PERCHÉ ESISTE. Fino a oggi il lavoro sull'apprendimento durava una sera:
 * il punteggio di un quiz produceva uno stato per capitolo
 * (`appreso`/`ripassare`/`studiare`) che viveva in `state.learn`, **in memoria**,
 * azzerato a ogni `loadLesson`. Chiudere l'app, o anche solo cambiare lezione,
 * cancellava tutto. Il dato più costoso di un sistema di ripasso — la storia di
 * che cosa hai già risposto, e quando — non veniva scritto da nessuna parte.
 *
 * Qui c'è la prima pietra (P3.1 di PIANO-BRAYNR): `RIPASSO/stato.json` dentro il
 * contenitore, accanto ad `APPUNTI/` e `MAPPE/`. Cartella dell'UTENTE: la
 * pipeline non la tocca, e un corso rigenerato non porta via niente.
 *
 * ⚠️ L'IDENTITÀ DI UNA CARTA È IL SUO CONTENUTO, non la sua posizione:
 * `hash(capitolo + testo normalizzato della domanda)`. Se una rigenerazione
 * riscrive quella domanda, la carta è NUOVA e riparte da zero — ed è giusto,
 * perché la domanda non è più quella a cui avevi risposto. Lo stato rimasto
 * senza carta si pota **dicendolo** (`pota()` restituisce che cosa ha tolto):
 * si è persa una storia, e nasconderlo sarebbe peggio che perderla.
 *
 * Gli intervalli fra un ripasso e l'altro (P3.3) sono `prossimoIntervallo()`:
 * SM-2 semplificato, **puro**, e — la scelta che conta — **ricalcolato ogni
 * volta dalla storia**, non conservato sul disco. Vedi il suo commento.
 *
 *   node test/ripasso.js
 */

const fs = require('./permessi-disco').fs;
const path = require('path');
const crypto = require('crypto');
const corsiLib = require('./corsi');       // cartella(): risolve `Corsi/` e `Zaini/`
const appunti = require('./appunti');      // writeAtomic: la scrittura che non lascia file a metà

const CARTELLA = 'RIPASSO';
const FILE = 'stato.json';
const FORMATO = 1;

function str(v) { return typeof v === 'string' ? v : (v == null ? '' : String(v)); }

function dir(vault, corso) { return path.join(corsiLib.cartella(vault, corso), CARTELLA); }
function percorso(vault, corso) { return path.join(dir(vault, corso), FILE); }

/**
 * Il testo di una domanda, ridotto a ciò che la rende quella domanda.
 *
 * ⚠️ Spazi e maiuscole non contano: una rigenerazione che cambia
 * «Vero o falso?» in «Vero o falso ?» non deve azzerare la storia di chi quella
 * domanda l'ha già ripassata sei volte. Contano le PAROLE.
 */
function normalizza(testo) {
  return str(testo).toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * L'identità di una carta: capitolo + domanda.
 *
 * ⚠️ Il capitolo entra nell'identità perché la stessa domanda può comparire in
 * due capitoli diversi — «vero o falso: la dislessia è un disturbo della
 * comprensione?» sta bene in due lezioni — e sono due carte, con due storie.
 */
function identita(capitolo, domanda) {
  const semi = [str(capitolo), normalizza(domanda)].join('\0');
  return crypto.createHash('sha1').update(semi).digest('hex').slice(0, 12);
}

/* ===== Gli intervalli (P3.3) =============================================
 * L'algoritmo — SM-2 semplificato, e il perché di ogni sua scelta — sta in
 * `App/assets/ripasso/intervalli.js`: puro, senza `fs` né `crypto`, quindi lo
 * carica anche il RENDERER, che deve scrivere i tempi previsti sopra i quattro
 * bottoni. ⚠️ Un file solo: se la formula stesse qui e una sua copia di là, il
 * bottone prometterebbe un tempo e il disco ne registrerebbe un altro — e non
 * lo scoprirebbe nessuno, perché nessuno confronta le due cose.
 *
 * Qui si ri-esporta senza avvolgere: chi ha `lib/ripasso` non deve sapere che
 * il calcolo abita altrove, ma nemmeno passare da un secondo strato di funzioni
 * che un giorno aggiunge una sfumatura sua. */
const IV = require(path.join(__dirname, '..', 'App', 'assets', 'ripasso', 'intervalli.js'));
/** ⚠️ I quattro esiti li dichiara il modulo, non questo file: sono l'ordine dei
 *  bottoni E il vocabolario di ciò che si scrive su disco. Due elenchi paralleli
 *  reggono finché qualcuno non ne ritocca uno. */
const ESITI = IV.ESITI;
const prossimoIntervallo = IV.prossimoIntervallo;
const prossimaData = IV.prossimaData;
const anteprima = IV.anteprima;
const formattaIntervallo = IV.formattaIntervallo;
const dovuta = IV.dovuta;
const coda = IV.coda;


/** Una voce sana, comunque sia scritta sul disco. Ciò che non si capisce si
 *  scarta: uno stato di ripasso storto vale meno di nessuno stato. */
function normalizzaVoce(v) {
  if (!v || typeof v !== 'object') return null;
  const id = str(v.id).trim();
  if (!id) return null;
  const storia = (Array.isArray(v.storia) ? v.storia : [])
    .map((p) => ({ quando: str(p && p.quando), esito: ESITI.indexOf(str(p && p.esito)) >= 0 ? str(p.esito) : '' }))
    .filter((p) => p.quando && p.esito);
  return {
    id: id,
    capitolo: str(v.capitolo),
    visto: str(v.visto),
    esito: ESITI.indexOf(str(v.esito)) >= 0 ? str(v.esito) : '',
    prossimo: str(v.prossimo),      // P3.3: quando rivederla. Vuoto = «non lo sappiamo ancora».
    storia: storia
  };
}

/**
 * Lo stato di ripasso di un contenitore: `{ carte: {id: voce}, error }`.
 *
 * Un file che non c'è è uno stato vuoto senza errore — è la condizione normale
 * di un corso su cui non si è ancora ripassato. Un file illeggibile o storto è
 * un errore DICHIARATO: chi chiama non deve confondere «non hai ancora
 * ripassato» con «la tua storia non si è potuta leggere».
 */
function leggi(vault, corso) {
  let grezzo;
  try { grezzo = fs.readFileSync(percorso(vault, corso), 'utf-8'); }
  catch (e) { return { carte: {}, error: e.code === 'ENOENT' ? '' : (e.message || 'lettura fallita') }; }
  let dati;
  try { dati = JSON.parse(grezzo); }
  catch (e) { return { carte: {}, error: 'il file non è JSON valido' }; }
  const lista = Array.isArray(dati) ? dati : (dati && Array.isArray(dati.carte) ? dati.carte : []);
  const carte = {};
  for (const v of lista) {
    const n = normalizzaVoce(v);
    if (n) carte[n.id] = n;          // l'ultima vince: un doppione è un errore di scrittura, non due storie
  }
  return { carte: carte, error: '' };
}

/** Scrive lo stato. Ordinato per id, perché un file che cambia ordine a ogni
 *  salvataggio è un file che nessuno può leggere in un `diff`. */
function salva(vault, corso, carte) {
  const lista = Object.keys(carte || {}).sort().map((k) => normalizzaVoce(carte[k])).filter(Boolean);
  const d = dir(vault, corso);
  try {
    fs.mkdirSync(d, { recursive: true });
    appunti.writeAtomic(path.join(d, FILE), JSON.stringify({ formato: FORMATO, carte: lista }, null, 1) + '\n');
  } catch (e) { return { error: e.message || 'scrittura fallita' }; }
  return { error: '', quante: lista.length };
}

/**
 * Registra una risposta. Torna lo stato NUOVO, senza toccare quello vecchio:
 * chi chiama decide se salvarlo, e una funzione che modifica in silenzio
 * l'oggetto che riceve è il modo in cui due parti dell'app si scoprono
 * disallineate.
 *
 * ⚠️ La storia si accumula ma non all'infinito: le ultime venti risposte bastano
 * a qualunque algoritmo di intervalli, e un file che cresce senza limite per un
 * dato che nessuno rilegge è un file che un giorno rallenta l'avvio.
 */
function registra(carte, id, esito, opt) {
  const o = opt || {};
  const quando = str(o.quando) || new Date().toISOString();
  const e = ESITI.indexOf(str(esito)) >= 0 ? str(esito) : '';
  if (!id || !e) return carte || {};
  const prima = (carte || {})[id] || { id: id, capitolo: str(o.capitolo), storia: [] };
  const voce = normalizzaVoce({
    id: id,
    capitolo: str(o.capitolo) || prima.capitolo,
    visto: quando,
    esito: e,
    /* ⚠️ `prossimo` lo calcola QUI l'algoritmo, sulla storia di PRIMA di questa
       risposta (che è appunto ciò su cui SM-2 decide). Chi chiama può imporlo —
       serve alle prove e a un eventuale «rivedi fuori scheduling» — ma non è più
       tenuto a saperlo: un campo che ogni chiamante deve ricordarsi di riempire
       è un campo che prima o poi resta vuoto. */
    prossimo: str(o.prossimo) || prossimaData(prima.storia || [], e, quando),
    storia: (prima.storia || []).concat([{ quando: quando, esito: e }]).slice(-20)
  });
  const out = Object.assign({}, carte);
  out[id] = voce;
  return out;
}

/**
 * Toglie lo stato delle carte che non esistono più, e DICE quali.
 *
 * ⚠️ Il patto è quello di `percorsi.invalida()`: quando una rigenerazione fa
 * sparire una domanda, la storia di quella carta è persa davvero — non si può
 * riattaccare a una domanda diversa senza mentire. La si toglie, e chi chiama
 * lo mostra («N carte non esistono più»). Perdere in silenzio è l'unica cosa
 * peggiore di perdere.
 */
function pota(carte, idsVivi) {
  const vivi = {};
  (idsVivi || []).forEach((i) => { vivi[str(i)] = true; });
  const restano = {}, tolte = [];
  Object.keys(carte || {}).forEach((k) => {
    if (vivi[k]) restano[k] = carte[k]; else tolte.push(carte[k]);
  });
  return { carte: restano, tolte: tolte };
}

/**
 * Lo stato di un CAPITOLO, derivato dalle sue carte.
 *
 * ⚠️ Le stesse tre etichette e le stesse soglie di prima (81 / 61), perché la
 * segnaletica su indice e barra di avanzamento non deve cambiare significato
 * sotto gli occhi di chi la conosce: cambia solo da DOVE viene il dato — dal
 * disco invece che dalla memoria di questa sessione (trappola ③).
 *
 * `null` quando non si è ancora risposto a niente: è «non lo so», ed è diverso
 * da «da studiare». Un capitolo mai aperto non deve accendersi di rosso.
 */
function statoCapitolo(carteDelCapitolo) {
  const l = (carteDelCapitolo || []).filter((c) => c && c.esito);
  if (!l.length) return null;
  const punti = { 'di-nuovo': 0, difficile: 40, buono: 85, facile: 100 };
  const media = l.reduce((s, c) => s + (punti[c.esito] || 0), 0) / l.length;
  return media >= 81 ? 'appreso' : media >= 61 ? 'ripassare' : 'studiare';
}

/** Le carte di un capitolo, dallo stato letto. */
function delCapitolo(carte, capitolo) {
  const c = str(capitolo);
  return Object.keys(carte || {}).map((k) => carte[k]).filter((v) => v && v.capitolo === c);
}

module.exports = {
  CARTELLA, FILE, FORMATO, ESITI, GRADINI: IV.GRADINI, MINUTO: IV.MINUTO, ORA: IV.ORA, GIORNO: IV.GIORNO,
  dir, percorso, normalizza, identita, normalizzaVoce,
  leggi, salva, registra, pota, statoCapitolo, delCapitolo,
  prossimoIntervallo, prossimaData, anteprima, formattaIntervallo, dovuta, coda
};
