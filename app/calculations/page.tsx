'use client';

import { useState, useEffect } from 'react';
import { PlusIcon, TrashIcon, CheckIcon, XIcon, EditIcon } from 'lucide-react';

interface CalculationTemplate {
  uuid: string;
  financial_code_uuid: string;
  template_uuid: string;
  template_name: string;
  is_active: boolean;
  created_at: string;
  financial_code?: {
    uuid: string;
    code: string;
    name: string;
  };
  template?: {
    uuid: string;
    operation_type: string;
    file_name: string;
  };
}

interface FinancialCode {
  uuid: string;
  code: string;
  name: string;
}

interface Template {
  uuid: string;
  operation_type: string;
  file_name: string;
}

export default function CalculationsPage() {
  const [calculations, setCalculations] = useState<CalculationTemplate[]>([]);
  const [financialCodes, setFinancialCodes] = useState<FinancialCode[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    financial_code_uuid: '',
    template_uuid: '',
    template_name: '',
    is_active: true,
  });

  // Fetch calculations, financial codes, and templates on mount
  useEffect(() => {
    fetchCalculations();
    fetchFinancialCodes();
    fetchTemplates();
  }, []);

  const fetchCalculations = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/calculations-financial-codes');
      if (!response.ok) throw new Error('Failed to fetch calculations');
      const data = await response.json();
      setCalculations(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch calculations');
    } finally {
      setLoading(false);
    }
  };

  const fetchFinancialCodes = async () => {
    try {
      const response = await fetch('/api/financial-codes?limit=1000&is_active=true');
      if (!response.ok) throw new Error('Failed to fetch financial codes');
      const data = await response.json();
      setFinancialCodes(data.data || []);
    } catch (err) {
      console.error('Failed to fetch financial codes:', err);
    }
  };

  const fetchTemplates = async () => {
    try {
      const response = await fetch('/api/templates?limit=1000&is_active=true');
      if (!response.ok) throw new Error('Failed to fetch templates');
      const data = await response.json();
      setTemplates(data.data || []);
    } catch (err) {
      console.error('Failed to fetch templates:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.financial_code_uuid || !formData.template_uuid || !formData.template_name) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      setLoading(true);
      const url = editingId 
        ? `/api/calculations-financial-codes/${editingId}`
        : '/api/calculations-financial-codes';
      
      const method = editingId ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save calculation');
      }

      setFormData({
        financial_code_uuid: '',
        template_uuid: '',
        template_name: '',
        is_active: true,
      });
      setEditingId(null);
      setShowForm(false);
      setError(null);
      fetchCalculations();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save calculation');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (calculation: CalculationTemplate) => {
    setFormData({
      financial_code_uuid: calculation.financial_code_uuid,
      template_uuid: calculation.template_uuid,
      template_name: calculation.template_name,
      is_active: calculation.is_active,
    });
    setEditingId(calculation.uuid);
    setShowForm(true);
  };

  const handleDelete = async (uuid: string) => {
    if (!window.confirm('Are you sure you want to delete this calculation template?')) return;

    try {
      setLoading(true);
      const response = await fetch(`/api/calculations-financial-codes/${uuid}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete calculation');
      
      fetchCalculations();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete calculation');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingId(null);
    setFormData({
      financial_code_uuid: '',
      template_uuid: '',
      template_name: '',
      is_active: true,
    });
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Calculation Templates</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          <PlusIcon size={20} />
          Add Template
        </button>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {showForm && (
        <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
          <h2 className="text-xl font-bold">
            {editingId ? 'Edit' : 'Create'} Calculation Template
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Financial Code *</label>
              <select
                value={formData.financial_code_uuid}
                onChange={(e) => setFormData({ ...formData, financial_code_uuid: e.target.value })}
                className="w-full border border-gray-300 rounded px-3 py-2"
                required
              >
                <option value="">Select Financial Code</option>
                {financialCodes.map((fc) => (
                  <option key={fc.uuid} value={fc.uuid}>
                    {fc.code} - {fc.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Template *</label>
              <select
                value={formData.template_uuid}
                onChange={(e) => {
                  const template = templates.find(t => t.uuid === e.target.value);
                  setFormData({
                    ...formData,
                    template_uuid: e.target.value,
                    template_name: template?.file_name || '',
                  });
                }}
                className="w-full border border-gray-300 rounded px-3 py-2"
                required
              >
                <option value="">Select Template</option>
                {templates.map((t) => (
                  <option key={t.uuid} value={t.uuid}>
                    {t.operation_type} - {t.file_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Template Name *</label>
              <input
                type="text"
                value={formData.template_name}
                onChange={(e) => setFormData({ ...formData, template_name: e.target.value })}
                className="w-full border border-gray-300 rounded px-3 py-2"
                required
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_active"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="rounded"
              />
              <label htmlFor="is_active" className="text-sm font-medium">
                Active
              </label>
            </div>

            <div className="flex gap-4">
              <button
                type="submit"
                disabled={loading}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {loading ? 'Saving...' : editingId ? 'Update' : 'Create'}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-lg shadow">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-6 py-3 text-left font-medium">Financial Code</th>
              <th className="px-6 py-3 text-left font-medium">Template</th>
              <th className="px-6 py-3 text-left font-medium">Template Name</th>
              <th className="px-6 py-3 text-left font-medium">Status</th>
              <th className="px-6 py-3 text-left font-medium">Created</th>
              <th className="px-6 py-3 text-left font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && calculations.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-4 text-center">
                  Loading...
                </td>
              </tr>
            ) : calculations.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                  No calculation templates found
                </td>
              </tr>
            ) : (
              calculations.map((calc) => (
                <tr key={calc.uuid} className="border-b hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="font-medium">{calc.financial_code?.code}</div>
                    <div className="text-xs text-gray-600">{calc.financial_code?.name}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-xs text-gray-600">{calc.template?.operation_type}</div>
                  </td>
                  <td className="px-6 py-4">{calc.template_name}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      calc.is_active
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {calc.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs text-gray-600">
                    {new Date(calc.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 space-x-2">
                    <button
                      onClick={() => handleEdit(calc)}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      <EditIcon size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(calc.uuid)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <TrashIcon size={16} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
