'use strict';
// Dimostrazione delle fondazioni, esclusivamente in un vault sintetico temporaneo.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
async function genera(dest){
 const v=fs.mkdtempSync(path.join(os.tmpdir(),'zaino-presenta-demo-'));
 try{
  require('../lib/zaini').crea(v,'Scienze');
  const P=require('../lib/presentazioni'),R=require('../lib/presentazioni-risorse'),M=require('../App/assets/presentazioni/modello'),F=require('../test/fixtures/presentazioni');
  let d=F.esempio(await P.crea(v,'scienze','Il Sistema solare'));
  const a=require('../lib/album').salva(v,'scienze',{origine:'foto',materiale:'Pianeta.png',didascalia:'Immagine dimostrativa',dati:'data:image/png;base64,'+F.png.toString('base64')});if(a.error)throw Error(a.error);
  const immagine=await R.importa(v,'scienze',d.id,{tipo:'album',id:a.voce.id,corso:'scienze'},d.revision);
  d=M.applica(d,{tipo:'inserisciBlocco',slideId:d.stacks[1].slides[0].id,...immagine});
  const dir=path.join(v,'Zaini/scienze/MATERIALI/Audio');fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'01 Tono.wav'),F.audio());
  const audio=await R.importa(v,'scienze',d.id,{version:1,tipo:'audio',file:'01 Tono.wav',corso:'scienze'},d.revision);
  d=M.applica(d,{tipo:'inserisciBlocco',slideId:d.stacks[0].slides[0].id,...audio});
  d=M.applica(d,{tipo:'statoSuccessivo',slideId:d.stacks[1].slides[0].id,direzione:'sotto'});
  d.stacks[1].slides[1].blocks[1].style={fontSize:52,color:'#357a38'};
  d=await P.salva(v,'scienze',d,d.revision);fs.mkdirSync(dest,{recursive:true});return await require('../lib/presentazioni-export').esporta(v,'scienze',d.id,dest,d.revision);
 }finally{fs.rmSync(v,{recursive:true,force:true});}
}
if(require.main===module){const dest=process.argv[2];if(!dest||!path.isAbsolute(dest))throw Error('Indica una cartella di destinazione assoluta.');genera(dest).then(r=>console.log(JSON.stringify(r,null,2))).catch(e=>{console.error(e);process.exitCode=1;});}
module.exports={genera};
