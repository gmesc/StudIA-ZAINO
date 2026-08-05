#!/usr/bin/env python3
"""
ocr — che cosa c'è dentro le pagine di un PDF, e quali vale la pena far leggere.

Due comandi, e la separazione è il punto:

    ocr.py scheda <pdf>...      elenca gli oggetti di ogni pagina. NON serve Chandra:
                                bastano pypdfium2 e qualche millisecondo a pagina.
    ocr.py leggi <pdf> <pagine> <indice.json> <cartella-figure>
                                fa leggere quelle pagine a Chandra e innesta il
                                risultato nell'indice. Serve Chandra, e costa
                                minuti a pagina.

«scheda» esiste per poter dire all'utente che cosa guadagnerebbe **prima** che
scarichi undici gigabyte e aspetti ore. Perciò non dipende da Chandra: se lo
facesse, l'unico modo di sapere se conviene installarlo sarebbe installarlo.

Perché contare gli oggetti invece di misurarne l'area: una tabella è disegnata
con filetti sottili — tanti tracciati, area minima — e su una slide l'oggetto
più grande è sempre il rettangolo di sfondo. Provato contro la lettura vera di
Chandra su sei pagine scelte a cavallo della soglia: la regola sull'area ne
sbagliava due, il conteggio nessuna. Il conteggio funziona perché è meccanico:
un oggetto immagine È una figura, e venti tracciati SONO una tabella o un disegno.

La regola vive in lib/ocr.js, non qui: qui si misura, là si decide.
"""

import json
import os
import sys

import pypdfium2 as pdfium
import pypdfium2.raw as C

T_TEXT = C.FPDF_PAGEOBJ_TEXT
T_PATH = C.FPDF_PAGEOBJ_PATH
T_IMG = C.FPDF_PAGEOBJ_IMAGE
T_FORM = C.FPDF_PAGEOBJ_FORM

MAX_PROFONDITA = 4


def conta_oggetti(pg):
    """Quanti oggetti di testo, tracciato e immagine contiene la pagina."""
    n = {"testo": 0, "tracciato": 0, "immagine": 0}

    def scendi(o, prof=0):
        t = o.type
        if t == T_TEXT:
            n["testo"] += 1
        elif t == T_PATH:
            n["tracciato"] += 1
        elif t == T_IMG:
            n["immagine"] += 1
        # I gruppi (Form XObject) vanno aperti a mano: in pypdfium2 un PdfObject
        # NON ha `get_objects()`, ce l'ha solo la pagina. Ed è dentro i gruppi
        # che stanno quasi sempre gli schemi: ignorandoli, su un corpus di 1377
        # pagine se ne perdevano 444 senza un solo errore.
        elif t == T_FORM and prof < MAX_PROFONDITA:
            try:
                quanti = C.FPDFFormObj_CountObjects(o.raw)
            except Exception:
                return
            for k in range(quanti):
                raw = C.FPDFFormObj_GetObject(o.raw, k)
                if raw:
                    scendi(pdfium.PdfObject(raw, page=o.page, pdf=o.pdf, level=prof + 1), prof + 1)

    for o in pg.get_objects():
        scendi(o)
    return n


def scheda_pdf(percorso):
    """Una riga per pagina: quanto testo si estrae, e quanta grafica c'è."""
    doc = pdfium.PdfDocument(percorso)
    pagine = []
    for i in range(len(doc)):
        pg = doc[i]
        try:
            n = conta_oggetti(pg)
        except Exception as e:
            # Una pagina illeggibile si dichiara: un `continue` muto qui
            # significherebbe un buco nell'elenco che nessuno può vedere.
            pagine.append({"p": i + 1, "errore": type(e).__name__})
            continue
        try:
            testo = (pg.get_textpage().get_text_bounded() or "").strip()
        except Exception:
            testo = ""
        pagine.append({"p": i + 1, "car": len(testo),
                       "nImg": n["immagine"], "nPath": n["tracciato"], "nTesto": n["testo"]})
    doc.close()
    return {"file": os.path.basename(percorso), "npagine": len(pagine), "pagine": pagine}


# --------------------------------------------------------------- lettura vera

ETICHETTE_FIGURA = ("Image", "Figure")
ETICHETTA_TABELLA = "Table"


def _pulisci(html):
    """Il testo di un blocco senza i tag: quello che va nell'indice testuale."""
    import re
    t = re.sub(r"<[^>]+>", " ", html or "")
    t = t.replace("&nbsp;", " ").replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">")
    return " ".join(t.split())


