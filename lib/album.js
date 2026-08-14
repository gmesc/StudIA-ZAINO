'use strict';
/**
 * album — le immagini che l'utente ritaglia dai documenti, su disco.
 *
 * Vivono in `Corsi/<corso>/ALBUM/`: i file d'immagine più `_album.json`, che è
 * l'indice. La cartella è dell'UTENTE, ed è quella scelta che decide tutto il
 * resto — la pipeline non ci scrive mai, un corso protetto resta aperto a chi ci
 * studia sopra (qui non si passa da `corsi.assicuraScrivibile()`, esattamente
 * come per appunti e mappe), e l'esportazione la porta o la lascia a casa con lo
 * stesso interruttore degli appunti.
 *
 * ⚠️ Da non confondere con `MATERIALI/Figure/`, che sono i ritagli di Chandra.
 * Quelli sono DERIVATI: si rifanno rileggendo il PDF, e infatti la pipeline li
 * rigenera. Questi no — li ha scelti una persona, trascinando il mouse su una
 * pagina, e se si perdono sono persi. È l'unica ragione per cui due mucchi di
 * immagini stanno in due posti diversi, e vale la pena ricordarla prima di
 * «semplificare» unendoli.
 *
 * ── Le tre regole che tengono in piedi il resto ────────────────────────────
 *
 * 1. **Il rettangolo si salva in coordinate della PAGINA**, mai dello schermo.
 *    Un rettangolo in pixel di schermo è vero solo per lo zoom con cui è stato
 *    disegnato: riaperto al 200% indicherebbe un altro punto della pagina. Le
 *    coordinate della pagina invece non hanno uno zoom — sono il documento.
 *
 * 2. **Chi usa un'immagine la REFERENZIA, non la copia.** Negli appunti si
 *    scrive `![didascalia](album:<id>)`, sulla mappa il nodo porta l'id. Da qui
 *    discendono due cose: l'id dev'essere corto e stabile (§ `identita`), e
 *    cancellare non può essere un gesto silenzioso (§ `usi` e `rimuovi`).
 *
 * 3. **Il nome del file non cambia mai più.** La didascalia sì (`rinomina`), il
 *    file no: vedi la nota su `rinomina`, che è il punto in cui questo modulo si
 *    comporta diversamente da `appunti.js` e da `mappe.js`.
 *
 * E due regole prese in prestito da `appunti.js`, per le stesse ragioni già
 * pagate là: si scrive in modo atomico (tmp + rename), e un errore di lettura
 * non si traduce mai in «nessuna immagine» — la cartella assente è l'unico caso
 * in cui l'elenco vuoto è la verità. Qui non si lancia: si ripara e si racconta.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const corsiLib = require('./corsi');   // la radice dei corsi: `Corsi/`, o `Progetti/` nei vault mai migrati
// `writeAtomic`, `nomeValido`, `safeName`, `nomeSicuro` sono già scritti e
// provati là: le stesse domande hanno una risposta sola, e una seconda copia
// sarebbe la copia destinata a divergere. È già la scelta di `mappe.js`.
const appunti = require('./appunti');
const mappe = require('./mappe');      // il nome della cartella `MAPPE/`, dichiarato in un posto solo

const CARTELLA = 'ALBUM';
const INDICE = '_album.json';

/** Versione della forma dell'indice. Si alza solo quando la forma cambia
 *  davvero: costa una riga oggi ed è la sola cosa che rende economico il
 *  cambiamento domani, quando in giro ci saranno album di età diverse. È la
 *  stessa ragione del `formato` delle mappe. */
const FORMATO = 1;

/**
 * Quanto possono discostarsi due rettangoli e restare LO STESSO ritaglio: sei
 * punti tipografici per ciascuno dei quattro numeri.
 *
 * Il punto è 1/72 di pollice, cioè 0,35 mm: sei punti sono 2,1 mm sulla pagina
 * stampata, e sullo schermo — dove pdf.js disegna intorno a 1,5× — una dozzina
 * di pixel. È la misura della mano: due trascinamenti attorno alla stessa figura
 * non danno mai gli stessi decimali, e chiedere l'uguaglianza esatta vorrebbe
 * dire riempire l'album di doppioni identici a occhio.
 *
 * Sopra questa soglia invece i due ritagli sono due gesti diversi: prendere lo
 * schema, e prendere lo schema con la sua didascalia sotto, differiscono di ben
 * più di due millimetri.
 */
const TOLLERANZA = 6;
/** Quanto possono distare due fermi immagine per essere lo stesso: mezzo secondo. */
const TOLLERANZA_T = 0.5;

/** I formati che il renderer può consegnare da un canvas, e come si chiama il
 *  file che ne esce. Un `type` fuori da questi tre non si scrive: un file che
 *  nessuno sa disegnare non è un'immagine, è un byte in più nel vault. */
const TIPI = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp', 'image/gif': '.gif' };

/** Le due provenienze di un'immagine, ed è la differenza che decide tutto il
 *  resto di questo file:
 *
 *   `ritaglio`  un rettangolo preso da un documento o da un fermo immagine: sa
 *               da quale materiale e da quale punto viene, e ci si può tornare.
 *   `foto`      un'immagine portata dentro dall'utente: non viene da nessun
 *               punto, e la sua identità sono i BYTE.
 *
 * Stanno nello stesso archivio e nello stesso indice apposta. Due cartelle
 * vorrebbero dire due spazi di identità, due grammatiche di rimando (`album:<id>`
 * non deve sapere che cosa ha dietro) e due voci nell'esportazione. Le viste
 * dell'app sono due — «Ritagli» e «Album Foto» — ma sono due FILTRI, non due
 * mucchi. */
