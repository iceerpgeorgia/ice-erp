import os
from urllib.parse import urlparse, urlunparse
from pathlib import Path
import pandas as pd
import psycopg2
from dotenv import load_dotenv


def main():
    load_dotenv()
    url = os.environ.get("DATABASE_URL")
    if not url:
        raise RuntimeError("DATABASE_URL not set")

    parsed = urlparse(url)
    clean_url = urlunparse(parsed._replace(query=""))

    table = "GE78BG0000000893486000_BOG_GEL"
    sheet_path = Path("TR_HIST.xlsx")
    if not sheet_path.exists():
        raise FileNotFoundError(sheet_path)

    sheet = pd.read_excel(sheet_path, sheet_name="BOG_GEL")
    sheet = sheet[[
        "Account",
        "counteragent_uuid",
        "project_uuid",
        "financial_code_uuid",
        "Currency",
        "nominal_amount",
        "account_currency_amount",
        "transaction_date",
        "correction_date",
        "payment_id",
        "dockey",
        "entriesid",
    ]].copy()

    for col in ["counteragent_uuid", "project_uuid", "financial_code_uuid", "payment_id"]:
        sheet[col] = sheet[col].astype("string").str.strip()
        sheet[col] = sheet[col].where(sheet[col].notna(), None)

    for col in ["dockey", "entriesid"]:
        sheet[col] = sheet[col].astype("string").str.strip()

        sheet["Currency"] = sheet["Currency"].astype("string").str.strip()

        sheet["transaction_date"] = pd.to_datetime(sheet["transaction_date"]).dt.date
        sheet["correction_date"] = pd.to_datetime(sheet["correction_date"], errors="coerce").dt.date

        sheet["nominal_amount"] = pd.to_numeric(sheet["nominal_amount"], errors="coerce")
        sheet["account_currency_amount"] = pd.to_numeric(sheet["account_currency_amount"], errors="coerce")

        conn = psycopg2.connect(clean_url)
        query = f"""
                SELECT
                    t.dockey,
                    t.entriesid,
                    t.payment_id,
                    t.counteragent_uuid,
                    t.project_uuid,
                    t.financial_code_uuid,
                    t.nominal_amount,
                    t.account_currency_amount,
                    t.transaction_date::date AS transaction_date,
                    t.correction_date::date AS correction_date,
                    nc.code AS nominal_currency_code
                FROM "{table}" t
                LEFT JOIN currencies nc ON nc.uuid = t.nominal_currency_uuid
        """

    db = pd.read_sql_query(query, conn)

    counteragents_df = pd.read_sql_query(
        "SELECT counteragent_uuid, COALESCE(name, counteragent) AS counteragent_name FROM counteragents",
        conn,
    )
    projects_df = pd.read_sql_query(
        "SELECT project_uuid, project_name FROM projects",
        conn,
    )
    financial_codes_df = pd.read_sql_query(
        "SELECT uuid AS financial_code_uuid, code AS financial_code_code, name AS financial_code_name FROM financial_codes",
        conn,
    )
    conn.close()

    for df, col in [
        (counteragents_df, "counteragent_uuid"),
        (projects_df, "project_uuid"),
        (financial_codes_df, "financial_code_uuid"),
    ]:
        df[col] = df[col].astype("string").str.strip()

    for col in ["counteragent_uuid", "project_uuid", "financial_code_uuid", "payment_id"]:
        db[col] = db[col].astype("string").str.strip()
        db[col] = db[col].where(db[col].notna(), None)

    for col in ["dockey", "entriesid"]:
        db[col] = db[col].astype("string").str.strip()

    db["nominal_currency_code"] = db["nominal_currency_code"].astype("string").str.strip()

    counteragent_map = (
        counteragents_df.set_index("counteragent_uuid")["counteragent_name"].to_dict()
    )
    project_map = projects_df.set_index("project_uuid")["project_name"].to_dict()
    financial_code_code_map = financial_codes_df.set_index("financial_code_uuid")[
        "financial_code_code"
    ].to_dict()
    financial_code_name_map = financial_codes_df.set_index("financial_code_uuid")[
        "financial_code_name"
    ].to_dict()

    sheet["counteragent_name"] = sheet["counteragent_uuid"].map(counteragent_map)
    sheet["project_name"] = sheet["project_uuid"].map(project_map)
    sheet["financial_code_code"] = sheet["financial_code_uuid"].map(financial_code_code_map)
    sheet["financial_code_name"] = sheet["financial_code_uuid"].map(financial_code_name_map)

    db["counteragent_name"] = db["counteragent_uuid"].map(counteragent_map)
    db["project_name"] = db["project_uuid"].map(project_map)
    db["financial_code_code"] = db["financial_code_uuid"].map(financial_code_code_map)
    db["financial_code_name"] = db["financial_code_uuid"].map(financial_code_name_map)

    sheet["key"] = sheet["dockey"].fillna("") + "|" + sheet["entriesid"].fillna("")
    db["key"] = db["dockey"].fillna("") + "|" + db["entriesid"].fillna("")

    sheet["row_in_key"] = sheet.groupby("key").cumcount()
    db["row_in_key"] = db.groupby("key").cumcount()

    merged = sheet.merge(
        db,
        on=["key", "row_in_key"],
        how="outer",
        suffixes=("_sheet", "_db"),
        indicator=True,
    )

    rows = []

    def add_row(row, issue, column=None, sheet_value=None, db_value=None):
        dockey = row.get("dockey_sheet") if pd.notna(row.get("dockey_sheet")) else row.get("dockey_db")
        entriesid = (
            row.get("entriesid_sheet") if pd.notna(row.get("entriesid_sheet")) else row.get("entriesid_db")
        )
        def pick(col_base):
            sheet_col = f"{col_base}_sheet"
            db_col = f"{col_base}_db"
            sheet_val = row.get(sheet_col) if sheet_col in row else None
            db_val = row.get(db_col) if db_col in row else None
            if pd.isna(sheet_val):
                sheet_val = None
            if pd.isna(db_val):
                db_val = None
            return sheet_val, db_val

        payment_id_sheet, payment_id_db = pick("payment_id")
        counteragent_sheet, counteragent_db = pick("counteragent_uuid")
        counteragent_name_sheet, counteragent_name_db = pick("counteragent_name")
        project_sheet, project_db = pick("project_uuid")
        project_name_sheet, project_name_db = pick("project_name")
        financial_code_sheet, financial_code_db = pick("financial_code_uuid")
        financial_code_code_sheet, financial_code_code_db = pick("financial_code_code")
        financial_code_name_sheet, financial_code_name_db = pick("financial_code_name")
        transaction_date_sheet, transaction_date_db = pick("transaction_date")
        correction_date_sheet, correction_date_db = pick("correction_date")
        nominal_amount_sheet, nominal_amount_db = pick("nominal_amount")
        account_amount_sheet, account_amount_db = pick("account_currency_amount")
        currency_sheet = row.get("Currency") if "Currency" in row else None
        currency_db = row.get("nominal_currency_code") if "nominal_currency_code" in row else None
        if pd.isna(currency_sheet):
            currency_sheet = None
        if pd.isna(currency_db):
            currency_db = None
        rows.append(
            {
                "dockey": dockey,
                "entriesid": entriesid,
                "issue": issue,
                "column": column,
                "sheet_value": sheet_value,
                "db_value": db_value,
                "label": issue,
                "payment_id_sheet": payment_id_sheet,
                "payment_id_db": payment_id_db,
                "counteragent_uuid_sheet": counteragent_sheet,
                "counteragent_uuid_db": counteragent_db,
                "counteragent_name_sheet": counteragent_name_sheet,
                "counteragent_name_db": counteragent_name_db,
                "project_uuid_sheet": project_sheet,
                "project_uuid_db": project_db,
                "project_name_sheet": project_name_sheet,
                "project_name_db": project_name_db,
                "financial_code_uuid_sheet": financial_code_sheet,
                "financial_code_uuid_db": financial_code_db,
                "financial_code_code_sheet": financial_code_code_sheet,
                "financial_code_code_db": financial_code_code_db,
                "financial_code_name_sheet": financial_code_name_sheet,
                "financial_code_name_db": financial_code_name_db,
                "transaction_date_sheet": transaction_date_sheet,
                "transaction_date_db": transaction_date_db,
                "correction_date_sheet": correction_date_sheet,
                "correction_date_db": correction_date_db,
                "Currency_sheet": currency_sheet,
                "Currency_db": currency_db,
                "nominal_amount_sheet": nominal_amount_sheet,
                "nominal_amount_db": nominal_amount_db,
                "account_currency_amount_sheet": account_amount_sheet,
                "account_currency_amount_db": account_amount_db,
            }
        )

    for _, row in merged[merged["_merge"] == "left_only"].iterrows():
        add_row(row, "missing_in_db")

    for _, row in merged[merged["_merge"] == "right_only"].iterrows():
        add_row(row, "missing_in_sheet")

    matched = merged[merged["_merge"] == "both"]
    tol = 0.01

    for _, row in matched.iterrows():
        comparisons = {
            "payment_id": (row["payment_id_sheet"], row["payment_id_db"]),
            "counteragent_uuid": (row["counteragent_uuid_sheet"], row["counteragent_uuid_db"]),
            "project_uuid": (row["project_uuid_sheet"], row["project_uuid_db"]),
            "financial_code_uuid": (
                row["financial_code_uuid_sheet"],
                row["financial_code_uuid_db"],
            ),
            "transaction_date": (row["transaction_date_sheet"], row["transaction_date_db"]),
            "correction_date": (row["correction_date_sheet"], row["correction_date_db"]),
            "Currency": (row["Currency"], row["nominal_currency_code"]),
        }

        for col, (sv, dv) in comparisons.items():
            if pd.isna(sv) and pd.isna(dv):
                continue
            if (sv is None or (isinstance(sv, float) and pd.isna(sv))) and (
                dv is None or (isinstance(dv, float) and pd.isna(dv))
            ):
                continue
            if str(sv) != str(dv):
                add_row(row, "mismatch", col, sv, dv)

        s_nom = row["nominal_amount_sheet"]
        d_nom = row["nominal_amount_db"]
        if not (pd.isna(s_nom) and pd.isna(d_nom)):
            if pd.isna(s_nom) or pd.isna(d_nom) or abs(float(s_nom) - float(d_nom)) > tol:
                add_row(row, "mismatch", "nominal_amount", s_nom, d_nom)

        s_acc = row["account_currency_amount_sheet"]
        d_acc = row["account_currency_amount_db"]
        if not (pd.isna(s_acc) and pd.isna(d_acc)):
            if pd.isna(s_acc) or pd.isna(d_acc) or abs(float(s_acc) - float(d_acc)) > tol:
                add_row(row, "mismatch", "account_currency_amount", s_acc, d_acc)

    report = pd.DataFrame(rows)

    report_path = Path("bog_gel_deviation_report.xlsx")
    with pd.ExcelWriter(report_path, engine="openpyxl") as writer:
        report.to_excel(writer, index=False, sheet_name="deviations")

    print("report rows", len(report))
    print("report path", report_path.resolve())


if __name__ == "__main__":
    main()
