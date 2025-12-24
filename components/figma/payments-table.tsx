'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { 
  Search, 
  Plus, 
  Edit2, 
  Check, 
  X, 
  Filter, 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown,
  Settings,
  Eye,
  EyeOff,
  Trash2
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Checkbox } from './ui/checkbox';
import { Combobox } from '@/components/ui/combobox';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from './ui/table';

export type Payment = {
  id: number;
  projectUuid: string;
  counteragentUuid: string;
  financialCodeUuid: string;
  jobUuid: string;
  paymentId: string;
  recordUuid: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  projectIndex: string | null;
  counteragentName: string | null;
  financialCodeValidation: string | null;
  jobName: string | null;
  jobIdentifier: string | null;
};

type ColumnKey = keyof Payment;

type ColumnConfig = {
  key: ColumnKey;
  label: string;
  width: number;
  visible: boolean;
  sortable: boolean;
  filterable: boolean;
  responsive?: 'sm' | 'md' | 'lg' | 'xl';
};

const defaultColumns: ColumnConfig[] = [
  { key: 'id', label: 'ID', width: 80, visible: false, sortable: true, filterable: true },
  { key: 'paymentId', label: 'Payment ID', width: 300, visible: true, sortable: true, filterable: true },
  { key: 'recordUuid', label: 'Record UUID', width: 150, visible: true, sortable: true, filterable: true },
  { key: 'projectIndex', label: 'Project', width: 400, visible: true, sortable: true, filterable: true },
  { key: 'counteragentName', label: 'Counteragent', width: 250, visible: true, sortable: true, filterable: true },
  { key: 'financialCodeValidation', label: 'Financial Code', width: 200, visible: true, sortable: true, filterable: true },
  { key: 'jobName', label: 'Job', width: 200, visible: true, sortable: true, filterable: true },
  { key: 'projectUuid', label: 'Project UUID', width: 200, visible: false, sortable: true, filterable: true, responsive: 'xl' },
  { key: 'counteragentUuid', label: 'Counteragent UUID', width: 200, visible: false, sortable: true, filterable: true, responsive: 'xl' },
  { key: 'financialCodeUuid', label: 'Financial Code UUID', width: 200, visible: false, sortable: true, filterable: true, responsive: 'xl' },
  { key: 'jobUuid', label: 'Job UUID', width: 200, visible: false, sortable: true, filterable: true, responsive: 'xl' },
  { key: 'jobIdentifier', label: 'Job Identifier', width: 200, visible: false, sortable: true, filterable: true },
  { key: 'isActive', label: 'Status', width: 100, visible: true, sortable: true, filterable: true },
  { key: 'createdAt', label: 'Created', width: 140, visible: false, sortable: true, filterable: true },
  { key: 'updatedAt', label: 'Updated', width: 140, visible: false, sortable: true, filterable: true },
];

