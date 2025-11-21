import React, { useState, useEffect } from 'react';
import { Settings, Eye, EyeOff } from 'lucide-react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';

// Types for column configuration
export type ColumnKey = string;

export type ColumnConfig = {
  key: ColumnKey;
  label: string;
  width: number;
  visible: boolean;
  sortable: boolean;
  filterable: boolean;
  responsive?: 'sm' | 'md' | 'lg' | 'xl';
};

export type ColumnSettingsDialogProps = {
  columns: ColumnConfig[];
  onColumnsChange: (columns: ColumnConfig[]) => void;
  storageKey?: string;
  defaultColumns?: ColumnConfig[];
  className?: string;
  buttonVariant?: 'default' | 'outline' | 'ghost' | 'link' | 'destructive' | 'secondary';
  buttonSize?: 'default' | 'sm' | 'lg' | 'icon';
  showButtonText?: boolean;
  title?: string;
  description?: string;
};

// Default columns for demo purposes
export const defaultCountriesColumns: ColumnConfig[] = [
  { key: 'id', label: 'ID', width: 80, visible: true, sortable: true, filterable: true },
  { key: 'createdAt', label: 'Created', width: 140, visible: false, sortable: true, filterable: true, responsive: 'xl' },
  { key: 'updatedAt', label: 'Updated', width: 140, visible: false, sortable: true, filterable: true, responsive: 'xl' },
  { key: 'ts', label: 'Timestamp', width: 140, visible: false, sortable: true, filterable: true, responsive: 'lg' },
  { key: 'countryUuid', label: 'UUID', width: 200, visible: false, sortable: true, filterable: true, responsive: 'xl' },
  { key: 'nameEn', label: 'Name EN', width: 180, visible: true, sortable: true, filterable: true },
  { key: 'nameKa', label: 'Name GE', width: 200, visible: true, sortable: true, filterable: true, responsive: 'md' },
  { key: 'iso2', label: 'ISO2', width: 80, visible: true, sortable: true, filterable: true },
  { key: 'iso3', label: 'ISO3', width: 80, visible: true, sortable: true, filterable: true, responsive: 'lg' },
  { key: 'unCode', label: 'UN Code', width: 100, visible: true, sortable: true, filterable: true, responsive: 'lg' },
  { key: 'country', label: 'Country', width: 200, visible: false, sortable: true, filterable: true, responsive: 'xl' },
  { key: 'isActive', label: 'Status', width: 100, visible: true, sortable: true, filterable: true }
];

/**
 * ColumnSettingsDialog Component
 * 
 * A reusable dialog component for managing table column visibility and settings.
 * Features:
 * - Individual column show/hide toggles
 * - Responsive breakpoint indicators
 * - localStorage persistence
 * - Bulk operations (Reset to defaults)
 * - Visual status indicators
 * 
 * @param columns - Array of column configurations
 * @param onColumnsChange - Callback when columns are modified
 * @param storageKey - localStorage key for persistence (optional)
 * @param defaultColumns - Default column configuration for reset functionality
 * @param className - Additional CSS classes for the trigger button
 * @param buttonVariant - Button style variant
 * @param buttonSize - Button size
 * @param showButtonText - Whether to show "Columns" text on button
 * @param title - Dialog title (defaults to "Column Settings")
 * @param description - Dialog description
 */
