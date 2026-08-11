'use strict';
/**
 * Il ritentativo sugli errori passeggeri: una manopola sola, quattro fornitori
 * che contano in modo diverso.
 *
 * Non si prova che «la rete funziona» — non c'è rete qui dentro. Si prova la
 * parte che sbaglia in silenzio: la conversione fra unità di misura (un `3`
 * scritto in due posti dà 3 e 4), il campo che se cambia nome spegne il
 * ritentativo di Gemini senza dirlo, e il giudizio su che cosa sia passeggero.
 *
 *   node test/ritentativi.js
 */

const R = require('../lib/ai/ritentativi');
const anthropic = require('../lib/ai/anthropic');
const openai = require('../lib/ai/openai');
const google = require('../lib/ai/google');
const claudecode = require('../lib/ai/claudecode');
const provider = require('../lib/ai/provider');

let ko = 0, ok = 0;
function check(nome, atteso, avuto) {
  const a = JSON.stringify(atteso), b = JSON.stringify(avuto);
  if (a === b) { ok++; return; }
  ko++;
  console.log('  ✗ ' + nome + '\n      atteso: ' + a + '\n      avuto:  ' + b);
}
function sezione(t) { console.log('\n== ' + t); }

// ------------------------------------------------ 1. la manopola e le unità
sezione('Una manopola sola, e ogni SDK la legge nella SUA unità');

check('i tentativi totali sono quelli dichiarati', R.TENTATIVI, R.tentativi());
check('le ripetizioni sono i tentativi meno la prima chiamata', R.TENTATIVI - 1, R.ripetizioni());

/* ⚠️ Il controllo che conta: le due unità devono descrivere lo STESSO numero di
   chiamate. Anthropic e OpenAI contano le ripetizioni (`maxRetries: 3` = 4
   chiamate); Gemini conta i tentativi (`attempts: 4` = 4 chiamate, perché la sua
   `apiCall` fa `retries: attempts - 1`). Se un giorno qualcuno «uniforma» i due
   campi allo stesso valore, un fornitore ritenterà una volta in meno degli altri
   e non se ne accorgerà nessuno. */
const A = anthropic.opzioniClient({ apiKey: 'k' });
const O = openai.opzioniClient({ apiKey: 'k' });
const G = google.opzioniClient({ apiKey: 'k' });
check('anthropic: chiamate totali', R.TENTATIVI, A.maxRetries + 1);
check('openai: chiamate totali', R.TENTATIVI, O.maxRetries + 1);
check('google: chiamate totali', R.TENTATIVI, G.httpOptions.retryOptions.attempts);
check('e i tre fornitori ritentano lo stesso numero di volte',
  [R.TENTATIVI, R.TENTATIVI], [A.maxRetries + 1, O.maxRetries + 1]);

/* Il ritentativo di Gemini si accende SOLO se esiste `httpOptions.retryOptions`:
   la sua `apiCall` comincia con «se non c'è, `fetch` nudo». Un campo rinominato
   lo spegne senza un errore, e si tornerebbe al fornitore che non ritenta mai —
   cioè all'incidente da cui è nato tutto questo. */
check('google: il ritentativo è acceso, e il campo si chiama come vuole l\'SDK',
  true, !!(G.httpOptions && G.httpOptions.retryOptions && G.httpOptions.retryOptions.attempts > 1));
check('google: e ha un tetto di tempo, che prima non aveva affatto',
  R.TIMEOUT_MS, G.httpOptions.timeout);
check('la chiave arriva al client', ['k', 'k', 'k'], [A.apiKey, O.apiKey, G.apiKey]);

/* ⚠️ E infine la prova che conta più di tutte: che gli SDK quelle opzioni le
   PRENDANO. Un campo con il nome sbagliato non solleva niente — viene ignorato,
   e il ritentativo resta spento senza che nessuno se ne accorga finché non serve.
   Si costruiscono i client veri, con una chiave finta: nessuna rete, nessun
   costo, ma i nomi dei campi li valida l'SDK e non noi. È anche il controllo che
   si accende il giorno in cui un aggiornamento rinomina qualcosa. */
