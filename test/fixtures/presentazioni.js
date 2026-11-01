'use strict';
const M=require('../../App/assets/presentazioni/modello');
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jMZkAAAAASUVORK5CYII=','base64');
function audio(){const n=8000,b=Buffer.alloc(44+n*2);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(8000,24);b.writeUInt32LE(16000,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(n*2,40);for(let i=0;i<n;i++)b.writeInt16LE(Math.round(Math.sin(i*2*Math.PI*440/8000)*3000),44+i*2);return b;}
function esempio(base){
 const d=M.copia(base);let n=0;const id=()=> 'esempio_'+(++n);
 const testo=(markdown,slot='body',type='text')=>({id:id(),type,slot,markdown});
 const slide=(title,blocks)=>({...M.slide(id),title,blocks,notes:{markdown:'NOTA_PRIVATA: '+title+'; chiedere una spiegazione agli studenti. \\(x^2\\)'}});
 const apertura=slide('Sistema solare',[testo('Il Sistema solare','title','title'),testo('Esploriamo **pianeti** e orbite. La forza segue \\(F=ma\\).')]);
 const pianeti=slide('Pianeti',[testo('Pianeti','title','title'),testo('Rocciosi e giganti gassosi'),testo('La distanza dal Sole cambia il periodo orbitale.')]);
 pianeti.animations=[{targetId:pianeti.blocks[1].id,step:1,effect:'fade-in'},{targetId:pianeti.blocks[2].id,step:1,effect:'fade-up'},{targetId:pianeti.blocks[1].id,step:2,effect:'highlight-red'}];
 const formule=['\\frac{1}{2}','\\sqrt{x^2+y^2}','a_i^2+\\alpha','\\begin{pmatrix}1&2\\\\3&4\\end{pmatrix}','\\begin{aligned}a&=b+c\\\\d&=e+f\\end{aligned}','\\comandoinesistente{x}'];
 const orbite=slide('Orbite',[testo('Orbite','title','title'),...formule.map(latex=>({id:id(),type:'math',slot:'formula',latex,display:true}))]);
 d.stacks=[{id:id(),slides:[apertura]},{id:id(),slides:[pianeti,slide('Rocciosi',[testo('Mercurio, Venere, Terra e Marte')]),slide('Giganti gassosi',[testo('Giove e Saturno')])]},{id:id(),slides:[orbite,slide('Esempio',[{id:id(),type:'math',slot:'formula',latex:'T^2 \\propto a^3',display:true}]),slide('Soluzione',[testo('Confronta i periodi e le distanze.')])]}];
 return M.esigi(d);
}
module.exports={png,audio,esempio};
