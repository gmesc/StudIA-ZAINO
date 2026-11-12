'use strict';
// Correzione ripetibile della presentazione dimostrativa, sempre su una copia.
const fs=require('node:fs'),V=require('../lib/validate');
function rivedi(originale){
 const d=structuredClone(originale),nomi=/\b(qpdf|ClamAV|Hunspell|Pretext|Excalidraw|Tesseract)\b/g;
 const corsivo=s=>s.replace(nomi,(nome,offset,t)=>t[offset-1]==='*'&&t[offset+nome.length]==='*'?nome:'*'+nome+'*');
 for(const st of d.stacks)for(const s of st.slides){
  // Gli esperimenti di movimento non fanno parte del percorso didattico.
  if(s.title==='Apri lo zaino esempio'){s.autoAnimate={...s.autoAnimate,enabled:false,groupId:null};for(const b of s.blocks)delete b.matchId;}
  if(s.title==='OCR: rendi selezionabile una scansione')s.animations=s.animations.filter(a=>a.effect!=='letters');
  for(const b of s.blocks){
   if(b.markdown)b.markdown=corsivo(b.markdown);
   for(const i of b.items||[])if(i.markdown)i.markdown=corsivo(i.markdown);
   if(b.table)b.table=b.table.map(r=>r.map(t=>corsivo(t)));
   if(b.richText)b.richText=b.richText.flatMap(run=>{const parts=[],re=new RegExp(nomi.source,'g');let pos=0,m;while(m=re.exec(run.text)){if(m.index>pos)parts.push({...run,text:run.text.slice(pos,m.index)});parts.push({...run,text:m[0],style:{...run.style,italic:true}});pos=m.index+m[0].length;}if(pos<run.text.length)parts.push({...run,text:run.text.slice(pos)});return parts;});
  }
 }
 const esito=V.validatePresentazione(d);if(!esito.ok)throw Error(JSON.stringify(esito.errors));return d;
}
if(require.main===module){const [src,dst]=process.argv.slice(2);if(!src||!dst||src===dst)throw Error('Uso: node bin/rivedi-intro-zaino.js sorgente.json copia-corretta.json');const d=rivedi(JSON.parse(fs.readFileSync(src)));fs.writeFileSync(dst,JSON.stringify(d,null,2)+'\n',{flag:'wx'});console.log('Controllate '+d.stacks.reduce((n,s)=>n+s.slides.length,0)+' slide; originale conservato.');}
module.exports={rivedi};
