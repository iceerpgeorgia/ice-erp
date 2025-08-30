#!/usr/bin/env python3
"""
ingest_from_excel_to_postgres.py
Loads data from Base_Migrate.xlsx into Postgres based on 'fields' mapping.
"""
import argparse
import pandas as pd
from sqlalchemy import create_engine, text

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", required=True, help="Postgres DATABASE_URL")
    ap.add_argument("--excel", required=True, help="Path to Base_Migrate.xlsx")
    args = ap.parse_args()

    engine = create_engine(args.db, future=True)
    xl = pd.ExcelFile(args.excel)

    fields = pd.read_excel(xl, sheet_name="fields")
    fields.columns = [c.strip() for c in fields.columns]

    table_cols = {}
    table_entity = {}
    for _, r in fields.iterrows():
        entity = str(r["entity"]).strip()
        t = str(r["db_table"]).strip()
        c = str(r["db_column"]).strip()
        if not t or not c: continue
        table_cols.setdefault(t, [])
        if c not in table_cols[t]:
            table_cols[t].append(c)
        if t not in table_entity and entity:
            table_entity[t] = entity

    def find_sheet(xl, target: str):
        low = {name.lower(): name for name in xl.sheet_names}
        t = target.lower()
        if t in low: return low[t]
        alt = target.replace("_"," ").strip().lower()
        for k, v in low.items():
            if k == alt or k.replace(" ","") == alt.replace(" ",""):
                return v
        return None

    with engine.begin() as conn:
        for t, cols in table_cols.items():
            sheet_key = table_entity.get(t, t)
            ws = find_sheet(xl, sheet_key)
            if not ws:
                print(f"[WARN] No worksheet matched for table '{t}' (lookup key '{sheet_key}'). Skipping.")
                continue
            df = pd.read_excel(xl, sheet_name=ws)
            keep = [c for c in cols if c in df.columns]
            if not keep:
                print(f"[WARN] No mapped columns found in sheet '{ws}' for table '{t}', skipping.")
                continue

            ins_cols = ', '.join('"' + c + '"' for c in keep)
            params   = ', '.join(':' + c for c in keep)
            sql = 'INSERT INTO "' + t + '" (' + ins_cols + ') VALUES (' + params + ')'
            n = 0
            for _, row in df.iterrows():
                params_dict = {}
                for c in keep:
                    val = row[c]
                    if pd.isna(val): val = None
                    if isinstance(val, str) and val.lower() in ("true","false","yes","no"):
                        val = val.lower() in ("true","yes")
                    params_dict[c] = val
                conn.execute(text(sql), params_dict)
                n += 1
            print(f"Inserted {n} rows into {t} from sheet '{ws}'.")

if __name__ == "__main__":
    main()
