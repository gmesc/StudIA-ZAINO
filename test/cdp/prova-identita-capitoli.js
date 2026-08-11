/* I riferimenti scritti PRIMA continuano a trovare il loro capitolo.
 *
 * L'11 agosto 2026 il lettore ha smesso di inventarsi l'id di un capitolo e ha
 * cominciato a usare quello scritto nel frontmatter. In TD74-DSA i due non
 * coincidono mai — quello sul disco ha il prefisso del corso — quindi lì **tutto
 * ciò che l'utente aveva scritto porta il nome vecchio**; in ai-literacy
 * coincidono, e per quel corso non cambia niente.
 *
 * ⚠️ Per questo la prova non pretende che i due nomi siano diversi: dipende dal
 * corso aperto. Quando sono uguali dichiara che qui non c'è niente da
 * dimostrare, invece di fallire su una differenza che non c'è.
 *
 * Se la catena dei nomi (`assets/lettura/identita.js`) non funzionasse, il
 * danno sarebbe silenzioso e totale: le parole chiave non si accendono più sul
 * testo, gli appunti scivolano sotto «altri capitoli», e nessun errore compare
 * da nessuna parte. Questa prova guarda proprio lì, sul vault vero (una copia).
 *
 * ⚠️ Gira contro il vault della config: puntarlo a una COPIA (trappola ⑧).
 *   ./test/cdp/con-vault-di-prova.sh prova-identita-capitoli
 */
const S = require('path').join(__dirname, 'cdp.js');
const { collega, val, pausa, partiPulito } = require(S);

let ko = 0;
function ok(n, atteso, avuto) {
  const a = JSON.stringify(atteso), b = JSON.stringify(avuto);
  if (a === b) { console.log('  ok  ' + n); return; }
  ko++; console.log('  KO  ' + n + '\n      atteso ' + a + '\n      avuto  ' + b);
}

