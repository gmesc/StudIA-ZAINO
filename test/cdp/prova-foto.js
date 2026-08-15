/* Le immagini che entrano nell'Album Foto, dalla porta vera.
 *
 * ⚠️ Che cosa NON si può simulare, e va detto invece di fingere: il
 * trascinamento dal Finder. CDP consegna un `dragEvent` ma non i PERCORSI dei
 * file, e senza percorso non si può provare la strada dell'HEIC — che è l'unica
 * che passa dal main (`sips`). Quel pezzo sta in `test/heic.js` e nei gesti a
 * mano. Qui si prova tutto il resto passando dalla stessa funzione che il
 * `drop` chiama, con dei `File` veri costruiti nella pagina.
 *
 * Il controllo che vale più di tutti: il formato lo dicono i BYTE. Un file di
 * testo chiamato `.png` non deve entrare — se entrasse, nel vault ci sarebbe
 * un'immagine che un giorno non si apre e nessuno saprebbe perché.
 *
 *   ./test/cdp/con-vault-di-prova.sh prova-foto.js
 */
const S = require('path').join(__dirname, 'cdp.js');
const { collega, val, invia, pausa, partiPulito, apriStrumento } = require(S);

/** Trascina col mouse VERO. `mod` sono i modificatori CDP (4 = ⌘): un evento
 *  del mouse li porta con sé, ed è così che l'app sa che si sta ritagliando. */
