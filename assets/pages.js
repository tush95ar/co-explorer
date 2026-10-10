/* CO Explorer — pages & router */
'use strict';

/* ======================================================= Overview */
function pageOverview() {
  const rows = applyF(null);
  const city = kpis(rows);
  setCrumbs([]);
  if (!rows.length) return head('Citywide overview') + emptyState();
  const boroM = countBy(rows, C.boro); const boros = sortedEntries(boroM);
  const top = (kind, n = 10) => sortedEntries(countBy(rows, ENT[kind].col)).slice(0, n).map(([k, c]) => ({ html: entLink(kind, k), count: c, k }));
  const tB = sortedEntries(countBy(rows, C.b)).slice(0, 10).map(([b, c]) => ({ html: entLink('building', b, bldAddr(b)), extra: esc(DICT.boro[C.boro[BLD_ROW[b]]]), count: c }));
  const trendId = nid('c'), boroId = nid('c');

  onMount(() => {
    mountTrend(trendId, rows, { brush: true });
    makeChart(boroId, hbarOption(boros.map(b => DICT.boro[b[0]]), boros.map(b => b[1]), { tip: 'Click: open borough · Shift-click: filter' }), {
      onClick: p => go(entPath('borough', boros[revIdx(p, boros.length)][0])), onShift: p => crossFilter('boro', boros[revIdx(p, boros.length)][0]),
    });
  });
  const t = T();
  return `${head('Citywide overview', `NYC DOB NOW Certificates of Occupancy issued ${ymShort(monthRange()[0])} – ${ymShort(monthRange()[1])}`)}
    ${kpiTiles(city, { links: { cos: link('/explorer'), bld: link('/list/building'), jobs: link('/list/job'), units: link('/housing'), median: link('/processing'), renew: link('/renewals') } })}
    <div class="grid">
      ${chartCard({ id: trendId, title: 'Certificates issued per month', sub: `Stacked by job type. Drag across months to set the date range. ${ymShort(YM_MAX)} is partial (data ends ${fmtIss(META.issuedMax).slice(0, 10)}).`, span: 12, height: 300, legend: legendHtml(DICT.jtg.map((n, g) => [t.jt[g], n])), hint: 'Click a month: open in Explorer · Shift-click: filter to month · Drag: set date range', table: trendTable(rows) })}
      ${chartCard({ id: boroId, title: 'By borough', span: 4, height: 230, table: { head: ['Borough', 'COs', 'Share'], rows: boros.map(([k, c]) => [entLink('borough', k), fmt(c), pct(c, rows.length)]) } })}
      ${filingCard(nid('c'), rows, 4)}
      ${mixCard(nid('c'), rows, 'Job type', 4)}
      ${mapCard(nid('m'), rows, 12, 'Where certificates were issued')}
      ${card('Top neighborhoods', rankTable(top('nta')) + `<a class="note" href="${link('/list/nta')}">All neighborhoods →</a>`, 6)}
      ${card('Top streets', rankTable(top('street')) + `<a class="note" href="${link('/list/street')}">All streets →</a>`, 6, 'Spelling variants merged (5TH AVE = FIFTH AVENUE)')}
      ${card('Top ZIP codes', rankTable(top('zip')) + `<a class="note" href="${link('/list/zip')}">All ZIP codes →</a>`, 6)}
      ${card('Top buildings', rankTable(tB, { label: 'Building', extra: 'Borough' }) + `<a class="note" href="${link('/list/building')}">All buildings →</a>`, 6)}
    </div>`;
}

function head(title, sub = '', right = '') {
  return `<div class="page-head"><div><h1>${title}</h1>${sub ? `<div class="sub">${sub}</div>` : ''}</div>${right}</div>`;
}

/* ======================================================= Geography hubs */
const GEO_CHILDREN = {
  borough: [['cb', 'Community boards'], ['nta', 'Neighborhoods'], ['council', 'Council districts']],
  cb: [['nta', 'Neighborhoods'], ['zip', 'ZIP codes']],
  council: [['nta', 'Neighborhoods'], ['zip', 'ZIP codes']],
  zip: [['nta', 'Neighborhoods'], ['street', 'Streets']],
  nta: [['street', 'Streets'], ['zip', 'ZIP codes']],
};

function pageGeo(kind, key) {
  const k = ENT[kind].from(key);
  const all = k == null ? null : rowsOf(kind, k);
  if (!all || !all.length) return notFound(`${ENT[kind].one} “${key}”`);
  const rows = applyF(all, kind + ':' + k);
  const name = ENT[kind].name(k);
  const cityRows = applyF(null);
  const city = kpis(cityRows);
  const boro = modeOf(all, C.boro);

  // breadcrumb
  const chain = [];
  if (kind !== 'borough') chain.push({ label: DICT.boro[boro], href: entHref('borough', boro) });
  if (kind === 'nta') { const cb = modeOf(all, C.cb); if (cb >= 0) chain.push({ label: cbName(cb), href: entHref('cb', cb) }); }
  chain.push({ label: kind === 'cb' ? cbName(k) : name });
  setCrumbs(chain);

  const sub = kind === 'borough' ? 'Borough' : `${ENT[kind].one} in ${entLink('borough', boro)}`;
  const compareIds = kind === 'borough' ? DICT.boro.map((_, b) => DICT.boro[b]) : [ENT[kind].key(k), ...similar(kind, k, 3).map(x => ENT[kind].key(x.k))];
  const right = `<div class="toolbar" style="margin:0">
      <a class="btn" style="line-height:28px" href="${link('/compare', { kind, ids: compareIds.join('|') })}">${kind === 'borough' ? 'Compare all boroughs' : 'Compare with similar'}</a>
      <a class="btn" style="line-height:28px" href="${link('/explorer', { scope: `${kind}:${ENT[kind].key(k)}` })}">Open rows in Explorer</a></div>`;
  let html = head(esc(name), sub, right);
  if (!rows.length) return html + emptyState();
  const kk = kpis(rows);
  const scope = { scope: `${kind}:${ENT[kind].key(k)}` };
  html += kpiTiles(kk, { cmp: city, links: { cos: link('/explorer', scope), bld: link('/list/building', scope), jobs: link('/list/job', scope), units: link('/housing'), median: link('/processing', scope), renew: link('/renewals', scope) } });

  const t = T(); const trendId = nid('c');
  onMount(() => mountTrend(trendId, rows, { scopeExtra: scope }));
  html += `<div class="grid">
    ${chartCard({ id: trendId, title: 'Certificates per month', span: 12, height: 260, legend: legendHtml(DICT.jtg.map((n, g) => [t.jt[g], n])), hint: 'Click a month: open in Explorer · Shift-click: filter to month', table: trendTable(rows) })}
    ${mixCard(nid('c'), rows, 'Job type mix', 4)}
    ${filingCard(nid('c'), rows, 4)}
    ${unitsCard(nid('c'), rows, 4)}`;

  // children rankings
  const kids = GEO_CHILDREN[kind] || [];
  kids.forEach(([ck, label], n) => {
    const ent = sortedEntries(countBy(rows, ENT[ck].col));
    const id = nid('c'); const top = ent.slice(0, 15);
    const labels = top.map(([x]) => ck === 'cb' ? cbName(x) : ENT[ck].name(x));
    onMount(() => makeChart(id, hbarOption(labels, top.map(e => e[1])), {
      onClick: p => go(entPath(ck, top[revIdx(p, top.length)][0])),
      onShift: p => go(entPath(ck, top[revIdx(p, top.length)][0])),
    }));
    html += chartCard({
      id, title: `${label} ranked`, sub: `Top ${top.length} of ${ent.length}`, span: n === 0 ? 6 : 6, height: Math.max(200, top.length * 22 + 20), hint: 'Click a bar: open it',
      table: { head: [label, 'COs'], rows: ent.map(([x, c]) => [entLink(ck, x), fmt(c)]), num: [1] },
    });
  });
  html += mapCard(nid('m'), rows, kids.length % 2 ? 6 : 12, 'Map');
  if (kind === 'nta') html += procHistCard(nid('c'), rows, 6, scope);

  // top buildings + recent
  const tB = sortedEntries(countBy(rows, C.b)).slice(0, 10).map(([b, c]) => ({ html: entLink('building', b, bldAddr(b)), count: c }));
  const recent = Array.from(rows).sort((a, b) => C.iss[b] - C.iss[a]).slice(0, 12);
  html += card('Top buildings', rankTable(tB, { label: 'Building' }), 6);
  html += card('Most recent certificates', simpleTable(['Certificate', 'Issued', 'Building', 'Filing'], recent.map(i => [certLink(i), fmtIss(C.iss[i]).slice(0, 10), entLink('building', C.b[i], bldAddr(C.b[i])), esc(DICT.ft[C.ft[i]] || '—')])), 6);
  html += `</div>`;

  // similar neighborhoods (NTA)
  if (kind === 'nta') {
    const sim = similar('nta', k, 6);
    html += `<h2>Similar neighborhoods</h2><section class="card"><p class="note" style="margin-top:0">Nearest by certificate volume, job-type mix, filing-type mix and median processing time (all years, unfiltered).</p>
      ${simpleTable(['Neighborhood', 'Borough', 'COs', 'New building share', 'Renewal share', 'Median days'], sim.map(x => {
        const r = rowsOf('nta', x.k); const f = ntaFeatures().raw.get(x.k);
        return [entLink('nta', x.k), entLink('borough', modeOf(r, C.boro)), fmt(r.length), (f.nb * 100).toFixed(0) + '%', (f.ren * 100).toFixed(0) + '%', fmt1(f.med)];
      }), [2, 3, 4, 5])}</section>`;
  }

  // related
  const groups = [];
  if (kind !== 'borough') groups.push({ title: 'Parent', items: [{ html: entLink('borough', boro), count: rowsOf('borough', boro).length }] });
  else groups.push({ title: 'Other boroughs', items: DICT.boro.map((_, b) => b).filter(b => b !== k).map(b => ({ html: entLink('borough', b), count: rowsOf('borough', b).length })) });
  if (kind !== 'borough') {
    const sibs = sortedEntries(countBy(rowsOf('borough', boro), ENT[kind].col)).filter(([x]) => x !== k).slice(0, 8);
    groups.push({ title: `Other ${ENT[kind].many.toLowerCase()} in ${DICT.boro[boro]}`, items: sibs.map(([x, c]) => ({ html: entLink(kind, x), count: c })), more: link('/list/' + kind, { boro: DICT.boro[boro] }) });
  }
  for (const ok of ['cb', 'council', 'zip', 'nta']) if (ok !== kind) groups.push({ title: `Overlapping ${ENT[ok].many.toLowerCase()}`, items: overlap(all, ok, 8) });
  html += relatedPanel(groups);
  return html;
}

