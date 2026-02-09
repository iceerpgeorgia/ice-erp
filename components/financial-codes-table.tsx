"use client";

import React, { useState, useEffect } from "react";
import { Download, Plus, Pencil, ChevronDown, ChevronRight } from "lucide-react";
import { exportRowsToXlsx } from "@/lib/export-xlsx";

type FinancialCode = {
  id: string; // API returns as string (serialized from BigInt)
  uuid: string;
  code: string;
  name: string;
  validation: string | null;
  appliesToPL: boolean;
  appliesToCF: boolean;
  isIncome: boolean;
  parentUuid: string | null; // UUID of parent
  description: string | null;
  depth: number;
  sortOrder: number;
  isActive: boolean;
  children?: FinancialCode[];
};

export function FinancialCodesTable() {
  const [codes, setCodes] = useState<FinancialCode[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCode, setEditingCode] = useState<FinancialCode | null>(null);
  const [parentCode, setParentCode] = useState<FinancialCode | null>(null);

  const fetchCodes = async () => {
    try {
      const res = await fetch("/api/financial-codes");
      const data = await res.json();

      const normalized: FinancialCode[] = Array.isArray(data)
        ? data.map((code: any) => ({
            id: String(code.id),
            uuid: code.uuid,
            code: code.code,
            name: code.name,
            validation: code.validation ?? null,
            appliesToPL: code.appliesToPL ?? code.applies_to_pl ?? false,
            appliesToCF: code.appliesToCF ?? code.applies_to_cf ?? false,
            isIncome: code.isIncome ?? code.is_income ?? false,
            parentUuid: code.parentUuid ?? code.parent_uuid ?? null,
            description: code.description ?? null,
            depth: code.depth ?? 0,
            sortOrder: code.sortOrder ?? code.sort_order ?? 0,
            isActive: code.isActive ?? code.is_active ?? true,
            children: [],
          }))
        : [];

      // Build hierarchical structure
      const hierarchy = buildHierarchy(normalized);
      setCodes(hierarchy);
      
      // Expand all nodes by default - collect all IDs
      const allIds = new Set<string>();
      normalized.forEach((code: FinancialCode) => {
        allIds.add(code.id);
      });
      setExpandedIds(allIds);
      
      setLoading(false);
    } catch (error) {
      console.error("Failed to fetch financial codes:", error);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCodes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const buildHierarchy = (flatList: FinancialCode[]): FinancialCode[] => {
    const map = new Map<string, FinancialCode>();
    const roots: FinancialCode[] = [];

    // Create map of all codes by uuid
    flatList.forEach(code => {
      map.set(code.uuid, { ...code, children: [] });
    });

    // Build parent-child relationships using parentUuid
    flatList.forEach(code => {
      const node = map.get(code.uuid)!;
      if (code.parentUuid && map.has(code.parentUuid)) {
        const parent = map.get(code.parentUuid)!;
        if (!parent.children) parent.children = [];
        parent.children.push(node);
      } else {
        roots.push(node);
      }
    });

    // Sort children with special handling: codes starting with "0" come after "9"
    // and numeric parts are compared as integers (0.10 comes after 0.9)
    const sortChildren = (nodes: FinancialCode[]) => {
      nodes.sort((a, b) => {
        if (a.sortOrder !== b.sortOrder) {
          return a.sortOrder - b.sortOrder;
        }
        
        // Custom sort: codes starting with "0" should come after "9"
        const aStartsWith0 = a.code.startsWith('0');
        const bStartsWith0 = b.code.startsWith('0');
        
        if (aStartsWith0 && !bStartsWith0) return 1;  // a after b
        if (!aStartsWith0 && bStartsWith0) return -1; // a before b
        
        // Split codes by dots and compare each part as integer
        const aParts = a.code.split('.').map(p => parseInt(p, 10) || 0);
        const bParts = b.code.split('.').map(p => parseInt(p, 10) || 0);
        
        const maxLen = Math.max(aParts.length, bParts.length);
        for (let i = 0; i < maxLen; i++) {
          const aVal = aParts[i] || 0;
          const bVal = bParts[i] || 0;
          if (aVal !== bVal) {
            return aVal - bVal;
          }
        }
        
        return 0;
      });
      nodes.forEach(node => {
        if (node.children && node.children.length > 0) {
          sortChildren(node.children);
        }
      });
    };

    sortChildren(roots);

    return roots;
  };

  const flattenCodes = (nodes: FinancialCode[]): FinancialCode[] => {
    const result: FinancialCode[] = [];
    const walk = (items: FinancialCode[]) => {
      items.forEach((item) => {
        result.push(item);
        if (item.children && item.children.length > 0) {
          walk(item.children);
        }
      });
    };
    walk(nodes);
    return result;
  };

  const handleExportXlsx = () => {
    if (codes.length === 0) return;
    setIsExporting(true);
    try {
      const exportColumns = [
        { key: 'code', label: 'Code' },
        { key: 'name', label: 'Name' },
        { key: 'validation', label: 'Validation' },
        { key: 'description', label: 'Description' },
        { key: 'appliesToPL', label: 'P&L' },
        { key: 'appliesToCF', label: 'CF' },
        { key: 'isIncome', label: 'Income' },
        { key: 'isActive', label: 'Active' },
        { key: 'parentUuid', label: 'Parent UUID' },
        { key: 'depth', label: 'Depth' },
        { key: 'sortOrder', label: 'Sort Order' },
        { key: 'uuid', label: 'UUID' },
      ];
      const fileName = `financial-codes_${new Date().toISOString().slice(0, 10)}.xlsx`;
      exportRowsToXlsx({
        rows: flattenCodes(codes),
        columns: exportColumns,
        fileName,
        sheetName: 'Financial Codes',
      });
    } finally {
      setIsExporting(false);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleAdd = (parent?: FinancialCode) => {
    setParentCode(parent || null);
    setEditingCode(null);
    setIsDialogOpen(true);
  };

  const handleEdit = (code: FinancialCode) => {
    setEditingCode(code);
    const flat = flattenCodes(codes);
    const parent = code.parentUuid
      ? flat.find((item) => item.uuid === code.parentUuid) || null
      : null;
    setParentCode(parent);
    setIsDialogOpen(true);
  };

  const renderRow = (code: FinancialCode, level: number = 0): React.ReactNode => {
    const hasChildren = code.children && code.children.length > 0;
    const isExpanded = expandedIds.has(code.id);
    const indent = level * 24;

    return (
      <React.Fragment key={code.id}>
        <tr className="border-b hover:bg-slate-50">
          <td className="px-4 py-3" style={{ paddingLeft: `${16 + indent}px` }}>
            <div className="flex items-center gap-2">
              {hasChildren ? (
                <button
                  onClick={() => toggleExpand(code.id)}
                  className="p-1 hover:bg-slate-200 rounded"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </button>
              ) : (
                <span className="w-6" />
              )}
              <span className="font-mono font-medium">{code.code}.</span>
            </div>
          </td>
          <td className="px-4 py-3">{code.name}</td>
          <td className="px-4 py-3 text-center">
            {code.isIncome ? "✓" : ""}
          </td>
          <td className="px-4 py-3 text-sm text-slate-600">
            {code.validation || ""}
          </td>
          <td className="px-4 py-3 text-sm text-slate-600">
            {code.description || ""}
          </td>
          <td className="px-4 py-3 text-center">
            {code.appliesToPL ? "✓" : ""}
          </td>
          <td className="px-4 py-3 text-center">
            {code.appliesToCF ? "✓" : ""}
          </td>
          <td className="px-4 py-3 text-center">
            <span className={code.isActive ? "text-green-600" : "text-red-600"}>
              {code.isActive ? "✓" : "✗"}
            </span>
          </td>
          <td className="px-4 py-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleAdd(code)}
                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                title="Add child"
              >
                <Plus className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleEdit(code)}
                className="p-1.5 text-slate-600 hover:bg-slate-100 rounded"
                title="Edit"
              >
                <Pencil className="w-4 h-4" />
              </button>
            </div>
          </td>
        </tr>
        {hasChildren && isExpanded && code.children!.map(child => renderRow(child, level + 1))}
      </React.Fragment>
    );
  };

  if (loading) {
    return <div className="p-8 text-center">Loading financial codes...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Financial Codes</h1>
          <p className="text-slate-600 mt-2">Hierarchical view of your structure of P&L and Cash Flow</p>
          <p className="text-xs text-slate-500 mt-1">
            Note: You can use @project and @job_no placeholders in descriptions (e.g., ხელფასი + @project + @job_no).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportXlsx}
            disabled={isExporting || codes.length === 0}
            className="flex items-center gap-2 px-4 py-2 border rounded-lg text-slate-700 hover:bg-slate-50 transition"
          >
            <Download className="w-4 h-4" />
            {isExporting ? 'Exporting...' : 'Export XLSX'}
          </button>
          <button
            onClick={() => handleAdd()}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            <Plus className="w-4 h-4" />
            Add Root Code
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg border shadow-sm overflow-auto">
        <table className="w-full">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">Code</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">Name</th>
              <th className="px-4 py-3 text-center font-semibold text-slate-700">Income</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">Validation</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">Description</th>
              <th className="px-4 py-3 text-center font-semibold text-slate-700">P&L</th>
              <th className="px-4 py-3 text-center font-semibold text-slate-700">CF</th>
              <th className="px-4 py-3 text-center font-semibold text-slate-700">Active</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">Actions</th>
            </tr>
          </thead>
          <tbody>
            {codes.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                  No financial codes found. Click &quot;Add Root Code&quot; to create one.
                </td>
              </tr>
            ) : (
              codes.map(code => renderRow(code, 0))
            )}
          </tbody>
        </table>
      </div>

      {isDialogOpen && (
        <FinancialCodeDialog
          code={editingCode}
          parent={parentCode}
          onClose={() => setIsDialogOpen(false)}
          onSuccess={() => {
            setIsDialogOpen(false);
            fetchCodes();
          }}
        />
      )}
    </div>
  );
}

type DialogProps = {
  code: FinancialCode | null;
  parent: FinancialCode | null;
  onClose: () => void;
  onSuccess: () => void;
};

function FinancialCodeDialog({ code, parent, onClose, onSuccess }: DialogProps) {
  const [formData, setFormData] = useState({
    codeNumber: "",
    name: "",
    description: "",
    isIncome: false,
    appliesToPL: false,
    appliesToCF: false,
    isActive: true,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (code) {
      // Editing existing code - extract just the last segment if there's a parent
      const codeNumber = parent && code.code.startsWith(parent.code + ".")
        ? code.code.substring(parent.code.length + 1)
        : code.code;
      
      setFormData({
        codeNumber,
        name: code.name,
        description: code.description || "",
        isIncome: code.isIncome,
        appliesToPL: code.appliesToPL,
        appliesToCF: code.appliesToCF,
        isActive: code.isActive,
      });
    }
  }, [code, parent]);

  // Compute validation preview - updates live as form fields change
  const validationPreview = (() => {
    const fullCode = parent
      ? `${parent.code}.${formData.codeNumber}`
      : formData.codeNumber;
    const incomeIndicator = formData.isIncome ? " (+) " : " (-) ";
    return fullCode && formData.name ? `${fullCode}.${incomeIndicator}${formData.name}` : "";
  })();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrors({});

    try {
      const fullCode = parent
        ? `${parent.code}.${formData.codeNumber}`
        : formData.codeNumber;

      const payload = {
        ...(code && { id: code.id }),
        code: fullCode,
        name: formData.name,
        description: formData.description,
        isIncome: formData.isIncome,
        appliesToPL: formData.appliesToPL,
        appliesToCF: formData.appliesToCF,
        isActive: formData.isActive,
        parentUuid: parent?.uuid || null,
      };

      const method = code ? "PATCH" : "POST";
      const res = await fetch("/api/financial-codes", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok) {
        onSuccess();
      } else {
        setErrors(data.errors || {});
      }
    } catch (error) {
      console.error("Submit error:", error);
      setErrors({ _form: "Failed to save" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto m-4">
        <div className="p-6 border-b">
          <h2 className="text-2xl font-bold">
            {code ? "Edit Account" : parent ? `Add Child to ${parent.code}` : "Add Root Code"}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {parent && (
            <div className="bg-slate-50 p-3 rounded text-sm">
              Parent: <span className="font-mono font-semibold">{parent.code}.</span> - {parent.name}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">
              Code Number {parent ? "(child number only)" : "(root number)"}
            </label>
            <input
              type="text"
              value={formData.codeNumber}
              onChange={(e) => {
                // Only allow integers
                const value = e.target.value.replace(/[^\d]/g, '');
                setFormData({ ...formData, codeNumber: value });
              }}
              className="w-full px-3 py-2 border rounded-lg font-mono"
              placeholder={parent ? "e.g., 1 (becomes " + parent.code + ".1)" : "e.g., 1, 2, 3"}
            />
            {errors.code && <p className="text-red-600 text-sm mt-1">{errors.code}</p>}
            {parent && formData.codeNumber && (
              <p className="text-xs text-slate-600 mt-1">
                Full code will be: <span className="font-mono font-semibold">{parent.code}.{formData.codeNumber}</span>
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Name (Georgian)</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
            />
            {errors.name && <p className="text-red-600 text-sm mt-1">{errors.name}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
              rows={3}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Validation (Auto-generated)
            </label>
            <div className="w-full px-3 py-2 border rounded-lg bg-slate-50 text-slate-600 font-mono text-sm">
              {validationPreview || "Will be generated based on code, income status, and name"}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Format: Code. + {formData.isIncome ? '"(+)"' : '"(-)"'} + Name
            </p>
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.isIncome}
                onChange={(e) => setFormData({ ...formData, isIncome: e.target.checked })}
                className="rounded"
              />
              <span className="text-sm font-medium">Is Income</span>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.appliesToPL}
                onChange={(e) => setFormData({ ...formData, appliesToPL: e.target.checked })}
                className="rounded"
              />
              <span className="text-sm font-medium">Applies to P&L Statement</span>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.appliesToCF}
                onChange={(e) => setFormData({ ...formData, appliesToCF: e.target.checked })}
                className="rounded"
              />
              <span className="text-sm font-medium">Applies to Cash Flow Statement</span>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="rounded"
              />
              <span className="text-sm font-medium">Active</span>
            </label>
          </div>

          {errors._form && <p className="text-red-600 text-sm">{errors._form}</p>}

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border rounded-lg hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? "Saving..." : code ? "Update" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
