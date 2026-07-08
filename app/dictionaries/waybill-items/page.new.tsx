'use client';

import { WaybillItemsTable } from '@/components/figma/waybill-items-table';

export default function WaybillItemsPage() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Waybill Items</h1>
        <p className="text-gray-600 mt-2">
          Manage waybill line items with appendable waybill header columns for comprehensive inventory tracking.
        </p>
      </div>
      <WaybillItemsTable />
    </div>
  );
}
