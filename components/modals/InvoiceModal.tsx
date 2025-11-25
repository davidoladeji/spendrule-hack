'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { fetchWithAuth } from '@/lib/auth-client';
import { NotificationModal } from '@/components/ui/notification-modal';

interface Invoice {
  invoiceId: string;
  invoiceNumber?: string;
  invoiceDate: string;
  dueDate?: string;
  vendorPartyId: string;
  customerPartyId?: string;
  contractId?: string;
  grossAmount: number;
  netServiceAmount: number;
  taxAmount?: number;
  currency: string;
  currentStatus: string;
}

interface Party {
  partyId: string;
  legalName: string;
  partyType: string;
}

interface InvoiceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  invoice?: Invoice | null; // For edit mode
}

export function InvoiceModal({ open, onOpenChange, onSuccess, invoice }: InvoiceModalProps) {
  const [loading, setLoading] = useState(false);
  const [loadingParties, setLoadingParties] = useState(false);
  const [notification, setNotification] = useState<{type: 'success' | 'error' | 'info' | 'warning', title: string, message: string} | null>(null);
  const [vendors, setVendors] = useState<Party[]>([]);
  const [customers, setCustomers] = useState<Party[]>([]);
  const [formData, setFormData] = useState({
    invoiceNumber: '',
    invoiceDate: '',
    dueDate: '',
    vendorPartyId: '',
    customerPartyId: '',
    contractId: '',
    netServiceAmount: '',
    taxAmount: '',
    grossAmount: '',
    currency: 'USD',
    currentStatus: 'Pending',
  });

  useEffect(() => {
    if (open) {
      loadParties();
      if (invoice) {
        // Edit mode - populate form
        // Handle date formatting - invoice dates come as strings from API
        const formatDate = (dateStr: string | Date | undefined): string => {
          if (!dateStr) return '';
          const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
          return date.toISOString().split('T')[0];
        };

        setFormData({
          invoiceNumber: invoice.invoiceNumber || '',
          invoiceDate: formatDate(invoice.invoiceDate),
          dueDate: formatDate(invoice.dueDate),
          vendorPartyId: invoice.vendorPartyId || '',
          customerPartyId: invoice.customerPartyId || '',
          contractId: invoice.contractId || '',
          netServiceAmount: typeof invoice.netServiceAmount === 'number' 
            ? invoice.netServiceAmount.toString() 
            : (invoice.netServiceAmount?.toString() || ''),
          taxAmount: invoice.taxAmount 
            ? (typeof invoice.taxAmount === 'number' ? invoice.taxAmount.toString() : invoice.taxAmount.toString())
            : '',
          grossAmount: typeof invoice.grossAmount === 'number'
            ? invoice.grossAmount.toString()
            : (invoice.grossAmount?.toString() || ''),
          currency: invoice.currency || 'USD',
          currentStatus: invoice.currentStatus || 'Pending',
        });
      } else {
        // Create mode - reset form
        setFormData({
          invoiceNumber: '',
          invoiceDate: '',
          dueDate: '',
          vendorPartyId: '',
          customerPartyId: '',
          contractId: '',
          netServiceAmount: '',
          taxAmount: '',
          grossAmount: '',
          currency: 'USD',
          currentStatus: 'Pending',
        });
      }
    }
  }, [open, invoice]);

  const loadParties = async () => {
    setLoadingParties(true);
    try {
      const [vendorsRes, customersRes] = await Promise.all([
        fetchWithAuth('/api/parties?partyType=Vendor'),
        fetchWithAuth('/api/parties?partyType=Customer'),
      ]);

      if (vendorsRes.ok) {
        const vendorsData = await vendorsRes.json();
        setVendors(vendorsData.parties || []);
      }

      if (customersRes.ok) {
        const customersData = await customersRes.json();
        setCustomers(customersData.parties || []);
      }
    } catch (error) {
      console.error('Error loading parties:', error);
    } finally {
      setLoadingParties(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = {
        invoiceNumber: formData.invoiceNumber || undefined,
        invoiceDate: formData.invoiceDate,
        dueDate: formData.dueDate || undefined,
        vendorPartyId: formData.vendorPartyId,
        customerPartyId: formData.customerPartyId || formData.vendorPartyId, // Fallback to vendor if no customer
        contractId: formData.contractId || undefined,
        netServiceAmount: parseFloat(formData.netServiceAmount) || 0,
        taxAmount: formData.taxAmount ? parseFloat(formData.taxAmount) : undefined,
        grossAmount: parseFloat(formData.grossAmount) || 0,
        currency: formData.currency,
        currentStatus: formData.currentStatus,
      };

      const url = invoice ? `/api/invoices/${invoice.invoiceId}` : '/api/invoices';
      const method = invoice ? 'PATCH' : 'POST';

      const response = await fetchWithAuth(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        onOpenChange(false);
        onSuccess?.();
      } else {
        const error = await response.json();
        setNotification({
          type: 'error',
          title: 'Error',
          message: error.error || `Failed to ${invoice ? 'update' : 'create'} invoice`,
        });
      }
    } catch (error) {
      console.error(`Error ${invoice ? 'updating' : 'creating'} invoice:`, error);
      setNotification({
        type: 'error',
        title: 'Error',
        message: `Failed to ${invoice ? 'update' : 'create'} invoice. Please try again.`,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{invoice ? 'Edit Invoice' : 'Create Invoice'}</DialogTitle>
          <DialogDescription>
            {invoice ? 'Update invoice details' : 'Create a new invoice manually'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="invoiceNumber">Invoice Number</Label>
              <Input
                id="invoiceNumber"
                value={formData.invoiceNumber}
                onChange={(e) => setFormData({ ...formData, invoiceNumber: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invoiceDate">Invoice Date *</Label>
              <Input
                id="invoiceDate"
                type="date"
                value={formData.invoiceDate}
                onChange={(e) => setFormData({ ...formData, invoiceDate: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dueDate">Due Date</Label>
              <Input
                id="dueDate"
                type="date"
                value={formData.dueDate}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="currentStatus">Status</Label>
              <Select
                value={formData.currentStatus}
                onValueChange={(value) => setFormData({ ...formData, currentStatus: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Pending">Pending</SelectItem>
                  <SelectItem value="Approved">Approved</SelectItem>
                  <SelectItem value="Rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="vendorPartyId">Vendor *</Label>
              <Select
                value={formData.vendorPartyId}
                onValueChange={(value) => setFormData({ ...formData, vendorPartyId: value })}
                required
                disabled={loadingParties}
              >
                <SelectTrigger>
                  <SelectValue placeholder={loadingParties ? "Loading..." : "Select vendor"} />
                </SelectTrigger>
                <SelectContent>
                  {vendors.map((vendor) => (
                    <SelectItem key={vendor.partyId} value={vendor.partyId}>
                      {vendor.legalName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="customerPartyId">Customer</Label>
              <Select
                value={formData.customerPartyId}
                onValueChange={(value) => setFormData({ ...formData, customerPartyId: value })}
                disabled={loadingParties}
              >
                <SelectTrigger>
                  <SelectValue placeholder={loadingParties ? "Loading..." : "Select customer"} />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((customer) => (
                    <SelectItem key={customer.partyId} value={customer.partyId}>
                      {customer.legalName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="netServiceAmount">Net Service Amount *</Label>
              <Input
                id="netServiceAmount"
                type="number"
                step="0.01"
                value={formData.netServiceAmount}
                onChange={(e) => setFormData({ ...formData, netServiceAmount: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="taxAmount">Tax Amount</Label>
              <Input
                id="taxAmount"
                type="number"
                step="0.01"
                value={formData.taxAmount}
                onChange={(e) => setFormData({ ...formData, taxAmount: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="grossAmount">Gross Amount *</Label>
              <Input
                id="grossAmount"
                type="number"
                step="0.01"
                value={formData.grossAmount}
                onChange={(e) => setFormData({ ...formData, grossAmount: e.target.value })}
                required
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
                  <SelectItem value="CAD">CAD</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (invoice ? 'Updating...' : 'Creating...') : (invoice ? 'Update Invoice' : 'Create Invoice')}
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

