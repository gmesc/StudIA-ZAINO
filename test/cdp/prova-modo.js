/* Le due modalità: CORSO e ZAINO, e il logo che le commuta.
 *
 * ⚠️ Che cosa questa prova difende davvero. Commutare modalità cambia il
 * CONTENITORE sotto i piedi degli strumenti: `corsoAttivo()` smette di
 * rispondere con il corso e risponde con lo zaino, e da lì in poi appunti,
 * mappe, album ed evidenze scrivono in `Zaini/<id>/`. Se quella riga si
 * scollegasse, non si vedrebbe niente di rotto a schermo — si continuerebbe a
 * scrivere nel corso di prima. Perciò il controllo centrale non è «la topbar è
 * cambiata» ma «su che cosa sto lavorando».
 *
 * E il click parte dal MOUSE VERO sul logo: una chiamata a `cambiaModo()` a
 * mano proverebbe la funzione saltando il bottone, che è metà di quello che
 * qui c'è da provare.
 *
 *   ./test/cdp/con-vault-di-prova.sh prova-modo.js
 */
const S = require('path').join(__dirname, 'cdp.js');
const { collega, val, clicca, pausa, partiPulito, apriStrumento } = require(S);

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
    const v = await val(expr);
    if (v) return v;
    if (Date.now() > fine) return null;
    await pausa(200);
  }
}

/* Che cosa si vede nella topbar: le due file di tendine e i comandi che NON
   dipendono dalla modalità. */
const TOPBAR = `(()=>{ function c(sel){ const e=document.querySelector(sel);
    if(!e) return null; const r=e.getBoundingClientRect(); return r.width>0 && r.height>0; }
  return { corsi:c('.lessonrow'), zaino:c('.zainorow'),
           lente:c('#searchBtn'), banco:c('#bancoBtn'), tema:c('#themeToggle'), corpo:c('.chipgroup'),
           piu:c('#zainoNuovo'),
           modo:document.documentElement.dataset.modo||'',
           premuto:(document.getElementById('modoBtn')||{}).getAttribute
                   ? document.getElementById('modoBtn').getAttribute('aria-pressed') : null,
           titoloSidebar:(document.getElementById('sidebarTitolo')||{}).textContent }; })()`;