const ORIGINI = ['ritaglio', 'foto'];

/** Le miniature delle foto, in una sottocartella di `ALBUM/`. Solo le foto ne
 *  hanno una: un ritaglio è già piccolo, una foto da dodici megapixel dentro una
 *  card da 104px è una decodifica intera per un francobollo. Sta DENTRO `ALBUM/`
 *  perché l'esportazione porta via la cartella intera: una sorella di `ALBUM/`
 *  sarebbe da aggiungere a `pacchetto.js`, e prima o poi la si dimenticherebbe. */
const MINI = '_mini';

/* ------------------------------------------------------------- vocabolario */

function str(v) { return v == null ? '' : String(v); }

/** Un numero vero, o `null`. ⚠️ Qui non basta `+v`: `+null`, `+''` e `+false`
 *  valgono 0, cioè un rettangolo inchiodato nell'angolo della pagina da un campo
 *  che era semplicemente vuoto. È la stessa scala di `mappe.coord`, e per la
 *  stessa ragione. */
function numero(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string' && v.trim() !== '') { const n = +v; return Number.isFinite(n) ? n : null; }
  return null;
}

/** La pagina: un intero da 1 in su, come la conta chi legge. `null` se non lo è
 *  — una pagina 0 o «tre» non indica niente che si possa riaprire. */
function pagina(v) {
  const n = numero(v);
  if (n === null) return null;
  const i = Math.trunc(n);
  return i >= 1 ? i : null;
}

/**
 * Il SECONDO di un video: un numero da 0 in su, con un decimo di precisione.
 *
 * ⚠️ Un ritaglio viene da un **punto** del materiale, e il punto ha due forme:
 * la pagina di un documento e il secondo di un video. Non è la stessa cosa
 * scritta in due modi — una pagina parte da 1 e non ha decimali, un secondo
 * parte da 0 (il primo fotogramma) e ne ha. Confonderli vorrebbe dire ritagli
 * che dichiarano «pagina 0» o video che cominciano dal secondo 1.
 *
 * Un decimo è la precisione utile: sotto, due fotogrammi sono lo stesso istante
 * per chiunque guardi; sopra, si perde il fermo immagine che si voleva.
 */
function secondo(v) {
  const n = numero(v);
  if (n === null || n < 0) return null;
  return Math.round(n * 10) / 10;
}

/** Il punto da cui viene un ritaglio, in una forma sola per chi ordina e
 *  confronta: `{ tipo:'pagina'|'tempo', valore }`, o `null` se non c'è. */
function punto(v) {
  const t = (v && v.t != null) ? secondo(v.t) : null;
  if (t !== null) return { tipo: 'tempo', valore: t };
  const p = pagina(v && v.pagina);
  if (p !== null) return { tipo: 'pagina', valore: p };
  return null;
}

/** `2:12`, come lo legge chi guarda un video. */
function minutoSecondo(t) {
  const n = Math.max(0, Math.floor(secondo(t) || 0));
  return Math.floor(n / 60) + ':' + String(n % 60).padStart(2, '0');
}

/**
 * Il rettangolo sulla pagina. `null` se non è un rettangolo.
 *
 * Le larghezze negative si RADDRIZZANO invece di essere rifiutate: trascinare da
 * destra a sinistra, o dal basso verso l'alto, è un gesto normale, e un modulo
 * che risponde «rettangolo non valido» a un gesto normale sta solo scaricando su
 * chi chiama un lavoro di due righe. Larghezza o altezza a zero invece no: non è
 * un ritaglio storto, è un ritaglio che non contiene niente.
 */
function normalizzaRect(r) {
  const o = r || {};
  let x = numero(o.x), y = numero(o.y), w = numero(o.w), h = numero(o.h);
  if (x === null || y === null || w === null || h === null) return null;
  if (w < 0) { x += w; w = -w; }
  if (h < 0) { y += h; h = -h; }
  if (!(w > 0) || !(h > 0)) return null;
  return { x, y, w, h };
}

/**
 * L'identità di un ritaglio: il materiale, la pagina e il rettangolo arrotondato
 * al punto intero, in dieci cifre esadecimali.
 *
 * Perché arrotondare al PUNTO e non ai decimali: i decimali di un trascinamento
 * a mano sono rumore del mouse, non informazione — due gesti sulla stessa figura
 * danno `312.4083…` e `312.9137…`, e un id costruito su quei numeri sarebbe
 * diverso ogni volta. Il punto tipografico (0,35 mm) è già più fine di quanto
 * una mano possa controllare: sotto quella soglia non c'è niente da distinguere.
 *
 * ⚠️ Ma l'arrotondamento da solo NON decide se due ritagli sono lo stesso, e
 * questa è la correzione alla regola scritta nel piano. Qualunque griglia ha dei
 * bordi: con un passo di 6 punti, 8,9 e 9,1 — due decimi di punto di distanza —
 * cadono in celle diverse e produrrebbero due immagini per lo stesso gesto (è
 * aritmetica, non un caso limite raro: il bordo di ogni cella è un punto in cui
 * la regola si rovescia). Perciò l'id è il NOME del ritaglio, corto e stabile, e
 * a decidere se il ritaglio è già in album è `gemello`, che confronta le
 * distanze — dove un bordo non c'è.
 *
 * Dieci cifre sono quaranta bit: in un album da mille immagini la probabilità di
 * due id uguali è dell'ordine di 4·10⁻⁷, e la stringa resta corta abbastanza da
 * poterla scrivere a mano dentro `![…](album:…)` senza guardarla due volte.
 */
