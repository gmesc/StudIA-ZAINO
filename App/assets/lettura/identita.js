/* ============================================================================
   lettura/identita.js — chi è un capitolo, e come lo si ritrova domani
   ============================================================================
   Il problema che questo file esiste per risolvere è l'ULTIMO modo rimasto, in
   StudIA, di perdere lavoro dell'utente.

   Un appunto, un'evidenza, un nodo di mappa e un rimando `cap:…` dicono a quale
   capitolo appartengono scrivendone l'ID. Se quell'id **dipende dalla
   posizione** del capitolo nella lezione, una rigenerazione che ne infila uno in
   mezzo sposta l'id di tutti quelli dopo — e da quel momento ogni riferimento
   scritto prima punta al capitolo sbagliato, o a nessuno. Non c'è un errore da
   nessuna parte: le parole chiave semplicemente non si accendono più, e gli
   appunti finiscono sotto «altri capitoli».

   ⚠️ COME STANNO LE COSE OGGI, contato sui 243 capitoli del vault:

     · **tutti** hanno un `id:` scritto nel frontmatter del `.md`;
     · in un corso su due quell'id **non** coincide con quello che il lettore
       usava, perché il lettore lo RICALCOLAVA dalla posizione. In TD74-DSA sono
       210 capitoli su 210 (`td74-07-disturbi-scrittura-c02` sul disco contro
       `07-disturbi-scrittura-c02` nel lettore); in ai-literacy i 33 capitoli
       coincidono, e per loro non cambia niente.

   Cioè: per due terzi del vault ci sono due identificatori per la stessa cosa,
   e tutto quello che l'utente ha scritto finora porta il SECONDO. Passare al
   primo di colpo staccherebbe ogni riferimento esistente in quel corso —
   esattamente il danno da evitare.

   Quindi qui non si sceglie: si tiene una **catena**. Un capitolo ha un id
   stabile (quello scritto sul disco, che una rigenerazione può conservare) e
   conserva come ALIAS quello posizionale di prima. Un riferimento combacia se
   corrisponde all'uno **o** all'altro. I riferimenti nuovi nascono con l'id
   stabile; i vecchi continuano a trovare la loro strada.

   ⚠️ Questo file non risolve tutto da solo: perché l'id stabile sia davvero
   stabile, la pipeline deve CONSERVARLO quando rigenera una lezione invece di
   ricalcolarlo dall'ordine (`lib/genera.js`, `scriviCapitolo`). Finché non lo
   fa, questa catena rende il passaggio possibile senza rompere niente — che è
   la metà del lavoro che si può fare senza toccare i dati di nessuno.
   ============================================================================ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.LetturaIdentita = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function str(v) { return v == null ? '' : String(v); }

  /** L'id posizionale: `<cartella della lezione>-cNN`. È quello che il lettore
   *  ha usato fino all'11 agosto 2026, ed è quello scritto in tutti gli appunti,
   *  le evidenze e le mappe fatte prima. Non si può smettere di riconoscerlo. */
  function posizionale(lessonId, order) {
    return str(lessonId) + '-c' + String(order == null ? 0 : order).padStart(2, '0');
  }

  /* Un id valido è una parola: niente spazi, niente barre. ⚠️ La guardia non è
     formale — un id finisce in un attributo HTML (`data-cap`) e dentro un
     selettore: uno spazio lo spezza, una barra lo fa sembrare un percorso. */
  function valido(id) {
    return /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(str(id));
  }

  /**
   * L'identità di un capitolo: quella buona, e quella da riconoscere ancora.
   *
   * `fm` è il frontmatter già letto. Si preferisce l'id scritto sul disco
   * perché è l'unico che una rigenerazione può conservare: quello posizionale,
   * per definizione, cambia appena l'ordine cambia.
   */
  function di(fm, lessonId, order) {
    const scritto = str(fm && fm.id).trim();
    const pos = posizionale(lessonId, order);
    const id = valido(scritto) ? scritto : pos;
    return { id: id, alias: id === pos ? [] : [pos] };
  }

  /** Tutti i nomi con cui un capitolo risponde, senza vuoti né doppioni. */
  function nomi(cap) {
    const out = [];
    if (!cap) return out;
    [cap.id, cap.idLegacy].concat(cap.alias || []).forEach(function (n) {
      const s = str(n);
      if (s && out.indexOf(s) < 0) out.push(s);
    });
    return out;
  }

  /**
   * Questo riferimento parla di questo capitolo?
   *
   * ⚠️ Il confronto è contro TUTTI i nomi, non solo l'id corrente. È la riga per
   * cui esiste il file: un'evidenza salvata sei mesi fa porta il nome di allora,
   * e chiederle di conoscere quello di oggi vorrebbe dire cancellarla.
   */
  function stesso(riferimento, cap) {
    const r = str(riferimento);
    if (!r) return false;
    return nomi(cap).indexOf(r) >= 0;
  }

  /** Fra i capitoli di una lezione, quello a cui un riferimento appartiene.
   *  `-1` se non c'è: chi chiama lo dice, invece di aprire il primo per caso. */
  function indiceDi(riferimento, capitoli) {
    const lista = capitoli || [];
    for (let i = 0; i < lista.length; i++) if (stesso(riferimento, lista[i])) return i;
    return -1;
  }

  return { posizionale: posizionale, valido: valido, di: di, nomi: nomi, stesso: stesso, indiceDi: indiceDi };
}));
