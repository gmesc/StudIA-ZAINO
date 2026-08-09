#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Worker di ingestion per StudIA (chiamato da Electron).
Scansiona <vault>/Fonti/: PDF -> testo pagina in Indice-PDF/, video/audio -> trascrizione
(timestamp) in Trascrizioni/. Poi rigenera i videoRefs nelle lezioni di Lezioni/.
Righe di avanzamento su stdout: @TOTAL n | @FILE i n kind nome | @SUB f | @OK .. | @ERR .. | @DONE fatti n
"""
import sys, os, json, argparse, datetime, subprocess, tempfile, shutil, re
import html as html_mod

VIDEO_EXT = [".mp4",".mov",".mkv",".webm",".avi",".mpeg",".mpg"]      # priorità: video
AUDIO_EXT = [".m4a",".mp3",".wav",".aac",".flac"]
MEDIA_EXT = VIDEO_EXT + AUDIO_EXT
MLX_REPO  = "mlx-community/whisper-large-v3-turbo"   # motore veloce su GPU Apple (M-series)

# La lingua parlata nei media. Non è un dettaglio: Whisper, se gliene si impone una
# sbagliata, non si accorge dell'errore — trascrive i suoni inglesi in parole italiane
# plausibili e restituisce un testo scorrevole e completamente inventato. Il default
# resta "it" (il caso normale di chi usa StudIA); "auto" lascia decidere al modello,
# che sui primi 30 secondi sbaglia se l'apertura è musica o silenzio.
LINGUA_DEFAULT = "it"
def norm_lang(v):
    """Il codice da passare a Whisper: None significa «riconoscila da solo»."""
    v = (v or LINGUA_DEFAULT).strip().lower()
    return None if v in ("auto", "") else v

_logf = None            # file di log persistente (aperto in main)
_stdout_ok = True       # diventa False se il consumatore dello stdout sparisce (app chiusa/riavviata)
def out(*a):
    """Stampa su stdout (per la UI) E su un log persistente. Immune al BrokenPipe:
    se lo stdout si rompe (Electron chiuso), NON fa morire il processo — continua e logga su file."""
    global _stdout_ok
    msg = " ".join(str(x) for x in a)
    if _stdout_ok:
        try: print(msg, flush=True)
        except (BrokenPipeError, OSError):
            _stdout_ok = False
            try: sys.stdout = open(os.devnull, "w")   # evita ulteriori BrokenPipe altrove
            except Exception: pass
    if _logf is not None:
        try: _logf.write(msg + "\n"); _logf.flush()
        except Exception: pass
def atomic(obj, path):
    tmp = path + ".tmp"; json.dump(obj, open(tmp,"w",encoding="utf-8"), ensure_ascii=False, indent=1); os.replace(tmp, path)
def atomic_text(text, path):
    tmp = path + ".tmp"; open(tmp,"w",encoding="utf-8").write(text); os.replace(tmp, path)

def extract_pdf(path, oj):
    from pypdf import PdfReader
    pages=[]
    for i,pg in enumerate(PdfReader(path).pages, start=1):
        try: t=pg.extract_text() or ""
        except Exception: t=""
        pages.append({"page":i, "text":" ".join(t.split())})
    atomic({"pdf":os.path.basename(path),"npages":len(pages),"pages":pages}, oj); return len(pages)

# Pagine web salvate dal browser: 1 MB di file per ~7 KB di lezione. Il resto è
# impalcatura del sito (menu, footer, script, template). Qui si tiene solo il testo
# e lo si spezza sulle intestazioni, che nelle pagine di una lezione sono la scaletta
# della lezione. Niente librerie esterne: la regex basta perché il caso peggiore è
# un po' di testo di troppo, non un file rovinato.
_HTML_VIA = re.compile(
    r"(?is)<(script|style|head|noscript|svg|template|nav|header|footer|aside|button|form)\b[^>]*>.*?</\1\s*>")
_HTML_TAG = re.compile(r"(?s)<[^>]+>")
_HTML_TIT = re.compile(r"(?is)<h([1-6])\b[^>]*>(.*?)</h\1\s*>")
_HTML_IMG = re.compile(r"(?is)<img\b[^>]*>")
_HTML_ATT = lambda tag, nome: (re.search(r'(?is)\b' + nome + r'\s*=\s*"([^"]*)"', tag)
                               or re.search(r"(?is)\b" + nome + r"\s*=\s*'([^']*)'", tag))

# immagini che in una pagina salvata non sono mai contenuto: marchio del sito,
# foto profilo, icone, pixel di tracciamento
_IMG_SCARTO = re.compile(r"(?i)\b(logo|avatar|icon|profile|badge|spacer|pixel|tracking|banner|sprite)\b")
_IMG_EXT = (".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".avif")

def _misure_immagine(percorso):
    """Larghezza e altezza leggendo solo l'intestazione del file: niente Pillow."""
    try:
        with open(percorso, "rb") as f: d = f.read(32768)
    except Exception: return (0, 0)
    try:
        if d[:8] == b"\x89PNG\r\n\x1a\n":
            return (int.from_bytes(d[16:20], "big"), int.from_bytes(d[20:24], "big"))
        if d[:3] == b"GIF":
            return (int.from_bytes(d[6:8], "little"), int.from_bytes(d[8:10], "little"))
        if d[:4] == b"RIFF" and d[8:12] == b"WEBP":
            if d[12:16] == b"VP8X": return (int.from_bytes(d[24:27], "little") + 1,
                                            int.from_bytes(d[27:30], "little") + 1)
            return (0, 0)
        if d[:2] == b"\xff\xd8":                      # JPEG: si cerca il marcatore SOF
            i = 2
            while i + 9 < len(d):
                if d[i] != 0xFF: i += 1; continue
                m = d[i + 1]
                if 0xC0 <= m <= 0xCF and m not in (0xC4, 0xC8, 0xCC):
                    return (int.from_bytes(d[i + 7:i + 9], "big"), int.from_bytes(d[i + 5:i + 7], "big"))
                i += 2 + int.from_bytes(d[i + 2:i + 4], "big")
    except Exception: pass
    return (0, 0)

