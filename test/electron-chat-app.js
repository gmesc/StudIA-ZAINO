'use strict';
// Esemplare di prova: i provider sono simulati prima di caricare il main.
// Nessuna variabile d'ambiente o opzione di produzione abilita questi adattatori.
const provider = require('../lib/chat-provider');
const fs = require('fs'), path = require('path');
const { app, dialog } = require('electron');
const registra = (nome, dati) => fs.appendFileSync(path.join(app.getPath('userData'), nome), JSON.stringify(dati) + '\n');
const apriDialogo = dialog.showOpenDialog.bind(dialog);
dialog.showOpenDialog = async (opzioni) => {
  if (opzioni.buttonLabel !== 'Importa cartelle') return apriDialogo(opzioni);
  registra('cartelle-dialogo.jsonl', opzioni);
  const scelta = path.join(app.getPath('userData'), 'cartelle-pick.json');
  return { canceled: !fs.existsSync(scelta), filePaths: fs.existsSync(scelta) ? JSON.parse(fs.readFileSync(scelta)) : [] };
};
provider.modelli = async () => [{id:'modello-locale-di-prova',nome:'Modello locale di prova'}];
provider.rispondi = async ({messages,signal,system}) => {
  const ultimo=messages.at(-1).content;
  registra('chat-requests.jsonl', { messages, system });
  let strutturata;try{strutturata=JSON.parse(messages[0].content);}catch(_){}
  if(strutturata?.porzioni)return {text:JSON.stringify({items:[{title:'Energia cellulare',text:'La fonte descrive energia e cellule.\n- Concetti: energia.\n- Prerequisiti: cellule.\nEsempi: ATP.',refs:[strutturata.porzioni[0].chunkId]}]})};
  if(strutturata?.proofs && strutturata.topic)return {text:JSON.stringify({question:'Quale processo converte la luce?',answer:'La fotosintesi.',rubric:['Nomina la fotosintesi.'],hint:'Pensa alle piante.',refs:[strutturata.proofs[0].chunkId]})};
  if(strutturata?.expected)return {text:JSON.stringify({correct:['Hai nominato la fotosintesi.'],missing:[],contradictory:[],summary:'Il tentativo è coerente con la fonte.',assessable:true})};
  if(ultimo.startsWith('Risposta lenta')) await new Promise((resolve,reject)=>{
    const timer=setTimeout(resolve,10000);
    const cancel=()=>{clearTimeout(timer);reject(new Error('Risposta interrotta.'));};
    if(signal.aborted)cancel();else signal.addEventListener('abort',cancel,{once:true});
  });
  if(ultimo.startsWith('Prova citazione')) return {text:'Il passaggio citato è `[MATERIALI/PDF/01 Botanica.pdf, p. 1]`. Seconda pagina `[MATERIALI/PDF/01 Botanica.pdf, p. 2]`. Alias inventato [S999].'};
  return {text:'La **fotosintesi** permette alle piante di trasformare la luce solare in energia chimica. La clorofilla assorbe energia luminosa.\n\nQuale parte di questo passaggio vuoi approfondire?'};
};
// Il click TTS attraversa il ponte reale; l'adattatore produce audio silenzioso
// e registra il testo, senza chiamare servizi vocali o suonare durante la prova.
const voce = require('../lib/voce');
voce.elenco = () => [{nome:'Alice',lingua:'it-IT'}];
voce.rendi = async (testo, nome, opts) => {
  registra('voce-requests.jsonl', { testo, nome });
  const wav = Buffer.alloc(16044);
  wav.write('RIFF'); wav.writeUInt32LE(wav.length-8,4); wav.write('WAVEfmt ',8);
  wav.writeUInt32LE(16,16); wav.writeUInt16LE(1,20); wav.writeUInt16LE(1,22);
  wav.writeUInt32LE(8000,24); wav.writeUInt32LE(16000,28); wav.writeUInt16LE(2,32); wav.writeUInt16LE(16,34);
  wav.write('data',36); wav.writeUInt32LE(wav.length-44,40); fs.writeFileSync(opts.file,wav);
  return {ok:true,file:opts.file};
};
global.fetch=async()=>{throw new Error('Rete disabilitata nella prova UI.');};
require('../main');
