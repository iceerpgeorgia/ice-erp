
#!/usr/bin/env python3
"""
ingest_google_to_postgres.py

Reads an Excel mapping file (sources + fields) describing where the data
lives in Google Sheets and how it maps into the Postgres schema.
Fetches → transforms → loads into Postgres.

Usage:
  python ingest_google_to_postgres.py --config ingest_mapping_template.xlsx --db "postgresql://..."
Options:
  --truncate TableA,TableB,...   Truncate tables before load (RESTART IDENTITY CASCADE)
  --limit-rows N                 Limit rows per entity (debug/dev)
  --dry-run                      Print stats but do not write to DB

Auth (Google):
  - Use a Google Service Account with Sheets API enabled.
  - Share each spreadsheet with the service account email.
  - Set env var GOOGLE_APPLICATION_CREDENTIALS=<path to service-account.json>

Install:
  pip install google-api-python-client google-auth google-auth-httplib2 google-auth-oauthlib
  pip install pandas openpyxl sqlalchemy psycopg2-binary python-dotenv
"""
import argparse
import os
import sys
import time
from typing import Optional, Any, Tuple

import pandas as pd
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine

# Google
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

SCOPES = ["https://www.googleapis.com/auth/spreadsheets.readonly"]

def log(msg: str):
    print(msg, flush=True)

# --------------- Google Sheets helpers ---------------

def build_sheets_service():
    key_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
    if not key_path or not os.path.isfile(key_path):
        raise SystemExit("Set GOOGLE_APPLICATION_CREDENTIALS to your service account JSON path.")
    creds = service_account.Credentials.from_service_account_file(key_path, scopes=SCOPES)
    return build("sheets", "v4", credentials=creds, cache_discovery=False)

def read_sheet_to_df(svc, spreadsheet_id: str, sheet_name: str, header_row: int = 1, range_a1: Optional[str] = None) -> pd.DataFrame:
    # If range not provided, read a large band
    rng = f"'{sheet_name}'!{range_a1}" if range_a1 else f"'{sheet_name}'!A1:ZZZ100000"
    values = []
    backoff = 1.0
    for attempt in range(6):
        try:
            resp = svc.spreadsheets().values().get(
                spreadsheetId=spreadsheet_id,
                range=rng,
                valueRenderOption="UNFORMATTED_VALUE",
                dateTimeRenderOption="FORMATTED_STRING",
            ).execute()
            values = resp.get("values", [])
            break
        except HttpError as e:
            log(f"[WARN] Sheets read error (attempt {attempt+1}): {e}. Retrying in {backoff:.1f}s...")
            time.sleep(backoff)
            backoff = min(backoff * 2, 30.0)
    if not values:
        return pd.DataFrame()

    max_len = max(len(r) for r in values)
    values = [r + [""]*(max_len - len(r)) for r in values]
    hdr_idx = max(1, header_row) - 1
    headers = [str(h or "").strip() for h in values[hdr_idx]]
    data = values[hdr_idx+1:]
    return pd.DataFrame(data, columns=headers)

# --------------- Mapping loader ---------------

def load_mapping(xlsx_path: str) -> Tuple[pd.DataFrame, pd.DataFrame]:
    xl = pd.ExcelFile(xlsx_path)
    sources = pd.read_excel(xl, "sources")
    fields  = pd.read_excel(xl, "fields")
    sources.columns = [c.strip() for c in sources.columns]
    fields.columns  = [c.strip() for c in fields.columns]
    return sources, fields

# --------------- Transforms ---------------

def apply_transform(val: Any, transform: Optional[str]) -> Any:
    if transform is None or str(transform).strip() == "":
        return val
    t = str(transform).strip().lower()
    if val in (None, ""):
        return None
    try:
        if t == "date":
            return pd.to_datetime(val).date()
        if t == "timestamp":
            return pd.to_datetime(val).to_pydatetime()
        if t in ("decimal","money","number"):
            s = str(val).replace(",", ".").strip()
            return float(s) if s != "" else None
        if t == "int":
            return int(float(val))
        if t == "lower":
            return str(val).lower()
        if t == "upper":
            return str(val).upper()
        if t == "iban_list":
            # handled in counteragents ingestion
            return val
    except Exception:
        return None
    return val

# --------------- DB helpers ---------------

def get_engine(db_url: str) -> Engine:
    return create_engine(db_url, pool_pre_ping=True, future=True)

def upsert_counteragents(engine: Engine, df: pd.DataFrame, fmap: pd.DataFrame, limit_rows: Optional[int] = None, dry_run: bool = False):
    guid_col = _map_get(fmap, "Counteragent", "id")
    name_col = _map_get(fmap, "Counteragent", "displayName")
    iban_col = _map_get(fmap, "BankAccount", "iban")

    rows = []
    ib_rows = []

    for idx, r in df.iterrows():
        if limit_rows and idx >= limit_rows:
            break
        guid = str(r.get(guid_col, "") or "").strip()
        name = str(r.get(name_col, "") or "").strip()
        if not guid and not name:
            continue
        rows.append({"id": guid, "displayName": name})

        raw_ibans = str(r.get(iban_col, "") or "").strip() if iban_col else ""
        if raw_ibans:
            items = [s.strip() for s in raw_ibans.split(",") if s.strip()]
            for ord_idx, iban in enumerate(items, start=1):
                ib_rows.append({"counteragentId": guid, "iban": iban, "ordinal": ord_idx})

    log(f"  Counteragent upserts: {len(rows)}; BankAccount upserts: {len(ib_rows)}")
    if dry_run:
        return
    with engine.begin() as conn:
        for row in rows:
            conn.execute(text("""
                INSERT INTO "Counteragent"(id, "displayName")
                VALUES (:id, :displayName)
                ON CONFLICT (id) DO UPDATE SET "displayName" = EXCLUDED."displayName"
            """), row)
        for row in ib_rows:
            conn.execute(text("""
                INSERT INTO "BankAccount"("counteragentId", iban, ordinal)
                VALUES (:counteragentId, :iban, :ordinal)
                ON CONFLICT ("counteragentId", iban) DO UPDATE SET ordinal = EXCLUDED.ordinal
            """), row)

