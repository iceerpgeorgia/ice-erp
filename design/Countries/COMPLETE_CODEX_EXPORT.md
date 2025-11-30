# 🚀 COMPLETE COUNTRIES TABLE EXPORT FOR CHATGPT CODEX

## 📋 OVERVIEW
This is the complete export package for a production-ready countries data management table with advanced filtering, sorting, and CRUD capabilities. This includes Google Sheets-style column filters, resizable columns with localStorage persistence, and responsive design.

---

## 🎯 KEY FEATURES

### ✅ Core Functionality
- **Full CRUD Operations**: Create, Read, Update (no Delete - uses Active/Inactive status)
- **Advanced Search**: Global search across all text fields
- **Google Sheets-Style Filters**: Dropdown checkbox filters for every column header
- **Dynamic Sorting**: Click any column header to sort (ascending/descending)
- **Responsive Design**: Columns hide below specific breakpoints (name_ka below md, iso3/un_code below lg)
- **Resizable Columns**: Drag column borders to resize with localStorage persistence
- **Form Validation**: Comprehensive validation with error messages

### 📊 Data Schema
```typescript
interface Country {
  id: string;
  name_en: string;        // Required - English name
  name_ka: string;        // Optional - Georgian name  
  iso2: string;           // Required - 2-letter ISO code (uppercase)
  iso3: string;           // Required - 3-letter ISO code (uppercase)
  un_code: number | null; // Optional - UN numeric code (1-999)
  country: string;        // Required - Country field
  is_active: boolean;     // Required - Active/Inactive status
}
```

### 🎨 Styling Specifications
- **Header Background**: `#f9fafb`
- **Row Colors**: Alternating white (`#ffffff`) and light gray (`#f9fafb`)
- **Header Height**: `56px`
- **Row Height**: `48px`
- **Typography**: Uses system default weights and sizes from globals.css
- **Custom Colors**: Defined via CSS custom properties in Tailwind V4

### 📱 Responsive Breakpoints
- `name_ka` column hidden below `md` breakpoint (768px)
- `iso3` and `un_code` columns hidden below `lg` breakpoint (1024px)

### ✔️ Form Validation Rules
- **name_en**: Required, cannot be empty
- **iso2**: Required, must be exactly 2 uppercase letters (regex: `/^[A-Z]{2}$/`)
- **iso3**: Required, must be exactly 3 uppercase letters (regex: `/^[A-Z]{3}$/`)
- **un_code**: Optional, must be number between 1-999 if provided
- **country**: Required, cannot be empty
- **is_active**: Boolean toggle (defaults to true for new entries)

### 📐 Default Column Widths
```typescript
{
  name_en: 200,
  name_ka: 180, 
  iso2: 80,
  iso3: 80,
  un_code: 100,
  country: 180,
  is_active: 100,
  actions: 120
}
```

---

## 📦 REQUIRED DEPENDENCIES

```json
{
  "dependencies": {
    "react": "^18.0.0",
    "lucide-react": "latest",
    "@radix-ui/react-dialog": "latest",
    "@radix-ui/react-popover": "latest", 
    "@radix-ui/react-checkbox": "latest",
    "@radix-ui/react-switch": "latest"
  }
}
```

---

## 🧩 REQUIRED SHADCN/UI COMPONENTS

Install these in `/components/ui/` directory:
- `button.tsx`, `input.tsx`, `badge.tsx`, `dialog.tsx`, `label.tsx`, `switch.tsx`, `popover.tsx`, `checkbox.tsx`

---

## 📁 FILE 1: /App.tsx

```tsx
import { CountriesTable } from './components/countries-table';

export default function App() {
  return (
    <div className="min-h-screen bg-background p-4 md:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <CountriesTable />
      </div>
    </div>
  );
}
```

---

## 📁 FILE 2: /styles/globals.css

