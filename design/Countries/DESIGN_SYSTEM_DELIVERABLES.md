# 🎨 COMPLETE DESIGN SYSTEM DELIVERABLES FOR COUNTRIES TABLE

## 📋 **1. DESIGN TOKENS + LAYOUT VARIABLES**

### **Typography Tokens**
```typescript
// Typography System
export const typography = {
  fontFamily: 'system-ui, -apple-system, sans-serif',
  fontWeights: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700
  },
  fontSize: {
    base: '16px',
    sm: '14px',
    lg: '18px',
    xl: '20px',
    '2xl': '24px'
  },
  lineHeight: 1.5,
  
  // Element-specific typography
  headings: {
    h2: { fontSize: 'var(--text-xl)', fontWeight: 'var(--font-weight-medium)' },
    h4: { fontSize: 'var(--text-base)', fontWeight: 'var(--font-weight-medium)' }
  },
  labels: { fontSize: 'var(--text-base)', fontWeight: 'var(--font-weight-medium)' },
  buttons: { fontSize: 'var(--text-base)', fontWeight: 'var(--font-weight-medium)' },
  inputs: { fontSize: 'var(--text-base)', fontWeight: 'var(--font-weight-normal)' }
}
```

### **Color Tokens**
```typescript
// Color System
export const colors = {
  // Base colors
  background: '#ffffff',
  foreground: 'oklch(0.145 0 0)', // #1f2937
  
  // Surface colors
  card: '#ffffff',
  cardForeground: 'oklch(0.145 0 0)',
  
  // Interactive colors
  primary: '#030213',
  primaryForeground: 'oklch(1 0 0)',
  secondary: 'oklch(0.95 0.0058 264.53)',
  secondaryForeground: '#030213',
  
  // State colors
  muted: '#ececf0',
  mutedForeground: '#717182',
  accent: '#e9ebef',
  accentForeground: '#030213',
  destructive: '#d4183d',
  destructiveForeground: '#ffffff',
  
  // UI elements
  border: 'rgba(0, 0, 0, 0.1)',
  input: 'transparent',
  inputBackground: '#f3f3f5',
  switchBackground: '#cbced4',
  ring: 'oklch(0.708 0 0)',
  
  // Table-specific colors
  tableHeader: '#f9fafb',
  tableRowEven: '#ffffff',
  tableRowOdd: '#f9fafb',
  tableHover: 'rgba(156, 163, 175, 0.05)', // gray-50
  
  // Badge colors
  badgeActiveBackground: 'rgba(34, 197, 94, 0.1)', // green-100
  badgeActiveText: 'rgb(21, 128, 61)', // green-800
  badgeInactiveBackground: 'rgba(156, 163, 175, 0.1)', // gray-100
  badgeInactiveText: 'rgb(75, 85, 99)' // gray-600
}
```

### **Shadows & Radii**
```typescript
export const effects = {
  shadows: {
    card: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
    dialog: '0 25px 50px -12px rgb(0 0 0 / 0.25)',
    popover: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)'
  },
  radii: {
    sm: 'calc(0.625rem - 4px)', // ~6px
    md: 'calc(0.625rem - 2px)', // ~8px  
    lg: '0.625rem', // 10px
    xl: 'calc(0.625rem + 4px)' // ~14px
  }
}
```

### **Spacing Tokens**
```typescript
export const spacing = {
  // Standard gaps
  gap: {
    1: '4px',
    2: '8px',
    3: '12px', 
    4: '16px',
    6: '24px',
    8: '32px'
  },
  
  // Table-specific spacing
  table: {
    cellPadding: '16px', // px-4
    headerHeight: '56px',
    rowHeight: '48px',
    columnGap: '8px'
  },
  
  // Dialog spacing
  dialog: {
    padding: '24px',
    maxWidth: '600px',
    headerSpacing: '16px',
    actionSpacing: '16px'
  },
  
  // Toolbar spacing
  toolbar: {
    padding: '16px',
    buttonGap: '8px'
  }
}
```

### **Breakpoints**
```typescript
export const breakpoints = {
  sm: '640px',
  md: '768px',  // name_ka column shows/hides here
  lg: '1024px', // iso3 and un_code columns show/hide here
  xl: '1280px',
  '2xl': '1536px'
}
```

---

## 📊 **2. TABLE SCHEMA BUNDLE**