// Feature vectors for nearest-neighbor similarity
let _ntaF = null;
function ntaFeatures() {
  if (_ntaF) return _ntaF;
  const raw = new Map();
  for (const [k, r] of index('nta')) {
    let nb = 0, alt = 0, ren = 0, fin = 0;
    for (const i of r) { if (C.jtg[i] === 0) nb++; else if (C.jtg[i] === 1) alt++; if (C.ft[i] >= 2) ren++; if (C.ft[i] === 1) fin++; }
    raw.set(k, { n: Math.log10(r.length), nb: nb / r.length, alt: alt / r.length, ren: ren / r.length, fin: fin / r.length, med: median(r) || 0 });
  }
  const keys = ['n', 'nb', 'alt', 'ren', 'fin', 'med'];
  const stats = keys.map(f => { const v = [...raw.values()].map(x => x[f]); const m = v.reduce((a, b) => a + b, 0) / v.length; const sd = Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / v.length) || 1; return [m, sd]; });
  const z = new Map(); for (const [k, x] of raw) z.set(k, keys.map((f, j) => (x[f] - stats[j][0]) / stats[j][1]));
  return (_ntaF = { raw, z });
}
function genericFeatures(kind) {
  const z = new Map();
  for (const [k, r] of index(kind)) {
    let nb = 0, ren = 0; for (const i of r) { if (C.jtg[i] === 0) nb++; if (C.ft[i] >= 2) ren++; }
    z.set(k, [Math.log10(r.length) * 2, nb / r.length * 3, ren / r.length * 3]);
  }
  return z;
}
function similar(kind, k, n) {
  const z = kind === 'nta' ? ntaFeatures().z : genericFeatures(kind);
  const me = z.get(k); if (!me) return [];
  const out = []; for (const [x, v] of z) if (x !== k) out.push({ k: x, d: v.reduce((a, b, j) => a + (b - me[j]) ** 2, 0) });
  return out.sort((a, b) => a.d - b.d).slice(0, n);
}

/* ======================================================= Street */
function pageStreet(key) {
  const k = ENT.street.from(key); const all = k == null ? null : rowsOf('street', k);
  if (!all || !all.length) return notFound(`Street “${key}”`);
  const rows = applyF(all, 'street:' + k);
  setCrumbs([{ label: 'Streets', href: link('/list/street') }, { label: DICT.stDisplay[k] }]);
  const scope = { scope: `street:${DICT.stNorm[k]}` };
  const boros = sortedEntries(countBy(all, C.boro)).map(([b]) => entLink('borough', b)).join(', ');
  let html = head(esc(DICT.stDisplay[k]), `Street in ${boros} · normalized key <code>${esc(DICT.stNorm[k])}</code>`,
    `<a class="btn" style="line-height:28px" href="${link('/explorer', scope)}">Open rows in Explorer</a>`);
  if (!rows.length) return html + emptyState();
  html += kpiTiles(kpis(rows), { links: { cos: link('/explorer', scope) } });
  const t = T(); const trendId = nid('c'), boId = nid('c');
  const bo = sortedEntries(countBy(rows, C.boro));
  onMount(() => {
    mountTrend(trendId, rows, { scopeExtra: scope });
    makeChart(boId, hbarOption(bo.map(x => DICT.boro[x[0]]), bo.map(x => x[1])), { onClick: p => go(entPath('borough', bo[revIdx(p, bo.length)][0])), onShift: p => crossFilter('boro', bo[revIdx(p, bo.length)][0]) });
  });
  const blds = sortedEntries(countBy(rows, C.b));
  const spell = Object.entries(META.streetAliases[DICT.stNorm[k]] || {}).sort((a, b) => b[1] - a[1]);
  html += `<div class="grid">
    ${chartCard({ id: trendId, title: 'Certificates per month', span: 8, height: 240, legend: legendHtml(DICT.jtg.map((n, g) => [t.jt[g], n])), table: trendTable(rows) })}
    ${chartCard({ id: boId, title: 'By borough', span: 4, height: 240, table: { head: ['Borough', 'COs'], rows: bo.map(([b, c]) => [entLink('borough', b), fmt(c)]), num: [1] } })}
    ${mapCard(nid('m'), rows, 7, 'Buildings on this street')}
    ${card(`All buildings (${fmt(blds.length)})`, `<div class="alt-table" style="max-height:380px">${simpleTable(['Building', 'Borough', 'NTA', 'COs'], blds.map(([b, c]) => [entLink('building', b, bldAddr(b)), esc(DICT.boro[C.boro[BLD_ROW[b]]]), entLink('nta', BLD.nta[b]), fmt(c)]), [3])}</div>`, 5)}
    </div>`;
  html += relatedPanel([
    { title: 'Spellings in source data', items: spell.map(([s, c]) => ({ html: esc(s), count: c })), max: 12 },
    { title: 'Neighborhoods along it', items: overlap(all, 'nta') },
    { title: 'ZIP codes', items: overlap(all, 'zip') },
    { title: 'Community boards', items: overlap(all, 'cb') },
  ]);
  return html;
}

/* ======================================================= Lot */
function pageLot(key) {
  const k = ENT.lot.from(key); const all = k == null ? null : rowsOf('lot', k);
  if (!all || !all.length) return notFound(`Tax lot “${key}”`);
  const rows = applyF(all, 'lot:' + k);
  const bbl = DICT.bbl[k]; const lotNo = +bbl.slice(6); const condo = lotNo >= 7501 && lotNo <= 7599;
  setCrumbs([...geoChainForRows(all), { label: 'BBL ' + bbl }]);
  const boro = modeOf(all, C.boro);
  let html = head('BBL ' + esc(bbl), `${condo ? '<span class="tag">Condominium billing lot</span>' : '<span class="tag">Tax lot</span>'} Borough ${entLink('borough', boro)} · Block ${+bbl.slice(1, 6)} · Lot ${lotNo}`);
  if (!rows.length) return html + emptyState();
  html += kpiTiles(kpis(rows), { links: { cos: link('/explorer', { scope: 'lot:' + bbl }) } });
  const blds = sortedEntries(countBy(rows, C.b));
  // Condo unit lots: distinct tax-lot numbers recorded on the COs billed to this BBL
  const unitLots = new Map(); for (const i of rows) { const kk = `${C.block[i]}/${C.lot[i]}`; unitLots.set(kk, (unitLots.get(kk) || 0) + 1); }
  // Other condo billing lots on the same block
  const blockPrefix = bbl.slice(0, 6);
  const sameBlock = DICT.bbl.map((s, x) => [s, x]).filter(([s, x]) => x !== k && s.startsWith(blockPrefix)).map(([s, x]) => ({ html: entLink('lot', x), count: rowsOf('lot', x).length }));
  html += `<div class="grid">
    ${card(`Buildings on this lot (${blds.length})`, simpleTable(['Building', 'BIN', 'COs'], blds.map(([b, c]) => [entLink('building', b, bldAddr(b)), String(BLD.bin[b]), fmt(c)]), [2]), 6)}
    ${card(condo ? 'Condo unit lots grouped under this billing BBL' : 'Block / lot as recorded on COs', simpleTable(['Block / lot', 'COs'], [...unitLots.entries()].sort((a, b) => b[1] - a[1]).map(([s, c]) => [esc(s), fmt(c)]), [1]), 6)}
    ${mapCard(nid('m'), rows, 6, 'Location')}
    ${card('Certificates', `<div class="alt-table" style="max-height:300px">${simpleTable(['Certificate', 'Issued', 'Filing', 'Units'], Array.from(rows).sort((a, b) => C.iss[b] - C.iss[a]).map(i => [certLink(i), fmtIss(C.iss[i]).slice(0, 10), esc(DICT.ft[C.ft[i]] || '—'), C.units[i] < 0 ? '—' : fmt(C.units[i])]), [3])}</div>`, 6)}
  </div>`;
  html += relatedPanel([
    { title: 'Other lots on the same block', items: sameBlock, max: 10 },
    { title: 'Neighborhood', items: overlap(all, 'nta') },
    { title: 'Community board', items: overlap(all, 'cb') },
    { title: 'ZIP', items: overlap(all, 'zip') },
  ]);
  return html;
}

