'use strict';
/**
 * scaletta — da un corso approvato alle ALTERNATIVE di indice dei capitoli.
 *
 * Lo stesso materiale si può insegnare in modi diversi, tutti legittimi: in
 * sequenza, partendo dalle domande, partendo dai casi. La macchina non sa quale
 * sia il modo giusto per chi studia, e fingere che lo sappia sarebbe una bugia:
 * quindi ne propone due o tre e dichiara in una frase che cosa cambia davvero
 * per chi le userà.
 *
 * Due regole reggono tutto:
 *  - le alternative cambiano ORDINE e RAGGRUPPAMENTO, mai la copertura: ogni
 *    materiale del corso finisce in ognuna di esse;
 *  - le preferenze di forma dell'utente valgono per TUTTE: non sono una delle
 *    variabili in gioco, sono il vincolo comune.
 */

const schede = require('./schede');
const provider = require('./ai/provider');

function chiamaDefault(opts) { return provider.completa(opts); }

/** Quante alternative chiedere: due sono poche per scegliere, quattro sono troppe da leggere. */
const N_ALTERNATIVE = 3;

const PRINCIPI = [
  'sequenza didattica: si procede come il materiale è stato pensato, dai fondamenti alle applicazioni',
  'per domande: ogni capitolo risponde a una domanda che chi studia si pone davvero',
  'per casi e situazioni: si parte da un caso concreto e si risale alla teoria che serve',
  'per grana fine: molti capitoli brevi e autonomi invece di pochi blocchi lunghi',
  'per blocchi tematici: unità ampie che tengono insieme un tema per intero'
];

const SISTEMA = [
  'Sei il progettista di un corso di studio. Ricevi le schede dei materiali assegnati a UN corso',
  'e proponi ' + N_ALTERNATIVE + ' SCALETTE ALTERNATIVE dei suoi capitoli.',
  '',
  'Regole non negoziabili:',
  '- ogni alternativa copre TUTTO il materiale del corso: cambiano ordine e raggruppamento, mai la copertura;',
  '- le alternative differiscono per PRINCIPIO ORGANIZZATIVO, non per dettagli di titolo:',
  '  due scalette con gli stessi capitoli in ordine quasi uguale sono un fallimento;',
  '- scegli un principio diverso per ciascuna, fra questi o altri che ti sembrino migliori:',
  PRINCIPI.map((p) => '    · ' + p).join('\n'),
  '- «differenza» dice in UNA frase che cosa cambia PER CHI STUDIA, non che cosa cambia nell\'elenco:',
  '  «arrivi prima alla pratica ma vedi la teoria a pezzi» è utile, «i capitoli sono in ordine diverso» no;',
  '- le preferenze di forma dell\'utente (lunghezza, grana, prevedibilità) valgono per TUTTE le alternative:',
  '  non usarle come variabile per differenziarle;',
  '- ogni capitolo dichiara da quale materiale viene e con quale intervallo:',
  '  per i video «da»/«a» sono SECONDI, per i PDF sono NUMERI DI PAGINA, per le pagine web sono',
  '  numeri d\'ordine dei blocchi di testo. Se un capitolo usa un materiale per intero, ometti da/a;',
  '- non inventare materiali: usa solo i numeri che trovi nelle schede.'
].join('\n');

/** Schema della risposta. */
function schemaAlternative() {
  return {
    type: 'object',
    properties: {
      alternative: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            nome: { type: 'string' },
            principio: { type: 'string' },
            differenza: { type: 'string' },
            adattaA: { type: 'string' },
            capitoli: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  titolo: { type: 'string' },
                  sintesi: { type: 'string' },
                  fonti: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        /* Il NUMERO, non il nome. Il campo si chiamava «materiale»
                           e basta, e il modello ci metteva il titolo della lezione:
                           la cosa più ragionevole, vista la richiesta. Poi il
                           confronto col numero falliva e la scaletta veniva
                           buttata intera. La regola c'era nel prompt in prosa,
                           ma è lo schema quello che il modello guarda davvero. */
                        materiale: { type: 'string',
                          description: 'Il NUMERO del materiale come compare fra parentesi quadre nelle schede, per esempio "34". Non il titolo, non il nome del file.' },
                        da: { type: 'integer', description: 'Secondo di inizio nel video, o pagina iniziale del PDF.' },
                        a: { type: 'integer', description: 'Secondo di fine, o pagina finale.' }
                      },
                      required: ['materiale']
                    }
                  }
                },
                required: ['titolo', 'fonti']
              }
            }
          },
          required: ['nome', 'differenza', 'capitoli']
        }
      }
    },
    required: ['alternative']
  };
}

