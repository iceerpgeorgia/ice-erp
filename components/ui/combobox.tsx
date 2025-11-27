"use client"

import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "./popover"
import { Button } from "./button"

export interface ComboboxProps {
  value?: string
  onValueChange?: (value: string) => void
  options: { value: string; label: string; keywords?: string }[]
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  triggerClassName?: string
}

export function Combobox({
  value,
  onValueChange,
  options,
  placeholder = "Select...",
  searchPlaceholder = "Search...",
  emptyText = "No results found.",
  triggerClassName = ""
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")

  const filtered = React.useMemo(() => {
    if (!search) return options
    return options.filter(option => {
      const searchText = search.toLowerCase()
      const labelMatch = option.label.toLowerCase().includes(searchText)
      const keywordsMatch = option.keywords?.toLowerCase().includes(searchText)
      return labelMatch || keywordsMatch
    })
  }, [options, search])

  const selectedLabel = options.find(opt => opt.value === value)?.label

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          role="combobox"
          aria-expanded={open}
          className={`w-full justify-between bg-white text-gray-900 border border-gray-300 hover:bg-gray-50 ${triggerClassName}`}
        >
          {selectedLabel || placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0">
        <div className="p-2">
          <input
            className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="max-h-60 overflow-auto">
          {filtered.length === 0 && (
            <div className="py-6 text-center text-sm text-gray-500">{emptyText}</div>
          )}
          {filtered.map((option) => (
            <div
              key={option.value}
              className={`relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-gray-100 ${
                value === option.value ? 'bg-gray-100' : ''
              }`}
              onClick={() => {
                onValueChange?.(option.value)
                setOpen(false)
                setSearch("")
              }}
            >
              <Check
                className={`mr-2 h-4 w-4 ${value === option.value ? 'opacity-100' : 'opacity-0'}`}
              />
              {option.label}
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
