/* La vista di ripasso (P3.3): fronte, risposta, quattro esiti coi tempi.
 *
 * ⚠️ CHE COSA SI STA DIFENDENDO. Il campo `prossimo` è ciò che rende utile tutto
 * il resto: senza, la storia dei ripassi è un archivio che non dice mai *quando*
 * tornare. Le prove di unità misurano la formula; qui si misura che la formula
 * arrivi davvero fino ai due posti che contano — l'ETICHETTA SUL BOTTONE e il
 * campo SUL DISCO — e che i due dicano la stessa cosa. Sono la stessa funzione
 * (`assets/ripasso/intervalli.js`, caricata da main e renderer): questa prova è
 * ciò che se ne accorge il giorno che qualcuno ne fa una seconda copia.
 *
 * ⚠️ Gira contro il vault della config: puntarlo a una COPIA (trappola ⑧).
 *   ./test/cdp/con-vault-di-prova.sh prova-ripasso-vista
 */
const S = require('path').join(__dirname, 'cdp.js');
const { collega, val, clicca, pausa, apriStrumento, partiPulito } = require(S);

let ko = 0;
function ok(n, atteso, avuto) {
  const a = JSON.stringify(atteso), b = JSON.stringify(avuto);
  if (a === b) { console.log('  ok  ' + n); return; }
  ko++; console.log('  KO  ' + n + '\n      atteso ' + a + '\n      avuto  ' + b);
}

