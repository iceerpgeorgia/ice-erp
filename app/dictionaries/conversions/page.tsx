import { ConversionsTable } from '@/components/figma/conversions-table';

export const revalidate = 0;

export default function ConversionsPage() {
  return (
    <div className="w-full px-6 py-6">
      <div className="mb-4">
        <h1 className="text-2xl font-semibold">Conversions</h1>
        <p className="text-sm text-muted-foreground">
          BOG conversion pairs with account and currency labels.
        </p>
      </div>
      <ConversionsTable />
    </div>
  );
}