async function trascina(x1, y1, x2, y2, mod) {
  const m = mod || 0;
  await invia('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x1, y: y1, modifiers: m });
  await invia('Input.dispatchMouseEvent', { type: 'mousePressed', x: x1, y: y1, button: 'left', clickCount: 1, modifiers: m });
  for (let i = 1; i <= 6; i++) {
    await invia('Input.dispatchMouseEvent', { type: 'mouseMoved',
      x: Math.round(x1 + (x2 - x1) * i / 6), y: Math.round(y1 + (y2 - y1) * i / 6), button: 'left', modifiers: m });
    await pausa(30);
  }
  await invia('Input.dispatchMouseEvent', { type: 'mouseReleased', x: x2, y: y2, button: 'left', clickCount: 1, modifiers: m });
}

let ko = 0;
function ok(n, atteso, avuto) {
  const a = JSON.stringify(atteso), b = JSON.stringify(avuto);
  if (a === b) { console.log('  ok  ' + n); return; }
  ko++; console.log('  KO  ' + n + '\n      atteso ' + a + '\n      avuto  ' + b);
}
function sezione(t) { console.log('\n== ' + t); }

async function finoA(expr, quanto) {
  const fine = Date.now() + (quanto || 20000);
  for (;;) {
    const v = await val(expr);
    if (v) return v;
    if (Date.now() > fine) return null;
    await pausa(250);
  }
}

const ZAINO = 'zaino-foto';

/* Le immagini si fabbricano NELLA PAGINA: un canvas dà un PNG e un JPEG veri —
   con l'intestazione giusta, che è ciò che l'import guarda — e la GIF si scrive
   a mano perché il canvas non la produce. `fileDa` costruisce il `File` che il
   trascinamento consegnerebbe. */
const FABBRICA = `
  window.__foto = {
    async png(w, h, colore){
      const c=document.createElement('canvas'); c.width=w; c.height=h;
      const g=c.getContext('2d'); g.fillStyle=colore||'#3b82f6'; g.fillRect(0,0,w,h);
      const b=await new Promise(r=>c.toBlob(r,'image/png'));
      return b;
    },
    async jpg(w, h, colore){
      const c=document.createElement('canvas'); c.width=w; c.height=h;
      const g=c.getContext('2d'); g.fillStyle=colore||'#facc15'; g.fillRect(0,0,w,h);
      const b=await new Promise(r=>c.toBlob(r,'image/jpeg',0.9));
      return b;
    },
    gif(){
      /* Una GIF89a minima e VALIDA: 1x1, tabella colori globale, un blocco
         immagine. Il browser deve saperla disegnare, o l'import la scarta. */
      const byte=[0x47,0x49,0x46,0x38,0x39,0x61,1,0,1,0,0x80,0,0,
                  0xff,0xff,0xff,0,0,0,
                  0x2c,0,0,0,0,1,0,1,0,0,
                  0x02,0x02,0x44,0x01,0x00,0x3b];
      return new Blob([new Uint8Array(byte)], {type:'image/gif'});
    },
    testo(t){ return new Blob([t||'non sono un immagine'], {type:'text/plain'}); },
    file(blob, nome){ return new File([blob], nome, {type:blob.type}); }
  };
  1`;

(async () => {
  await collega();
  await val('location.reload(), 1'); await pausa(2000);
  await collega(); await pausa(800);
  await partiPulito();
  await val(FABBRICA);
  /* ⚠️ Si prende la disposizione del banco PRIMA di toccarla. Questa prova apre
     uno strumento nuovo e passa in modalità zaino: senza rimettere le cose
     com'erano, il rosso lo prendono le prove dopo — ed è successo davvero
     (`prova-modo` e `prova-evidenze-pdf`, che con lo zaino attivo guardano
     un'altra app). Una prova lascia il banco come l'ha trovato. */
  const bancoPrima = await val('JSON.stringify(bancoStato())');

  sezione('L\'Album Foto vive negli ZAINI, e in un corso non si offre nemmeno');
  /* ⚠️ Si guarda l'elenco delle voci OFFERTE, non il riquadro: il riquadro
     esiste sempre nel DOM (il banco lo sposta, non lo crea), e cercarlo lì
     direbbe «c'è» anche dove non si può scegliere. */
  ok('in un corso la voce non c\'è', false,
    await val("Object.keys(bancoStrumentiOfferti()).indexOf('foto')>=0"));

  await val(`(async()=>{ await cambiaModo('zaino'); await zainoCrea('Zaino foto'); return 1; })()`);
  await finoA(`zainoAttivo()==='${ZAINO}' ? 1 : 0`, 10000);
  await pausa(600);
  ok('in uno zaino sì', true,
    await val("Object.keys(bancoStrumentiOfferti()).indexOf('foto')>=0"));
  ok('e i Ritagli hanno cambiato nome', 'Ritagli', await val("bancoStrumenti().album.nome"));

  await apriStrumento('foto');
  await pausa(400);
  ok('il riquadro è a schermo', true, await val("bancoVisibile('foto')"));
  ok('e dice come si comincia', true,
    /Trascina/.test(await val("document.getElementById('fotoLista').textContent")));

  sezione('Tre immagini entrano — e ognuna porta il nome del suo file');
  const corso = await val('corsoAttivo()');
  const esito = await val(`(async()=>{
    const f=window.__foto;
    const files=[ f.file(await f.png(300,200), 'Cartello.png'),
                  f.file(await f.jpg(240,180), 'Gita al lago.jpg'),
                  f.file(f.gif(), 'ciclo.gif') ];
    await fotoTrascinate(files);
    return 1; })()`);
  ok('l\'import è andato a termine', 1, esito);
  const voci = await finoA(`(()=>{ const v=(window.vault.album.elenco(${JSON.stringify(corso)},'foto').voci||[]);
    return v.length>=3 ? v : null; })()`, 20000);
  ok('nell\'archivio ce ne sono tre', 3, voci ? voci.length : 0);
  ok('e si dichiarano foto', ['foto', 'foto', 'foto'], (voci || []).map((v) => v.origine));
  ok('la didascalia di partenza è il nome del file',
    ['Cartello', 'Gita al lago', 'ciclo'].sort(),
    (voci || []).map((v) => v.didascalia).sort());
  /* ⚠️ Una foto NON ha una pagina: se ne avesse una, sarebbe inventata. */
  ok('nessuna dichiara una pagina', [undefined, undefined, undefined],
    (voci || []).map((v) => v.pagina));
  ok('e ognuna ha la sua miniatura', 3, (voci || []).filter((v) => !!v.mini).length);
  console.log('   ' + (voci || []).map((v) => v.file).join(' · '));

  sezione('⚠️ La GIF entra com\'è: dal canvas tornerebbe un fotogramma solo');
  const gif = (voci || []).find((v) => /ciclo/.test(v.didascalia));
  ok('resta un .gif', true, !!gif && /\.gif$/.test(gif.file));

  sezione('Le due griglie sono due filtri sullo stesso archivio');
  await pausa(600);
  const griglie = await val(`({ foto:document.querySelectorAll('#fotoLista .alcard').length,
    ritagli:document.querySelectorAll('#albLista .alcard').length,
    conto:document.getElementById('fotoConto').textContent })`);
  ok('le tre immagini sono nell\'Album Foto', 3, griglie.foto);
  ok('e nei Ritagli non ce n\'è nessuna', 0, griglie.ritagli);
  ok('il conto lo dice a parole', '3 immagini', griglie.conto);

  sezione('La stessa immagine due volte non fa due card');
  await val(`(async()=>{ const f=window.__foto;
    await fotoTrascinate([ f.file(await f.png(300,200), 'un altro nome.png') ]); return 1; })()`);
  await pausa(1500);
  ok('nell\'archivio ce ne sono ancora tre', 3,
    (await val(`(window.vault.album.elenco(${JSON.stringify(corso)},'foto').voci||[]).length`)));

  sezione('⚠️ Il formato lo dicono i BYTE, non il nome');
  await val(`(async()=>{ const f=window.__foto;
    await fotoTrascinate([ f.file(f.testo(), 'finta.png'), f.file(f.testo(), 'note.txt') ]); return 1; })()`);
  await pausa(1200);
  ok('un file di testo chiamato .png non entra', 3,
    (await val(`(window.vault.album.elenco(${JSON.stringify(corso)},'foto').voci||[]).length`)));
  /* E l'utente lo sa: il rifiuto è scritto, non silenzioso. */
  const avviso = await val(`(()=>{ const t=document.getElementById('toast');
    return t ? t.textContent : ''; })()`);
  console.log('   avviso a schermo: ' + JSON.stringify(avviso));
  ok('e l\'app lo dice', true, /finta\.png|note\.txt|immagine/.test(avviso));

  sezione('⚠️ Un file che non entra dice che cosa entra DOVE SI È');
  /* Prima rispondeva «qui si rilascia una lezione .json» anche dentro uno
     zaino, dove le lezioni non si rilasciano affatto: un rifiuto che manda a
     cercare una porta che in quella modalità non esiste. */
  await val(`(async()=>{ const f=window.__foto;
    const files=[ f.file(f.testo('due righe'), 'appunti.txt') ];
    /* ⚠️ Si passa dal gestore della caduta, non da fotoTrascinate: il messaggio
       che si vuole misurare lo scrive lui, quando nessuno vuole quel file.
       ⚠️⚠️ E niente apici inversi in questo commento: sta dentro un template
       letterale e uno di quelli lo chiude a metà. È l'ottava volta. */
    const dt=new DataTransfer(); files.forEach(x=>dt.items.add(x));
    window.dispatchEvent(new DragEvent('drop', { dataTransfer:dt, bubbles:true, cancelable:true }));
    return 1; })()`);
  await pausa(800);
  const rifiuto = await val("(()=>{ const t=document.getElementById('toast'); return t?t.textContent:''; })()");
  console.log('   ' + JSON.stringify(rifiuto));
  ok('il rifiuto nomina il file', true, /appunti\.txt/.test(rifiuto));
  ok('e dice che cosa entra in uno zaino', true, /pdf/i.test(rifiuto) && /immagini/i.test(rifiuto));
  ok('senza parlare di lezioni, che qui non si rilasciano', false, /lezione/i.test(rifiuto));

  sezione('Una foto non ha una fonte a cui tornare, e il menu lo dichiara');
  const id = (voci || [])[0].id;
  await val(`albumMenu(${JSON.stringify(id)}, 200, 200), 1`);
  await pausa(300);
  const menu = await val(`(()=>{ const b=document.querySelector('#albMenu .ctx-item[data-alb="fonte"]');
    return b ? { spento:b.disabled, motivo:(b.querySelector('.ctx-scorc')||{}).textContent||'' } : null; })()`);
  ok('«Alla fonte» è spenta', true, !!menu && menu.spento);
  ok('e dice perché', true, !!menu && /portata dentro/.test(menu.motivo));
  await val('albumChiudiMenu(), 1');

  sezione('La didascalia si cambia, il file no');
  const prima = (voci || [])[0];
  const r = await val(`(()=>{ const r=window.vault.album.rinomina(${JSON.stringify(corso)}, ${JSON.stringify(id)}, 'Il cartello del parco');
    return { error:r.error, file:r.voce && r.voce.file, did:r.voce && r.voce.didascalia }; })()`);
  ok('la rinomina passa', '', r.error);
  ok('la didascalia è quella nuova', 'Il cartello del parco', r.did);
  ok('e il nome del file non si è mosso: è l\'identità a cui puntano i rimandi',
    prima.file, r.file);

  sezione('Il visualizzatore: si apre, si adatta, e segue il riquadro');
  /* Si passa dal doppio click sulla card, che è il gesto che chiunque prova per
     primo su una griglia di provini. */
  const cartello = (voci || []).find((v) => /Cartello/.test(v.didascalia));
  await val(`fotoApri(${JSON.stringify(cartello.id)}), 1`);
  await pausa(900);
  const apertura = await val(`({ aperta:FOTOV.aperta,
    grigliaNascosta:document.getElementById('fotoLista').hidden,
    vistaVisibile:!document.getElementById('fotoVista').hidden,
    barra:!document.getElementById('fotoBarraVista').hidden,
    titolo:document.getElementById('fotoTitolo').textContent,
    livello:document.getElementById('fotoZoomLvl').textContent })`);
  ok('l\'immagine aperta è quella', cartello.id, apertura.aperta);
  ok('la griglia lascia il posto', true, apertura.grigliaNascosta && apertura.vistaVisibile);
  ok('e la barra è quella della vista', true, apertura.barra);
  ok('il titolo è la didascalia', 'Cartello', apertura.titolo);
  /* Stessa grammatica delle fonti: il segno, non la percentuale. */
  ok('parte adattata alla larghezza', '⟷', apertura.livello);

  const larga = await finoA(`(()=>{ const i=document.getElementById('fotoImg');
    return i && i.naturalWidth ? Math.round(i.getBoundingClientRect().width) : null; })()`, 10000);
  const host = await val("Math.round(document.getElementById('fotoHost').clientWidth)");
  console.log('   immagine ' + larga + 'px in un riquadro da ' + host + 'px');
  /* ⚠️ «Alla larghezza» vuol dire ESATTAMENTE la larghezza del riquadro: se la
     scala fosse un numero fisso, questa misura non coinciderebbe. */
  ok('l\'immagine è larga quanto il riquadro', true, Math.abs(larga - host) <= 2);

  /* Il divisore del banco stringe il riquadro: la scala deve seguirlo. */
  const colPrima = await val('bancoStato().col');
  await val(`(()=>{ const s=bancoStato(); s.col=0.35; bancoSalva();
    bancoApplicaFrazioni(); bancoPosizionaDivisori(); bancoDopoLayout(); return 1; })()`);
  /* ⚠️ Non si pretende «più stretta»: il blocco della griglia può stare a destra
     del divisore, e allora spostarlo lo ALLARGA. L'invariante vero è un altro —
     l'immagine è larga quanto il riquadro, qualunque misura abbia adesso. */
  const dopoDivisore = await finoA(`(()=>{ const i=document.getElementById('fotoImg');
    const w=Math.round(i.getBoundingClientRect().width);
    return w !== ${larga} ? { img:w, host:Math.round(document.getElementById('fotoHost').clientWidth) } : null; })()`, 8000);
  ok('muovendo il divisore la scala si rifà', true, !!dopoDivisore);
  console.log('   → immagine ' + (dopoDivisore ? dopoDivisore.img : '?') + 'px · riquadro '
    + (dopoDivisore ? dopoDivisore.host : '?') + 'px');
  ok('e l\'immagine è ancora larga quanto il riquadro', true,
    !!dopoDivisore && Math.abs(dopoDivisore.img - dopoDivisore.host) <= 2);
  await val(`(()=>{ const s=bancoStato(); s.col=${colPrima}; bancoSalva();
    bancoApplicaFrazioni(); bancoPosizionaDivisori(); bancoDopoLayout(); return 1; })()`);
  await pausa(700);

  sezione('Lo zoom a mano esce dall\'adattamento, come sulle fonti');
  await val('fotoZoomPasso(true), 1'); await pausa(500);
  const aMano = await val(`({ testo:document.getElementById('fotoZoomLvl').textContent,
    salvato:localStorage.getItem('studia.foto.zoom') })`);
  ok('«+» porta alla percentuale', true, /%$/.test(aMano.testo));
  ok('e il livello si ricorda su disco', true, !/^page-/.test(aMano.salvato));
  await val('fotoZoomAdatta(), 1'); await pausa(500);
  /* Da una percentuale si rientra sempre dalla LARGHEZZA — è l'adattamento con
     cui un'immagine si apre, e la stessa regola delle fonti. */
  ok('il click sul livello torna a un adattamento', '⟷',
    await val("document.getElementById('fotoZoomLvl').textContent"));
  await val('fotoZoomAdatta(), 1'); await pausa(500);
  ok('e un altro click porta alla pagina intera', '⤢',
    await val("document.getElementById('fotoZoomLvl').textContent"));
  await val("localStorage.setItem('studia.foto.zoom','page-width'), fotoZoomApplica(), 1");
  await pausa(600);

  sezione('⌘ + trascinamento sull\'immagine: ne esce un ritaglio');
  const primaRitagli = await val(`(window.vault.album.elenco(${JSON.stringify(corso)},'ritaglio').voci||[]).length`);
  const box = await val(`(()=>{ const i=document.getElementById('fotoImg').getBoundingClientRect();
    const h=document.getElementById('fotoHost').getBoundingClientRect();
    const x=Math.max(i.left,h.left), y=Math.max(i.top,h.top);
    const x2=Math.min(i.right,h.right), y2=Math.min(i.bottom,h.bottom);
    return { x:Math.round(x), y:Math.round(y), w:Math.round(x2-x), h:Math.round(y2-y) }; })()`);
  console.log('   immagine a schermo: ' + JSON.stringify(box));
  await trascina(box.x + Math.round(box.w * 0.2), box.y + Math.round(box.h * 0.2),
                 box.x + Math.round(box.w * 0.7), box.y + Math.round(box.h * 0.7), 4);
  const dopoRitagli = await finoA(`(()=>{ const n=(window.vault.album.elenco(${JSON.stringify(corso)},'ritaglio').voci||[]).length;
    return n>${primaRitagli} ? n : null; })()`, 20000);
  ok('nei Ritagli ce n\'è uno in più', primaRitagli + 1, dopoRitagli);
  const nato = await val(`(()=>{ const v=window.vault.album.elenco(${JSON.stringify(corso)},'ritaglio').voci||[];
    return v[v.length-1]||null; })()`);
  ok('e sa da quale immagine viene', cartello.id, nato && nato.da);
  ok('senza inventarsi una pagina', undefined, nato && nato.pagina);
  /* ⚠️ Le coordinate sono i PIXEL VERI dell'immagine, non quelli a schermo: a
     un altro zoom gli stessi pixel di schermo indicherebbero un'altra area. */
  console.log('   rettangolo: ' + JSON.stringify(nato.rect) + ' su un\'immagine 300×200');
  ok('il rettangolo è nei pixel dell\'immagine', true,
    nato.rect.x < 300 && nato.rect.w > 20 && nato.rect.x + nato.rect.w <= 300);

  sezione('E dal ritaglio si torna all\'immagine, non a un documento');
  await val('fotoChiudiVista(), 1'); await pausa(400);
  ok('la griglia è tornata', false, await val('FOTOV.aperta ? true : false'));
  await val(`albumAzione('fonte', ${JSON.stringify(nato.id)}), 1`);
  await pausa(800);
  ok('«Alla fonte» riapre la foto madre', cartello.id, await val('FOTOV.aperta'));
  await val('fotoChiudiVista(), 1'); await pausa(400);

  sezione('E si rimette tutto com\'era');
  await val(`(async()=>{ await cambiaModo('corso'); return 1; })()`);
  await pausa(700);
  await val('(()=>{ BANCO.stato=JSON.parse(' + JSON.stringify(bancoPrima) + ');' +
    ' bancoSalva(); bancoDisegna(); bancoApplicaFrazioni(); bancoPosizionaDivisori();' +
    ' bancoDopoLayout(); return 1; })()');
  await pausa(600);
  ok('si torna ai corsi', 'corso', await val('modoAttivo()'));
  ok('e il banco è quello di prima', bancoPrima, await val('JSON.stringify(bancoStato())'));

  console.log(ko ? `\n✗ ${ko} controlli falliti` : '\n✓ tutti i controlli passati');
  process.exit(ko ? 1 : 0);
})();
