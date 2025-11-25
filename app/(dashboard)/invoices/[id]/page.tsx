'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { fetchWithAuth } from '@/lib/auth-client';
import DocumentViewer from '@/components/DocumentViewer';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, FileText, AlertCircle, CheckCircle2, XCircle, Edit, Trash2, RefreshCw } from 'lucide-react';
import { NotificationModal } from '@/components/ui/notification-modal';
import { InvoiceModal } from '@/components/modals/InvoiceModal';

interface Invoice {
  invoiceId: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate?: string;
  vendorParty: { legalName: string; partyId: string };
  customerParty?: { legalName: string; partyId: string };
  grossAmount: number;
  netAmount?: number;
  taxAmount?: number;
  currency: string;
  currentStatus: string;
  validationStatus?: string;
  contract?: {
    contractId: string;
    contractNumber: string;
  };
  invoiceLineItems: Array<{
    lineItemId: string;
    lineNumber: number;
    description?: string;
    quantity?: number;
    unitPrice?: number;
    lineAmount: number;
    billableItem?: {
      itemName: string;
    };
    serviceCategory?: {
      categoryName: string;
    };
  }>;
  invoiceValidations?: Array<{
    validationId: string;
    validationDate: string;
    validationStatus: string;
    validationExceptions: Array<{
      exceptionId: string;
      exceptionType: string;
      severity: string;
      message: string;
      expectedValue?: string;
      actualValue?: string;
      varianceAmount?: number;
    }>;
  }>;
  sourceDocument?: {
    documentId: string;
    documentUrl: string;
    documentName: string;
    mimeType?: string;
    totalPages?: number;
  };
}

