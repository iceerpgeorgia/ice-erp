import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import Papa from 'papaparse';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const tableExists = async (tableName: string) => {
  const rows = await prisma.$queryRaw<{ regclass: string | null }[]>`
    SELECT to_regclass(${`public.${tableName}`})::text as regclass
  `;
  return Array.isArray(rows) && rows[0]?.regclass !== null;
};

const GE_MONTHS: Record<string, number> = {
  'იან': 0,
  'თებ': 1,
  'მარ': 2,
  'აპრ': 3,
  'მაი': 4,
  'ივნ': 5,
  'ივლ': 6,
  'აგვ': 7,
  'სექ': 8,
  'ოქტ': 9,
  'ნოე': 10,
  'დეკ': 11,
};

const EN_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const normalizeInn = (value: string | null | undefined) => {
  if (!value) return null;
  const digits = String(value).replace(/\D/g, '');
  if (!digits) return null;
  if (digits.length === 10) return `0${digits}`;
  return digits;
};

const normalizeWaybillNo = (value: string | null | undefined) => {
  if (!value) return null;
  const digits = String(value).replace(/\D/g, '');
  if (!digits) return null;
  if (digits.length === 9) return `0${digits}`;
  return digits;
};

const parseDecimal = (value: string | null | undefined) => {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  const normalized = trimmed.replace(/\s+/g, '').replace(',', '.');
  const num = Number(normalized);
  if (Number.isNaN(num)) return null;
  return normalized;
};

const parseGeorgianDateTime = (value: string | null | undefined) => {
  if (!value) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  const match = trimmed.match(/(\d{1,2})-([^-]{3})-(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/);
  if (!match) return null;
  const day = Number(match[1]);
  const monthKey = match[2];
  const year = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const monthIndex = GE_MONTHS[monthKey];
  if (monthIndex === undefined) return null;
  return new Date(year, monthIndex, day, hour, minute, second);
};

const formatDate = (date: Date | null) => {
  if (!date) return null;
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
};

const formatPeriod = (date: Date | null) => {
  if (!date) return null;
  return `${EN_MONTHS[date.getMonth()]} ${date.getFullYear()}`;
};

const getValue = (row: Record<string, any>, ...keys: string[]) => {
  for (const key of keys) {
    if (row[key] !== undefined) return row[key];
  }
  return undefined;
};

const parseCounteragent = (value: string | null | undefined) => {
  const raw = value ? String(value).trim() : '';
  if (!raw) {
    return { raw: null, inn: null, name: null, vat: false };
  }
  const match = raw.match(/^\(([^)]*)\)\s*(.*)$/);
  const inside = match ? match[1] : '';
  const name = match ? match[2] : raw;
  const vat = raw.includes('დღგ') || inside.includes('დღგ');
  const inn = normalizeInn(inside);
  return {
    raw,
    inn,
    name: name?.trim() || null,
    vat,
  };
};

const parseDriver = (value: string | null | undefined) => {
  const raw = value ? String(value).trim() : '';
  if (!raw) return { raw: null, id: null, name: null };
  const match = raw.match(/^\(([^)]*)\)\s*(.*)$/);
  const inside = match ? match[1] : '';
  const name = match ? match[2] : raw;
  const id = normalizeInn(inside);
  return { raw, id, name: name?.trim() || null };
};

const toComparable = (value: any) => {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'object' && typeof value.toString === 'function') {
    return value.toString();
  }
  return String(value);
};

const isDifferent = (existing: any, incoming: any, keys: string[]) =>
  keys.some((key) => toComparable(existing?.[key]) !== toComparable(incoming?.[key]));

