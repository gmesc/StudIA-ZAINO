'use strict';
/**
 * Adattatore «Claude Code»: usa il `claude` già installato e già autenticato
 * sulla macchina, invece di una chiave API.
 *
 * A cosa serve: una chiave API si paga a token, e non ha niente a che vedere con
 * l'abbonamento mensile. Claude Code invece usa l'autenticazione con cui hai
 * fatto login — quindi il lavoro pesa sul piano, non sulla carta di credito.
 *
 * Che cosa cambia rispetto agli altri adattatori:
 *  - non c'è un tool forzato che garantisca la struttura: lo schema si chiede
 *    a parole e si verifica dopo. Va bene, perché tutta la pipeline valida già
 *    quello che riceve e chiede una correzione quando non torna;
 *  - ogni chiamata porta con sé il contesto di Claude Code (~37k token, per lo
 *    più riletti dalla cache oraria): non è gratis, ma su abbonamento è consumo
 *    del piano, non spesa;
 *  - il costo che Claude Code dichiara viene registrato lo stesso, così la
 *    dashboard mostra quanto sarebbe costato a listino.
 */

const { spawn } = require('child_process');
const os = require('os');
const fs = require('fs');
const path = require('path');
const R = require('./ritentativi');   // quanti tentativi: deciso una volta per tutti i fornitori

/**
 * Trovare il binario è il punto delicato di tutta questa modalità.
 *
 * Un'app lanciata dal Finder NON eredita il PATH della shell: launchd le passa
 * un PATH minimo (/usr/bin:/bin:/usr/sbin:/sbin). Claude Code invece si installa
 * quasi sempre in ~/.local/bin o in /opt/homebrew/bin, che lì dentro non ci
 * sono. Un semplice spawn('claude') fallirebbe quindi per ogni utente del .dmg
 * pur funzionando perfettamente dal terminale — e sembrerebbe un baco nostro.
 *
 * Si cerca in tre modi, dal più economico al più costoso, e si ricorda l'esito.
 */
const { spawnSync } = require('child_process');

function casaDi() { return os.homedir(); }

/** I posti in cui Claude Code si installa davvero, in ordine di frequenza. */
function candidati() {
  const casa = casaDi();
  return [
    process.env.STUDIA_CLAUDE_BIN,                       // scelta esplicita dell'utente
    path.join(casa, '.local', 'bin', 'claude'),          // installer nativo
    '/opt/homebrew/bin/claude',                          // Homebrew su Apple Silicon
    '/usr/local/bin/claude',                             // Homebrew su Intel, npm -g
    path.join(casa, '.npm-global', 'bin', 'claude'),
    path.join(casa, '.bun', 'bin', 'claude'),
    path.join(casa, '.volta', 'bin', 'claude'),
    '/usr/bin/claude'
  ].filter(Boolean);
}

/** Chiede alla shell di login dove sta: è il modo che funziona con nvm e simili. */
function chiediAllaShell() {
  const shell = process.env.SHELL || '/bin/zsh';
  try {
    const r = spawnSync(shell, ['-lc', 'command -v claude'], { encoding: 'utf-8', timeout: 10000 });
    const p = String((r && r.stdout) || '').trim().split('\n').pop();
    return p && fs.existsSync(p) ? p : null;
  } catch (e) { return null; }
}

let _trovato;                                            // memoria della ricerca
/** Il percorso del binario, o null se non è installato. */
function percorso(riprova) {
  if (_trovato !== undefined && !riprova) return _trovato;
  _trovato = null;
  for (const c of candidati()) {
    try { if (fs.existsSync(c) && (fs.statSync(c).mode & 0o111)) { _trovato = c; break; } } catch (e) {}
  }
  if (!_trovato) _trovato = chiediAllaShell();
  return _trovato;
}

/** Il binario da usare: il percorso trovato, altrimenti il nome nudo. */
const BINARIO = percorso() || 'claude';

/**
 * Diagnosi per le Impostazioni: dove sta, che versione ha, se è autenticato.
 * Restituisce sempre un oggetto, mai un'eccezione.
 */
function diagnosi() {
  const p = percorso(true);
  if (!p) {
    return { ok: false, motivo: 'non-installato',
      spiegazione: 'Claude Code non risulta installato su questo computer.' };
  }
  let versione = '';
  try {
    const r = spawnSync(p, ['--version'], { encoding: 'utf-8', timeout: 10000 });
    if (r.status !== 0) return { ok: false, percorso: p, motivo: 'non-eseguibile', spiegazione: 'Trovato in ' + p + ' ma non risponde.' };
    versione = String(r.stdout || '').trim();
  } catch (e) {
    return { ok: false, percorso: p, motivo: 'non-eseguibile', spiegazione: String(e.message || e) };
  }
  return { ok: true, percorso: p, versione };
}

