'use strict';
/**
 * pianoedit — le correzioni a mano del raggruppamento delle lezioni.
 *
 * Erano dentro `App/wizard.js`, dove serviva il pannello «Indice delle lezioni».
 * Ora la stessa mano si usa nel composer — righe = lezioni, e il taglio delle
 * lezioni si decide lì, accanto agli indici che ne nascono — quindi la logica
 * esce dal pannello e diventa una libreria: due copie della stessa procedura
 * divergono sempre, e questa decide i NOMI DELLE CARTELLE, cioè la cosa su cui
 * si agganciano capitoli, rimandi e percorsi.
 *
 * Nessuna funzione qui tocca il disco: prendono un piano e ne restituiscono uno.
 */

/** Le azioni disponibili su una lezione, nell'ordine in cui compaiono nei comandi. */
const AZIONI = ['su', 'giu', 'unisci', 'separa', 'giu-mat'];

/** Il nome di cartella di una lezione: `NN-slug`, progressivo. */
function slugLezione(title) {
  return String(title || 'lezione').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/^\s*\d{1,3}(\s*-\s*\d{1,3})?[\s.:·-]*/, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40).replace(/-+$/, '') || 'lezione';
}

/**
 * Rinumera le cartelle in sequenza.
 *
 * Le cartelle devono restare `NN-slug` progressive: è la sequenza didattica, ed
 * è anche l'ordine con cui il lettore le mostra. Cambia dopo ogni modifica —
 * ed è la ragione per cui una scaletta già pagata può ritrovarsi appesa alla
 * cartella di un'altra lezione (vedi `firme()`).
 */
function rinumera(piano) {
  (piano.lezioni || []).forEach((c, i) => {
    c.folder = String(i + 1).padStart(2, '0') + '-' + slugLezione(c.title);
  });
  return piano;
}

/** Se un comando ha senso sulla lezione `i`: la UI lo usa per spegnere i pulsanti. */
function possibile(piano, azione, i) {
  const c = (piano && piano.lezioni) || [];
  if (!c[i]) return false;
  if (azione === 'su') return i > 0;
  if (azione === 'giu') return i < c.length - 1;
  if (azione === 'unisci') return i < c.length - 1;
  if (azione === 'separa') return (c[i].materiali || []).length > 1;
  if (azione === 'giu-mat') return i < c.length - 1 && (c[i].materiali || []).length > 1;
  return false;
}

/**
 * Applica un comando e rinumera. Il piano passato viene modificato in luogo:
 * chi chiama lo salva subito dopo, e una copia in più darebbe l'illusione di
 * poter tornare indietro senza che nessuno ne tenga la storia.
 */
function applica(piano, azione, i) {
  const c = (piano && piano.lezioni) || [];
  if (!c[i] || !possibile(piano, azione, i)) return piano;
  if (azione === 'su') { const t = c[i - 1]; c[i - 1] = c[i]; c[i] = t; }
  else if (azione === 'giu') { const u = c[i + 1]; c[i + 1] = c[i]; c[i] = u; }
  else if (azione === 'unisci') {
    c[i].materiali = (c[i].materiali || []).concat(c[i + 1].materiali || []);
    c[i].rationale = 'Unito a mano con «' + c[i + 1].title + '».';
    c.splice(i + 1, 1);
  } else if (azione === 'separa') {
    const ultimo = c[i].materiali.pop();
    c.splice(i + 1, 0, {
      folder: '', title: (ultimo.num ? ultimo.num + ' ' : '') + String(ultimo.titolo || ultimo.source).toUpperCase().slice(0, 80),
      area: c[i].area || '', rationale: 'Separato a mano da «' + c[i].title + '».',
      status: 'proposto', materiali: [ultimo], capitoli: []
    });
  } else if (azione === 'giu-mat') {
    c[i + 1].materiali.unshift(c[i].materiali.pop());
  }
  return rinumera(piano);
}

/**
 * L'impronta di ogni lezione: cartella → materiali che contiene.
 *
 * Serve a capire, dopo una modifica, quali scalette valgono ancora. La cartella
 * da sola non basta e sarebbe un inganno: unendo due lezioni tutte le successive
 * scalano di un numero, e `03-delega.json` finirebbe appeso a una lezione che
 * parla d'altro — con dentro capitoli che citano materiali che quella lezione non ha.
 */
function firme(piano) {
  const out = {};
  for (const c of ((piano && piano.lezioni) || [])) {
    out[c.folder] = (c.materiali || []).map((m) => String((m && (m.num || m.source)) || m)).sort().join(',');
  }
  return out;
}

/** Le cartelle la cui scaletta non vale più: sparite, o con materiali diversi. */
function cartelleCambiate(pianoPrima, pianoDopo) {
  const a = firme(pianoPrima), b = firme(pianoDopo);
  return Object.keys(a).filter((folder) => b[folder] !== a[folder]);
}

module.exports = { AZIONI, slugLezione, rinumera, possibile, applica, firme, cartelleCambiate };
