/* Scelta locale delle fonti di ricerca e ripasso: indipendente dalle chat. */
(function(root,factory){
 if(typeof module==='object' && module.exports)module.exports=factory();else root.ZainoSceltaFonti=factory();
}(typeof self!=='undefined'?self:this,function(){
 'use strict';
 function normalizza(s){return {mode:s?.mode==='selected'?'selected':'all',sourceIds:[...new Set((Array.isArray(s?.sourceIds)?s.sourceIds:[]).filter(id=>typeof id==='string'))],wikipedia:false};}
 function crea({prefix,bar,host,state,onChange}){
  const button=document.createElement('button');button.type='button';button.className='tbtn zstudio-scope-button';button.id=prefix+'Button';
  button.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M8 6h13M8 12h13M8 18h13"/><circle cx="3" cy="6" r="1"/><circle cx="3" cy="12" r="1"/><circle cx="3" cy="18" r="1"/></svg><span></span>';
  button.title='Scegli una o più fonti per questo strumento';button.setAttribute('aria-expanded','false');button.setAttribute('aria-controls',prefix);bar.prepend(button);
  const panel=document.createElement('div');panel.id=prefix;panel.hidden=true;panel.className='zchat-scope zchat-source-picker';host.append(panel);
  let epoch=0;
  const key=()=> 'studia-zaino.fonti.'+prefix+'.'+window.vault.path+'.'+state.zaino;
  function draw(){
   button.querySelector('span').textContent=state.scope.mode==='all'?'Fonti: tutte':'Fonti: '+state.scope.sourceIds.length;
   panel.replaceChildren();
   function row(label,checked,fn,id){const l=document.createElement('label'),c=document.createElement('input'),t=document.createElement('span');c.type='checkbox';c.disabled=button.disabled;c.checked=checked;c.onchange=()=>fn(c.checked);if(id)c.dataset.sourceId=id;t.textContent=label.split('/').pop();t.title=label;l.append(c,t);panel.append(l);}
   row('Tutto lo zaino',state.scope.mode==='all',checked=>set({mode:checked?'all':'selected',sourceIds:[]}));
   for(const source of state.sources||[])row(source.file,state.scope.mode==='all'||state.scope.sourceIds.includes(source.id),checked=>{
    const ids=new Set(state.scope.mode==='all'?state.sources.map(s=>s.id):state.scope.sourceIds);if(checked)ids.add(source.id);else ids.delete(source.id);set({mode:'selected',sourceIds:[...ids]});
   },source.id);
   if(state.scope.mode==='selected'&&!state.scope.sourceIds.length){const p=document.createElement('p');p.className='zchat-hint';p.textContent='Nessuna fonte selezionata.';panel.append(p);}
  }
  function set(scope){state.scope=normalizza(scope);try{localStorage.setItem(key(),JSON.stringify(state.scope));}catch(_){}draw();onChange?.();}
  async function refresh(){const z=state.zaino,run=++epoch;if(!z){state.sources=[];draw();return;}const r=await window.vault.chat.sources(z);if(run!==epoch||z!==state.zaino)return;if(!r?.ok)throw Error(r?.error||'Fonti non disponibili.');state.sources=r.sources;draw();}
  async function sync(){let s;try{s=JSON.parse(localStorage.getItem(key()));}catch(_){}state.scope=normalizza(s);panel.hidden=true;button.setAttribute('aria-expanded','false');await refresh();}
  button.onclick=()=>{panel.hidden=!panel.hidden;button.setAttribute('aria-expanded',String(!panel.hidden));if(!panel.hidden)refresh().catch(e=>{panel.textContent=e.message;});};
  panel.onkeydown=e=>{if(e.key==='Escape'){panel.hidden=true;button.setAttribute('aria-expanded','false');button.focus();e.stopPropagation();}};
  state.scope=normalizza(state.scope);draw();return {sync,refresh,set,button,panel};
 }
 return {normalizza,crea};
}));
