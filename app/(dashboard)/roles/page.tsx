'use client';

import { useEffect, useState, useMemo } from 'react';
import { fetchWithAuth } from '@/lib/auth-client';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Plus,
  ShieldCheck,
  Edit,
  Trash2,
  Search,
  ChevronDown,
  ChevronRight,
  Grid,
  List,
  FileText,
  DollarSign,
  Users as UsersIcon,
  Building2,
  Settings,
  Receipt,
  Activity
} from 'lucide-react';
import { RoleModal } from '@/components/modals/RoleModal';
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
  createdAt: string;
  userCount: number;
  permissionCount: number;
  permissions: Permission[];
}

export default function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [notification, setNotification] = useState<{type: 'success' | 'error' | 'info' | 'warning', title: string, message: string} | null>(null);
  const [deleteConfirmDialog, setDeleteConfirmDialog] = useState<{open: boolean, role: Role | null}>({open: false, role: null});
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [resourceFilter, setResourceFilter] = useState('all');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');

  useEffect(() => {
    loadRoles();
  }, []);

  const loadRoles = async () => {
    try {
      const response = await fetchWithAuth('/api/roles');
      if (response.ok) {
        const data = await response.json();
        setRoles(data.roles || []);
      }
    } catch (error) {
      console.error('Error loading roles:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddRole = () => {
    setSelectedRole(null);
    setRoleModalOpen(true);
  };

  const handleEditRole = (role: Role) => {
    setSelectedRole(role);
    setRoleModalOpen(true);
  };

  const handleDeleteRole = (role: Role) => {
    setDeleteConfirmDialog({ open: true, role });
  };

  const confirmDeleteRole = async () => {
    const role = deleteConfirmDialog.role;
    if (!role) return;

    setDeleteConfirmDialog({ open: false, role: null });

    try {
      const response = await fetchWithAuth(`/api/roles/${role.roleId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setNotification({
          type: 'success',
          title: 'Success',
          message: 'Role deleted successfully',
        });
        loadRoles();
      } else {
        let errorMessage = 'Failed to delete role';
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
      console.error('Error deleting role:', error);
      setNotification({
        type: 'error',
        title: 'Error',
        message: 'Failed to delete role. Please try again.',
      });
    }
  };

  const toggleRowExpansion = (roleId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(roleId)) {
      newExpanded.delete(roleId);
    } else {
      newExpanded.add(roleId);
    }
    setExpandedRows(newExpanded);
  };

  // Get unique resources from all permissions
  const availableResources = useMemo(() => {
    const resources = new Set<string>();
    roles.forEach(role => {
      role.permissions?.forEach(p => resources.add(p.resource));
    });
    return Array.from(resources).sort();
  }, [roles]);

  // Filter and search logic
  const filteredRoles = useMemo(() => {
    return roles.filter(role => {
      // Search filter
      const matchesSearch = searchQuery === '' ||
        role.roleName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        role.roleDescription?.toLowerCase().includes(searchQuery.toLowerCase());

      // Type filter
      const matchesType = typeFilter === 'all' ||
        (typeFilter === 'system' && role.isSystemRole) ||
        (typeFilter === 'custom' && !role.isSystemRole);

      // Resource filter
      const matchesResource = resourceFilter === 'all' ||
        role.permissions?.some(p => p.resource === resourceFilter);

      return matchesSearch && matchesType && matchesResource;
    });
  }, [roles, searchQuery, typeFilter, resourceFilter]);

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
          <h1 className="text-lg font-semibold text-foreground">Roles</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Manage user roles and permissions</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center border rounded-md">
            <Button
              size="sm"
              variant={viewMode === 'table' ? 'default' : 'ghost'}
              className="rounded-r-none"
              onClick={() => setViewMode('table')}
            >
              <List className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              className="rounded-l-none"
              onClick={() => setViewMode('grid')}
            >
              <Grid className="h-3.5 w-3.5" />
            </Button>
          </div>
          <Button size="sm" onClick={handleAddRole}>
            <Plus className="h-3.5 w-3.5" />
            New Role
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-3 space-y-3">
          {/* Search and Filters */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search roles..."
                className="pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="system">System</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
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
            {(searchQuery || typeFilter !== 'all' || resourceFilter !== 'all') && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setSearchQuery('');
                  setTypeFilter('all');
                  setResourceFilter('all');
                }}
              >
                Clear
              </Button>
            )}
          </div>

          {/* Table View */}
          {viewMode === 'table' && (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs w-12"></TableHead>
                    <TableHead className="text-xs">Role Name</TableHead>
                    <TableHead className="text-xs">Description</TableHead>
                    <TableHead className="text-xs">Type</TableHead>
                    <TableHead className="text-xs">Users</TableHead>
                    <TableHead className="text-xs">Permissions</TableHead>
                    <TableHead className="text-xs">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRoles.map((role) => (
                    <>
                      <TableRow key={role.roleId} className="cursor-pointer hover:bg-muted/50">
                        <TableCell className="py-2.5">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0"
                            onClick={() => toggleRowExpansion(role.roleId)}
                          >
                            {expandedRows.has(role.roleId) ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </Button>
                        </TableCell>
                        <TableCell className="py-2.5" onClick={() => toggleRowExpansion(role.roleId)}>
                          <div className="flex items-center gap-2">
                            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <div className="text-xs font-medium text-foreground">{role.roleName}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="py-2.5 text-xs text-muted-foreground" onClick={() => toggleRowExpansion(role.roleId)}>
                          {role.roleDescription || 'N/A'}
                        </TableCell>
                        <TableCell className="py-2.5" onClick={() => toggleRowExpansion(role.roleId)}>
                          {role.isSystemRole ? (
                            <Badge variant="default" className="text-xs">
                              System
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs">
                              Custom
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="py-2.5 text-xs text-muted-foreground" onClick={() => toggleRowExpansion(role.roleId)}>
                          {role.userCount}
                        </TableCell>
                        <TableCell className="py-2.5 text-xs text-muted-foreground" onClick={() => toggleRowExpansion(role.roleId)}>
                          {role.permissionCount}
                        </TableCell>
                        <TableCell className="py-2.5">
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="px-2 text-xs"
                              onClick={() => handleEditRole(role)}
                            >
                              <Edit className="h-3 w-3 mr-1" />
                              Edit
                            </Button>
                            {!role.isSystemRole && role.userCount === 0 && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="px-2 text-xs text-destructive hover:text-destructive"
                                onClick={() => handleDeleteRole(role)}
                              >
                                <Trash2 className="h-3 w-3 mr-1" />
                                Delete
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                      {expandedRows.has(role.roleId) && (
                        <TableRow>
                          <TableCell colSpan={7} className="bg-muted/30 p-4">
                            <div className="space-y-2">
                              <div className="text-xs font-medium text-foreground">Permissions ({role.permissionCount})</div>
                              {role.permissions && role.permissions.length > 0 ? (
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                                  {role.permissions.map((perm) => {
                                    const PermIcon = getResourceIcon(perm.resource);
                                    const colorClass = getResourceColor(perm.resource);
                                    return (
                                      <Badge key={perm.permissionId} className={`text-xs justify-start ${colorClass}`}>
                                        <PermIcon className="h-3 w-3 mr-1" />
                                        <span className="font-medium">{perm.resource}:</span>
                                        <span className="ml-1">{perm.action}</span>
                                      </Badge>
                                    );
                                  })}
                                </div>
                              ) : (
                                <div className="text-xs text-muted-foreground">No permissions assigned</div>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  ))}
                  {filteredRoles.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="px-6 py-12 text-center">
                        <div className="flex flex-col items-center justify-center">
                          <ShieldCheck className="h-8 w-8 text-muted-foreground mb-2" />
                          <p className="text-xs font-medium text-foreground mb-0.5">No roles found</p>
                          <p className="text-xs text-muted-foreground">
                            {searchQuery || typeFilter !== 'all' || resourceFilter !== 'all'
                              ? 'Try adjusting your filters'
                              : 'Get started by creating a new role'}
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Grid View */}
          {viewMode === 'grid' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredRoles.map((role) => (
                <Card key={role.roleId} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-2 flex-1">
                        <ShieldCheck className="h-5 w-5 text-muted-foreground mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-semibold text-foreground truncate">{role.roleName}</h3>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                            {role.roleDescription || 'No description'}
                          </p>
                        </div>
                      </div>
                      {role.isSystemRole ? (
                        <Badge variant="default" className="text-xs shrink-0">
                          System
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs shrink-0">
                          Custom
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <span className="font-medium text-foreground">{role.userCount}</span>
                        <span>users</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="font-medium text-foreground">{role.permissionCount}</span>
                        <span>permissions</span>
                      </div>
                    </div>

                    {role.permissions && role.permissions.length > 0 && (
                      <div className="space-y-1.5">
                        <div className="text-xs font-medium text-foreground">Permissions</div>
                        <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto">
                          {role.permissions.slice(0, 6).map((perm) => {
                            const PermIcon = getResourceIcon(perm.resource);
                            const colorClass = getResourceColor(perm.resource);
                            return (
                              <Badge key={perm.permissionId} className={`text-xs ${colorClass}`}>
                                <PermIcon className="h-3 w-3 mr-1" />
                                {perm.resource}:{perm.action}
                              </Badge>
                            );
                          })}
                          {role.permissions.length > 6 && (
                            <Badge variant="secondary" className="text-xs">
                              +{role.permissions.length - 6} more
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-2 pt-2 border-t">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 text-xs"
                        onClick={() => handleEditRole(role)}
                      >
                        <Edit className="h-3 w-3 mr-1" />
                        Edit
                      </Button>
                      {!role.isSystemRole && role.userCount === 0 && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 text-xs text-destructive hover:text-destructive"
                          onClick={() => handleDeleteRole(role)}
                        >
                          <Trash2 className="h-3 w-3 mr-1" />
                          Delete
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
              {filteredRoles.length === 0 && (
                <div className="col-span-full px-6 py-12 text-center border rounded-md">
                  <div className="flex flex-col items-center justify-center">
                    <ShieldCheck className="h-8 w-8 text-muted-foreground mb-2" />
                    <p className="text-xs font-medium text-foreground mb-0.5">No roles found</p>
                    <p className="text-xs text-muted-foreground">
                      {searchQuery || typeFilter !== 'all' || resourceFilter !== 'all'
                        ? 'Try adjusting your filters'
                        : 'Get started by creating a new role'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <RoleModal
        open={roleModalOpen}
        onOpenChange={setRoleModalOpen}
        role={selectedRole}
        onSuccess={() => {
          loadRoles();
        }}
      />

      {/* Delete Confirmation Dialog */}
      {deleteConfirmDialog.role && (
        <NotificationModal
          open={deleteConfirmDialog.open}
          onOpenChange={(open) => !open && setDeleteConfirmDialog({ open: false, role: null })}
          type="warning"
          title="Confirm Delete"
          message={`Are you sure you want to delete the role "${deleteConfirmDialog.role.roleName}"? This action cannot be undone.`}
          onConfirm={confirmDeleteRole}
          onCancel={() => setDeleteConfirmDialog({ open: false, role: null })}
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

