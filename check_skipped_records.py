import psycopg2

url = 'postgresql://postgres.fojbzghphznbslqwurrm:fulebimojviT1985%25@aws-1-eu-west-1.pooler.supabase.com:5432/postgres'

conn = psycopg2.connect(url, connect_timeout=10)
cur = conn.cursor()

print('Fetching records with NULL/empty DocValueDate...\n')

cur.execute('''
    SELECT DocKey, EntriesId, DocRecDate, DocValueDate, EntryDbAmt, EntryCrAmt, DocNomination, DocProdGroup
    FROM bog_gel_raw_893486000 
    WHERE DocValueDate IS NULL OR TRIM(DocValueDate) = ''
    ORDER BY DocRecDate DESC
    LIMIT 49
''')

records = cur.fetchall()
print(f'Found {len(records)} records without valid DocValueDate:\n')
print('='*120)

for i, (dockey, entriesid, recdate, valdate, debit, credit, desc, prodgroup) in enumerate(records, 1):
    amt = (float(debit or 0) - float(credit or 0))
    print(f'{i}. DocKey: {dockey} | EntriesId: {entriesid}')
    print(f'   RecDate: {recdate} | ValueDate: "{valdate}" | ProdGroup: {prodgroup}')
    print(f'   Amount: {amt:,.2f} GEL')
    print(f'   Description: {desc[:80] if desc else "N/A"}')
    print('-'*120)

print(f'\nTotal skipped: {len(records)} records')
print('\nThese records are in raw table but excluded from consolidated due to missing transaction date.')

conn.close()
