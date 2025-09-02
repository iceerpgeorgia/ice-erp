import { createEntityType } from "./actions";

export default function EntitiesForm() {
  return (
    <div className="border rounded-xl p-4">
      <h2 className="font-semibold mb-3">Add Entity Type</h2>
      <form action={createEntityType} className="grid gap-3 grid-cols-1 md:grid-cols-2">
        <label className="grid gap-1">
          <span className="text-sm">Code</span>
          <input name="code" className="border rounded-md px-3 py-2 w-full" placeholder="LTD" />
        </label>
        <label className="grid gap-1">
          <span className="text-sm">Active</span>
          <input type="checkbox" name="is_active" defaultChecked className="h-4 w-4" />
        </label>
        <label className="grid gap-1">
          <span className="text-sm">Name (EN)</span>
          <input name="name_en" className="border rounded-md px-3 py-2 w-full" placeholder="Limited" required />
        </label>
        <label className="grid gap-1">
          <span className="text-sm">Name (KA)</span>
          <input name="name_ka" className="border rounded-md px-3 py-2 w-full" placeholder="ქართული" required />
        </label>
        <div className="md:col-span-2">
          <button className="border rounded-md px-3 py-2 hover:bg-gray-50" type="submit">Save</button>
        </div>
      </form>
      <p className="mt-4 text-xs text-gray-500">
        To bulk-load from Excel, run: <code>npm run import:entity-types</code>
      </p>
    </div>
  );
}

