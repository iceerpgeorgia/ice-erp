import re

# Read the file
with open(r'c:\next-postgres-starter\components\figma\projects-table.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix table body rendering - replace all the column cell rendering
# Find the TableBody section and replace cell rendering
table_body_pattern = r'<TableBody>.*?paginatedProjects\.map\(\(Project\) => \(.*?</TableRow>\s*\)\)\}\s*</TableBody>'

table_body_replacement = '''<TableBody>
              {paginatedProjects.map((project) => (
                <TableRow key={project.id} className="hover:bg-muted/50 transition-colors">
                  {visibleColumns.map((column) => (
                    <TableCell
                      key={column.key}
                      className={`${getResponsiveClass(column.responsive)} relative bg-white`}
                      style={{ width: column.width }}
                    >
                      <div className="py-1 overflow-hidden text-ellipsis whitespace-nowrap">
                        {column.key === 'id' ? (
                          <span className="text-sm">{project.id}</span>
                        ) : column.key === 'createdAt' ? (
                          <span className="text-sm">{new Date(project.createdAt).toLocaleDateString()}</span>
                        ) : column.key === 'updatedAt' ? (
                          <span className="text-sm">{new Date(project.updatedAt).toLocaleDateString()}</span>
                        ) : column.key === 'projectUuid' ? (
                          <span className="text-sm">{project.projectUuid}</span>
                        ) : column.key === 'projectName' ? (
                          <span className="text-sm font-medium">{project.projectName}</span>
                        ) : column.key === 'date' ? (
                          <span className="text-sm">{new Date(project.date).toLocaleDateString()}</span>
                        ) : column.key === 'value' ? (
                          <span className="text-sm">{Number(project.value).toLocaleString()}</span>
                        ) : column.key === 'oris1630' ? (
                          <span className="text-sm">{project.oris1630 || '-'}</span>
                        ) : column.key === 'counteragent' ? (
                          <span className="text-sm">{project.counteragent || '-'}</span>
                        ) : column.key === 'financialCode' ? (
                          <span className="text-sm">{project.financialCode || '-'}</span>
                        ) : column.key === 'currency' ? (
                          <span className="text-sm">{project.currency || '-'}</span>
                        ) : column.key === 'state' ? (
                          <span className="text-sm">{project.state || '-'}</span>
                        ) : column.key === 'contractNo' ? (
                          <span className="text-sm">{project.contractNo || '-'}</span>
                        ) : column.key === 'projectIndex' ? (
                          <span className="text-sm">{project.projectIndex || '-'}</span>
                        ) : column.key === 'counteragentUuid' ? (
                          <span className="text-sm">{project.counteragentUuid}</span>
                        ) : column.key === 'financialCodeUuid' ? (
                          <span className="text-sm">{project.financialCodeUuid}</span>
                        ) : column.key === 'currencyUuid' ? (
                          <span className="text-sm">{project.currencyUuid}</span>
                        ) : column.key === 'stateUuid' ? (
                          <span className="text-sm">{project.stateUuid}</span>
                        ) : column.key === 'employees' ? (
                          <span className="text-sm">
                            {project.employees && project.employees.length > 0 
                              ? project.employees.map(e => e.employeeName).join(', ')
                              : '-'}
                          </span>
                        ) : (
                          <span className="text-sm">-</span>
                        )}
                      </div>
                    </TableCell>
                  ))}
                  <TableCell className="w-24">
                    <div className="flex items-center space-x-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => startEdit(project)}
                        className="h-7 w-7 p-0"
                        title="Edit project"
                      >
                        <Edit2 className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => viewAuditLog(project)}
                        className="h-7 w-7 p-0"
                        title="View audit history"
                      >
                        <Info className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>'''

content = re.sub(table_body_pattern, table_body_replacement, content, flags=re.DOTALL)

# Fix empty state
content = content.replace('{sortedEntityTypes.length === 0', '{sortedProjects.length === 0')
content = content.replace('No entityTypes found', 'No projects found')
content = content.replace('No entityTypes added yet', 'No projects added yet')
content = content.replace('Get started by adding your first Project', 'Get started by adding your first project')

# Fix audit dialog description
content = content.replace(
    'Change history for {editingEntityType?.name} (ID: {editingEntityType?.id})',
    'Change history for {editingProject?.projectName} (ID: {editingProject?.id})'
)

# Save the file
with open(r'c:\next-postgres-starter\components\figma\projects-table.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Table rendering fixed")
