'use client';

import { useEffect, useState } from 'react';
import { fetchWithAuth } from '@/lib/auth-client';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Users, Edit, Trash2, Key, Search, X } from 'lucide-react';
import { UserModal } from '@/components/modals/UserModal';
import { NotificationModal } from '@/components/ui/notification-modal';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface Role {
  roleId: string;
  roleName: string;
  roleDescription?: string;
}

interface User {
  userId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  isActive: boolean;
  lastLogin?: string;
  createdAt: string;
  roles: Role[];
  organization?: {
    organizationId: string;
    name: string;
  };
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [notification, setNotification] = useState<{type: 'success' | 'error' | 'info' | 'warning', title: string, message: string} | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [activeCount, setActiveCount] = useState(0);
  const [inactiveCount, setInactiveCount] = useState(0);
  const [resetPasswordDialog, setResetPasswordDialog] = useState<{open: boolean, userId: string, email: string}>({open: false, userId: '', email: ''});
  const [newPassword, setNewPassword] = useState('');
  const [resettingPassword, setResettingPassword] = useState(false);
  const [deleteConfirmDialog, setDeleteConfirmDialog] = useState<{open: boolean, user: User | null}>({open: false, user: null});

  useEffect(() => {
    loadUsers();
  }, [page, searchTerm]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '50',
      });
      if (searchTerm) {
        params.append('search', searchTerm);
      }

      const response = await fetchWithAuth(`/api/users?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        console.log('Users API response:', data); // Debug log
        setUsers(data.users || []);
        setTotalPages(data.pagination?.totalPages || 1);
        setTotal(data.pagination?.total || 0);
        setActiveCount(data.counts?.active || 0);
        setInactiveCount(data.counts?.inactive || 0);
      } else {
        const errorData = await response.json();
        console.error('Error loading users:', errorData);
        setNotification({
          type: 'error',
          title: 'Error',
          message: errorData.error || 'Failed to load users',
        });
      }
    } catch (error) {
      console.error('Error loading users:', error);
      setNotification({
        type: 'error',
        title: 'Error',
        message: 'Failed to load users. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = () => {
    setSelectedUser(null);
    setUserModalOpen(true);
  };

  const handleEditUser = (user: User) => {
    setSelectedUser(user);
    setUserModalOpen(true);
  };

  const handleToggleActive = async (user: User) => {
    try {
      const response = await fetchWithAuth(`/api/users/${user.userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !user.isActive }),
      });

      if (response.ok) {
        setNotification({
          type: 'success',
          title: 'Success',
          message: `User ${!user.isActive ? 'activated' : 'deactivated'} successfully`,
        });
        loadUsers();
      } else {
        let errorMessage = 'Failed to update user status';
        try {
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const error = await response.json();
            errorMessage = error.error || error.message || errorMessage;
          } else {
            const text = await response.text();
            errorMessage = text || errorMessage;
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
      console.error('Error toggling user status:', error);
      setNotification({
        type: 'error',
        title: 'Error',
        message: 'Failed to update user status. Please try again.',
      });
    }
  };

  const handleDeleteUser = (user: User) => {
    setDeleteConfirmDialog({ open: true, user });
  };

  const confirmDeleteUser = async () => {
    const user = deleteConfirmDialog.user;
    if (!user) return;

    setDeleteConfirmDialog({ open: false, user: null });

    try {
      const response = await fetchWithAuth(`/api/users/${user.userId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setNotification({
          type: 'success',
          title: 'Success',
          message: 'User deactivated successfully',
        });
        loadUsers();
      } else {
        let errorMessage = 'Failed to deactivate user';
        try {
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const error = await response.json();
            errorMessage = error.error || error.message || errorMessage;
          } else {
            const text = await response.text();
            errorMessage = text || errorMessage;
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
      console.error('Error deactivating user:', error);
      setNotification({
        type: 'error',
        title: 'Error',
        message: 'Failed to deactivate user. Please try again.',
      });
    }
  };

  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 8) {
      setNotification({
        type: 'error',
        title: 'Validation Error',
        message: 'Password must be at least 8 characters',
      });
      return;
    }

    setResettingPassword(true);
    try {
      const response = await fetchWithAuth(`/api/users/${resetPasswordDialog.userId}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword }),
      });

      if (response.ok) {
        setNotification({
          type: 'success',
          title: 'Success',
          message: 'Password reset successfully',
        });
        setResetPasswordDialog({ open: false, userId: '', email: '' });
        setNewPassword('');
        loadUsers();
      } else {
        const error = await response.json();
        setNotification({
          type: 'error',
          title: 'Error',
          message: error.error || 'Failed to reset password',
        });
      }
    } catch (error) {
      console.error('Error resetting password:', error);
      setNotification({
        type: 'error',
        title: 'Error',
        message: 'Failed to reset password. Please try again.',
      });
    } finally {
      setResettingPassword(false);
    }
  };

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
          <h1 className="text-lg font-semibold text-foreground">User Management</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Manage system users and their roles</p>
        </div>
        <Button size="sm" onClick={handleAddUser}>
          <Plus className="h-3.5 w-3.5" />
          New User
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3">
            <div className="text-xs text-muted-foreground">Total Users</div>
            <div className="text-lg font-semibold mt-1">{total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="text-xs text-muted-foreground">Active</div>
            <div className="text-lg font-semibold mt-1 text-green-600">{activeCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="text-xs text-muted-foreground">Inactive</div>
            <div className="text-lg font-semibold mt-1 text-gray-600">{inactiveCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="text-xs text-muted-foreground">Page</div>
            <div className="text-lg font-semibold mt-1">{page} / {totalPages}</div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-3">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by email or name..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              className="pl-8"
            />
            {searchTerm && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1 h-7 w-7 p-0"
                onClick={() => {
                  setSearchTerm('');
                  setPage(1);
                }}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-3">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Email</TableHead>
                  <TableHead className="text-xs">Name</TableHead>
                  <TableHead className="text-xs">Roles</TableHead>
                  <TableHead className="text-xs">Organization</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs">Last Login</TableHead>
                  <TableHead className="text-xs">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.userId}>
                    <TableCell className="py-2.5">
                      <div className="text-xs font-medium text-foreground">{user.email}</div>
                    </TableCell>
                    <TableCell className="py-2.5 text-xs text-muted-foreground">
                      {user.firstName || user.lastName
                        ? `${user.firstName || ''} ${user.lastName || ''}`.trim()
                        : 'N/A'}
                    </TableCell>
                    <TableCell className="py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {user.roles?.slice(0, 2).map((role) => (
                          <Badge key={role.roleId} variant="outline" className="text-xs">
                            {role.roleName}
                          </Badge>
                        ))}
                        {user.roles && user.roles.length > 2 && (
                          <Badge variant="outline" className="text-xs">
                            +{user.roles.length - 2}
                          </Badge>
                        )}
                        {(!user.roles || user.roles.length === 0) && (
                          <span className="text-xs text-muted-foreground">No roles</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="py-2.5 text-xs text-muted-foreground">
                      {user.organization?.name || 'N/A'}
                    </TableCell>
                    <TableCell className="py-2.5">
                      {user.isActive ? (
                        <Badge variant="default" className="text-xs bg-green-600">
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs">
                          Inactive
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="py-2.5 text-xs text-muted-foreground">
                      {user.lastLogin
                        ? new Date(user.lastLogin).toLocaleDateString()
                        : 'Never'}
                    </TableCell>
                    <TableCell className="py-2.5">
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="px-2 text-xs"
                          onClick={() => handleEditUser(user)}
                        >
                          <Edit className="h-3 w-3 mr-1" />
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="px-2 text-xs"
                          onClick={() => setResetPasswordDialog({ open: true, userId: user.userId, email: user.email })}
                        >
                          <Key className="h-3 w-3 mr-1" />
                          Reset
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="px-2 text-xs"
                          onClick={() => handleToggleActive(user)}
                        >
                          {user.isActive ? 'Deactivate' : 'Activate'}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="px-2 text-xs text-destructive hover:text-destructive"
                          onClick={() => handleDeleteUser(user)}
                        >
                          <Trash2 className="h-3 w-3 mr-1" />
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {users.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <Users className="h-8 w-8 text-muted-foreground mb-2" />
                        <p className="text-xs font-medium text-foreground mb-0.5">No users found</p>
                        <p className="text-xs text-muted-foreground">Get started by creating a new user</p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            Previous
          </Button>
          <span className="text-xs text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            Next
          </Button>
        </div>
      )}

      <UserModal
        open={userModalOpen}
        onOpenChange={setUserModalOpen}
        user={selectedUser}
        onSuccess={() => {
          loadUsers();
        }}
      />

      {/* Reset Password Dialog */}
      <Dialog open={resetPasswordDialog.open} onOpenChange={(open) => !open && setResetPasswordDialog({ open: false, userId: '', email: '' })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Set a new password for {resetPasswordDialog.email}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">New Password</label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimum 8 characters"
                disabled={resettingPassword}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setResetPasswordDialog({ open: false, userId: '', email: '' });
                setNewPassword('');
              }}
              disabled={resettingPassword}
            >
              Cancel
            </Button>
            <Button onClick={handleResetPassword} disabled={resettingPassword || !newPassword || newPassword.length < 8}>
              {resettingPassword ? 'Resetting...' : 'Reset Password'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      {deleteConfirmDialog.user && (
        <NotificationModal
          open={deleteConfirmDialog.open}
          onOpenChange={(open) => !open && setDeleteConfirmDialog({ open: false, user: null })}
          type="warning"
          title="Confirm Deactivation"
          message={`Are you sure you want to deactivate the user "${deleteConfirmDialog.user.email}"? This action can be reversed by activating the user again.`}
          onConfirm={confirmDeleteUser}
          onCancel={() => setDeleteConfirmDialog({ open: false, user: null })}
          confirmLabel="Deactivate"
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