export function ColumnSettingsDialog({
  columns,
  onColumnsChange,
  storageKey = 'table-columns-settings',
  defaultColumns = columns,
  className = '',
  buttonVariant = 'outline',
  buttonSize = 'sm',
  showButtonText = true,
  title = 'Column Settings',
  description = 'Configure which columns to show and their visibility.'
}: ColumnSettingsDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [localColumns, setLocalColumns] = useState<ColumnConfig[]>(columns);

  // Load settings from localStorage on mount
  useEffect(() => {
    if (storageKey) {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        try {
          const parsedColumns = JSON.parse(saved);
          setLocalColumns(parsedColumns);
          onColumnsChange(parsedColumns);
        } catch (error) {
          console.warn('Failed to parse saved column settings:', error);
        }
      }
    }
  }, [storageKey, onColumnsChange]);

  // Save settings to localStorage when columns change
  useEffect(() => {
    if (storageKey) {
      localStorage.setItem(storageKey, JSON.stringify(localColumns));
    }
  }, [localColumns, storageKey]);

  // Toggle individual column visibility
  const toggleColumn = (key: ColumnKey) => {
    const updatedColumns = localColumns.map(col =>
      col.key === key ? { ...col, visible: !col.visible } : col
    );
    setLocalColumns(updatedColumns);
    onColumnsChange(updatedColumns);
  };

  // Reset to default configuration
  const resetToDefaults = () => {
    setLocalColumns(defaultColumns);
    onColumnsChange(defaultColumns);
  };

  // Get responsive breakpoint badge
  const getResponsiveBadge = (responsive?: string) => {
    if (!responsive) return null;
    
    const badgeStyles = {
      sm: 'bg-blue-100 text-blue-800 border-blue-200',
      md: 'bg-green-100 text-green-800 border-green-200',
      lg: 'bg-orange-100 text-orange-800 border-orange-200',
      xl: 'bg-purple-100 text-purple-800 border-purple-200'
    };

    return (
      <span className={`px-1.5 py-0.5 text-xs font-medium rounded border ${badgeStyles[responsive as keyof typeof badgeStyles]}`}>
        {responsive.toUpperCase()}
      </span>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant={buttonVariant}
          size={buttonSize}
          className={className}
        >
          <Settings className="h-4 w-4" />
          {showButtonText && <span className="ml-2">Columns</span>}
        </Button>
      </DialogTrigger>
      
      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        
        <div className="space-y-3 py-4">
          {localColumns.map((column) => (
            <div
              key={column.key}
              className="flex items-center justify-between py-2 border-b border-border last:border-b-0"
            >
              <div className="flex items-center space-x-3">
                <Checkbox
                  id={`col-${column.key}`}
                  checked={column.visible}
                  onCheckedChange={() => toggleColumn(column.key)}
                />
                <Label
                  htmlFor={`col-${column.key}`}
                  className="text-sm font-medium cursor-pointer flex-1"
                >
                  {column.label}
                </Label>
                {getResponsiveBadge(column.responsive)}
              </div>
              
              <div className="flex items-center space-x-2">
                {column.visible ? (
                  <Eye className="h-4 w-4 text-success-foreground" />
                ) : (
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                )}
                <span className="text-xs text-muted-foreground">
                  {column.visible ? 'Visible' : 'Hidden'}
                </span>
              </div>
            </div>
          ))}
        </div>
        
        <div className="flex justify-between items-center pt-4 border-t border-border">
          <div className="text-xs text-muted-foreground">
            {localColumns.filter(col => col.visible).length} of {localColumns.length} columns visible
          </div>
          
          <div className="flex space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={resetToDefaults}
            >
              Reset
            </Button>
            <Button
              size="sm"
              onClick={() => setIsOpen(false)}
            >
              Done
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Hook for managing column settings with localStorage persistence
export function useColumnSettings(
  initialColumns: ColumnConfig[],
  storageKey: string = 'table-columns-settings'
) {
  const [columns, setColumns] = useState<ColumnConfig[]>(initialColumns);

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        const parsedColumns = JSON.parse(saved);
        setColumns(parsedColumns);
      } catch (error) {
        console.warn('Failed to parse saved column settings:', error);
        setColumns(initialColumns);
      }
    }
  }, [initialColumns, storageKey]);

  // Save to localStorage when columns change
  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(columns));
  }, [columns, storageKey]);

  // Get only visible columns
  const visibleColumns = columns.filter(col => col.visible);

  // Update columns
  const updateColumns = (newColumns: ColumnConfig[]) => {
    setColumns(newColumns);
  };

  // Toggle specific column
  const toggleColumn = (key: ColumnKey) => {
    const updatedColumns = columns.map(col =>
      col.key === key ? { ...col, visible: !col.visible } : col
    );
    setColumns(updatedColumns);
  };

  // Reset to initial state
  const resetColumns = () => {
    setColumns(initialColumns);
  };

  return {
    columns,
    visibleColumns,
    updateColumns,
    toggleColumn,
    resetColumns
  };
}

// Utility function to get responsive CSS classes
export function getResponsiveClass(responsive?: string): string {
  switch (responsive) {
    case 'sm': return 'hidden sm:table-cell';
    case 'md': return 'hidden md:table-cell';
    case 'lg': return 'hidden lg:table-cell';
    case 'xl': return 'hidden xl:table-cell';
    default: return '';
  }
}

export default ColumnSettingsDialog;