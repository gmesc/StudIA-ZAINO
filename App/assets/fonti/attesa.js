/* ============================================================================
   fonti/attesa.js — aspettare una CONDIZIONE, non un numero
   ============================================================================
   Una funzione sola: `attendi(prova, opz)` guarda ogni tanto se una cosa è
   diventata vera, e risponde quando lo è o quando ha rinunciato. Mai «forse».

   ⚠️ PERCHÉ ESISTE, ED È UN DIFETTO MISURATO. Chi clicca un risultato della
   lente su una pagina di un PDF passa da qui:

       openPdf(documento, pagina)          // asincrono: il viewer deve disegnare
       setTimeout(function(){ … }, 600)    // ⚠️ un numero, non una condizione

   Seicento millisecondi, sperando che il documento sia pronto. È l'anti-pattern
   che le prove di questo progetto dichiarano nero su bianco in testa a
   `test/cdp/prova-pdf.js` — «un `sleep` fisso o mente sulle macchine lente o
   spreca tempo su quelle veloci» — e qui non è teoria: `GUIDA-ARCHITETTO.md` §6
   registra che **il layer di testo di un PDF da 266 pagine arriva dopo 12,4
   secondi su un Mac Intel**, invece di 1-2.

   Che cosa succede quando il numero è troppo corto: la ricerca parte da dove il
   visualizzatore si trova in quel momento, e **l'occorrenza giusta la si
   manca** — si atterra sulla pagina ma non sul punto, o su un'altra pagina del
   tutto. È il difetto della specie peggiore: **invisibile sulla macchina di chi
   l'ha scritto, sistematico su una più lenta**. La stessa forma delle otto
   prove rosse dell'Intel del 16 agosto, che erano attese troppo corte e non
   guasti.

   ⚠️ E PERCHÉ È UN MODULO invece di tre righe sul posto. Perché un'attesa ha
   quattro modi di sbagliare che non si vedono guardando, e tre di essi lasciano
   l'app in uno stato che nessuno saprebbe spiegare:

     · **non finisce mai** — la condizione non diventa vera e non c'è un tetto:
       chi ha chiamato resta appeso per sempre, e non c'è niente a schermo che
       lo dica;
     · **risponde DUE volte** — la condizione diventa vera un istante dopo la
       rinuncia, e chi chiama esegue il seguito due volte. Su una ricerca vuol
       dire due salti di pagina, il secondo inspiegabile;
     · **lascia acceso un timer** — l'attesa finisce e il battito continua a
       girare, e con lui la chiusura che si porta dietro;
     · **aspetta un giro anche quando è già pronto** — la condizione era vera
       dal primo istante, e si è aspettato lo stesso. Su una macchina veloce è
       il difetto opposto a quello che si voleva togliere.

   ⚠️ L'OROLOGIO E IL TIMER SI FANNO PASSARE, e non è pulizia: è la condizione
   per provare tutto questo in Node con un tempo FINTO, in quaranta millisecondi
   e senza incertezza. Un'attesa provata col tempo vero è una prova che a volte
   passa. È la stessa scelta di `suMac(nav)` in `tasti/nomi.js`, che si fa
   passare il navigatore invece di leggerlo da sé.

   Che cosa NON sta qui: **quale** condizione aspettare. Quella la conosce solo
   chi ha il DOM davanti — ed è una scelta delicata, perché «il documento è
   aperto» e «la pagina è a schermo» sono due fatti diversi.

     node test/attesa-fonte.js
   ============================================================================ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FontiAttesa = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* Il tetto: quanto si aspetta prima di dire che non ce l'abbiamo fatta.
     ⚠️ Venti secondi non sono generosità, sono una MISURA con un margine: il
     layer di testo di un documento da 266 pagine arriva dopo 12,4 secondi su un
     Mac Intel, e un tetto più corto di così trasformerebbe una macchina lenta
     in un'app rotta. Chi aspetta non paga il tetto: paga la condizione, che su
     una macchina veloce è vera al primo sguardo. */
  var TETTO = 20000;

  /* Ogni quanto si riguarda. Abbastanza spesso da non farsi sentire (un occhio
     nota un ritardo attorno ai 100 ms), abbastanza di rado da non pesare su un
     documento che sta disegnando. */
  var PASSO = 80;

  /**
   * `prova`: una funzione senza argomenti che risponde vero quando è ora.
   * `opz`:
   *   `tetto`  millisecondi oltre i quali si rinuncia (di fabbrica TETTO)
   *   `passo`  ogni quanto si riguarda (di fabbrica PASSO)
   *   `ora`    che ora è — si fa passare per poter provare col tempo finto
   *   `dopo`   come si chiede di essere richiamati — idem
   *
   * → una Promise che si risolve con `{ pronto, ms, sguardi }`. **Sempre**, e
   *   **una volta sola**: non si rifiuta mai, perché «non è arrivato in tempo»
   *   è una risposta e non un guasto — chi chiama deve poterla leggere e
   *   dirlo a chi guarda, non prendersi un'eccezione da qualche parte.
   */
  function attendi(prova, opz) {
    var o = opz || {};
    var tetto = (typeof o.tetto === 'number' && o.tetto >= 0) ? o.tetto : TETTO;
    var passo = (typeof o.passo === 'number' && o.passo > 0) ? o.passo : PASSO;
    var ora = o.ora || function () { return Date.now(); };
    var dopo = o.dopo || function (fn, ms) { return setTimeout(fn, ms); };
    var inizio = ora();
    var sguardi = 0;

    return new Promise(function (risolvi) {
      /* ⚠️ Una risposta sola, e la guardia sta QUI perché di qui passano tutte
         e due le uscite. Senza, la condizione che diventa vera un istante dopo
         la rinuncia farebbe eseguire il seguito DUE volte — su una ricerca,
         due salti di pagina, e il secondo inspiegabile. */
      var risposto = false;
      function chiudi(pronto) {
        if (risposto) return;
        risposto = true;
        risolvi({ pronto: !!pronto, ms: ora() - inizio, sguardi: sguardi });
      }

      function guarda() {
        sguardi++;
        var ok = false;
        /* ⚠️ Una `prova` che solleva NON deve rompere l'attesa: interroga il
           DOM, e il DOM in mezzo a un ridisegno risponde in modi che non si
           prevedono. Un'eccezione qui vuol dire «non ancora», non «mai». */
        try { ok = !!prova(); } catch (e) { ok = false; }
        if (ok) return chiudi(true);
        /* Il tetto si guarda DOPO la condizione: allo scadere esatto, se la
           cosa è pronta, è pronta — rinunciare un millisecondo prima di una
           risposta che c'è è il modo più stupido di fallire. */
        if (ora() - inizio >= tetto) return chiudi(false);
        dopo(guarda, passo);
      }

      /* ⚠️ SI GUARDA SUBITO, senza aspettare il primo battito. Chi arriva a
         cose già fatte — ed è il caso normale su una macchina veloce — non deve
         pagare un ritardo per un'attesa che non serviva. Era il difetto opposto
         a quello che si sta togliendo, e sarebbe stato altrettanto invisibile. */
      guarda();
    });
  }

  return { attendi: attendi, TETTO: TETTO, PASSO: PASSO };
}));
