'use strict';
/**
 * voce — lettura ad alta voce con la sintesi di sistema di macOS (/usr/bin/say).
 *
 * Perché non basta la Web Speech API del renderer: Chromium su macOS parla
 * attraverso la vecchia NSSpeechSynthesizer e vede solo le voci «legacy»
 * (Alice, Eddy, Grandma…). Le voci buone — quelle scaricate da Impostazioni →
 * Accessibilità → Contenuto pronunciato, che si chiamano «Federica (Premium)»,
 * «Alice (Enhanced)» e simili — passano da AVSpeechSynthesizer e a Chromium
 * non arrivano. `say` invece le vede tutte: è la stessa voce che si sente in
 * Safari, e in genere è molto più bella.
 *
 * In più `say` accetta i comandi incorporati dell'Apple Speech Synthesis:
 *   [[slnc 300]]  silenzio di 300 ms      → le pause fra le frasi, esatte
 *   [[rate 170]]  parole al minuto        → il rallentando sui titoli
 * Così un intero paragrafo va in un solo processo, senza il buco fra una
 * frase e l'altra che si sentirebbe rilanciando `say` per ogni frase.
 *
 * Questo modulo non parla da solo: prepara il testo e la riga di comando
 * (funzioni pure, coperte dai test) e offre a main.js l'avvio del processo.
 */
const { spawn, execFileSync } = require('child_process');
const fs = require('fs');

const SAY = '/usr/bin/say';
const WPM_BASE = 180;          // velocità di crociera: la 1× dell'interfaccia

/* Le «parole al minuto» di say non sono proporzionali alla velocità che si sente:
   la curva è schiacciata in basso e ripida in alto. Misurato su questa macchina
   con Federica (Premium) e Alice, che concordano entro il 5%:
       -r  50 → 0,75×      -r 180 → 1,00×      -r 280 → 1,50×      -r 385 → 2,00×
   Prendendo 0,75 × 180 = 135 si otterrebbe 0,91×, cioè quasi nessun rallentamento:
   di qui la tabella. Sotto 0,72× il motore non sa andare, e lì ci si ferma. */
const SCALA_WPM = [[0.75, 50], [0.81, 80], [0.87, 110], [0.91, 135], [1, 180],
                   [1.5, 280], [2, 385], [2.5, 470], [3, 560]];
function wpmDaVelocita(vel) {
  const v = +vel || 1;
  if (v <= SCALA_WPM[0][0]) return SCALA_WPM[0][1];
  for (let i = 1; i < SCALA_WPM.length; i++) {
    if (v <= SCALA_WPM[i][0]) {
      const a = SCALA_WPM[i - 1], b = SCALA_WPM[i];
      return Math.round(a[1] + (b[1] - a[1]) * (v - a[0]) / (b[0] - a[0]));
    }
  }
  return SCALA_WPM[SCALA_WPM.length - 1][1];
}

function disponibile() {
  return process.platform === 'darwin' && fs.existsSync(SAY);
}

/* `say -v '?'` stampa «Nome  spazi  lingua  # frase d'esempio».
   La colonna del nome è allineata con spazi, ma i nomi lunghi la sfondano e
   allora di spazio ne resta uno solo: «Eddy (Italiano (Italia)) it_IT # …».
   Per questo la riga si ancora alla sigla di lingua seguita da «#», non al
   numero di spazi — altrimenti metà delle voci sparirebbe dall'elenco. */
function parsaVoci(testo) {
  const out = [];
  String(testo == null ? '' : testo).split('\n').forEach((riga) => {
    const m = /^(.+?)\s+([a-z]{2}(?:[-_][A-Za-z]+)?)\s+#\s*(.*)$/.exec(riga);
    if (!m) return;
    out.push({ nome: m[1].trim(), lingua: m[2].replace('_', '-'), esempio: m[3].trim() });
  });
  return out;
}

/* Quanto è «buona» una voce italiana, per sceglierne una da sola:
   3 = premium/enhanced (le migliori), 2 = Alice e compagne di sistema,
   1 = una qualsiasi italiana, 0 = le voci-scherzo (Grandma, Rocko, Bells…),
   che macOS installa in italiano ma sono inascoltabili per studiare. */
const VOCI_SCHERZO = /^(bells|bahh|boing|bubbles|cellos|good ?news|jester|organ|superstar|trinoids|whisper|wobble|zarvox|albert|bad ?news|junior|kathy|ralph|eddy|flo|grandma|grandpa|reed|rocko|sandy|shelley)\b/i;
function qualita(v) {
  const n = String(v && v.nome || '');
  if (/premium|enhanced|neural/i.test(n)) return 3;
  if (VOCI_SCHERZO.test(n)) return 0;
  if (/^(alice|federica|luca|paola|emma|elsa|chiara)\b/i.test(n)) return 2;
  return 1;
}
function italiane(voci) {
  return (voci || []).filter((v) => /^it\b/i.test(v.lingua || ''))
    .slice().sort((a, b) => qualita(b) - qualita(a) || a.nome.localeCompare(b.nome));
}
function migliore(voci) {
  const it = italiane(voci);
  return it.length ? it[0].nome : null;
}