/** Vero se il `claude` è installato e risponde. */
function disponibile() { return diagnosi().ok; }

/**
 * Una cartella neutra da cui lanciarlo: dentro il vault, Claude Code
 * caricherebbe il CLAUDE.md che trova lì attorno e si porterebbe dietro
 * contesto che non c'entra nulla con la scrittura di un capitolo.
 */
function cartellaNeutra() {
  const d = path.join(os.tmpdir(), 'studia-claudecode');
  try { fs.mkdirSync(d, { recursive: true }); } catch (e) {}
  return d;
}

/** Lo schema chiesto a parole: non c'è un tool che lo imponga. */
function istruzioneSchema(schema) {
  if (!schema) return '';
  return [
    '',
    'Rispondi ESCLUSIVAMENTE con un oggetto JSON conforme a questo schema.',
    'Niente testo prima o dopo, niente blocchi di codice, niente commenti.',
    JSON.stringify(schema)
  ].join('\n');
}

/** Lancia il processo e raccoglie stdout. Non solleva: gli errori tornano nel risultato. */
function esegui(args, testo, timeoutMs) {
  return new Promise((risolvi) => {
    let out = '', err = '', chiuso = false, scaduto = false;
    const bin = percorso() || BINARIO;
    const p = spawn(bin, args, { cwd: cartellaNeutra() });
    const orologio = setTimeout(() => {
      if (!chiuso) { scaduto = true; try { p.kill('SIGTERM'); } catch (e) {} }
    }, timeoutMs || 600000);
    p.stdout.on('data', (d) => { out += d; });
    p.stderr.on('data', (d) => { err += d; });
    p.on('error', (e) => { chiuso = true; clearTimeout(orologio); risolvi({ codice: -1, out, err: String(e.message || e) }); });
    p.on('close', (codice) => { chiuso = true; clearTimeout(orologio); risolvi({ codice, out, err, scaduto }); });
    // se il processo muore mentre gli stiamo scrivendo il prompt, stdin dà EPIPE:
    // ignorarlo va bene (il motivo vero arriva da `close`), ma NON gestirlo
    // affatto farebbe cadere l'intero processo Electron
    p.stdin.on('error', () => {});
    try { p.stdin.write(testo); p.stdin.end(); } catch (e) {}
  });
}

/**
 * Perché è andato storto: Claude Code lo scrive su STDOUT, non su stderr.
 *
 * Con `-p --output-format json` un errore esce come JSON regolare con
 * `is_error: true` e il motivo in `result` — e il processo esce comunque con
 * codice 1. Leggere solo stderr (che di norma è vuoto) lasciava all'utente il
 * solo «uscito con codice 1»: un errore senza informazione, identico per un
 * limite d'uso, un modello sbagliato e un sovraccarico.
 */
function motivoDi(r) {
  if (r.scaduto) return 'nessuna risposta entro il tempo massimo';
  const j = (() => { try { return JSON.parse(r.out); } catch (e) { return null; } })();
  if (j && (j.result || j.api_error_status)) {
    const stato = j.api_error_status ? ' (HTTP ' + j.api_error_status + ')' : '';
    return String(j.result || 'errore riportato dal CLI').trim().split('\n')[0].slice(0, 300) + stato;
  }
  const e = (r.err || '').trim();
  if (e) return e.split('\n').slice(-3).join(' ').slice(0, 300);
  const o = (r.out || '').trim();
  if (o) return o.split('\n').slice(-3).join(' ').slice(0, 300);
  return 'uscito con codice ' + r.codice;
}

/**
 * Errori che passano da soli: ritentarli è meglio che perdere il materiale.
 *
 * ⚠️ Qui si giudica una STRINGA, non uno status: Claude Code è un processo, e
 * quello che torna è la prima riga del suo `result` o le ultime righe di stderr
 * (vedi `motivoDi`). È l'unico adattatore in cui il codice HTTP può non esserci
 * affatto — e per questo la regola deve essere prudente da tutte e due le parti.
 *
 * ⚠️ Il numero va ancorato a un CONTESTO, non cercato nel testo. La versione di
 * prima cercava `5\d\d` ovunque nella stringa, e un errore 400 che nominasse
 * `max_tokens: 512` — o una frase come «over 500 tokens» — risultava passeggero:
 * si pagavano tre esecuzioni di un errore deterministico, che è il modo più caro
 * di sbagliare. Un numero in mezzo a una frase non è uno status: si accetta solo
 * dove un codice sta davvero — il suffisso `(HTTP nnn)` che `motivoDi` appende,
 * un `status`/`code` che lo introduce, o un numero in testa alla riga, che è
 * come si presentano gli errori HTTP grezzi. Le parole restano la via
 * principale, perché sono quelle che il CLI scrive davvero.
 */