function identita(v) {
  const r = normalizzaRect(v && v.rect) || { x: 0, y: 0, w: 0, h: 0 };
  const pt = punto(v);
  /* ⚠️ Il punto entra nel seme con il suo TIPO: senza, la pagina 12 di un PDF e
     il secondo 12 di un video darebbero lo stesso id per due immagini diverse. */
  const semi = [str(v && v.materiale), pt ? pt.tipo : '-', pt ? pt.valore : 0,
    Math.round(r.x), Math.round(r.y), Math.round(r.w), Math.round(r.h)].join('␟');
  return crypto.createHash('sha1').update(semi).digest('hex').slice(0, 10);
}

/**
 * L'identità di una FOTO: i suoi byte.
 *
 * Un ritaglio si riconosce dal gesto (materiale, punto, rettangolo); una foto
 * non ha nessuna delle tre cose — viene da fuori, e l'unica cosa che è
 * davvero *lei* è il suo contenuto. Da qui discende gratis la stessa regola che
 * i ritagli hanno con `gemello`: la stessa immagine trascinata due volte non fa
 * due voci, e non importa come si chiamava il file la seconda volta.
 *
 * Dieci cifre come per i ritagli, e per la stessa ragione: l'id si scrive a mano
 * dentro `![…](album:…)`, e i due tipi di immagine devono stare nello stesso
 * spazio di nomi — chi legge un rimando non deve sapere che cosa ha dietro.
 */
function identitaByte(buf) {
  return crypto.createHash('sha1').update(buf).digest('hex').slice(0, 10);
}

/** Un id è una stringa esadecimale e nient'altro. Serve a due cose: evitare di
 *  scandire mezzo corso per un id che non può essere in nessun indice, e
 *  chiudere la porta a un `../` che arrivasse da fuori. La difesa vera resta che
 *  il nome del file lo dà l'INDICE, mai il chiamante — questa è la seconda
 *  mandata, non l'unica. */
function idValido(id) { return /^[0-9a-f]{6,40}$/.test(str(id)); }

/* -------------------------------------------------------------- i byte veri */

/** La firma del formato dichiarato. Serve perché `Buffer.from(x, 'base64')` non
 *  solleva mai: davanti a base64 storto restituisce byte qualsiasi, e senza
 *  questo controllo un `data:image/png;base64,questo-non-è-base64` finirebbe su
 *  disco come immagine — visibile nell'album, impossibile da aprire. */
function firmaOk(buf, ext) {
  if (ext === '.png') {
    return buf.length > 24 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
      buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a;
  }
  if (ext === '.jpg') return buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  if (ext === '.webp') {
    return buf.length > 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP';
  }
  /* GIF87a e GIF89a: le due versioni esistenti, e la seconda è quella animata.
     Si accettano tutt'e due com'è arrivata — una GIF che passasse da un canvas
     tornerebbe indietro come fotogramma unico, cioè non sarebbe più lei. */
  if (ext === '.gif') {
    return buf.length > 6 && buf.toString('ascii', 0, 3) === 'GIF' &&
      (buf.toString('ascii', 3, 6) === '87a' || buf.toString('ascii', 3, 6) === '89a');
  }
  return false;
}

/**
 * Le misure vere di un PNG, lette dall'IHDR. `null` se non le si trova.
 *
 * `w` e `h` servono a chi disegna l'album per riservare il posto senza caricare
 * l'immagine, e MISURARLE è diverso da farsele dichiarare: un numero sbagliato
 * qui è un riquadro della forma sbagliata, e nessuno andrebbe a cercarne la
 * causa in un campo copiato per fiducia. L'IHDR è il primo chunk e sta sempre
 * allo stesso posto — 8 byte di firma, 4 di lunghezza, 4 di tipo, poi larghezza
 * e altezza come interi a 32 bit.
 *
 * Solo PNG, che è ciò che un canvas produce di default. Per JPEG e WebP si crede
 * a chi le dichiara: estrarle vorrebbe dire scrivere un pezzo di decodificatore
 * per ciascuno, e il costo non lo vale finché il renderer manda PNG.
 */
function misuraPng(buf) {
  if (buf.length < 24 || buf.toString('ascii', 12, 16) !== 'IHDR') return null;
  const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
  return (w > 0 && h > 0) ? { w, h } : null;
}

const RE_DATAURL = /^data:(image\/[a-z0-9.+-]+);base64,([\s\S]+)$/i;

/** Da data URL a byte: `{ buf, ext, w, h }`, oppure `{ error }`. Non lancia. */
function daDataUrl(dati) {
  const m = RE_DATAURL.exec(str(dati).trim());
  if (!m) return { error: 'i byte dell\'immagine non sono un data URL base64' };
  const ext = TIPI[m[1].toLowerCase()];
  if (!ext) return { error: 'formato non supportato: ' + m[1] };
  const buf = Buffer.from(m[2].replace(/\s+/g, ''), 'base64');
  if (!buf.length) return { error: 'l\'immagine è vuota' };
  if (!firmaOk(buf, ext)) return { error: 'i byte non sono un\'immagine ' + m[1] };
  const misura = ext === '.png' ? misuraPng(buf) : null;
  return { buf, ext, w: misura ? misura.w : 0, h: misura ? misura.h : 0, error: '' };
}

/* ------------------------------------------------------------------- dove */

/** ⚠️ Il corso è una cartella dentro `Corsi/`, non un percorso: senza questa
 *  guardia un `../..` uscirebbe dal vault. La domanda è la stessa che
 *  `appunti.nomeValido` fa sui nomi di file — una foglia, non una strada — e la
 *  risposta si prende da lì invece di riscriverla. */
