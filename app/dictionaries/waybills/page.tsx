import { WaybillsTable } from '@/components/figma/waybills-table';

export const revalidate = 0;

export default function WaybillsPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Waybills In</h1>
      <WaybillsTable />
    </div>
  );
}
