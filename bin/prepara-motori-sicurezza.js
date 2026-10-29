#!/usr/bin/env node
'use strict';
// Si esegue sulla macchina di build, mai sul computer dell'utente. Nessun installer PKG/MSI viene avviato.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const {gzipSync}=require('node:zlib');
const ROOT=path.resolve(__dirname,'..');
const Q='https://github.com/qpdf/qpdf/releases/download/v12.4.2/';
const C='https://github.com/Cisco-Talos/clamav/releases/download/clamav-1.5.4/';
const DOWNLOAD={
 'qpdf-darwin-arm64':['qpdf-12.4.2-bin-macos-arm64.zip',Q,'62e46987a30ea167cbc530ccb22690aec3d8c812ed09979a941bcee92e504b79'],
 'qpdf-darwin-x64':['qpdf-12.4.2-bin-macos-x86_64.zip',Q,'dd3b01f4414d198529bb0f13bba59c2f016a328bb3506695087a96fb80fc1481'],
 'qpdf-win32-x64':['qpdf-12.4.2-msvc64.zip',Q,'db87077e683630c1217e0e8f9a20a9749d952ab676e881c3689187763a5de25d'],
 'clamav-darwin':['clamav-1.5.4.macos.universal.pkg',C,'df7fa753e2f9f67f3bc99b2a40a3be7ef559088c68ad6bdf66b4b5764e965bd6'],
 'clamav-win32-x64':['clamav-1.5.4.win.x64.zip',C,'0d9e0228b2674137ea1a2853566c98a0278ad52ab2582c3d6dbd75373848c395'],
 'clamav-linux-x64':['clamav-1.5.4.linux.x86_64.deb',C,'28d6efc5b4423e7830c3559339552eb53870a9eac51ac4efb37d60530d329886'],
 'qpdf-sorgenti':['qpdf-12.4.2.tar.gz',Q,'8a58af5b6141319287c1883bec8bd1bd545b7567b7fc5e6ce5d25a1c85f36397'],
 'clamav-sorgenti':['clamav-1.5.4.tar.gz',C,'1af1117a228f1b5bc7fa91a0dabc37848a99e7d25188e9be8043332ce721dfd3']
};
const digest=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
function comando(bin,args,timeout=180000){return execFileSync(bin,args,{encoding:'utf8',maxBuffer:8*1024*1024,timeout});}
function elenco(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?elenco(path.join(dir,e.name)):[path.join(dir,e.name)]);}
function copia(src,dst,radice){
 const reale=fs.realpathSync(src),rel=path.relative(fs.realpathSync(radice),reale);
 if(rel.startsWith('..')||path.isAbsolute(rel)||!fs.statSync(reale).isFile())throw Error('File estratto fuori dal pacchetto: '+src);
 fs.mkdirSync(path.dirname(dst),{recursive:true});fs.copyFileSync(reale,dst);fs.chmodSync(dst,fs.statSync(reale).mode&0o777);
}
async function scarica(spec,cache){
 const[nome,base,sha]=spec,finale=path.join(cache,nome);fs.mkdirSync(cache,{recursive:true});
 if(fs.existsSync(finale)&&digest(finale)===sha)return finale;
 const tmp=finale+'.part';console.log('Download '+nome);
 const r=await fetch(base+nome,{signal:AbortSignal.timeout(15*60*1000)});if(!r.ok)throw Error('Download HTTP '+r.status+': '+nome);
 const fd=fs.openSync(tmp,'w',0o600);let n=0;
 try{for await(const b of r.body){n+=b.length;if(n>1024*1024*1024)throw Error('Download troppo grande.');fs.writeSync(fd,b);}}finally{fs.closeSync(fd);}
 if(digest(tmp)!==sha){fs.rmSync(tmp);throw Error('SHA-256 non valido: '+nome);}
 fs.renameSync(tmp,finale);return finale;
}
function estrai(archivio,dest){
 fs.mkdirSync(dest,{recursive:true});
 // Gli archivi sono già confrontati con gli hash della release; controlliamo anche i percorsi.
 const nomi=comando(process.platform==='win32'?'tar':'/usr/bin/tar',['-tf',archivio]).split(/\r?\n/).filter(Boolean);
 if(nomi.some(n=>n.startsWith('/')||n.includes('\\')||n.split('/').includes('..')||/^[A-Za-z]:/.test(n)))throw Error('Percorso non valido nell’archivio.');
 comando(process.platform==='win32'?'tar':'/usr/bin/tar',['-xf',archivio,'-C',dest]);
}
function firmaMac(base){
 const files=elenco(base).filter(f=>f.endsWith('.dylib')||path.dirname(f)===path.join(base,'bin'));
 for(const f of files){
  const rpath=path.dirname(f)===path.join(base,'bin')?'@executable_path/../lib':'@loader_path';
  const output=comando('/usr/bin/otool',['-l',f]);
  const presenti=[...output.matchAll(/cmd LC_RPATH\s+cmdsize \d+\s+path ([^\n]+) \(offset/g)].map(m=>m[1]);
  for(const vecchio of new Set(presenti))if(vecchio!==rpath)comando('/usr/bin/install_name_tool',['-delete_rpath',vecchio,f]);
  if(!presenti.includes(rpath))comando('/usr/bin/install_name_tool',['-add_rpath',rpath,f]);
  const deps=comando('/usr/bin/otool',['-L',f]);
  for(const riga of deps.split('\n').filter(l=>l.startsWith('\t'))){const d=riga.trim().split(' (')[0];if(!(d.startsWith('/usr/lib/')||d.startsWith('/System/Library/')||d.startsWith('@rpath/')||d.startsWith('@loader_path/')))throw Error('Dipendenza non portabile: '+d);}
  comando('/usr/bin/codesign',['--force','--sign','-','--timestamp=none',f]);
 }
}
async function prepara({piattaforma=process.platform,architettura=process.arch,cache=path.join(ROOT,'build','sicurezza-download'),destinazione=path.join(ROOT,'build','sicurezza-pacchetti')}={}){
 const target=piattaforma+'-'+architettura;
 if(!['darwin-arm64','darwin-x64','win32-x64','linux-x64'].includes(target))throw Error('Target dei motori non supportato: '+target);
 if(piattaforma==='darwin'&&process.platform!=='darwin')throw Error('I pacchetti macOS si preparano su macOS per relocare e firmare i binari.');
 const lavoro=fs.mkdtempSync(path.join(os.tmpdir(),'zaino-pacchetti-'));
 try{for(const id of ['qpdf','clamav']){
  const spec=DOWNLOAD[piattaforma==='linux'&&id==='qpdf'?'qpdf-sorgenti':id+'-'+(id==='clamav'&&piattaforma==='darwin'?'darwin':target)];
  const archivio=await scarica(spec,cache),sorgenti=await scarica(DOWNLOAD[id+'-sorgenti'],cache);
  const base=path.join(lavoro,id),out=path.join(destinazione,target,id),src=path.join(lavoro,id+'-sorgenti');
  fs.mkdirSync(out,{recursive:true});if(fs.readdirSync(out).length)fs.rmSync(out,{recursive:true});fs.mkdirSync(out,{recursive:true});
  estrai(sorgenti,src);
  if(piattaforma==='linux'){
   if(process.platform!=='linux')throw Error('Il pacchetto Debian si prepara su Linux.');
   if(id==='qpdf'){
    // Compilare sulla distribuzione di destinazione evita di spedire librerie di un'altra distro.
    const fonte=fs.readdirSync(src,{withFileTypes:true}).find(e=>e.isDirectory());
    const build=path.join(base,'build');
    comando('cmake',['-S',path.join(src,fonte.name),'-B',build,'-DCMAKE_BUILD_TYPE=Release','-DBUILD_SHARED_LIBS=OFF','-DBUILD_STATIC_LIBS=ON','-DBUILD_DOC=OFF','-DREQUIRE_CRYPTO_OPENSSL=ON']);
    comando('cmake',['--build',build,'--target','qpdf','--parallel','2'],600000);
    copia(path.join(build,'qpdf','qpdf'),path.join(out,'bin','qpdf'),base);
   }else{
    comando('dpkg-deb',['-x',archivio,base]);const prefix=path.join(base,'usr','local');
    copia(path.join(prefix,'etc','certs','clamav.crt'),path.join(out,'etc','certs','clamav.crt'),base);
    for(const nome of ['clamscan','freshclam','sigtool'])copia(path.join(prefix,'bin',nome),path.join(out,'bin',nome),base);
    for(const nome of fs.readdirSync(path.join(prefix,'lib')).filter(n=>/^lib(clamav|clammspack|freshclam)\.so/.test(n)))copia(path.join(prefix,'lib',nome),path.join(out,'lib',nome),base);
    for(const f of elenco(out).filter(f=>f.includes(path.sep+'bin'+path.sep)||/\.so(?:\.|$)/.test(f)))comando('patchelf',['--set-rpath',f.includes(path.sep+'bin'+path.sep)?'$ORIGIN/../lib':'$ORIGIN',f]);
   }
  }else if(piattaforma==='darwin'&&id==='clamav'){
   comando('/usr/sbin/pkgutil',['--expand-full',archivio,base]);
   const bin=path.join(base,'clamav-1.5.4.macos.universal-programs.pkg','Payload','usr','local','clamav');
   const lib=path.join(base,'clamav-1.5.4.macos.universal-libraries.pkg','Payload','usr','local','clamav','lib');
   copia(path.join(bin,'etc','certs','clamav.crt'),path.join(out,'etc','certs','clamav.crt'),base);
   for(const nome of ['clamscan','freshclam','sigtool'])copia(path.join(bin,'bin',nome),path.join(out,'bin',nome),base);
   // Escludiamo intenzionalmente unrar e gli eseguibili di servizio: la scansione richiesta è PDF.
   for(const nome of ['libclamav.12.dylib','libclammspack.0.dylib','libfreshclam.4.dylib'])copia(path.join(lib,nome),path.join(out,'lib',nome),base);
   copia(path.join(base,'Resources','License.txt'),path.join(out,'licenze','ClamAV-PKG.txt'),base);
  }else{
   estrai(archivio,base);
   const eseguibili=elenco(base),nome=id==='qpdf'?'qpdf':'clamscan';
   const exe=eseguibili.find(f=>path.basename(f)===nome+(piattaforma==='win32'?'.exe':''));if(!exe)throw Error('Eseguibile assente: '+id);
   if(piattaforma==='darwin'){
    copia(exe,path.join(out,'bin','qpdf'),base);
    for(const f of eseguibili.filter(f=>/libqpdf\.30\.dylib$/.test(f)))copia(f,path.join(out,'lib',path.basename(f)),base);
   }else{
    const dir=path.dirname(exe);
    if(id==='clamav'){const cert=eseguibili.find(f=>path.basename(f)==='clamav.crt');if(!cert)throw Error('Certificato ClamAV mancante.');copia(cert,path.join(out,'etc','certs','clamav.crt'),base);}
    for(const f of eseguibili.filter(f=>path.dirname(f)===dir&&(/\.dll$/i.test(f)||[id==='qpdf'?'qpdf.exe':'clamscan.exe','freshclam.exe','sigtool.exe'].includes(path.basename(f))))){
     if(/unrar/i.test(f))continue;copia(f,path.join(out,'bin',path.basename(f)),base);
    }
    for(const f of eseguibili.filter(f=>/(license|copying|notice)/i.test(path.basename(f))))copia(f,path.join(out,'licenze','binari-'+path.basename(f)),base);
   }
  }
  // Conserva anche gli avvisi delle dipendenze native presenti nell'archivio ufficiale.
  if(fs.existsSync(base))for(const f of elenco(base).filter(f=>/(license|copying|notice)/i.test(path.basename(f))))if(fs.lstatSync(f).isFile())copia(f,path.join(out,'licenze','upstream',path.relative(base,f)),base);
  const fonteDir=fs.readdirSync(src,{withFileTypes:true}).find(e=>e.isDirectory());const fonte=fonteDir?path.join(src,fonteDir.name):src;
  for(const f of fs.readdirSync(fonte).filter(f=>/^(license|copying|notice)/i.test(f)))if(fs.statSync(path.join(fonte,f)).isFile())copia(path.join(fonte,f),path.join(out,'licenze',f),src);
  fs.mkdirSync(path.join(out,'sorgenti'),{recursive:true});fs.copyFileSync(__filename,path.join(out,'sorgenti','ricetta-zaino.js'));fs.copyFileSync(sorgenti,path.join(out,'sorgenti',path.basename(sorgenti)));
  fs.writeFileSync(path.join(out,'sorgenti','PROVENIENZA.json'),JSON.stringify({binario:{url:spec[1]+spec[0],sha256:spec[2]},sorgenti:{url:DOWNLOAD[id+'-sorgenti'][1]+DOWNLOAD[id+'-sorgenti'][0],sha256:DOWNLOAD[id+'-sorgenti'][2]},modifiche:piattaforma==='darwin'?'Selezione dei soli programmi necessari; librerie senza symlink; rpath relativo e firma ad hoc. Il codice sorgente non è modificato.':'Selezione degli eseguibili e DLL necessari, senza unrar. Il codice sorgente non è modificato.',ricetta:'bin/prepara-motori-sicurezza.js nella distribuzione sorgente di ZAINO.'},null,2)+'\n');
  if(piattaforma==='darwin')firmaMac(out);
  const comandi=Object.fromEntries((id==='qpdf'?['qpdf']:['clamscan','freshclam','sigtool']).map(n=>[n,'bin/'+n+(piattaforma==='win32'?'.exe':'')]));
  if(piattaforma===process.platform&&architettura===process.arch)for(const c of Object.values(comandi))console.log(comando(path.join(out,c),c.includes('freshclam')?['--config-file='+ (process.platform==='win32'?'NUL':'/dev/null'),'--version']:['--version']).split('\n')[0]);
  const files=elenco(out).sort().map(f=>({nome:path.relative(out,f).split(path.sep).join('/'),dimensione:fs.statSync(f).size,sha256:digest(f),eseguibile:Object.values(comandi).some(c=>path.join(out,c)===f)}));
  // I binari compressi non vengono rifirmati/modificati da electron-builder: gli hash restano validi.
  for(const f of files.filter(f=>f.eseguibile||/(\.(dylib|dll)$|\.so(?:\.|$))/i.test(f.nome))){const originale=path.join(out,f.nome);f.origine='payload/'+f.nome+'.gz';const compresso=path.join(out,f.origine);fs.mkdirSync(path.dirname(compresso),{recursive:true});fs.writeFileSync(compresso,gzipSync(fs.readFileSync(originale)));f.dimensioneOrigine=fs.statSync(compresso).size;f.sha256Origine=digest(compresso);fs.rmSync(originale);}
  fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify({formato:1,id,nome:id==='qpdf'?'qpdf':'ClamAV',versione:id==='qpdf'?'12.4.2':'1.5.4',piattaforma,architettura,comandi,files},null,2)+'\n');

  console.log('Preparato '+target+'/'+id);
 }}finally{fs.rmSync(lavoro,{recursive:true,force:true});}
}
function verificaTarget(piattaforma,architettura){
 const risorse=path.join(ROOT,'build');const {crea}=require('../lib/sicurezza-installazione');
 try{crea({radice:path.join(os.tmpdir(),'zaino-verifica-build'),risorse,piattaforma,architettura}).verificaPacchetti();}
 catch(e){throw Error('Pacchetti di sicurezza assenti/non validi per '+piattaforma+'-'+architettura+': '+e.message+'. Esegui npm run sicurezza:prepara -- --piattaforma '+piattaforma+' --arch '+architettura+'.');}
}
module.exports={prepara,verificaTarget,DOWNLOAD};
if(require.main===module){
 const args=process.argv.slice(2),leggi=(k,d)=>args.includes(k)?args[args.indexOf(k)+1]:d;
 const op={piattaforma:leggi('--piattaforma',process.platform),architettura:leggi('--arch',process.arch),cache:leggi('--cache',undefined)};
 Promise.resolve(args.includes('--verifica')?verificaTarget(op.piattaforma,op.architettura):prepara(op)).catch(e=>{console.error(e.message);process.exitCode=1;});
}
