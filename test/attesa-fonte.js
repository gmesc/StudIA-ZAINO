/* Aspettare una condizione: i quattro modi di sbagliare — col tempo FINTO.
 *
 * ⚠️ Perché col tempo finto. Un'attesa provata con l'orologio vero è una prova
 * che a volte passa: dipende da quanto è carico il computer, cioè esattamente
 * dalla variabile che questo lavoro esiste per togliere di mezzo. Qui l'orologio
 * e il timer si fanno passare, e la prova è deterministica in quaranta
 * millisecondi.
 *
 * ⚠️ Che cosa difende, e sono i quattro modi in cui un'attesa sbaglia senza
 * che si veda: non finisce mai · risponde due volte · lascia acceso un timer ·
 * aspetta un giro anche quando era già pronto.
 *
 *   node test/attesa-fonte.js
 */
const A = require('../App/assets/fonti/attesa.js');

let ko = 0;
function ok(nome, atteso, avuto) {
  const a = JSON.stringify(atteso), b = JSON.stringify(avuto);
  if (a === b) { console.log('  ok  ' + nome); return; }
  ko++; console.log('  KO  ' + nome + '\n      atteso ' + a + '\n      avuto  ' + b);
}
function sezione(t) { console.log('\n== ' + t); }

/**
 * Un orologio finto e il suo timer. Il tempo non passa da sé: lo si fa passare.
 * `avanza(ms)` sposta le lancette ed esegue tutto quello che era in coda per
 * quel momento — così l'attesa vive un tempo che noi decidiamo, e la prova non
 * dipende mai da quanto è carico il computer.
 */
function orologio() {
  let t = 0;
  let coda = [];
  let accesi = 0;
  return {
    ora: () => t,
    dopo: (fn, ms) => { accesi++; coda.push({ q: t + ms, fn }); },
    /* Quanti battiti sono stati chiesti e non ancora eseguiti: è il modo di
       accorgersi di un timer lasciato acceso. */
    inCoda: () => coda.length,
    chiesti: () => accesi,
    avanza(ms) {
      const fine = t + ms;
      /* Si esegue un battito alla volta, in ordine: un battito può chiederne un
         altro, ed è proprio quello che fa l'attesa. */
      for (let giri = 0; giri < 10000; giri++) {
        const prossimo = coda.filter((x) => x.q <= fine).sort((a, b) => a.q - b.q)[0];
        if (!prossimo) break;
        coda = coda.filter((x) => x !== prossimo);
        t = prossimo.q;
        prossimo.fn();
      }
      t = fine;
    }
  };
}

