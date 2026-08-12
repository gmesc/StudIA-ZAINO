'use strict';
/**
 * Le regole del player (App/assets/player/lettore.js).
 *
 * Sono le quattro cose che, sbagliate, non sollevano niente: un tipo indovinato
 * male, un tempo scritto in una forma che nessuno sa rileggere, un salto che
 * esce dalla durata, una riga di appunto con un rimando morto.
 *
 * ⚠️ E la copia dichiarata: le estensioni stanno qui e in `lib/materiali.js`,
 * perché questo file gira nel browser e quello nella pipeline. Questa prova le
 * inchioda insieme — è l'unica cosa che impedisce alle due liste di divergere
 * in silenzio.
 *
 *   node test/player.js
 */

const P = require('../App/assets/player/lettore');
const mat = require('../lib/materiali');
const M = require('../lib/media');

let ko = 0, ok = 0;
function check(nome, atteso, avuto) {
  const a = JSON.stringify(atteso), b = JSON.stringify(avuto);
  if (a === b) { ok++; return; }
  ko++;
  console.log('  ✗ ' + nome + '\n      atteso: ' + a + '\n      avuto:  ' + b);
}
function sezione(t) { console.log('\n== ' + t); }

sezione('Le due liste di estensioni sono la stessa lista');
{
  /* ⚠️ Se questa prova diventa rossa non si «aggiusta l'atteso»: si copia la
     riga nuova nell'altro file. Una lista più corta nel renderer vuol dire un
     file che il player non riconosce ma che l'import ha copiato — cioè un
     materiale nel vault che non si può aprire. Una più corta in `lib/` vuol
     dire l'opposto: un file che si apre e che non entra mai. */
  check('i video', mat.EXT_VIDEO, P.EXT_VIDEO);
  check('gli audio', mat.EXT_AUDIO, P.EXT_AUDIO);
  /* E il verdetto deve coincidere, non solo le liste: sono due funzioni
     diverse, scritte in due mondi diversi, sulla stessa domanda. */
  const campioni = ['a.mp4', 'b.MOV', 'c.m4a', 'd.opus', 'e.pdf', 'f', 'g.mp3'];
  check('e il verdetto è lo stesso', campioni.map(M.tipoDi), campioni.map(P.tipoDi));
}

sezione('Che cosa è questo file');
{
  check('un mp4 è un video', 'video', P.tipoDi('01 lezione.mp4'));
  check('un m4a è un audio', 'audio', P.tipoDi('02 appunti.m4a'));
  check('le maiuscole non contano', 'video', P.tipoDi('LEZIONE.MP4'));
  check('un pdf non è né l’uno né l’altro', '', P.tipoDi('03 dispensa.pdf'));
  check('un nome senza punto nemmeno', '', P.tipoDi('lezione'));
  /* Il punto in mezzo al nome non è un'estensione. */
  check('e l’estensione è l’ultimo pezzo', 'audio', P.tipoDi('lezione 1.2 finale.mp3'));
}

sezione('Come si scrive un tempo');
{
  check('sotto il minuto', '0:07', P.tempo(7));
  check('minuti e secondi', '14:10', P.tempo(850));
  /* ⚠️ Oltre l'ora si scrive l'ora: «83:20» è un tempo che nessun lettore
     mostra e che nessuno sa ritrovare sulla barra. */
  check('oltre l’ora, l’ora', '1:23:20', P.tempo(5000));
  check('le due cifre dei minuti', '2:05:03', P.tempo(7503));
  check('lo zero è un tempo', '0:00', P.tempo(0));
  check('il negativo si schiaccia a zero', '0:00', P.tempo(-30));
  check('e il niente pure', '0:00', P.tempo(undefined));
  check('i decimali si troncano', '0:41', P.tempo(41.9));
}

sezione('Saltare avanti e indietro');
{
  check('avanti di dieci', 110, P.salto(100, 10, 600));
  check('indietro di dieci', 90, P.salto(100, -10, 600));
  /* ⚠️ Sotto zero non si va: `currentTime` negativo non solleva, riporta a zero
     e basta — ma il conto sbagliato resterebbe in giro. */
  check('sotto zero no', 0, P.salto(3, -10, 600));
  check('oltre la fine nemmeno', 600, P.salto(595, 10, 600));
  /* ⚠️ La durata può non esserci: prima dei metadati vale `NaN`, e stringere a
     `NaN` darebbe `NaN`. Senza durata si stringe solo a sinistra. */
  check('senza durata si salta lo stesso', 110, P.salto(100, 10, NaN));
  check('e con durata zero pure', 110, P.salto(100, 10, 0));
}

sezione('Le velocità');
{
  check('l’insieme è chiuso', [0.75, 1, 1.25, 1.5, 1.75, 2], P.VELOCITA);
  check('più veloce', 1.25, P.velocita(1, 1));
  check('più lento', 0.75, P.velocita(1, -1));
  /* Agli estremi resta ferma: un giro che riparte da 0,75 dopo il 2× farebbe
     rallentare chi voleva accelerare. */
  check('al massimo resta al massimo', 2, P.velocita(2, 1));
  check('al minimo resta al minimo', 0.75, P.velocita(0.75, -1));
  /* Una velocità fuori elenco si aggancia alla più vicina invece di far
     ripartire da capo. */
  check('una velocità estranea si aggancia alla più vicina', 1.5, P.velocita(1.3, 1));
}

sezione('La riga che finisce nell’appunto');
{
  check('con il numero, è un rimando vivo',
    '\n- [14:10](video:03#t=850) ', P.rigaAppunto({ secondo: 850, numero: '03' }));
  check('con il testo selezionato accanto',
    '\n- [14:10](video:03#t=850) la definizione di competenza',
    P.rigaAppunto({ secondo: 850, numero: '03', testo: '  la definizione\n di competenza ' }));
  /* ⚠️ Senza numero si scrive il tempo NUDO: un `[14:10](video:#t=850)` sarebbe
     un cartello che non porta da nessuna parte, e si scoprirebbe fra un mese. */
  check('senza numero, il tempo nudo', '\n- 14:10 ', P.rigaAppunto({ secondo: 850 }));
  check('il numero a una cifra si scrive a due', '\n- [0:05](video:03#t=5) ',
    P.rigaAppunto({ secondo: 5, numero: 3 }));
  check('e senza niente resta l’inizio', '\n- 0:00 ', P.rigaAppunto({}));
}

console.log('\n' + (ko ? '✗ ' + ko + ' controlli falliti' : '✓ tutti i controlli passati') + ' (' + ok + ' ok)');
process.exit(ko ? 1 : 0);
