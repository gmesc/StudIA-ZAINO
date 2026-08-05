# Trascrizione automatica dei video

## Quale file lanciare
Usa SEMPRE la copia in **questa cartella principale**: `Trascrivi-lezioni_Whisper.command` (qui, non quella dentro `StudIA-Vault/`). Tutti i video/mp3 stanno qui in radice; lo script guarda solo la propria cartella, quindi la copia dentro il vault non trova nessun file, carica il modello e si chiude subito senza trascrivere nulla (sembra "non partire", ma in realtà ha solo finito subito perché non c'è niente da fare lì).

## Già risolto: niente estrazione manuale dell'audio
Lo script `Trascrivi-lezioni_Whisper.command` ora trascrive **direttamente i video** (`.mp4`, `.mov`, `.mkv`, `.m4a`, `.wav`, `.mp3`…). Whisper estrae l'audio da solo: **non serve più creare gli `.mp3`**. Basta che i video siano nella cartella. Lo script:
- va avanti **senza interruzioni**: se un file dà errore lo salta e continua;
- **riprende** da dove era: salta ciò che è già completo in `trascrizioni/` (cioè ha già il `.json` finale);
- ignora i file ancora in copia e scrive i `.json` in modo atomico (mai a metà).

Nota: se lo script viene interrotto MENTRE sta trascrivendo un file (Mac in sospensione, riavvio, o il vecchio bug del riavvio automatico — vedi sotto), quel file non ha ancora il `.json`, quindi al prossimo avvio **riparte da zero su quel file** (i `.txt`/`.vtt` parziali vengono sovrascritti). È normale, non un errore — ma su un file lungo può volerci molto per arrivare in fondo.

## Automatico: ogni 15 minuti la cartella viene ricontrollata da sola
Con un piccolo LaunchAgent di macOS lo script riparte da solo a intervalli regolari, senza bisogno di lanciarlo a mano.

1. Copia il file `it.studia.autotranscribe.plist` in `~/Library/LaunchAgents/`
   (nel Finder: menu **Vai → Vai alla cartella…** e incolla `~/Library/LaunchAgents`).
2. Nel Terminale:
   ```
   launchctl load -w ~/Library/LaunchAgents/it.studia.autotranscribe.plist
   ```
   (Su macOS recenti, se `load` dà errore: `launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/it.studia.autotranscribe.plist`)
3. Fatto. Da ora lo script riparte da solo al login e poi ogni 15 minuti; se trova video nuovi o non ancora completati li trascrive, senza che tu debba fare nulla.

- Per **fermare** l'automatismo: `launchctl unload -w ~/Library/LaunchAgents/it.studia.autotranscribe.plist`
- **Log**: `trascrizioni/_log.txt` (avanzamento) e `_autotranscribe.out/err.log`.
- La **prima volta** scarica il modello Whisper (serve internet una volta sola).

**Correzione 22/07/2026**: la versione precedente del `.plist` aveva anche un `WatchPaths` che osservava questa stessa cartella. Ma lo script scrive `.txt`/`.vtt` dentro questa cartella MAN MANO che trascrive → ogni scrittura riattivava `WatchPaths` → il job si riavviava da solo a metà lavoro, sempre sulla stessa lezione, senza mai finirla. Rimosso: ora riparte solo al login e ogni 15 minuti (`StartInterval`), che basta e non si auto-interrompe più. Il file corretto è già in questa cartella, pronto da (re)installare con i comandi sopra.

Alternativa senza Terminale: Automator → **Azione cartella** collegata alla cartella, che lancia lo stesso script (meno affidabile del LaunchAgent, e soffriva dello stesso problema di auto-riavvio).

## Velocità: quanto ci vuole
Il modello "medium" su CPU è accurato ma lento: una singola lezione di ~90-100 minuti può richiedere diverse ore. Con 23 video, il primo giro completo può richiedere giorni se lo si lascia scorrere da solo. Se i tempi sono un problema, si può usare il modello "small" (più veloce, un po' meno preciso) lanciando a mano da Terminale con `WHISPER_MODEL=small ./Trascrivi-lezioni_Whisper.command`.

## Dopo la trascrizione: indice dei video
Quando ci sono i `.json`, genera i rimandi ai minutaggi nei corsi:
```
python3 StudIA-Vault/index_videos.py --transcripts trascrizioni/ --course StudIA-Vault/Corsi/<corso>.json --out StudIA-Vault/Corsi/<corso>.json --video-ext .mp4
```
