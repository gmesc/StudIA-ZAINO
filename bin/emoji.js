/* La tavolozza completa di OpenMoji per il selettore degli appunti, GENERATA.
 *
 *   npm run emoji      → App/assets/dati/emoji.js
 *
 * Prima qui c'erano 89 emoji scelte a mano. Adesso ci sono tutte quelle che il
 * font dell'app sa disegnare, e le 89 curate restano in testa: una tavolozza
 * completa senza una prima riga è un archivio, non uno strumento.
 *
 * ⚠️ Perché non pesa niente. Le emoji non sono immagini che entrano nel
 * pacchetto: sono CARATTERI, disegnati da `assets/fonts/OpenMoji-color.woff2`
 * che è già lì. Aggiungerne duemila costa il testo del loro elenco, non un byte
 * di grafica — ed è per questo che restano icone OpenMoji vere e non emoji di
 * sistema travestite.
 *
 * ⚠️ E si VERIFICA che il font le disegni, invece di darlo per scontato. Ogni
 * carattere si disegna due volte, con il font e senza: se i pixel coincidono il
 * glifo non è nel font e a disegnarlo è il sistema — quella voce non entra.
 * Senza questo controllo la tavolozza prometterebbe OpenMoji e consegnerebbe
 * Apple, che è esattamente ciò che il font self-hosted serve a evitare.
 *
 * Le tre sorgenti (scaricate al bisogno in `build/`, non versionate: il
 * prodotto sì):
 *   openmoji.json         l'elenco ufficiale, con gruppi e sottogruppi
 *   cldr-it.json          i nomi e i sinonimi ITALIANI (Unicode CLDR)
 *   cldr-it-derived.json  le sequenze — ⚠️, ✅, le bandiere — che stanno a parte
 *
 * Le parole chiave italiane sono ciò che permette di trovare ⚠️ scrivendo
 * «attenzione»: senza CLDR resterebbero le annotazioni inglesi di OpenMoji, e
 * la ricerca smetterebbe di funzionare nella lingua di chi scrive. Dove il nome
 * italiano non c'è — 188 voci, quasi tutte bandiere e simboli rari — l'inglese
 * di OpenMoji resta, dichiarato.
 *
 * Che cosa resta fuori, e perché: i toni della pelle (sei copie della stessa
 * mano), i «component» (pezzi di sequenza, non emoji), e le 405 icone in area a
 * uso privato — vedi `inAreaPrivata()`, è la decisione che protegge i file
 * dell'utente. Di 4565 voci ne restano 2111: tutte quelle che si possono
 * scrivere in un appunto e rileggere fuori di qui.
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const RADICE = path.join(__dirname, '..');
const CACHE = path.join(RADICE, 'build');
const CURATE = path.join(RADICE, 'App', 'assets', 'dati', 'emoji-curate.json');
const USCITA = path.join(RADICE, 'App', 'assets', 'dati', 'emoji.js');
const FONT = path.join(RADICE, 'App', 'assets', 'fonts', 'OpenMoji-color.woff2');

const FONTI = {
  'openmoji.json': 'https://raw.githubusercontent.com/hfg-gmuend/openmoji/master/data/openmoji.json',
  'cldr-it.json': 'https://raw.githubusercontent.com/unicode-org/cldr-json/main/cldr-json/cldr-annotations-full/annotations/it/annotations.json',
  'cldr-it-derived.json': 'https://raw.githubusercontent.com/unicode-org/cldr-json/main/cldr-json/cldr-annotations-derived-full/annotationsDerived/it/annotations.json',
};

/* I gruppi di OpenMoji, in italiano e nell'ordine in cui si guardano. Un gruppo
   nuovo che comparisse nella sorgente finirebbe in fondo col suo nome inglese:
   meglio una voce brutta che una categoria persa in silenzio. */
const GRUPPI = [
  ['smileys-emotion', 'Faccine ed emozioni'],
  ['people-body', 'Persone e gesti'],
  ['animals-nature', 'Animali e natura'],
  ['food-drink', 'Cibo e bevande'],
  ['travel-places', 'Viaggi e luoghi'],
  ['activities', 'Attività'],
  ['objects', 'Oggetti'],
  ['symbols', 'Simboli'],
  ['flags', 'Bandiere'],
  ['extras-openmoji', 'Extra di OpenMoji'],
  ['extras-unicode', 'Extra Unicode'],
];

