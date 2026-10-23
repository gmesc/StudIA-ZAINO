'use strict';
/* La forma scelta dal menu mantiene l'ultimo riquadro usato, e l'anteprima
 * deve anticipare proprio ciò che verrà montato. Mouse e Invio passano da
 * CDP: chiamare bancoForma da solo non troverebbe un menu che ruba il focus.
 *
 * Solo vault sintetico: bash bin/prova-zaino.sh prova-banco-riduzione.js
 * La prova non scrive documenti e ripristina banco, attivo e memoria zoom.
 */
const assert = require('assert');
const fs = require('fs');
const c = require('./cdp');
let controlli = 0;
function verifica(nome, atteso, avuto) {
  assert.deepStrictEqual(avuto, atteso, nome);
  controlli++;
  console.log('  ok  ' + nome);
}
async function aspetta(expr) {
  const fine = Date.now() + 10000;
  while (Date.now() < fine) {
    if (await c.val(expr)) return;
    await c.pausa(100);
  }
  throw new Error('Attesa scaduta: ' + expr);
}
async function sopra(sel) {
  const p = await c.val(`(() => {
    const e=document.querySelector(${JSON.stringify(sel)}), r=e && e.getBoundingClientRect();
    return r && r.width && r.height ? {x:r.left+r.width/2,y:r.top+r.height/2} : null;
  })()`);
  assert(p, 'Bersaglio visibile: ' + sel);
  await c.invia('Input.dispatchMouseEvent', { type: 'mouseMoved', ...p });
}
async function menu() {
  await c.clicca('#bancoBtn');
  await aspetta(`document.getElementById('bancoPop').hasAttribute('open')`);
}
async function formaConMouse(forma) {
  await menu();
  await c.clicca('#bForme .bforma[data-forma="' + forma + '"]');
  await aspetta(`bancoStato().forma===${JSON.stringify(forma)} && !document.getElementById('bancoPop').hasAttribute('open')`);
}
const visibili = () => c.val(`(() => {
  return Array.from(document.querySelectorAll('#banco .blocco')).filter(b=>!b.hidden)
    .sort((a,b)=>{const x=a.getBoundingClientRect(),y=b.getBoundingClientRect();return x.top-y.top||x.left-y.left;})
    .map(b=>bancoStrumentoIn(b.dataset.blocco));
})()`);
const pannelliIntatti = () => c.val(`window.__bancoRiduzione.pannelli.every(p=>{
  const el=document.getElementById(p.id), cm=el && el.querySelector('.CodeMirror');
  return el===p.el && (!p.cm || (cm===p.cm && cm.CodeMirror.getValue()===p.testo));
})`);
const strumentiSalvati = () => c.val(`Object.values(bancoStato().blocchi).filter(Boolean).sort()`);

