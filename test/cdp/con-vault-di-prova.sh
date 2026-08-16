#!/bin/bash
# Le prove sull'app viva, senza mettere le mani su niente di tuo.
#
# ⚠️ Perché esiste. Le prove CDP creano ed eliminano mappe, appunti e immagini, e una
# sequenza interrotta a metà ha già fatto sparire un file dell'utente (`AI.json`). I dati
# non sono versionati: sotto non c'è nessuna rete. È la trappola ⑧ del verbale 8-9 agosto,
# e questo script è il rimedio scritto una volta invece che ricordato ogni volta.
#
# ── Che cosa è cambiato, e perché conta ──────────────────────────────────────────────
# La prima versione **scambiava la config vera**: la copiava, ci riscriveva dentro
# `vaultPath`, e la rimetteva a posto alla fine. Funzionava, ma aveva due difetti che si
# pagavano ogni volta:
#
#   1. mentre le prove giravano, StudIA **non poteva restare aperta**. Se l'utente stava
#      elaborando un corpus e l'app scriveva la config (costi, chiavi, ultimo corso), il
#      ripristino gliela riscriveva sopra;
#   2. il rimedio dipendeva dal ripristino, cioè da un `trap`. Un `kill -9` e la config
#      restava puntata a un vault temporaneo che poi veniva cancellato.
#
# Adesso l'istanza di prova ha una **cartella dati tutta sua** (`--user-data-dir`): la sua
# config, le sue preferenze, il suo tutto. Della tua non tocca niente, nemmeno per un
# istante, e `main.js` non ha un lock di istanza singola — quindi **la tua StudIA può
# restare aperta e lavorare** mentre queste prove girano.
#
# Che cosa fa, in ordine: copia magra del vault (tutto il testo, niente MATERIALI: 23 GB
# diventano ~2 MB), una config nuova in una cartella dati temporanea, l'app con la porta di
# debug, le prove, e alla fine butta via la cartella temporanea. Non c'è niente da
# ripristinare, che è il modo più sicuro di ripristinare.
#
#   ./test/cdp/con-vault-di-prova.sh                     tutte le prove
#   ./test/cdp/con-vault-di-prova.sh prova-menu.js       una sola
#
set -u

QUI="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CFG_VERA="$HOME/Library/Application Support/studia/config.json"
LAVORO="$(mktemp -d "${TMPDIR:-/tmp}/studia-prove-XXXXXX")"
DATI="$LAVORO/dati"           # la cartella `userData` dell'istanza di prova
VAULT="$LAVORO/vault"
PORTA="${STUDIA_PORTA:-9333}"
PID_APP=""

# Si chiude l'app e si butta la cartella temporanea. Nessun ripristino: non c'è niente da
# rimettere a posto, perché non si è spostato niente.
pulisci() {
  local esito=$?
  echo ""
  if [ -n "$PID_APP" ] && kill -0 "$PID_APP" 2>/dev/null; then
    kill "$PID_APP" 2>/dev/null; wait "$PID_APP" 2>/dev/null
    echo "  app di prova chiusa"
  fi
  rm -rf "$LAVORO"
  echo "  cartella temporanea rimossa (la tua config non è mai stata toccata)"
  exit $esito
}
trap pulisci EXIT INT TERM

[ -f "$CFG_VERA" ] || { echo "✗ config non trovata: $CFG_VERA"; exit 1; }
VERO="$(node -e "console.log(JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).vaultPath||'')" "$CFG_VERA")"
[ -d "$VERO" ] || { echo "✗ il vault della config non esiste: $VERO"; exit 1; }

# La porta di debug è una risorsa a esemplare unico: se è già occupata, due istanze si
# contenderebbero le stesse prove e le misure mentirebbero.
if lsof -nP -iTCP:"$PORTA" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "✗ la porta $PORTA è già occupata: chiudi l'altra istanza di prova, o STUDIA_PORTA=9334 ..."
  exit 1
fi

echo "  vault vero:  $VERO  (in sola lettura: se ne fa una copia)"
echo "  copia magra: $VAULT"
mkdir -p "$VAULT" "$DATI"
# `MATERIALI/` e `_lavorazione/` sono il 99,99% del peso e non servono a provare
# l'interfaccia: restano fuori. Tutto il resto — lezioni, appunti, mappe — viene copiato.
rsync -a --exclude 'MATERIALI/' --exclude '_lavorazione/' "$VERO/" "$VAULT/" || exit 1
echo "  pesa $(du -sh "$VAULT" | cut -f1), con $(ls -1 "$VAULT/Corsi" 2>/dev/null | wc -l | tr -d ' ') corsi"

