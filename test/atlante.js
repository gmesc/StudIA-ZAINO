'use strict';
/* Le prove dell'Atlante delle opzioni.
 *
 * L'Atlante è una pagina che SPIEGA il profilo di apprendimento: per ogni menu,
 * che direttiva finisce nel prompt e che effetto ha. Una pagina così ha un modo
 * solo di essere inutile — dire una cosa diversa da quella che il codice fa.
 * Queste prove difendono esattamente quello, su tre fronti:
 *
 *  1. il catalogo (App/assets/dati/leve.js) elenca le stesse varianti che stanno
 *     nei <select> di App/StudIA.html — finché sono due copie, si controllano;
 *  2. nessuna leva è muta: due varianti della stessa leva devono produrre
 *     direttive diverse, o quella scelta non fa niente e l'utente non lo sa;
 *  3. ogni variante ha il suo esempio, e nessun esempio parla di una variante
 *     che non esiste più.
 *
 * ⚠️ La fase (struttura/testo) NON è dichiarata da nessuna parte: si deduce da
 * dove `directives()` mette le righe. Qui si controlla solo che la deduzione
 * abbia senso — che esista almeno una leva per parte, o vorrebbe dire che
 * qualcosa nella pipeline si è rotto.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const leve = require('../App/assets/dati/leve.js');
const profilo = require('../lib/profilo.js');

const RADICE = path.join(__dirname, '..');
const HTML = fs.readFileSync(path.join(RADICE, 'App', 'StudIA.html'), 'utf8');
const ESEMPI = JSON.parse(fs.readFileSync(path.join(RADICE, 'App', 'assets', 'dati', 'atlante-esempi.json'), 'utf8'));

let fatte = 0;
function prova(nome, fn) { fn(); fatte++; console.log('  ✓ ' + nome); }

console.log('atlante delle opzioni');

/* La scheda Utente delle impostazioni, ritagliata al momento: i confini di un
   blocco del monolite si calcolano adesso, mai da un grep di ieri. */
function schedaUtente() {
  const i = HTML.indexOf('<section class="set-pane" data-pane="utente"');
  assert.ok(i > 0, 'la scheda Utente non si trova più nel monolite');
  const f = HTML.indexOf('<!-- ============ CORSI', i);
  assert.ok(f > i, 'la fine della scheda Utente non si trova');
  return HTML.slice(i, f);
}

/** I valori delle <option> di un <select>, per id o per data-bisogno. */
function opzioniDi(sezione, leva) {
  const attr = leva.tipo === 'bisogno'
    ? 'data-bisogno="' + leva.chiave + '"'
    : 'id="' + leva.id + '"';
  const i = sezione.indexOf(attr);
  assert.ok(i > 0, 'menu non trovato nel markup: ' + (leva.id || leva.chiave));
  const chiusura = sezione.indexOf('</select>', i);
  const dentro = sezione.slice(i, chiusura);
  return [...dentro.matchAll(/<option value="([^"]*)"/g)].map((m) => m[1]).filter(Boolean);
}

prova('il catalogo elenca le stesse varianti dei menu', () => {
  const sez = schedaUtente();
  for (const l of leve.LEVE) {
    const nelMarkup = opzioniDi(sez, l);
    const nelCatalogo = l.varianti.map((v) => v.valore);
    assert.deepStrictEqual(nelCatalogo, nelMarkup,
      'catalogo e markup divergono su «' + l.chiave + '»: il catalogo dice [' + nelCatalogo +
      '], i menu dicono [' + nelMarkup + ']');
  }
});

prova('ogni variante di bisogno ha una regola in lib/profilo.js', () => {
  for (const l of leve.LEVE.filter((x) => x.tipo === 'bisogno')) {
    for (const v of l.varianti) {
      assert.ok(profilo.TOKEN[v.valore], 'token senza regola: ' + v.valore);
    }
  }
});

prova('nessuna variante è muta: ognuna arriva al prompt', () => {
  const atlante = leve.atlante(profilo.directives);
  const mute = [];
  for (const l of atlante) {
    for (const v of l.varianti) if (v.fase === 'nessuna') mute.push(l.chiave + '=' + v.valore);
  }
  assert.deepStrictEqual(mute, [],
    'queste scelte non producono nessuna direttiva: il menu le offre ma il modello non le riceve');
});

