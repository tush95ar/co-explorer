# Prompt: NYC Certificate of Occupancy Explorer — Multi-Layer Interlinked Dashboard

## Role & Goal
You are a senior data-visualization engineer. Build **"CO Explorer"**, a multi-page, multi-layered, fully cross-linked interactive dashboard from the file `DOB_NOW__Certificate_of_Occupancy_20261010.csv` (NYC DOB NOW Certificates of Occupancy, 82,806 rows, issued Jan 2021 – Oct 2026). Every chart, table row, map point and label must be a doorway into a deeper layer, and every deep page must link back up and sideways to related entities.

## Dataset Facts (use these — do not guess)
| Column | Notes |
|---|---|
| `JOB FILING NAME` | Job ID (~25.3k distinct; one job → many COs). **Entity: Job** |
| `JOB TYPE` | 5 raw values with inconsistent casing: `ALTERATION TYPE 1`, `Alteration CO`, `NEW BUILDING`, `New Building`, `CO - New Building with Existing Elements`. **Normalize** to 3 groups: *New Building*, *Alteration*, *NB w/ Existing Elements*; keep raw value for drill-down. |
| `BIN` | Building ID (~24.5k distinct). **Entity: Building** |
| `BOROUGH` | Manhattan 31k, Brooklyn 23.6k, Queens 15.6k, Bronx 8.3k, Staten Island 4.2k |
| `HOUSE NO`, `STREET NAME` | Address. Normalize street aliases (`5TH AVENUE` / `FIFTH AVENUE` / `5 AVENUE`) for grouping. |
| `BLOCK`, `LOT`, `BBL` | Tax lot. Lots 75xx = condo units. `BBL` ~1.9% null. **Entity: Lot** |
| `ZIP CODE` | 217 distinct |
| `SUBMITTED DATE` | `MM/DD/YYYY` |
| `C OF O ISSUANCE DATE` | `MM/DD/YY h:mm:ss AM/PM` (note double space before single-digit hours) |
| `C OF O STATUS` | Always `CO Issued` — constant; don't chart it, show as a footnote. |
| `C OF O FILING TYPE` | Renewal Without Change 47.9k, Final 19.2k, Initial 9k, Renewal With Change 6.7k (24 nulls) |
| `C OF O SEQUENCE #`, `APPLICATION NUMBER`, `C OF O NUMBER` | Near-unique IDs; seq has thousands separators (`91,215`). ~18 duplicate rows — dedupe on `APPLICATION NUMBER`. **Entity: Certificate** |
| `COMMUNITY BOARD` | 3-digit code, first digit = borough (1=MN,2=BX,3=BK,4=QN,5=SI). 68 distinct |
| `NUMBER OF DWELLING UNITS` | ~24% null; parse as int; treat null ≠ 0 |
| `latitude`, `longitude` | ~0.4% null |
| `Council District` | Zero-padded string `01`–`51` |
| `Census Tract` | Has thousands separators (`1,502`) |
| `NTA` | 224 neighborhood names. **Entity: Neighborhood** |

**Derived fields to compute:** `processing_days = issuance_date − submitted_date`; issuance year/quarter/month/weekday/hour; `job_type_group`; `is_condo_lot` (lot 7501–7599); `cos_per_job`; `renewal_flag` (filing type starts with "Renewal"); `units_bucket` (0, 1–2, 3–10, 11–50, 51–200, 200+).

## Architecture
- **Single self-contained HTML app** (or Vite + React if preferred) with **hash-based routing** so every view is a shareable URL, e.g. `#/borough/Brooklyn?year=2025&type=New%20Building`.
- Preprocess the CSV once (Python or in-browser with PapaParse in a Web Worker) into compact JSON: a fact table plus pre-aggregated cubes keyed by borough × NTA × year-month × job-type-group × filing-type. Build lookup indexes by BIN, BBL, Job, NTA, ZIP, CB, Council District.
- Libraries (pinned versions): ECharts or D3 for charts, Leaflet + marker clustering (or deck.gl) for maps, a virtualized table.
- **Global filter state** (date range, borough, job-type group, filing type, units bucket) lives in the URL and in a persistent filter bar; every page reads it. Show active filters as removable chips; include "Reset" and "Copy link".
- **Breadcrumb trail** on every page reflecting the drill path (e.g. *Citywide › Brooklyn › CB 301 › Williamsburg › 123 Bedford Ave (BIN 3xxxxxx) › Job 3211… › CO-0000…*). Back/forward browser buttons must work.

