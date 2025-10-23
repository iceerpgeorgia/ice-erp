import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";

export async function GET() {
  try {
    const supabase = getSupabaseServer();
    // Lightweight check against existing table; requires either SERVICE_ROLE or RLS allowing select
    const { count, error } = await supabase
      .from("countries")
      .select("id", { count: "exact", head: true });
    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }
    return NextResponse.json({ ok: true, table: "countries", count: count ?? null });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