(async () => {
  await collega(); await partiPulito(); await pausa(400);

  console.log('\n== Il capitolo ha due nomi, e li dichiara');
  const nomi = await val(`(()=>{const c=LESSON.chapters[state.current];
    return { id:c.id, nomi:LetturaIdentita.nomi(c) };})()`);
  console.log('   ' + JSON.stringify(nomi));
  ok('l\'id viene dal frontmatter', true, nomi.nomi.length >= 1);
  ok('e il contesto porta i nomi con sé', true,
    await val(`(curCtx().capitoloAlias||[]).length>0`));

  console.log('\n== Un\'evidenza col NOME VECCHIO si accende lo stesso');
  /* Si scrive un'evidenza a mano nell'elenco in memoria, con l'id posizionale —
     cioè esattamente com'è scritta nel file di chi usa l'app da ieri — e si
     chiede all'app se la considera di questo capitolo. */
  const esito = await val(`(()=>{
    const c=LESSON.chapters[state.current], ctx=curCtx();
    const vecchio=LetturaIdentita.posizionale(LESSON.id, state.current+1);
    const finta={ id:'prova', capitoloId:vecchio, exact:'x', prefix:'', suffix:'' };
    return { vecchio:vecchio, idOggi:c.id, diversi:(vecchio!==c.id),
             riconosciuta:evStessoCapitolo(finta, ctx),
             estranea:evStessoCapitolo({ id:'p2', capitoloId:'lezione-che-non-esiste-c99', exact:'y' }, ctx) };})()`);
  console.log('   nome vecchio «' + esito.vecchio + '» · id di oggi «' + esito.idOggi + '»');
  if (!esito.diversi) {
    console.log('   (in questo corso i due coincidono: qui la catena non ha niente da riparare)');
  }
  ok('l\'evidenza scritta col nome vecchio è di questo capitolo', true, esito.riconosciuta);
  ok('e una di un altro capitolo no', false, esito.estranea);

  console.log('\n== E dove i due nomi divergono davvero');
  /* ⚠️ Se ci si fermasse al corso aperto, in ai-literacy la prova passerebbe
     senza aver provato niente: là i due nomi coincidono. Si cerca una lezione
     in cui divergono — in questo vault è TD74-DSA, i cui id portano il prefisso
     del corso — e si misura lì. */
  const divergente = await val(`(()=>{
    for(const lid in LESSONS){
      const ch=(LESSONS[lid]||{}).chapters||[];
      for(let i=0;i<ch.length;i++){
        const pos=LetturaIdentita.posizionale(lid, i+1);
        if(ch[i] && ch[i].id!==pos) return { lezione:lid, indice:i, id:ch[i].id, vecchio:pos };
      }
    }
    return null; })()`);
  if (!divergente) {
    console.log('   (nessuna lezione con id divergenti in questo vault)');
  } else {
    console.log('   «' + divergente.id + '» ← era «' + divergente.vecchio + '»');
    ok('il capitolo risponde al nome nuovo', divergente.indice,
      await val(`(()=>{const ch=LESSONS[${JSON.stringify(divergente.lezione)}].chapters;
        return LetturaIdentita.indiceDi(${JSON.stringify(divergente.id)}, ch);})()`));
    ok('e anche al nome vecchio, che è quello scritto nei suoi appunti', divergente.indice,
      await val(`(()=>{const ch=LESSONS[${JSON.stringify(divergente.lezione)}].chapters;
        return LetturaIdentita.indiceDi(${JSON.stringify(divergente.vecchio)}, ch);})()`));
    ok('un rimando `cap:` col nome vecchio trova ancora la strada', true,
      await val(`!!trovaCapitolo(${JSON.stringify(divergente.vecchio)})`));
  }

  console.log('\n== Lo stesso per un appunto');
  ok('un appunto col nome vecchio resta «di questo capitolo»', true,
    await val(`(()=>{const ctx=curCtx();
      const vecchio=LetturaIdentita.posizionale(LESSON.id, state.current+1);
      return noteInChapter({ file:'x.md', capitoloId:vecchio, lezioneId:ctx.lezioneId }, ctx);})()`));

  console.log('\n== E un rimando `cap:` trova il capitolo con tutti e due i nomi');
  const rim = await val(`(()=>{const c=LESSON.chapters[state.current];
    const vecchio=LetturaIdentita.posizionale(LESSON.id, state.current+1);
    const a=trovaCapitolo(c.id), b=trovaCapitolo(vecchio);
    return { conNuovo:!!a && a.indice===state.current, conVecchio:!!b && b.indice===state.current,
             inventato:!!trovaCapitolo('mai-esistito-c42') };})()`);
  ok('col nome di oggi', true, rim.conNuovo);
  ok('e col nome di ieri', true, rim.conVecchio);
  ok('mentre un nome inventato non apre niente', false, rim.inventato);

  console.log('\n== Le evidenze vere del vault sono ancora al loro posto');
  /* La misura che conta davvero: quante ne mostra l'app, su tutti i capitoli
     delle lezioni caricate. Se la catena si rompesse, questo numero andrebbe a
     zero senza che nient'altro cambi. */
  const quante = await val(`(async()=>{
    if(!EVIDENZE.elenco.length) return { totali:0, viste:0 };
    let viste=0;
    for(let i=0;i<LESSON.chapters.length;i++){
      go(i); await new Promise(r=>setTimeout(r,120));
      viste += evidenzeDelCapitolo ? evidenzeDelCapitolo().length : 0;
    }
    return { totali:EVIDENZE.elenco.filter(e=>!e.materiale).length, viste:viste };})()`);
  console.log('   evidenze di capitolo nel corso: ' + quante.totali + ' · accese scorrendo questa lezione: ' + quante.viste);
  if (!quante.totali) console.log('   (nessuna evidenza salvata in questo corso: qui non c\'è niente da perdere)');
  else ok('almeno una si accende ancora', true, quante.viste > 0);

  console.log(ko ? '\n✗ ' + ko + ' controlli falliti' : '\n✓ tutti i controlli passati');
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