```css
@custom-variant dark (&:is(.dark *));

:root {
  --font-size: 16px;
  --background: #ffffff;
  --foreground: oklch(0.145 0 0);
  --card: #ffffff;
  --card-foreground: oklch(0.145 0 0);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.145 0 0);
  --primary: #030213;
  --primary-foreground: oklch(1 0 0);
  --secondary: oklch(0.95 0.0058 264.53);
  --secondary-foreground: #030213;
  --muted: #ececf0;
  --muted-foreground: #717182;
  --accent: #e9ebef;
  --accent-foreground: #030213;
  --destructive: #d4183d;
  --destructive-foreground: #ffffff;
  --border: rgba(0, 0, 0, 0.1);
  --input: transparent;
  --input-background: #f3f3f5;
  --switch-background: #cbced4;
  --font-weight-medium: 500;
  --font-weight-normal: 400;
  --ring: oklch(0.708 0 0);
  --chart-1: oklch(0.646 0.222 41.116);
  --chart-2: oklch(0.6 0.118 184.704);
  --chart-3: oklch(0.398 0.07 227.392);
  --chart-4: oklch(0.828 0.189 84.429);
  --chart-5: oklch(0.769 0.188 70.08);
  --radius: 0.625rem;
  --sidebar: oklch(0.985 0 0);
  --sidebar-foreground: oklch(0.145 0 0);
  --sidebar-primary: #030213;
  --sidebar-primary-foreground: oklch(0.985 0 0);
  --sidebar-accent: oklch(0.97 0 0);
  --sidebar-accent-foreground: oklch(0.205 0 0);
  --sidebar-border: oklch(0.922 0 0);
  --sidebar-ring: oklch(0.708 0 0);
}

.dark {
  --background: oklch(0.145 0 0);
  --foreground: oklch(0.985 0 0);
  --card: oklch(0.145 0 0);
  --card-foreground: oklch(0.985 0 0);
  --popover: oklch(0.145 0 0);
  --popover-foreground: oklch(0.985 0 0);
  --primary: oklch(0.985 0 0);
  --primary-foreground: oklch(0.205 0 0);
  --secondary: oklch(0.269 0 0);
  --secondary-foreground: oklch(0.985 0 0);
  --muted: oklch(0.269 0 0);
  --muted-foreground: oklch(0.708 0 0);
  --accent: oklch(0.269 0 0);
  --accent-foreground: oklch(0.985 0 0);
  --destructive: oklch(0.396 0.141 25.723);
  --destructive-foreground: oklch(0.637 0.237 25.331);
  --border: oklch(0.269 0 0);
  --input: oklch(0.269 0 0);
  --ring: oklch(0.439 0 0);
  --font-weight-medium: 500;
  --font-weight-normal: 400;
  --chart-1: oklch(0.488 0.243 264.376);
  --chart-2: oklch(0.696 0.17 162.48);
  --chart-3: oklch(0.769 0.188 70.08);
  --chart-4: oklch(0.627 0.265 303.9);
  --chart-5: oklch(0.645 0.246 16.439);
  --sidebar: oklch(0.205 0 0);
  --sidebar-foreground: oklch(0.985 0 0);
  --sidebar-primary: oklch(0.488 0.243 264.376);
  --sidebar-primary-foreground: oklch(0.985 0 0);
  --sidebar-accent: oklch(0.269 0 0);
  --sidebar-accent-foreground: oklch(0.985 0 0);
  --sidebar-border: oklch(0.269 0 0);
  --sidebar-ring: oklch(0.439 0 0);
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-input-background: var(--input-background);
  --color-switch-background: var(--switch-background);
  --color-ring: var(--ring);
  --color-chart-1: var(--chart-1);
  --color-chart-2: var(--chart-2);
  --color-chart-3: var(--chart-3);
  --color-chart-4: var(--chart-4);
  --color-chart-5: var(--chart-5);
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
  --color-sidebar: var(--sidebar);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-ring: var(--sidebar-ring);
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }

  body {
    @apply bg-background text-foreground;
  }
}

@layer base {
  :where(:not(:has([class*=" text-"]), :not(:has([class^="text-"])))) {
    h1 {
      font-size: var(--text-2xl);
      font-weight: var(--font-weight-medium);
      line-height: 1.5;
    }

    h2 {
      font-size: var(--text-xl);
      font-weight: var(--font-weight-medium);
      line-height: 1.5;
    }

    h3 {
      font-size: var(--text-lg);
      font-weight: var(--font-weight-medium);
      line-height: 1.5;
    }

    h4 {
      font-size: var(--text-base);
      font-weight: var(--font-weight-medium);
      line-height: 1.5;
    }

    p {
      font-size: var(--text-base);
      font-weight: var(--font-weight-normal);
      line-height: 1.5;
    }

    label {
      font-size: var(--text-base);
      font-weight: var(--font-weight-medium);
      line-height: 1.5;
    }

    button {
      font-size: var(--text-base);
      font-weight: var(--font-weight-medium);
      line-height: 1.5;
    }

    input {
      font-size: var(--text-base);
      font-weight: var(--font-weight-normal);
      line-height: 1.5;
    }
  }
}

html {
  font-size: var(--font-size);
}
```

---

## 📁 FILE 3: /components/countries-table.tsx

**NOTE: This is the exact complete implementation from your project. Copy this entire file:**

