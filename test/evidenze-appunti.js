/* Il testo evidenziato, dentro un appunto.
 *
 * Un'evidenza fatta sulla fonte vive in `APPUNTI/_evidenze.json` col suo colore
 * e il suo tratto. Quando quel testo finisce in un appunto — con «Appunta», o
 * con «Negli appunti» dal menu di una parola chiave — il markdown scrive
 * `[==la frase==](ev:9f2c…)`: il segno di Obsidian attorno al testo, e
 * l'indirizzo dell'evidenza fra parentesi.
 *
 * ⚠️ CHE COSA SI PROVA QUI, E PERCHÉ È LA COSA IMPORTANTE. Nel markdown il
 * COLORE NON C'È: c'è la citazione. L'aspetto si chiede all'indice al momento
 * di disegnare, attraverso il gancio `evidenza(id)`. È il motivo per cui
 * ricolorare una parola chiave cambia anche gli appunti che la citano — non
 * c'è nessuna copia da tenere d'accordo — ed è anche il motivo per cui questo
 * file esiste: se un giorno qualcuno scrivesse il colore nel markdown «per
 * comodità», questi controlli lo direbbero.
 *
 * ⚠️ Il parser NON è una copia: è `App/assets/lettura/capitolo.js`, lo STESSO
 * modulo che carica l'app. Vale qui la nota in testa a `test/figure.js`.
 */
const path = require('path');
const CAP = require(path.join(__dirname, '..', 'App', 'assets', 'lettura', 'capitolo.js'));

let ko = 0, ok = 0;
function check(nome, atteso, avuto) {
  const a = JSON.stringify(atteso), b = JSON.stringify(avuto);
  if (a === b) { ok++; return; }
  ko++;
  console.log('  ✗ ' + nome + '\n      atteso: ' + a + '\n      avuto:  ' + b);
}
function sezione(t) { console.log('\n== ' + t); }

/* L'indice delle evidenze, finto quanto basta: il gancio risponde come
   risponderebbe il renderer leggendo `EVIDENZE.elenco`. */
const INDICE = {
  '9f2c1a4b7e01': { colore: '#fdf14d', tratto: 'sotto' },
  'aa11bb22cc33': { colore: '#6fdcff', tratto: 'overlay' },
  'dd44ee55ff66': { colore: '', tratto: 'sotto' },
  /* Una con la POSTILLA: il corpo dell'annotazione, che l'appunto EREDITA
     invece di copiarselo accanto. */
  'be77cc88dd99': { colore: '#a16207', tratto: 'sotto', nota: 'contraddice p. 4' }
};
const P = CAP.crea({
  pdfNum: () => ({ '03': '03 La disortografia - Galton.pdf' }),
  mediaNum: () => ({}),
  evidenza: (id) => INDICE[id] || null
});
/* E un secondo parser SENZA il gancio: è la situazione di Node, della stampa
   fuori dall'app, e di chi rende un appunto quando l'indice non c'è. */
const MUTO = CAP.crea({ pdfNum: () => ({}), mediaNum: () => ({}) });

sezione('Dal markdown al segno che si vede');
{
  const h = P._mdInline('Il concetto è [==la memoria di lavoro==](ev:9f2c1a4b7e01), e conta.');
  check('il testo diventa un <mark>', true, /<mark class="evid"/.test(h));
  check('col tratto dell\'evidenza', true, /data-tratto="sotto"/.test(h));
  /* ⚠️ Il colore arriva PER RIGA, in una variabile: il foglio di stile non sa
     quali colori esistano — il selettore ne può produrre uno qualunque — e
     cinque regole fisse coprirebbero solo i preset. */
  check('e col suo colore', true, h.indexOf('style="--ev:#fdf14d"') > 0);
  check('il testo è tutto lì', true, h.indexOf('la memoria di lavoro') > 0);
  check('e i due segni di Obsidian non restano a vista', false, /==/.test(h));
  check('intorno c\'è l\'ancora che riporta alla fonte', true,
    /<a href="#" class="evlink" data-ev="9f2c1a4b7e01"/.test(h));
  check('il resto della frase non è stato toccato', true,
    h.indexOf('Il concetto è ') === 0 && /, e conta\.$/.test(h));

  const pieno = P._mdInline('[==alla Stabilo==](ev:aa11bb22cc33)');
  check('il fondo pieno si dichiara nel tratto', true, /data-tratto="overlay"/.test(pieno));
  check('con il suo colore', true, pieno.indexOf('--ev:#6fdcff') > 0);
}

