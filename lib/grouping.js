'use strict';
/**
 * grouping — euristiche di raggruppamento dei materiali in lezioni candidate.
 *
 * Serve a due cose:
 *  1. dare al modello dei CANDIDATI da correggere invece del foglio bianco;
 *  2. funzionare da solo quando non c'è una chiave API (degradazione prevista dal piano).
 *
 * Idea di fondo: le lezioni di solito sono blocchi CONTIGUI di materiali numerati che
 * parlano della stessa cosa. Si scorre la sequenza e si taglia dove il discorso cambia.
 * Ogni pezzo del ragionamento è una funzione isolata, così si può tarare una soglia
 * senza rileggere tutto.
 */

// ------------------------------------------------------------------- lessico

const STOP_TITOLO = new Set(('il lo la i gli le un uno una di a da in con su per tra fra del della dei delle dal nel nella e ed o alla al ai agli sulle sul come cosa che non piu meno td edu galton it').split(' '));

/** Minuscolo, senza accenti, senza punteggiatura. */
function normalizza(s) {
  return String(s == null ? '' : s)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Token significativi di un titolo. */
function tokenTitolo(titolo) {
  return normalizza(titolo).split(' ').filter((t) => t.length > 2 && !STOP_TITOLO.has(t));
}

/** Radice grezza: taglia le desinenze italiane più comuni (dislessia/dislessici → dislessi). */
function radice(p) {
  return String(p || '').replace(/(zione|zioni|mento|menti|ismo|ista|isti|iche|ico|ici|ica|ali|ale|are|ari|ivo|ivi|iva|ive|osi|oso|osa|ose|e|i|a|o)$/, '');
}

/** Insieme di radici da una lista di parole. */
function radici(parole) {
  return new Set((parole || []).map(radice).filter((r) => r.length > 3));
}

/**
 * Stoplist calcolata SUL CORPUS: le parole che compaiono nel titolo di quasi
 * tutti i materiali non distinguono niente. Nelle lezioni registrate è tipico
 * («Corso di Formazione Tutor DSA Esperto nell'assistenza allo studio…»):
 * senza toglierle, ogni materiale somiglia a ogni altro.
 */
function stoplistDinamica(materiali, quota) {
  const soglia = Math.max(2, Math.ceil((materiali || []).length * (quota || 0.3)));
  const df = new Map();
  for (const m of materiali || []) {
    for (const r of radici(tokenTitolo(m.titolo))) df.set(r, (df.get(r) || 0) + 1);
  }
  const out = new Set();
  for (const [r, n] of df) if (n >= soglia) out.add(r);
  return out;
}

/** Toglie dai titoli le parole-riempitivo del corpus. Ritorna una copia dei materiali. */
function ripulisciTitoli(materiali, stoplist) {
  return (materiali || []).map((m) => {
    const parole = tokenTitolo(m.titolo).filter((t) => !stoplist.has(radice(t)));
    return Object.assign({}, m, {
      titoloOriginale: m.titolo,
      titolo: parole.length ? parole.join(' ') : m.titolo
    });
  });
}

// ---------------------------------------------------------------- similarità

/** Jaccard fra due insiemi. */
function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let comuni = 0;
  for (const x of a) if (b.has(x)) comuni++;
  return comuni / (a.size + b.size - comuni);
}

/** Profilo lessicale di un materiale: radici del titolo + delle parole chiave. */
function profiloLessicale(m) {
  return {
    titolo: radici(tokenTitolo(m.titolo)),
    chiave: radici((m.paroleChiave || []).slice(0, 10))
  };
}

/** Similarità fra due materiali: il titolo pesa più delle parole chiave. */
function similarita(a, b) {
  const pa = profiloLessicale(a), pb = profiloLessicale(b);
  return 0.65 * jaccard(pa.titolo, pb.titolo) + 0.35 * jaccard(pa.chiave, pb.chiave);
}

/** Similarità di un materiale con un gruppo: il massimo verso i suoi membri. */
function similaritaConGruppo(m, gruppo) {
  return (gruppo.materiali || []).reduce((max, x) => Math.max(max, similarita(m, x)), 0);
}