function scarica(nome, url) {
  const dove = path.join(CACHE, nome);
  if (fs.existsSync(dove)) return Promise.resolve(JSON.parse(fs.readFileSync(dove, 'utf-8')));
  console.log('  scarico ' + nome + '…');
  return new Promise((ok, ko) => {
    const prendi = (u) => https.get(u, (r) => {
      if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) { r.resume(); return prendi(r.headers.location); }
      if (r.statusCode !== 200) { r.resume(); return ko(new Error(nome + ': HTTP ' + r.statusCode)); }
      let d = ''; r.setEncoding('utf-8');
      r.on('data', (c) => { d += c; });
      r.on('end', () => { fs.mkdirSync(CACHE, { recursive: true }); fs.writeFileSync(dove, d); ok(JSON.parse(d)); });
    }).on('error', ko);
    prendi(url);
  });
}

/* ⚠️ OpenMoji scrive «🎓️» con il selettore di variante in coda, CLDR scrive
   «🎓» senza: cercare il nome italiano con la chiave sbagliata lo perde in
   silenzio, e le parole chiave tornerebbero inglesi senza che nessuno se ne
   accorga. Si prova con e senza. */
const senzaVariante = (s) => s.replace(/️/g, '');

/**
 * ⚠️ Le 405 icone «extra» di OpenMoji non hanno un codepoint Unicode: stanno
 * nell'area a uso privato (E000–F8FF), dove ogni font mette quello che vuole.
 * Dentro StudIA si vedrebbero — il font ce l'ha — ma un'emoji finisce in un
 * appunto, e gli appunti sono file dell'utente che devono restare leggibili in
 * Obsidian, in una mail, su GitHub: fuori di qui quei caratteri sono
 * quadratini. Una tavolozza che offre un carattere illeggibile altrove non sta
 * offrendo un'icona, sta piazzando una mina nel testo di qualcun altro.
 * Restano tutte le emoji Unicode, che è ciò che si può scrivere e rileggere
 * ovunque.
 */
function inAreaPrivata(s) {
  return [...String(s)].some((c) => { const p = c.codePointAt(0); return p >= 0xE000 && p <= 0xF8FF; });
}

function italiano(base, derivate, ch) {
  return base[ch] || derivate[ch] || base[senzaVariante(ch)] || derivate[senzaVariante(ch)] || null;
}

