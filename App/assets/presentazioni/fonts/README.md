# Caratteri di PRESENTA

File originali, inclusi nell’app e nell’export HTML offline: nessuna installazione nel sistema e nessuna richiesta a servizi font durante l’uso.

## Provenienza

- Atkinson Hyperlegible: https://github.com/googlefonts/atkinson-hyperlegible, commit `1cb311624b2ddf88e9e37873999d165a8cd28b46`, directory `fonts/webfonts/`. Normale, grassetto, corsivo e grassetto corsivo. Licenza SIL OFL 1.1 in `OFL-Atkinson.txt`.
- TestMe Sans: https://github.com/molotro/TestMe02, commit `4dfa8c20e7e767fb31a576c318215d906e6eaf29`, file `TestMeSans02-Regular.otf` e `TestMeSans02-Bold.otf`. Presentazione degli autori: https://synsemia.org/2013/06/11/font-testme/. Licenza in `OFL-TestMe.txt`. Il nome CSS locale “TestMe Sans” è un alias: i binari non sono modificati. Il corsivo è sintetizzato dal browser, non incluso fra i file originali.

## Impronte SHA-256

- `AtkinsonHyperlegible-Bold.woff2`: `da8fce41a04f8498fbf79076f92d304b12e70c76f71b143c5dcfb6536c93c075`
- `AtkinsonHyperlegible-BoldItalic.woff2`: `f27e95143bc12e8f40f955cf86c74e6afef4441abb89d271282ea0f9e93c1fd5`
- `AtkinsonHyperlegible-Italic.woff2`: `60bedf0954ffa7e7800eddd529b06c7558d09283667c74fef60170d8d241089e`
- `AtkinsonHyperlegible-Regular.woff2`: `2df4ba17804bc7a36f123127966075d8427bff2df58d0d76820c1130bb1a4150`
- `TestMeSans02-Bold.otf`: `d5cb8d0f9d984e570f2d4f566138118555ca8ba1063ed7169609104170b3e8d5`
- `TestMeSans02-Regular.otf`: `6c6f867e118497821360e7b9abd4d086545494e845f3bc910489200f47f792a4`

## Varianti aggiunte il 1 novembre 2026

- Atkinson Hyperlegible Next: https://github.com/googlefonts/atkinson-hyperlegible-next, commit `7925f50f649b3813257faf2f4c0b381011f434f1`. File `fonts/webfonts/AtkinsonHyperlegibleNext[wght].woff2` e `AtkinsonHyperlegibleNext-Italic[wght].woff2`, rinominati localmente con suffisso `-Variable` senza modificare i binari. Pesi 200 ExtraLight, 300 Light, 400 Regular, 500 Medium, 600 SemiBold, 700 Bold, 800 ExtraBold, tutti con corsivo originale. Licenza `OFL-AtkinsonNext.txt`. La prima famiglia Atkinson resta separata per mantenere l’aspetto dei documenti esistenti.
- TestMe Sans Alternate: stesso commit TestMe02 indicato sopra, `TestMeAlt02-Regular.otf` e `TestMeAlt02-Bold.otf`. Stessa licenza `OFL-TestMe.txt`. Il repository originale non distribuisce Light né corsivi disegnati per TestMe; il corsivo continua a essere sintetizzato. La variante Serif è descritta dagli autori come incompleta negli accenti e non è proposta nell’editor per testi scolastici in italiano.

Tutte le impronte, comprese queste varianti e le licenze, sono verificate all’apertura/esportazione tramite `manifest.json`.
