import { NextResponse } from "next/server";
import { loadDesign } from "@/lib/designs";

export async function GET(
  req: Request,
  { params }: { params: { slug: string } }
) {
  const url = new URL(req.url);
  const source = (url.searchParams.get("source") as any) || "auto";
  const slug = params.slug;
  try {
    const design = await loadDesign(slug, source);
    if (!design) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true, slug, source, design });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