### **Countries Table Configuration**
```typescript
// design/countries.table.json
export const countriesTableConfig = {
  columns: [
    {
      key: 'name_en',
      label: 'Name (EN)',
      width: 200,
      minWidth: 120,
      hideBelow: null,
      alignment: 'left',
      sortable: true,
      filterable: true,
      required: true
    },
    {
      key: 'name_ka',
      label: 'Name (KA)',
      width: 180,
      minWidth: 100,
      hideBelow: 'md',
      alignment: 'left',
      sortable: true,
      filterable: true,
      required: false
    },
    {
      key: 'iso2',
      label: 'ISO2',
      width: 80,
      minWidth: 60,
      hideBelow: null,
      alignment: 'center',
      sortable: true,
      filterable: true,
      required: true,
      transform: 'uppercase'
    },
    {
      key: 'iso3',
      label: 'ISO3',
      width: 80,
      minWidth: 60,
      hideBelow: 'lg',
      alignment: 'center',
      sortable: true,
      filterable: true,
      required: true,
      transform: 'uppercase'
    },
    {
      key: 'un_code',
      label: 'UN Code',
      width: 100,
      minWidth: 80,
      hideBelow: 'lg',
      alignment: 'center',
      sortable: true,
      filterable: true,
      required: false,
      type: 'number',
      range: { min: 1, max: 999 }
    },
    {
      key: 'country',
      label: 'Country',
      width: 180,
      minWidth: 120,
      hideBelow: null,
      alignment: 'left',
      sortable: true,
      filterable: true,
      required: true
    },
    {
      key: 'is_active',
      label: 'Active',
      width: 100,
      minWidth: 80,
      hideBelow: null,
      alignment: 'center',
      sortable: true,
      filterable: true,
      type: 'boolean',
      badge: {
        true: { variant: 'success', icon: 'Check', text: 'Active' },
        false: { variant: 'secondary', icon: 'X', text: 'Inactive' }
      }
    },
    {
      key: 'actions',
      label: 'Actions',
      width: 120,
      minWidth: 100,
      hideBelow: null,
      alignment: 'center',
      sortable: false,
      filterable: false
    }
  ],
  
  ui: {
    defaultSort: { field: 'name_en', direction: 'asc' },
    rowDensity: 'comfortable', // 48px height
    stickyHeader: true,
    alternatingRows: true,
    hoverColor: 'rgba(156, 163, 175, 0.05)',
    focusColor: 'var(--color-ring)'
  },
  
  toolbar: {
    search: {
      enabled: true,
      placeholder: 'Search countries...',
      position: 'left'
    },
    filters: {
      enabled: true,
      clearButton: true,
      activeIndicator: true
    },
    actions: {
      resetWidths: true,
      addButton: { text: 'Add Country', icon: 'Plus' }
    }
  },
  
  persistence: {
    columnWidths: {
      key: 'countries-table-column-widths',
      storage: 'localStorage'
    }
  }
}
```

### **Filter Configuration**
```typescript
export const filterConfig = {
  layout: 'popover', // vs 'dropdown'
  searchable: true,
  selectAll: true,
  clearAll: true,
  placeholder: 'Search...',
  emptyLabel: '(Empty)',
  maxHeight: '192px', // max-h-48
  
  // Special handling for boolean columns
  booleanColumns: {
    options: [
      { value: true, label: 'Active' },
      { value: false, label: 'Inactive' }
    ],
    allLabel: 'All'
  }
}
```

---

## 🧩 **3. UI PRIMITIVES SPECIFICATIONS**

### **Button Component**
```typescript
// Button variants and states
export const buttonSpec = {
  variants: {
    default: {
      background: 'var(--color-primary)',
      color: 'var(--color-primary-foreground)',
      hover: 'opacity-90'
    },
    outline: {
      background: 'transparent',
      color: 'var(--color-foreground)', 
      border: '1px solid var(--color-border)',
      hover: 'var(--color-accent)'
    },
    ghost: {
      background: 'transparent',
      color: 'var(--color-foreground)',
      hover: 'var(--color-accent)'
    }
  },
  sizes: {
    sm: { height: '32px', padding: '0 12px', fontSize: '14px' },
    default: { height: '40px', padding: '0 16px', fontSize: '16px' },
    lg: { height: '44px', padding: '0 20px', fontSize: '16px' }
  },
  states: {
    disabled: { opacity: 0.5, pointerEvents: 'none' },
    loading: { opacity: 0.7, cursor: 'wait' }
  }
}
```

### **Input Component**
```typescript
export const inputSpec = {
  base: {
    height: '40px',
    padding: '0 12px',
    background: 'var(--color-input-background)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)',
    fontSize: 'var(--text-base)',
    fontWeight: 'var(--font-weight-normal)'
  },
  states: {
    focus: {
      outline: '2px solid var(--color-ring)',
      outlineOffset: '2px'
    },
    error: {
      border: '1px solid var(--color-destructive)'
    }
  },
  types: {
    number: {
      appearance: 'textfield' // Hide spinners
    }
  }
}
```