const corsoValido = appunti.nomeValido;

function dir(vaultPath, courseId) { return path.join(corsiLib.cartella(vaultPath, courseId), CARTELLA); }
function percorso(vaultPath, courseId) { return path.join(dir(vaultPath, courseId), INDICE); }

function stem(nome) { return str(nome).replace(/\.[A-Za-z0-9]{1,5}$/, ''); }
function tre(n) { return String(n).padStart(3, '0'); }

/**
 * Il nome del file: da quale documento, da quale pagina, e l'id.
 *
 * Ricalca la forma che `ocr.py` usa per le figure (`03 dispensa__p007_f2.webp`),
 * perché chi apre la cartella nel Finder legge le due cose che gli servono senza
 * aprire niente. La didascalia NON c'è, ed è deliberato: è la sola parte che
 * cambia, e un nome che contenesse una cosa mutevole obbligherebbe a rinominare
 * il file — cioè a spostare l'identità sotto i piedi di chi la referenzia.
 */
function nomeFile(voce, ext) {
  const base = appunti.safeName(stem(voce.materiale)).slice(0, 60).trim();
  /* Una foto non ha un punto da scrivere nel nome: al suo posto il prefisso
     `foto`, che nel Finder distingue a colpo d'occhio le due popolazioni della
     stessa cartella. */
  if (voce.origine === 'foto') return 'foto ' + appunti.nomeSicuro(base, 'immagine') + '_' + voce.id + ext;
  const pt = punto(voce);
  /* `__p007_` per una pagina, `__t0132_` per il secondo 132: due prefissi
     diversi perché nel Finder si legge il nome, e «132» senza lettera davanti
     sarebbe una pagina centotrentadue di un video che non ha pagine. */
  const dove = (pt && pt.tipo === 'tempo')
    ? '__t' + String(Math.floor(pt.valore)).padStart(4, '0')
    : '__p' + tre(pt ? pt.valore : 0);
  return appunti.nomeSicuro(base, 'ritaglio') + dove + '_' + voce.id + ext;
}

/** Una didascalia che manca non lascia una riga muta nell'album: si dice da dove
 *  viene l'immagine, che è l'unica cosa vera che si sa di lei. Stessa scelta di
 *  `appunti.nota`, che un appunto senza titolo lo chiama col nome del file. */
function didascaliaDiRipiego(voce) {
  // di una foto si sa una cosa sola: come si chiamava il file da cui è entrata
  if (voce.origine === 'foto') return stem(voce.materiale);
  const pt = punto(voce);
  if (pt && pt.tipo === 'tempo') return stem(voce.materiale) + ' — ' + minutoSecondo(pt.valore);
  return stem(voce.materiale) + ' — p. ' + (pt ? pt.valore : '?');
}

/* -------------------------------------------------------------- normalizza */

/**
 * Una voce comunque arrivata (dal renderer, dall'indice, da una mano che ha
 * modificato il JSON) rimessa in forma. `null` se non è un ritaglio: senza
 * materiale, senza pagina o senza rettangolo non si saprebbe né che cos'è né
 * come rifarlo.
 *
 * ⚠️ `id` e `file` si CONSERVANO come sono arrivati, non si ricalcolano. Sembra
 * il contrario di ciò che vuole la regola d'identità, e invece la difende: il
 * giorno in cui l'arrotondamento cambiasse, ricalcolare in lettura darebbe id
 * nuovi a immagini vecchie e ogni `![…](album:…)` scritto negli appunti
 * indicherebbe il vuoto. L'id lo decide `salva`, una volta sola, quando
 * l'immagine nasce; da lì in poi è un nome proprio.
 */
function normalizzaVoce(v) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const materiale = str(v.materiale).trim();
  if (!materiale) return null;
  const w = numero(v.w), h = numero(v.h);
  const base = {
    id: str(v.id),
    file: str(v.file),
    /* ⚠️ `origine` si SCRIVE sempre, anche sui ritagli, invece di lasciarla
       dedurre dall'assenza degli altri campi: un indice deve dire che cos'è
       ciascuna riga, non farlo indovinare a chi lo rilegge fra un anno. Le voci
       vecchie non ce l'hanno e diventano «ritaglio», che è ciò che sono. */
    origine: str(v.origine) === 'foto' ? 'foto' : 'ritaglio',
    materiale,
    didascalia: str(v.didascalia).trim(),
    creato: str(v.creato),
    // 0 vuol dire «non si sa»: meglio di un numero inventato, che chi disegna
    // userebbe per riservare un posto della forma sbagliata
    w: w !== null && w > 0 ? Math.round(w) : 0,
    h: h !== null && h > 0 ? Math.round(h) : 0
  };

  /* Una FOTO non ha né punto né rettangolo, e chiederglieli vorrebbe dire
     inventarle una pagina che non esiste. `materiale` per lei è il nome del file
     da cui è entrata — la sola cosa vera che si sa della sua provenienza — e la
     miniatura è l'unico campo in più. */
  if (base.origine === 'foto') {
    /* ⚠️ `mini` è un PERCORSO dentro `ALBUM/`, e va validato come tale: chi
       salva passa un data URL con lo stesso nome di campo, e senza questo
       controllo quel data URL finirebbe scritto nell'indice come se fosse un
       file — una riga che punta a un'immagine inesistente, e nessuno saprebbe
       da dove viene. Ed è la stessa difesa del campo `file`: una foglia di
       `_mini/`, non una strada che esca dalla cartella. */
    const mini = str(v.mini).trim();
    if (/^_mini\/[A-Za-z0-9][A-Za-z0-9._-]*$/.test(mini)) base.mini = mini;
    return base;
  }

  const pt = punto(v);
  const rect = normalizzaRect(v.rect);
  if (!pt || !rect) return null;
  base.rect = rect;
  /* Si scrive SOLO il campo che vale: una voce con `pagina` e `t` insieme
     direbbe due punti diversi, e chi la rilegge sceglierebbe a caso. */
  if (pt.tipo === 'tempo') base.t = pt.valore; else base.pagina = pt.valore;
  return base;
}

