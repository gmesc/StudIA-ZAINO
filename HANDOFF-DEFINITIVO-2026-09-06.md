# Handoff definitivo — fork StudIA - ZAINO, 6 settembre 2026

Questo è il punto d'ingresso del fork. Base StudIA: `2644b1a5ed28cf0b6099e7bbbe58cd4ba859a5cd`. Branch locale `studia-zaino`; upstream locale in sola lettura operativa, nessun push effettuato.

La richiesta del fork sostituisce le decisioni storiche che vietavano qualunque AI nello zaino: è stata aggiunta una chat didattica, senza generazione di corsi. I piani precedenti restano documentazione dell'app originale; per questo fork partire dal README e da `docs/CHAT.md`.

- `lib/zaino-only.js`: barriera IPC e preload, esclusione pipeline e accesso ai corsi; protezione id ambigui e symlink dello zaino.
- `lib/chat.js`: contesto aggiornato da PDF/testi/appunti, ruoli, Wikipedia, sessioni JSON/Markdown, annullamento e concorrenza.
- `lib/chat-profili.js`: profili nel vault con campi validati e scrittura atomica.
- `lib/chat-provider.js`: sei provider, cataloghi autenticati, errori senza credenziali.
- `lib/chat-ipc.js`: ponte, chiavi nel solo main, annullamento su reload e chiusura.
- `App/assets/chat/ui.js` e `ui.css`: finestra chat e nuove impostazioni Utente/AI; vecchi nodi conservati nascosti per il cablaggio condiviso.
- `test/electron-chat-app.js`, `bin/prova-zaino.sh`: test Electron con mock caricati esclusivamente dall'entry point di test; nessuna opzione di produzione attiva i mock.

Originale e fork hanno configurazioni personali separate. Le conversazioni sono in `Zaini/<id>/CHAT`. Le chiavi non viaggiano nel vault. I profili sono comuni agli zaini dello stesso vault; ogni invio applica il profilo selezionato aggiornato. L'appunto aperto viene salvato prima dell'invio.

I file d'ingresso della pipeline (`ingest.py`, `index_videos.py`, CLI, wizard e composer) sono rimossi. Le librerie condivise storiche restano per preservare gli strumenti dello zaino; i relativi comandi CORSI non sono eseguibili attraverso l'app.

Per provare a mano: creare due zaini, aggiungere un PDF e un appunto, configurare una chiave, aprire Chat AI e provare i tre ruoli; modificare l'appunto e fare una nuova domanda; cambiare zaino durante una risposta; riaprire l'app e la conversazione. Provare clone/modifica/elimina di un profilo.

## Verifiche concluse

- Suite originale: 51 file di test passati; 6 nuovi file passati, per 57 nella catena `npm test`. La prova vocale macOS richiede accesso ai servizi di sistema.
- `npm run test:ui`: creazione/modifica profilo, chiave simulata, catalogo modello, chat persistita, aggiornamento appunti, cambio zaino durante invio e riapertura verificati con click reali e screenshot.
- Pacchetto arm64 in `dist/mac-arm64/StudIA - ZAINO.app`, firmato ad hoc e verificato con codesign. Primo avvio, ponte chat, editor e lettura di PDF/appunti verificati nel runtime incluso. Non notarizzato.
- Le API esterne sono provate con mock: nessuna chiave o credito reale è stato usato.
- La verifica visiva ha portato a caricare EasyMDE prima dell’inizializzazione diretta dello zaino; la regressione apre un appunto nell’app.