// ------------------------------------------------------------- accoppiamenti

/** Due materiali sono un dittico PDF+video se hanno lo stesso numero. */
function stessoNumero(a, b) { return !!a.num && a.num === b.num; }

/** Sono consecutivi nella numerazione? */
function consecutivi(a, b) {
  if (!a.num || !b.num) return false;
  return Number(b.num) - Number(a.num) === 1;
}

/** Affinità sulle sole parole chiave del parlato/scritto (ignora i titoli). */
function affinitaLessicale(a, b) {
  return jaccard(radici((a.paroleChiave || []).slice(0, 12)), radici((b.paroleChiave || []).slice(0, 12)));
}

/**
 * Dittico teoria+applicazione: un PDF e un video consecutivi che parlano della
 * stessa cosa, anche se i titoli sono scritti in modo diverso («LA DISORTOGRAFIA
 * caratteristiche cliniche» + «Capire gli errori ortografici»). Si guarda solo
 * il lessico dei contenuti, con soglia più bassa: il tipo diverso è già un indizio.
 */
function dittico(a, b, par) {
  if (!consecutivi(a, b) || a.tipo === b.tipo) return 0;
  const sim = affinitaLessicale(a, b);
  // soglia più bassa di quella tematica, ma con un pavimento assoluto: senza,
  // due materiali qualsiasi di tipo diverso finirebbero appaiati per caso
  const minimo = Math.max(par.soglia * 0.6, 0.12);
  return sim >= minimo ? sim : 0;
}

// ----------------------------------------------------------- taglio a blocchi

/** Parametri per livello di granularità richiesto dall'utente. */
function parametri(granularita) {
  if (granularita === 'ampio') return { soglia: 0.10, max: 8 };
  if (granularita === 'medio') return { soglia: 0.14, max: 5 };
  return { soglia: 0.18, max: 4 };            // atomico (default)
}

/** Un gruppo nuovo, vuoto. */
function nuovoGruppo(m) { return { materiali: [m] }; }

/**
 * Decide se `m` continua il gruppo corrente o ne apre uno nuovo.
 * Restituisce { continua, motivo } — il motivo finisce nel rationale mostrato all'utente.
 */
function decidiTaglio(m, gruppo, par) {
  const ultimo = gruppo.materiali[gruppo.materiali.length - 1];
  if (gruppo.materiali.length >= par.max) return { continua: false, motivo: 'blocco già lungo (' + par.max + ' materiali)' };
  if (stessoNumero(m, ultimo)) return { continua: true, motivo: 'stesso numero: dittico teoria + applicazione' };
  if (!consecutivi(ultimo, m)) return { continua: false, motivo: 'numerazione non contigua' };
  const sim = similaritaConGruppo(m, gruppo);
  if (sim >= par.soglia) return { continua: true, motivo: 'stesso tema (affinità ' + sim.toFixed(2) + ')' };
  // il dittico lega una COPPIA, non allunga un blocco già formato: altrimenti
  // basta una catena di alternanze pdf/video per fondere mezzo corpus
  if (gruppo.materiali.length === 1) {
    const dit = dittico(ultimo, m, par);
    if (dit) return { continua: true, motivo: 'dittico teoria+applicazione (lessico ' + dit.toFixed(2) + ')' };
  }
  return { continua: false, motivo: 'cambio di tema (affinità ' + sim.toFixed(2) + ')' };
}

/** Scorre i materiali ordinati e li taglia in blocchi contigui. */
function blocchi(materiali, granularita) {
  const par = parametri(granularita);
  const out = [];
  let corrente = null;
  for (const m of materiali) {
    if (!corrente) { corrente = nuovoGruppo(m); corrente.motivi = []; continue; }
    const d = decidiTaglio(m, corrente, par);
    if (d.continua) { corrente.materiali.push(m); corrente.motivi.push(d.motivo); }
    else { out.push(corrente); corrente = nuovoGruppo(m); corrente.motivi = [d.motivo]; }
  }
  if (corrente) out.push(corrente);
  return out;
}

