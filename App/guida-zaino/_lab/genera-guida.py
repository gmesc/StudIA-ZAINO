from pathlib import Path
import json, html, re, os
R=Path(os.environ['ZAINO_GUIDA_ROOT']); G=R/'App/guida-zaino'
def e(s): return html.escape(str(s),quote=True)
def p(s): return '<p>'+s+'</p>'
def steps(*ss): return '<ol class="passi">'+''.join('<li>'+s+'</li>' for s in ss)+'</ol>'
def ul(*ss): return '<ul>'+''.join('<li>'+s+'</li>' for s in ss)+'</ul>'
def box(title,text): return '<aside class="callout"><b>'+title+'</b>'+p(text)+'</aside>'
def fig(name,caption): return '<figure><img src="img/nuova-'+name+'.png" alt="'+e(caption)+'" loading="lazy"><figcaption>'+caption+'</figcaption></figure>'
def h(id,title,body): return '<h3 id="'+id+'">'+title+'</h3>'+body
def table(rows):
 return '<div class="tabella"><table><thead><tr><th scope="col">Comando o voce</th><th scope="col">A cosa serve</th></tr></thead><tbody>'+''.join('<tr><td>'+a+'</td><td>'+b+'</td></tr>' for a,b in rows)+'</tbody></table></div>'
comandi=json.loads((G/'_lab/comandi.json').read_text())
def pannelli(nomi):
 risultato=''
 for nome in nomi:
  d=comandi['comandi-'+nome]
  punti=[{k:v for k,v in i.items() if k!='selector'} for i in d['items']]
  risultato+='<figure class="figura-comandi" data-rimandi="'+e(json.dumps(punti,ensure_ascii=False))+'"><img src="img/comandi-'+nome+'.png" width="'+str(round(d['width']*2))+'" height="'+str(round(d['height']*2))+'" alt="'+e(d['caption'])+'" loading="lazy"><figcaption>'+e(d['caption'])+'</figcaption></figure>'
  risultato+='<div class="tabella"><table class="tabella-comandi"><thead><tr><th scope="col">N.</th><th scope="col">Comando</th><th scope="col">Che cosa fa e come usarlo</th></tr></thead><tbody>'
  for i in punti:
   risultato+='<tr><td><span class="numero-rimando">'+str(i['numero'])+'</span></td><th scope="row">'+e(i['nome'])+'</th><td>'+e(i['descrizione'])+'</td></tr>'
  risultato+='</tbody></table></div>'
 return risultato

sections=[]
def sec(id,title,body): sections.append((id,title,body))
sec('panoramica','Che cosa puoi fare con ZAINO',
p('ZAINO raccoglie le tue fonti e gli strumenti per lavorarci. Uno <strong>zaino</strong> contiene i materiali di una materia, un progetto o una lezione.')+
h('studiare','Per studiare',steps('Crea uno zaino e importa un PDF, un video o un audio.','Leggi, sottolinea e annota le domande con le postille.','Affianca gli Appunti e riscrivi i concetti con parole tue.','Organizza le idee in una mappa o in una presentazione.','Ripassa con le cards e verifica la risposta nelle fonti.','Se vuoi, chiedi al tutor AI di spiegare un passaggio difficile.'))+
h('insegnare','Per insegnare',steps('Raccogli le fonti della lezione in uno zaino.','Scrivi una scheda negli Appunti e aggiungi immagini e rimandi.','Esporta la scheda in DOCX o PDF per distribuirla.','Costruisci una mappa o una presentazione con immagini, video e audio.','Apri la finestra parallela sullo schermo della classe.','Usa la LIM per spiegare. Salva la lavagnata e riaprila nella lezione successiva.'))+
fig('banco','Un banco di lavoro: la fonte rimane a fianco degli Appunti.')+
box('Parti senza AI','Leggere, scrivere, disegnare mappe, preparare presentazioni e usare la LIM non richiede un account ZAINO. I file restano sul computer.'))
sec('punti-di-forza','Le funzioni che fanno la differenza',
table([
('Tutto nello stesso spazio','Fonti, Appunti, mappe e PRESENTA si affiancano. Scegli tu quali strumenti vedere nel banco.'),
('Collegamenti alle fonti','Un rimando apre la pagina del PDF o il punto del video o dell’audio. Ritrovi il contesto mentre lavori.'),
('Finestra parallela','Proietta il contenuto su un altro schermo. Con PRESENTA, il GOBBO conserva sul tuo computer note e comandi.'),
('OCR','Riconosce il testo di un PDF scansionato, per selezionarlo e cercarlo. La qualità dipende dalla scansione.'),
('Controlli PDF','qpdf controlla la struttura; ClamAV cerca minacce conosciute. Sono strumenti locali opzionali, da installare e attivare.'),
('Ricerca per significato (embedding locale)','Trova nei tuoi materiali passaggi che parlano della stessa idea con parole diverse. Se cerchi «come respirano le piante», per esempio, puoi trovare un passaggio sullo scambio di gas nelle foglie. Per iniziare, scarica <strong>text</strong> in Impostazioni → AI → AI locale. Poi apri «Cerca nei materiali» e premi «Crea indice» per far leggere i documenti a ZAINO e preparare la ricerca. La ricerca avviene sul tuo computer. I download <strong>vision</strong> e <strong>video</strong> sono destinati a funzioni di ricerca in preparazione.'),
('Software libero','Il codice di ZAINO è aperto, con licenza GPL-3.0-or-later. I componenti mantengono le rispettive licenze.'),
('Offline e senza account ZAINO','Il lavoro manuale funziona senza rete. Download iniziali, aggiornamenti e AI cloud richiedono Internet.')])+
h('ai-svizzera','AI svizzera, se la vuoi',p('Infomaniak è un provider selezionabile. Per usarlo servono il tuo account del servizio AI e una API key personale.')+p('Una <strong>API key</strong> è una credenziale: autorizza ZAINO a usare il tuo servizio AI. Non è una password da condividere.')+
steps('Segui il <a href="https://insegnai.ch/articoliblog/guida-infomaniak.html" target="_blank" rel="noopener">tutorial API Infomaniak di insegnai.ch</a>.','Apri l’ingranaggio dell’app, poi «AI» → «AI cloud».','Scegli «Infomaniak» e incolla la chiave in «Nuova API key».','Premi «Salva chiave», aggiorna l’elenco e scegli il modello.','Se hai più prodotti AI Services, inserisci l’ID prodotto e salvalo.','Apri la chat, scegli le fonti e scrivi la tua richiesta.')+
p('Esempi: «Spiegami questo passaggio con un esempio»; «Prepara una sintesi con riferimenti alle fonti»; «Fammi una domanda alla volta».')+
box('Locale e cloud fanno lavori diversi','L’embedder locale trova passaggi pertinenti. Il tutor cloud formula risposte e genera materiali. Scaricare text non installa un tutor offline.')+
p('Le richieste cloud inviano al provider i passaggi selezionati dall’app, la conversazione e il profilo. Controlla costi e condizioni del tuo servizio. '+
'<a href="https://www.infomaniak.com/it/hosting/ai-services" target="_blank" rel="noopener">Informazioni ufficiali di Infomaniak</a>.')))
basic=[]
def basicpage(id,title,shot,read,actions,result,page):
 basic.append(dict(id=id,title=title,shot=shot,read=read,actions=actions,result=result,page=page))
