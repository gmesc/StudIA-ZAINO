#!/bin/bash
# Il pacchetto Mac che si apre con un doppio click, su qualunque Mac.
#
#   npm run notarizza            Apple Silicon (arm64)
#   npm run notarizza -- x64     Intel
#
# È la via di DISTRIBUZIONE. Quella locale resta `npm run pacchetto`, che firma
# ad-hoc e serve solo a provare sul proprio Mac: il pacchetto che esce da lì fa
# comparire «Apri comunque», questo no.
#
# ── Che cosa serve, una volta sola ───────────────────────────────────────────
#
#  1. un certificato **Developer ID Application** nel portachiavi. Xcode →
#     Settings → Accounts → Manage Certificates → + → Developer ID Application,
#     oppure developer.apple.com → Certificates. Serve il ruolo Account Holder o
#     Admin. Si controlla con:
#         security find-identity -v -p codesigning
#     ⚠️ «Apple Development» NON basta: firma per il tuo Mac, non per gli altri.
#
#  2. le credenziali per `notarytool`, in un profilo del portachiavi:
#         xcrun notarytool store-credentials studia-notarize \
#           --apple-id "tua-apple-id" --team-id TEAMID
#     La password è una **app-specific password** (appleid.apple.com → Accesso e
#     sicurezza), non quella dell'account. Il profilo la tiene cifrata: da qui in
#     poi nessuno script la vede, e non compare in nessun comando.
#
# ── Perché i passi sono cinque e non due ─────────────────────────────────────
#
# ⚠️ SI NOTARIZZA L'APP **E** IL DMG, e in quest'ordine. Il ticket di
# notarizzazione si «cuce» addosso a un file (`stapler`): se si cuce solo al dmg,
# l'app trascinata in Applicazioni resta senza, e su una macchina senza rete
# Gatekeeper non ha modo di verificarla. Se si cuce solo all'app, è il DMG
# scaricato dal browser a far comparire l'avviso. Perciò: si firma l'app, la si
# notarizza e le si cuce il ticket; POI si rifà il dmg dall'app già cucita, si
# notarizza anche quello e gli si cuce il suo.
#
# ⚠️ E il dmg si rifà A MANO, come faceva `pacchetto-mac.sh`: quello che
# electron-builder ha creato durante il build contiene la copia dell'app com'era
# PRIMA della notarizzazione. Spedire quello è il modo più facile di credere di
# aver notarizzato senza averlo fatto.
set -euo pipefail

QUI="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$QUI"

ARCH="${1:-arm64}"
case "$ARCH" in
  arm64) CARTELLA="dist/mac-arm64" ;;
  x64)   CARTELLA="dist/mac" ;;      # è così che le chiama electron-builder
  *) echo "✗ architettura sconosciuta: $ARCH (arm64 | x64)"; exit 1 ;;
esac

PROFILO="${STUDIA_NOTARY_PROFILE:-studia-notarize}"
NOME="$(node -p "require('./package.json').build.productName")"
VERSIONE="$(node -p "require('./package.json').version")"
APP="$CARTELLA/$NOME.app"
DMG="dist/$NOME-$VERSIONE-$ARCH.dmg"

# ── 0. le due cose che devono esserci PRIMA, o si scopre alla fine ───────────
# ⚠️ Un build da 227 MB che fallisce all'ultimo passo perché manca un certificato
# è mezz'ora buttata. Si chiede prima, e si dice come rimediare.
IDENTITA="$(security find-identity -v -p codesigning 2>/dev/null || true)"
CERT="$(printf '%s\n' "$IDENTITA" | grep "Developer ID Application" | head -1 || true)"
if [ -z "$CERT" ]; then
  echo "✗ nel portachiavi non c'è nessun «Developer ID Application»."
  echo "  Xcode → Settings → Accounts → Manage Certificates → + → Developer ID Application"
  echo "  («Apple Development» non basta: firma per il tuo Mac, non per gli altri)"
  exit 1
fi
# ⚠️ Il TEAM ID si legge dal certificato, non si chiede a chi lancia: chi ha due
# team — uno di sviluppo e uno del Developer ID — ne ha due diversi, e quello
# giusto è quello con cui l'app sarà FIRMATA. Sbagliarlo dà un rifiuto della
# notarizzazione che parla di credenziali invece che di team.
TEAM="$(printf '%s' "$CERT" | sed -n 's/.*(\([A-Z0-9]\{10\}\)).*/\1/p')"
echo "  certificato: $(printf '%s' "$CERT" | sed 's/^ *[0-9]*) *[0-9A-F]* *//')"
if ! xcrun notarytool history --keychain-profile "$PROFILO" >/dev/null 2>&1; then
  echo "✗ il profilo di notarizzazione «$PROFILO» non risponde. Si fa una volta sola:"
  echo "    xcrun notarytool store-credentials $PROFILO \\"
  echo "      --apple-id \"tua-apple-id\" --team-id ${TEAM:-TEAMID}"
  echo "  (la password è una app-specific password di appleid.apple.com → Accesso e sicurezza,"
  echo "   non quella dell'account: il profilo la tiene cifrata nel portachiavi)"
  exit 1
fi
echo "  profilo «$PROFILO»: risponde"

