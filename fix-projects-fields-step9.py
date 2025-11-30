import re

# Read the file
with open(r'c:\next-postgres-starter\components\figma\projects-table.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Define the Edit Dialog form content (same as Add Dialog but with edit- prefixes)
edit_dialog_form = '''<DialogHeader>
                <DialogTitle>Edit Project</DialogTitle>
                <DialogDescription>
                  Update the details for {editingProject?.projectName}. Fields marked with * are required.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                {/* Project Name - mandatory */}
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-projectName" className="text-right">Project Name *</Label>
                  <div className="col-span-3">
                    <Input
                      id="edit-projectName"
                      value={formData.projectName}
                      onChange={(e) => {
                        setFormData({...formData, projectName: e.target.value});
                        if (formErrors.projectName) setFormErrors({...formErrors, projectName: ''});
                      }}
                      className={formErrors.projectName ? 'border-red-500' : ''}
                      placeholder="Only English letters and numbers"
                    />
                    {formErrors.projectName && <p className="text-xs text-red-500 mt-1">{formErrors.projectName}</p>}
                  </div>
                </div>

                {/* Date - mandatory */}
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-date" className="text-right">Date *</Label>
                  <div className="col-span-3">
                    <Input
                      id="edit-date"
                      type="date"
                      value={formData.date}
                      onChange={(e) => {
                        setFormData({...formData, date: e.target.value});
                        if (formErrors.date) setFormErrors({...formErrors, date: ''});
                      }}
                      className={formErrors.date ? 'border-red-500' : ''}
                    />
                    {formErrors.date && <p className="text-xs text-red-500 mt-1">{formErrors.date}</p>}
                  </div>
                </div>

                {/* Value - mandatory */}
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-value" className="text-right">Value *</Label>
                  <div className="col-span-3">
                    <Input
                      id="edit-value"
                      type="number"
                      step="0.01"
                      value={formData.value}
                      onChange={(e) => {
                        setFormData({...formData, value: e.target.value});
                        if (formErrors.value) setFormErrors({...formErrors, value: ''});
                      }}
                      className={formErrors.value ? 'border-red-500' : ''}
                      placeholder="Must be greater than 0"
                    />
                    {formErrors.value && <p className="text-xs text-red-500 mt-1">{formErrors.value}</p>}
                  </div>
                </div>

                {/* ORIS 1630 - optional */}
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-oris1630" className="text-right">ORIS 1630</Label>
                  <div className="col-span-3">
                    <Input
                      id="edit-oris1630"
                      value={formData.oris1630}
                      onChange={(e) => setFormData({...formData, oris1630: e.target.value})}
                    />
                  </div>
                </div>

                {/* Counteragent - mandatory */}
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-counteragent" className="text-right">Counteragent *</Label>
                  <div className="col-span-3">
                    <Combobox
                      options={counteragentsList.map(c => ({ value: c.counteragentUuid, label: c.name, keywords: c.name }))}
                      value={formData.counteragentUuid}
                      onValueChange={(value) => {
                        setFormData({...formData, counteragentUuid: value});
                        if (formErrors.counteragentUuid) setFormErrors({...formErrors, counteragentUuid: ''});
                      }}
                      placeholder="Select counteragent"
                      searchPlaceholder="Search counteragents..."
                      emptyText="No counteragent found."
                      triggerClassName={formErrors.counteragentUuid ? 'border-red-500' : ''}
                    />
                    {formErrors.counteragentUuid && <p className="text-xs text-red-500 mt-1">{formErrors.counteragentUuid}</p>}
                  </div>
                </div>

                {/* Financial Code - mandatory */}
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-financialCode" className="text-right">Financial Code *</Label>
                  <div className="col-span-3">
                    <Combobox
                      options={financialCodesList.map(fc => ({ value: fc.uuid, label: fc.validation, keywords: fc.validation }))}
                      value={formData.financialCodeUuid}
                      onValueChange={(value) => {
                        setFormData({...formData, financialCodeUuid: value});
                        if (formErrors.financialCodeUuid) setFormErrors({...formErrors, financialCodeUuid: ''});
                      }}
                      placeholder="Select financial code"
                      searchPlaceholder="Search financial codes..."
                      emptyText="No financial code found."
                      triggerClassName={formErrors.financialCodeUuid ? 'border-red-500' : ''}
                    />
                    {formErrors.financialCodeUuid && <p className="text-xs text-red-500 mt-1">{formErrors.financialCodeUuid}</p>}
                  </div>
                </div>

                {/* Currency - mandatory */}
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-currency" className="text-right">Currency *</Label>
                  <div className="col-span-3">
                    <Combobox
                      options={currenciesList.map(c => ({ value: c.uuid, label: c.code, keywords: c.code }))}
                      value={formData.currencyUuid}
                      onValueChange={(value) => {
                        setFormData({...formData, currencyUuid: value});
                        if (formErrors.currencyUuid) setFormErrors({...formErrors, currencyUuid: ''});
                      }}
                      placeholder="Select currency"
                      searchPlaceholder="Search currencies..."
                      emptyText="No currency found."
                      triggerClassName={formErrors.currencyUuid ? 'border-red-500' : ''}
                    />
                    {formErrors.currencyUuid && <p className="text-xs text-red-500 mt-1">{formErrors.currencyUuid}</p>}
                  </div>
                </div>

                {/* State - mandatory */}
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-state" className="text-right">State *</Label>
                  <div className="col-span-3">
                    <Combobox
                      options={statesList.map(s => ({ value: s.uuid, label: s.name, keywords: s.name }))}
                      value={formData.stateUuid}
                      onValueChange={(value) => {
                        setFormData({...formData, stateUuid: value});
                        if (formErrors.stateUuid) setFormErrors({...formErrors, stateUuid: ''});
                      }}
                      placeholder="Select state"
                      searchPlaceholder="Search states..."
                      emptyText="No state found."
                      triggerClassName={formErrors.stateUuid ? 'border-red-500' : ''}
                    />
                    {formErrors.stateUuid && <p className="text-xs text-red-500 mt-1">{formErrors.stateUuid}</p>}
                  </div>
                </div>

                {/* Employees - optional, multi-select */}
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">Employees</Label>
                  <div className="col-span-3 space-y-2 max-h-48 overflow-auto border rounded p-2">
                    {employeesList.map((employee) => (
                      <div key={employee.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`edit-employee-${employee.id}`}
                          checked={formData.employees.includes(employee.counteragentUuid)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setFormData({
                                ...formData,
                                employees: [...formData.employees, employee.counteragentUuid]
                              });
                            } else {
                              setFormData({
                                ...formData,
                                employees: formData.employees.filter(e => e !== employee.counteragentUuid)
                              });
                            }
                          }}
                        />
                        <Label htmlFor={`edit-employee-${employee.id}`} className="text-sm cursor-pointer">
                          {employee.name}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={cancelEdit}>Cancel</Button>
                <Button onClick={handleSave}>Update Project</Button>
              </div>'''

# Replace Edit Dialog content
edit_dialog_pattern = r'<Dialog open=\{isEditDialogOpen\}.*?<DialogHeader>\s*<DialogTitle>Edit Project</DialogTitle>.*?</div>\s*</DialogContent>\s*</Dialog>'
edit_dialog_replacement = f'''<Dialog open={{isEditDialogOpen}} onOpenChange={{setIsEditDialogOpen}}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              {edit_dialog_form}
            </DialogContent>
          </Dialog>'''

content = re.sub(edit_dialog_pattern, edit_dialog_replacement, content, flags=re.DOTALL)

print("Edit dialog form replaced")

# Save the file
with open(r'c:\next-postgres-starter\components\figma\projects-table.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Dialog forms fixed - Step 2 (Edit Dialog)")