def upsert_accrualmap(engine: Engine, df: pd.DataFrame, fmap: pd.DataFrame, limit_rows: Optional[int] = None, dry_run: bool = False):
    id14_col = _map_get(fmap, "AccrualMap", "id14")
    caid_col = _map_get(fmap, "AccrualMap", "counteragentId")
    rows = []
    for idx, r in df.iterrows():
        if limit_rows and idx >= limit_rows:
            break
        id14 = str(r.get(id14_col, "") or "").strip()
        caid = str(r.get(caid_col, "") or "").strip()
        if not id14:
            continue
        rows.append({"id14": id14, "counteragentId": caid or None})
    log(f"  AccrualMap upserts: {len(rows)}")
    if dry_run:
        return
    with engine.begin() as conn:
        for row in rows:
            conn.execute(text("""
                INSERT INTO "AccrualMap"(id14, "counteragentId")
                VALUES (:id14, :counteragentId)
                ON CONFLICT (id14) DO UPDATE SET "counteragentId" = EXCLUDED."counteragentId"
            """), row)

def insert_erp_entries(engine: Engine, df: pd.DataFrame, fmap: pd.DataFrame, limit_rows: Optional[int] = None, dry_run: bool = False):
    rows = []
    for idx, r in df.iterrows():
        if limit_rows and idx >= limit_rows:
            break
        row = {}
        for _, m in fmap.iterrows():
            if str(m["db_table"]).strip() != "ErpEntry":
                continue
            sheet_col = str(m["sheet_column"]).strip()
            db_col    = str(m["db_column"]).strip()
            transform = str(m.get("transform") or "").strip() or None
            val = r.get(sheet_col, None)
            val = apply_transform(val, transform)
            row[db_col] = val
        if not str(row.get("id14") or "").strip():
            continue
        rows.append(row)
    log(f"  ErpEntry inserts: {len(rows)}")
    if dry_run or not rows:
        return
    with engine.begin() as conn:
        for row in rows:
            cols = ", ".join(f'"{k}"' for k in row.keys())
            params = ", ".join(f':{k}' for k in row.keys())
            sql = f'INSERT INTO "ErpEntry"({cols}) VALUES ({params})'
            conn.execute(text(sql), row)

def _map_get(fmap: pd.DataFrame, db_table: str, db_column: str) -> Optional[str]:
    v = fmap.loc[(fmap["db_table"]==db_table) & (fmap["db_column"]==db_column), "sheet_column"].values
    return v[0] if len(v) else None

# --------------- Orchestration ---------------

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--config", required=True, help="Path to mapping xlsx")
    ap.add_argument("--db", default=os.environ.get("DATABASE_URL",""), help="Postgres DATABASE_URL")
    ap.add_argument("--truncate", default="", help="Comma-separated tables to TRUNCATE (e.g. Counteragent,BankAccount,AccrualMap,ErpEntry)")
    ap.add_argument("--limit-rows", type=int, default=None, help="Limit rows per entity (debug)")
    ap.add_argument("--dry-run", action="store_true", help="Print but don’t write")
    args = ap.parse_args()

    if not args.db:
        raise SystemExit("Provide --db or set DATABASE_URL")

    engine = create_engine(args.db, pool_pre_ping=True, future=True)
    svc = build_sheets_service()

    # Load mapping
    sources = pd.read_excel(args.config, sheet_name="sources")
    fields  = pd.read_excel(args.config, sheet_name="fields")
    sources.columns = [c.strip() for c in sources.columns]
    fields.columns  = [c.strip() for c in fields.columns]

    # Optional truncate
    if args.truncate:
        targets = [t.strip() for t in args.truncate.split(",") if t.strip()]
        with engine.begin() as conn:
            for t in targets:
                log(f"TRUNCATE {t} ...")
                conn.execute(text(f'TRUNCATE TABLE "{t}" RESTART IDENTITY CASCADE;'))

    # Process in dependency order
    plan = ["counteragents", "accruals_map", "erp_entries"]
    for entity in plan:
        row = sources.loc[sources["entity"]==entity]
        if row.empty:
            log(f"[WARN] No 'sources' row for entity={entity}, skipping.")
            continue
        sr = row.iloc[0]
        spreadsheet_id = str(sr["spreadsheet_id"]).strip()
        sheet_name     = str(sr["sheet_name"]).strip()
        header_row     = int(sr["header_row"])
        range_a1       = str(sr.get("range_a1") or "").strip() or None

        log(f"\nReading {entity}: {spreadsheet_id} :: {sheet_name} (header_row={header_row}, range={range_a1 or 'FULL'})")
        df = read_sheet_to_df(svc, spreadsheet_id, sheet_name, header_row, range_a1)
        log(f" -> {len(df)} rows")
        fmap = fields.loc[fields["entity"]==entity].copy()

        if entity == "counteragents":
            upsert_counteragents(engine, df, fmap, args.limit_rows, args.dry_run)
        elif entity == "accruals_map":
            upsert_accrualmap(engine, df, fmap, args.limit_rows, args.dry_run)
        elif entity == "erp_entries":
            insert_erp_entries(engine, df, fmap, args.limit_rows, args.dry_run)

    log("\nIngestion complete.")

if __name__ == "__main__":
    main()