```tsx
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Search, Plus, Edit2, Check, X, Filter, GripVertical } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Checkbox } from './ui/checkbox';

interface Country {
  id: string;
  name_en: string;
  name_ka: string;
  iso2: string;
  iso3: string;
  un_code: number | null;
  country: string;
  is_active: boolean;
}

interface ColumnFilter {
  name_en: string[];
  name_ka: string[];
  iso2: string[];
  iso3: string[];
  un_code: (number | null)[];
  country: string[];
  is_active: boolean[];
}

interface ColumnWidths {
  name_en: number;
  name_ka: number;
  iso2: number;
  iso3: number;
  un_code: number;
  country: number;
  is_active: number;
  actions: number;
}

const MOCK_COUNTRIES: Country[] = [
  {
    id: '1',
    name_en: 'United States',
    name_ka: 'ამერიკის შეერთებული შტატები',
    iso2: 'US',
    iso3: 'USA',
    un_code: 840,
    country: 'United States',
    is_active: true
  },
  {
    id: '2',
    name_en: 'Georgia',
    name_ka: 'საქართველო',
    iso2: 'GE',
    iso3: 'GEO',
    un_code: 268,
    country: 'Georgia',
    is_active: true
  },
  {
    id: '3',
    name_en: 'United Kingdom',
    name_ka: 'გაერთიანებული სამეფო',
    iso2: 'GB',
    iso3: 'GBR',
    un_code: 826,
    country: 'United Kingdom',
    is_active: true
  },
  {
    id: '4',
    name_en: 'France',
    name_ka: 'საფრანგეთი',
    iso2: 'FR',
    iso3: 'FRA',
    un_code: 250,
    country: 'France',
    is_active: true
  },
  {
    id: '5',
    name_en: 'Germany',
    name_ka: 'გერმანია',
    iso2: 'DE',
    iso3: 'DEU',
    un_code: 276,
    country: 'Germany',
    is_active: false
  },
  {
    id: '6',
    name_en: 'Japan',
    name_ka: 'იაპონია',
    iso2: 'JP',
    iso3: 'JPN',
    un_code: 392,
    country: 'Japan',
    is_active: true
  },
  {
    id: '7',
    name_en: 'Canada',
    name_ka: 'კანადა',
    iso2: 'CA',
    iso3: 'CAN',
    un_code: 124,
    country: 'Canada',
    is_active: true
  },
  {
    id: '8',
    name_en: 'Australia',
    name_ka: 'ავსტრალია',
    iso2: 'AU',
    iso3: 'AUS',
    un_code: 36,
    country: 'Australia',
    is_active: true
  }
];

interface CountryFormData {
  name_en: string;
  name_ka: string;
  iso2: string;
  iso3: string;
  un_code: string;
  country: string;
  is_active: boolean;
}

const CountryForm: React.FC<{
  country?: Country;
  onSave: (data: CountryFormData) => void;
  onCancel: () => void;
}> = ({ country, onSave, onCancel }) => {
  const [formData, setFormData] = useState<CountryFormData>({
    name_en: country?.name_en || '',
    name_ka: country?.name_ka || '',
    iso2: country?.iso2 || '',
    iso3: country?.iso3 || '',
    un_code: country?.un_code?.toString() || '',
    country: country?.country || '',
    is_active: country?.is_active ?? true
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name_en.trim()) {
      newErrors.name_en = 'Enter English country name';
    }

    if (!formData.iso2.trim()) {
      newErrors.iso2 = 'ISO2 code is required';
    } else if (!/^[A-Z]{2}$/.test(formData.iso2)) {
      newErrors.iso2 = 'Must be 2 uppercase letters';
    }

    if (!formData.iso3.trim()) {
      newErrors.iso3 = 'ISO3 code is required';
    } else if (!/^[A-Z]{3}$/.test(formData.iso3)) {
      newErrors.iso3 = 'Must be 3 uppercase letters';
    }

    if (formData.un_code && (isNaN(Number(formData.un_code)) || Number(formData.un_code) < 1 || Number(formData.un_code) > 999)) {
      newErrors.un_code = 'Must be a valid UN numeric code';
    }

    if (!formData.country.trim()) {
      newErrors.country = 'Country field is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      onSave(formData);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="name_en">Name (EN) *</Label>
          <Input
            id="name_en"
            value={formData.name_en}
            onChange={(e) => setFormData({ ...formData, name_en: e.target.value })}
            className={errors.name_en ? 'border-destructive' : ''}
          />
          {errors.name_en && <p className="text-sm text-destructive mt-1">{errors.name_en}</p>}
        </div>

        <div>
          <Label htmlFor="name_ka">Name (KA)</Label>
          <Input
            id="name_ka"
            value={formData.name_ka}
            onChange={(e) => setFormData({ ...formData, name_ka: e.target.value })}
          />
        </div>

        <div>
          <Label htmlFor="iso2">ISO2 *</Label>
          <Input
            id="iso2"
            value={formData.iso2}
            onChange={(e) => setFormData({ ...formData, iso2: e.target.value.toUpperCase() })}
            maxLength={2}
            className={errors.iso2 ? 'border-destructive' : ''}
          />
          {errors.iso2 && <p className="text-sm text-destructive mt-1">{errors.iso2}</p>}
        </div>

        <div>
          <Label htmlFor="iso3">ISO3 *</Label>
          <Input
            id="iso3"
            value={formData.iso3}
            onChange={(e) => setFormData({ ...formData, iso3: e.target.value.toUpperCase() })}
            maxLength={3}
            className={errors.iso3 ? 'border-destructive' : ''}
          />
          {errors.iso3 && <p className="text-sm text-destructive mt-1">{errors.iso3}</p>}
        </div>

        <div>
          <Label htmlFor="un_code">UN Code</Label>
          <Input
            id="un_code"
            type="number"
            value={formData.un_code}
            onChange={(e) => setFormData({ ...formData, un_code: e.target.value })}
            min={1}
            max={999}
            className={errors.un_code ? 'border-destructive' : ''}
          />
          {errors.un_code && <p className="text-sm text-destructive mt-1">{errors.un_code}</p>}
        </div>

        <div>
          <Label htmlFor="country">Country *</Label>
          <Input
            id="country"
            value={formData.country}
            onChange={(e) => setFormData({ ...formData, country: e.target.value })}
            className={errors.country ? 'border-destructive' : ''}
          />
          {errors.country && <p className="text-sm text-destructive mt-1">{errors.country}</p>}
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <Switch
          id="is_active"
          checked={formData.is_active}
          onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
        />
        <Label htmlFor="is_active">Active</Label>
      </div>

      <div className="flex justify-end space-x-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">
          {country ? 'Update' : 'Create'} Country
        </Button>
      </div>
    </form>
  );
};

const DEFAULT_COLUMN_WIDTHS: ColumnWidths = {
  name_en: 200,
  name_ka: 180,
  iso2: 80,
  iso3: 80,
  un_code: 100,
  country: 180,
  is_active: 100,
  actions: 120
};

const STORAGE_KEY = 'countries-table-column-widths';

export const CountriesTable: React.FC = () => {
  const [countries, setCountries] = useState<Country[]>(MOCK_COUNTRIES);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<keyof Country>('name_en');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCountry, setEditingCountry] = useState<Country | null>(null);
  const [columnFilters, setColumnFilters] = useState<ColumnFilter>({
    name_en: [],
    name_ka: [],
    iso2: [],
    iso3: [],
    un_code: [],
    country: [],
    is_active: []
  });
  const [columnWidths, setColumnWidths] = useState<ColumnWidths>(DEFAULT_COLUMN_WIDTHS);
  const [isResizing, setIsResizing] = useState(false);
  const resizeRef = useRef<{
    column: keyof ColumnWidths;
    startX: number;
    startWidth: number;
  } | null>(null);

  // Load column widths from localStorage on component mount
  useEffect(() => {
    const savedWidths = localStorage.getItem(STORAGE_KEY);
    if (savedWidths) {
      try {
        const parsedWidths = JSON.parse(savedWidths);
        setColumnWidths({ ...DEFAULT_COLUMN_WIDTHS, ...parsedWidths });
      } catch (error) {
        console.warn('Failed to parse saved column widths:', error);
      }
    }
  }, []);

  // Save column widths to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(columnWidths));
  }, [columnWidths]);

  // Handle column resize start
  const handleResizeStart = (e: React.MouseEvent, column: keyof ColumnWidths) => {
    e.preventDefault();
    setIsResizing(true);
    resizeRef.current = {
      column,
      startX: e.clientX,
      startWidth: columnWidths[column]
    };
    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeEnd);
  };

  // Handle column resize move
  const handleResizeMove = (e: MouseEvent) => {
    if (!resizeRef.current) return;
    
    const { column, startX, startWidth } = resizeRef.current;
    const deltaX = e.clientX - startX;
    const newWidth = Math.max(50, startWidth + deltaX); // Minimum width of 50px
    
    setColumnWidths(prev => ({
      ...prev,
      [column]: newWidth
    }));
  };

  // Handle column resize end
  const handleResizeEnd = () => {
    setIsResizing(false);
    resizeRef.current = null;
    document.removeEventListener('mousemove', handleResizeMove);
    document.removeEventListener('mouseup', handleResizeEnd);
  };

  // Cleanup event listeners on unmount
  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleResizeMove);
      document.removeEventListener('mouseup', handleResizeEnd);
    };
  }, []);

  // Get unique values for each column for filter dropdowns
  const uniqueValues = useMemo(() => {
    return {
      name_en: [...new Set(countries.map(c => c.name_en))].sort(),
      name_ka: [...new Set(countries.map(c => c.name_ka))].sort(),
      iso2: [...new Set(countries.map(c => c.iso2))].sort(),
      iso3: [...new Set(countries.map(c => c.iso3))].sort(),
      un_code: [...new Set(countries.map(c => c.un_code))].sort((a, b) => {
        if (a === null) return 1;
        if (b === null) return -1;
        return (a as number) - (b as number);
      }),
      country: [...new Set(countries.map(c => c.country))].sort(),
      is_active: [true, false]
    };
  }, [countries]);

  const filteredAndSortedCountries = useMemo(() => {
    let filtered = countries;

    // Apply global search term
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(country =>
        country.name_en.toLowerCase().includes(searchLower) ||
        country.name_ka.toLowerCase().includes(searchLower) ||
        country.iso2.toLowerCase().includes(searchLower) ||
        country.iso3.toLowerCase().includes(searchLower) ||
        country.country.toLowerCase().includes(searchLower)
      );
    }

    // Apply column filters
    Object.entries(columnFilters).forEach(([column, selectedValues]) => {
      if (selectedValues.length > 0 && selectedValues.length < uniqueValues[column as keyof ColumnFilter].length) {
        filtered = filtered.filter(country => 
          selectedValues.includes(country[column as keyof Country])
        );
      }
    });

    return filtered.sort((a, b) => {
      const aValue = a[sortField];
      const bValue = b[sortField];
      
      if (aValue === null || aValue === undefined) return 1;
      if (bValue === null || bValue === undefined) return -1;
      
      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [countries, searchTerm, sortField, sortDirection, columnFilters, uniqueValues]);

  const handleSort = (field: keyof Country) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleFilterChange = (column: keyof Country, values: any[]) => {
    setColumnFilters(prev => ({
      ...prev,
      [column]: values
    }));
  };

  const clearAllFilters = () => {
    setColumnFilters({
      name_en: [],
      name_ka: [],
      iso2: [],
      iso3: [],
      un_code: [],
      country: [],
      is_active: []
    });
    setSearchTerm('');
  };

  const resetColumnWidths = () => {
    setColumnWidths(DEFAULT_COLUMN_WIDTHS);
  };

  const hasActiveFilters = useMemo(() => {
    return Object.values(columnFilters).some(filter => filter.length > 0) || searchTerm.length > 0;
  }, [columnFilters, searchTerm]);

  const handleSaveCountry = (formData: CountryFormData) => {
    if (editingCountry) {
      // Update existing
      setCountries(prev => prev.map(country => 
        country.id === editingCountry.id 
          ? {
              ...country,
              ...formData,
              un_code: formData.un_code ? Number(formData.un_code) : null
            }
          : country
      ));
    } else {
      // Create new
      const newCountry: Country = {
        id: Date.now().toString(),
        ...formData,
        un_code: formData.un_code ? Number(formData.un_code) : null
      };
      setCountries(prev => [...prev, newCountry]);
    }
    
    setIsDialogOpen(false);
    setEditingCountry(null);
  };

  const handleEditCountry = (country: Country) => {
    setEditingCountry(country);
    setIsDialogOpen(true);
  };

  const ResizeHandle: React.FC<{
    column: keyof ColumnWidths;
  }> = ({ column }) => (
    <div
      className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-blue-500/20 transition-colors group flex items-center justify-center"
      onMouseDown={(e) => handleResizeStart(e, column)}
      title="Drag to resize column"
    >
      <div className="w-1 h-6 bg-gray-300 group-hover:bg-blue-500 transition-colors rounded-sm"></div>
    </div>
  );

  const FilterDropdown: React.FC<{
    column: keyof Country;
    values: any[];
    selectedValues: any[];
    onFilterChange: (values: any[]) => void;
    title: string;
  }> = ({ column, values, selectedValues, onFilterChange, title }) => {
    const [searchTerm, setSearchTerm] = useState('');
    
    const filteredValues = values.filter(value => 
      value !== null && value !== undefined && 
      value.toString().toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleSelectAll = () => {
      if (selectedValues.length === values.length) {
        onFilterChange([]);
      } else {
        onFilterChange([...values]);
      }
    };

    const handleValueToggle = (value: any) => {
      if (selectedValues.includes(value)) {
        onFilterChange(selectedValues.filter(v => v !== value));
      } else {
        onFilterChange([...selectedValues, value]);
      }
    };

    if (column === 'is_active') {
      return (
        <PopoverContent className="w-48">
          <div className="space-y-2">
            <h4 className="font-medium">{title}</h4>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="all-active"
                  checked={selectedValues.length === 2}
                  onCheckedChange={handleSelectAll}
                />
                <label htmlFor="all-active" className="text-sm">All</label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="active-true"
                  checked={selectedValues.includes(true)}
                  onCheckedChange={() => handleValueToggle(true)}
                />
                <label htmlFor="active-true" className="text-sm">Active</label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="active-false"
                  checked={selectedValues.includes(false)}
                  onCheckedChange={() => handleValueToggle(false)}
                />
                <label htmlFor="active-false" className="text-sm">Inactive</label>
              </div>
            </div>
          </div>
        </PopoverContent>
      );
    }

    return (
      <PopoverContent className="w-64">
        <div className="space-y-3">
          <h4 className="font-medium">{title}</h4>
          <Input
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-8"
          />
          <div className="max-h-48 overflow-y-auto space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="select-all"
                checked={selectedValues.length === values.length}
                onCheckedChange={handleSelectAll}
              />
              <label htmlFor="select-all" className="text-sm font-medium">
                {selectedValues.length === values.length ? 'Deselect All' : 'Select All'}
              </label>
            </div>
            {filteredValues.map((value, index) => (
              <div key={`${value}-${index}`} className="flex items-center space-x-2">
                <Checkbox
                  id={`filter-${column}-${index}`}
                  checked={selectedValues.includes(value)}
                  onCheckedChange={() => handleValueToggle(value)}
                />
                <label htmlFor={`filter-${column}-${index}`} className="text-sm">
                  {value === null || value === undefined ? '(Empty)' : value.toString()}
                </label>
              </div>
            ))}
          </div>
        </div>
      </PopoverContent>
    );
  };

  return (
    <div className={`w-full space-y-4 ${isResizing ? 'cursor-col-resize' : ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl text-[#1f2937]">Countries</h2>
          <p className="text-[#374151]">Countries database with Google Sheets-style column filters</p>
        </div>
        
        <div className="flex gap-2">
          {hasActiveFilters && (
            <Button 
              variant="outline" 
              onClick={clearAllFilters}
            >
              <X className="w-4 h-4 mr-2" />
              Clear Filters
            </Button>
          )}

          <Button 
            variant="outline" 
            onClick={resetColumnWidths}
            title="Reset column widths to default"
          >
            <GripVertical className="w-4 h-4 mr-2" />
            Reset Widths
          </Button>
          
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => setEditingCountry(null)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Country
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>
                  {editingCountry ? 'Edit Country' : 'Add New Country'}
                </DialogTitle>
                <DialogDescription>
                  {editingCountry 
                    ? 'Update the country information below.' 
                    : 'Fill in the details to add a new country to the database.'
                  }
                </DialogDescription>
              </DialogHeader>
              <CountryForm
                country={editingCountry || undefined}
                onSave={handleSaveCountry}
                onCancel={() => {
                  setIsDialogOpen(false);
                  setEditingCountry(null);
                }}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center space-x-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#717182] w-4 h-4" />
          <Input
            placeholder="Search countries..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="text-sm text-[#717182]">
          {filteredAndSortedCountries.length} of {countries.length} countries
          {hasActiveFilters && " (filtered)"}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border overflow-hidden" style={{ backgroundColor: '#ffffff' }}>
        <div className="overflow-x-auto">
          <table className={`w-full ${isResizing ? 'select-none' : ''}`}>
            <thead style={{ backgroundColor: '#f9fafb' }}>
              <tr style={{ height: '56px' }}>
                <th 
                  className="text-left px-4 font-semibold text-[#1f2937] relative" 
                  style={{ width: `${columnWidths.name_en}px` }}
                >
                  <div className="flex items-center justify-between">
                    <span 
                      className="cursor-pointer hover:text-blue-600 flex items-center"
                      onClick={() => handleSort('name_en')}
                    >
                      Name (EN) {sortField === 'name_en' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </span>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                          <Filter className={`h-3 w-3 ${columnFilters.name_en.length > 0 ? 'text-blue-600' : 'text-gray-400'}`} />
                        </Button>
                      </PopoverTrigger>
                      <FilterDropdown
                        column="name_en"
                        values={uniqueValues.name_en}
                        selectedValues={columnFilters.name_en}
                        onFilterChange={(values) => handleFilterChange('name_en', values)}
                        title="Filter Name (EN)"
                      />
                    </Popover>
                  </div>
                  <ResizeHandle column="name_en" />
                </th>
                <th 
                  className="text-left px-4 font-semibold text-[#1f2937] hidden md:table-cell relative" 
                  style={{ width: `${columnWidths.name_ka}px` }}
                >
                  <div className="flex items-center justify-between">
                    <span 
                      className="cursor-pointer hover:text-blue-600 flex items-center"
                      onClick={() => handleSort('name_ka')}
                    >
                      Name (KA) {sortField === 'name_ka' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </span>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                          <Filter className={`h-3 w-3 ${columnFilters.name_ka.length > 0 ? 'text-blue-600' : 'text-gray-400'}`} />
                        </Button>
                      </PopoverTrigger>
                      <FilterDropdown
                        column="name_ka"
                        values={uniqueValues.name_ka}
                        selectedValues={columnFilters.name_ka}
                        onFilterChange={(values) => handleFilterChange('name_ka', values)}
                        title="Filter Name (KA)"
                      />
                    </Popover>
                  </div>
                  <ResizeHandle column="name_ka" />
                </th>
                <th 
                  className="text-center px-4 font-semibold text-[#1f2937] relative" 
                  style={{ width: `${columnWidths.iso2}px` }}
                >
                  <div className="flex items-center justify-between">
                    <span 
                      className="cursor-pointer hover:text-blue-600 flex items-center"
                      onClick={() => handleSort('iso2')}
                    >
                      ISO2 {sortField === 'iso2' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </span>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                          <Filter className={`h-3 w-3 ${columnFilters.iso2.length > 0 ? 'text-blue-600' : 'text-gray-400'}`} />
                        </Button>
                      </PopoverTrigger>
                      <FilterDropdown
                        column="iso2"
                        values={uniqueValues.iso2}
                        selectedValues={columnFilters.iso2}
                        onFilterChange={(values) => handleFilterChange('iso2', values)}
                        title="Filter ISO2"
                      />
                    </Popover>
                  </div>
                  <ResizeHandle column="iso2" />
                </th>
                <th 
                  className="text-center px-4 font-semibold text-[#1f2937] hidden lg:table-cell relative" 
                  style={{ width: `${columnWidths.iso3}px` }}
                >
                  <div className="flex items-center justify-between">
                    <span 
                      className="cursor-pointer hover:text-blue-600 flex items-center"
                      onClick={() => handleSort('iso3')}
                    >
                      ISO3 {sortField === 'iso3' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </span>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                          <Filter className={`h-3 w-3 ${columnFilters.iso3.length > 0 ? 'text-blue-600' : 'text-gray-400'}`} />
                        </Button>
                      </PopoverTrigger>
                      <FilterDropdown
                        column="iso3"
                        values={uniqueValues.iso3}
                        selectedValues={columnFilters.iso3}
                        onFilterChange={(values) => handleFilterChange('iso3', values)}
                        title="Filter ISO3"
                      />
                    </Popover>
                  </div>
                  <ResizeHandle column="iso3" />
                </th>
                <th 
                  className="text-center px-4 font-semibold text-[#1f2937] hidden lg:table-cell relative" 
                  style={{ width: `${columnWidths.un_code}px` }}
                >
                  <div className="flex items-center justify-between">
                    <span 
                      className="cursor-pointer hover:text-blue-600 flex items-center"
                      onClick={() => handleSort('un_code')}
                    >
                      UN Code {sortField === 'un_code' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </span>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                          <Filter className={`h-3 w-3 ${columnFilters.un_code.length > 0 ? 'text-blue-600' : 'text-gray-400'}`} />
                        </Button>
                      </PopoverTrigger>
                      <FilterDropdown
                        column="un_code"
                        values={uniqueValues.un_code}
                        selectedValues={columnFilters.un_code}
                        onFilterChange={(values) => handleFilterChange('un_code', values)}
                        title="Filter UN Code"
                      />
                    </Popover>
                  </div>
                  <ResizeHandle column="un_code" />
                </th>
                <th 
                  className="text-left px-4 font-semibold text-[#1f2937] relative" 
                  style={{ width: `${columnWidths.country}px` }}
                >
                  <div className="flex items-center justify-between">
                    <span 
                      className="cursor-pointer hover:text-blue-600 flex items-center"
                      onClick={() => handleSort('country')}
                    >
                      Country {sortField === 'country' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </span>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                          <Filter className={`h-3 w-3 ${columnFilters.country.length > 0 ? 'text-blue-600' : 'text-gray-400'}`} />
                        </Button>
                      </PopoverTrigger>
                      <FilterDropdown
                        column="country"
                        values={uniqueValues.country}
                        selectedValues={columnFilters.country}
                        onFilterChange={(values) => handleFilterChange('country', values)}
                        title="Filter Country"
                      />
                    </Popover>
                  </div>
                  <ResizeHandle column="country" />
                </th>
                <th 
                  className="text-center px-4 font-semibold text-[#1f2937] relative" 
                  style={{ width: `${columnWidths.is_active}px` }}
                >
                  <div className="flex items-center justify-between">
                    <span 
                      className="cursor-pointer hover:text-blue-600 flex items-center"
                      onClick={() => handleSort('is_active')}
                    >
                      Active {sortField === 'is_active' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </span>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                          <Filter className={`h-3 w-3 ${columnFilters.is_active.length > 0 ? 'text-blue-600' : 'text-gray-400'}`} />
                        </Button>
                      </PopoverTrigger>
                      <FilterDropdown
                        column="is_active"
                        values={uniqueValues.is_active}
                        selectedValues={columnFilters.is_active}
                        onFilterChange={(values) => handleFilterChange('is_active', values)}
                        title="Filter Active Status"
                      />
                    </Popover>
                  </div>
                  <ResizeHandle column="is_active" />
                </th>
                <th 
                  className="text-center px-4 font-semibold text-[#1f2937] relative" 
                  style={{ width: `${columnWidths.actions}px` }}
                >
                  Actions
                  <ResizeHandle column="actions" />
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedCountries.map((country, index) => (
                <tr 
                  key={country.id} 
                  className="border-t hover:bg-gray-50 transition-colors"
                  style={{ 
                    height: '48px',
                    backgroundColor: index % 2 === 0 ? '#ffffff' : '#f9fafb'
                  }}
                >
                  <td className="px-4 text-[#374151]" style={{ width: `${columnWidths.name_en}px` }}>{country.name_en}</td>
                  <td className="px-4 text-[#374151] hidden md:table-cell" style={{ width: `${columnWidths.name_ka}px` }}>{country.name_ka}</td>
                  <td className="px-4 text-center text-[#374151]" style={{ width: `${columnWidths.iso2}px` }}>{country.iso2}</td>
                  <td className="px-4 text-center text-[#374151] hidden lg:table-cell" style={{ width: `${columnWidths.iso3}px` }}>{country.iso3}</td>
                  <td className="px-4 text-center text-[#374151] hidden lg:table-cell" style={{ width: `${columnWidths.un_code}px` }}>{country.un_code || '-'}</td>
                  <td className="px-4 text-[#374151]" style={{ width: `${columnWidths.country}px` }}>{country.country}</td>
                  <td className="px-4 text-center" style={{ width: `${columnWidths.is_active}px` }}>
                    <div className="inline-flex items-center">
                      {country.is_active ? (
                        <Badge variant="default" className="bg-green-100 text-green-800">
                          <Check className="w-3 h-3 mr-1" />
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-gray-100 text-gray-600">
                          <X className="w-3 h-3 mr-1" />
                          Inactive
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-4 text-center" style={{ width: `${columnWidths.actions}px` }}>
                    <div className="flex items-center justify-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditCountry(country)}
                        className="h-8 w-8 p-0"
                        title="Edit country"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {filteredAndSortedCountries.length === 0 && (
        <div className="text-center py-8 text-[#717182]">
          {searchTerm || hasActiveFilters ? 'No countries found matching your search or filters.' : 'No countries available.'}
        </div>
      )}
    </div>
  );
};
```

---

## 🚀 INTEGRATION INSTRUCTIONS FOR CHATGPT CODEX

### Step 1: Install Dependencies
```bash
npm install lucide-react @radix-ui/react-dialog @radix-ui/react-popover @radix-ui/react-checkbox @radix-ui/react-switch
```

### Step 2: Setup Shadcn/UI Components
Ensure all required Shadcn/UI components are installed in `/components/ui/` directory.

### Step 3: Copy Files
1. Copy the exact `/components/countries-table.tsx` code above
2. Copy the `/styles/globals.css` code above
3. Copy the `/App.tsx` wrapper code above

### Step 4: Usage
```tsx
import { CountriesTable } from './components/countries-table';

export default function App() {
  return (
    <div className="min-h-screen bg-background p-4 md:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <CountriesTable />
      </div>
    </div>
  );
}
```

---

## ✨ FEATURES INCLUDED

✅ **Google Sheets-Style Column Filters** - Dropdown checkboxes for every column  
✅ **Resizable Columns** - Drag borders to resize with localStorage persistence  
✅ **Advanced Search** - Global search across all text fields  
✅ **Dynamic Sorting** - Click column headers to sort  
✅ **Responsive Design** - Columns hide at specific breakpoints  
✅ **Form Validation** - Comprehensive validation with error messages  
✅ **CRUD Operations** - Create, Read, Update (no Delete - uses Active/Inactive)  
✅ **Mock Data** - 8 sample countries for testing  
✅ **TypeScript** - Full type safety  
✅ **Tailwind V4** - Modern styling system with custom properties  

This is the complete, production-ready implementation that can be directly integrated into any React application.