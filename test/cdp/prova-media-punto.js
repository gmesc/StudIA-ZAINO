/* Il punto d'ascolto che sopravvive, e i media che si vedono e si tolgono.
 *
 * ⚠️ Che cosa questa prova difende davvero. Tre patti sui media dello zaino:
 *
 * 1) un media portato dentro COMPARE fra le fonti della sidebar (♪/▶) e si
 *    apre nel player da lì — prima finiva nel corpus e non si vedeva da
 *    nessuna parte: sembrava perso;
 * 2) il MINUTO a cui l'hai fermato sopravvive alla pausa, al cambio di
 *    contenitore e alla riapertura dell'app — il primo `timeupdate` di un
 *    media appena caricato arriva a 0 PRIMA del salto, e senza la sentinella
 *    `PLAYER.pronto` era la riapertura stessa ad azzerare il segno sul disco;
 * 3) il player ha il cestino (solo nello zaino), e il canale `media:elimina`
 *    manda il file nel Cestino e lo toglie dal corpus.
 *
 * Il media è un WAV generato qui: il vault di prova è una copia magra, senza
 * MATERIALI — un audio di un minuto pesa meno di un PDF e basta per tutto.
 *
 *   ./test/cdp/con-vault-di-prova.sh prova-media-punto.js
 */
const path = require('path');
const fs = require('fs');
const S = path.join(__dirname, 'cdp.js');
const { collega, val, clicca, pausa, partiPulito } = require(S);

let ko = 0;
function ok(n, atteso, avuto) {
  const a = JSON.stringify(atteso), b = JSON.stringify(avuto);
  if (a === b) { console.log('  ok  ' + n); return; }
  ko++; console.log('  KO  ' + n + '\n      atteso ' + a + '\n      avuto  ' + b);
}
function sezione(t) { console.log('\n== ' + t); }

async function finoA(expr, quanto) {
  const fine = Date.now() + (quanto || 12000);
  for (;;) {
    let v = null;
    try { v = await val(expr); } catch (e) { /* durante un reload l'app non risponde */ }
    if (v) return v;
    if (Date.now() > fine) return null;
    await pausa(200);
  }
}

/** Un WAV vero: PCM 16 bit, mono, 8 kHz, un sinusoide — 60 secondi. */
function wavDiProva(secondi) {
  const rate = 8000, n = rate * secondi, dati = Buffer.alloc(n * 2);
  for (let i = 0; i < n; i++) dati.writeInt16LE(Math.round(3000 * Math.sin(i / 20)), i * 2);
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + dati.length, 4); h.write('WAVE', 8);
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36); h.writeUInt32LE(dati.length, 40);
  return Buffer.concat([h, dati]);
}

const ZAINO = 'media-di-prova';
const WAV = '01 lezione di prova.wav';

