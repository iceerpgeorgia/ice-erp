import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type VoiceIntent = 'get_payments' | 'get_counteragents' | 'create_counteragent';

type VoiceCommandPayload = {
  transcript?: string;
  intent?: VoiceIntent;
  parameters?: {
    paymentId?: string;
    counteragentName?: string;
    name?: string;
    identificationNumber?: string;
    limit?: number;
  };
  confirmWrite?: boolean;
};

const PAYMENT_ID_PATTERN = /^[0-9a-f]{6}_[0-9a-f]{2}_[0-9a-f]{6}$/i;

function isSecretAuthorized(request: NextRequest) {
  const configuredSecret = process.env.OPENCLAW_WEBHOOK_SECRET;
  if (!configuredSecret) return false;
  const incomingSecret = request.headers.get('x-openclaw-secret');
  return Boolean(incomingSecret && incomingSecret === configuredSecret);
}

function normalizeIdentificationNumber(value: string | null | undefined) {
  if (!value) return null;
  const digits = String(value).replace(/\D/g, '');
  if (!digits) return null;
  if (digits.length === 10) return `0${digits}`;
  return digits;
}

function clampLimit(value: number | undefined, fallback = 10, max = 50) {
  if (!Number.isFinite(value)) return fallback;
  const n = Math.floor(Number(value));
  if (n < 1) return fallback;
  return Math.min(n, max);
}