/* ======================================================= Building */
function timelineOption(rows, onTipHint = 'Click: open certificate') {
  const t = T(); const o = baseOpt(t);
  o.grid.left = 16; o.grid.right = 24;
  o.tooltip.trigger = 'item';
  o.tooltip.formatter = p => { const i = p.data.i; return ttBox(certKey(i), [`${fmtIss(C.iss[i])}`, `${DICT.ft[C.ft[i]] || '—'} · ${DICT.jtg[C.jtg[i]]}`, `Units: ${C.units[i] < 0 ? '—' : fmt(C.units[i])}`, `Job ${DICT.job[C.job[i]]}`], onTipHint); };
  o.xAxis = { type: 'time', axisLine: { lineStyle: { color: t.border } }, axisLabel: { color: t.t3 }, splitLine: { show: true, lineStyle: { color: t.grid } } };
  o.yAxis = axisCat(t, DICT.ft, { inverse: true });
  o.series = DICT.ft.map((f, g) => ({
    name: f, type: 'scatter', symbolSize: 11,
    itemStyle: { color: t.ft[g], borderColor: t.surface, borderWidth: 1.5 },
    data: Array.from(rows).filter(i => C.ft[i] === g).map(i => ({ value: [issMs(C.iss[i]), g], i })),
  }));
  return o;
}
function pageBuilding(key) {
  const b = ENT.building.from(key); const all = b == null ? null : rowsOf('building', b);
  if (!all || !all.length) return notFound(`Building BIN ${key}`);
  const rows = applyF(all, 'b:' + b);
  const i0 = BLD_ROW[b];
  setCrumbs([...geoChainForRows(all), { label: bldAddr(b) }]);
  const addr = bldAddr(b);
  let html = head(esc(addr), `${entLink('borough', C.boro[i0])} · BIN ${BLD.bin[b]} · ${entLink('street', C.stn[i0], 'Street: ' + DICT.stDisplay[C.stn[i0]])}`,
    `<div class="toolbar" style="margin:0"><a class="btn" style="line-height:28px" href="${link('/compare', { kind: 'building', ids: String(BLD.bin[b]) })}">Compare…</a><a class="btn" style="line-height:28px" href="${link('/explorer', { scope: 'building:' + BLD.bin[b] })}">Open rows in Explorer</a></div>`);
  const filteredNote = rows.length < all.length ? `<p class="callout">Showing ${fmt(rows.length)} of ${fmt(all.length)} certificates at this building because global filters are active. <button class="linkbtn" data-reset>Clear filters</button></p>` : '';
  html += filteredNote;
  const k = kpis(rows.length ? rows : all);
  const t = T();
  const unitsSeries = Array.from(all).filter(i => C.units[i] >= 0).sort((a, c) => C.iss[a] - C.iss[c]);
  const facts = `<dl class="facts">
    <dt>BIN</dt><dd>${BLD.bin[b]}</dd>
    <dt>Tax lot</dt><dd>${C.bbl[i0] >= 0 ? entLink('lot', C.bbl[i0]) : '—'} · block ${C.block[i0]}, lot ${C.lot[i0]}</dd>
    <dt>Neighborhood</dt><dd>${entLink('nta', BLD.nta[b])}</dd>
    <dt>Community board</dt><dd>${entLink('cb', C.cb[i0])}</dd>
    <dt>Council district</dt><dd>${entLink('council', BLD.cd[b])}</dd>
    <dt>ZIP</dt><dd>${entLink('zip', C.zip[i0])}</dd>
    <dt>Census tract</dt><dd>${BLD.tract[b] >= 0 ? esc(DICT.tract[BLD.tract[b]]) : '—'}</dd>
    <dt>Coordinates</dt><dd>${BLD.lat[b] != null ? `${BLD.lat[b].toFixed(5)}, ${BLD.lng[b].toFixed(5)}` : '—'}</dd>
    <dt>Latest units</dt><dd>${unitsSeries.length ? fmt(C.units[unitsSeries[unitsSeries.length - 1]]) : '—'}</dd>
    <dt>First / last CO</dt><dd>${fmtIss(Math.min(...Array.from(all, i => C.iss[i]))).slice(0, 10)} → ${fmtIss(C.iss[i0]).slice(0, 10)}</dd>
  </dl>`;
  html += kpiTiles(k);
  const tlId = nid('c'), uId = nid('c');
  const tlRows = rows.length ? rows : all;
  onMount(() => {
    makeChart(tlId, timelineOption(tlRows), { onClick: p => go('/co/' + certKey(p.data.i)) });
    if (unitsSeries.length) {
      const o = baseOpt(t); o.tooltip.trigger = 'axis';
      o.tooltip.formatter = ps => { const i = unitsSeries[ps[0].dataIndex]; return ttBox(fmtIss(C.iss[i]).slice(0, 10), [`Units: <b>${fmt(C.units[i])}</b>`, `${certKey(i)} · ${DICT.ft[C.ft[i]] || '—'}`], 'Click: open certificate'); };
      o.xAxis = { type: 'time', axisLabel: { color: t.t3 }, axisLine: { lineStyle: { color: t.border } } };
      o.yAxis = axisVal(t, { minInterval: 1 });
      o.series = [{ type: 'line', step: 'end', data: unitsSeries.map(i => [issMs(C.iss[i]), C.units[i]]), lineStyle: { width: 2, color: t.seq }, itemStyle: { color: t.seq }, symbolSize: 8 }];
      makeChart(uId, o, { onClick: p => go('/co/' + certKey(unitsSeries[p.dataIndex])) });
    }
  });
  const jobs = sortedEntries(countBy(all, C.job));
  const blockNeighbors = [];
  const bo = C.boro[i0], blk = C.block[i0];
  for (const [bb, r] of index('building')) { if (bb === b) continue; const j = BLD_ROW[bb]; if (C.boro[j] === bo && C.block[j] === blk) blockNeighbors.push({ html: entLink('building', bb, bldAddr(bb)), count: r.length }); }
  html += `<div class="grid">
    ${card('Building facts', facts, 5)}
    ${mapCard(nid('m'), all, 7, 'Location', b)}
    ${chartCard({ id: tlId, title: 'Certificate timeline', sub: 'Initial → renewals → final', span: 12, height: 220, legend: legendHtml(DICT.ft.map((n, g) => [t.ft[g], n])), hint: 'Click a dot: open certificate', table: { head: ['Certificate', 'Issued', 'Filing type', 'Job'], rows: Array.from(tlRows).sort((a, c) => C.iss[a] - C.iss[c]).map(i => [certLink(i), fmtIss(C.iss[i]), esc(DICT.ft[C.ft[i]] || '—'), entLink('job', C.job[i], DICT.job[C.job[i]])]) } })}
    ${unitsSeries.length ? chartCard({ id: uId, title: 'Dwelling units over time', sub: 'As stated on each certificate', span: 6, height: 220, hint: 'Click a point: open certificate', table: { head: ['Issued', 'Units', 'Certificate'], rows: unitsSeries.map(i => [fmtIss(C.iss[i]).slice(0, 10), fmt(C.units[i]), certLink(i)]), num: [1] } }) : card('Dwelling units over time', '<p class="muted">No certificate at this building reports a unit count.</p>', 6)}
    ${card(`Jobs at this building (${jobs.length})`, simpleTable(['Job', 'Job type', 'COs', 'Latest'], jobs.map(([j, c]) => { const r = rowsOf('job', j); const last = r.reduce((a, x) => (C.iss[x] > C.iss[a] ? x : a), r[0]); return [entLink('job', j, DICT.job[j]), esc(DICT.jtr[C.jtr[last]]), fmt(c), fmtIss(C.iss[last]).slice(0, 10)]; }), [2]), 6)}
    ${card(`All certificates (${fmt(all.length)})`, `<div class="alt-table" style="max-height:340px">${simpleTable(['Certificate', 'CO number', 'Issued', 'Filing', 'Days', 'Units'], Array.from(all).sort((a, c) => C.iss[c] - C.iss[a]).map(i => [certLink(i), esc(coNumber(i)), fmtIss(C.iss[i]).slice(0, 10), esc(DICT.ft[C.ft[i]] || '—'), C.proc[i] === NOPROC ? '—' : fmt(C.proc[i]), C.units[i] < 0 ? '—' : fmt(C.units[i])]), [4, 5])}</div>`, 12)}
  </div>`;
  html += relatedPanel([
    { title: `Neighbors on block ${blk}`, items: blockNeighbors.sort((a, c) => c.count - a.count), max: 10 },
    { title: 'Same street', items: sortedEntries(countBy(rowsOf('street', C.stn[i0]), C.b)).filter(([x]) => x !== b && C.boro[BLD_ROW[x]] === bo).slice(0, 8).map(([x, c]) => ({ html: entLink('building', x, bldAddr(x)), count: c })), more: entHref('street', C.stn[i0]) },
    { title: 'Places', items: [{ html: entLink('nta', BLD.nta[b]) }, { html: entLink('cb', C.cb[i0]) }, { html: entLink('council', BLD.cd[b]) }, { html: entLink('zip', C.zip[i0]) }, { html: entLink('borough', bo) }] },
  ]);
  return html;
}

/* ======================================================= Job */
function pageJob(key) {
  const k = ENT.job.from(key); const all = k == null ? null : rowsOf('job', k);
  if (!all || !all.length) return notFound(`Job “${key}”`);
  const sorted = Array.from(all).sort((a, b) => C.iss[a] - C.iss[b]);
  const i0 = sorted[sorted.length - 1]; const b = C.b[i0];
  setCrumbs([...geoChainForRows(all), { label: bldAddr(b), href: entHref('building', b) }, { label: 'Job ' + DICT.job[k] }]);
  const bins = sortedEntries(countBy(all, C.b));
  let html = head('Job ' + esc(DICT.job[k]), `<span class="tag">${esc(DICT.jtr[C.jtr[i0]])}</span> at ${bins.map(([x]) => entLink('building', x, bldAddrFull(x))).join(', ')}`);
  const t = T(); const tl = nid('c'), pd = nid('c');
  onMount(() => {
    makeChart(tl, timelineOption(sorted), { onClick: p => go('/co/' + certKey(p.data.i)) });
    const o = vbarOption(sorted.map(certKey), sorted.map(i => (C.proc[i] === NOPROC ? 0 : C.proc[i])), { valueName: 'Days', tip: 'Click: open certificate', colors: sorted.map(i => t.ft[C.ft[i]] || t.t3) });
    o.series[0].label.show = sorted.length <= 12;
    o.xAxis.axisLabel.rotate = sorted.length > 6 ? 40 : 0;
    makeChart(pd, o, { onClick: p => go('/co/' + certKey(sorted[p.dataIndex])) });
  });
  const gaps = []; for (let j = 1; j < sorted.length; j++) gaps.push(C.day[sorted[j]] - C.day[sorted[j - 1]]);
  const kp = kpis(all);
  html += `<div class="kpis">
    <div class="kpi"><div class="lbl">Certificates</div><div class="val">${fmt(all.length)}</div></div>
    <div class="kpi"><div class="lbl">First → last</div><div class="val" style="font-size:16px">${fmtIss(C.iss[sorted[0]]).slice(0, 10)} → ${fmtIss(C.iss[i0]).slice(0, 10)}</div></div>
    <div class="kpi"><div class="lbl">Median days between COs</div><div class="val">${gaps.length ? fmt1(quantile(Float64Array.from(gaps).sort(), 0.5)) : '—'}</div></div>
    <div class="kpi"><div class="lbl">Median processing</div><div class="val">${fmt1(kp.median)} d</div></div>
    <div class="kpi"><div class="lbl">Has final CO</div><div class="val">${sorted.some(i => C.ft[i] === 1) ? 'Yes' : 'No'}</div></div>
  </div>`;
  html += `<div class="grid">
    ${chartCard({ id: tl, title: 'Filing sequence', span: 12, height: 200, legend: legendHtml(DICT.ft.map((n, g) => [t.ft[g], n])), hint: 'Click a dot: open certificate', table: { head: ['#', 'Certificate', 'Issued', 'Filing type'], rows: sorted.map((i, n) => [String(n + 1), certLink(i), fmtIss(C.iss[i]), esc(DICT.ft[C.ft[i]] || '—')]) } })}
    ${chartCard({ id: pd, title: 'Processing days per certificate', sub: 'Submitted → issued, colored by filing type', span: 12, height: 240, hint: 'Click a bar: open certificate', table: { head: ['Certificate', 'Days'], rows: sorted.map(i => [certLink(i), C.proc[i] === NOPROC ? '—' : fmt(C.proc[i])]), num: [1] } })}
    ${card('Certificates', simpleTable(['#', 'Certificate', 'CO number', 'Submitted', 'Issued', 'Filing', 'Days', 'Units'], sorted.map((i, n) => [String(n + 1), certLink(i), esc(coNumber(i)), fmtDay(C.sub[i]), fmtIss(C.iss[i]), esc(DICT.ft[C.ft[i]] || '—'), C.proc[i] === NOPROC ? '—' : fmt(C.proc[i]), C.units[i] < 0 ? '—' : fmt(C.units[i])]), [6, 7]), 12)}
  </div>`;
  html += relatedPanel([
    { title: 'Building', items: bins.map(([x, c]) => ({ html: entLink('building', x, bldAddr(x)), count: c })) },
    { title: 'Other jobs at this building', items: sortedEntries(countBy(rowsOf('building', b), C.job)).filter(([x]) => x !== k).map(([x, c]) => ({ html: entLink('job', x, 'Job ' + DICT.job[x]), count: c })) },
    { title: 'Places', items: [{ html: entLink('nta', C.nta[i0]) }, { html: entLink('cb', C.cb[i0]) }, { html: entLink('zip', C.zip[i0]) }, { html: entLink('borough', C.boro[i0]) }] },
  ]);
  return html;
}

