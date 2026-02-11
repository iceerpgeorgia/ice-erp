import fs from 'fs';
import { config } from 'dotenv';
import { prisma } from '../lib/prisma';

if (fs.existsSync('.env.local')) {
  config({ path: '.env.local' });
} else {
  config();
}

type PaymentSeedRow = {
  projectName: string;
  projectIndex: string;
  counteragentShort: string;
  amountCurrency: string;
  effectiveDate: string;
  counteragentFull: string;
  financialCodeValidation: string;
  currencyCode: string;
};

const rows: PaymentSeedRow[] = [
  {
    projectName: 'Kvareli Repair',
    projectIndex: '1.2.1.',
    counteragentShort: 'ინდეკო',
    amountCurrency: '1,800,000.00 GEL',
    effectiveDate: '01.07.2024',
    counteragentFull: 'ინდეკო (ს.კ. 202376133) - შპს',
    financialCodeValidation: '1.2.1. (+) შემოსავალი MEP დანადგარების რეალიზაციიდან',
    currencyCode: 'GEL',
  },
  {
    projectName: 'Kvareli Staff House Elevator',
    projectIndex: '1.1.1.',
    counteragentShort: 'ინდეკო სი ემ',
    amountCurrency: '24,300.00 USD',
    effectiveDate: '01.05.2025',
    counteragentFull: 'ინდეკო სი ემ (ს.კ. 405508339) - შპს',
    financialCodeValidation: '1.1.1. (+) შემოსავალი ლიფტების რეალიზაციიდან',
    currencyCode: 'USD',
  },
  {
    projectName: 'Kvareli Gallery',
    projectIndex: '1.2.1.',
    counteragentShort: 'ინდეკო სი ემ',
    amountCurrency: '795,000.00 USD',
    effectiveDate: '01.09.2025',
    counteragentFull: 'ინდეკო (ს.კ. 202376133) - შპს',
    financialCodeValidation: '1.2.1. (+) შემოსავალი MEP დანადგარების რეალიზაციიდან',
    currencyCode: 'USD',
  },
  {
    projectName: 'BOQ Vake Restaurant',
    projectIndex: '1.2.1.',
    counteragentShort: 'ინდეკო სი ემ',
    amountCurrency: '92,605.45 USD',
    effectiveDate: '06.08.2025',
    counteragentFull: 'ინდეკო სი ემ (ს.კ. 405508339) - შპს',
    financialCodeValidation: '1.2.1. (+) შემოსავალი MEP დანადგარების რეალიზაციიდან',
    currencyCode: 'USD',
  },
  {
    projectName: 'Kvareli Staff House',
    projectIndex: '1.2.1.',
    counteragentShort: 'ინდეკო სი ემ',
    amountCurrency: '169,060.00 USD',
    effectiveDate: '01.01.2025',
    counteragentFull: 'ინდეკო სი ემ (ს.კ. 405508339) - შპს',
    financialCodeValidation: '1.2.1. (+) შემოსავალი MEP დანადგარების რეალიზაციიდან',
    currencyCode: 'USD',
  },
  {
    projectName: 'Admiral',
    projectIndex: '1.2.3.',
    counteragentShort: 'ინდეკო სი ემ',
    amountCurrency: '444,536.20 USD',
    effectiveDate: '01.05.2024',
    counteragentFull: 'ინდეკო სი ემ (ს.კ. 405508339) - შპს',
    financialCodeValidation: '1.2.3. (+) შემოსავალი MEP დანადგარების სერვისიდან - არაგეგმიური',
    currencyCode: 'USD',
  },
  {
    projectName: 'Kvareli Wine Factory',
    projectIndex: '1.2.1.',
    counteragentShort: 'ინდეკო სი ემ',
    amountCurrency: '36,547.70 USD',
    effectiveDate: '01.05.2025',
    counteragentFull: 'ინდეკო სი ემ (ს.კ. 405508339) - შპს',
    financialCodeValidation: '1.2.1. (+) შემოსავალი MEP დანადგარების რეალიზაციიდან',
    currencyCode: 'USD',
  },
  {
    projectName: 'Kvareli Fans',
    projectIndex: '1.2.1.',
    counteragentShort: 'ინდეკო',
    amountCurrency: '5,806.00 EUR',
    effectiveDate: '21.05.2025',
    counteragentFull: 'ინდეკო (ს.კ. 202376133) - შპს',
    financialCodeValidation: '1.2.1. (+) შემოსავალი MEP დანადგარების რეალიზაციიდან',
    currencyCode: 'EUR',
  },
  {
    projectName: 'IndeKo - shartava 39',
    projectIndex: '1.1.2.',
    counteragentShort: 'ინდეკო',
    amountCurrency: '1.00 GEL',
    effectiveDate: '02.01.2018',
    counteragentFull: 'ინდეკო (ს.კ. 202376133) - შპს',
    financialCodeValidation: '1.1.2. (+) შემოსავალი ლიფტების სერვისიდან - გეგმიური',
    currencyCode: 'GEL',
  },
  {
    projectName: 'Kvareli Ballrom',
    projectIndex: '1.2.1.',
    counteragentShort: 'ინდეკო',
    amountCurrency: '15,000.00 USD',
    effectiveDate: '01.02.2025',
    counteragentFull: 'ინდეკო სი ემ (ს.კ. 405508339) - შპს',
    financialCodeValidation: '1.2.1. (+) შემოსავალი MEP დანადგარების რეალიზაციიდან',
    currencyCode: 'USD',
  },
  {
    projectName: 'Ramishvili Toshiba Installation',
    projectIndex: '1.2.3.',
    counteragentShort: 'ინდეკო სი ემ',
    amountCurrency: '45,000.00 GEL',
    effectiveDate: '01.01.2024',
    counteragentFull: 'ინდეკო სი ემ (ს.კ. 405508339) - შპს',
    financialCodeValidation: '1.2.3. (+) შემოსავალი MEP დანადგარების სერვისიდან - არაგეგმიური',
    currencyCode: 'GEL',
  },
  {
    projectName: 'Ramishvili VRV Outdoor Units Transport',
    projectIndex: '1.2.3.',
    counteragentShort: 'ინდეკო სი ემ',
    amountCurrency: '20,344.29 GEL',
    effectiveDate: '14.05.2024',
    counteragentFull: 'ინდეკო სი ემ (ს.კ. 405508339) - შპს',
    financialCodeValidation: '1.2.3. (+) შემოსავალი MEP დანადგარების სერვისიდან - არაგეგმიური',
    currencyCode: 'GEL',
  },
  {
    projectName: 'VaKe Sewage',
    projectIndex: '1.2.3.',
    counteragentShort: 'ინდეკო სი ემ',
    amountCurrency: '81,108.00 GEL',
    effectiveDate: '11.05.2023',
    counteragentFull: 'ინდეკო სი ემ (ს.კ. 405508339) - შპს',
    financialCodeValidation: '1.2.3. (+) შემოსავალი MEP დანადგარების სერვისიდან - არაგეგმიური',
    currencyCode: 'GEL',
  },
  {
    projectName: 'Ramishvili Toshiba Installation Materials',
    projectIndex: '1.2.1.',
    counteragentShort: 'ინდეკო სი ემ',
    amountCurrency: '26,817.00 GEL',
    effectiveDate: '18.01.2024',
    counteragentFull: 'ინდეკო სი ემ (ს.კ. 405508339) - შპს',
    financialCodeValidation: '1.2.1. (+) შემოსავალი MEP დანადგარების რეალიზაციიდან',
    currencyCode: 'GEL',
  },
  {
    projectName: 'Ramishvili VRF Instalation',
    projectIndex: '1.2.1.',
    counteragentShort: 'ინდეკო სი ემ',
    amountCurrency: '57,722.90 USD',
    effectiveDate: '16.08.2023',
    counteragentFull: 'ინდეკო სი ემ (ს.კ. 405508339) - შპს',
    financialCodeValidation: '1.2.1. (+) შემოსავალი MEP დანადგარების რეალიზაციიდან',
    currencyCode: 'USD',
  },
  {
    projectName: 'Kvareli Additional VRF Installation',
    projectIndex: '1.2.1.',
    counteragentShort: 'ინდეკო სი ემ',
    amountCurrency: '8,591.00 USD',
    effectiveDate: '11.10.2023',
    counteragentFull: 'ინდეკო სი ემ (ს.კ. 405508339) - შპს',
    financialCodeValidation: '1.2.1. (+) შემოსავალი MEP დანადგარების რეალიზაციიდან',
    currencyCode: 'USD',
  },
  {
    projectName: 'Kvareli SprinKlers',
    projectIndex: '1.2.1.',
    counteragentShort: 'ინდეკო სი ემ',
    amountCurrency: '10,339.00 EUR',
    effectiveDate: '04.10.2023',
    counteragentFull: 'ინდეკო სი ემ (ს.კ. 405508339) - შპს',
    financialCodeValidation: '1.2.1. (+) შემოსავალი MEP დანადგარების რეალიზაციიდან',
    currencyCode: 'EUR',
  },
  {
    projectName: 'Ramishvili Firefighting',
    projectIndex: '1.2.1.',
    counteragentShort: 'ინდეკო სი ემ',
    amountCurrency: '219,593.00 USD',
    effectiveDate: '01.12.2023',
    counteragentFull: 'ინდეკო სი ემ (ს.კ. 405508339) - შპს',
    financialCodeValidation: '1.2.1. (+) შემოსავალი MEP დანადგარების რეალიზაციიდან',
    currencyCode: 'USD',
  },
  {
    projectName: 'Ramishvili Ventilation',
    projectIndex: '1.2.1.',
    counteragentShort: 'ინდეკო სი ემ',
    amountCurrency: '183,367.50 USD',
    effectiveDate: '01.12.2023',
    counteragentFull: 'ინდეკო სი ემ (ს.კ. 405508339) - შპს',
    financialCodeValidation: '1.2.1. (+) შემოსავალი MEP დანადგარების რეალიზაციიდან',
    currencyCode: 'USD',
  },
  {
    projectName: 'Kvareli FF Pump',
    projectIndex: '1.2.1.',
    counteragentShort: 'ინდეკო სი ემ',
    amountCurrency: '51,668.00 USD',
    effectiveDate: '13.11.2023',
    counteragentFull: 'ინდეკო სი ემ (ს.კ. 405508339) - შპს',
    financialCodeValidation: '1.2.1. (+) შემოსავალი MEP დანადგარების რეალიზაციიდან',
    currencyCode: 'USD',
  },
  {
    projectName: 'Admiral design',
    projectIndex: '1.2.3.',
    counteragentShort: 'ინდეკო სი ემ',
    amountCurrency: '9,300.00 USD',
    effectiveDate: '01.05.2024',
    counteragentFull: 'ინდეკო სი ემ (ს.კ. 405508339) - შპს',
    financialCodeValidation: '1.2.3. (+) შემოსავალი MEP დანადგარების სერვისიდან - არაგეგმიური',
    currencyCode: 'USD',
  },
  {
    projectName: 'Kvareli VRV Installation',
    projectIndex: '1.2.1.',
    counteragentShort: 'ინდეკო სი ემ',
    amountCurrency: '100,000.00 USD',
    effectiveDate: '01.03.2023',
    counteragentFull: 'ინდეკო სი ემ (ს.კ. 405508339) - შპს',
    financialCodeValidation: '1.2.1. (+) შემოსავალი MEP დანადგარების რეალიზაციიდან',
    currencyCode: 'USD',
  },
  {
    projectName: 'Kvareli AHU',
    projectIndex: '1.2.1.',
    counteragentShort: 'ინდეკო სი ემ',
    amountCurrency: '109,707.00 EUR',
    effectiveDate: '01.11.2022',
    counteragentFull: 'ინდეკო სი ემ (ს.კ. 405508339) - შპს',
    financialCodeValidation: '1.2.1. (+) შემოსავალი MEP დანადგარების რეალიზაციიდან',
    currencyCode: 'EUR',
  },
  {
    projectName: 'Kvareli 3 units PFD Box',
    projectIndex: '1.2.1.',
    counteragentShort: 'ინდეკო სი ემ',
    amountCurrency: '1,875.00 USD',
    effectiveDate: '18.01.2024',
    counteragentFull: 'ინდეკო სი ემ (ს.კ. 405508339) - შპს',
    financialCodeValidation: '1.2.1. (+) შემოსავალი MEP დანადგარების რეალიზაციიდან',
    currencyCode: 'USD',
  },
  {
    projectName: 'Kvareli Pool AHU',
    projectIndex: '1.2.1.',
    counteragentShort: 'ინდეკო სი ემ',
    amountCurrency: '33,755.00 EUR',
    effectiveDate: '03.08.2023',
    counteragentFull: 'ინდეკო სი ემ (ს.კ. 405508339) - შპს',
    financialCodeValidation: '1.2.1. (+) შემოსავალი MEP დანადგარების რეალიზაციიდან',
    currencyCode: 'EUR',
  },
  {
    projectName: 'Kvareli Fire Valve',
    projectIndex: '1.2.1.',
    counteragentShort: 'ინდეკო სი ემ',
    amountCurrency: '0.00 EUR',
    effectiveDate: '04.10.2023',
    counteragentFull: 'ინდეკო სი ემ (ს.კ. 405508339) - შპს',
    financialCodeValidation: '1.2.1. (+) შემოსავალი MEP დანადგარების რეალიზაციიდან',
    currencyCode: 'EUR',
  },
  {
    projectName: 'Ramishvili Toshiba Ventilation Equipment',
    projectIndex: '1.2.1.',
    counteragentShort: 'ინდეკო სი ემ',
    amountCurrency: '45,968.00 USD',
    effectiveDate: '01.11.2023',
    counteragentFull: 'ინდეკო სი ემ (ს.კ. 405508339) - შპს',
    financialCodeValidation: '1.2.1. (+) შემოსავალი MEP დანადგარების რეალიზაციიდან',
    currencyCode: 'USD',
  },
  {
    projectName: 'Kvareli Additional VRV Controllers',
    projectIndex: '1.2.1.',
    counteragentShort: 'ინდეკო სი ემ',
    amountCurrency: '15,120.00 USD',
    effectiveDate: '04.10.2023',
    counteragentFull: 'ინდეკო სი ემ (ს.კ. 405508339) - შპს',
    financialCodeValidation: '1.2.1. (+) შემოსავალი MEP დანადგარების რეალიზაციიდან',
    currencyCode: 'USD',
  },
  {
    projectName: 'Kvareli Dammaged Indoor 2 Units',
    projectIndex: '1.2.1.',
    counteragentShort: 'ინდეკო სი ემ',
    amountCurrency: '1,320.00 USD',
    effectiveDate: '04.10.2023',
    counteragentFull: 'ინდეკო სი ემ (ს.კ. 405508339) - შპს',
    financialCodeValidation: '1.2.1. (+) შემოსავალი MEP დანადგარების რეალიზაციიდან',
    currencyCode: 'USD',
  },
  {
    projectName: 'VaKe VRV',
    projectIndex: '1.2.1.',
    counteragentShort: 'ინდეკო სი ემ',
    amountCurrency: '188,915.32 USD',
    effectiveDate: '01.06.2023',
    counteragentFull: 'ინდეკო სი ემ (ს.კ. 405508339) - შპს',
    financialCodeValidation: '1.2.1. (+) შემოსავალი MEP დანადგარების რეალიზაციიდან',
    currencyCode: 'USD',
  },
  {
    projectName: 'Kvareli VRF FILTER Installation',
    projectIndex: '1.2.1.',
    counteragentShort: 'ინდეკო სი ემ',
    amountCurrency: '2,877.00 GEL',
    effectiveDate: '18.05.2023',
    counteragentFull: 'ინდეკო სი ემ (ს.კ. 405508339) - შპს',
    financialCodeValidation: '1.2.1. (+) შემოსავალი MEP დანადგარების რეალიზაციიდან',
    currencyCode: 'GEL',
  },
  {
    projectName: 'Kvareli MocKup',
    projectIndex: '1.2.1.',
    counteragentShort: 'ინდეკო სი ემ',
    amountCurrency: '2,755.00 USD',
    effectiveDate: '13.12.2022',
    counteragentFull: 'ინდეკო სი ემ (ს.კ. 405508339) - შპს',
    financialCodeValidation: '1.2.1. (+) შემოსავალი MEP დანადგარების რეალიზაციიდან',
    currencyCode: 'USD',
  },
  {
    projectName: 'ChaKhruKhadze',
    projectIndex: '1.1.1.',
    counteragentShort: 'ინდეკო',
    amountCurrency: '23,100.00 USD',
    effectiveDate: '24.10.2019',
    counteragentFull: 'ინდეკო (ს.კ. 202376133) - შპს',
    financialCodeValidation: '1.1.1. (+) შემოსავალი ლიფტების რეალიზაციიდან',
    currencyCode: 'USD',
  },
];

