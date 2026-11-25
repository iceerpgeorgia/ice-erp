-- Keep chat requests out of Supabase's public API (anon/authenticated roles): row level security on,
-- no policies. The app reads and writes through Prisma as the table owner, which RLS does not limit.
ALTER TABLE ai_change_requests ENABLE ROW LEVEL SECURITY;
