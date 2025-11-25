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
import { ArrowLeft, Building2, FileText, Edit, Trash2 } from 'lucide-react';
import { NotificationModal } from '@/components/ui/notification-modal';
import { PartyModal } from '@/components/modals/PartyModal';
import { useRouter } from 'next/navigation';

interface Party {
  partyId: string;
  partyNumber?: string;
  legalName: string;
  tradingName?: string;
  partyType: string;
  partyStatus: string;
  taxId?: string;
  dunsNumber?: string;
  npiNumber?: string;
  cageCode?: string;
  primaryContactEmail?: string;
  primaryContactPhone?: string;
  contractParties?: Array<{
    contractId: string;
    partyId: string;
    partyRole: string;
    contract: {
      contractId: string;
      contractNumber: string;
      contractTitle?: string;
      contractStatus?: string;
      effectiveDate?: string;
      expirationDate?: string;
    };
  }>;
  invoicesAsVendor?: Array<{
    invoiceId: string;
    invoiceNumber: string;
    invoiceDate: string;
    totalAmount: number;
    currentStatus: string;
  }>;
  invoicesAsCustomer?: Array<{
    invoiceId: string;
    invoiceNumber: string;
    invoiceDate: string;
    totalAmount: number;
    currentStatus: string;
  }>;
}

