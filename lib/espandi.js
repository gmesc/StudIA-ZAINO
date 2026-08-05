'use strict';
/**
 * espandi — far crescere un progetto già finito senza rompere quello che c'è.
 *
 * Il vincolo che governa tutto: **si accoda, non si rinumera mai**. I capitoli
 * si chiamano `NN-slug.md` e i corsi si citano fra loro con `[[NN-slug]]`;
 * rinumerare un corso esistente significa spezzare in un colpo tutti i rimandi
 * che puntano a lui, e quelli non sono link rotti visibili — mandano l'allievo
 * sulla pagina sbagliata. Quindi:
 *
 *  - un materiale nuovo prende il numero successivo, mai uno già usato;
 *  - un capitolo nuovo si aggiunge in coda al corso, con l'ordine successivo;
 *  - `ordine_capitoli` cresce, non viene riscritto da zero;
 *  - un corso nuovo si aggiunge dopo l'ultimo, e i vecchi restano dove sono.
 *
 * Tutte funzioni pure: prendono liste e stringhe, non toccano il disco.
 */

/** I capitoli già scritti di un corso, dal contenuto della sua cartella. */
function capitoliDi(files) {
  return (files || [])
    .filter((f) => /^\d{2,3}-.*\.md$/.test(f))
    .sort((a, b) => a.localeCompare(b, 'it'));
}

/** Il numero da cui ripartire per accodare (1 se il corso è vuoto). */
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
 * I materiali che nessun corso del progetto dichiara di usare: sono quelli da
 * proporre quando si espande. `corsi` è [{ folder, materiali: [num] }].
 */
function materialiNuovi(materiali, corsi) {
  const usati = new Set();
  for (const c of corsi || []) for (const n of (c.materiali || [])) usati.add(parseInt(n, 10));
  return (materiali || []).filter((m) => {
    const n = parseInt(m.num, 10);
    return Number.isFinite(n) && !usati.has(n);
  });
}

/** Il numero del prossimo corso di un progetto («17-…» se l'ultimo è il 16). */
function prossimoCorso(folders) {
  let max = 0;
  for (const f of folders || []) {
    const m = /^(\d{2,3})-/.exec(f);
    if (m) max = Math.max(max, parseInt(m[1], 10) || 0);
  }
  return String(max + 1).padStart(2, '0');
}

/**
 * I rimandi che puntano a un corso inesistente, con l'indicazione di dove
 * stanno. `capitoli` è [{ file, contenuto }], `folders` l'elenco dei corsi.
 */
function wikilinkRotti(capitoli, folders) {
  const esistenti = new Set(folders || []);
  const out = [];
  for (const c of capitoli || []) {
    const trovati = String(c.contenuto || '').match(/\[\[([^\]]+)\]\]/g) || [];
    for (const w of trovati) {
      const target = w.slice(2, -2).split('|')[0].trim();
      if (!esistenti.has(target)) out.push({ file: c.file, target });
    }
  }
  return out;
}

/**
 * Che cosa comporta l'espansione, detto prima di farla: quanti materiali nuovi,
 * dove finiranno, da quale numero partono i capitoli.
 */
function anteprima({ materialiNuovi: nuovi, corso, files, ordineEsistente }) {
  const da = prossimoOrdine(files);
  return {
    materiali: (nuovi || []).length,
    corso: corso || null,
    daOrdine: da,
    capitoliEsistenti: capitoliDi(files).length,
    ordinePrevisto: (ordineEsistente || capitoliDi(files)).length,
    rinumera: false                                  // mai: è il punto di tutto questo modulo
  };
}

module.exports = { capitoliDi, prossimoOrdine, ordineAggiornato, materialiNuovi,
  prossimoCorso, wikilinkRotti, anteprima };