const parseInn = (value: string) => {
  const match = value.match(/\b(\d{9,11})\b/);
  return match ? match[1] : null;
};

async function findProjectUuid(row: PaymentSeedRow) {
  const byNameIndex = await prisma.$queryRawUnsafe<any[]>(
    'SELECT project_uuid, project_name, project_index, created_at FROM projects WHERE project_name = $1 AND project_index = $2 ORDER BY created_at DESC LIMIT 2',
    row.projectName,
    row.projectIndex
  );
  if (byNameIndex.length >= 1) {
    if (byNameIndex.length > 1) {
      console.warn(`Multiple projects matched name+index; using latest: ${row.projectName} (${row.projectIndex})`);
    }
    return byNameIndex[0].project_uuid as string;
  }

  const byName = await prisma.$queryRawUnsafe<any[]>(
    'SELECT project_uuid, project_name, project_index, created_at FROM projects WHERE project_name = $1 ORDER BY created_at DESC LIMIT 2',
    row.projectName
  );
  if (byName.length >= 1) {
    if (byName.length > 1) {
      console.warn(`Multiple projects matched name; using latest: ${row.projectName}`);
    }
    return byName[0].project_uuid as string;
  }

  const byIndex = await prisma.$queryRawUnsafe<any[]>(
    'SELECT project_uuid, project_name, project_index, created_at FROM projects WHERE project_index = $1 ORDER BY created_at DESC LIMIT 2',
    row.projectIndex
  );
  if (byIndex.length >= 1) {
    if (byIndex.length > 1) {
      console.warn(`Multiple projects matched index; using latest: ${row.projectIndex}`);
    }
    return byIndex[0].project_uuid as string;
  }

  const byNameInsensitive = await prisma.$queryRawUnsafe<any[]>(
    'SELECT project_uuid, project_name, project_index, created_at FROM projects WHERE LOWER(project_name) = LOWER($1) ORDER BY created_at DESC LIMIT 2',
    row.projectName
  );
  if (byNameInsensitive.length >= 1) {
    if (byNameInsensitive.length > 1) {
      console.warn(`Multiple projects matched name (case-insensitive); using latest: ${row.projectName}`);
    }
    return byNameInsensitive[0].project_uuid as string;
  }

  const byNameLike = await prisma.$queryRawUnsafe<any[]>(
    'SELECT project_uuid, project_name, project_index, created_at FROM projects WHERE project_name ILIKE $1 ORDER BY created_at DESC LIMIT 2',
    `%${row.projectName}%`
  );
  if (byNameLike.length >= 1) {
    if (byNameLike.length > 1) {
      console.warn(`Multiple projects matched name (partial); using latest: ${row.projectName}`);
    }
    return byNameLike[0].project_uuid as string;
  }

  const tokens = row.projectName.split(/\s+/).filter(Boolean);
  if (tokens.length > 1) {
    const tokenPattern = `%${tokens.join('%')}%`;
    const byTokens = await prisma.$queryRawUnsafe<any[]>(
      'SELECT project_uuid, project_name, project_index, created_at FROM projects WHERE project_name ILIKE $1 ORDER BY created_at DESC LIMIT 2',
      tokenPattern
    );
    if (byTokens.length >= 1) {
      if (byTokens.length > 1) {
        console.warn(`Multiple projects matched tokens; using latest: ${row.projectName}`);
      }
      return byTokens[0].project_uuid as string;
    }
  }

  throw new Error(`Project not found: ${row.projectName} (${row.projectIndex})`);
}

