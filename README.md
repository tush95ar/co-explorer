# CO Explorer

**Live dashboard:** https://tush95ar.github.io/co-explorer/

An interactive dashboard of NYC DOB NOW **Certificates of Occupancy** (82,806 certificates issued Mar 2021 – Oct 2026). Its pages are layered and linked to each other. Every chart mark, map point, table row and entity name opens a deeper page, and every deep page links back up and across to related places.

## Run it

```bash
python3 prepare_data.py
```
This reads `DOB_NOW__Certificate_of_Occupancy_20261010.csv` and writes `data/co_data.js` (~7.7 MB). Rerun it whenever the CSV changes. You can pass a different CSV path as the first argument.

Then open `index.html` directly in a browser (works from `file://`), or serve the folder:

```bash
python3 -m http.server 8765
```
…and visit http://localhost:8765. ECharts, Leaflet and Leaflet.markercluster load from cdnjs, and map tiles come from OpenStreetMap, so an internet connection is needed.

## Files

| File | Purpose |
|---|---|
| `prepare_data.py` | CSV → compact columnar JSON (dictionary-encoded), data-quality stats, street normalization |
| `data/co_data.js` | Generated data (`window.CO_DATA`) |
| `index.html` | Shell: top bar, side nav, filter bar, search modal |
| `assets/core.js` | Data model, derived fields, indexes, filters + URL state, chart/map/table components, search |
| `assets/pages.js` | All pages and the hash router |
| `assets/styles.css` | Theme tokens (light/dark), layout, responsive rules, button system |
| `assets/buttons.js` | Button component helpers: `btn()`, `setBusy()`, `flashDone()` |
| `buttons.html` | Button style guide: every variant × size × state |

## Global behavior

- **URL is the state.** Global filters (`from`, `to`, `boro`, `type`, `ft`, `units`) live in the hash query and carry over through every link. Reloading or sharing a URL restores the exact view. Use **Copy link** in the filter bar.
- **Filter bar** with removable chips and **Reset**. On phones it collapses behind a *Filters* button.
- **Breadcrumbs** follow the place hierarchy (Citywide › Borough › CB › Neighborhood › Building › Job › Certificate). Browser back/forward works.
- **Search** (⌘K, Ctrl+K or `/`) does type-ahead across addresses, streets, BIN, BBL, job #, application #, CO #, neighborhoods, ZIPs, CBs and council districts.
- **Chart clicks:** a plain click drills down (opens a page). Shift-click cross-filters. The tooltip footer on each chart says which.
- **"View as table"** on every chart gives the same data as an accessible table.
- Light/dark theme (follows the OS, with a toggle button). Colors are color-blind-validated and stay consistent everywhere: job-type groups use slots 1–3 and filing types use slots 8, 7, 6, 5.

## Page map

| Route | Purpose | Links out to |
|---|---|---|
| `#/` | Citywide KPIs, monthly trend (drag to set dates), boroughs, filing types, job types, clustered map, top-10 NTAs/streets/ZIPs/buildings | Explorer, lists, boroughs, all top-10 entities, buildings (map) |
| `#/borough/:name` | KPIs vs city, trend, mix charts, CB/NTA/council rankings, map, top buildings, recent COs | CBs, NTAs, council districts, buildings, certificates, Compare (all boroughs), Explorer |
| `#/cb/:code` · `#/council/:n` · `#/zip/:zip` | Same hub template, ranked NTAs + ZIPs/streets | Borough (parent), sibling hubs, overlapping geographies |
| `#/nta/:name` | Hub + processing-time histogram + **similar neighborhoods** | Streets, ZIPs, buildings, Compare-with-similar |
| `#/street/:normalized` | Street across boroughs; raw spellings merged | Buildings, boroughs, NTAs, ZIPs, CBs |
| `#/lot/:bbl` | Tax lot. Condo billing lots (75xx) list the unit lots grouped under them | Buildings, other lots on the block |
| `#/building/:bin` | Facts, mini map, CO timeline, units over time, jobs, all COs, block neighbors | Lot, street, NTA, CB, council, ZIP, jobs, certificates |
| `#/job/:id` | Filing sequence, processing days per CO, all COs | Building, other jobs, certificates |
| `#/co/:application` | Every field, each a link. Previous/next at the same building | Job, building, lot, street, ZIP, CB, council, NTA |
| `#/processing` | Box plots by borough, job type, filing type and year; histogram; weekday×hour heatmap; top-50 outliers | Certificates, filters |
| `#/renewals` | Sankey of filing sequences per job, COs-per-job, buildings with most renewals, longest chains | Buildings, jobs |
| `#/housing` | Units from New Building **Final** COs by quarter, borough, NTA; largest projects | Boroughs, NTAs, buildings, certificates |
| `#/compare?kind=&ids=a\|b` | 2–4 places side by side: metrics table, overlaid monthly trend, filing-type mix | Each compared place |
| `#/explorer` | Virtualized table of all rows: text filter, sortable columns, column chooser, CSV export of the current filter. Every ID is linked | Every entity |
| `#/list/:kind` | Sortable, filterable index of boroughs, CBs, councils, ZIPs, NTAs, streets, lots, buildings or jobs | Each entity |
| `#/about` | Data quality report | — |

