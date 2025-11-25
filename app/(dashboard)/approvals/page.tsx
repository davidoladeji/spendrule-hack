'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchWithAuth } from '@/lib/auth-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, ArrowUp, Settings } from 'lucide-react';
import { NotificationModal } from '@/components/ui/notification-modal';

interface Approval {
  approvalId: string;
  invoice: {
    invoiceId: string;
    invoiceNumber: string;
    vendorParty: { legalName: string };
    grossAmount: number;
    currency: string;
  };
  currentStatus: string;
  currentLevel: number;
  approvalLevel: { levelName: string; thresholdAmount: number };
  assignedToUser?: string;
  assignedToRole?: string;
  requiredByDate: string;
}

export default function ApprovalsPage() {
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [notification, setNotification] = useState<{type: 'success' | 'error' | 'info' | 'warning', title: string, message: string} | null>(null);

  useEffect(() => {
    loadApprovals();
  }, []);

  const loadApprovals = async () => {
    try {
      const response = await fetchWithAuth('/api/approvals');
      if (response.ok) {
        const data = await response.json();
        setApprovals(data.approvals || []);
      }
    } catch (error) {
      console.error('Error loading approvals:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (approvalId: string) => {
    setProcessing(approvalId);
    try {
      const response = await fetchWithAuth(`/api/approvals/${approvalId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision: 'Approve',
          comments: 'Approved by user',
        }),
      });
      if (response.ok) {
        loadApprovals();
      } else {
        const error = await response.json();
        console.error('Failed to approve:', error);
        setNotification({
          type: 'error',
          title: 'Approval Error',
          message: error.error || 'Failed to approve. Please try again.',
        });
      }
    } catch (error) {
      console.error('Error approving:', error);
      setNotification({
        type: 'error',
        title: 'Approval Error',
        message: 'Failed to approve. Please try again.',
      });
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (approvalId: string) => {
    setProcessing(approvalId);
    try {
      const response = await fetchWithAuth(`/api/approvals/${approvalId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision: 'Reject',
          rejectionReason: 'Rejected by user',
          comments: 'Rejected by user',
        }),
      });
      if (response.ok) {
        loadApprovals();
      } else {
        const error = await response.json();
        console.error('Failed to reject:', error);
        setNotification({
          type: 'error',
          title: 'Rejection Error',
          message: error.error || 'Failed to reject. Please try again.',
        });
      }
    } catch (error) {
      console.error('Error rejecting:', error);
      setNotification({
        type: 'error',
        title: 'Rejection Error',
        message: 'Failed to reject. Please try again.',
      });
    } finally {
      setProcessing(null);
    }
  };

  const handleEscalate = async (approvalId: string) => {
    setProcessing(approvalId);
    try {
      const response = await fetchWithAuth(`/api/approvals/${approvalId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision: 'Escalate',
          comments: 'Escalated to next level',
        }),
      });
      if (response.ok) {
        loadApprovals();
      } else {
        const error = await response.json();
        console.error('Failed to escalate:', error);
        setNotification({
          type: 'error',
          title: 'Escalation Error',
          message: error.error || 'Failed to escalate. Please try again.',
        });
      }
    } catch (error) {
      console.error('Error escalating:', error);
      setNotification({
        type: 'error',
        title: 'Escalation Error',
        message: 'Failed to escalate. Please try again.',
      });
    } finally {
      setProcessing(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const pendingCount = approvals.filter((a) => a.currentStatus === 'Pending').length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Approval Workflows</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Configure limits and view active queues</p>
        </div>
        <Button size="sm" variant="outline">
          <Settings className="h-3.5 w-3.5 mr-1.5" />
          Global Settings
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Approval Thresholds</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
            <div className="p-3 border rounded-md bg-muted/30">
              <h3 className="text-xs font-semibold mb-1">Stage 1: AP Clerk</h3>
              <p className="text-xs text-muted-foreground">$0 - $1,000</p>
            </div>
            <div className="p-3 border rounded-md bg-muted/30">
              <h3 className="text-xs font-semibold mb-1">Stage 2: Department Head</h3>
              <p className="text-xs text-muted-foreground">$1,001 - $10,000</p>
            </div>
            <div className="p-3 border rounded-md bg-muted/30">
              <h3 className="text-xs font-semibold mb-1">Stage 3: CFO / VP</h3>
              <p className="text-xs text-muted-foreground">$10,001 - ∞</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Active Requests</CardTitle>
            {pendingCount > 0 && (
              <Badge variant="secondary" className="text-xs">
                {pendingCount} Pending
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-3">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Invoice</TableHead>
                  <TableHead className="text-xs">Vendor</TableHead>
                  <TableHead className="text-xs">Current Stage</TableHead>
                  <TableHead className="text-xs">Amount</TableHead>
                  <TableHead className="text-xs">Due Date</TableHead>
                  <TableHead className="text-xs">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {approvals.map((approval) => (
                  <TableRow key={approval.approvalId}>
                    <TableCell className="py-2.5">
                      <Link
                        href={`/invoices/${approval.invoice.invoiceId}`}
                        className="text-xs font-medium text-primary hover:text-primary/80"
                      >
                        {approval.invoice.invoiceNumber || approval.invoice.invoiceId.substring(0, 8)}
                      </Link>
                    </TableCell>
                    <TableCell className="py-2.5 text-xs text-muted-foreground">
                      {approval.invoice.vendorParty?.legalName || 'N/A'}
                    </TableCell>
                    <TableCell className="py-2.5">
                      <Badge variant="secondary" className="text-xs">
                        {approval.approvalLevel.levelName}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-2.5 text-xs font-medium">
                      {approval.invoice.currency} {approval.invoice.grossAmount.toLocaleString()}
                    </TableCell>
                    <TableCell className="py-2.5 text-xs text-muted-foreground">
                      {new Date(approval.requiredByDate).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="py-2.5">
                      <div className="flex items-center gap-1">
                        {approval.currentStatus === 'Pending' && (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              size="sm"
                              variant="ghost"
                              className="px-2 text-xs"
                              onClick={() => handleApprove(approval.approvalId)}
                              disabled={processing === approval.approvalId}
                            >
                              <CheckCircle className="h-3 w-3 mr-1" />
                              {processing === approval.approvalId ? '...' : 'Approve'}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              size="sm"
                              variant="ghost"
                              className="px-2 text-xs"
                              onClick={() => handleReject(approval.approvalId)}
                              disabled={processing === approval.approvalId}
                            >
                              <XCircle className="h-3 w-3 mr-1" />
                              {processing === approval.approvalId ? '...' : 'Reject'}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              size="sm"
                              variant="ghost"
                              className="px-2 text-xs"
                              onClick={() => handleEscalate(approval.approvalId)}
                              disabled={processing === approval.approvalId}
                            >
                              <ArrowUp className="h-3 w-3 mr-1" />
                              {processing === approval.approvalId ? '...' : 'Escalate'}
                            </Button>
                          </>
                        )}
                        <Link href={`/approvals/${approval.approvalId}`}>
                          <Button size="sm" variant="ghost" className="px-2 text-xs">
                            View
                          </Button>
                        </Link>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {approvals.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <CheckCircle className="h-8 w-8 text-muted-foreground mb-2" />
                        <p className="text-xs font-medium text-foreground mb-0.5">No active approval requests</p>
                        <p className="text-xs text-muted-foreground">All approvals have been processed</p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
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
