'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { fetchWithAuth } from '@/lib/auth-client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Plus, Edit, Trash2 } from 'lucide-react';
import { InvoiceUploadModal } from '@/components/modals/InvoiceUploadModal';
import { InvoiceModal } from '@/components/modals/InvoiceModal';
import { NotificationModal } from '@/components/ui/notification-modal';

interface Invoice {
  invoiceId: string;
  invoiceNumber: string;
  invoiceDate: string;
  vendorParty: { legalName: string; partyId?: string };
  grossAmount: number;
  currency: string;
  currentStatus: string;
  validationStatus: string;
}

export default function InvoicesPage() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [validating, setValidating] = useState<string | null>(null);
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [editInvoice, setEditInvoice] = useState<Invoice | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [notification, setNotification] = useState<{type: 'success' | 'error' | 'info' | 'warning', title: string, message: string} | null>(null);

  useEffect(() => {
    loadInvoices();
  }, [filter]);

  const loadInvoices = async () => {
    try {
      const url = filter !== 'all' ? `/api/invoices?status=${filter}` : '/api/invoices';
      const response = await fetchWithAuth(url);
      if (response.ok) {
        const data = await response.json();
        setInvoices(data.invoices || []);
      }
    } catch (error) {
      console.error('Error loading invoices:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleNewInvoice = () => {
    setEditInvoice(null);
    setInvoiceModalOpen(true);
  };

  const handleEditInvoice = (invoice: Invoice) => {
    setEditInvoice(invoice);
    setInvoiceModalOpen(true);
  };

  const handleDeleteInvoice = async (invoiceId: string) => {
    if (!confirm('Are you sure you want to delete this invoice? This action cannot be undone.')) {
      return;
    }

    setDeleting(invoiceId);
    try {
      const response = await fetchWithAuth(`/api/invoices/${invoiceId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setNotification({
          type: 'success',
          title: 'Success',
          message: 'Invoice deleted successfully',
        });
        loadInvoices();
      } else {
        const error = await response.json();
        setNotification({
          type: 'error',
          title: 'Error',
          message: error.error || 'Failed to delete invoice',
        });
      }
    } catch (error) {
      console.error('Error deleting invoice:', error);
      setNotification({
        type: 'error',
        title: 'Error',
        message: 'Failed to delete invoice. Please try again.',
      });
    } finally {
      setDeleting(null);
    }
  };

  const handleValidate = async (invoiceId: string) => {
    setValidating(invoiceId);
    try {
      const response = await fetchWithAuth('/api/validations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId }),
      });
      if (response.ok) {
        loadInvoices();
      } else {
        const error = await response.json();
        console.error('Failed to validate invoice:', error);
        setNotification({
          type: 'error',
          title: 'Validation Error',
          message: error.error || 'Failed to validate invoice. Please try again.',
        });
      }
    } catch (error) {
      console.error('Error validating invoice:', error);
      setNotification({
        type: 'error',
        title: 'Validation Error',
        message: 'Failed to validate invoice. Please try again.',
      });
    } finally {
      setValidating(null);
    }
  };

  const handleRowClick = (invoiceId: string) => {
    // Open L3 panel (navigate to detail page)
    router.push(`/invoices/${invoiceId}`);
  };

  const handleRowDoubleClick = (invoiceId: string) => {
    router.push(`/invoices/${invoiceId}`);
  };

  const formatCurrency = (amount: number, currency: string) => {
    return `${currency} ${amount.toLocaleString()}`;
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
          <h1 className="text-lg font-semibold text-foreground">Invoice Processing Queue</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Review and process invoices</p>
        </div>
        <Button size="sm" onClick={handleNewInvoice}>
          <Plus className="h-3.5 w-3.5" />
          New Invoice
        </Button>
      </div>

      <div className="flex gap-1.5">
        <Button
          size="sm"
          variant={filter === 'all' ? 'default' : 'outline'}
          onClick={() => setFilter('all')}
        >
          All
        </Button>
        <Button
          size="sm"
          variant={filter === 'Pending' ? 'default' : 'outline'}
          onClick={() => setFilter('Pending')}
        >
          Pending
        </Button>
        <Button
          size="sm"
          variant={filter === 'Approved' ? 'default' : 'outline'}
          onClick={() => setFilter('Approved')}
        >
          Approved
        </Button>
      </div>

      <Card>
        <CardContent className="p-3">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Invoice #</TableHead>
                  <TableHead className="text-xs">Vendor</TableHead>
                  <TableHead className="text-xs">Date</TableHead>
                  <TableHead className="text-xs">Amount</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs">Validation</TableHead>
                  <TableHead className="text-xs">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((invoice) => (
                  <TableRow
                    key={invoice.invoiceId}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleRowClick(invoice.invoiceId)}
                    onDoubleClick={() => handleRowDoubleClick(invoice.invoiceId)}
                  >
                    <TableCell className="py-2.5">
                      <Link
                        href={`/invoices/${invoice.invoiceId}`}
                        className="text-xs font-medium text-primary hover:text-primary/80"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {invoice.invoiceNumber || invoice.invoiceId.substring(0, 8)}
                      </Link>
                    </TableCell>
                    <TableCell className="py-2.5">
                      {invoice.vendorParty?.partyId ? (
                        <Link
                          href={`/parties/${invoice.vendorParty.partyId}`}
                          className="text-xs text-primary hover:text-primary/80"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {invoice.vendorParty?.legalName || 'N/A'}
                        </Link>
                      ) : (
                        <span className="text-xs text-muted-foreground">{invoice.vendorParty?.legalName || 'N/A'}</span>
                      )}
                    </TableCell>
                    <TableCell className="py-2.5 text-xs text-muted-foreground">
                      {new Date(invoice.invoiceDate).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </TableCell>
                    <TableCell className="py-2.5 text-xs font-medium">
                      {formatCurrency(invoice.grossAmount, invoice.currency)}
                    </TableCell>
                    <TableCell className="py-2.5">
                      <Badge
                        variant={
                          invoice.currentStatus === 'Approved'
                            ? 'default'
                            : invoice.currentStatus === 'Pending'
                            ? 'secondary'
                            : 'destructive'
                        }
                        className="text-xs"
                      >
                        {invoice.currentStatus}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-2.5">
                      {invoice.validationStatus ? (
                        <Badge
                          variant={invoice.validationStatus === 'Passed' ? 'default' : 'destructive'}
                          className="text-xs"
                        >
                          {invoice.validationStatus}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">Not validated</span>
                      )}
                    </TableCell>
                    <TableCell className="py-2.5">
                      <div className="flex items-center gap-1">
                        {!invoice.validationStatus && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-2 text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleValidate(invoice.invoiceId);
                            }}
                            disabled={validating === invoice.invoiceId}
                          >
                            <RefreshCw
                              className={`h-3 w-3 mr-1 ${validating === invoice.invoiceId ? 'animate-spin' : ''}`}
                            />
                            {validating === invoice.invoiceId ? 'Validating...' : 'Validate'}
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditInvoice(invoice);
                          }}
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2 text-xs text-destructive hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteInvoice(invoice.invoiceId);
                          }}
                          disabled={deleting === invoice.invoiceId}
                        >
                          <Trash2 className={`h-3 w-3 ${deleting === invoice.invoiceId ? 'animate-pulse' : ''}`} />
                        </Button>
                        <Link
                          href={`/invoices/${invoice.invoiceId}`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Button size="sm" variant="ghost" className="h-6 px-2 text-xs">
                            View
                          </Button>
                        </Link>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {invoices.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <p className="text-xs font-medium text-foreground mb-0.5">No invoices found</p>
                        <p className="text-xs text-muted-foreground">Upload documents to create invoices</p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <InvoiceUploadModal
        open={invoiceModalOpen && !editInvoice}
        onOpenChange={(open) => {
          setInvoiceModalOpen(open);
          if (!open) setEditInvoice(null);
        }}
        onSuccess={() => {
          loadInvoices();
        }}
        forceDocumentType="invoice"
      />
      <InvoiceModal
        open={invoiceModalOpen && !!editInvoice}
        onOpenChange={(open) => {
          setInvoiceModalOpen(open);
          if (!open) setEditInvoice(null);
        }}
        onSuccess={() => {
          loadInvoices();
          setEditInvoice(null);
        }}
        invoice={editInvoice}
      />
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