### **Switch Component**
```typescript
export const switchSpec = {
  track: {
    width: '44px',
    height: '24px',
    background: 'var(--color-switch-background)',
    backgroundChecked: 'var(--color-primary)',
    borderRadius: '12px'
  },
  thumb: {
    width: '20px',
    height: '20px',
    background: '#ffffff',
    borderRadius: '10px',
    translateX: { off: '2px', on: '22px' },
    transition: 'transform 0.2s'
  }
}
```

### **Dialog Component**
```typescript
export const dialogSpec = {
  overlay: {
    background: 'rgba(0, 0, 0, 0.8)',
    backdropFilter: 'blur(2px)'
  },
  content: {
    background: 'var(--color-card)',
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow-dialog)',
    maxWidth: '600px',
    width: '90vw',
    maxHeight: '85vh',
    padding: '24px'
  },
  header: {
    marginBottom: '16px'
  },
  title: {
    fontSize: 'var(--text-lg)',
    fontWeight: 'var(--font-weight-medium)',
    marginBottom: '8px'
  },
  description: {
    fontSize: 'var(--text-sm)',
    color: 'var(--color-muted-foreground)'
  }
}
```

### **Badge Component**
```typescript
export const badgeSpec = {
  variants: {
    default: {
      background: 'var(--badge-active-background)',
      color: 'var(--badge-active-text)'
    },
    secondary: {
      background: 'var(--badge-inactive-background)', 
      color: 'var(--badge-inactive-text)'
    }
  },
  base: {
    display: 'inline-flex',
    alignItems: 'center',
    borderRadius: 'var(--radius-sm)',
    padding: '2px 8px',
    fontSize: '12px',
    fontWeight: 'var(--font-weight-medium)'
  },
  icon: {
    width: '12px',
    height: '12px',
    marginRight: '4px'
  }
}
```

### **Popover Component**
```typescript
export const popoverSpec = {
  content: {
    background: 'var(--color-popover)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)',
    boxShadow: 'var(--shadow-popover)',
    padding: '16px',
    minWidth: '192px', // w-48
    maxWidth: '256px', // w-64
    zIndex: 50
  },
  arrow: {
    size: '8px',
    color: 'var(--color-popover)'
  }
}
```

---

## 📝 **4. ADD COUNTRY FORM SPECIFICATIONS**

### **Form Layout**
```typescript
export const formSpec = {
  container: {
    className: 'space-y-4'
  },
  grid: {
    className: 'grid grid-cols-1 md:grid-cols-2 gap-4',
    breakpoint: 'md'
  },
  fields: [
    {
      id: 'name_en',
      label: 'Name (EN)',
      type: 'text',
      required: true,
      gridColumn: '1',
      validation: {
        required: 'Enter English country name'
      }
    },
    {
      id: 'name_ka', 
      label: 'Name (KA)',
      type: 'text',
      required: false,
      gridColumn: '2'
    },
    {
      id: 'iso2',
      label: 'ISO2',
      type: 'text',
      required: true,
      maxLength: 2,
      transform: 'uppercase',
      gridColumn: '1',
      validation: {
        required: 'ISO2 code is required',
        pattern: { regex: '/^[A-Z]{2}$/', message: 'Must be 2 uppercase letters' }
      }
    },
    {
      id: 'iso3',
      label: 'ISO3', 
      type: 'text',
      required: true,
      maxLength: 3,
      transform: 'uppercase',
      gridColumn: '2',
      validation: {
        required: 'ISO3 code is required',
        pattern: { regex: '/^[A-Z]{3}$/', message: 'Must be 3 uppercase letters' }
      }
    },
    {
      id: 'un_code',
      label: 'UN Code',
      type: 'number',
      required: false,
      min: 1,
      max: 999,
      gridColumn: '1',
      validation: {
        range: 'Must be a valid UN numeric code'
      }
    },
    {
      id: 'country',
      label: 'Country',
      type: 'text', 
      required: true,
      gridColumn: '2',
      validation: {
        required: 'Country field is required'
      }
    },
    {
      id: 'is_active',
      label: 'Active',
      type: 'switch',
      defaultValue: true,
      gridColumn: 'span'
    }
  ],
  actions: {
    className: 'flex justify-end space-x-2 pt-4',
    buttons: [
      {
        type: 'button',
        variant: 'outline',
        text: 'Cancel',
        action: 'cancel'
      },
      {
        type: 'submit',
        variant: 'default', 
        text: 'Create Country',
        textEdit: 'Update Country',
        action: 'submit'
      }
    ]
  }
}
```

### **Error Styling**
```typescript
export const errorSpec = {
  field: {
    border: '1px solid var(--color-destructive)'
  },
  message: {
    fontSize: 'var(--text-sm)',
    color: 'var(--color-destructive)',
    marginTop: '4px'
  }
}
```