basicpage('iniziare','Apri lo zaino esempio','banco','Lo zaino “Intro a ZAINO” è un laboratorio. Puoi modificare i suoi appunti, la mappa e la presentazione.',
['Scarica lo zaino esempio dalla guida.','Estrai lo ZIP in una cartella del computer.','Apri Impostazioni, poi Zaino e leggi il percorso della cartella dati.','Chiudi ZAINO prima di copiare i file.','Apri la cartella dati e crea la sottocartella Zaini, se manca.','Copia solo la cartella intro-a-zaino dentro Zaini.','Riapri ZAINO e scegli “Intro a ZAINO” nel menu accanto al nome dell’app.','Apri l’appunto “01 - Inizia qui”.'],
'Vedi gli appunti del percorso e la miniguida PDF nelle Fonti.',1)
basicpage('impostazioni','Impostazioni: scegli come lavorare','impostazioni','L’ingranaggio della topbar apre le Impostazioni. Le preferenze dell’AI sono facoltative; i file si possono usare subito.',
['Apri l’ingranaggio nella topbar.','Apri Aspetto e scegli Atkinson Hyperlegible, se ti aiuta a leggere.','Apri Utente e osserva le preferenze del tutor.','Apri Zaino e trova la cartella dati e l’elenco degli zaini.','Chiudi le Impostazioni con la X.'],
'Sai dove cambiare carattere, preferenze e cartella dei file.',2)
basicpage('ocr','OCR: rendi selezionabile una scansione','ocr','Un PDF scansionato contiene fotografie delle pagine. L’OCR riconosce le parole e aggiunge un testo selezionabile e ricercabile.',
['Apri nelle Fonti un PDF scansionato o fotografato.','Prova a selezionare una frase: se manca il testo, usa l’OCR.','Nella barra premi “Riconosci il testo di questo documento fotografato”.','Attendi il riconoscimento e controlla le parole lette.','Per fermarti usa “Ferma il riconoscimento del testo”.','Riprova la selezione e cerca una parola con SEARCH.'],
'Puoi selezionare e cercare le parole che prima erano soltanto in una fotografia.',3)
basicpage('modelli','AI locale e tutor cloud','modelli','Con text puoi cercare un’idea nei tuoi materiali anche quando usano parole diverse. La ricerca avviene sul tuo computer. Vision e video sono per funzioni in preparazione.',
['Apri Impostazioni, poi AI e AI locale.','Leggi dimensione e stato del componente text.','Premi text · Scarica solo se vuoi la ricerca per significato e hai una connessione.','Lascia AI cloud vuota se vuoi lavorare senza tutor.'],
'Distingui il download del modello locale dalla chiave per il tutor remoto.',3)
basicpage('sicurezza','PDF: analisi e scansione antivirus','sicurezza','qpdf verifica la struttura dei PDF e segnala anomalie. ClamAV cerca malware e virus conosciuti. I controlli lavorano sul computer, senza inviare i documenti online.',
['Apri Impostazioni, poi Sicurezza.','Leggi lo stato di qpdf e ClamAV.','Per usare un motore, premi Installa e attendi il completamento.','Seleziona Attiva controllo per il motore installato.','Per ClamAV controlla le firme e usa Aggiorna firme, se necessario.','Consulta Ultimo controllo e leggi gli eventuali avvisi.'],
'Sai quali controlli sono attivi e distingui un’analisi strutturale da una scansione antivirus.',5)
basicpage('sidebar','Sidebar: trova e organizza i materiali','sidebar','La colonna laterale elenca i materiali dello zaino. Le sezioni compaiono quando contengono qualcosa. Un numero indica lo split che mostra quel materiale.',
['Apri Fonti e scegli la miniguida PDF.','Apri Appunti e scegli “02 - Impostazioni”.','Trova il numero dello split accanto al materiale aperto.','Usa la matita della sezione per modificare o organizzare le voci disponibili.','Ridimensiona la colonna con il suo bordo.'],
'Il nome identifica il materiale; il numero indica dove lo stai guardando.',4)
basicpage('banchi','Banchi: prepara lo spazio','banchi','Il banco è la disposizione degli split. Uno split è un riquadro che ospita uno strumento. Cambiare banco non cancella i materiali.',
['Apri l’icona BANCO nella topbar.','Scegli una disposizione con due split affiancati.','Nel primo split scegli Fonti.','Nel secondo scegli Appunti.','Sposta il divisore per dare più spazio alla lettura.','Prova il disegno di un banco personale dal menu BANCO.'],
'Leggi il PDF e scrivi senza cambiare continuamente finestra.',5)
basicpage('split','Split: allarga, sposta e chiudi','split','La testata contiene il numero dello split, il nome dello strumento e i comandi. Passa il puntatore su un’icona per leggerne il nome.',
['Fai doppio clic sulla testata o sul numero dello split.','Ripeti il doppio clic per tornare al banco.','Trascina la testata su un altro split per scambiare i posti.','Apri la tendina dello strumento e prova Mappa.','Chiudi uno split con la sua X.','Riapri il materiale dalla sidebar.'],
'Hai modificato la vista. Il materiale è ancora nello zaino.',6)
basicpage('search','SEARCH: ritrova quello che hai scritto','search','La lente cerca per parole nei PDF leggibili, negli appunti, nei nodi delle mappe e nelle didascalie dello zaino aperto.',
['Apri la lente nella topbar.','Scrivi “banco”.','Leggi il tipo e il contesto di ciascun risultato.','Premi un risultato per raggiungere il passaggio.','Chiudi la ricerca e riaprila con un’altra parola.'],
'Trovi i testi senza ricordare in quale documento o appunto si trovano.',7)
basicpage('filesystem','File: dove sono e perché','file','La cartella dati scelta nelle Impostazioni contiene Zaini. Ogni zaino ha sottocartelle per fonti e materiali. I dati personali sono separati dal programma.',
['Apri Impostazioni e la scheda Zaino.','Leggi il percorso della cartella dati.','Apri quella cartella con il gestore dei file del computer.','Trova Zaini e poi intro-a-zaino.','Osserva MATERIALI, APPUNTI, MAPPE, ALBUM e PRESENTAZIONI.','Chiudi ZAINO prima di fare una copia completa della cartella dati.'],
'Sai fare un backup dei contenuti senza confonderli con il file dell’app.',8)
basicpage('proiettare','Leggi e mostra su un altro schermo','proiezione','Allargare uno split, usare lo schermo intero e aprire una finestra parallela sono tre azioni diverse.',
['Apri l’appunto del percorso e passa alla vista renderizzata.','Usa il comando di lettura per ingrandire il testo.','Prova lo schermo intero e torna indietro con Esc.','Apri la finestra parallela dalla testata dello split.','Sposta la finestra sullo schermo esterno, se disponibile.','Chiudi la finestra parallela quando hai finito.'],
'Sul computer mantieni gli strumenti; sullo schermo esterno mostri il contenuto.',9)
basicpage('conclusione','Prova mappa e presentazione','presenta','La mappa riassume il percorso con nodi e sottonodi. La presentazione ha slide principali e approfondimenti sotto ciascun capitolo.',
['Apri la mappa “Come si usa ZAINO”.','Espandi un ramo e apri il rimando alla pagina della miniguida.','Apri la presentazione “Come si usa ZAINO”.','Avvia Presenta e prova i capitoli e gli approfondimenti.','Torna alla guida e scegli una funzione nella sezione 4.'],
'Hai completato il percorso base. Approfondisci Fonti, Appunti, Mappa, PRESENTA, LIM e Ripasso nella sezione 4.',10)
for numero,b in enumerate(basic,1): b['page']=numero
body=(p('Impara facendo. Il percorso base comprende appunti brevi, una mappa, una presentazione e un PDF di '+str(len(basic))+' pagine.')+
 '<div class="download"><a class="azione" href="download/Intro-a-ZAINO.zip" download>Scarica lo zaino esempio</a><a class="azione" href="download/Miniguida-ZAINO.pdf">Apri la miniguida PDF</a></div>')
