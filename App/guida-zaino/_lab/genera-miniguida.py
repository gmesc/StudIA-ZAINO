from pathlib import Path
import os,json,html
from fontTools.ttLib import TTFont as ConvertFont
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Paragraph
from reportlab.lib.utils import ImageReader
from reportlab.lib.colors import HexColor
R=Path(os.environ['ZAINO_GUIDA_ROOT']);G=R/'App/guida-zaino';T=Path('/private/tmp/studia-guida-20261105-pdf');T.mkdir(exist_ok=True)
for weight in ['Regular','Bold','Italic']:
 f=ConvertFont(R/f'App/assets/presentazioni/fonts/AtkinsonHyperlegible-{weight}.woff2');f.flavor=None;f.save(T/f'{weight}.ttf')
 pdfmetrics.registerFont(TTFont('Atkinson'+('' if weight=='Regular' else weight),str(T/f'{weight}.ttf')))
pdfmetrics.registerFontFamily('Atkinson',normal='Atkinson',bold='AtkinsonBold',italic='AtkinsonItalic',boldItalic='AtkinsonBold')
out=G/'download/Miniguida-ZAINO.pdf'
c=canvas.Canvas(str(out),pagesize=(595.276,841.89));c.setTitle('Come si usa ZAINO - Miniguida pratica');c.setAuthor('Giacomo Meschini · insegnai.ch');c.setSubject('Impostazioni, OCR, sicurezza PDF, sidebar, split e banchi, SEARCH e cartella dei file. ZAINO 1.4.1.')
W,H=595.276,841.89;X=38;L=W-2*X
ACCENTO='#0f766e';GRIGIO='#5b6069'
# Spazi in punti: il titolo resta più vicino al proprio contenuto.
GAP_TITOLO_TESTO=3;GAP_SEZIONE_ATTIVITA=1
GAP_TITOLETTO_TESTO=5;GAP_TITOLETTO_ELENCO=8;PRIMA_TITOLETTO=18
style=ParagraphStyle('corpo',fontName='Atkinson',fontSize=11,leading=15,textColor=HexColor('#16181d'))
small=ParagraphStyle('piccolo',parent=style,fontSize=10,leading=13)
title=ParagraphStyle('titolo',parent=style,fontName='AtkinsonBold',fontSize=23,leading=25,textColor=HexColor(ACCENTO))
def text(s,y,st=style,x=X,w=L,draw=True,gap=7):
 p=Paragraph(s.replace('→',' / '),st);_,h=p.wrap(w,900)
 if draw:p.drawOn(c,x,y-h)
 return y-h-gap
def label(s,y,draw=True,gap=GAP_TITOLETTO_TESTO,color=ACCENTO):
 if draw:c.setFillColor(HexColor(color));c.setFont('AtkinsonBold',10);c.drawString(X,y,s)
 return y-gap