(async () => {
  await c.collega();
  await aspetta(`typeof bancoStato==='function' && typeof bancoBloccoAttivo==='function' && zainoAttivo()==='biologia'`);
  assert((await c.val('window.vault.path')).includes('studia-zaino-prova-'), 'Questa prova richiede il vault sintetico');
  await c.partiPulito();
  const precedente = await c.val(`({
    stato:JSON.parse(JSON.stringify(bancoStato())), attivo:BANCO.attivo,
    chiave:bancoChiave(), salvato:localStorage.getItem(bancoChiave()),
    zoom:localStorage.getItem(bancoZoomChiave())
  })`);
  const tutti = ['appunti', 'appunti2', 'fonte', 'fonte2'];
  try {
    await c.val(`(() => {
      BANCO.stato=BancoForme.normalizzaStato({forma:'quattro',col:0.5,riga:0.5,
        blocchi:{A:'fonte',C:'appunti',B:'fonte2',D:'appunti2'}});
      BANCO.attivo='A'; bancoSalva(); bancoDisegna(); return true;
    })()`);
    await aspetta(`!!document.querySelector('#notePane .CodeMirror') && !!document.querySelector('#notePane2 .CodeMirror')`);
    await c.val(`(() => {
      window.__bancoRiduzione={pannelli:['pdfPane','pdfPane2','notePane','notePane2'].map(id=>{
        const el=document.getElementById(id), cm=el.querySelector('.CodeMirror');
        return {id,el,cm,testo:cm ? cm.CodeMirror.getValue() : null};
      })}; return true;
    })()`);
    verifica('quattro riquadri in ordine visivo', ['fonte', 'appunti', 'fonte2', 'appunti2'], await visibili());
    verifica('le testate sono numerate nell’ordine visivo', ['1', '3', '2', '4'],
      await c.val(`['A','B','C','D'].map(b=>document.querySelector('.blocco[data-blocco="'+b+'"] .bnumero').textContent)`));

    verifica('la maniglia non copre il nome del primo split',true,await c.val(`document.querySelector('.bhead[data-primo="1"] .bnumero').getBoundingClientRect().left>=document.querySelector('#menuBtn').getBoundingClientRect().right`));

    console.log('\n== Quattro → due: il quarto usato rimane per primo');
    await c.clicca('.blocco[data-blocco="D"] .bnumero');
    verifica('il click vero nel quarto riquadro lo attiva', 'D', await c.val('bancoBloccoAttivo()'));
    verifica('anche Appunta segue la testata scelta', 'appunti2', await c.val('noteStatoAttivo().id'));
    verifica('il pallino attivo compare sul quarto riquadro', true,
      await c.val(`!document.querySelector('.blocco[data-blocco="D"] .battivo').hidden && document.querySelector('.blocco[data-blocco="D"]').dataset.attivo==='1'`));
    verifica('il pallino sostituisce il testo ed è accessibile', true, await c.val(`(()=>{
      const e=document.querySelector('.blocco[data-blocco="D"] .battivo'),s=getComputedStyle(e);
      return !e.textContent && e.getAttribute('aria-label')==='Riquadro attivo' && s.width==='6px' && s.height==='6px' && s.backgroundColor===s.color;
    })()`));
    verifica('separatori sottili grigi, senza sottolineatura attiva', true, await c.val(`(()=>{
      const linea=getComputedStyle(document.querySelector('.blocco[data-bordo-sx="1"]')).borderLeftColor;
      return Array.from(document.querySelectorAll('#banco .blocco:not([hidden]) > .bhead')).every(e=>{
        const s=getComputedStyle(e);return s.borderTopWidth==='1px' && s.borderTopColor===linea && s.boxShadow==='none';
      });
    })()`));
    verifica('la barra di avanzamento dei capitoli è nascosta nello zaino', 'none', await c.val(`getComputedStyle(document.getElementById('navdots')).display`));
    await menu();
    verifica('aprire Banco non ruba l’attivo', 'D', await c.val('bancoBloccoAttivo()'));
    const primaAnteprima = await c.val('JSON.stringify(bancoStato())');
    await sopra('#bForme .bforma[data-forma="due-col"]');
    await aspetta(`document.getElementById('bFormaAnteprima').textContent.startsWith('Restano: 4 · Appunti')`);
    const anteprima = await c.val(`document.getElementById('bFormaAnteprima').textContent`);
    verifica('l’anteprima mette prima il quarto e poi il primo', true,
      anteprima.indexOf('4 · Appunti') < anteprima.indexOf('1 · Fonti') && anteprima.includes('1 · Fonti'));
    verifica('l’anteprima è visibile', true,
      await c.val(`document.getElementById('bFormaAnteprima').getBoundingClientRect().height>0`));
    verifica('anche l’etichetta accessibile anticipa i riquadri', true,
      (await c.val(`document.querySelector('#bForme .bforma[data-forma="due-col"]').getAttribute('aria-label')`)).includes(anteprima));
    verifica('il menu chiarisce che gli esclusi restano aperti', true,
      (await c.val(`document.querySelector('#bancoPop .bforma-aiuto').textContent`)).includes('restano aperti'));
    verifica('passare sulla forma non modifica il banco', primaAnteprima, await c.val('JSON.stringify(bancoStato())'));
    const shot = await c.invia('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('/tmp/studia-zaino-banco-riduzione.png', Buffer.from(shot.result.data, 'base64'));
    await c.clicca('#bForme .bforma[data-forma="due-col"]');
    await aspetta(`bancoStato().forma==='due-col' && !document.getElementById('bancoPop').hasAttribute('open')`);
    verifica('il banco mostra proprio i due annunciati', ['appunti2', 'fonte'], await visibili());
    verifica('i pannelli sono montati nei due riquadri reali', true,
      await c.val(`!!document.querySelector('.bcorpo[data-corpo="A"] > #notePane2') && !!document.querySelector('.bcorpo[data-corpo="C"] > #pdfPane')`));
    verifica('gli altri pannelli rimangono vivi nel magazzino', true,
      await c.val(`!!document.querySelector('#bancoMagazzino > #notePane') && !!document.querySelector('#bancoMagazzino > #pdfPane2')`));
    verifica('l’attivo segue lo strumento nel nuovo primo riquadro', 'A', await c.val('bancoBloccoAttivo()'));
    verifica('un solo pallino è attivo a schermo', 1,
      await c.val(`Array.from(document.querySelectorAll('#banco .blocco')).filter(b=>!b.hidden && !b.querySelector('.battivo').hidden).length`));
    verifica('tutti gli strumenti restano nello stato', tutti, await strumentiSalvati());
    verifica('nessun pannello o testo di appunto viene ricreato o perso', true, await pannelliIntatti());
    await formaConMouse('quattro');
    verifica('riallargare mostra di nuovo tutti gli strumenti', tutti, (await visibili()).sort());
    verifica('riallargare riusa gli stessi pannelli e testi', true, await pannelliIntatti());

    console.log('\n== Tre → uno: scelta della forma da tastiera');
    await c.val(`(() => {
      BANCO.stato=BancoForme.normalizzaStato({forma:'tre-sx',col:0.5,riga:0.5,
        blocchi:{A:'fonte',C:'appunti',D:'appunti2',B:'fonte2'}});
      BANCO.attivo='A'; bancoSalva(); bancoDisegna(); return true;
    })()`);
    await c.clicca('.blocco[data-blocco="C"] .bnumero');
    verifica('il secondo riquadro visivo è ora attivo', 'C', await c.val('bancoBloccoAttivo()'));
    await menu();
    // Il focus della scelta vive fuori dal banco: l’Invio non deve cambiare
    // quale riquadro verrà conservato. Il comando parte da tastiera vera.
    await c.val(`document.querySelector('#bForme .bforma[data-forma="uno"]').focus()`);
    await aspetta(`document.getElementById('bFormaAnteprima').textContent.startsWith('Restano: 2 · Appunti')`);
    verifica('il focus nel menu conserva l’ultimo riquadro', 'C', await c.val('bancoBloccoAttivo()'));
    verifica('il pulsante Uno conserva il focus', 'uno', await c.val('document.activeElement.dataset.forma'));
    await c.invia('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r',unmodifiedText:'\r'});
    await c.invia('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
    await aspetta(`bancoStato().forma==='uno' && !document.getElementById('bancoPop').hasAttribute('open')`);
    verifica('Invio conserva proprio l’appunto del riquadro C', ['appunti'], await visibili());
    verifica('il pannello conservato è realmente a schermo', true,
      await c.val(`!!document.querySelector('.bcorpo[data-corpo="A"] > #notePane') && document.getElementById('notePane').getBoundingClientRect().width>0`));
    verifica('la riduzione a uno conserva tutti gli altri strumenti', tutti, await strumentiSalvati());
    const salvato = await c.val('JSON.stringify(bancoStato())');
    await c.val('bancoRicarica()');
    verifica('la disposizione rientra identica dal localStorage', salvato, await c.val('JSON.stringify(bancoStato())'));
    verifica('il ripristino mantiene l’appunto a schermo', ['appunti'], await visibili());
    await formaConMouse('quattro');
    verifica('dopo tre → uno → quattro tutti i riquadri tornano visibili', tutti, (await visibili()).sort());
    verifica('anche dopo il ripristino i pannelli e i testi sono gli originali', true, await pannelliIntatti());
  } finally {
    await c.val(`(() => {
      closePops();
      const p=${JSON.stringify(precedente)};
      BANCO.stato=BancoForme.normalizzaStato(p.stato); BANCO.attivo=p.attivo;
      bancoDisegna();
      if(p.salvato===null) localStorage.removeItem(p.chiave); else localStorage.setItem(p.chiave,p.salvato);
      if(p.zoom===null) localStorage.removeItem(p.chiave+'.zoom'); else localStorage.setItem(p.chiave+'.zoom',p.zoom);
      delete window.__bancoRiduzione; return true;
    })()`);
  }
  verifica('la prova lascia la disposizione iniziale', precedente.stato, await c.val('bancoStato()'));
  verifica('la memoria del banco torna com’era', precedente.salvato,
    await c.val(`localStorage.getItem(${JSON.stringify(precedente.chiave)})`));
  console.log('\n✓ banco: riduzioni, anteprima, focus e conservazione (' + controlli + ' controlli)');
  process.exit(0);
})().catch(e => { console.error('prova-banco-riduzione:', e); process.exit(1); });
