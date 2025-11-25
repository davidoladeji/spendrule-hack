'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { fetchWithAuth } from '@/lib/auth-client';
import { NotificationModal } from '@/components/ui/notification-modal';

interface Contract {
  contractId: string;
  contractNumber: string;
  contractTitle: string;
  contractType: string;
  effectiveDate: string;
  expirationDate: string;
  autoRenewalEnabled?: boolean;
  renewalPeriod?: string | null;
  noticePeriodDays?: number | null;
  totalContractValue?: number | null;
  annualValue?: number | null;
  currency: string;
  contractStatus: string;
}

interface ContractModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  contract?: Contract | null;
}

export function ContractModal({ open, onOpenChange, onSuccess, contract }: ContractModalProps) {
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState<{type: 'success' | 'error' | 'info' | 'warning', title: string, message: string} | null>(null);
  const [formData, setFormData] = useState({
    contractNumber: '',
    contractTitle: '',
    contractType: '',
    effectiveDate: '',
    expirationDate: '',
    autoRenewalEnabled: false,
    renewalPeriod: '',
    noticePeriodDays: '',
    totalContractValue: '',
    annualValue: '',
    currency: 'USD',
    contractStatus: 'Draft',
  });

  // Load contract data when editing
  useEffect(() => {
    if (contract && open) {
      setFormData({
        contractNumber: contract.contractNumber || '',
        contractTitle: contract.contractTitle || '',
        contractType: contract.contractType || '',
        effectiveDate: contract.effectiveDate ? new Date(contract.effectiveDate).toISOString().split('T')[0] : '',
        expirationDate: contract.expirationDate ? new Date(contract.expirationDate).toISOString().split('T')[0] : '',
        autoRenewalEnabled: contract.autoRenewalEnabled || false,
        renewalPeriod: contract.renewalPeriod || '',
        noticePeriodDays: contract.noticePeriodDays?.toString() || '',
        totalContractValue: contract.totalContractValue?.toString() || '',
        annualValue: contract.annualValue?.toString() || '',
        currency: contract.currency || 'USD',
        contractStatus: contract.contractStatus || 'Draft',
      });
    } else if (!contract && open) {
      // Reset form for new contract
      setFormData({
        contractNumber: '',
        contractTitle: '',
        contractType: '',
        effectiveDate: '',
        expirationDate: '',
        autoRenewalEnabled: false,
        renewalPeriod: '',
        noticePeriodDays: '',
        totalContractValue: '',
        annualValue: '',
        currency: 'USD',
        contractStatus: 'Draft',
      });
    }
  }, [contract, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const isEdit = !!contract;
      const url = isEdit ? `/api/contracts/${contract.contractId}` : '/api/contracts';
      const method = isEdit ? 'PATCH' : 'POST';

      const response = await fetchWithAuth(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          totalContractValue: formData.totalContractValue ? parseFloat(formData.totalContractValue) : null,
          annualValue: formData.annualValue ? parseFloat(formData.annualValue) : null,
          noticePeriodDays: formData.noticePeriodDays ? parseInt(formData.noticePeriodDays) : null,
          renewalPeriod: formData.renewalPeriod || null,
          autoRenewalEnabled: formData.autoRenewalEnabled,
        }),
      });

      if (response.ok) {
        onOpenChange(false);
        if (!isEdit) {
          setFormData({
            contractNumber: '',
            contractTitle: '',
            contractType: '',
            effectiveDate: '',
            expirationDate: '',
            autoRenewalEnabled: false,
            renewalPeriod: '',
            noticePeriodDays: '',
            totalContractValue: '',
            annualValue: '',
            currency: 'USD',
            contractStatus: 'Draft',
          });
        }
        onSuccess?.();
      } else {
        const error = await response.json();
        setNotification({
          type: 'error',
          title: 'Error',
          message: error.error || `Failed to ${isEdit ? 'update' : 'create'} contract`,
        });
      }
    } catch (error) {
      console.error(`Error ${contract ? 'updating' : 'creating'} contract:`, error);
      setNotification({
        type: 'error',
        title: 'Error',
        message: `Failed to ${contract ? 'update' : 'create'} contract. Please try again.`,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{contract ? 'Edit Contract' : 'Create Contract'}</DialogTitle>
          <DialogDescription>
            {contract ? 'Update contract details' : 'Create a new contract with all required fields'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="contractNumber">Contract Number *</Label>
              <Input
                id="contractNumber"
                value={formData.contractNumber}
                onChange={(e) => setFormData({ ...formData, contractNumber: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contractTitle">Contract Title *</Label>
              <Input
                id="contractTitle"
                value={formData.contractTitle}
                onChange={(e) => setFormData({ ...formData, contractTitle: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="contractType">Contract Type *</Label>
              <Select
                value={formData.contractType}
                onValueChange={(value) => setFormData({ ...formData, contractType: value })}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MSA">MSA</SelectItem>
                  <SelectItem value="SOW">SOW</SelectItem>
                  <SelectItem value="Amendment">Amendment</SelectItem>
                  <SelectItem value="Purchase Order">Purchase Order</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="contractStatus">Status</Label>
              <Select
                value={formData.contractStatus}
                onValueChange={(value) => setFormData({ ...formData, contractStatus: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Draft">Draft</SelectItem>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Expired">Expired</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="effectiveDate">Effective Date *</Label>
              <Input
                id="effectiveDate"
                type="date"
                value={formData.effectiveDate}
                onChange={(e) => setFormData({ ...formData, effectiveDate: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="expirationDate">Expiration Date *</Label>
              <Input
                id="expirationDate"
                type="date"
                value={formData.expirationDate}
                onChange={(e) => setFormData({ ...formData, expirationDate: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
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
            <div className="space-y-2">
              <Label htmlFor="renewalPeriod">Renewal Period</Label>
              <Select
                value={formData.renewalPeriod}
                onValueChange={(value) => setFormData({ ...formData, renewalPeriod: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Monthly">Monthly</SelectItem>
                  <SelectItem value="Quarterly">Quarterly</SelectItem>
                  <SelectItem value="Annually">Annually</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="totalContractValue">Total Contract Value</Label>
              <Input
                id="totalContractValue"
                type="number"
                step="0.01"
                value={formData.totalContractValue}
                onChange={(e) => setFormData({ ...formData, totalContractValue: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="annualValue">Annual Value</Label>
              <Input
                id="annualValue"
                type="number"
                step="0.01"
                value={formData.annualValue}
                onChange={(e) => setFormData({ ...formData, annualValue: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="noticePeriodDays">Notice Period (Days)</Label>
              <Input
                id="noticePeriodDays"
                type="number"
                value={formData.noticePeriodDays}
                onChange={(e) => setFormData({ ...formData, noticePeriodDays: e.target.value })}
              />
            </div>
            <div className="flex items-center space-x-2 pt-8">
              <input
                type="checkbox"
                id="autoRenewalEnabled"
                checked={formData.autoRenewalEnabled}
                onChange={(e) => setFormData({ ...formData, autoRenewalEnabled: e.target.checked })}
                className="h-4 w-4"
              />
              <Label htmlFor="autoRenewalEnabled" className="cursor-pointer">
                Auto-renewal enabled
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (contract ? 'Updating...' : 'Creating...') : (contract ? 'Update Contract' : 'Create Contract')}
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

