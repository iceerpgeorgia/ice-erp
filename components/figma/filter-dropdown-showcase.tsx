import React, { useState } from 'react';
import { Search, Filter } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';

// Standalone Filter Dropdown Component for Export
export function FilterDropdownShowcase() {
  const [isOpen, setIsOpen] = useState(true); // Always open for showcase
  const [filterSearchTerm, setFilterSearchTerm] = useState('');
  const [selectedValues, setSelectedValues] = useState(['FR']); // Pre-selected FR to match screenshot

  // Sample data matching your screenshot
  const uniqueValues = ['DE', 'FR', 'GB', 'GE', 'JP', 'US'];
  
  // Filter values based on search term
  const filteredValues = uniqueValues.filter(value => 
    value.toLowerCase().includes(filterSearchTerm.toLowerCase())
  );

  const handleSelectAll = () => {
    setSelectedValues(filteredValues);
  };

  const handleClearAll = () => {
    setSelectedValues([]);
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 p-8">
      <div className="relative">
        {/* Context: Show the table header to provide context */}
        <div className="mb-4 bg-white border rounded-lg shadow-sm">
          <div className="flex items-center px-4 py-3 border-b bg-gray-50">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
              ISO2
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-6 px-1 text-blue-600"
              >
                <Filter className="h-3 w-3" />
                <span className="ml-1 text-xs">1</span>
              </Button>
            </div>
          </div>
          <div className="px-4 py-3 text-sm">
            FR
          </div>
        </div>

        {/* The main filter dropdown */}
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <div className="opacity-0 pointer-events-none">
              <Button variant="ghost" size="sm">
                <Filter className="h-3 w-3" />
              </Button>
            </div>
          </PopoverTrigger>
          <PopoverContent 
            className="w-72" 
            align="start"
            style={{
              position: 'absolute',
              top: '-20px',
              left: '120px',
              transform: 'none'
            }}
          >
            <div className="space-y-3">
              {/* Header */}
              <div className="flex items-center justify-between border-b pb-2">
                <div className="font-medium text-sm">ISO2</div>
                <div className="text-xs text-muted-foreground">
                  Displaying 6
                </div>
              </div>

              {/* Sort Options */}
              <div className="space-y-1">
                <button className="w-full text-left text-sm py-1 px-2 hover:bg-muted rounded">
                  Sort A to Z
                </button>
                <button className="w-full text-left text-sm py-1 px-2 hover:bg-muted rounded">
                  Sort Z to A
                </button>
              </div>

              {/* Filter by values section */}
              <div className="border-t pt-3">
                <div className="font-medium text-sm mb-2">Filter by values</div>
                
                {/* Select All / Clear controls */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex gap-2">
                    <button
                      onClick={handleSelectAll}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Select all 6
                    </button>
                    <span className="text-xs text-muted-foreground">·</span>
                    <button
                      onClick={handleClearAll}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                {/* Search input */}
                <div className="relative mb-3">
                  <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                  <Input
                    placeholder="Search values..."
                    value={filterSearchTerm}
                    onChange={(e) => setFilterSearchTerm(e.target.value)}
                    className="pl-7 h-8 text-sm"
                  />
                </div>

                {/* Values list with exact layout from screenshot */}
                <div className="space-y-1 max-h-48 overflow-auto border rounded p-2">
                  {filteredValues.map(value => (
                    <div key={value} className="flex items-center space-x-2 py-1">
                      <Checkbox
                        id={`iso2-${value}`}
                        checked={selectedValues.includes(value)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedValues([...selectedValues, value]);
                          } else {
                            setSelectedValues(selectedValues.filter(v => v !== value));
                          }
                        }}
                      />
                      <Label htmlFor={`iso2-${value}`} className="text-sm flex-1 cursor-pointer">
                        {value}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action buttons - matching your exact styling */}
              <div className="flex justify-end space-x-2 pt-2 border-t">
                <Button variant="outline" size="sm">
                  Cancel
                </Button>
                <Button size="sm" className="bg-green-600 hover:bg-green-700">
                  OK
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}