'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { fetchWithAuth } from '@/lib/auth-client';
import { NotificationModal } from '@/components/ui/notification-modal';

interface Role {
  roleId: string;
  roleName: string;
  roleDescription?: string;
}

interface Organization {
  organizationId: string;
  name: string;
  type?: string;
}

interface User {
  userId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  organizationId: string;
  isActive: boolean;
  roles?: Role[];
}

interface UserModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  user?: User | null;
}

export function UserModal({ open, onOpenChange, onSuccess, user }: UserModalProps) {
  const [loading, setLoading] = useState(false);
  const [roles, setRoles] = useState<Role[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [notification, setNotification] = useState<{type: 'success' | 'error' | 'info' | 'warning', title: string, message: string} | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    organizationId: '',
    isActive: true,
  });
  const [selectedRoles, setSelectedRoles] = useState<Set<string>>(new Set());
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (open) {
      loadData();
      if (user) {
        setFormData({
          email: user.email,
          password: '', // Don't populate password
          firstName: user.firstName || '',
          lastName: user.lastName || '',
          organizationId: user.organizationId,
          isActive: user.isActive,
        });
        setSelectedRoles(new Set(user.roles?.map(r => r.roleId) || []));
      } else {
        setFormData({
          email: '',
          password: '',
          firstName: '',
          lastName: '',
          organizationId: '',
          isActive: true,
        });
        setSelectedRoles(new Set());
      }
    }
  }, [open, user]);

  const loadData = async () => {
    setLoadingData(true);
    try {
      const [rolesResponse, orgsResponse] = await Promise.all([
        fetchWithAuth('/api/roles'),
        fetchWithAuth('/api/organizations'),
      ]);

      if (rolesResponse.ok) {
        const rolesData = await rolesResponse.json();
        setRoles(rolesData.roles || []);
      }

      if (orgsResponse.ok) {
        const orgsData = await orgsResponse.json();
        setOrganizations(orgsData.organizations || []);
        // Set default organization if creating new user and no org selected
        if (!user && orgsData.organizations?.length === 1) {
          setFormData(prev => ({ ...prev, organizationId: orgsData.organizations[0].organizationId }));
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoadingData(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.email) {
      setNotification({
        type: 'error',
        title: 'Validation Error',
        message: 'Email is required',
      });
      return;
    }

    if (!user && !formData.password) {
      setNotification({
        type: 'error',
        title: 'Validation Error',
        message: 'Password is required for new users',
      });
      return;
    }

    if (formData.password && formData.password.length < 8) {
      setNotification({
        type: 'error',
        title: 'Validation Error',
        message: 'Password must be at least 8 characters',
      });
      return;
    }

    if (selectedRoles.size === 0) {
      setNotification({
        type: 'error',
        title: 'Validation Error',
        message: 'At least one role must be selected',
      });
      return;
    }

    if (!formData.organizationId) {
      setNotification({
        type: 'error',
        title: 'Validation Error',
        message: 'Organization is required',
      });
      return;
    }

    setLoading(true);

    try {
      const payload: any = {
        email: formData.email,
        firstName: formData.firstName || undefined,
        lastName: formData.lastName || undefined,
        organizationId: formData.organizationId,
        roleIds: Array.from(selectedRoles),
        isActive: formData.isActive,
      };

      // Only include password if provided (for new users or password reset)
      if (formData.password) {
        payload.password = formData.password;
      }

      const url = user ? `/api/users/${user.userId}` : '/api/users';
      const method = user ? 'PUT' : 'POST';

      const response = await fetchWithAuth(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        setNotification({
          type: 'success',
          title: user ? 'User Updated' : 'User Created',
          message: user ? 'User has been updated successfully' : 'User has been created successfully',
        });
        setTimeout(() => {
          onSuccess?.();
          onOpenChange(false);
        }, 1500);
      } else {
        const errorData = await response.json();
        setNotification({
          type: 'error',
          title: 'Error',
          message: errorData.error || `Failed to ${user ? 'update' : 'create'} user`,
        });
      }
    } catch (error) {
      console.error(`Error ${user ? 'updating' : 'creating'} user:`, error);
      setNotification({
        type: 'error',
        title: 'Error',
        message: `Failed to ${user ? 'update' : 'create'} user. Please try again.`,
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleRole = (roleId: string) => {
    const newSelected = new Set(selectedRoles);
    if (newSelected.has(roleId)) {
      newSelected.delete(roleId);
    } else {
      newSelected.add(roleId);
    }
    setSelectedRoles(newSelected);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{user ? 'Edit User' : 'Create New User'}</DialogTitle>
            <DialogDescription>
              {user ? 'Update user information and roles' : 'Add a new user to the system'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">
                  Password {user ? '(leave blank to keep current)' : '*'}
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required={!user}
                    disabled={loading}
                    placeholder={user ? 'Leave blank to keep current' : 'Minimum 8 characters'}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </Button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  disabled={loading}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="organizationId">Organization *</Label>
              <Select
                value={formData.organizationId}
                onValueChange={(value) => setFormData({ ...formData, organizationId: value })}
                disabled={loading || loadingData}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select organization" />
                </SelectTrigger>
                <SelectContent>
                  {organizations.map((org) => (
                    <SelectItem key={org.organizationId} value={org.organizationId}>
                      {org.name} {org.type ? `(${org.type})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Roles *</Label>
              <div className="border rounded-md p-3 max-h-48 overflow-y-auto">
                {loadingData ? (
                  <div className="text-sm text-muted-foreground">Loading roles...</div>
                ) : roles.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No roles available</div>
                ) : (
                  <div className="space-y-2">
                    {roles.map((role) => (
                      <div key={role.roleId} className="flex items-center space-x-2">
                        <Checkbox
                          id={`role-${role.roleId}`}
                          checked={selectedRoles.has(role.roleId)}
                          onCheckedChange={() => toggleRole(role.roleId)}
                          disabled={loading}
                        />
                        <Label
                          htmlFor={`role-${role.roleId}`}
                          className="text-sm font-normal cursor-pointer flex-1"
                        >
                          {role.roleName}
                          {role.roleDescription && (
                            <span className="text-xs text-muted-foreground ml-2">
                              - {role.roleDescription}
                            </span>
                          )}
                        </Label>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {selectedRoles.size > 0 && (
                <p className="text-xs text-muted-foreground">
                  {selectedRoles.size} role{selectedRoles.size !== 1 ? 's' : ''} selected
                </p>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="isActive"
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked as boolean })}
                disabled={loading}
              />
              <Label htmlFor="isActive" className="text-sm font-normal cursor-pointer">
                User is active
              </Label>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Saving...' : user ? 'Update User' : 'Create User'}
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

