"use client";

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Plus } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Label } from './ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { Combobox } from '@/components/ui/combobox';
import { MultiCombobox } from '@/components/ui/multi-combobox';

const SERVICE_STATE_OPTIONS = ['Active', 'Conversion', 'Others', 'Free', 'Recovery'];
const DEPARTMENT_OPTIONS = ['Batumi', 'Tbilisi'];

type AddProjectDialogProps = {
  /** Pre-fill and lock the counteragent field */
  fixedCounteragentUuid?: string;
  fixedCounteragentName?: string;
  /** Called after a project is successfully created */
  onSuccess?: () => void;
  /** Custom trigger button. If not provided, a default "Add Project" button is rendered. */
  trigger?: React.ReactNode;
};

export function AddProjectDialog({
  fixedCounteragentUuid,
  fixedCounteragentName,
  onSuccess,
  trigger,
}: AddProjectDialogProps) {
  const [open, setOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Reference data
  const [counteragentsList, setCounteragentsList] = useState<Array<{ id: number; name: string; counteragentUuid: string }>>([]);
  const [financialCodesList, setFinancialCodesList] = useState<Array<{ id: number; validation: string; uuid: string }>>([]);
  const [currenciesList, setCurrenciesList] = useState<Array<{ id: number; code: string; uuid: string }>>([]);
  const [statesList, setStatesList] = useState<Array<{ id: number; name: string; uuid: string }>>([]);
  const [employeesList, setEmployeesList] = useState<Array<{ id: number; name: string; counteragentUuid: string }>>([]);
  const [insidersList, setInsidersList] = useState<Array<{ insiderUuid: string; insiderName: string }>>([]);
  const [selectedInsiderUuids, setSelectedInsiderUuids] = useState<string[]>([]);

  const isInsiderFixed = selectedInsiderUuids.length === 1;
  const fixedInsider = useMemo(() => {
    if (!isInsiderFixed) return null;
    return insidersList.find((i) => i.insiderUuid === selectedInsiderUuids[0]) ?? null;
  }, [isInsiderFixed, insidersList, selectedInsiderUuids]);

  const insiderOptions = useMemo(
    () => insidersList.map((i) => ({ value: i.insiderUuid, label: i.insiderName, keywords: i.insiderName })),
    [insidersList]
  );

  const [formData, setFormData] = useState({
    projectName: '',
    date: '',
    value: '',
    oris1630: '',
    address: '',
    department: '',
    serviceState: '',
    insiderUuid: '',
    counteragentUuid: fixedCounteragentUuid || '',
    financialCodeUuid: '',
    currencyUuid: '',
    stateUuid: '',
    employees: [] as string[],
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const resetForm = useCallback(() => {
    setFormData({
      projectName: '',
      date: '',
      value: '',
      oris1630: '',
      address: '',
      department: '',
      serviceState: '',
      insiderUuid: fixedInsider?.insiderUuid || insidersList[0]?.insiderUuid || '',
      counteragentUuid: fixedCounteragentUuid || '',
      financialCodeUuid: '',
      currencyUuid: '',
      stateUuid: '',
      employees: [],
    });
    setFormErrors({});
  }, [fixedCounteragentUuid, fixedInsider, insidersList]);

  // Load reference data each time dialog opens
  useEffect(() => {
    if (!open) return;
    const fetchData = async () => {
      try {
        const [caRes, fcRes, curRes, stRes, empRes, insRes] = await Promise.all([
          fetch('/api/counteragents'),
          fetch('/api/financial-codes'),
          fetch('/api/currencies'),
          fetch('/api/project-states'),
          fetch('/api/counteragents?is_emploee=true'),
          fetch('/api/insider-selection'),
        ]);

        if (caRes.ok) {
          const data = await caRes.json();
          setCounteragentsList(data.map((c: any) => ({
            id: c.id,
            name: c.counteragent || c.name,
            counteragentUuid: c.counteragent_uuid || c.counteragentUuid,
          })));
        }

        if (fcRes.ok) {
          const data = await fcRes.json();
          const filtered = data.filter((fc: any) => {
            const isIncome = fc.isIncome ?? fc.is_income;
            const appliesToPL = fc.appliesToPL ?? fc.applies_to_pl;
            return isIncome === true && appliesToPL === true;
          });
          setFinancialCodesList(filtered.map((fc: any) => ({
            id: fc.id,
            validation: fc.validation || fc.code || fc.name,
            uuid: fc.uuid || fc.financial_code_uuid,
          })));
        }

        if (curRes.ok) {
          const curResp = await curRes.json();
          const curData = Array.isArray(curResp) ? curResp : curResp.data;
          const allowed = ['USD', 'GEL', 'EUR'];
          const filtered = allowed.map((code) => curData.find((c: any) => c.code === code)).filter(Boolean);
          setCurrenciesList(filtered.map((c: any) => ({
            id: c.id,
            code: c.code,
            uuid: c.uuid || c.currency_uuid,
          })));
        }

        if (stRes.ok) {
          const data = await stRes.json();
          setStatesList(data.map((s: any) => ({
            id: s.id,
            name: s.name,
            uuid: s.uuid || s.state_uuid,
          })));
        }

        if (empRes.ok) {
          const data = await empRes.json();
          setEmployeesList(data.map((e: any) => ({
            id: e.id,
            name: e.counteragent || e.name,
            counteragentUuid: e.counteragent_uuid || e.counteragentUuid,
          })));
        }

        if (insRes.ok) {
          const data = await insRes.json();
          const options = Array.isArray(data?.options) ? data.options : [];
          const selectedInsiders = Array.isArray(data?.selectedInsiders) ? data.selectedInsiders : [];
          const selectedUuids = Array.isArray(data?.selectedUuids) ? data.selectedUuids : [];
          const availableRaw = selectedInsiders.length > 0 ? selectedInsiders : options;
          const available = availableRaw.map((o: any) => ({ insiderUuid: o.insiderUuid, insiderName: o.insiderName }));
          setInsidersList(available);
          setSelectedInsiderUuids(selectedUuids);

          const defaultInsider = selectedUuids.length > 0 ? selectedUuids[0] : available[0]?.insiderUuid || '';
          setFormData((prev) => ({ ...prev, insiderUuid: prev.insiderUuid || defaultInsider }));
        }

      } catch (error) {
        console.error('Failed to fetch project form data:', error);
      }
    };
    fetchData();
  }, [open]);

  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!formData.projectName.trim()) errors.projectName = 'Project name is required';
    else if (!/^[a-zA-Z0-9\s]+$/.test(formData.projectName)) errors.projectName = 'Only English letters and numbers';
    if (!formData.date) errors.date = 'Date is required';
    if (!formData.value) errors.value = 'Value is required';
    else if (parseFloat(formData.value) <= 0) errors.value = 'Must be > 0';
    if (!formData.counteragentUuid) errors.counteragentUuid = 'Counteragent is required';
    if (!formData.financialCodeUuid) errors.financialCodeUuid = 'Financial code is required';
    if (!formData.currencyUuid) errors.currencyUuid = 'Currency is required';
    if (!formData.stateUuid) errors.stateUuid = 'State is required';
    if (!formData.insiderUuid) errors.insiderUuid = 'Insider is required';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      if (!validateForm()) return;

      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectName: formData.projectName,
          date: formData.date,
          value: parseFloat(formData.value),
          oris1630: formData.oris1630 || null,
          address: formData.address || null,
          department: formData.department || null,
          serviceState: formData.serviceState || null,
          counteragentUuid: formData.counteragentUuid,
          financialCodeUuid: formData.financialCodeUuid,
          currencyUuid: formData.currencyUuid,
          stateUuid: formData.stateUuid,
          insider_uuid: formData.insiderUuid || null,
          insiderUuid: formData.insiderUuid || null,
          employees: formData.employees,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        alert(`Failed to add: ${error.error || 'Unknown error'}`);
        return;
      }

      setOpen(false);
      resetForm();
      onSuccess?.();
    } catch (error) {
      console.error('Add project error:', error);
      alert('Failed to save project.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (v) resetForm(); }}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Project
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Project</DialogTitle>
          <DialogDescription>
            Enter the details for the new project. Fields marked with * are required.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {/* Insider */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">Insider *</Label>
            <div className="col-span-3">
              <Combobox
                options={insiderOptions}
                value={formData.insiderUuid}
                onValueChange={(value: string) => {
                  setFormData({ ...formData, insiderUuid: value });
                  if (formErrors.insiderUuid) setFormErrors({ ...formErrors, insiderUuid: '' });
                }}
                disabled={isInsiderFixed}
                placeholder="Select insider"
                searchPlaceholder="Search insiders..."
                emptyText="No insider found."
                triggerClassName={[
                  formErrors.insiderUuid ? 'border-red-500' : '',
                  isInsiderFixed ? 'bg-muted text-muted-foreground cursor-not-allowed' : '',
                ].filter(Boolean).join(' ')}
              />
              {isInsiderFixed && fixedInsider?.insiderName && (
                <p className="text-xs text-muted-foreground mt-1">Fixed: {fixedInsider.insiderName}</p>
              )}
              {formErrors.insiderUuid && <p className="text-xs text-red-500 mt-1">{formErrors.insiderUuid}</p>}
            </div>
          </div>

          {/* Project Name */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">Project Name *</Label>
            <div className="col-span-3">
              <Input
                value={formData.projectName}
                onChange={(e) => { setFormData({ ...formData, projectName: e.target.value }); if (formErrors.projectName) setFormErrors({ ...formErrors, projectName: '' }); }}
                className={formErrors.projectName ? 'border-red-500' : ''}
                placeholder="Only English letters and numbers"
              />
              {formErrors.projectName && <p className="text-xs text-red-500 mt-1">{formErrors.projectName}</p>}
            </div>
          </div>

          {/* Date */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">Date *</Label>
            <div className="col-span-3">
              <Input
                type="date"
                value={formData.date}
                onChange={(e) => { setFormData({ ...formData, date: e.target.value }); if (formErrors.date) setFormErrors({ ...formErrors, date: '' }); }}
                className={formErrors.date ? 'border-red-500' : ''}
              />
              {formErrors.date && <p className="text-xs text-red-500 mt-1">{formErrors.date}</p>}
            </div>
          </div>

          {/* Value */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">Value *</Label>
            <div className="col-span-3">
              <Input
                type="number"
                step="0.01"
                value={formData.value}
                onChange={(e) => { setFormData({ ...formData, value: e.target.value }); if (formErrors.value) setFormErrors({ ...formErrors, value: '' }); }}
                className={formErrors.value ? 'border-red-500' : ''}
                placeholder="Must be greater than 0"
              />
              {formErrors.value && <p className="text-xs text-red-500 mt-1">{formErrors.value}</p>}
            </div>
          </div>

          {/* ORIS 1630 */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">ORIS 1630</Label>
            <div className="col-span-3">
              <Input value={formData.oris1630} onChange={(e) => setFormData({ ...formData, oris1630: e.target.value })} />
            </div>
          </div>

          {/* Address */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">Address</Label>
            <div className="col-span-3">
              <Input value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} placeholder="Project address" />
            </div>
          </div>

          {/* Department */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">Department</Label>
            <div className="col-span-3">
              <Select value={formData.department || undefined} onValueChange={(v) => setFormData({ ...formData, department: v })}>
                <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                <SelectContent>
                  {DEPARTMENT_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Service State */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">Service State</Label>
            <div className="col-span-3">
              <Select value={formData.serviceState || undefined} onValueChange={(v) => setFormData({ ...formData, serviceState: v })}>
                <SelectTrigger><SelectValue placeholder="Select service state" /></SelectTrigger>
                <SelectContent>
                  {SERVICE_STATE_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Counteragent */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">Counteragent *</Label>
            <div className="col-span-3">
              {fixedCounteragentUuid ? (
                <>
                  <Input value={fixedCounteragentName || fixedCounteragentUuid} disabled className="bg-muted text-muted-foreground cursor-not-allowed" />
                  <p className="text-xs text-muted-foreground mt-1">Fixed from statement context</p>
                </>
              ) : (
                <Combobox
                  options={counteragentsList.map((c) => ({ value: c.counteragentUuid, label: c.name, keywords: c.name }))}
                  value={formData.counteragentUuid}
                  onValueChange={(value: string) => {
                    setFormData({ ...formData, counteragentUuid: value });
                    if (formErrors.counteragentUuid) setFormErrors({ ...formErrors, counteragentUuid: '' });
                  }}
                  placeholder="Select counteragent"
                  searchPlaceholder="Search counteragents..."
                  emptyText="No counteragent found."
                  triggerClassName={formErrors.counteragentUuid ? 'border-red-500' : ''}
                />
              )}
              {formErrors.counteragentUuid && <p className="text-xs text-red-500 mt-1">{formErrors.counteragentUuid}</p>}
            </div>
          </div>

          {/* Financial Code */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">Financial Code *</Label>
            <div className="col-span-3">
              <Combobox
                options={financialCodesList.map((fc) => ({ value: fc.uuid, label: fc.validation, keywords: fc.validation }))}
                value={formData.financialCodeUuid}
                onValueChange={(value: string) => {
                  setFormData({ ...formData, financialCodeUuid: value });
                  if (formErrors.financialCodeUuid) setFormErrors({ ...formErrors, financialCodeUuid: '' });
                }}
                placeholder="Select financial code"
                searchPlaceholder="Search financial codes..."
                emptyText="No financial code found."
                triggerClassName={formErrors.financialCodeUuid ? 'border-red-500' : ''}
              />
              {formErrors.financialCodeUuid && <p className="text-xs text-red-500 mt-1">{formErrors.financialCodeUuid}</p>}
            </div>
          </div>

          {/* Currency */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">Currency *</Label>
            <div className="col-span-3">
              <Combobox
                options={currenciesList.map((c) => ({ value: c.uuid, label: c.code, keywords: c.code }))}
                value={formData.currencyUuid}
                onValueChange={(value: string) => {
                  setFormData({ ...formData, currencyUuid: value });
                  if (formErrors.currencyUuid) setFormErrors({ ...formErrors, currencyUuid: '' });
                }}
                placeholder="Select currency"
                searchPlaceholder="Search currencies..."
                emptyText="No currency found."
                triggerClassName={formErrors.currencyUuid ? 'border-red-500' : ''}
              />
              {formErrors.currencyUuid && <p className="text-xs text-red-500 mt-1">{formErrors.currencyUuid}</p>}
            </div>
          </div>

          {/* State */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">State *</Label>
            <div className="col-span-3">
              <Combobox
                options={statesList.map((s) => ({ value: s.uuid, label: s.name, keywords: s.name }))}
                value={formData.stateUuid}
                onValueChange={(value: string) => {
                  setFormData({ ...formData, stateUuid: value });
                  if (formErrors.stateUuid) setFormErrors({ ...formErrors, stateUuid: '' });
                }}
                placeholder="Select state"
                searchPlaceholder="Search states..."
                emptyText="No state found."
                triggerClassName={formErrors.stateUuid ? 'border-red-500' : ''}
              />
              {formErrors.stateUuid && <p className="text-xs text-red-500 mt-1">{formErrors.stateUuid}</p>}
            </div>
          </div>

          {/* Employees */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">Employees</Label>
            <div className="col-span-3">
              <MultiCombobox
                options={employeesList.map((e) => ({ value: e.counteragentUuid, label: e.name, keywords: e.name }))}
                value={formData.employees}
                onValueChange={(values) => setFormData({ ...formData, employees: values })}
                placeholder="Select employees..."
                searchPlaceholder="Search employees..."
                emptyText="No employee found."
              />
            </div>
          </div>
        </div>
        <div className="flex justify-end space-x-2">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isSaving}>Cancel</Button>
          <Button onClick={handleSave} disabled={isSaving}>{isSaving ? 'Saving...' : 'Save Project'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
