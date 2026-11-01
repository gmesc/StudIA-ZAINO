'use strict';
const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('presentaPubblico',{
 pronto:()=>ipcRenderer.invoke('presenta:player',{azione:'pronto'}),
 conferma:o=>ipcRenderer.invoke('presenta:player',{...o,azione:'conferma'}),
 onComando:fn=>{const h=(_e,o)=>fn(o);ipcRenderer.on('presenta:player-comando',h);return ()=>ipcRenderer.removeListener('presenta:player-comando',h);}
});
