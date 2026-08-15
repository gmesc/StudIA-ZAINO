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

  /* La TESTATA del modale è una barra come le altre: stesso fondo, stessa
     altezza, stessa linea sotto, e i suoi due comandi (🧙 ✕) sono `.tbtn`
     attaccati a destra invece di due `.iconbtn` incorniciati. */
  const testa = await val(`(()=>{
    const h=document.querySelector('#settingsModal .media-head');
    const s=getComputedStyle(h);
    const b=[...h.querySelectorAll('button')];
    return { alta:Math.round(h.getBoundingClientRect().height),
             fondo:s.backgroundColor, linea:s.borderBottomWidth,
             fuoriToken:b.filter(x=>!x.classList.contains('tbtn')).map(x=>x.id),
             altezze:[...new Set(b.map(x=>Math.round(x.getBoundingClientRect().height)))],
             pannello:getComputedStyle(document.querySelector('#settingsModal .media-card')).backgroundColor };
  })()`);
  /* ⚠️ Non si confronta con 40px: l'altezza di una barra non è quella dei suoi
     bottoni — ci sono il rientro verticale e la linea sotto. Il metro è una
     barra VERA costruita al momento con le stesse classi: se la testata è
     davvero «quella barra», le due misure coincidono. */
  const metro = await val(`(()=>{
    const d=document.createElement('div'); d.className='tbar tbar-ctl';
    d.style.cssText='position:absolute;left:-9999px;top:0;width:400px';
    d.innerHTML='<b>x</b><span class="tbspazio"></span><button class="tbtn">y</button>';
    document.body.appendChild(d);
    const h=Math.round(d.getBoundingClientRect().height); d.remove(); return h;
  })()`);
  ok('la testata è alta esattamente quanto una `.tbar.tbar-ctl` vera', metro, testa.alta);
  ok('i comandi della testata sono bottoni di barra', [], testa.fuoriToken);
  ok('…e alti come la barra li vuole', [parseInt(per.ai.ctl, 10)], testa.altezze);
  ok('la testata ha la linea sotto della barra', '1px', testa.linea);
  ok('…e il fondo della barra', testa.pannello, testa.fondo);

  /* Il PIEDE del modale Video: la stessa barra girata — la linea chiude invece
     di aprire — e i due bottoni che erano `.btn-sec`/`.btn-go`, cioè le ultime
     classi-bottone dell'app fuori dal token. Il modale non serve aprirlo: le
     misure si prendono rendendolo visibile per un istante, perché un elemento
     `hidden` non ha geometria e ogni misura sarebbe zero. */
  const piede = await val(`(()=>{
    /* ⚠️ Non basta togliere \`hidden\`: il modale si apre con
       \`html[data-media="1"]\`, e senza quell'attributo resta \`display:none\`
       — gli elementi dentro esistono ma sono larghi e alti zero. */
    const m=document.getElementById('mediaModal'); const era=m.hidden; m.hidden=false;
    const eraD=document.documentElement.dataset.media; document.documentElement.dataset.media='1';
    const f=m.querySelector('.media-foot'); const s=getComputedStyle(f);
    const b=[...f.querySelectorAll('button')];
    const out={ sopra:s.borderTopWidth, sotto:s.borderBottomWidth,
      fondo:s.backgroundColor,
      fuoriToken:b.filter(x=>!x.classList.contains('tbtn')).map(x=>x.id),
      accenti:b.filter(x=>x.classList.contains('acc')).map(x=>x.id),
      altezze:[...new Set(b.map(x=>Math.round(x.getBoundingClientRect().height)))],
      spento:getComputedStyle(document.getElementById('mediaGo')).opacity };
    m.hidden=era; if(eraD===undefined) delete document.documentElement.dataset.media; else document.documentElement.dataset.media=eraD;
    return out;
  })()`);
  ok('i bottoni del piede sono bottoni di barra', [], piede.fuoriToken);
  ok('l\'accento sta sul comando che agisce', ['mediaGo'], piede.accenti);
  ok('…alti come la barra li vuole', [parseInt(per.ai.ctl, 10)], piede.altezze);
  ok('la linea del piede sta sopra, non sotto', { sopra: '1px', sotto: '0px' },
    { sopra: piede.sopra, sotto: piede.sotto });
  vero('un comando spento si vede spento senza una regola sua', parseFloat(piede.spento) < .5);

  /* Il «?» non è un bottone di barra: è un rimando a una nota — piccolo, in
     grassetto, rialzato, blu, senza cornice. Ma resta un comando da prendere
     col mouse, e la grafia da 10px non basta: il bersaglio è più grande della
     grafia grazie al rientro, riassorbito da un margine negativo perché la
     riga non si sposti. */
  /* ⚠️ I «?» stanno nella scheda Utente, e il giro qui sopra è finito su AI: un
     elemento in un pannello nascosto misura 0×0, e la prova accuserebbe il CSS
     di una colpa della prova. Si torna sulla scheda giusta PRIMA di misurare. */
  await val(`(()=>{document.querySelector('.set-tab[data-tab="utente"]').click();return 1})()`);
  await pausa(250);
  const aiuto = await val(`(()=>{
    const b=document.querySelector('#settingsModal .helpbtn'); const s=getComputedStyle(b);
    const r=b.getBoundingClientRect();
    const et=b.closest('label,.set-sec-h');
    return { bordo:s.borderTopWidth, fondo:s.backgroundColor, rialzo:s.verticalAlign,
             corpo:parseFloat(s.fontSize), peso:s.fontWeight, colore:s.color,
             bersaglio:[Math.round(r.width),Math.round(r.height)],
             corpoEtichetta:parseFloat(getComputedStyle(et).fontSize) };
  })()`);
  ok('il «?» non ha più la scatola', { bordo: '0px', fondo: 'rgba(0, 0, 0, 0)' },
    { bordo: aiuto.bordo, fondo: aiuto.fondo });
  ok('è rialzato come un esponente', 'super', aiuto.rialzo);
  vero('è più piccolo dell\'etichetta che lo ospita', aiuto.corpo < aiuto.corpoEtichetta);
  vero('è in grassetto', parseInt(aiuto.peso, 10) >= 700);
  // era grigio `--muted` quando era una scatoletta: adesso è il blu di ciò che spiega
  const spento = await val(`(()=>{const d=document.createElement('span');
    d.style.color='var(--muted)'; document.body.appendChild(d);
    const c=getComputedStyle(d).color; d.remove(); return c;})()`);
  vero('è colorato di blu, non spento di grigio', aiuto.colore !== spento);
  ok('il bersaglio del mouse è più grande della grafia (larghezza, altezza)',
    true, aiuto.bersaglio[0] >= 16 && aiuto.bersaglio[1] >= 16 ? true : aiuto.bersaglio);

  // …e quando il riquadro è aperto lo dice il markup, non solo il colore
  const segno = await val(`(()=>{
    const b=document.querySelector('#settingsModal .helpbtn'); b.click();
    const v=b.getAttribute('aria-expanded');
    document.body.click();
    return { aperto:v, dopo:b.getAttribute('aria-expanded') };
  })()`);
  ok('lo stato aperto sta nel markup, e sparisce alla chiusura',
    { aperto: 'true', dopo: null }, segno);

  /* La promessa grossa, in un controllo solo. */
  const superstiti = await val(`[...document.querySelectorAll(
    '.dashbtn,.kr-save:not(.tbtn),.btn-sec,.btn-go,.media-foot button:not(.tbtn),#settingsModal .iconbtn')]
    .map(x=>x.id||x.className)`);
  ok('nessun dialetto di bottone sopravvive nei modali', [], superstiti);

  console.log(ko ? '\n' + ko + ' controlli falliti' : '\n✓ tutti i controlli passati');
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
