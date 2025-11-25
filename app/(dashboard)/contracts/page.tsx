'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { fetchWithAuth } from '@/lib/auth-client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, FileText, Upload, Edit, Trash2, Star, Checkbox, Search, ChevronDown, X, ChevronLeft, ChevronRight, ArrowUpDown } from 'lucide-react';
import { ContractModal } from '@/components/modals/ContractModal';
import { InvoiceUploadModal } from '@/components/modals/InvoiceUploadModal';
import { Pills } from '@/components/ui/pills';
import { NotificationModal } from '@/components/ui/notification-modal';

interface Contract {
  contractId: string;
  contractNumber: string;
  contractTitle: string;
  contractStatus: string;
  effectiveDate: string;
  expirationDate: string;
  totalContractValue: number;
  currency: string;
  autoRenewalEnabled?: boolean;
  renewalPeriod?: string;
  noticePeriodDays?: number;
  contractParties?: Array<{
    party: {
      partyId: string;
      legalName: string;
      partyType: string;
    };
    partyRole: string;
  }>;
  billableItems?: Array<{
    itemName: string;
    itemCategory?: string;
  }>;
}

export default function ContractsPage() {
  const router = useRouter();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [contractModalOpen, setContractModalOpen] = useState(false);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [editingContract, setEditingContract] = useState<Contract | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [selectedContracts, setSelectedContracts] = useState<Set<string>>(new Set());
  const [favoriteContracts, setFavoriteContracts] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [viewFilter, setViewFilter] = useState<string>('active');
  const [sortBy, setSortBy] = useState<string>('contract');
  const [activeFilters, setActiveFilters] = useState<Array<{key: string, label: string}>>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(50);
  const [notification, setNotification] = useState<{type: 'success' | 'error' | 'info' | 'warning', title: string, message: string} | null>(null);

  useEffect(() => {
    loadContracts();
  }, []);

  const loadContracts = async () => {
    try {
      const response = await fetchWithAuth('/api/contracts');
      if (response.ok) {
        const data = await response.json();
        setContracts(data.contracts || []);
      }
    } catch (error) {
      console.error('Error loading contracts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleNewContract = () => {
    setEditingContract(null);
    setContractModalOpen(true);
  };

  const handleEditContract = (contract: Contract) => {
    setEditingContract(contract);
    setContractModalOpen(true);
  };

  const handleDeleteContract = async (contractId: string) => {
    if (!confirm('Are you sure you want to delete this contract? This action cannot be undone.')) {
      return;
    }

    setDeleting(contractId);
    try {
      const response = await fetchWithAuth(`/api/contracts/${contractId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setNotification({
          type: 'success',
          title: 'Success',
          message: 'Contract deleted successfully',
        });
        loadContracts();
      } else {
        const error = await response.json();
        setNotification({
          type: 'error',
          title: 'Error',
          message: error.error || 'Failed to delete contract',
        });
      }
    } catch (error) {
      console.error('Error deleting contract:', error);
      setNotification({
        type: 'error',
        title: 'Error',
        message: 'Failed to delete contract. Please try again.',
      });
    } finally {
      setDeleting(null);
    }
  };

  const handleRowClick = (contractId: string) => {
    // Open L3 panel (for now, navigate to detail page)
    router.push(`/contracts/${contractId}`);
  };

  const handleRowDoubleClick = (contractId: string) => {
    router.push(`/contracts/${contractId}`);
  };

  const calculateDuration = (effectiveDate: string, expirationDate: string) => {
    const start = new Date(effectiveDate);
    const end = new Date(expirationDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const years = Math.floor(diffDays / 365);
    const months = Math.floor((diffDays % 365) / 30);
    
    if (years > 0) {
      return `${years} year${years > 1 ? 's' : ''}`;
    }
    return `${months} month${months > 1 ? 's' : ''}`;
  };

  const formatRelativeDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
      const daysAgo = Math.abs(diffDays);
      return `${daysAgo} day${daysAgo > 1 ? 's' : ''} ago`;
    } else if (diffDays === 0) {
      return 'Today';
    } else {
      return `In ${diffDays} day${diffDays > 1 ? 's' : ''}`;
    }
  };

  const getContractStatus = (contract: Contract) => {
    if (contract.contractStatus === 'Active') {
      const expirationDate = new Date(contract.expirationDate);
      const now = new Date();
      const diffTime = expirationDate.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays <= 90 && diffDays > 0) {
        return { label: `Expiring Soon (${diffDays}d)`, variant: 'warning' as const };
      }
      return { label: 'Active', variant: 'success' as const };
    }
    return { label: contract.contractStatus, variant: 'secondary' as const };
  };

  const getAutoRenewText = (contract: Contract) => {
    if (contract.autoRenewalEnabled) {
      const days = contract.noticePeriodDays || 90;
      return `Yes ${days}d`;
    }
    return 'No';
  };

  const formatStartDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  const formatCurrency = (amount: number, currency: string) => {
    if (amount >= 1000000) {
      return `$${(amount / 1000000).toFixed(2)}M`;
    } else if (amount >= 1000) {
      return `$${(amount / 1000).toFixed(0)}K`;
    }
    return `${currency} ${amount.toLocaleString()}`;
  };

  // Update active filters when filters change
  useEffect(() => {
    const filters: Array<{key: string, label: string}> = [];
    if (statusFilter !== 'all') {
      filters.push({ key: 'status', label: `Status = ${statusFilter === 'active' ? 'Active' : statusFilter}` });
    }
    if (viewFilter === 'expiring') {
      filters.push({ key: 'expiring', label: 'Expiring Within = 90 days' });
    }
    setActiveFilters(filters);
  }, [statusFilter, viewFilter]);

  const removeFilter = (key: string) => {
    if (key === 'status') {
      setStatusFilter('all');
    } else if (key === 'expiring') {
      setViewFilter('active');
    }
  };

  const clearAllFilters = () => {
    setStatusFilter('all');
    setViewFilter('active');
    setSearchQuery('');
    setActiveFilters([]);
  };

  // Filter contracts based on search and filters
  const filteredContracts = contracts.filter(contract => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesSearch = 
        contract.contractNumber.toLowerCase().includes(query) ||
        getVendorName(contract).toLowerCase().includes(query) ||
        contract.contractTitle?.toLowerCase().includes(query);
      if (!matchesSearch) return false;
    }
    if (statusFilter !== 'all' && contract.contractStatus !== statusFilter) {
      return false;
    }
    if (viewFilter === 'expiring') {
      const expirationDate = new Date(contract.expirationDate);
      const now = new Date();
      const diffTime = expirationDate.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays > 90 || diffDays < 0) return false;
    }
    return true;
  });

  // Pagination
  const totalPages = Math.ceil(filteredContracts.length / pageSize);
  const paginatedContracts = filteredContracts.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const getVendorName = (contract: Contract) => {
    const vendor = contract.contractParties?.find(cp => cp.partyRole === 'Vendor');
    return vendor?.party.legalName || 'N/A';
  };

  const getVendorId = (contract: Contract) => {
    const vendor = contract.contractParties?.find(cp => cp.partyRole === 'Vendor');
    return vendor?.party.partyId;
  };

  const getServices = (contract: Contract) => {
    return contract.billableItems?.map(item => item.itemName || item.itemCategory || '').filter(Boolean) || [];
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
          <h1 className="text-lg font-semibold text-foreground">Contracts</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Review and process contracts</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={handleNewContract}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            New Contract
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Q Search contracts..."
            className="pl-8 text-xs"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[120px] text-xs">
            <SelectValue placeholder="Filter" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
          </SelectContent>
        </Select>
        <Select value={viewFilter} onValueChange={setViewFilter}>
          <SelectTrigger className="w-[160px] text-xs">
            <SelectValue placeholder="View" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active Contracts</SelectItem>
            <SelectItem value="expiring">Expiring Soon</SelectItem>
            <SelectItem value="all">All Contracts</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-[100px] text-xs">
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="contract">Contract ↓</SelectItem>
            <SelectItem value="vendor">Vendor</SelectItem>
            <SelectItem value="date">Start Date</SelectItem>
            <SelectItem value="value">Total Value</SelectItem>
            <SelectItem value="status">Status</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Active Filter Pills */}
      {activeFilters.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {activeFilters.map((filter) => (
            <Badge
              key={filter.key}
              variant="secondary"
              className="text-xs px-2 py-1 flex items-center gap-1"
            >
              {filter.label}
              <button
                onClick={() => removeFilter(filter.key)}
                className="ml-1 hover:bg-secondary-foreground/20 rounded-full p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          <button
            onClick={clearAllFilters}
            className="text-xs text-primary hover:text-primary/80"
          >
            Clear All
          </button>
        </div>
      )}

      <Card>
        <CardContent className="p-3">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs w-10"></TableHead>
                  <TableHead className="text-xs w-10"></TableHead>
                  <TableHead className="text-xs">
                    <div className="flex items-center gap-1 cursor-pointer hover:text-foreground" onClick={() => setSortBy('contract')}>
                      Contract
                      <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
                    </div>
                  </TableHead>
                  <TableHead className="text-xs">Vendor</TableHead>
                  <TableHead className="text-xs">
                    <div className="flex items-center gap-1 cursor-pointer hover:text-foreground" onClick={() => setSortBy('services')}>
                      Services
                      <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
                    </div>
                  </TableHead>
                  <TableHead className="text-xs">
                    <div className="flex items-center gap-1 cursor-pointer hover:text-foreground" onClick={() => setSortBy('date')}>
                      Start Date
                      <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
                    </div>
                  </TableHead>
                  <TableHead className="text-xs text-right">
                    <div className="flex items-center justify-end gap-1 cursor-pointer hover:text-foreground" onClick={() => setSortBy('value')}>
                      Total Value
                      <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
                    </div>
                  </TableHead>
                  <TableHead className="text-xs">
                    <div className="flex items-center gap-1 cursor-pointer hover:text-foreground" onClick={() => setSortBy('status')}>
                      Status
                      <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
                    </div>
                  </TableHead>
                  <TableHead className="text-xs">Auto-Renew</TableHead>
                  <TableHead className="text-xs text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedContracts.map((contract) => {
                  const vendorId = getVendorId(contract);
                  const services = getServices(contract);
                  const status = getContractStatus(contract);
                  const isSelected = selectedContracts.has(contract.contractId);
                  const isFavorite = favoriteContracts.has(contract.contractId);
                  
                  return (
                    <TableRow
                      key={contract.contractId}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleRowClick(contract.contractId)}
                      onDoubleClick={() => handleRowDoubleClick(contract.contractId)}
                    >
                      <TableCell className="py-2.5" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            e.stopPropagation();
                            const newSelected = new Set(selectedContracts);
                            if (e.target.checked) {
                              newSelected.add(contract.contractId);
                            } else {
                              newSelected.delete(contract.contractId);
                            }
                            setSelectedContracts(newSelected);
                          }}
                          className="w-4 h-4"
                        />
                      </TableCell>
                      <TableCell className="py-2.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const newFavorites = new Set(favoriteContracts);
                            if (isFavorite) {
                              newFavorites.delete(contract.contractId);
                            } else {
                              newFavorites.add(contract.contractId);
                            }
                            setFavoriteContracts(newFavorites);
                          }}
                          className="text-yellow-500 hover:text-yellow-600"
                        >
                          <Star className={`h-3.5 w-3.5 ${isFavorite ? 'fill-current' : ''}`} />
                        </button>
                      </TableCell>
                      <TableCell className="py-2.5">
                        <Link
                          href={`/contracts/${contract.contractId}`}
                          className="text-xs font-medium text-primary hover:text-primary/80"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {contract.contractNumber}
                        </Link>
                      </TableCell>
                      <TableCell className="py-2.5">
                        {vendorId ? (
                          <Link
                            href={`/parties/${vendorId}`}
                            className="text-xs text-primary hover:text-primary/80"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {getVendorName(contract)}
                          </Link>
                        ) : (
                          <span className="text-xs text-muted-foreground">{getVendorName(contract)}</span>
                        )}
                      </TableCell>
                      <TableCell className="py-2.5">
                        {services.length > 0 ? (
                          <Pills items={services} maxVisible={2} />
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="py-2.5">
                        <span className="text-xs text-muted-foreground">
                          {formatStartDate(contract.effectiveDate)}
                        </span>
                      </TableCell>
                      <TableCell className="py-2.5 text-right text-xs font-medium">
                        {contract.totalContractValue
                          ? formatCurrency(Number(contract.totalContractValue), contract.currency)
                          : 'N/A'}
                      </TableCell>
                      <TableCell className="py-2.5">
                        <Badge
                          variant={status.variant === 'success' ? 'default' : status.variant === 'warning' ? 'secondary' : 'outline'}
                          className={`text-xs flex items-center gap-1 ${
                            status.variant === 'success' 
                              ? 'bg-green-100 text-green-800 border-green-200' 
                              : status.variant === 'warning'
                              ? 'bg-orange-100 text-orange-800 border-orange-200'
                              : ''
                          }`}
                        >
                          <div className={`h-2 w-2 rounded-full ${
                            status.variant === 'success' 
                              ? 'bg-green-600' 
                              : status.variant === 'warning'
                              ? 'bg-orange-600'
                              : 'bg-gray-400'
                          }`} />
                          {status.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-2.5">
                        <span className="text-xs text-muted-foreground">
                          {getAutoRenewText(contract)}
                        </span>
                      </TableCell>
                      <TableCell className="py-2.5">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-2 text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditContract(contract);
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
                              handleDeleteContract(contract.contractId);
                            }}
                            disabled={deleting === contract.contractId}
                          >
                            <Trash2 className={`h-3 w-3 ${deleting === contract.contractId ? 'animate-pulse' : ''}`} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {paginatedContracts.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={10} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mb-3">
                          <FileText className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <p className="text-xs font-medium text-foreground mb-0.5">No contracts found</p>
                        <p className="text-xs text-muted-foreground">Get started by creating a new contract</p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="text-xs"
          >
            <ChevronLeft className="h-3.5 w-3.5 mr-1" />
            Previous
          </Button>
          <span className="text-xs text-muted-foreground">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="text-xs"
          >
            Next
            <ChevronRight className="h-3.5 w-3.5 ml-1" />
          </Button>
        </div>
      )}

      <ContractModal
        open={contractModalOpen}
        onOpenChange={(open) => {
          setContractModalOpen(open);
          if (!open) {
            setEditingContract(null);
          }
        }}
        contract={editingContract}
        onSuccess={() => {
          loadContracts();
          setEditingContract(null);
        }}
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
      <InvoiceUploadModal
        open={uploadModalOpen}
        onOpenChange={setUploadModalOpen}
        onSuccess={() => {
          loadContracts();
        }}
        forceDocumentType="contract"
      />
    </div>
  );
}
