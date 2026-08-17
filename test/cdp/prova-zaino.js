/* La sidebar dello ZAINO: fonti · appunti · mappe.
 *
 * ⚠️ Che cosa difende. Le tre sezioni non hanno canali loro: chiedono a
 * `corpus.list`, `notes.leggi` e `mappe.elenco` passando l'id dello ZAINO dove
 * quelli si aspettano un corso. Funziona per due ragioni sole — `corsoAttivo()`
 * risponde con lo zaino, e `corsi.cartella()` risolve le due radici — e nessuno
 * di quei tre canali sa che gli zaini esistono. Se uno dei due perni si
 * scollegasse, qui si vedrebbero tre sezioni vuote invece di un errore: il
 * guasto più silenzioso che questa modalità possa avere.
 *
 * Perciò ogni sezione si prova con un dato VERO messo sul disco, e si controlla
 * anche DOVE è finito: un appunto scritto nello zaino deve stare in
 * `Zaini/<id>/APPUNTI/`, non in `Corsi/`.
 *
 *   ./test/cdp/con-vault-di-prova.sh prova-zaino.js
 */
const path = require('path');
const fs = require('fs');
const S = path.join(__dirname, 'cdp.js');
const { collega, val, clicca, pausa, partiPulito, apriStrumento } = require(S);

let ko = 0;
function ok(n, atteso, avuto) {
  const a = JSON.stringify(atteso), b = JSON.stringify(avuto);
  if (a === b) { console.log('  ok  ' + n); return; }
  ko++; console.log('  KO  ' + n + '\n      atteso ' + a + '\n      avuto  ' + b);
}
function sezione(t) { console.log('\n== ' + t); }

async function finoA(expr, quanto) {
  const fine = Date.now() + (quanto || 12000);
  for (;;) {
    const v = await val(expr);
    if (v) return v;
    if (Date.now() > fine) return null;
    await pausa(200);
  }
}

/** Le sezioni della sidebar, come le vede chi guarda. */
const SIDEBAR = `(()=>{ const h=document.getElementById('zainoNav');
  if(!h) return null;
  const tit=[...h.querySelectorAll('.zs-tit span:first-child')].map(e=>e.textContent);
  function voci(cl){ return [...h.querySelectorAll('button.'+cl)].map(b=>b.textContent.trim()); }
  return { visibile:!h.hidden && h.getBoundingClientRect().height>0,
           sezioni:tit, fonti:voci('zn-fonte'), appunti:voci('zn-appunto'), mappe:voci('zn-mappa'),
           vuoti:[...h.querySelectorAll('.zs-vuoto')].map(e=>e.textContent.trim()) }; })()`;

const ZAINO = 'zaino-di-prova';

