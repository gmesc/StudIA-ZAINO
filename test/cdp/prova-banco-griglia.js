/* La griglia larga del banco: tre colonne, quattro divisori, e le forme
 * disegnate dall'utente.
 *
 * ⚠️ Che cosa difende. Una `grid-template-areas` storta non solleva niente: il
 * CSS scarta la regola INTERA e impagina una griglia qualunque — il guasto si
 * vede a occhio, mesi dopo. Qui si misura che i blocchi nuovi esistano davvero
 * a schermo, che i divisori compaiano solo dove separano qualcosa, e che una
 * forma dipinta sopravviva al giro del localStorage.
 *
 *   ./test/cdp/con-vault-di-prova.sh prova-banco-griglia.js
 */
const S = require('path').join(__dirname, 'cdp.js');
const { collega, val, pausa, partiPulito } = require(S);

let ko = 0;
function ok(n, atteso, avuto) {
  const a = JSON.stringify(atteso), b = JSON.stringify(avuto);
  if (a === b) { console.log('  ok  ' + n); return; }
  ko++; console.log('  KO  ' + n + '\n      atteso ' + a + '\n      avuto  ' + b);
}
function sezione(t) { console.log('\n== ' + t); }

(async () => {
  await collega();
  await val('location.reload(), 1'); await pausa(2000);
  await collega(); await pausa(800);
  await partiPulito();
  const bancoPrima = await val('JSON.stringify(bancoStato())');

  sezione('Tre colonne: i blocchi ci sono, e sono larghi un terzo');
  await val("bancoForma('tre-col'), 1"); await pausa(600);
  const tre = await val(`(()=>{
    const vis=[...document.querySelectorAll('.blocco')].filter(b=>!b.hidden).map(b=>b.dataset.blocco);
    const el=document.getElementById('banco');
    const larghe=vis.map(b=>Math.round(document.querySelector('.blocco[data-blocco="'+b+'"]').getBoundingClientRect().width));
    return { vis:vis, larghe:larghe, template:el.style.gridTemplateColumns,
             div:[...document.querySelectorAll('.bdiv')].filter(d=>!d.hidden).map(d=>d.id) }; })()`);
  ok('i blocchi a schermo sono A, C, E', ['A', 'C', 'E'], tre.vis);
  /* ⚠️ Larghi UGUALI: senza il valore di fabbrica per le tre colonne, la prima
     partirebbe a metà — una colonna doppia che nessuno ha chiesto. */
  const [a, c, e] = tre.larghe;
  console.log('   larghezze: ' + tre.larghe.join(' · ') + ' — ' + tre.template);
  ok('e larghi quasi uguali', true, Math.abs(a - c) <= 8 && Math.abs(c - e) <= 8);
  ok('con i due divisori verticali e nessun orizzontale', ['bDivCol', 'bDivCol2'], tre.div);

  sezione('Sei blocchi: la 3×2 piena');
  await val("bancoForma('sei'), 1"); await pausa(600);
  ok('sei blocchi a schermo', ['A', 'B', 'C', 'D', 'E', 'F'],
    await val("[...document.querySelectorAll('.blocco')].filter(b=>!b.hidden).map(b=>b.dataset.blocco)"));
  ok('e compare anche il divisore orizzontale', true,
    await val("!document.getElementById('bDivRiga').hidden"));
  /* Il secondo divisore verticale si muove senza toccare il primo — e le
     griglie larghe scrivono i CAMPI loro (`col3`/`col3b`), non quelli della
     2×2: la taratura a due colonne non si sporca. */
  const prima = await val('({ col:bancoStato().col, col3:bancoStato().col3 })');
  await val(`(()=>{ const s=bancoStato(); s.col3b=BancoForme.frazioneDopo(s.col3, 0.8);
    bancoSalva(); bancoApplicaFrazioni(); bancoPosizionaDivisori(); return 1; })()`);
  const dopo = await val('({ col:bancoStato().col, col3:bancoStato().col3, col3b:bancoStato().col3b })');
  ok('muovere il secondo divisore non sposta il primo', prima.col3, dopo.col3);
  ok('e il secondo si è mosso', 0.8, dopo.col3b);
  ok('la taratura della 2×2 non si è sporcata', prima.col, dopo.col);

  sezione('Una vecchia disposizione 2×2 non cambia significato');
  await val("bancoForma('quattro'), 1"); await pausa(500);
  ok('quattro blocchi, quelli di sempre', ['A', 'B', 'C', 'D'],
    await val("[...document.querySelectorAll('.blocco')].filter(b=>!b.hidden).map(b=>b.dataset.blocco)"));
  ok('e i divisori tornano a essere due', ['bDivRiga', 'bDivCol'],
    await val("[...document.querySelectorAll('.bdiv')].filter(d=>!d.hidden).map(d=>d.id)"));

  sezione('Una forma dipinta: entra, si usa, sopravvive al giro del disco');
  /* Si dipinge per funzioni, non per pixel: il trascinamento sulla griglia del
     pittore è geometria già provata (`pittoreRettangolo` → `guastoNelleAree`),
     e qui interessa il VIAGGIO — dal dipinto al localStorage all'avvio dopo. */
  const dipinta = await val(`(()=>{
    PITTORE.celle=Array(9).fill('');
    pittoreRettangolo(0, 4);            // un 2×2 in alto a sinistra
    pittoreRettangolo(2, 8);            // la colonna destra intera (2, 5, 8)
    pittoreRettangolo(6, 7);            // la base sotto il quadrato
    return { celle:PITTORE.celle.join(''), aree:pittoreAree(),
             pieno:PITTORE.celle.every(x=>!!x) }; })()`);
  console.log('   ' + JSON.stringify(dipinta));
  ok('il dipinto copre tutte le celle', true, dipinta.pieno);
  ok('e le aree sono un rettangolo per blocco', '', await val(`BancoForme.guastoNelleAree(${JSON.stringify(dipinta.aree)})`));
  const salvata = await val(`(()=>{ pittoreSalva(); const f=bancoFormePersonali();
    return { quante:f.length, chiave:f.length?f[f.length-1].chiave:'', forma:bancoStato().forma }; })()`);
  ok('la forma è entrata nel localStorage', 1, salvata.quante);
  ok('e il banco ci è già sopra', salvata.chiave, salvata.forma);
  /* ⚠️ E il pittore SI CHIUDE. `closePops()` chiude ciò che è scritto nel suo
     elenco, non «tutto»: il pittore non c'era, e dopo il salvataggio restava in
     overlay sopra il banco — l'unico modo di levarselo era ricaricare. */
  ok('il pittore si è chiuso', false,
    await val("document.getElementById('pittorePop').hasAttribute('open')"));
  ok('e non copre più niente', true,
    await val(`(()=>{ const p=document.getElementById('pittorePop');
      return getComputedStyle(p).display==='none' || p.getBoundingClientRect().height===0; })()`));

  /* ⚠️ Il giro dell'avvio: si ricarica l'app e la forma personale deve tornare
     PRIMA che il banco rilegga lo stato, o `normalizzaStato` lo riporterebbe
     alla forma di fabbrica riparando una cosa che non era rotta. */
  await val('location.reload(), 1'); await pausa(2200);
  await collega(); await pausa(800);
  const doporeload = await val(`({ forma:bancoStato().forma,
    inTabella:!!BancoForme.FORME[${JSON.stringify(salvata.chiave)}],
    visibili:[...document.querySelectorAll('.blocco')].filter(b=>!b.hidden).length })`);
  ok('dopo il riavvio la forma personale è ancora in tabella', true, doporeload.inTabella);
  ok('e il banco è rimasto su di lei', salvata.chiave, doporeload.forma);
  ok('coi suoi blocchi a schermo', 3, doporeload.visibili);

  sezione('E si dimentica: il banco torna in piedi da solo');
  await val(`pittoreElimina(${JSON.stringify(salvata.chiave)}), 1`); await pausa(400);
  ok('la forma non è più in tabella', false,
    await val(`!!BancoForme.FORME[${JSON.stringify(salvata.chiave)}]`));
  ok('né nel localStorage', 0, await val('bancoFormePersonali().length'));
  ok('e il banco è tornato alla forma di fabbrica', 'due-col', await val('bancoStato().forma'));

  /* Una prova lascia il banco come l'ha trovato. */
  await val('(()=>{ BANCO.stato=JSON.parse(' + JSON.stringify(bancoPrima) + ');' +
    ' bancoSalva(); bancoDisegna(); bancoApplicaFrazioni(); bancoPosizionaDivisori();' +
    ' bancoDopoLayout(); return 1; })()');
  await pausa(500);
  ok('il banco è quello di prima', bancoPrima, await val('JSON.stringify(bancoStato())'));

  console.log(ko ? `\n✗ ${ko} controlli falliti` : '\n✓ tutti i controlli passati');
  process.exit(ko ? 1 : 0);
})();