# La config dell'istanza di prova: si parte dalla tua — così l'onboarding risulta già
# fatto e non compare la card di primo avvio davanti alle prove — ma il vault è la copia
# e **le chiavi API non si portano dietro**: queste prove non chiamano nessun modello, e
# una chiave copiata in una cartella temporanea è una chiave in più in giro per il disco.
node -e "
const fs=require('fs');
const c=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));
delete c.keys;
c.vaultPath=process.argv[2];
c.onboardingFatto=true;
fs.writeFileSync(process.argv[3], JSON.stringify(c,null,2));
" "$CFG_VERA" "$VAULT" "$DATI/config.json" || exit 1

cd "$QUI" || exit 1
# Di norma si prova il codice della cartella (`electron .`). Con `STUDIA_APP` si provano
# invece **gli stessi gesti dentro il pacchetto** — l'unica cosa che i tester eseguono
# davvero, e che può rompersi per conto suo (whitelist `files`, percorsi dentro il
# bundle, firma). Il vault e la cartella dati restano quelli di prova: cambia solo chi
# viene lanciato.
#
#   STUDIA_APP=dist/mac-arm64/StudIA.app ./test/cdp/con-vault-di-prova.sh
#
# ⚠️ `--user-data-dir` è ciò che rende innocuo tutto il resto: l'app di prova legge e
# scrive la config lì dentro, e la tua può restare aperta a lavorare.
if [ -n "${STUDIA_APP:-}" ]; then
  ESEGUIBILE="$STUDIA_APP/Contents/MacOS/$(basename "$STUDIA_APP" .app)"
  [ -x "$ESEGUIBILE" ] || { echo "✗ non è un pacchetto eseguibile: $ESEGUIBILE"; exit 1; }
  echo "  si prova il PACCHETTO: $STUDIA_APP"
  "$ESEGUIBILE" --user-data-dir="$DATI" --remote-debugging-port="$PORTA" > "$LAVORO/app.log" 2>&1 &
else
  ./node_modules/.bin/electron . --user-data-dir="$DATI" --remote-debugging-port="$PORTA" > "$LAVORO/app.log" 2>&1 &
fi
PID_APP=$!
printf "  avvio dell'app di prova"
for _ in $(seq 1 40); do
  curl -s --max-time 2 "http://127.0.0.1:$PORTA/json/version" >/dev/null 2>&1 && break
  printf "."; sleep 1
done
curl -s --max-time 2 "http://127.0.0.1:$PORTA/json/version" >/dev/null 2>&1 || {
  echo " ✗ non risponde sulla $PORTA — log in $LAVORO/app.log"; tail -5 "$LAVORO/app.log"; exit 1; }
echo " pronta"
sleep 2

# La prova che la separazione ha funzionato davvero: l'app di prova deve vedere la COPIA.
# Se leggesse il vault vero, tutto il resto di questo script sarebbe teatro.
VISTO="$(curl -s --max-time 3 "http://127.0.0.1:$PORTA/json" | node -e "
let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{
  try{ const t=JSON.parse(s).find(x=>x.type==='page'); console.log(t?t.url:''); }catch(e){ console.log(''); }
});")"
case "$VISTO" in
  *StudIA.html*) : ;;
  *) echo "✗ la pagina aperta non è quella attesa: $VISTO"; exit 1 ;;
esac

if [ $# -gt 0 ]; then PROVE=("$@"); else PROVE=(prova-b1.js prova-stampa.js prova-b2.js prova-banco-avvio.js prova-banco-contenuto.js prova-banco-ripristino.js prova-banco-griglia.js prova-media-punto.js prova-menu.js prova-selezione-menu.js prova-note.js prova-keyword.js prova-mappe-ui.js prova-mappa-trascina.js prova-topbar.js prova-topbar-stile.js prova-tbar.js prova-appunti-barra.js prova-maniglia-indice.js prova-wikilink.js prova-identita-capitoli.js prova-pdf.js prova-confronto.js prova-testolayer.js prova-album.js prova-album-trascina.js prova-foto.js prova-memorie.js prova-tendine.js prova-modo.js prova-zaino.js prova-evidenze-pdf.js prova-fonti.js prova-fonte-rimossa.js prova-import.js prova-ocr-zaino.js prova-player.js prova-ripasso.js prova-ripasso-vista.js prova-crediti.js prova-impostazioni-token.js prova-onboarding-token.js prova-atlante.js prova-emoji.js prova-evidenziatore.js); fi

KO=0
for p in "${PROVE[@]}"; do
  echo ""
  echo "── $p ───────────────────────────────────────────"
  STUDIA_PORTA="$PORTA" node "test/cdp/$p" || KO=$((KO+1))
done

echo ""
if [ "$KO" -eq 0 ]; then echo "✓ tutte le prove sono verdi"; else echo "✗ $KO prove fallite"; fi
exit $KO