def leggi(percorso, numeri, cartella_figure, avanti=None):
    """
    Fa leggere a Chandra le pagine indicate. Restituisce il testo di ognuna e le
    figure ritagliate, ciascuna col NUMERO DI PAGINA VERO.

    ⚠️ Chandra confronta i valori di `page_range` con l'indice 0-based del
    documento (vedi chandra/input.py), mentre la sua riga di comando li
    documenta come numeri di pagina. Qui si passano numeri di pagina veri e si
    converte in un punto solo: sbagliando, ogni figura verrebbe attribuita alla
    pagina precedente — in silenzio, ed è proprio il numero che serve a chi poi
    clicca sulla figura per aprire il PDF.
    """
    from chandra.input import load_file
    from chandra.model import InferenceManager
    from chandra.model.schema import BatchInputItem

    numeri = sorted(set(int(n) for n in numeri))
    if not numeri:
        return {"pagine": [], "figure": []}
    os.makedirs(cartella_figure, exist_ok=True)
    stem = os.path.splitext(os.path.basename(percorso))[0]

    immagini = load_file(percorso, {"page_range": ",".join(str(n - 1) for n in numeri)})
    if avanti:
        avanti({"fase": "modello", "msg": "carico il modello"})
    mgr = InferenceManager(method="hf")

    pagine, figure = [], []
    for i, img in enumerate(immagini):
        n = numeri[i] if i < len(numeri) else numeri[-1]
        if avanti:
            avanti({"fase": "pagina", "pagina": n, "fatte": i, "totale": len(immagini)})
        # «ocr_layout» è il prompt che fa uscire i blocchi con bbox ed etichetta;
        # con «ocr» si otterrebbe il solo testo, e niente figure.
        res = mgr.generate([BatchInputItem(image=img, prompt_type="ocr_layout")])[0]
        if getattr(res, "error", False):
            pagine.append({"page": n, "errore": "il modello non ha risposto"})
            continue

        pezzi, k = [], 0
        nomi_crop = list(res.images.keys())
        for blocco in res.chunks:
            et = blocco.get("label")
            if et in ("Page-Header", "Page-Footer", "Blank-Page"):
                continue
            if et in ETICHETTE_FIGURA:
                k += 1
                nome = "%s__p%03d_f%d.webp" % (stem, n, k)
                crop = res.images.get(nomi_crop[k - 1]) if k - 1 < len(nomi_crop) else None
                if crop is not None:
                    crop.save(os.path.join(cartella_figure, nome))
                    figure.append({"p": n, "file": nome, "tipo": "figura",
                                   "didascalia": _pulisci(blocco.get("content")),
                                   "bbox": blocco.get("bbox")})
                continue
            testo = _pulisci(blocco.get("content"))
            if testo:
                pezzi.append(testo)
        pagine.append({"page": n, "text": " ".join(pezzi), "motore": "chandra",
                       "html": res.html, "tabelle": res.html.count("<table")})
    return {"pagine": pagine, "figure": figure}


def unisci(indice, letto):
    """
    Innesta ciò che ha letto Chandra nell'indice esistente, senza buttare via
    quello che pypdf aveva già estratto dalle altre pagine.

    `motore` si scrive su OGNI pagina, non solo sull'indice: un vault finisce
    per contenere pagine lette in due modi diversi, e senza dirlo non si può più
    sapere perché una figura c'è e un'altra no.
    """
    per_n = {p.get("page"): p for p in (letto.get("pagine") or [])}
    fuori = []
    for p in (indice.get("pages") or []):
        n = p.get("page")
        nuovo = per_n.get(n)
        if nuovo and not nuovo.get("errore"):
            fuori.append({"page": n, "text": nuovo.get("text", ""), "motore": "chandra",
                          "html": nuovo.get("html", "")})
        else:
            fuori.append({"page": n, "text": p.get("text", ""), "motore": p.get("motore", "pypdf")})
    motori = set(p.get("motore") for p in fuori)
    return dict(indice, pages=fuori,
                figure=(indice.get("figure") or []) + (letto.get("figure") or []),
                motore=("chandra" if motori == {"chandra"} else
                        "pypdf" if motori == {"pypdf"} else "misto"))


def main():
    if len(sys.argv) >= 3 and sys.argv[1] == "scheda":
        fuori = []
        for p in sys.argv[2:]:
            try:
                fuori.append(scheda_pdf(p))
            except Exception as e:
                fuori.append({"file": os.path.basename(p), "errore": str(e)[:200]})
        json.dump(fuori, sys.stdout)
        return 0

    if len(sys.argv) >= 5 and sys.argv[1] == "leggi":
        pdf, pagine, indice_json, cartella = sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5]
        numeri = [int(x) for x in pagine.split(",") if x.strip()]

        def avanti(ev):
            print("@AVANZ " + json.dumps(ev), flush=True)

        letto = leggi(pdf, numeri, cartella, avanti)
        try:
            with open(indice_json, encoding="utf-8") as f:
                indice = json.load(f)
        except Exception:
            indice = {"pdf": os.path.basename(pdf),
                      "npages": max(numeri), "pages": [{"page": n, "text": ""} for n in numeri]}
        unito = unisci(indice, letto)
        tmp = indice_json + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(unito, f, ensure_ascii=False)
        os.replace(tmp, indice_json)
        print("@FATTO " + json.dumps({"pagine": len(letto["pagine"]), "figure": len(letto["figure"])}), flush=True)
        return 0

    print(__doc__.strip(), file=sys.stderr)
    return 2


if __name__ == "__main__":
    sys.exit(main())