function elenco() {
  if (!disponibile()) return [];
  try {
    return parsaVoci(execFileSync(SAY, ['-v', '?'], { encoding: 'utf8', timeout: 8000 }));
  } catch (e) { return []; }
}

/* Da segmenti a testo per `say`: le frasi di un blocco tornano a essere il
   paragrafo che erano, unite da uno spazio.
   Qui la prosodia NON si comanda. La prima versione infilava un [[slnc]] fra
   una frase e l'altra e un [[rate]] davanti a ciascuna: sbagliato due volte.
   Il motore la pausa di fine frase la fa già — misurata con ffmpeg, 247 ms
   dopo un punto — e la mia si sommava alla sua: 733 ms, una lettura zoppa.
   E un comando di velocità a ogni frase spezza la linea d'intonazione che il
   motore costruisce sul paragrafo intero. Il testo ben punteggiato gli basta:
   il punto, la virgola, il punto interrogativo li interpreta da sé.
   Restano fuori solo le pause FRA i blocchi, che il testo non sa esprimere:
   quelle le tiene il chiamante, fra un'invocazione e l'altra. */
function preparaTesto(segmenti, opts) {
  return (segmenti || [])
    // le quadre nel testo verrebbero prese per comandi incorporati
    .map((s) => String(s && s.t || '').replace(/[\[\]]/g, ' ').trim())
    .filter(Boolean)
    .join(' ');
}

/* La velocità del blocco: i titoli vanno detti più adagio del testo corrente.
   Dentro un blocco le frasi condividono il tipo, quindi la media basta e
   avanza — e passa dalla curva misurata, non da una moltiplicazione lineare. */
function velocitaBlocco(segmenti, velocita) {
  const s = (segmenti || []).filter((x) => x && x.t);
  if (!s.length) return velocitaChiara(velocita);
  const media = s.reduce((n, x) => n + (x.rate || 1), 0) / s.length;
  return velocitaChiara(velocita) * media;
}
function velocitaChiara(v) { const n = +v; return n > 0 ? n : 1; }

function argomenti(voce, opts) {
  const o = opts || {};
  const a = [];
  if (voce) a.push('-v', String(voce));
  a.push('-r', String(Math.round(o.wpm || WPM_BASE)));
  /* Con `file` la voce non esce dall'altoparlante: finisce in un .m4a che il
     renderer riprodurrà quando gli serve. È il modo per togliere dalla catena
     dell'ascolto l'avvio del processo, che costa e non è mai due volte uguale:
     con una corsa di say per paragrafo, ogni cambio di blocco apriva un buco. */
  if (o.file) a.push('--data-format=aac', '-o', String(o.file));
  a.push('-f', '-');            // il testo arriva da stdin: nessun problema di quoting
  return a;
}

/* Sintetizza su file. La sintesi va 6-7 volte più veloce del parlato, quindi il
   blocco successivo è pronto molto prima che serva. */
function rendi(testo, voce, opts) {
  const o = opts || {};
  if (!disponibile() || !o.file) return Promise.resolve({ ok: false, errore: 'sintesi non disponibile' });
  const p = spawn(SAY, argomenti(voce, o), { stdio: ['pipe', 'ignore', 'pipe'] });
  let err = '';
  if (p.stderr) p.stderr.on('data', (d) => { err += String(d); });
  if (p.stdin) p.stdin.on('error', () => {});
  const finita = new Promise((risolvi) => {
    let chiuso = false;
    p.on('error', (e) => { if (!chiuso) { chiuso = true; risolvi({ ok: false, errore: String(e.message || e) }); } });
    p.on('close', (codice) => {
      if (chiuso) return;
      chiuso = true;
      const buono = codice === 0 && fs.existsSync(o.file) && fs.statSync(o.file).size > 0;
      risolvi({ ok: buono, file: o.file, codice, errore: err.trim().slice(0, 300) });
    });
  });
  try { p.stdin.end(String(testo == null ? '' : testo)); } catch (e) {}
  return finita;
}

module.exports = {
  SAY, WPM_BASE, SCALA_WPM, wpmDaVelocita, disponibile, parsaVoci, qualita,
  italiane, migliore, elenco, preparaTesto, velocitaBlocco, argomenti, rendi
};
