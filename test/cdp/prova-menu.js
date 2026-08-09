/* Lotto 4 — il menu contestuale sulla selezione del capitolo.
 *
 * ⚠️ SCRITTO PRIMA DEL CODICE (9 agosto 2026). Finché il menu non esiste questa
 * prova è rossa, ed è il suo mestiere: i nomi (`#selMenu`, `data-az`) e le
 * promesse si decidono qui, non a cose fatte.
 *
 * Che cosa promette il lotto:
 *  · **due superfici, una funzione**: la barra contestuale `#selBarra` che compare
 *    da sé sulla selezione e il menu `#selMenu` del tasto destro fanno le stesse
 *    cose passando per `selAzione()`. La barra è a icone per chi sa già, il menu
 *    ha le parole scritte per chi guarda — ma un gesto senza voce non esiste;
 *  · «Copia» esiste perché in questa app il tasto destro non ha MAI mostrato
 *    niente (nessun `setApplicationMenu` in main.js): non stiamo sostituendo un
 *    menu di sistema, stiamo aggiungendo l'unica via col mouse per copiare;
 *  · «Appunta» accoda all'appunto già aperto invece di crearne sempre uno nuovo,
 *    e il frammento porta con sé il rimando `cap:` al capitolo d'origine.
 *
 * ⚠️ Gira contro il vault della config: puntarlo a una COPIA (trappola ⑧).
 *   ./node_modules/.bin/electron . --remote-debugging-port=9333
 *   node test/cdp/prova-menu.js
 */
const S = require('path').join(__dirname, 'cdp.js');
const { collega, invia, val, clicca, pausa } = require(S);

let ko = 0;
function ok(n, atteso, avuto) {
  const a = JSON.stringify(atteso), b = JSON.stringify(avuto);
  if (a === b) { console.log('  ok  ' + n); return; }
  ko++; console.log('  KO  ' + n + '\n      atteso ' + a + '\n      avuto  ' + b);
}
const aperto = () => val(`(()=>{const m=document.getElementById('selMenu');
  return !!m && m.classList.contains('open');})()`);
const voci = () => val(`[...document.querySelectorAll('#selMenu .ctx-item')].map(b=>b.dataset.az)`);

/* Seleziona davvero del testo dentro il capitolo e torna il rettangolo della
   selezione, che serve per mirare il tasto destro. Si passa da un Range vero:
   una selezione finta non produce le stesse coordinate. */
async function selezionaNelCapitolo() {
  return await val(`(()=>{
    const p=[...document.querySelectorAll('#content p')].find(x=>x.textContent.trim().length>40);
    if(!p) return null;
    const t=[...p.childNodes].find(n=>n.nodeType===3 && n.textContent.trim().length>40);
    if(!t) return null;
    const r=document.createRange(); r.setStart(t,5); r.setEnd(t,25);
    const s=getSelection(); s.removeAllRanges(); s.addRange(r);
    const b=r.getBoundingClientRect();
    return { testo:String(s), x:Math.round(b.left+b.width/2), y:Math.round(b.top+b.height/2),
             fuoriX:Math.round(b.right+200), fuoriY:Math.round(b.bottom+120) };
  })()`);
}
async function tastoDestro(x, y) {
  for (const type of ['mousePressed', 'mouseReleased']) {
    await invia('Input.dispatchMouseEvent', { type, x, y, button: 'right', clickCount: 1 });
  }
  await pausa(250);
}
/* La barra contestuale compare su `mouseup`: una selezione costruita da codice
   non la fa apparire da sé, e va simulato il rilascio del tasto. */
