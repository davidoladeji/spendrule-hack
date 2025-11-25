'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Circle,
  FileText,
  DollarSign,
  Users,
  Building2,
  ShieldCheck,
  Settings,
  Receipt,
  Activity
} from 'lucide-react';
import { fetchWithAuth } from '@/lib/auth-client';
import { NotificationModal } from '@/components/ui/notification-modal';

// Icon mapping for resources
const resourceIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  'Documents': FileText,
  'Contracts': FileText,
  'Payments': DollarSign,
  'Payment': DollarSign,
  'Users': Users,
  'Parties': Building2,
  'Roles': ShieldCheck,
  'Permissions': ShieldCheck,
  'Settings': Settings,
  'Invoices': Receipt,
  'Invoice': Receipt,
  'Analytics': Activity,
};

// Color mapping for resources
const resourceColors: Record<string, string> = {
  'Documents': 'text-blue-600 dark:text-blue-400',
  'Contracts': 'text-purple-600 dark:text-purple-400',
  'Payments': 'text-green-600 dark:text-green-400',
  'Payment': 'text-green-600 dark:text-green-400',
  'Users': 'text-orange-600 dark:text-orange-400',
  'Parties': 'text-cyan-600 dark:text-cyan-400',
  'Roles': 'text-red-600 dark:text-red-400',
  'Permissions': 'text-pink-600 dark:text-pink-400',
  'Settings': 'text-gray-600 dark:text-gray-400',
  'Invoices': 'text-yellow-600 dark:text-yellow-400',
  'Invoice': 'text-yellow-600 dark:text-yellow-400',
  'Analytics': 'text-indigo-600 dark:text-indigo-400',
};

const getResourceIcon = (resource: string) => {
  return resourceIcons[resource] || Settings;
};

const getResourceColor = (resource: string) => {
  return resourceColors[resource] || 'text-gray-600 dark:text-gray-400';
};

interface Permission {
  permissionId: string;
  permissionName: string;
  resource: string;
  action: string;
  description?: string;
}

interface Role {
  roleId: string;
  roleName: string;
  roleDescription?: string;
  isSystemRole: boolean;
  permissions?: Permission[];
}

interface RoleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  role?: Role | null;
}

