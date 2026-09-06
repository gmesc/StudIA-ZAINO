#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
LAVORO=$(mktemp -d /tmp/studia-zaino-prova-XXXXXX)
PORTA=${STUDIA_PORTA:-9458}
PID_APP=''
trap 'if [ -n "$PID_APP" ]; then kill "$PID_APP" 2>/dev/null || true; fi; rm -rf "$LAVORO"' EXIT
if lsof -nP -iTCP:"$PORTA" -sTCP:LISTEN >/dev/null 2>&1; then echo 'Porta di prova occupata'; exit 1; fi
mkdir -p "$LAVORO/dati" "$LAVORO/vault"
node - "$LAVORO" <<'JS'
const fs=require('fs'),path=require('path'),dir=process.argv[2],v=path.join(dir,'vault');
(async()=>{
require('./lib/zaini').crea(v,'Biologia');require('./lib/zaini').crea(v,'Storia');
require('./lib/appunti').save(v,'biologia',null,{title:'Fotosintesi'},'La fotosintesi converte la luce solare in energia chimica.');
require('./lib/appunti').save(v,'biologia',null,{title:'Cellule'},'Le cellule contengono organelli.');
const {PDFDocument,StandardFonts}=require('pdf-lib');
for(const titolo of ['Botanica','Biologia cellulare']){
 const doc=await PDFDocument.create(),font=await doc.embedFont(StandardFonts.Helvetica);
 for(let n=1;n<=3;n++)doc.addPage().drawText(titolo+' - pagina '+n,{x:40,y:700,font,size:18});
 const file=path.join(dir,titolo+'.pdf');fs.writeFileSync(file,await doc.save());
 require('./lib/fonti').importa(v,'biologia',[file]);
}
fs.mkdirSync(path.join(v,'Corsi','corso-nascosto'),{recursive:true});
fs.writeFileSync(path.join(dir,'dati','config.json'),JSON.stringify({vaultPath:v,onboardingFatto:true}));
})().catch(e=>{console.error(e);process.exitCode=1;});
JS
./node_modules/.bin/electron test/electron-chat-app.js --user-data-dir="$LAVORO/dati" --remote-debugging-port="$PORTA" > "$LAVORO/app.log" 2>&1 &
PID_APP=$!
for _ in $(seq 1 40); do if curl -sf "http://127.0.0.1:$PORTA/json/version" >/dev/null; then break; fi; sleep 0.25; done
if ! STUDIA_PORTA="$PORTA" node test/cdp/prova-chat-zaino.js; then cat "$LAVORO/app.log"; exit 1; fi
