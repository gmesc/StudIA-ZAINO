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
elif [ -n "${STUDIA_SORGENTE:-}" ]; then
  # Le prove di QUESTA cartella contro il sorgente di un'ALTRA — l'app originale in
  # `~/Claude/StudIA/StudIA`. È così che si misura «verde in tutte e due le app» per una prova
  # appena cambiata qui, senza toccare l'altro repo: gli stessi file di prova, un'altra app.
  #
  #   STUDIA_SORGENTE=~/Claude/StudIA/StudIA STUDIA_SUITE=zaino ./test/cdp/con-vault-di-prova.sh
  [ -f "$STUDIA_SORGENTE/package.json" ] || { echo "✗ non è la cartella di un'app: $STUDIA_SORGENTE"; exit 1; }
  echo "  si prova il SORGENTE di un'altra cartella: $STUDIA_SORGENTE"
  ./node_modules/.bin/electron "$STUDIA_SORGENTE" --user-data-dir="$DATI" --remote-debugging-port="$PORTA" > "$LAVORO/app.log" 2>&1 &
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

# ── I due registri ────────────────────────────────────────────────────────────────────
# ⚠️ Questo fork ha rimosso corsi, lezioni e capitoli: la maggior parte delle prove qui
# dentro li chiede, e fallisce per COSTRUZIONE — «il capitolo sta nel blocco A» è falso
# perché non c'è nessun capitolo. Misurato il 6 settembre 2026: 55 rosse su 69, e su
# `main` pulita 44. Un totale del genere non dice niente a nessuno, e ha già fatto
# credere a una regressione che non c'era.
#
# Perciò il registro è DUE. `PROVE_ZAINO` sono quelle che su questo fork possono essere
# verdi — misurate tali su due rami diversi, non scelte dal nome. È questo l'elenco che
# vale per il criterio (a) di un merge:
#
#   STUDIA_SUITE=zaino ./test/cdp/con-vault-di-prova.sh      solo quelle che qui hanno senso
#   ./test/cdp/con-vault-di-prova.sh                         tutte, come prima
#
# ⚠️ Una prova entra qui perché è stata VISTA verde LANCIANDO QUESTO ELENCO, non perché
# sembra parlare dello zaino (`prova-zaino.js` non c'è, e il nome ingannerebbe) e nemmeno
# perché era verde dentro la suite intera. Il primo elenco ne aveva 19 scelte così, e
# quattro sono cadute subito:
#   · `prova-note` e `prova-topbar` chiedono un CAPITOLO, che qui non esiste;
#   · `prova-album-trascina` e `prova-mappa-trascina` erano verdi solo perché `prova-album`
#     e `prova-mappe-ui` giravano PRIMA a preparare i dati — e quelle due, di corsi, in
#     questo elenco non ci sono.
# Cioè: questo non è un insieme, è una CATENA. Chi ne toglie o sposta un pezzo la rilancia.
#
# ⚠️ Per la stessa ragione i due registri seguono l'ORDINE di `PROVE=(`, non l'alfabeto: le
# prove si preparano il terreno a vicenda, e riordinarle le rompe. Misurato — con gli stessi
# 43 nomi in ordine alfabetico, `STUDIA_SUITE=corsi` sull'app originale dava 4 rosse; nel
# loro ordine, nessuna.
#
# ⚠️ E un verde si guarda in faccia. `prova-wikilink` stava qui perché usciva con codice 0, ma
# sul fork esce così RINUNCIANDO («corso ai-literacy-anthropic assente: niente da provare»):
# zero controlli. Un verde per rinuncia non prova niente — è passata fra i CORSI, dove sta il
# corso che le serve.
#
# Dal 7 settembre 2026 il registro è 34, e la storia dei venti in più è in due pezzi:
#   · dieci stavano fuori da tutti e due gli elenchi per mancanza di misura, ed erano verdi
#     lanciando questa catena;
#   · dieci stavano fra i CORSI senza chiedere nessun corso: chiedevano un PDF che sta in
#     `Fonti/` alla radice del vault, e che il contenitore attivo NASCONDE se ha `MATERIALI/`
#     (`cartelle()` in lib/materiali.js si confina lì dentro). Adesso ognuna, prima di aprirlo,
#     passa da `pdfVisibile()` in cdp.js: se il documento non si vede, lo mette in
#     `MATERIALI/PDF/` del contenitore attivo — dove lo metterebbe chi studia.
# ⚠️ E `prova-appunti-barra` azzerava il banco con la chiave MORTA (`studia.banco`): al reload
# ereditava la disposizione salvata da un'altra prova — un blocco, la mappa su una riga —
# e cadeva in ogni catena ZAINO passando da sola. Ora toglie la chiave viva (`bancoChiave()`).
PROVE_ZAINO=(
  prova-stampa.js prova-banco-avvio.js prova-banco-ripristino.js prova-banco-griglia.js
  prova-media-punto.js prova-vocabolario-zaino.js prova-appunto-riga.js prova-mappa-pallino.js
  prova-topbar-stile.js
  prova-tbar.js prova-appunti-barra.js prova-appunti-md.js prova-callout-bolla.js
  prova-riquadri-stili.js prova-maniglia-indice.js prova-pdf.js prova-pagina-campo.js
  prova-righello.js prova-voce-pagina.js prova-ricerca-pannellino.js prova-lente-mappe.js
  prova-testolayer.js prova-album.js prova-album-trascina.js prova-misura-immagine.js
  prova-memorie.js prova-tendine.js prova-evidenze-pdf.js prova-fonte-rimossa.js
  prova-ocr-zaino.js prova-crediti.js prova-emoji.js prova-sbircia.js prova-postilla-zaino.js
  prova-postille-vista.js)

