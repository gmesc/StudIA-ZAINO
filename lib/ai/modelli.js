'use strict';
/**
 * modelli — chiede a ogni fornitore quali modelli esistono DAVVERO oggi.
 *
 * Gli elenchi scritti a mano nelle Impostazioni invecchiano in fretta: un modello
 * viene ritirato e l'app continua a proporlo, uno nuovo esce e non compare. Qui
 * si interroga l'API con la chiave dell'utente e si tiene solo ciò che serve a
 * StudIA — che ha bisogno di poche cose molto precise: contesto lungo (i
 * materiali sono grandi), risposte strutturate, buon italiano.
 *
 * Sui prezzi si è onesti: si mostrano solo quelli che l'app conosce davvero.
 * Un listino inventato è peggio di un listino assente.
 */

const provider = require('./provider');

/** Modelli che non servono a questa app, per quanto validi: si escludono per nome. */
const FUORI_COMPITO = /(embed|whisper|tts|audio|realtime|image|vision-only|dall-e|moderation|rerank|guard|imagen|veo|aqa)/i;

/** Contesto sotto il quale un modello non regge un materiale di studio intero. */
const CONTESTO_MINIMO = 100000;

// ------------------------------------------------------------------ Anthropic

async function elencaAnthropic(apiKey) {
  const Anthropic = require('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey });
  const fuori = [];
  for await (const m of client.models.list()) {
    const cap = m.capabilities || {};
    fuori.push({
      id: m.id,
      nome: m.display_name || m.id,
      contesto: m.max_input_tokens || 0,
      maxOutput: m.max_tokens || 0,
      strutturato: !!(cap.structured_outputs && cap.structured_outputs.supported)
    });
  }
  return fuori;
}

// --------------------------------------------------------------------- OpenAI

async function elencaOpenai(apiKey) {
  const OpenAI = require('openai');
  const client = new OpenAI({ apiKey });
  const r = await client.models.list();
  const dati = (r && r.data) || [];
  return dati.map((m) => ({ id: m.id, nome: m.id, contesto: 0, maxOutput: 0, strutturato: true }));
}

// --------------------------------------------------------------------- Google

async function elencaGoogle(apiKey) {
  const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models?key=' + encodeURIComponent(apiKey));
  if (!r.ok) throw new Error('Google ha risposto ' + r.status);
  const j = await r.json();
  return ((j && j.models) || [])
    .filter((m) => (m.supportedGenerationMethods || []).indexOf('generateContent') >= 0)
    .map((m) => ({
      id: String(m.name || '').replace(/^models\//, ''),
      nome: m.displayName || m.name,
      contesto: m.inputTokenLimit || 0,
      maxOutput: m.outputTokenLimit || 0,
      strutturato: true,
      nota: m.description || ''
    }));
}

// ---------------------------------------------------------------- Claude Code

/**
 * Claude Code non ha un endpoint da interrogare: sceglie il modello per alias.
 * Si restituisce quindi ciò che accetta davvero sulla riga di comando.
 */
function elencaClaudeCode() {
  return [
    { id: '', nome: 'quello configurato in Claude Code', contesto: 0, maxOutput: 0, strutturato: true,
      nota: 'Usa il modello con cui Claude Code è già impostato.' },
    { id: 'opus', nome: 'Opus — qualità massima', contesto: 0, maxOutput: 0, strutturato: true },
    { id: 'sonnet', nome: 'Sonnet — equilibrato', contesto: 0, maxOutput: 0, strutturato: true }
  ];
}

// ------------------------------------------------------------------ giudizio

/**
 * Se un modello è adatto ai compiti di StudIA, e in una riga perché no.
 * Il giudizio è dichiarato, non nascosto: l'utente resta libero di scegliere.
 */
function giudizio(m) {
  if (FUORI_COMPITO.test(m.id)) return { adatto: false, perche: 'serve ad altro (non genera testo strutturato)' };
  if (m.contesto && m.contesto < CONTESTO_MINIMO) {
    return { adatto: false, perche: 'contesto troppo corto (' + Math.round(m.contesto / 1000) + 'k) per un materiale intero' };
  }
  if (!m.strutturato) return { adatto: false, perche: 'non garantisce risposte strutturate' };
  return { adatto: true, perche: '' };
}

/** Descrizione breve e onesta: misure vere, prezzo solo se lo conosciamo. */
function descrizione(m) {
  const pezzi = [];
  if (m.contesto) pezzi.push(Math.round(m.contesto / 1000) + 'k di contesto');
  if (m.maxOutput) pezzi.push('fino a ' + Math.round(m.maxOutput / 1000) + 'k in uscita');
  const p = provider.PREZZI[m.id];
  pezzi.push(p ? ('$' + p[0] + ' / $' + p[1] + ' per milione di token') : 'prezzo non noto all\'app');
  return pezzi.join(' · ');
}

/** Costo indicativo di un capitolo, con la misura empirica della pipeline. */
function costoCapitolo(id) {
  return provider.stimaCosto({ modello: id, input: 9000, output: 1600 });
}

// -------------------------------------------------------------------- elenca

const ELENCHI = {
  anthropic: elencaAnthropic,
  openai: elencaOpenai,
  google: elencaGoogle,
  claudecode: async () => elencaClaudeCode()
};

/**
 * I modelli di un fornitore, normalizzati e giudicati.
 * Non solleva mai: gli errori tornano nel risultato.
 */
async function elenca(fornitore, apiKey) {
  const fn = ELENCHI[fornitore];
  if (!fn) return { errore: 'fornitore sconosciuto: ' + fornitore, modelli: [] };
  if (!apiKey && fornitore !== 'claudecode') return { errore: 'serve la chiave API di ' + fornitore, modelli: [] };
  let grezzi;
  try { grezzi = await fn(apiKey); }
  catch (e) { return { errore: String((e && e.message) || e), modelli: [] }; }

  const modelli = grezzi.map((m) => {
    const g = giudizio(m);
    const p = provider.PREZZI[m.id];
    return {
      id: m.id, nome: m.nome,
      contesto: m.contesto || 0, maxOutput: m.maxOutput || 0,
      prezzoIn: p ? p[0] : null, prezzoOut: p ? p[1] : null,
      costoCapitolo: costoCapitolo(m.id),
      adatto: g.adatto, perche: g.perche,
      descrizione: descrizione(m),
      nota: m.nota || ''
    };
  });
  // prima gli adatti, poi per contesto decrescente: chi sceglie vede subito i buoni
  modelli.sort((a, b) => (Number(b.adatto) - Number(a.adatto)) || (b.contesto - a.contesto) || a.id.localeCompare(b.id));
  return { modelli, aggiornato: new Date().toISOString() };
}

module.exports = { elenca, giudizio, descrizione, costoCapitolo, FUORI_COMPITO, CONTESTO_MINIMO, ELENCHI };
