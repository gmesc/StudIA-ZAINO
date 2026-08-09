# Rinomina dei livelli — Corso › Lezione › Capitolo

> Eseguita il 2026-08-09. Questo file è il contratto: se un giorno un pezzo di
> codice usa ancora il vocabolario vecchio, è un residuo, non una variante.

## Il perché

I tre livelli si chiamavano **Progetto › Corso › Capitolo**. Chi studia non ha
progetti: ha corsi. E dentro un corso non ci sono corsi: ci sono lezioni.
Il nome vecchio costringeva a tradurre a mente a ogni schermata, e la traduzione
sbagliata era già finita nei dati (`usage.jsonl` scriveva `courseId` con dentro
l'id di un progetto).

| livello | prima | adesso |
|---|---|---|
| 1 | Progetto | **Corso** |
| 2 | Corso | **Lezione** |
| 3 | Capitolo | Capitolo *(invariato)* |
| trasversale | Percorso | Percorso *(invariato)* |

Un **Percorso** resta quello che era: una traversata del Corso che sceglie una
variante d'indice per ogni Lezione. Gli otto personaggi non cambiano.

## Sul disco

```
StudIA - file/
  Corsi/                      ← era Progetti/
    <corso>/
      _corso.md               ← era _progetto.md
      LEZIONI/                ← era CORSI/
        <lezione>/
          _lezione.md         ← era _corso.md
          NN-titolo.md        capitoli (invariati)
      APPUNTI/  MATERIALI/  MAPPE/  PERCORSI/  _lavorazione/
```

Chiavi di frontmatter e di JSON:

| prima | adesso |
|---|---|
| `tipo: progetto` | `tipo: corso` |
| `tipo: course` | `tipo: lesson` |
| `n_corsi` | `n_lezioni` |
| `ordine_corsi` | `ordine_lezioni` |
| `corso_base` | `lezione_base` |
| `stile_progetto` | `stile_corso` |
| `stile_corsi` | `stile_lezioni` |
| `_piano.json` › `project` | `course` |
| `_piano.json` › `corsi[]` | `lezioni[]` |
| `_piano.json` › `corsi[].tipo: corso` | `lezioni[].tipo: lezione` |

I **corpi dei capitoli non si toccano**: lì «corso» è prosa didattica generata,
contenuto e non struttura.

## L'ordine della sostituzione (e perché non è negoziabile)

`Progetto→Corso` e `Corso→Lezione` insieme sono una catena: fatta nell'ordine
sbagliato, i Corsi appena nati diventano Lezioni e i due livelli collassano in
uno. Peggio ancora sul disco, dove `_corso.md` è il nome **di arrivo** del
livello 1 e il nome **di partenza** del livello 2.

Quindi, sempre in tre tempi:

1. livello 2 → sentinella (`corso`/`course` → `\x01…`)
2. livello 1 → nome nuovo (`progetto`/`project` → `corso`/`course`)
3. sentinella → nome nuovo (`\x01…` → `lezione`/`lesson`)

## I falsi amici (protetti prima di tutto)

Otto famiglie di parole contengono `cors` o `progett` senza essere né corsi né
progetti. Vanno congelate prima della fase 1 e scongelate dopo la fase 3.

| forma | che cos'è | esempi trovati |
|---|---|---|
| `[Pp]ercors[oi]`, `PERCORSI` | il Percorso, che resta | `percorsiLib`, `percorsoScelto`, `cartellePercorso`, `PERCORSI_ATTIVI` |
| `[Dd]iscors` | discorsivo, discorso | `stile_capitoli: discorsivo` |
| `[Cc]orsivo` | il corsivo tipografico | `Corsivo` |
| `trascors` | tempo trascorso | `trascorso` |
| `[Rr]icorsiv` | ricorsione | `contaFileRicorsivo` |
| `[Ii]n[Cc]orso`, `in-corso` | stato «in lavorazione» | `inCorso` (24 volte), `stato === 'in-corso'` |
| `progettista` | il ruolo nei prompt | `«Sei un progettista didattico»` |
| `[Pp]rogettazione` | idem | — |

**Attenzione alla maiuscola.** `percorso` minuscolo è il Percorso; `perCorso`
con la C maiuscola è «per corso», cioè il livello 2, e va rinominato in
`perLezione`. Le due forme si distinguono solo dal maiuscolo: qualunque regola
insensibile al caso le confonde.

## Abbreviazioni con collisione

`pdir` (cartella del progetto) e `cdir` (cartella del corso) si scambiano di
posto. Vanno trattate con lo stesso ordine a tre tempi, o `pdir→cdir` sovrascrive
un `cdir` che esiste già:

| prima | adesso |
|---|---|
| `cdir`, `cbase`, `corsoDir` | `ldir`, `lbase`, `lezioneDir` |
| `pdir`, `pdirs`, `projDir` | `cdir`, `cdirs`, `courseDir` |

## Compatibilità con i vault vecchi

La lettura tollera il vecchio impianto: se non c'è `Corsi/` si guarda in
`Progetti/`, se non c'è `LEZIONI/` si guarda in `CORSI/`, se non c'è
`_corso.md` si legge `_progetto.md`. La **scrittura** usa solo i nomi nuovi:
i vault crescono verso la struttura nuova, mai indietro.
