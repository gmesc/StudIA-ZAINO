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
const { collega, val, pausa, partiPulito, apriStrumento } = require(S);

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