(async () => {
  await collega(); await partiPulito(); await pausa(400);

  /* Terreno pulito: la copia del vault può portarsi dietro la storia di una
     prova precedente, e una coda già smaltita non prova niente. */
  await val(`(async()=>{ await window.vault.ripasso.salva(corsoAttivo(), {}); await ripassoCarica(); return 1; })()`);

  console.log('\n== Lo strumento esiste e si apre dal banco');
  const dove = await apriStrumento('flashcard');
  ok('«Ripasso» è uno strumento del banco a tutti gli effetti', 'a schermo', dove);
  await pausa(800);
  ok('e la vista ha la sua barra', true,
    await val(`!!document.querySelector('#ripassoPane .tbar #ripAmbito')`));

  /* L'ambito parte da tutto il corso: è lì che ci sono le carte. */
  await val(`(async()=>{ RIP.ambito='corso'; RIP.chiave=''; await ripassoCostruisci(); return 1; })()`);
  await pausa(900);
  const quante = await val(`RIP.mazzo.length`);
  console.log('   carte in coda: ' + quante);
  if (!quante) { console.log('  ✗ nessuna carta: senza quiz nel corso la prova non può provare niente'); process.exit(1); }
  ok('le carte mai viste sono tutte in coda', true, quante > 0);
  ok('e ognuna sa da quale capitolo viene', true, await val(`!!RIP.mazzo[0].capitolo && !!RIP.mazzo[0].id`));

  console.log('\n== Il fronte non mostra la risposta');
  const fronte = await val(`(()=>({ domanda:!!document.querySelector('#ripCorpo .ripfronte'),
    retro:!!document.querySelector('#ripCorpo .ripretro'),
    esiti:document.querySelectorAll('#ripPie .ripbtn').length,
    mostra:!!document.querySelector('#ripPie [data-mostra]') }))()`);
  ok('c\'è la domanda', true, fronte.domanda);
  /* ⚠️ La riga di stato è ciò che rende VISIBILI gli intervalli: senza, una
     carta risposta sparisce per dieci minuti e in una sessione sola non si vede
     mai il secondo gradino — a schermo il sistema sembra fermo. */
  ok('e la carta dice di non essere mai stata vista', 'mai vista',
    await val(`(document.querySelector('#ripCorpo .ripstato')||{}).textContent||''`));
  /* ⚠️ Il punto della carta: la risposta NON deve stare nel DOM prima che la si
     chieda. Nasconderla con il CSS non basterebbe — basta un colpo di rotella o
     un tema che non applica la regola, e il richiamo attivo è saltato. */
  ok('e la risposta non è nel DOM, non solo nascosta', false, fronte.retro);
  ok('nessun esito prima di aver girato la carta', 0, fronte.esiti);
  ok('c\'è un solo comando: mostra risposta', true, fronte.mostra);

  console.log('\n== Girata la carta arrivano i quattro esiti, coi tempi');
  await clicca('#ripPie [data-mostra]');
  await pausa(400);
  const retro = await val(`(()=>({ retro:!!document.querySelector('#ripCorpo .ripretro'),
    esiti:[...document.querySelectorAll('#ripPie .ripbtn')].map(b=>b.dataset.esito),
    tempi:[...document.querySelectorAll('#ripPie .ripbtn .riptempo')].map(b=>b.textContent) }))()`);
  ok('la risposta c\'è', true, retro.retro);
  ok('i quattro esiti, nell\'ordine dell\'algoritmo', ['di-nuovo', 'difficile', 'buono', 'facile'], retro.esiti);
  /* ⚠️ I tempi di una carta MAI VISTA sono i gradini, e sono una tabella: se un
     giorno diventano una formula, questa riga lo dice subito. */
  ok('e i tempi previsti sono quelli dei gradini', ['1 min', '5 min', '10 min', '1 giorno'], retro.tempi);

  console.log('\n== ⭐ Il tempo promesso sul bottone è quello scritto sul disco');
  const carta = await val(`(()=>({ id:RIP.mazzo[RIP.i].id, capitolo:RIP.mazzo[RIP.i].capitolo,
    promesso:document.querySelector('#ripPie .ripbtn[data-esito="buono"] .riptempo').textContent }))()`);
  const prima = Date.now();
  await clicca('#ripPie .ripbtn[data-esito="buono"]');
  await pausa(1100);
  const scritto = await val(`(async()=>{ const r=await window.vault.ripasso.leggi(corsoAttivo());
    const v=(r&&r.carte||{})[${JSON.stringify(carta.id)}]||null;
    return v ? { esito:v.esito, visto:v.visto, prossimo:v.prossimo, storia:v.storia.length } : null; })()`);
  ok('la risposta è su disco', ['buono', 1], scritto ? [scritto.esito, scritto.storia] : null);
  /* ⚠️ IL CONTROLLO CHE VALE PIÙ DI TUTTI: il campo non è più vuoto. Era la
     riga che mancava a P3.1 — il sistema registrava che cosa avevi risposto e
     non diceva mai quando tornare. */
  ok('e «prossimo» non è più vuoto', true, !!(scritto && scritto.prossimo));
  const minuti = scritto ? Math.round((new Date(scritto.prossimo) - new Date(scritto.visto)) / 60000) : -1;
  console.log('   promesso «' + carta.promesso + '» · scritto ' + minuti + ' min');
  ok('e vale esattamente i minuti promessi sul bottone', ['10 min', 10], [carta.promesso, minuti]);
  /* La data è ancorata a QUANDO si è risposto, non a un'ora inventata. */
  ok('il momento della risposta è adesso', true,
    scritto ? Math.abs(new Date(scritto.visto) - prima) < 20000 : false);

  console.log('\n== La carta risposta esce dalla coda, e la seguente è di nuovo coperta');
  const dopo = await val(`(()=>({ coda:RIP.mazzo.length, girata:RIP.girata,
    retro:!!document.querySelector('#ripCorpo .ripretro'), id:(RIP.mazzo[RIP.i]||{}).id||'' }))()`);
  ok('la coda è più corta di una', quante - 1, dopo.coda);
  ok('la carta appena risposta non è più quella davanti', false, dopo.id === carta.id);
  /* Rivederla adesso non direbbe niente su quanto la si ricorda: se ne riparla
     fra dieci minuti, che è appunto ciò che dice il disco. */
  ok('e la carta nuova è coperta', [false, false], [dopo.girata, dopo.retro]);

  console.log('\n== Una carta appena risposta NON torna subito');
  /* ⚠️ È la metà del punto di P3.3, e va misurata da qui: prima della coda
     basata su `prossimo`, una carta risposta restava in elenco e si poteva
     rispondere alla stessa domanda dieci volte di fila — che non dice niente su
     quanto la si ricorda. Adesso ha un appuntamento, e fino ad allora sparisce. */
  const subito = await val(`(async()=>{ RIP.ambito='corso'; RIP.chiave='';
    await ripassoCostruisci();
    return RIP.mazzo.some(c=>c.id===${JSON.stringify(carta.id)}); })()`);
  await pausa(500);
  ok('rifacendo la coda, la carta risposta non c\'è', false, subito);

  console.log('\n== Ma quando scade torna, CON la sua storia');
  /* Si sposta indietro l'appuntamento (il solo modo di far passare dieci minuti
     senza aspettarli) e si rifà la coda: la carta deve tornare, e i suoi tempi
     devono essere quelli del SECONDO gradino, non di una carta nuova. */
  const tornata = await val(`(async()=>{
    const r=await window.vault.ripasso.leggi(corsoAttivo());
    const c=Object.assign({}, (r&&r.carte)||{});
    const v=c[${JSON.stringify(carta.id)}];
    if(!v) return null;
    /* ⚠️ Le due date si spostano INSIEME, e restano coerenti: «visto» e
       «prossimo» a dieci minuti di distanza sono l'intervallo che la carta si
       era guadagnata. Spostarne una sola darebbe una carta con un passato che
       non è mai potuto succedere, e la riga di stato ne parlerebbe. */
    c[${JSON.stringify(carta.id)}]=Object.assign({}, v,
      { visto:'2020-01-01T00:00:00.000Z', prossimo:'2020-01-01T00:10:00.000Z' });
    await window.vault.ripasso.salva(corsoAttivo(), c);
    await ripassoCarica();
    RIP.ambito='corso'; RIP.chiave=''; await ripassoCostruisci();
    const k=RIP.mazzo.findIndex(x=>x.id===${JSON.stringify(carta.id)});
    if(k<0) return { c_e:false };
    const carta2=RIP.mazzo[k];
    RIP.i=k; ripassoVistaDisegna();
    return { c_e:true, primaInCoda:k===0, storia:(carta2.storia||[]).length,
             stato:(document.querySelector('#ripCorpo .ripstato')||{}).textContent||'',
             tempi:RipassoIntervalli.anteprima(carta2.storia||[]).map(b=>b.testo) }; })()`);
  await pausa(500);
  ok('la carta scaduta è tornata in coda', true, tornata && tornata.c_e);
  /* ⚠️ L'arretrato passa davanti alle mai viste: chi ha carte in ritardo deve
     poterle smaltire, o non le rivedrà mai. */
  ok('e sta davanti alle mai viste', true, tornata && tornata.primaInCoda);
  /* ⚠️ Se qui la storia fosse vuota, la carta sarebbe tornata SENZA il suo
     passato: la vista non appaierebbe più le domande vive con il disco, e ogni
     carta ripartirebbe da capo — cioè gli intervalli non crescerebbero mai. */
  ok('con la sua storia attaccata', 1, tornata && tornata.storia);
  /* ⚠️ E la dice a schermo: è l'unico posto in cui la crescita degli intervalli
     si vede senza aspettare che ne scada uno. «Ultimo intervallo 10 min» accanto
     a bottoni che adesso propongono un giorno È la crescita, resa leggibile. */
  ok('e lo dice in chiaro sulla carta', true,
    !!tornata && String(tornata.stato).indexOf('vista 1 volta · ultimo intervallo 10 min · scaduta ') === 0);
  ok('e i tempi sono quelli del secondo gradino', ['1 min', '10 min', '1 giorno', '4 giorni'],
    tornata && tornata.tempi);

  console.log('\n== «Salta» non è un giudizio');
  const salto = await val(`(async()=>{
    const prima=(RIP.mazzo[RIP.i]||{}).id||'';
    const r=await window.vault.ripasso.leggi(corsoAttivo());
    const quanteCarte=Object.keys((r&&r.carte)||{}).length;
    ripassoSalta();
    await new Promise(s=>setTimeout(s,300));
    const r2=await window.vault.ripasso.leggi(corsoAttivo());
    return { cambiata:((RIP.mazzo[RIP.i]||{}).id||'')!==prima,
             scritte:Object.keys((r2&&r2.carte)||{}).length, prima:quanteCarte,
             inCoda:RIP.mazzo.some(c=>c.id===prima) }; })()`);
  ok('la carta cambia', true, salto.cambiata);
  ok('ma non finisce niente sul disco', salto.prima, salto.scritte);
  ok('e la saltata resta in coda, in fondo', true, salto.inCoda);

  console.log('\n== L\'ambito restringe la coda');
  const ambiti = await val(`(async()=>{
    RIP.ambito='corso'; RIP.chiave=''; await ripassoCostruisci(); const corso=RIP.mazzo.length;
    RIP.ambito='capitolo'; RIP.chiave=''; await ripassoCostruisci(); const cap=RIP.mazzo.length;
    RIP.ambito='corso'; RIP.chiave=''; await ripassoCostruisci();
    return { corso:corso, cap:cap }; })()`);
  await pausa(400);
  ok('un capitolo solo non ha più carte di tutto il corso', true, ambiti.cap <= ambiti.corso);

  console.log(ko ? '\n✗ ' + ko + ' controlli falliti' : '\n✓ tutti i controlli passati');
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
