/* Demo pure: l’editor lavora su queste copie, mai sui materiali dello zaino. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('../presentazioni/modello'),require('./stili'));else root.ZainoTuningDemoModello=factory(root.PresentaModello,root.ZainoStili);})(globalThis,function(M,S){
 'use strict';
 function presentazione(p){
  let d=M.crea('00000000-0000-4000-8000-000000000001','Demo · '+p.nome),n=0,id=()=> 'demo-'+(++n);
  d.stacks=['La foresta','Le piante','Gli animali'].map((nome,h)=>({id:id(),slides:[nome,'Osserviamo da vicino','Colleghiamo le idee'].map((titolo,v)=>{
   const s=M.slide(id);s.title=v?nome+' · '+titolo:titolo;
   s.blocks=[{id:id(),type:'title',slot:'title',markdown:s.title,style:{box:{x:8,y:12,width:84,height:18},fontSize:54,color:'#0f766e'}},{id:id(),type:'text',slot:'body',markdown:['Ogni elemento della foresta è collegato agli altri.','La luce, l’acqua e il suolo permettono alla vita di crescere.','Osserva i dettagli e scopri nuove relazioni.'][v],style:{box:{x:8,y:36,width:84,height:42},fontSize:32,color:'#20242b'}},{...M.modelloComune('navbar'),id:id()}];return s;
  })}));
  if(p.tipo==='slide')d=M.applica(d,{tipo:'stilePresentazione',slideId:d.stacks[0].slides[0].id,tema:{...p.stile,nome:p.nome},community:true,tutte:true});
  else for(const pos of M.posizioni(d))pos.slide.blocks=pos.slide.blocks.map(b=>b.type==='navbar'?S.bloccoNavbar(b,p.stile):b);
  return M.esigi(d);
 }
 function mappa(){return {nodi:[
  {id:'foresta',testo:'La foresta'},{id:'piante',testo:'Piante'},{id:'animali',testo:'Animali'},
  {id:'alberi',testo:'Alberi',immagine:{id:'albero',w:180,h:120}},{id:'fiori',testo:'Fiori'},
  {id:'uccelli',testo:'Uccelli',immagine:{id:'uccello',w:180,h:120}},{id:'insetti',testo:'Insetti'}
 ],archi:[{da:'foresta',a:'piante',rel:'comprende'},{da:'foresta',a:'animali',rel:''},{da:'piante',a:'alberi',rel:'come'},{da:'piante',a:'fiori',rel:''},{da:'animali',a:'uccelli',rel:'come'},{da:'animali',a:'insetti',rel:''}]};}
 function estrai(p,d,s){return {...M.copia(p),stile:p.tipo==='slide'?S.slideCompleta(d,s):S.navbar(s.blocks.find(b=>b.type==='navbar'))};}
 return {presentazione,mappa,estrai};
});