export default function PartyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [party, setParty] = useState<Party | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'contracts' | 'invoices'>('overview');
  const [notification, setNotification] = useState<{type: 'success' | 'error' | 'info' | 'warning', title: string, message: string} | null>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadParty();
  }, [params.id]);

  const loadParty = async () => {
    try {
      const response = await fetchWithAuth(`/api/parties/${params.id}`);
      if (response.ok) {
        const data = await response.json();
        setParty(data);
        // Load invoices for this party
        loadInvoices(data.partyId);
      } else if (response.status === 404) {
        setNotification({
          type: 'error',
          title: 'Party Not Found',
          message: 'The party you are looking for does not exist.',
        });
      } else {
        setNotification({
          type: 'error',
          title: 'Error',
          message: 'Failed to load party. Please try again.',
        });
      }
    } catch (error) {
      console.error('Error loading party:', error);
      setNotification({
        type: 'error',
        title: 'Error',
        message: 'Failed to load party. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  const loadInvoices = async (partyId: string) => {
    try {
      const response = await fetchWithAuth(`/api/invoices?vendorId=${partyId}`);
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

  if (!party) {
    return (
      <div className="space-y-3">
        <Link href="/parties">
          <Button size="sm" variant="ghost">
            <ArrowLeft className="h-3.5 w-3.5 mr-1" />
            Back to Parties
          </Button>
        </Link>
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-sm text-muted-foreground">Party not found</p>
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

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this party? This action cannot be undone.')) {
      return;
    }

    setDeleting(true);
    try {
      const response = await fetchWithAuth(`/api/parties/${params.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setNotification({
          type: 'success',
          title: 'Success',
          message: 'Party deleted successfully',
        });
        setTimeout(() => {
          router.push('/parties');
        }, 1500);
      } else {
        const error = await response.json();
        setNotification({
          type: 'error',
          title: 'Error',
          message: error.error || 'Failed to delete party',
        });
      }
    } catch (error) {
      console.error('Error deleting party:', error);
      setNotification({
        type: 'error',
        title: 'Error',
        message: 'Failed to delete party. Please try again.',
      });
    } finally {
      setDeleting(false);
    }
  };

  const allContracts = (party.contractParties || []).map(cp => ({ 
    ...cp.contract, 
    role: cp.partyRole 
  }));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href="/parties">
            <Button size="sm" variant="ghost">
              <ArrowLeft className="h-3.5 w-3.5 mr-1" />
              Back to Parties
            </Button>
          </Link>
          <div>
            <h1 className="text-lg font-semibold text-foreground">
              {party.legalName}
            </h1>
            {party.tradingName && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Trading as: {party.tradingName}
              </p>
            )}
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
          <Badge variant="outline" className="text-xs">
            {party.partyType}
          </Badge>
          <Badge
            variant={party.partyStatus === 'Active' ? 'default' : 'secondary'}
            className="text-xs"
          >
            {party.partyStatus}
          </Badge>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
          <TabsTrigger value="contracts" className="text-xs">
            Contracts {allContracts.length > 0 && `(${allContracts.length})`}
          </TabsTrigger>
          <TabsTrigger value="invoices" className="text-xs">
            Invoices {invoices.length > 0 && `(${invoices.length})`}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-3">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <Card>
              <CardContent className="p-4">
                <h2 className="text-sm font-semibold mb-3">Party Details</h2>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between py-1.5 border-b">
                    <span className="text-muted-foreground">Legal Name</span>
                    <span className="font-medium">{party.legalName}</span>
                  </div>
                  {party.tradingName && (
                    <div className="flex items-center justify-between py-1.5 border-b">
                      <span className="text-muted-foreground">Trading Name</span>
                      <span className="font-medium">{party.tradingName}</span>
                    </div>
                  )}
                  {party.partyNumber && (
                    <div className="flex items-center justify-between py-1.5 border-b">
                      <span className="text-muted-foreground">Party Number</span>
                      <span className="font-medium">{party.partyNumber}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between py-1.5 border-b">
                    <span className="text-muted-foreground">Type</span>
                    <Badge variant="outline" className="text-xs">
                      {party.partyType}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between py-1.5 border-b">
                    <span className="text-muted-foreground">Status</span>
                    <Badge
                      variant={party.partyStatus === 'Active' ? 'default' : 'secondary'}
                      className="text-xs"
                    >
                      {party.partyStatus}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <h2 className="text-sm font-semibold mb-3">Contact & Identifiers</h2>
                <div className="space-y-2 text-xs">
                  {party.primaryContactEmail && (
                    <div className="flex items-center justify-between py-1.5 border-b">
                      <span className="text-muted-foreground">Email</span>
                      <a
                        href={`mailto:${party.primaryContactEmail}`}
                        className="text-primary hover:text-primary/80 font-medium"
                      >
                        {party.primaryContactEmail}
                      </a>
                    </div>
                  )}
                  {party.primaryContactPhone && (
                    <div className="flex items-center justify-between py-1.5 border-b">
                      <span className="text-muted-foreground">Phone</span>
                      <a
                        href={`tel:${party.primaryContactPhone}`}
                        className="text-primary hover:text-primary/80 font-medium"
                      >
                        {party.primaryContactPhone}
                      </a>
                    </div>
                  )}
                  {party.taxId && (
                    <div className="flex items-center justify-between py-1.5 border-b">
                      <span className="text-muted-foreground">Tax ID</span>
                      <span className="font-medium">{party.taxId}</span>
                    </div>
                  )}
                  {party.dunsNumber && (
                    <div className="flex items-center justify-between py-1.5 border-b">
                      <span className="text-muted-foreground">DUNS Number</span>
                      <span className="font-medium">{party.dunsNumber}</span>
                    </div>
                  )}
                  {party.npiNumber && (
                    <div className="flex items-center justify-between py-1.5 border-b">
                      <span className="text-muted-foreground">NPI Number</span>
                      <span className="font-medium">{party.npiNumber}</span>
                    </div>
                  )}
                  {party.cageCode && (
                    <div className="flex items-center justify-between py-1.5">
                      <span className="text-muted-foreground">CAGE Code</span>
                      <span className="font-medium">{party.cageCode}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="contracts" className="space-y-3">
          <Card>
            <CardContent className="p-3">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Contract Number</TableHead>
                      <TableHead className="text-xs">Role</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                      <TableHead className="text-xs">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allContracts.length > 0 ? (
                      allContracts.map((contract) => (
                        <TableRow key={contract.contractId}>
                          <TableCell className="py-2.5">
                            <Link
                              href={`/contracts/${contract.contractId}`}
                              className="text-xs font-medium text-primary hover:text-primary/80"
                            >
                              {contract.contractNumber || contract.contractId.substring(0, 8)}
                            </Link>
                          </TableCell>
                          <TableCell className="py-2.5">
                            <Badge variant="outline" className="text-xs">
                              {contract.role}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-2.5">
                            {contract.contractStatus && (
                              <Badge
                                variant={
                                  contract.contractStatus === 'Active'
                                    ? 'default'
                                    : 'secondary'
                                }
                                className="text-xs"
                              >
                                {contract.contractStatus}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="py-2.5">
                            <Link href={`/contracts/${contract.contractId}`}>
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
                          <p className="text-xs text-muted-foreground">No contracts found</p>
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
                        <TableCell colSpan={5} className="px-6 py-12 text-center">
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
      <PartyModal
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        onSuccess={() => {
          loadParty();
          setEditModalOpen(false);
        }}
        party={party}
      />
    </div>
  );
}

