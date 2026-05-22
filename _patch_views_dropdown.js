/**
 * Patch: projects-report views → dropdown + localStorage persistence
 */
const fs = require('fs');
const path = require('path');

function patch(fp, ...replacements) {
  let src = fs.readFileSync(fp, 'utf8').replace(/\r\n/g, '\n');
  const orig = src;
  for (const [oldStr, newStr, label] of replacements) {
    const count = src.split(oldStr).length - 1;
    if (count === 0) { console.error(`❌ NOT FOUND: ${label}`); process.exit(1); }
    if (count > 1)  { console.error(`❌ AMBIGUOUS (${count}): ${label}`); process.exit(1); }
    src = src.replace(oldStr, newStr);
    console.log(`  ✓ ${label}`);
  }
  fs.writeFileSync(fp, src, 'utf8');
  console.log(`✅ Patched ${path.basename(fp)} (${src.length - orig.length > 0 ? '+' : ''}${src.length - orig.length} chars)\n`);
}

patch(
  'components/figma/projects-report-table.tsx',

  // 1. Add Check + LayoutGrid to lucide imports
  [
    `import { BookmarkPlus, ChevronDown, ChevronRight, Download, Filter, Pencil, Plus, RefreshCw, Search, Settings, X } from 'lucide-react';`,
    `import { BookmarkPlus, Check, ChevronDown, ChevronRight, Download, Filter, LayoutGrid, Pencil, Plus, RefreshCw, Search, Settings, X } from 'lucide-react';`,
    'Add Check + LayoutGrid icons',
  ],

  // 2. Add viewsDropdownOpen state after newViewOpen
  [
    `  const [newViewName, setNewViewName] = useState('');
  const [newViewOpen, setNewViewOpen] = useState(false);`,
    `  const [newViewName, setNewViewName] = useState('');
  const [newViewOpen, setNewViewOpen] = useState(false);
  const [viewsDropdownOpen, setViewsDropdownOpen] = useState(false);`,
    'Add viewsDropdownOpen state',
  ],

  // 3. loadViews: prefer localStorage-saved UUID over default
  [
    `        setViews(data);
        const defaultView = data.find((v) => v.isDefault) ?? data[0];
        if (defaultView) {
          setActiveViewUuid(defaultView.uuid);
          applyViewConfig(defaultView.config);
        }`,
    `        setViews(data);
        const savedUuid = typeof window !== 'undefined' ? localStorage.getItem('projectsReportActiveView') : null;
        const savedView = savedUuid ? data.find((v) => v.uuid === savedUuid) : null;
        const viewToLoad = savedView ?? data.find((v) => v.isDefault) ?? data[0];
        if (viewToLoad) {
          setActiveViewUuid(viewToLoad.uuid);
          applyViewConfig(viewToLoad.config);
        }`,
    'loadViews: restore last selected view from localStorage',
  ],

  // 4. Persist activeViewUuid to localStorage (insert before showTaxMultiplier effects)
  [
    `  useEffect(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('projectsReportTaxMult') === 'true') {`,
    `  useEffect(() => {
    if (activeViewUuid && typeof window !== 'undefined') {
      localStorage.setItem('projectsReportActiveView', activeViewUuid);
    }
  }, [activeViewUuid]);

  useEffect(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('projectsReportTaxMult') === 'true') {`,
    'Persist activeViewUuid to localStorage',
  ],

  // 5. Replace the entire Views bar (pills UI) with a dropdown
  [
    `      {/* ── Views bar ── */}
      {views.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap min-h-[32px]">
          <span className="text-xs text-gray-400 font-medium shrink-0">Views:</span>
          {views.map((view) => {
            const isActive = view.uuid === activeViewUuid;
            const isRenaming = renamingViewUuid === view.uuid;
            return (
              <div key={view.uuid} className={\`flex items-center gap-0.5 rounded-full border text-xs font-medium px-2.5 py-0.5 cursor-pointer select-none \${isActive ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-gray-300 text-gray-600 hover:border-gray-400 hover:bg-gray-50'}\`}>
                {isRenaming ? (
                  <input
                    autoFocus
                    className="bg-transparent outline-none w-24 text-xs"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={() => handleRenameView(view.uuid, renameValue)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRenameView(view.uuid, renameValue);
                      if (e.key === 'Escape') setRenamingViewUuid(null);
                    }}
                  />
                ) : (
                  <span onClick={() => handleSwitchView(view.uuid)}>{view.name}</span>
                )}
                {isActive && !isRenaming && (
                  <button
                    className="ml-1 opacity-70 hover:opacity-100"
                    title="Rename view"
                    onClick={(e) => { e.stopPropagation(); setRenamingViewUuid(view.uuid); setRenameValue(view.name); }}
                  >
                    <Pencil className="h-2.5 w-2.5" />
                  </button>
                )}
                {views.length > 1 && isActive && (
                  <button
                    className="ml-0.5 opacity-70 hover:opacity-100"
                    title="Delete view"
                    onClick={(e) => { e.stopPropagation(); handleDeleteView(view.uuid); }}
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                )}
              </div>
            );
          })}
          {newViewOpen ? (
            <div className="flex items-center gap-1">
              <input
                autoFocus
                className="h-6 px-2 text-xs border border-gray-300 rounded-full outline-none focus:border-blue-400 w-32"
                placeholder="View name…"
                value={newViewName}
                onChange={(e) => setNewViewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateView();
                  if (e.key === 'Escape') { setNewViewOpen(false); setNewViewName(''); }
                }}
              />
              <button
                className="h-6 px-2 text-xs bg-blue-600 text-white rounded-full hover:bg-blue-700"
                onClick={handleCreateView}
              >
                Save
              </button>
              <button
                className="h-6 px-2 text-xs text-gray-500 hover:text-gray-700"
                onClick={() => { setNewViewOpen(false); setNewViewName(''); }}
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              className="flex items-center gap-0.5 text-xs text-gray-500 hover:text-blue-600 px-1"
              title="Save current state as a new view"
              onClick={() => setNewViewOpen(true)}
            >
              <BookmarkPlus className="h-3.5 w-3.5" />
              <span>New view</span>
            </button>
          )}
        </div>
      )}
      {views.length === 0 && viewsReady && (
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-400">No saved views.</span>
          {newViewOpen ? (
            <div className="flex items-center gap-1">
              <input
                autoFocus
                className="h-6 px-2 text-xs border border-gray-300 rounded-full outline-none focus:border-blue-400 w-32"
                placeholder="View name…"
                value={newViewName}
                onChange={(e) => setNewViewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateView();
                  if (e.key === 'Escape') { setNewViewOpen(false); setNewViewName(''); }
                }}
              />
              <button
                className="h-6 px-2 text-xs bg-blue-600 text-white rounded-full hover:bg-blue-700"
                onClick={handleCreateView}
              >
                Save
              </button>
              <button
                className="h-6 px-2 text-xs text-gray-500 hover:text-gray-700"
                onClick={() => { setNewViewOpen(false); setNewViewName(''); }}
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              className="flex items-center gap-0.5 text-xs text-blue-600 hover:text-blue-700"
              onClick={() => setNewViewOpen(true)}
            >
              <BookmarkPlus className="h-3.5 w-3.5" />
              <span>Save as view</span>
            </button>
          )}
        </div>
      )}`,
    `      {/* ── Views bar ── */}
      {viewsReady && (
        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              className="flex items-center gap-1.5 h-7 px-2.5 text-xs font-medium border border-gray-300 rounded bg-white hover:bg-gray-50 text-gray-700 select-none"
              onClick={() => setViewsDropdownOpen((v) => !v)}
            >
              <LayoutGrid className="h-3.5 w-3.5 text-gray-400" />
              <span>{views.find((v) => v.uuid === activeViewUuid)?.name ?? 'Views'}</span>
              <ChevronDown className="h-3 w-3 text-gray-400" />
            </button>
            {viewsDropdownOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setViewsDropdownOpen(false)} />
                <div className="absolute left-0 top-8 z-50 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[180px]">
                  {views.map((view) => (
                    <button
                      key={view.uuid}
                      className={\`w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-gray-50 \${view.uuid === activeViewUuid ? 'font-semibold text-blue-600' : 'text-gray-700'}\`}
                      onClick={() => { handleSwitchView(view.uuid); setViewsDropdownOpen(false); }}
                    >
                      {view.uuid === activeViewUuid ? <Check className="h-3 w-3 shrink-0" /> : <span className="w-3 shrink-0" />}
                      {view.name}
                    </button>
                  ))}
                  {views.length === 0 && <p className="px-3 py-1.5 text-xs text-gray-400">No saved views</p>}
                  <div className="border-t border-gray-100 my-1" />
                  {activeViewUuid && (
                    <button
                      className="w-full text-left px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 flex items-center gap-2"
                      onClick={() => {
                        setViewsDropdownOpen(false);
                        const v = views.find((v) => v.uuid === activeViewUuid);
                        if (v) { setRenamingViewUuid(v.uuid); setRenameValue(v.name); }
                      }}
                    >
                      <Pencil className="h-3 w-3" /> Rename
                    </button>
                  )}
                  {views.length > 1 && activeViewUuid && (
                    <button
                      className="w-full text-left px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 flex items-center gap-2"
                      onClick={() => { setViewsDropdownOpen(false); handleDeleteView(activeViewUuid); }}
                    >
                      <X className="h-3 w-3" /> Delete
                    </button>
                  )}
                  <div className="border-t border-gray-100 my-1" />
                  <button
                    className="w-full text-left px-3 py-1.5 text-xs text-blue-600 hover:bg-blue-50 flex items-center gap-2"
                    onClick={() => { setViewsDropdownOpen(false); setNewViewOpen(true); }}
                  >
                    <BookmarkPlus className="h-3 w-3" /> New view
                  </button>
                </div>
              </>
            )}
          </div>
          {renamingViewUuid && (
            <div className="flex items-center gap-1">
              <input
                autoFocus
                className="h-6 px-2 text-xs border border-gray-300 rounded outline-none focus:border-blue-400 w-32"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onBlur={() => handleRenameView(renamingViewUuid, renameValue)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRenameView(renamingViewUuid, renameValue);
                  if (e.key === 'Escape') setRenamingViewUuid(null);
                }}
              />
              <button className="h-6 px-2 text-xs text-gray-500 hover:text-gray-700" onClick={() => setRenamingViewUuid(null)}>Cancel</button>
            </div>
          )}
          {newViewOpen && (
            <div className="flex items-center gap-1">
              <input
                autoFocus
                className="h-6 px-2 text-xs border border-gray-300 rounded outline-none focus:border-blue-400 w-32"
                placeholder="View name\u2026"
                value={newViewName}
                onChange={(e) => setNewViewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateView();
                  if (e.key === 'Escape') { setNewViewOpen(false); setNewViewName(''); }
                }}
              />
              <button className="h-6 px-2 text-xs bg-blue-600 text-white rounded hover:bg-blue-700" onClick={handleCreateView}>Save</button>
              <button className="h-6 px-2 text-xs text-gray-500 hover:text-gray-700" onClick={() => { setNewViewOpen(false); setNewViewName(''); }}>Cancel</button>
            </div>
          )}
        </div>
      )}`,
    'Replace pills views bar with dropdown',
  ],
);

console.log('All patches applied!');
