/* Le cinque memorie di disposizione, dalla porta principale.
 *
 * ⚠️ La prova che conta è LA SCENA che ha generato questa funzione: cinque slot
 * pieni, non ricordo che cosa contengono, li premo tutti per guardarli — e a
 * quel punto ho perso la disposizione su cui stavo lavorando. Qui si riproduce
 * esattamente quella sequenza e si verifica che ⌘Z riporti indietro. Se questo
 * controllo è verde, il problema non esiste più; se è rosso, non conta nient'altro.
 *
 *   ./test/cdp/con-vault-di-prova.sh prova-memorie.js
 */
const S = require('path').join(__dirname, 'cdp.js');
const { collega, val, invia, pausa, partiPulito, apriStrumento } = require(S);

let ko = 0;
function ok(n, atteso, avuto) {
  const a = JSON.stringify(atteso), b = JSON.stringify(avuto);
  if (a === b) { console.log('  ok  ' + n); return; }
  ko++; console.log('  KO  ' + n + '\n      atteso ' + a + '\n      avuto  ' + b);
}
function sezione(t) { console.log('\n== ' + t); }

async function finoA(expr, quanto) {
  const fine = Date.now() + (quanto || 15000);
  for (;;) {
    const v = await val(expr);
    if (v) return v;
    if (Date.now() > fine) return null;
    await pausa(200);
  }
}

