'use client';

import { useEffect, useState, useMemo } from 'react';
import { fetchWithAuth } from '@/lib/auth-client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Plus,
  Edit,
  Trash2,
  Search,
  ChevronDown,
  ChevronRight,
  FileText,
  DollarSign,
  Users as UsersIcon,
  Building2,
  ShieldCheck,
  Settings,
  Receipt,
  Activity,
} from 'lucide-react';
import { PermissionModal } from '@/components/modals/PermissionModal';
import { NotificationModal } from '@/components/ui/notification-modal';

// Icon mapping for resources
const resourceIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  'Documents': FileText,
  'Contracts': FileText,
  'Payments': DollarSign,
  'Payment': DollarSign,
  'Users': UsersIcon,
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
  'Documents': 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30',
  'Contracts': 'text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/30',
  'Payments': 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30',
  'Payment': 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30',
  'Users': 'text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/30',
  'Parties': 'text-cyan-600 dark:text-cyan-400 bg-cyan-100 dark:bg-cyan-900/30',
  'Roles': 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30',
  'Permissions': 'text-pink-600 dark:text-pink-400 bg-pink-100 dark:bg-pink-900/30',
  'Settings': 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-900/30',
  'Invoices': 'text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/30',
  'Invoice': 'text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/30',
  'Analytics': 'text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-900/30',
};

const getResourceIcon = (resource: string) => {
  return resourceIcons[resource] || Settings;
};

const getResourceColor = (resource: string) => {
  return resourceColors[resource] || 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-900/30';
};

const getBorderColor = (resource: string) => {
  const colorMap: Record<string, string> = {
    'Documents': '#3b82f6',
    'Contracts': '#a855f7',
    'Payments': '#22c55e',
    'Payment': '#22c55e',
    'Users': '#f97316',
    'Parties': '#06b6d4',
    'Roles': '#ef4444',
    'Permissions': '#ec4899',
    'Settings': '#6b7280',
    'Invoices': '#eab308',
    'Invoice': '#eab308',
    'Analytics': '#6366f1',
  };
  return colorMap[resource] || '#6b7280';
};

interface Role {
  roleId: string;
  roleName: string;
  roleDescription?: string;
  isSystemRole: boolean;
}

interface Permission {
  permissionId: string;
  permissionName: string;
  resource: string;
  action: string;
  description?: string;
  roleCount: number;
  roles: Role[];
}

