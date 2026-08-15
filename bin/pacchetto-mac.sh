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
set -euo pipefail

QUI="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$QUI"

NOME="$(node -p "require('./package.json').build.productName")"
VERSIONE="$(node -p "require('./package.json').version")"
APP="dist/mac-arm64/$NOME.app"
DMG="dist/$NOME-$VERSIONE-arm64.dmg"

echo "── 1/4  il bundle ──────────────────────────────────────"
npm run dist:mac

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
hdiutil detach "$MONTA" >/dev/null; rmdir "$MONTA" 2>/dev/null || true

echo ""
echo "  $DMG  ($(du -h "$DMG" | cut -f1))"
echo "  al primo avvio: Impostazioni di Sistema → Privacy e sicurezza → «Apri comunque»"
exit $ESITO
