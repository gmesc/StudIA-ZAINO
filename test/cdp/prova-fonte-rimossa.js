/* Togliere una fonte dallo zaino, e ritrovarla.
 *
 * La promessa che questa prova difende non è «il file sparisce» — quella la
 * mantiene il sistema operativo. È l'altra: **il lavoro appeso a quel documento
 * non si stacca**. Evidenze, appunti, mappe e ritagli lo nominano col NOME
 * (`03 dispensa.pdf`), che è la forma con cui compare nei rimandi `pdf:03#p=7`;
 * se lo stesso documento tornasse col numero successivo libero, per l'app
 * sarebbe un altro, e tutto resterebbe orfano avendo davanti il file giusto.
 *
 * Qui si misura il giro intero dall'app: si toglie, si guarda che cosa resta
 * scritto nello zaino, si reimporta lo stesso contenuto, e si controlla che
 * abbia ripreso nome e numero di prima.
 *
 * ⚠️ Gira contro il vault della config: puntarlo a una COPIA (trappola ⑧).
 *   ./test/cdp/con-vault-di-prova.sh prova-fonte-rimossa
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const S = require('path').join(__dirname, 'cdp.js');
const { collega, val, pausa, partiPulito } = require(S);

let ko = 0;
function ok(n, atteso, avuto) {
  const a = JSON.stringify(atteso), b = JSON.stringify(avuto);
  if (a === b) { console.log('  ok  ' + n); return; }
  ko++; console.log('  KO  ' + n + '\n      atteso ' + a + '\n      avuto  ' + b);
}

(async () => {
  await collega(); await partiPulito(); await pausa(300);

  /* Uno zaino nuovo, tutto per questa prova: togliere documenti da uno zaino
     vero — anche nella copia — vorrebbe dire misurare su un terreno che
     un'altra prova può aver cambiato. */
  const zaino = await val(`(async()=>{
    const r = await window.vault.zaino.create('Prova rimozione fonti');
    return (r && (r.id || (r.zaino && r.zaino.id))) || '';
  })()`);
  ok('lo zaino di prova esiste', true, !!zaino);

  /* Un PDF minimo ma vero: deve superare il filtro sull'estensione e avere un
     contenuto stabile, perché è il CONTENUTO a farsi riconoscere al ritorno. */
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'studia-fonte-'));
  const sorgente = path.join(dir, 'dispensa di prova.pdf');
  fs.writeFileSync(sorgente, '%PDF-1.4\n% una dispensa finta ma con un contenuto suo\n%%EOF\n');

  const imp = async (p) => val(`window.vault.fonti.importa(${JSON.stringify(zaino)}, [${JSON.stringify(p)}])`);
  const elenco = async () => val(`(async()=>((await window.vault.corpus.list(${JSON.stringify(zaino)}))||[])
    .filter(m=>m.tipo==='pdf').map(m=>m.name))()`);

  console.log('\n== Entra, e prende il suo numero');
  await imp(sorgente);
  const dentro = await elenco();
  ok('il documento è nello zaino', ['01 dispensa di prova.pdf'], dentro);

  console.log('\n== Chi ci si appoggia si sa PRIMA di togliere');
  const usi = await val(`window.vault.fonti.usi(${JSON.stringify(zaino)}, '01 dispensa di prova.pdf')`);
  ok('nessun lavoro appeso, e nessun file illeggibile', [0, [], ''],
    [usi.quanti, usi.illeggibili, usi.error]);

  console.log('\n== Si toglie, e resta la traccia');
  const tolto = await val(`window.vault.fonti.elimina(${JSON.stringify(zaino)}, '01 dispensa di prova.pdf')`);
  ok('togliere non dà errore', '', tolto.error);
  ok('lo zaino non lo elenca più', [], await elenco());
  const tracce = await val(`window.vault.fonti.rimossi(${JSON.stringify(zaino)})`);
  ok('ne resta una traccia sola', 1, tracce.length);
  ok('con il nome che aveva', '01 dispensa di prova.pdf', tracce[0] && tracce[0].nome);
  ok('e con l\'impronta del contenuto', 40, ((tracce[0] || {}).impronta || '').length);

  console.log('\n== Il numero resta prenotato per il suo ritorno');
  /* ⚠️ È il controllo che ha smascherato il difetto quando la prova non
     esisteva: senza prenotazione, il documento importato dopo prendeva il
     numero liberato, e al ritorno nello zaino c'erano due «01» — un rimando
     `pdf:01` non avrebbe più saputo chi aprire. */
  const altro = path.join(dir, 'altro documento.pdf');
  fs.writeFileSync(altro, '%PDF-1.4\n% tutt\'altra cosa\n%%EOF\n');
  await imp(altro);
  ok('il nuovo prende il numero successivo, non quello libero',
    ['02 altro documento.pdf'], await elenco());

  console.log('\n== Lo stesso contenuto che torna si riaggancia');
  const ritorno = await imp(sorgente);
  const c = (ritorno.copiati || [])[0] || {};
  ok('riprende il nome, cioè il numero, di prima', '01 dispensa di prova.pdf', c.nome);
  ok('e l\'app lo sa, invece di farlo di nascosto', true, c.tornata);
  ok('la traccia si consuma solo a ritorno avvenuto', [],
    await val(`window.vault.fonti.rimossi(${JSON.stringify(zaino)})`));
  ok('nello zaino ci sono due documenti, uno per numero',
    ['01 dispensa di prova.pdf', '02 altro documento.pdf'], (await elenco()).sort());

  console.log('\n== Un file diverso con lo stesso nome NON eredita niente');
  await val(`window.vault.fonti.elimina(${JSON.stringify(zaino)}, '01 dispensa di prova.pdf')`);
  fs.writeFileSync(sorgente, '%PDF-1.4\n% stesso nome, un altro documento\n%%EOF\n');
  const finto = (await imp(sorgente)).copiati[0] || {};
  ok('non si spaccia per il ritorno', false, !!finto.tornata);
  ok('e prende un numero nuovo', '03 dispensa di prova.pdf', finto.nome);

  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {}
  console.log(ko ? '\n✗ ' + ko + ' controlli falliti' : '\n✓ tutti i controlli passati');
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