/** L'ordine dell'album: per documento, poi per pagina, poi per quando è stato
 *  ritagliato. È l'ordine in cui l'utente ha sfogliato il PDF, cioè quello in cui
 *  si aspetta di ritrovare le immagini. */
function perOrdine(a, b) {
  /* Le foto stanno dopo i ritagli nell'indice, e fra loro in ordine di nome:
     sono due popolazioni con due criteri — un ritaglio si cerca per «da dove
     viene», una foto per «come si chiama». */
  const oa = a.origine === 'foto' ? 1 : 0, ob = b.origine === 'foto' ? 1 : 0;
  if (oa !== ob) return oa - ob;
  const m = str(a.materiale).localeCompare(str(b.materiale), 'it');
  if (m) return m;
  const pa = punto(a), pb = punto(b);
  const va = pa ? pa.valore : 0, vb = pb ? pb.valore : 0;
  if (va !== vb) return va - vb;
  return str(a.creato).localeCompare(str(b.creato));
}

/** Due ritagli abbastanza vicini da essere lo stesso gesto: tutti e quattro i
 *  numeri entro `TOLLERANZA`. Basta che uno solo sia più lontano perché siano due
 *  ritagli diversi — un lato spostato di un centimetro è una scelta, non un
 *  tremolio. */
function vicini(a, b) {
  return Math.abs(a.x - b.x) <= TOLLERANZA && Math.abs(a.y - b.y) <= TOLLERANZA &&
    Math.abs(a.w - b.w) <= TOLLERANZA && Math.abs(a.h - b.h) <= TOLLERANZA;
}

/** Il ritaglio già in album che corrisponde a questo, o `null`. È qui che si
 *  decide l'identità di fatto: `identita` dà il nome, `gemello` dà la risposta. */
function gemello(voci, voce) {
  /* Una foto il suo gemello ce l'ha nell'id, che sono i byte: se c'è già
     un'immagine con quell'id è LA STESSA immagine, comunque si chiamasse il file
     da cui è arrivata. Niente rettangoli da confrontare. */
  if (voce.origine === 'foto') return voci.find((x) => x.origine === 'foto' && x.id === voce.id) || null;
  const pv = punto(voce);
  for (const x of voci) {
    if (x.materiale !== voce.materiale) continue;
    const px = punto(x);
    if (!px || !pv || px.tipo !== pv.tipo) continue;
    /* Sulla pagina il punto o è lo stesso o non lo è. Sul tempo no: fermare un
       video due volte non dà mai lo stesso millisecondo, e chiedere l'uguaglianza
       esatta vorrebbe dire un doppione a ogni ritaglio ripetuto. Mezzo secondo è
       la precisione della mano su una barra di scorrimento — la stessa idea dei
       sei punti tipografici sul rettangolo. */
    if (px.tipo === 'pagina' ? px.valore !== pv.valore : Math.abs(px.valore - pv.valore) > TOLLERANZA_T) continue;
    if (vicini(x.rect, voce.rect)) return x;
  }
  return null;
}

/* ------------------------------------------------------------------ indice */

/**
 * Legge `_album.json`. `{ voci, error }`.
 *
 * Distingue «non ce n'è» da «non si riesce a leggere»: dirle uguali vuol dire
 * mostrare un album vuoto a chi sta guardando un errore di permessi, e poi farlo
 * ricominciare da capo. Le voci rotte cadono una per una — una riga scritta male
 * non è un motivo per perdere le altre.
 */
function leggiIndice(vaultPath, courseId) {
  if (!corsoValido(courseId)) return { voci: [], error: 'corso non valido: ' + str(courseId) };
  let grezzo;
  try { grezzo = fs.readFileSync(percorso(vaultPath, courseId), 'utf-8'); }
  catch (e) { return { voci: [], error: e.code === 'ENOENT' ? '' : (e.message || 'lettura fallita') }; }
  let dati;
  try { dati = JSON.parse(grezzo); }
  catch (e) { return { voci: [], error: 'l\'indice dell\'album non è JSON valido' }; }
  const lista = Array.isArray(dati) ? dati : (dati && Array.isArray(dati.voci) ? dati.voci : []);
  const visti = new Set();
  const voci = [];
  for (const v of lista) {
    const o = normalizzaVoce(v);
    if (!o || !idValido(o.id) || visti.has(o.id)) continue;
    /* ⚠️ Il nome del file dev'essere una foglia di `ALBUM/`. Un indice
       modificato a mano — o costruito da chi non dovrebbe — con
       `"file": "../../APPUNTI/prezioso.md"` trasformerebbe `rimuovi` in una
       cancellazione fuori cartella, con la risposta «fatto». È il guasto già
       pagato dalle mappe (HANDOFF §5.2), qui su un'altra porta. */
    if (!appunti.nomeValido(o.file)) continue;
    visti.add(o.id);
    voci.push(o);
  }
  voci.sort(perOrdine);
  return { voci, error: '' };
}

