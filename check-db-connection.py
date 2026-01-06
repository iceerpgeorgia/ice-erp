#!/usr/bin/env python3
import os
from dotenv import load_dotenv

load_dotenv('.env.vercel.production')

db_url = os.getenv('DATABASE_URL')
print("=" * 80)
print("DATABASE CONNECTION CHECK")
print("=" * 80)
print(f"\nDATABASE_URL from .env.vercel.production:")
print(f"Host: {db_url.split('@')[1].split(':')[0] if '@' in db_url else 'unknown'}")
print(f"Database: {db_url.split('/')[-1].split('?')[0] if '/' in db_url else 'unknown'}")
print(f"\nFull URL (masked): {db_url[:50]}...{db_url[-30:]}")
