'use strict';
/**
 * lingua — la lingua in cui il modello deve SCRIVERE.
 *
 * Non va confusa con la lingua parlata nei video, che è un'impostazione di
 * Whisper (vedi `ingest.py --lang`): quella dice che cosa si sente, questa dice
 * che cosa esce. Un webinar in inglese può benissimo diventare una lezione in
 * italiano, e in genere è proprio quello che si vuole.
 *
 * Serve un'istruzione esplicita perché un corpus tutto in una lingua tira il
 * modello verso quella lingua anche quando il prompt è scritto in un'altra: i
 * punti dove si vede per primi sono i titoli delle lezioni e i termini del
 * glossario, cioè l'indice che l'utente legge. Prima questa istruzione stava
 * scritta a mano in un solo prompt su nove; ora passa da `provider.completa()`
 * e vale per tutte le chiamate, che nessuno se ne può dimenticare.
 */

/** Le lingue offerte: codice, nome italiano, endonimo (per il prompt). */
const LINGUE = [
  ['it', 'italiano', 'italiano'],
  ['en', 'inglese', 'English'],
  ['fr', 'francese', 'français'],
  ['de', 'tedesco', 'Deutsch'],
  ['es', 'spagnolo', 'español'],
  ['pt', 'portoghese', 'português']
];

const DEFAULT = 'it';

/** Il codice normalizzato, o il default se non è una lingua che conosciamo. */
function normalizza(codice) {
  const c = String(codice || '').trim().toLowerCase();
  return LINGUE.some((l) => l[0] === c) ? c : DEFAULT;
}

/** Il nome italiano di una lingua: «inglese». */
function nome(codice) {
  const l = LINGUE.find((x) => x[0] === normalizza(codice));
  return l ? l[1] : normalizza(codice);
}

/**
 * L'istruzione da mettere in cima al prompt di sistema.
 *
 * Nomina la lingua due volte — in italiano e nel suo endonimo — perché il nome
 * italiano da solo («in inglese») è una parola italiana in un contesto italiano,
 * e su un corpus inglese non basta sempre a spostare il modello.
 *
 * L'eccezione sulle citazioni è deliberata: tradurre le parole di un relatore
 * mentre gli si attribuiscono è una falsificazione della fonte, e il minutaggio
 * accanto alla citazione promette che lì si sente esattamente quello.
 */
function direttiva(codice) {
  const c = normalizza(codice);
  const l = LINGUE.find((x) => x[0] === c);
  return 'Scrivi tutto in ' + l[1] + ' (' + l[2] + '): titoli, sintesi, spiegazioni, glossario, ' +
    'domande. Vale anche se il materiale di partenza è in un\'altra lingua. ' +
    'Unica eccezione: le citazioni testuali restano nella lingua originale della fonte.';
}

/** Il prompt di sistema con l'istruzione sulla lingua in testa. */
function conDirettiva(sistema, codice) {
  return direttiva(codice) + '\n\n' + String(sistema || '');
}

module.exports = { LINGUE, DEFAULT, normalizza, nome, direttiva, conDirettiva };
