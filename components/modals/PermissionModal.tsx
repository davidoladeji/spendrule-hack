'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { fetchWithAuth } from '@/lib/auth-client';
import { NotificationModal } from '@/components/ui/notification-modal';

interface Permission {
  permissionId: string;
  permissionName: string;
  resource: string;
  action: string;
  description?: string;
}

interface PermissionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  permission?: Permission | null;
}

export function PermissionModal({ open, onOpenChange, onSuccess, permission }: PermissionModalProps) {
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState<{type: 'success' | 'error' | 'info' | 'warning', title: string, message: string} | null>(null);
  const [formData, setFormData] = useState({
    permissionName: '',
    resource: '',
    action: '',
    description: '',
  });

  useEffect(() => {
    if (open) {
      if (permission) {
        setFormData({
          permissionName: permission.permissionName,
          resource: permission.resource,
          action: permission.action,
          description: permission.description || '',
        });
      } else {
        setFormData({
          permissionName: '',
          resource: '',
          action: '',
          description: '',
        });
      }
    }
  }, [open, permission]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const url = permission ? `/api/permissions/${permission.permissionId}` : '/api/permissions';
      const method = permission ? 'PUT' : 'POST';

      const response = await fetchWithAuth(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setNotification({
          type: 'success',
          title: 'Success',
          message: permission ? 'Permission updated successfully' : 'Permission created successfully',
        });
        setTimeout(() => {
          onOpenChange(false);
          setFormData({
            permissionName: '',
            resource: '',
            action: '',
            description: '',
          });
          onSuccess?.();
        }, 1000);
      } else {
        const error = await response.json();
        setNotification({
          type: 'error',
          title: 'Error',
          message: error.error || (permission ? 'Failed to update permission' : 'Failed to create permission'),
        });
      }
    } catch (error) {
      console.error('Error saving permission:', error);
      setNotification({
        type: 'error',
        title: 'Error',
        message: permission ? 'Failed to update permission. Please try again.' : 'Failed to create permission. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{permission ? 'Edit Permission' : 'Create Permission'}</DialogTitle>
            <DialogDescription>
              {permission ? 'Update permission details' : 'Create a new permission'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="permissionName">Permission Name *</Label>
              <Input
                id="permissionName"
                value={formData.permissionName}
                onChange={(e) => setFormData({ ...formData, permissionName: e.target.value })}
                required
                disabled={loading}
                placeholder="e.g., invoices:create"
                pattern="^[a-z]+:[a-z]+$"
                title="Format: resource:action (e.g., invoices:create)"
              />
              <p className="text-xs text-muted-foreground">Format: resource:action (e.g., invoices:create)</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="resource">Resource *</Label>
                <Input
                  id="resource"
                  value={formData.resource}
                  onChange={(e) => setFormData({ ...formData, resource: e.target.value })}
                  required
                  disabled={loading}
                  placeholder="e.g., invoices"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="action">Action *</Label>
                <Input
                  id="action"
                  value={formData.action}
                  onChange={(e) => setFormData({ ...formData, action: e.target.value })}
                  required
                  disabled={loading}
                  placeholder="e.g., create"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                disabled={loading}
                placeholder="Permission description"
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading || !formData.permissionName || !formData.resource || !formData.action}>
                {loading ? 'Saving...' : permission ? 'Update' : 'Create'}
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