(async () => {
  await collega();
  await val('location.reload(), 1'); await pausa(1800);
  await collega(); await pausa(700);
  await partiPulito();
  /* Si parte dai corsi comunque: le prove girano tutte contro la stessa
     istanza, e quella prima potrebbe aver lasciato l'app nello zaino. */
  await val(`(async()=>{ await cambiaModo('corso'); return 1; })()`);
  await pausa(400);
  /* ⚠️ E il blocco del CAPITOLO deve essere a schermo: la card dello zaino vive
     dentro `<main>`, cioè nel corpo di quel blocco. Se la prova precedente ha
     lasciato lì una mappa o un documento, la card esiste nel DOM ma misura
     zero, e il click su «Crea zaino» fallisce accusando lo zaino per una
     disposizione del banco che nessuno ha rimesso a posto. Successo davvero,
     eseguendo la suite intera invece della prova sola. */
  await apriStrumento('capitolo');
  await pausa(400);

  sezione('Il logo è un bottone, e lo dichiara');
  const logo = await val(`(()=>{ const b=document.getElementById('modoBtn'); if(!b) return null;
    const s=getComputedStyle(b);
    return { tag:b.tagName, premuto:b.getAttribute('aria-pressed'), titolo:b.title,
             puntatore:s.cursor, cornice:s.borderTopWidth, sfondo:s.backgroundColor }; })()`);
  ok('è un <button>', 'BUTTON', logo.tag);
  ok('e dice in quale modalità si è', 'false', logo.premuto);
  ok('il titolo promette il gesto', true, /Zaino/i.test(logo.titolo));
  ok('la mano lo riconosce', 'pointer', logo.puntatore);
  /* ⚠️ Ma NON deve sembrare un bottone: niente cornice, niente sfondo. Il segno
     che è cliccabile è il movimento, non una scatola in mezzo alla topbar. */
  ok('senza cornice', '0px', logo.cornice);
  ok('e senza sfondo', true, /rgba\(0, 0, 0, 0\)|transparent/.test(logo.sfondo));

  sezione('Il click commuta, e la topbar cambia mestiere');
  const prima = await val(TOPBAR);
  ok('si parte dai corsi', ['corso', true, false], [prima.modo, prima.corsi, prima.zaino]);
  await clicca('#modoBtn');
  await pausa(700);
  const dopo = await val(TOPBAR);
  ok('adesso è ZAINO', 'zaino', dopo.modo);
  ok('la fila corso/percorso/lezione se ne va', false, dopo.corsi);
  ok('e arriva quella dello zaino', true, dopo.zaino);
  ok('il bottone lo dichiara a chi ascolta', 'true', dopo.premuto);
  ok('accanto alla tendina c\'è il «+» per creare', true, dopo.piu);
  /* Quello che NON dipende dalla modalità resta dov'è: è dell'app. */
  ok('lente, banco, tema e corpo del testo restano', [true, true, true, true],
    [dopo.lente, dopo.banco, dopo.tema, dopo.corpo]);
  ok('la sidebar smette di dire «Capitoli»', 'Zaino', dopo.titoloSidebar);
  /* Il contatore dei capitoli conta una lezione: acceso qui direbbe il
     progresso di un corso a chi sta leggendo altro. */
  ok('il contatore dei capitoli è spento', false,
    await val(`(()=>{ const c=document.getElementById('chapCounter');
      return !!c && c.getBoundingClientRect().height>0; })()`));
  ok('e l\'indice dei capitoli non è più a schermo', false,
    await val(`(()=>{ const t=document.getElementById('toc');
      return !!t && t.getBoundingClientRect().height>0; })()`));

  sezione('Il velo del trascinamento dice la cosa giusta per la modalità');
  /* Quello che si può rilasciare cambia: documenti in uno zaino, la lezione in
     un corso. Un cartello che promette la cosa sbagliata è peggio di nessun
     cartello. */
  const velo = (q) => val(`(()=>{ const dt=new DataTransfer();
    dt.items.add(new File(['%PDF-1.4'], 'x.pdf', { type:'application/pdf' }));
    window.dispatchEvent(new DragEvent('dragover', { dataTransfer:dt, bubbles:true, cancelable:true }));
    const stato=document.documentElement.dataset.drop || '';
    /* ⚠️ Si misura MENTRE il velo è acceso: tolto l'attributo la regola non
       corrisponde più, e lo stile calcolato torna quello della radice — cioè il
       serif di sistema, che è proprio la cosa che si sta controllando.
       ⚠️⚠️ E niente apici inversi qui dentro: questo commento vive in un
       template letterale, e uno di quelli lo chiude a metà. Sesta volta. */
    const st=getComputedStyle(document.documentElement, '::after');
    const testo=st.content || '', font=st.fontFamily || '';
    delete document.documentElement.dataset.drop;
    return { stato:stato, testo:testo, font:font }; })()`);
  const veloZaino = await velo();
  ok('nello zaino il velo parla di documenti', 'pdf', veloZaino.stato);
  console.log('   ' + veloZaino.testo);
  ok('e lo dice a parole', true, /PDF|zaino/i.test(veloZaino.testo));
  /* ⚠️ E con il carattere dell'app: uno pseudo-elemento su `html` non eredita
     il font del `body`, e restava l'unico posto con un serif di sistema. */
  ok('col carattere dell\'app, non quello di sistema', true,
    veloZaino.font.indexOf('Helvetica') >= 0);

  sezione('Il battito del logo serve una volta sola');
  ok('dopo il primo uso l\'invito è spento', null,
    await val(`document.getElementById('modoBtn').getAttribute('data-invito')`));
  ok('e il fatto è scritto', '1', await val(`localStorage.getItem('studia.modoUsato')`));

  sezione('Nello zaino non si offre «Capitolo»');
  /* ⚠️ I capitoli sono di una lezione. Offrirli qui vorrebbe dire una voce in
     tendina che apre il capitolo di un corso mentre si legge un documento
     proprio — e il blocco grande, che nei corsi tiene il capitolo, deve tenere
     le fonti. Le due disposizioni sono separate: quella dei corsi non si tocca. */
  const strumenti = await val(`(()=>{ const s=document.querySelector('.bsel[data-blocco="A"]');
    return { voci:[...s.options].map(o=>o.value), scelto:s.value,
             etichette:[...s.options].map(o=>o.textContent) }; })()`);
  ok('«Capitolo» non è in elenco', false, strumenti.voci.indexOf('capitolo') >= 0);
  ok('e il blocco grande tiene le fonti', 'fonte', strumenti.scelto);
  ok('che adesso si chiamano «Fonti»', true, strumenti.etichette.indexOf('Fonti') >= 0);

  sezione('Creare uno zaino dal «+» in barra');
  const nome = 'Prova di modalità';
  await clicca('#zainoNuovo');
  await pausa(400);
  ok('il pannellino si apre', true,
    await val(`!!document.querySelector('#zainoPop[open]')`));
  ok('e il bottone lo dichiara', 'true',
    await val(`document.getElementById('zainoNuovo').getAttribute('aria-expanded')`));
  ok('col cursore già nel campo', 'zainoNome', await val(`document.activeElement.id`));
  await val(`(()=>{ const c=document.getElementById('zainoNome'); c.value=${JSON.stringify(nome)}; return 1; })()`);
  await clicca('#zainoCrea');
  const creato = await finoA(`(()=>{ const s=document.getElementById('zainoSelect');
    return s && [...s.options].some(o=>o.textContent.indexOf('Prova di modalità')>=0); })()`, 10000);
  ok('lo zaino compare nella tendina', true, !!creato);
  ok('ed è quello attivo', 'prova-di-modalita', await val('zainoAttivo()'));
  /* Il pannellino ha finito: lasciarlo aperto col nome dentro inviterebbe a
     creare due volte la stessa materia. */
  ok('e il pannellino si è chiuso da solo', false,
    await val(`!!document.querySelector('#zainoPop[open]')`));

  sezione('⚠️ IL PERNO: su che cosa sto lavorando');
  /* La riga che, se si scollegasse, non romperebbe niente a schermo e
     scriverebbe tutto nel corso di prima. */
  ok('in modalità zaino il «corso» è lo zaino', 'prova-di-modalita', await val('corsoAttivo()'));
  const salvato = await val(`localStorage.getItem('studia.corso')`);
  await clicca('#modoBtn');
  await pausa(700);
  ok('tornando ai corsi si torna al corso di prima', salvato, await val('corsoAttivo()'));
  ok('e il valore del corso non era stato toccato', salvato, await val(`localStorage.getItem('studia.corso')`));
  ok('la fila delle tendine torna quella dei corsi', [true, false],
    await val(`(()=>{ const c=document.querySelector('.lessonrow').getBoundingClientRect().height>0;
      const z=document.querySelector('.zainorow').getBoundingClientRect().height>0; return [c,z]; })()`));

  sezione('La modalità sopravvive alla chiusura');
  await clicca('#modoBtn');           // di nuovo nello zaino
  await pausa(600);
  ok('siamo nello zaino', 'zaino', await val('modoAttivo()'));
  await val('location.reload(), 1'); await pausa(2000);
  await collega(); await pausa(900);
  const ripresa = await finoA(`(()=>{ return document.documentElement.dataset.modo==='zaino' ? 'zaino' : ''; })()`, 12000);
  ok('e all\'avvio si riapre lì', 'zaino', ripresa);
  ok('con lo zaino di prima', 'prova-di-modalita', await val('zainoAttivo()'));

  /* Si esce dallo zaino: la prova dopo non deve trovare l'app in una modalità
     che non si aspetta (trappola di `partiPulito`). */
  await val(`(async()=>{ await cambiaModo('corso'); return 1; })()`);
  await pausa(300);

  console.log('');
  console.log(ko ? '✗ ' + ko + ' controlli falliti' : '✓ tutti i controlli passati');
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('✗ ' + e.message); process.exit(1); });
