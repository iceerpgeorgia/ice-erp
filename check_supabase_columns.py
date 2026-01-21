import psycopg2

conn = psycopg2.connect('postgresql://postgres.fojbzghphznbslqwurrm:fulebimojviT1985%25@aws-1-eu-west-1.pooler.supabase.com:6543/postgres')
cur = conn.cursor()

# Check coverage
cur.execute("SELECT COUNT(*) as total, COUNT(correction_date) as with_corr_date, COUNT(exchange_rate) as with_exch_rate FROM consolidated_bank_accounts")
row = cur.fetchone()
print(f'\n=== SUPABASE consolidated_bank_accounts Coverage ===')
print(f'Total rows: {row[0]}')
print(f'With correction_date: {row[1]} ({row[1]/row[0]*100:.1f}%)')
print(f'With exchange_rate: {row[2]} ({row[2]/row[0]*100:.1f}%)')

# Get sample rows
cur.execute("SELECT id, transaction_date, correction_date, exchange_rate, account_currency_amount, nominal_amount FROM consolidated_bank_accounts WHERE exchange_rate IS NOT NULL ORDER BY id LIMIT 5")
print(f'\n=== Sample Records (first 5 with exchange_rate) ===')
for r in cur.fetchall():
    calc_nominal = round(r[4] * (1/r[3]), 2) if r[3] else None
    match = "✅" if calc_nominal == r[5] else "❌"
    print(f'ID: {r[0]:>6} | TxDate: {r[1]} | CorrDate: {r[2]} | Rate: {r[3]:>12} | AcctAmt: {r[4]:>10} | NomAmt: {r[5]:>10} {match}')

conn.close()
