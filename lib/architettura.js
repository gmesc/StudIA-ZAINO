'use strict';
/**
 * architettura — STADIO 1 multiagente: dalle schede all'architettura dei corsi.
 *
 * Riproduce il modo in cui è stata costruita a mano l'architettura del corpus di
 * prova: più analisti che guardano lo stesso materiale con occhi diversi, e poi
 * una sintesi che decide. Le tre lenti sono indipendenti — nessuna vede le
 * conclusioni delle altre — così non si allineano per inerzia.
 *
 *   1. TASSONOMIA  — di cosa parla questo corpus, in quali aree si divide
 *   2. SEQUENZA    — cosa presuppone cosa, in che ordine si studia
 *   3. LEGAMI      — coppie, gemelli, cerniere, materiali anomali (fonte, standalone)
 *   4. SINTESI     — un'architettura sola, con le decisioni motivate
 *   5. REVISIONE   — un critico che cerca i buchi; se ne trova, la sintesi si corregge
 *
 * Non usa la numerazione dei file per raggruppare: i numeri sono solo identificatori.
 * Un corpus disordinato o non sequenziale si analizza allo stesso modo.
 *
 * Ogni chiamata passa da `chiama`, iniettabile: i test girano senza rete.
 */

const schede = require('./schede');
const provider = require('./ai/provider');

function chiamaDefault(opts) { return provider.completa(opts); }

// -------------------------------------------------------------------- lenti

const LENTI = [
  {
    id: 'tassonomia',
    etichetta: 'Tassonomia dei contenuti',
    sistema: [
      'Sei un esperto della disciplina di cui parlano questi materiali. Ti viene dato l\'elenco delle schede di analisi.',
      'Individua la STRUTTURA CONCETTUALE del corpus: quali aree tematiche esistono davvero, quali materiali appartengono a ciascuna e perché.',
      'Ragiona sul contenuto, non sull\'ordine dei file: i materiali possono essere numerati a caso o non essere numerati affatto.',
      'Segnala i materiali che non appartengono a nessuna area e vanno trattati a parte (fonti di consultazione, allegati, materiali isolati).'
    ].join('\n'),
    schema: {
      type: 'object',
      properties: {
        aree: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              nome: { type: 'string' }, descrizione: { type: 'string' },
              materiali: { type: 'array', items: { type: 'string' } }
            },
            required: ['nome', 'materiali']
          }
        },
        anomali: {
          type: 'array',
          items: {
            type: 'object',
            properties: { materiale: { type: 'string' }, motivo: { type: 'string' }, trattamento: { type: 'string' } },
            required: ['materiale', 'motivo']
          }
        }
      },
      required: ['aree']
    }
  },
  {
    id: 'sequenza',
    etichetta: 'Sequenza didattica e prerequisiti',
    sistema: [
      'Sei un progettista didattico. Ti viene dato l\'elenco delle schede di analisi dei materiali di un corpus.',
      'Determina in quale ORDINE vanno studiati: cosa presuppone cosa, quali materiali sono fondamenti e quali affondi.',
      'Dichiara i vincoli di precedenza espliciti ("X va dopo Y perché Y ne è il presupposto").',
      'Non fidarti della numerazione dei file: un materiale può essere stato registrato prima e presupporne uno successivo.'
    ].join('\n'),
    schema: {
      type: 'object',
      properties: {
        ordine: { type: 'array', items: { type: 'string' } },
        precedenze: {
          type: 'array',
          items: {
            type: 'object',
            properties: { dopo: { type: 'string' }, prima: { type: 'string' }, perche: { type: 'string' } },
            required: ['dopo', 'prima']
          }
        },
        fondamenti: { type: 'array', items: { type: 'string' } }
      },
      required: ['ordine']
    }
  },
  {
    id: 'legami',
    etichetta: 'Coppie, cerniere e rimandi',
    sistema: [
      'Sei un analista di corpora didattici. Ti viene dato l\'elenco delle schede di analisi.',
      'Trova i LEGAMI fra materiali: dittici teoria+applicazione, materiali gemelli che trattano lo stesso strumento,',
      'cerniere che collegano due aree, e rimandi utili ("chi studia X dovrebbe tornare a Y").',
      'Segnala anche le SOVRAPPOSIZIONI: due materiali che dicono in gran parte la stessa cosa.'
    ].join('\n'),
    schema: {
      type: 'object',
      properties: {
        coppie: {
          type: 'array',
          items: {
            type: 'object',
            properties: { materiali: { type: 'array', items: { type: 'string' } }, tipo: { type: 'string' }, perche: { type: 'string' } },
            required: ['materiali']
          }
        },
        rimandi: {
          type: 'array',
          items: {
            type: 'object',
            properties: { da: { type: 'string' }, a: { type: 'string' }, perche: { type: 'string' } },
            required: ['da', 'a']
          }
        },
        sovrapposizioni: { type: 'array', items: { type: 'string' } }
      },
      required: ['coppie']
    }
  }
];

