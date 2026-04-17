'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

interface ModuleFeature {
  id: string;
  uuid: string;
  name: string;
  key: string;
  description: string | null;
  featureType: string;
  isActive: boolean;
}

interface Module {
  id: string;
  uuid: string;
  name: string;
  key: string;
  description: string | null;
  icon: string | null;
  route: string | null;
  displayOrder: number;
  isActive: boolean;
  ModuleFeature: ModuleFeature[];
}

export default function ModulesManagementPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [modules, setModules] = useState<Module[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedModule, setSelectedModule] = useState<Module | null>(null);
  const [showModuleModal, setShowModuleModal] = useState(false);
  const [showFeatureModal, setShowFeatureModal] = useState(false);
  const [editingFeature, setEditingFeature] = useState<ModuleFeature | null>(null);
  const [activeOnly, setActiveOnly] = useState(true);

  // Module form state
  const [moduleForm, setModuleForm] = useState({
    name: '',
    key: '',
    description: '',
    icon: '',
    route: '',
    displayOrder: 0,
    isActive: true,
  });

  // Feature form state
  const [featureForm, setFeatureForm] = useState({
    name: '',
    key: '',
    description: '',
    featureType: 'action',
    isActive: true,
  });

  // Check authorization
  useEffect(() => {
    if (status === 'loading') return;
    
    if (!session?.user) {
      router.push('/auth/signin');
      return;
    }

    // @ts-ignore
    if (session.user.role !== 'system_admin' && session.user.role !== 'admin') {
      router.push('/');
      return;
    }
  }, [session, status, router]);

  // Fetch modules
  useEffect(() => {
    fetchModules();
  }, [activeOnly]);

  const fetchModules = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch(`/api/modules?activeOnly=${activeOnly}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch modules');
      }

      const data = await response.json();
      setModules(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateModule = () => {
    setSelectedModule(null);
    setModuleForm({
      name: '',
      key: '',
      description: '',
      icon: '',
      route: '',
      displayOrder: 0,
      isActive: true,
    });
    setShowModuleModal(true);
  };

  const handleEditModule = (module: Module) => {
    setSelectedModule(module);
    setModuleForm({
      name: module.name,
      key: module.key,
      description: module.description || '',
      icon: module.icon || '',
      route: module.route || '',
      displayOrder: module.displayOrder,
      isActive: module.isActive,
    });
    setShowModuleModal(true);
  };

  const handleSaveModule = async () => {
    try {
      const url = selectedModule
        ? `/api/modules?uuid=${selectedModule.uuid}`
        : '/api/modules';
      
      const method = selectedModule ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(moduleForm),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save module');
      }

      setShowModuleModal(false);
      fetchModules();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save module');
    }
  };

  const handleDeleteModule = async (module: Module) => {
    if (!confirm(`Delete module "${module.name}"? This will also delete all its features and permissions.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/modules?uuid=${module.uuid}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete module');
      }

      fetchModules();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete module');
    }
  };

  const handleCreateFeature = (module: Module) => {
    setSelectedModule(module);
    setEditingFeature(null);
    setFeatureForm({
      name: '',
      key: '',
      description: '',
      featureType: 'action',
      isActive: true,
    });
    setShowFeatureModal(true);
  };

  const handleEditFeature = (module: Module, feature: ModuleFeature) => {
    setSelectedModule(module);
    setEditingFeature(feature);
    setFeatureForm({
      name: feature.name,
      key: feature.key,
      description: feature.description || '',
      featureType: feature.featureType,
      isActive: feature.isActive,
    });
    setShowFeatureModal(true);
  };

  const handleSaveFeature = async () => {
    if (!selectedModule) return;

    try {
      const url = editingFeature
        ? `/api/module-features?uuid=${editingFeature.uuid}`
        : '/api/module-features';
      
      const method = editingFeature ? 'PATCH' : 'POST';

      const body = editingFeature
        ? featureForm
        : { ...featureForm, moduleUuid: selectedModule.uuid };

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save feature');
      }

      setShowFeatureModal(false);
      fetchModules();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save feature');
    }
  };

  const handleDeleteFeature = async (feature: ModuleFeature) => {
    if (!confirm(`Delete feature "${feature.name}"?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/module-features?uuid=${feature.uuid}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete feature');
      }

      fetchModules();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete feature');
    }
  };

  if (status === 'loading' || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Module Management</h1>
            <p className="text-gray-600 mt-1">Manage application modules and their features</p>
          </div>
          <button
            onClick={handleCreateModule}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Create Module
          </button>
        </div>

        <div className="mb-4 flex items-center gap-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={activeOnly}
              onChange={(e) => setActiveOnly(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm text-gray-700">Show active only</span>
          </label>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        <div className="space-y-6">
          {modules.map((module) => (
            <div key={module.uuid} className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h2 className="text-xl font-semibold text-gray-900">{module.name}</h2>
                      <span className="text-sm text-gray-500">({module.key})</span>
                      {!module.isActive && (
                        <span className="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded">
                          Inactive
                        </span>
                      )}
                    </div>
                    {module.description && (
                      <p className="text-gray-600 mt-1">{module.description}</p>
                    )}
                    <div className="flex gap-4 mt-2 text-sm text-gray-500">
                      {module.route && <span>Route: {module.route}</span>}
                      {module.icon && <span>Icon: {module.icon}</span>}
                      <span>Order: {module.displayOrder}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEditModule(module)}
                      className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteModule(module)}
                      className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 transition"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-md font-medium text-gray-900">
                      Features ({module.ModuleFeature.length})
                    </h3>
                    <button
                      onClick={() => handleCreateFeature(module)}
                      className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition"
                    >
                      Add Feature
                    </button>
                  </div>
                  
                  {module.ModuleFeature.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {module.ModuleFeature.map((feature) => (
                        <div
                          key={feature.uuid}
                          className="p-3 bg-gray-50 rounded border border-gray-200"
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-gray-900">{feature.name}</span>
                                {!feature.isActive && (
                                  <span className="text-xs px-1 py-0.5 bg-gray-200 text-gray-700 rounded">
                                    Inactive
                                  </span>
                                )}
                              </div>
                              <span className="text-xs text-gray-500">{feature.key}</span>
                              {feature.description && (
                                <p className="text-xs text-gray-600 mt-1">{feature.description}</p>
                              )}
                            </div>
                            <div className="flex gap-1 ml-2">
                              <button
                                onClick={() => handleEditFeature(module, feature)}
                                className="text-xs px-2 py-1 text-blue-600 hover:bg-blue-50 rounded"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteFeature(feature)}
                                className="text-xs px-2 py-1 text-red-600 hover:bg-red-50 rounded"
                              >
                                Del
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-sm">No features yet</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {modules.length === 0 && !isLoading && (
          <div className="text-center py-12 text-gray-500">
            No modules found. Create your first module to get started.
          </div>
        )}
      </div>

      {/* Module Modal */}
      {showModuleModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-semibold mb-4">
              {selectedModule ? 'Edit Module' : 'Create Module'}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Name *</label>
                <input
                  type="text"
                  value={moduleForm.name}
                  onChange={(e) => setModuleForm({ ...moduleForm, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="Bank Transactions"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Key *</label>
                <input
                  type="text"
                  value={moduleForm.key}
                  onChange={(e) => setModuleForm({ ...moduleForm, key: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="bank_transactions"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  value={moduleForm.description}
                  onChange={(e) => setModuleForm({ ...moduleForm, description: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  rows={3}
                  placeholder="Manage bank transactions and statements"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Icon</label>
                  <input
                    type="text"
                    value={moduleForm.icon}
                    onChange={(e) => setModuleForm({ ...moduleForm, icon: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="bank"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Display Order</label>
                  <input
                    type="number"
                    value={moduleForm.displayOrder}
                    onChange={(e) => setModuleForm({ ...moduleForm, displayOrder: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Route</label>
                <input
                  type="text"
                  value={moduleForm.route}
                  onChange={(e) => setModuleForm({ ...moduleForm, route: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="/bank-transactions"
                />
              </div>
              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={moduleForm.isActive}
                    onChange={(e) => setModuleForm({ ...moduleForm, isActive: e.target.checked })}
                    className="rounded"
                  />
                  <span className="text-sm font-medium">Active</span>
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowModuleModal(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveModule}
                className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700"
              >
                {selectedModule ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Feature Modal */}
      {showFeatureModal && selectedModule && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-semibold mb-4">
              {editingFeature ? 'Edit Feature' : 'Create Feature'}
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              Module: <strong>{selectedModule.name}</strong>
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Name *</label>
                <input
                  type="text"
                  value={featureForm.name}
                  onChange={(e) => setFeatureForm({ ...featureForm, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="View Transactions"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Key *</label>
                <input
                  type="text"
                  value={featureForm.key}
                  onChange={(e) => setFeatureForm({ ...featureForm, key: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="view"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  value={featureForm.description}
                  onChange={(e) => setFeatureForm({ ...featureForm, description: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  rows={2}
                  placeholder="View bank transactions"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Feature Type</label>
                <select
                  value={featureForm.featureType}
                  onChange={(e) => setFeatureForm({ ...featureForm, featureType: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="action">Action</option>
                  <option value="view">View</option>
                  <option value="access">Access</option>
                </select>
              </div>
              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={featureForm.isActive}
                    onChange={(e) => setFeatureForm({ ...featureForm, isActive: e.target.checked })}
                    className="rounded"
                  />
                  <span className="text-sm font-medium">Active</span>
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowFeatureModal(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveFeature}
                className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700"
              >
                {editingFeature ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