// -------------------------------------------------------------- intitolazione

/** Le radici comuni a tutti i materiali del gruppo. */
function radiciComuni(gruppo) {
  const insiemi = gruppo.materiali.map((m) => radici(tokenTitolo(m.titolo)));
  if (!insiemi.length) return [];
  return Array.from(insiemi[0]).filter((r) => insiemi.every((s) => s.has(r)));
}

/** Titolo leggibile per il gruppo: le parole del titolo più lungo che ricorrono in tutti. */
function titoloGruppo(gruppo) {
  const comuni = radiciComuni(gruppo);
  const base = gruppo.materiali
    .slice()
    .sort((a, b) => tokenTitolo(b.titolo).length - tokenTitolo(a.titolo).length)[0];
  const parole = tokenTitolo(base.titolo).filter((t) => comuni.some((r) => t.indexOf(r) === 0));
  const testo = (parole.length ? parole : tokenTitolo(base.titolo).slice(0, 5)).join(' ');
  return (testo.toUpperCase() || 'SENZA TITOLO').slice(0, 110).trim();
}

/** Prefisso numerico del gruppo: "04-06" oppure "18". */
function intervallo(gruppo) {
  const nums = gruppo.materiali.map((m) => m.num).filter(Boolean);
  if (!nums.length) return '';
  const a = nums[0], b = nums[nums.length - 1];
  return a === b ? a : a + '-' + b;
}

/** Spiegazione in una riga del perché quel blocco sta insieme. */
function rationale(gruppo) {
  const n = gruppo.materiali.length;
  if (n === 1) return 'Materiale a sé: nessun vicino con lo stesso tema.';
  const motivi = (gruppo.motivi || []).filter(Boolean);
  const tema = motivi.filter((s) => s.indexOf('stesso tema') === 0).length;
  const dittici = motivi.filter((s) => s.indexOf('stesso numero') === 0).length;
  const parti = [];
  if (tema) parti.push(tema + ' material' + (tema === 1 ? 'e' : 'i') + ' con lo stesso tema');
  if (dittici) parti.push(dittici + ' dittic' + (dittici === 1 ? 'o' : 'i') + ' teoria+applicazione');
  return 'Blocco contiguo ' + intervallo(gruppo) + (parti.length ? ': ' + parti.join(', ') + '.' : '.');
}

// ---------------------------------------------------------------- confezione

/** Slug ASCII per la cartella della lezione. */
function slug(s, max) {
  const t = normalizza(s).replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return (t.slice(0, max || 40).replace(/-+$/, '')) || 'lezione';
}

/** Trasforma un blocco grezzo nella forma-lezione del piano. */
function aLezione(gruppo, ordine) {
  const titolo = titoloGruppo(gruppo);
  const nn = String(ordine).padStart(2, '0');
  return {
    folder: nn + '-' + slug(titolo),
    title: intervallo(gruppo) + ' ' + titolo,
    area: '',
    rationale: rationale(gruppo),
    status: 'proposto',
    materiali: gruppo.materiali.map((m) => ({
      source: m.nome,
      type: m.tipo,
      num: m.num,
      titolo: m.titolo,
      durata: m.durata || 0,
      pagine: m.npagine || 0
    })),
    capitoli: []
  };
}

/** Proposta euristica completa: dal digest alle lezioni candidate. */
function proponi(dg, opzioni) {
  const gran = (opzioni && opzioni.granularita) || 'atomico';
  const grezzi = (dg && dg.materiali) || [];
  const materiali = ripulisciTitoli(grezzi, stoplistDinamica(grezzi, (opzioni && opzioni.quotaStop) || 0.3));
  return blocchi(materiali, gran).map(aLezione);
}

module.exports = {
  normalizza, tokenTitolo, radice, radici, jaccard, stoplistDinamica, ripulisciTitoli,
  profiloLessicale, similarita, similaritaConGruppo,
  stessoNumero, consecutivi, affinitaLessicale, dittico, parametri, decidiTaglio, blocchi,
  radiciComuni, titoloGruppo, intervallo, rationale, slug, aLezione, proponi
};
