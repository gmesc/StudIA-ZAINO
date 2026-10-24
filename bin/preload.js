'use strict';
// Le funzioni ponte restano definite nei moduli IPC; il preload sandbox non
// può richiederli a runtime. Si incorporano qui senza introdurre un bundler.
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname,'..');
function genera() {
  const sorgente=fs.readFileSync(path.join(root,'preload-base.js'),'utf8');
  const ponti=['chat','rag','studio'].map(nome=>{
    const ponte=require(path.join(root,'lib',nome+'-ipc')).ponte;
    return 'vaultApi.'+nome+' = ('+ponte.toString()+')(ipcRenderer);';
  }).join('\n');
  return '// GENERATO da preload-base.js e lib/*-ipc.js: node bin/preload.js\n'+sorgente.replace('/* PONTI_GENERATI */',ponti);
}
if(require.main===module) fs.writeFileSync(path.join(root,'preload.js'),genera());
module.exports={genera};