/** Le parole con cui si cerca: minuscole, senza doppioni, separate da spazio. */
function chiavi(parole) {
  const viste = new Set();
  for (const p of parole) {
    for (const w of String(p || '').toLowerCase().split(/[\s,:]+/)) {
      const pulita = w.replace(/[«»"'()]/g, '').trim();
      if (pulita.length > 1) viste.add(pulita);
    }
  }
  return [...viste].join(' ');
}

async function main() {
  const [openmoji, cldr, cldrDer] = await Promise.all(
    Object.entries(FONTI).map(([n, u]) => scarica(n, u)));
  const base = cldr.annotations.annotations;
  const derivate = cldrDer.annotationsDerived.annotations;
  const curate = JSON.parse(fs.readFileSync(CURATE, 'utf-8'));

  /* Fuori i toni della pelle (2040 voci: sei copie della stessa mano riempiono
     la griglia e non aggiungono un significato) e i «component», che sono pezzi
     di sequenza, non emoji da inserire. */
  const voci = openmoji.filter((e) => !e.skintone && e.group !== 'component')
    .filter((e) => e.emoji && e.emoji.trim() && !inAreaPrivata(e.emoji));

  /* Le parole chiave curate a mano vincono: sono state scelte guardando che
     cosa un insegnante scrive per cercare. Quelle di CLDR si aggiungono. */
  const curatePer = new Map();
  for (const [, elenco] of curate) for (const v of elenco) curatePer.set(senzaVariante(v.ch), v.kw);

  const conNome = [];
  let senzaItaliano = 0;
  for (const e of voci) {
    const it = italiano(base, derivate, e.emoji);
    if (!it) senzaItaliano++;
    const kw = chiavi([
      curatePer.get(senzaVariante(e.emoji)) || '',
      ...(it ? it.tts || [] : []),
      ...(it ? it.default || [] : []),
      it ? '' : e.annotation,          // le extra di OpenMoji non hanno l'italiano
      it ? '' : e.tags,
    ]);
    conNome.push({ ch: e.emoji, gruppo: e.group, kw, ordine: e.order || 0 });
  }

  /* La prova che il font le disegni davvero. Gira in Electron perché serve un
     motore di rendering: è una misura, non una stima. */
  const { app, BrowserWindow } = require('electron');
  await app.whenReady();
  const win = new BrowserWindow({ show: false, width: 200, height: 200 });
  const b64 = 'data:font/woff2;base64,' + fs.readFileSync(FONT).toString('base64');
  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(
    `<!doctype html><meta charset="utf-8"><style>@font-face{font-family:'OpenMoji';src:url('${b64}') format('woff2');}</style>`));
  const disegnate = await win.webContents.executeJavaScript(`(async()=>{
    await document.fonts.load("36px 'OpenMoji'"); await document.fonts.ready;
    const c=document.createElement('canvas'); c.width=48; c.height=48;
    const x=c.getContext('2d'); x.textBaseline='top';
    const impronta=(ch,conFont)=>{ x.clearRect(0,0,48,48);
      x.font='36px '+(conFont?"'OpenMoji', sans-serif":'sans-serif'); x.fillText(ch,4,4);
      const d=x.getImageData(0,0,48,48).data; let h=0;
      for(let i=0;i<d.length;i+=7) h=(h*31+d[i])>>>0; return h; };
    return ${JSON.stringify(conNome.map((v) => v.ch))}.map(ch => impronta(ch,true)!==impronta(ch,false));
  })()`);
  win.destroy();

  const buone = conNome.filter((_, i) => disegnate[i]);
  const scartate = conNome.length - buone.length;

  /* L'uscita ha la forma di prima — `[categoria, 'emoji parole|…']` — perché il
     renderer non deve imparare niente di nuovo: cambia il volume, non il patto. */
  const fuori = [];
  for (const [cat, elenco] of curate) {
    fuori.push([cat, elenco.map((v) => v.ch + ' ' + v.kw).join('|')]);
  }
  for (const [chiave, nome] of GRUPPI) {
    const dentro = buone.filter((v) => v.gruppo === chiave).sort((a, b) => a.ordine - b.ordine);
    if (dentro.length) fuori.push([nome, dentro.map((v) => v.ch + ' ' + v.kw).join('|')]);
  }
  const restanti = buone.filter((v) => !GRUPPI.some(([k]) => k === v.gruppo));
  if (restanti.length) {
    const gruppiIgnoti = [...new Set(restanti.map((v) => v.gruppo))].join(', ');
    console.log('  ⚠️ gruppi non tradotti, in fondo: ' + gruppiIgnoti);
    fuori.push(['Altre', restanti.map((v) => v.ch + ' ' + v.kw).join('|')]);
  }

  const testo = `/* ============================================================================
   dati/emoji.js — la tavolozza del selettore degli appunti
   ============================================================================
   ⚠️ GENERATO da bin/emoji.js (\`npm run emoji\`): qui non si scrive a mano, si
   riscriverebbe sopra alla prossima rigenerazione. Le emoji scelte a mano — con
   le loro parole chiave italiane, che sono la ragione per cui si trova ⚠️
   scrivendo «attenzione» — stanno in \`emoji-curate.json\`, ed è lì che si
   aggiunge o si toglie.

   Contiene TUTTE le emoji che il font dell'app sa disegnare (misurato, non
   supposto), raggruppate come le raggruppa OpenMoji, con la tavolozza curata in
   testa. I nomi e i sinonimi italiani vengono da Unicode CLDR; le icone «extra»
   di OpenMoji non sono Unicode e tengono le loro parole inglesi.

   La forma di una voce è \`<emoji> parola parola\`, le voci si separano con \`|\`:
   è la stessa di prima, perché il renderer non deve imparare niente di nuovo.

   ${buone.length} emoji in ${fuori.length} categorie.
   ============================================================================ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.DatiEmoji = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  return ${JSON.stringify(fuori, null, 0).replace(/\],\[/g, '],\n  [').replace(/^\[/, '[\n  ').replace(/\]$/, '\n]')};
}));
`;
  fs.writeFileSync(USCITA, testo);
  console.log("  " + buone.length + " emoji in " + fuori.length + ' categorie · ' +
              Math.round(fs.statSync(USCITA).size / 1024) + ' KB');
  console.log('  scartate perché il font non le disegna: ' + scartate +
              ' · senza nome italiano (restano in inglese): ' + senzaItaliano);
  app.quit();
}

main().catch((e) => { console.error(e); process.exit(1); });
