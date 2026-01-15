"""
Match counteragent identification values with counteragents table.
Uses fuzzy matching and Latin-to-Georgian transliteration.
"""
import pandas as pd
import psycopg2
from fuzzywuzzy import fuzz
from dotenv import load_dotenv
import os
import sys

# Set UTF-8 encoding for Windows
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

# Load environment variables
load_dotenv()

# Latin to Georgian transliteration mapping
LATIN_TO_GEORGIAN = {
    'a': 'ა', 'b': 'ბ', 'g': 'გ', 'd': 'დ', 'e': 'ე', 'v': 'ვ', 'z': 'ზ',
    'T': 'თ', 'i': 'ი', 'k': 'კ', 'l': 'ლ', 'm': 'მ', 'n': 'ნ', 'o': 'ო',
    'p': 'პ', 'J': 'ჟ', 'r': 'რ', 's': 'ს', 't': 'ტ', 'u': 'უ', 'f': 'ფ',
    'q': 'ქ', 'R': 'ღ', 'y': 'ყ', 'S': 'შ', 'C': 'ჩ', 'c': 'ც', 'Z': 'ძ',
    'w': 'წ', 'W': 'ჭ', 'x': 'ხ', 'j': 'ჯ', 'h': 'ჰ'
}

def transliterate_latin_to_georgian(text):
    """Convert Latin text to Georgian using transliteration map"""
    if not isinstance(text, str):
        return text
    
    result = []
    for char in text:
        result.append(LATIN_TO_GEORGIAN.get(char, char))
    return ''.join(result)

def find_best_match(search_term, counteragents_list, threshold=70):
    """
    Find best matching counteragent using fuzzy matching.
    Returns tuple: (match_score, counteragent_name, counteragent_uuid)
    """
    best_score = 0
    best_match = None
    best_uuid = None
    
    search_term_lower = str(search_term).lower().strip()
    
    for ca_name, ca_uuid in counteragents_list:
        ca_name_lower = str(ca_name).lower().strip()
        
        # Try exact substring match first
        if search_term_lower in ca_name_lower or ca_name_lower in search_term_lower:
            score = 100
        else:
            # Try fuzzy matching
            score = fuzz.partial_ratio(search_term_lower, ca_name_lower)
        
        if score > best_score:
            best_score = score
            best_match = ca_name
            best_uuid = ca_uuid
    
    if best_score >= threshold:
        return (best_score, best_match, best_uuid)
    return None

def main():
    print("="*80)
    print("COUNTERAGENT MATCHING SCRIPT")
    print("="*80)
    
    # Read Excel file
    print("\n📂 Reading counteragent_identification.xlsx...")
    df = pd.read_excel('counteragent_identification.xlsx')
    print(f"   ✅ Loaded {len(df)} rows")
    print(f"   Columns: {list(df.columns)}")
    
    # Connect to database
    print("\n🔌 Connecting to database...")
    db_url = os.getenv('DATABASE_URL')
    if not db_url:
        print("   ❌ DATABASE_URL not found in environment")
        sys.exit(1)
    
    # Remove schema parameter from URL (not supported by psycopg2)
    if '?schema=' in db_url:
        db_url = db_url.split('?schema=')[0]
    
    conn = psycopg2.connect(db_url)
    cursor = conn.cursor()
    
    # Fetch all counteragents
    print("\n📥 Fetching counteragents from database...")
    cursor.execute("""
        SELECT counteragent, counteragent_uuid 
        FROM counteragents 
        WHERE counteragent IS NOT NULL
        ORDER BY counteragent
    """)
    
    counteragents = cursor.fetchall()
    print(f"   ✅ Loaded {len(counteragents)} counteragents")
    
    # Process each row
    print("\n🔍 Matching counteragents...")
    print("-"*80)
    
    matches_found = 0
    transliteration_matches = 0
    no_matches = 0
    
    for idx, row in df.iterrows():
        search_term = row['Regex']
        
        if pd.isna(search_term) or str(search_term).strip() == '':
            continue
        
        print(f"\n[{idx+1}/{len(df)}] Searching for: {search_term}")
        
        # Try direct matching first
        result = find_best_match(search_term, counteragents, threshold=70)
        
        # If no match, try Latin-to-Georgian transliteration
        if not result:
            georgian_term = transliterate_latin_to_georgian(str(search_term))
            if georgian_term != search_term:
                print(f"   🔄 Trying transliteration: {georgian_term}")
                result = find_best_match(georgian_term, counteragents, threshold=70)
                if result:
                    transliteration_matches += 1
        
        if result:
            score, match_name, match_uuid = result
            print(f"   ✅ Match found (score: {score}%)")
            print(f"      Name: {match_name}")
            print(f"      UUID: {match_uuid}")
            
            df.at[idx, 'Matchedcountragentlabel'] = match_name
            df.at[idx, 'Matchedcountragentuuid'] = match_uuid
            matches_found += 1
        else:
            print(f"   ❌ No match found")
            no_matches += 1
    
    # Save results
    print("\n" + "="*80)
    print("RESULTS SUMMARY")
    print("="*80)
    print(f"✅ Matches found: {matches_found}")
    print(f"🔄 Transliteration matches: {transliteration_matches}")
    print(f"❌ No matches: {no_matches}")
    
    output_file = 'counteragent_identification_matched.xlsx'
    print(f"\n💾 Saving results to {output_file}...")
    df.to_excel(output_file, index=False)
    print("   ✅ File saved successfully!")
    
    cursor.close()
    conn.close()

if __name__ == '__main__':
    main()
