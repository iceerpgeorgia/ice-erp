const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const loadEnv = (path) => {
  try {
    const content = fs.readFileSync(path, 'utf8');
    content.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const idx = trimmed.indexOf('=');
      if (idx === -1) return;
      const key = trimmed.slice(0, idx).trim();
      let value = trimmed.slice(idx + 1).trim();
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = value;
      }
    });
  } catch {
    // ignore
  }
};

loadEnv('.env.local');
loadEnv('.env');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
console.log('Has URL:', Boolean(url), 'Has key:', Boolean(key));

if (!url || !key) {
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

(async () => {
  const { data, error } = await supabase
    .from('currencies')
    .select('uuid, code, name')
    .ilike('code', 'gel');

  if (error) {
    console.error(error);
    process.exit(1);
  }

  console.log('Currencies GEL:', data);
})();
