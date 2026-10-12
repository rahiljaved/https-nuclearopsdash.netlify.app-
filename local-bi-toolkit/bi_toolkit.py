#!/usr/bin/env python3
"""
Local BI Toolkit - offline Power BI file analyzer and Excel automation.

Runs entirely on this computer. It makes NO network connections: every
socket is blocked at startup, so any accidental attempt to reach the
internet raises an error instead of sending data anywhere.

Commands
  pbi      <file.pbix|file.pbit> [-o report.xlsx]   Document a Power BI file
  profile  <file-or-folder> [-o profile.xlsx]       Data-quality profile of Excel/CSV
  combine  <folder> [--sheet NAME] [-o out.xlsx]    Stack many Excel/CSV files into one
  compare  <old.xlsx> <new.xlsx> --key COL [-o diff.xlsx]   Row-level differences
  auto     <files/folders...>                        Drag-and-drop mode (see drop_files_here.bat)
"""
import argparse
import io
import json
import socket
import struct
import sys
import zipfile
from datetime import datetime
from pathlib import Path


# --------------------------------------------------------------------------
# Offline guarantee: disable all networking before anything else runs.
# --------------------------------------------------------------------------
class NetworkBlockedError(RuntimeError):
    pass


def _blocked(*_args, **_kwargs):
    raise NetworkBlockedError("Local BI Toolkit is offline-only; network access is disabled.")


socket.socket.connect = _blocked
socket.socket.connect_ex = _blocked
socket.create_connection = _blocked
socket.getaddrinfo = _blocked

import pandas as pd  # noqa: E402  (imported after the network block on purpose)

EXCEL_EXT = {".xlsx", ".xlsm", ".xls"}
TABULAR_EXT = EXCEL_EXT | {".csv"}
OUTPUT_MARKERS = ("_profile_", "_combined_", "_pbi_report_", "_compare_")  # our own result files


def log(msg):
    print(f"[{datetime.now():%H:%M:%S}] {msg}")


def default_out(name):
    return Path(f"{name}_{datetime.now():%Y%m%d_%H%M%S}.xlsx")


def write_sheets(path, sheets):
    with pd.ExcelWriter(path, engine="openpyxl") as xw:
        for name, df in sheets.items():
            if df is None or df.empty:
                df = pd.DataFrame({"info": ["(nothing found)"]})
            df.to_excel(xw, sheet_name=name[:31], index=False)
            ws = xw.sheets[name[:31]]
            for col in ws.columns:
                width = max(len(str(c.value or "")) for c in col[:200])
                ws.column_dimensions[col[0].column_letter].width = min(max(10, width + 2), 80)
            ws.freeze_panes = "A2"
    log(f"Saved {path.resolve()}")


