import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/auth-guard";
import OpenAI from "openai";

// Groq uses an OpenAI-compatible API — same SDK, different baseURL + key.
function getGroqClient(): OpenAI | null {
  const key = process.env.GROQ_API_KEY;
  if (!key) return null;
  return new OpenAI({
    apiKey: key,
    baseURL: "https://api.groq.com/openai/v1",
  });
}

interface Candidate {
  id: number;
  rs_id: string;
  waybill_no: string | null;
  shipping_address: string;
  project_uuid: string | null;
  counteragent_name: string | null;
  activation_time: Date | null;
  trgm_score: number;
  llm_score?: number;
  llm_reason?: string;
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (isAuthError(auth)) return auth;

  const body = await req.json();
  const { rs_id, threshold = 0.12, project_uuid } = body as {
    rs_id: string;
    threshold?: number;
    project_uuid?: string | null;
  };

  if (!rs_id) {
    return NextResponse.json({ error: "rs_id is required" }, { status: 400 });
  }

  // 1. Fetch the source waybill's shipping address
  const source = await prisma.rs_waybills_in_api.findUnique({
    where: { rs_id },
    select: {
      rs_id: true,
      waybill_no: true,
      shipping_address: true,
      project_uuid: true,
    },
  });

  if (!source) {
    return NextResponse.json({ error: "Waybill not found" }, { status: 404 });
  }

  if (!source.shipping_address) {
    return NextResponse.json(
      { error: "This waybill has no shipping address" },
      { status: 422 }
    );
  }

  // 2. pg_trgm similarity search — finds candidates with similar addresses.
  //    Uses the GIN index on shipping_address for fast lookup.
  //    Excludes waybills already bound to the given project (if provided).
  const rawCandidates = await prisma.$queryRaw<
    Array<{
      id: bigint;
      rs_id: string;
      waybill_no: string | null;
      shipping_address: string;
      project_uuid: string | null;
      counteragent_name: string | null;
      activation_time: Date | null;
      trgm_score: number;
    }>
  >`
    SELECT
      id,
      rs_id,
      waybill_no,
      shipping_address,
      project_uuid::text         AS project_uuid,
      counteragent_name,
      activation_time,
      similarity(shipping_address, ${source.shipping_address})::float AS trgm_score
    FROM rs_waybills_in_api
    WHERE rs_id <> ${rs_id}
      AND shipping_address IS NOT NULL
      AND type <> 'შიდა გადაზიდვა'
      AND similarity(shipping_address, ${source.shipping_address}) >= ${threshold}
      AND (
        ${project_uuid ?? null}::text IS NULL
        OR project_uuid IS NULL
        OR project_uuid::text <> ${project_uuid ?? null}::text
      )
    ORDER BY trgm_score DESC
    LIMIT 500
  `;

  const candidates: Candidate[] = rawCandidates.map((r) => ({
    ...r,
    id: Number(r.id),
    trgm_score: Number(r.trgm_score),
  }));

  // 3. Optional LLM refinement via Groq (Llama 3.3 70B).
  //    If GROQ_API_KEY is not set, return pg_trgm results as-is.
  const groq = getGroqClient();

  if (!groq || candidates.length === 0) {
    return NextResponse.json({
      source: {
        rs_id: source.rs_id,
        waybill_no: source.waybill_no,
        shipping_address: source.shipping_address,
        project_uuid: source.project_uuid,
      },
      candidates,
      llm_used: false,
    });
  }

  // Build a compact list for the LLM to score.
  // Cap at 100 highest-scoring candidates to stay within token limits;
  // any beyond that are returned without LLM scoring (treated as confirmed by trgm).
  const LLM_BATCH_LIMIT = 100;
  const llmBatch = candidates.slice(0, LLM_BATCH_LIMIT);
  const beyondBatch = candidates.slice(LLM_BATCH_LIMIT);

  const addressList = llmBatch
    .map((c, i) => `${i + 1}. "${c.shipping_address}"`)
    .join("\n");

  const prompt = `You are a Georgian address matching assistant. Your task is to determine which addresses from a list refer to the same physical delivery location as a reference address.

Reference address: "${source.shipping_address}"

Candidate addresses:
${addressList}

Instructions:
- Addresses may be in Georgian (ქართული) or transliterated.
- Variations in spelling, abbreviations (გამზ. vs გამზირი, პ. vs პროსპექტი), punctuation, and number format should be treated as matches.
- Return a JSON array where each element has:
  - "index": the candidate number (1-based)
  - "is_match": true if it refers to the same physical location, false otherwise
  - "confidence": 0.0 to 1.0
  - "reason": one short sentence explaining why

Return ONLY valid JSON, no prose.`;

  let llmScored: Array<{
    index: number;
    is_match: boolean;
    confidence: number;
    reason: string;
  }> = [];

  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0,
      max_tokens: 2048,
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw);
    // Model may return { results: [...] } or just [...]
    llmScored = Array.isArray(parsed) ? parsed : parsed.results ?? parsed.matches ?? [];
  } catch (err) {
    console.error("[similar-address] LLM error:", err);
    // Fall back to trgm-only results
    return NextResponse.json({
      source: {
        rs_id: source.rs_id,
        waybill_no: source.waybill_no,
        shipping_address: source.shipping_address,
        project_uuid: source.project_uuid,
      },
      candidates,
      llm_used: false,
      llm_error: "LLM call failed, showing pg_trgm results only",
    });
  }

  // Merge LLM scores back into the scored batch
  const scoredBatch: Candidate[] = llmBatch.map((c, i) => {
    const llmResult = llmScored.find((r) => r.index === i + 1);
    return {
      ...c,
      llm_score: llmResult?.confidence ?? null,
      llm_reason: llmResult?.reason ?? null,
      _llm_is_match: llmResult?.is_match ?? true,
    } as Candidate & { _llm_is_match: boolean };
  });

  const confirmed = [
    ...(scoredBatch as Array<Candidate & { _llm_is_match: boolean }>)
      .filter((c) => c._llm_is_match)
      .map(({ _llm_is_match, ...rest }) => rest)
      .sort((a, b) => (b.llm_score ?? 0) - (a.llm_score ?? 0)),
    // Candidates beyond the LLM batch are included as-is (sorted by trgm score)
    ...beyondBatch,
  ];

  const rejected = (scoredBatch as Array<Candidate & { _llm_is_match: boolean }>)
    .filter((c) => !c._llm_is_match)
    .map(({ _llm_is_match, ...rest }) => rest);

  return NextResponse.json({
    source: {
      rs_id: source.rs_id,
      waybill_no: source.waybill_no,
      shipping_address: source.shipping_address,
      project_uuid: source.project_uuid,
    },
    candidates: confirmed,
    rejected,
    llm_used: true,
  });
}