export default function PermissionsPage() {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [groupedByResource, setGroupedByResource] = useState<Record<string, Permission[]>>({});
  const [loading, setLoading] = useState(true);
  const [permissionModalOpen, setPermissionModalOpen] = useState(false);
  const [selectedPermission, setSelectedPermission] = useState<Permission | null>(null);
  const [notification, setNotification] = useState<{type: 'success' | 'error' | 'info' | 'warning', title: string, message: string} | null>(null);
  const [deleteConfirmDialog, setDeleteConfirmDialog] = useState<{open: boolean, permission: Permission | null}>({open: false, permission: null});
  const [searchQuery, setSearchQuery] = useState('');
  const [resourceFilter, setResourceFilter] = useState('all');
  const [expandedResources, setExpandedResources] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadPermissions();
  }, []);

  const loadPermissions = async () => {
    try {
      const response = await fetchWithAuth('/api/permissions');
      if (response.ok) {
        const data = await response.json();
        setPermissions(data.permissions || []);
        setGroupedByResource(data.groupedByResource || {});
        // Expand all resources by default
        setExpandedResources(new Set(Object.keys(data.groupedByResource || {})));
      }
    } catch (error) {
      console.error('Error loading permissions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddPermission = () => {
    setSelectedPermission(null);
    setPermissionModalOpen(true);
  };

  const handleEditPermission = (permission: Permission) => {
    setSelectedPermission(permission);
    setPermissionModalOpen(true);
  };

  const handleDeletePermission = (permission: Permission) => {
    setDeleteConfirmDialog({ open: true, permission });
  };

  const confirmDeletePermission = async () => {
    const permission = deleteConfirmDialog.permission;
    if (!permission) return;

    setDeleteConfirmDialog({ open: false, permission: null });

    try {
      const response = await fetchWithAuth(`/api/permissions/${permission.permissionId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setNotification({
          type: 'success',
          title: 'Success',
          message: 'Permission deleted successfully',
        });
        loadPermissions();
      } else {
        let errorMessage = 'Failed to delete permission';
        try {
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const error = await response.json();
            errorMessage = error.error || error.message || errorMessage;
          }
        } catch (parseError) {
          console.error('Error parsing error response:', parseError);
        }
        setNotification({
          type: 'error',
          title: 'Error',
          message: errorMessage,
        });
      }
    } catch (error) {
      console.error('Error deleting permission:', error);
      setNotification({
        type: 'error',
        title: 'Error',
        message: 'Failed to delete permission. Please try again.',
      });
    }
  };

  const toggleResourceExpansion = (resource: string) => {
    const newExpanded = new Set(expandedResources);
    if (newExpanded.has(resource)) {
      newExpanded.delete(resource);
    } else {
      newExpanded.add(resource);
    }
    setExpandedResources(newExpanded);
  };

  // Available resources for filter
  const availableResources = useMemo(() => {
    return Object.keys(groupedByResource).sort();
  }, [groupedByResource]);

  // Filter logic
  const filteredGroupedPermissions = useMemo(() => {
    const filtered: Record<string, Permission[]> = {};

    Object.entries(groupedByResource).forEach(([resource, perms]) => {
      // Resource filter
      if (resourceFilter !== 'all' && resource !== resourceFilter) {
        return;
      }

      // Search filter
      const matchingPerms = perms.filter(perm => {
        if (searchQuery === '') return true;
        const query = searchQuery.toLowerCase();
        return (
          perm.permissionName.toLowerCase().includes(query) ||
          perm.action.toLowerCase().includes(query) ||
          perm.description?.toLowerCase().includes(query) ||
          perm.roles.some(role => role.roleName.toLowerCase().includes(query))
        );
      });

      if (matchingPerms.length > 0) {
        filtered[resource] = matchingPerms;
      }
    });

    return filtered;
  }, [groupedByResource, searchQuery, resourceFilter]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Permissions</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Manage system permissions grouped by resource</p>
        </div>
        <Button size="sm" onClick={handleAddPermission}>
          <Plus className="h-3.5 w-3.5" />
          New Permission
        </Button>
      </div>

      <Card>
        <CardContent className="p-3 space-y-3">
          {/* Search and Filters */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search permissions, actions, or roles..."
                className="pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            {availableResources.length > 0 && (
              <Select value={resourceFilter} onValueChange={setResourceFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Resource" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Resources</SelectItem>
                  {availableResources.map(resource => (
                    <SelectItem key={resource} value={resource}>{resource}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {(searchQuery || resourceFilter !== 'all') && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setSearchQuery('');
                  setResourceFilter('all');
                }}
              >
                Clear
              </Button>
            )}
          </div>

          {/* Grouped Permissions */}
          <div className="space-y-3">
            {Object.keys(filteredGroupedPermissions).length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <ShieldCheck className="h-12 w-12 text-muted-foreground mb-3" />
                <p className="text-sm font-medium text-foreground mb-1">No permissions found</p>
                <p className="text-xs text-muted-foreground">
                  {searchQuery || resourceFilter !== 'all'
                    ? 'Try adjusting your search or filters'
                    : 'Get started by creating a new permission'}
                </p>
              </div>
            ) : (
              Object.entries(filteredGroupedPermissions)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([resource, perms]) => {
                  const isExpanded = expandedResources.has(resource);
                  const ResourceIcon = getResourceIcon(resource);
                  const resourceColorClass = getResourceColor(resource);
                  const borderColor = getBorderColor(resource);

                  return (
                    <Card
                      key={resource}
                      className="overflow-hidden transition-all"
                      style={{ borderLeftWidth: '4px', borderLeftColor: borderColor }}
                    >
                      <CardContent className="p-0">
                        {/* Resource Header */}
                        <button
                          onClick={() => toggleResourceExpansion(resource)}
                          className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            )}
                            <div className={`p-2 rounded-lg ${resourceColorClass}`}>
                              <ResourceIcon className="h-4 w-4" />
                            </div>
                            <div className="text-left">
                              <h3 className="text-sm font-semibold text-foreground">{resource}</h3>
                              <p className="text-xs text-muted-foreground">
                                {perms.length} {perms.length === 1 ? 'permission' : 'permissions'}
                              </p>
                            </div>
                          </div>
                          <Badge variant="secondary" className="text-xs">
                            {perms.length}
                          </Badge>
                        </button>

                        {/* Permissions List */}
                        {isExpanded && (
                          <div className="border-t">
                            {perms.map((permission, index) => (
                              <div
                                key={permission.permissionId}
                                className={`px-4 py-3 hover:bg-muted/30 transition-colors ${
                                  index !== perms.length - 1 ? 'border-b' : ''
                                }`}
                              >
                                <div className="flex items-start justify-between gap-4">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                      <h4 className="text-sm font-medium text-foreground">
                                        {permission.action}
                                      </h4>
                                    </div>
                                    {permission.description && (
                                      <p className="text-xs text-muted-foreground mb-2">
                                        {permission.description}
                                      </p>
                                    )}
                                    <div className="flex flex-wrap items-center gap-1.5">
                                      {permission.roles.length > 0 ? (
                                        <>
                                          <span className="text-xs text-muted-foreground">Roles:</span>
                                          {permission.roles.map((role) => (
                                            <Badge
                                              key={role.roleId}
                                              variant="outline"
                                              className="text-xs"
                                            >
                                              {role.roleName}
                                            </Badge>
                                          ))}
                                        </>
                                      ) : (
                                        <span className="text-xs text-muted-foreground">No roles assigned</span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1 shrink-0">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-8 px-2 text-xs"
                                      onClick={() => handleEditPermission(permission)}
                                    >
                                      <Edit className="h-3 w-3" />
                                    </Button>
                                    {permission.roleCount === 0 && (
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-8 px-2 text-xs text-destructive hover:text-destructive"
                                        onClick={() => handleDeletePermission(permission)}
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })
            )}
          </div>
        </CardContent>
      </Card>

      <PermissionModal
        open={permissionModalOpen}
        onOpenChange={setPermissionModalOpen}
        permission={selectedPermission}
        onSuccess={() => {
          loadPermissions();
        }}
      />

      {/* Delete Confirmation Dialog */}
      {deleteConfirmDialog.permission && (
        <NotificationModal
          open={deleteConfirmDialog.open}
          onOpenChange={(open) => !open && setDeleteConfirmDialog({ open: false, permission: null })}
          type="warning"
          title="Confirm Delete"
          message={`Are you sure you want to delete the permission "${deleteConfirmDialog.permission.permissionName}"? This action cannot be undone.`}
          onConfirm={confirmDeletePermission}
          onCancel={() => setDeleteConfirmDialog({ open: false, permission: null })}
          confirmLabel="Delete"
          cancelLabel="Cancel"
        />
      )}

      {notification && (
        <NotificationModal
          open={!!notification}
          onOpenChange={(open) => !open && setNotification(null)}
          type={notification.type}
          title={notification.title}
          message={notification.message}
        />
      )}
    </div>
  );
}

