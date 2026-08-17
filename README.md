# StudIA

App desktop (Electron) per **studiare da un corpus di materiali propri**. Decine di videolezioni e
PDF entrano in un *vault*; una pipeline multiagente li trascrive, li indicizza, li legge per intero
e ne costruisce corsi strutturati; un lettore li presenta con quiz, glossari, mappe concettuali,
appunti, evidenze, album di ritagli e ripasso programmato.

Due proprietà contano più di ogni funzione:

1. **Il vault è dell'utente.** Cartelle di `.md` e JSON leggibili anche in Obsidian, senza
   database. L'app è un'interfaccia sul disco, non il contrario.
2. **I contenuti generati sono rigenerabili; quelli dell'utente no.** Tutta l'architettura ruota
   attorno a questa asimmetria.

> **Dove sono le cose.** Il **codice** sta qui (`StudIA/`); i **dati** stanno fuori, in una cartella
> scelta al primo avvio (di norma `StudIA - file/`). Sono separati dal 3 agosto 2026: nessun
> materiale personale finisce nel repository.

## Come si comincia

```bash
npm install
npm start                 # l'app
```

Al primo avvio StudIA chiede dove tenere il vault e dice che cosa trova sulla macchina — quale
motore AI, quale Python, quanto spazio. Da lì si importa una cartella di materiali e si generano le
lezioni, oppure si apre un vault che c'è già.

La stessa pipeline si usa da terminale, senza interfaccia:

```bash
npm run studia -- --help
```

## I tre livelli

**Corso › Lezione › Capitolo.** Un *corso* raccoglie i materiali di un percorso di studio; le
*lezioni* sono ciò che la pipeline genera; i *capitoli* sono le unità che si leggono. Nel codice
`LESSONS` sono le lezioni, non i corsi.

Accanto ai corsi ci sono gli **zaini**: contenitori di documenti *senza* lezioni generate, dove si
studia direttamente sulle fonti — utile per le dispense che non vale la pena trasformare.

## Che cosa c'è dentro il vault

```
StudIA - file/
  Corsi/<id>/
    _corso.md            il frontmatter del corso
    LEZIONI/             ← della PIPELINE, rigenerabile
    MATERIALI/           i file sorgente numerati, e le «lapidi» di quelli rimossi
    APPUNTI/ MAPPE/ RIPASSO/ ALBUM/ PERCORSI/     ← dell'UTENTE, mai toccate dalla pipeline
  Zaini/<id>/            come un corso, ma senza LEZIONI/
```

## I pacchetti

```bash
npm run pacchetto            # macOS Apple Silicon: bundle, firma ad-hoc, dmg, controprova
npm run pacchetto -- x64     # macOS Intel (gira anche su Apple Silicon, con Rosetta)
npm run dist:win             # Windows: l'installer NSIS x64
```

I due comandi per macOS non si fermano al dmg: firmano l'app e **rifanno il dmg dall'app firmata**,
poi lo montano per verificare che dentro ci sia davvero l'app firmata e dell'architettura giusta.
La firma è ad-hoc, non notarizzata: al primo avvio serve Impostazioni di Sistema → Privacy e
sicurezza → «Apri comunque». Su Windows l'equivalente è SmartScreen → «Esegui comunque».

**Requisiti misurati** (16 agosto 2026):

| | |
|---|---|
| macOS | **12 o superiore** (Electron 39), Apple Silicon o Intel |
| memoria | ~560 MB appena aperta, ~670 MB con un PDF grande e la mappa; ~1,3 GB al picco durante l'OCR |
| OCR di un documento fotografato | 1,7 s a pagina su Apple Silicon, 6,2 s su Intel — e il picco di memoria **non cresce** con la lunghezza |
| trascrizione locale | vuole Python e parecchia RAM: su una macchina da 4 GB conviene generare altrove e portarsi il vault |

Le due generazioni di risorse (icona ed emoji) si rifanno da sole:

```bash
npm run icona                # build/icon.png, icon.icns e icon.ico dal tocco OpenMoji
npm run emoji                # la tavolozza del selettore, da OpenMoji + Unicode CLDR
npm run crediti              # l'inventario delle licenze, ricavato da node_modules
```

## Come si verifica

```bash
npm test                                              # unità: ogni file gira anche da solo
./test/cdp/con-vault-di-prova.sh                      # le prove sull'app viva
./test/cdp/con-vault-di-prova.sh prova-menu.js        # una sola — è così che si lavora
STUDIA_APP=dist/mac-arm64/StudIA.app \
  ./test/cdp/con-vault-di-prova.sh                    # le stesse prove DENTRO il pacchetto
```

Le prove sull'app viva girano su una **copia magra del vault** e con una cartella dati tutta loro:
non toccano niente di tuo, e la tua StudIA può restare aperta mentre lavorano.

## Per chi ci mette le mani

| documento | che cosa dice |
|---|---|
| [GUIDA-ARCHITETTO.md](GUIDA-ARCHITETTO.md) | **come si costruisce qui**: filosofia, invarianti numerati, mappa del codice, processo, trappole permanenti |
| `HANDOFF-DEFINITIVO-<data>.md` (il più recente) | **a che punto siamo**: che cosa è appena entrato, che cosa resta aperto, le trappole fresche |
| `PIANO-*.md` | il dettaglio di ogni area (zaino, banco, mappe, appunti, foto, onboarding, moduli) |
| `App/guida-zaino/` | la **guida illustrata della modalità ZAINO**, con schermate dell'app vera: viaggia col pacchetto e si apre da Impostazioni › Zaino. La ricetta per rifarne le immagini sta in `_lab/` (fuori dal pacchetto) |

Se la guida e un handoff sembrano in conflitto, ha ragione l'handoff: è più recente.

## Licenze

Il codice è MIT. L'inventario completo dei componenti di terze parti si genera con `npm run
crediti` e si legge dentro l'app (Impostazioni › Crediti). Due note che vale la pena conoscere
prima di riusare qualcosa:

- le emoji e le icone sono **OpenMoji**, CC BY-SA 4.0: chi redistribuisce mantiene l'attribuzione;
- **l'icona dell'applicazione** è un'opera derivata dall'emoji «graduation cap» (U+1F393) di
  OpenMoji, quindi è CC BY-SA 4.0 e **non** MIT come il resto.

Contatto: giacomo@insegnai.ch
