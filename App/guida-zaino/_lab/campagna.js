/* La campagna completa di screenshot per la guida ZAINO, in un solo giro coerente.
   Finestra: 1470×956 (MacBook Air 13" a schermo intero), @2x. */
const L = require('./lab.js');
const fs = require('fs');
const path = require('path');
/* I materiali di prova stanno QUI accanto (`_lab/materiali/`): la campagna deve
   potersi rifare fra un anno, e una cartella temporanea fra un anno non c'è più.
   Il vault invece è per forza altrove — è quello dell'istanza di prova, vergine,
   avviata come dice il README — e lo dice `GUIDA_VAULT`. */
const M = path.join(__dirname, 'materiali') + path.sep;
const VAULT = process.env.GUIDA_VAULT;
if (!VAULT) { console.error('Serve GUIDA_VAULT=<cartella del vault di prova> (vedi README.md)'); process.exit(1); }
const W = 1470, H = 956;
const errori=[];

async function passo(nome, fn) {
  console.log('\n== ' + nome);
  try { await fn(); } catch (e) { errori.push(nome); console.error('  ✗ ' + nome + ': ' + (e && e.message || e)); }
  try { await L.pulito(); } catch (e) {}
}
async function vista(w, h) { await L.invia('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 2, mobile: false }); await L.pausa(700); }
async function toastVia() { await L.pausa(3600); }
async function conferma(ritorno) { await L.val(`window.__conf=null; window.confirm=function(m){ window.__conf=m; return ${ritorno ? 'true' : 'false'}; };`); }
async function bloccoLargo(blocco) { await L.val(`bancoZoom(${JSON.stringify(blocco)})`); await L.pausa(900); }
async function bloccoTorna() { await L.val(`bancoZoomTorna()`); await L.pausa(600); }
/** Seleziona una frase provandola su piu' pagine.
 *  ⚠️ pdf.js tiene reso solo un INTORNO della pagina corrente, e quale intorno
 *  dipende da dove si era prima: la stessa frase c'e' o non c'e' a seconda del
 *  passo precedente. Il 26 agosto questo ha reso rosso il passo 54-55 (e con
 *  lui il 130, che vive dei rimandi che il 54 scrive). */
async function selezionaFra(testo, pagine) {
  let ultimo;
  for (const p of pagine) {
    await L.val(`vaiAPagina(${p})`); await L.pausa(1600);
    try { return await L.selezionaTesto(testo); } catch (e) { ultimo = e; }
  }
  throw ultimo;
}
async function noteFileChe(re) { const f = await L.val(`window.vault.notes.leggi(corsoAttivo()).notes.map(n=>n.file)`); return f.find(x => re.test(x)); }

(async () => {
  await L.collega();
  if(!fs.realpathSync(VAULT).startsWith('/private/tmp/studia-guida-') || await L.val('window.vault.path')!==VAULT) throw new Error('Serve il vault temporaneo del runner della guida.');
  /* ── azzera tutto: vault vergine, localStorage pulito, ricarica ── */
  await passo('azzera', async () => {
    fs.rmSync(VAULT + '/Zaini', { recursive: true, force: true });
    await L.val(`localStorage.clear(); 1`);
    await L.invia('Page.navigate', { url: require('url').pathToFileURL(path.resolve(__dirname,'../../StudIA.html')).href });
    await L.pausa(3000);
    await L.collega();
    await vista(W, H);
    console.log(await L.val(`({modo: document.documentElement.dataset.modo, w: innerWidth, h: innerHeight})`));
  });

  /* ── 1. entrare e creare ── */
  await passo('01-07 creazione', async () => {
    const b = await L.centro('button.brand');
    await L.puntatore(b.x, b.y);
    await L.scatta('01-logo-commutatore', { clip: { x: 0, y: 0, width: 420, height: 60 }, scala: 3 });
    await L.overlayPulisci();
    await L.clicca('button.brand'); await L.pausa(900);
    await L.scatta('03-sidebar-vuota', { clip: { x: 0, y: 40, width: 280, height: 140 }, scala: 3 });
    await L.scatta('03b-zaino-senza-zaini');
    const p = await L.clicca('#zainoNuovo'); await L.pausa(500);
    await L.puntatore(p.x, p.y);
    const zp = await L.rect('#zainoPop');
    await L.scatta('04-pop-crea-zaino', { clip: { x: zp.x - 90, y: 0, width: 470, height: zp.y + zp.h + 16 }, scala: 3 });
    await L.overlayPulisci();
    await L.clicca('#zainoNome'); await L.scrivi('Sistema solare'); await L.pausa(200);
    const c = await L.centro('#zainoCrea'); await L.puntatore(c.x, c.y);
    await L.scatta('05-pop-nome-scritto', { clip: { x: zp.x - 90, y: 0, width: 470, height: zp.y + zp.h + 16 }, scala: 3 });
    await L.overlayPulisci();
    await L.clicca('#zainoCrea');
    await L.finoA(`zainoAttivo()==='sistema-solare' ? 1 : 0`, 8000); await L.pausa(700);
    await L.scatta('06-zaino-appena-creato');
    await L.scatta('07-sidebar-tre-sezioni', { sel: '#zainoNav', scala: 2 });
    await toastVia();
  });

  await passo('02 topbar numerata', async () => {
    const tb = await L.rect('header.topbar');
    const zs = await L.rect('#zainoSelect');
    const x0 = zs.x - 30;
    await L.banda({ x: x0, y: tb.y + tb.h, w: W - x0, h: 0 }, { altezza: 34 });
    await L.numeri([{ sel: '#zainoSelect', n: 1, dove: 'b' }, { sel: '#zainoNuovo', n: 2, dove: 'b' }, { sel: '#searchBtn', n: 3, dove: 'b' }, { sel: '#bancoBtn', n: 4, dove: 'b' }, { sel: '#chatBtn', n: 5, dove: 'b' }, { sel: '#settingsBtn', n: 6, dove: 'b' }, { sel: '#themeToggle', n: 7, dove: 'b' }, { sel: '#fsMinus', n: 8, dove: 'b' }, { sel: '#fsPlus', n: 9, dove: 'b' }], { filo: tb.y + tb.h + 5 });
    await L.scatta('02-topbar-zaino', { clip: { x: x0, y: 0, width: W - x0, height: tb.h + 36 }, scala: 3 });
    await L.overlayPulisci();
  });

  /* ── 2. il primo documento ── */
  await passo('10-12 import PDF', async () => {
    await L.val(`document.documentElement.dataset.drop='pdf'`); await L.pausa(300);
    await L.scatta('10-trascina-cartello');
    await L.val(`delete document.documentElement.dataset.drop`);
    await L.rilascia([M + 'Sistema solare.pdf']); await L.pausa(1300);
    await L.scatta('11-dopo-import-toast');
    await L.finoA(`(()=>{const p=document.querySelector('#pdfPane .textLayer span'); return p?1:0})()`, 15000);
    await L.pausa(1200);
    await L.scatta('12-pdf-aperto');
    await toastVia();
  });

  /* ── 3. finestra: sidebar, banco ── */
  await passo('23 sidebar una fonte', async () => { await L.scatta('23-sidebar-una-fonte', { sel: '#zainoNav', scala: 2 }); });
  await passo('41 forme', async () => {
    await L.clicca('#bancoBtn'); await L.pausa(400);
    const bp = await L.rect('#bancoPop');
    const voci = []; for (let i = 0; i < 13; i++) voci.push({ sel: `#bForme .bforma:nth-child(${i + 1})`, n: i + 1, dove: 'br', dx: 4, dy: 4 });
    await L.numeri(voci);
    await L.scatta('41-banco-forme', { clip: { x: bp.x - 40, y: 0, width: bp.w + 80, height: bp.y + bp.h + 16 }, scala: 3 });
    await L.overlayPulisci();
  });
  await passo('42 tendina strumenti', async () => {
    const bh = await L.rect('.blocco[data-blocco="A"] .bhead');
    await L.tendinaFinta('.bsel[data-blocco="A"]', { largh: 200 });
    const c = await L.centro('.bsel[data-blocco="A"]'); await L.puntatore(c.x + 40, c.y);
    await L.scatta('42-tendina-strumenti', { clip: { x: bh.x + bh.w / 2 - 300, y: bh.y - 6, width: 600, height: 300 }, scala: 2 });
    await L.overlayPulisci();
  });
  await passo('43 divisore', async () => {
    await L.val(`document.documentElement.dataset.bresize='1'`); await L.pausa(200);
    const dv = await L.rect('#bDivCol'); await L.puntatore(dv.x + 4, 470);
    await L.scatta('43-divisore', { clip: { x: dv.x - 200, y: 300, width: 400, height: 300 }, scala: 2 });
    await L.val(`document.documentElement.dataset.bresize=''`); await L.overlayPulisci();
  });
  await passo('44 a tutto banco', async () => {
    const hd = await L.rect('.blocco[data-blocco="A"] .bhead');
    await L.puntatore(hd.x + 60, hd.y + hd.h / 2);
    await L.scatta('44a-testata-doppio-click', { clip: { x: hd.x, y: hd.y - 4, width: 420, height: hd.h + 8 }, scala: 3 });
    await L.overlayPulisci();
    await L.val(`bancoZoom('A')`); await L.pausa(500);
    await L.scatta('44b-a-tutto-banco');
    await L.val(`bancoZoomTorna()`); await L.pausa(500);
    await toastVia();
  });
  await passo('40+45 quattro blocchi e blocco vuoto', async () => {
    await L.val(`bancoForma('quattro')`); await L.pausa(1000);
    await L.val(`mappaRegistro && MAPPA && MAPPA.registro!=='mie' ? mappaRegistro('mie') : 1`).catch(() => {});
    await L.pausa(600);
    await L.scatta('40-banco-quattro');
    await L.val(`bancoAssegna('D','')`); await L.pausa(700);
    const bd = await L.rect('.blocco[data-blocco="D"]');
    await L.scatta('45-blocco-vuoto', { clip: { x: bd.x, y: bd.y, width: bd.w, height: 200 }, scala: 2 });
    await L.val(`bancoAssegna('D','mappa'); bancoForma('due-col')`); await L.pausa(600);
  });
  await passo('46 maniglia sidebar', async () => {
    const mb = await L.centro('#menuBtn'); await L.puntatore(mb.x, mb.y);
    await L.scatta('46a-maniglia-sidebar', { clip: { x: mb.x - 120, y: mb.y - 60, width: 300, height: 160 }, scala: 3 });
    await L.overlayPulisci();
    await L.clicca('#menuBtn'); await L.pausa(500);
    await L.scatta('46b-sidebar-nascosta');
    await L.clicca('#menuBtn'); await L.pausa(500);
  });
  /* ⚠️ Il ritaglio si calcola dalle DUE geometrie — il pannellino del campo e
     l'elenco dei risultati — perché non sono allineati: l'elenco è più stretto
     e si posa dove ci sta. Con una `x` scritta a mano le intestazioni uscivano
     tagliate a metà (misurato il 17 agosto, quando l'elenco è passato da 560 a
     520 px e le foto vecchie sono diventate sbagliate senza che nulla lo dicesse). */
  async function scattaLente(nome, parola, attesa) {
    await L.val(`document.getElementById('searchInput').value=''`);
    await L.clicca('#searchInput'); await L.scrivi(parola); await L.pausa(attesa || 900);
    const sp = await L.rect('#searchPop'), rr = await L.rect('#searchRes');
    const x = Math.max(0, Math.min(sp.x, rr.x) - 8), y = Math.max(0, sp.y - 8);
    await L.scatta(nome, { clip: { x: x, y: y,
      width: Math.max(sp.x + sp.w, rr.x + rr.w) + 8 - x, height: rr.y + rr.h + 8 - y }, scala: 2 });
  }
  await passo('47 lente', async () => {
    await L.clicca('#searchBtn'); await L.pausa(400);
    await scattaLente('47b-lente-nessun-risultato', 'zzzz', 700);
    await scattaLente('47-lente-risultati', 'Plutone');
  });
  await passo('49 tema scuro', async () => {
    await L.val(`document.documentElement.dataset.theme='scuro'`); await L.pausa(400);
    await L.scatta('49-tema-scuro');
    await L.val(`document.documentElement.dataset.theme='chiaro'`); await L.pausa(300);
  });

  /* ── 4. la Fonte ── */
  await passo('20 pdfbar numerata', async () => {
    await bloccoLargo('A');
    const bar = await L.rect('#pdfPane .pdfbar');
    await L.banda(bar, { altezza: 36 });
    /* ⚠️ Diciassette, non dodici: da quando la barra fu numerata (17 ago) ci
       sono entrati il foglio colorato, il righello, la voce, l'interruttore
       delle sottolineature e le letture. Una figura numerata che salta dei
       bottoni PRESENTI nella figura è peggio di nessuna figura. */
    await L.numeri([{ sel: '#pdfDoc', n: 1, dove: 'b' }, { sel: '#pdfPrev', n: 2, dove: 'b' }, { sel: '#pdfPagN', n: 3, dove: 'b' }, { sel: '#pdfNext', n: 4, dove: 'b' }, { sel: '#pdfTinta', n: 5, dove: 'b' }, { sel: '#pdfRighelloBtn', n: 6, dove: 'b' }, { sel: '#pdfVoce', n: 7, dove: 'b' }, { sel: '#pdfZoomOut', n: 8, dove: 'b' }, { sel: '#pdfZoomLvl', n: 9, dove: 'b' }, { sel: '#pdfZoomIn', n: 10, dove: 'b' }, { sel: '#pdfEvid', n: 11, dove: 'b' }, { sel: '#pdfStrati', n: 12, dove: 'b' }, { sel: '#pdfRitaglia', n: 13, dove: 'b' }, { sel: '#pdfFindBtn', n: 14, dove: 'b' }, { sel: '#pdfNewtab', n: 15, dove: 'b' }, { sel: '#pdfElimina', n: 16, dove: 'b' }, { sel: '#pdfClose', n: 17, dove: 'b' }], { filo: bar.y + bar.h + 6 });
    await L.scatta('20-pdfbar-numerata', { clip: { x: bar.x, y: bar.y - 2, width: bar.w, height: bar.h + 38 }, scala: 3 });
    await L.overlayPulisci();
    await bloccoTorna();
  });
  await passo('21 pop documenti', async () => {
    await L.val(`vaiAPagina(9)`); await L.pausa(1500);
    await L.val(`letturaFlush && letturaFlush()`);
    const d = await L.clicca('#pdfDoc'); await L.pausa(500);
    const bar = await L.rect('#pdfPane .pdfbar'); const pop = await L.rect('#pdfDocPop');
    await L.puntatore(d.x, d.y);
    await L.scatta('21-pop-documenti', { clip: { x: bar.x, y: bar.y - 4, width: 560, height: pop.y + pop.h - bar.y + 20 }, scala: 3 });
  });
  await passo('22 cerca nel documento', async () => {
    const bar = await L.rect('#pdfPane .pdfbar');
    await L.clicca('#pdfFindBtn'); await L.pausa(300); await L.clicca('#pdfFindInput'); await L.scrivi('pianeti'); await L.pausa(900);
    await L.scatta('22-cerca-nel-documento', { clip: { x: bar.x + 200, y: bar.y - 4, width: bar.w - 200, height: 330 }, scala: 2 });
  });
  await passo('23abc zoom', async () => {
    const z = await L.rect('#pdfZoom'); const clipZ = { x: z.x - 8, y: z.y - 6, width: z.w + 16, height: z.h + 12 };
    await L.scatta('23a-zoom-larghezza', { clip: clipZ, scala: 4 });
    await L.val(`pdfZoomAdatta()`); await L.pausa(700);
    await L.scatta('23b-zoom-pagina', { clip: clipZ, scala: 4 });
    await L.val(`pdfZoomPasso(true)`); await L.pausa(700);
    await L.scatta('23c-zoom-percento', { clip: clipZ, scala: 4 });
    await L.val(`pdfZoomAdatta()`); await L.pausa(500);
  });
  await passo('24 confronto', async () => {
    await L.val(`bancoAssegna('C','fonte2')`); await L.pausa(700);
    await L.val(`fonte2Apri('01 Sistema solare.pdf')`); await L.pausa(2500);
    await L.val(`fonte2Pagina && fonte2Pagina(true)`); await L.pausa(800);
    await L.scatta('24-confronto');
    await L.val(`bancoAssegna('C','appunti')`); await L.pausa(500);
  });

  /* ── 5. selezione, evidenze, parole chiave ── */
  await passo('31-32 menu selezione + evidenza', async () => {
    await L.val(`openPdf('01 Sistema solare.pdf', 1, 'Sistema solare')`); await L.pausa(1800);
    await L.selezionaTesto('In ordine di distanza dal Sole');
    await L.scatta('31-menu-selezione', { sel: '#selBarra', margine: 10, scala: 2 });
    const menu = await L.rect('#selBarra');
    await L.banda({ x: menu.x + menu.w + 6, y: menu.y - 8, w: 60, h: 0 }, { altezza: menu.h + 16 });
    await L.numeri([{ sel: '#selBarra .ctx-item[data-az="appunta"]', n: 1, dove: 'r' }, { sel: '#selBarra .ctx-cals', n: 2, dove: 'r' }, { sel: '#selBarra .ctx-item[data-az="mappa"]', n: 3, dove: 'r' }, { sel: '#selBarra .ctx-item[data-az="keyword"]', n: 4, dove: 'r' }, { sel: '#selBarra .ctx-item[data-az="postilla"]', n: 5, dove: 'r' }, { sel: '#selBarra .ctx-colori', n: 6, dove: 'r' }, { sel: '#selBarra .ctx-tratti', n: 7, dove: 'r' }, { sel: '#selBarra .ctx-item[data-az="cancella"]', n: 8, dove: 'r' }, { sel: '#selBarra .ctx-item[data-az="copia"]', n: 9, dove: 'r' }], { dove: 'r' });
    await L.scatta('31-menu-selezione-numerato', { clip: { x: menu.x - 8, y: menu.y - 8, width: menu.w + 66, height: menu.h + 16 }, scala: 2 });
    await L.overlayPulisci();
    const p = await L.val(`(()=>{const r=getSelection().getRangeAt(0).getBoundingClientRect(); return {x:r.left,y:r.top}})()`);
    await L.clicca('#selBarra .ctx-col[data-evcol="#fdf14d"]'); await L.pausa(900);
    await L.pulito();
    await L.scatta('32-evidenza-gialla', { clip: { x: 300, y: p.y - 30, width: 660, height: 90 }, scala: 3 });
    await toastVia();
  });
  await passo('60-63 parole chiave', async () => {
    await L.val(`openPdf('01 Sistema solare.pdf', 4, 'Sistema solare')`); await L.pausa(2200);
    const p1 = await L.selezionaTesto('perielio');
    await L.clicca('#selBarra .ctx-col[data-evcol="#fdf14d"]'); await L.pausa(900);
    await L.scatta('60-keyword-toast');
    await L.pulito();
    await L.selezionaTesto('afelio');
    await L.clicca('#selBarra .ctx-tratto[data-tratto="overlay"]'); await L.pausa(900);
    await L.pulito();
    await L.selezionaTesto('eclittica');
    await L.clicca('#selBarra .ctx-col[data-evcol="#ff8ad0"]'); await L.pausa(900);
    await L.pulito();
    await L.scatta('61-evidenze-sul-pdf', { clip: { x: 300, y: p1.y0 - 60, width: 660, height: 110 }, scala: 3 });
    await L.val(`localStorage.setItem('studia.evidenze.tratto','sotto')`);
    await L.val(`bancoAssegna('C','keyword')`); await L.pausa(900);
    const kp = await L.rect('#keywordPane');
    await L.scatta('62-parole-chiave', { clip: { x: kp.x, y: kp.y - 40, width: kp.w, height: 200 }, scala: 2 });
    const chip = await L.val(`(()=>{ const c=document.querySelector('#kwLista .kwchip'); if(!c) return null; const r=c.getBoundingClientRect(); c.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:r.left+r.width/2,clientY:r.top+r.height/2})); return {x:r.left+r.width/2,y:r.top+r.height/2}; })()`);
    await L.pausa(500);
    const km = await L.rect('#kwMenu'); await L.puntatore(chip.x, chip.y);
    const x0 = Math.min(chip.x, km.x) - 40, y0 = Math.min(chip.y, km.y) - 30;
    await L.scatta('63-menu-parola-chiave', { clip: { x: x0, y: y0, width: Math.max(chip.x, km.x + km.w) - x0 + 40, height: km.y + km.h - y0 + 20 }, scala: 2 });
    await L.pulito();
    await L.val(`bancoAssegna('C','appunti')`); await L.pausa(400);
    await toastVia();
  });

  /* ── 6. media, foto, testi ── */
  await passo('25-27 media e player', async () => {
    await L.val(`bancoForma('due-col')`); await L.pausa(400);
    await L.rilascia([M + 'Videolezione pianeti.mp4', M + 'Podcast astronomia.m4a']); await L.pausa(1500);
    await L.scatta('25a-media-importati-toast');
    await L.pausa(2500);
    await L.val(`(()=>{ const v=document.getElementById('mediaVideo'); if(v && !v.paused) v.pause(); return 1; })()`);
    const bl = await L.val(`document.querySelector('.blocco:has(#playerPane)')?.dataset.blocco`);
    await bloccoLargo(bl || 'C');
    const pb = await L.rect('#playerPane .plbar');
    await L.banda(pb, { altezza: 36 });
    await L.numeri([{ sel: '#plScegli', n: 1, dove: 'b' }, { sel: '#plGiu', n: 2, dove: 'b' }, { sel: '#plPlay', n: 3, dove: 'b' }, { sel: '#plSu', n: 4, dove: 'b' }, { sel: '#plTempo', n: 5, dove: 'b' }, { sel: '#plVel', n: 6, dove: 'b' }, { sel: '#plRitaglia', n: 7, dove: 'b' }, { sel: '#plNota', n: 8, dove: 'b' }, { sel: '#plElimina', n: 9, dove: 'b' }, { sel: '#plClose', n: 10, dove: 'b' }], { filo: pb.y + pb.h + 6 });
    await L.scatta('25-playerbar-numerata', { clip: { x: pb.x, y: pb.y - 2, width: pb.w, height: pb.h + 38 }, scala: 3 });
    await L.overlayPulisci();
    const ps = await L.clicca('#plScegli'); await L.pausa(400);
    const mp = await L.rect('#plMediaPop'); await L.puntatore(ps.x, ps.y);
    await L.scatta('26-pop-media', { clip: { x: pb.x, y: pb.y - 2, width: 560, height: mp.y + mp.h - pb.y + 16 }, scala: 3 });
    await L.pulito();
    await bloccoTorna();
    // ⌘⇧C: segna il minuto (con un appunto: se non c'è lo crea → modale; ne creiamo uno prima)
    await L.val(`(async()=>{ const c=corsoAttivo(); const r=window.vault.notes.save(c,null,{title:'Appunti della videolezione', materiale:''},''); notesReload && notesReload(); return 1; })()`); await L.pausa(600);
    const nf = await noteFileChe(/videolezione/i);
    await L.val(`bancoMostra('appunti'); noteOpen(${JSON.stringify(nf)})`); await L.pausa(700);
    await L.val(`(()=>{ const v=document.getElementById('mediaVideo'); if(v){ v.currentTime=12; } return 1; })()`); await L.pausa(400);
    await L.val(`playerAppunta()`); await L.pausa(900);
    await L.scatta('27-cita-minuto', { sel: '#notePane', scala: 2 });
    await L.scatta('13-sidebar-fonti-tipi', { sel: '#zainoNav', scala: 2 });
    await toastVia();
  });
  await passo('14 import md', async () => {
    await L.val(`bancoForma('due-col'); bancoAssegna('C','appunti')`); await L.pausa(500);
    await L.rilascia([M + 'Appunti di classe.md']); await L.pausa(1200);
    await L.scatta('14-import-md');
    await toastVia();
  });
  await passo('15 import foto', async () => {
    await L.rilascia([M + 'Foto lavagna.jpg']); await L.pausa(1500);
    await L.scatta('15-import-foto-toast');
    await toastVia();
  });
  await passo('16 rifiuto', async () => {
    await L.val(`(()=>{const dt=new DataTransfer(); dt.items.add(new File(['x'],'compiti.docx')); window.dispatchEvent(new DragEvent('drop',{dataTransfer:dt,bubbles:true,cancelable:true})); return 1;})()`); await L.pausa(500);
    const t = await L.rect('#toast');
    await L.scatta('16-rifiuto-toast', { clip: { x: t.x - 20, y: t.y - 20, width: t.w + 40, height: t.h + 40 }, scala: 3 });
    await toastVia();
  });

  /* ── 7. appunti ── */
  await passo('50 notebar numerata', async () => {
    await bloccoLargo('C');
    const nb = await L.rect('#noteHost .editor-toolbar');
    await L.banda(nb, { altezza: 36 });
    const sels = ['#noteHost .notectl .tendina', '#noteNew', '#noteSave', '#noteRen', '#noteDel', '.editor-toolbar button.bold', '.editor-toolbar button.italic', '.editor-toolbar button.heading', '.editor-toolbar button.quote', '.editor-toolbar button.unordered-list', '.editor-toolbar button.ordered-list', '.editor-toolbar button.ncb-callout', '.editor-toolbar button.ncb-emoji', '.editor-toolbar button.ncb-cita', '.editor-toolbar button.ncb-mat', '.editor-toolbar button.link', '.editor-toolbar button.code', '.editor-toolbar button.preview', '.editor-toolbar button.side-by-side', '.editor-toolbar button.ncb-guida', '#noteStampa', '#notePdf', '#noteClose'];
    await L.numeri(sels.map((s, i) => ({ sel: s, n: i + 1, dove: 'b' })), { filo: nb.y + nb.h + 6 });
    await L.scatta('50-notebar-numerata', { clip: { x: nb.x, y: nb.y - 2, width: nb.w, height: nb.h + 38 }, scala: 3 });
    await L.overlayPulisci();
    await bloccoTorna();
  });
  await passo('51-53 nuovo appunto, chip, tendina', async () => {
    await L.val(`openPdf('01 Sistema solare.pdf', 3, 'Sistema solare')`); await L.pausa(1500);
    await L.clicca('#noteNew'); await L.pausa(500);
    await L.val(`document.getElementById('umInput').value='Pianeti rocciosi'`);
    await L.cornice('#umSel', { etichetta: 'PERSONALE oppure un documento' });
    await L.scatta('51-nuovo-appunto-battesimo', { sel: '#uiModal .um-card', margine: 40, scala: 2 });
    await L.overlayPulisci();
    await L.clicca('#umOk'); await L.pausa(900);
    const pers = await noteFileChe(/classe/);
    await L.val(`noteOpen(${JSON.stringify(pers)})`); await L.pausa(700);
    const nw = await L.rect('#noteWhere'); await L.puntatore(nw.x + nw.w / 2, nw.y + nw.h / 2);
    await L.scatta('53-chip-dove', { clip: { x: nw.x - 160, y: nw.y - 12, width: 420, height: nw.h + 24 }, scala: 3 });
    await L.overlayPulisci();
    await L.tendinaFinta('#noteSelect', { largh: 320 });
    const nt = await L.rect('#noteHost .notectl .tendina');
    await L.scatta('52-tendina-quaderno', { clip: { x: nt.x - 10, y: nt.y - 8, width: 520, height: 300 }, scala: 2 });
    await L.overlayPulisci();
    const doc = await noteFileChe(/rocciosi/i);
    await L.val(`noteOpen(${JSON.stringify(doc)})`); await L.pausa(600);
    await toastVia();
  });
  /* La lente che trova un appunto: va DOPO che l'appunto «Pianeti rocciosi»
     esiste, e la parola cercata sta sia lì sia nel PDF — è l'unico caso in cui
     si vede che «Appunti» è la prima sezione, sopra i documenti. Era in uno
     script a parte (fuori dalla campagna, e quindi non ripetibile). */
  await passo('48 lente appunti', async () => {
    await L.clicca('#searchBtn'); await L.pausa(400);
    await scattaLente('48-lente-appunti', 'rocciosi');
  });
  /* Scrivere dentro l'anteprima: il gesto si vede solo col campo APERTO, quindi
     si clicca un blocco e si fotografa mentre è in scrittura. */
  await passo('56b scrivere nell\'anteprima', async () => {
    await L.val(`closePdf()`); await L.pausa(400);
    await L.val(`openEditor()`); await L.pausa(1200);
    await L.val(`NOTES.mde.value('# Il sistema solare\\n\\nIl Sole contiene il 99,86% della massa di tutto il sistema.\\n\\n> [!nota]\\n> I quattro pianeti interni sono rocciosi.\\n')`);
    await L.pausa(500);
    if(!(await L.val(`!!document.querySelector('#noteHost .editor-preview-active-side')`))){
      await L.val(`NOTES.mde.toggleSideBySide()`); await L.pausa(1200);
    }
    const sel = '#noteHost .editor-preview-active-side .mdb[data-da="2"] p';
    const p = await L.centro(sel);
    await L.clicca(sel); await L.pausa(600);
    await L.puntatore(p.x, p.y);
    const cont = await L.rect('#noteHost .EasyMDEContainer');
    await L.scatta('56b-scrivere-nell-anteprima', { clip: { x: cont.x, y: cont.y - 6, width: cont.w, height: Math.min(420, cont.h) }, scala: 2 });
    await L.overlayPulisci();
    await L.val(`NOTES.mde.toggleSideBySide()`); await L.pausa(600);
  });
  await passo('54-55 appunta e anteprima', async () => {
    /* ⚠️ Il PDF va RIAPERTO: il passo qui sopra lo chiude per fotografare
       l'editor a tutta larghezza, e senza documento non c'e' nessun layer di
       testo da selezionare — la selezione falliva con «testo non trovato». */
    await L.val(`openPdf('01 Sistema solare.pdf', 2, 'Sistema solare')`); await L.pausa(2200);
    await selezionaFra('Il sistema solare è costituito dal Sole', [2, 3, 1, 4]);
    await L.clicca('#selBarra .ctx-cal[data-app="definizione"]'); await L.pausa(900);
    await L.scatta('54-appunta-riquadro');
    await L.pulito();
    await selezionaFra('le sue idee non presero piede nella comunità dei filosofi', [2, 3, 1, 4]);
    await L.clicca('#selBarra .ctx-cal[data-app=""]'); await L.pausa(900);
    await L.scatta('54b-appunta-senza-riquadro', { sel: '#notePane', scala: 2 });
    await L.pulito();
    await L.clicca('#noteHost .editor-toolbar button.preview'); await L.pausa(700);
    await L.scatta('55-anteprima', { sel: '#notePane', scala: 2 });
    await L.clicca('#noteHost .editor-toolbar button.preview'); await L.pausa(400);
    await toastVia();
  });
  await passo('56-59 callout, emoji, rinomina, materiali, guida', async () => {
    await L.clicca('#noteHost .editor-toolbar button.ncb-callout'); await L.pausa(400);
    await L.scatta('56-menu-callout', { sel: '#calloutMenu', margine: 16, scala: 2 });
    await L.pulito();
    await L.clicca('#noteHost .editor-toolbar button.ncb-emoji'); await L.pausa(500);
    await L.clicca('#emojiSearch'); await L.scrivi('pianeta'); await L.pausa(500);
    await L.scatta('57-emoji', { sel: '#emojiPop', margine: 16, scala: 2 });
    await L.pulito();
    await L.clicca('#noteRen'); await L.pausa(500);
    await L.scatta('58-rinomina-appunto', { sel: '#uiModal .um-card', margine: 40, scala: 2 });
    await L.clicca('#umCancel'); await L.pausa(300);
    await L.clicca('#noteHost .editor-toolbar button.ncb-mat'); await L.pausa(500);
    await L.scatta('59-cita-materiale', { sel: '#matPop', margine: 16, scala: 2 });
    await L.pulito();
    await L.clicca('#noteHost .editor-toolbar button.ncb-guida'); await L.pausa(500);
    await L.scatta('59b-guida-notazioni');
    await L.val(`document.getElementById('guidaClose')?.click()`); await L.pausa(300);
  });

  /* ── 8. mappa ── */
  await passo('64-73 mappa', async () => {
    await L.val(`bancoAssegna('C','mappa')`); await L.pausa(1000);
    await L.val(`mappaRegistro('generata')`).catch(() => {}); await L.pausa(600);
    await L.scatta('64a-mappa-generata-vuota', { sel: '#mappaView', scala: 2 });
    await L.val(`mappaRegistro('mie')`); await L.pausa(900);
    await L.scatta('64b-mappa-mie-vuota', { sel: '#mappaView', scala: 2 });
    await L.clicca('#mNuova'); await L.pausa(500);
    await L.val(`document.getElementById('umInput').value='Il sistema solare'`);
    await L.scatta('65-nuova-mappa-modale', { sel: '#uiModal .um-card', margine: 40, scala: 2 });
    await L.clicca('#umOk'); await L.pausa(1600);
    const root = await L.val(`MAPPA.mia.grafo.nodi[0].id`);
    await L.val(`mappaSeleziona(${JSON.stringify(root)}); mappaFiglio();`); await L.pausa(700);
    await L.scatta('66-nuovo-nodo-casella', { sel: '#mappaView', scala: 2 });
    await L.val(`document.querySelector('#mCampo').value='Pianeti rocciosi'; mappaRinominaChiudi(true);`); await L.pausa(600);
    await L.val(`mappaSeleziona(${JSON.stringify(root)}); mappaFiglio();`); await L.pausa(500);
    await L.val(`document.querySelector('#mCampo').value='Giganti gassosi'; mappaRinominaChiudi(true);`); await L.pausa(600);
    const n2 = await L.val(`MAPPA.mia.grafo.nodi.find(n=>/rocciosi/.test(n.testo)).id`);
    await L.val(`mappaSeleziona(${JSON.stringify(n2)}); mappaFiglio();`); await L.pausa(500);
    await L.val(`document.querySelector('#mCampo').value='Terra'; mappaRinominaChiudi(true);`); await L.pausa(600);
    await L.val(`mappaSeleziona(${JSON.stringify(n2)}); mappaFiglio();`); await L.pausa(500);
    await L.val(`document.querySelector('#mCampo').value='Marte'; mappaRinominaChiudi(true);`); await L.pausa(600);
    await L.val(`(()=>{ const ev=EVIDENZE.elenco.find(e=>e.exact==='perielio'); MAPPA.mia.grafo=MappaModifica.estrai(MAPPA.mia.grafo,{testo:ev.exact, nota:(ev.prefix||'')+ev.exact+(ev.suffix||''), colore:ev.colore, rimando:evidenzaRimando(ev), capitolo:evidenzaCapitolo(ev)}); mappaTocca(); mappaRidisegna(); return 1; })()`); await L.pausa(900);
    await L.val(`mappaSeleziona(null); mappaAdatta && mappaAdatta()`); await L.pausa(600);
    await L.scatta('67-mappa-con-nodi', { sel: '#mappaView', scala: 2 });
    await bloccoLargo('C');
    const mb = await L.rect('#mappaView .mtoolbar');
    await L.banda(mb, { altezza: 36 });
    await L.numeri([{ sel: '#mRegistro', n: 1, dove: 'b' }, { sel: '#mappaView .tendina.piccola', n: 2, dove: 'b' }, { sel: '#mNuova', n: 3, dove: 'b' }, { sel: '#mRinomina', n: 4, dove: 'b' }, { sel: '#mCestino', n: 5, dove: 'b' }, { sel: '#mMemorie', n: 6, dove: 'b' }, { sel: '#mOrient', n: 7, dove: 'b' }, { sel: '#mVista', n: 8, dove: 'b' }, { sel: '#mStampa', n: 9, dove: 'b' }, { sel: '#mPdf', n: 10, dove: 'b' }, { sel: '#mAdatta', n: 11, dove: 'b' }, { sel: '#mChiudi', n: 12, dove: 'b' }], { filo: mb.y + mb.h + 6 });
    await L.scatta('68-mappabar-numerata', { clip: { x: mb.x, y: mb.y - 2, width: mb.w, height: mb.h + 38 }, scala: 3 });
    await L.overlayPulisci();
    const nk = await L.val(`MAPPA.mia.grafo.nodi.find(n=>n.testo==='perielio').id`);
    await L.val(`mappaSeleziona(${JSON.stringify(nk)})`); await L.pausa(300);
    const nr = await L.rect(`#mappaSvg .mnodo[data-id="${nk}"]`);
    await L.val(`mapMenuApri(${nr.x + nr.w / 2}, ${nr.y + nr.h / 2}, {tipo:'nodo', id:${JSON.stringify(nk)}})`); await L.pausa(500);
    const mm = await L.rect('#mapMenu'); await L.puntatore(nr.x + nr.w / 2, nr.y + nr.h / 2);
    await L.scatta('69-menu-nodo', { clip: { x: Math.min(nr.x, mm.x) - 30, y: Math.min(nr.y, mm.y) - 30, width: Math.max(nr.x + nr.w, mm.x + mm.w) - Math.min(nr.x, mm.x) + 60, height: Math.max(nr.y + nr.h, mm.y + mm.h) - Math.min(nr.y, mm.y) + 60 }, scala: 2 });
    await L.pulito();
    /* ⚠️ Il mouse VERO va portato fuori dalla mappa prima di scattare. La mappa accende la
       parentela del nodo sotto il puntatore e spegne il resto (opacity .18, `data-evid`): il
       mouse era rimasto su un altro nodo dai passi prima, e «perielio», che non gli è parente,
       usciva trasparente e appena leggibile. Non era una dissolvenza: un'attesa non bastava. */
    await L.invia('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 8, y: 8 }); await L.pausa(400);
    await L.val(`mappaSeleziona(${JSON.stringify(nk)})`); await L.pausa(400);
    await L.scatta('69b-nodo-con-fonte', { clip: { x: nr.x - 30, y: nr.y - 30, width: nr.w + 60, height: nr.h + 60 }, scala: 4 });
    const sv = await L.rect('#mappaSvg');
    await L.val(`mapMenuApri(${sv.x + sv.w - 300}, ${sv.y + 80}, {tipo:'vuoto', id:null})`); await L.pausa(500);
    await L.scatta('70-menu-vuoto', { sel: '#mapMenu', margine: 16, scala: 2 });
    await L.pulito();
    const nT = await L.val(`MAPPA.mia.grafo.nodi.find(n=>n.testo==='Terra').id`);
    await L.val(`mappaArcoCrea(${JSON.stringify(nT)}, ${JSON.stringify(nk)})`); await L.pausa(700);
    await L.scatta('71-arco-verbo', { sel: '#mappaView', scala: 2 });
    await L.val(`document.querySelector('#mCampo').value='ha un'; mappaRinominaChiudi(true);`); await L.pausa(600);
    await L.clicca('#mVista'); await L.pausa(500);
    await L.scatta('72-vista-pop', { sel: '#mappaPop', margine: 16, scala: 2 });
    await L.pulito();
    await L.clicca('#mRinomina'); await L.pausa(500);
    await L.cornice('#umSel', { etichetta: 'PERSONALE oppure un documento' });
    await L.scatta('73-rinomina-mappa', { sel: '#uiModal .um-card', margine: 40, scala: 2 });
    await L.overlayPulisci();
    await L.clicca('#umCancel'); await L.pausa(300);
    await L.val(`mappaFlush && mappaFlush()`); await L.pausa(500);
    await bloccoTorna();
    await L.val(`bancoAssegna('C','appunti')`); await L.pausa(400);
  });

  /* ── 9. ritagli e album foto ── */
  await passo('74-83 ritagli, foto', async () => {
    await L.val(`bancoForma('due-col'); bancoAssegna('C','appunti')`); await L.pausa(500);
    await L.val(`openPdf('01 Sistema solare.pdf', 1, 'Sistema solare')`); await L.pausa(2000);
    const fb = await L.clicca('#pdfRitaglia'); await L.pausa(500);
    await L.puntatore(fb.x, fb.y);
    const bar = await L.rect('#pdfPane .pdfbar');
    await L.scatta('74-forbici-accese', { clip: { x: bar.x + 380, y: bar.y - 4, width: bar.w - 380, height: bar.h + 8 }, scala: 3 });
    await L.overlayPulisci();
    await L.pausa(2500);
    const img = await L.val(`(()=>{ const c=document.querySelector('#pdfFrame .page[data-page-number="1"] canvas'); const r=c.getBoundingClientRect(); return {x:r.left,y:r.top,w:r.width,h:r.height}; })()`);
    const x1 = img.x + img.w * 0.53, y1 = img.y + img.h * 0.205, x2 = img.x + img.w * 0.975, y2 = img.y + img.h * 0.32;
    await L.invia('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x1, y: y1 });
    await L.invia('Input.dispatchMouseEvent', { type: 'mousePressed', x: x1, y: y1, button: 'left', clickCount: 1 });
    for (let k = 1; k <= 10; k++) await L.invia('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x1 + (x2 - x1) * k / 10, y: y1 + (y2 - y1) * k / 10, button: 'left', buttons: 1 });
    await L.pausa(200);
    await L.scatta('75-ritaglio-rettangolo', { clip: { x: img.x, y: img.y, width: img.w, height: img.h * 0.42 }, scala: 2 });
    await L.invia('Input.dispatchMouseEvent', { type: 'mouseReleased', x: x2, y: y2, button: 'left', clickCount: 1 });
    await L.pausa(1500);
    await L.scatta('76-bolla-ritaglio-salvato', { sel: '#albBolla', margine: 24, scala: 2 });
    await L.pulito();
    await L.val(`albumRitaglioModo(false)`);
    await L.val(`bancoAssegna('C','album')`); await L.pausa(900);
    const ap = await L.rect('#albumPane');
    await L.scatta('77-ritagli-griglia', { clip: { x: ap.x, y: ap.y - 40, width: ap.w, height: 420 }, scala: 2 });
    const card = await L.centro('#albLista .alcard');
    await L.clicca('#albLista .alcard'); await L.pausa(500);
    const am = await L.rect('#albMenu'); await L.puntatore(card.x, card.y);
    await L.scatta('78-menu-ritaglio', { clip: { x: Math.min(card.r.x, am.x) - 20, y: Math.min(card.r.y, am.y) - 40, width: Math.max(card.r.x + card.r.w, am.x + am.w) - Math.min(card.r.x, am.x) + 40, height: Math.max(card.r.y + card.r.h, am.y + am.h) - Math.min(card.r.y, am.y) + 60 }, scala: 2 });
    await L.pulito();
    await L.val(`bancoAssegna('C','foto')`); await L.pausa(900);
    const fp = await L.rect('#fotoPane');
    await L.scatta('79-album-foto', { clip: { x: fp.x, y: fp.y - 40, width: fp.w, height: 420 }, scala: 2 });
    const fid = await L.val(`document.querySelector('#fotoLista .alcard')?.dataset.id`);
    await L.val(`fotoApri(${JSON.stringify(fid)})`); await L.pausa(1200);
    await L.scatta('80-foto-visualizzatore', { sel: '#fotoPane', scala: 2 });
    await L.val(`fotoChiudiVista()`); await L.pausa(400);
    await L.val(`bancoForma('quattro'); bancoAssegna('C','appunti'); bancoAssegna('D','foto')`); await L.pausa(1000);
    const noteFile = await noteFileChe(/rocciosi/i);
    await L.val(`noteOpen(${JSON.stringify(noteFile)})`); await L.pausa(600);
    await L.val(`(()=>{ NOTES.mde.setCursor(NOTES.mde.lineCount(),0); return 1; })()`).catch(() => {});
    await L.val(`albumAzione('appunti', ${JSON.stringify(fid)})`); await L.pausa(900);
    await L.scatta('81-foto-nell-appunto');
    await L.scatta('81b-bolla-va-bene-tutta', { sel: '#albBolla', margine: 24, scala: 2 });
    await L.pulito();
    await L.val(`bancoAssegna('D','mappa')`); await L.pausa(900);
    await L.val(`(async()=>{ if(!MAPPA.mia || !MAPPA.mia.file){ const l=await window.vault.mappe.elenco(corsoAttivo()); const m=(l.mappe||l)[0]; await mappaApriMia(m.file); } return 1; })()`); await L.pausa(800);
    await L.val(`bancoAssegna('B','album')`); await L.pausa(700);
    const rid = await L.val(`document.querySelector('#albLista .alcard')?.dataset.id`);
    await L.val(`albumAzione('mappa', ${JSON.stringify(rid)})`); await L.pausa(1200);
    await L.val(`mappaAdatta && mappaAdatta()`); await L.pausa(500);
    await L.scatta('82-nodo-immagine', { sel: '#mappaView', scala: 2 });
    await L.pulito();
    await L.val(`bancoForma('due-col'); bancoAssegna('C','appunti')`); await L.pausa(700);
    await L.clicca('#noteHost .editor-toolbar button.preview'); await L.pausa(900);
    await L.val(`(()=>{ const p=document.querySelector('#noteHost .editor-preview, #noteHost .editor-preview-side'); if(p) p.scrollTop=0; return 1; })()`);
    await L.scatta('83-anteprima-con-immagine', { sel: '#notePane', scala: 2 });
    await L.clicca('#noteHost .editor-toolbar button.preview'); await L.pausa(300);
    await toastVia();
  });

  /* ── 10. eliminare una fonte, lapide, ritorno ── */
  await passo('85-89 togli documento', async () => {
    await L.val(`bancoForma('due-col'); bancoAssegna('C','appunti')`); await L.pausa(500);
    await L.val(`openPdf('01 Sistema solare.pdf', 1, 'Sistema solare')`); await L.pausa(1800);
    const el = await L.centro('#pdfElimina'); await L.puntatore(el.x, el.y);
    const bar = await L.rect('#pdfPane .pdfbar');
    await L.scatta('85-togli-documento-bottone', { clip: { x: bar.x + bar.w - 380, y: bar.y - 4, width: 380, height: bar.h + 8 }, scala: 3 });
    await L.overlayPulisci();
    await conferma(false);
    await L.clicca('#pdfElimina'); await L.pausa(800);
    const msg = await L.val(`window.__conf`); console.log('CONFIRM:', msg);
    await L.dialogoFinto(msg);
    await L.scatta('86-conferma-togli-documento', { clip: { x: W / 2 - 260, y: 150, width: 520, height: 420 }, scala: 2 });
    await L.overlayPulisci();
    await conferma(true);
    await L.clicca('#pdfElimina'); await L.pausa(1500);
    await L.scatta('87-documento-tolto');
    console.log('lapidi', await L.val(`(async()=>JSON.stringify(await window.vault.fonti.rimossi(corsoAttivo())))()`));
    await toastVia();
    await L.val(`bancoAssegna('C','keyword')`); await L.pausa(700);
    await L.val(`(()=>{ const c=document.querySelector('#kwLista .kwchip'); const r=c.getBoundingClientRect(); c.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:r.left+r.width/2,clientY:r.top+r.height/2})); return 1; })()`); await L.pausa(400);
    await L.clicca('#kwMenu [data-kwaz="vai"]'); await L.pausa(2000);
    await L.scatta('88-rimando-orfano');
    await L.pulito();
    await L.val(`bancoAssegna('C','appunti')`); await L.pausa(400);
    await L.rilascia([M + 'Sistema solare.pdf']); await L.pausa(1500);
    await L.scatta('89-documento-tornato');
    await toastVia();
    await conferma(false);
  });

  /* ── 11. tendina zaini, impostazioni, elimina zaino ── */
  await passo('08 + 90-92 zaini', async () => {
    await L.val(`(async()=>{ await zainoCrea('Storia romana'); return 1; })()`); await L.pausa(1200);
    await L.val(`(async()=>{ await cambiaZaino('sistema-solare'); return 1; })()`); await L.pausa(1000);
    await toastVia();
    await L.tendinaFinta('#zainoSelect', { largh: 260 });
    const zs = await L.rect('#zainoSelect');
    await L.scatta('08-tendina-zaini', { clip: { x: zs.x - 120, y: 0, width: 420, height: 130 }, scala: 3 });
    await L.overlayPulisci();
    await L.clicca('#settingsBtn'); await L.pausa(600);
    await L.clicca('.set-tab[data-tab="zaino"]'); await L.pausa(700);
    await L.scatta('90-impostazioni-zaino');
    const zx = await L.centro('.zx-elimina[data-zaino="storia-romana"]'); await L.puntatore(zx.x, zx.y);
    const sz = await L.rect('#setZaini');
    await L.scatta('90b-impostazioni-zaino-riga', { clip: { x: sz.x - 20, y: sz.y - 120, width: sz.w + 40, height: sz.h + 150 }, scala: 2 });
    await L.overlayPulisci();
    await conferma(false);
    await L.clicca('.zx-elimina[data-zaino="storia-romana"]'); await L.pausa(500);
    const msg = await L.val(`window.__conf`); console.log('CONFIRM zaino:', msg);
    await L.dialogoFinto(msg);
    await L.scatta('91-conferma-elimina-zaino', { clip: { x: W / 2 - 260, y: 150, width: 520, height: 300 }, scala: 2 });
    await L.overlayPulisci();
    await conferma(true);
    await L.clicca('.zx-elimina[data-zaino="storia-romana"]'); await L.pausa(1200);
    await L.scatta('92-zaino-nel-cestino');
    await L.val(`document.getElementById('settingsClose')?.click()`); await L.pausa(400);
    await conferma(false);
    await toastVia();
  });

  /* ── 12. OCR ── */
  await passo('95-98 OCR', async () => {
    await L.val(`window.__conf=null;`);
    await L.rilascia([M + 'Scheda fotografata.pdf']); await L.pausa(4500);
    const prop = await L.val(`window.__conf`); console.log('PROPOSTA OCR:', prop);
    await L.dialogoFinto(prop || '(nessuna proposta)');
    await L.scatta('95-proposta-ocr', { clip: { x: W / 2 - 260, y: 150, width: 520, height: 360 }, scala: 2 });
    await L.overlayPulisci();
    await L.pausa(500);
    const oc = await L.centro('#pdfOcr'); await L.puntatore(oc.x, oc.y);
    const bar = await L.rect('#pdfPane .pdfbar');
    await L.scatta('96-bottone-aa-ocr', { clip: { x: bar.x + bar.w - 460, y: bar.y - 4, width: 460, height: bar.h + 8 }, scala: 3 });
    await L.overlayPulisci();
    await L.scatta('96b-scansione-aperta');
    const p = L.val(`ocrRiconosci(ANTEPRIMA.file)`);
    await L.pausa(2500);
    await L.scatta('97-ocr-in-corso');
    const t = await L.rect('#toast').catch(() => null);
    if (t) await L.scatta('97b-ocr-toast', { clip: { x: t.x - 20, y: t.y - 20, width: t.w + 40, height: t.h + 40 }, scala: 3 });
    await p; await L.pausa(1500);
    await L.scatta('98-ocr-fatto');
    const t2 = await L.rect('#toast').catch(() => null);
    if (t2) await L.scatta('98b-ocr-fatto-toast', { clip: { x: t2.x - 20, y: t2.y - 20, width: t2.w + 40, height: t2.h + 40 }, scala: 3 });
    await toastVia();
    // ora si seleziona: evidenzia una parola sulla scansione
    await L.pausa(800);
    try {
      const p2 = await L.selezionaTesto('sistema');
      await L.clicca('#selBarra .ctx-col[data-evcol="#b6f34d"]'); await L.pausa(900);
      await L.pulito();
      await L.scatta('99-ocr-evidenza', { clip: { x: 300, y: p2.y0 - 40, width: 660, height: 100 }, scala: 3 });
    } catch (e) { console.log('evidenza su scansione:', e.message); }
    await toastVia();
  });


  /* ══ 13. IL QUADERNO DI FINE AGOSTO ══════════════════════════════════════
     Gli undici lavori entrati fra il 24 e il 26 agosto 2026. Stanno in coda e
     non sparsi fra i passi di prima per una ragione sola: qui il vault e' gia'
     pieno (un PDF, due appunti, una mappa con cinque nodi, ritagli, foto,
     evidenze) ed e' esattamente lo stato in cui queste cose si vedono. Un
     pannello delle Postille su uno zaino vergine e' una scatola vuota. */

  /* Prima il VUOTO, che va fotografato finche' e' vuoto: dopo il passo dopo non
     lo e' piu'. E il vuoto che si vede qui e' il secondo dei tre — evidenze ce
     ne sono, postille no — cioe' quello che l'utente incontra davvero. */
  await passo('120 postille: il pannello vuoto', async () => {
    await L.val(`closePdf()`); await L.pausa(400);
    await L.val(`bancoForma('due-col'); bancoAssegna('C','postille')`); await L.pausa(900);
    const pp = await L.rect('#postillePane');
    await L.scatta('120-postille-vuoto', { clip: { x: pp.x, y: pp.y - 40, width: pp.w, height: 190 }, scala: 2 });
    await L.val(`bancoAssegna('C','appunti')`); await L.pausa(400);
  });

  /* ── Q6: la postilla, cioe' il PERCHE' di una sottolineatura ── */
  await passo('110-113 postilla', async () => {
    await L.val(`openPdf('01 Sistema solare.pdf', 1, 'Sistema solare')`); await L.pausa(2000);
    await L.selezionaTesto('In ordine di distanza dal Sole');
    const v = await L.centro('#selBarra .ctx-item[data-az="postilla"]');
    await L.puntatore(v.x, v.y);
    const mb = await L.rect('#selBarra');
    await L.scatta('110-voce-postilla', { clip: { x: mb.x - 8, y: mb.y - 8, width: mb.w + 16, height: mb.h + 16 }, scala: 2 });
    await L.overlayPulisci();
    await L.clicca('#selBarra .ctx-item[data-az="postilla"]'); await L.pausa(700);
    await L.val(`document.getElementById('umInput').value="Da rileggere: l\u2019ordine non è per grandezza"`);
    await L.scatta('111-postilla-modale', { sel: '#uiModal .um-card', margine: 40, scala: 2 });
    await L.clicca('#umOk'); await L.pausa(1200);
    const t = await L.rect('#toast').catch(() => null);
    if (t) await L.scatta('112-postilla-toast', { clip: { x: t.x - 20, y: t.y - 20, width: t.w + 40, height: t.h + 40 }, scala: 3 });
    await toastVia();
    /* ⚠️ E QUI si vede la cosa che vale il capitolo: riselezionando la STESSA
       frase il menu porta la postilla scritta, e la voce cambia in «Correggi».
       Su un PDF non c'e' altro posto dove una postilla si possa rileggere —
       le evidenze si dipingono con la Custom Highlight API, che non fa
       elementi su cui passare il mouse. */
    await L.pulito();
    await L.selezionaTesto('In ordine di distanza dal Sole');
    const mb2 = await L.rect('#selBarra');
    await L.scatta('113-postilla-nel-menu', { clip: { x: mb2.x - 8, y: mb2.y - 8, width: mb2.w + 16, height: mb2.h + 16 }, scala: 2 });
    await L.pulito();
    /* una seconda, su un'altra pagina: un pannello con un solo gruppo non
       mostra che le postille si raccolgono PER DOCUMENTO. */
    await L.val(`vaiAPagina(4)`); await L.pausa(1600);
    await L.selezionaTesto('perielio');
    await L.clicca('#selBarra .ctx-item[data-az="postilla"]'); await L.pausa(700);
    await L.val(`document.getElementById('umInput').value="Il punto più vicino al Sole: non confonderlo con l\u2019afelio"`);
    await L.clicca('#umOk'); await L.pausa(1200);
    await toastVia();
  });

  /* ── Lo strumento POSTILLE: dove il perche' si rilegge tutto insieme ── */
  await passo('121-122 strumento Postille', async () => {
    await L.val(`bancoAssegna('C','postille')`); await L.pausa(1000);
    const pp = await L.rect('#postillePane');
    await L.scatta('121-postille-pannello', { clip: { x: pp.x, y: pp.y - 40, width: pp.w, height: 330 }, scala: 2 });
    await L.clicca('#poCerca'); await L.scrivi('afelio'); await L.pausa(700);
    await L.scatta('122-postille-cerca', { clip: { x: pp.x, y: pp.y - 40, width: pp.w, height: 320 }, scala: 2 });
    await L.val(`document.getElementById('poCerca').value=''; document.getElementById('poCerca').dispatchEvent(new Event('input',{bubbles:true}));`); await L.pausa(400);
  });

  /* ── Q4: sbirciare senza saltare ── */
  await passo('130 bolla del rimando', async () => {
    await L.val(`bancoAssegna('C','appunti')`); await L.pausa(600);
    const nf = await noteFileChe(/rocciosi/i);
    await L.val(`noteOpen(${JSON.stringify(nf)})`); await L.pausa(900);
    if (!(await L.val(`!!document.querySelector('#noteHost .editor-preview-active, #noteHost .editor-preview-active-side')`))) {
      await L.clicca('#noteHost .editor-toolbar button.preview'); await L.pausa(1000);
    }
    const a = await L.val(`(()=>{ const l=document.querySelector('#noteHost .editor-preview-active a.plink, #noteHost .editor-preview-active a.evlink'); if(!l) return null; l.scrollIntoView({block:'center'}); const r=l.getBoundingClientRect(); return {x:r.left+r.width/2, y:r.top+r.height/2, x0:r.left, y0:r.top, w:r.width, h:r.height}; })()`);
    if (!a) throw new Error('nessun rimando nell anteprima dell appunto');
    await L.pausa(400);
    await L.muovi(a.x, a.y);
    /* ⚠️ Mezzo secondo di attesa e' il ritardo VERO (SBIRCIA.timer): sfiorando
       di passaggio la bolla non deve comparire. Scattare prima da' un vuoto. */
    await L.pausa(900);
    const b = await L.rect('#rimBolla');
    const x0 = Math.min(a.x0, b.x) - 24, y0 = Math.min(a.y0, b.y) - 24;
    await L.puntatore(a.x, a.y);
    await L.scatta('130-sbircia-bolla', { clip: { x: x0, y: y0, width: Math.max(a.x0 + a.w, b.x + b.w) - x0 + 24, height: Math.max(a.y0 + a.h, b.y + b.h) - y0 + 24 }, scala: 2 });
    await L.overlayPulisci();
    await L.val(`sbirciaChiudi()`);
    await L.clicca('#noteHost .editor-toolbar button.preview'); await L.pausa(400);
  });

  /* ── Q1: il quaderno si riapre alla riga ── */
  await passo('140 il segno di riga', async () => {
    const nf = await noteFileChe(/rocciosi/i);
    await L.val(`noteOpen(${JSON.stringify(nf)})`); await L.pausa(800);
    /* un corpo abbastanza lungo da avere un «piu' in basso» */
    /* ⚠️ L'appunto dev'essere piu' lungo della finestra, o non scorre niente e
       il segno non ha nulla da dimostrare: la prima versione ci stava tutta a
       schermo, e la riga segnata cadeva fuori dal ritaglio. */
    await L.val(`NOTES.mde.value(["# Pianeti rocciosi","","I quattro pianeti interni sono rocciosi: Mercurio, Venere, Terra e Marte. Sono piccoli, densi, con una superficie solida su cui in teoria si potrebbe camminare.","","## Mercurio","Il piu\u0300 vicino al Sole. Non ha atmosfera: quello che c\u2019era e\u0300 stato spazzato via dal vento solare.","","Di giorno supera i 400 gradi, di notte scende sotto i meno 170. La differenza piu\u0300 grande del sistema solare.","","## Venere","Atmosfera densissima di anidride carbonica, e un effetto serra che non si ferma piu\u0300.","","In superficie ci sono novanta atmosfere: come stare a novecento metri sott\u2019acqua.","","## Terra","L\u2019unico con acqua liquida in superficie, ed e\u0300 questo che cambia tutto il resto.","","## Marte","Il pianeta rosso: il colore lo da\u0300 l\u2019ossido di ferro nella polvere.","","Ha le due calotte di ghiaccio, e il vulcano piu\u0300 alto che si conosca.","","## Che cosa hanno in comune","Superficie solida, densita\u0300 alta, pochi satelliti o nessuno.","","## Da chiedere alla prof","Perche\u0301 i giganti gassosi stanno tutti oltre la linea del ghiaccio?",""].join("\\n"))`);
    await L.pausa(600);
    await L.val(`(()=>{ const cm=NOTES.mde.codemirror; cm.setCursor({line:26,ch:0}); cm.focus(); if(typeof rigaSegna==='function') rigaSegna(); return 1; })()`);
    await L.pausa(1400);
    await L.val(`rigaFlush && rigaFlush()`); await L.pausa(600);
    /* si chiude davvero: si apre l'ALTRO appunto e si torna. Fingere di
       riaprire (rigaVaiAlSegno a mano) proverebbe la funzione, non il gesto. */
    const altro = await noteFileChe(/classe/i);
    await L.val(`noteOpen(${JSON.stringify(altro)})`); await L.pausa(900);
    await L.val(`noteOpen(${JSON.stringify(nf)})`); await L.pausa(1400);
    const riga = await L.val(`(()=>{ const cm=NOTES.mde.codemirror; const n=cm.getCursor().line; const c=cm.charCoords({line:n,ch:0},'window'); const w=cm.getWrapperElement().getBoundingClientRect(); return {x:w.left+6, y:c.top, w:w.width-12, h:Math.max(18,c.bottom-c.top), n:n}; })()`);
    console.log('riga al riaprire:', riga && riga.n);
    const cont = await L.rect('#noteHost .EasyMDEContainer');
    if (riga) await L.cornice({ x: riga.x, y: riga.y, w: riga.w, h: riga.h }, { etichetta: 'qui eri rimasto' });
    await L.scatta('140-riga-al-segno', { clip: { x: cont.x, y: cont.y - 6, width: cont.w, height: cont.h + 12 }, scala: 2 });
    await L.overlayPulisci();
  });

  /* ── Q5: la lente vede anche le mappe e le didascalie ── */
  await passo('150 la lente su mappe e ritagli', async () => {
    /* un ritaglio senza didascalia non ha testo da trovare: dargliela e' il
       gesto vero, ed e' anche il modo di farsi trovare. */
    await L.val(`bancoAssegna('C','album')`); await L.pausa(900);
    const rid = await L.val(`document.querySelector('#albLista .alcard')?.dataset.id`);
    if (rid) {
      await L.val(`albumAzione('rinomina', ${JSON.stringify(rid)})`); await L.pausa(600);
      await L.val(`document.getElementById('umInput').value='Le orbite dei pianeti rocciosi'`);
      await L.clicca('#umOk'); await L.pausa(900);
    }
    await toastVia();
    /* ⚠️ La mappa qui e' CHIUSA di proposito, ed e' il punto della figura: fino
       al 30 agosto 2026 di una mappa non aperta la lente conosceva solo il
       titolo. Se un giorno questa figura tornasse senza la sezione della mappa,
       vuol dire che `mappe.nodi` non risponde piu'. */
    await L.val(`bancoForma('due-col'); bancoAssegna('C','appunti')`); await L.pausa(900);
    await L.val(`(()=>{ if(typeof mappaChiudi==='function') mappaChiudi(); MAPPA.mia={}; return 1; })()`).catch(() => {});
    await L.pausa(600);
    console.log('mappa aperta al momento della lente:', await L.val(`JSON.stringify((MAPPA.mia&&MAPPA.mia.file)||null)`));
    await L.clicca('#searchBtn'); await L.pausa(400);
    await scattaLente('150-lente-quattro-sezioni', 'rocciosi', 1400);
    await L.pulito();
  });

  /* ── Q7: la soglia dello zaino ── */
  await passo('160 la soglia dei media', async () => {
    await L.pulito();
    await L.rilascia([M + 'Nota vocale.aiff']); await L.pausa(3000);
    const t = await L.rect('#toast').catch(() => null);
    if (t) await L.scatta('160-soglia-rifiuto', { clip: { x: t.x - 20, y: t.y - 20, width: t.w + 40, height: t.h + 40 }, scala: 3 });
    else console.log('nessun toast: il file e ENTRATO — la soglia non ha fermato l aiff');
    const dentro = await L.val(`(async()=>{ const l=await window.vault.media.elenco(corsoAttivo()); return JSON.stringify((l.media||l||[]).map(m=>m.nome||m)); })()`).catch(() => '?');
    console.log('media nello zaino dopo l aiff:', dentro);
    await toastVia();
  });

  /* ── Q8: appunti, mappe e ritagli vanno nel Cestino di sistema ──
     ULTIMO, perche' distrugge le cose che tutti i passi di sopra usano. */
  await passo('170-173 il Cestino del quaderno', async () => {
    const altro = await noteFileChe(/classe/i);
    await L.val(`noteOpen(${JSON.stringify(altro)})`); await L.pausa(800);
    await conferma(false);
    await L.val(`noteDelete()`); await L.pausa(400);
    const q = await L.val(`window.__conf`);
    console.log('CONFERMA APPUNTO:', q);
    await L.dialogoFinto(q || '(nessuna conferma)');
    await L.scatta('170-conferma-elimina-appunto', { clip: { x: W / 2 - 260, y: 150, width: 520, height: 340 }, scala: 2 });
    await L.overlayPulisci();
    await conferma(true);
    await L.val(`noteDelete()`); await L.pausa(2000);
    const t = await L.rect('#toast').catch(() => null);
    if (t) await L.scatta('171-appunto-nel-cestino', { clip: { x: t.x - 20, y: t.y - 20, width: t.w + 40, height: t.h + 40 }, scala: 3 });
    await toastVia();

    /* la mappa: il cestino sta nella sua barra, e compare solo quando c'e'
       davvero una mappa da eliminare. */
    await L.val(`bancoAssegna('C','mappa')`); await L.pausa(1200);
    await L.val(`(async()=>{ if(!MAPPA.mia || !MAPPA.mia.file){ const l=await window.vault.mappe.elenco(corsoAttivo()); const m=(l.mappe||l)[0]; if(m) await mappaApriMia(m.file); } return 1; })()`); await L.pausa(1000);
    await bloccoLargo('C');
    const ces = await L.centro('#mCestino').catch(() => null);
    if (ces) {
      await L.puntatore(ces.x, ces.y);
      const mb = await L.rect('#mappaView .mtoolbar');
      await L.scatta('172-cestino-mappa', { clip: { x: mb.x, y: mb.y - 4, width: Math.min(mb.w, 620), height: mb.h + 8 }, scala: 3 });
      await L.overlayPulisci();
      await conferma(false);
      await L.clicca('#mCestino'); await L.pausa(400);
      const q2 = await L.val(`window.__conf`);
      console.log('CONFERMA MAPPA:', q2);
      await L.dialogoFinto(q2 || '(nessuna conferma)');
      await L.scatta('173-conferma-elimina-mappa', { clip: { x: W / 2 - 260, y: 150, width: 520, height: 340 }, scala: 2 });
      await L.overlayPulisci();
    } else console.log('#mCestino assente: nessuna mappa aperta');
    await bloccoTorna();
    await conferma(false);
    await L.val(`bancoAssegna('C','appunti')`); await L.pausa(400);
    await toastVia();
  });

  console.log('\nCampagna finita. Passi da verificare: '+errori.join(', '));
  fs.writeFileSync(path.join(VAULT,'screenshot-errori.json'),JSON.stringify(errori));
  process.exit(errori.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