/* ======================================================= Certificate */
function pageCert(key) {
  const i = CERT_IDX.get(key);
  if (i == null) return notFound(`Certificate “${key}”`);
  const b = C.b[i];
  setCrumbs([...geoChainForRows([i]), { label: bldAddr(b), href: entHref('building', b) }, { label: 'Job ' + DICT.job[C.job[i]], href: entHref('job', C.job[i]) }, { label: certKey(i) }]);
  const reused = META.reusedApplicationNumbers.includes(certKey(i).slice(0, 12));
  const siblings = Array.from(rowsOf('building', b)).sort((a, c) => C.iss[a] - C.iss[c]);
  const pos = siblings.indexOf(i);
  const nav = `<div class="toolbar" style="margin:0">
    ${pos > 0 ? `<a class="btn" style="line-height:28px" href="${certHref(siblings[pos - 1])}">← Previous at building</a>` : ''}
    ${pos < siblings.length - 1 ? `<a class="btn" style="line-height:28px" href="${certHref(siblings[pos + 1])}">Next at building →</a>` : ''}</div>`;
  const f = (l, v) => `<dt>${esc(l)}</dt><dd>${v}</dd>`;
  const raw = `<dl class="facts">
    ${f('Application number', `${certKey(i)}${reused ? ' <span class="tag">application number shared with another certificate</span>' : ''}`)}
    ${f('C of O number', esc(coNumber(i)))}
    ${f('C of O sequence #', fmt(seqNo(i)))}
    ${f('C of O status', 'CO Issued')}
    ${f('C of O filing type', C.ft[i] >= 0 ? `<a href="${link('/explorer', {}, { ...F, ft: C.ft[i] })}">${esc(DICT.ft[C.ft[i]])}</a>` : '—')}
    ${f('C of O issuance date', fmtIss(C.iss[i]))}
    ${f('Submitted date', fmtDay(C.sub[i]))}
    ${f('Processing days', C.proc[i] === NOPROC ? '—' : `<a href="${link('/processing')}">${fmt(C.proc[i])}</a>`)}
    ${f('Job filing name', entLink('job', C.job[i], DICT.job[C.job[i]]))}
    ${f('Job type', `${esc(DICT.jtr[C.jtr[i]])} <span class="muted">→</span> <a href="${link('/explorer', {}, { ...F, type: C.jtg[i] })}">${esc(DICT.jtg[C.jtg[i]])}</a>`)}
    ${f('BIN', entLink('building', b, String(BLD.bin[b])))}
    ${f('Address', `${esc(DICT.house[C.house[i]])} ${entLink('street', C.stn[i], DICT.st[C.st[i]])}`)}
    ${f('Borough', entLink('borough', C.boro[i]))}
    ${f('Block / lot', `${C.block[i]} / ${C.lot[i] >= 0 ? C.lot[i] : '—'}`)}
    ${f('BBL', C.bbl[i] >= 0 ? entLink('lot', C.bbl[i], DICT.bbl[C.bbl[i]]) : '—')}
    ${f('ZIP code', entLink('zip', C.zip[i], DICT.zip[C.zip[i]]))}
    ${f('Community board', entLink('cb', C.cb[i]))}
    ${f('Council district', entLink('council', C.cd[i]))}
    ${f('NTA', entLink('nta', C.nta[i]))}
    ${f('Census tract', BLD.tract[b] >= 0 ? esc(DICT.tract[BLD.tract[b]]) : '—')}
    ${f('Dwelling units', C.units[i] < 0 ? '<span class="muted">not reported</span>' : `<a href="${link('/explorer', {}, { ...F, units: C.ub[i] })}">${fmt(C.units[i])}</a>`)}
    ${f('Latitude / longitude', BLD.lat[b] != null ? `${BLD.lat[b].toFixed(5)}, ${BLD.lng[b].toFixed(5)}` : '—')}
  </dl>`;
  let html = head(certKey(i), `${esc(DICT.ft[C.ft[i]] || 'Certificate')} · issued ${fmtIss(C.iss[i]).slice(0, 10)} · ${entLink('building', b, bldAddrFull(b))}`, nav);
  html += `<div class="grid">${card('All fields', raw, 7)}${mapCard(nid('m'), [i], 5, 'Location', b)}</div>`;
  const others = META.reusedApplicationNumbers.includes(certKey(i).slice(0, 12)) ? [...CERT_IDX.entries()].filter(([kk, x]) => kk.startsWith(certKey(i).slice(0, 12)) && x !== i).map(([, x]) => ({ html: certLink(x) + ' · ' + esc(bldAddrFull(C.b[x])) })) : [];
  html += relatedPanel([
    { title: 'Same job', items: Array.from(rowsOf('job', C.job[i])).filter(x => x !== i).sort((a, c) => C.iss[c] - C.iss[a]).map(x => ({ html: `${certLink(x)} <span class="muted">${esc(DICT.ft[C.ft[x]] || '')}</span>` })), more: entHref('job', C.job[i]) },
    { title: 'Same building', items: siblings.filter(x => x !== i).reverse().map(x => ({ html: `${certLink(x)} <span class="muted">${fmtIss(C.iss[x]).slice(0, 10)}</span>` })), more: entHref('building', b) },
    { title: 'Shares this application number', items: others },
    { title: 'Places', items: [{ html: entLink('nta', C.nta[i]) }, { html: entLink('cb', C.cb[i]) }, { html: entLink('council', C.cd[i]) }, { html: entLink('zip', C.zip[i]) }, { html: entLink('street', C.stn[i]) }] },
  ]);
  return html;
}

/* ======================================================= Scoped rows (for analysis pages & explorer) */
function scopeRows(scope) {
  if (!scope) return { rows: null, label: '', key: 'all' };
  const [kind, ...rest] = scope.split(':'); const key = rest.join(':');
  if (!ENT[kind]) return { rows: null, label: '', key: 'all' };
  const k = ENT[kind].from(key); if (k == null) return { rows: new Int32Array(0), label: key, key: scope };
  return { rows: rowsOf(kind, k), label: ENT[kind].name(k), href: entHref(kind, k), key: scope, kind, k };
}
function scopeBanner(sc, path) {
  if (!sc.label) return '';
  return `<p class="callout">Scoped to <a href="${sc.href}">${esc(sc.label)}</a>. <a href="${link(path)}">Show citywide</a></p>`;
}

/* ======================================================= Processing Time Lab */
function pageProcessing() {
  const sc = scopeRows(ROUTE.q.scope);
  setCrumbs([...(sc.label ? [{ label: sc.label, href: sc.href }] : []), { label: 'Processing time' }]);
  const rows = applyF(sc.rows, sc.key);
  let html = head('Processing Time Lab', 'Days from submission to issuance (issuance date − submitted date)') + scopeBanner(sc, '/processing');
  if (!rows.length) return html + emptyState();
  const v = procValues(rows);
  const zero = v.filter(x => x === 0).length, neg = v.filter(x => x < 0).length;
  html += `<div class="kpis">
    <div class="kpi"><div class="lbl">Median</div><div class="val">${fmt1(quantile(v, .5))} d</div></div>
    <div class="kpi"><div class="lbl">Mean</div><div class="val">${fmt1(v.reduce((a, b) => a + b, 0) / v.length)} d</div></div>
    <div class="kpi"><div class="lbl">75th / 95th percentile</div><div class="val">${fmt1(quantile(v, .75))} / ${fmt1(quantile(v, .95))}</div></div>
    <div class="kpi"><div class="lbl">Same-day issuance</div><div class="val">${pct(zero, v.length)}</div><div class="cmp">${fmt(zero)} COs</div></div>
    <div class="kpi"><div class="lbl">Negative (flagged)</div><div class="val">${fmt(neg)}</div></div>
  </div>`;
  const t = T();
  const boxCard = (title, groups, labels, onPick, span = 6) => {
    const id = nid('c');
    const stats = groups.map(g => { const s = procValues(g); return s.length ? [quantile(s, .05), quantile(s, .25), quantile(s, .5), quantile(s, .75), quantile(s, .95)] : [0, 0, 0, 0, 0]; });
    const ns = groups.map(g => g.length);
    onMount(() => {
      const o = baseOpt(t); o.tooltip.trigger = 'item';
      o.tooltip.formatter = p => ttBox(labels[p.dataIndex], [`n = ${fmt(ns[p.dataIndex])}`, `p5 ${fmt1(stats[p.dataIndex][0])} · p25 ${fmt1(stats[p.dataIndex][1])}`, `median <b>${fmt1(stats[p.dataIndex][2])}</b>`, `p75 ${fmt1(stats[p.dataIndex][3])} · p95 ${fmt1(stats[p.dataIndex][4])}`], 'Click: filter to this group');
      o.xAxis = axisCat(t, labels, { axisLabel: { color: t.t2, interval: 0, width: 90, overflow: 'truncate' } });
      o.yAxis = axisVal(t, { name: 'days', nameTextStyle: { color: t.t3 } });
      o.series = [{ type: 'boxplot', data: stats, itemStyle: { color: t.seqLo, borderColor: t.seq, borderWidth: 1.5 }, boxWidth: [8, 36] }];
      makeChart(id, o, { onClick: p => onPick(p.dataIndex), onShift: p => onPick(p.dataIndex) });
    });
    return chartCard({ id, title, sub: 'Box = 25th–75th percentile, whiskers = 5th–95th', span, height: 240, hint: 'Click: filter to group', table: { head: ['Group', 'n', 'p5', 'p25', 'Median', 'p75', 'p95'], rows: stats.map((s, k) => [esc(labels[k]), fmt(ns[k]), ...s.map(fmt1)]), num: [1, 2, 3, 4, 5, 6] } });
  };
  const groupBy = (col, keys) => keys.map(k => { const a = []; for (const i of rows) if (col[i] === k) a.push(i); return a; });
  const years = [...new Set(Array.from(rows, i => C.year[i]))].filter(y => y > 0).sort();
  html += `<div class="grid">
    ${boxCard('By borough', groupBy(C.boro, [0, 1, 2, 3, 4]), DICT.boro, k => crossFilter('boro', k))}
    ${boxCard('By job type', groupBy(C.jtg, [0, 1, 2]), DICT.jtg, k => crossFilter('type', k))}
    ${boxCard('By filing type', groupBy(C.ft, [0, 1, 2, 3]), DICT.ft, k => crossFilter('ft', k))}
    ${boxCard('By issuance year', groupBy(C.year, years), years.map(String), k => setFilters({ ...F, from: years[k] * 12, to: years[k] * 12 + 11 }))}
    ${procHistCard(nid('c'), rows, 6)}`;
  // weekday × hour heatmap
  const hm = nid('c'); const cells = new Map(); let mx = 0;
  for (const i of rows) { if (C.wd[i] < 0) continue; const kk = C.wd[i] * 24 + C.hr[i]; const c = (cells.get(kk) || 0) + 1; cells.set(kk, c); if (c > mx) mx = c; }
  const hours = Array.from({ length: 24 }, (_, h) => h);
  onMount(() => {
    const o = baseOpt(t); o.grid.top = 8; o.grid.bottom = 44;
    o.tooltip.trigger = 'item'; o.tooltip.formatter = p => ttBox(`${WEEKDAYS[p.data[1]]} ${String(p.data[0]).padStart(2, '0')}:00`, [`${fmt(p.data[2])} COs issued`], '');
    o.xAxis = axisCat(t, hours.map(h => String(h).padStart(2, '0')), { splitArea: { show: false } });
    o.yAxis = axisCat(t, WEEKDAYS, { inverse: true });
    o.visualMap = { min: 0, max: mx, orient: 'horizontal', left: 'center', bottom: 0, itemHeight: 120, itemWidth: 10, calculable: false, inRange: { color: [t.surface, t.seqLo, t.seq, t.seqHi] }, textStyle: { color: t.t3 } };
    o.series = [{ type: 'heatmap', data: [...cells.entries()].map(([kk, c]) => [kk % 24, Math.floor(kk / 24), c]), itemStyle: { borderColor: t.surface, borderWidth: 1 } }];
    makeChart(hm, o);
  });
  html += chartCard({ id: hm, title: 'When certificates are issued', sub: 'Weekday × hour of issuance timestamp', span: 6, height: 260, hint: '', table: { head: ['Weekday', ...hours.map(String)], rows: WEEKDAYS.map((w, d) => [w, ...hours.map(h => fmt(cells.get(d * 24 + h) || 0))]) } });
  html += `</div>`;
  const longest = Array.from(rows).filter(i => C.proc[i] !== NOPROC).sort((a, b) => C.proc[b] - C.proc[a]).slice(0, 50);
  html += `<h2>Outliers — longest processing</h2>` + card('Top 50 longest', simpleTable(['Certificate', 'Building', 'Job type', 'Filing', 'Submitted', 'Issued', 'Days'], longest.map(i => [certLink(i), entLink('building', C.b[i], bldAddrFull(C.b[i])), esc(DICT.jtg[C.jtg[i]]), esc(DICT.ft[C.ft[i]] || '—'), fmtDay(C.sub[i]), fmtIss(C.iss[i]).slice(0, 10), fmt(C.proc[i])]), [6]), 12);
  return html;
}

