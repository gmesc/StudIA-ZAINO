/* L'icona dell'app, GENERATA — non disegnata a mano.
 *
 *   npm run icona      → build/icon.png (1024) e build/icon.icns
 *
 * La sorgente è il tocco accademico di OpenMoji (1F393, CC BY-SA 4.0), lo stesso
 * repertorio da cui vengono tutte le icone dell'app: `build/1F393.svg`. Sta nel
 * repo perché un'icona che si scarica al momento della build è una build che
 * dipende dalla rete.
 *
 * ⚠️ Perché uno script e non un .icns messo lì. Un binario generato una volta e
 * poi modificato a mano è la trappola ④ (la seconda copia che diverge) in forma
 * di immagine: fra sei mesi nessuno saprà da quale sorgente veniva, né con che
 * margini. Qui la ricetta è leggibile e il risultato si rifà in un comando —
 * come `lib/crediti.js` per le licenze.
 *
 * La griglia è quella di macOS Big Sur in avanti: la tela è 1024, il TILE è
 * 824×824 centrato (cioè 100 px di margine per lato, che è lo spazio dove il
 * sistema disegna l'ombra), e gli angoli sono un «squircle» — non un raggio
 * costante ma una curva continua, che è ciò che distingue un'icona di macOS da
 * un rettangolo stondato qualsiasi.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const RADICE = path.join(__dirname, '..');
const FUORI = path.join(RADICE, 'build');
const SORGENTE = path.join(FUORI, '1F393.svg');

const TELA = 1024;
const TILE = 824;                    // il quadrato dell'icona dentro la tela
const MARGINE = (TELA - TILE) / 2;   // 100 px: lo spazio dell'ombra di sistema
const EMOJI = 660;                   // quanto è larga l'emoji dentro il tile

/* Il ritaglio del disegno. L'SVG di OpenMoji è in una tela 72×72 ma il tocco ne
 * occupa solo una fascia: senza questo ritaglio l'icona risulterebbe piccola e
 * spostata in basso, perché il vuoto sopra e sotto conta come disegno.
 * I numeri vengono dalle forme: il bottone in cima (cerchio cy=22 r=3) e il
 * bordo inferiore del corpo (45.896 + mezzo tratto). */
const RITAGLIO = { x: 3, y: 18, w: 66, h: 30 };

/* La forma dell'angolo, MISURATA su un'icona di macOS, non indovinata.
 *
 * Un `rect` con `rx` non basta: l'arco stacca dal lato con un cambio di
 * curvatura che a 1024 px si vede, ed è la differenza fra «icona di macOS» e
 * «quadrato stondato». La forma giusta è un quarto di superellisse, che ai due
 * estremi ha già la tangente del lato e quindi ci entra senza spigolo.
 *
 * I due numeri vengono da un confronto vero: si è misurato, riga per riga, dove
 * comincia il disegno in un'icona di sistema (bordo sinistro a dieci altezze e
 * rientro sulla diagonale), e si è cercata la coppia che riproduce quei numeri.
 * Con raggio 0,2803 del lato ed esponente 2,56 lo scarto resta sotto i 3 px su
 * tutti i punti, e sulla diagonale è di 1 px (155 contro 156).
 * ⚠️ Chi vuole cambiarli rifaccia la misura, non la stima: la differenza fra
 * 2,56 e un arco di cerchio (2) è di 37 px sulla diagonale, cioè visibile.
 */
const RAGGIO = 0.2803;   // in frazioni del lato
const ESPONENTE = 2.56;

function squircle(lato) {
  const r = RAGGIO * lato;
  const PASSI = 48;
  /* Il quarto in alto a sinistra: da (0, r) sul lato sinistro a (r, 0) su
     quello superiore. Gli altri tre sono lo stesso quarto specchiato. */
  const quarto = [];
  for (let i = 0; i <= PASSI; i++) {
    const t = (Math.PI / 2) * (i / PASSI);
    quarto.push([
      r - r * Math.pow(Math.cos(t), 2 / ESPONENTE),
      r - r * Math.pow(Math.sin(t), 2 / ESPONENTE),
    ]);
  }
  const n = (v) => +v.toFixed(2);
  const tratto = (punti) => punti.map(([x, y]) => `L ${n(x)} ${n(y)}`).join(' ');
  const specchioX = (p) => p.map(([x, y]) => [lato - x, y]).reverse();
  const specchioY = (p) => p.map(([x, y]) => [x, lato - y]).reverse();
  const entrambi = (p) => p.map(([x, y]) => [lato - x, lato - y]);
  return [
    `M ${n(r)} 0`,
    tratto(specchioX(quarto)),        // in alto a destra
    tratto(entrambi(quarto)),         // in basso a destra
    tratto(specchioY(quarto)),        // in basso a sinistra
    tratto(quarto),                   // e ritorno in alto a sinistra
    'Z',
  ].join(' ');
}

