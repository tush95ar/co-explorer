#!/usr/bin/env python3
"""Turn the DOB NOW Certificate of Occupancy CSV into a compact, columnar
data file (data/co_data.js) for the CO Explorer dashboard.

Usage:  python3 prepare_data.py [path/to/csv]

Output sets `window.CO_DATA`, so the dashboard opens straight from disk
(file://) with no server or fetch().
"""
import csv
import json
import os
import re
import sys
from collections import Counter, defaultdict
from datetime import datetime, date

SRC = sys.argv[1] if len(sys.argv) > 1 else "DOB_NOW__Certificate_of_Occupancy_20261010.csv"
OUT_DIR = "data"
EPOCH = date(2000, 1, 1)

BOROUGHS = ["Manhattan", "Bronx", "Brooklyn", "Queens", "Staten Island"]  # CB first digit 1..5
JOB_TYPE_GROUP = {
    "NEW BUILDING": "New Building",
    "New Building": "New Building",
    "ALTERATION TYPE 1": "Alteration",
    "Alteration CO": "Alteration",
    "CO - New Building with Existing Elements to Remain": "NB w/ Existing Elements",
}
JTG = ["New Building", "Alteration", "NB w/ Existing Elements"]
FILING = ["Initial", "Final", "Renewal With Change", "Renewal Without Change"]

# ---------------------------------------------------------------- streets
ORDINAL_WORDS = {
    "FIRST": "1", "SECOND": "2", "THIRD": "3", "FOURTH": "4", "FIFTH": "5",
    "SIXTH": "6", "SEVENTH": "7", "EIGHTH": "8", "NINTH": "9", "TENTH": "10",
    "ELEVENTH": "11", "TWELFTH": "12",
}
SUFFIX = {
    "AVE": "AVENUE", "AV": "AVENUE", "ST": "STREET", "STR": "STREET", "PL": "PLACE",
    "BLVD": "BOULEVARD", "RD": "ROAD", "PKWY": "PARKWAY", "DR": "DRIVE", "LN": "LANE",
    "CT": "COURT", "TER": "TERRACE", "TERR": "TERRACE", "HWY": "HIGHWAY", "SQ": "SQUARE",
    "EXPY": "EXPRESSWAY", "TPKE": "TURNPIKE",
}
DIRECTION = {"E": "EAST", "W": "WEST", "N": "NORTH", "S": "SOUTH"}
WHOLE_ALIASES = {
    "AVENUE OF THE AMERICAS": "6 AVENUE",
    "AVE OF THE AMERICAS": "6 AVENUE",
}


def norm_street(raw):
    s = re.sub(r"[.,]", " ", raw.upper())
    s = re.sub(r"\s+", " ", s).strip()
    if s in WHOLE_ALIASES:
        return WHOLE_ALIASES[s]
    toks = s.split(" ")
    out = []
    for i, t in enumerate(toks):
        if t in ORDINAL_WORDS:
            t = ORDINAL_WORDS[t]
        m = re.fullmatch(r"(\d+)(ST|ND|RD|TH)", t)
        if m:
            t = m.group(1)
        if i == 0 and t in DIRECTION and len(toks) > 1:
            t = DIRECTION[t]
        if i == len(toks) - 1 and i > 0 and t in SUFFIX:
            t = SUFFIX[t]
        if t == "SAINT" or (t == "ST" and i == 0):
            t = "SAINT"
        out.append(t)
    s = " ".join(out)
    return WHOLE_ALIASES.get(s, s)


def ordinal(n):
    n = int(n)
    if 10 <= n % 100 <= 20:
        suf = "th"
    else:
        suf = {1: "st", 2: "nd", 3: "rd"}.get(n % 10, "th")
    return f"{n}{suf}"


def street_display(norm):
    words = []
    for t in norm.split(" "):
        if t.isdigit():
            words.append(ordinal(t))
        elif re.fullmatch(r"\d+-\d+", t):
            words.append(t)
        else:
            words.append(t.capitalize() if len(t) > 1 else t)
    return " ".join(words)


# ---------------------------------------------------------------- helpers
class Dict:
    def __init__(self):
        self.items, self.index = [], {}

    def id(self, v):
        if v not in self.index:
            self.index[v] = len(self.items)
            self.items.append(v)
        return self.index[v]


