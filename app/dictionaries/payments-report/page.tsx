'use client';

import { PaymentsReportTable } from '@/components/figma/payments-report-table';
import { useSearchParams } from 'next/navigation';

export default function PaymentsReportPage() {
  const searchParams = useSearchParams();
  const paymentIds = searchParams.get('paymentIds');
  const isIncome = searchParams.get('isIncome');

  return <PaymentsReportTable preFilterPaymentIds={paymentIds} preFilterIsIncome={isIncome === 'false' ? false : isIncome === 'true' ? true : undefined} />;
}
