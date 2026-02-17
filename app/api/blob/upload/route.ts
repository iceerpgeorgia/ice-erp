export async function POST() {
  return new Response(
    JSON.stringify({
      error: 'Blob uploads are disabled. Use Supabase Storage uploads instead.',
    }),
    { status: 410, headers: { 'Content-Type': 'application/json' } }
  );
}
