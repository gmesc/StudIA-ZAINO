'use strict';
/**
 * mdser — serializzatore deterministico oggetto → Markdown del vault StudIA.
 *
 * VINCOLO: l'output deve stare nel sottoinsieme che il parser del renderer legge
 * (App/StudIA.html: parseFrontmatter / parseFenced / mdChapter). In particolare:
 *  - il file inizia esattamente con "---\n", terminatori LF, nessun BOM;
 *  - chiavi frontmatter solo [A-Za-z_]+;
 *  - liste di oggetti solo come flow map su UNA riga: "  - { k: v, k2: v2 }";
 *  - liste di stringhe solo inline: "k: [a, b]";
 *  - un solo blocco ```quiz e un solo ```glossario per file (parseFenced legge il primo);
 *  - valori dei fenced mono-riga;
 *  - quoting: doppi apici con \" (il parser gestisce \" per il doppio apice e ''
 *    per il singolo — usiamo sempre il doppio, così l'apostrofo italiano è sicuro).
 */

const LF = '\n';

/** Stringa YAML sicura per il parser ristretto: sempre doppi apici, newline→spazio. */
function yq(v) {
  const s = String(v == null ? '' : v).replace(/\r/g, '').replace(/\n+/g, ' ').trim();
  return '"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
}

/** Valore scalare: numeri e booleani nudi, il resto quotato. */
function yv(v) {
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  return yq(v);
}

/** Lista inline di stringhe: [a, b] — quotate se contengono caratteri ambigui. */
function yList(arr) {
  const items = (arr || []).map((x) => {
    const s = String(x == null ? '' : x).replace(/\n+/g, ' ').trim();
    return /^[A-Za-z0-9À-ɏ_-]+$/.test(s) ? s : yq(s);
  });
  return '[' + items.join(', ') + ']';
}

/** Flow map su una riga: { k: v, k2: v2 } */
function yFlow(obj) {
  const parts = [];
  for (const k of Object.keys(obj)) {
    if (obj[k] === undefined || obj[k] === null) continue;
    parts.push(k + ': ' + yv(obj[k]));
  }
  return '{ ' + parts.join(', ') + ' }';
}

/** Traslittera e normalizza in slug ASCII [a-z0-9-] (regex wikilink del reader). */
function slugify(s, max) {
  const t = String(s == null ? '' : s)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  const lim = max || 60;
  if (t.length <= lim) return t || 'senza-titolo';
  return t.slice(0, lim).replace(/-+$/, '') || 'senza-titolo';
}

/** Prefisso numerico a 2 cifre. */
function nn(n) { return String(n).padStart(2, '0'); }

/** Nome file capitolo: NN-slug.md */
function chapterFilename(order, title) { return nn(order) + '-' + slugify(title) + '.md'; }

/** Nome cartella corso: NN-slug */
function courseFolder(order, title) { return nn(order) + '-' + slugify(title, 40); }

// ---------------------------------------------------------------- frontmatter

/**
 * Emette il blocco frontmatter. `entries` è un array di [chiave, valore] in
 * ordine deterministico; il valore può essere: scalare, {flow:obj},
 * {list:array-di-stringhe}, {rows:array-di-obj} (lista di flow map).
 */
function frontmatter(entries) {
  const out = ['---'];
  for (const [k, v] of entries) {
    if (v === undefined || v === null) continue;
    if (v && typeof v === 'object' && Array.isArray(v.rows)) {
      if (!v.rows.length) continue;
      out.push(k + ':');
      for (const r of v.rows) out.push('  - ' + yFlow(r));
    } else if (v && typeof v === 'object' && Array.isArray(v.list)) {
      if (!v.list.length) continue;
      out.push(k + ': ' + yList(v.list));
    } else if (v && typeof v === 'object' && v.flow) {
      out.push(k + ': ' + yFlow(v.flow));
    } else {
      out.push(k + ': ' + yv(v));
    }
  }
  out.push('---');
  return out.join(LF);
}

// ------------------------------------------------------------------ capitolo

