#!/bin/bash
# Rigenera le immagini della guida soltanto in un vault di esempio isolato.
set -euo pipefail
cd "$(dirname "$0")/.."
LAVORO=$(mktemp -d /private/tmp/studia-guida-XXXXXX)
PORTA=${STUDIA_PORTA:-9462}
PID_APP=''
trap 'if [ -n "$PID_APP" ]; then kill "$PID_APP" 2>/dev/null || true; fi' EXIT
if lsof -nP -iTCP:"$PORTA" -sTCP:LISTEN >/dev/null 2>&1; then echo 'Porta guida occupata'; exit 1; fi
mkdir -p "$LAVORO/dati" "$LAVORO/vault"
node - "$LAVORO" <<'JS'
const fs=require('fs'),path=require('path'),dir=process.argv[2];
fs.writeFileSync(path.join(dir,'dati/config.json'),JSON.stringify({vaultPath:path.join(dir,'vault'),profiloSaltato:true,onboardingFatto:true}));
JS
./node_modules/.bin/electron test/electron-chat-app.js --user-data-dir="$LAVORO/dati" --remote-debugging-port="$PORTA" > "$LAVORO/app.log" 2>&1 &
PID_APP=$!
for _ in $(seq 1 60); do if curl -sf "http://127.0.0.1:$PORTA/json/version" >/dev/null; then break; fi; sleep .25; done
printf 'Laboratorio isolato: %s\n' "$LAVORO"
GUIDA_VAULT="$LAVORO/vault" STUDIA_PORTA="$PORTA" node App/guida-zaino/_lab/campagna.js
GUIDA_VAULT="$LAVORO/vault" STUDIA_PORTA="$PORTA" node App/guida-zaino/_lab/fork.js
GUIDA_VAULT="$LAVORO/vault" STUDIA_PORTA="$PORTA" node App/guida-zaino/_lab/verifica.js