Analysis pages, lists and the explorer also accept `?scope=<kind>:<key>` (e.g. `scope=nta:Williamsburg`) to restrict them to one place.

## Derived fields

| Field | Definition |
|---|---|
| `processing_days` | Issuance date − submitted date, in whole days |
| issuance year / month / weekday / hour | From `C OF O ISSUANCE DATE` (`MM/DD/YY h:mm:ss AM/PM`, with irregular spacing handled) |
| `job_type_group` | `NEW BUILDING`, `New Building` → **New Building**; `ALTERATION TYPE 1`, `Alteration CO` → **Alteration**; `CO - New Building with Existing Elements to Remain` → **NB w/ Existing Elements** |
| `renewal` | Filing type starts with "Renewal" |
| condo lot | BBL lot number 7501–7599 |
| `units_bucket` | 0 · 1–2 · 3–10 · 11–50 · 51–200 · 200+. A blank unit count is *unknown*, never 0 |
| `cos_per_job` | Certificates sharing a `JOB FILING NAME` |
| Dwelling units KPI | Sum over buildings of the units on each building's **latest** certificate in scope, so renewals aren't counted twice |
| Housing pipeline units | New Building jobs: units on the latest Final CO per (job, building) |
| Street key | Uppercased. Ordinal words → numbers (FIFTH → 5). Ordinal suffixes dropped (5TH → 5). Abbreviations expanded (AVE → AVENUE). Leading E/W/N/S → EAST/WEST/… "Avenue of the Americas" → 6 Avenue. Result: 6,288 raw spellings → 3,964 streets |

## Data notes (differences from the original brief)

