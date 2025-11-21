// app/dictionaries/entity-types/[id]/edit/page.tsx
import { getServerSession } from "next-auth/next";
import { authOptions, prisma } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { updateEntityType, deleteEntityType } from "../../actions";
import DeleteButton from "../../DeleteButton";

export default async function EditEntityTypePage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/api/auth/signin");

  const id = BigInt(Number(params.id));
  const item = await prisma.entityType.findUnique({ where: { id } });
  if (!item) redirect("/dictionaries/entity-types");

  return (
    <div style={{ maxWidth: 480 }}>
      <h1 className="text-2xl font-semibold mb-4">Edit entity type #{item.id.toString()}</h1>

      <form action={updateEntityType.bind(null, params.id)} className="grid gap-3">
        <label className="grid gap-1">
          <span className="text-sm">Code</span>
          <input name="code" defaultValue={item.code ?? ""} className="border rounded px-3 py-2" />
        </label>
        <label className="grid gap-1">
          <span className="text-sm">Name (EN)</span>
          <input name="name_en" defaultValue={item.name_en} required className="border rounded px-3 py-2" />
        </label>
        <label className="grid gap-1">
          <span className="text-sm">Name (KA)</span>
          <input name="name_ka" defaultValue={item.name_ka} required className="border rounded px-3 py-2" />
        </label>
        <label className="inline-flex items-center gap-2">
          <input type="checkbox" name="is_active" defaultChecked={item.is_active} />
          <span className="text-sm">Active</span>
        </label>

        <div className="flex gap-2 mt-2 items-center">
          <button type="submit" className="border rounded px-3 py-2 hover:bg-gray-50">Save</button>
          <Link href="/dictionaries/entity-types" className="border rounded px-3 py-2 hover:bg-gray-50">Cancel</Link>
          <DeleteButton
            className="ml-auto border rounded px-3 py-2 text-red-700 hover:bg-red-50"
            action={deleteEntityType.bind(null, params.id)}
            label="Delete"
            confirmMessage="Delete this entity type?"
          />
        </div>
      </form>
    </div>
  );
}



