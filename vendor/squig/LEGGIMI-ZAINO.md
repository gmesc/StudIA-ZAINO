# Sorgente Squig incluso in ZAINO

Questi file originali provengono da pablostanley/squig, commit
`dd42610b2030b5547e0ce94d5771f45c246792ec`. `provenienza.json` registra le
impronte SHA-256 del sottoinsieme incluso. Conservare il LICENSE MIT originale.

Sono inclusi catalogo, primitive, sei palette e cinque pesi delle icone Phosphor.
Non sono inclusi l’editor React, servizi remoti, account, analisi degli accessi o
applicazione Next.js. Gli adattamenti sono fuori da questa cartella:
`lib/squig-catalogo.ts`, `lib/squig-tratti.ts` e `App/assets/squig/ui.js`.

`npm run squig:build` genera i due moduli locali UMD usando esbuild 0.28.2 e
Rough.js 4.6.4, già adottato da ZAINO e ora dipendenza diretta bloccata.
`npm run squig:verifica` confronta i byte ricompilati. Non servono fetch durante
la compilazione. `node test/squig.js` prova ogni componente, la sicurezza SVG,
gli stili, la persistenza e l’esportazione.

Patrick Hand originale (214772 byte, blob Git
`fb45ccdbd344ab7f9f4ae98792521405e48cda3e`) è incluso in
`App/assets/presentazioni/fonts/`, con licenza OFL e manifest SHA-256.
Le licenze Squig, Phosphor, Patrick Hand e Rough.js sono anche in
`App/assets/licenze/` e nei crediti dell’app.