body+=box('Usa una copia per le prove','Se la cartella intro-a-zaino esiste già, conserva prima la tua copia. Lo ZIP contiene uno zaino completo. Non importarlo come corso e non trascinarlo sui PDF. Segui la copia della cartella indicata sotto.')
for b in basic:
 body+=h('base-'+b['id'],b['title'],p(b['read'])+steps(*[e(x) for x in b['actions']])+p('<strong>Controlla:</strong> '+e(b['result']))+fig(b['shot'],b['title']+'.')+p('<a href="download/Miniguida-ZAINO.pdf#page='+str(b['page'])+'">Apri la pagina '+str(b['page'])+' della miniguida PDF</a>.'))
body+=h('base-setting-voci','Le voci delle Impostazioni',pannelli(['impostazioni', 'impostazioni-chiudi'])+steps('Per eliminare uno zaino, apri Impostazioni → Zaino.','Controlla attentamente il nome della riga.','Premi il cestino e leggi la conferma.','Conferma solo se vuoi spostare l’intera cartella nel Cestino del sistema.'))
body+=h('base-file-cartelle','La cartella dei file, spiegata',p('L’app è il programma installato. La cartella dati è il posto che scegli per i tuoi materiali. Aggiornare il programma non richiede spostare i materiali.')+
p('Per esempio, puoi chiamarla <strong>ZAINO - file</strong> e salvarla nella tua cartella Documenti.')+
p('Il percorso effettivo si legge in <strong>Impostazioni → Zaino</strong>. Se la tua cartella si chiama già <strong>StudIA - file</strong>, continua a usare quella: non occorre rinominarla o spostarla. Se scegli un disco esterno, collegalo prima di aprire ZAINO.')+
'''<pre class="albero">ZAINO - file/
  Zaini/
    intro-a-zaino/
      _zaino.md             nome dello zaino
      _identita.json        identità per i rimandi tra zaini
      MATERIALI/PDF/        copie dei PDF importati
      MATERIALI/Video/      video importati
      MATERIALI/Audio/      audio importati
      MATERIALI/Indici-PDF/ testo estratto per la ricerca
      APPUNTI/             file Markdown e parole chiave
      MAPPE/               mappe modificabili in JSON
      ALBUM/               immagini, ritagli e catalogo
      PRESENTAZIONI/       documenti JSON e risorse delle slide
      LIM/                 lavagnate .excalidraw
      CHAT/  RIPASSO/       conversazioni, schede e tentativi
      _lavorazione/rag/    indice tecnico rigenerabile</pre>'''+
p('Le sottocartelle nascono quando servono. I PDF ricevono un prefisso numerico: aiuta l’app a mantenere i rimandi alle pagine.')+
p('Markdown e JSON conservano testi e strutture in formati leggibili. Le risorse rimangono accanto ai materiali: la cartella si può copiare.')+
p('Una parte della configurazione resta separata, nella cartella dati dell’app del sistema operativo: chiavi, percorso del vault, cache e modelli scaricati. Le disposizioni sono ricordate anche nella memoria locale dell’interfaccia.')+
box('Un backup utile','Chiudi ZAINO e copia tutta la cartella dati in un altro disco. Copiare soltanto i file Markdown può lasciare fuori immagini e fonti.')+
p('Evita di rinominare a mano file numerati, cartelle e file che iniziano con “_”. Usa i comandi dell’app. Per condividere tra computer, conserva la struttura completa.'))
body+=box('Hai concluso il percorso base','La <a href="#strumenti">sezione 4</a> spiega ogni strumento. Scegli il lavoro che vuoi fare adesso, senza leggere tutto in ordine.')
sec('primi-passi','Come si usa ZAINO: prova con lo zaino esempio',body)
tools=''
tools+=h('fonti','Fonti: leggere, sottolineare e collegare',p('Lo split Fonti apre PDF, video e audio. Puoi affiancare due Fonti per confrontare documenti diversi.')+
steps('Trascina il file nella finestra di ZAINO e attendi l’importazione.','Scegli il file nella sidebar o nella tendina delle Fonti.','Nei PDF, usa le frecce o il numero di pagina per spostarti.','Usa meno, percentuale e più per regolare lo zoom.','Seleziona una frase e scegli il colore della sottolineatura.','Aggiungi una postilla per ricordare perché quella frase è importante.')+
p('<strong>Menu del testo selezionato:</strong> trascina su una frase nel PDF. Scegli una sottolineatura o una parola chiave per conservarla, «Postilla» per aggiungere una nota, oppure «Appunta» per portare il passaggio negli Appunti con il riferimento alla fonte.')+pannelli(['fonti-lettura', 'fonti-zoom', 'fonti-azioni', 'fonti-file'])+
steps('Per un ritaglio, premi le forbici.','Traccia il rettangolo attorno alla figura.','Scrivi una didascalia riconoscibile.','Apri Album e trascina il ritaglio nel materiale che stai costruendo.')+
p('Nei video e negli audio, spostati al minuto utile e usa il comando di citazione. Il rimando conserverà quel punto temporale.')+
'<h4>Riconoscere il testo di una scansione</h4>'+steps('Apri il PDF fotografato o scansionato.','Premi «Riconosci il testo di questo documento fotografato» nella barra delle Fonti.','Attendi il riconoscimento. Per interrompere usa «Ferma il riconoscimento del testo».','Prova a selezionare una frase e a cercare una parola con SEARCH.')+box('Se non riesci a selezionare','Può essere una scansione: prova OCR. Un’immagine molto sfocata o una scrittura a mano può restare difficile da riconoscere.'))
tools+=h('parole-album','Parole chiave e Album: porta i contenuti dove servono',p('Parole chiave raccoglie le sottolineature. Album raccoglie immagini e ritagli. Le loro voci si possono trascinare negli strumenti compatibili.')+
steps('Apri Parole chiave in uno split e una Mappa in un altro.','Trascina una parola sulla mappa per creare un nodo.','Apri il rimando del nodo per ritrovare il passaggio originale.','Apri Album e scegli una fotografia o un ritaglio.','Trascinalo negli Appunti, nella Mappa, in PRESENTA o nella LIM.')+
p('Trascinare riusa il contenuto: non elimina l’originale dall’Album. Le destinazioni possono offrire comandi diversi per dimensione, didascalia e stile.')+
p('Per modificare una parola chiave, fai clic destro sulla parola: puoi cambiarne colore e postilla o riaprire la fonte. Per un’immagine, apri il suo menu con un clic: trovi didascalia, fonte ed eliminazione. Il comando «Porta nella lavagna LIM», quando presente, inserisce il contenuto nella lavagna dello stesso zaino.')+pannelli(['album-tipi', 'album-ricerca', 'parole-filtri', 'parole-ordine']))
tools+=h('appunti','Appunti: scrivere, citare e condividere',p('Un appunto è un file Markdown. Scrivi nella vista di modifica; la vista renderizzata mostra il risultato con titoli, immagini e collegamenti.')+
steps('Scegli Appunti nella testata dello split.','Premi più per creare un appunto e scrivi il titolo.','Scrivi un breve paragrafo. Seleziona una parola e premi Grassetto.','Aggiungi un titolo, un elenco o un riquadro dalla barra.','Passa alla vista renderizzata per controllare l’impaginazione.','Attendi il salvataggio prima di chiudere o cambiare zaino.')+
p('I numeri blu collegano ogni comando al ritaglio della barra. Per le formule matematiche scrivi la notazione LaTeX fra delimitatori <code>$…$</code>: non c’è un pulsante dedicato in questa barra.')+pannelli(['appunti-file', 'appunti-testo', 'appunti-elenchi', 'appunti-fonti', 'appunti-esporta'])+
steps('Per importare un DOCX, trascinalo nella finestra dell’app.','Apri l’appunto convertito e controlla titoli, tabelle e immagini.','Per esportare, premi Esporta nella barra degli Appunti.','Scegli PDF o DOCX.','Scegli dove salvare e apri il file esportato per controllarlo.')+
p('Un DOCX complesso può cambiare impaginazione durante la conversione. Verifica il risultato prima di distribuirlo.')+
'<h4>Citare una fonte dello stesso zaino</h4>'+steps('Seleziona il passaggio nel PDF.','Usa Appunta o il comando di citazione disponibile.','Apri il link nell’anteprima degli Appunti: ritorni alla fonte.')+
'<h4 id="citazione-altro-zaino">Citare un PDF di un altro zaino</h4>'+steps('Apri lo zaino che contiene il PDF originale.','Seleziona il passaggio e usa «Copia testo con fonte» dal menu della selezione.','Passa allo zaino in cui stai scrivendo.','Apri l’appunto e incolla la citazione nel testo.','Passa alla vista renderizzata e premi il riferimento.','La fonte si apre in una finestra di lettura senza cambiare il tuo zaino.')+
fig('citazione','La citazione apre un PDF appartenente a un altro zaino.')+
p('La finestra offre «Cita la pagina», «Cita PDF» e «Apri zaino di origine». La citazione riconosce lo zaino tramite la sua identità.')+
box('Per condividere una citazione tra zaini','Il destinatario deve avere anche lo zaino di origine. Il link non carica una copia del PDF su Internet. Una fonte rimossa o cambiata può produrre un avviso.'))
tools+=h('mappe','Mappe: costruisci una struttura di idee',p('Una mappa collega concetti e spiegazioni. I nodi possono contenere testo, immagini, video e riferimenti alle fonti.')+
steps('Apri Mappa e crea una nuova mappa con più.','Scrivi il titolo e aggiungi il primo nodo.','Aggiungi nodi secondari con i concetti principali.','Collega i nodi e scrivi una relazione, se serve.','Trascina parole chiave o immagini dall’Album.','Apri le impostazioni della mappa e prova una disposizione diversa.','Controlla la mappa adattandola allo spazio disponibile.')+
p('Nella mappa, fai clic su un nodo per modificarne testo, nota e contenuti. Il menu del nodo raccoglie le azioni disponibili. I collegamenti uniscono i nodi e possono avere un’etichetta; espandere o comprimere un ramo mostra o nasconde i sottonodi senza eliminarli.')+pannelli(['mappe-file', 'mappe-vista', 'mappe-orienta'])+
p('I bordi visibili dei nodi sono continui. Il pallino in alto a destra apre la fonte. Se un nodo ha più fonti, il numero le conta e il pallino apre l’elenco.')+
p('Puoi cambiare colore e aspetto dei contenuti. Le opzioni di immagine includono resa in bianco e nero e fusione con lo sfondo.')+
box('Un uso didattico','Mostra prima il nodo principale. Apri un ramo alla volta e chiedi agli studenti di spiegare il collegamento.'))
tools+=(G/'_lab/stili-community.html').read_text()
tools+=h('presentazioni','PRESENTA e GOBBO: prepara e conduci una lezione',p('PRESENTA costruisce le slide. Le slide principali scorrono per capitoli; gli approfondimenti stanno sotto la slide di riferimento.')+
steps('Apri PRESENTA dalla tendina di uno split.','Apri Documento e scegli «Nuova presentazione».','Assegna un titolo. Scegli una slide nell’elenco.','Usa Inserisci per aggiungere testo, elenchi, formule, tabelle o media.','Seleziona l’oggetto per cambiarne testo, dimensione e posizione.','Premi «+ SLIDE» per aggiungere la slide principale del tema successivo.','Apri il menu di una miniatura con il tasto destro. Scegli «Nuovo approfondimento».','Prova la navigazione prima di mostrarla alla classe.')+
pannelli(['presenta-documento', 'presenta-proietta', 'presenta-aspetto', 'presenta-animazioni'])+
'<h4>Stili, immagini e contenuti multimediali</h4>'+steps('Seleziona un oggetto nella slide.','Regola font, colore, allineamento e riquadro dai controlli disponibili.','Per un’immagine, prova ritaglio, opacità o filtri.','Aggiungi video e audio dallo zaino o dal computer.','Controlla riproduzione e volume durante la prova.','Per una navbar, scegli ambito, orientamento e aspetto grafico.')+
'<h4>Presentare su un altro schermo</h4>'+steps('Collega lo schermo o il proiettore al computer.','Premi Presenta.','Apri GOBBO sul tuo banco.','Scegli lo schermo della proiezione dai comandi del relatore.','Prova capitoli, approfondimenti e note private.','Al termine chiudi il player e continua a modificare in PRESENTA.')+
fig('gobbo','GOBBO: i comandi e le note restano sullo schermo del relatore.')+
p('L’esportazione HTML crea una cartella con la presentazione e le sue risorse. Conserva e condividi tutta la cartella. Le note private non entrano nell’esportazione pubblica.'))
tools+=h('lim','LIM: conserva il lavoro fatto durante la lezione',p('La LIM è una lavagna per scrivere, disegnare, collegare idee e affiancare materiali. È utile per spiegare in classe e ragionare mentre studi.')+
steps('Apri LIM nella tendina di uno split.','Premi più per una lavagna nuova.','Scegli penna, testo, forma o freccia nella barra di disegno.','Disegna o scrivi sul foglio.','Premi Salva per conservare la nuova lavagnata.','Nella sidebar LIM, premi la matita della sezione e poi quella accanto alla lavagnata.','Riapri la lavagnata dalla sidebar quando riprendi la lezione.')+
pannelli(['lim-file', 'lim-forme', 'lim-scrivi', 'lim-menu'])+
steps('Affianca Parole chiave o Album alla LIM.','Trascina un contenuto sul foglio oppure usa «Porta nella lavagna LIM».','Disponi gli elementi e aggiungi una spiegazione.','Apri la finestra parallela per mostrare il lavoro alla classe.')+
p('Le lavagnate sono file .excalidraw nella cartella LIM dello zaino. Includono i dati delle immagini incorporate. Non sono documenti indicizzati dal tutor.'))
tools+=h('ripasso','Ripasso, schede e ricerca per significato',p('Il Raccoglitore conserva le schede generate dalle fonti. Ripasso propone domande e registra i tentativi. La generazione e il riscontro AI richiedono un provider configurato.')+
'<h4>1. Prepara l’indice locale</h4>'+steps('Apri Impostazioni → AI → AI locale.','Scarica text e attendi lo stato pronto.','Apri «Cerca nei materiali» nel Raccoglitore.','Premi «Crea indice», se l’indice manca.','Attendi la fine: l’app legge le fonti e prepara i passaggi.','Scrivi una domanda o un concetto e apri i risultati pertinenti.')+
fig('ricerca-materiali','Ricerca per significato e stato dell’indice locale.')+
p('L’indice si aggiorna dopo aggiunte e modifiche salvate nello zaino aperto. Il pulsante può diventare «Aggiorna indice» o «Ricostruisci indice».')+
'<h4>2. Crea una scheda</h4>'+steps('Apri il Raccoglitore e scegli le fonti utili.','Scegli il tipo di scheda: per esempio sintesi, concetti o domande.','Prepara l’analisi e controlla modello e stima del costo.','Avvia la generazione e attendi il completamento.','Rileggi la scheda e apri i riferimenti alla fonte.','Correggi o scarta i contenuti che non ti aiutano.')+
fig('schede','Raccoglitore: prepara e controlla i materiali di studio.')+
'<h4>3. Studia con cards e domande</h4>'+steps('Apri Ripasso e scegli l’ambito delle fonti o delle schede.','Leggi il fronte della card e prova a rispondere prima di voltarla.','Mostra la risposta e confrontala con la tua.','Se usi il tutor, invia un tentativo scritto e leggi il riscontro.','Apri il riferimento per verificare il passaggio originale.','Ripeti le domande ancora difficili.')+
fig('ripasso','Ripasso: prova a rispondere, poi controlla la fonte.')+
box('SEARCH o ricerca per significato?','La lente trova parole nei contenuti dello zaino. La ricerca per significato usa text e l’indice. Nessuna delle due richiede una chiave cloud.')+
p('Se una fonte cambia, le schede già create possono riferirsi alla versione precedente. Rileggile dopo un aggiornamento importante.'))
tools+=(G/'_lab/novita-20261112.html').read_text()
blocchi={m.group(1):m.group(0) for m in re.finditer(r'<h3 id="([^"]+)">.*?(?=<h3 id=|$)',tools,re.S)}
def parte(id,livello=3):
 testo=blocchi.pop(id)
 if livello==4: testo=re.sub(r'<h3(.*?)>(.*?)</h3>',r'<h4\1>\2</h4>',testo,count=1,flags=re.S)
 return testo