def parse_sub(s):
    try:
        return (datetime.strptime(s.strip(), "%m/%d/%Y").date() - EPOCH).days
    except ValueError:
        return None


def parse_iss(s):
    s = re.sub(r"\s+", " ", s.strip())
    try:
        dt = datetime.strptime(s, "%m/%d/%y %I:%M:%S %p")
    except ValueError:
        return None
    return int((dt - datetime(2000, 1, 1)).total_seconds() // 60)  # minutes since 2000-01-01


def main():
    with open(SRC, newline="", encoding="utf-8", errors="replace") as f:
        reader = csv.DictReader(f)
        header = reader.fieldnames
        rows = list(reader)
    n_raw = len(rows)

    null_counts = {c: sum(1 for r in rows if not (r.get(c) or "").strip()) for c in header}
    exact_dupes = n_raw - len({tuple(r[c] for c in header) for r in rows})
    app_counts = Counter(r["APPLICATION NUMBER"] for r in rows)
    reused_apps = sorted(a for a, c in app_counts.items() if c > 1)

    jobs, streets, house, zips, cbs, ntas, councils, tracts, bbls, jt_raw = (Dict() for _ in range(10))
    street_norm = Dict()
    street_alias = defaultdict(Counter)

    # Building table (geo is constant per BIN in this extract — verified)
    bld_index, bld = {}, {"bin": [], "lat": [], "lng": [], "nta": [], "cd": [], "tract": []}

    cols = {k: [] for k in [
        "job", "jtr", "b", "boro", "house", "st", "block", "lot", "zip", "sub", "iss",
        "ft", "cb", "app", "units", "co", "bbl"]}
    sub_fail = iss_fail = 0
    units_fail = Counter()
    seen_app = Counter()

    for r in rows:
        bin_ = r["BIN"].strip()
        if bin_ not in bld_index:
            bld_index[bin_] = len(bld["bin"])
            bld["bin"].append(int(bin_))
            lat, lng = r["latitude"].strip(), r["longitude"].strip()
            bld["lat"].append(round(float(lat) * 1e5) if lat else None)
            bld["lng"].append(round(float(lng) * 1e5) if lng else None)
            bld["nta"].append(ntas.id(r["NTA"].strip()) if r["NTA"].strip() else -1)
            bld["cd"].append(int(r["Council District"]) if r["Council District"].strip() else -1)
            bld["tract"].append(tracts.id(r["Census Tract"].replace(",", "").strip()) if r["Census Tract"].strip() else -1)

        st_raw = r["STREET NAME"].strip()
        sn = norm_street(st_raw)
        street_alias[sn][st_raw] += 1
        cols["job"].append(jobs.id(r["JOB FILING NAME"].strip()))
        cols["jtr"].append(jt_raw.id(r["JOB TYPE"].strip()))
        cols["b"].append(bld_index[bin_])
        cols["boro"].append(BOROUGHS.index(r["BOROUGH"].strip()))
        cols["house"].append(house.id(r["HOUSE NO"].strip()))
        cols["st"].append(streets.id(st_raw))
        street_norm.id(sn)
        cols["block"].append(int(r["BLOCK"]) if r["BLOCK"].strip() else -1)
        cols["lot"].append(int(r["LOT"]) if r["LOT"].strip() else -1)
        cols["zip"].append(zips.id(r["ZIP CODE"].strip()) if r["ZIP CODE"].strip() else -1)
        s = parse_sub(r["SUBMITTED DATE"]) if r["SUBMITTED DATE"].strip() else None
        if r["SUBMITTED DATE"].strip() and s is None:
            sub_fail += 1
        i = parse_iss(r["C OF O ISSUANCE DATE"]) if r["C OF O ISSUANCE DATE"].strip() else None
        if r["C OF O ISSUANCE DATE"].strip() and i is None:
            iss_fail += 1
        cols["sub"].append(s if s is not None else -1)
        cols["iss"].append(i if i is not None else -1)
        ft = r["C OF O FILING TYPE"].strip()
        cols["ft"].append(FILING.index(ft) if ft in FILING else -1)
        cols["cb"].append(cbs.id(r["COMMUNITY BOARD"].strip()) if r["COMMUNITY BOARD"].strip() else -1)
        app = r["APPLICATION NUMBER"].strip()
        seen_app[app] += 1
        # Application numbers are reused by ~18 unrelated certificates; give each
        # row a unique, stable key: CO-000091215 and CO-000091215-2
        cols["app"].append(int(app[3:]) * 10 + (seen_app[app] - 1))
        u = r["NUMBER OF DWELLING UNITS"].replace(",", "").strip()
        if u and not u.isdigit():
            units_fail[u] += 1  # e.g. "..208" — flagged, treated as unknown
            u = ""
        cols["units"].append(int(u) if u else -1)
        cols["co"].append(r["C OF O NUMBER"].strip())
        cols["bbl"].append(bbls.id(r["BBL"].strip()) if r["BBL"].strip() else -1)

    # C OF O NUMBER is "<BIN>-<seq>" for 98.8% of rows — store just the suffix when so
    co_compact = []
    for k, co in enumerate(cols["co"]):
        b = str(bld["bin"][cols["b"][k]])
        if co.startswith(b + "-"):
            co_compact.append(int(co[len(b) + 1:]))
        else:
            co_compact.append(co)
    cols["co"] = co_compact

    # data-quality stats on processing time
    neg = zero = 0
    for s, i in zip(cols["sub"], cols["iss"]):
        if s < 0 or i < 0:
            continue
        d = i // 1440 - s
        neg += d < 0
        zero += d == 0

    jt_map = {raw: JOB_TYPE_GROUP[raw] for raw in jt_raw.items}
    jtr_group = [JTG.index(JOB_TYPE_GROUP[raw]) for raw in jt_raw.items]
    st_norm_of = [street_norm.index[norm_street(s)] for s in streets.items]
    aliases = {sn: dict(c) for sn, c in street_alias.items() if len(c) > 1}

    issued = [i for i in cols["iss"] if i >= 0]
    meta = {
        "source": os.path.basename(SRC),
        "rowsRaw": n_raw,
        "exactDuplicateRows": exact_dupes,
        "reusedApplicationNumbers": reused_apps,
        "nullCounts": null_counts,
        "columns": header,
        "statusValues": dict(Counter(r["C OF O STATUS"] for r in rows)),
        "jobTypeMap": {k: {"group": v, "rows": sum(1 for r in rows if r["JOB TYPE"].strip() == k)} for k, v in jt_map.items()},
        "streetAliases": dict(sorted(aliases.items(), key=lambda kv: -sum(kv[1].values()))),
        "submittedParseFailures": sub_fail,
        "issuanceParseFailures": iss_fail,
        "negativeProcessingDays": neg,
        "zeroProcessingDays": zero,
        "unitsParseFailures": dict(units_fail),
        "issuedMin": min(issued),
        "issuedMax": max(issued),
        "generated": datetime.now().isoformat(timespec="seconds"),
    }

    data = {
        "meta": meta,
        "dict": {
            "boro": BOROUGHS, "jtg": JTG, "ft": FILING,
            "jtr": jt_raw.items, "jtrGroup": jtr_group,
            "job": jobs.items, "house": house.items, "st": streets.items,
            "stNormOf": st_norm_of, "stNorm": street_norm.items,
            "stDisplay": [street_display(s) for s in street_norm.items],
            "zip": zips.items, "cb": cbs.items, "nta": ntas.items,
            "tract": tracts.items, "bbl": bbls.items,
        },
        "bld": bld,
        "rows": cols,
    }
    os.makedirs(OUT_DIR, exist_ok=True)
    out = os.path.join(OUT_DIR, "co_data.js")
    with open(out, "w") as f:
        f.write("window.CO_DATA=")
        json.dump(data, f, separators=(",", ":"))
        f.write(";\n")
    print(f"rows {n_raw} | buildings {len(bld['bin'])} | jobs {len(jobs.items)} | "
          f"streets {len(streets.items)} -> {len(street_norm.items)} normalized | "
          f"parse failures sub={sub_fail} iss={iss_fail} | neg={neg} zero={zero} | "
          f"{out} {os.path.getsize(out) / 1e6:.1f} MB")


if __name__ == "__main__":
    main()
