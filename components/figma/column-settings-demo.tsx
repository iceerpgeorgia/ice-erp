import React from 'react';
import { ColumnSettingsDialog, useColumnSettings, defaultCountriesColumns, ColumnConfig } from './column-settings-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Badge } from './ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { getResponsiveClass } from './column-settings-dialog';

// Sample data for demonstration
const sampleCountries = [
  {
    id: 1,
    createdAt: '2025-10-01',
    updatedAt: '2025-10-02',
    ts: '2025-10-01T12:00:00Z',
    countryUuid: 'uuid-1234-5678',
    nameEn: 'Georgia',
    nameKa: 'საქართველო',
    iso2: 'GE',
    iso3: 'GEO',
    unCode: 268,
    country: 'Georgia',
    isActive: true
  },
  {
    id: 2,
    createdAt: '2025-10-01',
    updatedAt: '2025-10-02',
    ts: '2025-10-01T12:30:00Z',
    countryUuid: 'uuid-9012-3456',
    nameEn: 'United States',
    nameKa: 'შეერთებული შტატები',
    iso2: 'US',
    iso3: 'USA',
    unCode: 840,
    country: 'United States',
    isActive: true
  },
  {
    id: 3,
    createdAt: '2025-10-01',
    updatedAt: '2025-10-02',
    ts: '2025-10-01T13:00:00Z',
    countryUuid: 'uuid-7890-1234',
    nameEn: 'United Kingdom',
    nameKa: 'გაერთიანებული სამეფო',
    iso2: 'GB',
    iso3: 'GBR',
    unCode: 826,
    country: 'United Kingdom',
    isActive: false
  }
];

/**
 * ColumnSettingsDemo Component
 * 
 * Demonstrates the ColumnSettingsDialog component with a live table preview.
 * Shows how column visibility changes affect the table in real-time.
 */
export function ColumnSettingsDemo() {
  const {
    columns,
    visibleColumns,
    updateColumns
  } = useColumnSettings(defaultCountriesColumns, 'demo-columns-settings');

  // Render cell content based on column type
  const renderCellContent = (country: any, column: ColumnConfig) => {
    const value = country[column.key];
    
    switch (column.key) {
      case 'isActive':
        return (
          <Badge variant={value ? "success" : "error"} className="text-xs">
            {value ? 'Active' : 'Inactive'}
          </Badge>
        );
      case 'createdAt':
      case 'updatedAt':
        return <span className="text-sm">{value}</span>;
      case 'ts':
        return <span className="text-sm font-mono">{value}</span>;
      case 'countryUuid':
        return <span className="text-sm font-mono text-muted-foreground">{value}</span>;
      default:
        return <span className="text-sm">{value}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Column Settings Button */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Column Settings Demo</CardTitle>
              <CardDescription>
                Interactive demonstration of the column visibility dialog
              </CardDescription>
            </div>
            <ColumnSettingsDialog
              columns={columns}
              onColumnsChange={updateColumns}
              storageKey="demo-columns-settings"
              defaultColumns={defaultCountriesColumns}
            />
          </div>
        </CardHeader>
        
        <CardContent>
          <div className="space-y-4">
            {/* Stats */}
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                Showing {visibleColumns.length} of {columns.length} columns
              </span>
              <span>
                {sampleCountries.length} sample records
              </span>
            </div>

            {/* Responsive Breakpoint Info */}
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="text-muted-foreground">Responsive breakpoints:</span>
              <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded border">SM (640px+)</span>
              <span className="px-2 py-1 bg-green-100 text-green-800 rounded border">MD (768px+)</span>
              <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded border">LG (1024px+)</span>
              <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded border">XL (1280px+)</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Live Table Preview */}
      <Card>
        <CardHeader>
          <CardTitle>Live Table Preview</CardTitle>
          <CardDescription>
            This table updates immediately when you change column visibility settings
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <div className="border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    {visibleColumns.map((column) => (
                      <TableHead
                        key={column.key}
                        className={getResponsiveClass(column.responsive)}
                        style={{ width: column.width }}
                      >
                        <div className="flex items-center space-x-1">
                          <span>{column.label}</span>
                          {column.responsive && (
                            <span className={`px-1 py-0.5 text-xs rounded border ${{
                              'sm': 'bg-blue-100 text-blue-800 border-blue-200',
                              'md': 'bg-green-100 text-green-800 border-green-200',
                              'lg': 'bg-orange-100 text-orange-800 border-orange-200',
                              'xl': 'bg-purple-100 text-purple-800 border-purple-200'
                            }[column.responsive]}`}>
                              {column.responsive.toUpperCase()}
                            </span>
                          )}
                        </div>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sampleCountries.map((country) => (
                    <TableRow key={country.id} className="hover:bg-muted/50">
                      {visibleColumns.map((column) => (
                        <TableCell
                          key={column.key}
                          className={getResponsiveClass(column.responsive)}
                          style={{ width: column.width }}
                        >
                          {renderCellContent(country, column)}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Column Configuration Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Current Column Configuration</CardTitle>
          <CardDescription>
            Summary of all columns and their current settings
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <div className="grid gap-3">
            {columns.map((column) => (
              <div
                key={column.key}
                className={`flex items-center justify-between p-3 border rounded-lg ${
                  column.visible ? 'bg-success/10 border-success/20' : 'bg-muted/50 border-border'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div className={`w-3 h-3 rounded-full ${
                    column.visible ? 'bg-success-foreground' : 'bg-muted-foreground'
                  }`} />
                  <span className="font-medium">{column.label}</span>
                  <span className="text-xs text-muted-foreground">({column.key})</span>
                  {column.responsive && (
                    <span className={`px-1.5 py-0.5 text-xs rounded border ${{
                      'sm': 'bg-blue-100 text-blue-800 border-blue-200',
                      'md': 'bg-green-100 text-green-800 border-green-200',
                      'lg': 'bg-orange-100 text-orange-800 border-orange-200',
                      'xl': 'bg-purple-100 text-purple-800 border-purple-200'
                    }[column.responsive]}`}>
                      {column.responsive.toUpperCase()}
                    </span>
                  )}
                </div>
                
                <div className="flex items-center space-x-2 text-sm">
                  <span className="text-muted-foreground">{column.width}px</span>
                  <Badge variant={column.visible ? "success" : "secondary"} className="text-xs">
                    {column.visible ? 'Visible' : 'Hidden'}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default ColumnSettingsDemo;