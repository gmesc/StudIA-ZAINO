#!/bin/bash
# Le prove sull'app viva, senza mettere le mani nel vault vero.
#
# ⚠️ Perché esiste. Le prove CDP girano contro il vault indicato nella config, creano ed
# eliminano mappe e appunti, e una sequenza interrotta a metà ha già fatto sparire un file
# dell'utente (`AI.json`). I dati non sono versionati: sotto non c'è nessuna rete. È la
# trappola ⑧ del verbale 8-9 agosto, e questo script è il rimedio scritto una volta invece
# che ricordato ogni volta.
#
# Che cosa fa, in ordine: salva la config vera, ne fa una COPIA MAGRA del vault (tutto il
# testo, niente MATERIALI: 23 GB diventano ~2 MB), ci punta `vaultPath`, lancia l'app con
# la porta di debug, esegue le prove che gli passi, e alla fine rimette tutto com'era —
# **anche se lo interrompi con Ctrl-C o se una prova fallisce**, ed è il punto.
#
#   ./test/cdp/con-vault-di-prova.sh                     tutte le prove
#   ./test/cdp/con-vault-di-prova.sh prova-menu.js       una sola
#
set -u

QUI="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CFG="$HOME/Library/Application Support/studia/config.json"
LAVORO="$(mktemp -d "${TMPDIR:-/tmp}/studia-prove-XXXXXX")"
COPIA_CFG="$LAVORO/config.vera.json"
VAULT="$LAVORO/vault"
PID_APP=""

# Il ripristino è la prima cosa che si scrive, non l'ultima: se lo si mette in fondo, un
# `exit` a metà lo salta — che è esattamente com'è nato il guasto.
ripristina() {
  local esito=$?
  echo ""
  if [ -n "$PID_APP" ] && kill -0 "$PID_APP" 2>/dev/null; then
    kill "$PID_APP" 2>/dev/null; wait "$PID_APP" 2>/dev/null
    echo "  app chiusa"
  fi
  if [ -f "$COPIA_CFG" ]; then
    cp "$COPIA_CFG" "$CFG" && echo "  config ripristinata → $(node -e "console.log(JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).vaultPath)" "$CFG")"
  fi
  rm -rf "$LAVORO"
  exit $esito
}
trap ripristina EXIT INT TERM

[ -f "$CFG" ] || { echo "✗ config non trovata: $CFG"; exit 1; }
cp "$CFG" "$COPIA_CFG"
VERO="$(node -e "console.log(JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).vaultPath||'')" "$CFG")"
[ -d "$VERO" ] || { echo "✗ il vault della config non esiste: $VERO"; exit 1; }

echo "  vault vero:  $VERO"
echo "  copia magra: $VAULT"
mkdir -p "$VAULT"
# `MATERIALI/` e `_lavorazione/` sono il 99,99% del peso e non servono a provare
# l'interfaccia: restano fuori. Tutto il resto — lezioni, appunti, mappe — viene copiato.
rsync -a --exclude 'MATERIALI/' --exclude '_lavorazione/' "$VERO/" "$VAULT/" || exit 1
echo "  pesa $(du -sh "$VAULT" | cut -f1), con $(ls -1 "$VAULT/Corsi" 2>/dev/null | wc -l | tr -d ' ') corsi"

node -e "
const fs=require('fs'), p=process.argv[1];
const c=JSON.parse(fs.readFileSync(p,'utf8')); c.vaultPath=process.argv[2];
fs.writeFileSync(p, JSON.stringify(c,null,2));
" "$CFG" "$VAULT" || exit 1

cd "$QUI" || exit 1
./node_modules/.bin/electron . --remote-debugging-port=9333 > "$LAVORO/app.log" 2>&1 &
PID_APP=$!
printf "  avvio dell'app"
for _ in $(seq 1 30); do
  curl -s --max-time 2 http://127.0.0.1:9333/json/version >/dev/null 2>&1 && break
  printf "."; sleep 1
done
curl -s --max-time 2 http://127.0.0.1:9333/json/version >/dev/null 2>&1 || {
  echo " ✗ non risponde sulla 9333 — log in $LAVORO/app.log"; tail -5 "$LAVORO/app.log"; exit 1; }
echo " pronta"
sleep 2

if [ $# -gt 0 ]; then PROVE=("$@"); else PROVE=(prova-b1.js prova-b2.js prova-menu.js prova-keyword.js); fi

KO=0
for p in "${PROVE[@]}"; do
  echo ""
  echo "── $p ───────────────────────────────────────────"
  node "test/cdp/$p" || KO=$((KO+1))
done

echo ""
if [ "$KO" -gt 0 ]; then echo "✗ $KO prove fallite"; else echo "✓ tutte le prove sono verdi"; fi
exit "$KO"
