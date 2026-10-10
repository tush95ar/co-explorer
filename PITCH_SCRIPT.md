# CO Explorer — Pitch Script

**Length:** ~6 minutes plus Q&A · **Format:** spoken, with a live demo
**Setup before you start:** open the dashboard at the Overview page (`#/`), light mode, filters cleared. Have a second tab ready at `#/processing`.

> Stage directions are in *[brackets]*. Spoken lines are plain text. Every number below comes from the dashboard itself, so you can show it live.

---

## 1. Hook (30 sec)

*[Overview page on screen. Don't click anything yet.]*

Since March 2021, New York City has issued **82,806 Certificates of Occupancy** through DOB NOW. Each one is the legal sign-off that a building is safe to live or work in.

Together they cover **24,541 buildings** and **25,283 construction jobs**. That makes this one of the best records we have of how the city is actually being built.

Today, almost no one can use it.

## 2. The problem (45 sec)

The public data is one flat spreadsheet with 24 columns, and it fights back:

- The same job type is spelled five different ways.
- Fifth Avenue appears under ten different spellings.
- Some application numbers are shared by two unrelated buildings.
- A quarter of the unit counts are blank.

So a simple question, like "how long does a CO take in Queens?" or "how much new housing did Brooklyn finish last year?", turns into an afternoon of cleaning data. And the answer lives in a spreadsheet nobody else can check.

**CO Explorer turns that file into something you can click through and question in seconds.**

## 3. Live demo (3 min)

### a) Start citywide, then zoom in — "every number is a door"
*[Point at the KPI tiles.]*
Here's the whole city at a glance: certificates, buildings, jobs, about **525,000 dwelling units** on the latest certificates, and a median of **8 days** from submission to issuance.

*[Drag across 2024 on the monthly chart.]*
I just set the date range by dragging. Every chart, map and table on the site now shows 2024 only, and that filter stays with me wherever I go.

*[Click the Brooklyn bar.]*
One click takes me to Brooklyn. It shows Brooklyn's numbers next to the city average, its community boards, its neighborhoods and its map.

*[Click a neighborhood, e.g. Williamsburg, then a building on the map.]*
From neighborhood to building, and the building page shows its full history: the first certificate, every renewal, the final one, and the unit count over time.

*[Point at the breadcrumb.]*
The breadcrumb always tells me where I am: Citywide › Brooklyn › CB 301 › Williamsburg › the building. I'm never lost, and every page links up, down and sideways to related places.

### b) The "aha" — a number that looks good but isn't
*[Switch to the Processing Time tab.]*
Here's why exploring beats a static report. At first glance **Manhattan is the fastest borough, with a median of 1 day.**

*[Set Filing type = Final in the filter bar.]*
But 79% of Manhattan's certificates are routine renewals that are approved the same day. Look only at Final certificates, and **Manhattan becomes the slowest borough: a median of 61 days, about four times Staten Island's 15.**

A spreadsheet summary would have told you the opposite. Here it took one filter.

### c) Housing — the question leaders actually ask
*[Open Housing pipeline.]*
Counting only new buildings that received a Final certificate, the city delivered about **139,000 dwelling units** across **7,302 projects**. **72%** of those units came from large projects of 51 or more units, and **Brooklyn leads** with roughly 48,000.

*[Click a neighborhood bar, then a project.]*
Every bar opens the neighborhood behind it, and every project opens its certificate.

### d) Trust and sharing
*[Click Copy link.]*
Everything I just did is saved in the link. If I send it to you, you'll see exactly this view with the same filters.

*[Open Data explorer, then About the data.]*
If you want the raw rows, they're all here: sortable, searchable and exportable to CSV. Every data-quality decision is published. We merged 6,288 street spellings into 3,964 streets, kept the shared application numbers rather than deleting them, and flagged bad unit counts instead of guessing. Nothing is hidden.

*[Press ⌘K and type an address.]*
And if you know what you're looking for, search finds any address, BIN, lot, job or certificate number instantly.

## 4. Who it's for (30 sec)

- **Planners and policy staff:** track housing delivery by neighborhood, without waiting for a quarterly report.
- **DOB operations:** spot where certificates stall, by borough, job type or filing type.
- **Council offices and community boards:** see what got built in their district, building by building.
- **Developers, lenders and journalists:** get a building's full certificate history in one click.

## 5. Close and ask (30 sec)

The data was always public. What was missing was a way to move from a citywide number to a single building, and back again, without losing the thread.

CO Explorer runs in any browser with nothing to install, rebuilds from a new data extract with one command, and every view can be shared as a link.

**The ask:** *[choose one]*
- Give us **two weeks with your team**: we'll load the latest extract and build the three views you check most.
- Or: **let us host it internally**, so anyone with the link can use it.

Thank you. Who wants to pick a building?

*[Hand someone the ⌘K search. Letting the audience pick an address is the strongest finish.]*

---

## 60-second version (elevator / hallway)

> NYC has issued 82,806 Certificates of Occupancy since 2021, covering 24,500 buildings. The public data is a messy spreadsheet: five spellings of the same job type, ten spellings of Fifth Avenue. CO Explorer turns it into a dashboard where every number is a link. Start citywide, click into a borough, a neighborhood, a building, a single certificate. Filters follow you and every view is a shareable link. In one click it shows that Manhattan, which looks fastest at a 1-day median, is actually the slowest borough for Final certificates: a median of 61 days, about four times Staten Island's 15. It runs in any browser and rebuilds from the next data release with one command. Can I show you your district?

---

## Q&A prep

| Likely question | Answer |
|---|---|
| *Where does the data come from?* | NYC DOB NOW: Certificate of Occupancy open data, extract dated Oct 10 2026. All 82,806 rows are used. |
| *How current is it?* | As current as the latest extract. Rerun `prepare_data.py` on a new CSV and reload. The latest month is labeled as partial. |
| *Is the 525k units figure double-counted?* | No. Each building is counted once, using its latest certificate. The housing page is stricter: new buildings with a Final CO only (~139k units). |
| *Why are some unit counts missing?* | About 24% of certificates leave the unit field blank in the source data. We treat blank as unknown, not zero, and say so on every page. |
| *Did you remove duplicates?* | We checked. There are no exact duplicate rows. 18 application numbers are reused by two different certificates, so we kept both and labeled them. |
| *What's "processing time"?* | Issuance date minus submitted date, in days. 23% of certificates are issued the same day, mostly renewals. |
| *Is it accessible?* | Every chart has a "view as table" option. It supports keyboard navigation, a color-blind-safe palette, dark mode, and phone screens. |
| *What would it take to deploy?* | It's static files. Any web server or internal share works, with no database or login. |
| *What's next?* | Possible extensions: link to permits and violations by BIN, add saved views and alerts, and track project progress from Initial to Final CO. |

---

## Presenter checklist

- [ ] Filters cleared and Overview loaded before you start
- [ ] Internet on (charts and map tiles load from a CDN)
- [ ] Rehearse the Processing Time "aha" (Filing type = Final) — it's the moment people remember
- [ ] Pick a backup building address in case the audience goes quiet
- [ ] Zoom the browser to 110–125% if presenting on a projector
