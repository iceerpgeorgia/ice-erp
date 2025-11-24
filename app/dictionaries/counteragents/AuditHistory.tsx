"use client";
import * as React from "react";

type AuditLog = {
  id: number;
  changed_at: string;
  changed_by: string | null;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  operation: string;
};

type Props = {
  counteragentId: number;
};

export default function AuditHistory({ counteragentId }: Props) {
  const [logs, setLogs] = React.useState<AuditLog[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    async function fetchLogs() {
      try {
        setLoading(true);
        const res = await fetch(`/dictionaries/counteragents/audit-api?id=${counteragentId}`);
        if (!res.ok) throw new Error("Failed to fetch audit logs");
        const data = await res.json();
        setLogs(data);
      } catch (e: any) {
        setError(e.message || "Failed to load audit history");
      } finally {
        setLoading(false);
      }
    }
    fetchLogs();
  }, [counteragentId]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatFieldName = (field: string) => {
    return field
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  const getOperationBadge = (operation: string) => {
    const colors = {
      INSERT: "bg-green-100 text-green-800",
      UPDATE: "bg-blue-100 text-blue-800",
      DELETE: "bg-red-100 text-red-800",
    };
    return (
      <span
        className={`px-2 py-1 rounded text-xs font-medium ${
          colors[operation as keyof typeof colors] || "bg-gray-100 text-gray-800"
        }`}
      >
        {operation}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="p-4 border rounded bg-gray-50">
        <h2 className="text-lg font-semibold mb-4">Audit History</h2>
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 border rounded bg-red-50">
        <h2 className="text-lg font-semibold mb-4">Audit History</h2>
        <div className="text-red-600">{error}</div>
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="p-4 border rounded bg-gray-50">
        <h2 className="text-lg font-semibold mb-4">Audit History</h2>
        <div className="text-gray-500">No changes recorded yet.</div>
      </div>
    );
  }

  return (
    <div className="p-4 border rounded bg-white">
      <h2 className="text-lg font-semibold mb-4">Audit History</h2>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-3 py-2 font-medium">Date & Time</th>
              <th className="text-left px-3 py-2 font-medium">Changed By</th>
              <th className="text-left px-3 py-2 font-medium">Operation</th>
              <th className="text-left px-3 py-2 font-medium">Field</th>
              <th className="text-left px-3 py-2 font-medium">Old Value</th>
              <th className="text-left px-3 py-2 font-medium">New Value</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} className="border-t hover:bg-gray-50">
                <td className="px-3 py-2 whitespace-nowrap">{formatDate(log.changed_at)}</td>
                <td className="px-3 py-2">{log.changed_by || "System"}</td>
                <td className="px-3 py-2">{getOperationBadge(log.operation)}</td>
                <td className="px-3 py-2 font-medium">{formatFieldName(log.field_name)}</td>
                <td className="px-3 py-2 text-gray-600">
                  {log.old_value ? (
                    <span className="bg-red-50 px-2 py-1 rounded">{log.old_value}</span>
                  ) : (
                    <span className="text-gray-400 italic">empty</span>
                  )}
                </td>
                <td className="px-3 py-2 text-gray-900">
                  {log.new_value ? (
                    <span className="bg-green-50 px-2 py-1 rounded">{log.new_value}</span>
                  ) : (
                    <span className="text-gray-400 italic">empty</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
