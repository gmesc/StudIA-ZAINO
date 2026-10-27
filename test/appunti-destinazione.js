'use strict';
// Le operazioni iniziate in un editor conservano quella destinazione anche
// quando un dialogo o un ritaglio lasciano il tempo di lavorare nell'altro.
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const html = fs.readFileSync(process.env.ZAINO_HTML_PROVA || path.join(__dirname, '../App/StudIA.html'), 'utf8');
function funzione(nome) {
  const a = html.indexOf('function ' + nome + '(');
  if (a < 0) return '';
  // Queste funzioni di renderer sono dichiarazioni al livello superiore.
  const b = html.indexOf('\n}', a);
  assert(b > a, nome + ': confine della funzione');
  return html.slice(html.slice(a-6,a)==='async ' ? a-6 : a, b + 2);
}
function stato(file) {
  let body = file;
  return {courseId:'biologia', cur:{file, title:file}, mde:{
    value:()=>body,
    codemirror:{getValue:()=>body, setValue:v=>{body=v;}, getSelection:()=>'',
      replaceSelection:v=>{body+=v;}, getCursor:()=>({line:0,ch:0}), focus(){}}
  }};
}
const primo = stato('primo.md'), secondo = stato('secondo.md');
let attivo = primo, corso = 'biologia', rispondi;
const elementi = new Map();
const $ = id => {
  if (!elementi.has(id)) elementi.set(id, {value:'', innerHTML:'', focus(){},hasAttribute:()=>true});
  return elementi.get(id);
};
const messaggi = [], chiusi = [];
const ctx = {NOTES:primo, noteStatoAttivo:()=>attivo, corsoAttivo:()=>corso,
  mdbChiudi:(_,s)=>chiusi.push(s), toast:t=>messaggi.push(t), $,
  renderNoteMd:t=>t, escHtml:t=>t, noteDove:()=>'',
  MATERIALI:{}, MODO:{zaini:[{id:'biologia',title:'Biologia'},{id:'storia',title:'Storia'}]}, ANTEPRIMA:{tipo:'pdf',file:'01 Botanica.pdf',page:1},
  RimandiSintassi:require('../App/assets/rimandi/sintassi'),
  closePops(){}, popAt(){}, caricaMateriali:()=>Promise.resolve(), disegnaMateriali(){},
  askText:()=>new Promise(r=>{rispondi=r;}), setTimeout:f=>f(),
  EMOJI_A:null, emojiRender(){}, FOTOINS:{},
  PLAYER:{num:'09'}, playerAperto:()=>true, playerPausa(){}, playerSecondo:()=>12,
  Lettore:require('../App/assets/player/lettore'),
  LetturaMisura:require('../App/assets/lettura/misura'),
  fotoInsAzzera(){ctx.FOTOINS={};}};
vm.createContext(ctx);
['noteBersaglio','noteBersaglioValido','inserisciLink','citaPdf','apriMateriali','scegliMateriale',
  'foglioAppunto','openEmojiPop','emojiScelta','insertEmoji','albumMarkdown','fotoSostituisciInserimento','playerAppunta']
  .forEach(n=>vm.runInContext(funzione(n), ctx));

