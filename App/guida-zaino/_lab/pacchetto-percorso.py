from pathlib import Path
import os,json,re,zipfile
R=Path(os.environ['ZAINO_GUIDA_ROOT']);v=Path(os.environ['GUIDA_VAULT'])
assert str(v).startswith('/private/tmp/studia-guida-20261105-')
meta=json.loads((v/'demo.json').read_text());base=v/'Zaini'/meta['zaino'];G=R/'App/guida-zaino'
notes=[base/'APPUNTI'/n for n in meta['noteFiles']]
mappa=base/'MAPPE/Come si usa ZAINO.json'
deck=base/'PRESENTAZIONI'/meta['presentazione']/'presentazione.json';d=json.loads(deck.read_text())
ids={n['immagine']['id'] for n in json.loads(mappa.read_text())['nodi'] if n.get('immagine')}
album=json.loads((base/'ALBUM/_album.json').read_text());album['voci']=[x for x in album['voci'] if x['id'] in ids]
assert len(album['voci'])==meta['note']
files=[base/'_zaino.md',base/'_identita.json',base/'MATERIALI/PDF'/meta['pdf'],base/'MATERIALI/PDF/0002 - Scheda fotografata.pdf',mappa,deck,*notes]
files.extend(base/'ALBUM'/x['file'] for x in album['voci'])
files.extend(base/'MATERIALI/Figure'/ (meta['pdf'][:-4]+f'__p{i:03d}_f1.webp') for i in range(1,meta['note']+1))
files.extend(deck.parent/a['path'] for a in d['assets'].values())
readme='''COME SI USA ZAINO - zaino esempio per ZAINO 1.4.1
5 novembre 2026 - Giacomo Meschini - insegnai.ch

1. Estrai questo ZIP in una cartella del computer.
2. In ZAINO apri Impostazioni > Zaino e leggi il percorso della cartella dati.
3. Chiudi ZAINO.
4. Copia la cartella intro-a-zaino dentro la sottocartella Zaini di quel percorso.
   Se Zaini non esiste, creala. Non copiare dentro la cartella dell'applicazione.
   Se intro-a-zaino esiste gia, non sovrascriverla: conserva prima la tua copia.
5. Riapri ZAINO e scegli Intro a ZAINO dal menu accanto al nome dell'app.
6. Apri l'appunto 01 - Inizia qui.

Contenuto: miniguida PDF di 12 pagine, 12 appunti modificabili, una mappa
con nodi e sottonodi, una presentazione con 12 capitoli e 12 approfondimenti.
Le immagini degli appunti aprono la pagina corrispondente del PDF.
I file delle immagini rimangono inclusi: copia sempre lo zaino completo.
La sezione 4 della guida approfondisce tutti gli strumenti.
La guida si apre da Impostazioni > Zaino > Apri la guida allo ZAINO.

Il percorso manuale non richiede una API key. AI cloud e download sono facoltativi.
Il pacchetto non contiene credenziali, profili personali o conversazioni.
Non importare lo ZIP come corso e non trascinarlo nel lettore PDF.
Questo pacchetto e un contenuto didattico, non un aggiornamento dell'app.
'''
out=G/'download/Intro-a-ZAINO.zip'
with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
 z.writestr('LEGGIMI.txt',readme)
 z.writestr(meta['zaino']+'/ALBUM/_album.json',json.dumps(album,ensure_ascii=False,indent=2)+'\n')
 for p in sorted(set(files)):
  assert p.is_file(),p
  assert not re.search(r'[<>:"\\|?*]',p.name),p.name
  z.write(p,meta['zaino']+'/'+p.relative_to(base).as_posix())
with zipfile.ZipFile(out) as z:
 assert z.testzip() is None
 assert len([n for n in z.namelist() if '/APPUNTI/' in n and n.endswith('.md')])==meta['note']
 assert not any('/_versioni/' in n or '/CHAT/' in n for n in z.namelist())
print(f'{out}: {len(files)+2} file, {out.stat().st_size/1024/1024:.1f} MB')
