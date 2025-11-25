'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { fetchWithAuth } from '@/lib/auth-client';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PriorityIcon } from '@/components/ui/priority-icon';
import { AlertCircle, CheckCircle, XCircle, ArrowUp } from 'lucide-react';

interface Exception {
  exceptionId: string;
  exceptionType: string;
  severity: string;
  message: string;
  varianceAmount: number;
  validation: {
    invoice: {
      invoiceId: string;
      invoiceNumber: string;
      vendorParty: { legalName: string; partyId?: string };
    };
  };
}

export default function ExceptionsPage() {
  const router = useRouter();
  const [exceptions, setExceptions] = useState<Exception[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unresolved'>('unresolved');

  useEffect(() => {
    loadExceptions();
  }, [filter]);

  const loadExceptions = async () => {
    try {
      const url = filter === 'unresolved' ? '/api/exceptions?resolved=false' : '/api/exceptions';
      const response = await fetchWithAuth(url);
      if (response.ok) {
        const data = await response.json();
        setExceptions(data.exceptions || []);
      }
    } catch (error) {
      console.error('Error loading exceptions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async (exceptionId: string) => {
    try {
      const response = await fetchWithAuth(`/api/exceptions/${exceptionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolved: true }),
      });
      if (response.ok) {
        loadExceptions();
      }
    } catch (error) {
      console.error('Error resolving exception:', error);
    }
  };

  const handleRowClick = (exceptionId: string) => {
    // Open L3 panel (navigate to detail page which is now a Sheet)
    router.push(`/exceptions/${exceptionId}`);
  };

  const handleRowDoubleClick = (exceptionId: string) => {
    router.push(`/exceptions/${exceptionId}`);
  };

  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) {
      return `$${(amount / 1000000).toFixed(2)}M`;
    }
    return `$${(amount / 1000).toFixed(0)}K`;
  };

  const getPriority = (severity: string): 'high' | 'medium' | 'low' => {
    if (severity === 'High') return 'high';
    if (severity === 'Medium') return 'medium';
    return 'low';
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
          <h1 className="text-lg font-semibold text-foreground">Validation Exceptions</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Review and resolve validation exceptions</p>
        </div>
        <div className="flex gap-1.5">
          <Button
            size="sm"
            variant={filter === 'unresolved' ? 'default' : 'outline'}
            onClick={() => setFilter('unresolved')}
          >
            Unresolved
          </Button>
          <Button
            size="sm"
            variant={filter === 'all' ? 'default' : 'outline'}
            onClick={() => setFilter('all')}
          >
            All
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-3">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs w-12">Priority</TableHead>
                  <TableHead className="text-xs">Type</TableHead>
                  <TableHead className="text-xs">Vendor</TableHead>
                  <TableHead className="text-xs">Invoice</TableHead>
                  <TableHead className="text-xs">Issue</TableHead>
                  <TableHead className="text-xs text-right">Impact</TableHead>
                  <TableHead className="text-xs">Severity</TableHead>
                  <TableHead className="text-xs">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {exceptions.map((exception) => (
                  <TableRow
                    key={exception.exceptionId}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleRowClick(exception.exceptionId)}
                    onDoubleClick={() => handleRowDoubleClick(exception.exceptionId)}
                  >
                    <TableCell className="py-2.5">
                      <PriorityIcon priority={getPriority(exception.severity)} />
                    </TableCell>
                    <TableCell className="py-2.5">
                      <span className="text-xs font-medium">{exception.exceptionType}</span>
                    </TableCell>
                    <TableCell className="py-2.5">
                      {exception.validation.invoice.vendorParty?.partyId ? (
                        <Link
                          href={`/parties/${exception.validation.invoice.vendorParty.partyId}`}
                          className="text-xs text-primary hover:text-primary/80"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {exception.validation.invoice.vendorParty?.legalName || 'N/A'}
                        </Link>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {exception.validation.invoice.vendorParty?.legalName || 'N/A'}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="py-2.5">
                      <Link
                        href={`/invoices/${exception.validation.invoice.invoiceId}`}
                        className="text-xs text-primary hover:text-primary/80 font-medium"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {exception.validation.invoice.invoiceNumber ||
                          exception.validation.invoice.invoiceId.substring(0, 8)}
                      </Link>
                    </TableCell>
                    <TableCell className="py-2.5 text-xs text-muted-foreground max-w-xs truncate">
                      {exception.message}
                    </TableCell>
                    <TableCell className="py-2.5 text-right">
                      <span
                        className={`text-xs font-semibold ${
                          exception.varianceAmount >= 10000 ? 'text-destructive' : 'text-foreground'
                        }`}
                      >
                        {formatCurrency(exception.varianceAmount || 0)}
                      </span>
                    </TableCell>
                    <TableCell className="py-2.5">
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
                    </TableCell>
                    <TableCell className="py-2.5">
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="px-2 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleResolve(exception.exceptionId);
                          }}
                        >
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Resolve
                        </Button>
                        <Link
                          href={`/exceptions/${exception.exceptionId}`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Button size="sm" variant="ghost" className="px-2 text-xs">
                            View
                          </Button>
                        </Link>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {exceptions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <AlertCircle className="h-8 w-8 text-muted-foreground mb-2" />
                        <p className="text-xs font-medium text-foreground mb-0.5">No exceptions found</p>
                        <p className="text-xs text-muted-foreground">All exceptions have been resolved</p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