# `PROVE_CORSI` sono le prove che chiedono CORSI, LEZIONI, CAPITOLI o QUIZ. Su questo fork
# non possono passare, ed è giusto così: la pipeline è stata rimossa. Servono a chi rimette
# insieme le due metà — è l'elenco che dovrà tornare verde.
#
#   STUDIA_SUITE=corsi ./test/cdp/con-vault-di-prova.sh
#
# ⚠️ NON è «tutto il resto» dedotto per esclusione: sono quelle che, con lo STESSO vault e lo
# STESSO runner, falliscono qui e passano sull'app originale (`~/Claude/StudIA/StudIA`, base
# 2644b1a), dove la suite intera è 69 su 69 verdi con 1786 controlli. Il vault ce li ha, i
# corsi: è il fork che non li espone.
#
# ⚠️ Il PERCHÉ di ciascuna sta nell'handoff del 7 settembre 2026, ed è misurato, non dedotto
# dal nome: 14 vogliono un capitolo, 11 un corso o la commutazione ai corsi, 5 il registro
# Generata/Mie delle mappe, 2 il quiz, 3 la scheda Corsi delle Impostazioni. Le nove che
# volevano soltanto un PDF alla radice del vault sono passate nello ZAINO (vedi sopra).

PROVE_CORSI=(
  prova-b1.js prova-b2.js prova-banco-contenuto.js prova-menu.js
  prova-selezione-menu.js prova-note.js prova-keyword.js prova-mappe-ui.js
  prova-mappa-trascina.js prova-l1.js prova-l2.js prova-l3l4.js
  prova-topbar.js prova-wikilink.js prova-identita-capitoli.js prova-lente-punto.js
  prova-confronto.js prova-foto.js prova-modo.js prova-tasti-frecce.js
  prova-zaino.js prova-fonti.js prova-import.js prova-player.js
  prova-media-nonapre.js prova-ripasso.js prova-ripasso-vista.js prova-impostazioni-token.js
  prova-onboarding-token.js prova-primo-avvio.js prova-atlante.js prova-evidenziatore.js
  prova-evidenza-appunto.js prova-postilla.js prova-strati.js)