/** Il testo delle schede, uguale per tutte le lenti. */
function contesto(schedeMappa) {
  return '## Schede di analisi dei materiali\n\n' + schede.testoPerPrompt(schedeMappa);
}

/** Esegue una lente. Ritorna { id, dati, errore, uso }. */
async function eseguiLente(lente, schedeMappa, ai) {
  const r = await (ai.chiama || chiamaDefault)({
    fornitore: ai.fornitore, modello: ai.modello, apiKey: ai.apiKey, lingua: ai.lingua,
    sistema: lente.sistema,
    utente: contesto(schedeMappa) + '\n\nRispondi solo con la struttura richiesta.',
    schema: lente.schema,
    maxTokens: 8000
  });
  return { id: lente.id, dati: r && r.ok ? r.dati : null, errore: r && r.ok ? null : (r && r.errore) || 'nessuna risposta', uso: r && r.uso };
}

/** Esegue tutte le lenti in parallelo: sono indipendenti per costruzione. */
async function eseguiLenti(schedeMappa, ai, onProgress) {
  const avanti = onProgress || function () {};
  return Promise.all(LENTI.map(async (l) => {
    avanti({ fase: 'lente', id: l.id, stato: 'in corso', etichetta: l.etichetta });
    const r = await eseguiLente(l, schedeMappa, ai);
    avanti({ fase: 'lente', id: l.id, stato: r.errore ? ('errore: ' + r.errore) : 'fatto', etichetta: l.etichetta });
    return r;
  }));
}

// ------------------------------------------------------------------ sintesi

const SISTEMA_SINTESI = [
  'Sei il responsabile del percorso di studio. Ricevi le schede dei materiali e tre analisi indipendenti:',
  'una tassonomia dei contenuti, una sequenza didattica con i prerequisiti, una mappa dei legami.',
  'Costruisci L\'ARCHITETTURA DEFINITIVA dei corsi.',
  'Regole non negoziabili:',
  '- ogni materiale deve stare in ESATTAMENTE un corso: non inventarne, non ometterne;',
  '- un corso è un blocco coerente di studio, non un contenitore di file vicini di numero;',
  '- l\'ordine dei corsi rispetta i prerequisiti dichiarati dalla lente «sequenza»;',
  '- dove le tre analisi sono in disaccordo, decidi tu e scrivi la decisione in «decisioni», con il perché;',
  '- i materiali di sola consultazione restano un modulo-fonte a sé, non un corso lineare;',
  '- «rimandi» elenca i collegamenti fra corsi che il lettore dovrà poter seguire.'
].join('\n');

/** Schema dell'architettura finale. */
function schemaArchitettura() {
  return {
    type: 'object',
    properties: {
      corsi: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            area: { type: 'string' },
            rationale: { type: 'string' },
            tipo: { type: 'string', enum: ['corso', 'modulo-fonte'] },
            materiali: { type: 'array', items: { type: 'string' } }
          },
          required: ['title', 'materiali']
        }
      },
      rimandi: {
        type: 'array',
        items: {
          type: 'object',
          properties: { da: { type: 'string' }, a: { type: 'string' }, perche: { type: 'string' } },
          required: ['da', 'a']
        }
      },
      decisioni: { type: 'array', items: { type: 'string' } }
    },
    required: ['corsi']
  };
}

/** Le tre analisi, impaginate per la sintesi. */
function testoLenti(risultati) {
  return risultati.map((r) => '### Analisi «' + r.id + '»\n' + (r.dati ? JSON.stringify(r.dati, null, 1) : '(non disponibile: ' + r.errore + ')')).join('\n\n');
}

/** Esegue la sintesi. */
async function sintetizza(schedeMappa, risultatiLenti, ai, extra) {
  const r = await (ai.chiama || chiamaDefault)({
    fornitore: ai.fornitore, modello: ai.modello, apiKey: ai.apiKey, lingua: ai.lingua,
    sistema: SISTEMA_SINTESI,
    utente: [contesto(schedeMappa), '## Le tre analisi', testoLenti(risultatiLenti), extra || ''].filter(Boolean).join('\n\n'),
    schema: schemaArchitettura(),
    maxTokens: 12000
  });
  return r;
}

