#!/usr/bin/env python3
"""
NBG Exchange Rate Updater for Supabase
Same as update-nbg-rates.py but uses REMOTE_DATABASE_URL
"""

import os
import sys

# Set DATABASE_URL to REMOTE_DATABASE_URL before importing the main script
remote_url = os.getenv("REMOTE_DATABASE_URL", "postgresql://postgres.fojbzghphznbslqwurrm:fulebimojviT1985%25@aws-1-eu-west-1.pooler.supabase.com:6543/postgres")
os.environ["DATABASE_URL"] = remote_url

print("🌐 Using SUPABASE (PRODUCTION) database")
print(f"   Connection: {remote_url.split('@')[1].split('/')[0]}\n")

# Now run the main update script
import importlib.util
spec = importlib.util.spec_from_file_location("update_nbg_rates", "scripts/update-nbg-rates.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
module.main()
