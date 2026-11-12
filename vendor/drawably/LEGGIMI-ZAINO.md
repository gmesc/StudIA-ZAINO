# Sorgente Drawably incluso in ZAINO

Sottoinsieme originale di https://github.com/danielwh2/drawably, commit
`013c1a2dadf8d5b87c92698f18a60682711e4bfc`, versione 0.4.2. La licenza MIT
© 2026 Daniel Belyi è conservata integralmente. `provenienza.json` registra gli
SHA-256 dei file originali, confrontati anche con i blob Git della revisione.

`lib/drawably-tratti.ts` e `lib/drawably-catalogo.ts` sono adattatori ZAINO.
Riutilizzano le primitive originali e adattano i 23 controlli, decorazioni e
compositi documentati a un albero SVG statico e sicuro. Il tratto delle mappe
usa una singola passata chiusa; i nodi con immagine conservano gli angoli
superiori retti. Semantica di moduli, focus e animazione continua non fanno
parte dell’illustrazione salvata: per navigare fra slide si usa la Navbar.

Nessuna dipendenza runtime o chiamata di rete. Il font originale opzionale di
Drawably non viene copiato: ZAINO usa Patrick Hand già incluso e con licenza OFL.
L’interfaccia della libreria è in `App/assets/drawably/ui.js`; il catalogo è
caricato soltanto quando viene aperta. Font e licenza accompagnano l’HTML offline.

Rigenerare con `npm run drawably:build`, confrontare con `npm run drawably:verifica`.
La compilazione usa esbuild 0.28.2 già adottato dal progetto. Prova pura:
`node test/drawably.js`. Cablaggio UI: `test/cdp/prova-drawably.js`.
