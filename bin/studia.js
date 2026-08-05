#!/usr/bin/env node
'use strict';
/**
 * studia — pipeline da riga di comando, senza Electron.
 *
 * Serve per lavorare un corpus grande (decine di video e PDF) da terminale o da
 * uno script: trascrivere, indicizzare, far leggere i materiali agli agenti,
 * costruire l'architettura dei corsi. Sono gli stessi moduli che usa l'app —
 * nessuna logica duplicata, così quello che si prova qui vale anche là.
 *
 *   node bin/studia.js stato        --vault <cartella> [--progetto NOME]
 *   node bin/studia.js ingest       --vault <cartella> [--force] [--only FILE]
 *   node bin/studia.js schede       --vault <cartella> --progetto NOME [--rifai] [--concorrenza 3]
 *   node bin/studia.js architettura --vault <cartella> --progetto NOME [--no-revisione]
 *   node bin/studia.js tutto        --vault <cartella> --progetto NOME
 *
 * La chiave arriva dall'ambiente: ANTHROPIC_API_KEY, OPENAI_API_KEY o GOOGLE_API_KEY.
 * Con STUDIA_FINTO=1 la pipeline gira con un modello finto: utile per provarla a vuoto.
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const RADICE = path.join(__dirname, '..');
const corpus = require(path.join(RADICE, 'lib', 'corpus'));
const schede = require(path.join(RADICE, 'lib', 'schede'));
const architettura = require(path.join(RADICE, 'lib', 'architettura'));
const propose = require(path.join(RADICE, 'lib', 'propose'));
const profilo = require(path.join(RADICE, 'lib', 'profilo'));
const mat = require(path.join(RADICE, 'lib', 'materiali'));
const provider = require(path.join(RADICE, 'lib', 'ai', 'provider'));
const progetti = require(path.join(RADICE, 'lib', 'progetti'));

// ------------------------------------------------------------------ utilità

/** Argomenti in forma `--chiave valore` / `--flag`. */
function leggiArgomenti(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.slice(0, 2) === '--') {
      const chiave = a.slice(2);
      const prossimo = argv[i + 1];
      if (prossimo === undefined || prossimo.slice(0, 2) === '--') out[chiave] = true;
      else { out[chiave] = prossimo; i++; }
    } else out._.push(a);
  }
  return out;
}

function esci(messaggio, codice) {
  console.error(messaggio);
  process.exit(codice == null ? 1 : codice);
}

/** Verifica che la cartella sia un vault StudIA plausibile. */
function controllaVault(vault) {
  if (!vault) esci('Manca --vault <cartella>.');
  if (!fs.existsSync(vault)) esci('Cartella inesistente: ' + vault);
  try { fs.mkdirSync(path.join(vault, 'Progetti'), { recursive: true }); } catch (e) {}
  return vault;
}

/** Il progetto deve esistere: il wizard lo crea, qui lo si crea al volo se manca. */
function assicuraProgetto(vault, nome) {
  if (!nome) esci('Manca --progetto <nome>.');
  // un progetto protetto è materiale di studio: la pipeline non ci scrive
  if (progetti.protetto(vault, nome)) esci(progetti.motivoRifiuto(nome));
  const dir = path.join(vault, 'Progetti', nome);
  if (!fs.existsSync(dir)) {
    const mdser = require(path.join(RADICE, 'lib', 'mdser'));
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, '_progetto.md'), mdser.progetto({ id: nome, title: nome }), 'utf-8');
    console.log('· progetto creato: Progetti/' + nome);
  }
  return nome;
}

// -------------------------------------------------------------- fornitore AI

/** Chiavi trovate nell'ambiente. */
function chiaviAmbiente() {
  return {
    anthropic: process.env.ANTHROPIC_API_KEY || null,
    openai: process.env.OPENAI_API_KEY || null,
    google: process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || null
  };
}

/** Modello finto per le prove a vuoto: risponde qualcosa di valido a ogni fase. */
function modelloFinto() {
  return async function (o) {
    const s = o.sistema || '';
    if (s.indexOf('Leggi la porzione') > 0)
      return { ok: true, dati: { temi: [{ titolo: 'Tema simulato', da: 0, a: 60 }], concetti: ['prova'] }, uso: { inputTokens: 10, outputTokens: 5 } };
    if (s.indexOf('analisi parziali') > 0)
      return { ok: true, dati: { sintesi: 'Scheda simulata a scopo di collaudo.', livello: 'misto', temi: [{ titolo: 'Tema simulato' }] }, uso: { inputTokens: 10, outputTokens: 5 } };
    if (s.indexOf('esperto della disciplina') > 0) return { ok: true, dati: { aree: [] }, uso: {} };
    if (s.indexOf('progettista didattico') > 0) return { ok: true, dati: { ordine: [] }, uso: {} };
    if (s.indexOf('corpora didattici') > 0) return { ok: true, dati: { coppie: [] }, uso: {} };
    if (s.indexOf('responsabile del percorso') > 0) return { ok: true, dati: { corsi: [] }, uso: {} };
    if (s.indexOf('revisore severo') > 0) return { ok: true, dati: { promossa: true, rilievi: [] }, uso: {} };
    return { ok: false, errore: 'fase non riconosciuta' };
  };
}