/* ======================================================= Renewal patterns */
function pageRenewals() {
  const sc = scopeRows(ROUTE.q.scope);
  setCrumbs([...(sc.label ? [{ label: sc.label, href: sc.href }] : []), { label: 'Renewal patterns' }]);
  const rows = applyF(sc.rows, sc.key, F, ['ft']);
  let html = head('Renewal patterns', 'How certificates progress within a job: Initial → renewals → Final. (Filing-type filter is ignored on this page.)') + scopeBanner(sc, '/renewals');
  if (!rows.length) return html + emptyState();
  const byJob = new Map();
  for (const i of rows) { let a = byJob.get(C.job[i]); if (!a) byJob.set(C.job[i], a = []); a.push(i); }
  const STEPS = 6; const links = new Map(); const nodes = new Set();
  const perJob = []; let reachedFinal = 0, startInitial = 0;
  const ftShort = ['Initial', 'Final', 'Renewal w/ change', 'Renewal w/o change'];
  const nodeName = (s, f) => `${s < STEPS - 1 ? s + 1 : STEPS + '+'}. ${f < 0 ? 'Unknown' : ftShort[f]}`;
  for (const [j, a] of byJob) {
    a.sort((x, y) => C.iss[x] - C.iss[y]);
    perJob.push([j, a]);
    if (a.some(i => C.ft[i] === 1)) reachedFinal++;
    if (C.ft[a[0]] === 0) startInitial++;
    for (let s = 0; s + 1 < a.length && s + 1 < STEPS; s++) {
      const src = nodeName(s, C.ft[a[s]]), dst = nodeName(s + 1, C.ft[a[s + 1]]);
      nodes.add(src); nodes.add(dst); const kk = src + '\u0000' + dst; links.set(kk, (links.get(kk) || 0) + 1);
    }
  }
  const lens = perJob.map(([, a]) => a.length);
  const t = T(); const sk = nid('c'), hist = nid('c');
  const ftOfNode = n => ftShort.findIndex(f => n.endsWith(f));
  onMount(() => {
    const o = baseOpt(t); o.tooltip.trigger = 'item';
    o.tooltip.formatter = p => p.dataType === 'edge' ? ttBox(`${p.data.source} → ${p.data.target}`, [`${fmt(p.data.value)} jobs`], '') : ttBox(p.name, [`${fmt(p.value)} jobs`], '');
    o.series = [{
      type: 'sankey', left: 8, right: (document.getElementById(sk)?.clientWidth || 0) >= 640 ? 130 : 8, top: 8, bottom: 8, nodeGap: 8, nodeWidth: 12, draggable: false, layoutIterations: 0,
      data: [...nodes].sort().map(n => ({ name: n, itemStyle: { color: t.ft[ftOfNode(n)] || t.t3, borderColor: t.surface } })),
      links: [...links.entries()].map(([kk, v]) => { const [source, target] = kk.split('\u0000'); return { source, target, value: v }; }),
      nodeAlign: 'left', lineStyle: { color: 'gradient', opacity: .35 }, label: { show: (document.getElementById(sk)?.clientWidth || 0) >= 640, color: t.t2, fontSize: 11 }, emphasis: { focus: 'adjacency' },
    }];
    makeChart(sk, o);
    const buckets = [1, 2, 3, 4, 5, 6, 8, 11, 16, 1e9], bl = ['1', '2', '3', '4', '5', '6–7', '8–10', '11–15', '16+'];
    const cnt = bl.map((_, k) => lens.filter(x => x >= buckets[k] && x < buckets[k + 1]).length);
    makeChart(hist, vbarOption(bl, cnt, { valueName: 'Jobs', tip: '' }));
  });
  const renB = new Map(); for (const i of rows) if (C.ft[i] >= 2) renB.set(C.b[i], (renB.get(C.b[i]) || 0) + 1);
  const topRenB = sortedEntries(renB).slice(0, 15).map(([b, c]) => ({ html: entLink('building', b, bldAddrFull(b)), count: c }));
  const longJobs = perJob.sort((a, b) => b[1].length - a[1].length).slice(0, 15).map(([j, a]) => ({ html: entLink('job', j, 'Job ' + DICT.job[j]), extra: entLink('building', C.b[a[0]], bldAddr(C.b[a[0]])), count: a.length }));
  html += `<div class="kpis">
    <div class="kpi"><div class="lbl">Jobs in scope</div><div class="val">${fmt(byJob.size)}</div></div>
    <div class="kpi"><div class="lbl">Jobs with a Final CO</div><div class="val">${pct(reachedFinal, byJob.size)}</div><div class="cmp">${fmt(reachedFinal)} jobs</div></div>
    <div class="kpi"><div class="lbl">Jobs starting with Initial</div><div class="val">${pct(startInitial, byJob.size)}</div><div class="cmp">others started before this extract</div></div>
    <div class="kpi"><div class="lbl">Median COs per job</div><div class="val">${fmt1(quantile(Float64Array.from(lens).sort(), .5))}</div></div>
  </div><div class="grid">
    ${chartCard({ id: sk, title: 'Filing sequences per job (first six steps)', sub: 'Each band = jobs moving from one filing type to the next', span: 12, height: 440, hint: '', legend: legendHtml(DICT.ft.map((n, g) => [t.ft[g], n])), table: { head: ['From', 'To', 'Jobs'], rows: [...links.entries()].sort((a, b) => b[1] - a[1]).map(([kk, v]) => [...kk.split('\u0000').map(esc), fmt(v)]), num: [2] } })}
    ${chartCard({ id: hist, title: 'Certificates per job', span: 4, height: 240, hint: '' })}
    ${card('Buildings with most renewals', rankTable(topRenB, { label: 'Building', value: 'Renewals', max: 15 }), 4)}
    ${card('Longest CO chains', rankTable(longJobs, { label: 'Job', extra: 'Building', value: 'COs', max: 15 }), 4)}
  </div>`;
  return html;
}

