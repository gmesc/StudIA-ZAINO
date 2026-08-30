# StudIA — istruzioni per chi lavora qui

App desktop (Electron, arm64) per studiare da un corpus di materiali propri. **Il vault è
dell'utente**: cartelle di `.md` e JSON leggibili anche in Obsidian, nessun database. L'app è
un'interfaccia sul disco, non il contrario.

⚠️ Questo file è **corto di proposito**. Non ripete i documenti: dice che cosa leggere e le poche
regole che non si negoziano mai. Una quarta copia delle stesse regole divergerebbe al primo
ritocco — è la trappola ④ del progetto, in forma di documento.

## Che cosa leggere, in quest'ordine

1. **`GUIDA-ARCHITETTO.md`** — come si costruisce qui: invarianti numerati, vocabolario, mappa del
   codice e dei dati, trappole permanenti. Cambia di rado.
2. **`HANDOFF-DEFINITIVO-*.md` con la DATA PIÙ ALTA** — a che punto siamo. ⚠️ Dal **30 agosto
   2026 ce n'è uno solo**: i venti storici sono stati eliminati (stavano in git, e ci restano —
   `git log -S "<parola>" -- 'HANDOFF*'`, `git show 52b0ad5:<nome>`), perché le regole che
   valevano davvero erano già nella guida dell'architetto e la catena costava una sessione a
   risalirla. Accanto restano due file che handoff cronologici **non sono**: `HANDOFF.md`
   (l'unica specifica della pipeline) e `HANDOFF-PACCHETTO-QUADERNO.md`.
3. **Il `PIANO-*` dell'area toccata** — BRAYNR (appunti, evidenze, mappe, ripasso) · ZAINO · BANCO ·
   MODULI (lo smontaggio del monolite) · MAPPE-EDITOR · ONBOARDING · FOTO.

In conflitto **vince l'handoff più recente**, anche contro la guida: è più recente per costruzione.

## Le regole che non si negoziano

**Si scrive pensando alla prova in NODE, non a quella CDP.** Non è «aggiungere una prova dopo»: è
scegliere la forma del codice *prima*, così che la parte che si sbaglia stia in una funzione pura
richiamabile da `node test/<file>.js`. La decisione diventa un **modulo UMD** in `App/assets/…`; al
renderer resta leggere il DOM, chiamare il modulo, fare quello che dice. Alla prova CDP resta il
**cablaggio**, mai la logica. (Una prova CDP costa ~40 s e un'istanza di Electron; una di unità
~40 ms.)

**Il modulo si fa PASSARE quello che non può leggere**, invece di andarselo a prendere: è la forma
di `suMac(nav)` in `tasti/nomi.js`. Così si prova senza vault, senza DOM e senza Electron.

**Una prova non si crede finché non la si sa far diventare ROSSA.** Si rimette il codice di prima,
si rilancia, si guarda che il controllo nuovo fallisca. Un verde che non si sa far diventare rosso
non prova niente — e nemmeno un verde che verifica solo che il dato sia sul disco, senza guardare
se a schermo compaia qualcosa.

**Un rosso si fa PARLARE, non si rilancia.** Se è «a corse alterne», la causa è quasi sempre lo
stato lasciato da un'altra prova (la modalità, i pannellini, il banco) o una misura sbagliata. E
**la suite intera si lancia al cancelletto**, non a ogni passo: durante il lavoro solo le prove che
si toccano.

**Perdere in silenzio è l'unica cosa peggiore di perdere.** Ciò che sparisce si dice; un file
illeggibile è un errore dichiarato, non uno stato vuoto.

**Il conto si fa, non si ricorda.** Quante prove, quante righe, quanti file: si contano prima di
scriverli in un documento.

## Le trappole che costano di più

- ⚠️ **Prima di aprire Electron**, `GUIDA-ARCHITETTO.md` §6.1: la porta di debug è a esemplare
  unico, e il client CDP finisce a pilotare l'app di un altro progetto. **Non si chiude mai un
  processo per nome** (`pkill -f Electron` prende ogni Electron della macchina, comprese le app
  dell'utente): solo per PID annotato o per porta di debug.
- ⚠️ **Niente apici inversi dentro un template literal**, nemmeno in un commento: lo chiudono a
  metà e la prova muore in `SyntaxError`. Vale anche per i messaggi di commit passati con `-m` fra
  doppi apici — la shell li **esegue**. La forma sicura è l'**heredoc quotato** (`<<'EOF'`).
- ⚠️ **Una prova nuova va DENTRO i due registri**: `PROVE=(` in `test/cdp/con-vault-di-prova.sh` e
  la catena di `npm test` in `package.json`.
- ⚠️ **I confini di un blocco del monolite** si calcolano dalle sentinelle al momento, mai da un
  `grep` di ieri: `App/StudIA.html` si muove sotto i piedi.
- ⚠️ **Una prova lascia il banco, la modalità e i pannellini come li ha trovati.**

## Come si verifica

```bash
cd "/Users/giacomomeschini/Claude/StudIA/StudIA"
npm test                                            # le unità, in catena
STUDIA_PORTA=9346 ./test/cdp/con-vault-di-prova.sh  # le prove sull'app viva
npm start                                           # l'app
```

⚠️ Il `cd` fa parte del comando: la cartella di lavoro delle chat è quella **di fuori**.

**Le prove misurano, non guardano.** Dopo ogni passo si consegna all'utente una lista corta di
gesti da provare a mano: più di un difetto reale è stato trovato da lui con tutte le suite verdi.
**E se il lavoro sta su un ramo, il comando per provarlo si dà sempre**, in un blocco a sé:
`git checkout <ramo> && npm start`.

## Come si lavora

- **Un ramo per ogni lavoro**; commit frequenti con messaggi che spiegano il **perché** (prosa, ⚠️
  per le trappole pagate).
- **Il merge si dichiara, non si presume**: (a) le due suite verdi; (b) i gesti provati a mano
  dall'utente; (c) piani e handoff aggiornati; (d) `main` non si è mossa.
- **All'utente si chiede solo per i bivi veri** — dove due letture producono lavori materialmente
  diversi. Il resto si decide e **si dichiara**.
- **A fine sessione**: un `HANDOFF-DEFINITIVO` datato, che rimpiazza il precedente; nel vecchio si
  mette il riquadro 📍 che dice che non è più il punto d'ingresso.

## La lingua

Codice, commenti, messaggi di commit e documenti sono **in italiano**, e i commenti dicono *perché*
— non che cosa fa la riga. Un `⚠️` marca una trappola pagata almeno una volta.
