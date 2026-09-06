'use strict';
// Esemplare di prova: i provider sono simulati prima di caricare il main.
// Nessuna variabile d'ambiente o opzione di produzione abilita questi adattatori.
const provider = require('../lib/chat-provider');
const fs = require('fs'), path = require('path');
const { app } = require('electron');
const registra = (nome, dati) => fs.appendFileSync(path.join(app.getPath('userData'), nome), JSON.stringify(dati) + '\n');
provider.modelli = async () => [{id:'modello-locale-di-prova',nome:'Modello locale di prova'}];
provider.rispondi = async ({messages,signal,system}) => {
  const ultimo=messages.at(-1).content;
  registra('chat-requests.jsonl', { messages, system });
  if(ultimo.startsWith('Risposta lenta')) await new Promise((resolve,reject)=>{
    const timer=setTimeout(resolve,10000);
    const cancel=()=>{clearTimeout(timer);reject(new Error('Risposta interrotta.'));};
    if(signal.aborted)cancel();else signal.addEventListener('abort',cancel,{once:true});
  });
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