async function findCounteragentUuid(row: PaymentSeedRow) {
  const inn = parseInn(row.counteragentFull);
  if (inn) {
    const byInn = await prisma.$queryRawUnsafe<any[]>(
      'SELECT counteragent_uuid FROM counteragents WHERE identification_number = $1 LIMIT 2',
      inn
    );
    if (byInn.length === 1) return byInn[0].counteragent_uuid as string;
  }

  const byName = await prisma.$queryRawUnsafe<any[]>(
    'SELECT counteragent_uuid FROM counteragents WHERE counteragent = $1 LIMIT 2',
    row.counteragentShort
  );
  if (byName.length === 1) return byName[0].counteragent_uuid as string;

  throw new Error(`Counteragent not found: ${row.counteragentShort}`);
}

async function findFinancialCodeUuid(row: PaymentSeedRow) {
  const byValidation = await prisma.$queryRawUnsafe<any[]>(
    'SELECT uuid, validation, code FROM financial_codes WHERE validation = $1 LIMIT 2',
    row.financialCodeValidation
  );
  if (byValidation.length === 1) return byValidation[0].uuid as string;

  const byCode = await prisma.$queryRawUnsafe<any[]>(
    'SELECT uuid, validation, code FROM financial_codes WHERE code = $1 LIMIT 2',
    row.projectIndex
  );
  if (byCode.length === 1) return byCode[0].uuid as string;

  throw new Error(`Financial code not found: ${row.financialCodeValidation}`);
}

