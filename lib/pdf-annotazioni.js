'use strict';
const path=require('node:path'),{createHash}=require('node:crypto'),D=require('./permessi-disco'),fs=D.fs,A=require('./appunti'),F=require('./fonti'),M=require('../App/assets/fonti/annotazioni');
// L'impronta segue anche una rinomina; lo stesso documento nei due split
// condivide il registro. Una revisione impedisce di sovrascrivere un'altra vista.
async function fonte(v,z,file){
 require('./fonti-ai').verifica(v,z);const originale=F.percorso(v,z,file);
 if(!originale||!file.toLowerCase().endsWith('.pdf'))throw Error('Fonte PDF non disponibile.');
 const p=D.percorso(v,originale),st=await fs.promises.stat(p);if(st.size>128*1024*1024)throw Error('Le annotazioni supportano PDF fino a 128 MB.');
 const bytes=await fs.promises.readFile(p),id=createHash('sha256').update(bytes).digest('hex');
 return {p,bytes,id,registro:D.percorso(v,path.join(A.dir(v,z),'_annotazioni-pdf',id+'.json'))};
}
function contenuto(f){
 try{if(fs.statSync(f.registro).size>8*1024*1024)throw Error('Registro delle annotazioni troppo grande.');return M.valida(JSON.parse(fs.readFileSync(f.registro,'utf8')));}
 catch(e){if(e.code==='ENOENT')return M.vuoto();throw e;}
}
async function leggi(v,z,file){const f=await fonte(v,z,file);return {id:f.id,...contenuto(f)};}
async function salva(v,z,file,id,dati){
 const d=M.valida(dati),f=await fonte(v,z,file);if(f.id!==id)throw Error('Il PDF è cambiato: riaprilo prima di annotare.');
 const prima=contenuto(f);if(prima.revisione!==d.revisione)throw Error('Le annotazioni sono cambiate in un’altra vista. Riapri il documento per aggiornarle.');
 d.revisione++;const json=JSON.stringify(d,null,2)+'\n';if(Buffer.byteLength(json)>8*1024*1024)throw Error('Registro delle annotazioni troppo grande. Riduci il numero di segni.');
 fs.mkdirSync(path.dirname(f.registro),{recursive:true});A.writeAtomic(f.registro,json);return {id:f.id,...d};
}
async function esporta(v,z,file){
 const f=await fonte(v,z,file),d=contenuto(f),{PDFDocument,rgb,LineCapStyle,StandardFonts}=require('pdf-lib'),pdf=await PDFDocument.load(f.bytes),pages=pdf.getPages(),font=await pdf.embedFont(StandardFonts.Helvetica);
 // Il TTF è per l'export: il decoder WOFF2 di fontkit rompe il subset dei glifi.
 const caratteri={zaino:font};if(d.segni.some(s=>M.haTesto(s)&&s.fontUi==='atkinson')){pdf.registerFontkit(require('@pdf-lib/fontkit'));caratteri.atkinson=await pdf.embedFont(await fs.promises.readFile(path.join(__dirname,'../App/assets/presentazioni/fonts/AtkinsonHyperlegible-Regular.ttf')),{subset:true});}
 for(const s of d.segni){const p=pages[s.pagina-1];if(!p)throw Error('Una pagina annotata non esiste più.');const c=s.colore.slice(1),color=rgb(...[0,2,4].map(i=>parseInt(c.slice(i,i+2),16)/255));
  if(M.haTesto(s)){
   const carattere=caratteri[s.fontUi||'zaino'];
   try{
    const disponibili=new Set(carattere.getCharacterSet());for(const lettera of s.testo){if(!'\n\r'.includes(lettera)&&!disponibili.has(lettera.codePointAt(0)))throw Error('carattere non disponibile: '+lettera);}
    const righe=M.righe(s,t=>carattere.widthOfTextAtSize(t,s.fontSize));
    if(s.tipo==='postit'){const r=M.riquadro(s,righe.length),f=s.fondo.slice(1);p.drawRectangle({x:r.x,y:r.y,width:r.w,height:r.h,color:rgb(...[0,2,4].map(i=>parseInt(f.slice(i,i+2),16)/255)),opacity:s.opacita});}
    p.drawText(righe.join('\n'),{x:s.punti[0][0],y:s.punti[0][1],font:carattere,size:s.fontSize,lineHeight:s.fontSize*1.2,color,opacity:s.opacita});
   }catch(e){throw Error('Impossibile esportare il testo con il font scelto: '+e.message);}continue;
  }
  // Un solo tratto per segno: sovrapporre segmenti separati scurirebbe
  // le giunture quando l'opacità è inferiore al 100%.
  const percorso=M.percorso(s,true);
  for(const pieno of M.pieni(s)){const d=M.percorsoPunti([pieno.map(([x,y])=>[x,-y])])+' Z';p.drawSvgPath(d,{x:0,y:0,color,opacity:s.opacita});}
  p.drawSvgPath(percorso,{x:0,y:0,borderColor:color,borderWidth:s.spessore,borderOpacity:s.opacita,borderLineCap:LineCapStyle.Round});
 }
 return {originale:f.p,bytes:await pdf.save()};
}
module.exports={leggi,salva,esporta};
