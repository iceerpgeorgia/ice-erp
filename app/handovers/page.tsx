'use client';

import { HandoversTable } from '@/components/figma/handovers-table';
import { ErrorBoundary } from '@/components/figma/error-boundary';

export default function HandoversPage() {
  return (
    <ErrorBoundary fallback={(error, retry) => (
      <div className="w-full p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-6">
          <h2 className="text-xl font-semibold text-red-900 mb-2">Handovers page error</h2>
          <p className="text-sm text-red-800 mb-4 font-mono break-all">{error.message}</p>
          <details className="text-sm text-red-800 mb-4 p-3 bg-red-100/50 rounded">
            <summary className="cursor-pointer font-semibold">Stack trace</summary>
            <pre className="mt-2 text-xs overflow-auto max-h-40 whitespace-pre-wrap">{error.stack}</pre>
          </details>
          <button
            onClick={retry}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Try again
          </button>
        </div>
      </div>
    )}>
      <HandoversTable />
    </ErrorBoundary>
  );
}
