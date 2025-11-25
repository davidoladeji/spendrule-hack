'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { fetchWithAuth } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, FileText, MapPin, Package } from 'lucide-react';
import { NotificationModal } from '@/components/ui/notification-modal';

interface Contract {
  contractId: string;
  contractNumber: string;
  contractTitle?: string;
  contractStatus?: string;
  effectiveDate?: string;
  expirationDate?: string;
  totalContractValue?: number;
  currency?: string;
  parentContract?: {
    contractId: string;
    contractNumber: string;
  };
  childContracts?: Array<{
    contractId: string;
    contractNumber: string;
  }>;
  contractParties?: Array<{
    party: {
      partyId: string;
      legalName: string;
      partyType: string;
    };
    partyRole: string;
  }>;
  contractLocations?: Array<{
    location: {
      locationId: string;
      locationName: string;
      addressLine1?: string;
      city?: string;
      state?: string;
    };
  }>;
  billableItems?: Array<{
    itemId: string;
    itemName: string;
    description?: string;
    contractPrice?: number;
    contractUom?: string;
    pricingModel?: {
      modelName: string;
      pricingTiers?: Array<{
        tierName?: string;
        minValue: number;
        maxValue?: number;
        rate: number;
      }>;
    };
    serviceCategory?: {
      categoryName: string;
    };
  }>;
}

