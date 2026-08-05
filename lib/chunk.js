'use strict';
/**
 * chunk — spezza i materiali lunghi in porzioni analizzabili.
 *
 * Una trascrizione di 60 minuti o un PDF di 120 pagine non entrano comodamente
 * in una sola chiamata: si dividono in porzioni con un po' di sovrapposizione,
 * conservando SEMPRE il riferimento (secondi o pagina) — senza quello i capitoli
 * generati non potrebbero linkare al punto giusto.
 */

/** Stima grossolana dei token: per l'italiano ~4 caratteri per token. */
function stimaToken(testo) { return Math.ceil(String(testo || '').length / 4); }

/** mm:ss leggibile. */
function mmss(sec) {
  const s = Math.max(0, Math.floor(sec || 0));
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}

/** Segmenti di trascrizione → testo con marcatori temporali ogni tot secondi. */
function testoConMinutaggi(segmenti, passo) {
  const p = passo || 60;
  let prossimo = 0;
  const righe = [];
  for (const s of segmenti || []) {
    const t = Math.floor(Number(s.start) || 0);
    if (t >= prossimo) { righe.push('[' + mmss(t) + ' = ' + t + 's]'); prossimo = t + p; }
    righe.push(String(s.text || '').trim());
  }
  return righe.join(' ').replace(/\s+/g, ' ').trim();
}

/** Divide i segmenti in porzioni di durata massima, con sovrapposizione. */
function porzioniTrascrizione(segmenti, maxSec, sovrappSec) {
  const segs = segmenti || [];
  if (!segs.length) return [];
  const dur = Number(segs[segs.length - 1].end) || 0;
  const passo = maxSec || 1500;                 // 25 minuti
  const over = sovrappSec == null ? 60 : sovrappSec;
  if (dur <= passo) return [{ da: 0, a: Math.round(dur), testo: testoConMinutaggi(segs) }];
  const out = [];
  for (let inizio = 0; inizio < dur; inizio += passo - over) {
    const fine = Math.min(dur, inizio + passo);
    const dentro = segs.filter((s) => Number(s.end) > inizio && Number(s.start) < fine);
    if (dentro.length) out.push({ da: Math.round(inizio), a: Math.round(fine), testo: testoConMinutaggi(dentro) });
    if (fine >= dur) break;
  }
  return out;
}

/** Pagine PDF → testo con marcatori di pagina. */
function testoConPagine(pagine) {
  return (pagine || []).map((p) => '[p. ' + p.page + '] ' + String(p.text || '').trim()).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** Divide le pagine in porzioni sotto una soglia di caratteri. */
function porzioniPdf(pagine, maxCaratteri) {
  const pg = pagine || [];
  if (!pg.length) return [];
  const max = maxCaratteri || 60000;
  const out = [];
  let corrente = [], lung = 0;
  for (const p of pg) {
    const t = String(p.text || '');
    if (lung + t.length > max && corrente.length) {
      out.push({ da: corrente[0].page, a: corrente[corrente.length - 1].page, testo: testoConPagine(corrente) });
      corrente = []; lung = 0;
    }
    corrente.push(p); lung += t.length;
  }
  if (corrente.length) out.push({ da: corrente[0].page, a: corrente[corrente.length - 1].page, testo: testoConPagine(corrente) });
  return out;
}

/**
 * Il contenuto di una pagina web in porzioni. Non ha pagine né minuti: si taglia
 * sui paragrafi, senza spezzarne mai uno a metà.
 */
function porzioniHtml(testo, maxCaratteri) {
  const t = String(testo || '').trim();
  if (!t) return [];
  const max = maxCaratteri || 60000;
  const out = [];
  let corrente = [], lung = 0;
  for (const par of t.split(/\n{2,}/)) {
    if (lung + par.length > max && corrente.length) {
      out.push({ da: out.length + 1, a: out.length + 1, testo: corrente.join('\n\n') });
      corrente = []; lung = 0;
    }
    corrente.push(par); lung += par.length;
  }
  if (corrente.length) out.push({ da: out.length + 1, a: out.length + 1, testo: corrente.join('\n\n') });
  return out;
}

/** Etichetta leggibile di una porzione. */
function etichetta(porzione, tipo) {
  if (tipo === 'pdf') return 'pagine ' + porzione.da + '–' + porzione.a;
  if (tipo === 'html') return 'parte ' + porzione.da;
  return 'da ' + mmss(porzione.da) + ' a ' + mmss(porzione.a);
}

module.exports = { stimaToken, mmss, testoConMinutaggi, porzioniTrascrizione,
  testoConPagine, porzioniPdf, porzioniHtml, etichetta };
