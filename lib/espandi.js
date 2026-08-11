'use strict';
/**
 * espandi — far crescere un corso già finito senza rompere quello che c'è.
 *
 * Il vincolo che governa tutto: **si accoda, non si rinumera mai**. I capitoli
 * si chiamano `NN-slug.md` e le lezioni si citano fra loro con `[[NN-slug]]`;
 * rinumerare una lezione esistente significa spezzare in un colpo tutti i rimandi
 * che puntano a lei, e quelli non sono link rotti visibili — mandano l'allievo
 * sulla pagina sbagliata. Quindi:
 *
 *  - un materiale nuovo prende il numero successivo, mai uno già usato;
 *  - un capitolo nuovo si aggiunge in coda alla lezione, con l'ordine successivo;
 *  - `ordine_capitoli` cresce, non viene riscritto da zero;
 *  - una lezione nuova si aggiunge dopo l'ultima, e le vecchie restano dove sono.
 *
 * Tutte funzioni pure: prendono liste e stringhe, non toccano il disco.
 */

/* L'unica ragione di questo require: `scomponi`, cioè dove finisce la base di
   una lezione e comincia il nome della variante. È una regola sola e sta in un
   posto solo — riscriverla qui con un `indexOf('--')` è come sono nati i due
   `capitoloDi` che si contraddicevano. `percorsi` tocca il disco, questo modulo
   no: la dipendenza è sul vocabolario, non sul comportamento. */
const percorsi = require('./percorsi');

/** I capitoli già scritti di una lezione, dal contenuto della sua cartella. */
function capitoliDi(files) {
  return (files || [])
    .filter((f) => /^\d{2,3}-.*\.md$/.test(f))
    .sort((a, b) => a.localeCompare(b, 'it'));
}

/** Il numero da cui ripartire per accodare (1 se la lezione è vuota). */
function prossimoOrdine(files) {
  let max = 0;
  for (const f of capitoliDi(files)) {
    const m = /^(\d{2,3})-/.exec(f);
    if (m) max = Math.max(max, parseInt(m[1], 10) || 0);
  }
  return max + 1;
}

/**
 * L'ordine aggiornato: prima quello dichiarato (che è la volontà dell'autore),
 * poi i file nuovi. Niente doppioni, niente riordini a sorpresa.
 */
function ordineAggiornato(ordineEsistente, nuoviFile) {
  const out = [];
  const visto = new Set();
  for (const f of (ordineEsistente || []).concat(nuoviFile || [])) {
    if (!f || visto.has(f)) continue;
    visto.add(f); out.push(f);
  }
  return out;
}

/**
 * I materiali che nessuna lezione del corso dichiara di usare: sono quelli da
 * proporre quando si espande. `lezioni` è [{ folder, materiali: [num] }].
 */
function materialiNuovi(materiali, lezioni) {
  const usati = new Set();
  for (const c of lezioni || []) for (const n of (c.materiali || [])) usati.add(parseInt(n, 10));
  return (materiali || []).filter((m) => {
    const n = parseInt(m.num, 10);
    return Number.isFinite(n) && !usati.has(n);
  });
}

/** Il numero della prossima lezione di un corso («17-…» se l'ultima è la 16). */
function prossimoLezione(folders) {
  let max = 0;
  for (const f of folders || []) {
    const m = /^(\d{2,3})-/.exec(f);
    if (m) max = Math.max(max, parseInt(m[1], 10) || 0);
  }
  return String(max + 1).padStart(2, '0');
}

/**
 * I rimandi che puntano a una lezione inesistente, con l'indicazione di dove
 * stanno. `capitoli` è [{ file, contenuto }], `nomi` i nomi citabili — quelli
 * che dà `percorsi.nomiRimandabili`, cioè le BASI delle lezioni che hanno
 * capitoli, non l'elenco delle cartelle sul disco.
 *
 * ⚠️ Il target si normalizza alla base prima del confronto, perché il lettore fa
 * lo stesso: un rimando scritto con il nome di una variante
 * (`04-delegation--scaletta-a`) apre comunque la lezione — la variante che il
 * percorso attivo rivendica — quindi chiamarlo rotto sarebbe una bugia. Chi
 * decide che cosa il modello ha il PERMESSO di scrivere è `nomiRimandabili`,
 * che le varianti non le elenca: sono due domande diverse e vanno tenute tali.
 */
function wikilinkRotti(capitoli, nomi) {
  const esistenti = new Set(nomi || []);
  const out = [];
  for (const c of capitoli || []) {
    const trovati = String(c.contenuto || '').match(/\[\[([^\]]+)\]\]/g) || [];
    for (const w of trovati) {
      const target = w.slice(2, -2).split('|')[0].trim();
      if (!esistenti.has(percorsi.scomponi(target).base)) out.push({ file: c.file, target });
    }
  }
  return out;
}

