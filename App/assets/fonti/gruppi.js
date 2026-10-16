(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FontiGruppi = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // L'ordine è dell'utente; il disco decide soltanto quali fonti esistono ancora.
  function testo(v) { return typeof v === 'string' ? v.trim() : ''; }
  function lista(v) { return Array.isArray(v) ? v : []; }
  function nomeFile(v) { return typeof v === 'string' && !!v && !/[\\/\x00]/.test(v) && v !== '.' && v !== '..'; }
  function tutti(stato) {
    return lista(stato && stato.gruppi).reduce(function (acc, g) {
      return acc.concat(lista(g && g.files));
    }, []).concat(lista(stato && stato.liberi));
  }

  function normalizza(stato, nomiFiles) {
    var s = stato || {}, reali = new Set(lista(nomiFiles).filter(nomeFile)), visti = new Set(), ids = new Set();
    function prendi(files) {
      return lista(files).filter(function (f) {
        if (!reali.has(f) || visti.has(f)) return false;
        visti.add(f); return true;
      });
    }
    var gruppi = [];
    lista(s.gruppi).forEach(function (g) {
      if (!g || !testo(g.id) || !testo(g.nome) || ids.has(g.id)) return;
      ids.add(g.id);
      gruppi.push({ id: g.id, nome: testo(g.nome), chiuso: g.chiuso === true, files: prendi(g.files) });
    });
    var liberi = prendi(s.liberi);
    reali.forEach(function (f) { if (!visti.has(f)) liberi.push(f); });
    return { versione: 1, gruppi: gruppi, liberi: liberi };
  }
  function copia(stato) { return normalizza(stato, tutti(stato)); }
  function gruppo(stato, id) { return stato.gruppi.find(function (g) { return g.id === id; }); }
  function posizione(indice, lunghezza) {
    return typeof indice === 'number' && Number.isFinite(indice)
      ? Math.max(0, Math.min(Math.trunc(indice), lunghezza)) : lunghezza;
  }
  function crea(stato, id, nome) {
    var s = copia(stato);
    if (testo(id) && testo(nome) && !gruppo(s, id)) s.gruppi.push({ id: id, nome: testo(nome), chiuso: false, files: [] });
    return s;
  }
  function rinomina(stato, id, nome) {
    var s = copia(stato), g = gruppo(s, id);
    if (g && testo(nome)) g.nome = testo(nome);
    return s;
  }
  function elimina(stato, id) {
    var s = copia(stato), g = gruppo(s, id);
    if (g) { s.liberi = s.liberi.concat(g.files); s.gruppi = s.gruppi.filter(function (x) { return x.id !== id; }); }
    return s;
  }
  // Indice indica la posizione FINALE: si misura dopo aver tolto il file da dov'era.
  function sposta(stato, file, gruppoId, indice) {
    var s = copia(stato), g = gruppo(s, gruppoId);
    if ((gruppoId !== '' && !g) || tutti(s).indexOf(file) < 0) return s;
    s.gruppi.forEach(function (x) { x.files = x.files.filter(function (f) { return f !== file; }); });
    s.liberi = s.liberi.filter(function (f) { return f !== file; });
    var destinazione = g ? g.files : s.liberi;
    destinazione.splice(posizione(indice, destinazione.length), 0, file);
    return s;
  }
  function ordinaGruppo(stato, id, indice) {
    var s = copia(stato), g = gruppo(s, id);
    if (g) {
      s.gruppi = s.gruppi.filter(function (x) { return x.id !== id; });
      s.gruppi.splice(posizione(indice, s.gruppi.length), 0, g);
    }
    return s;
  }
  function toggle(stato, id) {
    var s = copia(stato), g = gruppo(s, id);
    if (g) g.chiuso = !g.chiuso;
    return s;
  }
  function rinominaFile(stato, vecchio, nuovo) {
    var s = copia(stato), nomi = tutti(s);
    if (!nomeFile(nuovo) || nomi.indexOf(vecchio) < 0 || nomi.indexOf(nuovo) >= 0) return s;
    function sostituisci(f) { return f === vecchio ? nuovo : f; }
    s.gruppi.forEach(function (g) { g.files = g.files.map(sostituisci); });
    s.liberi = s.liberi.map(sostituisci);
    return s;
  }

  // Il bersaglio descrive ciò che si vede, non un indice calcolato prima di togliere l'origine.
  function trascina(stato, origine, bersaglio) {
    var s = copia(stato), o = origine || {}, b = bersaglio || {};
    if (o.file) {
      if (o.file === b.file) return s;
      var g = gruppo(s, b.gruppo), files = g ? g.files : s.liberi;
      if (b.gruppo && !g) return s;
      files = files.filter(function (f) { return f !== o.file; });
      var i = b.file ? files.indexOf(b.file) : files.length;
      if (i < 0) return s;
      return sposta(s, o.file, b.gruppo || '', i + (b.file && b.dopo ? 1 : 0));
    }
    if (o.gruppo && b.gruppo && o.gruppo !== b.gruppo) {
      var altri = s.gruppi.filter(function (g) { return g.id !== o.gruppo; });
      var indice = altri.findIndex(function (g) { return g.id === b.gruppo; });
      if (indice >= 0) return ordinaGruppo(s, o.gruppo, indice + (b.dopo ? 1 : 0));
    }
    return s;
  }

  return { normalizza: normalizza, crea: crea, rinomina: rinomina, elimina: elimina,
    sposta: sposta, ordinaGruppo: ordinaGruppo, toggle: toggle, rinominaFile: rinominaFile, trascina: trascina };
}));