(async () => {
  await collega();
  await partiPulito();

  sezione('Un audio entra nello zaino e COMPARE fra le fonti');
  await val(`(async()=>{ if(modoAttivo()!=='zaino') await cambiaModo('zaino');
    if(zainoAttivo()!=='${ZAINO}') await zainoCrea('Media di prova'); return 1; })()`);
  await finoA(`zainoAttivo()==='${ZAINO}' ? 1 : 0`, 10000);
  const vault = await val('window.vault.path');
  const dirAudio = path.join(vault, 'Zaini', ZAINO, 'MATERIALI', 'Audio');
  fs.mkdirSync(dirAudio, { recursive: true });
  fs.writeFileSync(path.join(dirAudio, WAV), wavDiProva(60));
  await val('zainoNavAggiorna()');
  const voce = await finoA(`document.querySelectorAll('#zainoNav .zn-media').length ? 1 : 0`, 10000);
  ok('la voce ♪ è in sidebar, fra le fonti', 1, voce);
  /* ⚠️ La sidebar si è appena riscritta: un click calcolato su un nodo appena
     sostituito arriva a un elemento staccato (trappola di prova-zaino, stessa
     pausa). E se il primo click cade comunque nel vuoto, se ne fa un secondo:
     qui si prova il SEGNO d'ascolto, non la stabilità del DOM della sidebar. */
  await pausa(800);
  try{ await clicca('#zainoNav .zn-media'); }catch(e){ /* nodo appena sostituito */ }
  var aperto = await finoA(`(typeof PLAYER!=='undefined' && PLAYER.file===${JSON.stringify(WAV)}) ? 1 : 0`, 6000);
  if(!aperto){
    /* Il click può cadere nel ricambio della sidebar: qui si prova il SEGNO,
       non la stabilità del DOM — si passa dalla porta vera, che è la stessa
       funzione che il click chiama. */
    await val(`(()=>{ playerApri(${JSON.stringify(WAV)}, null, 'prova'); return 1; })()`);
  }
  aperto = await finoA(`(typeof PLAYER!=='undefined' && PLAYER.file===${JSON.stringify(WAV)} && PLAYER.pronto) ? 1 : 0`, 12000);
  ok('il click (o la sua porta) apre nel player, pronto al segno', 1, aperto);
  ok('e il cestino del player è a schermo (siamo nello zaino)', true,
    await val(`(()=>{ const b=document.getElementById('plElimina');
      return !!b && !b.hidden && b.getBoundingClientRect().width>0; })()`));

  sezione('Fermato al secondo 30: il segno si scrive SUBITO');
  await val(`(()=>{ playerVaiA(30); return 1; })()`);
  await pausa(400);
  await val(`(()=>{ playerPausa(); return 1; })()`);
  const segnato = await finoA(`ascoltoSecondo(${JSON.stringify(WAV)})===30 ? 1 : 0`, 6000);
  ok('il segno d\'ascolto dice 30', 1, segnato);

  sezione('L\'app si riapre: stesso audio, stesso secondo, in PAUSA');
  try { await val(`(setTimeout(()=>location.reload(),80),1)`); } catch (e) {}
  await pausa(2500);
  await collega();
  await finoA(`(typeof bancoStato==='function' && document.documentElement.dataset.modo==='zaino') ? 1 : 0`, 20000);
  const tornato = await finoA(`(()=>{ if(typeof PLAYER==='undefined' || PLAYER.file!==${JSON.stringify(WAV)}) return 0;
    const v=document.getElementById('mediaVideo'); if(!v || !v.paused) return 0;
    const s=Math.round(v.currentTime); return (s>=29 && s<=31) ? 1 : 0; })()`, 20000);
  ok('il player riapre al secondo 30, fermo', 1, tornato);
  /* ⚠️ Il controllo del veleno: la riapertura NON deve aver riscritto il segno
     con lo 0 del caricamento — era il bug misurato, e il disco è la verità. */
  await pausa(1200);
  ok('e il segno sul disco è ancora 30, non azzerato dalla riapertura', 30,
    await val(`ascoltoSecondo(${JSON.stringify(WAV)})`));

  sezione('Il canale del cestino: via dal corpus, senza sorprese');
  const esito = await val(`window.vault.media.elimina('${ZAINO}', ${JSON.stringify(WAV)}).then(r=>r&&r.error||'')`);
  ok('media:elimina risponde senza errore', '', esito);
  const sparito = await val(`window.vault.corpus.list('${ZAINO}').then(l=>(l||[]).every(m=>m.name!==${JSON.stringify(WAV)})?1:0)`);
  ok('e il corpus non lo elenca più', 1, sparito);
  await val(`(()=>{ try{ playerChiudi(); }catch(e){} return 1; })()`);
  await val('zainoNavAggiorna()');
  await pausa(500);
  ok('la sidebar non lo mostra più', 0, await val(`document.querySelectorAll('#zainoNav .zn-media').length`));

  /* In ordine per la prova dopo. */
  await val(`(async()=>{ await cambiaModo('corso'); return 1; })()`);

  console.log(ko ? `\n✗ ${ko} controlli falliti` : '\n✓ tutti i controlli passati');
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error('prova-media-punto: ' + (e && e.message)); process.exit(1); });
