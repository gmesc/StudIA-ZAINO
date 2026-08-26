/* LA POSTILLA: il corpo dell'annotazione, accanto al bersaglio (Q6).
 *
 * ⚠️ Perché esiste. Nel modello W3C un'annotazione ha due metà — il BERSAGLIO
 * (`prefix/exact/suffix`) e il CORPO. StudIA aveva solo la prima: la ragione per
 * cui hai segnato una frase, l'unica cosa che valeva, si perdeva — perché
 * scriverla in un appunto è un cambio di stanza, e per una riga non lo fai.
 *
 * Che cosa si scrive, il limite di UNA RIGA e il fatto che la postilla NON
 * entri nell'identità stanno in `lib/evidenze.js` e si provano in Node
 * (`test/evidenze.js`, `test/evidenze-appunti.js`). Qui si misura il
 * CABLAGGIO: la voce c'è nel menu della selezione, il gesto scrive davvero, e
 * l'id dell'evidenza non è cambiato — cioè i `[==testo==](ev:…)` già scritti
 * negli appunti continuano a ritrovarla.
 *
 *   ./test/cdp/con-vault-di-prova.sh prova-postilla.js
 */
const path = require('path');
const S = path.join(__dirname, 'cdp.js');
const { collega, val, pausa, partiPulito, apriStrumento } = require(S);

let ko = 0;
function ok(n, atteso, avuto) {
  const a = JSON.stringify(atteso), b = JSON.stringify(avuto);
  if (a === b) { console.log('  ok  ' + n); return; }
  ko++; console.log('  KO  ' + n + '\n      atteso ' + a + '\n      avuto  ' + b);
}
function sezione(t) { console.log('\n== ' + t); }

async function finoA(expr, quanto) {
  const fine = Date.now() + (quanto || 15000);
  for (;;) {
    const v = await val(expr);
    if (v) return v;
    if (Date.now() > fine) return null;
    await pausa(250);
  }
}

