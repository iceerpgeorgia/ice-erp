import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod/v4';
import { prisma, withRetry } from '@/lib/prisma';
import { sendEmail } from '@/lib/payment-notifications';
import { LLM_MATCH_MODEL } from '@/lib/waybills/llm-inventory-match';

// New RS unit texts that the items trigger added to rs_unit_dimension_map without a dimension are
// classified by Claude. Confident answers map the unit (the map trigger then moves its items and
// redoes their suggestions); the rest stay unmapped for a person. Admins (role admin or
// system_admin) get one email per run listing both outcomes; each unit text is reported once.
export const UNIT_MAP_MIN_CONFIDENCE = 0.85;
const SAMPLE_GOODS = 8;

const UnitPickSchema = z.object({
  dimension: z.number().int().describe('Number of the dimension this unit text means, or 0 when unsure'),
  confidence: z.number().describe('Confidence from 0 to 1'),
  reason: z.string().describe('One short sentence'),
});

const SYSTEM_PROMPT = `You map units of measure written on Georgian supplier waybills (RS.ge) to a company's fixed list of dimensions.
Unit texts are free text: abbreviations, typos, Russian or English ("ც", "ცალ.", "шт", "pcs", "კვ.მ", "მ2").
Each dimension lists the unit texts already mapped to it, as examples. Goods names that use the unit show what is being counted.

Pick the dimension the unit text means. A packaging word (box, pack, roll, bag) maps to that packaging dimension when the list has it.
Answer 0 when the unit text could mean several dimensions or none fits. A wrong mapping moves every item with this unit, so be strict.`;

export type UnitMappingOutcome = {
  unitText: string;
  itemCount: number;
  sampleGoods: string[];
  dimension: string | null;
  confidence: number;
  reason: string;
  mapped: boolean;
};

export type UnitMappingRunResult = {
  checked: number;
  mapped: number;
  unmapped: number;
  emailed: number;
  emailError: string | null;
  stoppedEarly: string | null;
};

export type UnitDimension = { uuid: string; dimension: string; examples: string | null };

/** Asks Claude which dimension a unit text means. Returns null dimension when unsure or declined. */
export async function classifyUnitText(
  client: Anthropic,
  unitText: string,
  sampleGoods: string[],
  dimensions: UnitDimension[]
): Promise<{ dimension: UnitDimension | null; confidence: number; reason: string }> {
  const dimensionList = dimensions
    .map((d, index) => `${index + 1}. ${d.dimension}${d.examples ? ` (mapped unit texts: ${d.examples})` : ''}`)
    .join('\n');
  const response = await client.messages.parse({
    model: LLM_MATCH_MODEL,
    max_tokens: 1000,
    system: SYSTEM_PROMPT,
    output_config: { effort: 'low', format: zodOutputFormat(UnitPickSchema) },
    messages: [{
      role: 'user',
      content: `Unit text: "${unitText}"\nGoods names with this unit:\n${sampleGoods.map((g) => `- ${g}`).join('\n')}\n\nDimensions:\n${dimensionList}`,
    }],
  });
  const pick = response.stop_reason === 'refusal' ? null : response.parsed_output ?? null;
  const chosen = pick && pick.dimension >= 1 && pick.dimension <= dimensions.length ? dimensions[pick.dimension - 1] : null;
  return {
    dimension: chosen,
    confidence: chosen ? Math.min(Math.max(Number(pick?.confidence) || 0, 0), 1) : 0,
    reason: pick?.reason ?? 'No answer',
  };
}

export async function loadUnitDimensions(): Promise<UnitDimension[]> {
  return withRetry(() =>
    prisma.$queryRawUnsafe<UnitDimension[]>(
      `SELECT d.uuid::text AS uuid, d.dimension,
              string_agg(m.unit_text, ', ' ORDER BY m.unit_text) AS examples
         FROM dimensions d
         LEFT JOIN rs_unit_dimension_map m ON m.dimension_uuid = d.uuid AND m.is_active
        WHERE d.is_active
        GROUP BY d.uuid, d.dimension
        ORDER BY d.dimension`
    )
  );
}

const escapeHtml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