if [ $# -gt 0 ]; then PROVE=("$@");
elif [ "${STUDIA_SUITE:-}" = "zaino" ]; then PROVE=("${PROVE_ZAINO[@]}");
elif [ "${STUDIA_SUITE:-}" = "corsi" ]; then PROVE=("${PROVE_CORSI[@]}");
else PROVE=(prova-b1.js prova-stampa.js prova-b2.js prova-banco-avvio.js prova-banco-contenuto.js prova-banco-ripristino.js prova-banco-griglia.js prova-media-punto.js prova-vocabolario-zaino.js prova-menu.js prova-selezione-menu.js prova-note.js prova-appunto-riga.js prova-keyword.js prova-mappe-ui.js prova-mappa-trascina.js prova-mappa-pallino.js prova-l1.js prova-l2.js prova-l3l4.js prova-topbar.js prova-topbar-stile.js prova-tbar.js prova-appunti-barra.js prova-appunti-md.js prova-callout-bolla.js prova-riquadri-stili.js prova-maniglia-indice.js prova-wikilink.js prova-identita-capitoli.js prova-pdf.js prova-pagina-campo.js prova-righello.js prova-voce-pagina.js prova-ricerca-pannellino.js prova-lente-punto.js prova-lente-mappe.js prova-confronto.js prova-testolayer.js prova-album.js prova-album-trascina.js prova-foto.js prova-misura-immagine.js prova-memorie.js prova-tendine.js prova-modo.js prova-tasti-frecce.js prova-zaino.js prova-evidenze-pdf.js prova-fonti.js prova-fonte-rimossa.js prova-import.js prova-ocr-zaino.js prova-player.js prova-media-nonapre.js prova-ripasso.js prova-ripasso-vista.js prova-crediti.js prova-impostazioni-token.js prova-onboarding-token.js prova-primo-avvio.js prova-atlante.js prova-emoji.js prova-evidenziatore.js prova-evidenza-appunto.js prova-sbircia.js prova-postilla.js prova-postilla-zaino.js prova-postille-vista.js prova-strati.js); fi

KO=0
ROSSE=()
MORTA=""                      # la prova durante la quale l'app di prova è morta, se è successo
USCITA="$LAVORO/prove.log"    # tutto ciò che le prove stampano: serve a CONTARE i controlli
: > "$USCITA"
for p in "${PROVE[@]}"; do
  echo ""
  echo "── $p ───────────────────────────────────────────"
  STUDIA_PORTA="$PORTA" node "test/cdp/$p" 2>&1 | tee -a "$USCITA"
  if [ "${PIPESTATUS[0]}" -ne 0 ]; then KO=$((KO+1)); ROSSE+=("$p"); fi
  # ⚠️ Prima della prova dopo si guarda se l'app è ancora VIVA. Il 6 settembre 2026 è morta
  # durante prova-righello: quella prova è uscita ZITTA con codice 0 (la promessa CDP in
  # attesa non si chiude mai, e node esce quando non ha più niente da fare), e le 37 dopo
  # hanno detto `fetch failed` — 37 rosse che erano UN evento. E il perché non si è saputo
  # mai, perché `app.log` stava nella cartella temporanea che questo script butta all'uscita.
  # Qui ci si ferma, si dice il codice d'uscita — che distingue un crash da un kill da un ⌘Q —
  # e il log dell'app si mette in salvo PRIMA che la cartella sparisca.
  if ! kill -0 "$PID_APP" 2>/dev/null; then
    wait "$PID_APP" 2>/dev/null; CODICE=$?
    MORTA="$p"
    case "$CODICE" in
      # ⚠️ Misurato il 7 settembre 2026: un `kill` (SIGTERM) Electron lo trasforma in un'uscita
      # ORDINATA, codice 0 — lo stesso di un ⌘Q. Quindi 0 non vuol dire «da dentro»: vuol dire
      # «nessun crash», e il colpevole è una mano o un comando da fuori (§6.1 della guida).
      0)   COME="uscita pulita (codice 0): un ⌘Q, una chiusura dal Dock, o un kill da fuori — NON un crash" ;;
      143) COME="SIGTERM non gestito: terminata da fuori" ;;
      137) COME="SIGKILL: uccisa da fuori (kill -9), o dal sistema per memoria" ;;
      134|139|133) COME="segnale $((CODICE-128)): un CRASH vero — il rapporto sta in ~/Library/Logs/DiagnosticReports/Electron-*" ;;
      *)   COME="codice d'uscita $CODICE" ;;
    esac
    SALVATO="$HOME/Library/Logs/StudIA-prove/app-morta-$(date +%Y%m%d-%H%M%S).log"
    mkdir -p "$(dirname "$SALVATO")" && cp "$LAVORO/app.log" "$SALVATO" 2>/dev/null
    echo ""
    echo "✗ L'APP DI PROVA È MORTA durante $p — $COME"
    echo "  il suo log è conservato in: $SALVATO (ultime righe qui sotto)"
    tail -8 "$LAVORO/app.log" | sed 's/^/    │ /'
    break
  fi
done

echo ""
# ⚠️ Il numero che dice se la suite è girata DAVVERO non è quello dei rossi ma quello dei
# CONTROLLI eseguiti: una corsa da 55 rosse aveva 488 controlli invece di 1073, cioè metà
# suite mai partita. Prima si contava a mano dopo, adesso lo dice il runner.
echo "  controlli eseguiti: $(grep -c '^  ok  \|^  KO  ' "$USCITA") (ok $(grep -c '^  ok  ' "$USCITA"), KO $(grep -c '^  KO  ' "$USCITA"))"
if [ -n "$MORTA" ]; then
  # Le prove dopo la morte NON sono rosse: non sono state eseguite, ed è un'altra cosa.
  ESEGUITE=0; for p in "${PROVE[@]}"; do ESEGUITE=$((ESEGUITE+1)); [ "$p" = "$MORTA" ] && break; done
  RESTANO=$((${#PROVE[@]}-ESEGUITE))
  echo "✗ l'app è morta durante $MORTA: eseguite $ESEGUITE prove su ${#PROVE[@]}, $RESTANO NON eseguite"
  [ "$RESTANO" -gt 0 ] && echo "    per riprendere da lì:  ./test/cdp/con-vault-di-prova.sh ${PROVE[*]:$ESEGUITE}"
  exit 1
fi
if [ "$KO" -eq 0 ]; then
  echo "✓ tutte le prove sono verdi (${#PROVE[@]})"
else
  # ⚠️ CHI è rossa, non solo quante. Prima si sapeva il numero e basta, e per
  # risalire ai nomi bisognava ripescarli dall'uscita con un `awk` — che ne
  # trova MENO del vero, perché una prova che muore in un'eccezione non stampa
  # né «KO» né «✗». Un conteggio senza nomi costa una corsa in più ogni volta.
  echo "✗ $KO prove fallite su ${#PROVE[@]}:"
  for p in "${ROSSE[@]}"; do echo "    $p"; done
  echo ""
  echo "  ⚠️ Su questo fork un rosso NON si crede finché non lo si è rilanciato da solo:"
  echo "     ./test/cdp/con-vault-di-prova.sh ${ROSSE[*]}"
fi
exit $KO