(async()=>{
  ctx.inserisciLink('pagina','pdf:01#p=2',secondo);
  assert.equal(primo.mde.value(),'primo.md','una citazione esplicita nel secondo non tocca il primo');
  assert(secondo.mde.value().includes('[pagina](pdf:01#p=2)'));
  attivo=secondo;
  ctx.inserisciLink('altra','pdf:01#p=3');
  assert(secondo.mde.value().includes('[altra](pdf:01#p=3)'),'il comando globale segue il fuoco');
  assert.equal(ctx.foglioAppunto(secondo).html,secondo.mde.value(),'anche la stampa legge il secondo');
  assert.equal(chiusi.at(-1),secondo,'la stampa consolida l’anteprima giusta');

  // Si esegue la preparazione reale: il renderer cattura il destinatario prima
  // dell'IPC e apre l'anteprima; nessun link viene ancora scritto nell'appunto.
  let fontePronta,richiesta,anteprima;
  ctx.window={vault:{citazioni:{crea:(...args)=>{richiesta=args;return new Promise(r=>{fontePronta=r;});}}}};
  ctx.citazioneZainoApri=(r,b)=>{anteprima={rimando:r,dest:b};};
  const ui=fs.readFileSync(path.join(__dirname,'../App/assets/rimandi/citazioni-ui.js'),'utf8');
  const da=ui.indexOf(' window.citazionePrepara=async function'),a=ui.indexOf('async function',da),fine=ui.indexOf('\n };',a);
  vm.runInContext('citazionePrepara='+ui.slice(a,fine+4),ctx);
  ctx.apriMateriali(null,secondo);ctx.scegliMateriale('01 Botanica.pdf','pdf','01');
  assert.deepEqual(richiesta,['biologia','01 Botanica.pdf',1,'']);
  const corpoPrima=secondo.mde.value();attivo=primo;fontePronta({rimando:'RIMANDO_PDF'});await new Promise(setImmediate);
  assert.equal(anteprima.dest.stato,secondo);assert.equal(secondo.mde.value(),corpoPrima,'nessun inserimento prima della scelta in anteprima');
  anteprima=null;ctx.apriMateriali(null,secondo);ctx.scegliMateriale('01 Botanica.pdf','pdf','01');
  secondo.cur={file:'cambiato.md'};fontePronta({rimando:'VECCHIO_DESTINATARIO'});await new Promise(setImmediate);
  assert.equal(anteprima,null,'cambio documento annulla la preparazione');assert(messaggi.at(-1).includes('destinazione è cambiato'));
  ctx.apriMateriali(null,secondo);ctx.MATERIALI.zaino='storia';ctx.scegliMateriale('01 Fonte esterna.pdf','pdf','01');
  assert.deepEqual(richiesta,['storia','01 Fonte esterna.pdf',1,'']);attivo=primo;fontePronta({rimando:'ALTRO_ZAINO'});await new Promise(setImmediate);
  assert.equal(anteprima.dest.stato,secondo);assert.equal(anteprima.rimando,'ALTRO_ZAINO');assert.equal(primo.mde.value(),'primo.md');

  attivo=secondo;ctx.openEmojiPop(null);attivo=primo;ctx.emojiScelta('🌱');
  assert(secondo.mde.value().includes('🌱'));assert(!primo.mde.value().includes('🌱'));
  attivo=secondo;ctx.openEmojiPop(null);corso='storia';ctx.emojiScelta('🌻');
  assert(!secondo.mde.value().includes('🌻'),'un menu vecchio non scrive dopo il cambio zaino');

  corso='biologia';attivo=primo;
  const foto={id:'foto-uno',didascalia:'Schema'}, nuova={id:'ritaglio-uno',da:'foto-uno'};
  const testo=ctx.albumMarkdown(foto);secondo.mde.codemirror.setValue(testo);
  ctx.FOTOINS={dove:'appunto',foto:foto.id,testo,appunto:ctx.noteBersaglio(secondo)};
  assert.equal(ctx.fotoSostituisciInserimento(nuova),true);
  assert(secondo.mde.value().includes('album:ritaglio-uno'),'il ritaglio sostituisce l’immagine nel documento iniziale');
  assert.equal(primo.mde.value(),'primo.md');

  attivo=secondo;secondo.cur=null;
  ctx.noteNew=()=>new Promise(r=>{rispondi=r;});
  let attesa=ctx.playerAppunta();attivo=primo;
  secondo.cur={file:'dal-player.md'};rispondi(false);await attesa;
  assert(!secondo.mde.value().includes('video:'),'annullare il titolo non inserisce la citazione');
  attivo=secondo;secondo.cur=null;attesa=ctx.playerAppunta();attivo=primo;
  ctx.PLAYER.num='10';secondo.cur={file:'dal-player.md'};rispondi(true);await attesa;
  assert(secondo.mde.value().includes('video:09#t=12'),'il minuto conserva editor e media scelti prima del titolo');
  assert.equal(primo.mde.value(),'primo.md');assert.equal(chiusi.at(-1),secondo);
  console.log('✓ destinazione appunti: citazioni, dialoghi, stampa, emoji, ritagli e player fra due editor');
})().catch(e=>{console.error(e);process.exitCode=1;});
