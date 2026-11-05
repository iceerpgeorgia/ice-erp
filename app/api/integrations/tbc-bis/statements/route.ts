import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import {
  getTbcBisAccessToken,
  getTbcBisConfigStatus,
  getTokenPreview,
  tbcBisApiRequest,
} from '@/lib/integrations/tbc-bis/client';
import { mapTbcStatementPayloadToXml } from '@/lib/integrations/tbc-bis/statement-mapper';
import { processTBC } from '@/lib/bank-import/import_bank_xml_data';
import { getSupabaseClient } from '@/lib/bank-import/db-utils';

export const dynamic = 'force-dynamic';

type StatementPreviewResponse = {
  ok: boolean;
  mode: 'preview';
  path: string;
  status: number;
  correlationId: string | null;
  detailsCount: number;
  header: {
    AccountNo: string;
    Currency: string;
    DateFrom?: string;
    DateTo?: string;
  };
  xmlPreview: string;
  config: ReturnType<typeof getTbcBisConfigStatus>;
};

function sanitizePath(value: string | null) {
  if (!value) return null;
  if (!value.startsWith('/')) return null;
  if (value.includes('://')) return null;
  return value;
}

function parseBoolean(value: string | null) {
  if (!value) return false;
  return value === '1' || value.toLowerCase() === 'true' || value.toLowerCase() === 'yes';
}

async function resolveAccountContext(accountUuid: string) {
  const supabase = getSupabaseClient();
  const { data: account, error: accountError } = await supabase
    .from('bank_accounts')
    .select('uuid, account_number, currency_uuid, insider_uuid, raw_table_name')
    .eq('uuid', accountUuid)
    .single();

  if (accountError || !account) {
    throw new Error(`bank_accounts entry not found for accountUuid=${accountUuid}`);
  }

  const { data: currency, error: currencyError } = await supabase
    .from('currencies')
    .select('code')
    .eq('uuid', account.currency_uuid)
    .single();

  if (currencyError || !currency?.code) {
    throw new Error(`currencies entry not found for currencyUuid=${account.currency_uuid}`);
  }

  const currencyCode = String(currency.code).trim().toUpperCase();
  const accountNumber = String(account.account_number).trim().toUpperCase();

  return {
    accountUuid: account.uuid,
    accountNumber,
    currencyCode,
    insiderUuid: account.insider_uuid ? String(account.insider_uuid) : null,
    rawTableName:
      (account.raw_table_name ? String(account.raw_table_name).trim() : '') ||
      `${accountNumber}_TBC_${currencyCode}`,
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const path = sanitizePath(searchParams.get('path'));
    const importToDb = parseBoolean(searchParams.get('import'));
    const accountUuid = searchParams.get('accountUuid');
    const insiderUuid = searchParams.get('insiderUuid') || undefined;
    const accountNumber = searchParams.get('accountNumber') || undefined;
    const currencyCode = searchParams.get('currency') || undefined;

    const accountContext = importToDb && accountUuid ? await resolveAccountContext(accountUuid) : null;
    const effectiveInsiderUuid = accountContext?.insiderUuid || insiderUuid;

    if (!path) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Missing or invalid ?path. Expected relative TBC BIS path like /bab/v1/accounts/movements?...',
          config: getTbcBisConfigStatus(),
        },
        { status: 400 }
      );
    }

    const token = await getTbcBisAccessToken({ insiderUuid: effectiveInsiderUuid || undefined });
    const tokenPreview = getTokenPreview(token);

    const tbcResponse = await tbcBisApiRequest<unknown>({
      method: 'GET',
      path,
      insiderUuid: effectiveInsiderUuid || undefined,
    });

    if (!tbcResponse.ok) {
      return NextResponse.json(
        {
          ok: false,
          path,
          status: tbcResponse.status,
          correlationId: tbcResponse.correlationId,
          response: tbcResponse.data,
          config: getTbcBisConfigStatus(),
          token: tokenPreview,
        },
        { status: 502 }
      );
    }

    const mapped = mapTbcStatementPayloadToXml(tbcResponse.data, {
      accountNumber: accountContext?.accountNumber || accountNumber,
      currencyCode: accountContext?.currencyCode || currencyCode,
      allowEmptyStatement: true,
    });

    if (!importToDb) {
      const preview: StatementPreviewResponse = {
        ok: true,
        mode: 'preview',
        path,
        status: tbcResponse.status,
        correlationId: tbcResponse.correlationId,
        detailsCount: mapped.detailsCount,
        header: mapped.header,
        xmlPreview: mapped.xmlContent.slice(0, 3000),
        config: getTbcBisConfigStatus(),
      };

      return NextResponse.json({
        ...preview,
        token: tokenPreview,
      });
    }

    if (!accountUuid) {
      return NextResponse.json(
        {
          ok: false,
          error: 'accountUuid is required when import=1',
        },
        { status: 400 }
      );
    }

    const importAccountContext = accountContext || (await resolveAccountContext(accountUuid));
    if (!importAccountContext) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Failed to resolve account context',
        },
        { status: 500 }
      );
    }

    if (mapped.detailsCount === 0) {
      return NextResponse.json({
        ok: true,
        mode: 'import',
        path,
        status: tbcResponse.status,
        correlationId: tbcResponse.correlationId,
        detailsCount: 0,
        header: mapped.header,
        accountContext: importAccountContext,
        token: tokenPreview,
        message: 'No statement transactions returned by TBC BIS for the requested period. Import skipped.',
      });
    }

    await processTBC(
      mapped.xmlContent,
      importAccountContext.accountUuid,
      importAccountContext.accountNumber,
      importAccountContext.currencyCode,
      importAccountContext.rawTableName,
      uuidv4()
    );

    return NextResponse.json({
      ok: true,
      mode: 'import',
      path,
      status: tbcResponse.status,
      correlationId: tbcResponse.correlationId,
      detailsCount: mapped.detailsCount,
      header: mapped.header,
      accountContext: importAccountContext,
      token: tokenPreview,
      message: 'TBC BIS statement mapped to XML headers/records and imported through TBC pipeline.',
    });
  } catch (error: any) {
    const message = error?.message || 'Failed to process TBC BIS statement endpoint';
    const status = message.includes('Synthetic API keys are not allowed') ? 422 : 500;
    return NextResponse.json(
      {
        ok: false,
        error: message,
        config: getTbcBisConfigStatus(),
      },
      { status }
    );
  }
}