/** Normalizza il corpo markdown: LF, niente tab, niente code fence residui. */
function bodyText(md) {
  return String(md == null ? '' : md)
    .replace(/\r\n?/g, LF)
    .replace(/\t/g, '  ')
    .replace(/```/g, '')          // i fence sono riservati a quiz/glossario
    .replace(/\n{3,}/g, LF + LF)
    .trim();
}

/**
 * Serializza un capitolo.
 * ch: { id, title, order, fonte:{tipo,materiale}, videoRefs[], sources[], tags[],
 *       status, inBreve, contenuto, puntiChiave[], quiz[{q,a,perche}],
 *       glossario[{t,d}], footnotes[] }
 */
function chapter(ch) {
  const fm = [
    ['id', ch.id],
    ['title', ch.title],
    ['order', Number(ch.order) || 1],
    ['fonte', ch.fonte ? { flow: { tipo: ch.fonte.tipo, materiale: String(ch.fonte.materiale) } } : null],
    ['videoRefs', { rows: (ch.videoRefs || []).map((v) => ({ video: String(v.video), t: Number(v.t) || 0, label: v.label })) }],
    ['sources', { rows: (ch.sources || []).map((s) => ({ pdf: String(s.pdf), page: Number(s.page) || 1, label: s.label })) }],
    ['tags', { list: ch.tags || [] }],
    ['status', ch.status || 'draft']
  ];

  const parts = [frontmatter(fm), ''];

  parts.push('## In breve');
  parts.push(bodyText(ch.inBreve));
  parts.push('');
  parts.push('## Contenuto');
  parts.push('');
  parts.push(bodyText(ch.contenuto));
  parts.push('');
  parts.push('## Punti chiave');
  for (const k of ch.puntiChiave || []) parts.push('- ' + bodyText(k).replace(/\n+/g, ' '));

  const quiz = ch.quiz || [];
  if (quiz.length) {
    parts.push('');
    parts.push('```quiz');
    for (const q of quiz) {
      parts.push('- q: ' + yq(q.q));
      parts.push('  a: ' + (q.a === true ? 'true' : 'false'));
      parts.push('  perche: ' + yq(q.perche));
    }
    parts.push('```');
  }

  const gl = ch.glossario || [];
  if (gl.length) {
    parts.push('');
    parts.push('```glossario');
    for (const g of gl) {
      parts.push('- t: ' + yq(g.t));
      parts.push('  d: ' + yq(g.d));
    }
    parts.push('```');
  }

  const fns = ch.footnotes || [];
  if (fns.length) {
    parts.push('');
    fns.forEach((t, i) => parts.push('[^' + (i + 1) + ']: ' + String(t).replace(/\n+/g, ' ').trim()));
  }

  return parts.join(LF).replace(/\n{3,}/g, LF + LF).trim() + LF;
}

// --------------------------------------------------------------- corso/progetto

/** _corso.md — co: { id, title, tipo, area, materiali[], status, ordineCapitoli[], nota } */
function corso(co) {
  const fm = [
    ['id', co.id],
    ['title', co.title],
    ['tipo', co.tipo || 'course'],
    ['area', co.area || ''],
    ['materiali', { list: (co.materiali || []).map(String) }],
    ['status', co.status || 'draft'],
    ['ordine_capitoli', { list: co.ordineCapitoli || [] }]
  ];
  const body = ['', '# ' + String(co.title || co.id), ''];
  if (co.nota) body.push(bodyText(co.nota), '');
  return frontmatter(fm) + LF + body.join(LF).replace(/\n{3,}/g, LF + LF) + LF;
}

/**
 * Il ruolo dichiarato delle fonti, come righe di frontmatter. Si scrivono solo
 * le eccezioni: un materiale senza riga è materiale ufficiale del corso.
 * Accetta sia { "05": "appunti" } sia [{ materiale, ruolo }].
 */
function righeFonti(fonti) {
  const lista = Array.isArray(fonti)
    ? fonti
    : Object.keys(fonti || {}).sort().map((k) => ({ materiale: k, ruolo: (fonti || {})[k] }));
  return lista
    .filter((f) => f && f.materiale && f.ruolo)
    .map((f) => ({ materiale: String(f.materiale), ruolo: String(f.ruolo) }));
}

/** Il blocco «fonti:» pronto per l'upsert nel frontmatter. */
function bloccoFonti(fonti) {
  const righe = righeFonti(fonti);
  return righe.length
    ? 'fonti:' + LF + righe.map((r) => '  - ' + yFlow(r)).join(LF)
    : 'fonti: []';
}

/**
 * _progetto.md — pr: { id, title, tipo, nCorsi, nMateriali, ordineCorsi[],
 *   fonti (mappa numero→ruolo o lista), brief:{obiettivo,scadenza,priorita,granularita},
 *   descrizione, indicazioni }
 */
