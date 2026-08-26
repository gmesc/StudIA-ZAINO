/* Lo strumento «Postille»: il perché delle proprie sottolineature, tutte insieme.
 *
 * ⚠️ Perché esiste. La postilla si scriveva e non aveva nessun posto dove
 * mostrarsi: sul documento le evidenze si dipingono con la Custom Highlight
 * API, che non crea elementi su cui passare il mouse, e una frase lunga non
 * diventa «parola chiave», quindi non ha nemmeno un chip. L'utente ha riferito
 * «non si salva» di una postilla che era sul disco — invisibile e non salvato,
 * per chi la usa, sono la stessa cosa.
 *
 * Che cosa entra nell'elenco, come si raggruppa e in che ordine lo decide
 * `evidenze/postille.js`, provato in Node (`test/postille.js`). Qui si misura
 * il CABLAGGIO: lo strumento è nel registro, il pannello si monta, l'elenco si
 * riempie, e un click porta dove la frase è stata segnata.
 *
 *   ./test/cdp/con-vault-di-prova.sh prova-postille-vista.js
 */
const path = require('path');
const fs = require('fs');
const S = path.join(__dirname, 'cdp.js');
const { collega, val, pausa, partiPulito, apriStrumento } = require(S);

let ko = 0;
function ok(n, atteso, avuto) {
  const a = JSON.stringify(atteso), b = JSON.stringify(avuto);
  if (a === b) { console.log('  ok  ' + n); return; }
  ko++; console.log('  KO  ' + n + '\n      atteso ' + a + '\n      avuto  ' + b);
}
function sezione(t) { console.log('\n== ' + t); }
async function finoA(expr, q) { const f = Date.now() + (q || 20000);
  for (;;) { const v = await val(expr); if (v) return v; if (Date.now() > f) return null; await pausa(250); } }

const ZAINO = 'zaino-postille';