export default function InvoiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'line-items' | 'validation' | 'document'>('overview');
  const [notification, setNotification] = useState<{type: 'success' | 'error' | 'info' | 'warning', title: string, message: string} | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [reExtracting, setReExtracting] = useState(false);

  useEffect(() => {
    loadInvoice();
  }, [params.id]);

  const loadInvoice = async () => {
    try {
      const response = await fetchWithAuth(`/api/invoices/${params.id}`);
      if (response.ok) {
        const data = await response.json();
        setInvoice(data);
      } else if (response.status === 404) {
        setNotification({
          type: 'error',
          title: 'Invoice Not Found',
          message: 'The invoice you are looking for does not exist.',
        });
      } else {
        setNotification({
          type: 'error',
          title: 'Error',
          message: 'Failed to load invoice. Please try again.',
        });
      }
    } catch (error) {
      console.error('Error loading invoice:', error);
      setNotification({
        type: 'error',
        title: 'Error',
        message: 'Failed to load invoice. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="space-y-3">
        <Link href="/invoices">
          <Button size="sm" variant="ghost">
            <ArrowLeft className="h-3.5 w-3.5 mr-1" />
            Back to Invoices
          </Button>
        </Link>
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-sm text-muted-foreground">Invoice not found</p>
          </CardContent>
        </Card>
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

  const handleReExtract = async () => {
    if (!confirm('This will re-extract data from the source document. The invoice will be updated with new extracted values. Continue?')) {
      return;
    }

    setReExtracting(true);
    try {
      const response = await fetchWithAuth(`/api/invoices/${params.id}/re-extract`, {
        method: 'POST',
      });

      if (response.ok) {
        const result = await response.json();
        setNotification({
          type: 'success',
          title: 'Success',
          message: result.message || 'Invoice re-extracted successfully. Refreshing...',
        });
        // Reload invoice data
        setTimeout(() => {
          loadInvoice();
        }, 1000);
      } else {
        const error = await response.json();
        setNotification({
          type: 'error',
          title: 'Error',
          message: error.error || 'Failed to re-extract invoice',
        });
      }
    } catch (error) {
      console.error('Error re-extracting invoice:', error);
      setNotification({
        type: 'error',
        title: 'Error',
        message: 'Failed to re-extract invoice. Please try again.',
      });
    } finally {
      setReExtracting(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this invoice? This action cannot be undone.')) {
      return;
    }

    setDeleting(true);
    try {
      const response = await fetchWithAuth(`/api/invoices/${params.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setNotification({
          type: 'success',
          title: 'Success',
          message: 'Invoice deleted successfully',
        });
        setTimeout(() => {
          router.push('/invoices');
        }, 1500);
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
      setDeleting(false);
    }
  };

  const latestValidation = invoice.invoiceValidations?.[0];
  const hasExceptions = latestValidation?.validationExceptions && latestValidation.validationExceptions.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href="/invoices">
            <Button size="sm" variant="ghost">
              <ArrowLeft className="h-3.5 w-3.5 mr-1" />
              Back to Invoices
            </Button>
          </Link>
          <div>
            <h1 className="text-lg font-semibold text-foreground">
              Invoice {invoice.invoiceNumber || invoice.invoiceId.substring(0, 8)}
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {invoice.vendorParty?.legalName || 'Unknown Vendor'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setEditModalOpen(true)}
          >
            <Edit className="h-3.5 w-3.5 mr-1" />
            Edit
          </Button>
          {invoice.sourceDocument && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleReExtract}
              disabled={reExtracting}
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1 ${reExtracting ? 'animate-spin' : ''}`} />
              {reExtracting ? 'Re-extracting...' : 'Re-extract'}
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={handleDelete}
            disabled={deleting}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className={`h-3.5 w-3.5 mr-1 ${deleting ? 'animate-pulse' : ''}`} />
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
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
          {invoice.validationStatus && (
            <Badge
              variant={invoice.validationStatus === 'Passed' ? 'default' : 'destructive'}
              className="text-xs"
            >
              {invoice.validationStatus}
            </Badge>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="line-items">Line Items</TabsTrigger>
          <TabsTrigger value="validation">
            Validation {hasExceptions && <AlertCircle className="ml-1 text-destructive" />}
          </TabsTrigger>
          <TabsTrigger value="document">Document</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardContent className="p-6">
                <h2 className="text-sm font-semibold mb-4">Invoice Details</h2>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between py-1.5 border-b">
                    <span className="text-muted-foreground">Invoice Number</span>
                    <span className="font-medium">{invoice.invoiceNumber || 'N/A'}</span>
                  </div>
                  <div className="flex items-center justify-between py-1.5 border-b">
                    <span className="text-muted-foreground">Invoice Date</span>
                    <span className="font-medium">
                      {new Date(invoice.invoiceDate).toLocaleDateString()}
                    </span>
                  </div>
                  {invoice.dueDate && (
                    <div className="flex items-center justify-between py-1.5 border-b">
                      <span className="text-muted-foreground">Due Date</span>
                      <span className="font-medium">
                        {new Date(invoice.dueDate).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between py-1.5 border-b">
                    <span className="text-muted-foreground">Vendor</span>
                    <Link
                      href={`/parties/${invoice.vendorParty?.partyId}`}
                      className="text-primary hover:text-primary/80 font-medium"
                    >
                      {invoice.vendorParty?.legalName || 'N/A'} →
                    </Link>
                  </div>
                  {invoice.customerParty && (
                    <div className="flex items-center justify-between py-1.5 border-b">
                      <span className="text-muted-foreground">Customer</span>
                      <Link
                        href={`/parties/${invoice.customerParty.partyId}`}
                        className="text-primary hover:text-primary/80 font-medium"
                      >
                        {invoice.customerParty.legalName} →
                      </Link>
                    </div>
                  )}
                  {invoice.contract && (
                    <div className="flex items-center justify-between py-1.5 border-b">
                      <span className="text-muted-foreground">Contract</span>
                      <Link
                        href={`/contracts/${invoice.contract.contractId}`}
                        className="text-primary hover:text-primary/80 font-medium"
                      >
                        {invoice.contract.contractNumber} →
                      </Link>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <h2 className="text-sm font-semibold mb-4">Financial Summary</h2>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between py-1.5 border-b">
                    <span className="text-muted-foreground">Gross Amount</span>
                    <span className="font-bold text-sm">
                      {invoice.currency} {invoice.grossAmount.toLocaleString()}
                    </span>
                  </div>
                  {invoice.taxAmount !== undefined && invoice.taxAmount !== null && (
                    <div className="flex items-center justify-between py-1.5 border-b">
                      <span className="text-muted-foreground">Tax</span>
                      <span className="font-medium">
                        {invoice.currency} {invoice.taxAmount.toLocaleString()}
                      </span>
                    </div>
                  )}
                  {invoice.netAmount !== undefined && invoice.netAmount !== null && (
                    <div className="flex items-center justify-between py-1.5 border-b">
                      <span className="text-muted-foreground">Net Amount</span>
                      <span className="font-medium">
                        {invoice.currency} {invoice.netAmount.toLocaleString()}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between py-1.5 border-b">
                    <span className="text-muted-foreground">Status</span>
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
                  </div>
                  {invoice.validationStatus && (
                    <div className="flex items-center justify-between py-1.5">
                      <span className="text-muted-foreground">Validation</span>
                      <Badge
                        variant={invoice.validationStatus === 'Passed' ? 'default' : 'destructive'}
                        className="text-xs"
                      >
                        {invoice.validationStatus}
                      </Badge>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="line-items" className="space-y-4">
          <Card>
            <CardContent className="p-4">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Line #</TableHead>
                      <TableHead className="text-xs">Description</TableHead>
                      <TableHead className="text-xs">Item</TableHead>
                      <TableHead className="text-xs">Quantity</TableHead>
                      <TableHead className="text-xs">Unit Price</TableHead>
                      <TableHead className="text-xs text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoice.invoiceLineItems && invoice.invoiceLineItems.length > 0 ? (
                      invoice.invoiceLineItems.map((item) => (
                        <TableRow key={item.lineItemId}>
                          <TableCell className="py-2.5 text-xs">{item.lineNumber}</TableCell>
                          <TableCell className="py-2.5 text-xs">
                            {item.description || 'N/A'}
                          </TableCell>
                          <TableCell className="py-2.5 text-xs">
                            {item.billableItem?.itemName || item.serviceCategory?.categoryName || 'N/A'}
                          </TableCell>
                          <TableCell className="py-2.5 text-xs">
                            {item.quantity?.toLocaleString() || 'N/A'}
                          </TableCell>
                          <TableCell className="py-2.5 text-xs">
                            {item.unitPrice
                              ? `${invoice.currency} ${item.unitPrice.toLocaleString()}`
                              : 'N/A'}
                          </TableCell>
                          <TableCell className="py-2.5 text-xs text-right font-medium">
                            {invoice.currency} {item.lineAmount.toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="px-6 py-12 text-center">
                          <p className="text-xs text-muted-foreground">No line items found</p>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="validation" className="space-y-4">
          {latestValidation ? (
            <>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-semibold">Validation Results</h2>
                    <Badge
                      variant={latestValidation.validationStatus === 'Passed' ? 'default' : 'destructive'}
                      className="text-xs"
                    >
                      {latestValidation.validationStatus}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Validated on {new Date(latestValidation.validationDate).toLocaleString()}
                  </div>
                </CardContent>
              </Card>

              {hasExceptions ? (
                <Card>
                  <CardContent className="p-6">
                    <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-destructive" />
                      Exceptions ({latestValidation.validationExceptions.length})
                    </h2>
                    <div className="space-y-2">
                      {latestValidation.validationExceptions.map((exception) => (
                        <div
                          key={exception.exceptionId}
                          className="border rounded-md p-3 space-y-1.5"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Badge
                                variant={
                                  exception.severity === 'High'
                                    ? 'destructive'
                                    : exception.severity === 'Medium'
                                    ? 'secondary'
                                    : 'outline'
                                }
                                className="text-xs"
                              >
                                {exception.severity}
                              </Badge>
                              <span className="text-xs font-medium">{exception.exceptionType}</span>
                            </div>
                            {exception.varianceAmount && (
                              <span className="text-xs font-bold text-destructive">
                                {invoice.currency} {exception.varianceAmount.toLocaleString()}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">{exception.message}</p>
                          {exception.expectedValue && exception.actualValue && (
                            <div className="text-xs space-y-0.5">
                              <div>
                                <span className="text-muted-foreground">Expected: </span>
                                <span className="font-medium">{exception.expectedValue}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Actual: </span>
                                <span className="font-medium">{exception.actualValue}</span>
                              </div>
                            </div>
                          )}
                          <Link href={`/exceptions/${exception.exceptionId}`}>
                            <Button size="sm" variant="ghost" className="h-6 px-2 text-xs mt-1">
                              View Details →
                            </Button>
                          </Link>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      No exceptions found. Invoice passed validation.
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <XCircle className="h-4 w-4" />
                  This invoice has not been validated yet.
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="document" className="space-y-4">
          {invoice.sourceDocument ? (
            <Card>
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold">Source Document</h2>
                    <Badge variant="outline" className="text-xs">
                      <FileText className="h-3 w-3 mr-1" />
                      {invoice.sourceDocument.documentName}
                    </Badge>
                  </div>
                  <DocumentViewer
                    documentUrl={invoice.sourceDocument.documentUrl}
                  />
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-6">
                <p className="text-sm text-muted-foreground">No source document available</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {notification && (
        <NotificationModal
          open={!!notification}
          onOpenChange={(open) => !open && setNotification(null)}
          type={notification.type}
          title={notification.title}
          message={notification.message}
        />
      )}
      <InvoiceModal
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        onSuccess={() => {
          loadInvoice();
          setEditModalOpen(false);
        }}
        invoice={invoice}
      />
    </div>
  );
}

