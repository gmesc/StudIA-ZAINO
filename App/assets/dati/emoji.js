/* ============================================================================
   dati/emoji.js — l'elenco curato di emoji del selettore degli appunti
   ============================================================================
   Sei categorie, e dentro ciascuna le emoji con le loro PAROLE CHIAVE ITALIANE:
   è quello che permette di trovare ⚠️ scrivendo «attenzione» invece di
   ricordarsi dov'era nella griglia. La forma di una voce è
   `<emoji> parola parola parola`, e le voci si separano con `|`.

   ⚠️ È una tavolozza CURATA, non l'elenco completo delle emoji: chi la allunga
   sta scegliendo che cosa un insegnante troverà in due secondi. Le parole
   chiave sono in italiano e al singolare, come le cerca chi scrive.

   Sono dati, quindi stanno qui e non nel renderer: `EMOJI_FLAT` — l'indice
   piatto su cui gira la ricerca — resta là, perché è una trasformazione.
   ============================================================================ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.DatiEmoji = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  return [
  ['Studio','\u{1F4D6} libro leggere lettura studio|\u{1F4DA} libri biblioteca studio|\u{1F4DD} appunto nota scrivere|✏️ matita scrivere|\u{1F4CB} appunti lista blocco|\u{1F4D2} quaderno|\u{1F393} laurea scuola studente|\u{1F469}‍\u{1F3EB} insegnante maestra docente|\u{1F5C2}️ archivio schedario|\u{1F4C4} foglio documento|\u{1F4CE} allegato graffetta|\u{1F50D} cerca lente ricerca|\u{1F9E0} cervello mente memoria|\u{1F4A1} idea lampadina intuizione|\u{1F9E9} esempio incastro puzzle|\u{1F5A5}️ computer schermo'],
  ['Segnali','✅ fatto giusto completato|❌ sbagliato errore no|⚠️ attenzione pericolo avviso|❗ importante esclamativo|❓ dubbio domanda|⭐ stella importante preferito|\u{1F534} rosso urgente|\u{1F7E1} giallo medio|\u{1F7E2} verde ok|\u{1F535} blu|\u{1F3AF} obiettivo bersaglio target|\u{1F6A9} bandiera segnala|\u{1F4CC} puntina fissa|\u{1F511} chiave concetto chiave|\u{1F512} chiuso bloccato|\u{1F6AB} vietato divieto'],
  ['Tempo e numeri','⏱️ cronometro tempo|⏰ sveglia tempo scadenza|\u{1F4C5} calendario data|\u{1F5D3}️ agenda giorno|⏩ avanti veloce|⏪ indietro|\u{1F51D} presto nuovo|1️⃣ uno primo|2️⃣ due secondo|3️⃣ tre terzo|\u{1F522} numeri conta'],
  ['Frecce e relazioni','➡️ destra freccia quindi|⬅️ sinistra freccia|⬆️ su aumenta|⬇️ giu diminuisce|\u{1F501} ciclo ripeti loop|\u{1F500} incrocia mescola|↔️ bidirezionale relazione|\u{1F517} link collegamento|\u{1F5FA}️ mappa panoramica|\u{1F310} rete globale web|⚖️ equilibrio confronto bilancia|\u{1F4CA} grafico dati statistica|\u{1F4C8} crescita aumento|\u{1F4C9} calo diminuzione'],
  ['Persone e DSA','\u{1F464} persona utente|\u{1F465} gruppo classe persone|\u{1F9D1}‍\u{1F393} studente allievo|\u{1F476} bambino|\u{1F468}‍\u{1F469}‍\u{1F466} famiglia genitori|\u{1F5E3}️ parlare orale voce|\u{1F442} ascolto udito|\u{1F441}️ vista occhio lettura|✍️ scrittura mano|\u{1F91D} collaborazione aiuto|❤️ cuore emozione motivazione|\u{1F60A} contento positivo|\u{1F615} confuso difficolta|\u{1F62B} stanco fatica affaticamento|\u{1F4AA} forza impegno|\u{1F31F} successo brillante'],
  ['Materie','\u{1F520} lettere alfabeto italiano|\u{1F524} parole lessico|\u{1F1EE}\u{1F1F9} italiano lingua|\u{1F1EC}\u{1F1E7} inglese lingua|➕ matematica addizione calcolo|\u{1F9EE} calcolo abaco matematica|\u{1F4D0} geometria misura|\u{1F52C} scienze microscopio|\u{1F30D} geografia mondo|\u{1F3DB}️ storia antico|\u{1F3B5} musica nota|\u{1F3A8} arte disegno|\u{1F3AE} gioco videogioco|\u{1F3AC} video film lezione|\u{1F3A7} audio ascolto cuffie|\u{1F4F1} tecnologia telefono app']
];
}));