def _immagini_html(raw_pulito, path):
    """Le immagini citate dalla pagina, con il verdetto su quali sono contenuto."""
    cartella = os.path.dirname(path)
    stem = os.path.splitext(os.path.basename(path))[0]
    # gli asset della pagina stanno in «<nome>_files/»: si cerca per nome di file,
    # perché in fase di importazione la cartella è stata rinumerata
    assetdir = None
    for cand in os.listdir(cartella) if os.path.isdir(cartella) else []:
        if cand.endswith("_files") and os.path.isdir(os.path.join(cartella, cand)) and cand.startswith(stem):
            assetdir = os.path.join(cartella, cand); break
    fuori = []
    for tag in _HTML_IMG.findall(raw_pulito):
        src = (_HTML_ATT(tag, "src") or [None, ""])[1] if _HTML_ATT(tag, "src") else ""
        alt = html_mod.unescape((_HTML_ATT(tag, "alt") or [None, ""])[1] if _HTML_ATT(tag, "alt") else "").strip()
        if not src or src.startswith("data:"): continue
        base = os.path.basename(src.split("?")[0].split("#")[0])
        locale = os.path.join(assetdir, base) if assetdir and os.path.exists(os.path.join(assetdir, base)) else None
        byte = os.path.getsize(locale) if locale else 0
        larg, alt_px = _misure_immagine(locale) if locale else (0, 0)
        voce = {"src": src, "alt": alt, "file": base if locale else "",
                "byte": byte, "larghezza": larg, "altezza": alt_px}
        if _IMG_SCARTO.search(alt) or _IMG_SCARTO.search(base):
            voce["scartata"] = "decorazione del sito (logo, icona o foto profilo)"
        elif not locale:
            voce["scartata"] = "immagine non salvata insieme alla pagina"
        elif larg and alt_px and (larg < 120 or alt_px < 120):
            voce["scartata"] = "troppo piccola per essere un contenuto (%dx%d)" % (larg, alt_px)
        elif byte and byte < 4000 and not base.lower().endswith(".svg"):
            voce["scartata"] = "troppo leggera per essere un contenuto (%d byte)" % byte
        fuori.append(voce)
    return fuori

