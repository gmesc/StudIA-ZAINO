/* leve — il catalogo delle leve del profilo di apprendimento.
 *
 * Che cos'è: l'elenco dei menu della scheda ⚙ Impostazioni › Utente, con le
 * loro varianti e con il modo di costruire un profilo che contenga SOLO quella
 * scelta. Serve all'Atlante delle opzioni (la pagina che spiega ogni menu) e
 * alle prove.
 *
 * ⚠️ Che cosa questo file NON contiene, di proposito: le direttive. Quelle
 * vivono in `lib/profilo.js` e sono l'unica verità — l'Atlante le CHIEDE a
 * `directives()` invece di ricopiarle. Un elenco di spiegazioni scritto a mano
 * accanto al codice che spiega è la trappola ④: diverge al primo ritocco, e una
 * pagina che dice al lettore una direttiva che il prompt non contiene è peggio
 * di nessuna pagina. Stessa lezione dei crediti (`lib/crediti.js`).
 *
 * ⚠️ E non contiene nemmeno la FASE. «Questa leva cambia l'indice o il testo?»
 * non si dichiara: si misura, chiedendo a `directives()` se quella scelta
 * produce righe per la fase `proposta`, per la `generazione`, o per entrambe.
 * Dichiararla avrebbe voluto dire poterla sbagliare.
 *
 * Le varianti qui elencate devono coincidere con le `<option>` dei `<select>`
 * in `App/StudIA.html`: è una seconda copia, e `test/atlante.js` la tiene onesta
 * confrontandole a ogni corsa. Il giorno che i menu si costruiranno da questo
 * file, la copia sparisce e la prova con lei.
 *
 * UMD: `<script src>` nel browser, `require()` in Node (invariante 5).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.LeveProfilo = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* I sette menu «di che cosa ho bisogno»: ognuno contribuisce al massimo un
     token alla lista `bisogni` del profilo. La prima opzione è vuota — «nessuna
     difficoltà» — e non produce nessuna direttiva: è l'assenza di una scelta,
     non una scelta, e nell'Atlante non è una colonna. */
  const BISOGNI = [
    { chiave: 'lettura', etichetta: 'Lettura', id: 'lettura', varianti: [
      { valore: 'lettura-lenta', etichetta: 'Leggo lentamente e mi affatico' },
      { valore: 'lettura-decodifica', etichetta: 'Inciampo sulle parole lunghe o nuove' },
      { valore: 'lettura-comprensione', etichetta: 'Leggo bene ma perdo il filo del significato' }
    ] },
    { chiave: 'scrittura', etichetta: 'Scrittura', id: 'scrittura', varianti: [
      { valore: 'scrittura-ortografia', etichetta: 'Faccio spesso errori di ortografia' },
      { valore: 'scrittura-gesto', etichetta: 'Scrivere a mano è faticoso o poco leggibile' },
      { valore: 'scrittura-organizzazione', etichetta: 'Fatico a organizzare le idee per iscritto' }
    ] },
    { chiave: 'numeri', etichetta: 'Numeri e calcolo', id: 'numeri', varianti: [
      { valore: 'numeri-calcolo', etichetta: 'Il calcolo a mente è faticoso' },
      { valore: 'numeri-procedure', etichetta: 'Mi perdo nelle procedure a più passaggi' },
      { valore: 'numeri-quantita', etichetta: 'Fatico a stimare quantità e proporzioni' }
    ] },
    { chiave: 'attenzione', etichetta: 'Attenzione', id: 'attenzione', varianti: [
      { valore: 'attenzione-distraibilita', etichetta: 'Mi distraggo facilmente' },
      { valore: 'attenzione-avvio', etichetta: 'Fatico a iniziare, poi vado' },
      { valore: 'attenzione-iperfocus', etichetta: 'Iperfocus lungo, poi crollo' }
    ] },
    { chiave: 'spazio', etichetta: 'Spazio, mappe e schemi', id: 'spazio', varianti: [
      { valore: 'spazio-schemi', etichetta: 'Mappe e schemi mi confondono più del testo' },
      { valore: 'spazio-grafici', etichetta: 'Grafici e disposizioni spaziali sono faticosi' },
      { valore: 'spazio-orientamento', etichetta: 'Mi oriento male dentro documenti lunghi' }
    ] },
    { chiave: 'carico', etichetta: 'Carico e ambiente', id: 'carico', varianti: [
      { valore: 'carico-affollamento', etichetta: 'Le pagine affollate mi affaticano' },
      { valore: 'carico-prevedibilita', etichetta: 'Ho bisogno di una struttura sempre uguale' },
      { valore: 'carico-pause', etichetta: 'Ho bisogno di parti brevi con pause' }
    ] },
    { chiave: 'memoria', etichetta: 'Memoria', id: 'memoria', varianti: [
      { valore: 'memoria-lavoro', etichetta: 'Perdo i passaggi intermedi per strada' },
      { valore: 'memoria-richiamo', etichetta: 'Ricordo bene solo se ripasso spesso' }
    ] }
  ];

  /* Le leve esplicite: qui la scelta non è un bisogno ma una preferenza di
     forma, e finisce in un campo suo del profilo (le chiavi sono quelle di
     `lib/mdser.js`: snake_case nel file, camelCase nell'oggetto). */
  const SCELTE = [
    { chiave: 'stile_corso', etichetta: 'Stile del corso', id: 'profStileCorso', campo: 'stile_corso', varianti: [
      { valore: 'tematico', etichetta: 'Tematico — blocchi per argomento' },
      { valore: 'cronologico', etichetta: 'Cronologico — ordine di erogazione' },
      { valore: 'problemi', etichetta: 'Per problemi — parti da un caso' }
    ] },
    { chiave: 'stile_lezioni', etichetta: 'Stile delle lezioni', id: 'profStileLezioni', campo: 'stile_lezioni', varianti: [
      { valore: 'cornici', etichetta: 'Cornici e ponti — prima la mappa' },
      { valore: 'lineare', etichetta: 'Lineare — un passo alla volta' },
      { valore: 'spirale', etichetta: 'A spirale — si torna sui concetti' }
    ] },
    { chiave: 'stile_capitoli', etichetta: 'Stile dei capitoli', id: 'profStileCapitoli', campo: 'stile_capitoli', varianti: [
      { valore: 'discorsivo', etichetta: 'Discorsivo' },
      { valore: 'schematico', etichetta: 'Schematico' },
      { valore: 'esempi', etichetta: 'Esempi prima, teoria dopo' },
      { valore: 'domande', etichetta: 'Guidato da domande' }
    ] },
    { chiave: 'granularita', etichetta: 'Granularità', id: 'profGranularita', campo: 'granularita', varianti: [
      { valore: 'atomico', etichetta: 'Atomica — un concetto per capitolo' },
      { valore: 'medio', etichetta: 'Media — pochi concetti legati' },
      { valore: 'ampio', etichetta: 'Ampia — un tema intero per capitolo' }
    ] },
    { chiave: 'capitoli_brevi', etichetta: 'Capitoli brevi', id: 'profCapitoliBrevi', campo: 'capitoli_brevi', booleano: true, varianti: [
      { valore: 'true', etichetta: 'Sì — testi corti' },
      { valore: 'false', etichetta: 'No — testi distesi' }
    ] },
    { chiave: 'quiz', etichetta: 'Quiz', id: 'profQuiz', campo: 'quiz', varianti: [
      { valore: 'frequenti', etichetta: 'Frequenti — 5-6 per capitolo' },
      { valore: 'pochi', etichetta: 'Pochi — 2 per capitolo' },
      { valore: 'nessuno', etichetta: 'Nessuno' }
    ] },
    { chiave: 'glossario', etichetta: 'Glossario', id: 'profGlossario', campo: 'glossario', varianti: [
      { valore: 'esteso', etichetta: 'Esteso' },
      { valore: 'essenziale', etichetta: 'Essenziale' },
      { valore: 'nessuno', etichetta: 'Nessuno' }
    ] },
    { chiave: 'esempi_concreti', etichetta: 'Esempi concreti', id: 'profEsempiConcreti', campo: 'esempi_concreti', booleano: true, varianti: [
      { valore: 'true', etichetta: 'Sì — molti esempi' },
      { valore: 'false', etichetta: 'No — solo se servono' }
    ] },
    { chiave: 'approfondimenti', etichetta: 'Approfondimenti', id: 'profApprofondimenti', campo: 'approfondimenti', varianti: [
      { valore: 'ricchi', etichetta: 'Ricchi — digressioni collegate' },
      { valore: 'minimi', etichetta: 'Minimi — solo l\'essenziale' }
    ] }
  ];

  const LEVE = BISOGNI.map((l) => Object.assign({ tipo: 'bisogno' }, l))
    .concat(SCELTE.map((l) => Object.assign({ tipo: 'scelta' }, l)));

  /** La leva con quella chiave, o null. */
  function leva(chiave) { return LEVE.filter((l) => l.chiave === chiave)[0] || null; }

  /**
   * Un profilo che contiene SOLO quella scelta.
   *
   * È il cuore dell'Atlante: per sapere che cosa fa una variante da sola la si
   * chiede a `directives()` su un profilo vuoto tranne lei. Un profilo pieno
   * risponderebbe «tutto insieme», e le combo (`COMBO` in lib/profilo.js)
   * mescolerebbero due leve in una riga sola — che è giusto nel prompt vero,
   * ma nell'Atlante nasconderebbe proprio ciò che si vuole mostrare.
   */
  function profiloCon(chiave, valore) {
    const l = leva(chiave);
    if (!l || !valore) return { bisogni: [] };
    if (l.tipo === 'bisogno') return { bisogni: [valore] };
    const p = { bisogni: [] };
    p[l.campo] = l.booleano ? (valore === 'true') : valore;
    return p;
  }

  /**
   * L'atlante completo: per ogni leva, per ogni variante, le direttive che ne
   * escono nelle due fasi. `dirFn` è `directives` di lib/profilo.js, passata da
   * fuori perché questo modulo gira anche nel browser, dove `lib/` non esiste.
   *
   * `fase` di una variante NON è dichiarata: è dedotta da dove sono finite le
   * sue righe. `struttura` = tocca l'indice (fase proposta), `testo` = tocca la
   * scrittura del capitolo, `entrambe`, oppure `nessuna` — e quest'ultima è
   * un'informazione preziosa: quella scelta non arriva al modello.
   */
  function atlante(dirFn) {
    return LEVE.map(function (l) {
      const varianti = l.varianti.map(function (v) {
        const d = dirFn(profiloCon(l.chiave, v.valore));
        const proposta = d.proposta || [], generazione = d.generazione || [];
        return {
          valore: v.valore,
          etichetta: v.etichetta,
          proposta: proposta,
          generazione: generazione,
          fase: proposta.length && generazione.length ? 'entrambe'
            : proposta.length ? 'struttura'
              : generazione.length ? 'testo' : 'nessuna'
        };
      });
      return {
        chiave: l.chiave, etichetta: l.etichetta, tipo: l.tipo, id: l.id,
        // la leva tocca la struttura se almeno una sua variante lo fa
        struttura: varianti.some((v) => v.fase === 'struttura' || v.fase === 'entrambe'),
        varianti: varianti
      };
    });
  }

  return { LEVE: LEVE, BISOGNI: BISOGNI, SCELTE: SCELTE, leva: leva, profiloCon: profiloCon, atlante: atlante };
}));