function transitorio(motivo) {
  const s = String(motivo || '');
  if (/rate.?limit|overload|sovracc|timeout|tempo massimo|temporan|try again|ECONNRESET|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|socket hang up/i.test(s)) return true;
  const m = /\(HTTP\s+(\d{3})\)/i.exec(s)
    || /\b(?:HTTP|status|code|errore)\D{0,3}(\d{3})\b/i.exec(s)
    || /^\s*(\d{3})\b/.exec(s);
  if (!m) return false;
  const n = parseInt(m[1], 10);
  return n === 408 || n === 409 || n === 429 || (n >= 500 && n <= 599);
}

/** Attesa fra un tentativo e il successivo: 2s, poi 6s, poi 18s. */
function attesa(n) { return new Promise((r) => setTimeout(r, 2000 * Math.pow(3, n))); }

/** Somma i token di una risposta di Claude Code, cache compresa. */
function usoDi(j) {
  const u = (j && j.usage) || {};
  const modello = Object.keys((j && j.modelUsage) || {})[0] || '';
  return {
    modello,
    inputTokens: (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0),
    outputTokens: u.output_tokens || 0,
    // Claude Code dichiara già il costo a listino: si prende quello, invece di
    // ricalcolarlo su un modello che potrebbe non essere fra quelli a listino
    costoUsdDichiarato: typeof j.total_cost_usd === 'number' ? j.total_cost_usd : null
  };
}

/** Un solo tentativo: restituisce { ok, testo, uso } oppure { ok:false, motivo }. */
async function unTentativo(args, o) {
  const r = await esegui(args, o.utente || '', o.timeoutMs);
  if (r.codice !== 0) return { ok: false, motivo: motivoDi(r) };
  let j;
  try { j = JSON.parse(r.out); } catch (e) { return { ok: false, motivo: 'risposta non interpretabile' }; }
  if (j.is_error) return { ok: false, motivo: motivoDi(r) };
  return { ok: true, testo: String(j.result == null ? '' : j.result), uso: usoDi(j) };
}

/**
 * Chiede una risposta, ritentando gli inciampi passeggeri.
 *
 * Le schede si analizzano tre materiali per volta: un limite d'uso o un
 * sovraccarico momentaneo colpiva una porzione a caso e faceva perdere l'intero
 * materiale — le porzioni già pagate comprese. Tre tentativi distanziati
 * costano molto meno di una rilettura da capo.
 */
async function chiedi(o) {
  const args = ['-p', '--output-format', 'json',
    '--strict-mcp-config', '--no-session-persistence'];
  if (o.sistema) args.push('--system-prompt', o.sistema + istruzioneSchema(o.schema));
  else if (o.schema) args.push('--system-prompt', istruzioneSchema(o.schema).trim());
  if (o.modello) args.push('--model', o.modello);

  /* Il numero sta in `lib/ai/ritentativi.js` insieme a quello degli altri tre
     fornitori: è una decisione sola, e finora era scritta qui e nascosta.
     ⚠️ Con tre tentativi le attese usate erano 2s e 6s: i 18s del commento su
     `attesa()` non si raggiungevano mai, perché l'ultimo tentativo non aspetta.
     Con quattro il commento diventa vero. */
  const tentativi = o.tentativi == null ? R.tentativi() : Math.max(1, o.tentativi);
  let ultimo = '';
  for (let n = 0; n < tentativi; n++) {
    const t = await unTentativo(args, o);
    if (t.ok) return { testo: t.testo, uso: t.uso };
    ultimo = t.motivo;
    if (!transitorio(ultimo) || n === tentativi - 1) break;
    await attesa(n);
  }
  throw new Error('claude: ' + ultimo);
}

module.exports = { chiedi, disponibile, diagnosi, percorso, candidati, usoDi, istruzioneSchema,
  cartellaNeutra, motivoDi, transitorio, BINARIO };
