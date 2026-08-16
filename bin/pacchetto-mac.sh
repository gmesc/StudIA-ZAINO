#!/bin/bash
# Il pacchetto per Mac, dall'inizio alla fine, in un comando solo.
#
#   npm run dist:mac        ← electron-builder: il bundle e un dmg
#   npm run pacchetto       ← questo: bundle, FIRMA, e il dmg che contiene l'app firmata
#
# ⚠️ Perché esiste, cioè che cosa si sbagliava a mano. `mac.identity: null` dice a
# electron-builder di **saltare la firma**, e su arm64 un bundle non sigillato è un bundle
# che macOS rifiuta con «l'app è danneggiata» — non «l'app non è verificata»: proprio
# danneggiata, che manda il tester a cercare un guasto che non c'è. Il rimedio è una firma
# ad-hoc (`--sign -`) dopo il build. Ma electron-builder il dmg lo ha già fatto PRIMA, con
# dentro la copia non firmata: firmare `dist/mac-arm64/StudIA.app` e spedire quel dmg è il
# modo più facile di credere di aver rimediato senza aver rimediato. Perciò il dmg si
# rifà, da zero, dall'app appena firmata.
#
# ⚠️ La firma ad-hoc non è notarizzabile per definizione: `spctl` dirà sempre «rejected»,
# e al primo avvio serve Impostazioni di Sistema → Privacy e sicurezza → «Apri comunque»
# (da Sequoia il vecchio destro → Apri non basta più). Per togliere quel passo servono
# l'Apple Developer Program e la notarizzazione vera: allora questo script si **butta**,
# non si adatta — esiste solo per compensare `identity: null`.
#
# ⚠️ L'ARCHITETTURA si passa, e cambia due cose insieme: dove electron-builder
# mette il bundle e come si chiama il dmg. Scriverne una a mano è il modo di
# firmare un bundle e spedirne un altro.
#
#   npm run pacchetto            Apple Silicon (arm64)
#   npm run pacchetto -- x64     Intel — gira anche su Apple Silicon, con Rosetta
#
set -euo pipefail

QUI="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$QUI"

ARCH="${1:-arm64}"
case "$ARCH" in
  arm64) CARTELLA="dist/mac-arm64" ;;
  x64)   CARTELLA="dist/mac" ;;      # è così che le chiama electron-builder
  *) echo "✗ architettura sconosciuta: $ARCH (arm64 | x64)"; exit 1 ;;
esac

NOME="$(node -p "require('./package.json').build.productName")"
VERSIONE="$(node -p "require('./package.json').version")"
APP="$CARTELLA/$NOME.app"
DMG="dist/$NOME-$VERSIONE-$ARCH.dmg"

echo "── 1/4  il bundle ($ARCH) ──────────────────────────────"
npx electron-builder --mac "--$ARCH"

[ -d "$APP" ] || { echo "✗ manca $APP"; exit 1; }

echo ""
echo "── 2/4  la firma ad-hoc ────────────────────────────────"
# `--deep` è deprecato da Apple (firma i binari annidati nell'ordine sbagliato) ma per una
# firma ad-hoc è ciò che c'è: con la notarizzazione sparisce insieme a tutto lo script.
codesign --force --deep --sign - --timestamp=none "$APP"
codesign --verify --strict "$APP" || { echo "✗ la firma non regge: il dmg sarebbe «danneggiato»"; exit 1; }
echo "  firma valida (spctl dirà «rejected»: è ad-hoc, non notarizzata — atteso)"

echo ""
echo "── 3/4  il dmg, rifatto dall'app FIRMATA ───────────────"
STAGE="$(mktemp -d "${TMPDIR:-/tmp}/studia-dmg-XXXXXX")"
trap 'rm -rf "$STAGE"' EXIT
cp -R "$APP" "$STAGE/"
ln -s /Applications "$STAGE/Applications"      # il trascinamento che tutti si aspettano
rm -f "$DMG" "$DMG.blockmap"
hdiutil create -volname "$NOME $VERSIONE" -srcfolder "$STAGE" -ov -format UDZO "$DMG" >/dev/null

echo ""
echo "── 4/4  la controprova ─────────────────────────────────"
# Non «il dmg esiste», ma «l'app DENTRO il dmg è firmata»: è l'unica copia che il tester
# eseguirà davvero, e le due cose sono state diverse per un mese.
MONTA="$(mktemp -d "${TMPDIR:-/tmp}/studia-verifica-XXXXXX")"
hdiutil attach "$DMG" -nobrowse -readonly -mountpoint "$MONTA" >/dev/null
if codesign --verify --strict "$MONTA/$NOME.app"; then
  ESITO=0; echo "  ✓ l'app dentro il dmg è firmata e integra"
else
  ESITO=1; echo "  ✗ l'app dentro il dmg NON è firmata"
fi
# ⚠️ E che sia l'architettura CHIESTA: i due dmg si chiamano quasi uguale, e un
# tester con un Mac Intel che riceve l'arm64 vede solo «l'app non si apre».
DENTRO="$(lipo -archs "$MONTA/$NOME.app/Contents/MacOS/$NOME" 2>/dev/null || echo '?')"
case "$ARCH:$DENTRO" in
  arm64:*arm64*|x64:*x86_64*) echo "  ✓ ed è $DENTRO, come chiesto" ;;
  *) ESITO=1; echo "  ✗ dentro c'è $DENTRO, ma si è chiesto $ARCH" ;;
esac
hdiutil detach "$MONTA" >/dev/null; rmdir "$MONTA" 2>/dev/null || true

echo ""
echo "  $DMG  ($(du -h "$DMG" | cut -f1))"
echo "  al primo avvio: Impostazioni di Sistema → Privacy e sicurezza → «Apri comunque»"
exit $ESITO