- **No rows are deduplicated.** The brief said to dedupe ~18 rows on `APPLICATION NUMBER`. In fact those 18 application numbers are each shared by two *different* certificates (different buildings, jobs and dates), and there are 0 exact duplicate rows. All 82,806 rows are kept. The second certificate of each pair gets a `-2` suffix in URLs (e.g. `#/co/CO-000091215-2`).
- The job-type value is `CO - New Building with Existing Elements to Remain` (the brief's version was cut short).
- `NUMBER OF DWELLING UNITS` contains `..208` eight times. It's treated as unknown and reported on the About page.
- Issuance dates run **Mar 2021 → Oct 10 2026**. The latest month and quarter are partial and labeled as such.
- Latitude/longitude, NTA, council district and census tract are constant per BIN in this extract, so they're stored once per building.
- 0 negative processing days. 19,036 certificates were issued the same day they were submitted (mostly renewals). They're kept and flagged.

## Implementation notes

- Filtering and aggregation run on the main thread over typed-array columns. Filtering all 82k rows takes ~4 ms, and page renders take ~50–200 ms. That made a Web Worker and pre-aggregated cubes unnecessary, and keeps `file://` working (workers are blocked there).
- Maps cluster buildings (not individual COs) with Leaflet.markercluster. They load in short chunks and bind tooltips on hover, so the citywide map (24.5k buildings) doesn't block the page.
- Library versions are pinned: ECharts 5.5.0, Leaflet 1.9.4, Leaflet.markercluster 1.5.3.

## Design notes: button system

All controls share one component. Its styles are the `buttons` section of `assets/styles.css`, and the markup comes from `btn()` in `assets/buttons.js`. See every variant, size and state side by side at [`buttons.html`](buttons.html) ([live](https://tush95ar.github.io/co-explorer/buttons.html)).

```js
btn({ label, variant: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger', size: 'sm' | 'md' | 'lg',
      href,            // → <a class="btn"> for navigation; otherwise <button type="button">
      icon, iconRight, iconOnly, block, cls, attrs })
setBusy(el, true|false)       // spinner overlay + aria-busy; the button keeps its width
flashDone(el, 'Copied ✓')     // brief success overlay, reverts after 1.5 s
```

**Performance choices**
- **Only `transform` and `opacity` animate.** The hover tint (`::before`) and lift shadow (`::after`) are pre-painted layers that fade in, so no `box-shadow` or `background` transitions trigger repaints.
- **Zero layout shift.** Every variant reserves a 1px border (transparent on ghost buttons). Loading and success text overlays the label instead of replacing it.
- **No `will-change`.** The layers are tiny and animate for 160 ms. Promoting them permanently would cost more memory than it saves.
- **Hover sits inside `@media (hover: hover) and (pointer: fine)`**, so touch screens never get stuck hover states. The press state (`scale(.97)`, 90 ms) still gives touch feedback.
- **CSS does all the effects.** JS only toggles the busy and done states.

**Accessibility**
- The focus ring (2px `--focus` outline with a 2px offset) shows only for keyboard focus (`:focus-visible`), never on mouse clicks.
- **Touch targets:** under `pointer: coarse`, an invisible `::before` grows the hit area to at least 44×44 px (chip ×, icon buttons, small buttons, sort headers). The desktop layout stays dense.
- `prefers-reduced-motion` removes all transforms, and the spinner becomes an opacity pulse. `forced-colors` mode falls back to system `ButtonText`/`ButtonFace`/`Highlight` colors.
- Toggles expose their state with `aria-expanded` ("View as table", Columns, nav) or `aria-pressed` (theme), and show a persistent "on" style.

**Measured contrast (WCAG AA)**

| | Light | Dark |
|---|---|---|
| Primary text on fill | 5.39:1 (`#fff` on `#256abf`) | 9.33:1 (`#0b0b0b` on `#86b6ef`) |
| Secondary / outline text | 19.17:1 | 17.42:1 |
| Ghost text | 6.46:1 | 8.25:1 |
| Danger text | 6.40:1 | 7.90:1 |
| Outline border vs surface / page | 3.33:1 (min) | 3.41:1 |
| Danger border | 3.57:1 (min) | 4.20:1 |
| Disabled text | 3.21:1 | 4.41:1 |

The old primary (`#2a78d6`, 4.42:1 light, 3.64:1 dark) failed AA and has been replaced.

**Re-theming.** Change the tokens in `:root` and in both dark-mode blocks (`:root[data-theme="dark"]` and the `prefers-color-scheme` block):

| Token | Controls |
|---|---|
| `--btn-radius`, `--btn-h-sm/md/lg`, `--btn-pad-x` | Shape and size |
| `--dur-fast`, `--dur`, `--ease-out` | Motion timing (press, hover) |
| `--btn-primary-bg`, `--btn-primary-fg` | Primary fill and label |
| `--btn-outline-border`, `--btn-danger-fg`, `--btn-danger-border` | Outline and destructive colors |
| `--btn-tint`, `--btn-tint-strong`, `--btn-tint-danger` | Hover/press tint layers |
| `--btn-on-bg`, `--btn-disabled-bg`, `--btn-disabled-fg`, `--btn-shadow` | Toggled-on, disabled and lift shadow |

Button colors never reuse the chart tokens (`--jt-*`, `--ft-*`, `--s-*`, `--seq*`), which are validated for color-blind safety separately.

## License

Code: [MIT](LICENSE). The certificate data in `DOB_NOW__Certificate_of_Occupancy_20261010.csv` (and the derived `data/co_data.js`) is NYC Open Data from the NYC Department of Buildings and is not covered by this license; see the [NYC Open Data terms of use](https://opendata.cityofnewyork.us/overview/#termsofuse).