export async function POST(req: NextRequest) {
  try {
    if (!(await tableExists('rs_waybills_in'))) {
      return NextResponse.json(
        { error: 'Waybills table is not available yet. Please run migrations.' },
        { status: 503 }
      );
    }
    const formData = await req.formData();
    const file = formData.get('file');
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'Missing file' }, { status: 400 });
    }

    const text = await file.text();
    const parsed = Papa.parse<Record<string, any>>(text, {
      header: true,
      skipEmptyLines: true,
    });

    if (parsed.errors?.length) {
      return NextResponse.json({
        error: 'CSV parse error',
        details: parsed.errors,
      }, { status: 400 });
    }

    const counteragents = await prisma.counteragents.findMany({
      select: { counteragent_uuid: true, identification_number: true },
    });
    const counteragentMap = new Map<string, string>();
    for (const c of counteragents) {
      const inn = normalizeInn(c.identification_number || '');
      if (inn) {
        counteragentMap.set(inn, c.counteragent_uuid);
      }
    }

    const importBatchId = randomUUID();
    const records = (parsed.data || []).map((row) => {
      const waybillNoRaw = getValue(row, 'ზედნადები', 'waybill_no');
      const state = getValue(row, 'სტატუსი', 'state');
      const condition = getValue(row, 'მდგომარეობა', 'condition');
      const category = getValue(row, 'კატეგორია', 'category');
      const type = getValue(row, 'ტიპი', 'type');
      const counteragentRaw = getValue(row, 'ორგანიზაცია', 'counteragent');
      const sum = parseDecimal(getValue(row, 'თანხა', 'sum'));
      const driverRaw = getValue(row, 'მძღოლი', 'driver');
      const vehicle = getValue(row, 'ავტო', 'vehicle');
      const transportationSum = parseDecimal(getValue(row, 'ტრანსპ თანხა', 'transportation_sum'));
      const departureAddress = getValue(row, 'ტრანსპორტ. დაწყება', 'departure_address');
      const shippingAddress = getValue(row, 'მიწოდების ადგილი', 'shipping_address');
      const activationTime = parseGeorgianDateTime(getValue(row, 'გააქტიურების თარ.', 'activation_time'));
      const transportationBeginningTime = parseGeorgianDateTime(getValue(row, 'ტრანსპ. დაწყება', 'transportation_beginning_time'));
      const submissionTime = parseGeorgianDateTime(getValue(row, 'ჩაბარების თარ.', 'submission_time'));
      const cancellationTime = parseGeorgianDateTime(getValue(row, 'გაუქმების თარ.', 'cancellation_time'));
      const note = getValue(row, 'შენიშვნა', 'note');
      const vatDocId = getValue(row, 'ა/ფ ID', 'vat_doc_id');
      const stat = getValue(row, 'STAT', 'stat');
      const transportationCost = parseDecimal(getValue(row, 'ტრანსპორტირების ხარჯი', 'transportation_cost'));
      const rsId = getValue(row, 'ID', 'id', 'rs_id');

      const counteragentParsed = parseCounteragent(counteragentRaw);
      const driverParsed = parseDriver(driverRaw);

      const counteragentUuid = counteragentParsed.inn
        ? counteragentMap.get(counteragentParsed.inn) || null
        : null;
      const driverUuid = driverParsed.id ? counteragentMap.get(driverParsed.id) || null : null;

      const activationDate = activationTime ? new Date(activationTime) : null;

      return {
        waybill_no: normalizeWaybillNo(waybillNoRaw),
        state: state ? String(state).trim() : null,
        condition: condition ? String(condition).trim() : null,
        category: category ? String(category).trim() : null,
        type: type ? String(type).trim() : null,
        counteragent: counteragentParsed.raw,
        counteragent_inn: counteragentParsed.inn,
        counteragent_name: counteragentParsed.name,
        counteragent_uuid: counteragentUuid,
        vat: counteragentParsed.vat,
        sum,
        driver: driverParsed.raw,
        driver_id: driverParsed.id,
        driver_uuid: driverUuid,
        vehicle: vehicle ? String(vehicle).trim() : null,
        transportation_sum: transportationSum,
        departure_address: departureAddress ? String(departureAddress).trim() : null,
        shipping_address: shippingAddress ? String(shippingAddress).trim() : null,
        activation_time: activationTime,
        transportation_beginning_time: transportationBeginningTime,
        submission_time: submissionTime,
        cancellation_time: cancellationTime,
        note: note ? String(note).trim() : null,
        vat_doc_id: vatDocId ? String(vatDocId).trim() : null,
        stat: stat ? String(stat).trim() : null,
        transportation_cost: transportationCost,
        rs_id: rsId ? String(rsId).trim() : null,
        project_uuid: null,
        financial_code_uuid: null,
        corresponding_account: null,
        date: formatDate(activationDate),
        period: formatPeriod(activationDate),
        import_batch_id: importBatchId,
        created_at: new Date(),
        updated_at: new Date(),
      };
    });

    const filtered = records.filter(r => r.waybill_no || r.rs_id || r.counteragent || r.activation_time);

    const compareKeys = [
      'waybill_no',
      'state',
      'condition',
      'category',
      'type',
      'counteragent',
      'counteragent_inn',
      'counteragent_name',
      'counteragent_uuid',
      'vat',
      'sum',
      'driver',
      'driver_id',
      'driver_uuid',
      'vehicle',
      'transportation_sum',
      'departure_address',
      'shipping_address',
      'activation_time',
      'transportation_beginning_time',
      'submission_time',
      'cancellation_time',
      'note',
      'vat_doc_id',
      'stat',
      'transportation_cost',
      'rs_id',
      'date',
      'period',
    ];

    const withKey = filtered.filter(r => r.rs_id && r.waybill_no);
    const withoutKey = filtered.filter(r => !(r.rs_id && r.waybill_no));

    const existingMap = new Map<string, any>();
    const batchSize = 200;
    for (let i = 0; i < withKey.length; i += batchSize) {
      const batch = withKey.slice(i, i + batchSize);
      const existing = await prisma.rs_waybills_in.findMany({
        where: {
          OR: batch.map((row) => ({
            rs_id: row.rs_id as string,
            waybill_no: row.waybill_no as string,
          })),
        },
        select: Object.fromEntries(compareKeys.map((key) => [key, true])) as any,
      });

      for (const row of existing) {
        existingMap.set(`${row.rs_id}::${row.waybill_no}`, row);
      }
    }

    const toCreate = [...withoutKey];
    const toUpdate: Array<{ where: { rs_id: string; waybill_no: string }; data: any }> = [];

    for (const row of withKey) {
      const key = `${row.rs_id}::${row.waybill_no}`;
      const existing = existingMap.get(key);
      if (!existing) {
        toCreate.push(row);
        continue;
      }

      if (isDifferent(existing, row, compareKeys)) {
        const {
          project_uuid,
          financial_code_uuid,
          corresponding_account,
          created_at,
          updated_at,
          ...updatable
        } = row;

        toUpdate.push({
          where: { rs_id: row.rs_id as string, waybill_no: row.waybill_no as string },
          data: {
            ...updatable,
            import_batch_id: importBatchId,
            updated_at: new Date(),
          },
        });
      }
    }

    const result = await prisma.rs_waybills_in.createMany({
      data: toCreate,
      skipDuplicates: true,
    });

    let updated = 0;
    const updateBatchSize = 50;
    for (let i = 0; i < toUpdate.length; i += updateBatchSize) {
      const batch = toUpdate.slice(i, i + updateBatchSize).map((item) =>
        prisma.rs_waybills_in.updateMany({
          where: item.where,
          data: item.data,
        })
      );
      await prisma.$transaction(batch);
      updated += batch.length;
    }

    return NextResponse.json({
      imported: result.count,
      updated,
      import_batch_id: importBatchId,
    });
  } catch (error: any) {
    console.error('[POST /api/waybills/import] Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to import waybills' },
      { status: 500 }
    );
  }
}
