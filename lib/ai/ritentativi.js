'use strict';
/**
 * ritentativi — quante volte si riprova, detto una volta per tutti i fornitori.
 *
 * ## Perché questo file esiste, e perché NON è un ciclo
 *
 * La domanda di partenza era «aggiungere il ritentativo sugli errori passeggeri
 * a `provider.completa()`, perché ce l'ha solo Claude Code». Misurato, il
 * presupposto era falso per metà: **Anthropic e OpenAI ritentano già dentro il
 * loro SDK** (`maxRetries ?? 2`, cioè 3 tentativi, con `retry-after` rispettato
 * e attese con jitter). Chi non ritentava mai era **Google**, ed è esattamente
 * il fornitore della cascata di 503 che ha ucciso una generazione a metà.
 *
 * Un ciclo dentro `completa()` non avrebbe aggiunto sicurezza: l'avrebbe
 * moltiplicata. Misure prese sul codice, non a occhio:
 *
 *   - un capitolo passa da `lib/genera.js` che fa **due giri** → 3 tentativi
 *     dentro diventano 6 chiamate, che per Anthropic sono **18 richieste HTTP**
 *     fatturate;
 *   - `lib/ai/claudecode.js` ha già un ciclo suo di 3 → 9 processi `claude`, con
 *     600 secondi di tetto ciascuno;
 *   - `lib/genera.js:305` tratta un errore di rete come una risposta invalida e
 *     **brucia uno dei due giri di riparazione**: il capitolo pagato due volte
 *     resterebbe con un solo giro vero;
 *   - `completa()` non ha una callback in firma: durante le attese non ha
 *     **nessun canale** per dire «sto aspettando», e il pulsante «Ferma» viene
 *     letto solo fra un capitolo e l'altro (`main.js:1539`). Minuti di
 *     interfaccia ferma che sembra rotta.
 *
 * Quindi: ogni SDK ritenta per conto suo, che è il posto in cui il ritentativo
 * costa meno (stessa connessione, `retry-after` del server, nessun prompt
 * rispedito da capo). Qui si decide **quante volte**, una volta sola.
 *
 * ## L'unità di misura, che è la trappola
 *
 * ⚠️ La stessa cifra vuol dire cose diverse nei tre SDK. Anthropic e OpenAI
 * contano le **ripetizioni** (`maxRetries: 2` = 3 chiamate); Google conta i
 * **tentativi totali** (`attempts: 5` = 5 chiamate, `retries: attempts - 1`
 * nella sua `apiCall`). Scrivere «3» in due posti dà 3 e 4. Qui il numero
 * pubblico è uno solo — i TENTATIVI, prima chiamata compresa — e la conversione
 * la fa questo file, non chi lo chiama.
 */

/**
 * Tentativi totali, prima chiamata compresa.
 *
 * Quattro e non tre: un tentativo in più di quanto facevano di default Anthropic
 * e OpenAI, perché l'incidente da cui nasce tutto questo è una cascata — un
 * fornitore che risponde 503 per qualche decina di secondi — e la differenza fra
 * tre e quattro tentativi è proprio la coda della cascata. Oltre non si va: le
 * attese crescono in modo esponenziale e il resto dell'app non sa aspettare in
 * silenzio così a lungo (vedi sopra).
 */
const TENTATIVI = 4;

/**
 * Tetto per singolo tentativo, in millisecondi.
 *
 * ⚠️ Serve soprattutto a Google, che oggi non ne ha **nessuno**: una richiesta
 * appesa non fallisce mai, quindi non si arriva nemmeno a ritentare — il caso
 * peggiore non è l'errore, è il silenzio. Anthropic e OpenAI hanno già 10
 * minuti di default per tentativo e si lasciano com'è.
 */
const TIMEOUT_MS = 10 * 60 * 1000;

/** Quante RIPETIZIONI dopo la prima chiamata: Anthropic e OpenAI contano così. */
function ripetizioni() { return Math.max(0, TENTATIVI - 1); }

/** Quanti tentativi TOTALI: Google conta così (`attempts`), e Claude Code pure. */
function tentativi() { return Math.max(1, TENTATIVI); }

module.exports = { TENTATIVI, TIMEOUT_MS, ripetizioni, tentativi };