/**
 * Le lezioni a cui ha senso accodare capitoli: le destinazioni VERE.
 *
 * La domanda a cui questa funzione risponde è una sola, e va tenuta in mente
 * perché è facile risponderne un'altra: **se genero qui dentro, il testo si
 * vedrà?** Non «questa cartella esiste», non «ha dei capitoli».
 *
 * ⚠️ E la risposta la danno i PERCORSI, non il disco. La prima versione di
 * questa funzione guardava il conteggio dei capitoli, e su un corso senza
 * varianti sembrava giusta; ma il lettore sceglie con `preferitaFra`, che
 * consulta le scelte del percorso. Appena le due regole divergono si offrono
 * cartelle-fantasma: misurato, bastava creare **un** percorso su TD74-DSA per
 * avere 32 cartelle sul disco, 32 righe offerte e 16 visibili. Sedici righe che
 * portano a testo pagato e mai mostrato.
 *
 * Tre casi, e vengono tutti da lì:
 *
 *  1. **il segnaposto della base**, quando un percorso rivendica una variante:
 *     non si vede, e non è una destinazione. Vale anche se la base ha capitoli
 *     SUOI — è il caso che la versione precedente lasciava passare;
 *  2. **la variante non rivendicata da nessuno**: due varianti, un percorso
 *     solo. Quella che nessun percorso legge è un segnaposto travestito;
 *  3. **la base che nessun percorso nomina**: lì il lettore ripiega sulla
 *     cartella che c'è, quindi è una destinazione — anche senza capitoli, che è
 *     il caso della lezione pianificata e non ancora scritta.
 *
 * Una cartella rivendicata da **anche un solo** percorso è sempre una
 * destinazione: qualcuno la legge, e non conta che il percorso attivo adesso sia
 * un altro. Il ripasso di un percorso non deve dipendere da quale stai leggendo.
 *
 * @param lezioni  [{ folder, capitoli, … }] — si conservano tutti gli altri campi
 * @param percorsiSalvati  quelli di `percorsi.leggiTutti`: `[{ scelte: { base: { cartella } } }]`
 */
function destinazioni(lezioni, percorsiSalvati) {
  const lista = (lezioni || []).filter((l) => l && l.folder);
  const conPercorsi = (percorsiSalvati || []).filter((p) => p && p.scelte && Object.keys(p.scelte).length);

  const rivendicate = new Set();     // cartelle che almeno un percorso fa leggere
  const basiDecise = new Set();      // basi su cui almeno un percorso si è espresso
  for (const p of conPercorsi) {
    for (const base of Object.keys(p.scelte)) {
      const c = p.scelte[base] && p.scelte[base].cartella;
      if (!c) continue;              // «non lo so» non è «nessuna»: la base resta indecisa
      rivendicate.add(c);
      basiDecise.add(base);
    }
  }
  // le cartelle che l'app carica davvero: solo quelle con capitoli (`preload.js`)
  const caricate = lista.filter((l) => l.capitoli > 0).map((l) => l.folder);

  return lista.filter((l) => {
    const base = percorsi.scomponi(l.folder).base;
    if (rivendicate.has(l.folder)) return true;   // qualcuno la legge: è una destinazione
    if (basiDecise.has(base)) return false;       // un percorso legge un'altra cartella di questa lezione
    /* Senza nessun percorso salvato il lettore non filtra affatto
       (`lezioniVisibili` esce prima): tutto ciò che ha capitoli si vede. */
    if (!conPercorsi.length) return true;
    /* Percorsi presenti ma muti su questa lezione: decide il ripiego, che è la
       stessa scelta di `preferitaFra` nel lettore — e si ragiona su come sarebbe
       DOPO aver generato qui, perché è quello che sta per succedere. */
    const cand = caricate.filter((f) => percorsi.scomponi(f).base === base);
    if (cand.indexOf(l.folder) < 0) cand.push(l.folder);
    if (cand.length === 1) return true;
    if (cand.indexOf(base) >= 0) return l.folder === base;   // la base vince sulle varianti non rivendicate
    return l.folder === cand.slice().sort((a, b) => a.localeCompare(b, 'it'))[0];
  });
}

/**
 * Che cosa comporta l'espansione, detto prima di farla: quanti materiali nuovi,
 * dove finiranno, da quale numero partono i capitoli.
 */
function anteprima({ materialiNuovi: nuovi, lezione, files, ordineEsistente }) {
  const da = prossimoOrdine(files);
  return {
    materiali: (nuovi || []).length,
    lezione: lezione || null,
    daOrdine: da,
    capitoliEsistenti: capitoliDi(files).length,
    ordinePrevisto: (ordineEsistente || capitoliDi(files)).length,
    rinumera: false                                  // mai: è il punto di tutto questo modulo
  };
}

module.exports = { capitoliDi, prossimoOrdine, ordineAggiornato, materialiNuovi,
  prossimoLezione, wikilinkRotti, destinazioni, anteprima };