comuni=h('barra-comune','La barra comune a tutti gli split',p('Ogni split ha una testata con numero, strumento, documento e comandi della vista. Impara questi controlli una volta: li ritrovi nei diversi strumenti. I comandi specifici del contenuto sono nella barra sottostante.')+pannelli(['split','split-documento','split-vista'])+p('Trascina la testata sopra un altro split per scambiare le posizioni. Le funzioni disponibili dipendono dal contenuto: per esempio, PRESENTA apre il player delle slide dal comando di proiezione.'))
ordine=comuni+parte('finestra-esterna-strumenti',4)
ordine+=h('laser-spot','Laser e Spot: indica un dettaglio durante la spiegazione',p('Il puntatore si usa nell’area con il bordo arancione del banco che stai proiettando. Il gesto appare sia sul tuo computer sia nella finestra esterna e non modifica il documento.')+steps('Apri la finestra parallela dalla testata dello split.','Nel banco principale, premi l’ingranaggio accanto alla scritta «Area proiettata».','Scegli forma, colore, bordo e dissolvenza con i comandi illustrati sotto.','Chiudi il menu. Nell’area arancione tieni premuto il tasto destro del mouse e trascina.','Rilascia il tasto per avviare la dissolvenza. Premi Esc per cancellare il segno.')+pannelli(['laser-apri','laser-forme','laser-colore','laser-durata'])+p('Le impostazioni vengono ricordate sul computer. Il semplice movimento del mouse non mostra un puntatore al pubblico. I disegni salvati sulla LIM o sul documento restano distinti dai segni temporanei del laser.'))
# Le tre catture per forma confrontano Spot spento, acceso e senza bordo.
ordine+=p('Gli esempi seguenti mostrano la finestra vista dal pubblico. Ogni anteprima alterna tre schermate: <strong>Spot spento</strong>, <strong>Spot acceso con bordo rosso</strong> e <strong>Spot acceso con Bordo = 0</strong>. Premi l’anteprima per fermarti sul fotogramma che stai guardando. Nella vista ingrandita puoi usare le frecce per confrontare le tre schermate. Con Bordo = 0 il contorno scompare: rimangono l’interno nitido e l’esterno oscurato e sfocato.')
for forma,titolo,descrizione in [
 ('laser','Laser: una traccia disegnata a mano','Senza Spot il gesto lascia una traccia libera. Con Spot disegna il contorno della zona che vuoi mostrare: ZAINO chiude il contorno e oscura e sfoca il resto della finestra.'),
 ('box','Box: una zona rettangolare','Trascina fra due angoli opposti. Con Spot spento compare soltanto il bordo; con Spot acceso il testo dentro il rettangolo rimane nitido e l’esterno viene oscurato e sfocato.'),
 ('cerchio','Cerchio: una zona circolare','Trascina dal centro verso il bordo. Con Spot spento il cerchio indica il dettaglio; con Spot acceso soltanto l’interno resta nitido e l’esterno viene oscurato e sfocato.')]:
 ordine+='<h5 id="esempio-'+forma+'">'+titolo+'</h5>'+p(descrizione)