// ---------------------------------------------------------------- revisione

const SISTEMA_REVISIONE = [
  'Sei un revisore severo. Ti viene data un\'architettura di corsi e le schede dei materiali da cui nasce.',
  'Cerca i difetti, in ordine di gravità:',
  '1. materiali mancanti o assegnati a due corsi;',
  '2. corsi incoerenti, che tengono insieme cose che non stanno insieme;',
  '3. ordine che viola un prerequisito;',
  '4. titoli che non dicono di cosa parla il corso.',
  'Se l\'architettura è solida dillo senza inventare problemi: «promossa» = true e nessun rilievo.'
].join('\n');

function schemaRevisione() {
  return {
    type: 'object',
    properties: {
      promossa: { type: 'boolean' },
      rilievi: {
        type: 'array',
        items: {
          type: 'object',
          properties: { gravita: { type: 'string', enum: ['alta', 'media', 'bassa'] }, problema: { type: 'string' }, rimedio: { type: 'string' } },
          required: ['problema']
        }
      }
    },
    required: ['promossa']
  };
}

/** Fa rivedere l'architettura a un critico indipendente. */
async function revisiona(schedeMappa, architettura, ai) {
  const r = await (ai.chiama || chiamaDefault)({
    fornitore: ai.fornitore, modello: ai.modello, apiKey: ai.apiKey, lingua: ai.lingua,
    sistema: SISTEMA_REVISIONE,
    utente: [contesto(schedeMappa), '## Architettura proposta', JSON.stringify(architettura, null, 1)].join('\n\n'),
    schema: schemaRevisione(),
    maxTokens: 4000
  });
  return r;
}

/** I rilievi gravi diventano istruzioni per il secondo giro di sintesi. */
function istruzioniCorrezione(revisione) {
  const gravi = ((revisione && revisione.rilievi) || []).filter((x) => x.gravita !== 'bassa');
  if (!gravi.length) return null;
  return '## Rilievi del revisore da correggere\n' +
    gravi.map((x, i) => (i + 1) + '. ' + x.problema + (x.rimedio ? ' → ' + x.rimedio : '')).join('\n');
}

// ------------------------------------------------------------- orchestrazione

/** Somma i consumi di tutte le chiamate. */
function sommaUso(usi) { return schede.sommaUso(usi); }

/**
 * Pipeline completa dello stadio 1.
 * Ritorna { architettura, revisione, giri, uso, errore }.
 */
async function costruisci(schedeMappa, ai, opts) {
  const o = opts || {};
  const avanti = o.onProgress || function () {};
  const usi = [];

  const lenti = await eseguiLenti(schedeMappa, ai, avanti);
  lenti.forEach((l) => usi.push(l.uso));
  if (lenti.every((l) => !l.dati)) return { errore: 'nessuna delle analisi è riuscita: ' + lenti[0].errore, uso: sommaUso(usi) };

  avanti({ fase: 'sintesi', stato: 'in corso' });
  let r = await sintetizza(schedeMappa, lenti, ai);
  usi.push(r && r.uso);
  if (!r || !r.ok) return { errore: 'sintesi non riuscita: ' + ((r && r.errore) || '?'), uso: sommaUso(usi) };
  let architettura = r.dati, giri = 1, revisione = null;

  if (o.revisione !== false) {
    avanti({ fase: 'revisione', stato: 'in corso' });
    const rev = await revisiona(schedeMappa, architettura, ai);
    usi.push(rev && rev.uso);
    revisione = rev && rev.ok ? rev.dati : null;
    const correzioni = istruzioniCorrezione(revisione);
    if (correzioni) {
      avanti({ fase: 'sintesi', stato: 'secondo giro dopo i rilievi del revisore' });
      const r2 = await sintetizza(schedeMappa, lenti, ai, correzioni);
      usi.push(r2 && r2.uso);
      if (r2 && r2.ok) { architettura = r2.dati; giri = 2; }
    }
  }
  return { architettura, revisione, lenti, giri, uso: sommaUso(usi) };
}

module.exports = {
  LENTI, contesto, eseguiLente, eseguiLenti,
  SISTEMA_SINTESI, schemaArchitettura, testoLenti, sintetizza,
  SISTEMA_REVISIONE, schemaRevisione, revisiona, istruzioniCorrezione,
  sommaUso, costruisci
};