/** La pagina che il browser fotografa: il tile bianco e il tocco al centro. */
function pagina() {
  const disegno = fs.readFileSync(SORGENTE, 'utf-8')
    .replace(/<svg[^>]*>/, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${RITAGLIO.x} ${RITAGLIO.y} ${RITAGLIO.w} ${RITAGLIO.h}" width="${EMOJI}" height="${(EMOJI * RITAGLIO.h) / RITAGLIO.w}">`);
  return `<!doctype html><meta charset="utf-8"><style>
    html,body{margin:0;padding:0;background:transparent;}
    /* la tela intera, con il tile centrato: il margine è dove macOS mette l'ombra */
    .tela{width:${TELA}px;height:${TELA}px;position:relative;}
    .tile{position:absolute;left:${MARGINE}px;top:${MARGINE}px;width:${TILE}px;height:${TILE}px;
          display:flex;align-items:center;justify-content:center;
          background:#fff;
          /* il contorno di macOS: ritagliato, non disegnato — così il bianco
             finisce esattamente dentro la forma e non sborda di un pixel */
          clip-path:path('${squircle(TILE)}');}
  </style><div class="tela"><div class="tile">${disegno}</div></div>`;
}

/** Le taglie che un .icns deve contenere, con i loro nomi obbligati. */
const TAGLIE = [
  ['icon_16x16.png', 16], ['icon_16x16@2x.png', 32],
  ['icon_32x32.png', 32], ['icon_32x32@2x.png', 64],
  ['icon_128x128.png', 128], ['icon_128x128@2x.png', 256],
  ['icon_256x256.png', 256], ['icon_256x256@2x.png', 512],
  ['icon_512x512.png', 512], ['icon_512x512@2x.png', 1024],
];

async function main() {
  if (!fs.existsSync(SORGENTE)) {
    console.error('manca ' + SORGENTE + ' — è il tocco di OpenMoji (1F393), va nel repo');
    process.exit(1);
  }
  const { app, BrowserWindow } = require('electron');
  await app.whenReady();

  /* Una finestra fuori schermo grande esattamente quanto la tela: si fotografa
     ciò che si vede, quindi la misura della finestra È la misura dell'icona. */
  const win = new BrowserWindow({
    width: TELA, height: TELA, show: false, frame: false, transparent: true,
    backgroundColor: '#00000000', useContentSize: true,
    webPreferences: { offscreen: true },
  });
  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(pagina()));
  await new Promise((r) => setTimeout(r, 400));   // il tempo di disegnare
  const foto = await win.webContents.capturePage();
  const png = path.join(FUORI, 'icon.png');
  fs.writeFileSync(png, foto.toPNG());
  console.log('  ' + path.relative(RADICE, png) + '  ' + TELA + '×' + TELA);

  /* Il .icns si costruisce da un `.iconset`: una cartella con le dieci taglie
     dai nomi obbligati. `sips` rimpicciolisce, `iconutil` impacchetta — sono
     due strumenti di sistema, niente da installare. */
  const set = path.join(FUORI, 'icon.iconset');
  fs.rmSync(set, { recursive: true, force: true });
  fs.mkdirSync(set, { recursive: true });
  for (const [nome, lato] of TAGLIE) {
    execFileSync('sips', ['-z', String(lato), String(lato), png, '--out', path.join(set, nome)],
      { stdio: 'ignore' });
  }
  execFileSync('iconutil', ['-c', 'icns', set, '-o', path.join(FUORI, 'icon.icns')]);
  fs.rmSync(set, { recursive: true, force: true });
  const peso = fs.statSync(path.join(FUORI, 'icon.icns')).size;
  console.log('  build/icon.icns  ' + Math.round(peso / 1024) + ' KB, ' + TAGLIE.length + ' taglie');
  app.quit();
}

main().catch((e) => { console.error(e); process.exit(1); });