async function mostraBarra() {
  const s = await selezionaNelCapitolo();
  await val(`(()=>{const e=document.createEvent('MouseEvent');
    e.initEvent('mouseup',true,true); document.dispatchEvent(e); return 1;})()`);
  await pausa(300);
  return s;
}
async function esc() {
  for (const type of ['keyDown', 'keyUp']) {
    await invia('Input.dispatchKeyEvent', { type, key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  }
  await pausa(250);
}

(async () => {
  await collega();
  await pausa(400);

  const sel = await selezionaNelCapitolo();
  if (!sel) { console.log('✗ nessun paragrafo abbastanza lungo nel capitolo aperto'); process.exit(1); }

  console.log('\n== il tasto destro DENTRO la selezione apre il menu');
  await tastoDestro(sel.x, sel.y);
  ok('il menu è aperto', true, await aperto());
  /* Erano sei quando questo file è stato scritto: c'era anche `evidenzia`.
     È caduta costruendo — la riga dei colori È l'evidenziatore, e una voce che
     ripete lo stesso gesto con meno precisione è un bottone senza mestiere. */
  ok('ha le cinque voci, in ordine', ['appunta', 'mappa', 'keyword', 'cancella', 'copia'], await voci());
  ok('e la riga dei colori: cinque preset più il picker', [5, 1],
    await val(`[document.querySelectorAll('#selMenu .ctx-col').length,
                document.querySelectorAll('#selMenu input[type=color]').length]`));
  ok('la selezione non è stata persa', sel.testo, await val('String(getSelection())'));

  console.log('\n== dove vive, e che non esca dallo schermo');
  // ⚠️ `container-type:inline-size` su .bcorpo e #mappaView rende quegli elementi
  // il blocco contenitore dei `position:fixed`: un menu messo lì dentro si
  // ancorerebbe al riquadro e finirebbe sotto la topbar
  ok('è figlio di <body>, fuori dai contenitori con container-type', 'BODY',
    await val(`document.getElementById('selMenu').parentElement.tagName`));
  ok('sta tutto dentro la finestra', true,
    await val(`(()=>{const r=document.getElementById('selMenu').getBoundingClientRect();
      return r.left>=0 && r.top>=0 && r.right<=window.innerWidth+1 && r.bottom<=window.innerHeight+1;})()`));
  // le due superfici non stanno mai insieme: aprendo il menu la barra si spegne,
  // o si sovrapporrebbero sullo stesso punto dello schermo
  ok('la barra si spegne quando si apre il menu', false,
    await val(`(()=>{const b=document.getElementById('selBarra');
      return !!b && b.classList.contains('aperta');})()`));

  console.log('\n== Esc chiude il menu e SOLO il menu');
  await esc();
  ok('il menu si è chiuso', false, await aperto());
  ok('e la mappa non è stata trascinata via con lui', false, await val('mappaAperta()'));

  console.log('\n== fuori dalla selezione non si apre');
  await selezionaNelCapitolo();
  await tastoDestro(sel.fuoriX, sel.fuoriY);
  ok('tasto destro lontano dalla selezione: nessun menu', false, await aperto());
  await tastoDestro(20, 8);   // sulla topbar, fuori da #content
  ok('tasto destro fuori dal capitolo: nessun menu', false, await aperto());

  console.log('\n== la barra compare da sé, e porta tutto');
  const s2 = await mostraBarra();
  ok('la barra è comparsa', true,
    await val(`(()=>{const b=document.getElementById('selBarra');
      return !!b && b.classList.contains('aperta');})()`));
  ok('con le quattro azioni', ['cancella', 'appunta', 'mappa', 'copia'],
    await val(`[...document.querySelectorAll('#selBarra .sb-az')].map(b=>b.dataset.az)`));
  ok('e la tavolozza: cinque preset più il picker', [5, 1],
    await val(`[document.querySelectorAll('#selBarra .ctx-col').length,
                document.querySelectorAll('#selBarra input[type=color]').length]`));
  /* La posizione la decide il browser con `position-try-fallbacks`: sopra la
     selezione se ci sta, sotto se no. Quello che si verifica qui è la promessa,
     non il meccanismo — non deve uscire dalla finestra, mai. */
  ok('sta tutta dentro la finestra', true,
    await val(`(()=>{const r=document.getElementById('selBarra').getBoundingClientRect();
      return r.left>=-1 && r.top>=-1 && r.right<=window.innerWidth+1 && r.bottom<=window.innerHeight+1;})()`));

  console.log('\n== Copia, dalla barra');
  await clicca('#selBarra .sb-az[data-az="copia"]'); await pausa(400);
  ok('la barra si chiude dopo la scelta', false,
    await val(`document.getElementById('selBarra').classList.contains('aperta')`));
  ok('il testo è finito negli appunti di sistema', s2.testo,
    (await val('navigator.clipboard.readText()')) || '(lettura non permessa)');

  console.log('\n== Appunta accoda invece di creare sempre');
  const quanti = () => val('NOTES.list.length');
  const prima = await quanti();
  await mostraBarra();
  await clicca('#selBarra .sb-az[data-az="appunta"]'); await pausa(500);
  /* Senza un appunto aperto si ricade su `noteNew`, che il titolo lo CHIEDE:
     è l'unico momento in cui la domanda ha senso, e va risposta come la
     risponderebbe una persona. */
  ok('senza un appunto aperto chiede il titolo', true,
    await val(`(()=>{const m=document.getElementById('uiModal'); return !!m && m.hasAttribute('open');})()`));
  await val(`(()=>{document.getElementById('umInput').value='Prova menu'; return 1;})()`);
  await clicca('#umOk'); await pausa(900);
  ok('e allora ne nasce uno', prima + 1, await quanti());
  const corpo1 = await val('NOTES.mde ? NOTES.mde.value() : ""');
  ok('e il frammento porta il rimando al capitolo', true, /\(cap:[A-Za-z0-9._-]+\)/.test(corpo1));

  await mostraBarra();
  await clicca('#selBarra .sb-az[data-az="appunta"]'); await pausa(800);
  ok('col medesimo appunto aperto NON ne nasce un secondo', prima + 1, await quanti());
  const corpo2 = await val('NOTES.mde ? NOTES.mde.value() : ""');
  ok('il secondo frammento si accoda al primo', true, corpo2.length > corpo1.length);
  ok('e non ha cancellato quello di prima', true, corpo2.indexOf(corpo1.trim().slice(0, 40)) >= 0);

  console.log('\n== le parole chiave: evidenziare, ricolorare, cancellare');
  const quanteEv = () => val('window.vault.evidenze.leggi(corsoAttivo()).evidenze.length');
  const evPrima = await quanteEv();
  const s3 = await mostraBarra();
  await clicca('#selBarra .ctx-col'); await pausa(700);        // il primo preset
  ok('evidenziare scrive una parola chiave', evPrima + 1, await quanteEv());
  ok('con il testo della selezione', s3.testo,
    await val(`window.vault.evidenze.leggi(corsoAttivo()).evidenze.slice(-1)[0].exact`));
  ok('e il giallo è acceso senza toccare il DOM', true,
    await val(`CSS.highlights.has('ev-0')`));
  ok('nessun <mark> è stato infilato nel capitolo', 0,
    await val(`document.querySelectorAll('#content mark').length`));

  // lo stesso punto, un colore diverso: si ricolora, non si duplica
  const idEv = await val(`window.vault.evidenze.leggi(corsoAttivo()).evidenze.slice(-1)[0].id`);
  await mostraBarra();
  /* La barra sa che sotto la selezione c'è già una parola chiave, e lo dice
     accendendo «Cancella»: su una selezione qualunque quel tasto è spento, e
     un tasto che si può premere quando non c'è niente da cancellare sarebbe un
     gesto che non fa niente senza dirlo. */
  ok('la barra si accorge che qui c\'è già una parola chiave', false,
    await val(`document.querySelector('#selBarra .sb-az[data-az="cancella"]').disabled`));
  await clicca('#selBarra .ctx-col:nth-of-type(3)'); await pausa(700);
  ok('ricolorare non aggiunge una riga', evPrima + 1, await quanteEv());
  ok('e l\'identità resta la stessa', idEv,
    await val(`window.vault.evidenze.leggi(corsoAttivo()).evidenze.slice(-1)[0].id`));

  // sopravvive al ridisegno del capitolo
  await val('render(), 1'); await pausa(500);
  ok('dopo un ridisegno del capitolo si riaccende da sé', true, await val(`CSS.highlights.has('ev-0')`));

  await mostraBarra();
  await clicca('#selBarra .sb-az[data-az="cancella"]'); await pausa(700);
  ok('cancellare la toglie dal disco', evPrima, await quanteEv());
  ok('e il colore si spegne', false, await val(`CSS.highlights.has('ev-0')`));

  console.log('\n== L5: il frammento diventa un nodo della mappa');
  const s4 = await mostraBarra();
  await clicca('#selBarra .sb-az[data-az="mappa"]'); await pausa(2500);
  ok('la mappa è entrata in scena da sé', true, await val('mappaAperta()'));
  ok('nel registro «Mie», non nella generata', 'mie', await val('MAPPA.registro'));
  ok('ed è nata una mappa col solo frammento', 1, await val('(MAPPA.mia.grafo&&MAPPA.mia.grafo.nodi||[]).length'));
  ok('il nodo porta il testo selezionato', s4.testo,
    await val('(MAPPA.mia.grafo&&MAPPA.mia.grafo.nodi||[{}])[0].testo'));
  /* Il colore pieno contro il grigio è il segnale di Braynr: si vede a colpo
     d'occhio quanta parte della mappa viene dal testo e quanta l'hai messa tu. */
  ok('e nasce «dalla fonte», non «dell\'utente»', 'fonte',
    await val('(MAPPA.mia.grafo&&MAPPA.mia.grafo.nodi||[{}])[0].origine'));
  ok('con la frase attorno nella nota', true,
    await val('!!((MAPPA.mia.grafo&&MAPPA.mia.grafo.nodi||[{}])[0].nota||"").length'));
  const titoloMappa = await val('MAPPA.mia.titolo');
  ok('intitolata alla lezione e al capitolo', true, /—/.test(titoloMappa || ''));

  // il secondo frammento entra nella mappa che c'è, non ne apre una seconda
  const quanteMappe = () => val('MAPPA.elenco.length');
  const mappePrima = await quanteMappe();
  await mostraBarra();
  await clicca('#selBarra .sb-az[data-az="mappa"]'); await pausa(900);
  ok('il secondo frammento si aggiunge alla mappa aperta', 2,
    await val('(MAPPA.mia.grafo&&MAPPA.mia.grafo.nodi||[]).length'));
  ok('senza creare una seconda mappa', mappePrima, await quanteMappe());

  // si lascia il vault come lo si è trovato
  await val('(async()=>{ const f=MAPPA.mia.file; if(f) await window.vault.mappe.rimuovi(corsoAttivo(), f); })()');
  await pausa(600);

  console.log('\n' + (ko ? '✗ ' + ko + ' controlli falliti' : '✓ menu contestuale verde dalla porta principale'));
  process.exit(ko ? 1 : 0);
})();
