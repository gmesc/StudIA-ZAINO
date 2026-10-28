'use strict';
const {contextBridge,ipcRenderer}=require('electron');
function ascolta(canale,fn){const h=(_e,d)=>fn(d);ipcRenderer.on(canale,h);return ()=>ipcRenderer.removeListener(canale,h);}
contextBridge.exposeInMainWorld('proiezione',{
 lim:{comando:o=>ipcRenderer.invoke('lim:comando',o),flush:o=>ipcRenderer.sendSync('lim:flush',o),onCambiata:fn=>ascolta('lim:cambiata',fn)},
 lavagna:fn=>ascolta('proiezione:lavagna',fn),
 quadro:fn=>ascolta('proiezione:quadro',fn),schermi:fn=>ascolta('proiezione:schermi',fn),intero:fn=>ascolta('proiezione:intero',fn),
 comando:o=>ipcRenderer.invoke('proiezione:comando',o)
});
