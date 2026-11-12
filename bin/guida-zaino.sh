#!/bin/bash
# Guida 2026-11-05: screenshot reali, PDF e zaino didattico in un vault isolato.
set -euo pipefail
cd "$(dirname "$0")/.."
export ZAINO_GUIDA_ROOT="$PWD"
export GUIDA_PYTHON=${GUIDA_PYTHON:-python3}
"$GUIDA_PYTHON" -c 'import reportlab, PIL, fontTools, brotli' || {
  echo 'Servono reportlab, Pillow, fonttools e brotli nel Python indicato da GUIDA_PYTHON.' >&2
  exit 1
}
export STUDIA_PORTA=${STUDIA_PORTA:-9465}
if lsof -nP -iTCP:"$STUDIA_PORTA" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "La porta $STUDIA_PORTA è già usata; scegli STUDIA_PORTA." >&2; exit 1
fi
LAVORO=$(mktemp -d /private/tmp/studia-guida-20261105-XXXXXX)
export GUIDA_VAULT="$LAVORO/vault"
mkdir -p "$LAVORO/dati" "$GUIDA_VAULT"
node - "$LAVORO" <<'JS'
const fs=require('node:fs'),path=require('node:path'),p=process.argv[2];
fs.writeFileSync(path.join(p,'dati/config.json'),JSON.stringify({vaultPath:path.join(p,'vault'),profiloSaltato:true,onboardingFatto:true}));
JS
python3 App/guida-zaino/_lab/genera-guida.py
node App/guida-zaino/_lab/genera-percorso.js
./node_modules/.bin/electron . --user-data-dir="$LAVORO/dati" --remote-debugging-port="$STUDIA_PORTA" > "$LAVORO/app.log" 2>&1 &
PID_APP=$!
trap 'kill "$PID_APP" 2>/dev/null || true' EXIT
for _ in $(seq 1 80); do
  if curl -sf "http://127.0.0.1:$STUDIA_PORTA/json/version" >/dev/null; then break; fi
  sleep .25
done
printf 'Laboratorio della guida: %s\n' "$LAVORO"
node App/guida-zaino/_lab/screenshot-nuova.js
"$GUIDA_PYTHON" App/guida-zaino/_lab/genera-miniguida.py
node App/guida-zaino/_lab/genera-percorso.js
python3 App/guida-zaino/_lab/pacchetto-percorso.py
node App/guida-zaino/_lab/verifica-nuova.js