(async () => {
  sezione('⭐ Chi è già pronto non aspetta nemmeno un battito');
  {
    /* ⚠️ Il difetto OPPOSTO a quello che si sta togliendo, e altrettanto
       invisibile: su una macchina veloce la condizione è vera al primo sguardo,
       e far pagare comunque un giro vorrebbe dire sostituire un ritardo fisso
       con un altro ritardo fisso. */
    const c = orologio();
    const r = await A.attendi(() => true, { ora: c.ora, dopo: c.dopo });
    ok('risponde pronto', true, r.pronto);
    ok('al primo sguardo', 1, r.sguardi);
    ok('senza che passi tempo', 0, r.ms);
    ok('e senza chiedere nemmeno un battito', 0, c.chiesti());
  }

  sezione('Chi diventa pronto strada facendo');
  {
    const c = orologio();
    let pronto = false;
    const p = A.attendi(() => pronto, { ora: c.ora, dopo: c.dopo, passo: 100, tetto: 5000 });
    c.avanza(300);
    pronto = true;                 // arriva mentre si aspetta
    c.avanza(200);
    const r = await p;
    ok('risponde pronto', true, r.pronto);
    ok('e dice quanto ha aspettato', true, r.ms >= 300 && r.ms <= 500);
    ok('guardando più di una volta', true, r.sguardi > 1);
    /* ⚠️ Nessun battito resta in coda: un timer lasciato acceso continuerebbe a
       girare per sempre, e con lui tutto quello che si porta dietro. */
    ok('e non lascia acceso niente', 0, c.inCoda());
  }

  sezione('⭐ Chi non arriva in tempo riceve una RISPOSTA, non un\'eccezione');
  {
    /* ⚠️ «Non è arrivato in tempo» è una risposta, non un guasto: chi chiama
       deve poterla leggere e dirlo a chi guarda. Un rifiuto costringerebbe ogni
       chiamante a un `catch`, e il primo che se lo dimentica lascia l'app in
       uno stato che nessuno sa spiegare. */
    const c = orologio();
    const p = A.attendi(() => false, { ora: c.ora, dopo: c.dopo, passo: 100, tetto: 1000 });
    c.avanza(3000);
    const r = await p;
    ok('la promessa si risolve, non si rifiuta', 'object', typeof r);
    ok('e dice che non è pronto', false, r.pronto);
    ok('avendo rinunciato al tetto, non dopo', true, r.ms >= 1000 && r.ms <= 1100);
    ok('e senza lasciare battiti accesi', 0, c.inCoda());
  }

  sezione('⭐ Una risposta sola, anche se la cosa arriva un istante dopo');
  {
    /* ⚠️ IL CONTROLLO CHE VALE IL FILE. La condizione che diventa vera subito
       dopo la rinuncia farebbe eseguire il seguito DUE volte: su una ricerca
       vuol dire due salti di pagina, e il secondo inspiegabile. */
    const c = orologio();
    let volte = 0;
    let pronto = false;
    const p = A.attendi(() => pronto, { ora: c.ora, dopo: c.dopo, passo: 100, tetto: 500 });
    p.then(() => { volte++; });
    c.avanza(900);                 // il tetto scade: rinuncia
    pronto = true;                 // …e la cosa arriva un istante dopo
    c.avanza(2000);
    await p;
    ok('il seguito è stato eseguito una volta sola', 1, volte);
    ok('e la risposta resta «non pronto»', false, (await p).pronto);
    ok('nessun battito è rimasto acceso', 0, c.inCoda());
  }

  sezione('Una prova che solleva vuol dire «non ancora», non «mai»');
  {
    /* ⚠️ La condizione interroga il DOM, e il DOM in mezzo a un ridisegno
       risponde in modi che non si prevedono. Un'eccezione non deve rompere
       l'attesa: al giro dopo la cosa può esserci. */
    const c = orologio();
    let giri = 0;
    const p = A.attendi(() => {
      giri++;
      if (giri < 3) throw new Error('il DOM sta ridisegnando');
      return true;
    }, { ora: c.ora, dopo: c.dopo, passo: 100, tetto: 5000 });
    c.avanza(500);
    const r = await p;
    ok('l\'attesa sopravvive alle eccezioni', true, r.pronto);
    ok('e ci arriva al giro buono', 3, r.sguardi);
  }

  sezione('I casi storti non inventano niente');
  {
    const c = orologio();
    /* Un tetto a zero vuol dire «guarda una volta e basta»: è un caso lecito, e
       deve comportarsi come tale invece di aspettare per sempre. */
    const r = await A.attendi(() => false, { ora: c.ora, dopo: c.dopo, tetto: 0 });
    ok('tetto zero: uno sguardo e via', [false, 1], [r.pronto, r.sguardi]);
    ok('e nessun battito', 0, c.inCoda());
  }
  {
    const c = orologio();
    /* Un passo storto ripiega su quello di fabbrica invece di girare a vuoto:
       un `setTimeout(fn, NaN)` in un browser vale zero, cioè un battito
       ininterrotto che si mangia il processore. */
    const p = A.attendi(() => false, { ora: c.ora, dopo: c.dopo, passo: 0, tetto: 300 });
    c.avanza(1000);
    const r = await p;
    ok('un passo a zero non fa girare a vuoto', true, r.sguardi < 20);
    ok('e si rinuncia comunque al tetto', false, r.pronto);
  }
  {
    /* Senza orologio finto usa quello vero: qui si guarda solo che non esploda
       e che risponda subito, perché la condizione è già vera. */
    const r = await A.attendi(() => true);
    ok('senza orologio passato funziona lo stesso', true, r.pronto);
  }
  {
    const c = orologio();
    const r = await A.attendi(null, { ora: c.ora, dopo: c.dopo, tetto: 0 });
    ok('una prova che non è una funzione non è mai pronta', false, r.pronto);
  }

  sezione('I numeri di fabbrica sono quelli misurati');
  /* ⚠️ Venti secondi non sono generosità: il layer di testo di un PDF da 266
     pagine arriva dopo 12,4 s su un Mac Intel (guida §6). Un tetto più corto
     trasformerebbe una macchina lenta in un'app rotta. */
  ok('il tetto copre i 12,4 secondi misurati sull\'Intel', true, A.TETTO > 12400);
  ok('e il passo non si fa sentire', true, A.PASSO > 0 && A.PASSO <= 100);

  console.log(ko ? `\n✗ ${ko} controlli falliti` : `\n✓ tutti i controlli passati`);
  process.exit(ko ? 1 : 0);
})();
