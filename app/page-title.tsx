'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

const toTitleCase = (value: string) =>
  value
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim();

const routeTitles: Record<string, string> = {
  '/': 'Home',
  '/dictionaries': 'Dictionaries',
  '/dictionaries/bank-accounts': 'Bank Accounts',
  '/dictionaries/bank-transactions': 'Bank Transactions',
  '/dictionaries/bank-transactions-test': 'Bank Transactions Test',
  '/dictionaries/banks': 'Banks',
  '/dictionaries/counteragents': 'Counteragents',
  '/dictionaries/currencies': 'Currencies',
  '/dictionaries/entity-types': 'Entity Types',
  '/dictionaries/financial-codes': 'Financial Codes',
  '/dictionaries/jobs': 'Jobs',
  '/dictionaries/nbg-rates': 'NBG Rates',
  '/dictionaries/parsing-scheme-rules': 'Parsing Scheme Rules',
  '/dictionaries/payments': 'Payments',
  '/dictionaries/payments-ledger': 'Payments Ledger',
  '/dictionaries/payments-report': 'Payments Report',
  '/dictionaries/waybills': 'Waybills In',
  '/dictionaries/projects': 'Projects',
  '/dictionaries/salary-accruals': 'Salary Accruals',
  '/bank-transaction-batches': 'Bank Transaction Batches',
};

const resolveTitle = (pathname: string) => {
  if (routeTitles[pathname]) return routeTitles[pathname];

  if (pathname.startsWith('/payment-statement')) {
    return 'Payment Statement';
  }

  if (pathname.startsWith('/counteragent-statement')) {
    return 'Counteragent Statement';
  }

  if (pathname.startsWith('/dictionaries/counteragents/')) {
    return 'Counteragents';
  }

  if (pathname.startsWith('/dictionaries/countries')) {
    return 'Countries';
  }

  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 0) return 'Home';
  return toTitleCase(segments[segments.length - 1]);
};

export default function PageTitle() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) return;
    document.title = resolveTitle(pathname);
  }, [pathname]);

  return null;
}