async function findCurrencyUuid(row: PaymentSeedRow) {
  const result = await prisma.$queryRawUnsafe<any[]>(
    'SELECT uuid FROM currencies WHERE code = $1 LIMIT 2',
    row.currencyCode
  );
  if (result.length === 1) return result[0].uuid as string;
  throw new Error(`Currency not found: ${row.currencyCode}`);
}

async function ensurePayment(
  projectUuid: string,
  counteragentUuid: string,
  financialCodeUuid: string,
  currencyUuid: string
) {
  const existing = await prisma.$queryRawUnsafe<any[]>(
    `SELECT payment_id FROM payments
     WHERE counteragent_uuid = $1::uuid
       AND financial_code_uuid = $2::uuid
       AND currency_uuid = $3::uuid
       AND income_tax = false
       AND project_uuid IS NOT DISTINCT FROM $4::uuid
       AND job_uuid IS NULL
       AND is_active = true
     LIMIT 1`,
    counteragentUuid,
    financialCodeUuid,
    currencyUuid,
    projectUuid
  );

  if (existing.length > 0) {
    return { created: false, paymentId: existing[0].payment_id as string };
  }

  const inserted = await prisma.$queryRawUnsafe<any[]>(
    `INSERT INTO payments (
      project_uuid,
      counteragent_uuid,
      financial_code_uuid,
      job_uuid,
      income_tax,
      currency_uuid,
      accrual_source,
      payment_id,
      record_uuid,
      updated_at
    ) VALUES (
      $1::uuid,
      $2::uuid,
      $3::uuid,
      NULL,
      false,
      $4::uuid,
      NULL,
      '',
      '',
      NOW()
    ) RETURNING payment_id`,
    projectUuid,
    counteragentUuid,
    financialCodeUuid,
    currencyUuid
  );

  return { created: true, paymentId: inserted[0]?.payment_id as string };
}

