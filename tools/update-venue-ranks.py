"""Rebuild assets/js/venue-ranks-data.js from pinned public ranking catalogs.

Run with Python 3, or pass --input-dir DIR to use previously downloaded JSON.
The sources are the CCF seventh-edition list, ICORE 2026 conference portal and
Tsinghua TH-CPL 2019 list. The independent projects below transcribe these
catalogs. Their MIT licenses cover their code, not the original publications.
Only factual venue names, grades, record links and edition details are used.
To adopt a new edition, review its source, revision, schema and checks together.
"""

import argparse
import json
from pathlib import Path
from urllib.request import urlopen


RAW = "https://raw.githubusercontent.com/"
CCF = "haozhou-wong/ccf-recommended-list-2026-markdown/dcf1a02335fb44dcaf785997d5c535ab41628a16/data/"
LENS = "qirunzeng/VenueRank-Lens/a68b51cbf0eaa2bce03b6a51dfffca239ceba857/WebExtension/"
CCF_SOURCE = "https://www.ccf.org.cn/Academic_Evaluation/By_category/2026-03-31/870181.shtml"
CORE_SOURCE = "https://portal.core.edu.au/conf-ranks/?by=all&source=ICORE2026"
TH_SOURCE = "https://numbda.cs.tsinghua.edu.cn/~yuwj/TH-CPL.pdf"
ROOT = Path(__file__).resolve().parents[1]
STATIC_ROOT = ROOT if (ROOT / "index.html").is_file() else ROOT / "dist"
OUTPUT = STATIC_ROOT / "assets/js/venue-ranks-data.js"

# Alternate names used on proceedings and in past editions of these series.
# Shared acronyms across series need a full-name check before adding aliases.
CONFERENCE_NAMES = {
    "CVPR": (
        "IEEE/CVF Conference on Computer Vision and Pattern Recognition",
        "IEEE Conference on Computer Vision and Pattern Recognition",
        "IEEE/CVF Computer Vision and Pattern Recognition Conference",
    ),
    "WWW": (
        "ACM Web Conference", "The Web Conference",
        "International World Wide Web Conference", "International World Wide Web Conferences",
    ),
    "KDD": (
        "KDD", "SIGKDD", "ACM SIGKDD Conference on Knowledge Discovery and Data Mining",
        "ACM SIGKDD International Conference on Knowledge Discovery and Data Mining",
        "ACM International Conference on Knowledge Discovery and Data Mining",
    ),
    "SIGMOD": (
        "ACM SIGMOD Conference", "ACM Conference on Management of Data",
        "ACM SIGMOD International Conference on Management of Data",
        "ACM Special Interest Group on Management of Data Conference",
    ),
    "NeurIPS": (
        "NIPS", "Conference on Neural Information Processing Systems",
        "Annual Conference on Neural Information Processing Systems",
        "Advances in Neural Information Processing Systems",
    ),
    "ACM MM": ("ACMMM", "ACM MM", "ACM Multimedia", "ACM International Conference on Multimedia"),
    "Eurographics": ("EG", "Eurographics", "Annual Conference of the European Association for Computer Graphics"),
    "IJCNN": (
        "IEEE International Joint Conference on Neural Networks",
        "International Joint Conference on Neural Networks",
    ),
    "FSE/ESEC": (
        "FSE", "ESEC/FSE", "FSE/ESEC", "SIGSOFT FSE",
        "ACM International Conference on the Foundations of Software Engineering",
    ),
}
SERIES_KEY = {"ACMMM": "ACM MM", "SIGKDD": "KDD", "NIPS": "NeurIPS", "EG": "Eurographics"}


def read_catalog(directory, project, filename):
    if directory:
        return json.loads((directory / filename).read_bytes())
    with urlopen(RAW + project + filename, timeout=45) as response:
        return json.load(response)


