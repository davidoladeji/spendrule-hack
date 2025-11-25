'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { fetchWithAuth } from '@/lib/auth-client';
import { NotificationModal } from '@/components/ui/notification-modal';
import { Plus, Trash2 } from 'lucide-react';

interface PricingModelModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface PricingTier {
  tierSequence: number;
  tierName: string;
  minValue: string;
  maxValue: string;
  rate: string;
}

export function PricingModelModal({ open, onOpenChange, onSuccess }: PricingModelModalProps) {
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState<{type: 'success' | 'error' | 'info' | 'warning', title: string, message: string} | null>(null);
  const [formData, setFormData] = useState({
    modelName: '',
    modelType: '',
    version: '1.0',
    baseRate: '',
    currency: 'USD',
    isActive: true,
  });
  const [tiers, setTiers] = useState<PricingTier[]>([]);

  const addTier = () => {
    setTiers([
      ...tiers,
      {
        tierSequence: tiers.length + 1,
        tierName: '',
        minValue: '',
        maxValue: '',
        rate: '',
      },
    ]);
  };

  const removeTier = (index: number) => {
    setTiers(tiers.filter((_, i) => i !== index).map((t, i) => ({ ...t, tierSequence: i + 1 })));
  };

  const updateTier = (index: number, field: keyof PricingTier, value: string) => {
    const newTiers = [...tiers];
    newTiers[index] = { ...newTiers[index], [field]: value };
    setTiers(newTiers);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetchWithAuth('/api/pricing-models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          baseRate: formData.baseRate ? parseFloat(formData.baseRate) : undefined,
          tiers: tiers.map((tier) => ({
            tierSequence: tier.tierSequence,
            tierName: tier.tierName || undefined,
            minValue: parseFloat(tier.minValue),
            maxValue: tier.maxValue ? parseFloat(tier.maxValue) : undefined,
            rate: parseFloat(tier.rate),
          })),
        }),
      });

      if (response.ok) {
        onOpenChange(false);
        setFormData({
          modelName: '',
          modelType: '',
          version: '1.0',
          baseRate: '',
          currency: 'USD',
          isActive: true,
        });
        setTiers([]);
        onSuccess?.();
      } else {
        const error = await response.json();
        setNotification({
          type: 'error',
          title: 'Error',
          message: error.error || 'Failed to create pricing model',
        });
      }
    } catch (error) {
      console.error('Error creating pricing model:', error);
      setNotification({
        type: 'error',
        title: 'Error',
        message: 'Failed to create pricing model. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Pricing Model</DialogTitle>
          <DialogDescription>Create a new pricing model with tiered rates</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="modelName">Model Name *</Label>
              <Input
                id="modelName"
                value={formData.modelName}
                onChange={(e) => setFormData({ ...formData, modelName: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="modelType">Model Type *</Label>
              <Select
                value={formData.modelType}
                onValueChange={(value) => setFormData({ ...formData, modelType: value })}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Tiered">Tiered</SelectItem>
                  <SelectItem value="Flat">Flat</SelectItem>
                  <SelectItem value="Volume">Volume</SelectItem>
                  <SelectItem value="Percentage">Percentage</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="baseRate">Base Rate</Label>
              <Input
                id="baseRate"
                type="number"
                step="0.01"
                value={formData.baseRate}
                onChange={(e) => setFormData({ ...formData, baseRate: e.target.value })}
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

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Pricing Tiers</Label>
              <Button type="button" size="sm" variant="outline" onClick={addTier}>
                <Plus className="h-3 w-3 mr-1" />
                Add Tier
              </Button>
            </div>
            {tiers.map((tier, index) => (
              <div key={index} className="grid grid-cols-5 gap-2 items-end p-2 border rounded">
                <div className="space-y-1">
                  <Label className="text-xs">Tier Name</Label>
                  <Input
                    value={tier.tierName}
                    onChange={(e) => updateTier(index, 'tierName', e.target.value)}
                    placeholder="Tier name"
                    className="h-8"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Min Value *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={tier.minValue}
                    onChange={(e) => updateTier(index, 'minValue', e.target.value)}
                    required
                    className="h-8"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Max Value</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={tier.maxValue}
                    onChange={(e) => updateTier(index, 'maxValue', e.target.value)}
                    placeholder="∞"
                    className="h-8"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Rate *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={tier.rate}
                    onChange={(e) => updateTier(index, 'rate', e.target.value)}
                    required
                    className="h-8"
                  />
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => removeTier(index)}
                  className="h-8"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Model'}
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