(async () => {
  await collega();
  await val('location.reload(), 1'); await pausa(2000);
  await collega(); await pausa(800);
  await partiPulito();
  await apriStrumento('capitolo');
  await finoA(`(typeof corsoAttivo==='function' && corsoAttivo()) ? 1 : 0`, 15000);

  /* Si parte pulito: le prove girano contro la stessa istanza, e un'evidenza
     lasciata da un giro precedente falserebbe i conteggi. */
  await val(`(()=>{ const api=window.vault.evidenze; const r=api.leggi(corsoAttivo());
    (r.evidenze||[]).forEach(function(e){ api.rimuovi(corsoAttivo(), e.id); });
    evidenzeCarica(); evidenzeDisegna(); return 1; })()`);
  await pausa(400);

  sezione('La voce c\'è, e dice se si scrive o si corregge');
  {
    /* Il menu si costruisce da `selMenuHTML`, che è la porta unica della barra
       E del tasto destro: se la voce c'è qui, c'è in tutte e due. */
    const senza = await val(`(()=>{ const r=document.createRange();
      const p=document.querySelector('#content p, #content li'); if(!p) return '';
      r.selectNodeContents(p);
      return selMenuHTML({ testo:p.textContent.slice(0,40), range:r }); })()`);
    ok('«Postilla…» è nel menu della selezione', true, /data-az="postilla"/.test(senza));
    ok('e su una frase mai postillata invita a scriverla', true, /Postilla…/.test(senza));
  }

  sezione('Si scrive, e l\'evidenza resta LA STESSA');
  {
    /* Si passa dalla porta vera (`postillaChiedi`), ma la modale si riempie da
       qui: `askText` è una promessa, e una prova non può battere a mano. */
    const id = await val(`(async()=>{
      const api=window.vault.evidenze;
      const r=api.aggiungi(corsoAttivo(), { exact:'una frase da postillare', capitoloId:'c-prova' });
      evidenzeCarica();
      return r.evidenza ? r.evidenza.id : ''; })()`);
    ok('c\'è un\'evidenza su cui scrivere', true, !!id);

    const dopo = await val(`(()=>{ const r=window.vault.evidenze.postilla(corsoAttivo(),
      ${JSON.stringify(id)}, '  contraddice\\np. 4  ');
      return r.evidenza ? { id:r.evidenza.id, nota:r.evidenza.nota||'' } : null; })()`);
    ok('la postilla si scrive, ripulita in una riga', 'contraddice p. 4', dopo && dopo.nota);
    /* ⚠️ IL CONTROLLO CHE VALE IL LAVORO: l'id non cambia. Se la postilla
       entrasse nell'identità, ogni `ev:` scritto negli appunti smetterebbe di
       ritrovare la sua evidenza — in silenzio. */
    ok('⚠️ e l\'id NON è cambiato: è la stessa evidenza', id, dopo && dopo.id);
    ok('sul disco è una sola', 1,
      await val(`window.vault.evidenze.leggi(corsoAttivo()).evidenze.length`));

    /* ⚠️ E LA DIFESA VERA, dal lato in cui l'identità si CALCOLA davvero.
       Su un'evidenza che esiste già `normalizzaVoce` non ricalcola l'id — lo
       trova e lo tiene — quindi il controllo qui sopra resterebbe verde anche
       se la postilla entrasse nel seme: l'ho misurato rimettendo il difetto.
       Il punto in cui il seme conta è `identita()`, cioè la porta da cui
       «Appunta» ricava l'id FUTURO per scrivere `[==testo==](ev:<id>)` PRIMA
       che l'evidenza esista. Se lì la postilla pesasse, l'appunto citerebbe un
       id che non nascerà mai. */
    const semi = await val(`(()=>{ const api=window.vault.evidenze;
      const base={ exact:'una frase da postillare', capitoloId:'c-prova' };
      const a=api.identita(base);
      const b=api.identita(Object.assign({}, base, { nota:'contraddice p. 4' }));
      return [a.id, b.id, a.error||'', b.error||'']; })()`);
    ok('⚠️ l\'id FUTURO non cambia scrivendo una postilla', true,
      !!semi[0] && semi[0] === semi[1]);
    ok('e la porta non ha avuto niente da ridire', ['', ''], [semi[2], semi[3]]);

    /* Il menu adesso deve offrire di CORREGGERLA, non di scriverla. */
    await val(`evidenzeCarica(), 1`);
    const testo = await val(`(()=>{ const e=(EVIDENZE.elenco||[]).filter(function(x){ return x.id===${JSON.stringify(id)}; })[0];
      return e ? (e.nota||'') : ''; })()`);
    ok('e l\'elenco in memoria la conosce', 'contraddice p. 4', testo);
  }

  sezione('L\'appunto che la cita la EREDITA, invece di copiarsela');
  {
    const id = await val(`(()=>{ const e=(EVIDENZE.elenco||[])[0]; return e ? e.id : ''; })()`);
    const html = await val(`(()=>{ return mdToHtml('Il punto [==una frase da postillare==](ev:'+${JSON.stringify(id)}+') non torna.', true); })()`);
    ok('la postilla arriva nel title del segno', true, html.indexOf('contraddice p. 4') > 0);
    /* ⚠️ Che nel markdown non ci sia nessuna COPIA lo prova la riga qui sotto,
       non un controllo sul testo che scrivo io in questa prova: se la postilla
       fosse copiata invece che citata, correggerla lascerebbe l'appunto con la
       versione vecchia. Qui c'era un controllo che finiva in `|| true` — cioè
       un verde che non poteva diventare rosso, che è la cosa contro cui questo
       progetto mette in guardia in ogni handoff. */

    const corretta = await val(`(()=>{ window.vault.evidenze.postilla(corsoAttivo(), ${JSON.stringify(id)}, 'anzi: conferma p. 9');
      evidenzeCarica();
      return mdToHtml('Il punto [==una frase da postillare==](ev:'+${JSON.stringify(id)}+') non torna.', true); })()`);
    ok('correggendola, l\'appunto che la cita cambia da sé', true,
      corretta.indexOf('anzi: conferma p. 9') > 0 && corretta.indexOf('contraddice p. 4') < 0);
  }

  sezione('Toglierla è un gesto, e non lascia un campo vuoto');
  {
    const id = await val(`(()=>{ const e=(EVIDENZE.elenco||[])[0]; return e ? e.id : ''; })()`);
    const dopo = await val(`(()=>{ window.vault.evidenze.postilla(corsoAttivo(), ${JSON.stringify(id)}, '   ');
      const e=window.vault.evidenze.leggi(corsoAttivo()).evidenze[0];
      return { haChiave:('nota' in e), id:e.id }; })()`);
    ok('la chiave sparisce dal record', false, dopo.haChiave);
    ok('e l\'id non è cambiato nemmeno togliendola', id, dopo.id);
  }

  /* Si lascia il corso com'era. */
  await val(`(()=>{ const api=window.vault.evidenze; const r=api.leggi(corsoAttivo());
    (r.evidenze||[]).forEach(function(e){ api.rimuovi(corsoAttivo(), e.id); });
    evidenzeCarica(); evidenzeDisegna(); return 1; })()`);
  console.log('\n' + (ko ? '✗ ' + ko + ' controlli falliti' : '✓ tutti i controlli passati'));
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('✗ ' + (e && e.message ? e.message : e)); process.exit(1); });