echo ""
echo "── 1/5  il bundle, firmato con Developer ID ────────────"
# `identity` non si passa: senza `identity: null` nel package.json,
# electron-builder cerca da sé il Developer ID Application del portachiavi. E
# l'hardened runtime con gli entitlements è nella configurazione, non qui: una
# riga di firma scritta in due posti diverge al primo ritocco.
npx electron-builder --mac "--$ARCH"
[ -d "$APP" ] || { echo "✗ manca $APP"; exit 1; }
codesign --verify --strict --deep "$APP"
# ⚠️ L'esito si legge da una VARIABILE, non da una pipe. `codesign -dv | grep -q`
# sembra la cosa ovvia e sotto `set -o pipefail` è una trappola: `grep -q` esce
# appena trova, `codesign` si prende un SIGPIPE, e la pipeline risulta fallita
# ESATTAMENTE quando il controllo ha successo. Il 30 agosto 2026 ha fermato una
# notarizzazione su un'app firmata benissimo, dicendo il contrario di com'era.
INFO="$(codesign -dv "$APP" 2>&1 || true)"
case "$INFO" in
  *"flags=0x"*"runtime"*) echo "  firma valida, hardened runtime acceso" ;;
  *) echo "✗ l'app non ha l'hardened runtime: la notarizzazione la rifiuterebbe"
     printf '%s\n' "$INFO" | sed 's/^/    /'; exit 1 ;;
esac

echo ""
echo "── 2/5  la notarizzazione dell'APP ─────────────────────"
# Si spedisce uno zip perché notarytool non accetta una cartella, e un `.app` è
# una cartella. `ditto` è l'unico modo di zipparla senza perdere i link simbolici
# del framework di Electron — con `zip` il bundle arriva rotto e la
# notarizzazione fallisce con un errore che parla d'altro.
ZIP="$(mktemp -d "${TMPDIR:-/tmp}/studia-notarize-XXXXXX")/$NOME.zip"
ditto -c -k --keepParent "$APP" "$ZIP"
xcrun notarytool submit "$ZIP" --keychain-profile "$PROFILO" --wait
xcrun stapler staple "$APP"
xcrun stapler validate "$APP"
echo "  ticket cucito all'app"

echo ""
echo "── 3/5  il dmg, rifatto dall'app NOTARIZZATA ───────────"
STAGE="$(mktemp -d "${TMPDIR:-/tmp}/studia-dmg-XXXXXX")"
trap 'rm -rf "$STAGE"' EXIT
cp -R "$APP" "$STAGE/"
ln -s /Applications "$STAGE/Applications"      # il trascinamento che tutti si aspettano
rm -f "$DMG" "$DMG.blockmap"
hdiutil create -volname "$NOME $VERSIONE" -srcfolder "$STAGE" -ov -format UDZO "$DMG" >/dev/null

echo ""
echo "── 4/5  la notarizzazione del DMG ──────────────────────"
xcrun notarytool submit "$DMG" --keychain-profile "$PROFILO" --wait
xcrun stapler staple "$DMG"
xcrun stapler validate "$DMG"
echo "  ticket cucito al dmg"

echo ""
echo "── 5/5  la controprova, con gli occhi di chi riceve ────"
# ⚠️ Non «il file esiste», ma la domanda vera: che cosa dice Gatekeeper. `spctl`
# su una firma ad-hoc rispondeva «rejected»; qui deve rispondere «accepted» e
# nominare la notarizzazione. È l'unica riga che distingue un pacchetto che si
# apre con un doppio click da uno che chiede «Apri comunque».
ESITO=0
MONTA="$(mktemp -d "${TMPDIR:-/tmp}/studia-verifica-XXXXXX")"
hdiutil attach "$DMG" -nobrowse -readonly -mountpoint "$MONTA" >/dev/null
VERDETTO="$(spctl -a -vvv -t exec "$MONTA/$NOME.app" 2>&1 || true)"
printf '%s\n' "$VERDETTO" | sed 's/^/    /'
# Stessa ragione di sopra: si guarda dentro la variabile, senza pipe.
case "$VERDETTO" in *accepted*) ;; *) ESITO=1; echo "  ✗ Gatekeeper NON accetta l'app dentro il dmg" ;; esac
case "$VERDETTO" in *Notarized*|*notarized*) ;; *) ESITO=1; echo "  ✗ manca la notarizzazione (firma valida ma non notarizzata)" ;; esac
xcrun stapler validate "$MONTA/$NOME.app" >/dev/null 2>&1 \
  || { ESITO=1; echo "  ✗ l'app dentro il dmg non ha il ticket cucito: senza rete non si aprirà"; }
# ⚠️ E che sia l'architettura CHIESTA: i due dmg si chiamano quasi uguale, e un
# tester con un Mac Intel che riceve l'arm64 vede solo «l'app non si apre».
DENTRO="$(lipo -archs "$MONTA/$NOME.app/Contents/MacOS/$NOME" 2>/dev/null || echo '?')"
case "$ARCH:$DENTRO" in
  arm64:*arm64*|x64:*x86_64*) echo "  ✓ ed è $DENTRO, come chiesto" ;;
  *) ESITO=1; echo "  ✗ dentro c'è $DENTRO, ma si è chiesto $ARCH" ;;
esac
hdiutil detach "$MONTA" >/dev/null; rmdir "$MONTA" 2>/dev/null || true

echo ""
if [ $ESITO -eq 0 ]; then
  echo "  ✓ $DMG  ($(du -h "$DMG" | cut -f1))"
  echo "    si apre con un doppio click: niente «Apri comunque», anche senza rete"
else
  echo "  ✗ il pacchetto NON è pronto da spedire: vedi le righe qui sopra"
fi
exit $ESITO
