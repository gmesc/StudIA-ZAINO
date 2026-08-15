/* L'Atlante delle opzioni, sull'app viva.
 *
 * Che cosa promette:
 *  · si apre da ⚙ Impostazioni › Utente e mostra una riga per leva del profilo,
 *    una card per variante;
 *  · la direttiva in ogni card è QUELLA VERA: la pagina la riceve dal main, che
 *    la chiede a profilo.directives() — qui la si riconfronta con la stessa
 *    funzione, caricando il modulo in Node;
 *  · il cartellino di fase distingue le leve che cambiano l'indice da quelle
 *    che cambiano il testo;
 *  · «Visualizza esempi» apre i confronti, e la pagina dichiara che sono
 *    illustrativi; la scelta attuale dell'utente è marcata;
 *  · la ricerca filtra; Esc chiude l'atlante e lascia le impostazioni aperte.
 *
 * ⚠️ Gira contro il vault della config: puntarlo a una COPIA (trappola ⑧).
 *   ./test/cdp/con-vault-di-prova.sh prova-atlante.js
 */
const S = require('path').join(__dirname, 'cdp.js');
const { collega, invia, val, clicca, pausa, partiPulito } = require(S);
const leve = require('../../App/assets/dati/leve.js');
const profilo = require('../../lib/profilo.js');

let ko = 0;
function ok(n, atteso, avuto) {
  const a = JSON.stringify(atteso), b = JSON.stringify(avuto);
  if (a === b) { console.log('  ok  ' + n); return; }
  ko++; console.log('  KO  ' + n + '\n      atteso ' + a + '\n      avuto  ' + b);
}
function vero(n, avuto) { ok(n, true, !!avuto); }


/* ⚠️ Le prove girano in coda ad altre trentasei, e ognuna eredita lo schermo
   dell'ultima: un modale rimasto aperto copre la topbar, e il click su ⚙
   finirebbe sul suo fondo. Si parte richiudendo le superfici, non sperando. */
async function schermoPulito() {
  await val(`(()=>{
    ['settingsModal','creditsModal','guidaModal','mediaModal','atlante'].forEach(function(id){
      var m=document.getElementById(id); if(m) m.hidden=true; });
    ['crediti','guida','media','atlante'].forEach(function(k){ delete document.documentElement.dataset[k]; });
    if(typeof closePops==='function') closePops();
    return 1;})()`);
}