async function main() {
  const results: Array<{ name: string; paymentId: string; created: boolean }> = [];
  const failures: Array<{ name: string; reason: string }> = [];

  for (const row of rows) {
    try {
      const projectUuid = await findProjectUuid(row);
      const counteragentUuid = await findCounteragentUuid(row);
      const financialCodeUuid = await findFinancialCodeUuid(row);
      const currencyUuid = await findCurrencyUuid(row);

      const outcome = await ensurePayment(
        projectUuid,
        counteragentUuid,
        financialCodeUuid,
        currencyUuid
      );

      results.push({
        name: row.projectName,
        paymentId: outcome.paymentId,
        created: outcome.created,
      });
    } catch (error: any) {
      failures.push({
        name: row.projectName,
        reason: error?.message || 'Unknown error',
      });
    }
  }

  const created = results.filter((r) => r.created);
  const skipped = results.filter((r) => !r.created);

  console.log(`Created: ${created.length}`);
  created.forEach((row) => console.log(`  + ${row.name}: ${row.paymentId}`));
  console.log(`Skipped (existing): ${skipped.length}`);
  skipped.forEach((row) => console.log(`  - ${row.name}: ${row.paymentId}`));

  if (failures.length > 0) {
    console.log(`Failed: ${failures.length}`);
    failures.forEach((row) => console.log(`  ! ${row.name}: ${row.reason}`));
  }
}

main()
  .catch((error) => {
    console.error('Failed to create payments:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });