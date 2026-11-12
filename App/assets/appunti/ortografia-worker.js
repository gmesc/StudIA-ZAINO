import {loadModule} from 'hunspell-asm';
const fabbrica=loadModule({timeout:10000});
const dizionari = new Map(),risorse=new Map();
async function dizionario(lingua) {
  if (!dizionari.has(lingua)) dizionari.set(lingua, Promise.all(['aff','dic'].map(async ext => {
    if(risorse.has(lingua))return new Uint8Array(risorse.get(lingua)[ext]);
    const risposta = await fetch(new URL('dizionari/'+lingua+'.'+ext, self.location.href));
    if (!risposta.ok) throw Error('Dizionario non disponibile');
    return new Uint8Array(await risposta.arrayBuffer());
  })).then(async ([aff,dic]) => {const f=await fabbrica;const a=f.mountBuffer(aff),d=f.mountBuffer(dic);try{return f.create(a,d);}finally{f.unmount(a);f.unmount(d);}}));
  return dizionari.get(lingua);
}
self.onmessage = async ({data}) => {
  try {
    for(const d of data.dizionari||[])if(['fr','de','es'].includes(d.id)&&d.aff?.byteLength<=3000000&&d.dic?.byteLength<=10000000)risorse.set(d.id,d);
    const lingue = String(data.lingua).split('-');
    if (lingue.length>2||!lingue.every(l => ['it','en','fr','de','es'].includes(l))||(lingue.length===2&&(lingue[0]!=='it'||lingue[1]==='it'))) throw Error('Lingua non valida');
    const motori = await Promise.all(lingue.map(dizionario));
    const corretta = parola => motori.some(m => m.spell(parola.replaceAll("’", "'")));
    const risultato = data.parola ? (corretta(data.parola) ? [] : [...new Set(motori.flatMap(m => m.suggest(data.parola.replaceAll("’", "\'"))))].slice(0,8)) : data.parole.filter(p => !corretta(p));
    self.postMessage({id:data.id,risultato});
  } catch(e) { for(const l of String(data.lingua).split('-'))dizionari.delete(l);self.postMessage({id:data.id,errore:e.message}); }
};