// ------------------------------------------------------------------ contesto

/** I numeri dei materiali di un corso, come stringhe a due cifre. */
function materialiDi(corso) {
  return (corso.materiali || []).map((m) => String(m.num || m.source || m).trim()).filter(Boolean);
}

/** Le schede dei soli materiali di questo corso. */
function schedeDelCorso(corso, schedeMappa) {
  const numeri = new Set(materialiDi(corso));
  const fuori = {};
  for (const [num, sch] of Object.entries(schedeMappa || {})) if (numeri.has(num)) fuori[num] = sch;
  return fuori;
}

/**
 * Il vincolo sul numero dei capitoli, se l'utente ne ha chiesto uno.
 *
 * Lasciato al modello, il numero oscilla fra 2 e 8 sullo stesso corso, e
 * confrontare le alternative diventa un confronto fra lunghezze invece che fra
 * principi organizzativi. Quando il numero è dichiarato vale per TUTTE le
 * scalette: è un vincolo comune, non una delle variabili in gioco — altrimenti
 * il modello lo userebbe proprio per differenziarle, che è il contrario.
 */
function vincoloCapitoli(n) {
  const q = Number(n);
  if (!q || q < 2) return '';
  return [
    '## Numero dei capitoli',
    'Ogni scaletta deve avere ' + q + ' capitoli, al massimo uno in più o uno in meno.',
    'È una richiesta esplicita di chi studia, e vale per TUTTE le alternative allo stesso modo:',
    'non differenziarle per lunghezza. La copertura del materiale resta intera: se ' + q + ' capitoli',
    'sono pochi per il materiale del corso, accorpa i temi vicini invece di lasciarne fuori qualcuno.'
  ].join('\n');
}

/** Il messaggio utente: schede del corso + vincoli di forma + brief. */
function messaggio(corso, schedeMappa, regoleForma, brief, nCapitoli) {
  return [
    '## Corso «' + (corso.title || corso.folder) + '»',
    corso.rationale ? 'Perché questi materiali stanno insieme: ' + corso.rationale : '',
    '',
    '## Schede dei materiali del corso',
    schede.testoPerPrompt(schedeDelCorso(corso, schedeMappa)),
    '',
    regoleForma || '',
    brief ? '\n## Brief del progetto\n' + brief : '',
    vincoloCapitoli(nCapitoli),
    '',
    'Proponi ' + N_ALTERNATIVE + ' scalette alternative. Rispondi solo con la struttura richiesta.'
  ].filter((r) => r !== '').join('\n');
}

// -------------------------------------------------------------- normalizza

/**
 * Difende la copertura, come fa la proposta dell'indice: i materiali inventati
 * si scartano, quelli dimenticati si segnalano. Meglio un'alternativa dichiarata
 * incompleta che una che sembra completa e non lo è.
 */
