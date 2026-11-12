'use strict';
const {app,BrowserWindow}=require('electron'),assert=require('node:assert/strict'),path=require('node:path');
app.whenReady().then(async()=>{
 const w=new BrowserWindow({show:false,width:1080,height:900,webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true}});
 try{
  await w.loadFile(path.join(__dirname,'demo.html'));
  const val=s=>w.webContents.executeJavaScript(s);
  assert(await val("!!window.LaboratorioAppunti&&!!document.querySelector('.tiptap h1')"));
  const prima=await val('LaboratorioAppunti.editor.getMarkdown()');
  await val("LaboratorioAppunti.editor.commands.focus('start')");
  await new Promise(r=>setTimeout(r,100));
  await w.webContents.insertText('Nuova ');
  await new Promise(r=>setTimeout(r,100));
  assert((await val('LaboratorioAppunti.editor.getMarkdown()')).includes('Nuova Biologia'));
  await val('LaboratorioAppunti.editor.commands.undo()');assert.equal(await val('LaboratorioAppunti.editor.getMarkdown()'),prima);
  const speciali=await val('LaboratorioAppunti.esempi[0].slice(1)');
  for(const testo of speciali)assert(prima.includes(testo));
  await val("LaboratorioAppunti.editor.commands.insertContent('X');LaboratorioAppunti.apri(1)");
  assert(!(await val('LaboratorioAppunti.editor.getMarkdown()')).includes('Biologia'));
  assert.equal(await val('LaboratorioAppunti.editor.can().undo()'),false,'nuovo appunto: niente undo del precedente');
  await val('LaboratorioAppunti.apri(0)');assert((await val('LaboratorioAppunti.editor.getMarkdown()')).includes('XBiologia'));
  const shot=await w.webContents.capturePage();require('node:fs').writeFileSync('/private/tmp/zaino-editor-tiptap-prototipo.png',shot.toPNG());
  console.log('✓ Prototipo Tiptap: digitazione, Undo, due documenti isolati e conservazione dei campioni ZAINO');
 }catch(e){console.error(e);process.exitCode=1;}finally{w.destroy();app.exit(process.exitCode||0);}
});