async function notifyAdmins(outcomes: UnitMappingOutcome[]): Promise<number> {
  const admins = await prisma.user.findMany({
    where: { role: { in: ['admin', 'system_admin'] }, isAuthorized: true, email: { not: null } },
    select: { email: true },
  });
  const recipients = [...new Set(admins.map((admin) => admin.email!).filter(Boolean))];
  if (recipients.length === 0) return 0;

  const mapped = outcomes.filter((outcome) => outcome.mapped);
  const unmapped = outcomes.filter((outcome) => !outcome.mapped);
  const appUrl = (process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/+$/, '');
  const pageUrl = `${appUrl}/dictionaries/dimensions`;
  const subject = unmapped.length > 0
    ? `ICE ERP: ${unmapped.length} RS unit${unmapped.length === 1 ? '' : 's'} need a dimension`
    : `ICE ERP: Claude mapped ${mapped.length} new RS unit${mapped.length === 1 ? '' : 's'}`;

  const line = (outcome: UnitMappingOutcome) =>
    `"${outcome.unitText}" (${outcome.itemCount} items${outcome.sampleGoods[0] ? `, e.g. ${outcome.sampleGoods.slice(0, 2).join('; ')}` : ''})` +
    (outcome.mapped
      ? ` → ${outcome.dimension} (${Math.round(outcome.confidence * 100)}%: ${outcome.reason})`
      : ` — ${outcome.dimension ? `Claude's guess ${outcome.dimension} at ${Math.round(outcome.confidence * 100)}%` : 'no guess'}: ${outcome.reason}`);

  const textParts: string[] = [];
  if (unmapped.length > 0) {
    textParts.push(`Need a dimension (items with these units cannot be bound to inventories until mapped):\n${unmapped.map((o) => `- ${line(o)}`).join('\n')}`);
  }
  if (mapped.length > 0) {
    textParts.push(`Mapped automatically by Claude (please double-check):\n${mapped.map((o) => `- ${line(o)}`).join('\n')}`);
  }
  textParts.push(`Map or correct them by dragging the unit chips on the Dimensions page: ${pageUrl}`);

  const htmlList = (items: UnitMappingOutcome[]) => `<ul>${items.map((o) => `<li>${escapeHtml(line(o))}</li>`).join('')}</ul>`;
  const html = [
    unmapped.length > 0 ? `<p><b>Need a dimension</b> (items with these units cannot be bound to inventories until mapped):</p>${htmlList(unmapped)}` : '',
    mapped.length > 0 ? `<p><b>Mapped automatically by Claude</b> (please double-check):</p>${htmlList(mapped)}` : '',
    `<p>Map or correct them by dragging the unit chips on the <a href="${escapeHtml(pageUrl)}">Dimensions page</a>.</p>`,
  ].join('');

  await sendEmail({ to: recipients.join(', '), subject, text: textParts.join('\n\n'), html, fromName: 'ICE ERP Waybills' });
  return recipients.length;
}

/**
 * Classifies active unit texts that have items but no dimension and were never sent to Claude.
 * Runs at the start of the :30 cron so newly mapped items reach steps 4-5 in the same run.
 */
export async function runUnitMapping(): Promise<UnitMappingRunResult> {
  const result: UnitMappingRunResult = { checked: 0, mapped: 0, unmapped: 0, emailed: 0, emailError: null, stoppedEarly: null };

  const pending = await withRetry(() =>
    prisma.$queryRawUnsafe<Array<{ id: bigint; unit_text: string; item_count: number }>>(
      `SELECT m.id, m.unit_text, count(i.id)::int AS item_count
         FROM rs_unit_dimension_map m
         JOIN rs_waybills_in_items i ON i.unit = m.unit_text
        WHERE m.is_active AND m.dimension_uuid IS NULL AND m.ai_checked_at IS NULL
        GROUP BY m.id, m.unit_text
        ORDER BY count(i.id) DESC
        LIMIT 20`
    )
  );

  const outcomes: UnitMappingOutcome[] = [];
  if (pending.length > 0) {
    if (!process.env.ANTHROPIC_API_KEY) {
      result.stoppedEarly = 'ANTHROPIC_API_KEY is not set';
    } else {
      const client = new Anthropic();
      const dimensions = await loadUnitDimensions();

      for (const unit of pending) {
        const samples = await withRetry(() =>
          prisma.$queryRawUnsafe<Array<{ goods_name: string }>>(
            `SELECT DISTINCT goods_name FROM rs_waybills_in_items
              WHERE unit = $1 AND goods_name IS NOT NULL LIMIT ${SAMPLE_GOODS}`,
            unit.unit_text
          )
        );
        const sampleGoods = samples.map((row) => row.goods_name);
        let answer: Awaited<ReturnType<typeof classifyUnitText>>;
        try {
          answer = await classifyUnitText(client, unit.unit_text, sampleGoods, dimensions);
        } catch (error) {
          if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
            result.stoppedEarly = `Claude API rejected the credentials: ${(error as Error).message}`;
            break;
          }
          // Rate limit or outage: leave the unit for the next run.
          console.error('[llm-unit-mapping] model call failed', { unit: unit.unit_text, error });
          continue;
        }
        const chosen = answer.dimension;
        const confidence = answer.confidence;
        const mapped = Boolean(chosen) && confidence >= UNIT_MAP_MIN_CONFIDENCE;
        const reason = answer.reason;
        await withRetry(() =>
          prisma.$executeRawUnsafe(
            `UPDATE rs_unit_dimension_map
                SET ai_checked_at = now(),
                    ai_dimension_uuid = $2::uuid,
                    ai_confidence = $3,
                    ai_reason = $4,
                    ai_mapped = $5,
                    dimension_uuid = CASE WHEN $5 AND dimension_uuid IS NULL THEN $2::uuid ELSE dimension_uuid END,
                    updated_at = now()
              WHERE id = $1`,
            unit.id,
            chosen?.uuid ?? null,
            Math.round(confidence * 10000) / 10000,
            reason,
            mapped
          )
        );
        result.checked += 1;
        if (mapped) result.mapped += 1;
        else result.unmapped += 1;
        outcomes.push({
          unitText: unit.unit_text,
          itemCount: unit.item_count,
          sampleGoods,
          dimension: chosen?.dimension ?? null,
          confidence,
          reason,
          mapped,
        });
      }
    }
  }

  // Email everything Claude looked at that admins have not heard about yet (also catches units from
  // a run whose email failed).
  const unreported = await withRetry(() =>
    prisma.$queryRawUnsafe<Array<{ id: bigint; unit_text: string; dimension: string | null; ai_confidence: number | null; ai_reason: string | null; ai_mapped: boolean; item_count: number }>>(
      `SELECT m.id, m.unit_text, d.dimension, m.ai_confidence::float8 AS ai_confidence, m.ai_reason, m.ai_mapped,
              (SELECT count(*)::int FROM rs_waybills_in_items i WHERE i.unit = m.unit_text) AS item_count
         FROM rs_unit_dimension_map m
         LEFT JOIN dimensions d ON d.uuid = m.ai_dimension_uuid
        WHERE m.ai_checked_at IS NOT NULL AND m.admin_notified_at IS NULL`
    )
  );
  if (unreported.length > 0) {
    const byText = new Map(outcomes.map((outcome) => [outcome.unitText, outcome]));
    const toReport: UnitMappingOutcome[] = unreported.map((row) => byText.get(row.unit_text) ?? {
      unitText: row.unit_text,
      itemCount: row.item_count,
      sampleGoods: [],
      dimension: row.dimension,
      confidence: Number(row.ai_confidence ?? 0),
      reason: row.ai_reason ?? '',
      mapped: row.ai_mapped,
    });
    try {
      result.emailed = await notifyAdmins(toReport);
      if (result.emailed > 0) {
        await withRetry(() =>
          prisma.$executeRawUnsafe(
            `UPDATE rs_unit_dimension_map SET admin_notified_at = now() WHERE id = ANY($1::bigint[])`,
            unreported.map((row) => row.id)
          )
        );
      }
    } catch (error) {
      result.emailError = error instanceof Error ? error.message : String(error);
      console.error('[llm-unit-mapping] admin email failed', error);
    }
  }

  return result;
}
