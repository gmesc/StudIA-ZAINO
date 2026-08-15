/* ============================================================================
   appunti/importa.js — i testi che arrivano da fuori e diventano appunti
   ============================================================================
   Un `.md` scritto altrove — Obsidian, un altro Mac, un'esportazione — è già la
   forma nativa di questo vault: non c'è niente da convertire, solo da capire
   che cosa tenere e che cosa dire.

   ⚠️ LE TRE COSE CHE SI PERDONO IN SILENZIO, se nessuno le dichiara:

   1. **Il frontmatter di un altro programma.** Gli appunti di StudIA hanno un
      frontmatter loro, con una LISTA BIANCA di chiavi (`lib/appunti.js`): tutto
      ciò che non è in quella lista sparisce alla prima riscrittura. `title` si
      recupera — è il titolo dell'appunto — ma le altre chiavi vanno messe nel
      corpo, o l'utente le perde senza saperlo.
   2. **I `[[wikilink]]`.** Dentro l'app puntano alle LEZIONI del contenitore, e
      quelli di un altro vault non troveranno niente: non è un guasto da
      riparare, è una cosa da dire.
   3. **Le immagini con percorso relativo.** `![](immagini/x.png)` cerca un file
      che qui non c'è: quelle vanno nell'album, ed è un secondo gesto.

   Nessun DOM, nessun `fs`: `<script src>` nel browser, `require()` in Node.

     node test/importa-testi.js
   ============================================================================ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.AppuntiImporta = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* Due megabyte: un appunto più lungo di così non è un appunto, è un corpus —
     e allora la sua strada è diventare una FONTE, non una nota che si apre in
     un editor. Il rifiuto lo dice. */
  var MAX_BYTE = 2 * 1024 * 1024;

  /* `.markdown` esiste ed è lo stesso formato: rifiutarlo per l'estensione
     lunga sarebbe una pedanteria che l'utente paga. */
  var ESTENSIONI = { '.md': 'md', '.markdown': 'md', '.txt': 'txt' };

  function str(v) { return v == null ? '' : String(v); }

  /** Che tipo di testo è, dal nome. `null` se non è un testo che sappiamo
   *  portare dentro. */
  function tipoDalNome(nome) {
    var m = /\.([A-Za-z0-9]+)$/.exec(str(nome));
    if (!m) return null;
    return ESTENSIONI['.' + m[1].toLowerCase()] || null;
  }

  /** «12 KB», come lo legge una persona. */
  function mega(byte) {
    var n = Number(byte) || 0;
    if (n < 1024 * 1024) return Math.max(1, Math.round(n / 1024)) + ' KB';
    return (Math.round(n / (1024 * 1024) * 10) / 10).toString().replace('.', ',') + ' MB';
  }

  /** Chi entra e chi no, coi motivi. Stessa forma di `AlbumFoto.accetta`: due
   *  import che rispondono in due modi diversi sarebbero due cose da imparare. */
  function accetta(elenco, max) {
    var tetto = Number(max) > 0 ? Number(max) : MAX_BYTE;
    var buone = [], scartate = [];
    (elenco || []).forEach(function (f) {
      var nome = str(f && f.nome);
      var quanto = Number((f && f.dimensione) || 0);
      var tipo = tipoDalNome(nome);
      if (!tipo) { scartate.push({ nome: nome, motivo: 'non è un testo' }); return; }
      if (quanto > tetto) {
        scartate.push({ nome: nome, motivo: 'pesa ' + mega(quanto) + ': più che un appunto è una fonte' });
        return;
      }
      if (!quanto) { scartate.push({ nome: nome, motivo: 'il file è vuoto' }); return; }
      buone.push({ nome: nome, dimensione: quanto, tipo: tipo });
    });
    return { buone: buone, scartate: scartate };
  }

  /** Il titolo dal nome del file: senza cartella e senza estensione. */
  function titoloDa(nome) {
    var n = str(nome).replace(/^.*[\\/]/, '').replace(/\.[A-Za-z0-9]{1,9}$/, '').trim();
    return n || 'Appunto importato';
  }

  var RE_FM = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

  /**
   * Da un file di testo a `{ titolo, corpo, avvisi, meta }`.
   *
   * Il titolo si cerca in tre posti, in quest'ordine: il `title` del
   * frontmatter, il primo titolo di primo livello del testo, il nome del file.
   * ⚠️ Il `# Titolo` trovato NON si toglie dal corpo: è testo che l'autore ha
   * scritto, e toglierlo perché ci somiglia vorrebbe dire che riaprendo
   * l'appunto manca una riga che c'era.
   */
  function daTesto(grezzo, nome) {
    var t = str(grezzo).replace(/^﻿/, '').replace(/\r\n?/g, '\n');
    var avvisi = [], meta = {};
    var titolo = '';

    var m = RE_FM.exec(t);
    if (m) {
      var resto = [];
      m[1].split('\n').forEach(function (riga) {
        var kv = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(riga);
        if (!kv) { if (riga.trim()) resto.push(riga); return; }
        var chiave = kv[1], valore = kv[2].trim().replace(/^["']|["']$/g, '');
        meta[chiave] = valore;
        if (chiave.toLowerCase() === 'title' && valore) titolo = valore;
        else resto.push(riga);
      });
      t = t.slice(m[0].length).replace(/^\n+/, '');
      /* ⚠️ Ciò che resta del frontmatter torna nel CORPO, dentro un blocco di
         codice: gli appunti di StudIA hanno una lista bianca di chiavi, e tutto
         il resto sparirebbe al primo salvataggio. Un blocco `yaml` si vede, si
         legge, e non finge di essere un frontmatter nostro. */
      if (resto.length) {
        t = '```yaml\n' + resto.join('\n') + '\n```\n\n' + t;
        avvisi.push('il frontmatter dell’altro programma è finito in cima all’appunto, come blocco di testo');
      }
    }

    if (!titolo) {
      var h = /^#\s+(.+)$/m.exec(t);
      if (h) titolo = h[1].trim();
    }
    if (!titolo) titolo = titoloDa(nome);

    if (/\[\[[^\]]+\]\]/.test(t)) {
      avvisi.push('i rimandi fra doppie parentesi puntano alle lezioni di questo contenitore: da un altro vault non troveranno niente');
    }
    /* Un'immagine con percorso relativo — non `album:`, non `http` — qui non
       esiste: il file è rimasto dov'era. */
    if (/!\[[^\]]*\]\((?!album:|https?:|data:)[^)]+\)/.test(t)) {
      avvisi.push('le immagini con percorso relativo non sono arrivate: portale nell’Album Foto e rimettile');
    }

    return { titolo: titolo, corpo: t.replace(/\s+$/, ''), avvisi: avvisi, meta: meta };
  }

  return {
    MAX_BYTE: MAX_BYTE, ESTENSIONI: ESTENSIONI,
    tipoDalNome: tipoDalNome, accetta: accetta, daTesto: daTesto, titoloDa: titoloDa, mega: mega
  };
}));
