import { config } from 'dotenv';
import { getSupabaseClient } from '../lib/bank-import/db-utils';

config();

async function main() {
  const tableName = process.argv[2] || 'GE78BG0000000893486000_BOG_GEL';
  const supabase = getSupabaseClient();

  const { error } = await supabase.from(tableName).delete().gt('id', 0);
  if (error) {
    throw error;
  }

  console.log(`✅ Truncated ${tableName}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
