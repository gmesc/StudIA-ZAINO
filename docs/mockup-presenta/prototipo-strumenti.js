'use strict';
// Tre scenari interattivi dentro B · Sul foglio, già scelto: scrittura, materiali, stile.
// Solo memoria e dati sintetici. Il prototipo non viene caricato dall'app o dal vault.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'../..'),app=fs.readFileSync(path.join(root,'App/StudIA.html'),'utf8');
const css=app.slice(app.indexOf('<style>')+7,app.indexOf('</style>'));
const html=()=>fs.readFileSync(path.join(__dirname,'prototipo-strumenti.html'),'utf8').replace('/* CSS_ZAINO */',css).replace('/* CSS_ICONE */',fs.readFileSync(path.join(root,'App/assets/comandi.css'),'utf8')).replace('/* ICONE_ZAINO */',fs.readFileSync(path.join(root,'App/assets/interfaccia/icone.js'),'utf8')).replace('/* MODELLO_ZAINO */',fs.readFileSync(path.join(root,'App/assets/presentazioni/testo.js'),'utf8')+'\n'+fs.readFileSync(path.join(root,'App/assets/presentazioni/modello.js'),'utf8')).replace('/* COLORI_ZAINO */',fs.readFileSync(path.join(root,'App/assets/presentazioni/colori.js'),'utf8'));
// Serve soltanto i font inclusi nel prototipo, senza esporre altre cartelle del progetto.
const fontLocali=new Map(fs.readdirSync(path.join(__dirname,'fonts')).filter(nome=>/\.(woff2|otf)$/.test(nome)).map(nome=>['/fonts/'+nome,path.join(__dirname,'fonts',nome)]));
const server=http.createServer((req,res)=>{
 const percorso=new URL(req.url,'http://localhost').pathname;
 if(fontLocali.has(percorso)){
  res.writeHead(200,{'Content-Type':percorso.endsWith('.woff2')?'font/woff2':'font/otf','Cache-Control':'no-store'});
  res.end(fs.readFileSync(fontLocali.get(percorso)));return;
 }
 if(percorso!=='/'){res.writeHead(404);res.end();return;}
 res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end(html());
});
server.listen(Number(process.env.PORT||8773),'127.0.0.1',()=>console.log('Mockup PRESENTA: http://127.0.0.1:'+server.address().port+'/?variant=testo'));
