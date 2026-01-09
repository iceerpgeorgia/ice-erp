# Formula Autocomplete Feature

## Overview
The formula textarea now has **intelligent autocomplete** for column names, similar to Facebook's @-mentions feature.

## How It Works

### Automatic Suggestions
- Start typing any column name (e.g., `docs`, `doc`, `sender`)
- Autocomplete dropdown appears **automatically** after 1+ characters
- Shows **all matching columns** from the selected parsing scheme's raw data table

### Keyboard Navigation
- **↑ / ↓** - Navigate through suggestions
- **Enter** or **Tab** - Select highlighted suggestion
- **Escape** - Close autocomplete dropdown
- **Continue typing** - Refines suggestions in real-time

### Mouse Interaction
- **Hover** - Highlight suggestion
- **Click** - Insert column name at cursor position

## Example Usage

### Scenario 1: Typing a search formula
```
You type: SEARCH("text", doc
Autocomplete shows:
  ▶ docbranch
  ▶ docdepartment
  ▶ docdstamt
  ▶ docdstccy
  ▶ docinformation
  ▶ dockey
  ▶ docno
  ▶ docnomination
  ▶ docrecdate
  ▶ docsendername
  ▶ docsrcamt
  ▶ docsrcccy
  ▶ docvaluedate

You press ↓↓ to highlight "docsendername" and press Enter
Result: SEARCH("text", docsendername)
```

### Scenario 2: Multiple columns in one formula
```
You type: AND(docsr
Autocomplete shows:
  ▶ docsrcamt
  ▶ docsrcccy

You select "docsrcamt" with Enter
Result: AND(docsrcamt

You type: > 1000, docsr
Autocomplete shows again:
  ▶ docsrcamt
  ▶ docsrcccy

You select "docsrcccy"
Final: AND(docsrcamt > 1000, docsrcccy = "GEL")
```

### Scenario 3: Complex nested formula
```
Typing: OR(SEARCH("text", doc
                              ↑ cursor here
Autocomplete appears with all "doc*" columns
Select one, keeps typing...
```

## Features

✅ **Smart Matching** - Case-insensitive prefix matching  
✅ **Context Aware** - Only shows when typing words (ignores inside strings)  
✅ **Position Aware** - Dropdown appears near cursor location  
✅ **Keyboard First** - Full keyboard navigation support  
✅ **Mouse Friendly** - Click to insert  
✅ **Visual Feedback** - Blue highlight for selected item  
✅ **Auto-replace** - Replaces partial word with full column name  
✅ **Multi-use** - Works anywhere in the formula

## UI Hints

When a parsing scheme is selected and columns are loaded:
> 💡 Start typing column names for autocomplete suggestions

When typing and matches found:
> [Blue dropdown with matching columns]

## Technical Details

- **Trigger**: Typing any alphanumeric character after whitespace/operator
- **Match**: Columns starting with typed characters (case-insensitive)
- **Insertion**: Replaces partial word from start to cursor position
- **Cleanup**: Closes on blur, Escape, or selection
- **Validation**: Still validates formula on blur after autocomplete

## Benefits

1. **Faster formula writing** - No need to memorize exact column names
2. **Fewer typos** - Select from valid columns only
3. **Better UX** - Familiar interaction pattern (like @-mentions)
4. **Visual discovery** - See all available columns while typing
5. **Reduced errors** - Prevents unknown column validation errors

## Keyboard Shortcuts Summary

| Key | Action |
|-----|--------|
| `Type 1+ chars` | Show autocomplete |
| `↑` | Previous suggestion |
| `↓` | Next suggestion |
| `Enter` | Insert selected |
| `Tab` | Insert selected |
| `Esc` | Close dropdown |
| `Click` | Insert clicked item |