(async () => {
  await collega();
  await val('location.reload(), 1'); await pausa(2000);
  await collega(); await pausa(800);
  await partiPulito();

  const vault = await val('window.vault.path');
  const dirZaino = path.join(vault, 'Zaini', ZAINO);

  sezione('Uno zaino nuovo: tre sezioni, tutte vuote, e ognuna dice perché');
  await val(`(async()=>{ await cambiaModo('zaino'); await zainoCrea('Zaino di prova'); return 1; })()`);
  await finoA(`zainoAttivo()==='${ZAINO}' ? 1 : 0`, 10000);
  await pausa(600);
  const vuota = await val(SIDEBAR);
  ok('la sidebar dello zaino è a schermo', true, !!vuota && vuota.visibile);
  ok('e ha le tre sezioni, in quest\'ordine', ['Fonti', 'Appunti', 'Mappe'], vuota.sezioni);
  ok('nessuna voce, per ora', [0, 0, 0],
    [vuota.fonti.length, vuota.appunti.length, vuota.mappe.length]);
  /* ⚠️ Tre sezioni vuote senza una riga di spiegazione sono indistinguibili da
     tre sezioni rotte. Ognuna dice che cosa manca e dove si comincia. */
  ok('e ognuna spiega il proprio vuoto', 3, vuota.vuoti.length);
  console.log('   ' + JSON.stringify(vuota.vuoti));
  /* L'indice dei capitoli non c'entra niente qui, e non deve restare sotto. */
  ok('l\'indice dei capitoli non è a schermo', false,
    await val(`(()=>{ const t=document.getElementById('toc'); return !!t && t.getBoundingClientRect().height>0; })()`));

  sezione('FONTI: un documento messo nello zaino compare, e si apre');
  /* Il PDF si copia sul disco come farebbe l'import (Z5): la sezione deve
     leggere la cartella dello zaino, non un elenco tenuto in memoria. */
  const corpusGlobale = path.join(vault, 'Fonti');
  const unPdf = fs.readdirSync(corpusGlobale).filter((f) => f.toLowerCase().endsWith('.pdf'))[0];
  ok('c\'è un PDF da mettere nello zaino', true, !!unPdf);
  fs.copyFileSync(path.join(corpusGlobale, unPdf), path.join(dirZaino, 'MATERIALI', 'PDF', unPdf));
  await val('zainoNavAggiorna()');
  const conFonte = await finoA(`(()=>{ const n=document.querySelectorAll('#zainoNav .zn-fonte').length;
    return n ? n : 0; })()`, 10000);
  ok('il documento compare fra le fonti', 1, conFonte);
  const etichetta = await val(`document.querySelector('#zainoNav .zn-fonte').textContent.trim()`);
  console.log('   ' + JSON.stringify(etichetta));
  ok('e il nome del file sta nel title, non nell\'etichetta', true,
    (await val(`document.querySelector('#zainoNav .zn-fonte').title`)) === unPdf);

  /* ⚠️ Si aspetta che la sidebar stia ferma prima di premere. Non è
     scaramanzia: `zainoNavAggiorna()` riscrive l'`innerHTML` della colonna, e
     un click calcolato su un bottone appena sostituito arriva a un nodo
     staccato dal documento — il gesto parte, non lo riceve nessuno, e il rosso
     accusa `openPdf` che non è mai stata chiamata. È la trappola «misurare
     mentre il disegno è in volo», qui applicata al click invece che alla
     misura. */
  await pausa(800);
  await clicca('#zainoNav .zn-fonte');
  const aperto = await finoA(`(PDFJS.doc && PDFJS.doc.numPages) || 0`, 20000);
  ok('il click lo apre davvero nel visualizzatore', true, (aperto || 0) > 0);
  ok('ed è quel documento', unPdf, await val('ANTEPRIMA.file'));
  /* ⚠️ Qui si prova il perno di `materiali.js`: `srcUrl` cerca il file nelle
     cartelle dei contenitori, e senza gli zaini fra quelli ripiegherebbe in
     silenzio su `<vault>/Fonti/`, cioè aprirebbe un ALTRO file con lo stesso
     nome — o niente, senza dire perché. */
  /* Dal 13 agosto `srcUrl` vuole il contenitore attivo: senza, un omonimo in
     un ALTRO zaino vince per ordine alfabetico — è successo qui, quando due
     prove hanno copiato lo stesso PDF in due zaini. */
  const url = await val(`window.vault.srcUrl(${JSON.stringify(unPdf)}, corsoAttivo())`);
  ok('e il file aperto è quello DELLO ZAINO', true, decodeURIComponent(url).indexOf('/Zaini/' + ZAINO + '/') > 0);
  ok('la voce si accende come aperta', true,
    await val(`!!document.querySelector('#zainoNav .zn-fonte.attivo')`));

  sezione('APPUNTI: si scrive nello zaino, e finisce nello zaino');
  await apriStrumento('appunti');
  await pausa(600);
  /* Si passa dalla porta vera: il «+» della barra degli appunti, con il suo
     riquadro per il titolo. */
  await clicca('#noteNew');
  await pausa(400);
  await val(`(()=>{ const i=document.getElementById('umInput'); i.value='Prima lettura'; return 1; })()`);
  await clicca('#umOk');
  const conAppunto = await finoA(`document.querySelectorAll('#zainoNav .zn-appunto').length || 0`, 12000);
  ok('l\'appunto compare nella sua sezione', 1, conAppunto);
  ok('col titolo che gli ho dato', 'Prima lettura',
    await val(`document.querySelector('#zainoNav .zn-appunto').textContent.trim()`));
  /* ⚠️ E soprattutto: su quale disco è finito. */
  const suDisco = fs.readdirSync(path.join(dirZaino, 'APPUNTI')).filter((f) => f.endsWith('.md'));
  ok('il file sta in Zaini/<id>/APPUNTI/', 1, suDisco.filter((f) => f !== '_indice.md').length);
  ok('e non è nato niente sotto Corsi/', false,
    fs.existsSync(path.join(vault, 'Corsi', ZAINO)));

  sezione('MAPPE: se ne disegna una, e si elenca');
  await apriStrumento('mappa');
  await pausa(700);
  await val(`(async()=>{ await mappaRegistro('mie'); return 1; })()`);
  await pausa(500);
  await val(`(()=>{ mappaNuova(); return 1; })()`);
  await pausa(400);
  const inp = await val(`(()=>{ const i=document.getElementById('umInput');
    if(!i || !document.querySelector('#uiModal[open]')) return 0;
    i.value='Mappa di prova'; return 1; })()`);
  if (inp) { await clicca('#umOk'); }
  const conMappa = await finoA(`document.querySelectorAll('#zainoNav .zn-mappa').length || 0`, 12000);
  ok('la mappa compare nella sua sezione', 1, conMappa);
  ok('e il documento sta in Zaini/<id>/MAPPE/', true,
    fs.existsSync(path.join(dirZaino, 'MAPPE')) &&
    fs.readdirSync(path.join(dirZaino, 'MAPPE')).some((f) => f.endsWith('.json')));

  sezione('Un .md trascinato diventa un appunto, e dice che cosa non è arrivato');
  /* Un testo scritto altrove è già la forma nativa del vault: non si converte
     niente. Ma tre cose si perderebbero in silenzio, e vanno dette. */
  const primaNote = await val(`(window.vault.notes.leggi('${ZAINO}').notes||[]).length`);
  await val(`(async()=>{
    const testo='---\\ntitle: "Lettura di agosto"\\ntags: [ai, mente]\\n---\\n\\n' +
      'Vedi [[Lezione 3]].\\n\\n![schema](immagini/x.png)\\n';
    const f=new File([testo], 'note obsidian.md', {type:'text/markdown'});
    await testiTrascinati([f]);
    return 1; })()`);
  const dopoNote = await finoA(`(()=>{ const n=(window.vault.notes.leggi('${ZAINO}').notes||[]).length;
    return n>${primaNote} ? n : null; })()`, 15000);
  ok('l\'appunto è nato', primaNote + 1, dopoNote);
  /* ⚠️ Si cerca per TITOLO, non «l'ultima della lista»: l'elenco degli appunti
     è ordinato, non cronologico, e in questo zaino ce n'è già un altro. */
  const nata = await val(`(()=>{ const n=window.vault.notes.leggi('${ZAINO}').notes||[];
    return n.filter(x=>x.title==='Lettura di agosto')[0]||null; })()`);
  /* Il titolo viene dal frontmatter, che è il primo dei tre posti in cui si
     cerca — prima del titolo nel testo e del nome del file. */
  ok('col titolo del frontmatter', 'Lettura di agosto', nata && nata.title);
  ok('e sta dentro lo zaino', true,
    fs.existsSync(path.join(dirZaino, 'APPUNTI', nata.file)));
  const corpo = fs.readFileSync(path.join(dirZaino, 'APPUNTI', nata.file), 'utf-8');
  /* ⚠️ Le chiavi che la lista bianca di `lib/appunti.js` mangerebbe restano nel
     corpo, dentro un blocco che si vede e si legge. */
  ok('le chiavi dell\'altro programma non sono sparite', true, /tags: \[ai, mente\]/.test(corpo));
  ok('e il testo vero c\'è', true, /Lezione 3/.test(corpo));
  ok('l\'appunto si è aperto da sé', true, !!(await val('NOTES.cur ? 1 : 0')));

  sezione('La lente cerca anche negli APPUNTI');
  /* ⚠️ Gli appunti erano l'unica cosa che l'utente scrive e non poteva
     rileggere cercando: la lente guardava le pagine dei documenti e basta.
     Qui si scrive una parola che nel PDF non c'è di sicuro, e si pretende di
     ritrovarla — e di aprire l'appunto giusto. */
  await val(`(()=>{ window.vault.notes.save('${ZAINO}', null, { title:'Zibaldone' },
    'La parola introvabile è zibaldonemio, e sta solo qui.\\n'); notesReload(); return 1; })()`);
  await pausa(400);
  const trovati = await val(`(()=>{ const r=searchRun('zibaldonemio')||[];
    return r.map(function(x){ return { appunto:x.d.appunto||'', gruppo:x.d.lessonTitle }; }); })()`);
  ok('la parola scritta in un appunto si trova', 1, (trovati || []).length);
  ok('il risultato dice quale appunto aprire', true, !!(trovati[0] && /\.md$/.test(trovati[0].appunto)));
  ok('ed è raggruppato sotto «Appunti»', 'Appunti', trovati[0] && trovati[0].gruppo);
  /* Il risultato si apre nel suo strumento, dalla porta di sempre. */
  await val(`(()=>{ const r=searchRun('zibaldonemio')[0]; searchGoto(r, 'zibaldonemio'); return 1; })()`);
  const apertoApp = await finoA(`(NOTES.cur && NOTES.cur.title==='Zibaldone') ? 1 : 0`, 8000);
  ok('e cliccarlo apre quell\'appunto', 1, apertoApp);
  /* ⚠️ L'indice della lente è una COPIA: senza invalidarlo a ogni rilettura,
     un appunto appena scritto non si troverebbe fino al cambio di contenitore.
     Questo controllo è l'unico che se ne accorgerebbe. */
  await val(`(()=>{ const n=window.vault.notes.leggi('${ZAINO}').notes.filter(x=>x.title==='Zibaldone')[0];
    window.vault.notes.save('${ZAINO}', n.file, { title:'Zibaldone' }, 'Adesso dice cavolfiorbis.\\n');
    notesReload(); return 1; })()`);
  await pausa(400);
  ok('e un appunto appena cambiato si trova subito', 1, await val(`(searchRun('cavolfiorbis')||[]).length`));
  ok('mentre la parola di prima non c\'è più', 0, await val(`(searchRun('zibaldonemio')||[]).length`));

  sezione('Le etichette della lente dicono DOVE si cerca');
  ok('nello zaino parlano dello zaino', true,
    /nello zaino/.test(await val(`document.getElementById('searchInput').placeholder`)));
  /* ⚠️ Il suggerimento del bottone nomina un tasto: su un Mac «⌘F», altrove
     «Ctrl+F». Che sia uno dei due lo dice la piattaforma di chi esegue. */
  const sugg = await val(`document.getElementById('searchBtn').title`);
  ok('e il bottone nomina il tasto della piattaforma giusta', true,
    /Cerca nello zaino \((⌘F|Ctrl\+F)\)/.test(sugg));
  ok('nessun «Cmd+» rimasto in giro', 0,
    await val(`[...document.querySelectorAll('[title],[aria-label]')]
      .filter(function(e){ return /Cmd[+-]/.test(e.getAttribute('title')||'') || /Cmd[+-]/.test(e.getAttribute('aria-label')||''); }).length`));

  sezione('Rinominare lo zaino: il titolo, la cartella, e il lavoro che ci sta dentro');
  const primaFile = fs.readdirSync(path.join(dirZaino, 'APPUNTI')).filter((f) => f.endsWith('.md')).length;
  /* Si passa dalla porta vera — il ✎ di Impostazioni › Zaino — e dalla sua
     finestrella, che è la stessa di ogni rinomina dell'app. */
  await val(`(()=>{ zainoRinomina('${ZAINO}'); return 1; })()`);
  await finoA(`document.querySelector('#uiModal[open]') ? 1 : 0`, 8000);
  ok('la finestrella chiede il nome nuovo', 'Nuovo nome della materia',
    await val(`document.getElementById('umTitle').textContent`));
  ok('col nome di adesso già dentro', true,
    !!(await val(`document.getElementById('umInput').value.length>0`)));
  await val(`(()=>{ document.getElementById('umInput').value='Zaino ribattezzato'; return 1; })()`);
  await clicca('#umOk');
  const nuovoId = await finoA(`zainoAttivo()==='zaino-ribattezzato' ? 1 : 0`, 12000);
  ok('lo zaino attivo è quello col nome nuovo', 1, nuovoId);
  /* ⚠️ Il controllo che conta: la cartella si è spostata E il lavoro è dentro.
     Un id che cambia senza portarsi il contenuto sarebbe uno zaino svuotato. */
  const dirNuova = path.join(vault, 'Zaini', 'zaino-ribattezzato');
  ok('la cartella vecchia non c\'è più', false, fs.existsSync(dirZaino));
  ok('e quella nuova ha gli appunti di prima', primaFile,
    fs.readdirSync(path.join(dirNuova, 'APPUNTI')).filter((f) => f.endsWith('.md')).length);
  ok('la tendina in barra dice il nome nuovo', true,
    /Zaino ribattezzato/.test(await val(`document.getElementById('zainoSelect').selectedOptions[0].textContent`)));
  /* E la sidebar non si è svuotata: legge la cartella nuova, non quella di prima. */
  ok('la sidebar continua a elencare gli appunti', true,
    (await val(`document.querySelectorAll('#zainoNav .zn-appunto').length`)) > 0);
  /* Il banco è memoria della macchina, sotto una chiave che contiene l'id: se
     non traslocasse, rinominare sembrerebbe aver resettato lo zaino. */
  ok('e la disposizione del banco ha traslocato', false,
    await val(`localStorage.getItem('studia.banco.c.${ZAINO}') !== null`));

  sezione('La guida illustrata si apre da Impostazioni › Zaino');
  /* ⚠️ Che cosa difende. La guida viaggia DENTRO il pacchetto
     (`App/guida-zaino/`) e si apre da un bottone: se un giorno l'IPC cambia
     nome, o la cartella non finisce nell'app impacchettata, il bottone resta
     muto — nessun errore, nessun rosso, e chi preme conclude che l'app è rotta.
     Qui si controllano i tre anelli separatamente, così un rosso dice QUALE si
     è staccato.
     ⚠️ La finestra NON si apre: aprirla lascerebbe una seconda finestra sopra
     l'app per tutte le prove che seguono — è la trappola dello strascico, già
     pagata con l'editor e con la modalità. Si prova che la porta c'è e che
     dietro la porta c'è il file, non che la maniglia gira. */
  ok('il ponte verso il main esiste', 'function',
    await val(`typeof (window.vault.guida && window.vault.guida.apri)`));
  await val(`document.getElementById('settingsBtn').click()`); await pausa(400);
  await val(`document.querySelector('.set-tab[data-tab="zaino"]').click()`); await pausa(500);
  const btnGuida = await val(`(()=>{ const b=document.getElementById('setGuida');
    return b ? { c:b.textContent.trim(), visibile:b.getBoundingClientRect().height>0 } : null; })()`);
  ok('il bottone è nella scheda Zaino, a schermo', true, !!btnGuida && btnGuida.visibile);
  ok('e dice che cosa apre', true, !!btnGuida && /guida allo ZAINO/i.test(btnGuida.c));
  await val(`document.getElementById('settingsClose')?.click()`); await pausa(300);
  /* Il terzo anello: il file che il main aprirà. Si guarda sul disco, accanto
     al codice che sta girando — nel pacchetto è la stessa cartella dentro
     `app.asar`, ed è ciò che il giro degli installer deve verificare a mano. */
  ok('la guida è sul disco, accanto all\'app', true,
    fs.existsSync(path.join(__dirname, '..', '..', 'App', 'guida-zaino', 'index.html')));

  sezione('Tornando ai corsi la sidebar torna quella dei capitoli');
  await val(`(async()=>{ await cambiaModo('corso'); return 1; })()`);
  await pausa(700);
  ok('le tre sezioni se ne vanno', false,
    await val(`(()=>{ const h=document.getElementById('zainoNav');
      return !!h && !h.hidden && h.getBoundingClientRect().height>0; })()`));
  ok('e l\'indice dei capitoli torna', 'Capitoli',
    await val(`document.getElementById('sidebarTitolo').textContent`));
  ok('e la lente torna a parlare del corso', true,
    /nel corso/.test(await val(`document.getElementById('searchInput').placeholder`)));

  console.log('');
  console.log(ko ? '✗ ' + ko + ' controlli falliti' : '✓ tutti i controlli passati');
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('✗ ' + e.message); process.exit(1); });
