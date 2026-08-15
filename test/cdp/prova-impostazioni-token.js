/* Le Impostazioni parlano la lingua delle barre.
 *
 * Prima qui convivevano cinque dialetti di bottone: `.dashbtn` (blu),
 * `.kr-save` (teal), `.setup-btn`, `.iconbtn` con quattro proprietà scritte a
 * mano nell'attributo `style`, e un `.btn` senza nemmeno una regola — grigio di
 * fabbrica del browser. Adesso sono tutti `.tbtn`, alla scala `--ctl-h` che il
 * contenitore ridichiara (`.tbar-ctl`), con un accento solo: teal = scrive.
 *
 * Questa prova difende proprio quello: non «i bottoni esistono», ma «sono la
 * STESSA cosa». Un `height:` o un `font-size:` scritto a mano su un bottone di
 * queste schede la fa diventare rossa.
 *
 * ⚠️ Gira contro il vault della config: puntarlo a una COPIA (trappola ⑧).
 *   ./test/cdp/con-vault-di-prova.sh prova-impostazioni-token.js
 */
const S = require('path').join(__dirname, 'cdp.js');
const { collega, invia, val, clicca, pausa, partiPulito } = require(S);

let ko = 0;
function ok(n, atteso, avuto) {
  const a = JSON.stringify(atteso), b = JSON.stringify(avuto);
  if (a === b) { console.log('  ok  ' + n); return; }
  ko++; console.log('  KO  ' + n + '\n      atteso ' + a + '\n      avuto  ' + b);
}
function vero(n, avuto) { ok(n, true, !!avuto); }

/* Tutti i bottoni delle quattro schede, misurati DA VIVI: la verità è quella
   che il browser calcola, non quella che sta scritta nel foglio di stile. */
const RILEVA = `(()=>{
  const m=document.getElementById('settingsModal');
  const b=[...m.querySelectorAll('.set-body button')];
  const ctl=getComputedStyle(document.documentElement).getPropertyValue('--ctl-h').trim();
  return {
    ctl,
    totale:b.length,
    fuoriToken:b.filter(x=>!x.classList.contains('tbtn') && !x.classList.contains('helpbtn')).map(x=>x.id||x.className),
    vecchiDialetti:[...m.querySelectorAll('.dashbtn,.kr-save:not(.tbtn),.setup-btn,.btn')].map(x=>x.id||x.className),
    misureAMano:b.filter(x=>/height|font-size|padding|width/.test(x.getAttribute('style')||'')).map(x=>x.id||x.className),
    altezze:[...new Set(b.filter(x=>x.classList.contains('tbtn')&&x.offsetParent).map(x=>Math.round(x.getBoundingClientRect().height)))],
    corpi:[...new Set(b.filter(x=>x.classList.contains('tbtn')&&x.offsetParent).map(x=>getComputedStyle(x).fontSize))],
    maiuscole:[...new Set(b.filter(x=>x.classList.contains('tbtn')&&x.offsetParent).map(x=>getComputedStyle(x).textTransform))],
    accenti:[...m.querySelectorAll('.tbtn.acc')].map(x=>x.id||x.textContent.trim()),
    fondiAccento:[...new Set([...m.querySelectorAll('.tbtn.acc')].filter(x=>x.offsetParent).map(x=>getComputedStyle(x).backgroundColor))]
  };
})()`;

(async () => {
  await collega();
  await partiPulito();
  await clicca('#settingsBtn'); await pausa(300);

  // si passa da tutte le schede: i pannelli nascosti non si misurano
  const per = {};
  for (const t of ['utente', 'corsi', 'zaino', 'ai']) {
    await val(`(()=>{document.querySelector('.set-tab[data-tab="${t}"]').click();return 1})()`);
    await pausa(250);
    per[t] = await val(RILEVA);
  }
  const ai = per.ai, corsi = per.corsi;

  ok('nessun bottone fuori dal token (a parte i «?» d\'aiuto)', [], corsi.fuoriToken);
  ok('i vecchi dialetti sono spariti', [], corsi.vecchiDialetti);
  ok('nessuna misura scritta a mano nell\'attributo style', [], corsi.misureAMano);
  ok('…anche nella scheda AI', [], ai.fuoriToken.concat(ai.vecchiDialetti, ai.misureAMano));

  // la scala: `.tbar-ctl` ridichiara --tb-h a --ctl-h, quindi 40px, non i 30 delle barre
  ok('una sola altezza, quella dei controlli grandi', [parseInt(corsi.ctl, 10)], corsi.altezze);
  ok('…e nella scheda AI la stessa', [parseInt(ai.ctl, 10)], ai.altezze);
  ok('un solo corpo del testo', ['12px'], corsi.corpi);
  ok('maiuscoletto come in barra', ['uppercase'], corsi.maiuscole);

  // l'accento: teal, e solo su ciò che scrive
  /* `.tbtn.acc` si cerca su tutto il modale, schede nascoste comprese: l'elenco
     è quindi quello COMPLETO dei comandi che scrivono, ed è la promessa. */
  ok('l\'accento sta su tutti e soli i comandi che scrivono',
    ['profSave', 'vaultChangeBtn', 'projRiprendi', 'projCreate', 'Salva', 'Salva', 'Salva', 'aiSave'],
    corsi.accenti);
  vero('nella scheda AI l\'accento è su «Salva impostazioni AI» e sulle chiavi',
    ai.accenti.includes('aiSave') && ai.accenti.filter((x) => x === 'Salva').length === 3);
  ok('un solo fondo per l\'accento', 1, ai.fondiAccento.length);

  // il vassoio: un gruppo di comandi si vede come gruppo anche su fondo chiaro
  vero('le righe di comandi hanno la superficie del vassoio', await val(
    `(()=>{const r=[...document.querySelectorAll('#settingsModal .setrow')].filter(x=>x.offsetParent&&x.querySelector('.tbtn'));
      return r.length>0 && r.every(x=>getComputedStyle(x).backgroundColor!=='rgba(0, 0, 0, 0)');})()`));

  console.log(ko ? '\n' + ko + ' controlli falliti' : '\n✓ tutti i controlli passati');
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