export default function ContractDetailPage() {
  const params = useParams();
  const [contract, setContract] = useState<Contract | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'parties' | 'locations' | 'billable-items' | 'invoices'>('overview');
  const [notification, setNotification] = useState<{type: 'success' | 'error' | 'info' | 'warning', title: string, message: string} | null>(null);
  const [invoices, setInvoices] = useState<any[]>([]);

  useEffect(() => {
    loadContract();
  }, [params.id]);

  const loadContract = async () => {
    try {
      const response = await fetchWithAuth(`/api/contracts/${params.id}`);
      if (response.ok) {
        const data = await response.json();
        setContract(data);
        // Load invoices for this contract
        loadInvoices(data.contractId);
      } else if (response.status === 404) {
        setNotification({
          type: 'error',
          title: 'Contract Not Found',
          message: 'The contract you are looking for does not exist.',
        });
      } else {
        setNotification({
          type: 'error',
          title: 'Error',
          message: 'Failed to load contract. Please try again.',
        });
      }
    } catch (error) {
      console.error('Error loading contract:', error);
      setNotification({
        type: 'error',
        title: 'Error',
        message: 'Failed to load contract. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  const loadInvoices = async (contractId: string) => {
    try {
      const response = await fetchWithAuth(`/api/invoices?contractId=${contractId}`);
      if (response.ok) {
        const data = await response.json();
        setInvoices(data.invoices || []);
      }
    } catch (error) {
      console.error('Error loading invoices:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!contract) {
    return (
      <div className="space-y-3">
        <Link href="/contracts">
          <Button size="sm" variant="ghost">
            <ArrowLeft className="h-3.5 w-3.5 mr-1" />
            Back to Contracts
          </Button>
        </Link>
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-sm text-muted-foreground">Contract not found</p>
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

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href="/contracts">
            <Button size="sm" variant="ghost">
              <ArrowLeft className="h-3.5 w-3.5 mr-1" />
              Back to Contracts
            </Button>
          </Link>
          <div>
            <h1 className="text-lg font-semibold text-foreground">
              {contract.contractNumber}
            </h1>
            {contract.contractTitle && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {contract.contractTitle}
              </p>
            )}
          </div>
        </div>
        {contract.contractStatus && (
          <Badge
            variant={contract.contractStatus === 'Active' ? 'default' : 'secondary'}
            className="text-xs"
          >
            {contract.contractStatus}
          </Badge>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
          <TabsTrigger value="parties" className="text-xs">
            Parties {contract.contractParties && contract.contractParties.length > 0 && `(${contract.contractParties.length})`}
          </TabsTrigger>
          <TabsTrigger value="locations" className="text-xs">
            Locations {contract.contractLocations && contract.contractLocations.length > 0 && `(${contract.contractLocations.length})`}
          </TabsTrigger>
          <TabsTrigger value="billable-items" className="text-xs">
            Billable Items {contract.billableItems && contract.billableItems.length > 0 && `(${contract.billableItems.length})`}
          </TabsTrigger>
          <TabsTrigger value="invoices" className="text-xs">
            Invoices {invoices.length > 0 && `(${invoices.length})`}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-3">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <Card>
              <CardContent className="p-4">
                <h2 className="text-sm font-semibold mb-3">Contract Details</h2>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between py-1.5 border-b">
                    <span className="text-muted-foreground">Contract Number</span>
                    <span className="font-medium">{contract.contractNumber}</span>
                  </div>
                  {contract.contractTitle && (
                    <div className="flex items-center justify-between py-1.5 border-b">
                      <span className="text-muted-foreground">Title</span>
                      <span className="font-medium">{contract.contractTitle}</span>
                    </div>
                  )}
                  {contract.effectiveDate && (
                    <div className="flex items-center justify-between py-1.5 border-b">
                      <span className="text-muted-foreground">Effective Date</span>
                      <span className="font-medium">
                        {new Date(contract.effectiveDate).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                  {contract.expirationDate && (
                    <div className="flex items-center justify-between py-1.5 border-b">
                      <span className="text-muted-foreground">Expiration Date</span>
                      <span className="font-medium">
                        {new Date(contract.expirationDate).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                  {contract.contractStatus && (
                    <div className="flex items-center justify-between py-1.5 border-b">
                      <span className="text-muted-foreground">Status</span>
                      <Badge
                        variant={contract.contractStatus === 'Active' ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {contract.contractStatus}
                      </Badge>
                    </div>
                  )}
                  {contract.totalContractValue !== undefined && contract.totalContractValue !== null && (
                    <div className="flex items-center justify-between py-1.5">
                      <span className="text-muted-foreground">Total Value</span>
                      <span className="font-bold text-sm">
                        {contract.currency || 'USD'} {contract.totalContractValue.toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <h2 className="text-sm font-semibold mb-3">Related Contracts</h2>
                <div className="space-y-2 text-xs">
                  {contract.parentContract && (
                    <div className="flex items-center justify-between py-1.5 border-b">
                      <span className="text-muted-foreground">Parent Contract</span>
                      <Link
                        href={`/contracts/${contract.parentContract.contractId}`}
                        className="text-primary hover:text-primary/80 font-medium"
                      >
                        {contract.parentContract.contractNumber} →
                      </Link>
                    </div>
                  )}
                  {contract.childContracts && contract.childContracts.length > 0 && (
                    <div className="py-1.5">
                      <span className="text-muted-foreground">Child Contracts ({contract.childContracts.length})</span>
                      <div className="mt-2 space-y-1">
                        {contract.childContracts.map((child) => (
                          <div key={child.contractId} className="flex items-center justify-between">
                            <Link
                              href={`/contracts/${child.contractId}`}
                              className="text-primary hover:text-primary/80 font-medium text-xs"
                            >
                              {child.contractNumber} →
                            </Link>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {!contract.parentContract && (!contract.childContracts || contract.childContracts.length === 0) && (
                    <p className="text-xs text-muted-foreground py-2">No related contracts</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="parties" className="space-y-3">
          <Card>
            <CardContent className="p-3">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Party</TableHead>
                      <TableHead className="text-xs">Type</TableHead>
                      <TableHead className="text-xs">Role</TableHead>
                      <TableHead className="text-xs">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contract.contractParties && contract.contractParties.length > 0 ? (
                      contract.contractParties.map((cp) => (
                        <TableRow key={cp.party.partyId}>
                          <TableCell className="py-2.5">
                            <Link
                              href={`/parties/${cp.party.partyId}`}
                              className="text-xs font-medium text-primary hover:text-primary/80"
                            >
                              {cp.party.legalName}
                            </Link>
                          </TableCell>
                          <TableCell className="py-2.5">
                            <Badge variant="outline" className="text-xs">
                              {cp.party.partyType}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-2.5 text-xs text-muted-foreground">
                            {cp.partyRole}
                          </TableCell>
                          <TableCell className="py-2.5">
                            <Link href={`/parties/${cp.party.partyId}`}>
                              <Button size="sm" variant="ghost" className="h-6 px-2 text-xs">
                                View
                              </Button>
                            </Link>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={4} className="px-6 py-12 text-center">
                          <p className="text-xs text-muted-foreground">No parties found</p>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="locations" className="space-y-3">
          <Card>
            <CardContent className="p-3">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Location Name</TableHead>
                      <TableHead className="text-xs">Address</TableHead>
                      <TableHead className="text-xs">City</TableHead>
                      <TableHead className="text-xs">State</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contract.contractLocations && contract.contractLocations.length > 0 ? (
                      contract.contractLocations.map((cl) => (
                        <TableRow key={cl.location.locationId}>
                          <TableCell className="py-2.5 text-xs font-medium">
                            {cl.location.locationName}
                          </TableCell>
                          <TableCell className="py-2.5 text-xs text-muted-foreground">
                            {cl.location.addressLine1 || 'N/A'}
                          </TableCell>
                          <TableCell className="py-2.5 text-xs text-muted-foreground">
                            {cl.location.city || 'N/A'}
                          </TableCell>
                          <TableCell className="py-2.5 text-xs text-muted-foreground">
                            {cl.location.state || 'N/A'}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={4} className="px-6 py-12 text-center">
                          <p className="text-xs text-muted-foreground">No locations found</p>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="billable-items" className="space-y-3">
          <Card>
            <CardContent className="p-3">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Item Name</TableHead>
                      <TableHead className="text-xs">Description</TableHead>
                      <TableHead className="text-xs">Category</TableHead>
                      <TableHead className="text-xs">Price</TableHead>
                      <TableHead className="text-xs">UOM</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contract.billableItems && contract.billableItems.length > 0 ? (
                      contract.billableItems.map((item) => (
                        <TableRow key={item.itemId}>
                          <TableCell className="py-2.5 text-xs font-medium">
                            {item.itemName}
                          </TableCell>
                          <TableCell className="py-2.5 text-xs text-muted-foreground">
                            {item.description || 'N/A'}
                          </TableCell>
                          <TableCell className="py-2.5 text-xs text-muted-foreground">
                            {item.serviceCategory?.categoryName || 'N/A'}
                          </TableCell>
                          <TableCell className="py-2.5 text-xs font-medium">
                            {item.contractPrice
                              ? `${contract.currency || 'USD'} ${item.contractPrice.toLocaleString()}`
                              : 'N/A'}
                          </TableCell>
                          <TableCell className="py-2.5 text-xs text-muted-foreground">
                            {item.contractUom || 'N/A'}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5} className="px-6 py-12 text-center">
                          <p className="text-xs text-muted-foreground">No billable items found</p>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invoices" className="space-y-3">
          <Card>
            <CardContent className="p-3">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Invoice #</TableHead>
                      <TableHead className="text-xs">Date</TableHead>
                      <TableHead className="text-xs">Vendor</TableHead>
                      <TableHead className="text-xs">Amount</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                      <TableHead className="text-xs">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.length > 0 ? (
                      invoices.map((invoice) => (
                        <TableRow key={invoice.invoiceId}>
                          <TableCell className="py-2.5">
                            <Link
                              href={`/invoices/${invoice.invoiceId}`}
                              className="text-xs font-medium text-primary hover:text-primary/80"
                            >
                              {invoice.invoiceNumber || invoice.invoiceId.substring(0, 8)}
                            </Link>
                          </TableCell>
                          <TableCell className="py-2.5 text-xs text-muted-foreground">
                            {new Date(invoice.invoiceDate).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="py-2.5 text-xs text-muted-foreground">
                            {invoice.vendorParty?.legalName || 'N/A'}
                          </TableCell>
                          <TableCell className="py-2.5 text-xs font-medium">
                            {invoice.currency} {invoice.grossAmount?.toLocaleString() || '0'}
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
                            <Link href={`/invoices/${invoice.invoiceId}`}>
                              <Button size="sm" variant="ghost" className="h-6 px-2 text-xs">
                                View
                              </Button>
                            </Link>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="px-6 py-12 text-center">
                          <p className="text-xs text-muted-foreground">No invoices found</p>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
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
    </div>
  );
}

