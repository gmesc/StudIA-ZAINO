#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Indicizza le trascrizioni con timestamp e aggiunge a ogni capitolo di un corso i
`videoRefs` = rimandi ai punti dei video dove si parla dell'argomento.

Uso:
  python3 index_videos.py --transcripts trascrizioni/ --course corso.json --out corso.json
Opzioni:
  --min-score N     soglia punteggio (default 4)
  --min-terms N     n. minimo di termini distinti trovati (default 2)
  --max-refs N      max rimandi per capitolo, tra tutti i video (default 4)
  --video-ext .mp4  usa questa estensione al posto di quella del file audio (es. .mp3 -> .mp4)

Match: termini del glossario (peso 3) + parole significative di titolo/punti-chiave/brief (peso 1).
E' un indice per PAROLE CHIAVE (deterministico, spiegabile). Upgrade futuro: embeddings semantici.
"""
import json, re, argparse, glob, os

STOP = set("""il lo la i gli le un uno una di a da in con su per tra fra e ed o od ma se che chi cui non piu meno molto poco come dove quando perche cosi anche solo ogni tutto tutti tutte questa questo questi queste quella quello essere sono era stato stata viene vengono fare fanno puo possono deve devono sua suo loro nel nella nelle nei degli delle dei alla allo alle agli dal dalla dalle dai due tre sempre gia ancora quindi cioe oppure senza dentro fuori sopra sotto""".split())

def norm(t): return re.sub(r"[^a-zà-ù0-9\s]", " ", (t or "").lower())

def chapter_terms(c):
    strong = [norm(g.get("t","")) for g in c.get("glossary", []) if g.get("t")]
    strong = [s for s in strong if s]
    text = " ".join(c.get("keypoints", [])) + " " + c.get("title","") + " " + c.get("brief","")
    words = sorted({w for w in norm(text).split() if len(w) > 4 and w not in STOP})
    return strong, words

def score(segtext, strong, words):
    st = " " + norm(segtext) + " "
    sc, hit = 0, set()
    for g in strong:
        if g and (" "+g+" ") in st: sc += 3; hit.add(g)
    for w in words:
        if re.search(r"\b" + re.escape(w) + r"\b", st): sc += 1; hit.add(w)
    return sc, len(hit)

def short_label(media):
    base = os.path.splitext(os.path.basename(media))[0]
    base = re.sub(r"edu\.galton\.it", "", base, flags=re.I)
    toks = [t for t in re.split(r"[\s_]+", base) if t]
    num = ""
    if toks and re.fullmatch(r"\d{1,2}", toks[0]):
        num = toks[0]; toks = toks[1:]
    NOISE = {"TD", "td"}
    toks = [t for t in toks if t not in NOISE and not re.fullmatch(r"\d{1,3}", t)]
    name = " ".join(toks[:6]).strip()
    return (num + " · " if num else "") + name

def index(transcripts, course, min_score=4, min_terms=2, max_refs=4, video_ext=None):
    # Scoping: se il corso dichiara "videos": ["01","05",...] (prefissi numero modulo),
    # i rimandi si cercano SOLO nelle trascrizioni di quei video. Senza campo -> tutte (retro-compat).
    # Allowlist che non matcha nulla -> nessun ref (esplicito, niente fallback globale).
    allow = course.get("videos")
    if allow:
        pref = tuple(str(a) for a in allow)
        transcripts = [t for t in transcripts
                       if os.path.basename(t.get("media", "")).startswith(pref)]
    for c in course.get("chapters", []):
        strong, words = chapter_terms(c)
        found = []
        for tr in transcripts:
            media = tr.get("media","")
            if video_ext: media = os.path.splitext(media)[0] + video_ext
            best = None
            for seg in tr.get("segments", []):
                sc, nt = score(seg.get("text",""), strong, words)
                if sc >= min_score and nt >= min_terms and (best is None or sc > best[0]):
                    best = (sc, seg.get("start",0), seg.get("text",""))
            if best:
                found.append({"video": media, "t": int(round(best[1])),
                              "label": short_label(media), "score": best[0]})
        found.sort(key=lambda r: -r["score"])
        refs = [{"video": r["video"], "t": r["t"], "label": r["label"]} for r in found[:max_refs]]
        if refs: c["videoRefs"] = refs
        elif "videoRefs" in c: del c["videoRefs"]
    return course

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--transcripts", required=True)
    ap.add_argument("--course", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--min-score", type=int, default=4)
    ap.add_argument("--min-terms", type=int, default=2)
    ap.add_argument("--max-refs", type=int, default=4)
    ap.add_argument("--video-ext", default=None)
    a = ap.parse_args()
    trs = [json.load(open(f, encoding="utf-8")) for f in sorted(glob.glob(os.path.join(a.transcripts, "*.json")))]
    course = json.load(open(a.course, encoding="utf-8"))
    index(course, course, min_score=a.min_score, min_terms=a.min_terms, max_refs=a.max_refs, video_ext=a.video_ext) if False else index(trs, course, a.min_score, a.min_terms, a.max_refs, a.video_ext)
    json.dump(course, open(a.out, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    n = sum(1 for c in course["chapters"] if c.get("videoRefs"))
    print("OK: %d/%d capitoli con videoRefs -> %s" % (n, len(course["chapters"]), a.out))

if __name__ == "__main__":
    main()