sezione('⚠️ Nel markdown il colore NON c\'è: c\'è la citazione');
{
  /* Se un giorno il colore finisse scritto nell'appunto, ricolorare
     un'evidenza lascerebbe indietro tutti gli appunti che la citano — e nessuno
     se ne accorgerebbe finché non si guardano insieme. Qui si prova che lo
     stesso markdown, con due indici diversi, dà due colori diversi. */
  const md = '[==la stessa frase==](ev:9f2c1a4b7e01)';
  const prima = P._mdInline(md);
  const ALTRO = CAP.crea({ pdfNum: () => ({}), mediaNum: () => ({}),
    evidenza: () => ({ colore: '#ff8ad0', tratto: 'overlay' }) });
  const dopo = ALTRO._mdInline(md);
  check('lo stesso testo, ricolorato, esce col colore nuovo', true, dopo.indexOf('--ev:#ff8ad0') > 0);
  check('e col tratto nuovo', true, /data-tratto="overlay"/.test(dopo));
  check('senza che nel markdown sia cambiato niente', true, prima !== dopo);
}

sezione('Un riferimento senza alcun dato resta neutro');
{
  const h = P._mdInline('[==una frase tolta dall’elenco==](ev:000011112222)');
  check('il testo c\'è tutto', true, h.indexOf('una frase tolta dall’elenco') > 0);
  check('si dichiara orfana', true, /class="evid evorfana"/.test(h));
  /* ⚠️ Niente ancora: porterebbe a un posto che l'indice non sa più dire, e un
     link che non porta da nessuna parte è peggio di nessun link. */
  check('e non ha un\'ancora che non porta da nessuna parte', false, /evlink/.test(h));
  check('il perché si legge passandoci sopra', true, /title="Questa parola chiave/.test(h));

  const senzaGancio = MUTO._mdInline('[==in Node non esiste un indice==](ev:9f2c1a4b7e01)');
  check('senza gancio si degrada allo stesso modo', true, /evorfana/.test(senzaGancio));
  check('e il testo non si perde mai', true, senzaGancio.indexOf('in Node non esiste un indice') > 0);
}

sezione('La gomma sulla fonte conserva l’ultimo aspetto della citazione, anche riaprendo');
{
  const fs=require('fs'),os=require('os'),E=require('../lib/evidenze');
  const vault=fs.mkdtempSync(path.join(os.tmpdir(),'studia-colore-citato-'));
  try {
    const corso='prova', voce={exact:'memoria',capitoloId:'c1',colore:'#fdf14d',tratto:'sotto',nota:'personale'};
    const id=E.aggiungi(vault,corso,voce).evidenza.id;
    const md='[==memoria==](ev:'+id+')';
    const parser=CAP.crea({evidenza:chiave=>{
      const d=E.leggi(vault,corso),v=d.evidenze.find(e=>e.id===chiave);
      const s=(d.stiliRimossi||[]).find(e=>e.id===chiave);
      return v || (s ? {...s,rimossa:true} : null);
    }});
    E.colora(vault,corso,id,'#ff8ad0'); E.tratta(vault,corso,id,'overlay');
    E.rimuovi(vault,corso,id);
    const d=E.leggi(vault,corso),h=parser.mdToHtml(md,true);
    check('la parola non torna nell’elenco',0,d.evidenze.length);
    check('rimangono solo id, ultimo colore e tratto',
      [{id,colore:'#ff8ad0',tratto:'overlay'}],d.stiliRimossi);
    check('il parser conserva il colore dopo la rilettura da disco',true,h.includes('--ev:#ff8ad0'));
    check('e conserva il fondo pieno',true,h.includes('data-tratto="overlay"'));
    check('non applica la classe grigia',false,h.includes('evorfana'));
    check('non inventa un link al segno cancellato',false,h.includes('evlink'));
    check('lo stile non si mescola con un altro zaino',0,(E.leggi(vault,'altro').stiliRimossi||[]).length);
    E.aggiungi(vault,corso,{exact:'altro',capitoloId:'c1'});
    check('un salvataggio successivo conserva lo stile rimosso',d.stiliRimossi,E.leggi(vault,corso).stiliRimossi);
    E.aggiungi(vault,corso,{...voce,colore:'#6fdcff'});
    check('risegnando lo stesso punto prevale il nuovo colore',true,parser.mdToHtml(md,true).includes('--ev:#6fdcff'));
    check('e non resta una seconda copia del vecchio stile',[],E.leggi(vault,corso).stiliRimossi);
    E.salva(vault,corso,[]);
    check('anche la cancellazione in blocco conserva l’aspetto',true,parser.mdToHtml(md,true).includes('--ev:#6fdcff'));
    const strato=E.creaStrato(vault,corso,'Seconda lettura').strato;
    const e=E.aggiungi(vault,corso,{...voce,strato:strato.id}).evidenza;
    E.rimuoviStrato(vault,corso,strato.id,'via');
    check('anche togliendo una lettura si conserva il colore',true,
      E.leggi(vault,corso).stiliRimossi.some(s=>s.id===e.id&&s.colore==='#fdf14d'));
  } finally {fs.rmSync(vault,{recursive:true,force:true});}
}

sezione('Un\'evidenza senza colore non scrive una variabile vuota');
{
  const h = P._mdInline('[==tinta persa==](ev:dd44ee55ff66)');
  check('il segno c\'è', true, /<mark class="evid"/.test(h));
  check('ma non una variabile senza valore', false, /--ev:"/.test(h));
  check('e l\'ancora resta', true, /evlink/.test(h));
}

sezione('`==testo==` scritto a mano, o tornato da Obsidian');
{
  const h = P._mdInline('Questo è ==importante== davvero.');
  check('diventa un segno anche senza citare niente', true, /<mark class="evid">importante<\/mark>/.test(h));
  check('senza ancora, perché non c\'è dove andare', false, /evlink/.test(h));
  check('e senza colore proprio: lo dà il foglio di stile', false, /--ev:/.test(h));
}

sezione('⚠️ Quello che NON deve diventare un\'evidenziatura');
{
  /* Senza la guardia sullo spazio, una riga di codice o una formula si
     accenderebbero da sole: `a == b` non è un segno di nessuno. */
  check('un doppio uguale fra spazi', false, /<mark/.test(P._mdInline('se a == b allora c == d')));
  check('un uguale solo', false, /<mark/.test(P._mdInline('x = 3')));
  check('due segni senza niente in mezzo', false, /<mark/.test(P._mdInline('scrivi ==== così')));
}

sezione('Il testo passa dall\'escape, come tutto il resto');
{
  const h = P._mdInline('[==Anna & <b>Bruno</b>==](ev:9f2c1a4b7e01)');
  check('l\'HTML dentro il segno non diventa HTML', false, /<b>/.test(h));
  check('la e commerciale è scappata una volta sola', true, h.indexOf('Anna &amp; ') > 0);
  check('e non due', false, /&amp;amp;/.test(h));
}

sezione('Convive con gli altri rimandi sulla stessa riga');
{
  const h = P._mdInline('[==la frase==](ev:9f2c1a4b7e01) — [p. 7](pdf:03#p=7)');
  check('il segno c\'è', true, /<mark class="evid"/.test(h));
  check('e il rimando alla pagina pure', true, /class="plink"/.test(h));
  /* ⚠️ Il segno si riconosce PRIMA del link normale: quella regex matcha anche
     questo, e il testo uscirebbe da un'ancora qualunque con i due `==` a vista.
     È la stessa precedenza già pagata dalle figure. */
  check('e nessuno dei due ha mangiato l\'altro', false, /==/.test(h));
}

sezione('Dentro un capitolo, e dentro un riquadro');
{
  const h = P.mdToHtml('> [!nota] Da ricordare\nnon si usa qui', true);
  check('mdToHtml non si rompe', true, typeof h === 'string');
  const b = P.mdToHtml('- primo [==segnato==](ev:9f2c1a4b7e01)\n- secondo', true);
  check('un segno dentro un elenco puntato regge', true,
    /<li>primo <a href="#" class="evlink"/.test(b));
}

sezione('La POSTILLA si eredita, come il colore');
{
  /* ⚠️ Nel markdown c'è la CITAZIONE, non il dato: la postilla vive
     nell'evidenza e l'appunto la CHIEDE al momento di disegnare. Copiarla nel
     markdown la farebbe divergere al primo ritocco — è la regola P1.1-bis,
     la stessa per cui ricolorare una parola chiave cambia anche gli appunti. */
  const h = P._mdInline('Qui [==il passaggio==](ev:be77cc88dd99) non torna.');
  check('la postilla finisce nel title del segno', true,
    h.indexOf('title="contraddice p. 4"') > 0);
  check('e il segno la dichiara, per chi vuole vederla a colpo d\'occhio', true,
    /data-postilla="1"/.test(h));
  check('nel markdown la postilla NON è scritta', false, /contraddice/.test(
    'Qui [==il passaggio==](ev:be77cc88dd99) non torna.'));

  /* ⚠️ Due `title` annidati: si legge quello più interno solo se quello esterno
     non c'è. Con una postilla, la cosa da leggere passandoci sopra è LEI —
     dove porta il link lo dice già il cursore. */
  check('l\'ancora non copre la postilla col suo title', false,
    /class="evlink"[^>]*title=/.test(h));
  const senza = P._mdInline('Qui [==altra frase==](ev:9f2c1a4b7e01) invece sì.');
  check('ma senza postilla l\'ancora dice ancora dove porta', true,
    /class="evlink"[^>]*title="Torna dove l/.test(senza));
  check('e il segno senza postilla non ha title', false, /<mark[^>]*title=/.test(senza));

  /* Un riferimento privo anche dello stile conservato resta neutro:
     la postilla di un'altra evidenza non deve colorarlo. */
  check('l\'orfana non è cambiata', true,
    /evorfana/.test(P._mdInline('[==sparita==](ev:000000000000)')));
}

console.log('\n' + (ko ? '✗ ' + ko + ' controlli falliti  (' + (ok + ko) + ' controlli)'
                       : '✓ tutto verde  (' + ok + ' controlli)'));
process.exit(ko ? 1 : 0);
