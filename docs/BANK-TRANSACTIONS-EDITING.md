# Bank Transactions Inline Editing

## Overview
The Bank Transactions table now supports inline editing for the Description field. Changes are saved immediately and trigger database updates to maintain referential integrity.

## How to Edit
1. Navigate to the Bank Transactions page
2. Click on any Description cell to enter edit mode
3. The cell will highlight with a blue background and show an input field
4. Type your changes
5. Press Enter or click outside the cell to save
6. Press Escape to cancel without saving
7. The page will reload automatically after a successful save to reflect any database trigger updates

## Editable Fields
Currently, only the **Description** field is directly editable.

### Future Enhancement: Reference Fields
Other fields (Counteragent, Project, Financial Code, Payment, Nominal Currency) require lookup dialogs to select from existing records. These will be implemented in a future update. Clicking on these fields will show a message: "Editing reference fields requires a lookup dialog. This feature is coming soon."

## Database Triggers
When you update a transaction, the database automatically applies any relevant triggers to maintain data consistency across related tables. This includes:
- Updating related counteragent associations
- Recalculating project totals
- Updating financial code summaries
- Maintaining payment reconciliation

## Technical Implementation

### API Endpoint
- **Path:** `/api/bank-transactions/[id]`
- **Method:** PATCH
- **Body:** JSON with fields to update
- **Returns:** Updated transaction record

### Example Request
```json
{
  "description": "Updated description text"
}
```

### Supported Update Fields (for future reference field editing)
- `description` (string) - Currently editable
- `counteragent_uuid` (UUID) - Requires lookup dialog
- `project_uuid` (UUID) - Requires lookup dialog
- `financial_code_uuid` (UUID) - Requires lookup dialog
- `payment_uuid` (UUID) - Requires lookup dialog
- `nominal_currency_uuid` (UUID) - Requires lookup dialog
- `date` (DateTime) - Future enhancement
- `correction_date` (DateTime) - Future enhancement

### Component Features
- Visual feedback: Editable cells have hover effect
- Edit mode: Blue background when editing
- Loading state: Input is disabled while saving
- Keyboard shortcuts:
  - Enter: Save changes
  - Escape: Cancel editing
- Auto-reload: Page refreshes after save to show trigger updates

## Testing
1. Click on a description cell in any bank transaction row
2. Change the text
3. Press Enter
4. Verify the page reloads
5. Verify the description is updated
6. Check database logs to see if triggers executed

## Known Limitations
- Only one cell can be edited at a time
- Page reload is required after each edit (to ensure trigger updates are visible)
- Reference fields cannot be edited yet (requires lookup dialog implementation)
- No bulk editing support
- No undo/redo functionality

## Future Enhancements
1. **Lookup Dialogs:** Implement searchable dropdowns for reference fields (counteragent, project, etc.)
2. **Date Pickers:** Add date picker widgets for date fields
3. **Optimistic Updates:** Update UI immediately without page reload, then refresh in background
4. **Bulk Editing:** Select multiple rows and edit fields in batch
5. **Edit History:** Show audit log of changes for each transaction
6. **Validation:** Add client-side validation before saving
7. **Permissions:** Restrict editing based on user roles
