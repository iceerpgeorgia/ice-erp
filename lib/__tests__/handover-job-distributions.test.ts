import {
  buildPaymentLookupMaps,
  makePaymentLookupKey,
  resolvePaymentInfo,
} from '../handovers-job-distributions';

describe('handover job distribution lookup', () => {
  it('prefers the exact composite payment key over a duplicate payment-id alias', () => {
    const payments = [
      {
        paymentUuid: 'uuid-1',
        currencyCode: 'USD',
        paymentId: 'PAY-1',
        projectUuid: 'project-a',
        counteragentUuid: 'ca-a',
        financialCodeUuid: 'fc-a',
      },
      {
        paymentUuid: 'uuid-2',
        currencyCode: 'GEL',
        paymentId: 'PAY-1',
        projectUuid: 'project-b',
        counteragentUuid: 'ca-b',
        financialCodeUuid: 'fc-b',
      },
    ];

    const { paymentMap, paymentIdMap } = buildPaymentLookupMaps(payments as any);

    const row = {
      payment_id: 'PAY-1',
      project_uuid: 'project-a',
      counteragent_uuid: 'ca-a',
      financial_code_uuid: 'fc-a',
      nominal_currency_code: 'USD',
    } as any;

    expect(resolvePaymentInfo(row, paymentMap, paymentIdMap)).toEqual({
      paymentUuid: 'uuid-1',
      currencyCode: 'USD',
      paymentId: 'PAY-1',
    });
  });

  it('returns null when the payment id is ambiguous and no composite key matches', () => {
    const payments = [
      {
        paymentUuid: 'uuid-1',
        currencyCode: 'USD',
        paymentId: 'PAY-1',
        projectUuid: 'project-a',
        counteragentUuid: 'ca-a',
        financialCodeUuid: 'fc-a',
      },
      {
        paymentUuid: 'uuid-2',
        currencyCode: 'GEL',
        paymentId: 'PAY-1',
        projectUuid: 'project-b',
        counteragentUuid: 'ca-b',
        financialCodeUuid: 'fc-b',
      },
    ];

    const { paymentMap, paymentIdMap } = buildPaymentLookupMaps(payments as any);

    const row = {
      payment_id: 'PAY-1',
      project_uuid: 'project-c',
      counteragent_uuid: 'ca-c',
      financial_code_uuid: 'fc-c',
      nominal_currency_code: 'EUR',
    } as any;

    expect(resolvePaymentInfo(row, paymentMap, paymentIdMap)).toBeNull();
  });

  it('creates stable composite keys for payment lookup', () => {
    expect(
      makePaymentLookupKey('PAY-1', 'project-a', 'ca-a', 'fc-a', 'USD')
    ).toBe('PAY-1|project-a|ca-a|fc-a|USD');
  });
});
