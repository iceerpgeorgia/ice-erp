'use client';

import { useEffect, useState } from 'react';
import { Plus, Edit, Trash2, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';

interface ParsingScheme {
  id: number;
  name: string;
  description: string | null;
  isActive: boolean;
  rulesCount: number;
  accountsCount: number;
}

interface ParsingRule {
  id: number;
  parsingSchemeId: number;
  columnName: string;
  conditionOperator: string;
  conditionValue: string | null;
  paymentId: string;
  priority: number;
  isActive: boolean;
}

const CONDITION_OPERATORS = [
  { value: 'equals', label: 'Equals' },
  { value: 'equals_ignore_case', label: 'Equals (ignore case)' },
  { value: 'contains', label: 'Contains' },
  { value: 'starts_with', label: 'Starts with' },
  { value: 'ends_with', label: 'Ends with' },
  { value: 'regex_match', label: 'Regex match' },
  { value: 'greater_than', label: 'Greater than' },
  { value: 'less_than', label: 'Less than' },
  { value: 'greater_than_or_equal', label: 'Greater than or equal' },
  { value: 'less_than_or_equal', label: 'Less than or equal' },
  { value: 'is_null', label: 'Is null' },
  { value: 'is_not_null', label: 'Is not null' },
  { value: 'is_empty', label: 'Is empty' },
  { value: 'is_not_empty', label: 'Is not empty' },
  { value: 'not_equals', label: 'Not equals' },
  { value: 'not_contains', label: 'Does not contain' }
];

const COLUMN_NAMES = [
  'description',
  'counteragent_account_number',
  'account_currency_amount',
  'id_1',
  'id_2',
  'date'
];

export default function ParsingRulesPage() {
  const [schemes, setSchemes] = useState<ParsingScheme[]>([]);
  const [selectedScheme, setSelectedScheme] = useState<ParsingScheme | null>(null);
  const [rules, setRules] = useState<ParsingRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [ruleDialogOpen, setRuleDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<ParsingRule | null>(null);
  
  // Form state
  const [columnName, setColumnName] = useState('');
  const [conditionOperator, setConditionOperator] = useState('equals');
  const [conditionValue, setConditionValue] = useState('');
  const [paymentId, setPaymentId] = useState('');
  const [priority, setPriority] = useState('0');
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    fetchSchemes();
  }, []);

  useEffect(() => {
    if (selectedScheme) {
      fetchRules(selectedScheme.id);
    }
  }, [selectedScheme]);

  const fetchSchemes = async () => {
    try {
      const response = await fetch('/api/parsing-schemes');
      if (!response.ok) throw new Error('Failed to fetch schemes');
      const data = await response.json();
      setSchemes(data);
      if (data.length > 0 && !selectedScheme) {
        setSelectedScheme(data[0]);
      }
    } catch (error) {
      console.error('Error fetching schemes:', error);
      alert('Failed to load parsing schemes');
    } finally {
      setLoading(false);
    }
  };

  const fetchRules = async (schemeId: number) => {
    try {
      const response = await fetch(`/api/parsing-rules?parsingSchemeId=${schemeId}`);
      if (!response.ok) throw new Error('Failed to fetch rules');
      const data = await response.json();
      setRules(data);
    } catch (error) {
      console.error('Error fetching rules:', error);
      alert('Failed to load parsing rules');
    }
  };

  const openAddDialog = () => {
    setEditingRule(null);
    setColumnName('');
    setConditionOperator('equals');
    setConditionValue('');
    setPaymentId('');
    setPriority('0');
    setIsActive(true);
    setRuleDialogOpen(true);
  };

  const openEditDialog = (rule: ParsingRule) => {
    setEditingRule(rule);
    setColumnName(rule.columnName);
    setConditionOperator(rule.conditionOperator);
    setConditionValue(rule.conditionValue || '');
    setPaymentId(rule.paymentId);
    setPriority(rule.priority.toString());
    setIsActive(rule.isActive);
    setRuleDialogOpen(true);
  };

  const handleSaveRule = async () => {
    if (!selectedScheme) return;
    
    if (!columnName || !conditionOperator || !paymentId) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      const payload = {
        parsingSchemeId: selectedScheme.id,
        columnName,
        conditionOperator,
        conditionValue: conditionValue || null,
        paymentId,
        priority: parseInt(priority),
        isActive
      };

      let response;
      if (editingRule) {
        response = await fetch(`/api/parsing-rules/${editingRule.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } else {
        response = await fetch('/api/parsing-rules', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }

      if (!response.ok) throw new Error('Failed to save rule');
      
      setRuleDialogOpen(false);
      fetchRules(selectedScheme.id);
      fetchSchemes(); // Refresh rule counts
    } catch (error) {
      console.error('Error saving rule:', error);
      alert('Failed to save rule');
    }
  };

  const handleDeleteRule = async (ruleId: number) => {
    if (!confirm('Are you sure you want to delete this rule?')) return;

    try {
      const response = await fetch(`/api/parsing-rules/${ruleId}`, {
        method: 'DELETE'
      });

      if (!response.ok) throw new Error('Failed to delete rule');
      
      if (selectedScheme) {
        fetchRules(selectedScheme.id);
        fetchSchemes(); // Refresh rule counts
      }
    } catch (error) {
      console.error('Error deleting rule:', error);
      alert('Failed to delete rule');
    }
  };

  const toggleRuleActive = async (rule: ParsingRule) => {
    try {
      const response = await fetch(`/api/parsing-rules/${rule.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !rule.isActive })
      });

      if (!response.ok) throw new Error('Failed to update rule');
      
      if (selectedScheme) {
        fetchRules(selectedScheme.id);
      }
    } catch (error) {
      console.error('Error updating rule:', error);
      alert('Failed to update rule');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Bank Account Parsing Rules</h1>
      </div>

      {/* Parsing Schemes Selector */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Parsing Scheme</h2>
        <div className="flex gap-4 flex-wrap">
          {schemes.map(scheme => (
            <button
              key={scheme.id}
              onClick={() => setSelectedScheme(scheme)}
              className={`px-6 py-3 rounded-lg border-2 transition-all ${
                selectedScheme?.id === scheme.id
                  ? 'border-blue-600 bg-blue-50 text-blue-700'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <div className="font-semibold">{scheme.name}</div>
              <div className="text-sm text-gray-600">
                {scheme.rulesCount} rules · {scheme.accountsCount} accounts
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Rules Table */}
      {selectedScheme && (
        <div className="bg-white rounded-lg shadow-sm">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">
                Rules for {selectedScheme.name}
              </h2>
              <Button onClick={openAddDialog}>
                <Plus className="w-4 h-4 mr-2" />
                Add Rule
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Priority</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Column</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Operator</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Value</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Payment ID</th>
                  <th className="px-6 py-3 text-center text-sm font-semibold text-gray-700">Active</th>
                  <th className="px-6 py-3 text-center text-sm font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {rules.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                      No rules defined yet. Click "Add Rule" to create one.
                    </td>
                  </tr>
                ) : (
                  rules.map(rule => (
                    <tr key={rule.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm">
                        <div className="flex items-center gap-2">
                          <GripVertical className="w-4 h-4 text-gray-400 cursor-move" />
                          <span className="font-mono">{rule.priority}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm font-mono">{rule.columnName}</td>
                      <td className="px-6 py-4 text-sm">
                        {CONDITION_OPERATORS.find(op => op.value === rule.conditionOperator)?.label || rule.conditionOperator}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span className="font-mono text-blue-600">{rule.conditionValue || '-'}</span>
                      </td>
                      <td className="px-6 py-4 text-sm font-mono">{rule.paymentId}</td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => toggleRuleActive(rule)}
                          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                            rule.isActive
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {rule.isActive ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditDialog(rule)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteRule(rule.id)}
                          >
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add/Edit Rule Dialog */}
      <Dialog open={ruleDialogOpen} onOpenChange={setRuleDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingRule ? 'Edit Rule' : 'Add New Rule'}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="columnName">Column Name *</Label>
              <select
                id="columnName"
                value={columnName}
                onChange={(e) => setColumnName(e.target.value)}
                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select column...</option>
                {COLUMN_NAMES.map(col => (
                  <option key={col} value={col}>{col}</option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="conditionOperator">Condition Operator *</Label>
              <select
                id="conditionOperator"
                value={conditionOperator}
                onChange={(e) => setConditionOperator(e.target.value)}
                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {CONDITION_OPERATORS.map(op => (
                  <option key={op.value} value={op.value}>{op.label}</option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="conditionValue">Condition Value</Label>
              <Input
                id="conditionValue"
                value={conditionValue}
                onChange={(e) => setConditionValue(e.target.value)}
                placeholder="Value to compare against"
              />
              <p className="text-sm text-gray-500 mt-1">
                Leave empty for null checks (is_null, is_not_null, etc.)
              </p>
            </div>

            <div>
              <Label htmlFor="paymentId">Payment ID *</Label>
              <Input
                id="paymentId"
                value={paymentId}
                onChange={(e) => setPaymentId(e.target.value)}
                placeholder="e.g., SAL_001"
              />
              <p className="text-sm text-gray-500 mt-1">
                Payment ID to use if this rule matches
              </p>
            </div>

            <div>
              <Label htmlFor="priority">Priority</Label>
              <Input
                id="priority"
                type="number"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                placeholder="0"
              />
              <p className="text-sm text-gray-500 mt-1">
                Lower number = higher priority (evaluated first)
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="isActive"
                checked={isActive}
                onCheckedChange={(checked) => setIsActive(checked as boolean)}
              />
              <Label htmlFor="isActive" className="cursor-pointer">
                Rule is active
              </Label>
            </div>

            <div className="flex gap-3 pt-4">
              <Button onClick={handleSaveRule} className="flex-1">
                {editingRule ? 'Update Rule' : 'Create Rule'}
              </Button>
              <Button
                variant="outline"
                onClick={() => setRuleDialogOpen(false)}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
