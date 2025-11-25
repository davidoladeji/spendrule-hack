'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { fetchWithAuth } from '@/lib/auth-client';
import { NotificationModal } from '@/components/ui/notification-modal';

interface ServiceItemModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  contractId?: string;
}

export function ServiceItemModal({ open, onOpenChange, onSuccess, contractId }: ServiceItemModalProps) {
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState<{type: 'success' | 'error' | 'info' | 'warning', title: string, message: string} | null>(null);
  const [contracts, setContracts] = useState<Array<{ contractId: string; contractNumber: string }>>([]);
  const [formData, setFormData] = useState({
    contractId: contractId || '',
    pricingModelId: '',
    itemName: '',
    itemDescription: '',
    itemCategory: '',
    listPrice: '',
    contractPrice: '',
    priceFloor: '',
    priceCeiling: '',
    allowedVarianceType: '',
    allowedVarianceValue: '',
    primaryUom: '',
    currency: 'USD',
    billingFrequency: '',
    rateType: '',
    sku: '',
    catalogNumber: '',
    glAccount: '',
  });

  useEffect(() => {
    if (open) {
      loadContracts();
      if (contractId) {
        setFormData((prev) => ({ ...prev, contractId }));
      }
    }
  }, [open, contractId]);

  const loadContracts = async () => {
    try {
      const response = await fetchWithAuth('/api/contracts');
      if (response.ok) {
        const data = await response.json();
        setContracts(data.contracts || []);
      }
    } catch (error) {
      console.error('Error loading contracts:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetchWithAuth('/api/service-catalog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          listPrice: parseFloat(formData.listPrice),
          contractPrice: formData.contractPrice ? parseFloat(formData.contractPrice) : undefined,
          priceFloor: formData.priceFloor ? parseFloat(formData.priceFloor) : undefined,
          priceCeiling: formData.priceCeiling ? parseFloat(formData.priceCeiling) : undefined,
          allowedVarianceValue: formData.allowedVarianceValue ? parseFloat(formData.allowedVarianceValue) : undefined,
        }),
      });

      if (response.ok) {
        onOpenChange(false);
        setFormData({
          contractId: contractId || '',
          pricingModelId: '',
          itemName: '',
          itemDescription: '',
          itemCategory: '',
          listPrice: '',
          contractPrice: '',
          priceFloor: '',
          priceCeiling: '',
          allowedVarianceType: '',
          allowedVarianceValue: '',
          primaryUom: '',
          currency: 'USD',
          billingFrequency: '',
          rateType: '',
          sku: '',
          catalogNumber: '',
          glAccount: '',
        });
        onSuccess?.();
      } else {
        const error = await response.json();
        setNotification({
          type: 'error',
          title: 'Error',
          message: error.error || 'Failed to create service item',
        });
      }
    } catch (error) {
      console.error('Error creating service item:', error);
      setNotification({
        type: 'error',
        title: 'Error',
        message: 'Failed to create service item. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Service Item</DialogTitle>
          <DialogDescription>Add a new billable item to the service catalog</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="contractId">Contract *</Label>
            <Select
              value={formData.contractId}
              onValueChange={(value) => setFormData({ ...formData, contractId: value })}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Select contract" />
              </SelectTrigger>
              <SelectContent>
                {contracts.map((contract) => (
                  <SelectItem key={contract.contractId} value={contract.contractId}>
                    {contract.contractNumber}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="itemName">Item Name *</Label>
              <Input
                id="itemName"
                value={formData.itemName}
                onChange={(e) => setFormData({ ...formData, itemName: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sku">SKU</Label>
              <Input
                id="sku"
                value={formData.sku}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="itemDescription">Description</Label>
            <Input
              id="itemDescription"
              value={formData.itemDescription}
              onChange={(e) => setFormData({ ...formData, itemDescription: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="listPrice">List Price *</Label>
              <Input
                id="listPrice"
                type="number"
                step="0.01"
                value={formData.listPrice}
                onChange={(e) => setFormData({ ...formData, listPrice: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contractPrice">Contract Price</Label>
              <Input
                id="contractPrice"
                type="number"
                step="0.01"
                value={formData.contractPrice}
                onChange={(e) => setFormData({ ...formData, contractPrice: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="currency">Currency *</Label>
              <Select
                value={formData.currency}
                onValueChange={(value) => setFormData({ ...formData, currency: value })}
                required
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                  <SelectItem value="GBP">GBP</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="primaryUom">Primary UOM *</Label>
              <Input
                id="primaryUom"
                value={formData.primaryUom}
                onChange={(e) => setFormData({ ...formData, primaryUom: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="catalogNumber">Catalog Number</Label>
              <Input
                id="catalogNumber"
                value={formData.catalogNumber}
                onChange={(e) => setFormData({ ...formData, catalogNumber: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Item'}
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