(async () => {
  await collega();
  await partiPulito();
  await schermoPulito();

  // Impostazioni › Utente › Atlante
  await clicca('#settingsBtn'); await pausa(300);
  await val(`(()=>{document.querySelector('.set-tab[data-tab="utente"]').click();return 1})()`);
  await pausa(200);
  await val(`(()=>{document.getElementById('apriAtlante').scrollIntoView({block:'center'});return 1})()`);
  await clicca('#apriAtlante');
  for (let i = 0; i < 30; i++) {
    if (await val(`document.querySelectorAll('#atlCorpo .atl-riga').length`) > 5) break;
    await pausa(100);
  }

  vero('l\'atlante è aperto', await val(`!document.getElementById('atlante').hidden`));
  ok('una riga per leva', leve.LEVE.length, await val(`document.querySelectorAll('#atlCorpo .atl-riga').length`));
  const attese = leve.LEVE.reduce((n, l) => n + l.varianti.length, 0);
  ok('una card per variante', attese, await val(`document.querySelectorAll('#atlCorpo .atl-card').length`));

  // la direttiva mostrata è quella vera: confronto con directives() qui in Node
  const attesa = profilo.directives(leve.profiloCon('quiz', 'frequenti')).generazione[0];
  const mostrata = await val(`(()=>{
    const r=[...document.querySelectorAll('#atlCorpo .atl-riga')].find(x=>x.dataset.leva==='quiz');
    return r.querySelectorAll('.atl-card')[0].querySelector('.atl-dir li').textContent;
  })()`);
  ok('la direttiva in pagina è quella di profilo.directives()', attesa, mostrata);

  // il cartellino di fase: granularità cambia l'indice, quiz il testo
  ok('granularità è marcata «cambia l\'indice»', 'cambia l\'indice', await val(
    `[...document.querySelectorAll('#atlCorpo .atl-riga')].find(x=>x.dataset.leva==='granularita').querySelector('.atl-fase').textContent`));
  ok('quiz è marcata «cambia il testo»', 'cambia il testo', await val(
    `[...document.querySelectorAll('#atlCorpo .atl-riga')].find(x=>x.dataset.leva==='quiz').querySelector('.atl-fase').textContent`));

  // gli esempi: chiusi di partenza, aperti tutti insieme dal bottone
  ok('gli esempi partono chiusi', 0, await val(`document.querySelectorAll('#atlCorpo .atl-es:not([hidden])').length`));
  await clicca('#atlEsempi'); await pausa(250);
  ok('«Visualizza esempi» li apre tutti', attese, await val(`document.querySelectorAll('#atlCorpo .atl-es:not([hidden])').length`));
  vero('il brano di prova è in testa', await val(`!document.getElementById('atlBrano').hidden`));
  vero('la pagina dichiara che gli esempi sono illustrativi', await val(
    `/illustrativi/i.test(document.getElementById('atlPiede').textContent)`));
  vero('l\'esempio di granularità atomica è un indice', await val(`(()=>{
    const r=[...document.querySelectorAll('#atlCorpo .atl-riga')].find(x=>x.dataset.leva==='granularita');
    return /indice/.test(r.querySelector('.atl-es .atl-tipo').textContent);
  })()`));

  // la scelta attuale dell'utente è marcata (il vault di prova ha un profilo)
  const marcate = await val(`document.querySelectorAll('#atlCorpo .atl-card.scelta').length`);
  vero('almeno una card è marcata come «la tua scelta» (' + marcate + ')', marcate >= 1);

  // la ricerca filtra e tiene il fuoco
  await val(`(()=>{const c=document.getElementById('atlCerca');
    c.focus(); c.value='glossario'; c.dispatchEvent(new Event('input',{bubbles:true})); return 1;})()`);
  await pausa(200);
  /* ⚠️ Non «1»: la ricerca guarda anche il TESTO delle direttive, e «glossario»
     compare pure in quella di lettura-lenta («ogni tecnicismo va nel
     glossario»). È il comportamento giusto — la parola si cerca dove l'utente
     la leggerà — quindi la promessa è: meno righe del totale, e la leva
     «glossario» fra loro. */
  const filtrate = await val(`[...document.querySelectorAll('#atlCorpo .atl-riga')].map(x=>x.dataset.leva)`);
  vero('la ricerca restringe alle leve pertinenti (' + filtrate.join(', ') + ')',
    filtrate.length < leve.LEVE.length && filtrate.includes('glossario'));
  vero('…senza perdere il fuoco', await val(`document.activeElement.id==='atlCerca'`));
  await val(`(()=>{const c=document.getElementById('atlCerca');
    c.value=''; c.dispatchEvent(new Event('input',{bubbles:true})); return 1;})()`);
  await pausa(150);

  // Esc chiude l'atlante prima delle impostazioni
/* ⚠️ Qui l'Esc attraversa anche il gestore delle MAPPE (window, in cattura,
     StudIA.html ~15378): scatta se una mappa è aperta nel banco — cosa che in
     coda alle altre trentasei prove è la norma — e lascia passare solo le
     modali che conosce. L'atlante è stato aggiunto alla sua lista: questa
     prova, girando DOPO le prove delle mappe, difende proprio quel passaggio. */
  await invia('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', windowsVirtualKeyCode: 27 });
  await pausa(200);
  vero('Esc chiude l\'atlante', await val(`document.getElementById('atlante').hidden`));
  vero('…e lascia aperte le impostazioni', await val(`!document.getElementById('settingsModal').hidden`));

  /* Il riquadro del «?» rimanda qui: il suo piede apre l'ATLANTE con la stessa
     funzione del bottone in Impostazioni (invariante 6), e il popover si
     richiude da sé. Il click è via JS: il bottone sta in fondo a un riquadro
     che scorre, e un click a coordinate senza scroll finirebbe fuori — è
     successo alla prima sonda di questo gesto. */
  const rimando = await val(`(()=>{
    const hb=document.querySelector('#settingsModal .helpbtn'); hb.click();
    const hp=document.getElementById('helpPop');
    const b=document.getElementById('hpAtlante'); if(!b) return { manca:true };
    b.click();
    return { atlante: !document.getElementById('atlante').hidden,
             popChiuso: !hp.hasAttribute('open'),
             segno: !!document.querySelector('.helpbtn[aria-expanded]') };
  })()`);
  ok('il piede del «?» apre l\'atlante e richiude il riquadro',
    { atlante: true, popChiuso: true, segno: false }, rimando);
  await val(`(()=>{chiudiAtlante(); return 1})()`);

  console.log(ko ? '\n' + ko + ' controlli falliti' : '\n✓ tutti i controlli passati');
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