/* ======================================================= Housing pipeline */
function pageHousing() {
  const sc = scopeRows(ROUTE.q.scope);
  setCrumbs([...(sc.label ? [{ label: sc.label, href: sc.href }] : []), { label: 'Housing pipeline' }]);
  const rows = applyF(sc.rows, sc.key, F, ['type', 'ft']);
  let html = head('Housing pipeline', 'Dwelling units delivered by New Building jobs, counted from their Final certificate. (Job-type and filing-type filters are fixed on this page.)') + scopeBanner(sc, '/housing');
  // latest Final CO per (job, building) for New Building jobs with a unit count
  const best = new Map();
  for (const i of rows) {
    if (C.jtg[i] !== 0 || C.ft[i] !== 1 || C.units[i] < 0) continue;
    const kk = C.job[i] * 100000 + C.b[i]; const p = best.get(kk);
    if (p == null || C.iss[i] > C.iss[p]) best.set(kk, i);
  }
  const fin = [...best.values()];
  if (!fin.length) return html + emptyState('No New Building final certificates in scope');
  const total = fin.reduce((a, i) => a + C.units[i], 0);
  const q = new Map(); for (const i of fin) { const qq = Math.floor(C.ym[i] / 3); q.set(qq, (q.get(qq) || 0) + C.units[i]); }
  const qs = [...q.keys()].sort((a, b) => a - b); const qLabel = x => `${Math.floor(x / 4)} Q${x % 4 + 1}`;
  const sumBy = col => { const m = new Map(); for (const i of fin) { const k = col[i]; if (k < 0) continue; m.set(k, (m.get(k) || 0) + C.units[i]); } return sortedEntries(m); };
  const byBoro = sumBy(C.boro), byNta = sumBy(C.nta).slice(0, 15);
  const big = fin.slice().sort((a, b) => C.units[b] - C.units[a]).slice(0, 15);
  const qId = nid('c'), bId = nid('c'), nId = nid('c');
  onMount(() => {
    const o = vbarOption(qs.map(qLabel), qs.map(x => q.get(x)), { valueName: 'Units', tip: 'Click: filter to quarter' });
    o.series[0].label.show = false;
    makeChart(qId, o, { onClick: p => { const x = qs[p.dataIndex]; setFilters({ ...F, from: x * 3, to: x * 3 + 2 }); } });
    makeChart(bId, hbarOption(byBoro.map(x => DICT.boro[x[0]]), byBoro.map(x => x[1]), { valueName: 'Units' }), { onClick: p => go(entPath('borough', byBoro[revIdx(p, byBoro.length)][0])), onShift: p => crossFilter('boro', byBoro[revIdx(p, byBoro.length)][0]) });
    makeChart(nId, hbarOption(byNta.map(x => DICT.nta[x[0]]), byNta.map(x => x[1]), { valueName: 'Units' }), { onClick: p => go(entPath('nta', byNta[revIdx(p, byNta.length)][0])) });
  });
  html += `<div class="kpis">
    <div class="kpi"><div class="lbl">Units delivered</div><div class="val">${fmt(total)}</div></div>
    <div class="kpi"><div class="lbl">New-building jobs finalized</div><div class="val">${fmt(fin.length)}</div></div>
    <div class="kpi"><div class="lbl">Median units per job</div><div class="val">${fmt1(quantile(Float64Array.from(fin.map(i => C.units[i])).sort(), .5))}</div></div>
    <div class="kpi"><div class="lbl">Share in 51+ unit projects</div><div class="val">${pct(fin.filter(i => C.units[i] > 50).reduce((a, i) => a + C.units[i], 0), total)}</div></div>
  </div><div class="grid">
    ${chartCard({ id: qId, title: 'Units delivered per quarter', sub: `Latest quarter is partial — data ends ${fmtIss(META.issuedMax).slice(0, 10)}`, span: 12, height: 260, hint: 'Click a quarter: filter to it', table: { head: ['Quarter', 'Units'], rows: qs.map(x => [qLabel(x), fmt(q.get(x))]), num: [1] } })}
    ${chartCard({ id: bId, title: 'By borough', span: 5, height: 240, table: { head: ['Borough', 'Units'], rows: byBoro.map(([b, u]) => [entLink('borough', b), fmt(u)]), num: [1] } })}
    ${chartCard({ id: nId, title: 'Top neighborhoods', span: 7, height: 380, hint: 'Click: open neighborhood', table: { head: ['Neighborhood', 'Units'], rows: byNta.map(([b, u]) => [entLink('nta', b), fmt(u)]), num: [1] } })}
    ${card('Largest projects', simpleTable(['Building', 'Neighborhood', 'Final CO', 'Units'], big.map(i => [entLink('building', C.b[i], bldAddrFull(C.b[i])), entLink('nta', C.nta[i]), certLink(i), fmt(C.units[i])]), [3]), 12)}
  </div>`;
  return html;
}