/** Scrive l'indice, ordinato e indentato: è un file dell'utente, e deve poter
 *  essere letto a occhio e messo in un diff. Atomico come tutto il resto. */
function scriviIndice(vaultPath, courseId, voci) {
  const d = dir(vaultPath, courseId);
  const ordinate = voci.slice().sort(perOrdine);
  try {
    fs.mkdirSync(d, { recursive: true });
    appunti.writeAtomic(path.join(d, INDICE), JSON.stringify({ formato: FORMATO, voci: ordinate }, null, 2) + '\n');
  } catch (e) { return { error: e.message || 'scrittura dell\'indice fallita' }; }
  return { error: '' };
}

/**
 * L'album di un corso: `{ voci, error }`, in ordine.
 *
 * `origine` filtra la vista — `'ritaglio'` o `'foto'` — e senza torna tutto.
 * Il filtro sta QUI e non in chi disegna perché è una domanda sull'archivio, e
 * perché le due viste dell'app («Ritagli» e «Album Foto») devono partire dalla
 * stessa risposta: due filtri scritti in due posti divergono al primo campo
 * nuovo.
 */
function elenco(vaultPath, courseId, origine) {
  const letto = leggiIndice(vaultPath, courseId);
  const o = str(origine);
  if (!o || ORIGINI.indexOf(o) < 0 || letto.error) return letto;
  return { voci: letto.voci.filter((v) => v.origine === o), error: '' };
}

/** Una voce sola, per id. `null` se non c'è. */
function voce(vaultPath, courseId, id) {
  const letto = leggiIndice(vaultPath, courseId);
  if (letto.error || !idValido(id)) return null;
  return letto.voci.find((v) => v.id === str(id)) || null;
}

/** Il percorso su disco dell'immagine, o `''`. Il nome del file viene
 *  dall'indice e non da chi chiama: è la ragione per cui un id malevolo qui non
 *  porta da nessuna parte — semplicemente non corrisponde a niente. */
function percorsoImmagine(vaultPath, courseId, id) {
  const v = voce(vaultPath, courseId, id);
  return v ? path.join(dir(vaultPath, courseId), v.file) : '';
}

/** Il percorso della MINIATURA, o `''` se quella voce non ne ha. Chi disegna
 *  ripiega sull'immagine vera: una miniatura che manca è un francobollo in
 *  meno, non un guasto. */
function percorsoMini(vaultPath, courseId, id) {
  const v = voce(vaultPath, courseId, id);
  return (v && v.mini) ? path.join(dir(vaultPath, courseId), v.mini) : '';
}

/* --------------------------------------------------------------- scrittura */

/**
 * Salva un ritaglio. `{ voce, giaCera, error }`.
 *
 * La voce che arriva è `{ materiale, pagina, rect, didascalia, dati }`, dove
 * `dati` è il data URL prodotto dal canvas. `adesso` fissa l'istante di `creato`
 * (lo usano i test), come in `appunti.save` e `mappe.salva`.
 *
 * Ritagliare due volte la stessa area non fa due immagini: se il gemello c'è, si
 * torna quello e non si riscrive niente. ⚠️ Nemmeno la didascalia: cambiarla è
 * il mestiere di `rinomina`, e se `salva` la sovrascrivesse basterebbe passare
 * di nuovo sulla stessa figura per cancellare il nome che l'utente le aveva dato.
 *
 * `giaCera` risponde a «quest'area era già in album?», non a «ho scritto un
 * file?»: è la domanda che serve a chi disegna, per dire «già presente» invece
 * di «aggiunta».
 *
 * L'unico caso in cui un gemello viene comunque riscritto è il file mancante:
 * l'indice lo dichiara e su disco non c'è (una cancellazione dal Finder, una
 * copia incompleta). Lì riscriverlo è ripararlo, e l'id resta quello di prima —
 * così gli appunti che lo referenziano tornano a vedere qualcosa.
 */
