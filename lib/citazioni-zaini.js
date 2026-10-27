'use strict';
// Solo gesti dell'utente. Il recupero AI non importa questo modulo e non segue i link.
const path=require('node:path'),{randomUUID}=require('node:crypto');
const D=require('./permessi-disco'),fs=D.fs,Z=require('./zaini'),F=require('./fonti-ai');
const R=require('../App/assets/rimandi/sintassi'),{scriviAtomico,leggiFileSicuro}=require('./chat-profili');
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
function identita(v,z,crea=false){
 F.verifica(v,z);let data;
 try{data=JSON.parse(leggiFileSicuro(v,[...F.parti(z),'_identita.json'],4096));}
 catch(e){if(e.code!=='ENOENT')throw e;if(!crea)return '';data={version:1,id:randomUUID()};scriviAtomico(v,[...F.parti(z),'_identita.json'],JSON.stringify(data,null,2)+'\n');}
 if(data.version!==1||!UUID.test(data.id))throw Error('Identità dello zaino non valida.');return data.id;
}
function trovaZaino(v,id){
 if(!UUID.test(id))throw Error('Identità dello zaino non valida.');
 const trovati=[];
 for(const d of fs.readdirSync(D.percorso(v,path.join(v,'Zaini')),{withFileTypes:true})){
  if(!d.isDirectory()||d.name.startsWith('.')||!Z.esiste(v,d.name))continue;
  if(identita(v,d.name)===id)trovati.push(d.name);
 }
 return trovati;
}
function titolo(v,z){return require('./profilo').parse(leggiFileSicuro(v,[...F.parti(z),'_zaino.md']).toString('utf8')).title||z;}
function crea(v,z,file,pagina,testo=''){
 if(!Z.nomeValido(z)||!Z.esiste(v,z))throw Error('Zaino non disponibile.');
 if(typeof file!=='string'||file!==path.basename(file)||/[\\\x00-\x1f]/.test(file)||!/\.pdf$/i.test(file))throw Error('PDF non valido.');
 if(pagina!==null&&(!Number.isInteger(pagina)||pagina<1||pagina>999999))throw Error('Numero di pagina non valido.');
 if(typeof testo!=='string'||testo.length>100000)throw Error('Citazione troppo lunga.');
 const matches=F.sincronizza(v,z).sources.filter(s=>s.kind==='pdf'&&path.basename(s.file)===file);
 if(matches.length!==1)throw Error(matches.length?'Più PDF hanno lo stesso nome. Rinominali prima di citarli.':'PDF non disponibile o non leggibile.');
 const s=matches[0],p=D.percorso(v,path.join(v,...F.parti(z),s.file));
 if(!require('./formati-sicuri').verificaFile(p,{estensioni:['.pdf']}).ok)throw Error('Formato PDF non consentito.');
 const id=identita(v,z,true),rimando=R.scriviPdfZaino(id,s.id,pagina,s.revision);
 const r={status:'available',zaino:z,zainoTitolo:titolo(v,z),file,pagina:pagina===null?1:pagina,rimando,...(pagina===null?{intero:true}:{})};
 return {...r,markdown:R.citazionePdfZaino(r,testo)};
}
function risolvi(v,rimando){
 const r=R.leggi(rimando);if(!r||r.tipo!=='pdf-zaino')throw Error('Citazione non valida.');
 const trovati=trovaZaino(v,r.zainoId);
 if(trovati.length!==1)return {status:trovati.length?'ambiguous':'removed'};
 const z=trovati[0],source=F.sincronizza(v,z,{salva:false}).sources.find(s=>s.id===r.sourceId&&s.kind==='pdf');
 if(!source)return {status:'removed'};
 if(source.revision!==r.revision)return {status:'changed'};
 return {status:'available',zaino:z,zainoTitolo:titolo(v,z),file:path.basename(source.file),pagina:r.pagina,rimando,...(r.intero?{intero:true}:{}),...(r.selezione?{selezione:r.selezione}:{}),path:D.percorso(v,path.join(v,...F.parti(z),source.file))};
}
function leggi(r){
 const ref=R.leggi(r.rimando),fd=fs.openSync(r.path,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW);
 let bytes;
 try{if(fs.fstatSync(fd).size>40*1024*1024)throw Error('PDF troppo grande per questa citazione (massimo 40 MB).');bytes=fs.readFileSync(fd);}finally{fs.closeSync(fd);}
 if(bytes.length>40*1024*1024||F.hash(bytes)!==ref.revision)throw Error('La fonte è cambiata durante l’apertura.');
 return bytes;
}
module.exports={crea,risolvi,leggi};
