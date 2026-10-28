'use strict';
const {contextBridge,ipcRenderer}=require('electron');
function ascolta(canale,fn){const h=(_e,d)=>fn(d);ipcRenderer.on(canale,h);return ()=>ipcRenderer.removeListener(canale,h);}
contextBridge.exposeInMainWorld('proiezione',{
 quadro:fn=>ascolta('proiezione:quadro',fn),schermi:fn=>ascolta('proiezione:schermi',fn),intero:fn=>ascolta('proiezione:intero',fn),
 comando:o=>ipcRenderer.invoke('proiezione:comando',o)
});
