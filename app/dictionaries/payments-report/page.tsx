import { PaymentsReportTable } from '@/components/figma/payments-report-table';

export const metadata = {
  title: 'Payments Report',
};

// Always render dynamically and never cache the HTML for this page.
// Ensures every navigation pulls the latest JS bundle hashes, so users
// can never get stuck on an old client build that ignores no-store fetches.
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export default function PaymentsReportPage() {
  return <PaymentsReportTable />;
}
