/* ============================================================================
   player/lettore.js — le regole del PLAYER, senza il player
   ============================================================================
   Lo strumento «Player» è un elemento `<video>` in un riquadro del banco: un
   video, o un audio, che si guarda mentre negli appunti si scrive. Il DOM sta
   nel renderer; qui c'è tutto ciò che si può decidere senza un lettore acceso —
   e che quindi si può provare in Node, prima di aprire l'app:

     · che cosa è questo file (video o audio);
     · come si scrive un tempo, e come si salta avanti e indietro;
     · le velocità che esistono, e quella dopo;
     · la riga che finisce nell'appunto quando si marca il minuto.

   ⚠️ **Perché un modulo e non quattro funzioni nel renderer.** Sono le quattro
   cose che, sbagliate, si vedono solo a mano: un salto che esce dalla durata
   non solleva niente — il lettore si ferma alla fine e sembra un dispetto — e
   una riga di appunto scritta con un rimando storto è un link morto che si
   scopre fra un mese. Qui si provano tutte, con `node test/player.js`.

   ⚠️ **Le estensioni sono scritte due volte** — qui e in `lib/materiali.js` —
   perché questo file gira nel browser, dove `lib/` non arriva, e quello gira
   nella pipeline, dove `assets/` non arriva. È una copia dichiarata, e
   `test/player.js` la inchioda: se un giorno le due liste divergono, la prova
   diventa rossa prima che un `.opus` trascinato in uno zaino sparisca senza
   dire dov'è finito.
   ============================================================================ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../rimandi/sintassi'));
  else root.Lettore = factory(root.RimandiSintassi);
}(typeof self !== 'undefined' ? self : this, function (Rimandi) {
  'use strict';

  const EXT_VIDEO = ['.mp4', '.mov', '.mkv', '.webm', '.avi', '.mpeg', '.mpg'];
  const EXT_AUDIO = ['.m4a', '.mp3', '.wav', '.aac', '.flac', '.ogg', '.opus', '.aiff'];

  /** Le velocità che esistono. Un insieme CHIUSO, come le forme del banco: una
   *  velocità qualunque si ottiene solo con un campo, e un campo per una leva
   *  che si preme al volo è una leva che non si preme. */
  const VELOCITA = [0.75, 1, 1.25, 1.5, 1.75, 2];

  function str(v) { return typeof v === 'string' ? v : (v == null ? '' : String(v)); }

  function estensione(nome) {
    const s = str(nome);
    const i = s.lastIndexOf('.');
    return i < 0 ? '' : s.slice(i).toLowerCase();
  }

  /** `'video'`, `'audio'`, o `''` se non è né l'uno né l'altro. */
  function tipoDi(nome) {
    const ext = estensione(nome);
    if (EXT_VIDEO.indexOf(ext) >= 0) return 'video';
    if (EXT_AUDIO.indexOf(ext) >= 0) return 'audio';
    return '';
  }

  /**
   * Che cosa dire quando il media non si apre — o `''`, se non c'è niente da
   * dire. Si fa passare `err` (il `MediaError` dell'elemento), perché il modulo
   * il DOM non ce l'ha.
   *
   * ⚠️ Esiste perché «entra e non suona» è la promessa rotta dall'altro lato
   * rispetto a «non entra e non lo dice». Misurato il 24 agosto 2026 con file
   * veri dentro l'Electron del progetto: di tutto ciò che le liste accettano,
   * **`.aiff`, `.avi` e `.mpg`/`.mpeg` Chromium non li apre** (`code=4`,
   * `DEMUXER_ERROR_COULD_NOT_OPEN`) — entravano nel vault e davano un riquadro
   * nero muto. ⚠️ Il sospetto sull'`.ogg` era invece della MISURA, non
   * dell'app: il primo file di prova l'aveva scritto l'encoder vorbis
   * sperimentale di ffmpeg; con un Ogg sano si apre benissimo.
   *
   * ⚠️ Qui NON c'è una lista dei formati che non si aprono, ed è deliberato:
   * sarebbe la sesta copia del difetto che Q7 ha appena chiuso, e per giunta
   * una copia di ciò che decide Chromium — che cambia a ogni Electron. Si
   * guarda che cosa è successo davvero, così anche un `.mkv` con dentro un
   * codec esotico viene detto.
   *
   * ⚠️ E il `code 1` tace: `MEDIA_ERR_ABORTED` è il caricamento interrotto
   * perché si è aperto un altro media, non un guasto. (La chiusura del player
   * — `removeAttribute('src')` + `load()` — non emette `error` affatto ma solo
   * `emptied`: misurato, non supposto.)
   */
  function erroreDaDire(err, nome, opz) {
    const code = err && err.code;
    if (!code || code === 1) return '';
    const o = opz || {};
    const che = str(nome) ? '«' + str(nome) + '»' : 'questo file';
    if (code === 2) return 'Non riesco a leggere ' + che + ': il file è stato spostato o non si può aprire.';
    /* ⚠️ IL RIMEDIO DIPENDE DA DOVE SI È, e si fa PASSARE perché questo modulo
       la modalità non la può leggere. Nei corsi la trascrizione c'è, e un
       formato che il lettore non apre si trascrive lo stesso: passa da ffmpeg,
       non da Chromium. Nello ZAINO non c'è — «qui non si trascrive niente» è
       una decisione dichiarata in PIANO-ZAINO.md §1.5 — e prometterla lì
       sarebbe un cartello che indica una porta che non esiste, cioè il difetto
       che questo progetto si vieta in più punti. Pagato il 24 agosto 2026:
       l'utente ha letto «si può trascrivere lo stesso» dentro uno zaino. */
    const rimedio = o.siTrascrive
      ? ' Si può trascrivere lo stesso — la trascrizione non passa da qui.'
      : ' Per ascoltarlo qui va convertito in un formato che il lettore apre (per esempio .m4a o .mp3).';
    if (code === 4) {
      return 'Il lettore non apre ' + che + ': questo formato non lo sa decodificare.' + rimedio;
    }
    return che.charAt(0).toUpperCase() + che.slice(1) + ' si apre ma non si riesce a leggerlo: ' +
      'il file è danneggiato, o il codec che ha dentro non si decodifica.' + rimedio;
  }

  /**
   * Che cosa dire a chi trascina, nello ZAINO, dei media che il lettore non
   * apre — o `''` se non ce n'è nessuno.
   *
   * ⚠️ Nello zaino un media che non si apre non serve a NIENTE: non si ascolta
   * e non si trascrive (PIANO-ZAINO.md §1.5). Farlo entrare vuol dire un file
   * nel vault, numerato, che a ogni click risponde «non lo apro»: è il terzo
   * caso — né entra e si vede, né si ferma sulla soglia dicendo perché — e la
   * regola del progetto dice che non deve esistere. Nei CORSI è l'opposto, e
   * infatti lì non si ferma niente: la pipeline lo trascrive benissimo.
   *
   * ⚠️ Il messaggio dice il RIMEDIO, non solo il rifiuto: un «no» che non dice
   * come si fa è un vicolo cieco, e la conversione è un gesto che si fa in un
   * minuto con qualunque programma.
   */
  function rifiutoSullaSoglia(nomi) {
    const l = (nomi || []).map(str).filter(Boolean);
    if (!l.length) return '';
    const chi = l.length === 1 ? '«' + l[0] + '»' : l.length + ' file (' + l.join(' · ') + ')';
    const verbo = l.length === 1 ? 'Convertilo' : 'Convertili';
    return 'Non porto dentro ' + chi + ': il lettore non apre questo formato, e qui non si ' +
      'trascrive. ' + verbo + ' in un formato che si apre (per esempio .m4a o .mp3) e ritrascina' +
      (l.length === 1 ? '' : 'li') + '.';
  }

  /**
   * Secondi → `m:ss`, e `h:mm:ss` quando l'ora c'è.
   *
   * ⚠️ L'ora non è un vezzo: una lezione registrata dura più di un'ora, e
   * «83:20» è un tempo che nessun lettore mostra e che nessuno sa ritrovare
   * sulla barra. La forma è quella che `leggiMinuto` sa già rileggere, così un
   * tempo scritto a mano in un appunto continua a valere.
   */
  function tempo(sec) {
    let s = Math.max(0, Math.floor(Number(sec) || 0));
    const h = Math.floor(s / 3600); s -= h * 3600;
    const m = Math.floor(s / 60); s -= m * 60;
    const due = (n) => (n < 10 ? '0' + n : String(n));
    return h ? (h + ':' + due(m) + ':' + due(s)) : (m + ':' + due(s));
  }

  /**
   * Dove si arriva saltando di `delta` secondi.
   *
   * ⚠️ Si stringe alla durata, e la durata può non esserci: prima che il lettore
   * abbia letto i metadati vale `NaN`, e un `currentTime = NaN` non solleva —
   * riporta il media a zero. Senza durata si stringe solo a sinistra: andare
   * oltre la fine lo fa fermare, che è il male minore e reversibile.
   */
  function salto(secondo, delta, durata) {
    const s = Number(secondo) || 0;
    const d = Number(delta) || 0;
    let out = Math.max(0, Math.floor(s + d));
    const fine = Number(durata);
    if (isFinite(fine) && fine > 0) out = Math.min(out, Math.floor(fine));
    return out;
  }

  /** La velocità dopo quella di adesso, nel verso chiesto (+1 / −1). Agli
   *  estremi resta ferma: un giro che riparte da 0,75 dopo il 2× farebbe
   *  rallentare chi voleva accelerare. */
  function velocita(attuale, verso) {
    const v = Number(attuale);
    let i = VELOCITA.indexOf(v);
    if (i < 0) {
      /* Una velocità che non è in elenco (ripresa da una sessione vecchia, o
         messa dai comandi del sistema) si aggancia alla più vicina, invece di
         far ripartire da capo. */
      i = 0;
      for (let k = 1; k < VELOCITA.length; k++) {
        if (Math.abs(VELOCITA[k] - v) < Math.abs(VELOCITA[i] - v)) i = k;
      }
    }
    const j = Math.max(0, Math.min(VELOCITA.length - 1, i + (Number(verso) < 0 ? -1 : 1)));
    return VELOCITA[j];
  }

  /**
   * La riga che il tasto rapido lascia nell'appunto.
   *
   *     - [12:30](video:03#t=750) quello che stavi per scrivere
   *
   * ⚠️ Il rimando lo scrive `RimandiSintassi`, non questa funzione: la
   * grammatica di «da dove viene» sta in un posto solo, ed è la ragione per cui
   * quel file esiste. Qui si decide solo la CORNICE — un elenco puntato, perché
   * appuntare un video vuol dire fare una scaletta di minuti, non un tema.
   *
   * ⚠️ Senza numero si scrive il tempo NUDO, non un link rotto: un materiale
   * non numerato esiste (l'utente può aver rinominato il file), e un
   * `[12:30](video:#t=750)` sarebbe un cartello che non porta da nessuna parte.
   */
  function rigaAppunto(dati) {
    const d = dati || {};
    const sec = Math.max(0, Math.floor(Number(d.secondo) || 0));
    const et = tempo(sec);
    const rim = d.numero && Rimandi ? Rimandi.scriviVideo(d.numero, sec) : '';
    const capo = rim ? Rimandi.link(et, rim) : et;
    const testo = str(d.testo).replace(/\s+/g, ' ').trim();
    return '\n- ' + capo + (testo ? ' ' + testo : ' ');
  }

  return {
    EXT_VIDEO: EXT_VIDEO, EXT_AUDIO: EXT_AUDIO, VELOCITA: VELOCITA,
    estensione: estensione, tipoDi: tipoDi, tempo: tempo, erroreDaDire: erroreDaDire,
    rifiutoSullaSoglia: rifiutoSullaSoglia,
    salto: salto, velocita: velocita, rigaAppunto: rigaAppunto
  };
}));
