# Tabelle in APPUNTI

Il comando **Inserisci o modifica tabella** nella toolbar apre l’editor a celle. Nell’anteprima basta cliccare la tabella. Si possono aggiungere righe e colonne dopo la cella selezionata, eliminare la riga o colonna corrente, scegliere l’intestazione e modificare font, dimensione, colori, allineamento, grassetto, corsivo e sottolineato. I comandi Grassetto/Corsivo/Codice formattano la selezione nella cella con Markdown. Annulla chiude senza applicare; Applica sostituisce soltanto la tabella, in un’operazione Undo. La rimozione di celle piene richiede conferma. Limiti: 50 righe, 20 colonne.

In PRESENTA selezionare l’oggetto tabella e usare **Copia oggetto** oppure ⌘/Ctrl+C fuori dai campi di testo. Incollare nell’appunto con ⌘/Ctrl+V. Il comando mantiene anche la copia interna fra slide. Gli appunti di sistema contengono i dati della tabella con font, dimensione, colore, sfondo, allineamento ed enfasi; APPUNTI li interpreta senza passare da HTML arbitrario. Non sono importate animazioni o posizione sulla slide. Le tabelle semplici scritte con la sintassi Markdown a barre verticali sono riconosciute quando iniziano un blocco.

Il file rimane Markdown: le tabelle formattate sono recinti `zaino-tabella` con un oggetto JSON versionato e validato. Nessun HTML viene eseguito. Gli appunti precedenti conservano la loro sintassi e gli altri blocchi non vengono riscritti. Il dialogo controlla che file, istanza e contenuto non siano cambiati prima di applicare modifiche.

PDF e DOCX usano la stessa tabella resa nell’anteprima. In PDF si ripetono le intestazioni e si evitano interruzioni dentro una riga. DOCX conserva celle modificabili, font, dimensioni, colori, sfondi, enfasi, allineamento, didascalie e rimandi già supportati dal convertitore. Il footer con titolo e pagina X di Y rimane. La disponibilità dei font e la paginazione del lettore Word possono produrre differenze rispetto al PDF.

## Verifiche del 4 novembre 2026

- 95 programmi Node verdi: `/private/tmp/zaino-tabelle-node.log`.
- `test/appunti-tabelle.js`: roundtrip, stili da PRESENTA, dati non validi e testo non eseguibile; controprova rossa togliendo gli stili.
- `test/cdp/prova-appunti-tabelle.js`: comando toolbar, modifica in anteprima, aggiunta riga, copia tramite scorciatoia di PRESENTA, incolla, riapertura e scrittura reale PDF/DOCX. La prova intercetta il contenuto scritto negli appunti di sistema, senza sovrascrivere il clipboard personale, e lo passa all’evento di incolla.
- Export DOCX precedente e parità dei due editor verificati. La toolbar è verde su un’istanza pulita (`/private/tmp/zaino-tabelle-toolbar.log`); nella sequenza di prove precedente aveva incontrato un problema di stato residuo nella chiusura dell’appunto.
- Log finale verde: `/private/tmp/zaino-tabelle-finale.log`.
- Prove esportate: `/private/tmp/zaino-tabelle-prova.pdf` e `.docx`. PDF renderizzato e ispezionato; DOCX verificato nella struttura OOXML. Verifica visiva finale in Microsoft Word da eseguire con l’utente.

Moduli: `App/assets/appunti/tabelle.js` (contratto e resa), `tabelle-ui.js` (dialogo e incolla), `tabelle.css`. Il trasferimento passa dal comando copia esistente di PRESENTA; il renderer DOCX raccoglie gli stili delle celle.
