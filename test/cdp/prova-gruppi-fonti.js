'use strict';
// Solo vault sintetico di bin/prova-zaino.sh: prova gesti, persistenza e riapertura.
const assert=require('assert'), fs=require('fs'), path=require('path'), c=require('./cdp');
async function aspetta(expr){
  const fine=Date.now()+10000;
  while(Date.now()<fine){ if(await c.val(expr)) return; await c.pausa(80); }
  throw new Error('Attesa scaduta: '+expr);
}
async function stabile(){ await aspetta('!ZNAV.carico && !ZNAV.salva'); await c.pausa(120); }
async function click(sel){
  await stabile();
  await c.val(`document.querySelector(${JSON.stringify(sel)}).scrollIntoView({block:'nearest'})`);
  await c.pausa(80); await c.clicca(sel); await c.pausa(80);
}
async function nome(testo){
  await aspetta(`document.getElementById('uiModal').hasAttribute('open')`);
  await c.val(`document.getElementById('umInput').value=${JSON.stringify(testo)}`);
  await c.clicca('#umOk'); await stabile();
}
const stato=()=>c.val('ZNAV.gruppi');
async function assegna(file,id){
  await stabile();
  await c.val(`(()=>{const s=Array.from(document.querySelectorAll('[data-znav-gruppo]')).find(s=>s.dataset.znavGruppo===${JSON.stringify(file)});s.value=${JSON.stringify(id)};s.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await stabile();
}
(async()=>{
  await c.collega(); await c.partiPulito();
  await aspetta(`zainoAttivo()==='biologia' && ZNAV.gruppi && !ZNAV.carico`);
  const vault=await c.val('window.vault.path'); assert(vault.includes('studia-zaino-prova-'));
  const iniziale=await stato(), files=iniziale.liberi; assert.equal(files.length,2);
  await click('[data-znav="crea"]'); await nome('Lezioni <base>');
  const uno=(await stato()).gruppi[0].id;
  assert.equal(await c.val(`document.querySelector('.zs-nome').textContent`),'Lezioni <base>');
  await assegna(files[0],uno); await assegna(files[1],uno);
  assert.equal(await c.val('document.activeElement.dataset.znavGruppo'),files[1]);
  assert.deepEqual((await stato()).gruppi[0].files,files);
  await click('.zs-gruppo [data-znav="file-giu"]');
  assert.deepEqual((await stato()).gruppi[0].files,[files[1],files[0]]);
  assert.deepEqual(await c.val(`Array.from(document.querySelectorAll('.zs-gruppo .zn-fonte')).map(x=>x.dataset.quale)`),[files[1],files[0]]);
  await click('[data-znav="toggle"]');
  assert.equal((await stato()).gruppi[0].chiuso,true);
  assert.equal(await c.val(`document.querySelector('.zs-gruppo .zn-fonte').getBoundingClientRect().height`),0);
  await click('[data-znav="crea"]'); await nome('Esercizi');
  const due=(await stato()).gruppi[1].id;
  await click(`section[data-gruppo="${due}"] [data-znav="gruppo-su"]`);
  assert.deepEqual((await stato()).gruppi.map(g=>g.id),[due,uno]);
  await click(`section[data-gruppo="${due}"] [data-znav="rinomina"]`); await nome('Ripasso');
  const salvato=await stato();
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(vault,'Zaini/biologia/MATERIALI/_gruppi.json'),'utf8')),salvato);
  await c.val(`cambiaZaino('storia',true)`); await aspetta(`ZNAV.id==='storia' && !ZNAV.carico`);
  assert.equal((await stato()).gruppi.length,0);
  await c.val(`cambiaZaino('biologia',true)`); await aspetta(`ZNAV.id==='biologia' && !ZNAV.carico`);
  assert.deepEqual(await stato(),salvato);
  await c.val('location.reload()'); await c.pausa(1100);
  await aspetta(`typeof ZNAV!=='undefined' && ZNAV.gruppi && !ZNAV.carico`);
  assert.deepEqual(await stato(),salvato);
  await click(`section[data-gruppo="${uno}"] [data-znav="toggle"]`);
  await click(`section[data-gruppo="${uno}"] .zn-fonte`);
  await aspetta(`ANTEPRIMA.file===${JSON.stringify(files[1])}`);
  await click('[data-znav="organizza"]');
  assert.equal(await c.val('document.activeElement.dataset.znav'),'organizza');
  await click(`section[data-gruppo="${uno}"] [data-znav="elimina"]`);
  assert.deepEqual((await stato()).liberi,[files[1],files[0]]);
  assert.equal(fs.readdirSync(path.join(vault,'Zaini/biologia/MATERIALI/PDF')).filter(f=>f.endsWith('.pdf')).length,2);
  // L'errore di lettura non nasconde le fonti né permette di sovrascrivere il registro.
  const registro=path.join(vault,'Zaini/biologia/MATERIALI/_gruppi.json'), buono=fs.readFileSync(registro,'utf8');
  fs.writeFileSync(registro,'{rotto'); await c.val('zainoNavAggiorna()'); await stabile();
  assert.equal(await c.val(`document.querySelectorAll('#zainoNav .zn-fonte').length`),2);
  assert.equal(await c.val(`document.querySelector('[data-znav="crea"]').disabled`),true);
  assert.match(await c.val(`document.querySelector('#zainoNav .zs-no').textContent`),/non leggibile/);
  fs.writeFileSync(registro,buono); await c.val('zainoNavAggiorna()'); await stabile();
  await assegna(files[1],due);
  for(const tema of ['chiaro','scuro']){
    await c.val(`document.documentElement.dataset.theme=${JSON.stringify(tema)}`);
    await c.pausa(100);
    const r=await c.invia('Page.captureScreenshot',{format:'png'});
    fs.writeFileSync('/tmp/studia-zaino-gruppi-'+tema+'.png',Buffer.from(r.result.data,'base64'));
    assert(await c.val(`(()=>{const e=document.getElementById('zainoNav');return e.scrollWidth<=e.clientWidth+1;})()`));
  }
  await c.val(`document.documentElement.dataset.theme='chiaro'; ZNAV.organizza=false; zainoNavAggiorna()`);
  console.log('✓ gruppi: crea, rinomina, sposta, ordina, chiudi, riapri, cambia zaino e sciogli senza perdere fonti');
  process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