function parseIntentFromTranscript(transcript: string): { intent?: VoiceIntent; params: Record<string, string> } {
  const lowered = transcript.toLowerCase();
  const params: Record<string, string> = {};

  const paymentIdMatch = transcript.match(/[0-9a-f]{6}_[0-9a-f]{2}_[0-9a-f]{6}/i);
  if (paymentIdMatch) {
    params.paymentId = paymentIdMatch[0];
  }

  const namedMatch = transcript.match(/named\s+([\p{L}0-9\-_'\s]{2,80})/iu);
  if (namedMatch?.[1]) {
    params.name = namedMatch[1].trim();
  }

  const geNamedMatch = transcript.match(/სახელად\s+([\p{L}0-9\-_'\s]{2,80})/iu);
  if (!params.name && geNamedMatch?.[1]) {
    params.name = geNamedMatch[1].trim();
  }

  const geCounteragentMatch = transcript.match(/კონტრაგენტ(?:ი|ის)?\s+([\p{L}0-9\-_'\s]{2,80})/iu);
  if (geCounteragentMatch?.[1]) {
    params.counteragentName = geCounteragentMatch[1].trim();
  }

  const innMatch = transcript.match(/(?:საიდენტიფიკაციო\s+ნომერი|inn)\s*[:\-]?\s*(\d{9,12})/iu);
  if (innMatch?.[1]) {
    params.identificationNumber = innMatch[1];
  }

  if (lowered.includes('create counteragent') || lowered.includes('add counteragent')) {
    return { intent: 'create_counteragent', params };
  }

  if (lowered.includes('შექმენი კონტრაგენტი') || lowered.includes('დაამატე კონტრაგენტი')) {
    return { intent: 'create_counteragent', params };
  }

  if (lowered.includes('find payment') || lowered.includes('show payment') || lowered.includes('get payment')) {
    return { intent: 'get_payments', params };
  }

  if (lowered.includes('იპოვე გადახდა') || lowered.includes('მაჩვენე გადახდა') || lowered.includes('მომეცი გადახდა')) {
    return { intent: 'get_payments', params };
  }

  if (lowered.includes('find counteragent') || lowered.includes('show counteragent') || lowered.includes('get counteragent')) {
    return { intent: 'get_counteragents', params };
  }

  if (lowered.includes('იპოვე კონტრაგენტი') || lowered.includes('მაჩვენე კონტრაგენტი') || lowered.includes('მომეცი კონტრაგენტი')) {
    return { intent: 'get_counteragents', params };
  }

  return { intent: undefined, params };
}

async function handleGetPayments(payload: VoiceCommandPayload) {
  const paymentId = payload.parameters?.paymentId?.trim();
  const counteragentName = payload.parameters?.counteragentName?.trim();
  const take = clampLimit(payload.parameters?.limit, 10, 50);

  let counteragentFilter: string[] | undefined;
  let counteragentNameMap = new Map<string, string>();

  if (counteragentName) {
    const matchingCounteragents = await prisma.counteragents.findMany({
      where: {
        OR: [
          { counteragent: { contains: counteragentName, mode: 'insensitive' } },
          { name: { contains: counteragentName, mode: 'insensitive' } },
        ],
      },
      select: {
        counteragent_uuid: true,
        counteragent: true,
        name: true,
      },
      take: 100,
    });

    counteragentFilter = matchingCounteragents.map((c) => c.counteragent_uuid);
    counteragentNameMap = new Map(
      matchingCounteragents.map((c) => [c.counteragent_uuid, c.counteragent || c.name || c.counteragent_uuid])
    );

    if (counteragentFilter.length === 0) {
      return {
        ok: true,
        intent: 'get_payments',
        resultCount: 0,
        results: [],
        message: 'No payments matched the requested counteragent.',
      };
    }
  }

  const payments = await prisma.payments.findMany({
    where: {
      is_active: true,
      ...(paymentId ? { payment_id: paymentId } : {}),
      ...(counteragentFilter ? { counteragent_uuid: { in: counteragentFilter } } : {}),
    },
    orderBy: { created_at: 'desc' },
    take,
    select: {
      id: true,
      payment_id: true,
      counteragent_uuid: true,
      financial_code_uuid: true,
      currency_uuid: true,
      income_tax: true,
      is_active: true,
      created_at: true,
      updated_at: true,
    },
  });

  const missingCounteragentUuids = Array.from(
    new Set(payments.map((p) => p.counteragent_uuid).filter((uuid) => !counteragentNameMap.has(uuid)))
  );

  if (missingCounteragentUuids.length > 0) {
    const moreCounteragents = await prisma.counteragents.findMany({
      where: { counteragent_uuid: { in: missingCounteragentUuids } },
      select: { counteragent_uuid: true, counteragent: true, name: true },
    });
    for (const row of moreCounteragents) {
      counteragentNameMap.set(row.counteragent_uuid, row.counteragent || row.name || row.counteragent_uuid);
    }
  }

  const financialCodeUuids = Array.from(new Set(payments.map((p) => p.financial_code_uuid)));
  const currencyUuids = Array.from(new Set(payments.map((p) => p.currency_uuid)));

  const [financialCodes, currencies] = await Promise.all([
    prisma.financial_codes.findMany({ where: { uuid: { in: financialCodeUuids } }, select: { uuid: true, validation: true } }),
    prisma.currencies.findMany({ where: { uuid: { in: currencyUuids } }, select: { uuid: true, code: true } }),
  ]);

  const financialCodeMap = new Map(financialCodes.map((r) => [r.uuid, r.validation]));
  const currencyMap = new Map(currencies.map((r) => [r.uuid, r.code]));

  const results = payments.map((p) => ({
    id: Number(p.id),
    paymentId: p.payment_id,
    counteragentUuid: p.counteragent_uuid,
    counteragentName: counteragentNameMap.get(p.counteragent_uuid) ?? p.counteragent_uuid,
    financialCodeUuid: p.financial_code_uuid,
    financialCode: financialCodeMap.get(p.financial_code_uuid) ?? null,
    currencyUuid: p.currency_uuid,
    currencyCode: currencyMap.get(p.currency_uuid) ?? null,
    incomeTax: p.income_tax,
    isActive: p.is_active,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
  }));

  return {
    ok: true,
    intent: 'get_payments',
    resultCount: results.length,
    results,
    message: results.length > 0 ? `Found ${results.length} payment record(s).` : 'No payments found.',
  };
}

async function handleGetCounteragents(payload: VoiceCommandPayload) {
  const name = payload.parameters?.counteragentName?.trim() || payload.parameters?.name?.trim();
  const identificationNumber = normalizeIdentificationNumber(payload.parameters?.identificationNumber);
  const take = clampLimit(payload.parameters?.limit, 10, 50);

  const rows = await prisma.counteragents.findMany({
    where: {
      ...(name
        ? {
            OR: [
              { counteragent: { contains: name, mode: 'insensitive' } },
              { name: { contains: name, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(identificationNumber ? { identification_number: identificationNumber } : {}),
    },
    orderBy: { id: 'desc' },
    take,
    select: {
      id: true,
      counteragent_uuid: true,
      counteragent: true,
      name: true,
      identification_number: true,
      internal_number: true,
      is_active: true,
      created_at: true,
      updated_at: true,
    },
  });

  return {
    ok: true,
    intent: 'get_counteragents',
    resultCount: rows.length,
    results: rows.map((row) => ({
      id: Number(row.id),
      counteragentUuid: row.counteragent_uuid,
      displayName: row.counteragent || row.name || row.counteragent_uuid,
      identificationNumber: row.identification_number,
      internalNumber: row.internal_number,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })),
    message: rows.length > 0 ? `Found ${rows.length} counteragent record(s).` : 'No counteragents found.',
  };
}

async function handleCreateCounteragent(payload: VoiceCommandPayload) {
  const name = payload.parameters?.name?.trim();
  const identificationNumber = normalizeIdentificationNumber(payload.parameters?.identificationNumber);

  if (!payload.confirmWrite) {
    return {
      ok: false,
      intent: 'create_counteragent',
      code: 'WRITE_CONFIRMATION_REQUIRED',
      message: 'Write operation requires confirmWrite=true to prevent accidental voice-triggered changes.',
    };
  }

  if (!name) {
    return {
      ok: false,
      intent: 'create_counteragent',
      code: 'VALIDATION_ERROR',
      message: 'Counteragent name is required for create_counteragent intent.',
    };
  }

  if (identificationNumber) {
    const existingByInn = await prisma.counteragents.findFirst({
      where: { identification_number: identificationNumber },
      select: { id: true, counteragent_uuid: true, counteragent: true, name: true, internal_number: true },
    });

    if (existingByInn) {
      return {
        ok: false,
        intent: 'create_counteragent',
        code: 'DUPLICATE_IDENTIFICATION_NUMBER',
        message: 'A counteragent with this identification number already exists.',
        existing: {
          id: Number(existingByInn.id),
          counteragentUuid: existingByInn.counteragent_uuid,
          displayName: existingByInn.counteragent || existingByInn.name || existingByInn.counteragent_uuid,
          internalNumber: existingByInn.internal_number,
        },
      };
    }
  }

  const created = await prisma.counteragents.create({
    data: {
      counteragent_uuid: crypto.randomUUID(),
      name,
      identification_number: identificationNumber,
      is_active: true,
      updated_at: new Date(),
    },
    select: { id: true, counteragent_uuid: true, name: true, counteragent: true, identification_number: true },
  });

  const idStr = created.id.toString();
  const zeros = '0'.repeat(Math.max(0, 6 - idStr.length));
  const internalNumber = `ICE${zeros}${idStr}`;

  const finalized = await prisma.counteragents.update({
    where: { id: created.id },
    data: { internal_number: internalNumber, updated_at: new Date() },
    select: {
      id: true,
      counteragent_uuid: true,
      name: true,
      counteragent: true,
      identification_number: true,
      internal_number: true,
      is_active: true,
      created_at: true,
      updated_at: true,
    },
  });

  return {
    ok: true,
    intent: 'create_counteragent',
    message: 'Counteragent created successfully.',
    created: {
      id: Number(finalized.id),
      counteragentUuid: finalized.counteragent_uuid,
      displayName: finalized.counteragent || finalized.name || finalized.counteragent_uuid,
      identificationNumber: finalized.identification_number,
      internalNumber: finalized.internal_number,
      isActive: finalized.is_active,
      createdAt: finalized.created_at,
      updatedAt: finalized.updated_at,
    },
  };
}

export async function POST(request: NextRequest) {
  try {
    const secretAuthorized = isSecretAuthorized(request);
    if (!secretAuthorized) {
      const session = await getServerSession(authOptions);
      if (!session?.user?.email) {
        return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
      }
    }

    const body = (await request.json()) as VoiceCommandPayload;
    const transcript = String(body.transcript ?? '').trim();

    const parsed = transcript ? parseIntentFromTranscript(transcript) : { intent: undefined, params: {} };
    const effectiveIntent = body.intent ?? parsed.intent;

    if (!effectiveIntent) {
      return NextResponse.json(
        {
          ok: false,
          code: 'INTENT_NOT_RECOGNIZED',
          message: 'No supported intent found. Provide intent explicitly or a transcript that maps to a supported command.',
          supportedIntents: ['get_payments', 'get_counteragents', 'create_counteragent'],
        },
        { status: 400 }
      );
    }

    const payload: VoiceCommandPayload = {
      ...body,
      parameters: {
        paymentId: body.parameters?.paymentId ?? parsed.params.paymentId,
        counteragentName: body.parameters?.counteragentName ?? parsed.params.counteragentName,
        name: body.parameters?.name ?? parsed.params.name,
        identificationNumber: body.parameters?.identificationNumber ?? parsed.params.identificationNumber,
        limit: body.parameters?.limit,
      },
    };

    if (payload.parameters?.paymentId && !PAYMENT_ID_PATTERN.test(payload.parameters.paymentId)) {
      return NextResponse.json(
        {
          ok: false,
          code: 'VALIDATION_ERROR',
          message: 'paymentId must follow 6_2_6 hex format (for example a1b2c3_4d_9f8e7d).',
        },
        { status: 400 }
      );
    }

    if (effectiveIntent === 'get_payments') {
      const result = await handleGetPayments(payload);
      return NextResponse.json(result, { status: 200 });
    }

    if (effectiveIntent === 'get_counteragents') {
      const result = await handleGetCounteragents(payload);
      return NextResponse.json(result, { status: 200 });
    }

    if (effectiveIntent === 'create_counteragent') {
      const result = await handleCreateCounteragent(payload);
      return NextResponse.json(result, { status: result.ok ? 201 : 400 });
    }

    return NextResponse.json(
      {
        ok: false,
        code: 'UNSUPPORTED_INTENT',
        message: `Unsupported intent: ${effectiveIntent}`,
      },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('[openclaw/command] error:', error);
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || 'Unexpected server error',
      },
      { status: 500 }
    );
  }
}