export function PaymentsTable() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [projects, setProjects] = useState<Array<{ projectUuid: string; projectIndex: string; projectName: string }>>([]);
  const [counteragents, setCounteragents] = useState<Array<{ counteragentUuid: string; name: string; identificationNumber: string; entityType: string }>>([]);
  const [financialCodes, setFinancialCodes] = useState<Array<{ uuid: string; validation: string; code: string }>>([]);
  const [jobs, setJobs] = useState<Array<{ jobUuid: string; jobIndex: string; jobName: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortColumn, setSortColumn] = useState<ColumnKey>('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [columnConfig, setColumnConfig] = useState<ColumnConfig[]>(defaultColumns);
  const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>({});

  // Form states
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedProjectUuid, setSelectedProjectUuid] = useState('');
  const [selectedCounteragentUuid, setSelectedCounteragentUuid] = useState('');
  const [selectedFinancialCodeUuid, setSelectedFinancialCodeUuid] = useState('');
  const [selectedJobUuid, setSelectedJobUuid] = useState('');

  useEffect(() => {
    fetchPayments();
    fetchProjects();
    fetchCounteragents();
    fetchFinancialCodes();
    fetchJobs();
  }, []);

  const fetchPayments = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/payments');
      if (!response.ok) throw new Error('Failed to fetch payments');
      const data = await response.json();
      setPayments(data);
    } catch (error) {
      console.error('Error fetching payments:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchProjects = async () => {
    try {
      const response = await fetch('/api/projects');
      if (!response.ok) throw new Error('Failed to fetch projects');
      const data = await response.json();
      // Map the API response to our format
      const formattedProjects = data.map((p: any) => ({
        projectUuid: p.project_uuid,
        projectIndex: p.project_index,
        projectName: p.project_name
      }));
      setProjects(formattedProjects);
    } catch (error) {
      console.error('Error fetching projects:', error);
    }
  };

  const fetchCounteragents = async () => {
    try {
      const response = await fetch('/api/counteragents');
      if (!response.ok) throw new Error('Failed to fetch counteragents');
      const data = await response.json();
      // Map to include full display format
      const formattedCounteragents = data.map((ca: any) => ({
        counteragentUuid: ca.counteragent_uuid,
        name: ca.name,
        identificationNumber: ca.identification_number || '',
        entityType: ca.entity_type || ''
      }));
      setCounteragents(formattedCounteragents);
    } catch (error) {
      console.error('Error fetching counteragents:', error);
    }
  };

  const fetchFinancialCodes = async () => {
    try {
      const response = await fetch('/api/financial-codes');
      if (!response.ok) throw new Error('Failed to fetch financial codes');
      const data = await response.json();
      // Map to include both validation and code
      const formattedCodes = data.map((fc: any) => ({
        uuid: fc.uuid,
        validation: fc.validation || fc.name,
        code: fc.code
      }));
      setFinancialCodes(formattedCodes);
    } catch (error) {
      console.error('Error fetching financial codes:', error);
    }
  };

  const fetchJobs = async () => {
    try {
      const response = await fetch('/api/jobs');
      if (!response.ok) throw new Error('Failed to fetch jobs');
      const data = await response.json();
      // Map to our format
      const formattedJobs = data.map((job: any) => ({
        jobUuid: job.jobUuid,
        jobIndex: job.jobIndex,
        jobName: job.jobName
      }));
      setJobs(formattedJobs);
    } catch (error) {
      console.error('Error fetching jobs:', error);
    }
  };

  const handleAddPayment = async () => {
    if (!selectedProjectUuid || !selectedCounteragentUuid || !selectedFinancialCodeUuid || !selectedJobUuid) {
      alert('Please fill in all fields');
      return;
    }

    try {
      const response = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectUuid: selectedProjectUuid,
          counteragentUuid: selectedCounteragentUuid,
          financialCodeUuid: selectedFinancialCodeUuid,
          jobUuid: selectedJobUuid,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create payment');
      }

      setIsDialogOpen(false);
      resetForm();
      fetchPayments();
    } catch (error: any) {
      console.error('Error adding payment:', error);
      alert(error.message || 'Failed to add payment');
    }
  };

  const handleDeletePayment = async (id: number) => {
    if (!confirm('Are you sure you want to delete this payment?')) return;

    try {
      const response = await fetch(`/api/payments?id=${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete payment');
      fetchPayments();
    } catch (error) {
      console.error('Error deleting payment:', error);
      alert('Failed to delete payment');
    }
  };

  const resetForm = () => {
    setSelectedProjectUuid('');
    setSelectedCounteragentUuid('');
    setSelectedFinancialCodeUuid('');
    setSelectedJobUuid('');
  };

  const handleSort = (column: ColumnKey) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const getUniqueValues = (key: ColumnKey): string[] => {
    const values = payments
      .map(payment => String(payment[key] || ''))
      .filter((value, index, self) => value && self.indexOf(value) === index);
    return values.sort();
  };

  const filteredAndSortedPayments = useMemo(() => {
    let filtered = [...payments];

    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(payment =>
        Object.values(payment).some(value =>
          String(value).toLowerCase().includes(term)
        )
      );
    }

    // Apply column filters
    Object.entries(columnFilters).forEach(([column, values]) => {
      if (values.length > 0) {
        filtered = filtered.filter(payment => {
          const cellValue = String(payment[column as ColumnKey] || '');
          return values.includes(cellValue);
        });
      }
    });

    // Apply sorting
    filtered.sort((a, b) => {
      const aValue = a[sortColumn];
      const bValue = b[sortColumn];
      
      if (aValue === null || aValue === undefined) return 1;
      if (bValue === null || bValue === undefined) return -1;
      
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
      }
      
      const aStr = String(aValue).toLowerCase();
      const bStr = String(bValue).toLowerCase();
      
      if (sortDirection === 'asc') {
        return aStr.localeCompare(bStr);
      } else {
        return bStr.localeCompare(aStr);
      }
    });

    return filtered;
  }, [payments, searchTerm, sortColumn, sortDirection, columnFilters]);

  // Column filter component (matching counteragents style)
  function ColumnFilter({ column }: { column: ColumnConfig }) {
    const uniqueValues = getUniqueValues(column.key);
    const [searchValue, setSearchValue] = useState('');
    const [tempSelected, setTempSelected] = useState<string[]>(columnFilters[column.key] || []);
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

    const filteredValues = uniqueValues.filter(value =>
      value.toLowerCase().includes(searchValue.toLowerCase())
    );

    const sortedValues = [...filteredValues].sort((a, b) => {
      return sortOrder === 'asc' ? a.localeCompare(b) : b.localeCompare(a);
    });

    const handleApply = () => {
      setColumnFilters(prev => ({
        ...prev,
        [column.key]: tempSelected
      }));
    };

    const handleCancel = () => {
      setTempSelected(columnFilters[column.key] || []);
    };

    const handleSelectAll = () => {
      setTempSelected(sortedValues);
    };

    const handleClearAll = () => {
      setTempSelected([]);
    };

    const toggleSort = () => {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    };

    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-6 px-2 hover:bg-gray-100"
          >
            <Filter className="h-3 w-3" />
            {columnFilters[column.key]?.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
                {columnFilters[column.key].length}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-0" align="start">
          <div className="p-2 border-b">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search..."
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                className="pl-8 h-9"
              />
            </div>
          </div>
          <div className="p-2 border-b flex items-center justify-between">
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleSort}
                className="h-7 px-2"
              >
                {sortOrder === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
              </Button>
            </div>
            <div className="flex gap-2 text-xs">
              <button
                onClick={handleSelectAll}
                className="text-blue-600 hover:underline"
              >
                Select all
              </button>
              <span className="text-gray-400">|</span>
              <button
                onClick={handleClearAll}
                className="text-blue-600 hover:underline"
              >
                Clear
              </button>
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto p-2">
            {sortedValues.map(value => (
              <div key={value} className="flex items-center space-x-2 py-1">
                <Checkbox
                  id={`${column.key}-${value}`}
                  checked={tempSelected.includes(value)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setTempSelected([...tempSelected, value]);
                    } else {
                      setTempSelected(tempSelected.filter(v => v !== value));
                    }
                  }}
                />
                <label
                  htmlFor={`${column.key}-${value}`}
                  className="text-sm cursor-pointer flex-1"
                >
                  {value || '(empty)'}
                </label>
              </div>
            ))}
          </div>
          <div className="p-2 border-t flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancel}
              className="h-8"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleApply}
              className="h-8 bg-green-600 hover:bg-green-700"
            >
              OK
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  const visibleColumns = columnConfig.filter(col => col.visible);

  if (loading) {
    return <div className="p-8 text-center">Loading payments...</div>;
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Payments</h1>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Add Payment
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add New Payment</DialogTitle>
              <DialogDescription>
                Create a new payment record
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Project</Label>
                <Combobox
                  value={selectedProjectUuid}
                  onChange={setSelectedProjectUuid}
                  options={projects.map(p => ({
                    value: p.projectUuid,
                    label: p.projectIndex || p.projectName
                  }))}
                  placeholder="Select project..."
                  searchPlaceholder="Search projects..."
                />
              </div>

              <div className="space-y-2">
                <Label>Counteragent</Label>
                <Combobox
                  value={selectedCounteragentUuid}
                  onChange={setSelectedCounteragentUuid}
                  options={counteragents.map(ca => ({
                    value: ca.counteragentUuid,
                    label: `${ca.name}${ca.identificationNumber ? ` (ს.კ. ${ca.identificationNumber})` : ''}${ca.entityType ? ` - ${ca.entityType}` : ''}`
                  }))}
                  placeholder="Select counteragent..."
                  searchPlaceholder="Search counteragents..."
                />
              </div>

              <div className="space-y-2">
                <Label>Financial Code</Label>
                <Combobox
                  value={selectedFinancialCodeUuid}
                  onChange={setSelectedFinancialCodeUuid}
                  options={financialCodes.map(fc => ({
                    value: fc.uuid,
                    label: `${fc.validation} (${fc.code})`
                  }))}
                  placeholder="Select financial code..."
                  searchPlaceholder="Search financial codes..."
                />
              </div>

              <div className="space-y-2">
                <Label>Job</Label>
                <Combobox
                  value={selectedJobUuid}
                  onChange={setSelectedJobUuid}
                  options={jobs.map(job => ({
                    value: job.jobUuid,
                    label: job.jobIndex || job.jobName
                  }))}
                  placeholder="Select job..."
                  searchPlaceholder="Search jobs..."
                />
              </div>

              <Button onClick={handleAddPayment} className="w-full">
                Create Payment
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search all columns..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm">
              <Settings className="h-4 w-4 mr-2" />
              Columns
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64">
            <div className="space-y-2">
              <h4 className="font-medium text-sm mb-3">Toggle Columns</h4>
              {columnConfig.map((column) => (
                <div key={column.key} className="flex items-center space-x-2">
                  <Checkbox
                    id={`col-${column.key}`}
                    checked={column.visible}
                    onCheckedChange={(checked) => {
                      setColumnConfig(
                        columnConfig.map(col =>
                          col.key === column.key ? { ...col, visible: !!checked } : col
                        )
                      );
                    }}
                  />
                  <label
                    htmlFor={`col-${column.key}`}
                    className="text-sm cursor-pointer"
                  >
                    {column.label}
                  </label>
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <div className="text-sm text-gray-600">
        Showing {filteredAndSortedPayments.length} of {payments.length} payments
      </div>

      <div className="border rounded-lg overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {visibleColumns.map((column) => (
                <TableHead key={column.key} style={{ width: column.width }}>
                  <div className="flex items-center gap-1">
                    {column.sortable ? (
                      <button
                        onClick={() => handleSort(column.key)}
                        className="flex items-center gap-1 hover:text-gray-900"
                      >
                        {column.label}
                        {sortColumn === column.key && (
                          sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                        )}
                      </button>
                    ) : (
                      column.label
                    )}
                    {column.filterable && <ColumnFilter column={column} />}
                  </div>
                </TableHead>
              ))}
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSortedPayments.map((payment) => (
              <TableRow key={payment.id}>
                {visibleColumns.map((column) => (
                  <TableCell key={column.key}>
                    {column.key === 'isActive' ? (
                      <Badge variant={payment.isActive ? 'default' : 'secondary'}>
                        {payment.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    ) : (
                      String(payment[column.key] || '')
                    )}
                  </TableCell>
                ))}
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeletePayment(payment.id)}
                  >
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
