/* ============================================================================
   appunti/scrivibile.js — le due decisioni dell'anteprima che si scrive
   ============================================================================
   Nell'affiancata ◫ si scrive anche nella parte RESA, un blocco per volta: si
   clicca, quel pezzo torna markdown in un campo, ⌘Invio tiene, Esc annulla, e
   si riscrivono SOLO le righe di quel blocco. Il montaggio sta nel renderer;
   qui stanno le due domande che si possono sbagliare in silenzio, e che perciò
   si provano in Node senza DOM né Electron:

     1. **dove finisce il cursore** quando si clicca in mezzo a una parola. Il
        campo contiene il MARKDOWN, il click è avvenuto sul TESTO RESO: fra i
        due c'è la sintassi, che nel reso non si vede. Senza questo conto il
        cursore andava in fondo al blocco, e per correggere una parola all'inizio
        di sei righe bisognava riattraversarle tutte.
     2. **che cos'è un blocco** in un elenco. Otto voci di seguito sono UN blocco
        di righe piene, quindi un solo campo con otto righe dentro: cliccare la
        terza apriva tutte e otto. Qui si dice quando un elenco si può aprire
        voce per voce — e quando no, che è la metà che conta.

   ⚠️ Nessuna delle due indovina. Se l'allineamento non torna o l'elenco non ha
   la forma semplice, si risponde «non lo so» (`null`) e il renderer fa quello
   che faceva prima: un campo solo, cursore in fondo. Un cursore nel punto
   sbagliato è peggio di un cursore in fondo, perché chi scrive se ne accorge
   solo dopo aver battuto.
   ============================================================================ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.AppuntiScrivibile = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function str(v) { return typeof v === 'string' ? v : (v == null ? '' : String(v)); }
  function spazio(c) { return c === ' ' || c === '\t' || c === '\n' || c === '\r' || c === ' '; }

  /**
   * Dal punto toccato nel TESTO RESO alla posizione nel MARKDOWN.
   *
   * L'allineamento è avido e a due dita: si scorre il sorgente e il testo reso
   * insieme; dove i caratteri coincidono avanzano tutti e due, dove no avanza
   * solo il sorgente — ed è lì che stanno gli asterischi del grassetto, le
   * parentesi di un rimando, il cancelletto di un titolo. Quando il reso ha
   * consumato `off` caratteri, la posizione nel sorgente è la risposta.
   *
   * ⚠️ Gli spazi si trattano a parte: il reso li collassa (due spazi diventano
   * uno, un a capo diventa uno spazio) e confrontarli alla lettera farebbe
   * perdere il passo a metà riga. Un bianco vale un bianco, quanti che siano.
   *
   * ⚠️ E se il conto non torna — testo che non si ritrova, offset oltre la fine
   * — si risponde `null`. Chi chiama sa che vuol dire «mettilo in fondo, come
   * prima»: un cursore piazzato per finta in mezzo a una parola sbagliata
   * costerebbe una correzione a chi scrive, e nessuno saprebbe perché.
   */
  function posSorgente(md, reso, off) {
    var src = str(md), testo = str(reso);
    var n = Math.trunc(Number(off));
    if (!src || !isFinite(n) || n < 0) return null;
    if (n > testo.length) return null;
    var i = 0, j = 0;
    while (i < src.length && j < n) {
      var a = src.charAt(i), b = testo.charAt(j);
      if (spazio(a) && spazio(b)) {
        while (i < src.length && spazio(src.charAt(i))) i++;
        while (j < testo.length && spazio(testo.charAt(j))) j++;
        continue;
      }
      if (a === b) { i++; j++; continue; }
      i++;                                   // sintassi: c'è nel sorgente, non nel reso
    }
    if (j !== n) return null;
    /* ⚠️ Il cursore si mette DAVANTI al carattere che si vede, non davanti alla
       sintassi che lo precede: fermandosi qui, cliccare sulla «m» di una parola
       in grassetto lo lasciava fra i due asterischi, e la prima lettera battuta
       finiva dentro il marcatore invece che nella parola. Si scavalca fino al
       prossimo carattere del reso — con un tetto, perché se non lo si trova
       lì vicino vuol dire che l'allineamento non regge più, e allora si resta
       dov'era invece di correre in fondo al file. */
    if (j < testo.length) {
      var c = testo.charAt(j), k = i, tetto = i + 40;
      while (k < src.length && k < tetto && src.charAt(k) !== c) k++;
      if (k < src.length && src.charAt(k) === c) return k;
    }
    return i;
  }

  /**
   * Le voci di un elenco, una per riga — o `null` se questo elenco non si tocca.
   *
   * Si dice di sì solo alla forma semplice: ogni riga è una voce di PRIMO
   * livello (`- testo`, `1. testo`), nessuna indentata sotto un'altra, nessuna
   * riga di continuazione. Un elenco annidato, o una voce che prosegue sulla
   * riga dopo, resta un blocco solo.
   *
   * ⚠️ Il perché del rifiuto, e non è prudenza generica: le voci qui diventano
   * i confini con cui si RISCRIVE il file dell'utente (`replaceRange` fra due
   * righe). Sbagliare un confine su un elenco annidato non fa un cursore
   * storto: fa una voce che si mangia le sue figlie.
   */
  function vociElenco(righe) {
    if (!Array.isArray(righe) || righe.length < 2) return null;
    var out = [];
    for (var i = 0; i < righe.length; i++) {
      var r = str(righe[i]);
      if (/^\s{2,}/.test(r)) return null;               // indentata: annidata o continuazione
      var m = /^\s?([-*+]|\d{1,3}[.)])\s+\S/.exec(r);
      if (!m) return null;                              // non è una voce: non è un elenco semplice
      out.push(i);
    }
    return out;
  }

  /**
   * Marca i `<li>` di primo livello come blocchi, uno per voce.
   *
   * ⚠️ Si contano PRIMA: se i `<li>` non sono tanti quante le voci, l'HTML non è
   * quello che si crede — un elenco annidato sfuggito, una voce che il renderore
   * ha fuso — e si restituisce l'html com'era. Marcare a metà darebbe blocchi
   * con le coordinate di righe altrui, cioè scritture nel posto sbagliato.
   */
  function marcaVoci(html, righe, base) {
    var h = str(html);
    var v = vociElenco(righe);
    if (!v) return h;
    var quanti = (h.match(/<li(?=[\s>])/g) || []).length;
    if (quanti !== v.length) return h;
    if (/<li[^>]*>[\s\S]*?<(ul|ol)[\s>]/.test(h)) return h;   // un annidato che vociElenco non ha visto
    var da = Math.trunc(Number(base)) || 0, k = 0;
    return h.replace(/<li(?=[\s>])/g, function (m) {
      var riga = da + v[k++];
      return '<li class="mdb" data-da="' + riga + '" data-a="' + riga + '"';
    });
  }

  return { posSorgente: posSorgente, vociElenco: vociElenco, marcaVoci: marcaVoci };
}));