/** Configurazione AI: fornitore, modello, chiave — oppure il modello finto. */
function configurazioneAi(arg) {
  if (process.env.STUDIA_FINTO === '1') {
    console.log('· MODELLO FINTO attivo (STUDIA_FINTO=1): nessuna chiamata di rete');
    return { chiama: modelloFinto() };
  }
  const chiavi = chiaviAmbiente();
  const fornitore = arg.fornitore || provider.fornitoreDisponibile(chiavi, process.env.STUDIA_PROVIDER);
  if (!fornitore) esci('Nessuna chiave API nell\'ambiente. Esporta ANTHROPIC_API_KEY (o OPENAI_API_KEY / GOOGLE_API_KEY).');
  const modello = arg.modello || provider.MODELLI_DEFAULT[fornitore];
  console.log('· fornitore: ' + fornitore + ' · modello: ' + modello);
  return { fornitore, modello, apiKey: chiavi[fornitore] };
}

// ------------------------------------------------------------------ comandi

/** Fotografia dello stato: materiali, elaborazione, schede, piano. */
function comandoStato(arg) {
  const vault = controllaVault(arg.vault);
  const dg = corpus.digest(vault);
  console.log('Vault: ' + vault);
  console.log('Materiali elaborati: ' + dg.totale + ' (' + dg.video + ' video, ' + dg.pdf + ' pdf, ' + (dg.durataTotale / 3600).toFixed(1) + ' ore)');

  // i materiali stanno dentro i progetti (con ripiego sulle cartelle globali di prima)
  const media = mat.elenca(vault, 'Media').length;
  const fonti = mat.elenca(vault, 'Fonti').length;
  console.log('Nelle cartelle: ' + media + ' video/audio, ' + fonti + ' documenti');
  if (dg.totale < media + fonti) console.log('  ⚠ ' + (media + fonti - dg.totale) + ' file non ancora elaborati → «studia ingest»');

  if (arg.progetto) {
    const mappa = schede.tutte(vault, arg.progetto, dg.materiali);
    console.log('Progetto «' + arg.progetto + '»: ' + Object.keys(mappa).length + '/' + dg.totale + ' schede' +
      (progetti.protetto(vault, arg.progetto) ? '  · PROTETTO (sola lettura)' : ''));
    const piano = propose.leggiPiano(vault, arg.progetto);
    console.log('  piano: ' + (piano ? (piano.corsi.length + ' corsi, stato ' + piano.status + ', origine ' + piano.origine) : 'non ancora costruito'));
  }
  return 0;
}
function contaFile(dir) { try { return fs.readdirSync(dir).filter((f) => f[0] !== '.').length; } catch (e) { return 0; } }

