import { OrisExport } from '@/components/oris-export';

export const revalidate = 0;

export const metadata = {
  title: 'ORIS Export',
};

export default function OrisExportPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-1">ORIS Export</h1>
      <p className="text-sm text-muted-foreground mb-4">
        Accounting entries for incoming waybills, in the file layout the ORIS program imports.
      </p>
      <OrisExport />
    </div>
  );
}