export function RoleModal({ open, onOpenChange, onSuccess, role }: RoleModalProps) {
  const [loading, setLoading] = useState(false);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loadingPermissions, setLoadingPermissions] = useState(false);
  const [notification, setNotification] = useState<{type: 'success' | 'error' | 'info' | 'warning', title: string, message: string} | null>(null);
  const [formData, setFormData] = useState({
    roleName: '',
    roleDescription: '',
    isSystemRole: false,
  });
  const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(new Set());
  const [expandedResources, setExpandedResources] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open) {
      loadPermissions();
      if (role) {
        setFormData({
          roleName: role.roleName,
          roleDescription: role.roleDescription || '',
          isSystemRole: role.isSystemRole,
        });
        setSelectedPermissions(new Set(role.permissions?.map(p => p.permissionName) || []));
      } else {
        setFormData({
          roleName: '',
          roleDescription: '',
          isSystemRole: false,
        });
        setSelectedPermissions(new Set());
      }
    }
  }, [open, role]);

  const loadPermissions = async () => {
    setLoadingPermissions(true);
    try {
      const response = await fetchWithAuth('/api/permissions');
      if (response.ok) {
        const data = await response.json();
        setPermissions(data.permissions || []);
      }
    } catch (error) {
      console.error('Error loading permissions:', error);
    } finally {
      setLoadingPermissions(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = {
        ...formData,
        permissions: Array.from(selectedPermissions),
      };

      const url = role ? `/api/roles/${role.roleId}` : '/api/roles';
      const method = role ? 'PUT' : 'POST';

      const response = await fetchWithAuth(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        setNotification({
          type: 'success',
          title: 'Success',
          message: role ? 'Role updated successfully' : 'Role created successfully',
        });
        setTimeout(() => {
          onOpenChange(false);
          setFormData({
            roleName: '',
            roleDescription: '',
            isSystemRole: false,
          });
          setSelectedPermissions(new Set());
          onSuccess?.();
        }, 1000);
      } else {
        const error = await response.json();
        setNotification({
          type: 'error',
          title: 'Error',
          message: error.error || (role ? 'Failed to update role' : 'Failed to create role'),
        });
      }
    } catch (error) {
      console.error('Error saving role:', error);
      setNotification({
        type: 'error',
        title: 'Error',
        message: role ? 'Failed to update role. Please try again.' : 'Failed to create role. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  const togglePermission = (permissionName: string) => {
    const newSelected = new Set(selectedPermissions);
    if (newSelected.has(permissionName)) {
      newSelected.delete(permissionName);
    } else {
      newSelected.add(permissionName);
    }
    setSelectedPermissions(newSelected);
  };

  const toggleResource = (resource: string) => {
    const newExpanded = new Set(expandedResources);
    if (newExpanded.has(resource)) {
      newExpanded.delete(resource);
    } else {
      newExpanded.add(resource);
    }
    setExpandedResources(newExpanded);
  };

  const selectAllInResource = (resource: string) => {
    const resourcePerms = groupedPermissions[resource] || [];
    const newSelected = new Set(selectedPermissions);
    const allSelected = resourcePerms.every(p => newSelected.has(p.permissionName));

    if (allSelected) {
      // Deselect all
      resourcePerms.forEach(p => newSelected.delete(p.permissionName));
    } else {
      // Select all
      resourcePerms.forEach(p => newSelected.add(p.permissionName));
    }
    setSelectedPermissions(newSelected);
  };

  // Group permissions by resource
  const groupedPermissions = permissions.reduce((acc, perm) => {
    if (!acc[perm.resource]) {
      acc[perm.resource] = [];
    }
    acc[perm.resource].push(perm);
    return acc;
  }, {} as Record<string, Permission[]>);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{role ? 'Edit Role' : 'Create Role'}</DialogTitle>
            <DialogDescription>
              {role ? 'Update role details and permissions' : 'Create a new role and assign permissions'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="roleName">Role Name *</Label>
              <Input
                id="roleName"
                value={formData.roleName}
                onChange={(e) => setFormData({ ...formData, roleName: e.target.value })}
                required
                disabled={loading || (role?.isSystemRole && role)}
                placeholder="e.g., Finance Manager"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="roleDescription">Description</Label>
              <Input
                id="roleDescription"
                value={formData.roleDescription}
                onChange={(e) => setFormData({ ...formData, roleDescription: e.target.value })}
                disabled={loading}
                placeholder="Role description"
              />
            </div>

            {!role && (
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="isSystemRole"
                  checked={formData.isSystemRole}
                  onCheckedChange={(checked) => setFormData({ ...formData, isSystemRole: checked === true })}
                  disabled={loading}
                />
                <Label htmlFor="isSystemRole" className="font-normal">
                  System Role (cannot be deleted or modified after creation)
                </Label>
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Permissions</Label>
                <Badge variant="secondary" className="text-xs">
                  {selectedPermissions.size} selected
                </Badge>
              </div>
              <div className="h-[350px] border rounded-md overflow-hidden">
                {loadingPermissions ? (
                  <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                    Loading permissions...
                  </div>
                ) : (
                  <div className="h-full overflow-y-auto">
                    {Object.entries(groupedPermissions).map(([resource, perms]) => {
                      const selectedCount = perms.filter(p => selectedPermissions.has(p.permissionName)).length;
                      const isExpanded = expandedResources.has(resource);
                      const allSelected = perms.length > 0 && selectedCount === perms.length;

                      const ResourceIcon = getResourceIcon(resource);
                      const resourceColor = getResourceColor(resource);

                      return (
                        <div key={resource} className="border-b last:border-b-0">
                          {/* Resource Header */}
                          <div className="bg-muted/30 p-3 flex items-center justify-between hover:bg-muted/50 transition-colors">
                            <button
                              type="button"
                              onClick={() => toggleResource(resource)}
                              className="flex items-center gap-2 flex-1 text-left"
                            >
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                              )}
                              <ResourceIcon className={`h-4 w-4 ${resourceColor}`} />
                              <span className="font-medium text-sm">{resource}</span>
                              <Badge variant="outline" className="text-xs ml-2">
                                {selectedCount}/{perms.length}
                              </Badge>
                            </button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => selectAllInResource(resource)}
                              className="text-xs h-7"
                              disabled={loading}
                            >
                              {allSelected ? (
                                <>
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                  Deselect All
                                </>
                              ) : (
                                <>
                                  <Circle className="h-3 w-3 mr-1" />
                                  Select All
                                </>
                              )}
                            </Button>
                          </div>

                          {/* Permission List */}
                          {isExpanded && (
                            <div className="p-3 space-y-2 bg-background">
                              {perms.map((perm) => (
                                <div key={perm.permissionId} className="flex items-start space-x-2 p-2 rounded-md hover:bg-muted/30 transition-colors">
                                  <Checkbox
                                    id={perm.permissionId}
                                    checked={selectedPermissions.has(perm.permissionName)}
                                    onCheckedChange={() => togglePermission(perm.permissionName)}
                                    disabled={loading}
                                    className="mt-0.5"
                                  />
                                  <Label
                                    htmlFor={perm.permissionId}
                                    className="font-normal cursor-pointer flex-1"
                                  >
                                    <div className="font-medium text-sm">{perm.action}</div>
                                    {perm.description && (
                                      <div className="text-xs text-muted-foreground mt-0.5">{perm.description}</div>
                                    )}
                                  </Label>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading || !formData.roleName}>
                {loading ? 'Saving...' : role ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {notification && (
        <NotificationModal
          open={!!notification}
          onOpenChange={(open) => !open && setNotification(null)}
          type={notification.type}
          title={notification.title}
          message={notification.message}
        />
      )}
    </>
  );
}