def _e_interfaccia(par):
    """
    Vero se il blocco è una fila di comandi del sito e non prosa. I menu di una
    pagina di lezione non stanno sempre dentro <nav>: quello che li tradisce è che
    sono corti e senza punteggiatura di frase. Una riga di prosa vera, anche
    breve, quasi sempre finisce con un punto.
    """
    t = par.strip()
    if t.startswith("##"): return False                  # le intestazioni restano
    if len(t) >= 160: return False                       # troppo lungo per essere un menu
    return not re.search(r"[.!?]", t)

def extract_html(path, oj):
    """
    Da una pagina salvata: il CONTENUTO INFORMATIVO come testo continuo, più le
    immagini che sono davvero materiale di studio. Le intestazioni restano nel
    testo come marcatori — sono informazione, non impalcatura.
    """
    raw = open(path, encoding="utf-8", errors="replace").read()
    # le immagini si censiscono PRIMA di togliere menu e piè di pagina, altrimenti
    # quelle decorative sparirebbero senza lasciare traccia del perché
    senza_codice = re.sub(r"(?is)<(script|style|head|noscript|template)\b[^>]*>.*?</\1\s*>", " ", raw)
    immagini = _immagini_html(senza_codice, path)
    pulito = _HTML_VIA.sub(" ", raw)

    # il testo dell'alt di un'immagine di contenuto è informazione: resta nel corpo
    def _rendi(m):
        tag = m.group(0)
        a = _HTML_ATT(tag, "alt")
        return (" [immagine: " + html_mod.unescape(a[1]).strip() + "] ") if (a and a[1].strip()) else " "
    pulito = _HTML_IMG.sub(_rendi, pulito)

    titolo = ""
    pezzi, ultimo = [], 0
    for m in _HTML_TIT.finditer(pulito):
        t = " ".join(html_mod.unescape(_HTML_TAG.sub(" ", m.group(2))).split())
        if not t: continue
        if not titolo: titolo = t
        prima = " ".join(html_mod.unescape(_HTML_TAG.sub(" ", pulito[ultimo:m.start()])).split())
        if prima: pezzi.append(prima)
        pezzi.append("## " + t)
        ultimo = m.end()
    coda = " ".join(html_mod.unescape(_HTML_TAG.sub(" ", pulito[ultimo:])).split())
    if coda: pezzi.append(coda)
    testo = "\n\n".join(p for p in pezzi if not _e_interfaccia(p)).strip()

    tenute = [i for i in immagini if not i.get("scartata")]
    atomic({"html": os.path.basename(path), "titolo": titolo, "testo": testo,
            "caratteri": len(testo), "immagini": immagini, "nimmagini": len(tenute)}, oj)
    return len(testo)

def _save_transcript(path, oj, segs, lang):
    atomic({"media":os.path.basename(path),"language":lang,"segments":segs}, oj)
    atomic_text("\n".join(s["text"] for s in segs) + ("\n" if segs else ""), os.path.splitext(oj)[0]+".txt")
    return len(segs)

def load_backend(model_name, prefer):
    """Sceglie il motore di trascrizione:
       - 'mlx'  = mlx-whisper su GPU Apple (M-series): ~10-15x più veloce del realtime.
       - 'fw'   = faster-whisper su CPU (fallback): più lento ma senza dipendenze Apple.
       prefer: 'mlx' | 'fw' | 'auto' (auto = mlx se disponibile, altrimenti fw)."""
    if prefer != "fw":
        try:
            import mlx_whisper  # noqa: F401
            try:                                   # pre-carica/scarica ORA, non al primo file
                from mlx_whisper.load_models import load_model; load_model(MLX_REPO)
            except Exception: pass
            return {"kind":"mlx","repo":MLX_REPO}
        except Exception as e:
            if prefer == "mlx": out("@ERR mlx-whisper richiesto ma non disponibile (%s)"%e)
            else: out("@ERR mlx-whisper non disponibile (%s) — uso faster-whisper su CPU"%e)
    from faster_whisper import WhisperModel
    return {"kind":"fw","model":WhisperModel(model_name, device="cpu", compute_type="int8", cpu_threads=0)}