(async () => {
  await collega();
  await val('location.reload(), 1'); await pausa(1800);
  await collega(); await pausa(600);
  await partiPulito();
  await val(`(()=>{ try{ bancoForma('uno'); }catch(e){} return 1; })()`);
  await apriStrumento('mappa');
  await pausa(600);

  sezione('Una mappa tua, con qualcosa dentro');
  /* Si semina una mappa dell'utente: le memorie esistono solo là, perché su una
     mappa generata non c'è niente da salvare — si rifà da sola a ogni lettura. */
  const nata = await val(`(async()=>{
    if(!mappaPronta()) return 'moduli non pronti';
    let g = { nodi:[], archi:[] };
    for(const t of ['Radice','Uno','Due','Tre']) g = MappaModifica.creaNodo(g, { testo:t });
    const r = await window.vault.mappe.salva(corsoAttivo(), null, {
      titolo:'Prova memorie', corso:corsoAttivo(), nodi:g.nodi, archi:g.archi, vista:{} });
    if(r.error) return r.error;
    MAPPA.registro='mie';
    await mappaCaricaElenco();
    await mappaApriMia(r.file);
    return 'ok';
  })()`);
  if (nata !== 'ok') { console.log('✗ non riesco a preparare la mappa: ' + nata); process.exit(1); }
  ok('la mappa tua è aperta', true, await val('mappaMie() && !!MAPPA.mia.grafo'));

  sezione('Cinque slot, e si vede quali sono vuoti');
  await pausa(300);
  const barra = await val(`(()=>{ const b=document.getElementById('mMemorie');
    return { visibile:!b.hidden, motoriNascosti:document.getElementById('mMotore').hidden,
             bottoni:[...b.querySelectorAll('button[data-mem]')].length,
             vuoti:[...b.querySelectorAll('button.vuota')].length }; })()`);
  ok('i cinque bottoni ci sono', 5, barra.bottoni);
  ok('e sono tutti vuoti', 5, barra.vuoti);
  ok('la barra delle memorie è visibile su una mappa tua', true, barra.visibile);
  /* Su una mappa tua il motore è un mezzo, la disposizione è il fine: i quattro
     motori restano nel menu contestuale della tela. */
  ok('e i motori escono dalla barra', true, barra.motoriNascosti);

  sezione('Cinque disposizioni diverse, salvate nei cinque slot');
  const motori = ['albero', 'dag', 'percorso', 'anelli', 'albero'];
  for (let i = 0; i < 5; i++) {
    await val(`(()=>{ MAPPA.vista.motore=${JSON.stringify(motori[i])};
      MAPPA.vista.orient=${i % 2 ? "'lr'" : "'td'"};
      const l=mappaMemorie(); l[${i}]=mappaDisposizioneOra('Disposizione ${i + 1}');
      mappaMemorieScrivi(l); return 1; })()`);
  }
  const pieni = await val("[...document.querySelectorAll('#mMemorie button.piena')].length");
  ok('adesso sono tutti pieni', 5, pieni);

  sezione('LA SCENA: li premo tutti per guardare, e non perdo il mio lavoro');
  /* Si costruisce una disposizione riconoscibile e NON salvata: è quella che
     nella scena andava persa. */
  await val(`(()=>{ MAPPA.vista.motore='anelli'; MAPPA.vista.orient='lr';
    MAPPA.vista.gapNodo=77; mappaSincronizzaComandi(); mappaRidisegna(); return 1; })()`);
  const mio = await val('({ motore:MAPPA.vista.motore, orient:MAPPA.vista.orient, gap:MAPPA.vista.gapNodo })');
  console.log('   il mio lavoro: ' + JSON.stringify(mio));

  for (let i = 0; i < 5; i++) { await val(`mappaMemoriaRichiama(${i}), 1`); await pausa(150); }
  const dopoIlGiro = await val('({ motore:MAPPA.vista.motore, gap:MAPPA.vista.gapNodo })');
  console.log('   dopo averli guardati tutti: ' + JSON.stringify(dopoIlGiro));
  ok('guardandoli tutti la vista è cambiata (era il problema)', true,
    dopoIlGiro.motore !== mio.motore || dopoIlGiro.gap !== mio.gap);

  /* ⚠️ E adesso la riga che rende innocuo tutto: cinque annulla, uno per ogni
     richiamo, e si torna esattamente dov'eravamo. */
  for (let i = 0; i < 5; i++) { await val('mappaAnnulla(), 1'); await pausa(120); }
  const tornato = await val('({ motore:MAPPA.vista.motore, orient:MAPPA.vista.orient, gap:MAPPA.vista.gapNodo })');
  console.log('   dopo cinque ⌘Z: ' + JSON.stringify(tornato));
  ok('⌘Z riporta il lavoro non salvato', mio, tornato);

  sezione('L\'annulla riporta anche le LEVE, non solo i nodi');
  /* Era il difetto della pila: copiava il solo grafo, quindi un annulla dopo un
     richiamo avrebbe rimesso i nodi lasciando il motore dov'era. */
  const prima = await val('MAPPA.vista.motore');
  await val('mappaMemoriaRichiama(1), 1'); await pausa(200);
  const cambiato = await val('MAPPA.vista.motore');
  await val('mappaAnnulla(), 1'); await pausa(200);
  ok('il motore cambia richiamando', true, cambiato !== prima);
  ok('e torna indietro annullando', prima, await val('MAPPA.vista.motore'));

  sezione('Le posizioni messe a mano tornano al loro posto');
  await val(`(()=>{ const g=MappaModifica.copia(MAPPA.mia.grafo);
    g.nodi[1].x=500; g.nodi[1].y=400; MAPPA.mia.grafo=g;
    const l=mappaMemorie(); l[2]=mappaDisposizioneOra('Con posizioni'); mappaMemorieScrivi(l);
    const g2=MappaModifica.copia(MAPPA.mia.grafo); g2.nodi[1].x=10; g2.nodi[1].y=10;
    MAPPA.mia.grafo=g2; return 1; })()`);
  ok('il nodo è stato spostato altrove', [10, 10],
    await val('[MAPPA.mia.grafo.nodi[1].x, MAPPA.mia.grafo.nodi[1].y]'));
  await val('mappaMemoriaRichiama(2), 1'); await pausa(250);
  ok('richiamando torna dove l\'avevo messo', [500, 400],
    await val('[MAPPA.mia.grafo.nodi[1].x, MAPPA.mia.grafo.nodi[1].y]'));

  sezione('Un nodo nato DOPO la memoria non viene spostato a caso');
  /* ⚠️ Una memoria vecchia non conosce i nodi nati dopo: restano dove sono, e il
     richiamo lo dice invece di far credere che sia tornato tutto. */
  await val(`(()=>{ const g=MappaModifica.creaNodo(MAPPA.mia.grafo, { testo:'Nato dopo' });
    const id=g.nuovo; const g2=MappaModifica.sposta(g, id, { x:900, y:900 });
    MAPPA.mia.grafo=g2; return 1; })()`);
  const quanti = await val('MAPPA.mia.grafo.nodi.length');
  await val('mappaMemoriaRichiama(2), 1'); await pausa(250);
  ok('il nodo nuovo è ancora lì', quanti, await val('MAPPA.mia.grafo.nodi.length'));
  ok('e non è stato spostato', [900, 900],
    await val(`(()=>{ const n=MAPPA.mia.grafo.nodi.filter(x=>x.testo==='Nato dopo')[0];
      return [n.x, n.y]; })()`));

  sezione('Sovrascrivere è un altro gesto, e uno slot protetto rifiuta');
  await val(`(()=>{ const l=mappaMemorie(); l[3]=Object.assign({}, l[3], { protetta:true });
    mappaMemorieScrivi(l); return 1; })()`);
  const nomePrima = await val('mappaMemorie()[3].nome');
  await val('mappaMemoriaSalva(3), 1'); await pausa(400);
  ok('lo slot protetto non si lascia sovrascrivere', nomePrima, await val('mappaMemorie()[3].nome'));
  ok('e nessuna finestra è rimasta aperta', true,
    await val("!document.querySelector('#askModal:not([hidden])')"));

  sezione('Svuotare si annulla');
  await val('mappaMemoriaAzione("svuota", 0), 1'); await pausa(250);
  ok('lo slot è vuoto', null, await val('mappaMemorie()[0]'));
  await val('mappaAnnulla(), 1'); await pausa(250);
  ok('⌘Z lo riporta', true, await val('!!mappaMemorie()[0]'));

  sezione('L\'anteprima si guarda senza caricare');
  const primaVista = await val('MAPPA.vista.motore');
  await val(`(()=>{ const b=document.querySelector('#mMemorie button[data-mem="1"]');
    mappaMemoriaAnteprima(1, b); return 1; })()`);
  await pausa(300);
  const ant = await val(`(()=>{ const p=document.getElementById('memPop');
    return { aperta:!p.hidden, conSvg:!!p.querySelector('svg'),
             nodi:p.querySelectorAll('svg .mnodo, svg g[data-id]').length }; })()`);
  ok('l\'anteprima si apre', true, ant.aperta);
  ok('e disegna la mappa vera', true, ant.conSvg);
  /* ⚠️ È il punto: guardare NON carica. Senza questo, per ricordare che cosa c'è
     in uno slot bisogna premerlo — e premerlo butta via il lavoro in corso. */
  ok('e la vista NON è cambiata', primaVista, await val('MAPPA.vista.motore'));
  await val('mappaMemoriaAnteprimaVia(), 1');
  ok('e se ne va da sola', true, await val("document.getElementById('memPop').hidden"));

  sezione('Ridimensionare un\'immagine prendendola per un angolo');
  {
    /* Un nodo-immagine vero sulla mappa, poi il gesto: si preme l'angolo in
       basso a destra e si tira in fuori. */
    const pronto = await val(`(()=>{
      const g = MappaModifica.estrai(MAPPA.mia.grafo, { testo:'Schema',
        immagine:{ id:'aa11bb22', w:400, h:300 } });
      MAPPA.mia.grafo = g; MAPPA.sel = g.nuovo;
      mappaTocca(); mappaRidisegna();
      return g.nuovo; })()`);
    await pausa(400);
    /* ⚠️ Le maniglie compaiono solo sul nodo SELEZIONATO: quattro pallini su
       ogni ritaglio competerebbero con il ritaglio stesso. */
    const quante = await val("document.querySelectorAll('#mappaSvg .mscala').length");
    ok('quattro maniglie, una per angolo, sul nodo scelto', 4, quante);
    ok('e su un nodo non selezionato non ce ne sono', 0,
      await val(`(()=>{ MAPPA.sel=null; mappaRidisegna();
        return document.querySelectorAll('#mappaSvg .mscala').length; })()`));

    await val(`(()=>{ MAPPA.sel=${JSON.stringify(pronto)}; mappaRidisegna(); return 1; })()`);
    await pausa(300);
    const ang = await val(`(()=>{ const h=document.querySelector('#mappaSvg .mscala[data-ang="se"]');
      if(!h) return null; const r=h.getBoundingClientRect();
      const c=document.querySelector('#mappaSvg .mnodo[data-id=${JSON.stringify(pronto)}] rect');
      const rc=c?c.getBoundingClientRect():null;
      return { x:Math.round(r.left+r.width/2), y:Math.round(r.top+r.height/2),
               larga:rc?Math.round(rc.width):0 }; })()`);
    ok('la maniglia in basso a destra è a schermo', true, !!ang && ang.x > 0);
    console.log('   angolo a (' + ang.x + ',' + ang.y + ') · nodo largo ' + ang.larga + ' px');

    const scalaPrima = await val(`(()=>{ const n=MAPPA.mia.grafo.nodi.filter(x=>x.id===${JSON.stringify(pronto)})[0];
      return (n.immagine&&n.immagine.scala)||1; })()`);
    /* Si tira in diagonale verso l'esterno: la scala si ricava dalla distanza
       dal CENTRO, quindi qualunque angolo si prenda il gesto vuol dire lo stesso. */
    await invia('Input.dispatchMouseEvent', { type:'mousePressed', x:ang.x, y:ang.y, button:'left', clickCount:1 });
    for (let i = 1; i <= 6; i++) {
      await invia('Input.dispatchMouseEvent', { type:'mouseMoved',
        x: ang.x + 10 * i, y: ang.y + 8 * i, button:'left' });
      await pausa(40);
    }
    await invia('Input.dispatchMouseEvent', { type:'mouseReleased', x:ang.x + 60, y:ang.y + 48, button:'left', clickCount:1 });
    await pausa(500);

    const dopoScala = await val(`(()=>{ const n=MAPPA.mia.grafo.nodi.filter(x=>x.id===${JSON.stringify(pronto)})[0];
      return (n.immagine&&n.immagine.scala)||1; })()`);
    console.log('   scala: ' + scalaPrima + ' → ' + dopoScala);
    ok('tirando l\'angolo l\'immagine è cresciuta', true, dopoScala > scalaPrima);
    const largaDopo = await val(`(()=>{ const c=document.querySelector('#mappaSvg .mnodo[data-id=${JSON.stringify(pronto)}] rect');
      return c?Math.round(c.getBoundingClientRect().width):0; })()`);
    ok('e il riquadro a schermo è più largo davvero', true, largaDopo > ang.larga);
    console.log('   nodo largo ' + ang.larga + ' → ' + largaDopo + ' px');

    /* ⚠️ Il gesto intero è UN passo nella pila, non trenta: metterlo a ogni
       movimento riempirebbe i venti posti con passi identici. */
    await val('mappaAnnulla(), 1'); await pausa(300);
    ok('un solo ⌘Z riporta alla misura di prima', scalaPrima,
      await val(`(()=>{ const n=MAPPA.mia.grafo.nodi.filter(x=>x.id===${JSON.stringify(pronto)})[0];
        return (n.immagine&&n.immagine.scala)||1; })()`));

    /* Prendere un angolo non deve SPOSTARE il nodo: sono due gesti diversi
       sullo stesso oggetto, ed è il modo classico di sbagliarli. */
    const dove = await val(`(()=>{ const n=MAPPA.mia.grafo.nodi.filter(x=>x.id===${JSON.stringify(pronto)})[0];
      return [n.x===undefined?null:n.x, n.y===undefined?null:n.y]; })()`);
    ok('e il nodo non si è spostato', [null, null], dove);
  }

  console.log('');
  console.log(ko ? '✗ ' + ko + ' controlli falliti' : '✓ tutti i controlli passati');
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('✗ ' + e.message); process.exit(1); });
