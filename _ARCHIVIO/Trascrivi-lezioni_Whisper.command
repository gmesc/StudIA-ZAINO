#!/bin/bash
# ============================================================
#  StudIA — Trascrizione locale con TIMESTAMP (Whisper)
#  INPUT : sottocartella "Media" (e, se presenti, "Fonti") accanto a questo file
#  OUTPUT: sottocartella "Trascrizioni"  -> <nome>.json  <nome>.txt  <nome>.vtt
#  Mostra l'avanzamento in tempo reale, ANCHE dentro ogni video (percentuale).
#  Va avanti senza interruzioni, riprende da dove era, legge i video direttamente.
# ============================================================
cd "$(dirname "$0")" || exit 1
MODEL="${WHISPER_MODEL:-medium}"     # "small" = più veloce, "medium" = più accurato
OUT="Trascrizioni"; mkdir -p "$OUT"

if [ ! -d ".whisper-venv" ]; then python3 -m venv .whisper-venv; fi
source .whisper-venv/bin/activate
python -c "import faster_whisper" 2>/dev/null || { python -m pip install --quiet --upgrade pip; python -m pip install --quiet faster-whisper; }

python - "$MODEL" "$OUT" <<'PY'
import sys, os, glob, json, time, datetime
from faster_whisper import WhisperModel
model_size, OUT = sys.argv[1], sys.argv[2]
INPUT_DIRS = ["Media", "Fonti", "."]     # cartelle dove cercare i file (in quest'ordine)
VIDEO_EXT = [".mp4",".mov",".mkv",".webm",".avi",".mpeg",".mpg"]
AUDIO_EXT = [".m4a",".mp3",".wav",".aac",".flac"]
MEDIA_EXT = VIDEO_EXT + AUDIO_EXT

def log(m):
    line = "[%s] %s" % (datetime.datetime.now().strftime("%F %T"), m)
    print(line, flush=True)
    try: open(os.path.join(OUT,"_log.txt"),"a",encoding="utf-8").write(line+"\n")
    except OSError: pass
def fmt(t):
    h=int(t//3600); m=int((t%3600)//60); s=t%60; return "%02d:%02d:%06.3f"%(h,m,s)
def hms(sec):
    sec=int(sec); return ("%dh%02dm"%(sec//3600,(sec%3600)//60)) if sec>=3600 else ("%dm%02ds"%(sec//60,sec%60))

# raccogli i file media (dedup per nome, preferendo il video), saltando quelli già fatti
prio={e:i for i,e in enumerate(MEDIA_EXT)}
chosen={}   # stem -> path
for d in INPUT_DIRS:
    if not os.path.isdir(d): continue
    for f in sorted(os.listdir(d)):
        p=os.path.join(d,f)
        if not os.path.isfile(p): continue
        ext=os.path.splitext(f)[1].lower(); stem=os.path.splitext(f)[0]
        if ext not in MEDIA_EXT: continue
        if stem not in chosen or prio[ext] < prio[os.path.splitext(chosen[stem])[1].lower()]:
            chosen[stem]=p
todo=[]; already=0
for stem,p in sorted(chosen.items()):
    js=os.path.join(OUT,stem+".json")
    if os.path.exists(js) and os.path.getsize(js)>0: already+=1
    else: todo.append((stem,p))

log("carico Whisper '%s' (download solo la prima volta)..." % model_size)
model=WhisperModel(model_size, device="cpu", compute_type="int8", cpu_threads=0)
log("trovati %d file | gia' fatti %d | da fare %d" % (len(chosen), already, len(todo)))

done=err=0
for i,(stem,path) in enumerate(todo, start=1):
    log("[%d/%d] trascrivo: %s" % (i, len(todo), os.path.basename(path)))
    t0=time.time()
    try:
        segments, info = model.transcribe(path, language="it", beam_size=5, vad_filter=True)
        dur=getattr(info,"duration",0) or 0; segs=[]; nextpct=10
        for seg in segments:
            segs.append({"start":round(seg.start,2),"end":round(seg.end,2),"text":seg.text.strip()})
            if dur:
                pct=min(100, int(seg.end/dur*100))
                if pct>=nextpct:
                    log("        ... %d%%" % pct); nextpct = (pct//10)*10 + 10
        with open(os.path.join(OUT,stem+".txt"),"w",encoding="utf-8") as ft, \
             open(os.path.join(OUT,stem+".vtt"),"w",encoding="utf-8") as fv:
            fv.write("WEBVTT\n\n")
            for s in segs:
                ft.write(s["text"]+"\n"); fv.write("%s --> %s\n%s\n\n"%(fmt(s["start"]),fmt(s["end"]),s["text"]))
        tmp=os.path.join(OUT,stem+".json.tmp")
        json.dump({"media":os.path.basename(path),"language":getattr(info,'language','it'),"segments":segs},
                  open(tmp,"w",encoding="utf-8"), ensure_ascii=False, indent=1)
        os.replace(tmp, os.path.join(OUT,stem+".json"))
        log("        ok -> %s/%s.json  (%d segmenti, %s)" % (OUT, stem, len(segs), hms(time.time()-t0))); done+=1
    except Exception as e:
        log("        ERRORE su %s: %s -> continuo" % (os.path.basename(path), e)); err+=1
log("FINE: %d trascritti adesso, %d errori (%d gia' presenti)" % (done, err, already))
PY

if [ -t 0 ]; then echo; read -n 1 -s -r -p "Premi un tasto per chiudere..."; fi
