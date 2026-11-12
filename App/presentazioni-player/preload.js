'use strict';
const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('presentaPubblico',{
 fonte:o=>ipcRenderer.invoke('presenta:player',{...o,azione:'fonte'}),
 chiudiFonte:o=>ipcRenderer.invoke('presenta:player',{...o,azione:'chiudiFonte'}),
 esci:()=>ipcRenderer.invoke('presenta:player',{azione:'esci'}),
 onEscape:fn=>{const h=()=>fn();ipcRenderer.on('presenta:escape',h);return ()=>ipcRenderer.removeListener('presenta:escape',h);},
 pronto:()=>ipcRenderer.invoke('presenta:player',{azione:'pronto'}),
 conferma:o=>ipcRenderer.invoke('presenta:player',{...o,azione:'conferma'}),
 onComando:fn=>{const h=(_e,o)=>fn(o);ipcRenderer.on('presenta:player-comando',h);return ()=>ipcRenderer.removeListener('presenta:player-comando',h);}
});
