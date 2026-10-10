/* CO Explorer — core: data model, filters, routing, shared components */
'use strict';

const D = window.CO_DATA;
const DICT = D.dict;
const META = D.meta;
const RAW = D.rows;
const N = RAW.job.length;
const MS2000 = Date.UTC(2000, 0, 1);

/* ======================================================= columns */
const C = {};
for (const k of ['job', 'b', 'house', 'st', 'block', 'lot', 'zip', 'sub', 'iss', 'cb', 'app', 'units', 'bbl']) C[k] = Int32Array.from(RAW[k]);
C.jtr = Uint8Array.from(RAW.jtr);
C.boro = Uint8Array.from(RAW.boro);
C.ft = Int8Array.from(RAW.ft);
C.co = RAW.co;

const BLD = {
  bin: Int32Array.from(D.bld.bin),
  lat: D.bld.lat.map(v => (v == null ? null : v / 1e5)),
  lng: D.bld.lng.map(v => (v == null ? null : v / 1e5)),
  nta: Int32Array.from(D.bld.nta),
  cd: Int32Array.from(D.bld.cd),
  tract: Int32Array.from(D.bld.tract),
};
const NB = BLD.bin.length;

const UB_KEYS = ['0', '1-2', '3-10', '11-50', '51-200', '200p'];
const UB_LABELS = ['0', '1–2', '3–10', '11–50', '51–200', '200+'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const PROC_BINS = [[0, 0, 'Same day'], [1, 7, '1–7 d'], [8, 30, '8–30 d'], [31, 90, '31–90 d'], [91, 180, '91–180 d'], [181, 365, '181–365 d'], [366, 730, '1–2 yr'], [731, 1e9, '2 yr +']];
const NOPROC = -999999;

// derived per-row
C.jtg = new Uint8Array(N); C.stn = new Int32Array(N); C.nta = new Int32Array(N); C.cd = new Int32Array(N);
C.ym = new Int32Array(N); C.year = new Int16Array(N); C.wd = new Int8Array(N); C.hr = new Int8Array(N);
C.day = new Int32Array(N); C.proc = new Int32Array(N); C.ub = new Int8Array(N);
let YM_MIN = 1e9, YM_MAX = -1;
for (let i = 0; i < N; i++) {
  C.jtg[i] = DICT.jtrGroup[C.jtr[i]];
  C.stn[i] = DICT.stNormOf[C.st[i]];
  C.nta[i] = BLD.nta[C.b[i]];
  C.cd[i] = BLD.cd[C.b[i]];
  const m = C.iss[i];
  if (m >= 0) {
    const dt = new Date(MS2000 + m * 6e4);
    const y = dt.getUTCFullYear(), mo = dt.getUTCMonth();
    C.year[i] = y; C.ym[i] = y * 12 + mo; C.wd[i] = dt.getUTCDay(); C.hr[i] = dt.getUTCHours();
    C.day[i] = Math.floor(m / 1440);
    if (C.ym[i] < YM_MIN) YM_MIN = C.ym[i];
    if (C.ym[i] > YM_MAX) YM_MAX = C.ym[i];
  } else { C.ym[i] = -1; C.year[i] = -1; C.wd[i] = -1; C.hr[i] = -1; C.day[i] = -1; }
  C.proc[i] = (m >= 0 && C.sub[i] >= 0) ? C.day[i] - C.sub[i] : NOPROC;
  const u = C.units[i];
  C.ub[i] = u < 0 ? -1 : u === 0 ? 0 : u <= 2 ? 1 : u <= 10 ? 2 : u <= 50 ? 3 : u <= 200 ? 4 : 5;
}

/* ======================================================= formatting */
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = n => (n == null || Number.isNaN(n) ? '—' : Number(n).toLocaleString('en-US'));
const fmt1 = n => (n == null || Number.isNaN(n) ? '—' : Number(n).toLocaleString('en-US', { maximumFractionDigits: 1 }));
const pct = (a, b) => (b ? (100 * a / b).toFixed(1) + '%' : '—');
const ymLabel = ym => `${Math.floor(ym / 12)}-${String(ym % 12 + 1).padStart(2, '0')}`;
const ymShort = ym => new Date(Date.UTC(Math.floor(ym / 12), ym % 12, 1)).toLocaleString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
const parseYm = s => { const m = /^(\d{4})-(\d{2})$/.exec(s || ''); return m ? +m[1] * 12 + (+m[2] - 1) : null; };
const fmtDay = d => (d < 0 ? '—' : new Date(MS2000 + d * 864e5).toISOString().slice(0, 10));
const fmtIss = m => (m < 0 ? '—' : new Date(MS2000 + m * 6e4).toISOString().slice(0, 16).replace('T', ' '));
const issMs = m => MS2000 + m * 6e4;

/* ======================================================= entity helpers */
const certKey = i => { const a = C.app[i]; const base = 'CO-' + String(Math.floor(a / 10)).padStart(9, '0'); return a % 10 ? `${base}-${a % 10 + 1}` : base; };
const coNumber = i => { const v = C.co[i]; return typeof v === 'number' ? `${BLD.bin[C.b[i]]}-${String(v).padStart(7, '0')}` : (v || '—'); };
const seqNo = i => Math.floor(C.app[i] / 10);
const cbBoro = code => DICT.boro[(+String(code)[0]) - 1] || '';
const cbName = k => `CB ${DICT.cb[k]}`;
const cbLong = k => `CB ${DICT.cb[k]} · ${cbBoro(DICT.cb[k])}`;

// latest row per building (for address & units)
const BLD_ROW = new Int32Array(NB).fill(-1);
for (let i = 0; i < N; i++) { const b = C.b[i]; if (BLD_ROW[b] < 0 || C.iss[i] > C.iss[BLD_ROW[b]]) BLD_ROW[b] = i; }
const bldAddr = b => { const i = BLD_ROW[b]; return `${DICT.house[C.house[i]]} ${DICT.stDisplay[C.stn[i]]}`; };
const bldAddrFull = b => `${bldAddr(b)}, ${DICT.boro[C.boro[BLD_ROW[b]]]}`;

const BIN_IDX = new Map(); for (let b = 0; b < NB; b++) BIN_IDX.set(BLD.bin[b], b);
const mapFromList = arr => { const m = new Map(); arr.forEach((v, i) => m.set(v, i)); return m; };
const KEYMAP = {
  borough: mapFromList(DICT.boro), cb: mapFromList(DICT.cb), zip: mapFromList(DICT.zip), nta: mapFromList(DICT.nta),
  street: mapFromList(DICT.stNorm), lot: mapFromList(DICT.bbl), job: mapFromList(DICT.job),
};

const ENT = {
  borough: { one: 'Borough', many: 'Boroughs', col: C.boro, name: k => DICT.boro[k], key: k => DICT.boro[k], from: s => KEYMAP.borough.get(s) },
  cb: { one: 'Community board', many: 'Community boards', col: C.cb, name: cbLong, key: k => DICT.cb[k], from: s => KEYMAP.cb.get(s) },
  council: { one: 'Council district', many: 'Council districts', col: C.cd, name: k => `Council District ${k}`, key: k => String(k), from: s => (/^\d+$/.test(s) ? +s : undefined) },
  zip: { one: 'ZIP code', many: 'ZIP codes', col: C.zip, name: k => `ZIP ${DICT.zip[k]}`, key: k => DICT.zip[k], from: s => KEYMAP.zip.get(s) },
  nta: { one: 'Neighborhood', many: 'Neighborhoods', col: C.nta, name: k => DICT.nta[k], key: k => DICT.nta[k], from: s => KEYMAP.nta.get(s) },
  street: { one: 'Street', many: 'Streets', col: C.stn, name: k => DICT.stDisplay[k], key: k => DICT.stNorm[k], from: s => KEYMAP.street.get(s) },
  lot: { one: 'Tax lot', many: 'Tax lots', col: C.bbl, name: k => `BBL ${DICT.bbl[k]}`, key: k => DICT.bbl[k], from: s => KEYMAP.lot.get(s) },
  building: { one: 'Building', many: 'Buildings', col: C.b, name: k => bldAddrFull(k), key: k => String(BLD.bin[k]), from: s => BIN_IDX.get(+s) },
  job: { one: 'Job', many: 'Jobs', col: C.job, name: k => `Job ${DICT.job[k]}`, key: k => DICT.job[k], from: s => KEYMAP.job.get(s) },
};
const CERT_IDX = new Map(); for (let i = 0; i < N; i++) CERT_IDX.set(certKey(i), i);

const IDX = {};
function index(kind) {
  if (IDX[kind]) return IDX[kind];
  const col = ENT[kind].col, lists = new Map();
  for (let i = 0; i < N; i++) {
    const k = col[i]; if (k < 0) continue;
    let a = lists.get(k); if (!a) lists.set(k, a = []); a.push(i);
  }
  const m = new Map(); for (const [k, a] of lists) m.set(k, Int32Array.from(a));
  return (IDX[kind] = m);
}
const rowsOf = (kind, k) => index(kind).get(k) || new Int32Array(0);

/* ======================================================= routing & filters */
const FILTER_KEYS = ['from', 'to', 'boro', 'type', 'ft', 'units'];
let ROUTE = { path: '/', segs: [], q: {} };
let F = {};

function parseHash() {
  const h = location.hash.replace(/^#/, '') || '/';
  const [p, qs] = h.split('?');
  const q = Object.fromEntries(new URLSearchParams(qs || ''));
  const segs = p.split('/').filter(Boolean).map(decodeURIComponent);
  return { path: '/' + segs.map(encodeURIComponent).join('/'), segs, q };
}
function readFilters(q) {
  const f = {};
  const from = parseYm(q.from), to = parseYm(q.to);
  if (from != null) f.from = from;
  if (to != null) f.to = to;
  if (q.boro && DICT.boro.includes(q.boro)) f.boro = DICT.boro.indexOf(q.boro);
  if (q.type && DICT.jtg.includes(q.type)) f.type = DICT.jtg.indexOf(q.type);
  if (q.ft && DICT.ft.includes(q.ft)) f.ft = DICT.ft.indexOf(q.ft);
  if (q.units && UB_KEYS.includes(q.units)) f.units = UB_KEYS.indexOf(q.units);
  return f;
}
function filterParams(f = F) {
  const p = {};
  if (f.from != null) p.from = ymLabel(f.from);
  if (f.to != null) p.to = ymLabel(f.to);
  if (f.boro != null) p.boro = DICT.boro[f.boro];
  if (f.type != null) p.type = DICT.jtg[f.type];
  if (f.ft != null) p.ft = DICT.ft[f.ft];
  if (f.units != null) p.units = UB_KEYS[f.units];
  return p;
}
const filterKey = (f = F) => JSON.stringify(f);
// Build a hash link that keeps global filters
function link(path, extra = {}, f = F) {
  const p = { ...filterParams(f), ...extra };
  for (const k of Object.keys(p)) if (p[k] == null || p[k] === '') delete p[k];
  const qs = new URLSearchParams(p).toString();
  return '#' + path + (qs ? '?' + qs : '');
}
const entPath = (kind, k) => `/${kind}/${encodeURIComponent(ENT[kind].key(k))}`;
const entHref = (kind, k, extra) => link(entPath(kind, k), extra);
const entLink = (kind, k, label) => (k == null || k < 0 ? '—' : `<a href="${entHref(kind, k)}">${esc(label ?? ENT[kind].name(k))}</a>`);
const certHref = i => link('/co/' + certKey(i));
const certLink = i => `<a href="${certHref(i)}">${certKey(i)}</a>`;
function go(path, extra, f) { location.hash = link(path, extra, f); }
function setFilters(nf) {
  const extra = { ...ROUTE.q }; for (const k of FILTER_KEYS) delete extra[k];
  location.hash = link(ROUTE.path, extra, nf);
}
function crossFilter(key, val) { const nf = { ...F }; if (nf[key] === val) delete nf[key]; else nf[key] = val; setFilters(nf); }

function passes(i, f) {
  if (f.from != null && C.ym[i] < f.from) return false;
  if (f.to != null && C.ym[i] > f.to) return false;
  if (f.boro != null && C.boro[i] !== f.boro) return false;
  if (f.type != null && C.jtg[i] !== f.type) return false;
  if (f.ft != null && C.ft[i] !== f.ft) return false;
  if (f.units != null && C.ub[i] !== f.units) return false;
  return true;
}
const MEMO = new Map();
// Apply global filters (or a variant) to a scope's rows. rows=null → all rows.
function applyF(rows, scopeKey = 'all', f = F, skip = []) {
  const ff = { ...f }; for (const s of skip) delete ff[s];
  const key = scopeKey + '|' + JSON.stringify(ff);
  if (MEMO.has(key)) return MEMO.get(key);
  const out = [];
  if (rows) { for (let j = 0; j < rows.length; j++) if (passes(rows[j], ff)) out.push(rows[j]); }
  else for (let i = 0; i < N; i++) if (passes(i, ff)) out.push(i);
  const res = Int32Array.from(out);
  if (MEMO.size > 80) MEMO.delete(MEMO.keys().next().value);
  MEMO.set(key, res);
  return res;
}

/* ======================================================= aggregation */
function countBy(rows, col) {
  const m = new Map();
  for (let j = 0; j < rows.length; j++) { const k = col[rows[j]]; if (k < 0) continue; m.set(k, (m.get(k) || 0) + 1); }
  return m;
}
const sortedEntries = m => [...m.entries()].sort((a, b) => b[1] - a[1]);
function modeOf(rows, col) { let best = -1, bc = 0; for (const [k, c] of countBy(rows, col)) if (c > bc) { bc = c; best = k; } return best; }
function distinct(rows, col) { const s = new Set(); for (let j = 0; j < rows.length; j++) s.add(col[rows[j]]); return s; }
function procValues(rows) {
  const v = []; for (let j = 0; j < rows.length; j++) { const p = C.proc[rows[j]]; if (p !== NOPROC) v.push(p); }
  return Float64Array.from(v).sort();
}
function quantile(sorted, q) {
  if (!sorted.length) return null;
  const pos = (sorted.length - 1) * q, lo = Math.floor(pos), hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}
const median = rows => quantile(procValues(rows), 0.5);
// Dwelling units counted once per building: the latest CO (in scope) that reports units.
function unitsLatest(rows) {
  const best = new Map();
  for (let j = 0; j < rows.length; j++) {
    const i = rows[j]; if (C.units[i] < 0) continue;
    const prev = best.get(C.b[i]); if (prev == null || C.iss[i] > C.iss[prev]) best.set(C.b[i], i);
  }
  let s = 0; for (const i of best.values()) s += C.units[i]; return s;
}
function kpis(rows) {
  let ren = 0; for (let j = 0; j < rows.length; j++) if (C.ft[rows[j]] >= 2) ren++;
  return {
    cos: rows.length, bld: distinct(rows, C.b).size, jobs: distinct(rows, C.job).size,
    units: unitsLatest(rows), median: median(rows), renew: rows.length ? ren / rows.length : null, renN: ren,
  };
}
function monthRange(f = F) { return [f.from != null ? Math.max(f.from, YM_MIN) : YM_MIN, f.to != null ? Math.min(f.to, YM_MAX) : YM_MAX]; }
function monthly(rows, by = C.jtg, groups = 3) {
  const [a, b] = monthRange(); const len = Math.max(0, b - a + 1);
  const series = Array.from({ length: groups }, () => new Array(len).fill(0));
  for (let j = 0; j < rows.length; j++) { const i = rows[j]; const x = C.ym[i] - a; const g = by[i]; if (x >= 0 && x < len && g >= 0) series[g][x]++; }
  return { months: Array.from({ length: len }, (_, k) => a + k), series };
}

/* ======================================================= theme tokens for charts */
function T() {
  const s = getComputedStyle(document.documentElement), v = n => s.getPropertyValue(n).trim();
  return {
    t1: v('--text-1'), t2: v('--text-2'), t3: v('--text-3'), grid: v('--grid'), border: v('--border'), surface: v('--surface'),
    jt: [v('--jt-0'), v('--jt-1'), v('--jt-2')], ft: [v('--ft-0'), v('--ft-1'), v('--ft-2'), v('--ft-3')],
    s: [v('--s-0'), v('--s-1'), v('--s-2'), v('--s-3')], seq: v('--seq'), seqLo: v('--seq-lo'), seqHi: v('--seq-hi'),
    dark: v('--tiles') === 'dark',
  };
}
const HINT_DRILL = 'Click: open · Shift-click: filter';
function ttBox(title, lines, hint) {
  return `<div class="tt"><b>${esc(title)}</b>${lines.map(l => `<div>${l}</div>`).join('')}${hint ? `<div class="h">${hint}</div>` : ''}</div>`;
}
const sw = c => `<i class="sw" style="background:${c}"></i>`;
function baseOpt(t = T()) {
  return {
    animation: false,
    textStyle: { fontFamily: getComputedStyle(document.body).fontFamily, color: t.t2, fontSize: 12 },
    grid: { left: 8, right: 16, top: 16, bottom: 8, containLabel: true },
    tooltip: {
      backgroundColor: t.surface, borderColor: t.border, borderWidth: 1, padding: [8, 10],
      textStyle: { color: t.t1, fontSize: 12 }, extraCssText: 'box-shadow:0 4px 16px rgba(0,0,0,.15);border-radius:8px;',
    },
  };
}
const axisCat = (t, data, extra = {}) => ({ type: 'category', data, axisLine: { lineStyle: { color: t.border } }, axisTick: { show: false }, axisLabel: { color: t.t2, hideOverlap: true }, ...extra });
const axisVal = (t, extra = {}) => ({ type: 'value', splitLine: { lineStyle: { color: t.grid } }, axisLabel: { color: t.t3 }, axisLine: { show: false }, ...extra });

/* ======================================================= page mounting */
let MOUNTS = [], CHARTS = [], MAPS = [], RENDER_GEN = 0;
const TABLES = {};
const onMount = fn => MOUNTS.push(fn);
let uid = 0; const nid = p => `${p}${++uid}`;

function cleanup() {
  CHARTS.forEach(c => c.dispose()); CHARTS = [];
  MAPS.forEach(m => { try { if (m._coexCluster) { m._coexCluster.clearLayers(); m.removeLayer(m._coexCluster); } m.off(); m.remove(); } catch (e) { /* map already torn down */ } }); MAPS = [];
  for (const k in TABLES) delete TABLES[k];
}

// A card with a chart and an accessible table alternative.
function chartCard({ id, title, sub, height = 280, span = 6, hint = HINT_DRILL, legend = '', table, extraTools = '' }) {
  if (table) TABLES[id] = table;
  return `<section class="card span-${span}" aria-labelledby="${id}-h">
    <div class="card-head"><div><h3 id="${id}-h">${esc(title)}</h3>${sub ? `<div class="sub">${sub}</div>` : ''}</div>
      <div class="card-tools">${extraTools}${table ? btn({ label: 'View as table', variant: 'ghost', size: 'sm', attrs: `data-tbl="${id}" aria-expanded="false"` }) : ''}</div></div>
    ${legend}
    <div class="chart" id="${id}" style="height:${height}px" role="img" aria-label="${esc(title)} chart"></div>
    <div class="alt-table" id="${id}-tbl" hidden></div>
    ${hint ? `<p class="hint">${hint}</p>` : ''}
  </section>`;
}
function legendHtml(items) { return `<div class="legend">${items.map(([c, l]) => `<span>${sw(c)}${esc(l)}</span>`).join('')}</div>`; }
function card(title, body, span = 6, sub = '') {
  return `<section class="card span-${span}"><div class="card-head"><div><h3>${esc(title)}</h3>${sub ? `<div class="sub">${sub}</div>` : ''}</div></div>${body}</section>`;
}
function simpleTable(head, rows, numCols = []) {
  return `<div class="table-wrap"><table class="t"><thead><tr>${head.map((h, k) => `<th${numCols.includes(k) ? ' class="n"' : ''}>${h && h.html ? h.html : esc(h)}</th>`).join('')}</tr></thead>
    <tbody>${rows.map(r => `<tr>${r.map((c, k) => `<td${numCols.includes(k) ? ' class="n"' : ''}>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
// Ranked list with inline magnitude bar
function rankTable(items, { label = 'Name', value = 'COs', max = 10, extra } = {}) {
  const top = items.slice(0, max); const mx = Math.max(1, ...top.map(x => x.count));
  if (!top.length) return `<p class="muted">Nothing in scope.</p>`;
  return `<div class="table-wrap"><table class="t rank"><thead><tr><th>${esc(label)}</th>${extra ? `<th>${esc(extra)}</th>` : ''}<th class="n">${esc(value)}</th></tr></thead><tbody>
    ${top.map(x => `<tr><td>${x.html}</td>${extra ? `<td>${x.extra ?? ''}</td>` : ''}<td class="bar-cell"><div class="bt" style="justify-content:flex-end"><span class="num">${fmt(x.count)}</span><div class="bb" style="width:${Math.max(2, 70 * x.count / mx)}px"></div></div></td></tr>`).join('')}
  </tbody></table></div>`;
}
function emptyState(msg = 'No COs match these filters') {
  return `<div class="empty"><h3>${esc(msg)}</h3><p>Try widening the date range or removing a filter.</p>${btn({ label: 'Reset filters', variant: 'primary', size: 'lg', attrs: 'data-reset' })}</div>`;
}

function makeChart(id, option, { onClick, onShift, onEvent } = {}) {
  const el = document.getElementById(id); if (!el) return null;
  const ch = echarts.init(el, null, { renderer: 'canvas' });
  ch.setOption(option);
  if (onClick || onShift) ch.on('click', p => {
    const shift = p.event && p.event.event && (p.event.event.shiftKey || p.event.event.metaKey && false);
    if (shift && onShift) onShift(p); else if (onClick) onClick(p);
  });
  if (onEvent) for (const [ev, fn] of Object.entries(onEvent)) ch.on(ev, fn);
  CHARTS.push(ch);
  return ch;
}

/* ---------------- standard charts */
function trendOption(rows, { brush = false, by = 'jtg' } = {}) {
  const t = T(), byFt = by === 'ft';
  const { months, series } = byFt ? monthly(rows, C.ft, 4) : monthly(rows);
  const names = byFt ? DICT.ft : DICT.jtg, cols = byFt ? t.ft : t.jt;
  const o = baseOpt(t);
  o.grid.top = brush ? 36 : 16;
  o.tooltip.trigger = 'axis';
  o.tooltip.axisPointer = { type: 'shadow', shadowStyle: { color: t.dark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.05)' } };
  o.tooltip.formatter = ps => {
    const ym = months[ps[0].dataIndex]; let tot = 0; ps.forEach(p => tot += p.value);
    return ttBox(ymShort(ym), [...ps.slice().reverse().map(p => `${sw(p.color)}${esc(p.seriesName)}: <b>${fmt(p.value)}</b>`), `Total: <b>${fmt(tot)}</b>`], 'Click: open month in Explorer · Shift-click: filter to month' + (brush ? ' · Drag: set date range' : ''));
  };
  o.xAxis = axisCat(t, months.map(ymShort));
  o.yAxis = axisVal(t);
  o.series = series.map((d, g) => ({
    name: names[g], type: 'bar', stack: 'a', data: d, barCategoryGap: '20%',
    itemStyle: { color: cols[g], borderColor: t.surface, borderWidth: 1, borderRadius: g === series.length - 1 ? [3, 3, 0, 0] : 0 },
    emphasis: { focus: 'none' },
  }));
  if (brush) {
    o.toolbox = { right: 8, top: 0, itemSize: 14, iconStyle: { borderColor: t.t3 }, feature: { brush: { type: ['lineX', 'clear'], title: { lineX: 'Drag to set date range', clear: 'Clear selection' } } } };
    o.brush = { xAxisIndex: 0, brushType: 'lineX', brushMode: 'single', transformable: false, brushStyle: { color: 'rgba(42,120,214,.12)', borderColor: t.seq, borderWidth: 1 } };
  }
  return { o, months };
}
function mountTrend(id, rows, { brush = false, scopeExtra = {}, by } = {}) {
  const { o, months } = trendOption(rows, { brush, by });
  const ch = makeChart(id, o, {
    onClick: p => go('/explorer', { ...scopeExtra }, { ...F, from: months[p.dataIndex], to: months[p.dataIndex] }),
    onShift: p => setFilters({ ...F, from: months[p.dataIndex], to: months[p.dataIndex] }),
    onEvent: brush ? {
      brushEnd: e => {
        const a = e.areas && e.areas[0]; if (!a || !a.coordRange) return;
        const [s, en] = a.coordRange; const lo = months[Math.max(0, s)], hi = months[Math.min(months.length - 1, en)];
        if (lo != null && hi != null) setFilters({ ...F, from: lo, to: hi });
      },
    } : undefined,
  });
  if (ch && brush) ch.dispatchAction({ type: 'takeGlobalCursor', key: 'brush', brushOption: { brushType: 'lineX', brushMode: 'single' } });
  return { months };
}
function trendTable(rows, by = 'jtg') {
  const byFt = by === 'ft'; const { months, series } = byFt ? monthly(rows, C.ft, 4) : monthly(rows);
  const names = byFt ? DICT.ft : DICT.jtg;
  return { head: ['Month', ...names, 'Total'], rows: months.map((m, k) => [ymShort(m), ...series.map(s => fmt(s[k])), fmt(series.reduce((a, s) => a + s[k], 0))]), num: [1, 2, 3, 4, 5] };
}
// Horizontal single-color bars (rankings) — color by entity is unnecessary here
function hbarOption(labels, values, { tip, valueName = 'COs' } = {}) {
  const t = T(); const o = baseOpt(t);
  o.grid.right = 48;
  o.tooltip.trigger = 'item';
  o.tooltip.formatter = p => ttBox(labels[p.dataIndex], [`${valueName}: <b>${fmt(values[p.dataIndex])}</b>`], tip ?? HINT_DRILL);
  o.yAxis = axisCat(t, labels.slice().reverse(), { axisLabel: { color: t.t2, width: 150, overflow: 'truncate' } });
  o.xAxis = axisVal(t);
  o.series = [{
    type: 'bar', data: values.slice().reverse(), barMaxWidth: 18,
    itemStyle: { color: t.seq, borderRadius: [0, 4, 4, 0] },
    label: { show: labels.length <= 12, position: 'right', color: t.t2, formatter: p => fmt(p.value) },
  }];
  return o;
}
const revIdx = (p, n) => n - 1 - p.dataIndex;
function vbarOption(labels, values, { tip, color, valueName = 'COs', colors } = {}) {
  const t = T(); const o = baseOpt(t);
  o.tooltip.trigger = 'item';
  o.tooltip.formatter = p => ttBox(labels[p.dataIndex], [`${valueName}: <b>${fmt(values[p.dataIndex])}</b>`], tip ?? HINT_DRILL);
  o.xAxis = axisCat(t, labels); o.yAxis = axisVal(t);
  o.series = [{
    type: 'bar', data: values.map((v, k) => ({ value: v, itemStyle: { color: colors ? colors[k] : (color || t.seq) } })), barMaxWidth: 40,
    itemStyle: { borderRadius: [4, 4, 0, 0] }, label: { show: labels.length <= 10, position: 'top', color: t.t2, formatter: p => fmt(p.value) },
  }];
  return o;
}
function donutOption(labels, values, colors, { tip } = {}) {
  const t = T(); const o = baseOpt(t);
  const tot = values.reduce((a, b) => a + b, 0);
  o.tooltip.trigger = 'item';
  o.tooltip.formatter = p => ttBox(labels[p.dataIndex], [`${fmt(p.value)} COs (${pct(p.value, tot)})`], tip ?? 'Click: filter everything to this value');
  o.series = [{
    type: 'pie', radius: ['48%', '72%'], center: ['50%', '52%'], avoidLabelOverlap: true,
    itemStyle: { borderColor: t.surface, borderWidth: 2 },
    label: { color: t.t2, formatter: p => `${p.name}\n${pct(p.value, tot)}`, fontSize: 11 },
    labelLine: { lineStyle: { color: t.border } },
    data: labels.map((l, k) => ({ name: l, value: values[k], itemStyle: { color: colors[k] } })),
  }];
  return o;
}
// Job-type mix: one horizontal 100% bar per group, colored by group
function mixCard(id, rows, title = 'Job type mix', span = 4) {
  const t = T(); const m = countBy(rows, C.jtg); const vals = [0, 1, 2].map(g => m.get(g) || 0);
  onMount(() => makeChart(id, vbarOption(DICT.jtg, vals, { colors: t.jt, tip: 'Click: filter to this job type' }), {
    onClick: p => crossFilter('type', p.dataIndex), onShift: p => crossFilter('type', p.dataIndex),
  }));
  return chartCard({ id, title, span, height: 230, hint: 'Click: filter to job type', table: { head: ['Job type', 'COs', 'Share'], rows: vals.map((v, g) => [DICT.jtg[g], fmt(v), pct(v, rows.length)]), num: [1, 2] } });
}
function filingCard(id, rows, span = 4) {
  const t = T(); const m = countBy(rows, C.ft); const vals = [0, 1, 2, 3].map(g => m.get(g) || 0);
  onMount(() => makeChart(id, donutOption(DICT.ft, vals, t.ft), { onClick: p => crossFilter('ft', p.dataIndex), onShift: p => crossFilter('ft', p.dataIndex) }));
  return chartCard({ id, title: 'Filing type', span, height: 230, hint: 'Click: filter everything to this filing type', table: { head: ['Filing type', 'COs', 'Share'], rows: vals.map((v, g) => [DICT.ft[g], fmt(v), pct(v, rows.length)]), num: [1, 2] } });
}
function unitsCard(id, rows, span = 4) {
  const m = countBy(rows, C.ub); const vals = UB_LABELS.map((_, k) => m.get(k) || 0);
  const unknown = rows.length - vals.reduce((a, b) => a + b, 0);
  onMount(() => makeChart(id, vbarOption(UB_LABELS, vals, { tip: 'Click: filter to this unit range' }), { onClick: p => crossFilter('units', p.dataIndex), onShift: p => crossFilter('units', p.dataIndex) }));
  return chartCard({ id, title: 'Dwelling units per CO', sub: `${fmt(unknown)} COs with no unit count are excluded`, span, height: 230, hint: 'Click: filter to unit range', table: { head: ['Units', 'COs'], rows: vals.map((v, k) => [UB_LABELS[k], fmt(v)]), num: [1] } });
}
function procHistCard(id, rows, span = 4, scopeExtra = {}) {
  const v = procValues(rows); const counts = PROC_BINS.map(([a, b]) => { let c = 0; for (const x of v) if (x >= a && x <= b) c++; return c; });
  onMount(() => makeChart(id, vbarOption(PROC_BINS.map(b => b[2]), counts, { tip: 'Click: open Processing Time Lab' }), { onClick: () => go('/processing', scopeExtra) }));
  return chartCard({ id, title: 'Processing time', sub: `Median ${fmt1(quantile(v, 0.5))} days (submitted → issued)`, span, height: 230, hint: 'Click: open Processing Time Lab', table: { head: ['Days', 'COs'], rows: counts.map((c, k) => [PROC_BINS[k][2], fmt(c)]), num: [1] } });
}

/* ---------------- KPI tiles */
function kpiTiles(k, { cmp, links = {} } = {}) {
  const tile = (key, lbl, val, cmpTxt) => {
    const href = links[key]; const tag = href ? 'a' : 'div';
    return `<${tag} class="kpi"${href ? ` href="${href}"` : ''}><div class="lbl">${lbl}</div><div class="val">${val}</div>${cmpTxt ? `<div class="cmp">${cmpTxt}</div>` : ''}</${tag}>`;
  };
  return `<div class="kpis">
    ${tile('cos', 'Certificates issued', fmt(k.cos), cmp ? `${pct(k.cos, cmp.cos)} of city` : '')}
    ${tile('bld', 'Buildings', fmt(k.bld), cmp ? `${pct(k.bld, cmp.bld)} of city` : '')}
    ${tile('jobs', 'Jobs', fmt(k.jobs), cmp ? `${fmt1(k.cos / (k.jobs || 1))} COs per job (city ${fmt1(cmp.cos / (cmp.jobs || 1))})` : `${fmt1(k.cos / (k.jobs || 1))} COs per job`)}
    ${tile('units', 'Dwelling units', fmt(k.units), 'latest CO per building')}
    ${tile('median', 'Median processing', k.median == null ? '—' : fmt1(k.median) + ' d', cmp ? `city ${fmt1(cmp.median)} d` : 'submitted → issued')}
    ${tile('renew', 'Renewals', k.renew == null ? '—' : (k.renew * 100).toFixed(1) + '%', cmp ? `city ${(cmp.renew * 100).toFixed(1)}%` : `${fmt(k.renN)} renewal COs`)}
  </div>`;
}

/* ---------------- maps */
function tileLayer() {
  return L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors', maxZoom: 19,
  });
}
// Clustered map of buildings in scope; click a point → Building page.
function mountMap(id, rows, { highlight } = {}) {
  const el = document.getElementById(id); if (!el || !window.L) return;
  const map = L.map(el, { preferCanvas: true, scrollWheelZoom: false, zoomControl: true, maxZoom: 19, zoomAnimation: true });
  MAPS.push(map);
  const per = countBy(rows, C.b);
  const t = T();
  const cluster = L.markerClusterGroup({
    chunkedLoading: true, chunkInterval: 40, chunkDelay: 16, showCoverageOnHover: false, maxClusterRadius: 50,
    iconCreateFunction: c => {
      const n = c.getChildCount(); const s = n < 10 ? 28 : n < 100 ? 34 : n < 1000 ? 42 : 50;
      return L.divIcon({ html: `<div style="width:${s - 8}px;height:${s - 8}px">${n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1) + 'k' : n}</div>`, className: 'mc', iconSize: [s, s] });
    },
  });
  const pts = [], markers = [];
  for (const [b, cnt] of per) {
    const la = BLD.lat[b], ln = BLD.lng[b]; if (la == null) continue;
    const mk = L.circleMarker([la, ln], { radius: Math.min(12, 4 + Math.sqrt(cnt)), color: t.surface, weight: 1.5, fillColor: b === highlight ? t.jt[1] : t.seq, fillOpacity: .9 });
    mk._coexB = b; mk._coexN = cnt;
    markers.push(mk); pts.push([la, ln]);
  }
  // tooltips are bound lazily on first hover; one delegated click handler
  cluster.on('mouseover', e => {
    const mk = e.layer; if (mk._coexB == null || mk.getTooltip()) return;
    mk.bindTooltip(`<b>${esc(bldAddrFull(mk._coexB))}</b><br>${fmt(mk._coexN)} COs · BIN ${BLD.bin[mk._coexB]}<br><span style="opacity:.7">Click: open building</span>`).openTooltip();
  });
  cluster.on('click', e => { if (e.layer._coexB != null) location.hash = entHref('building', e.layer._coexB); });
  // position first (no animation), then tiles, then markers
  if (pts.length === 1) map.setView(pts[0], 17, { animate: false });
  else if (pts.length) map.fitBounds(pts, { padding: [20, 20], maxZoom: 16, animate: false });
  else map.setView([40.71, -73.95], 10, { animate: false });
  tileLayer().addTo(map);
  map.addLayer(cluster); map._coexCluster = cluster;
  cluster.addLayers(markers);
  map.on('focus', () => map.scrollWheelZoom.enable());
  map.on('blur', () => map.scrollWheelZoom.disable());
  setTimeout(() => map.invalidateSize(), 50);
}
function mapCard(id, rows, span = 6, title = 'Map', highlight) {
  const n = distinct(rows, C.b).size;
  onMount(() => { const gen = RENDER_GEN; setTimeout(() => { if (gen === RENDER_GEN) mountMap(id, rows, { highlight }); }, 30); });
  return `<section class="card span-${span}"><div class="card-head"><div><h3>${esc(title)}</h3><div class="sub">${fmt(n)} building${n === 1 ? "" : "s"} · clusters zoom in on click</div></div></div>
    <div class="map${span < 6 ? ' small' : ''}" id="${id}" role="region" aria-label="${esc(title)}"></div><p class="hint">Click a point to open its building</p></section>`;
}

/* ---------------- related panel */
function relatedPanel(groups) {
  const g = groups.filter(x => x.items && x.items.length);
  if (!g.length) return '';
  return `<h2>Related</h2><section class="card"><div class="related">${g.map(x => `<div><h4>${esc(x.title)}</h4><ul>${x.items.slice(0, x.max || 8).map(it => `<li>${it.html}${it.count != null ? `<span>${fmt(it.count)}</span>` : ''}</li>`).join('')}</ul>${x.more ? `<a class="note" href="${x.more}">See all →</a>` : ''}</div>`).join('')}</div></section>`;
}
// Overlap items: counts of another dimension within rows
function overlap(rows, kind, max = 8, exclude) {
  return sortedEntries(countBy(rows, ENT[kind].col)).filter(([k]) => k !== exclude).slice(0, max).map(([k, c]) => ({ html: entLink(kind, k), count: c }));
}

/* ---------------- virtual table */
function vtable(el, { cols, items, rowH = 34, height = 520, sort, onSort }) {
  const widths = cols.map(c => c.w || 140); const total = widths.reduce((a, b) => a + b, 0);
  const tpl = widths.map(w => `minmax(${w}px, ${w}fr)`).join(' ');
  let data = Array.from(items); // plain array: typed-array .map() would coerce sort tuples
  let sk = sort ? sort.key : null, dir = sort ? sort.dir : -1;
  const doSort = () => {
    if (sk == null) return; const c = cols.find(x => x.key === sk); if (!c) return;
    const g = c.sort || c.get; const tagged = data.map(it => [g(it), it]);
    tagged.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0) * dir);
    data = tagged.map(x => x[1]);
  };
  doSort();
  el.innerHTML = `<div class="vt" style="height:${Math.min(height, 40 + data.length * rowH)}px" role="table" aria-rowcount="${data.length}">
    <div class="vt-inner" style="min-width:${total}px">
      <div class="vt-head" role="row" style="grid-template-columns:${tpl}">${cols.map(c => `<button role="columnheader" class="${c.num ? 'n' : ''}" data-k="${c.key}" aria-sort="${c.key === sk ? (dir > 0 ? 'ascending' : 'descending') : 'none'}">${esc(c.label)}${c.key === sk ? (dir > 0 ? ' ▲' : ' ▼') : ''}</button>`).join('')}</div>
      <div class="vt-body" style="position:relative;height:${data.length * rowH}px"></div>
    </div></div>`;
  const sc = el.querySelector('.vt'), body = el.querySelector('.vt-body');
  let last = -1;
  const draw = () => {
    const top = Math.max(0, sc.scrollTop - 36); const start = Math.max(0, Math.floor(top / rowH) - 5);
    if (start === last) return; last = start;
    const end = Math.min(data.length, start + Math.ceil(sc.clientHeight / rowH) + 12);
    let h = '';
    for (let r = start; r < end; r++) {
      const it = data[r];
      h += `<div class="vt-row" role="row" style="top:${r * rowH}px;height:${rowH}px;grid-template-columns:${tpl}">${cols.map(c => `<div role="cell" class="${c.num ? 'n' : ''}">${c.html ? c.html(it) : esc(c.get(it))}</div>`).join('')}</div>`;
    }
    body.innerHTML = h;
  };
  let raf = 0; sc.addEventListener('scroll', () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(draw); });
  el.querySelectorAll('.vt-head button').forEach(b => b.addEventListener('click', () => {
    const k = b.dataset.k; if (sk === k) dir = -dir; else { sk = k; dir = (cols.find(c => c.key === k).num ? -1 : 1); }
    if (onSort) onSort({ key: sk, dir });
    vtable(el, { cols, items: data, rowH, height, sort: { key: sk, dir }, onSort });
  }));
  draw();
  return { get data() { return data; } };
}

/* ======================================================= breadcrumbs */
function crumbsFor(chain) {
  const parts = [`<a href="${link('/')}">Citywide</a>`];
  chain.forEach((c, k) => {
    const last = k === chain.length - 1;
    parts.push('<span class="sep">›</span>');
    parts.push(last || !c.href ? `<span${last ? ' aria-current="page"' : ''}>${esc(c.label)}</span>` : `<a href="${c.href}">${esc(c.label)}</a>`);
  });
  if (!chain.length) parts[0] = `<span aria-current="page">Citywide</span>`;
  return parts.join(' ');
}
const geoChainForRows = (rows, upto) => {
  const out = [];
  const bo = modeOf(rows, C.boro); if (bo >= 0) out.push({ label: DICT.boro[bo], href: entHref('borough', bo) });
  if (upto === 'borough') return out;
  const cb = modeOf(rows, C.cb); if (cb >= 0) out.push({ label: cbName(cb), href: entHref('cb', cb) });
  if (upto === 'cb') return out;
  const nt = modeOf(rows, C.nta); if (nt >= 0) out.push({ label: DICT.nta[nt], href: entHref('nta', nt) });
  return out;
};

/* ======================================================= filter bar */
function renderFilterBar() {
  const el = document.getElementById('filterbar');
  const months = []; for (let m = YM_MIN; m <= YM_MAX; m++) months.push(m);
  const opt = (v, l, sel) => `<option value="${esc(v)}"${sel ? ' selected' : ''}>${esc(l)}</option>`;
  const chips = [];
  if (F.from != null || F.to != null) chips.push(['date', `${F.from != null ? ymShort(F.from) : 'Start'} – ${F.to != null ? ymShort(F.to) : 'Latest'}`]);
  if (F.boro != null) chips.push(['boro', DICT.boro[F.boro]]);
  if (F.type != null) chips.push(['type', DICT.jtg[F.type]]);
  if (F.ft != null) chips.push(['ft', DICT.ft[F.ft]]);
  if (F.units != null) chips.push(['units', `${UB_LABELS[F.units]} units`]);
  const open = el.classList.contains('open');
  el.innerHTML = `
    <div class="fb-row">
      ${btn({ label: `Filters${chips.length ? ` (${chips.length})` : ''}`, cls: 'fb-toggle', attrs: `id="fbToggle" aria-expanded="${open}"` })}
    </div>
    <div class="fb-row collapsible">
      <label>From<select id="fFrom" aria-label="Issued from month">${opt('', 'Start')}${months.map(m => opt(ymLabel(m), ymShort(m), F.from === m)).join('')}</select></label>
      <label>To<select id="fTo" aria-label="Issued to month">${opt('', 'Latest')}${months.map(m => opt(ymLabel(m), ymShort(m), F.to === m)).join('')}</select></label>
      <label>Borough<select id="fBoro">${opt('', 'All')}${DICT.boro.map((b, k) => opt(b, b, F.boro === k)).join('')}</select></label>
      <label>Job type<select id="fType">${opt('', 'All')}${DICT.jtg.map((b, k) => opt(b, b, F.type === k)).join('')}</select></label>
      <label>Filing type<select id="fFt">${opt('', 'All')}${DICT.ft.map((b, k) => opt(b, b, F.ft === k)).join('')}</select></label>
      <label>Units<select id="fUnits">${opt('', 'All')}${UB_KEYS.map((b, k) => opt(b, UB_LABELS[k], F.units === k)).join('')}</select></label>
      ${btn({ label: 'Reset', variant: 'danger', attrs: 'id="fReset"' })}
      ${btn({ label: 'Copy link', attrs: 'id="fCopy"' })}
    </div>
    <div class="chips" aria-label="Active filters">${chips.map(([k, l]) => `<span class="chip">${esc(l)}${btn({ label: `Remove ${esc(l)} filter`, variant: 'ghost', size: 'sm', iconOnly: true, icon: '×', attrs: `data-chip="${k}"` })}</span>`).join('')}</div>`;
  const read = () => {
    const nf = {};
    const v = id => document.getElementById(id).value;
    if (v('fFrom')) nf.from = parseYm(v('fFrom'));
    if (v('fTo')) nf.to = parseYm(v('fTo'));
    if (v('fBoro')) nf.boro = DICT.boro.indexOf(v('fBoro'));
    if (v('fType')) nf.type = DICT.jtg.indexOf(v('fType'));
    if (v('fFt')) nf.ft = DICT.ft.indexOf(v('fFt'));
    if (v('fUnits')) nf.units = UB_KEYS.indexOf(v('fUnits'));
    if (nf.from != null && nf.to != null && nf.from > nf.to) [nf.from, nf.to] = [nf.to, nf.from];
    setFilters(nf);
  };
  el.querySelectorAll('select').forEach(s => s.addEventListener('change', read));
  el.querySelector('#fReset').addEventListener('click', () => setFilters({}));
  el.querySelector('#fCopy').addEventListener('click', e => {
    const b = e.currentTarget, url = location.href;
    (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(() => { flashDone(b, 'Copied ✓'); toast('Link copied'); }, () => { prompt('Copy this link', url); });
  });
  el.querySelector('#fbToggle').addEventListener('click', () => { el.classList.toggle('open'); el.querySelector('#fbToggle').setAttribute('aria-expanded', el.classList.contains('open')); });
  el.querySelectorAll('[data-chip]').forEach(b => b.addEventListener('click', () => {
    const nf = { ...F }; const k = b.dataset.chip;
    if (k === 'date') { delete nf.from; delete nf.to; } else delete nf[k];
    setFilters(nf);
  }));
}
function toast(msg) { const t = document.getElementById('toast'); t.textContent = msg; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 1800); }

/* ======================================================= search */
let SEARCH = null;
function buildSearch() {
  const e = [];
  const add = (kind, label, sub, href, key) => e.push({ kind, label, sub, href, key: (key || label).toLowerCase() });
  DICT.boro.forEach((b, k) => add('Borough', b, '', entPath('borough', k)));
  DICT.nta.forEach((b, k) => add('Neighborhood', b, '', entPath('nta', k)));
  DICT.zip.forEach((b, k) => add('ZIP', b, '', entPath('zip', k)));
  DICT.cb.forEach((b, k) => add('Comm. board', `CB ${b}`, cbBoro(b), entPath('cb', k), `cb ${b} community board ${b}`));
  for (const k of index('council').keys()) add('Council', `Council District ${k}`, '', entPath('council', k), `council district ${k} cd ${k}`);
  DICT.stNorm.forEach((s, k) => add('Street', DICT.stDisplay[k], '', entPath('street', k), `${DICT.stDisplay[k]} ${s}`));
  for (let b = 0; b < NB; b++) {
    const i = BLD_ROW[b]; const raw = `${DICT.house[C.house[i]]} ${DICT.st[C.st[i]]}`;
    add('Building', bldAddr(b), `${DICT.boro[C.boro[i]]} · BIN ${BLD.bin[b]}`, entPath('building', b), `${bldAddr(b)} ${raw} ${BLD.bin[b]}`);
  }
  DICT.bbl.forEach((s, k) => add('Tax lot', `BBL ${s}`, '', entPath('lot', k), s));
  DICT.job.forEach((s, k) => add('Job', `Job ${s}`, '', entPath('job', k), s));
  for (let i = 0; i < N; i++) add('Certificate', certKey(i), coNumber(i), '/co/' + certKey(i), `${certKey(i)} ${coNumber(i)}`);
  SEARCH = e;
}
function searchQuery(q) {
  q = q.trim().toLowerCase(); if (!q) return [];
  const terms = q.split(/\s+/); const starts = [], contains = [];
  const per = {};
  for (const x of SEARCH) {
    if (!terms.every(t => x.key.includes(t))) continue;
    per[x.kind] = (per[x.kind] || 0) + 1; if (per[x.kind] > 8) continue;
    (x.key.startsWith(terms[0]) ? starts : contains).push(x);
    if (starts.length > 40) break;
  }
  return starts.concat(contains).slice(0, 30);
}
function openSearch() {
  if (!SEARCH) buildSearch();
  const m = document.getElementById('searchModal'), inp = document.getElementById('searchInput'), ul = document.getElementById('searchResults');
  m.hidden = false; inp.value = ''; ul.innerHTML = '<li class="muted" style="padding:10px">Start typing…</li>'; inp.focus();
  let sel = 0, res = [];
  const draw = () => {
    ul.innerHTML = res.length ? res.map((r, k) => `<li role="option" class="${k === sel ? 'sel' : ''}" aria-selected="${k === sel}"><a href="${link(r.href)}"><span>${esc(r.label)} <span class="s">${esc(r.sub)}</span></span><span class="k">${r.kind}</span></a></li>`).join('') : '<li class="muted" style="padding:10px">No matches</li>';
    const s = ul.querySelector('.sel'); if (s) s.scrollIntoView({ block: 'nearest' });
  };
  inp.oninput = () => { res = searchQuery(inp.value); sel = 0; draw(); };
  inp.onkeydown = ev => {
    if (ev.key === 'ArrowDown') { sel = Math.min(res.length - 1, sel + 1); draw(); ev.preventDefault(); }
    else if (ev.key === 'ArrowUp') { sel = Math.max(0, sel - 1); draw(); ev.preventDefault(); }
    else if (ev.key === 'Enter' && res[sel]) { location.hash = link(res[sel].href); closeSearch(); }
  };
  ul.onclick = ev => { if (ev.target.closest('a')) closeSearch(); };
}
function closeSearch() { document.getElementById('searchModal').hidden = true; }
