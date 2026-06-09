# Handover Template Analysis

## Overview
The `handover template.xlsx` file is a pre-designed Excel template with embedded formulas and placeholders for generating professional handover documents (მიღება-ჩაბარების აქტი).

## File Structure

### Sheet: "Handover"
- **Dimensions**: C1:L85 (Content spans columns C-L, rows 1-85)
- **Content rows**: 54 rows with values/formulas
- **Total rows available**: 85

---

## Template Sections

### 1. HEADER SECTION (Rows 1-14)
- **Row 1**: Title (merged C1:K1) - "მიღება-ჩაბარების აქტი" (Handover Document)
- **Row 4**: Comment placeholders about project department and certificate date formatting
  - C4:E4: Department-specific text
  - J4:K4: Certificate date formatting instructions
- **Row 6**: Long merged cell (C6:K14) containing placeholder text for:
  - Dynamic party information: `project.counteragent.entity_type.Name_Geo + project.counteragent.Name`
  - This will be replaced with actual project details during export

### 2. COLUMN HEADERS (Row 16)
| Column | Header | Content |
|--------|--------|---------|
| C | # | Row number (auto-numbered) |
| D | კონტ. # | Counteragent ID |
| E | მწარმოებელი | Manufacturer name |
| F | საქარხნო ნომერი | Factory number |
| G | ამწეობა (კგ) | Weight in kilograms |
| H | სართ. | Floors |
| I | სერტიფიკატის # | Certificate number |
| J | თანხა + symbol | Nominal amount with currency symbol |
| K | თანხა ₾ | Amount in GEL |

### 3. DATA ROWS (Rows 17-63)
**KEY FINDING**: Uses FILTER array formulas to pull data from "Jobs" sheet

#### Row 17: Array Formulas (FILTER Functions)
```excel
D17: =_xlfn._xlws.FILTER(Jobs!A:A,Jobs!M:M=46169)
E17: =_xlfn._xlws.FILTER(Jobs!C:C,Jobs!M:M=46169)
F17: =_xlfn._xlws.FILTER(Jobs!B:B,Jobs!M:M=46169)
G17: =_xlfn._xlws.FILTER(Jobs!E:E,Jobs!M:M=46169)&" კგ"
H17: =_xlfn._xlws.FILTER(Jobs!D:D,Jobs!M:M=46169)
I17: =_xlfn._xlws.FILTER(Jobs!N:N,Jobs!M:M=46169)
J17: =_xlfn._xlws.FILTER(Jobs!F:F,Jobs!M:M=46169)
K17: =_xlfn._xlws.FILTER(Jobs!K:K,Jobs!M:M=46169)
```

**Critical Placeholder**: `46169` appears in all FILTER criteria
- This is a **placeholder project ID** that needs to be replaced with the actual project ID during export
- The FILTER function will then pull only jobs matching this project

#### Row 18: Sample Data
Contains one example row:
- D18: L0002 (counteragent ID)
- E18: OTIS (manufacturer)
- F18: K6NC0633 (factory number)
- G18: 1600 კგ (weight with unit)
- H18: 13 (floors)
- I18: 0861-26 (certificate number)
- J18: 55044 (nominal amount)
- K18: 147664.18 (GEL amount)

#### Rows 19-63: Empty with Row Number Formula
- **C column**: Contains formula `=IF(D19<>"",ROW()-16,"")` for rows 19-63
  - This auto-generates row numbers (1, 2, 3, ...) based on whether column D has content
  - ROW()-16 translates: Row 17 → 1, Row 18 → 2, Row 19 → 3, etc.

#### Column C Formula Pattern
```excel
C17: =IF(D17<>"",ROW()-16,"")
C18: =IF(D18<>"",ROW()-16,"")
C19: =IF(D19<>"",ROW()-16,"")
...continues through C63
```
Purpose: Automatically number rows only when they contain data

### 4. TOTALS ROW (Row 64)
- **C64**: "ჯამი" (Sum/Total label) - merged C64:H64
- **J64**: `=SUM(J17:J63)` - Sum of nominal amounts
- **K64**: `=SUM(K17:K63)` - Sum of GEL amounts

### 5. NOTES SECTION (Row 66)
- **C66:K66** (merged): Explanation about VAT inclusion
  - Text: "ცხრილში მოცემული თანხები მოცემულია მონტაჟის ღირებულების და დღგ-ს ჩათვლით."
  - Translation: "Amounts in the table include installation cost and VAT."

### 6. FOOTER SECTION (Rows 69+)
- **C69:G79** (merged): Placeholder for first party information
  - Contains template text: `project.counteragent.entity_type.Name_Geo + project.counteragent.Name`
  - Includes signature line placeholder: "---------------"
- **H69:K79** (merged): Placeholder for second party information
  - Template company: "შპს აი-სი-ი" (LLC ICE)
  - Includes signature line placeholder: "---------------"