def tail(b,y,draw=True):
 y=label('PROVA TU',y,draw,gap=GAP_TITOLETTO_ELENCO)
 for i,s in enumerate(b['actions'],1):
  if draw:
   c.setFillColor(HexColor('#f97316'));c.circle(X+9.5,y-7.5,9.5,fill=1,stroke=0)
   c.setFillColor(HexColor('#ffffff'));c.setFont('AtkinsonBold',10);c.drawCentredString(X+9.5,y-11.2,str(i))
  y=text(html.escape(s),y,small,x=X+29,w=L-29,draw=draw)
 y-=4
 def extra(s):
  nonlocal y;y=text(s,y,small,draw=draw)
 if b['id']=='impostazioni':
  y=label('LE VOCI DELLE IMPOSTAZIONI',y-14,draw)
  extra('<b>Utente:</b> preferenze per il tutor. <b>Zaino:</b> cartella dati e gestione degli zaini. <b>Aspetto:</b> carattere. <b>AI:</b> cloud e modelli locali. <b>Sicurezza:</b> controlli PDF. <b>Mago:</b> crediti e licenze.')
  extra('Per eliminare uno zaino: Impostazioni → Zaino → cestino sulla sua riga → leggi la conferma. L’intera cartella va nel Cestino del sistema.')
 if b['id']=='ocr':
  extra('<b><font color="#0f766e">Per un buon risultato:</font></b> usa pagine dritte, nitide e ben illuminate. Rileggi nomi, numeri e formule: il testo riconosciuto può contenere errori.')
  extra('Il riconoscimento lavora sul computer. Fermarlo conserva le pagine già riconosciute; puoi riprendere quelle mancanti. Il pulsante si attiva per i documenti che hanno pagine da riconoscere.')
 if b['id']=='modelli':
  extra('La API key autorizza l’uso del tuo servizio AI. Per Infomaniak: AI → AI cloud → provider Infomaniak → Salva chiave → scegli modello. L’ID prodotto serve se il rilevamento automatico non basta.')
  extra('<link href="https://insegnai.ch/articoliblog/guida-infomaniak.html" color="#1d4ed8">Tutorial API Infomaniak su insegnai.ch</link>. Il cloud richiede rete e può avere costi. Il download text non installa un tutor offline.')
 if b['id']=='sicurezza':
  extra('<b>qpdf:</b> controlla la struttura del PDF; non è un antivirus. <b>ClamAV:</b> confronta il contenuto con le firme di minacce note. Installazione e attivazione sono due azioni separate.')
  extra('Un controllo attivo che non può essere completato blocca il PDF e mostra una spiegazione. Se Installa non è disponibile, il componente può mancare nel pacchetto dell’app. Nessun controllo garantisce l’assenza di ogni minaccia.')
 if b['id']=='search':
  extra('<b>Lente:</b> ricerca rapida per parole nello zaino aperto. <b>Cerca nei materiali:</b> ricerca anche per significato, dopo il download text e la creazione dell’indice. Non serve una chiave cloud per cercare.')
 if b['id']=='filesystem':
  y=label('LA STRUTTURA DELLO ZAINO',y-14,draw)
  extra('<b>MATERIALI/PDF, Video, Audio:</b> copie delle fonti. <b>Indici-PDF:</b> testo estratto per cercare.<br/><b>APPUNTI:</b> testi Markdown e parole chiave. <b>MAPPE:</b> strutture JSON.<br/><b>ALBUM:</b> immagini e catalogo. <b>PRESENTAZIONI:</b> JSON e risorse.<br/><b>LIM:</b> file .excalidraw. <b>CHAT e RIPASSO:</b> conversazioni e studio.<br/><b>_zaino.md e _identita.json:</b> nome e identità. <b>_lavorazione/rag:</b> indice locale rigenerabile.')
  extra('<b><font color="#0f766e">Perché:</font></b> i contenuti sono separati dal programma e conservati in formati leggibili o modificabili. La struttura mantiene uniti testi, immagini e rimandi. I numeri dei PDF aiutano a riconoscere le fonti.')
  extra('Le cartelle nascono quando servono. Chiavi, impostazioni, cache e modelli stanno nell’area dati dell’app del sistema operativo. Le disposizioni sono ricordate anche nell’interfaccia. Usa l’app per rinominare i materiali.')
 if b['id']=='proiettare':
  extra('<b>Split allargato:</b> occupa il banco. <b>Schermo intero:</b> occupa lo schermo, Esc torna indietro. <b>Finestra parallela:</b> una seconda finestra per mostrare il contenuto. Per le slide usa PRESENTA e GOBBO.')
 if b['id']=='conclusione':
  extra('Per continuare: Impostazioni → Zaino → “Apri la guida allo ZAINO”. Vai alla <b>sezione 4</b>: Fonti, Parole chiave e Album, Appunti, Mappe, PRESENTA, LIM, Ripasso.')
 y-=PRIMA_TITOLETTO
 y=label('HAI RAGGIUNTO L’OBIETTIVO SE…',y,draw)
 return text(html.escape(b['result']),y,small,draw=draw)
data=json.loads((G/'_lab/percorso-base.json').read_text());metrics=[]
for b in data:
 c.setFillColor(HexColor('#fbfbfa'));c.rect(0,0,W,H,fill=1,stroke=0)
 c.setStrokeColor(HexColor('#dcdcdc'));c.line(X,H-53,W-X,H-53)
 c.setFillColor(HexColor(GRIGIO));c.setFont('Atkinson',9);c.drawString(X,H-38,'ZAINO · MINIGUIDA PRATICA')
 c.bookmarkPage(b['id']);c.addOutlineEntry(b['title'],b['id'],0)
 y=label(f"{b['page']:02d} / IMPARA FACENDO",H-78,gap=GAP_SEZIONE_ATTIVITA,color='#16181d')
 y=text(html.escape(b['title']),y,title,gap=GAP_TITOLO_TESTO);y=text(html.escape(b['read']),y)
 shot=G/('img/nuova-'+b['shot']+'.png');assert shot.is_file(),shot
 im=ImageReader(str(shot));iw,ih=im.getSize();padding=12 if b['id']=='modelli' else 0
 cap={'iniziare':355,'search':355,'filesystem':300,'proiettare':355,'conclusione':355,'ocr':280,'sicurezza':270,'modelli':320}.get(b['id'],240)
 tailheight=1000-tail(b,1000,False)
 available=y-20-tailheight-54
 height=min(cap,available,(L-2*padding)*ih/iw+2*padding);assert height>30,(b['id'],height)
 innerh=height-2*padding;width=innerh*iw/ih+2*padding;left=X+(L-width)/2
 if padding:c.setFillColor(HexColor('#ffffff'));c.rect(left,y-height,width,height,fill=1,stroke=0)
 c.drawImage(im,left+padding,y-height+padding,width-2*padding,innerh,mask='auto')
 c.setStrokeColor(HexColor('#dcdcdc'));c.rect(left,y-height,width,height,fill=0,stroke=1)
 y=tail(b,y-height-20)
 assert y>=53,(b['id'],y)
 metrics.append({'id':b['id'],'page':b['page'],'imageWidth':round(width,1),'imageHeight':round(height,1),'bottom':round(y,1)})
 c.setStrokeColor(HexColor('#dcdcdc'));c.line(X,39,W-X,39);c.setFillColor(HexColor(GRIGIO));c.setFont('Atkinson',9);c.drawString(X,24,'ZAINO 1.4.1 · 5 novembre 2026 · Giacomo Meschini');c.drawRightString(W-X,24,f"{b['page']} / {len(data)}")
 c.showPage()
c.save();(T/'misure.json').write_text(json.dumps(metrics,indent=2));print(out);print(json.dumps(metrics,indent=2))
