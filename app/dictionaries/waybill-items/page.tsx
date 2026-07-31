import { WaybillItemsTable } from '@/components/figma/waybill-items-table';

export const revalidate = 0;

export default function WaybillItemsPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Waybill Items</h1>
      <WaybillItemsTable />
    </div>
  );
}
