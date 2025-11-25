'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { fetchWithAuth } from '@/lib/auth-client';
import { NotificationModal } from '@/components/ui/notification-modal';

interface Party {
  partyId: string;
  partyType: string;
  legalName: string;
  tradingName?: string;
  partyNumber?: string;
  taxId?: string;
  dunsNumber?: string;
  npiNumber?: string;
  cageCode?: string;
  primaryContactEmail?: string;
  primaryContactPhone?: string;
  partyStatus: string;
}

interface PartyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  party?: Party | null; // For edit mode
}

export function PartyModal({ open, onOpenChange, onSuccess, party }: PartyModalProps) {
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState<{type: 'success' | 'error' | 'info' | 'warning', title: string, message: string} | null>(null);
  const [formData, setFormData] = useState({
    partyType: '',
    legalName: '',
    tradingName: '',
    partyNumber: '',
    taxId: '',
    dunsNumber: '',
    npiNumber: '',
    cageCode: '',
    primaryContactEmail: '',
    primaryContactPhone: '',
    partyStatus: 'Active',
  });

  // Load party data when in edit mode
  useEffect(() => {
    if (open && party) {
      setFormData({
        partyType: party.partyType || '',
        legalName: party.legalName || '',
        tradingName: party.tradingName || '',
        partyNumber: party.partyNumber || '',
        taxId: party.taxId || '',
        dunsNumber: party.dunsNumber || '',
        npiNumber: party.npiNumber || '',
        cageCode: party.cageCode || '',
        primaryContactEmail: party.primaryContactEmail || '',
        primaryContactPhone: party.primaryContactPhone || '',
        partyStatus: party.partyStatus || 'Active',
      });
    } else if (open && !party) {
      // Reset form for create mode
      setFormData({
        partyType: '',
        legalName: '',
        tradingName: '',
        partyNumber: '',
        taxId: '',
        dunsNumber: '',
        npiNumber: '',
        cageCode: '',
        primaryContactEmail: '',
        primaryContactPhone: '',
        partyStatus: 'Active',
      });
    }
  }, [open, party]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const url = party ? `/api/parties/${party.partyId}` : '/api/parties';
      const method = party ? 'PATCH' : 'POST';
      
      // For PATCH, only send fields that can be updated (exclude partyType)
      const payload = party
        ? {
            legalName: formData.legalName,
            tradingName: formData.tradingName || undefined,
            partyNumber: formData.partyNumber || undefined,
            taxId: formData.taxId || undefined,
            dunsNumber: formData.dunsNumber || undefined,
            npiNumber: formData.npiNumber || undefined,
            cageCode: formData.cageCode || undefined,
            primaryContactEmail: formData.primaryContactEmail || undefined,
            primaryContactPhone: formData.primaryContactPhone || undefined,
            partyStatus: formData.partyStatus,
          }
        : formData;

      const response = await fetchWithAuth(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        onOpenChange(false);
        if (!party) {
          // Reset form only for create mode
          setFormData({
            partyType: '',
            legalName: '',
            tradingName: '',
            partyNumber: '',
            taxId: '',
            dunsNumber: '',
            npiNumber: '',
            cageCode: '',
            primaryContactEmail: '',
            primaryContactPhone: '',
            partyStatus: 'Active',
          });
        }
        onSuccess?.();
      } else {
        const error = await response.json();
        setNotification({
          type: 'error',
          title: 'Error',
          message: error.error || `Failed to ${party ? 'update' : 'create'} party`,
        });
      }
    } catch (error) {
      console.error(`Error ${party ? 'updating' : 'creating'} party:`, error);
      setNotification({
        type: 'error',
        title: 'Error',
        message: `Failed to ${party ? 'update' : 'create'} party. Please try again.`,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{party ? 'Edit Party' : 'Add Party'}</DialogTitle>
          <DialogDescription>
            {party ? 'Update party details' : 'Create a new vendor or customer party'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="partyType">Party Type *</Label>
              <Select
                value={formData.partyType}
                onValueChange={(value) => setFormData({ ...formData, partyType: value })}
                required
                disabled={!!party} // Disable in edit mode
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Vendor">Vendor</SelectItem>
                  <SelectItem value="Customer">Customer</SelectItem>
                  <SelectItem value="GPO">GPO</SelectItem>
                  <SelectItem value="Distributor">Distributor</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="partyStatus">Status</Label>
              <Select
                value={formData.partyStatus}
                onValueChange={(value) => setFormData({ ...formData, partyStatus: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="legalName">Legal Name *</Label>
            <Input
              id="legalName"
              value={formData.legalName}
              onChange={(e) => setFormData({ ...formData, legalName: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tradingName">Trading Name</Label>
            <Input
              id="tradingName"
              value={formData.tradingName}
              onChange={(e) => setFormData({ ...formData, tradingName: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="partyNumber">Party Number</Label>
              <Input
                id="partyNumber"
                value={formData.partyNumber}
                onChange={(e) => setFormData({ ...formData, partyNumber: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="taxId">Tax ID</Label>
              <Input
                id="taxId"
                value={formData.taxId}
                onChange={(e) => setFormData({ ...formData, taxId: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dunsNumber">DUNS Number</Label>
              <Input
                id="dunsNumber"
                value={formData.dunsNumber}
                onChange={(e) => setFormData({ ...formData, dunsNumber: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="npiNumber">NPI Number</Label>
              <Input
                id="npiNumber"
                value={formData.npiNumber}
                onChange={(e) => setFormData({ ...formData, npiNumber: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cageCode">CAGE Code</Label>
            <Input
              id="cageCode"
              value={formData.cageCode}
              onChange={(e) => setFormData({ ...formData, cageCode: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="primaryContactEmail">Contact Email</Label>
              <Input
                id="primaryContactEmail"
                type="email"
                value={formData.primaryContactEmail}
                onChange={(e) => setFormData({ ...formData, primaryContactEmail: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="primaryContactPhone">Contact Phone</Label>
              <Input
                id="primaryContactPhone"
                value={formData.primaryContactPhone}
                onChange={(e) => setFormData({ ...formData, primaryContactPhone: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (party ? 'Updating...' : 'Creating...') : (party ? 'Update Party' : 'Create Party')}
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