def _extract_wav(path):
    """Estrae l'audio in un wav 16kHz mono via ffmpeg CLI. ffmpeg è più tollerante ai glitch AAC del
    decoder PyAV usato da mlx/whisper (che altrimenti si ferma al primo pacchetto corrotto, troncando
    la trascrizione a metà). Ritorna il path del wav temporaneo, o None se ffmpeg manca/fallisce."""
    if not shutil.which("ffmpeg"): return None
    try:
        fd, wav = tempfile.mkstemp(suffix=".wav", prefix="studia_"); os.close(fd)
        r = subprocess.run(["ffmpeg","-y","-hide_banner","-loglevel","error","-i",path,
                            "-vn","-ac","1","-ar","16000","-f","wav",wav],
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        if r.returncode == 0 and os.path.exists(wav) and os.path.getsize(wav) > 1000:
            return wav
        try: os.remove(wav)
        except Exception: pass
    except Exception as e:
        out("@ERR estrazione audio ffmpeg fallita (%s) — uso il file originale" % e)
    return None

def transcribe(path, oj, backend, lang=LINGUA_DEFAULT):
    audio = _extract_wav(path) or path        # audio robusto via ffmpeg; fallback al file originale
    try:
        return _transcribe_audio(path, audio, oj, backend, norm_lang(lang))
    finally:
        if audio != path:
            try: os.remove(audio)
            except Exception: pass

def _transcribe_audio(path, audio, oj, backend, lang):
    if backend["kind"] == "mlx":
        import mlx_whisper, tqdm as _tq
        # mlx trascrive in un colpo solo: aggancio la sua barra tqdm interna (sui frame)
        # e la converto in @SUB per la UI, buttando via l'output della barra (niente spam su stderr).
        _Orig = _tq.tqdm
        class _Sink:
            def write(self, *a): pass
            def flush(self): pass
        class _SubTqdm(_Orig):
            def __init__(self, *a, **k):
                k["file"] = _Sink(); k["disable"] = False       # output soppresso, update() attivo
                super().__init__(*a, **k); self._last = 0.0
            def update(self, n=1):
                r = super().update(n)
                try:
                    if self.total:
                        f = min(1.0, self.n / self.total)
                        if f - self._last >= 0.01: out("@SUB %.4f" % f); self._last = f
                except Exception: pass
                return r
        _tq.tqdm = _SubTqdm
        try:
            res = mlx_whisper.transcribe(audio, path_or_hf_repo=backend["repo"],
                                         language=lang, word_timestamps=False, verbose=False)
        finally:
            _tq.tqdm = _Orig
        out("@SUB 1.0000")
        segs = [{"start":round(s.get("start",0.0),2),"end":round(s.get("end",0.0),2),
                 "text":(s.get("text") or "").strip()} for s in res.get("segments",[])]
        return _save_transcript(path, oj, segs, res.get("language") or lang or LINGUA_DEFAULT)
    # fallback faster-whisper (CPU), con avanzamento @SUB
    model = backend["model"]
    segments, info = model.transcribe(audio, language=lang, beam_size=5, vad_filter=True)
    dur=getattr(info,"duration",0) or 0; segs=[]; last=0.0
    for seg in segments:
        segs.append({"start":round(seg.start,2),"end":round(seg.end,2),"text":seg.text.strip()})
        if dur:
            f=min(1.0, seg.end/dur)
            if f-last>=0.01: out("@SUB %.4f"%f); last=f
    return _save_transcript(path, oj, segs, getattr(info,'language',None) or lang or LINGUA_DEFAULT)

def reindex_lessons(vault):
    try: import index_videos
    except Exception as e: out("@ERR index :: %s"%e); return
    tra=os.path.join(vault,"Trascrizioni"); cor=os.path.join(vault,"Lezioni")
    if not os.path.isdir(cor): return          # niente lezioni in formato JSON: non c'è nulla da reindicizzare
    trs=[]
    for f in sorted(os.listdir(tra)) if os.path.isdir(tra) else []:
        if f.endswith(".json"):
            try: trs.append(json.load(open(os.path.join(tra,f),encoding="utf-8")))
            except Exception: pass
    if not trs or not os.path.isdir(cor): return
    for cf in sorted(os.listdir(cor)):
        if not cf.endswith(".json"): continue
        p=os.path.join(cor,cf)
        try:
            lesson=json.load(open(p,encoding="utf-8"))
            index_videos.index(trs, lesson)      # usa il nome media reale (già .mp4 se presente)
            atomic(lesson, p)
        except Exception as e: out("@ERR index %s :: %s"%(cf,e))

def main():
    ap=argparse.ArgumentParser(); ap.add_argument("--vault",required=True); ap.add_argument("--model",default="medium")
    ap.add_argument("--skip-video",action="store_true"); ap.add_argument("--skip-pdf",action="store_true")
    ap.add_argument("--only",action="append",default=[])   # basename dei media da elaborare; se presente, SOLO questi (niente PDF)
    ap.add_argument("--force",action="store_true")          # rielabora anche se il .json esiste già
    ap.add_argument("--backend",default="auto",choices=["auto","mlx","fw"])  # motore: auto=mlx se c'è, altrimenti CPU
    ap.add_argument("--lang",default=LINGUA_DEFAULT)        # lingua parlata nei media; "auto" = la riconosce Whisper
    ap.add_argument("--corso",default=None)              # limita tutto ai materiali di QUESTO corso
    a=ap.parse_args()
    only=set(a.only)
    FONTI=os.path.join(a.vault,"Fonti"); MEDIA=os.path.join(a.vault,"Media")
    TRA=os.path.join(a.vault,"Trascrizioni"); os.makedirs(TRA,exist_ok=True)
    PIDX=os.path.join(a.vault,"Indice-PDF"); os.makedirs(PIDX,exist_ok=True)
    HIDX=os.path.join(a.vault,"Indice-HTML"); os.makedirs(HIDX,exist_ok=True)

    # Un corso può portarsi dentro i suoi materiali (Corsi/<id>/MATERIALI/):
    # si scandiscono anche quelli, e il derivato (trascrizione, indice) viene
    # scritto ACCANTO al materiale, così la cartella del corso resta completa
    # anche quando la si copia altrove.
    # dentro un corso ogni tipo ha la sua cartella; «Media» e «Fonti» restano
    # i nomi interni della pipeline (vedi lib/materiali.js)
    NOMI={"Media":["Video","Audio"], "Fonti":["PDF","Web","Documenti"],
          "Trascrizioni":["Trascrizioni"], "Indice-PDF":["Indici-PDF"], "Indice-HTML":["Indici-Web"]}
    def cartelle_materiali(sub):
        """Le cartelle da scandire per `sub`.

        Con --corso si guarda SOLO dentro di lui. Senza, tutto il vault: era
        l'unico comportamento, e faceva rielaborare i materiali di un corso
        mentre se ne lavorava un altro — 64 file per due corsi che non c'entrano
        niente fra loro. La radice resta nell'elenco solo per i vault a corpus
        unico, cioè quando nessun corso si porta dentro i propri materiali."""
        out=[]
        cdir=os.path.join(a.vault,"Corsi")
        if os.path.isdir(cdir):
            ids=[a.corso] if a.corso else sorted(os.listdir(cdir))
            for pid in ids:
                for n in NOMI.get(sub,[sub])+[sub]:
                    d=os.path.join(cdir,pid,"MATERIALI",n)
                    if os.path.isdir(d) and d not in out: out.append(d)
        # un corso che ha già i suoi materiali non deve pescare dalla radice:
        # là ci sono quelli di tutti, ed è il ripiego dei vault mai riordinati
        if a.corso and out: return out
        d=os.path.join(a.vault,sub)
        if os.path.isdir(d) and d not in out: out.append(d)
        return out

    def dir_derivato(full, sub, globale):
        marca=os.sep+"MATERIALI"+os.sep
        d=os.path.dirname(full)
        if marca in d+os.sep:
            base=(d+os.sep).split(marca)[0]
            dd=os.path.join(base,"MATERIALI",NOMI.get(sub,[sub])[0]); os.makedirs(dd,exist_ok=True); return dd
        return globale

    def gia_fatto(stem, sub):
        for d in cartelle_materiali(sub):
            oj=os.path.join(d,stem+".json")
            if os.path.exists(oj) and os.path.getsize(oj)>0: return True
        return False

    # log persistente: sopravvive alla chiusura dell'app, così un blocco è sempre diagnosticabile
    global _logf
    try:
        _logdir=os.path.join(a.vault,".studia","log"); os.makedirs(_logdir,exist_ok=True)
        _logf=open(os.path.join(_logdir,"ingest.log"),"a",encoding="utf-8")
        _logf.write("\n==== %s  pid=%d  model=%s  only=%s ====\n" % (
            datetime.datetime.now().isoformat(timespec="seconds"), os.getpid(), a.model,
            (sorted(only) if only else "tutti")))
        _logf.flush()
    except Exception: _logf=None

    prio={e:i for i,e in enumerate(MEDIA_EXT)}
    # media da Fonti/ + Media/ : dedup per stem, priorità al video; a parità di ext, Fonti (scandita prima) vince
    media_by_stem={}                                        # stem -> (fname, fullpath)
    for d in cartelle_materiali("Fonti")+cartelle_materiali("Media"):
        if not os.path.isdir(d): continue
        for f in sorted(os.listdir(d)):
            full=os.path.join(d,f)
            if not os.path.isfile(full): continue
            ext=os.path.splitext(f)[1].lower()
            if ext in MEDIA_EXT:
                st=os.path.splitext(f)[0]; cur=media_by_stem.get(st)
                if cur is None or prio[ext] < prio[os.path.splitext(cur[0])[1].lower()]:
                    media_by_stem[st]=(f,full)

    def need(oj, stem=None, sub=None):
        if a.force: return True
        if os.path.exists(oj) and os.path.getsize(oj)>0: return False
        # già elaborato altrove (nel vault o in un altro corso): non rifarlo
        return not (stem and sub and gia_fatto(stem, sub))

    tasks=[]                                                # (kind, fname, fullpath, oj)
    # PDF solo da Fonti/, e solo se NON è una selezione mirata di video (--only)
    if not a.skip_pdf and not only:
        visti=set()
        for d in cartelle_materiali("Fonti"):
            for f in sorted(os.listdir(d)):
                full=os.path.join(d,f)
                ext=os.path.splitext(f)[1].lower()
                if not os.path.isfile(full) or f in visti: continue
                visti.add(f)
                st=os.path.splitext(f)[0]
                if ext==".pdf":
                    oj=os.path.join(dir_derivato(full,"Indice-PDF",PIDX),st+".json")
                    if need(oj,st,"Indice-PDF"): tasks.append(("pdf",f,full,oj))
                elif ext in (".html",".htm"):
                    oj=os.path.join(dir_derivato(full,"Indice-HTML",HIDX),st+".json")
                    if need(oj,st,"Indice-HTML"): tasks.append(("html",f,full,oj))
    if not a.skip_video:
        for st,(f,full) in sorted(media_by_stem.items()):
            if only and f not in only: continue
            oj=os.path.join(dir_derivato(full,"Trascrizioni",TRA),st+".json")
            if need(oj,st,"Trascrizioni"): tasks.append(("video",f,full,oj))

    total=len(tasks); out("@TOTAL %d"%total)
    backend=None
    if any(t[0]=="video" for t in tasks):
        out("@FILE 0 %d model Preparo il motore di trascrizione..."%total)
        backend=load_backend(a.model, a.backend)
        out("@OK motore di trascrizione: %s · lingua: %s"%(backend["kind"], norm_lang(a.lang) or "riconosciuta dal modello"))
    done=0
    for i,(kind,fname,full,oj) in enumerate(tasks,start=1):
        out("@FILE %d %d %s %s"%(i,total,kind,fname))
        try:
            if kind=="pdf":    n=extract_pdf(full,oj);  misura="%d pagine"%n
            elif kind=="html": n=extract_html(full,oj); misura="%d caratteri di contenuto"%n
            else:              n=transcribe(full,oj,backend,a.lang); misura="%d segmenti"%n
            out("@OK %s (%s)"%(fname, misura)); done+=1
        except Exception as e: out("@ERR %s :: %s"%(fname,e))
    if not a.skip_video: reindex_lessons(a.vault)
    out("@DONE %d %d"%(done,total))

if __name__=="__main__":
    try:
        main()
    except SystemExit:
        raise
    except BaseException as e:
        import traceback
        tb = traceback.format_exc()
        try: out("@FATAL %s :: %s" % (type(e).__name__, e)); out(tb)
        except Exception: pass
        if _logf is not None:
            try: _logf.write("FATAL\n"+tb+"\n"); _logf.flush()
            except Exception: pass
        sys.exit(1)
