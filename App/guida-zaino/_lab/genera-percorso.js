'use strict';
// Genera soltanto il laboratorio dichiarato e il pacchetto didattico della guida.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=process.env.ZAINO_GUIDA_ROOT, v=process.env.GUIDA_VAULT;
if(!root||!v||!path.resolve(v).startsWith('/private/tmp/studia-guida-20261105-'))throw Error('Usa un laboratorio temporaneo dedicato.');
const G=path.join(root,'App/guida-zaino'),data=JSON.parse(fs.readFileSync(path.join(G,'_lab/percorso-base.json')));
const Z=require(path.join(root,'lib/zaini')),A=require(path.join(root,'lib/appunti')),M=require(path.join(root,'lib/mappe')),P=require(path.join(root,'lib/presentazioni')),PM=require(path.join(root,'App/assets/presentazioni/modello')),Album=require(path.join(root,'lib/album'));
const noteFiles=[],precedenti=fs.existsSync(path.join(v,'demo.json'))?JSON.parse(fs.readFileSync(path.join(v,'demo.json'))).noteFiles||[]:[];
const z='intro-a-zaino',base=path.join(v,'Zaini',z),pdf='0001 - Miniguida ZAINO.pdf';
const uuid='e8d04c9b-a2b0-4da2-a360-8f24c890da7c';
function ok(r){if(r?.error)throw Error(r.error);return r;}
function pngSize(b){return {w:b.readUInt32BE(16),h:b.readUInt32BE(20)};}
(async()=>{
fs.mkdirSync(v,{recursive:true});if(!Z.esiste(v,z))ok(Z.crea(v,'Intro a ZAINO','2026-11-05'));
fs.writeFileSync(path.join(base,'_identita.json'),JSON.stringify({version:1,id:uuid}));
const mini=path.join(G,'download/Miniguida-ZAINO.pdf');
if(!fs.existsSync(mini)){
 const {PDFDocument,StandardFonts}=require(path.join(root,'node_modules/pdf-lib')),d=await PDFDocument.create(),font=await d.embedFont(StandardFonts.Helvetica);
 for(const b of data){let page=d.addPage([595,842]);page.drawText('ZAINO - '+b.page+' - '+b.title.replace(/[^\x20-\x7eàèéìòù]/g,' '),{x:40,y:760,size:18,font});page.drawText('La miniguida accompagna il percorso pratico.',{x:40,y:700,size:13,font});}
 fs.writeFileSync(mini,await d.save());
}
fs.copyFileSync(mini,path.join(base,'MATERIALI/PDF',pdf));
fs.copyFileSync(path.join(G,'_lab/materiali/Scheda fotografata.pdf'),path.join(base,'MATERIALI/PDF/0002 - Scheda fotografata.pdf'));
const immagini={};
for(const b of data){const f=path.join(G,'img/nuova-'+b.shot+'.png');if(!fs.existsSync(f))continue;const bytes=fs.readFileSync(f),r=ok(Album.salva(v,z,{origine:'foto',materiale:'Schermata '+b.title+'.png',didascalia:b.title,dati:'data:image/png;base64,'+bytes.toString('base64')}));immagini[b.id]={id:r.voce.id,...pngSize(bytes)};}
// Appunti brevi: un'azione per riga, riferimenti relativi al PDF dello zaino.
for(const b of data){const numero=String(b.page).padStart(2,'0'),titolo=b.page===1?'01 - Inizia qui':numero+' - '+b.title;
 const ref='pdf:0001#p='+b.page;
 const nome=A.nomeSicuro(A.safeName(titolo),'Appunto')+'.md',vecchio=path.join(base,'APPUNTI',titolo+'.md');if(nome!==titolo+'.md'&&fs.existsSync(vecchio))fs.unlinkSync(vecchio);noteFiles.push(nome);
 if(immagini[b.id]){const fig=path.join(base,'MATERIALI/Figure',pdf.replace(/\.pdf$/i,'')+'__p'+String(b.page).padStart(3,'0')+'_f1.webp');fs.mkdirSync(path.dirname(fig),{recursive:true});require('node:child_process').execFileSync(process.env.GUIDA_PYTHON||'python3',['-c','from PIL import Image;import sys;Image.open(sys.argv[1]).save(sys.argv[2],format="WEBP",lossless=True)',path.join(G,'img/nuova-'+b.shot+'.png'),fig]);}
 const corpo='# '+b.title+'\n\n'+b.read+'\n\n## Prova tu\n\n'+b.actions.map((s,i)=>(i+1)+'. '+s).join('\n')+'\n\n## Controlla\n\n'+b.result+'\n\n[Apri la miniguida, pagina '+b.page+']('+ref+')\n\n'+(immagini[b.id]?'![Schermata: '+b.title+'](fig:0001#p='+b.page+'&i=1)\n\n':'')+(b.id==='modelli'?'[Tutorial API Infomaniak](https://insegnai.ch/articoliblog/guida-infomaniak.html)\n\n':'')+(b.id==='conclusione'?'Apri Impostazioni, poi Zaino e “Apri la guida allo ZAINO”. La sezione 4 spiega ogni strumento.\n':'');
 ok(A.save(v,z,nome,{title:titolo},corpo,'2026-11-05T09:00:00.000Z'));
}
for(const nome of precedenti)if(!noteFiles.includes(nome)){const p=path.join(base,'APPUNTI',nome);if(fs.existsSync(p))fs.unlinkSync(p);}
const nodi=[{id:'zaino',testo:'Come si usa ZAINO',genere:'radice',livello:0,origine:'utente',nota:'Apri un ramo. Prova le azioni e verifica il risultato nella miniguida.'}],archi=[];
for(const [i,b]of data.entries()){
 const ref={type:'pdf',file:pdf,page:b.page,label:'Miniguida, pagina '+b.page};
 nodi.push({id:b.id,testo:b.title,livello:1,gruppo:i+1,origine:'utente',rimando:ref,nota:b.read});archi.push({da:'zaino',a:b.id,rel:'esplora'});
 const id=b.id+'-prova';nodi.push({id,testo:b.actions[0],livello:2,gruppo:i+1,origine:'utente',nota:b.result,rimando:ref});archi.push({da:b.id,a:id,rel:'prova'});
 if(immagini[b.id]){const id=b.id+'-immagine';nodi.push({id,testo:b.title,livello:2,gruppo:i+1,origine:'utente',rimando:ref,immagine:immagini[b.id]});archi.push({da:b.id,a:id,rel:'guarda'});}
}
ok(M.salva(v,z,'Come si usa ZAINO.json',{titolo:'Come si usa ZAINO',nodi,archi,vista:{motore:'albero',orient:'lr',fsNodo:15,glossario:false,fonti:true,aspetto:{font:'atkinson'}}}));
// Il documento PRESENTA segue il formato validato della versione in uso.
const id='8db7c956-862f-4c25-ab1e-43a6d907a8eb',dir=path.join(base,'PRESENTAZIONI',id);fs.mkdirSync(path.join(dir,'assets'),{recursive:true});
let d=PM.crea(uuid,'Come si usa ZAINO');d.id=id;d.revision=1;d.stacks=[];
const nuovo=()=>crypto.randomUUID();
function slide(b,approfondimento){const s=PM.slide();s.title=approfondimento?'Prova: '+b.title:b.title;s.background='#ffffff';
 const ref='pdf:0001#p='+b.page;
 s.blocks=[{id:nuovo(),type:'title',slot:'title',markdown:s.title,style:{fontFamily:'atkinson',fontSize:46,color:'#16181d',box:{x:6,y:5,width:88,height:15}}},
 {id:nuovo(),type:'text',slot:'body',markdown:approfondimento?b.actions.map((s,i)=>(i+1)+'. '+s).join('\n'):b.read+'\n\n'+b.result,style:{fontFamily:'atkinson',fontSize:25,color:'#16181d',box:{x:6,y:25,width:approfondimento||!immagini[b.id]?88:42,height:53}}},
 {id:nuovo(),type:'text',slot:'body',markdown:'[Miniguida PDF · pagina '+b.page+']('+ref+')',source:{kind:'file',id:pdf,title:'Miniguida ZAINO',link:ref,page:b.page},style:{fontFamily:'atkinson',fontSize:20,color:'#1d4ed8',box:{x:6,y:82,width:70,height:7}}},
 {id:nuovo(),type:'navbar',slot:'body',variant:'steps',scope:'main',orientation:'horizontal',activeZoom:1,style:{fontFamily:'atkinson',fontSize:18,box:{x:6,y:92,width:79,height:6}}},
 {id:nuovo(),type:'page-number',slot:'body',style:{fontFamily:'atkinson',fontSize:18,box:{x:87,y:92,width:7,height:6}}}];
 s.notes.markdown='Prima mostra il tema. Poi invita a provare: '+b.actions[0]+'\nControllo: '+b.result;
 if(!approfondimento&&immagini[b.id]){const bytes=fs.readFileSync(path.join(G,'img/nuova-'+b.shot+'.png')),hash=crypto.createHash('sha256').update(bytes).digest('hex'),asset='a_'+hash,rel='assets/'+hash+'.png';fs.writeFileSync(path.join(dir,rel),bytes);d.assets[asset]={kind:'image',path:rel,mimeType:'image/png',sha256:hash,size:bytes.length,source:{kind:'file',id:pdf,title:b.title,link:ref,page:b.page}};
 s.blocks.push({id:nuovo(),type:'image',slot:'media',assetId:asset,alt:b.title,caption:'Miniguida · p. '+b.page,source:{kind:'file',id:pdf,title:b.title,link:ref,page:b.page},style:{box:{x:51,y:26,width:43,height:51}}});}
 return s;}
for(const b of data)d.stacks.push({id:nuovo(),slides:[slide(b,false),slide(b,true)]});
PM.esigi(d);P.verifica(d,uuid,id);fs.writeFileSync(path.join(dir,'presentazione.json'),JSON.stringify(d,null,2)+'\n');P.verificaRisorse(v,z,d);
const meta={zaino:z,noteFiles,note:data.length,nodi:nodi.length,slide:PM.posizioni(d).length,presentazione:id,pdf};fs.writeFileSync(path.join(v,'demo.json'),JSON.stringify(meta));console.log(meta);
})().catch(e=>{console.error(e);process.exitCode=1});