---

## Merged Cells
The template uses merged cells for professional formatting:
- C1:K1 - Title
- C69:G79 - First party footer
- C6:K14 - Project details section
- G2:H2 - (small merge, likely spacing)
- H69:K79 - Second party footer
- C66:K66 - Notes about VAT
- C64:H64 - Totals label
- C4:E4 - Department comment

---

## Column Widths
Auto-adjusted for readability:
- C: 4.5 (narrow for row numbers)
- D: 8.5 (counteragent ID)
- E: 13.5 (manufacturer name - wider)
- F: 9.25 (factory number)
- G: 8.0 (weight)
- H: 6.25 (floors)
- I: 15.625 (certificate number - widest)
- J: 11.625 (nominal amount)
- K: 13.75 (GEL amount)
- L: 13.0 (hidden/unused)

---

## Integration Strategy for Export

### Method 1: Template-Based Export (Recommended)
1. **Copy the template** as base
2. **Replace placeholder ID** `46169` with actual project/handover ID
3. **Formulas auto-populate**: FILTER functions pull matching jobs from Jobs sheet
4. **Advantages**:
   - Professional formatting preserved
   - Formulas remain live (can recalculate in Excel)
   - Minimal code needed (mostly string replacement)
   - User can edit template without breaking export

### Method 2: Hybrid Approach (Alternative)
- Keep current programmatic export for flexibility
- Offer both options:
  - "Export with formulas" (template-based, dynamic)
  - "Export with values" (current approach, static)

### Key Implementation Steps

#### Step 1: Template Copying & ID Replacement
```typescript
// Pseudo-code for export logic
1. Load handover template.xlsx
2. Get worksheet "Handover"
3. Replace all instances of "46169" with actual project ID
4. Replace placeholder text in rows 4, 6, 69 with actual project data
5. Save as new file: `handovers-{projectIndex}-{date}.xlsx`
```

#### Step 2: Data Sources
- **Jobs sheet**: Must exist in template with columns:
  - A: Counteragent ID (D in Handover)
  - B: Factory number (F in Handover)
  - C: Manufacturer name (E in Handover)
  - D: Floors (H in Handover)
  - E: Weight (G in Handover)
  - F: Nominal amount (J in Handover)
  - K: GEL amount (K in Handover)
  - M: Project ID (filter criteria)
  - N: Certificate number (I in Handover)

#### Step 3: Placeholder Replacement Map
| Placeholder | Source | Location |
|-------------|--------|----------|
| 46169 | project.uuid | Row 17 FILTER formulas (D:K) |
| project.department | project.location | Row 4 comment |
| project.counteragent.entity_type.Name_Geo + project.counteragent.Name | counteragent info | Row 6 merged cell |
| Certificate date format | handover.liftCertDate | Row 4 comment |

---

## Current Data Layout

### Sample Data (Row 18)
Shows expected output format when formulas evaluate:
```
# | কনটর.# | Manufacturer | Factory | Weight | Floors | Cert# | Nominal | GEL
1 | L0002   | OTIS         | K6NC0633| 1600 კგ| 13     |0861-26| 55044   |147664.18
```

---

## Observations & Notes

1. **FILTER Formulas**
   - Uses modern Excel (Office 365) dynamic array functions
   - `_xlfn` prefix indicates extended functions
   - Will work in Excel 365, but may show #NAME! error in older versions
   - LibreOffice Calc won't support FILTER; would need conversion to VLOOKUP or similar

2. **Placeholder ID: 46169**
   - Appears to be a test project ID (possibly serial timestamp)
   - Must be replaced with actual project UUID for each export
   - All 8 FILTER formulas in row 17 reference this ID

3. **Auto-Numbering Feature**
   - Row numbers in column C are intelligent: only show when data exists
   - Allows flexible data entry without manual renumbering

4. **Professional Design**
   - Georgian text throughout (proper localization)
   - Proper merged cells for title and footer
   - Includes totals row (SUM formulas)
   - VAT explanation included
   - Signature block layout (parties & signature lines)

5. **Sheet Dependencies**
   - Template assumes "Jobs" sheet exists with proper column structure
   - If Jobs sheet is missing or has wrong columns, formulas will fail
   - May need validation during export to ensure Jobs sheet integrity

---

## Recommendations

### For Immediate Export Enhancement
1. Create a template loader utility
2. Implement placeholder replacement for project ID
3. Test FILTER formulas evaluate correctly in target Excel version
4. Validate Jobs sheet structure before export

### For Future Improvements
1. Support multiple template variations (report types)
2. Add template editor UI for non-technical users
3. Implement conditional formatting (e.g., color rows by status)
4. Add export options: Keep formulas vs. Convert to values
5. Support template localization (English, Russian, etc.)
