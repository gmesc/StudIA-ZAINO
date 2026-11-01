'use strict';
// Solo dati sintetici; nessuna configurazione, installazione o cartella personale.
const {app,BrowserWindow,protocol,net}=require('electron'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const V=require('../../lib/presentazioni-vista'),tmp=fs.mkdtempSync(path.join(os.tmpdir(),'zaino-presenta-mockup-'));
V.registra(protocol);app.setPath('userData',path.join(tmp,'profilo'));
app.whenReady().then(async()=>{
 const win=new BrowserWindow({width:1400,height:900,show:false,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false,webSecurity:true}});
 const frame=V.frame({session:win.webContents.session,net,appDir:path.resolve(__dirname,'../../App')});
 const file=require('./genera').genera(frame.url,path.join(tmp,'index.html'));await win.loadFile(file);win.show();
});
app.on('window-all-closed',()=>app.quit());app.on('will-quit',()=>fs.rmSync(tmp,{recursive:true,force:true}));
