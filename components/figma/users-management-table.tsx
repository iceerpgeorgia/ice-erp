'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Download, Shield, Bell, BellOff } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Switch } from '../ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import { Badge } from '../ui/badge';
import { exportRowsToXlsx } from '@/lib/export-xlsx';

type User = {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
  isAuthorized: boolean;
  authorizedAt: Date | null;
  authorizedBy: string | null;
  emailVerified: Date | null;
  paymentNotifications: boolean;
};

type ModuleFeature = {
  uuid: string;
  name: string;
  key: string;
  isActive: boolean;
};

type Module = {
  uuid: string;
  name: string;
  key: string;
  isActive: boolean;
  ModuleFeature: ModuleFeature[];
};

export default function UsersManagementTable() {
  const { data: session } = useSession();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newUser, setNewUser] = useState({ email: '', name: '', role: 'user' });
  const [addingUser, setAddingUser] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  
  // Module access dialog state
  const [showModulesDialog, setShowModulesDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [selectedModules, setSelectedModules] = useState<Set<string>>(new Set());
  const [savingModules, setSavingModules] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/users');
      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExportXlsx = () => {
    if (filteredUsers.length === 0) return;
    setIsExporting(true);
    try {
      const fileName = `users_${new Date().toISOString().slice(0, 10)}.xlsx`;
      exportRowsToXlsx({
        rows: filteredUsers,
        columns: [
          { key: 'name', label: 'Name' },
          { key: 'email', label: 'Email' },
          { key: 'role', label: 'Role' },
          { key: 'isAuthorized', label: 'Authorized' },
          { key: 'authorizedAt', label: 'Authorized At' },
          { key: 'authorizedBy', label: 'Authorized By' },
          { key: 'emailVerified', label: 'Email Verified' },
        ],
        fileName,
        sheetName: 'Users',
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.email) {
      alert('Email is required');
      return;
    }

    setAddingUser(true);
    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser),
      });

      if (response.ok) {
        const createdUser = await response.json();
        setUsers([...users, createdUser]);
        setNewUser({ email: '', name: '', role: 'user' });
        setShowAddForm(false);
        alert('User added successfully!');
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to add user');
      }
    } catch (error) {
      console.error('Failed to add user:', error);
      alert('Failed to add user');
    } finally {
      setAddingUser(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user?')) {
      return;
    }

    try {
      const response = await fetch(`/api/users?id=${userId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setUsers(users.filter(u => u.id !== userId));
        alert('User deleted successfully!');
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to delete user');
      }
    } catch (error) {
      console.error('Failed to delete user:', error);
      alert('Failed to delete user');
    }
  };

  const handleAuthorizationToggle = async (userId: string, currentStatus: boolean) => {
    try {
      const response = await fetch(`/api/users?id=${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isAuthorized: !currentStatus }),
      });

      if (response.ok) {
        const updatedUser = await response.json();
        setUsers(users.map(u => u.id === userId ? updatedUser : u));
      }
    } catch (error) {
      console.error('Failed to update authorization:', error);
      alert('Failed to update user authorization');
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      const response = await fetch(`/api/users?id=${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });

      if (response.ok) {
        const updatedUser = await response.json();
        setUsers(users.map(u => u.id === userId ? updatedUser : u));
      }
    } catch (error) {
      console.error('Failed to update role:', error);
      alert('Failed to update user role');
    }
  };

  const handlePaymentNotificationsToggle = async (userId: string, currentStatus: boolean) => {
    try {
      const response = await fetch(`/api/users?id=${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentNotifications: !currentStatus }),
      });

      if (response.ok) {
        const updatedUser = await response.json();
        setUsers(users.map(u => u.id === userId ? updatedUser : u));
      }
    } catch (error) {
      console.error('Failed to update payment notifications:', error);
      alert('Failed to update payment notifications');
    }
  };

  const handleOpenModulesDialog = async (user: User) => {
    setSelectedUser(user);
    setShowModulesDialog(true);
    
    try {
      // Fetch all modules
      const modulesResponse = await fetch('/api/modules?activeOnly=true');
      if (modulesResponse.ok) {
        const modulesData = await modulesResponse.json();
        setModules(modulesData);
      }
      
      // Fetch user's current permissions
      const permissionsResponse = await fetch(`/api/permissions/users?userId=${user.id}`);
      if (permissionsResponse.ok) {
        const permissions = await permissionsResponse.json();
        // Extract module UUIDs from permissions
        const moduleUuids = new Set<string>(
          permissions
            .map((p: any) => p.moduleFeature?.moduleUuid)
            .filter((uuid: any): uuid is string => Boolean(uuid))
        );
        setSelectedModules(moduleUuids);
      }
    } catch (error) {
      console.error('Failed to load module data:', error);
    }
  };

  const handleToggleModule = (moduleUuid: string) => {
    const newSelected = new Set(selectedModules);
    if (newSelected.has(moduleUuid)) {
      newSelected.delete(moduleUuid);
    } else {
      newSelected.add(moduleUuid);
    }
    setSelectedModules(newSelected);
  };

  const handleSaveModuleAccess = async () => {
    if (!selectedUser) return;
    
    setSavingModules(true);
    try {
      // Grant access to selected modules (this will grant all features of each module)
      const grantPromises = Array.from(selectedModules).map(moduleUuid =>
        fetch('/api/permissions/modules', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: selectedUser.id,
            moduleUuid,
          }),
        })
      );

      // Revoke access to unselected modules
      const revokePromises = modules
        .filter(m => !selectedModules.has(m.uuid))
        .map(m =>
          fetch(`/api/permissions/modules?userId=${selectedUser.id}&moduleUuid=${m.uuid}`, {
            method: 'DELETE',
          })
        );

      await Promise.all([...grantPromises, ...revokePromises]);
      
      setShowModulesDialog(false);
      alert('Module access updated successfully!');
    } catch (error) {
      console.error('Failed to update module access:', error);
      alert('Failed to update module access');
    } finally {
      setSavingModules(false);
    }
  };

  const filteredUsers = users.filter(user =>
    user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (session?.user?.role !== 'system_admin') {
    return (
      <div className="p-8 text-center">
        <p className="text-destructive">Access denied. System Administrator role required.</p>
      </div>
    );
  }

  if (loading) {
    return <div className="p-8 text-center">Loading users...</div>;
  }

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">User Management</h1>
          <p className="text-sm text-muted-foreground">
            Manage user access and roles for the application
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportXlsx}
            disabled={isExporting || filteredUsers.length === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            {isExporting ? 'Exporting...' : 'Export XLSX'}
          </Button>
          <Button onClick={() => setShowAddForm(!showAddForm)}>
            {showAddForm ? 'Cancel' : 'Add User'}
          </Button>
        </div>
      </div>

      {showAddForm && (
        <div className="rounded-md border p-4 bg-muted/50">
          <form onSubmit={handleAddUser} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="user@example.com"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Name (Optional)</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="John Doe"
                  value={newUser.name}
                  onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select
                  value={newUser.role}
                  onValueChange={(value) => setNewUser({ ...newUser, role: value })}
                >
                  <SelectTrigger id="role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="system_admin">System Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button type="submit" disabled={addingUser}>
              {addingUser ? 'Adding...' : 'Add User'}
            </Button>
          </form>
        </div>
      )}

      <div className="flex items-center space-x-2">
        <Input
          placeholder="Search by email or name..."
          value={searchTerm}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Authorized</TableHead>
              <TableHead>Payment Notifications</TableHead>
              <TableHead>Authorized By</TableHead>
              <TableHead>Authorized At</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">{user.email}</TableCell>
                <TableCell>{user.name || '-'}</TableCell>
                <TableCell>
                  <Select
                    value={user.role}
                    onValueChange={(value: string) => handleRoleChange(user.id, value)}
                    disabled={session?.user?.email === user.email}
                  >
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">User</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="system_admin">System Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={user.isAuthorized}
                      onCheckedChange={() => handleAuthorizationToggle(user.id, user.isAuthorized)}
                      disabled={session?.user?.email === user.email}
                    />
                    {user.isAuthorized ? (
                      <Badge variant="default">Authorized</Badge>
                    ) : (
                      <Badge variant="destructive">Unauthorized</Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center space-x-2">
                    {user.paymentNotifications ? (
                      <Bell className="h-4 w-4 text-green-600" />
                    ) : (
                      <BellOff className="h-4 w-4 text-gray-400" />
                    )}
                    <Switch
                      checked={user.paymentNotifications}
                      onCheckedChange={() => handlePaymentNotificationsToggle(user.id, user.paymentNotifications)}
                      disabled={!user.isAuthorized || !user.email}
                    />
                    {user.paymentNotifications ? (
                      <Badge variant="default" className="text-xs">Enabled</Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">
                        {!user.isAuthorized ? 'Requires Authorization' : !user.email ? 'No Email' : 'Disabled'}
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {user.authorizedBy || '-'}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {user.authorizedAt
                    ? new Date(user.authorizedAt).toLocaleDateString()
                    : '-'}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenModulesDialog(user)}
                      disabled={!user.isAuthorized}
                    >
                      <Shield className="h-3 w-3 mr-1" />
                      Modules
                    </Button>
                    {session?.user?.email === user.email ? (
                      <span className="text-xs text-muted-foreground">(You)</span>
                    ) : (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeleteUser(user.id)}
                      >
                        Delete
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="text-sm text-muted-foreground">
        Total users: {filteredUsers.length}
      </div>

      {/* Module Access Dialog */}
      {showModulesDialog && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="mb-4">
              <h2 className="text-xl font-semibold">Module Access</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Select which modules <strong>{selectedUser.name || selectedUser.email}</strong> can access
              </p>
            </div>

            <div className="space-y-3">
              {modules.map((module) => (
                <div
                  key={module.uuid}
                  className="border rounded-lg p-4 hover:bg-gray-50 transition"
                >
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedModules.has(module.uuid)}
                      onChange={() => handleToggleModule(module.uuid)}
                      className="mt-1 h-4 w-4 rounded border-gray-300"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{module.name}</span>
                        <span className="text-xs text-gray-500">({module.key})</span>
                      </div>
                      {module.ModuleFeature.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {module.ModuleFeature.map((feature) => (
                            <span
                              key={feature.uuid}
                              className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded"
                            >
                              {feature.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </label>
                </div>
              ))}

              {modules.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No modules available. Create modules first in the Module Management page.
                </div>
              )}
            </div>

            <div className="flex justify-between items-center mt-6 pt-4 border-t">
              <div className="text-sm text-gray-600">
                {selectedModules.size} module(s) selected
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowModulesDialog(false)}
                  disabled={savingModules}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveModuleAccess}
                  disabled={savingModules}
                >
                  {savingModules ? 'Saving...' : 'Save Access'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