/* ======================================================= Compare */
const COMPARE_KINDS = ['borough', 'nta', 'zip', 'cb', 'council', 'street', 'building'];
function pageCompare() {
  setCrumbs([{ label: 'Compare' }]);
  const kind = COMPARE_KINDS.includes(ROUTE.q.kind) ? ROUTE.q.kind : 'nta';
  const ids = (ROUTE.q.ids || '').split('|').filter(Boolean).slice(0, 4);
  const ents = ids.map(s => ({ s, k: ENT[kind].from(s) })).filter(x => x.k != null);
  const listId = 'cmpList';
  const options = kind === 'building' ? '' : [...index(kind).keys()].map(k => `<option value="${esc(ENT[kind].key(k))}">${esc(ENT[kind].name(k))}</option>`).join('');
  let html = head('Compare', 'Pick 2–4 places of the same type and see them side by side');
  html += `<div class="toolbar">
    <label class="muted">Type <select class="ctl" id="cmpKind">${COMPARE_KINDS.map(k => `<option value="${k}"${k === kind ? ' selected' : ''}>${ENT[k].many}</option>`).join('')}</select></label>
    <input class="ctl" id="cmpAdd" list="${listId}" placeholder="${kind === 'building' ? 'Type a BIN' : 'Add ' + ENT[kind].one.toLowerCase() + '…'}" style="max-width:260px" ${ents.length >= 4 ? 'disabled' : ''}>
    <datalist id="${listId}">${options}</datalist>
    <button class="btn primary" id="cmpAddBtn" ${ents.length >= 4 ? 'disabled' : ''}>Add</button>
    ${ents.map((e, n) => `<span class="chip"><i style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${T().s[n]}"></i>${esc(ENT[kind].name(e.k))}<button aria-label="Remove" data-cmp-rm="${n}">×</button></span>`).join('')}
  </div>`;
  onMount(() => {
    const add = () => {
      const v = document.getElementById('cmpAdd').value.trim(); if (!v) return;
      let key = v; if (ENT[kind].from(key) == null) { const hit = [...index(kind).keys()].find(k => ENT[kind].name(k).toLowerCase() === v.toLowerCase()); if (hit != null) key = ENT[kind].key(hit); }
      if (ENT[kind].from(key) == null) { toast('Not found'); return; }
      go('/compare', { kind, ids: [...ids, key].join('|') });
    };
    document.getElementById('cmpKind').addEventListener('change', e => go('/compare', { kind: e.target.value }));
    document.getElementById('cmpAddBtn').addEventListener('click', add);
    document.getElementById('cmpAdd').addEventListener('keydown', e => { if (e.key === 'Enter') add(); });
    document.querySelectorAll('[data-cmp-rm]').forEach(b => b.addEventListener('click', () => go('/compare', { kind, ids: ids.filter((_, n) => n !== +b.dataset.cmpRm).join('|') })));
  });
  if (ents.length < 1) return html + `<div class="empty"><h3>Nothing to compare yet</h3><p>Add places above, or try <a href="${link('/compare', { kind: 'borough', ids: DICT.boro.join('|') })}">all five boroughs</a>.</p></div>`;
  const t = T();
  const sets = ents.map(e => { const r = applyF(rowsOf(kind, e.k), kind + ':' + e.k); return { ...e, rows: r, kp: kpis(r), name: ENT[kind].name(e.k) }; });
  const share = (r, col, v) => { let c = 0; for (const i of r) if (col[i] === v) c++; return pct(c, r.length); };
  const metrics = [
    ['Certificates', s => fmt(s.kp.cos)], ['Buildings', s => fmt(s.kp.bld)], ['Jobs', s => fmt(s.kp.jobs)],
    ['Dwelling units (latest per building)', s => fmt(s.kp.units)], ['Median processing days', s => fmt1(s.kp.median)],
    ['Renewal share', s => (s.kp.renew == null ? '—' : (s.kp.renew * 100).toFixed(1) + '%')],
    ...DICT.jtg.map((n, g) => [`${n} share`, s => share(s.rows, C.jtg, g)]),
  ];
  html += card('Side by side', simpleTable(['Metric', ...sets.map((s, n) => ({ html: `${sw(t.s[n])}${entLink(kind, s.k, s.name)}` }))], metrics.map(([m, f]) => [esc(m), ...sets.map(f)]), sets.map((_, n) => n + 1)), 12);
  const lineId = nid('c'), ftId = nid('c');
  const [a, b] = monthRange(); const months = Array.from({ length: b - a + 1 }, (_, k) => a + k);
  const seriesData = sets.map(s => { const arr = new Array(months.length).fill(0); for (const i of s.rows) { const x = C.ym[i] - a; if (x >= 0 && x < arr.length) arr[x]++; } return arr; });
  onMount(() => {
    const o = baseOpt(t); o.tooltip.trigger = 'axis';
    o.tooltip.formatter = ps => ttBox(ymShort(months[ps[0].dataIndex]), ps.map(p => `${sw(p.color)}${esc(p.seriesName)}: <b>${fmt(p.value)}</b>`), '');
    o.xAxis = axisCat(t, months.map(ymShort), { boundaryGap: false }); o.yAxis = axisVal(t);
    o.series = sets.map((s, n) => ({ name: s.name, type: 'line', data: seriesData[n], showSymbol: false, symbolSize: 8, lineStyle: { width: 2, color: t.s[n] }, itemStyle: { color: t.s[n] }, emphasis: { focus: 'series' } }));
    makeChart(lineId, o);
    const fo = baseOpt(t); fo.tooltip.trigger = 'item';
    fo.tooltip.formatter = p => ttBox(p.name, [`${sw(p.color)}${esc(p.seriesName)}: <b>${p.value.toFixed(1)}%</b>`], 'Click: open place');
    fo.yAxis = axisCat(t, sets.map(s => s.name), { inverse: true, axisLabel: { color: t.t2, width: 140, overflow: 'truncate' } });
    fo.xAxis = axisVal(t, { max: 100, axisLabel: { color: t.t3, formatter: '{value}%' } });
    fo.series = DICT.ft.map((f, g) => ({ name: f, type: 'bar', stack: 'x', barMaxWidth: 26, itemStyle: { color: t.ft[g], borderColor: t.surface, borderWidth: 1 }, data: sets.map(s => { let c = 0; for (const i of s.rows) if (C.ft[i] === g) c++; return s.rows.length ? 100 * c / s.rows.length : 0; }) }));
    makeChart(ftId, fo, { onClick: p => go(entPath(kind, sets[p.dataIndex].k)) });
  });
  html += `<div class="grid" style="margin-top:14px">
    ${chartCard({ id: lineId, title: 'Certificates per month', span: 12, height: 280, hint: '', legend: legendHtml(sets.map((s, n) => [t.s[n], s.name])), table: { head: ['Month', ...sets.map(s => s.name)], rows: months.map((m, k) => [ymShort(m), ...seriesData.map(d => fmt(d[k]))]) } })}
    ${chartCard({ id: ftId, title: 'Filing-type mix', span: 12, height: 60 + sets.length * 40, hint: 'Click a bar: open place', legend: legendHtml(DICT.ft.map((n, g) => [t.ft[g], n])) })}
  </div>`;
  return html;
}

/* ======================================================= Data Explorer */
const EXP_COLS = [
  { key: 'cert', label: 'Certificate', w: 150, get: i => certKey(i), html: i => certLink(i), def: 1 },
  { key: 'iss', label: 'Issued', w: 140, get: i => C.iss[i], html: i => fmtIss(C.iss[i]), csv: i => fmtIss(C.iss[i]), def: 1 },
  { key: 'sub', label: 'Submitted', w: 110, get: i => C.sub[i], html: i => fmtDay(C.sub[i]), csv: i => fmtDay(C.sub[i]) },
  { key: 'proc', label: 'Days', w: 70, num: 1, get: i => C.proc[i], html: i => (C.proc[i] === NOPROC ? '—' : fmt(C.proc[i])), csv: i => (C.proc[i] === NOPROC ? '' : C.proc[i]), def: 1 },
  { key: 'ft', label: 'Filing type', w: 170, get: i => DICT.ft[C.ft[i]] || '', def: 1 },
  { key: 'jtg', label: 'Job type', w: 150, get: i => DICT.jtg[C.jtg[i]], def: 1 },
  { key: 'jtr', label: 'Job type (raw)', w: 200, get: i => DICT.jtr[C.jtr[i]] },
  { key: 'job', label: 'Job', w: 110, get: i => DICT.job[C.job[i]], html: i => entLink('job', C.job[i], DICT.job[C.job[i]]), def: 1 },
  { key: 'bin', label: 'BIN', w: 90, get: i => BLD.bin[C.b[i]], html: i => entLink('building', C.b[i], String(BLD.bin[C.b[i]])), def: 1 },
  { key: 'addr', label: 'Address', w: 230, get: i => `${DICT.house[C.house[i]]} ${DICT.st[C.st[i]]}`, html: i => `${esc(DICT.house[C.house[i]])} ${entLink('street', C.stn[i], DICT.st[C.st[i]])}`, def: 1 },
  { key: 'boro', label: 'Borough', w: 110, get: i => DICT.boro[C.boro[i]], html: i => entLink('borough', C.boro[i]), def: 1 },
  { key: 'nta', label: 'Neighborhood', w: 220, get: i => DICT.nta[C.nta[i]] || '', html: i => entLink('nta', C.nta[i]), def: 1 },
  { key: 'zip', label: 'ZIP', w: 70, get: i => DICT.zip[C.zip[i]] || '', html: i => entLink('zip', C.zip[i], DICT.zip[C.zip[i]]) },
  { key: 'cb', label: 'CB', w: 70, get: i => DICT.cb[C.cb[i]] || '', html: i => entLink('cb', C.cb[i], DICT.cb[C.cb[i]]) },
  { key: 'cd', label: 'Council', w: 70, num: 1, get: i => C.cd[i], html: i => entLink('council', C.cd[i], String(C.cd[i])) },
  { key: 'bbl', label: 'BBL', w: 110, get: i => DICT.bbl[C.bbl[i]] || '', html: i => (C.bbl[i] >= 0 ? entLink('lot', C.bbl[i], DICT.bbl[C.bbl[i]]) : '—') },
  { key: 'block', label: 'Block', w: 70, num: 1, get: i => C.block[i] },
  { key: 'lot', label: 'Lot', w: 70, num: 1, get: i => C.lot[i] },
  { key: 'units', label: 'Units', w: 70, num: 1, get: i => C.units[i], html: i => (C.units[i] < 0 ? '—' : fmt(C.units[i])), csv: i => (C.units[i] < 0 ? '' : C.units[i]), def: 1 },
  { key: 'co', label: 'CO number', w: 150, get: i => coNumber(i) },
  { key: 'tract', label: 'Census tract', w: 100, get: i => (BLD.tract[C.b[i]] >= 0 ? DICT.tract[BLD.tract[C.b[i]]] : '') },
  { key: 'lat', label: 'Latitude', w: 90, num: 1, get: i => BLD.lat[C.b[i]] ?? '' },
  { key: 'lng', label: 'Longitude', w: 95, num: 1, get: i => BLD.lng[C.b[i]] ?? '' },
];
let EXP_VISIBLE = null, EXP_TEXT = null;
function pageExplorer() {
  const sc = scopeRows(ROUTE.q.scope);
  setCrumbs([...(sc.label ? [{ label: sc.label, href: sc.href }] : []), { label: 'Data explorer' }]);
  if (!EXP_VISIBLE) { try { EXP_VISIBLE = JSON.parse(localStorage.getItem('coex-cols')); } catch (e) {} if (!Array.isArray(EXP_VISIBLE)) EXP_VISIBLE = EXP_COLS.filter(c => c.def).map(c => c.key); }
  let rows = applyF(sc.rows, sc.key);
  const q = (ROUTE.q.q || '').trim().toLowerCase();
  if (q) {
    if (!EXP_TEXT) { EXP_TEXT = new Array(N); for (let i = 0; i < N; i++) EXP_TEXT[i] = `${certKey(i)} ${coNumber(i)} ${DICT.job[C.job[i]]} ${BLD.bin[C.b[i]]} ${DICT.house[C.house[i]]} ${DICT.st[C.st[i]]} ${DICT.stDisplay[C.stn[i]]} ${DICT.nta[C.nta[i]] || ''} ${DICT.zip[C.zip[i]] || ''} ${DICT.bbl[C.bbl[i]] || ''}`.toLowerCase(); }
    const terms = q.split(/\s+/); rows = rows.filter(i => terms.every(tm => EXP_TEXT[i].includes(tm)));
  }
  const cols = EXP_COLS.filter(c => EXP_VISIBLE.includes(c.key));
  let html = head('Data explorer', `${fmt(rows.length)} of ${fmt(N)} certificates match`) + scopeBanner(sc, '/explorer');
  html += `<div class="toolbar">
    <input type="search" class="ctl" id="expQ" placeholder="Filter rows: address, BIN, job, CO…" value="${esc(ROUTE.q.q || '')}" aria-label="Filter rows">
    <div class="colchooser"><button class="btn" id="colBtn" aria-expanded="false">Columns (${cols.length})</button>
      <div class="menu" id="colMenu" hidden>${EXP_COLS.map(c => `<label><input type="checkbox" value="${c.key}"${EXP_VISIBLE.includes(c.key) ? ' checked' : ''}> ${esc(c.label)}</label>`).join('')}</div></div>
    <button class="btn" id="expCsv">Export CSV (${fmt(rows.length)} rows)</button>
  </div><div id="expTable"></div><p class="note">Click a column header to sort. Every ID links to its page.</p>`;
  onMount(() => {
    const el = document.getElementById('expTable');
    if (!rows.length) { el.innerHTML = emptyState(); return; }
    const sortKey = ROUTE.q.sort ? { key: ROUTE.q.sort.replace(/^-/, ''), dir: ROUTE.q.sort.startsWith('-') ? -1 : 1 } : { key: 'iss', dir: -1 };
    vtable(el, {
      cols, items: rows, height: Math.max(360, window.innerHeight - 330), sort: sortKey,
      onSort: s => history.replaceState(null, '', link(ROUTE.path, { ...ROUTE.q, sort: (s.dir < 0 ? '-' : '') + s.key })),
    });
    const qi = document.getElementById('expQ'); let tmo;
    qi.addEventListener('input', () => { clearTimeout(tmo); tmo = setTimeout(() => go(ROUTE.path, { ...ROUTE.q, q: qi.value || null }), 350); });
    const btn = document.getElementById('colBtn'), menu = document.getElementById('colMenu');
    btn.addEventListener('click', () => { menu.hidden = !menu.hidden; btn.setAttribute('aria-expanded', !menu.hidden); });
    menu.addEventListener('change', () => {
      EXP_VISIBLE = [...menu.querySelectorAll('input:checked')].map(x => x.value);
      try { localStorage.setItem('coex-cols', JSON.stringify(EXP_VISIBLE)); } catch (e) {}
      render();
    });
    document.getElementById('expCsv').addEventListener('click', () => {
      const cell = v => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
      const lines = [cols.map(c => cell(c.label)).join(',')];
      for (const i of rows) lines.push(cols.map(c => cell(c.csv ? c.csv(i) : c.get(i))).join(','));
      const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `co_explorer_${rows.length}_rows.csv`; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    });
  });
  if (q) setTimeout(() => { const x = document.getElementById('expQ'); if (x) { x.focus(); x.setSelectionRange(x.value.length, x.value.length); } }, 0);
  return html;
}

/* ======================================================= Entity lists */
function pageList(kind) {
  if (!ENT[kind]) return notFound('List');
  const sc = scopeRows(ROUTE.q.scope);
  setCrumbs([...(sc.label ? [{ label: sc.label, href: sc.href }] : []), { label: 'All ' + ENT[kind].many.toLowerCase() }]);
  const rows = applyF(sc.rows, sc.key);
  let html = head(ENT[kind].many, `${ENT[kind].many} with certificates matching the current filters`) + scopeBanner(sc, '/list/' + kind);
  if (!rows.length) return html + emptyState();
  const col = ENT[kind].col; const agg = new Map();
  for (const i of rows) {
    const k = col[i]; if (k < 0) continue;
    let a = agg.get(k); if (!a) agg.set(k, a = { k, n: 0, nb: 0, ren: 0, b: new Set(), p: [], boro: C.boro[i], units: 0 });
    a.n++; if (C.jtg[i] === 0) a.nb++; if (C.ft[i] >= 2) a.ren++; a.b.add(C.b[i]); if (C.proc[i] !== NOPROC) a.p.push(C.proc[i]);
  }
  const items = [...agg.values()].map(a => { a.p.sort((x, y) => x - y); a.med = a.p.length ? quantile(a.p, .5) : null; a.nbld = a.b.size; a.b = null; a.p = null; return a; });
  const cols = [
    { key: 'name', label: ENT[kind].one, w: kind === 'building' ? 280 : 240, get: a => ENT[kind].name(a.k), html: a => entLink(kind, a.k, kind === 'building' ? bldAddr(a.k) : null) },
    ...(kind !== 'borough' ? [{ key: 'boro', label: 'Borough', w: 110, get: a => DICT.boro[a.boro] }] : []),
    { key: 'n', label: 'COs', w: 80, num: 1, get: a => a.n, html: a => fmt(a.n) },
    ...(kind !== 'building' ? [{ key: 'nbld', label: 'Buildings', w: 90, num: 1, get: a => a.nbld, html: a => fmt(a.nbld) }] : [{ key: 'bin', label: 'BIN', w: 90, get: a => BLD.bin[a.k] }]),
    { key: 'nb', label: 'New bldg %', w: 100, num: 1, get: a => a.nb / a.n, html: a => pct(a.nb, a.n) },
    { key: 'ren', label: 'Renewal %', w: 100, num: 1, get: a => a.ren / a.n, html: a => pct(a.ren, a.n) },
    { key: 'med', label: 'Median days', w: 100, num: 1, get: a => a.med ?? -1, html: a => fmt1(a.med) },
  ];
  html += `<div class="toolbar"><input type="search" class="ctl" id="listQ" placeholder="Filter ${ENT[kind].many.toLowerCase()}…" aria-label="Filter list"><span class="muted" id="listN">${fmt(items.length)} ${ENT[kind].many.toLowerCase()}</span></div><div id="listT"></div>`;
  onMount(() => {
    const el = document.getElementById('listT');
    const draw = (its, sort) => vtable(el, { cols, items: its, height: Math.max(360, window.innerHeight - 320), sort: sort || { key: 'n', dir: -1 } });
    draw(items);
    const qi = document.getElementById('listQ');
    qi.addEventListener('input', () => {
      const t = qi.value.trim().toLowerCase();
      const its = t ? items.filter(a => (ENT[kind].name(a.k) + ' ' + ENT[kind].key(a.k)).toLowerCase().includes(t)) : items;
      document.getElementById('listN').textContent = `${fmt(its.length)} ${ENT[kind].many.toLowerCase()}`;
      draw(its);
    });
  });
  return html;
}

/* ======================================================= About */
function pageAbout() {
  setCrumbs([{ label: 'About the data' }]);
  const m = META;
  const nulls = Object.entries(m.nullCounts).map(([c, n]) => [esc(c), fmt(n), pct(n, m.rowsRaw)]);
  const aliases = Object.entries(m.streetAliases).slice(0, 40);
  const reused = m.reusedApplicationNumbers.map(a => `<li>${[...CERT_IDX.entries()].filter(([k]) => k.startsWith(a)).map(([, i]) => `${certLink(i)} <span class="muted">${esc(bldAddrFull(C.b[i]))}</span>`).join(' · ')}</li>`).join('');
  return `${head('About the data', `Source file <code>${esc(m.source)}</code> · prepared ${esc(m.generated.replace('T', ' '))}`)}
  <div class="grid">
    ${card('Row counts', `<dl class="facts">
      <dt>Rows in source</dt><dd>${fmt(m.rowsRaw)}</dd>
      <dt>Exact duplicate rows</dt><dd>${fmt(m.exactDuplicateRows)} — nothing removed</dd>
      <dt>Rows in dashboard</dt><dd>${fmt(N)}</dd>
      <dt>Buildings (BIN)</dt><dd>${fmt(NB)}</dd>
      <dt>Jobs</dt><dd>${fmt(DICT.job.length)}</dd>
      <dt>Issued</dt><dd>${fmtIss(m.issuedMin).slice(0, 10)} → ${fmtIss(m.issuedMax).slice(0, 10)}</dd>
      <dt>C OF O STATUS</dt><dd>Constant: ${Object.entries(m.statusValues).map(([k, v]) => `“${esc(k)}” × ${fmt(v)}`).join(', ')} — not charted</dd>
    </dl>`, 6)}
    ${card('Parsing & derived-field checks', `<dl class="facts">
      <dt>Submitted-date parse failures</dt><dd>${fmt(m.submittedParseFailures)} (plus ${fmt(m.nullCounts['SUBMITTED DATE'])} blank)</dd>
      <dt>Issuance-date parse failures</dt><dd>${fmt(m.issuanceParseFailures)} (plus ${fmt(m.nullCounts['C OF O ISSUANCE DATE'])} blank)</dd>
      <dt>Negative processing days</dt><dd>${fmt(m.negativeProcessingDays)} (kept, flagged)</dd>
      <dt>Zero processing days</dt><dd>${fmt(m.zeroProcessingDays)} (same-day issuance, mostly renewals — kept)</dd>
      <dt>Unparseable unit counts</dt><dd>${Object.entries(m.unitsParseFailures).map(([k, v]) => `“${esc(k)}” × ${v}`).join(', ') || 'none'} → treated as unknown</dd>
    </dl>`, 6)}
    ${card('Application numbers shared by different certificates', `<p class="note" style="margin-top:0">${m.reusedApplicationNumbers.length} application numbers each appear on two unrelated certificates (different buildings, jobs and dates). They are not duplicates, so all rows are kept. The second one gets a “-2” suffix in this dashboard’s URLs.</p><ul style="font-size:13px;padding-left:18px;max-height:240px;overflow:auto">${reused}</ul>`, 12)}
    ${card('Job type normalization', simpleTable(['Raw value', 'Group', 'Rows'], Object.entries(m.jobTypeMap).map(([raw, v]) => [esc(raw), esc(v.group), fmt(v.rows)]), [2]), 6)}
    ${card('Null rates per column', `<div class="alt-table" style="max-height:340px">${simpleTable(['Column', 'Blank', 'Rate'], nulls, [1, 2])}</div>`, 6)}
    ${card('Street alias normalization (top 40)', `<p class="note" style="margin-top:0">${fmt(DICT.st.length)} raw spellings → ${fmt(DICT.stNorm.length)} normalized streets. Rules: ordinal words to numbers (FIFTH→5), drop ordinal suffixes (5TH→5), expand abbreviations (AVE→AVENUE, ST→STREET), leading E/W/N/S → EAST/WEST/…, “Avenue of the Americas” → 6 Avenue.</p><div class="alt-table" style="max-height:380px">${simpleTable(['Normalized', 'Raw spellings'], aliases.map(([n, v]) => [entLink('street', KEYMAP.street.get(n), DICT.stDisplay[KEYMAP.street.get(n)]), Object.entries(v).sort((a, b) => b[1] - a[1]).map(([s, c]) => `${esc(s)} <span class="muted">(${fmt(c)})</span>`).join(', ')]))}</div>`, 12)}
    ${card('Derived fields', `<dl class="facts">
      <dt>processing_days</dt><dd>Issuance date − submitted date, in whole days</dd>
      <dt>job_type_group</dt><dd>New Building / Alteration / NB w/ Existing Elements (see mapping)</dd>
      <dt>renewal</dt><dd>Filing type starts with “Renewal”</dd>
      <dt>condo lot</dt><dd>BBL lot number 7501–7599 (condominium billing lot)</dd>
      <dt>units bucket</dt><dd>0 · 1–2 · 3–10 · 11–50 · 51–200 · 200+ (blank = unknown, never 0)</dd>
      <dt>Dwelling units KPI</dt><dd>Sum over buildings of the units on each building’s latest certificate in scope (avoids counting renewals twice)</dd>
      <dt>Housing pipeline</dt><dd>New Building jobs: units on the latest Final CO per job and building</dd>
      <dt>Geography</dt><dd>Latitude/longitude, NTA, council district and census tract are constant per BIN in this extract and are stored once per building</dd>
    </dl>`, 12)}
  </div>`;
}

function notFound(what) {
  setCrumbs([{ label: 'Not found' }]);
  return `<div class="empty"><h3>${esc(what)} was not found</h3><p>It may not appear in this extract. Try the search (⌘K).</p><a class="btn primary" style="line-height:28px;display:inline-block" href="${link('/')}">Back to overview</a></div>`;
}

/* ======================================================= Router */
function setCrumbs(chain) { document.getElementById('crumbs').innerHTML = crumbsFor(chain); }

const ROUTES = {
  '': () => pageOverview(),
  borough: s => pageGeo('borough', s[1]), cb: s => pageGeo('cb', s[1]), council: s => pageGeo('council', s[1]),
  zip: s => pageGeo('zip', s[1]), nta: s => pageGeo('nta', s[1]),
  street: s => pageStreet(s[1]), lot: s => pageLot(s[1]), building: s => pageBuilding(s[1]),
  job: s => pageJob(s[1]), co: s => pageCert(s[1]),
  processing: () => pageProcessing(), renewals: () => pageRenewals(), housing: () => pageHousing(),
  compare: () => pageCompare(), explorer: () => pageExplorer(), list: s => pageList(s[1]), about: () => pageAbout(),
};

let lastPath = null;
function render() {
  const t0 = performance.now();
  ROUTE = parseHash(); F = readFilters(ROUTE.q);
  cleanup(); MOUNTS = []; RENDER_GEN++;
  renderFilterBar();
  const fn = ROUTES[ROUTE.segs[0] || ''] || (() => notFound('Page'));
  let html;
  try { html = fn(ROUTE.segs); } catch (e) { console.error(e); html = `<div class="empty"><h3>Something went wrong rendering this page</h3><pre class="muted">${esc(e.message)}</pre></div>`; }
  const main = document.getElementById('main');
  main.innerHTML = html;
  MOUNTS.forEach(fn2 => { try { fn2(); } catch (e) { console.error(e); } });
  // nav highlight
  const navPath = '/' + (ROUTE.segs[0] === 'list' ? 'list/' + ROUTE.segs[1] : (ROUTE.segs[0] || ''));
  document.querySelectorAll('[data-nav]').forEach(a => { const on = a.dataset.nav === navPath || (navPath === '/' && a.dataset.nav === '/'); a.classList.toggle('active', on); if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); a.href = link(a.dataset.nav); });
  document.querySelector('.brand').href = link('/');
  document.getElementById('foot').innerHTML = `Source: NYC Department of Buildings, DOB NOW: Certificate of Occupancy (${fmt(N)} rows, extract ${esc(META.source.match(/\d{8}/)?.[0] || '')}). C OF O STATUS is “CO Issued” for every row. Unit counts are missing for ${pct(META.nullCounts['NUMBER OF DWELLING UNITS'], N)} of rows, BBL for ${pct(META.nullCounts.BBL, N)}, coordinates for ${pct(META.nullCounts.latitude, N)}. ${META.reusedApplicationNumbers.length} application numbers are reused by different certificates; all rows are kept. <a href="${link('/about')}">About the data →</a> · Rendered in ${Math.round(performance.now() - t0)} ms`;
  const pathOnly = ROUTE.path;
  if (pathOnly !== lastPath) { window.scrollTo(0, 0); document.getElementById('sidenav').classList.remove('open'); }
  lastPath = pathOnly;
  document.title = (document.querySelector('.page-head h1')?.textContent || 'Overview') + ' · CO Explorer';
}

/* ======================================================= boot & global events */
function boot() {
  window.addEventListener('hashchange', render);
  document.addEventListener('click', e => {
    const tb = e.target.closest('[data-tbl]');
    if (tb) {
      const id = tb.dataset.tbl, box = document.getElementById(id + '-tbl'), chart = document.getElementById(id), tbl = TABLES[id];
      const show = box.hidden;
      if (show && tbl) box.innerHTML = simpleTable(tbl.head, tbl.rows.map(r => r.map(c => (typeof c === 'string' && c.startsWith('<')) ? c : esc(c))), tbl.num || []);
      box.hidden = !show; chart.hidden = show; tb.textContent = show ? 'View as chart' : 'View as table'; tb.setAttribute('aria-expanded', show);
      if (!show) CHARTS.forEach(c => c.getDom() === chart && c.resize());
    }
    if (e.target.closest('[data-reset]')) setFilters({});
  });
  document.getElementById('searchBtn').addEventListener('click', openSearch);
  document.getElementById('searchModal').addEventListener('click', e => { if (e.target.id === 'searchModal') closeSearch(); });
  document.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openSearch(); }
    else if (e.key === '/' && !/input|textarea|select/i.test(document.activeElement.tagName)) { e.preventDefault(); openSearch(); }
    else if (e.key === 'Escape') closeSearch();
  });
  document.getElementById('themeBtn').addEventListener('click', () => {
    const cur = document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('coex-theme', next); } catch (e) {}
    render();
  });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (!document.documentElement.dataset.theme) render(); });
  const nt = document.getElementById('navToggle');
  nt.addEventListener('click', () => { const sn = document.getElementById('sidenav'); sn.classList.toggle('open'); nt.setAttribute('aria-expanded', sn.classList.contains('open')); });
  let rt; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => CHARTS.forEach(c => c.resize()), 120); });
  render();
}
boot();