## Layers & Pages
### Layer 0 — Citywide Overview (`#/`)
- KPI tiles: total COs, distinct buildings, distinct jobs, total dwelling units, median processing days, % renewals. Each tile links to a pre-filtered list page.
- Monthly issuance trend (stacked by job-type group) with brushing to set the global date range.
- Borough comparison bars → click to Layer 1.
- Filing-type donut → click filters globally.
- Citywide clustered map; click a cluster to zoom, click a point → Building page.
- "Top 10" panels: NTAs, streets, ZIPs, buildings by CO count → each row links to its entity page.

### Layer 1 — Geography hubs
- **Borough page** (`#/borough/:name`): KPIs vs. city average, trend, job-type mix, community-board ranking, NTA choropleth/bubble map, units distribution. Links down to CB/NTA, sideways to other boroughs (compare toggle).
- **Community Board page**, **Council District page**, **ZIP page** — same template, each listing its NTAs, top buildings, and recent COs.
### Layer 2 — Neighborhood (NTA) page
- Map of all COs in the NTA, monthly trend, new-building vs. alteration ratio, dwelling-unit pipeline, processing-time distribution, ranked streets and buildings. "Similar neighborhoods" (nearest by CO volume/mix) links sideways.
### Layer 3 — Place pages
- **Street page**: all buildings on a normalized street, across boroughs.
- **Lot (BBL) page**: all BINs on the lot; condo unit lots grouped.
- **Building (BIN) page**: address header, mini map, timeline of every CO (Initial → Renewals → Final), unit count over time, all jobs at this BIN, neighbors on the same block.
### Layer 4 — Record pages
- **Job page**: all COs filed under the job, sequence chart of filing types, processing durations.
- **Certificate page**: every field of the row, formatted, with each value a link (BIN → building, NTA → neighborhood, CB → board, ZIP → ZIP, job → job).
### Cross-cutting analytical pages
- **Processing Time Lab**: distribution/box plots of `processing_days` by borough, job type, filing type, year; outlier table linking to certificates.
- **Renewal Patterns**: Initial→Renewal→Final sequences per job (Sankey), buildings with most renewals.
- **Housing Pipeline**: dwelling units from New Building Finals by geography and time.
- **Compare**: pick 2–4 entities of the same type (boroughs, NTAs, ZIPs, buildings) and view side-by-side metrics + overlaid trends.
- **Data Explorer**: virtualized, sortable, filterable table of all rows with column chooser, CSV export of the current filter, and every ID cell hyperlinked.

## Interlinking Rules (non-negotiable)
1. Every entity name anywhere (borough, CB, council district, ZIP, NTA, street, BBL, BIN, job, certificate) renders as a link to its page.
2. Clicking a chart mark either drills down (navigates) or cross-filters (shift-click), with a hover tooltip explaining which.
3. Each entity page ends with a **"Related"** panel: parent, siblings, children, and other geographies that overlap it.
4. Global filters persist across navigation; entity scope is added on top.
5. Global search box (⌘K) with type-ahead across addresses, BIN, BBL, job, CO number, NTA, ZIP → jumps to the matching page.

## UX & Design
- Responsive (works at 375px), left nav for page types, sticky filter bar, light/dark themes.
- Consistent color per job-type group and per filing type across every chart.
- Loading skeletons, empty states ("No COs match these filters" + reset button), and footnotes for data caveats (nulls in units/BBL/coords, constant status column, dedupe count).
- Accessible: keyboard navigation, ARIA labels, color-blind-safe palette, tables as alternatives to charts.
- Performance: aggregation in a Web Worker, memoized selectors, map clustering; page transitions < 300 ms on 83k rows.

## Data Quality Handling
Report on an "About the data" page: row count before/after dedupe, null rates per column, job-type normalization map, street alias normalization map, date parse failures, and negative/zero processing days (flag, don't drop).

## Deliverables
1. Preprocessing script (`prepare_data.py` or worker module) and generated data files.
2. The dashboard app with all pages above.
3. README: how to run, page map (route → purpose → links in/out), and the derived-field definitions.

## Acceptance Checklist
- [ ] Every page reachable from Overview within ≤ 4 clicks, and every page links back up via breadcrumbs.
- [ ] Any URL reloaded restores the exact view and filters.
- [ ] Clicking any ID in any table navigates to its entity page.
- [ ] KPI totals on Overview reconcile with the Data Explorer under the same filters.
- [ ] Job-type casing variants never appear as separate categories in top-level charts.
- [ ] No horizontal scroll at phone width; dark mode legible.
