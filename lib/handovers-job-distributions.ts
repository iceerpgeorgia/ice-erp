export type PaymentLookupEntry = {
  paymentUuid: string;
  currencyCode: string | null;
  paymentId: string | null;
  financialCodeUuid: string | null;
};

export type PaymentLookupInput = {
  paymentUuid?: string | null;
  paymentId?: string | null;
  projectUuid?: string | null;
  counteragentUuid?: string | null;
  financialCodeUuid?: string | null;
  currencyCode?: string | null;
};

export function makePaymentLookupKey(
  paymentId?: string | null,
  projectUuid?: string | null,
  counteragentUuid?: string | null,
  financialCodeUuid?: string | null,
  currencyCode?: string | null,
) {
  return [
    paymentId ?? '',
    projectUuid ?? '',
    counteragentUuid ?? '',
    financialCodeUuid ?? '',
    currencyCode ?? '',
  ].join('|');
}

export function buildPaymentLookupMaps(payments: PaymentLookupInput[]) {
  const paymentMap = new Map<string, PaymentLookupEntry>();
  const paymentIdMap = new Map<string, PaymentLookupEntry[]>();

  payments.forEach((payment) => {
    if (!payment.paymentId || !payment.paymentUuid) return;

    const entry: PaymentLookupEntry = {
      paymentUuid: payment.paymentUuid,
      currencyCode: payment.currencyCode ?? null,
      paymentId: payment.paymentId ?? null,
      financialCodeUuid: payment.financialCodeUuid ?? null,
    };

    paymentMap.set(
      makePaymentLookupKey(
        payment.paymentId,
        payment.projectUuid,
        payment.counteragentUuid,
        payment.financialCodeUuid,
        payment.currencyCode,
      ),
      entry,
    );

    const aliases = paymentIdMap.get(payment.paymentId) ?? [];
    aliases.push(entry);
    paymentIdMap.set(payment.paymentId, aliases);
  });

  return { paymentMap, paymentIdMap };
}

export function resolvePaymentInfo(
  row: {
    payment_id?: string | null;
    project_uuid?: string | null;
    counteragent_uuid?: string | null;
    financial_code_uuid?: string | null;
    nominal_currency_code?: string | null;
  },
  paymentMap: Map<string, PaymentLookupEntry>,
  paymentIdMap: Map<string, PaymentLookupEntry[]>,
) {
  const compositeKey = makePaymentLookupKey(
    row.payment_id,
    row.project_uuid,
    row.counteragent_uuid,
    row.financial_code_uuid,
    row.nominal_currency_code,
  );

  if (paymentMap.has(compositeKey)) {
    return paymentMap.get(compositeKey) ?? null;
  }

  if (!row.payment_id) return null;

  const candidates = paymentIdMap.get(row.payment_id) ?? [];
  return candidates.length === 1 ? candidates[0] : null;
}