function salva(vaultPath, courseId, ingresso, adesso) {
  const letto = leggiIndice(vaultPath, courseId);
  if (letto.error) return { voce: null, giaCera: false, error: letto.error };

  const v = normalizzaVoce(ingresso);
  if (!v) {
    return {
      voce: null, giaCera: false,
      error: (ingresso && str(ingresso.origine) === 'foto')
        ? 'la foto non dice da quale file viene'
        : 'il ritaglio non dice da quale documento, da quale pagina o da quale area viene'
    };
  }
  const d = dir(vaultPath, courseId);

  /* ⚠️ Per una FOTO i byte si leggono PRIMA di cercare il gemello, non dopo: il
     suo gemello È il suo contenuto, e senza i byte non si saprebbe nemmeno che
     cosa cercare. Per un ritaglio l'ordine resta l'altro — lì il gemello si
     riconosce dal gesto, e leggere un'immagine per scoprire che c'era già
     sarebbe lavoro buttato. */
  let img = null;
  if (v.origine === 'foto') {
    img = daDataUrl(ingresso && ingresso.dati);
    if (img.error) return { voce: null, giaCera: false, error: img.error };
    v.id = identitaByte(img.buf);
  }

  const gia = gemello(letto.voci, v);
  if (gia && fs.existsSync(path.join(d, gia.file))) return { voce: gia, giaCera: true, error: '' };

  // i byte si guardano PRIMA di toccare il disco: un data URL storto non deve
  // lasciare né un file a metà né una riga nell'indice che punta al nulla
  if (!img) {
    img = daDataUrl(ingresso && ingresso.dati);
    if (img.error) return { voce: null, giaCera: false, error: img.error };
  }

  const ora = str(adesso) || new Date().toISOString();
  const fatta = Object.assign({}, v, {
    id: gia ? gia.id : (v.origine === 'foto' ? v.id : identita(v)),
    creato: gia ? gia.creato : (v.creato || ora),
    didascalia: (gia ? gia.didascalia : v.didascalia) || didascaliaDiRipiego(v),
    // le misure vere vincono su quelle dichiarate: vedi `misuraPng`
    w: img.w || v.w,
    h: img.h || v.h
  });
  /* Il nome del file si rifà solo se il ritaglio è nuovo — o se, riparando un
     file sparito, i byte arrivano in un altro formato: un `.png` che dentro è un
     webp è una bugia scritta nel nome, e l'id (che è la parte che conta) resta
     comunque quello di prima. */
  fatta.file = gia && path.extname(gia.file).toLowerCase() === img.ext ? gia.file : nomeFile(fatta, img.ext);

  try {
    fs.mkdirSync(d, { recursive: true });
    /* ⚠️ `writeAtomic` passa 'utf-8' a `writeFileSync`, ma con un Buffer Node
       ignora l'encoding e scrive i byte così come sono — provato in
       `test/album.js`, che riconfronta il file scritto con i byte mandati. Vale
       la pena saperlo prima di «correggere» quella firma. */
    appunti.writeAtomic(path.join(d, fatta.file), img.buf);
  } catch (e) {
    return { voce: null, giaCera: false, error: e.message || 'scrittura dell\'immagine fallita' };
  }

  /* La miniatura, se il chiamante l'ha mandata. Non è obbligatoria e non è un
     errore che manchi: chi disegna sa ripiegare sull'immagine vera. ⚠️ Ma se
     fallisce la SUA scrittura, la foto resta comunque salvata — perdere
     l'immagine perché non si è potuto scrivere un francobollo sarebbe il
     rimedio peggiore del guasto. */
  if (fatta.origine === 'foto' && str(ingresso && ingresso.mini)) {
    const m = daDataUrl(ingresso.mini);
    if (!m.error) {
      const nomeMini = fatta.id + m.ext;
      try {
        fs.mkdirSync(path.join(d, MINI), { recursive: true });
        appunti.writeAtomic(path.join(d, MINI, nomeMini), m.buf);
        fatta.mini = MINI + '/' + nomeMini;
      } catch (e) { delete fatta.mini; }
    }
  }

  const voci = letto.voci.filter((x) => x.id !== fatta.id).concat([fatta]);
  const scritto = scriviIndice(vaultPath, courseId, voci);
  if (scritto.error) return { voce: null, giaCera: !!gia, error: scritto.error };
  return { voce: fatta, giaCera: !!gia, error: '' };
}

/**
 * Cambia la didascalia. `{ voce, error }`.
 *
 * ⚠️ Qui questo modulo si comporta al contrario di `appunti.rinomina` e di
 * `mappe.rinomina`, e non è una dimenticanza. Là il nome del file INSEGUE il
 * titolo, perché il file è la cosa che l'utente cerca nel Finder e una doppia
 * verità fra dentro e fuori sarebbe una trappola. Qui no: il file è l'oggetto a
 * cui puntano `![…](album:<id>)` negli appunti e i nodi delle mappe. Rinominarlo
 * vorrebbe dire cambiare l'identità di una cosa già referenziata — e siccome
 * l'indice sa comunque ricondurre l'id al file, il guasto non si vedrebbe subito
 * ma solo il giorno in cui qualcuno legge quella cartella senza il suo indice.
 * La didascalia è un'etichetta; il file è un'identità. Solo la prima si cambia.
 */
function rinomina(vaultPath, courseId, id, didascalia) {
  const letto = leggiIndice(vaultPath, courseId);
  if (letto.error) return { voce: null, error: letto.error };
  if (!idValido(id)) return { voce: null, error: 'id non valido: ' + str(id) };
  const i = letto.voci.findIndex((v) => v.id === str(id));
  if (i < 0) return { voce: null, error: 'l\'immagine «' + str(id) + '» non è nell\'album' };
  const t = str(didascalia).trim();
  if (!t) return { voce: null, error: 'un\'immagine senza didascalia non si distinguerebbe dalle altre' };
  const voci = letto.voci.slice();
  voci[i] = Object.assign({}, voci[i], { didascalia: t });
  const scritto = scriviIndice(vaultPath, courseId, voci);
  if (scritto.error) return { voce: null, error: scritto.error };
  return { voce: voci[i], error: '' };
}

/* -------------------------------------------------------------------- usi */

function nessunUso() { return { appunti: [], mappe: [], illeggibili: [], quanti: 0, error: '' }; }

/**
 * I file di una cartella che nominano questo id. Torna anche quelli che non si
 * sono potuti leggere: «non l'ho trovato» e «non ho potuto guardare» sono due
 * risposte diverse, e confonderle è ciò che rende silenziosa una cancellazione.
 */
function cercaIn(d, ext, re) {
  const trovati = [], illeggibili = [];
  let files;
  try { files = fs.readdirSync(d); }
  catch (e) {
    // la cartella che non c'è è «nessun uso»; qualsiasi altro errore no
    if (e.code !== 'ENOENT') illeggibili.push(path.basename(d) + '/');
    return { trovati, illeggibili };
  }
  for (const f of files.sort()) {
    // i file che cominciano per `_` sono viste generate (`_indice.md`,
    // `_evidenze.md`): si riscrivono da sole, e contarle gonfierebbe gli usi con
    // qualcosa che nessuno ha scritto
    if (!ext.test(f) || f.charAt(0) === '_' || f.charAt(0) === '.') continue;
    try { if (re.test(fs.readFileSync(path.join(d, f), 'utf-8'))) trovati.push(f); }
    catch (e) { illeggibili.push(f); }
  }
  return { trovati, illeggibili };
}