/** Riduce un nome a confronto: minuscolo, senza estensione, solo lettere e cifre. */
function impronta(s) {
  return String(s || '').replace(/\.[a-z0-9]+$/i, '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

/**
 * Il numero del materiale a cui una fonte si riferisce, o '' se non lo si trova.
 *
 * Il modello dovrebbe rispondere «34», e ora lo schema glielo dice. Ma se
 * risponde col titolo — «Lesson 4: A closer look at Delegation…» — la scaletta
 * è comunque buona: sbaglia la forma del riferimento, non il merito. Prima quel
 * riferimento veniva scartato, e con esso il capitolo e l'intera alternativa:
 * l'utente vedeva «il modello non ha prodotto scalette utilizzabili» su una
 * risposta perfettamente sensata.
 *
 * Il confronto passa dall'impronta, perché fra i due testi cambiano estensione,
 * numero iniziale e punteggiatura (i titoli di YouTube usano «：» e «｜» a
 * larghezza piena, che nel testo del modello tornano ASCII).
 */
function numeroDiFonte(valore, corso) {
  const grezzo = String(valore == null ? '' : valore).trim();
  const validi = new Set(materialiDi(corso));
  if (/^\d{1,3}$/.test(grezzo)) {
    const n = grezzo.padStart(2, '0');
    return validi.has(n) ? n : '';
  }
  const imp = impronta(grezzo);
  if (!imp) return '';
  for (const m of (corso.materiali || [])) {
    const num = String(m.num || '').trim();
    if (!num || !validi.has(num)) continue;
    for (const testo of [m.source, m.titolo]) {
      const alt = impronta(String(testo || '').replace(/^\d{1,3}\s*/, ''));
      if (alt && (alt === imp || alt.indexOf(imp) >= 0 || imp.indexOf(alt) >= 0)) return num;
    }
  }
  return '';
}

function normalizza(alt, corso) {
  const validi = new Set(materialiDi(corso));
  const visti = new Set();
  const capitoli = (alt.capitoli || []).map((c) => {
    const fonti = (c.fonti || [])
      .map((f) => ({ materiale: numeroDiFonte(f.materiale, corso), da: f.da, a: f.a }))
      .filter((f) => validi.has(f.materiale));
    fonti.forEach((f) => visti.add(f.materiale));
    return { titolo: String(c.titolo || '').trim(), sintesi: String(c.sintesi || '').trim(), fonti };
  }).filter((c) => c.titolo && c.fonti.length);
  const mancanti = Array.from(validi).filter((n) => !visti.has(n)).sort();
  return {
    nome: String(alt.nome || '').trim() || 'Alternativa',
    principio: String(alt.principio || '').trim(),
    differenza: String(alt.differenza || '').trim(),
    adattaA: String(alt.adattaA || '').trim(),
    capitoli, mancanti,
    completa: mancanti.length === 0
  };
}

/** Scarta le alternative gemelle: stessi titoli nello stesso ordine. */
function togliDoppioni(lista) {
  const viste = new Set(), fuori = [];
  for (const a of lista) {
    const impronta = a.capitoli.map((c) => c.titolo.toLowerCase()).join('|');
    if (viste.has(impronta)) continue;
    viste.add(impronta); fuori.push(a);
  }
  return fuori;
}

// ------------------------------------------------------------------ proponi

/**
 * Le alternative di scaletta per un corso.
 * @returns {{alternative: Array, uso: Object|null, errore: string|null}}
 */
async function proponi(corso, schedeMappa, ai, opts) {
  const o = opts || {};
  const r = await (ai.chiama || chiamaDefault)({
    fornitore: ai.fornitore, modello: ai.modello, apiKey: ai.apiKey, lingua: ai.lingua,
    sistema: SISTEMA,
    utente: messaggio(corso, schedeMappa, o.regoleForma, o.brief, o.nCapitoli),
    schema: schemaAlternative(),
    maxTokens: 12000
  });
  if (!r || !r.ok) return { alternative: [], uso: r && r.uso, errore: (r && r.errore) || 'nessuna risposta' };
  const alternative = togliDoppioni(((r.dati && r.dati.alternative) || []).map((a) => normalizza(a, corso)))
    .filter((a) => a.capitoli.length);
  return {
    alternative, uso: r.uso,
    errore: alternative.length ? null : 'il modello non ha prodotto scalette utilizzabili'
  };
}

module.exports = {
  N_ALTERNATIVE, PRINCIPI, SISTEMA, schemaAlternative,
  materialiDi, schedeDelCorso, messaggio, vincoloCapitoli, impronta, numeroDiFonte, normalizza, togliDoppioni, proponi
};