# --------------------------------------------------------------------------
# Power BI (.pbix / .pbit)
# --------------------------------------------------------------------------
def _read_json_part(zf, name):
    raw = zf.read(name)
    for enc in ("utf-16-le", "utf-8-sig", "utf-8"):
        try:
            text = raw.decode(enc)
            return json.loads(text.lstrip("﻿"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            continue
    return None


def _fields_from_query(query):
    names = []
    for sel in (query or {}).get("Select", []):
        if sel.get("Name"):
            names.append(sel["Name"])
    return names


def parse_layout(layout):
    pages, visuals = [], []
    for i, sec in enumerate(layout.get("sections", []), 1):
        page = sec.get("displayName", sec.get("name"))
        containers = sec.get("visualContainers", [])
        pages.append({"order": i, "page": page, "visual_count": len(containers),
                      "width": sec.get("width"), "height": sec.get("height")})
        for vc in containers:
            try:
                cfg = json.loads(vc.get("config", "{}"))
            except json.JSONDecodeError:
                cfg = {}
            sv = cfg.get("singleVisual", {})
            title = ""
            try:
                title = sv["vcObjects"]["title"][0]["properties"]["text"]["expr"]["Literal"]["Value"].strip("'")
            except (KeyError, IndexError, TypeError):
                pass
            fields = _fields_from_query(sv.get("prototypeQuery"))
            visuals.append({"page": page, "visual_type": sv.get("visualType", "group/other"),
                            "title": title, "fields_used": ", ".join(fields),
                            "x": vc.get("x"), "y": vc.get("y")})
    return pd.DataFrame(pages), pd.DataFrame(visuals)


def parse_model_schema(schema):
    model = schema.get("model", {})
    tables, columns, measures, rels, queries = [], [], [], [], []
    for t in model.get("tables", []):
        tname = t.get("name")
        if tname.startswith(("LocalDateTable_", "DateTableTemplate_")):
            continue
        tables.append({"table": tname, "columns": len(t.get("columns", [])),
                       "measures": len(t.get("measures", [])), "hidden": t.get("isHidden", False)})
        for c in t.get("columns", []):
            columns.append({"table": tname, "column": c.get("name"), "data_type": c.get("dataType"),
                            "type": c.get("type", "data"), "expression": _join(c.get("expression")),
                            "hidden": c.get("isHidden", False)})
        for m in t.get("measures", []):
            measures.append({"table": tname, "measure": m.get("name"),
                             "dax": _join(m.get("expression")), "format": m.get("formatString", "")})
        for p in t.get("partitions", []):
            src = p.get("source", {})
            queries.append({"table": tname, "type": src.get("type"), "power_query_m": _join(src.get("expression"))})
    for r in model.get("relationships", []):
        rels.append({"from": f"{r.get('fromTable')}[{r.get('fromColumn')}]",
                     "to": f"{r.get('toTable')}[{r.get('toColumn')}]",
                     "cardinality": f"{r.get('fromCardinality', 'many')}-to-{r.get('toCardinality', 'one')}",
                     "cross_filter": r.get("crossFilteringBehavior", "oneDirection"),
                     "active": r.get("isActive", True)})
    return {k: pd.DataFrame(v) for k, v in
            {"Tables": tables, "Columns": columns, "Measures": measures,
             "Relationships": rels, "PowerQuery": queries}.items()}


def _join(expr):
    return "\n".join(expr) if isinstance(expr, list) else (expr or "")


def parse_datamashup(blob):
    """DataMashup = 4-byte version + 4-byte length + embedded zip with Formulas/Section1.m"""
    try:
        size = struct.unpack("<I", blob[4:8])[0]
        with zipfile.ZipFile(io.BytesIO(blob[8:8 + size])) as inner:
            return inner.read("Formulas/Section1.m").decode("utf-8", "replace")
    except Exception:
        return ""


def split_m_queries(section_text):
    rows = []
    for chunk in section_text.split("shared ")[1:]:
        name, _, body = chunk.partition("=")
        rows.append({"query": name.strip().strip('#"'), "power_query_m": body.strip().rstrip(";")})
    return pd.DataFrame(rows)


def cmd_pbi(args):
    path = Path(args.file)
    log(f"Reading {path.name} locally")
    sheets = {}
    with zipfile.ZipFile(path) as zf:
        names = zf.namelist()
        sheets["Contents"] = pd.DataFrame(
            [{"part": i.filename, "size_kb": round(i.file_size / 1024, 1)} for i in zf.infolist()])

        if "Report/Layout" in names:
            layout = _read_json_part(zf, "Report/Layout") or {}
            sheets["Pages"], sheets["Visuals"] = parse_layout(layout)
        if "DataModelSchema" in names:  # present in .pbit templates
            sheets.update(parse_model_schema(_read_json_part(zf, "DataModelSchema") or {}))
        elif "DataModel" in names:
            sheets["Note"] = pd.DataFrame({"info": [
                ".pbix stores its model in a compressed binary. For full table/measure/DAX "
                "documentation, open the file in Power BI Desktop and use File > Export > "
                "Power BI template (.pbit), then run this tool on the .pbit."]})
        if "DataMashup" in names and "PowerQuery" not in sheets:
            sheets["PowerQuery"] = split_m_queries(parse_datamashup(zf.read("DataMashup")))
        if "Connections" in names:
            conn = _read_json_part(zf, "Connections") or {}
            sheets["Connections"] = pd.json_normalize(conn.get("Connections", [conn]))

    summary = [{"item": "File", "value": str(path.resolve())},
               {"item": "Analysed", "value": f"{datetime.now():%Y-%m-%d %H:%M}"}]
    for k, df in sheets.items():
        if k not in ("Contents", "Note"):
            summary.append({"item": f"{k} count", "value": len(df)})
    out = Path(args.out) if args.out else default_out(f"{path.stem}_pbi_report")
    write_sheets(out, {"Summary": pd.DataFrame(summary), **sheets})


# --------------------------------------------------------------------------
# Excel / CSV helpers
# --------------------------------------------------------------------------
def iter_files(target):
    p = Path(target)
    if p.is_file():
        yield p
    else:
        for f in sorted(p.rglob("*")):
            if (f.suffix.lower() in TABULAR_EXT and not f.name.startswith("~$")
                    and not any(m in f.name for m in OUTPUT_MARKERS)):
                yield f


def read_tables(path, sheet=None):
    if path.suffix.lower() == ".csv":
        yield "csv", pd.read_csv(path)
        return
    book = pd.read_excel(path, sheet_name=sheet if sheet else None)
    if isinstance(book, pd.DataFrame):
        yield sheet, book
    else:
        yield from book.items()


def cmd_profile(args):
    overview, cols = [], []
    for f in iter_files(args.target):
        log(f"Profiling {f.name}")
        for sheet, df in read_tables(f):
            overview.append({"file": f.name, "sheet": sheet, "rows": len(df), "columns": df.shape[1],
                             "duplicate_rows": int(df.duplicated().sum()),
                             "empty_rows": int(df.isna().all(axis=1).sum())})
            for c in df.columns:
                s = df[c]
                num = pd.api.types.is_numeric_dtype(s)
                cols.append({"file": f.name, "sheet": sheet, "column": str(c), "dtype": str(s.dtype),
                             "blanks": int(s.isna().sum()),
                             "blank_%": round(100 * s.isna().mean(), 1) if len(s) else 0,
                             "distinct": int(s.nunique()),
                             "min": s.min() if num else "", "max": s.max() if num else "",
                             "sample": ", ".join(map(str, s.dropna().unique()[:3]))})
    out = Path(args.out) if args.out else default_out("results_profile")
    write_sheets(out, {"Overview": pd.DataFrame(overview), "Columns": pd.DataFrame(cols)})


def cmd_combine(args):
    frames = []
    for f in iter_files(args.folder):
        for sheet, df in read_tables(f, args.sheet):
            df = df.dropna(how="all")
            df.insert(0, "source_sheet", sheet)
            df.insert(0, "source_file", f.name)
            frames.append(df)
            log(f"Added {f.name} [{sheet}] - {len(df)} rows")
    if not frames:
        sys.exit("No Excel/CSV files found.")
    combined = pd.concat(frames, ignore_index=True, sort=False)
    out = Path(args.out) if args.out else default_out("results_combined")
    write_sheets(out, {"Combined": combined})
    log(f"Total rows: {len(combined)} from {len(frames)} sheets")


def cmd_compare(args):
    a = next(read_tables(Path(args.old), args.sheet))[1]
    b = next(read_tables(Path(args.new), args.sheet))[1]
    k = args.key
    a, b = a.set_index(k), b.set_index(k)
    added = b.loc[b.index.difference(a.index)].reset_index()
    removed = a.loc[a.index.difference(b.index)].reset_index()
    changes = []
    shared_cols = [c for c in a.columns if c in b.columns]
    for key in a.index.intersection(b.index):
        for c in shared_cols:
            ov, nv = a.at[key, c], b.at[key, c]
            if not (pd.isna(ov) and pd.isna(nv)) and ov != nv:
                changes.append({k: key, "column": c, "old": ov, "new": nv})
    out = Path(args.out) if args.out else default_out("results_compare")
    write_sheets(out, {"Changed": pd.DataFrame(changes), "Added": added, "Removed": removed})
    log(f"{len(changes)} changed cells, {len(added)} added rows, {len(removed)} removed rows")


def cmd_auto(args):
    """Pick the right job for each dropped item; save results next to it."""
    stamp = f"{datetime.now():%Y%m%d_%H%M%S}"
    for item in map(Path, args.paths):
        ext = item.suffix.lower()
        if ext in (".pbix", ".pbit"):
            cmd_pbi(argparse.Namespace(file=item, out=item.with_name(f"{item.stem}_pbi_report_{stamp}.xlsx")))
        elif item.is_dir():
            cmd_profile(argparse.Namespace(target=item, out=item / f"_profile_{stamp}.xlsx"))
            cmd_combine(argparse.Namespace(folder=item, sheet=None, out=item / f"_combined_{stamp}.xlsx"))
        elif ext in TABULAR_EXT:
            cmd_profile(argparse.Namespace(target=item, out=item.with_name(f"{item.stem}_profile_{stamp}.xlsx")))
        else:
            log(f"Skipped {item.name}: not a Power BI, Excel/CSV file or folder")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("pbi"); p.add_argument("file"); p.add_argument("-o", "--out"); p.set_defaults(fn=cmd_pbi)
    p = sub.add_parser("profile"); p.add_argument("target"); p.add_argument("-o", "--out"); p.set_defaults(fn=cmd_profile)
    p = sub.add_parser("combine"); p.add_argument("folder"); p.add_argument("--sheet")
    p.add_argument("-o", "--out"); p.set_defaults(fn=cmd_combine)
    p = sub.add_parser("compare"); p.add_argument("old"); p.add_argument("new"); p.add_argument("--key", required=True)
    p.add_argument("--sheet"); p.add_argument("-o", "--out"); p.set_defaults(fn=cmd_compare)
    p = sub.add_parser("auto"); p.add_argument("paths", nargs="+"); p.set_defaults(fn=cmd_auto)
    args = ap.parse_args()
    args.fn(args)


if __name__ == "__main__":
    main()
