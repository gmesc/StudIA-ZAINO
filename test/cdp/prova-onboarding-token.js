/* Wizard, primo avvio, benvenuto e composer: anche loro parlano la lingua delle barre.
 *
 * Erano le ultime superfici con bottoni propri: `.setup-btn` (teal, 14px),
 * `.ps-skip` (incorniciato, grigio), `.wz-btn` con la sua variante `.primary`,
 * e nel composer gli stessi `.wz-btn` rimpiccioliti a mano con padding e corpo
 * riscritti. Adesso sono `.tbtn`, con `.acc` su ciò che porta avanti.
 *
 * ⚠️ Queste finestre sono `hidden` in un'app già configurata: per misurarle si
 * tolgono `hidden` per un istante e si rimettono com'erano. Un elemento nascosto
 * non ha geometria, e ogni misura sarebbe zero — la prova direbbe «rotto»
 * parlando di sé stessa, non del codice.
 *
 * ⚠️ Gira contro il vault della config: puntarlo a una COPIA (trappola ⑧).
 *   ./test/cdp/con-vault-di-prova.sh prova-onboarding-token.js
 */
const S = require('path').join(__dirname, 'cdp.js');
const { collega, val, partiPulito } = require(S);

let ko = 0;
function ok(n, atteso, avuto) {
  const a = JSON.stringify(atteso), b = JSON.stringify(avuto);
  if (a === b) { console.log('  ok  ' + n); return; }
  ko++; console.log('  KO  ' + n + '\n      atteso ' + a + '\n      avuto  ' + b);
}
function vero(n, avuto) { ok(n, true, !!avuto); }

/** Rende visibile una finestra, la misura con la funzione data, e la richiude. */
function misura(id, corpo) {
  return `(()=>{
    const m=document.getElementById(${JSON.stringify(id)}); const era=m.hidden; m.hidden=false;
    let out; try{ out=(${corpo})(m); } finally { m.hidden=era; }
    return out;
  })()`;
}

const DATI = `(m)=>{
  const b=[...m.querySelectorAll('button')];
  return {
    fuoriToken:b.filter(x=>!x.classList.contains('tbtn')).map(x=>x.id||x.className),
    accenti:b.filter(x=>x.classList.contains('acc')).map(x=>x.id||x.textContent.trim()),
    altezze:[...new Set(b.filter(x=>x.offsetParent).map(x=>Math.round(x.getBoundingClientRect().height)))],
    corpi:[...new Set(b.filter(x=>x.offsetParent).map(x=>getComputedStyle(x).fontSize))]
  };
}`;

(async () => {
  await collega();
  await partiPulito();

  const ctl = parseInt(await val(`getComputedStyle(document.documentElement).getPropertyValue('--ctl-h')`), 10);
  const tb = parseInt(await val(`getComputedStyle(document.documentElement).getPropertyValue('--tb-h')`), 10);

  // ---- il benvenuto: un bottone solo, ed è quello che porta avanti
  const setup = await val(misura('setup', DATI));
  ok('il benvenuto non ha bottoni fuori dal token', [], setup.fuoriToken);
  ok('…e il suo unico comando ha l\'accento', ['chooseVault'], setup.accenti);
  ok('…alla scala dei controlli grandi', [ctl], setup.altezze);

  // ---- il primo avvio
  const pa = await val(misura('primoAvvio', DATI));
  ok('il primo avvio non ha bottoni fuori dal token', [], pa.fuoriToken);
  ok('l\'accento sta su «Avanti», non su «Salta»', ['paAvanti'], pa.accenti);

  // ---- la card del profilo
  const ps = await val(misura('profiloSetup', DATI));
  ok('la card del profilo non ha bottoni fuori dal token', [], ps.fuoriToken);
  ok('l\'accento sta su «Compila il profilo»', ['psCompila'], ps.accenti);

  // ---- il wizard: testata e piede sono barre
  const wz = await val(misura('wizard', `(m)=>{
    const d=(${DATI})(m);
    const f=getComputedStyle(m.querySelector('.wz-foot'));
    const h=getComputedStyle(m.querySelector('.wz-head'));
    d.piedeSopra=f.borderTopWidth; d.piedeSotto=f.borderBottomWidth;
    d.testaSotto=h.borderBottomWidth; d.fondoTesta=h.backgroundColor;
    d.pannello=getComputedStyle(m.querySelector('.wz-card')).backgroundColor;
    return d;
  }`));
  ok('il wizard non ha bottoni fuori dal token', [], wz.fuoriToken);
  ok('l\'accento sta su «Avanti»', ['wzNext'], wz.accenti);
  ok('una sola altezza in testata e piede', [ctl], wz.altezze);
  ok('un solo corpo del testo', ['12px'], wz.corpi);
  ok('la linea del piede chiude, quella della testata apre',
    { piedeSopra: '1px', piedeSotto: '0px', testaSotto: '1px' },
    { piedeSopra: wz.piedeSopra, piedeSotto: wz.piedeSotto, testaSotto: wz.testaSotto });
  ok('la testata ha il fondo della barra', wz.pannello, wz.fondoTesta);

  // ---- il composer: stessi bottoni, alla scala NORMALE delle barre
  const cmp = await val(misura('composer', `(m)=>{
    const b=[...m.querySelector('.cmp-top').querySelectorAll('button')];
    return { fuoriToken:b.filter(x=>!x.classList.contains('tbtn')).map(x=>x.id),
             accenti:b.filter(x=>x.classList.contains('acc')).map(x=>x.id),
             altezze:[...new Set(b.filter(x=>x.offsetParent).map(x=>Math.round(x.getBoundingClientRect().height)))] };
  }`));
  ok('la barra del composer non ha bottoni fuori dal token', [], cmp.fuoriToken);
  ok('l\'accento sta su «Salva i percorsi»', ['cmpSalva'], cmp.accenti);
  ok('…e lì la scala è quella delle barre, non dei modali', [tb], cmp.altezze);

  // ---- la promessa, in un controllo solo
  const superstiti = await val(`[...document.querySelectorAll('.setup-btn,.ps-skip,.wz-btn,.btn-sec,.btn-go,.dashbtn')]
    .map(x=>x.id||x.className)`);
  ok('nessuna classe-bottone di prima è rimasta viva', [], superstiti);

  console.log(ko ? '\n' + ko + ' controlli falliti' : '\n✓ tutti i controlli passati');
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
