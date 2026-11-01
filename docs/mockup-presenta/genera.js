'use strict';
// Legge il CSS e monta l'editor vero con dati sintetici, prima dell'innesto nel Banco.
const fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url'),M=require('../../App/assets/presentazioni/modello'),C=require('../../App/assets/presentazioni/reveal-adapter');
const root=path.join(__dirname,'../..'),app=fs.readFileSync(path.join(root,'App/StudIA.html'),'utf8'),css=app.slice(app.indexOf('<style>')+7,app.indexOf('</style>'));
let d=M.crea('00000000-0000-4000-8000-000000000001','La fotosintesi');d.revision=1;const sid=d.stacks[0].slides[0].id;
d=M.applica(d,{tipo:'titoloSlide',slideId:sid,title:'Una foglia al sole'});d=M.applica(d,{tipo:'inserisciBlocco',slideId:sid,block:{type:'text',slot:'body',markdown:'La pianta trasforma la luce in energia.\n\n- Entrano acqua e anidride carbonica.\n- Esce ossigeno.'}});d.stacks[0].slides[0].notes.markdown='Chiedere alla classe: che cosa serve a una pianta per crescere?';
const json=o=>JSON.stringify(o).replace(/</g,'\\u003c');
function genera(frameUrl,dest){
if(!/^presenta:\/\//.test(frameUrl))throw Error('Avvia il mockup con Electron: docs/mockup-presenta/avvia.js');
fs.writeFileSync(dest,'<!doctype html><html lang="it"><head><meta charset="utf-8"><base href="'+pathToFileURL(path.join(root,'App/')).href+'"><style>'+css+'\nbody{display:block;overflow:auto}#demo{height:95vh;display:grid;grid-template-columns:2fr 1fr}#presentaPane{border-right:1px solid var(--line)}</style><link rel="stylesheet" href="assets/presentazioni/editor.css"></head><body><div id="demo"><section id="presentaPane"></section><section id="gobboPane"></section></div><script src="assets/interfaccia/icone.js"></script><script src="assets/presentazioni/testo.js"></script><script src="assets/presentazioni/modello.js"></script><script src="assets/presentazioni/colori.js"></script><script src="assets/presentazioni/documento.js"></script><script>let documento='+json(d)+';window.zainoAttivo=()=>"demo";window.bancoVisibile=()=>true;window.bancoAggiornaDocumenti=()=>{};window.toast=console.log;window.vault={presentazioni:{onCambiata:()=>{},onSessione:()=>{},onChiudi:()=>{},comando:async o=>o.azione==="frame"?{ok:true,url:'+json(frameUrl)+'}:o.azione==="elenco"?{ok:true,elenco:[{id:documento.id,title:documento.title}]}:o.azione==="vista"?{ok:true,documento:'+json(C.compila(d))+'}:{ok:true,documento}}};localStorage.setItem("studia.presenta.demo",JSON.stringify({id:documento.id}));</script><script src="assets/presentazioni/editor.js"></script></body></html>');
return dest;
}
module.exports={genera};