function progetto(pr) {
  const b = pr.brief || {};
  const fm = [
    ['id', pr.id],
    ['title', pr.title],
    ['tipo', 'progetto'],
    ['n_corsi', Number(pr.nCorsi) || 0],
    ['n_materiali', Number(pr.nMateriali) || 0],
    ['obiettivo', b.obiettivo || ''],
    ['scadenza', b.scadenza || ''],
    ['fonti', { rows: righeFonti(pr.fonti) }],
    ['priorita', b.priorita || ''],
    ['granularita', b.granularita || ''],
    ['ordine_corsi', { list: pr.ordineCorsi || [] }]
  ];
  const body = ['', '# ' + String(pr.title || pr.id), ''];
  if (pr.descrizione) body.push(bodyText(pr.descrizione), '');
  body.push('## Indicazioni per questo materiale', '');
  body.push(bodyText(pr.indicazioni || '—'), '');
  return frontmatter(fm) + LF + body.join(LF).replace(/\n{3,}/g, LF + LF) + LF;
}

/**
 * _profilo.md — p: { bisogni[], bisogniAltro, stileProgetto, stileCorsi, stileCapitoli,
 *   granularita, capitoliBrevi, quiz, glossario, esempiConcreti, approfondimenti,
 *   comeImparo, cosaAffatica }
 */
function profilo(p, isoDate) {
  const fm = [
    ['schema', 1],
    ['tipo', 'profilo'],
    ['aggiornato', isoDate || ''],
    ['bisogni', { list: p.bisogni || [] }],
    ['bisogni_altro', p.bisogniAltro || ''],
    // struttura di ciò che si costruisce (scelta dall'utente nel pannello Impostazioni › Utente)
    ['stile_progetto', p.stileProgetto || 'tematico'],
    ['stile_corsi', p.stileCorsi || 'cornici'],
    ['stile_capitoli', p.stileCapitoli || 'discorsivo'],
    ['granularita', p.granularita || 'atomico'],
    ['capitoli_brevi', p.capitoliBrevi !== false],
    ['quiz', p.quiz || 'frequenti'],
    ['glossario', p.glossario || 'esteso'],
    ['esempi_concreti', p.esempiConcreti !== false],
    ['approfondimenti', p.approfondimenti || 'ricchi']
  ];
  const body = [
    '',
    '# Il mio profilo di apprendimento',
    '',
    '## Come imparo meglio',
    '',
    bodyText(p.comeImparo || '—'),
    '',
    '## Cosa mi affatica',
    '',
    bodyText(p.cosaAffatica || '—'),
    ''
  ];
  return frontmatter(fm) + LF + body.join(LF).replace(/\n{3,}/g, LF + LF) + LF;
}

// ------------------------------------------------------ upsert in-place (raw)

/**
 * Sostituisce/inserisce una chiave nel frontmatter GREZZO senza ri-serializzare
 * il resto (il parser ristretto perderebbe liste a blocchi, commenti, ecc.).
 * `line` è la riga completa già formattata, es. 'obiettivo: "esame"'.
 */
function upsertFmLine(raw, key, line) {
  const m = /^---\n([\s\S]*?)\n---/.exec(raw);
  if (!m) return raw;
  const head = m[1].split('\n');
  const keyRe = new RegExp('^' + key + ':');
  let i = head.findIndex((l) => keyRe.test(l));
  if (i >= 0) {
    // rimuove anche le eventuali righe-figlie indentate della chiave
    let j = i + 1;
    while (j < head.length && /^\s+\S/.test(head[j])) j++;
    head.splice(i, j - i, line);
  } else {
    head.push(line);
  }
  return raw.slice(0, m.index) + '---\n' + head.join('\n') + '\n---' + raw.slice(m.index + m[0].length);
}

/** Sostituisce (o aggiunge in coda) una sezione "## Titolo" nel corpo. */
function upsertSection(raw, heading, text) {
  const body = String(text == null ? '' : text);
  const re = new RegExp('(^|\\n)## ' + heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\n([\\s\\S]*?)(?=\\n## |$)');
  const block = '## ' + heading + LF + LF + bodyText(body) + LF;
  if (re.test(raw)) return raw.replace(re, (m, pre) => (pre || '') + block);
  return raw.replace(/\s*$/, LF + LF) + block;
}

module.exports = {
  yq, yv, yList, yFlow, frontmatter, bodyText,
  slugify, nn, chapterFilename, courseFolder,
  chapter, corso, progetto, profilo,
  righeFonti, bloccoFonti,
  upsertFmLine, upsertSection
};