/**
 * Dove compare quest'immagine: `{ appunti, mappe, illeggibili, quanti, error }`.
 *
 * ⚠️ Non si cerca la stringa `album:<id>`, si cerca l'ID. Negli appunti il
 * riferimento è scritto `![didascalia](album:<id>)` e il prefisso c'è; dentro
 * una mappa lo stesso id vive in un campo JSON — `"album": "a1b2c3d4e5"` — dove
 * fra `album` e l'id ci sono virgolette, due punti e uno spazio. Cercare il solo
 * `album:<id>` troverebbe zero usi su ogni mappa del corso, e `rimuovi`
 * cancellerebbe con la coscienza a posto un'immagine che una mappa sta
 * mostrando. Provato, non dedotto: `mappe.salva` di un nodo con `album: <id>`
 * scrive un file in cui la stringa `album:<id>` non compare mai, e in
 * `test/album.js` c'è il controllo che lo tiene fermo.
 * L'id è delimitato da caratteri non esadecimali, così non si riconosce dentro
 * un id più lungo che comincia allo stesso modo.
 */
function usi(vaultPath, courseId, id) {
  const out = nessunUso();
  if (!corsoValido(courseId)) { out.error = 'corso non valido: ' + str(courseId); return out; }
  const cod = str(id);
  if (!idValido(cod)) { out.error = 'id non valido: ' + cod; return out; }
  const re = new RegExp('(^|[^0-9a-fA-F])' + cod + '($|[^0-9a-fA-F])');
  const a = cercaIn(appunti.dir(vaultPath, courseId), /\.md$/i, re);
  const m = cercaIn(mappe.dir(vaultPath, courseId), /\.json$/i, re);
  out.appunti = a.trovati;
  out.mappe = m.trovati;
  out.illeggibili = a.illeggibili.concat(m.illeggibili);
  out.quanti = a.trovati.length + m.trovati.length;
  return out;
}

/**
 * Toglie un'immagine dall'album. `{ tolto, usi, error }`.
 *
 * ⚠️ RIFIUTA se l'immagine è usata da qualche parte, e serve `{ insisti: true }`
 * per passare sopra. È la regola già presa per le evidenze — «le orfane non si
 * cancellano, restano barrate» — vista dall'altro capo: un riferimento che si
 * rompe va DETTO, non nascosto. Se cancellare fosse un gesto muto, l'appunto
 * scritto sei mesi fa mostrerebbe un buco e nessuno saprebbe più che cosa c'era.
 *
 * Rifiuta anche quando un file non si è potuto leggere: lì l'immagine potrebbe
 * essere usata e non lo sappiamo, e «non lo so» non è «no».
 */
function rimuovi(vaultPath, courseId, id, opt) {
  const o = opt || {};
  const letto = leggiIndice(vaultPath, courseId);
  if (letto.error) return { tolto: false, usi: nessunUso(), error: letto.error };
  if (!idValido(id)) return { tolto: false, usi: nessunUso(), error: 'id non valido: ' + str(id) };
  const i = letto.voci.findIndex((v) => v.id === str(id));
  if (i < 0) return { tolto: false, usi: nessunUso(), error: 'l\'immagine «' + str(id) + '» non è nell\'album' };

  const u = usi(vaultPath, courseId, id);
  if (!o.insisti) {
    if (u.quanti) {
      return {
        tolto: false, usi: u,
        error: 'l\'immagine è usata in ' + u.quanti + ' file (' + u.appunti.concat(u.mappe).join(' · ') +
          '): cancellarla lascerebbe un riferimento rotto'
      };
    }
    if (u.illeggibili.length) {
      return {
        tolto: false, usi: u,
        error: 'non si è potuto leggere ' + u.illeggibili.join(' · ') + ': non si sa se l\'immagine è usata'
      };
    }
  }

  // il file può già non esserci (cancellato dal Finder): l'indice va ripulito
  // lo stesso, altrimenti l'album continuerebbe a mostrare una riga vuota
  try { fs.unlinkSync(path.join(dir(vaultPath, courseId), letto.voci[i].file)); }
  catch (e) { if (e.code !== 'ENOENT') return { tolto: false, usi: u, error: e.message || 'cancellazione fallita' }; }

  /* E la miniatura con lei: un francobollo orfano non si vede, non dà errore, e
     resta nel vault per sempre. Che non ci sia non è un guasto. */
  if (letto.voci[i].mini) {
    try { fs.unlinkSync(path.join(dir(vaultPath, courseId), letto.voci[i].mini)); } catch (e) { /* passi */ }
  }

  const voci = letto.voci.filter((v) => v.id !== str(id));
  const scritto = scriviIndice(vaultPath, courseId, voci);
  if (scritto.error) return { tolto: false, usi: u, error: scritto.error };
  return { tolto: true, usi: u, error: '' };
}

module.exports = {
  CARTELLA, INDICE, FORMATO, TOLLERANZA, TIPI, ORIGINI, MINI,
  dir, percorso, percorsoImmagine, percorsoMini, nomeFile,
  identita, identitaByte, idValido, normalizzaRect, normalizzaVoce, daDataUrl, misuraPng, firmaOk,
  vicini, gemello, perOrdine,
  leggiIndice, scriviIndice, elenco, voce, salva, rinomina, usi, rimuovi
};