sezione('Gli SDK veri accettano quelle opzioni (chiave finta, nessuna rete)');
{
  const Anthropic = require('@anthropic-ai/sdk');
  const OpenAI = require('openai');
  const { GoogleGenAI } = require('@google/genai');
  const ca = new Anthropic(anthropic.opzioniClient({ apiKey: 'x' }));
  const co = new OpenAI(openai.opzioniClient({ apiKey: 'x' }));
  const cg = new GoogleGenAI(google.opzioniClient({ apiKey: 'x' }));
  check('anthropic: il client ha preso il numero', R.ripetizioni(), ca.maxRetries);
  check('openai: il client ha preso il numero', R.ripetizioni(), co.maxRetries);
  const ho = cg.models && cg.models.apiClient && cg.models.apiClient.clientOptions
    && cg.models.apiClient.clientOptions.httpOptions;
  check('google: le retryOptions sopravvivono alla fusione con i suoi default',
    R.tentativi(), ho && ho.retryOptions && ho.retryOptions.attempts);
  check('google: e il tetto di tempo pure', R.TIMEOUT_MS, ho && ho.timeout);
}

// --------------------------------------- 2. che cosa è passeggero, per il CLI
sezione('Claude Code giudica una stringa, non uno status');

const T = claudecode.transitorio;
check('un sovraccarico si ritenta', true, T('overloaded_error (HTTP 529)'));
check('un limite d\'uso si ritenta', true, T('rate limit exceeded'));
check('un 503 riportato dal CLI si ritenta', true, T('Service Unavailable (HTTP 503)'));
check('il tempo massimo si ritenta', true, T('nessuna risposta entro il tempo massimo'));
check('una connessione caduta si ritenta', true, T('read ECONNRESET'));
check('un socket chiuso a metà si ritenta', true, T('socket hang up'));

check('una chiave sbagliata NON si ritenta', false, T('authentication_error (HTTP 401)'));
check('una richiesta malformata NON si ritenta', false, T('invalid_request_error (HTTP 400)'));
check('una risposta illeggibile NON si ritenta', false, T('risposta non interpretabile'));
check('un\'uscita con codice NON si ritenta', false, T('uscito con codice 1'));

/* ⚠️ Il falso positivo che è costato: `5\d\d` cercava tre cifre OVUNQUE, quindi
   un errore 400 che nominasse `max_tokens: 512` sembrava passeggero e si pagavano
   tre esecuzioni di un errore che non sarebbe mai passato da solo. */
check('un 400 che nomina «512» non diventa passeggero per via del numero',
  false, T('invalid_request_error (HTTP 400): max_tokens: 512 is too large'));
check('né uno che parla di «500 tokens»', false, T('prompt too long: over 500 tokens'));
check('ma un vero 500 resta passeggero', true, T('(HTTP 500) internal server error'));
check('e «disconnected» da solo non basta più', false, T('model disconnected from tool'));

// ------------------------------------------------ 3. l'errore resta leggibile
sezione('Un errore di rete non perde il suo codice per strada');

/* Dopo l'ultimo ritentativo Gemini lancia un errore il cui messaggio NON contiene
   lo status: `throwErrorIfNotOK` non viene mai raggiunto. Se si tiene il solo
   `message`, una cascata di 503 finisce nel registro come un errore senza numero. */
const gemini = Object.assign(new Error('Retryable HTTP Error: Service Unavailable'), { status: 503 });
check('lo status torna davanti al messaggio', 'HTTP 503: Retryable HTTP Error: Service Unavailable',
  provider.motivoDi(gemini));

const anth = Object.assign(new Error('Overloaded'), { status: 529, type: 'overloaded_error' });
check('e con Anthropic si legge anche il tipo', 'HTTP 529 overloaded_error: Overloaded',
  provider.motivoDi(anth));
check('un errore senza status resta quello che era', 'claude: qualcosa è andato storto',
  provider.motivoDi(new Error('claude: qualcosa è andato storto')));
check('e un errore che non è un Error non fa esplodere niente', 'boh', provider.motivoDi('boh'));
check('nemmeno il nulla', 'errore sconosciuto', provider.motivoDi(null));

console.log('\n' + (ko ? '✗ ' + ko + ' controlli falliti' : '✓ tutti i controlli passati') + ' (' + ok + ' ok)');
process.exit(ko ? 1 : 0);
