/*
 * StudIA - ZAINO — studiare sui propri materiali: documenti, appunti, mappe e un tutor AI.
 * Copyright (C) 2026 Giacomo Meschini
 *
 * This program is free software: you can redistribute it and/or modify it under
 * the terms of the GNU General Public License as published by the Free Software
 * Foundation, either version 3 of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A
 * PARTICULAR PURPOSE. See the GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License along with
 * this program. If not, see <https://www.gnu.org/licenses/>.
 *
 * ⚠️ Il testo che vale è quello inglese, nel file LICENSE. In breve: questo programma
 * è software libero; puoi usarlo, studiarlo, modificarlo e ridistribuirlo, e chi
 * riceve una copia — anche modificata — deve poter avere il codice sorgente con la
 * stessa libertà. Il sorgente sta su https://github.com/gmesc/StudIA-ZAINO
 */
// Sorgente del preload sandbox; genera preload.js con node bin/preload.js.
const { contextBridge, ipcRenderer, webUtils } = require('electron');
const cfg = ipcRenderer.sendSync('cfg:get') || {};
const vaultPath = cfg.vaultPath || null;
const sync = (gruppo, metodo, ...args) => ipcRenderer.sendSync('vault:sync', {gruppo, metodo, args});
const iniziale = sync('iniziale', 'leggi') || {};
// Il renderer consegna un File: una stringa inventata non concede accesso al disco.
function selezionato(file) {
  try {
    const percorso = webUtils.getPathForFile(file);
    if (!percorso) return null;
    const risposta = ipcRenderer.sendSync('file:selezionato', {percorso});
    return risposta && risposta.ok ? {percorso, cartella:!!risposta.cartella} : null;
  } catch (_) { return null; }
}
function percorsoDi(file) { return selezionato(file)?.percorso || ''; }
function verificaFile(file) {
  const percorso = percorsoDi(file);
  if (!percorso) return {ok:false,error:'Scegli o trascina un file dal computer.',cartella:false};
  return ipcRenderer.sendSync('file:verifica', {percorso});
}
const vaultApi = {
  hasElectron: true,
  path: vaultPath,
  lessons: [],
  courses: [],
  // gli schemi video:NN / pdf:NN si risolvono prima sui materiali dei corsi, poi su quelli del vault
  // globali: ripiego per i vault a corpus unico, dove i numeri non hanno corso
  mediaByNum: {},
  pdfByNum: {},
  numeriPerCorso: iniziale.numeriPerCorso || {},   // e queste sono quelle che contano
  srcUrl: (file, id) => sync('materiali', 'srcUrl', file, id),
  /* Mostra un file nel Finder. Prende ciò che il renderer ha per mano — un
     `file://` — e la conversione a percorso la fa il main, insieme al controllo
     che stia dentro il vault. */
  reveal: (quale) => ipcRenderer.invoke('file:reveal', quale),
  /* Dov'è il vault, in chiaro e in sola lettura. Serve a due cose concrete: le
     prove sull'app viva, che devono poter verificare di stare lavorando sulla
     COPIA e non sul vault vero (prima lo leggevano dalla config dell'utente —
     e con l'istanza di prova che ha una config sua quella lettura mentirebbe),
     e i comandi che mostrano un file nel Finder. Non è una porta di scrittura:
     è una stringa. */
  vaultPath: vaultPath,
  choose: () => ipcRenderer.invoke('vault:choose'),
  // con `corso` l'elenco è quello del corso, non di tutto il vault
  corpus: { list: (corso) => ipcRenderer.invoke('corpus:list', { corso }) },
  /* Salva come PDF: il renderer manda il documento già impaginato, il main lo
     stampa in una finestra invisibile e lo scrive dove dice il dialogo.
     ⚠️ UNA sola chiave `stampa` in questo oggetto: due chiavi uguali in un
     letterale non sono due cose — l'ultima vince e la prima sparisce senza un
     errore, ed è già costato due funzioni mute il 13 agosto. */
  stampa: {
    pdf: (o) => ipcRenderer.invoke('stampa:pdf', o || {}),
    mostra: (percorso) => ipcRenderer.invoke('stampa:mostra', { percorso: percorso })
  },
  /* La guida illustrata dello ZAINO, in una finestra sua. Sta dentro l'app
     (`App/guida-zaino/`) e non su disco accanto al vault: dev'esserci anche
     sul computer di chi installa il pacchetto e non ha mai visto questo repo. */
  guida: { apri: () => ipcRenderer.invoke('guida:apri') },
  schede: {
    stato: (corso) => ipcRenderer.invoke('schede:stato', { corso }),
    build: (corso, rifai) => ipcRenderer.send('schede:build', { corso, rifai }),
    onProgress: (cb) => { const h = (e, d) => cb(d); ipcRenderer.on('schede:progress', h); return () => ipcRenderer.removeListener('schede:progress', h); },
    onDone: (cb) => { const h = (e, d) => cb(d); ipcRenderer.on('schede:done', h); return () => ipcRenderer.removeListener('schede:done', h); },
    onError: (cb) => { const h = (e, d) => cb(d); ipcRenderer.on('schede:error', h); return () => ipcRenderer.removeListener('schede:error', h); }
  },
  plan: {
    get: (corso) => ipcRenderer.invoke('plan:get', { corso }),
    save: (corso, piano) => ipcRenderer.invoke('plan:save', { corso, piano }),
    approve: (corso) => ipcRenderer.invoke('plan:approve', { corso }),
    propose: (corso, granularita) => ipcRenderer.send('plan:propose', { corso, granularita }),
    // correzioni al taglio delle lezioni, dal composer: sposta/unisci/separa/rinomina
    comando: (corso, azione, indice, valore) => ipcRenderer.invoke('plan:comando', { corso, azione, indice, valore }),
    // i canali nuovi restituiscono la funzione per disiscriversi (a differenza di ingest.on*)
    onProgress: (cb) => { const h = (e, d) => cb(d); ipcRenderer.on('plan:progress', h); return () => ipcRenderer.removeListener('plan:progress', h); },
    onDone: (cb) => { const h = (e, d) => cb(d); ipcRenderer.on('plan:done', h); return () => ipcRenderer.removeListener('plan:done', h); },
    onError: (cb) => { const h = (e, d) => cb(d); ipcRenderer.on('plan:error', h); return () => ipcRenderer.removeListener('plan:error', h); }
  },
  ingest: {
    start: (opts) => ipcRenderer.send('ingest:start', opts || {}),
    onProgress: (cb) => ipcRenderer.on('ingest:progress', (e, d) => cb(d)),
    onDone: (cb) => ipcRenderer.on('ingest:done', (e, d) => cb(d)),
    onError: (cb) => ipcRenderer.on('ingest:error', (e, d) => cb(d)),
    onLog: (cb) => ipcRenderer.on('ingest:log', (e, d) => cb(d))
  },
  keys: {
    status: () => ipcRenderer.invoke('keys:status'),
    set: (provider, value) => ipcRenderer.invoke('keys:set', { provider, value }),
    clear: (provider) => ipcRenderer.invoke('keys:clear', { provider })
  },
  costs: {
    summary: () => ipcRenderer.invoke('costs:summary'),
    log: (entry) => ipcRenderer.invoke('costs:log', entry)
  },
  /* l'Atlante delle opzioni: leve, direttive vere ed esempi, composti nel main */
  atlante: () => ipcRenderer.invoke('profilo:atlante'),
  /* crediti e licenze: l'inventario sta su disco, non nel renderer */
  crediti: {
    leggi: () => ipcRenderer.invoke('crediti:leggi'),
    chromium: () => ipcRenderer.invoke('crediti:chromium'),
    notice: (percorso) => ipcRenderer.invoke('crediti:notice', { percorso: percorso || '' })
  },
  notes: {
    leggi: id => sync('notes','leggi',id), list: id => sync('notes','list',id),
    save: (id,file,meta,body,opt) => sync('notes','save',id,file,meta,body,opt),
    rename: (id,file,titolo) => sync('notes','rename',id,file,titolo),
    remove: (id,file) => ipcRenderer.invoke('note:rimuovi',{corso:id,file}).then(r=>!!(r&&r.ok)),
    reindex: id => sync('notes','reindex',id), versioni: (id,file) => sync('notes','versioni',id,file),
    cartellaVersioni: id => sync('notes','cartellaVersioni',id), indexPath: id => sync('notes','indexPath',id)
  },
  evidenze: {
    leggi: id => sync('evidenze','leggi',id), salva: (id,voci) => sync('evidenze','salva',id,voci),
    aggiungi: (id,voce) => sync('evidenze','aggiungi',id,voce), rimuovi: (id,voce) => sync('evidenze','rimuovi',id,voce),
    colora: (id,voce,colore) => sync('evidenze','colora',id,voce,colore),
    postilla: (id,voce,testo) => sync('evidenze','postilla',id,voce,testo),
    tratta: (id,voce,tratto) => sync('evidenze','tratta',id,voce,tratto),
    creaStrato: (id,nome) => sync('evidenze','creaStrato',id,nome),
    rinominaStrato: (id,strato,nome) => sync('evidenze','rinominaStrato',id,strato,nome),
    rimuoviStrato: (id,strato,dove) => sync('evidenze','rimuoviStrato',id,strato,dove),
    identita: voce => sync('evidenze','identita',voce)
  },
  album: {
    elenco: (id,origine) => sync('album','elenco',id,origine),
    percorsoDi,
    heic: percorso => sync('album','heic',percorso),
    heicDisponibile: () => !!iniziale.heicDisponibile,
    SENZA_HEIC: iniziale.senzaHeic || '',
    salva: (id,voce) => sync('album','salva',id,voce),
    rinomina: (id,voce,didascalia) => sync('album','rinomina',id,voce,didascalia),
    usi: (id,voce) => sync('album','usi',id,voce),
    rimuovi: (corso,id,opt) => ipcRenderer.invoke('album:rimuovi',{corso,id,opt}),
    srcUrl: (corso,id,quale) => sync('album','srcUrl',corso,id,quale)
  },
  // Le mappe passano dal main; solo i nodi per la ricerca richiedono risposta sincrona.
  mappe: {
    // elenco leggero (titoli e conteggi): i nodi arrivano solo con apri()
    elenco: (corso) => ipcRenderer.invoke('mappe:elenco', { corso }),
    nodi: corso => sync('mappe','nodi',corso),
    apri: (corso, file) => ipcRenderer.invoke('mappe:apri', { corso, file }),
    // `file` assente = mappa nuova; il nome scelto torna in `{ file }`
    salva: (corso, file, mappa) => ipcRenderer.invoke('mappe:salva', { corso, file, mappa }),
    rimuovi: (corso, file) => ipcRenderer.invoke('mappe:rimuovi', { corso, file }),
    // rinomina cambia il titolo dentro la mappa E il nome del file: restano d'accordo
    rinomina: (corso, file, titolo) => ipcRenderer.invoke('mappe:rinomina', { corso, file, titolo }),
    // «Modifica una copia»: il grafo è quello di MappaGenera.daCapitolo/daLezione
    semina: (corso, grafo, meta) => ipcRenderer.invoke('mappe:semina', { corso, grafo, meta })
  },
  profile: {read: () => ({}), save: () => ({ok:false,error:'Funzione CORSI non disponibile in StudIA - ZAINO.'})},
  prefs: {read: () => sync('prefs','read'), save: o => sync('prefs','save',o)},
  // lettura ad alta voce con la sintesi di sistema: vede anche le voci premium,
  // che a Web Speech dentro Chromium non arrivano
  voce: {
    disponibile: !!iniziale.voceDisponibile,
    elenco: () => ipcRenderer.invoke('voce:elenco'),
    // sintetizza un blocco su file e ne restituisce l'URL: la riproduzione la fa
    // il renderer con un <audio>, così l'avvio di say non cade fra un blocco e l'altro
    rendi: (segmenti, nome, velocita, chiave) => ipcRenderer.invoke('voce:rendi', { segmenti, voce: nome, velocita, chiave }),
    scarta: () => ipcRenderer.invoke('voce:scarta')
  },
  // corsi, brief e materiali passano dal main: scrittura atomica + un solo posto che tocca il vault
  course: {
    create: (nome, brief) => ipcRenderer.invoke('course:create', { nome, brief }),
    list: () => ipcRenderer.invoke('course:list'),
    // un corso in un file solo: per passarlo a qualcuno che non ha questo vault
    export: (corso, appunti) => ipcRenderer.invoke('course:export', { corso, appunti }),
    import: () => ipcRenderer.invoke('course:import'),
    // espansione di un corso già finito: che c'è di nuovo, e che cosa è rotto
    expandStato: (corso) => ipcRenderer.invoke('expand:stato', { corso }),
    onExportProgress: (cb) => {
      const h = (e, d) => cb(d);
      ipcRenderer.on('course:export:progress', h);
      return () => ipcRenderer.removeListener('course:export:progress', h);
    }
  },
  brief: {
    get: (corso) => ipcRenderer.invoke('brief:get', { corso }),
    set: (corso, brief) => ipcRenderer.invoke('brief:set', { corso, brief })
  },
  // Claude Code come motore: nessuna chiave, si usa l'abbonamento
  claudecode: {
    diagnosi: () => ipcRenderer.invoke('claudecode:diagnosi')
  },
  // quali modelli esistono davvero oggi, chiesti all'API del fornitore
  modelli: {
    aggiorna: (fornitore) => ipcRenderer.invoke('models:refresh', { fornitore }),
    cache: (fornitore) => ipcRenderer.invoke('models:cache', { fornitore })
  },
  // M5 — scalette alternative e scrittura dei capitoli
  scaletta: {
    proponi: (corso, folder, nCapitoli, nAlternative) => ipcRenderer.invoke('scaletta:proponi', { corso, folder, nCapitoli, nAlternative }),
    // tutte insieme, per il composer: una chiamata per lezione, con avanzamento
    tutte: (corso, opts) => ipcRenderer.send('scalette:tutte', Object.assign({ corso }, opts || {})),
    onProgress: (cb) => { const h = (e, d) => cb(d); ipcRenderer.on('scalette:progress', h); return () => ipcRenderer.removeListener('scalette:progress', h); },
    onDone: (cb) => { const h = (e, d) => cb(d); ipcRenderer.on('scalette:done', h); return () => ipcRenderer.removeListener('scalette:done', h); },
    onError: (cb) => { const h = (e, d) => cb(d); ipcRenderer.on('scalette:error', h); return () => ipcRenderer.removeListener('scalette:error', h); }
  },
  /* Gli zaini: la modalità in cui si studia sui propri documenti. L'API è corta
     perché lo è il concetto — un contenitore e i suoi PDF. Appunti, mappe e
     album dello zaino NON passano da qui: usano i loro canali di sempre con
     l'id dello zaino al posto di quello del corso. */
  zaino: {
    gruppiLeggi: (corso, sezione) => ipcRenderer.invoke('zaino:gruppi-leggi', { corso, sezione }),
    gruppiSalva: (corso, stato, sezione) => ipcRenderer.invoke('zaino:gruppi-salva', { corso, stato, sezione }),
    list: () => ipcRenderer.invoke('zaino:list'),
    create: (nome) => ipcRenderer.invoke('zaino:create', { nome }),
    /* Torna `{ id, title, spostato }`: `id` è quello NUOVO — quando il titolo
       cambia lo slug, cambia anche la cartella, e chi chiama deve riagganciarsi
       a quello o continuerebbe a scrivere in una cartella che non c'è più. */
    rinomina: (id, nome) => ipcRenderer.invoke('zaino:rinomina', { id, nome }),
    elimina: (id) => ipcRenderer.invoke('zaino:elimina', { id })
  },
  /* Il segno di lettura di ogni documento. Sta nel vault e non nel
     `localStorage` perché è un fatto del documento, non della macchina: lo
     zaino passato a un altro computer si riapre dove l'avevi lasciato. */
  /* Le fonti di un contenitore: portarle dentro e indicizzarle.
     ⚠️ `percorsoDi` esiste perché da Electron 32 un `File` trascinato non ha
     più `.path`: il percorso vero lo dà `webUtils.getPathForFile`, e senza
     quello un documento trascinato non si potrebbe copiare — si potrebbe solo
     leggerne il contenuto e riscriverlo, cioè fare la stessa cosa in peggio. */
  fonti: {
    verifica: verificaFile,
    /* ⚠️ `set` — il ruolo dichiarato di una fonte, che scrive il wizard — stava
       in un SECONDO blocco `fonti:` più in su nello stesso oggetto letterale.
       Due chiavi uguali in un letterale non sono due cose: l'ultima vince e la
       prima sparisce per intero, senza un errore. Il wizard chiamava
       `window.vault.fonti.set(...)` dietro una guardia che controlla l'oggetto
       `fonti` — che c'era — e moriva di TypeError sul `.set`: il ruolo scelto
       non arrivava mai in `_corso.md`, e l'utente non vedeva niente. Il canale
       nel main era vivo e intatto da sempre. */
    set: (corso, fonti) => ipcRenderer.invoke('fonti:set', { corso, fonti }),
    percorsoDi,
    eCartella: file => !!selezionato(file)?.cartella,
    importa: (corso, percorsi) => ipcRenderer.invoke('fonti:importa', { corso, percorsi }),
    /* Togliere una fonte: il file va nel Cestino di sistema e resta una traccia
       del suo contenuto, così se lo stesso documento torna riprende il nome e il
       numero di prima e il lavoro che ci stava sopra si riaggancia da sé. */
    elimina: (corso, file) => ipcRenderer.invoke('fonti:elimina', { corso, file }),
    /* Cambiare il nome di un documento: il NUMERO resta — è quello che scrivono
       i rimandi `pdf:03#p=7` — e il nome per esteso si riscrive dove è citato
       (evidenze, ritagli, appunti, mappe, lapidi, e l'indice del documento). */
    rinomina: (corso, file, titolo) => ipcRenderer.invoke('fonti:rinomina', { corso, file, titolo }),
    rimossi: (corso) => ipcRenderer.invoke('fonti:rimossi', { corso }),
    usi: (corso, file) => ipcRenderer.invoke('fonti:usi', { corso, file }),
    dimentica: (corso, impronta) => ipcRenderer.invoke('fonti:dimentica', { corso, impronta }),
    indiceServe: (corso, file) => ipcRenderer.invoke('fonti:indiceServe', { corso, file }),
    indiceScrivi: (corso, file, pagine, motore) =>
      ipcRenderer.invoke('fonti:indiceScrivi', { corso, file, pagine, motore }),
    indici: (corso) => ipcRenderer.invoke('fonti:indici', { corso })
  },
  /* Il testo dentro le fotografie: il renderer rasterizza le pagine (pdf.js e
     il canvas stanno da lui), il main riconosce con Tesseract e scrive il layer
     invisibile nella copia del PDF. Vedi lib/ocrpdf.js. */
  ocrpdf: {
    apri: () => ipcRenderer.invoke('ocrpdf:apri'),
    pagina: (png, larghezzaPx, altezzaPx) =>
      ipcRenderer.invoke('ocrpdf:pagina', { png, larghezzaPx, altezzaPx }),
    chiudi: () => ipcRenderer.invoke('ocrpdf:chiudi'),
    applica: (corso, file, pagine) => ipcRenderer.invoke('ocrpdf:applica', { corso, file, pagine })
  },
  /* Il ripasso: la storia di che cosa hai già risposto, e come. Vive in
     `RIPASSO/stato.json` dentro il contenitore — cartella dell'utente, come gli
     appunti: una rigenerazione del corso non la tocca. */
  ripasso: {
    leggi: (corso) => ipcRenderer.invoke('ripasso:leggi', { corso }),
    /* Scrive TUTTO lo stato: lo usa «azzera avanzamento», e le prove per
       ripartire da un terreno pulito. Le risposte singole passano da
       `registra`, che non richiede al renderer di sapere com'è fatta una voce. */
    salva: (corso, carte) => ipcRenderer.invoke('ripasso:salva', { corso, carte }),
    /* L'id della carta lo calcola il main: la formula dell'identità sta in un
       posto solo (`lib/ripasso.js`), e qui si mandano capitolo e domanda. */
    registra: (corso, capitolo, domanda, esito) =>
      ipcRenderer.invoke('ripasso:registra', { corso, capitolo, domanda, esito }),
    pota: (corso, vive) => ipcRenderer.invoke('ripasso:pota', { corso, vive }),
    /* Gli id delle carte che esistono adesso: la vista di ripasso ci appaia la
       storia letta dal disco. Non tocca niente — è solo la formula, che vive di
       là perché il renderer non ha `crypto`. */
    ids: (vive) => ipcRenderer.invoke('ripasso:ids', { vive })
  },
  lettura: {
    leggi: (corso) => ipcRenderer.invoke('lettura:leggi', { corso }),
    segna: (corso, file, pagina) => ipcRenderer.invoke('lettura:segna', { corso, file, pagina })
  },
  /* Il segno di ASCOLTO: lo stesso patto del segno di lettura, per i secondi.
     Sta nel vault e non nel `localStorage` perché è un fatto del materiale, non
     della macchina: lo zaino aperto su un altro computer riprende la lezione
     dov'era rimasta. */
  ascolto: {
    leggi: (corso) => ipcRenderer.invoke('ascolto:leggi', { corso }),
    segna: (corso, file, secondo) => ipcRenderer.invoke('ascolto:segna', { corso, file, secondo })
  },
  /* A che RIGA si era arrivati in un appunto: il terzo gemello di `lettura` e
     `ascolto`. Passa dal main come gli altri due — il segno sta nel vault, non
     nel `localStorage`, perché è un fatto del contenuto e viaggia con lui. */
  riga: {
    leggi: (corso) => ipcRenderer.invoke('riga:leggi', { corso }),
    segna: (corso, file, riga) => ipcRenderer.invoke('riga:segna', { corso, file, riga }),
    dimentica: (corso, file) => ipcRenderer.invoke('riga:dimentica', { corso, file })
  },
  /* I media di un contenitore: i video e gli audio che l'utente porta dentro.
     ⚠️ `percorsoDi` è quello delle fonti, e per la stessa ragione — da Electron
     32 un `File` trascinato non ha più `.path`. Sta anche qui perché chi
     trascina un video non deve sapere che la funzione vive sotto «fonti»: due
     gesti gemelli, due porte gemelle. */
  media: {
    /* ⚠️ Stessa storia di `fonti.set`: `list` — l'elenco dei video da
       trascrivere — viveva in un secondo blocco `media:` più in su, schiacciato
       da questo. Il modale «Trascrivi i video» si apriva e restava piantato su
       «Carico l'elenco…»: il TypeError è sincrono e scappa PRIMA che esista una
       Promise, quindi nemmeno il `.catch` lo raccoglieva. */
    list: () => ipcRenderer.invoke('media:list'),
    percorsoDi,
    importa: (corso, percorsi) => ipcRenderer.invoke('media:importa', { corso, percorsi }),
    elenco: (corso) => ipcRenderer.invoke('media:elenco', { corso }),
    elimina: (corso, file) => ipcRenderer.invoke('media:elimina', { corso, file }),
    usi: (corso, file) => ipcRenderer.invoke('media:usi', { corso, file })
  },
  /* Composer degli indici: righe = lezioni, colonne = indici proposti, e gli otto
     personaggi che si trascinano sulle card. Lo stato arriva in un colpo solo —
     piano, scalette in cache, percorsi già salvati — perché il composer si apre
     sempre su un corso intero, mai su una lezione sola. */
  composer: {
    stato: (corso) => ipcRenderer.invoke('composer:stato', { corso })
  },
  percorsi: {
    list: (corso) => ipcRenderer.invoke('percorsi:list', { corso }),
    save: (corso, percorsi) => ipcRenderer.invoke('percorsi:save', { corso, percorsi }),
    // le coppie lezione+indice: quante sono, quanto è già scritto, quanto costa il resto
    coppie: (corso) => ipcRenderer.invoke('percorsi:coppie', { corso }),
    // la scrittura vera: una cartella per coppia, `03-delega--per-domande`
    capitoli: (corso, opts) => ipcRenderer.send('percorsi:capitoli', Object.assign({ corso }, opts || {})),
    // si ferma con lo stesso interruttore della generazione singola: la coda è una sola
    ferma: (corso) => ipcRenderer.send('gen:cancel', { corso }),
    onCapProgress: (cb) => { const h = (e, d) => cb(d); ipcRenderer.on('percorsi:cap:progress', h); return () => ipcRenderer.removeListener('percorsi:cap:progress', h); },
    onCapLog: (cb) => { const h = (e, d) => cb(d); ipcRenderer.on('percorsi:cap:log', h); return () => ipcRenderer.removeListener('percorsi:cap:log', h); },
    onCapDone: (cb) => { const h = (e, d) => cb(d); ipcRenderer.on('percorsi:cap:done', h); return () => ipcRenderer.removeListener('percorsi:cap:done', h); },
    onCapError: (cb) => { const h = (e, d) => cb(d); ipcRenderer.on('percorsi:cap:error', h); return () => ipcRenderer.removeListener('percorsi:cap:error', h); }
  },
  gen: {
    stima: (corso, folder, capitoli) => ipcRenderer.invoke('gen:stima', { corso, folder, capitoli }),
    // accoda: i capitoli nuovi vanno in fondo, senza rinumerare quelli già scritti
    start: (corso, folder, capitoli, accoda) => ipcRenderer.send('gen:start', { corso, folder, capitoli, accoda: !!accoda }),
    cancel: (corso) => ipcRenderer.send('gen:cancel', { corso }),
    // ogni ascolto restituisce la funzione per smettere di ascoltare
    onProgress: (cb) => { const h = (e, d) => cb(d); ipcRenderer.on('gen:progress', h); return () => ipcRenderer.removeListener('gen:progress', h); },
    onLog: (cb) => { const h = (e, d) => cb(d); ipcRenderer.on('gen:log', h); return () => ipcRenderer.removeListener('gen:log', h); },
    onDone: (cb) => { const h = (e, d) => cb(d); ipcRenderer.on('gen:done', h); return () => ipcRenderer.removeListener('gen:done', h); },
    onError: (cb) => { const h = (e, d) => cb(d); ipcRenderer.on('gen:error', h); return () => ipcRenderer.removeListener('gen:error', h); }
  },
  files: {
    pick: () => ipcRenderer.invoke('files:pick'),
    import: (paths) => ipcRenderer.invoke('files:import', { paths }),
    pathOf: percorsoDi
  },
  // importazione di un'intera cartella: prima si guarda, poi si copia
  cartella: {
    pick: () => ipcRenderer.invoke('import:pick'),
    // con `corso` i materiali atterrano dentro di lui e la numerazione riparte da 01
    scan: (cartella, forzati, corso) => ipcRenderer.invoke('import:scan', { cartella, forzati, corso }),
    apply: (cartella, forzati, corso) => ipcRenderer.invoke('import:apply', { cartella, forzati, corso })
  },
  // com'è fatta la macchina: motore AI, Python, spazio, modello di trascrizione
  ambiente: {
    rileva: () => ipcRenderer.invoke('ambiente:rileva')
  },
  /* La lettura avanzata dei documenti: si installa se si vuole, e l'app
     funziona identica senza. `installa` è un flusso lungo con avanzamento,
     quindi eventi e non una promessa che tace per un quarto d'ora. */
  ocr: {
    stato: () => ipcRenderer.invoke('ocr:stato'),
    // quante pagine e quante ore, PDF per PDF: si vede prima di installare
    stima: (corso) => ipcRenderer.invoke('ocr:stima', { corso }),
    installa: (conModello) => ipcRenderer.send('ocr:installa', { conModello: conModello !== false }),
    rimuovi: () => ipcRenderer.invoke('ocr:rimuovi'),
    // la rilettura vera: ore di lavoro, quindi eventi e un modo per fermarla
    leggi: (corso, scelte) => ipcRenderer.send('ocr:leggi', { corso, scelte }),
    ferma: (corso) => ipcRenderer.send('ocr:ferma', { corso }),
    onLeggiProgress: (cb) => { const h = (e, d) => cb(d); ipcRenderer.on('ocr:leggiProgress', h); return () => ipcRenderer.removeListener('ocr:leggiProgress', h); },
    onLeggiLog: (cb) => { const h = (e, d) => cb(d); ipcRenderer.on('ocr:leggiLog', h); return () => ipcRenderer.removeListener('ocr:leggiLog', h); },
    onLeggiDone: (cb) => { const h = (e, d) => cb(d); ipcRenderer.on('ocr:leggiDone', h); return () => ipcRenderer.removeListener('ocr:leggiDone', h); },
    onLeggiError: (cb) => { const h = (e, d) => cb(d); ipcRenderer.on('ocr:leggiError', h); return () => ipcRenderer.removeListener('ocr:leggiError', h); },
    onProgress: (cb) => { const h = (e, d) => cb(d); ipcRenderer.on('ocr:progress', h); return () => ipcRenderer.removeListener('ocr:progress', h); },
    onLog: (cb) => { const h = (e, d) => cb(d); ipcRenderer.on('ocr:log', h); return () => ipcRenderer.removeListener('ocr:log', h); },
    onDone: (cb) => { const h = (e, d) => cb(d); ipcRenderer.on('ocr:done', h); return () => ipcRenderer.removeListener('ocr:done', h); },
    onError: (cb) => { const h = (e, d) => cb(d); ipcRenderer.on('ocr:error', h); return () => ipcRenderer.removeListener('ocr:error', h); }
  },
  onboarding: {
    skipped: () => ipcRenderer.invoke('profile:skipped'),
    skip: () => ipcRenderer.invoke('profile:skip'),
    // il primo avvio è una cosa sola, il profilo un'altra: due flag distinti
    stato: () => ipcRenderer.invoke('onboarding:stato'),
    fatto: (v) => ipcRenderer.invoke('onboarding:fatto', { fatto: v !== false }),
    /* «I requisiti per generare gli sono già stati mostrati»: è la domanda del
       primo ingresso nei CORSI, non quella del primo avvio dell'app. */
    pipelineVista: (v) => ipcRenderer.invoke('onboarding:pipelineVista', { vista: v !== false })
  }
};
// Il guscio condiviso conserva i nomi delle vecchie funzioni CORSI, senza capacità.
const nonDisponibile = () => ({ok:false,error:'Funzione CORSI non disponibile in StudIA - ZAINO.'});
for (const nome of ['schede','plan','ingest','course','brief','claudecode','modelli','scaletta','composer','percorsi','gen','files','cartella','ocr']) {
  for (const metodo of Object.keys(vaultApi[nome] || {})) vaultApi[nome][metodo] = metodo.startsWith('on') ? () => () => {} : () => Promise.resolve(nonDisponibile());
}
vaultApi.course.list = async () => [];
vaultApi.percorsi.list = async () => [];
vaultApi.onboarding.stato = async () => ({fatto:true,profiloSaltato:true,pipelineVista:true});
vaultApi.ambiente.rileva = async () => ({});
/* PONTI_GENERATI */
contextBridge.exposeInMainWorld('vault', vaultApi);