(async () => {
  await collega();
  await val('location.reload(), 1'); await pausa(2500);
  await collega(); await pausa(800);
  await partiPulito();

  sezione('Lo strumento c\'è, ed è del quaderno');
  {
    ok('è nel registro del banco', 'Postille', await val(`(bancoStrumenti().postille||{}).nome||''`));
    ok('con il suo pannello', true, await val(`bancoDisponibile('postille')`));
    ok('e sta con gli strumenti del quaderno', 'quaderno',
      await val(`(bancoStrumenti().postille||{}).famiglia||''`));
    /* ⚠️ Vale in tutte e due le metà dell'app: si postilla un capitolo come un
       documento, e uno strumento offerto solo di là sarebbe una funzione che
       compare e sparisce cambiando modalità. */
    ok('offerto nei corsi', true, await val(`!!bancoStrumentiOfferti().postille`));
    ok('e negli zaini', true, await val(`(()=>{ const p=modoAttivo();
      try{ MODO.ora='zaino'; return !!bancoStrumentiOfferti().postille; } finally{ MODO.ora=p; } })()`));
  }

  sezione('Uno zaino, un documento, e due postille');
  const vault = await val('window.vault.path');
  await val(`(async()=>{ await cambiaModo('zaino'); await zainoCrea('Zaino postille'); return 1; })()`);
  await finoA(`zainoAttivo()==='${ZAINO}' ? 1 : 0`, 15000);
  const fuori = fs.mkdtempSync(path.join(require('os').tmpdir(), 'studia-po-'));
  const orig = fs.readdirSync(path.join(vault, 'Fonti')).filter((f) => f.toLowerCase().endsWith('.pdf'))[0];
  fs.copyFileSync(path.join(vault, 'Fonti', orig), path.join(fuori, 'Dispensa.pdf'));
  const entrato = await val(`(async()=>{ const r=await window.vault.fonti.importa(corsoAttivo(),
    [${JSON.stringify(path.join(fuori, 'Dispensa.pdf'))}]);
    return (r.copiati||[]).map(function(x){ return x.nome; })[0]||''; })()`);
  ok('il documento è entrato', '01 Dispensa.pdf', entrato);

  /* Due evidenze con postilla e una senza: l'elenco deve mostrarne due. */
  await val(`(()=>{ const api=window.vault.evidenze, c=corsoAttivo();
    const a=api.aggiungi(c, { exact:'la prima frase segnata', materiale:${JSON.stringify(entrato)}, pagina:5 });
    const b=api.aggiungi(c, { exact:'la seconda frase segnata', materiale:${JSON.stringify(entrato)}, pagina:2 });
    const z=api.aggiungi(c, { exact:'una senza commento', materiale:${JSON.stringify(entrato)}, pagina:1 });
    api.postilla(c, a.evidenza.id, 'contraddice quello di prima');
    api.postilla(c, b.evidenza.id, 'chiedere al tutor');
    evidenzeCarica(); return 1; })()`);

  sezione('Il pannello si monta e mostra le postille');
  ok('il banco lo mette a schermo', 'a schermo', await apriStrumento('postille'));
  await pausa(600);
  const vista = await val(`(()=>{ const h=document.getElementById('poLista'); if(!h) return null;
    return { voci:[...h.querySelectorAll('.po-voce')].map(function(v){
               return (v.querySelector('.po-nota')||{}).textContent||''; }),
             gruppi:[...h.querySelectorAll('.po-gruppo')].map(function(g){ return (g.textContent||'').trim(); }),
             conto:(document.getElementById('poConto')||{}).textContent||'' }; })()`);
  ok('ci sono le due postille, e non la terza evidenza', 2, vista && vista.voci.length);
  /* ⚠️ Ordinate per PAGINA: è l'ordine in cui si incontrano leggendo, non
     quello in cui sono state scritte. La p. 2 viene prima della p. 5. */
  ok('nell\'ordine delle pagine', ['chiedere al tutor', 'contraddice quello di prima'], vista && vista.voci);
  ok('raggruppate sotto il loro documento', ['Dispensa'], vista && vista.gruppi);
  ok('e il conto le dichiara', '2 postille', vista && vista.conto);

  sezione('La ricerca filtra, e il conto resta quello vero');
  {
    await val(`(()=>{ const i=document.getElementById('poCerca'); i.value='tutor';
      i.dispatchEvent(new Event('input', { bubbles:true })); return 1; })()`);
    await pausa(300);
    const dopo = await val(`(()=>({ voci:document.querySelectorAll('#poLista .po-voce').length,
      conto:(document.getElementById('poConto')||{}).textContent||'' }))()`);
    ok('resta la sola che contiene la parola', 1, dopo.voci);
    /* ⚠️ Il conto dice quante postille ESISTONO, non quante se ne stanno
       guardando: se calasse col filtro, cercare sembrerebbe farle sparire. */
    ok('ma il conto non mente sul totale', '2 postille', dopo.conto);
    await val(`(()=>{ const i=document.getElementById('poCerca'); i.value='';
      i.dispatchEvent(new Event('input', { bubbles:true })); return 1; })()`);
    await pausa(300);
  }

  sezione('⚠️ Un click porta DOVE la frase è stata segnata');
  {
    await apriStrumento('fonte');
    await val(`openPdf(${JSON.stringify(entrato)}, 9, 'Dispensa'), 1`);
    await finoA(`(ANTEPRIMA.page===9) ? 1 : 0`, 15000);
    ok('il documento è su un\'altra pagina', 9, await val(`ANTEPRIMA.page`));
    await apriStrumento('postille');
    await pausa(500);
    await val(`(()=>{ const v=document.querySelectorAll('#poLista .po-voce')[0]; if(v) v.click(); return 1; })()`);
    const arrivato = await finoA(`(ANTEPRIMA.page===2) ? 1 : 0`, 15000);
    /* La prima voce è quella di p. 2: il click deve portare lì, e passa dalla
       stessa porta del chip («Vai»), non da una seconda strada. */
    ok('e il click apre il documento alla pagina della sua frase', 1, arrivato);
  }

  sezione('Il vuoto dice come si fa, non «nessun risultato»');
  {
    await val(`(()=>{ const api=window.vault.evidenze, c=corsoAttivo();
      (api.leggi(c).evidenze||[]).forEach(function(e){ if(e.nota) api.postilla(c, e.id, ''); });
      evidenzeCarica(); evidenzeDisegna(); return 1; })()`);
    await pausa(500);
    const vuoto = await val(`(document.querySelector('#poLista .povuoto')||{}).textContent||''`);
    ok('senza postille il pannello spiega il gesto', true, /Postilla/.test(vuoto));
    ok('e non finge che non ci siano sottolineature', true, /sottolineature/.test(vuoto));
  }

  /* si lascia il contenitore com'era */
  await val(`(()=>{ const api=window.vault.evidenze, c=corsoAttivo();
    (api.leggi(c).evidenze||[]).forEach(function(e){ api.rimuovi(c, e.id); });
    evidenzeCarica(); evidenzeDisegna(); return 1; })()`);
  await val(`(async()=>{ if(modoAttivo()!=='corso') await cambiaModo('corso'); return 1; })()`);
  console.log('\n' + (ko ? '✗ ' + ko + ' controlli falliti' : '✓ tutti i controlli passati'));
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('✗ ' + (e && e.message ? e.message : e)); process.exit(1); });