ordine=ordine.replace('<h3 id="laser-spot">','<h4 id="laser-spot">').replace('Laser e Spot: indica un dettaglio durante la spiegazione</h3>','Laser e Spot: indica un dettaglio durante la spiegazione</h4>')
ordine+=parte('fonti')
appunti,citazione=parte('appunti').split('<h4 id="citazione-altro-zaino">',1)
ordine+=appunti
for id in ['menu-stili-paragrafo','icone-callout','dizionari-appunti','appunti-a4-disegni']:ordine+=parte(id,4)
ordine+='<h4 id="citazione-altro-zaino">'+citazione
ordine+=parte('parole-album')
ordine+=parte('mappe')+parte('presentazioni')+parte('presentazioni-navbar-animazioni',4)
ordine+=parte('lim')+parte('ripasso')
ordine+=parte('stili-community')+parte('tuning-personalizzazione',4)
for id in ['squig-in-zaino','drawably-in-zaino','navbar-da-immagine']:ordine+=parte(id,4)
assert not blocchi,blocchi.keys()
sec('strumenti','Banchi di lavoro - split',ordine)
crediti=json.loads((R/'App/assets/dati/crediti.json').read_text())
voci=crediti.get('voci',[])
nomi=['Electron','Chromium','Node.js','PDF.js','EasyMDE','CodeMirror 5','Excalidraw','reveal.js','Atkinson Hyperlegible','Lucide','OpenMoji','Tesseract.js','qpdf','ClamAV']
rows=[]
for name in nomi:
 matches=[v for v in voci if name.lower() in v.get('nome','').lower()]
 if matches:
  v=matches[0];rows.append(('<a href="'+e(v.get('url','#'))+'">'+e(v['nome'])+'</a>',e(v.get('ruolo',''))+' · '+e(v.get('licenza',''))))
