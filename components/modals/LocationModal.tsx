'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { fetchWithAuth } from '@/lib/auth-client';
import { NotificationModal } from '@/components/ui/notification-modal';

interface LocationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function LocationModal({ open, onOpenChange, onSuccess }: LocationModalProps) {
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState<{type: 'success' | 'error' | 'info' | 'warning', title: string, message: string} | null>(null);
  const [formData, setFormData] = useState({
    locationCode: '',
    locationName: '',
    locationType: '',
    address: '',
    city: '',
    stateProvince: '',
    postalCode: '',
    countryCode: 'US',
    facilityType: '',
    bedCount: '',
    isActive: true,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetchWithAuth('/api/locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          bedCount: formData.bedCount ? parseInt(formData.bedCount) : undefined,
        }),
      });

      if (response.ok) {
        onOpenChange(false);
        setFormData({
          locationCode: '',
          locationName: '',
          locationType: '',
          address: '',
          city: '',
          stateProvince: '',
          postalCode: '',
          countryCode: 'US',
          facilityType: '',
          bedCount: '',
          isActive: true,
        });
        onSuccess?.();
      } else {
        const error = await response.json();
        setNotification({
          type: 'error',
          title: 'Error',
          message: error.error || 'Failed to create location',
        });
      }
    } catch (error) {
      console.error('Error creating location:', error);
      setNotification({
        type: 'error',
        title: 'Error',
        message: 'Failed to create location. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Location</DialogTitle>
          <DialogDescription>Create a new facility location</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="locationCode">Location Code *</Label>
              <Input
                id="locationCode"
                value={formData.locationCode}
                onChange={(e) => setFormData({ ...formData, locationCode: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="locationName">Location Name *</Label>
              <Input
                id="locationName"
                value={formData.locationName}
                onChange={(e) => setFormData({ ...formData, locationName: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="locationType">Location Type</Label>
              <Select
                value={formData.locationType}
                onValueChange={(value) => setFormData({ ...formData, locationType: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Acute Care">Acute Care</SelectItem>
                  <SelectItem value="Ambulatory">Ambulatory</SelectItem>
                  <SelectItem value="Outpatient">Outpatient</SelectItem>
                  <SelectItem value="Clinic">Clinic</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="facilityType">Facility Type</Label>
              <Select
                value={formData.facilityType}
                onValueChange={(value) => setFormData({ ...formData, facilityType: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Hospital">Hospital</SelectItem>
                  <SelectItem value="Clinic">Clinic</SelectItem>
                  <SelectItem value="Surgery Center">Surgery Center</SelectItem>
                  <SelectItem value="Urgent Care">Urgent Care</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Input
              id="address"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="stateProvince">State/Province</Label>
              <Input
                id="stateProvince"
                value={formData.stateProvince}
                onChange={(e) => setFormData({ ...formData, stateProvince: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="postalCode">Postal Code</Label>
              <Input
                id="postalCode"
                value={formData.postalCode}
                onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="countryCode">Country Code</Label>
              <Input
                id="countryCode"
                value={formData.countryCode}
                onChange={(e) => setFormData({ ...formData, countryCode: e.target.value })}
                maxLength={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bedCount">Bed Count</Label>
              <Input
                id="bedCount"
                type="number"
                value={formData.bedCount}
                onChange={(e) => setFormData({ ...formData, bedCount: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Location'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
      {notification && (
        <NotificationModal
          open={!!notification}
          onOpenChange={(open) => !open && setNotification(null)}
          type={notification.type}
          title={notification.title}
          message={notification.message}
        />
      )}
    </Dialog>
  );
}