prova('nessuna leva è muta: le sue varianti si distinguono', () => {
  const atlante = leve.atlante(profilo.directives);
  for (const l of atlante) {
    const impronte = l.varianti.map((v) => JSON.stringify([v.proposta, v.generazione]));
    const distinte = new Set(impronte);
    assert.strictEqual(distinte.size, impronte.length,
      'la leva «' + l.chiave + '» ha varianti che producono le STESSE direttive: ' +
      'scegliere l\'una o l\'altra non cambia niente');
  }
});

prova('la fase si deduce, e ci sono leve per entrambe', () => {
  const atlante = leve.atlante(profilo.directives);
  const struttura = atlante.filter((l) => l.struttura);
  const testo = atlante.filter((l) => !l.struttura);
  assert.ok(struttura.length >= 3, 'nessuna leva tocca più l\'indice: la fase proposta è vuota?');
  assert.ok(testo.length >= 5, 'nessuna leva tocca più il testo?');
  // e una leva strutturale deve comparire davvero nel blocco della fase proposta
  const g = leve.profiloCon('granularita', 'atomico');
  const blocco = profilo.promptBlock(g, 'proposta');
  assert.ok(/1 capitolo = 1 concetto/.test(blocco),
    'la granularità è dichiarata strutturale ma non compare nel prompt della proposta');
});

prova('il testo libero del profilo NON entra nella fase proposta', () => {
  const p = { bisogni: [], comeImparo: 'CANARINO-COME', cosaAffatica: 'CANARINO-AFFATICA' };
  const proposta = profilo.promptBlock(p, 'proposta');
  const generazione = profilo.promptBlock(p, 'generazione');
  assert.ok(!/CANARINO/.test(proposta),
    'il testo libero è finito nella proposta: l\'Atlante promette il contrario');
  assert.ok(/CANARINO-COME/.test(generazione) && /CANARINO-AFFATICA/.test(generazione),
    'il testo libero non arriva più nemmeno alla generazione');
});

prova('ogni variante ha un esempio, e nessun esempio è orfano', () => {
  const attese = new Set();
  leve.LEVE.forEach((l) => l.varianti.forEach((v) => attese.add(l.chiave + '.' + v.valore)));
  const presenti = new Set(Object.keys(ESEMPI.esempi));
  const mancanti = [...attese].filter((k) => !presenti.has(k));
  const orfani = [...presenti].filter((k) => !attese.has(k));
  assert.deepStrictEqual({ mancanti, orfani }, { mancanti: [], orfani: [] });
});

prova('gli esempi dichiarano il tipo e dicono che cosa guardare', () => {
  for (const [k, e] of Object.entries(ESEMPI.esempi)) {
    assert.ok(['testo', 'indice'].includes(e.tipo), 'tipo non valido in ' + k + ': ' + e.tipo);
    assert.ok(e.reso && e.reso.length > 20, 'esempio troppo corto: ' + k);
    assert.ok(e.guarda && e.guarda.length > 20, 'esempio senza «che cosa guardare»: ' + k);
  }
});

prova('gli esempi dichiarano di essere illustrativi', () => {
  // invariante 4: una pagina che sembra mostrare l'uscita del modello e invece
  // mostra un testo scritto a mano deve dirlo, o mente a chi la legge
  assert.ok(/illustrativi/i.test(ESEMPI.avviso), 'manca l\'avviso che gli esempi sono illustrativi');
  assert.ok(ESEMPI.brano && ESEMPI.brano.testo.length > 300, 'manca il brano di prova');
  assert.ok(/invent/i.test(ESEMPI.brano.nota || ''), 'il brano non dichiara di essere inventato');
});

prova('l\'esempio di una variante strutturale mostra un indice', () => {
  // se «granularità: atomica» mostrasse un pezzo di prosa, l'Atlante
  // insegnerebbe il contrario di ciò che quella leva fa
  const atlante = leve.atlante(profilo.directives);
  for (const l of atlante) {
    for (const v of l.varianti.filter((x) => x.fase === 'struttura')) {
      const e = ESEMPI.esempi[l.chiave + '.' + v.valore];
      assert.strictEqual(e.tipo, 'indice',
        l.chiave + '=' + v.valore + ' agisce sull\'indice, ma il suo esempio è di tipo «' + e.tipo + '»');
    }
  }
});

console.log('atlante: ' + fatte + ' prove passate');
