'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

interface User {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
  isAuthorized: boolean;
}

interface ModuleFeature {
  id: string;
  uuid: string;
  name: string;
  key: string;
  isActive: boolean;
}

interface Module {
  id: string;
  uuid: string;
  name: string;
  key: string;
  isActive: boolean;
  ModuleFeature: ModuleFeature[];
}

interface UserPermission {
  uuid: string;
  moduleFeature: {
    key: string;
    name: string;
    module: {
      key: string;
      name: string;
    };
  };
}

export default function PermissionsManagementPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [userPermissions, setUserPermissions] = useState<UserPermission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track granted features per module
  const [grantedFeatures, setGrantedFeatures] = useState<Record<string, Set<string>>>({});

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

  // Fetch users and modules
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const [usersRes, modulesRes] = await Promise.all([
          fetch('/api/users'),
          fetch('/api/modules?activeOnly=true'),
        ]);

        if (!usersRes.ok || !modulesRes.ok) {
          throw new Error('Failed to fetch data');
        }

        const usersData = await usersRes.json();
        const modulesData = await modulesRes.json();

        setUsers(usersData.filter((u: User) => u.isAuthorized));
        setModules(modulesData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  // Fetch user permissions when user is selected
  useEffect(() => {
    if (!selectedUser) {
      setUserPermissions([]);
      setGrantedFeatures({});
      return;
    }

    const fetchUserPermissions = async () => {
      try {
        const response = await fetch(`/api/permissions/users?userId=${selectedUser}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch user permissions');
        }

        const data = await response.json();
        setUserPermissions(data);

        // Build granted features map
        const granted: Record<string, Set<string>> = {};
        data.forEach((perm: UserPermission) => {
          const moduleKey = perm.moduleFeature.module.key;
          if (!granted[moduleKey]) {
            granted[moduleKey] = new Set();
          }
          granted[moduleKey].add(perm.moduleFeature.key);
        });

        setGrantedFeatures(granted);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      }
    };

    fetchUserPermissions();
  }, [selectedUser]);

  const toggleFeature = (moduleKey: string, featureKey: string) => {
    setGrantedFeatures((prev) => {
      const newGranted = { ...prev };
      
      if (!newGranted[moduleKey]) {
        newGranted[moduleKey] = new Set();
      }

      const moduleSet = new Set(newGranted[moduleKey]);
      
      if (moduleSet.has(featureKey)) {
        moduleSet.delete(featureKey);
      } else {
        moduleSet.add(featureKey);
      }

      newGranted[moduleKey] = moduleSet;
      return newGranted;
    });
  };

  const toggleModule = async (module: Module) => {
    if (!selectedUser) return;

    const currentGranted = grantedFeatures[module.key] || new Set();
    const allFeatures = module.ModuleFeature.filter((f) => f.isActive);
    const hasAll = allFeatures.every((f) => currentGranted.has(f.key));

    if (hasAll) {
      // Revoke all features
      if (!confirm(`Revoke all permissions for module "${module.name}"?`)) {
        return;
      }

      try {
        const response = await fetch(
          `/api/permissions/modules?userId=${selectedUser}&moduleUuid=${module.uuid}`,
          { method: 'DELETE' }
        );

        if (!response.ok) {
          throw new Error('Failed to revoke module permissions');
        }

        // Update local state
        setGrantedFeatures((prev) => {
          const newGranted = { ...prev };
          newGranted[module.key] = new Set();
          return newGranted;
        });

        alert(`Revoked all permissions for module "${module.name}"`);
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Failed to revoke module permissions');
      }
    } else {
      // Grant all features
      if (!confirm(`Grant all permissions for module "${module.name}"?`)) {
        return;
      }

      try {
        const response = await fetch('/api/permissions/modules', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: selectedUser,
            moduleUuid: module.uuid,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to grant module permissions');
        }

        const result = await response.json();

        // Update local state
        setGrantedFeatures((prev) => {
          const newGranted = { ...prev };
          newGranted[module.key] = new Set(allFeatures.map((f) => f.key));
          return newGranted;
        });

        alert(
          `Granted ${result.summary.granted} permissions, skipped ${result.summary.skipped} already granted`
        );
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Failed to grant module permissions');
      }
    }
  };

  const handleSavePermissions = async () => {
    if (!selectedUser) return;

    try {
      setIsSaving(true);

      // Build list of feature UUIDs to grant
      const featureUuids: string[] = [];
      
      modules.forEach((module) => {
        const granted = grantedFeatures[module.key] || new Set();
        module.ModuleFeature.forEach((feature) => {
          if (feature.isActive && granted.has(feature.key)) {
            featureUuids.push(feature.uuid);
          }
        });
      });

      const response = await fetch('/api/permissions/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedUser,
          permissions: featureUuids,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save permissions');
      }

      alert('Permissions saved successfully!');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save permissions');
    } finally {
      setIsSaving(false);
    }
  };

  const getModuleStatus = (module: Module) => {
    const activeFeatures = module.ModuleFeature.filter((f) => f.isActive);
    if (activeFeatures.length === 0) return { type: 'none', label: 'No Features' };

    const granted = grantedFeatures[module.key] || new Set();
    const grantedCount = activeFeatures.filter((f) => granted.has(f.key)).length;

    if (grantedCount === 0) {
      return { type: 'none', label: 'No Access', color: 'text-gray-500' };
    } else if (grantedCount === activeFeatures.length) {
      return { type: 'full', label: 'Full Access', color: 'text-green-600' };
    } else {
      return {
        type: 'partial',
        label: `Partial (${grantedCount}/${activeFeatures.length})`,
        color: 'text-yellow-600',
      };
    }
  };

  if (status === 'loading' || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  const selectedUserData = users.find((u) => u.id === selectedUser);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex h-screen">
        {/* User List Sidebar */}
        <div className="w-80 bg-white border-r border-gray-200 overflow-y-auto">
          <div className="p-6 border-b">
            <h2 className="text-xl font-semibold text-gray-900">Users</h2>
            <p className="text-sm text-gray-600 mt-1">Select a user to manage permissions</p>
          </div>
          <div className="p-4 space-y-2">
            {users.map((user) => (
              <button
                key={user.id}
                onClick={() => setSelectedUser(user.id)}
                className={`w-full text-left p-3 rounded-lg transition ${
                  selectedUser === user.id
                    ? 'bg-blue-100 border-blue-300'
                    : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                } border`}
              >
                <div className="font-medium text-gray-900">{user.name || 'No Name'}</div>
                <div className="text-sm text-gray-600">{user.email}</div>
                <div className="text-xs text-gray-500 mt-1">Role: {user.role}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Permissions Editor */}
        <div className="flex-1 overflow-y-auto">
          {selectedUser && selectedUserData ? (
            <div className="p-8">
              <div className="mb-6">
                <h1 className="text-3xl font-bold text-gray-900">
                  {selectedUserData.name}'s Permissions
                </h1>
                <p className="text-gray-600 mt-1">{selectedUserData.email}</p>
                <p className="text-sm text-gray-500 mt-1">
                  Role: <strong>{selectedUserData.role}</strong>
                </p>
              </div>

              {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                  {error}
                </div>
              )}

              <div className="mb-6">
                <button
                  onClick={handleSavePermissions}
                  disabled={isSaving}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                >
                  {isSaving ? 'Saving...' : 'Save All Changes'}
                </button>
              </div>

              <div className="space-y-6">
                {modules.map((module) => {
                  const status = getModuleStatus(module);
                  const activeFeatures = module.ModuleFeature.filter((f) => f.isActive);

                  return (
                    <div
                      key={module.uuid}
                      className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <h3 className="text-lg font-semibold text-gray-900">{module.name}</h3>
                            <span className={`text-sm font-medium ${status.color}`}>
                              {status.label}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => toggleModule(module)}
                          className={`px-4 py-2 text-sm rounded-lg transition ${
                            status.type === 'full'
                              ? 'bg-red-100 text-red-700 hover:bg-red-200'
                              : 'bg-green-100 text-green-700 hover:bg-green-200'
                          }`}
                        >
                          {status.type === 'full' ? 'Revoke All' : 'Grant All'}
                        </button>
                      </div>

                      {activeFeatures.length > 0 ? (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                          {activeFeatures.map((feature) => {
                            const isGranted = (grantedFeatures[module.key] || new Set()).has(
                              feature.key
                            );

                            return (
                              <label
                                key={feature.uuid}
                                className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition ${
                                  isGranted
                                    ? 'bg-blue-50 border-blue-300'
                                    : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isGranted}
                                  onChange={() => toggleFeature(module.key, feature.key)}
                                  className="rounded"
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-medium text-gray-900 truncate">
                                    {feature.name}
                                  </div>
                                  <div className="text-xs text-gray-500">{feature.key}</div>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-gray-500 text-sm">No active features in this module</p>
                      )}
                    </div>
                  );
                })}
              </div>

              {modules.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  No modules available. Please create modules first.
                </div>
              )}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className="text-center text-gray-500">
                <svg
                  className="mx-auto h-12 w-12 text-gray-400 mb-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                  />
                </svg>
                <p className="text-lg">Select a user to manage their permissions</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