---

## 🎯 **5. INTERACTION SPECIFICATIONS**

### **Column Resizing**
```typescript
export const columnResizeSpec = {
  handle: {
    width: '8px', // w-2
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    cursor: 'col-resize',
    backgroundColor: 'transparent',
    hover: 'rgba(59, 130, 246, 0.2)', // blue-500/20
    indicator: {
      width: '4px', // w-1  
      height: '24px', // h-6
      backgroundColor: 'rgb(209, 213, 219)', // gray-300
      backgroundColorHover: 'rgb(59, 130, 246)', // blue-500
      borderRadius: '2px'
    }
  },
  constraints: {
    minWidth: '50px',
    maxWidth: 'none'
  },
  persistence: {
    key: 'countries-table-column-widths',
    storage: 'localStorage'
  }
}
```

### **Row States**
```typescript
export const rowStateSpec = {
  default: {
    backgroundColor: 'alternating', // white/#f9fafb
    transition: 'background-color 0.15s'
  },
  hover: {
    backgroundColor: 'rgba(156, 163, 175, 0.05)' // gray-50
  },
  focus: {
    outline: '2px solid var(--color-ring)',
    outlineOffset: '-2px'
  }
}
```

### **Filter Dropdown Behavior**
```typescript
export const filterDropdownSpec = {
  trigger: {
    size: '24px', // h-6 w-6
    padding: 0,
    icon: {
      size: '12px', // h-3 w-3
      color: 'rgb(156, 163, 175)', // gray-400
      colorActive: 'rgb(37, 99, 235)' // blue-600
    }
  },
  content: {
    closeOnOutsideClick: true,
    closeOnEscape: true,
    maxHeight: '192px', // max-h-48
    overflowY: 'auto'
  },
  search: {
    placeholder: 'Search...',
    height: '32px', // h-8
    marginBottom: '12px'
  },
  items: {
    spacing: '8px', // space-y-2
    checkbox: {
      size: '16px',
      marginRight: '8px'
    }
  }
}
```

---

## 📦 **6. DELIVERY FORMAT**

### **TypeScript Configuration Bundle**
```typescript
// design-tokens.ts
export { typography, colors, effects, spacing, breakpoints } from './tokens';

// table-config.ts  
export { countriesTableConfig, filterConfig } from './table';

// ui-specs.ts
export { 
  buttonSpec, 
  inputSpec, 
  switchSpec, 
  dialogSpec, 
  badgeSpec, 
  popoverSpec 
} from './components';

// form-config.ts
export { formSpec, errorSpec } from './forms';

// interactions.ts
export { 
  columnResizeSpec, 
  rowStateSpec, 
  filterDropdownSpec 
} from './interactions';
```

### **Icon Requirements**
```typescript
// From lucide-react
export const requiredIcons = [
  'Search',      // Search input
  'Plus',        // Add Country button  
  'Edit2',       // Edit action
  'Check',       // Active badge
  'X',           // Inactive badge, Close button
  'Filter',      // Column filter triggers
  'GripVertical' // Reset widths button
];

// Icon specifications
export const iconSpec = {
  strokeWidth: 2,
  defaultSize: '16px', // w-4 h-4
  smallSize: '12px',   // w-3 h-3
  largeSize: '20px'    // w-5 h-5
}
```

### **Tailwind V4 Extensions**
```css
/* Additional CSS custom properties needed */
:root {
  /* Table-specific tokens */
  --table-header-bg: #f9fafb;
  --table-row-even: #ffffff;
  --table-row-odd: #f9fafb;
  --table-hover: rgba(156, 163, 175, 0.05);
  
  /* Badge tokens */
  --badge-active-bg: rgba(34, 197, 94, 0.1);
  --badge-active-text: rgb(21, 128, 61);
  --badge-inactive-bg: rgba(156, 163, 175, 0.1);
  --badge-inactive-text: rgb(75, 85, 99);
  
  /* Resize handle */
  --resize-handle-hover: rgba(59, 130, 246, 0.2);
  --resize-indicator: rgb(209, 213, 219);
  --resize-indicator-hover: rgb(59, 130, 246);
}
```

---

## 🚀 **IMPLEMENTATION PRIORITY**

### **Phase 1: Core Components**
1. Button, Input, Label, Switch components
2. Dialog system with proper focus management
3. Basic table structure with responsive columns

### **Phase 2: Advanced Features** 
1. Column resizing with localStorage persistence
2. Filter dropdown system with search
3. Form validation and error handling

### **Phase 3: Polish**
1. Hover states and transitions
2. Keyboard navigation
3. Loading states

This specification provides everything needed to rebuild the countries table with pixel-perfect accuracy and full feature parity! 🎯