def record(abbreviation, name, rank, url, kind):
    row = [abbreviation.strip(), name.strip(), rank, url, kind]
    if not row[1] or kind not in ("conference", "journal"):
        raise ValueError(f"Invalid venue: {row!r}")
    if kind == "conference":
        key = SERIES_KEY.get(abbreviation, abbreviation)
        if abbreviation in ("FSE", "ESEC/FSE", "FSE/ESEC"):
            key = "FSE/ESEC" if "software engineering" in name.lower() else None
        aliases = [alias for alias in CONFERENCE_NAMES.get(key, ()) if alias not in row[:2]]
        if aliases:
            row.append(aliases)
    return row


def checked(edition, source, rows, count, grades, ijcnn):
    if len(rows) != count or {r[2] for r in rows} != set(grades):
        raise ValueError(f"Unexpected size or grade set for {edition}")
    if [r[2] for r in rows if r[0] == "IJCNN" and r[4] == "conference"] != [ijcnn]:
        raise ValueError(f"Unexpected IJCNN record for {edition}")
    return {"edition": edition, "source": source, "rows": sorted(rows)}


def build(directory):
    ccf = read_catalog(directory, CCF, "ccf-2026.json")
    core = read_catalog(directory, LENS, "core_catalog.json")
    th = read_catalog(directory, LENS, "th_catalog.json")
    if (ccf["metadata"]["year"], core["metadata"]["source_name"], th["metadata"]["approved"]) != (
        2026, "ICORE2026", "2019-08-13"
    ):
        raise ValueError("Unexpected source edition")

    ccf_rows = []
    for domain in ccf["domains"]:
        for kind in ("conference", "journal"):
            for rank, venues in domain[kind + "s"].items():
                for entry in venues:
                    # The CCF export links to DBLP; cite the CCF edition itself.
                    ccf_rows.append(record(entry["abbr"], entry["full_name"], rank, "", kind))

    core_rows = []
    for entry in core["entries"]:
        if entry["kind"] != "conference" or not isinstance(entry["id"], int):
            raise ValueError("Invalid ICORE conference")
        url = f"https://portal.core.edu.au/conf-ranks/{entry['id']}/"
        core_rows.append(record(entry["abbreviation"], entry["name"], entry["rank"], url, entry["kind"]))

    th_rows = []
    for entry in th["entries"]:
        if not 1 <= entry["page"] <= th["metadata"]["source_pages"]:
            raise ValueError("Invalid TH-CPL page")
        url = f"{TH_SOURCE}#page={entry['page']}"
        th_rows.append(record(entry["abbreviation"], entry["name"], entry["rank"], url, entry["kind"]))

    return {
        "ccf": checked("CCF 2026 (7th edition)", CCF_SOURCE, ccf_rows, 681, ("A", "B", "C"), "C"),
        "core": checked("ICORE 2026", CORE_SOURCE, core_rows, 825,
                        ("A*", "A", "B", "C", "Australasian B", "Australasian C"), "B"),
        "thcpl": checked("TH-CPL 2019", TH_SOURCE, th_rows, 406, ("A", "B"), "B"),
    }


def render(catalog):
    def encode(value):
        return json.dumps(value, ensure_ascii=False, separators=(",", ":"))

    blocks = []
    for key, data in catalog.items():
        rows = ",\n".join("      " + encode(row) for row in data["rows"])
        blocks.append(f'  "{key}": {{\n    "edition": {encode(data["edition"])},\n'
                      f'    "source": {encode(data["source"])},\n    "rows": [\n{rows}\n    ]\n  }}')
    return ("// Generated by tools/update-venue-ranks.py from CCF, ICORE and TH-CPL.\n"
            "// Rows: [abbreviation, full name, grade, official URL or empty, kind, optional aliases].\n"
            "globalThis.venueRankCatalog = {\n" + ",\n".join(blocks) + "\n};\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input-dir", type=Path, help="read offline copies of the three source JSON files")
    args = parser.parse_args()
    catalog = build(args.input_dir)
    OUTPUT.write_bytes(render(catalog).encode("utf-8"))
    for value in catalog.values():
        print(f"{value['edition']}: {len(value['rows'])} source entries")
