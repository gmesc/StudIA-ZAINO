# Piano di implementazione — StudIA: pipeline autonoma di generazione corsi

> Documento operativo da passare a **Claude Code**. Descrive *cosa* costruire e *dove*
> innestarlo nel codice esistente. Il progetto è l'app Electron in `StudIA-Vault/`.
> Lingua dei contenuti e della UI: italiano. Utente con ADHD/autismo/APC → l'accessibilità
> non è un extra, è un requisito (capitoli brevi, un'azione per volta, stato sempre visibile).

---

## 0. Obiettivo in una frase

Estendere l'app Electron esistente perché, data una cartella-corpus (PDF + video in `Fonti/`),
**produca i corsi in autonomia facendo le proprie chiamate AI**, passando per: ingestione →
proposta di raggruppamento editabile → generazione dei corsi → validazione → salvataggio in
`Corsi/`, che il lettore già carica da solo.

Due principi guida:
- **Due "AI" separate.** Il *raggruppamento* è clustering (locale, deterministico, economico); la
  *generazione dei contenuti* è l'unica parte che richiede davvero un modello via API.
- **Neutralità di provider.** Il modello può essere di **Anthropic, OpenAI o Google**, scelto dalle
  impostazioni. Il codice parla a un'interfaccia astratta, non a un SDK specifico.

---

## 1. Cosa esiste già (NON riscrivere — innestarsi qui)

Verificato sul codice il 2026-07-22.

- **`main.js`** (processo main):
  - `config.json` in `app.getPath('userData')` con `{vaultPath, model}` (helper `readCfg`/`writeCfg`).
  - `vault:choose` (dialog cartella) + `scaffold()` che crea `Fonti, Corsi, Trascrizioni, Indice-PDF`
    (**nota: non crea `Media/`** — vedi §11).
  - `ensureDeps()`: crea un venv Python in `userData/pyenv` e installa `faster-whisper` + `pypdf`
    (una volta sola), con streaming di log.
  - `ingest:start`: lancia `ingest.py` e ritrasmette avanzamento al renderer con un protocollo a righe
    su stdout: `@TOTAL n` | `@FILE i n kind nome` | `@SUB frazione` | `@OK ..` | `@ERR ..` | `@DONE fatti tot`.
- **`ingest.py`** (worker, spawnato dal main):
  - Scansiona `Fonti/`. PDF → `Indice-PDF/<stem>.json` (testo **per pagina fisica**, via pypdf).
    Video/audio → `Trascrizioni/<stem>.json` (segmenti con timestamp, via Whisper). Dedup media per stem
    (preferisce il video all'audio).
  - `reindex_courses()`: dopo la trascrizione richiama `index_videos.index(trs, course)` su ogni
    `Corsi/*.json` per rigenerare i `videoRefs`.
  - È **resumable**: salta ciò che ha già un `.json` non vuoto. Scrittura atomica (`.tmp` + `os.replace`).
- **`preload.js`**: espone `window.vault = { hasElectron, path, courses, srcUrl(file), choose(),
  ingest:{start,onProgress,onDone,onError,onLog} }`. `srcUrl` risolve i file dentro **`Fonti/`**
  (usato sia per i PDF sia per i video).
- **`App/StudIA.html`** (1186 righe, il lettore):
  - Registro corsi `const COURSES={}` (riga ~709); `addCourse(c)` valida `title`+`chapters` (~711);
    `loadCourse(id)` (~993); `importCoursesFromText` (~1003); `refreshCourseSelect` (~988);
    `deleteCourse` (~1034).
  - `PDF_BASE='../Fonti/'` (~1051), `VIDEO_BASE='../Media/'` (~1052) — **ma in Electron** `openPdf`
    (~1101) e `openVideo` (~1070) usano `window.vault.srcUrl(file)` → quindi puntano a `Fonti/`.
    `VIDEO_BASE` resta solo per il browser.
  - Auto-caricamento dei corsi dal vault all'avvio (~1122) e barra di avanzamento cablata sugli eventi
    `ingest.onProgress/onDone/onError` (~1147).

**Conseguenza pratica:** gli step 1–2 (drop file → trascrizione lunga con status-bar + estrazione testo PDF)
**sono già fatti**. Il piano copre il resto: raggruppamento AI settabile, selezione pagine, e generazione
autonoma dei corsi via API multi-provider.

---

## 2. Architettura (vincoli non negoziabili)

1. **Chiavi API e TUTTE le chiamate AI nel processo MAIN (Node).** Mai nel renderer, mai in `window.*`,
   mai committate. Il renderer chiede via IPC; il main chiama l'API e restituisce il risultato. Motivo: il
   renderer carica anche HTML/contenuti; esporre le chiavi lì è una falla.
2. **Livello AI astratto e multi-provider.** Un modulo `ai/` con un'interfaccia comune e tre adattatori:
   ```
   ai/
     provider.js     // seleziona l'adattatore in base a config.aiProvider ed espone l'interfaccia comune
     anthropic.js    // adattatore Anthropic  (@anthropic-ai/sdk)
     openai.js       // adattatore OpenAI      (openai)
     google.js       // adattatore Google Gemini (@google/generative-ai)
   ```
   Interfaccia comune (identica per tutti):
   ```js
   // ritorna un oggetto GIÀ validato contro `schema` (JSON Schema), o lancia con errori leggibili
   generateStructured({ system, messages, schema, model, temperature }) -> Promise<object>
   // opzionale: vettori per la similarità (§7 layer B). Non tutti i provider ce l'hanno (vedi punto 6)
   embed(texts: string[]) -> Promise<number[][]>
   estimateCost({ inputTokens, outputTokens, model }) -> { usd }
   ```
   Il resto del codice (proposta, generazione) usa SOLO questa interfaccia: cambiare provider = cambiare una
   voce di config, non il codice.
3. **Elaborazione del corpus resta Python** (`ingest.py`, Whisper, pypdf) spawnata dal main: già così, funziona.
4. **Il detector di raggruppamento è Node** nel main: legge solo JSON già pronti (`Indice-PDF/*.json`,
   `Trascrizioni/*.json`) + i nomi file. Nessuna dipendenza pesante, gira offline.
5. **La validazione è un modulo JS in-process** (`validate.js`) basato su **JSON Schema + `ajv`** (§5), così
   il ciclo genera→valida→ripara resta veloce. Tenere anche `validate_course.py` come CLI, ma facendogli
   caricare **lo stesso** file schema (fonte di verità unica).
6. **Embeddings dipendono dal provider.** OpenAI (`text-embedding-3-*`) e Google (`text-embedding-004`) hanno
   embeddings; **Anthropic no**. Quindi la similarità (§7 layer B) usa gli embeddings del provider **se
   disponibili**, altrimenti **fallback a TF-IDF + coseno in JS puro** (nessun servizio esterno). Non cercare
   un endpoint embeddings su Anthropic: non c'è.
7. **Fidati, ma verifica.** Anche quando il provider offre structured output "strict" (OpenAI) o schema di
   risposta (Google), il main **ri-valida SEMPRE in locale con `ajv` + controlli semantici** (§5) prima di
   scrivere qualsiasi file. Le garanzie del provider non si prendono per buone alla cieca.

Schema dei processi:
```
Renderer (UI, accessibile)
   │  IPC (preload → window.vault.*)
Main (Node): chiavi API, livello ai/ (Anthropic|OpenAI|Google), detector (Node),
   │          validazione ajv (JS), orchestrazione batch
   ├── spawn Python: ingest.py (Whisper + pypdf)   [già esistente]
   └── fs: legge Indice-PDF/ Trascrizioni/ ; scrive piano.json, Corsi/*.json  (atomico)
```

---

## 3. Contratti dati (definirli PRIMA di scrivere codice)

### 3.1 `config.json` (esistente, in userData) — aggiungere campi
```jsonc
{
  "vaultPath": "…",
  "model": "medium",                    // modello Whisper (esistente)

  "aiProvider": "anthropic",            // NUOVO — anthropic | openai | google
  "apiKeys": {                          // NUOVO — una per provider; mai nel renderer/vault/git
    "anthropic": "",
    "openai": "",
    "google": ""
  },
  "genModel": "",                        // NUOVO — id modello del provider scelto (settabile)
  "embedProvider": "none",              // NUOVO — openai | google | none (none → TF-IDF)

  "granularity": "atomico",             // NUOVO — atomico | medio | tematico
  "monthlyBudgetUsd": 20                // NUOVO — tetto di spesa soft
}
```
Regola: si può salvare più di una chiave; `aiProvider` decide quale si usa. `genModel` va coerente col
provider attivo (validare la coppia provider+modello in Impostazioni).

### 3.2 `Indice-PDF/<stem>.json` (esistente) — sorgente testo PDF
```jsonc
{ "pdf": "03 … .pdf", "npages": 40, "pages": [ { "page": 1, "text": "…" }, … ] }
```
`page` = **pagina fisica**. I `sources` dei corsi usano la pagina fisica → mappatura diretta, niente offset.

### 3.3 `Trascrizioni/<stem>.json` (esistente) — sorgente testo video
```jsonc
{ "media": "01 … .mp4", "language": "it", "segments": [ { "start": 12.3, "end": 15.0, "text": "…" }, … ] }
```

### 3.4 `piano.json` (NUOVO — radice del vault) — il piano settabile
Scollega "decidere la struttura" da "generare i contenuti".
```jsonc
{
  "schema": 1,
  "granularity": "atomico",
  "groups": [
    {
      "id": "grp-dislessia-lettura",
      "title": "05 La dislessia",             // "NN Nome" (ordina il selettore)
      "subtitle": "Materiali 04–07",
      "status": "proposto",                    // proposto | approvato | generato | errore
      "courseFile": "td74-05-dislessia.json",
      "members": [
        { "source": "04 LA DISLESSIA … .pdf", "type": "pdf",
          "pages": "all",                      // "all" | [[1,10],[15,15]] (range pagine fisiche)
          "rationale": "dispensa teorica di base" },
        { "source": "05 … CAPIRE LA LETTURA STRUMENTALE … .mp4", "type": "video",
          "rationale": "videolezione della stessa area" }
      ]
    }
  ]
}
```

### 3.5 Corso `Corsi/<file>.json` — forma
`corso{ id, schema, title, subtitle, source, chapters[] }`,
`capitolo{ id, title, brief, html, keypoints[], glossary[{t,d}], quiz[], sources[]?, videoRefs[]? }`.
Le regole rigorose e lo schema formale sono in **§5** (da lì non si deroga).
**Note inline (citazioni):** il testo di `brief`/`html` può contenere token `[[n]]` che il
lettore trasforma in marcatori numerati interattivi (hover→nome documento, click→apre PDF alla
pagina / video al timestamp nel `#pdfPane`, + una sezione «Note e materiali» in fondo alla scheda).
La convenzione, il modello dati e le regole di validazione sono in **§5.9**. **Già implementato nel
lettore** (`App/StudIA.html`, 2026-07-22): retro-compatibile (deriva la lista note da
`sources[]`+`videoRefs[]` se manca `notes[]`). Manca solo il lato generazione (emettere i token).

---

## 4. Riepilogo delle due AI

| | Raggruppamento | Generazione contenuti |
|---|---|---|
| Dove | Node locale (detector) + 1 chiamata AI opzionale di rifinitura | Chiamate AI (una per corso) |
| Serve una chiave? | No per le euristiche; sì solo per la rifinitura | Sì |
| Provider | qualsiasi (via `ai/`) | qualsiasi (via `ai/`) |
| Output | `piano.json` | `Corsi/*.json` validati |

---

## 5. JSON: rigore, robustezza, precisione (SEZIONE CARDINE)

Obiettivo: i JSON prodotti dall'AI devono essere **sempre** conformi, senza campi spuri, senza tipi
sbagliati, senza titoli fuori convenzione. La strategia è "**schema unico + validazione doppia + riparazione
+ scrittura atomica**".

### 5.1 Fonte di verità unica
Creare la cartella `schema/` con due file **JSON Schema (draft 2020-12)**:
`schema/course.schema.json` e `schema/piano.schema.json`. Questi file sono l'**unica** definizione e vengono
usati in **tre** punti: (a) passati al provider come schema di structured output; (b) caricati da `validate.js`
(ajv) per validare l'output; (c) caricati da `validate_course.py` (libreria python `jsonschema`) per la CLI.
Nessuna regola va duplicata a mano nel codice: se cambia, cambia solo qui.

### 5.2 `schema/course.schema.json` (contenuto richiesto)
Vincoli da codificare esplicitamente:
- Ovunque `"additionalProperties": false` e `"required"` completo → niente campi extra, niente campi mancanti.
- `corso`: richiede `id, schema, title, chapters`. `schema` = `{"const": 1}`. `title` deve iniziare col numero
  del modulo: `"pattern": "^\\d{1,3}[ .:–-]"`. `chapters` = array `minItems: 1`.
- `id` (corso e capitolo): slug `"pattern": "^[a-z0-9]+(?:-[a-z0-9]+)*$"`.
- `capitolo`: richiede `id, title, brief, html, keypoints, quiz`. `title` **non** deve iniziare con una cifra:
  `"pattern": "^(?!\\d)"`. `brief` stringa non vuota (`minLength: 1`). `keypoints` = array di stringhe
  `minItems: 2`. `glossary` = array di `{ t, d }` (entrambe stringhe, `additionalProperties:false`).
- `quiz`: array; ogni item è un'**unione discriminata** su `type` (usare `oneOf` con `additionalProperties:false`):
  ```jsonc
  // single
  { "type": {"const":"single"}, "q": {"type":"string","minLength":1},
    "options": {"type":"array","items":{"type":"string"},"minItems":2},
    "answer": {"type":"integer","minimum":0},
    "explain": {"type":"string"} }              // required: type,q,options,answer  — VIETATO 'answer' booleano
  // tf
  { "type": {"const":"tf"}, "q": {"type":"string","minLength":1},
    "answer": {"type":"boolean"},
    "explain": {"type":"string"} }              // required: type,q,answer — VIETATO il campo 'options'
  ```
  Così lo schema stesso impedisce il bug storico (indice al posto del booleano nei `tf`, e viceversa).
- `sources`: array di `{ pdf:string, page:integer≥1, label:string }`, `additionalProperties:false`.
- `videoRefs`: array di `{ video:string, t:number≥0, label:string }`, `additionalProperties:false`.

### 5.3 Controlli semantici (oltre allo schema) — in `validate.js`
JSON Schema non copre tutto; aggiungere un passo `semanticCourse(obj)` che verifica:
1. **`single.answer < options.length`** (l'indice deve puntare a un'opzione esistente).
2. **HTML in allowlist**: `html` può contenere SOLO `<p> <ul> <li> <strong> <em> <h3>` e
   `<details class="level"><summary data-tag="…"><div class="body">…`. Passare l'HTML in un parser con
   allowlist (es. `sanitize-html` con configurazione stretta): se compaiono tag/attributi non ammessi →
   errore (non silenziosamente rimossi, così l'AI impara a non produrli).
3. **Titoli**: capitolo non inizia con cifra; corso inizia con "NN "; il numero del corso coincide con il
   prefisso del `courseFile` e col gruppo di `piano.json`.
4. **Unicità**: `id` dei capitoli unici dentro il corso; `id` del corso non già presente in `Corsi/` (a meno
   di rigenerazione esplicita dello stesso gruppo).
5. **Coerenza fonti**: ogni `sources[].pdf` esiste in `Fonti/` e `page ≤ npages` (da `Indice-PDF`).

### 5.4 Normalizzazione prima della validazione
Un passo `normalizeCourse(obj)` **conservativo**: trim degli spazi, collasso di spazi multipli nel testo,
coercizione solo di casi non ambigui (es. `answer:"0"` → `0` per i `single`). Mai "indovinare": se un `tf` ha
`answer:"vero"` la si rifiuta, non la si interpreta. La normalizzazione riduce i falsi negativi senza mascherare
errori veri.

### 5.5 Ciclo genera → valida → ripara → (quarantena)
```
1. generateStructured({system, messages, schema: course.schema}) del provider
2. normalizeCourse → validate.js (ajv) → semanticCourse
3. se errori: UNA chiamata di riparazione, passando gli errori in chiaro
   ("Il JSON ha questi problemi: …; restituisci SOLO il JSON corretto")
4. rivalidare; se ancora invalido: NON scrivere il corso. Marca il gruppo status="errore",
   salva il tentativo in Corsi/_scarti/<file>.invalid.json e logga gli errori. Continua col resto.
```
Non si scrive **mai** un corso non validato in `Corsi/`.

### 5.6 Serializzazione deterministica e scrittura atomica
- Ordine delle chiavi stabile (serializzatore con ordinamento fisso), UTF-8, `indent` 1–2, newline finale.
- Scrittura atomica: `.tmp` + `rename` (come già fa `ingest.py`). Mai lasciare un `.json` a metà.
- Idempotenza: rigenerare lo stesso gruppo produce lo stesso `courseFile` (sovrascrittura pulita), non doppioni.

### 5.7 `schema/piano.schema.json` (stesso rigore)
- `groups[]` `minItems:1`. Gruppo: richiede `id, title, status, members`. `status` = `enum`
  `["proposto","approvato","generato","errore"]`. `title` `pattern "^\\d"` (ha il numero). `courseFile`
  `pattern "\\.json$"`.
- `members[]` `minItems:1`. Membro: richiede `source, type`. `type` = `enum ["pdf","video"]`.
  `pages` = `oneOf`: `{"const":"all"}` **oppure** array di coppie `[[int≥1,int≥1]]`. `additionalProperties:false`.
- `validatePiano(obj)` in `validate.js`; controllo semantico: ogni `source` esiste in `Fonti/`; per i `pdf` con
  range, `page` entro `npages`.

### 5.8 Structured output per provider (mappare lo stesso schema)
`ai/*.js` traducono `schema` nel meccanismo nativo del provider:
- **OpenAI**: `response_format: { type:"json_schema", json_schema:{ name, strict:true, schema } }` (strict).
- **Google Gemini**: `generationConfig:{ responseMimeType:"application/json", responseSchema:<schema> }`
  (sottoinsieme OpenAPI dello schema — l'adattatore adatta ciò che serve).
- **Anthropic**: un `tool` con `input_schema:<schema>` + `tool_choice` forzato su quel tool.
In tutti e tre i casi, dopo la risposta si applica comunque §5.3–5.5. Lo schema resta uno solo; cambia solo la
"busta" per infilarlo nel provider.

### 5.9 Note inline (citazioni `[[n]]`) — modello dati + validazione
La citazione precisa è **il** valore didattico: dal testo si salta al PDF alla pagina esatta o al video al
minuto esatto per approfondire. Il lettore è già pronto (§3.5); qui si fissa cosa deve **generare** l'AI e cosa
deve **validare** il main.

**Modello dati (preferito).** Aggiungere al capitolo un array unico ordinato:
```jsonc
"notes": [
  { "type": "pdf",   "pdf": "04 … .pdf", "page": 12, "label": "04 · La dislessia" },
  { "type": "video", "video": "05 … .mp4", "t": 754, "label": "05 · Capire la lettura strumentale" }
]
```
Il numero `n` del token = **posizione 1-based in `notes[]`**. `label` = nome mostrato in hover e nella sezione
in fondo. `page` = pagina fisica (§3.2); `t` = secondi (§3.3). Retro-compat: se `notes[]` manca, il lettore
deriva la lista da `sources[]`+`videoRefs[]` (prima i pdf, poi i video) — ma per la **generazione nuova usare
`notes[]`**, che rende il legame numero→fonte esplicito e validabile.

**Token nel testo.** Dentro `brief`/`html`, l'AI inserisce `[[n]]` **subito dopo** l'affermazione che quella
fonte sostiene (es. `…un disturbo specifico della lettura [[1]].`). Testo semplice dentro i tag ammessi →
**nessuna modifica all'allowlist HTML** (§5.3). Il marcatore interattivo lo costruisce il lettore.

**Validazione (in `validate.js`, passo semantico §5.3).**
1. Estrarre ogni `[[n]]` da `brief`+`html` con `/\[\[(\d{1,3})\]\]/g`.
2. **Nessun marcatore orfano**: ogni `n` estratto deve avere `1 ≤ n ≤ notes.length` → altrimenti **errore**
   (non scrivere il corso; ciclo di riparazione §5.5).
3. **Ogni nota citata almeno una volta** (avviso, non blocco): una nota mai referenziata da `[[n]]` è sospetta.
4. **Coerenza fonte** (riusa §5.3.5): per `pdf`, `page ≤ npages` da `Indice-PDF`; il file esiste in `Fonti/`.
   Per `video`, il file esiste; `t ≥ 0`.
5. Lo **schema** (`course.schema.json`) codifica `notes[]` come `oneOf` discriminato su `type`
   (`additionalProperties:false`, `required` completo), stesso rigore di `sources`/`videoRefs` (§5.2).

**Prompt di generazione** (`prompts/course.md`, §10): istruire il modello a (a) popolare `notes[]` con le fonti
effettivamente usate per quel capitolo (pagina/minuto precisi), (b) disseminare `[[n]]` nel testo dove servono,
(c) non inventare pagine/minuti non presenti nel contesto assemblato. Few-shot con un esempio corretto.

---

## 6. Componente A — Impostazioni + chiavi API (multi-provider)

**File:** `main.js` (IPC), `preload.js` (`settings`), pannello Impostazioni nel renderer.
- IPC `settings:get` (ritorna la config **senza** le chiavi in chiaro: solo `{aiProvider, genModel,
  embedProvider, granularity, hasKey:{anthropic,openai,google}}`) e `settings:set`.
- `settings:testKey` (provider) → chiamata minima per validare la chiave del provider scelto; ok/errore leggibile.
- `settings:listModels` (opzionale) → elenco modelli suggeriti per provider (anche solo una lista statica editabile).
- UI: pannello (ingranaggio in topbar, coerente col design system): selettore **Provider** (Anthropic/OpenAI/
  Google), campo chiave per il provider attivo (password), scelta `genModel`, `embedProvider`, slider
  granularità, tetto di spesa. Una schermata calma, niente muri di testo.
- Sicurezza: chiavi solo in `config.json` (userData), mai nel vault/git. `.gitignore` del vault verificato.
  Miglioramento futuro (non bloccante): keychain macOS via `keytar`.

**Test:** per ogni provider, chiave finta → errore chiaro; chiave vera → ok; cambio provider → il resto del
codice non cambia comportamento.

---

## 7. Componente B — Detector di raggruppamento (Node, offline)

**File nuovo:** `grouping.js`. **Input:** `Indice-PDF/*.json` + `Trascrizioni/*.json` + lista `Fonti/`.
**Output:** cluster candidati con, per ogni accoppiamento, il *perché*. Deterministico, niente API.

- **Layer A — euristiche nomi/titoli (prima, istantaneo, senza trascrizione):** numero iniziale del file;
  marcatori di serie ("parte prima/seconda/terza", "Prima/Seconda Parte", "BDA 16-30 - Le prove di …");
  sovrapposizione di parole salienti nei titoli (stopword IT); accoppiamento PDF-teoria + video-spiegazione.
- **Layer B — similarità testo (fase 2):** se `embedProvider≠none`, usa `ai.embed()` sul testo dei materiali;
  altrimenti **TF-IDF + coseno in JS puro**. Soglia di merge pilotata da `granularity` (`atomico`=soglia alta,
  pochi merge; `tematico`=soglia bassa). Questo è il significato tecnico della levetta.

**Test:** propone almeno i blocchi ovvi (31–35, 36–38, famiglia dislessia, coppie PDF+video) con motivazioni.

---

## 8. Componente C — Proposta AI settabile → `piano.json`

**File nuovo:** `propose.js` + `prompts/grouping.md`.
- Input al modello: candidati di §7 + `granularity` + profilo utente (ADHD/autismo/APC → unità piccole) +
  convenzione titoli. **Structured output** con `schema/piano.schema.json`. Nessun contenuto di capitolo qui.
- Salva `piano.json` (atomico), validato con §5.7.
- Degradazione offline: senza chiave, `piano.json` costruito dalle sole euristiche. L'AI qui *rifinisce*.

---

## 9. Componente D — Editor del piano (renderer, accessibile)

**File:** pannello nel renderer + IPC `plan:get`/`plan:save` (che rivalida con §5.7 prima di salvare).
- Gruppi come schede (design system: bordi chiari, callout, niente glow). Per gruppo: titolo, sottotitolo,
  membri come chip, motivazione. Azioni: **unisci**, **separa**, **sposta** membro, **rinomina**, e per ogni
  membro PDF il campo **pagine** (`all` o range; mostra `npages`). Assorbe lo "step 3 modale selezione pagine".
- Levetta **granularità** → ricalcola (§7/§8). Salva → `piano.json`, gruppi `approvato`.
- Accessibilità: un pannello per volta, azioni esplicite, no drag-drop obbligatorio in v1, sempre visibile
  "cosa succede / cosa manca".

---

## 10. Componente E — Generazione corsi via API

**File nuovo:** `generate.js` + `prompts/course.md` + `validate.js` (§5).
Per ogni gruppo `approvato`:
1. **Assembla contesto**: per ogni membro, testo delle pagine selezionate da `Indice-PDF` (o "all") e/o
   `segments` da `Trascrizioni`, con etichette di provenienza (file + pagina/timestamp) per i `sources`.
2. **`generateStructured`** (provider attivo) con `prompts/course.md` come system prompt = regole di §5 +
   adattamento ADHD/autismo/APC + un esempio buono esistente (few-shot, es. `td74-05-dislessia.json`) +
   `schema: course.schema`.
3. **Ciclo §5.5** (normalizza → ajv → semantico → 1 riparazione → altrimenti quarantena).
4. **Sources**: `page` = pagina fisica usata (mappatura diretta). `videoRefs`: preferibilmente lasciati a
   `index_videos` (gira già in `reindex_courses`); documentare la scelta.
5. **Scrivi** `Corsi/<courseFile>.json` (atomico). Gruppo `generato`. Esporre IPC `courses:reload` per
   ricaricare il lettore senza riavvio.

**Contesto lungo:** se il testo supera la finestra, map-reduce (estrai/riassumi per pezzi, poi genera).

**Test (milestone chiave M3):** generare UN corso, validarlo, aprirlo nel lettore, verificare la qualità con l'utente.

---

## 11. Componente F — Modalità autonoma "Genera tutto"

**File:** `run.js` + IPC `run:all`, `run:cancel`.
- Percorre i gruppi `status≠generato`, genera con **concorrenza 1–2** (rate limit + CPU). Riusa lo **stesso
  protocollo** `@FILE/@SUB` → la **status-bar esistente** mostra tutto senza nuova UI.
- **Prima di partire**: `ai.estimateCost(...)` sull'insieme + **modale di conferma**; rispetta `monthlyBudgetUsd`
  come soft cap con avviso.
- **Resumable** (salta `generato`); errore su un gruppo → logga e continua. Backoff/retry su 429/5xx.

---

## 12. Riconciliazione media + riproduzione video (DECISIONE)

Il flusso nuovo indica **tutto in `Fonti/`** (PDF + video); `Media/` è solo il fallback browser di `VIDEO_BASE`.
**Azioni:** standardizzare su `Fonti/`; i .mp4 spostati in `Media/` in una sessione precedente **vanno rimessi
in `Fonti/`**; chiarire nel lettore che `VIDEO_BASE` è solo per il browser; opzionale: far scansionare a
`ingest.py` anche `Media/` come fallback.

---

## 13. Sicurezza e costi (checklist)

- Chiavi: solo nel main, solo in `config.json` (userData), mai nel renderer/vault/git. `.gitignore` verificato.
- Anteprima costo + conferma prima di ogni batch. Dry-run possibile. Log dei token per provider/sessione.
- Rate limit: backoff esponenziale; cap di concorrenza.
- Degradazione senza chiave: ingestione e raggruppamento euristico funzionano comunque.
- Validazione: §5.5, nessun JSON non validato scritto in `Corsi/`.

---

## 14. Ordine di implementazione (milestone testabili)

- **M1** — §5 `schema/*.json` + `validate.js` (ajv) + §6 Impostazioni/chiavi/`testKey` per i 3 provider +
  `ai/provider.js` con almeno un adattatore. (Fonda tutto.)
- **M2** — §7 detector euristico → `piano.json` (senza AI) + visualizzatore minimo.
- **M3** — §10 generazione di **UN** corso da un gruppo, con ciclo di validazione/riparazione, salvataggio,
  apertura nel lettore. *(Prova il valore centrale: fermarsi e verificare la qualità con l'utente.)*
- **M4** — §9 editor del piano + §8 proposta AI.
- **M5** — §11 batch autonomo + anteprima costo + resume + riuso status-bar.
- **M6** — §7 layer B (embeddings/TF-IDF), gli altri due adattatori provider, §12 riconciliazione media,
  rifinitura accessibilità.

Ogni milestone è consegnabile da solo. Non passare a M(n+1) senza aver testato M(n).

---

## 15. File nuovi / modificati

**Nuovi:** `schema/course.schema.json`, `schema/piano.schema.json`, `validate.js`,
`ai/provider.js`, `ai/anthropic.js`, `ai/openai.js`, `ai/google.js`,
`grouping.js`, `propose.js`, `generate.js`, `run.js`,
`prompts/grouping.md`, `prompts/course.md`.
**Modificati:** `main.js` (IPC settings/plan/generate/run; wiring `ai/`), `preload.js`
(esporre `settings`, `plan`, `generate`, `run`, `courses:reload`), `App/StudIA.html`
(pannello Impostazioni, editor-piano, riuso status-bar, `courses:reload`), `package.json`
(`ajv`, `ajv-formats`, `sanitize-html`, `@anthropic-ai/sdk`, `openai`, `@google/generative-ai` in
`dependencies`; eventuale `keytar`), `validate_course.py` (caricare `schema/course.schema.json`).
**Riusati as-is:** `ingest.py`, `index_videos.py`, schema in `reference/schema.md` della skill (come guida testuale).

---

## 16. Decisioni da confermare con l'utente (Claude Code: chiedere all'inizio)

1. **Provider di default** (Anthropic / OpenAI / Google) e **modello** per la generazione + **tetto di spesa**.
2. **Embeddings**: usarne uno (OpenAI/Google) per la similarità o restare su TF-IDF? (Default: TF-IDF, zero costi.)
3. **Chiavi**: `config.json` (semplice) o keychain macOS (`keytar`)? (Default: `config.json`.)
4. **`Media/`**: eliminarla e tenere tutto in `Fonti/`? (Consiglio: sì.)
5. **`videoRefs`**: dall'AI o da `index_videos`? (Consiglio: `index_videos`.)
6. **Granularità di default**: `atomico` (consigliato per il profilo).

---

## 17. Nota per Claude Code

Prima di scrivere codice, **rileggi** `main.js`, `preload.js`, `ingest.py` e l'HTML del lettore per gli agganci
(righe in §1). Non duplicare l'ingestione: è completa e resumable. Il cuore del lavoro nuovo è: (a) chiavi/AI
multi-provider nel main dietro l'interfaccia `ai/`; (b) **rigore JSON** di §5 — schema unico, validazione ajv +
semantica, riparazione, scrittura atomica, mai scrivere output non validato; (c) `piano.json` settabile che
scollega struttura e generazione; (d) batch autonomo che riusa la status-bar. Mantieni ogni schermata calma e a
fuoco singolo: è un requisito d'uso, non estetica.