sec('crediti','Chi sviluppa ZAINO e i componenti usati',p('ZAINO è sviluppato da <strong>Giacomo Meschini</strong>, insegnai.ch. Contatto: <a href="mailto:giacomo@insegnai.ch">giacomo@insegnai.ch</a>.')+
p('Il codice sorgente è disponibile nel <a href="https://github.com/gmesc/StudIA-ZAINO">repository pubblico di ZAINO</a>. La versione descritta in questa guida è la 1.4.1.')+
steps('Apri le Impostazioni con l’ingranaggio.','Premi il mago nella testata.','Cerca un componente o una licenza.','Apri il testo integrale oppure esporta NOTICE.txt.')+fig('crediti','Il mago nella testata delle Impostazioni apre crediti e licenze.')+
table(rows)+p('Questa tabella è una selezione. L’inventario completo con i testi delle licenze è incluso nell’app. '+
'Il marchio deriva dallo zaino OpenMoji, con licenza CC BY-SA 4.0. Atkinson Hyperlegible è distribuito con SIL Open Font License.'))
sec('condizioni-privacy','Condizioni d’uso e privacy',
h('condizioni','Uso del programma e dei materiali',p('ZAINO è software libero con licenza GNU GPL, versione 3 o successiva. Puoi usarlo, studiarlo, modificarlo e ridistribuirlo secondo la licenza.')+
p('Il programma è fornito senza garanzie, nei limiti indicati dalla <a href="https://www.gnu.org/licenses/gpl-3.0.html">GPL</a>. Il testo completo è incluso nell’app e disponibile nel <a href="https://github.com/gmesc/StudIA-ZAINO/blob/main/LICENSE">file LICENSE del progetto</a>.')+
p('I componenti di terzi mantengono le proprie licenze. La licenza del programma non cambia i diritti su PDF, immagini e altri materiali importati.')+
p('Importa e condividi solo materiali che puoi utilizzare. Le risposte AI possono contenere errori: verifica le fonti prima di studiare o distribuire una scheda.')+
p('Questa sezione riassume il funzionamento e le condizioni della licenza; non introduce un abbonamento o condizioni aggiuntive.'))+
h('privacy','Privacy policy: dati locali e servizi esterni',table([
('Questa guida','Non usa strumenti di analisi delle visite o font remoti. Ricorda il tema scelto nella memoria locale del browser.'),('File personali','Fonti, appunti, mappe, presentazioni e lavagnate restano nella cartella dati scelta. ZAINO non li carica su un proprio server.'),('Ricerca e indice','L’indice text viene elaborato sul computer e salvato nello zaino. Una cartella sincronizzata può copiarlo nel servizio scelto da te.'),('AI cloud','Invia al provider i passaggi pertinenti dei materiali, il messaggio, la cronologia e le preferenze del profilo. Il servizio ricevente applica le sue condizioni.'),('Chiavi API','Sono credenziali personali salvate nell’area dati dell’app. Non inserirle negli appunti o negli screenshot.'),('Download','Modelli e aggiornamenti delle firme antivirus richiedono collegamenti ai rispettivi distributori. Non sono upload dei tuoi documenti.'),('Wikipedia e link esterni','Spiegamelo può consultare Wikipedia. Aprire un link esterno coinvolge il sito scelto e il tuo browser.'),('Sincronizzazione e backup','Se scegli una cartella cloud o di rete, anche il relativo servizio gestisce le copie dei file. La scelta dipende da te.'),('Esportazioni','PDF, DOCX e cartelle HTML sono copie da condividere consapevolmente. Controlla contenuti, immagini e riferimenti prima di inviarli.')])+
steps('Per lavorare senza AI cloud, lascia vuota la chiave o rimuovila dalle Impostazioni.','Per cancellare una conversazione, usa il comando della sua cronologia.','Per eliminare uno zaino, controlla il nome e usa il cestino in Impostazioni → Zaino.','Gestisci separatamente il Cestino del sistema e le copie di backup o cloud.','Per revocare una chiave, usa anche il pannello del provider.')+
p('Per richieste sul progetto o sulla descrizione dei dati: <a href="mailto:giacomo@insegnai.ch">giacomo@insegnai.ch</a>. '+
'Per account, fatturazione o trattamento presso il provider AI, contatta quel servizio.')+
p('Informazioni verificate sul codice della versione 1.4.1 il 12 novembre 2026. '+
'<a href="https://www.infomaniak.com/it/hosting/ai-services">AI Services Infomaniak</a> · '+
'<a href="https://welcome.infomaniak.com/api/web-components/1/cgu/latest?id=87&amp;locale=it_IT">Condizioni del servizio AI Infomaniak</a>.')))
intro='''<!doctype html><html lang="it" data-theme="chiaro"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>ZAINO · Guida per studiare e insegnare</title><meta name="description" content="La guida di ZAINO: primi passi con uno zaino esempio, miniguida PDF e istruzioni per tutti gli strumenti."><link rel="stylesheet" href="stile.css?v=2026111216"></head><body>
<a class="skip" href="#inizio">Salta al contenuto</a><header class="topbar"><button class="tbtn menubtn" id="menuBtn" aria-label="Mostra o nascondi l’indice"></button><a class="brand" href="#inizio"><img class="cap" src="../assets/1F392.svg" width="32" height="32" alt=""><b>STUDIA ZAINO</b><span>Guida</span></a><a class="tbtn download-pdf" href="download/Miniguida-ZAINO.pdf">Miniguida PDF</a><span class="tbsep"></span><button class="tbtn" id="temaBtn" aria-label="Cambia tema"></button></header><div class="wrap"><aside class="sidebar" aria-label="Indice della guida"><h2>Il tuo percorso</h2><ol class="toc" id="toc"></ol><div class="sidebar-foot">ZAINO 1.4.1<br>12 novembre 2026</div></aside><main id="inizio"><article><p class="kicker">Guida di ZAINO · studiare e insegnare</p><h1>Le tue fonti.<br>Il tuo spazio di lavoro.</h1><p class="lead">Leggi, collega le idee e costruisci i tuoi materiali. Parti dal percorso pratico, poi scopri ogni strumento.</p><nav class="percorsi" aria-label="Da dove cominciare"><a href="#panoramica">Scopri ZAINO<span>Che cosa puoi farci</span></a><a href="#primi-passi">Impara facendo<span>Apri lo zaino esempio</span></a><a href="#strumenti">Trova un comando<span>Le istruzioni per ogni split</span></a></nav>'''
ending='''<footer>Guida di StudIA - ZAINO · versione 1.4.1 · 12 novembre 2026 · <a href="#crediti">Crediti</a> · <a href="#condizioni-privacy">Condizioni e privacy</a></footer></article></main></div><dialog class="lightbox" id="lb" aria-label="Schermata ingrandita"><button class="lbx" aria-label="Chiudi"></button><button class="lbp" aria-label="Precedente"></button><figure><div class="schermata"><img alt=""></div><figcaption></figcaption><ol class="rimandi" hidden></ol></figure><button class="lbn" aria-label="Successiva"></button></dialog><script src="../assets/interfaccia/icone.js"></script><script src="schermate.js?v=2026111215"></script><script src="guida.js?v=2026111216"></script></body></html>'''
documento=intro+''.join('<section class="cap" id="'+id+'"><h2 data-n="'+str(i).zfill(2)+'">'+title+'</h2>'+b+'</section>' for i,(id,title,b) in enumerate(sections,1))+ending
for tag in ['section','h2','h3','h4','p','ol','ul','table','figure','aside','header','footer']:
 documento=documento.replace('</'+tag+'>','</'+tag+'>\n')
for nome in json.loads((G/'_lab/didattica.json').read_text()):
 documento=documento.replace('src="img/nuova-'+nome+'.png"','src="img/didattica-'+nome+'.png"')
documento=re.sub(r'src="((?:img|download)/[^"]+)"',r'src="\1?v=2026111215"',documento)
(G/'index.html').write_text(documento)
(G/'_lab/percorso-base.json').write_text(json.dumps(basic,ensure_ascii=False,indent=2)+'\n')
print(f'Scritti 6 capitoli e {len(basic)} tappe pratiche.')