/** Trascrizione e indicizzazione: lancia ingest.py e ne stampa l'avanzamento. */
function comandoIngest(arg) {
  const vault = controllaVault(arg.vault);
  const py = arg.python || process.env.STUDIA_PYTHON || 'python3';
  const args = [path.join(RADICE, 'ingest.py'), '--vault', vault, '--model', arg.model || 'medium'];
  if (arg.force) args.push('--force');
  if (arg.only) args.push('--only', arg.only);
  console.log('· ingest: ' + py + ' ' + args.join(' '));
  return new Promise((risolvi) => {
    const p = spawn(py, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let fatale = null;
    const riga = (l) => {
      const s = String(l);
      if (s.startsWith('@FATAL ')) { fatale = s.slice(7).trim(); console.error('  ✗ ' + fatale); }
      else if (s.startsWith('@FILE ')) console.log('  → ' + s.slice(6));
      else if (s.startsWith('@OK ') || s.startsWith('@ERR ')) console.log('  ' + s);
    };
    require('readline').createInterface({ input: p.stdout }).on('line', riga);
    require('readline').createInterface({ input: p.stderr }).on('line', (l) => { if (/error|Traceback/i.test(l)) console.error('  ' + l); });
    p.on('error', (e) => { console.error('Impossibile avviare Python: ' + e.message); risolvi(1); });
    p.on('close', (code) => {
      if (code === 0 && !fatale) { console.log('· ingest completato'); risolvi(0); }
      else { console.error('· ingest fallito (uscita ' + code + (fatale ? ', ' + fatale : '') + ') — vedi Trascrizioni/_ingest.log'); risolvi(1); }
    });
  });
}

/** Stadio 0: gli agenti leggono ogni materiale e scrivono le schede. */
async function comandoSchede(arg) {
  const vault = controllaVault(arg.vault);
  const progetto = assicuraProgetto(vault, arg.progetto);
  const ai = configurazioneAi(arg);
  const dg = corpus.digest(vault);
  if (!dg.totale) esci('Nessun materiale elaborato: lancia prima «studia ingest».');

  const conc = Number(arg.concorrenza) || 3;
  console.log('· leggo ' + dg.totale + ' materiali (' + conc + ' in parallelo)…');
  const inizio = Date.now();
  const esiti = await schede.analizzaTutti(vault, progetto, dg.materiali, {
    concorrenza: conc, rifai: !!arg.rifai, ai,
    onProgress: (e) => { if (e.stato !== 'in lettura') console.log('  [' + (e.fatti || 0) + '/' + e.totale + '] ' + (e.num || '--') + ' ' + (e.titolo || '').slice(0, 50) + ' — ' + e.stato); }
  });
  const min = ((Date.now() - inizio) / 60000).toFixed(1);
  console.log('· schede: ' + esiti.fatte + ' nuove, ' + esiti.saltate + ' già presenti, ' + esiti.errori.length + ' errori · ' +
    esiti.uso.chiamate + ' chiamate, ' + esiti.uso.inputTokens + ' token in / ' + esiti.uso.outputTokens + ' out · ' + min + ' min');
  for (const e of esiti.errori) console.error('  ✗ ' + e.num + ' ' + e.titolo + ': ' + e.errore);
  return esiti.errori.length && !esiti.fatte ? 1 : 0;
}

/** Stadio 1: le tre lenti, la sintesi, la revisione — e il piano scritto. */
async function comandoArchitettura(arg) {
  const vault = controllaVault(arg.vault);
  const progetto = assicuraProgetto(vault, arg.progetto);
  const ai = configurazioneAi(arg);
  const dg = corpus.digest(vault);
  const mappa = schede.tutte(vault, progetto, dg.materiali);
  const quante = Object.keys(mappa).length;
  if (!quante) esci('Nessuna scheda: lancia prima «studia schede».');
  if (quante < dg.totale) console.log('  ⚠ schede incomplete: ' + quante + '/' + dg.totale);

  const r = await propose.proponiMultiagente(vault, progetto, {
    granularita: arg.granularita || 'atomico',
    profilo: profilo.load(vault),
    revisione: !arg['no-revisione'],
    ai,
    onProgress: (e) => console.log('  · ' + (e.etichetta || e.fase) + ': ' + (e.stato || 'in corso'))
  }, {});
  if (r.errore) esci('Architettura non riuscita: ' + r.errore);

  const scritto = propose.scriviPiano(vault, progetto, r.piano);
  if (scritto.error) esci(scritto.error);

  console.log('\n· architettura: ' + r.piano.corsi.length + ' corsi, ' + (r.giri > 1 ? 'due giri di sintesi' : 'un giro') +
    ', revisione ' + (r.revisione ? (r.revisione.promossa ? 'promossa' : 'con rilievi') : 'saltata'));
  for (const c of r.piano.corsi) {
    console.log('  [' + c.materiali.map((m) => m.num || '?').join(',') + '] ' + c.title + (c.area ? '  ·  ' + c.area : '') + (c.tipo === 'modulo-fonte' ? '  (modulo-fonte)' : ''));
  }
  if ((r.piano.decisioni || []).length) { console.log('\n  Decisioni:'); r.piano.decisioni.forEach((d) => console.log('   – ' + d)); }
  console.log('\n· piano scritto in Progetti/' + progetto + '/_piano.json');
  return 0;
}

/** Tutta la catena, in ordine. */
async function comandoTutto(arg) {
  const c1 = await comandoIngest(arg);
  if (c1) return c1;
  const c2 = await comandoSchede(arg);
  if (c2) return c2;
  return comandoArchitettura(arg);
}

const COMANDI = { stato: comandoStato, ingest: comandoIngest, schede: comandoSchede, architettura: comandoArchitettura, tutto: comandoTutto };

function aiuto() {
  console.log([
    'studia — pipeline StudIA da riga di comando',
    '',
    'Comandi:',
    '  stato          fotografia di materiali, schede e piano',
    '  ingest         trascrive i video e indicizza i PDF (Python, in locale)',
    '  schede         gli agenti leggono ogni materiale e scrivono le schede',
    '  architettura   tre lenti + sintesi + revisione → _piano.json',
    '  tutto          ingest → schede → architettura',
    '',
    'Opzioni: --vault <cartella> --progetto <nome> [--rifai] [--force] [--concorrenza N]',
    '         [--granularita atomico|medio|ampio] [--no-revisione] [--fornitore anthropic|openai|google]',
    '',
    'Chiavi: ANTHROPIC_API_KEY | OPENAI_API_KEY | GOOGLE_API_KEY     Prova a vuoto: STUDIA_FINTO=1'
  ].join('\n'));
}

async function principale() {
  const arg = leggiArgomenti(process.argv.slice(2));
  const comando = arg._[0];
  if (!comando || arg.help || arg.h) { aiuto(); return 0; }
  if (!COMANDI[comando]) { console.error('Comando sconosciuto: ' + comando + '\n'); aiuto(); return 1; }
  return COMANDI[comando](arg);
}

principale().then((c) => process.exit(c || 0)).catch((e) => esci(String((e && e.stack) || e)));
