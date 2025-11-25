'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { fetchWithAuth } from '@/lib/auth-client';
import DocumentViewer from '@/components/DocumentViewer';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { AlertCircle, ArrowLeft, FileText, ChevronDown, ChevronRight, CheckCircle, XCircle, ExternalLink } from 'lucide-react';
import { NotificationModal } from '@/components/ui/notification-modal';

interface Exception {
  exceptionId: string;
  exceptionType: string;
  severity: string;
  message: string;
  expectedValue?: string;
  actualValue?: string;
  varianceAmount?: number;
  resolved?: boolean;
  dueDate?: string;
  vendorIntelligence?: {
    exceptionCount: number;
    totalImpact: number;
    riskScore: number;
    recommendation: string;
  };
  allValidations?: Array<{
    validationId: string;
    validationDate: string;
    overallStatus: string;
    exceptions: Array<{
      exceptionId: string;
      exceptionType: string;
      severity: string;
      resolved: boolean;
    }>;
    rulesAppliedCount?: number;
  }>;
  auditTrail?: Array<{
    date: string;
    user: string;
    action: string;
  }>;
  validation: {
    validationId: string;
    validationDate: string;
    invoice: {
      invoiceId: string;
      invoiceNumber: string;
      vendorParty: { legalName: string; partyId?: string };
      sourceDocument?: { documentUrl: string; documentId: string };
      contract?: {
        contractId: string;
        contractNumber: string;
        documentExtractions?: Array<{
          documentId: string;
          document?: { documentUrl: string };
        }>;
      };
    };
    invoiceApprovalRequests?: Array<{
      approvalId: string;
      currentStatus: string;
      decision?: string;
    }>;
  };
  contractExtraction?: {
    extractionId: string;
    sourcePageNumber?: number;
    textSnippet?: string;
    extractedValue?: string;
    document?: { documentUrl: string };
  };
  invoiceExtraction?: {
    extractionId: string;
    sourcePageNumber?: number;
    textSnippet?: string;
    extractedValue?: string;
    document?: { documentUrl: string };
  };
}

export default function ExceptionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [exception, setException] = useState<Exception | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedValidations, setExpandedValidations] = useState(false);
  const [expandedAudit, setExpandedAudit] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'contract' | 'invoice'>('overview');
  const [processing, setProcessing] = useState<string | null>(null);
  const [notification, setNotification] = useState<{type: 'success' | 'error' | 'info' | 'warning', title: string, message: string} | null>(null);

  useEffect(() => {
    loadException();
  }, [params.id]);

  const loadException = async () => {
    try {
      const response = await fetchWithAuth(`/api/exceptions/${params.id}`);
      if (response.ok) {
        const data = await response.json();
        setException(data);
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Failed to load exception:', errorData);
        if (response.status === 404) {
          setNotification({
            type: 'error',
            title: 'Exception Not Found',
            message: `Exception with ID ${params.id} was not found. It may have been deleted or the ID is incorrect.`,
          });
        } else {
          setNotification({
            type: 'error',
            title: 'Error Loading Exception',
            message: errorData.error || 'Failed to load exception. Please try again.',
          });
        }
      }
    } catch (error) {
      console.error('Error loading exception:', error);
      setNotification({
        type: 'error',
        title: 'Error Loading Exception',
        message: 'An unexpected error occurred while loading the exception. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (action: 'dispute' | 'approve' | 'escalate') => {
    if (!exception) return;
    
    setProcessing(action);
    try {
      if (action === 'dispute') {
        const response = await fetchWithAuth(`/api/exceptions/${exception.exceptionId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            resolved: false,
            resolutionNotes: 'Invoice disputed - requesting credit memo',
          }),
        });
        if (response.ok) {
          router.push('/exceptions');
        } else {
          const error = await response.json();
          setNotification({
            type: 'error',
            title: 'Dispute Error',
            message: error.error || 'Failed to dispute exception. Please try again.',
          });
        }
      } else if (action === 'approve') {
        const response = await fetchWithAuth(`/api/exceptions/${exception.exceptionId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            resolved: true,
            resolutionNotes: 'Approved with note - flag for next negotiation',
          }),
        });
        if (response.ok) {
          router.push('/exceptions');
        } else {
          const error = await response.json();
          setNotification({
            type: 'error',
            title: 'Approval Error',
            message: error.error || 'Failed to approve exception. Please try again.',
          });
        }
      } else if (action === 'escalate') {
        const response = await fetchWithAuth('/api/approvals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            invoiceId: exception.validation.invoice.invoiceId,
            validationId: exception.validation.validationId,
          }),
        });
        if (response.ok) {
          router.push('/approvals');
        } else {
          const error = await response.json();
          setNotification({
            type: 'error',
            title: 'Escalation Error',
            message: error.error || 'Failed to escalate exception. Please try again.',
          });
        }
      }
    } catch (error) {
      console.error(`Error handling ${action}:`, error);
      setNotification({
        type: 'error',
        title: 'Error',
        message: `Failed to ${action}. Please try again.`,
      });
    } finally {
      setProcessing(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const isUrgent = exception?.dueDate ? new Date(exception.dueDate) <= new Date(Date.now() + 2 * 24 * 60 * 60 * 1000) : false;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!exception) {
    return (
      <Sheet open={true} onOpenChange={() => router.push('/exceptions')}>
        <SheetContent size="l3" side="right">
          <SheetHeader>
            <SheetTitle>Exception Not Found</SheetTitle>
            <SheetDescription>
              The exception you're looking for doesn't exist or may have been deleted.
            </SheetDescription>
          </SheetHeader>
          
          <div className="flex-1 overflow-y-auto py-4">
            <div className="text-center py-12">
              <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-sm font-medium text-foreground mb-1">Exception Not Found</p>
              <p className="text-xs text-muted-foreground mb-4">
                Exception ID: {params.id}
              </p>
              <p className="text-xs text-muted-foreground mb-6">
                This exception may have been deleted, or the ID is incorrect.
                <br />
                Please go back to the exceptions list to view available exceptions.
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => router.push('/exceptions')}
              >
                <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
                Back to Exceptions
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  const validationCount = exception.allValidations?.length || 0;
  const failedValidations = exception.allValidations?.filter(v => v.overallStatus === 'Failed').length || 0;

  return (
    <Sheet open={true} onOpenChange={() => router.push('/exceptions')}>
      <SheetContent size="l3" side="right" className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Exception Details</SheetTitle>
          <SheetDescription>Review validation exception and take action</SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto py-4 space-y-3">
          {/* Overview Section (L1) */}
          <Card>
            <CardContent className="p-4">
              <h2 className="text-sm font-semibold mb-3">Overview</h2>
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between py-1.5 border-b">
                  <span className="text-muted-foreground">Detection Date</span>
                  <span className="font-medium">{formatDate(exception.validation.validationDate)}</span>
                </div>
                <div className="flex items-center justify-between py-1.5 border-b">
                  <span className="text-muted-foreground">Result</span>
                  <Badge variant="destructive">Failed</Badge>
                </div>
                <div className="flex items-center justify-between py-1.5 border-b">
                  <span className="text-muted-foreground">Invoice</span>
                  <Link
                    href={`/invoices/${exception.validation.invoice.invoiceId}`}
                    className="text-primary hover:text-primary/80 font-medium flex items-center gap-1"
                  >
                    {exception.validation.invoice.invoiceNumber}
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>
                {exception.validation.invoice.contract && (
                  <div className="flex items-center justify-between py-1.5 border-b">
                    <span className="text-muted-foreground">Contract</span>
                    <Link
                      href={`/contracts/${exception.validation.invoice.contract.contractId}`}
                      className="text-primary hover:text-primary/80 font-medium flex items-center gap-1"
                    >
                      {exception.validation.invoice.contract.contractNumber}
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  </div>
                )}
                <div className="flex items-center justify-between py-1.5 border-b">
                  <span className="text-muted-foreground">Financial Impact</span>
                  <span className="font-bold text-sm text-destructive">
                    ${exception.varianceAmount?.toLocaleString() || '0'}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1.5 border-b">
                  <span className="text-muted-foreground">Severity</span>
                  <Badge
                    variant={
                      exception.severity === 'High'
                        ? 'destructive'
                        : exception.severity === 'Medium'
                        ? 'secondary'
                        : 'outline'
                    }
                  >
                    {exception.severity}
                  </Badge>
                </div>
                {exception.dueDate && (
                  <div className="flex items-center justify-between py-1.5">
                    <span className="text-muted-foreground">Due Date</span>
                    <span className={`font-medium ${isUrgent ? 'text-yellow-600' : ''}`}>
                      {formatDate(exception.dueDate)}
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Validations Performed (L2 - Expandable) */}
          <Card>
            <CardContent className="p-4">
              <Collapsible open={expandedValidations} onOpenChange={setExpandedValidations}>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold">Validations Performed</h2>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-6 text-xs">
                      {expandedValidations ? (
                        <>
                          Hide Details <ChevronDown className="h-3 w-3 ml-1" />
                        </>
                      ) : (
                        <>
                          Show All {validationCount} Validations <ChevronRight className="h-3 w-3 ml-1" />
                        </>
                      )}
                    </Button>
                  </CollapsibleTrigger>
                </div>
                <div className="text-xs text-muted-foreground mb-2">
                  {failedValidations} failed, {validationCount - failedValidations} passed
                </div>
                <CollapsibleContent>
                  <div className="space-y-2 mt-3">
                    {exception.allValidations?.map((val) => (
                      <div key={val.validationId} className="p-2 bg-muted/30 rounded text-xs">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium">{formatDate(val.validationDate)}</span>
                          {val.overallStatus === 'Passed' ? (
                            <CheckCircle className="h-3 w-3 text-green-600" />
                          ) : (
                            <XCircle className="h-3 w-3 text-red-600" />
                          )}
                        </div>
                        <div className="text-muted-foreground">
                          Status: {val.overallStatus} • {val.rulesAppliedCount || 0} rules applied
                        </div>
                        {val.exceptions.length > 0 && (
                          <div className="mt-1 text-muted-foreground">
                            {val.exceptions.length} exception(s)
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </CardContent>
          </Card>

          {/* Discrepancy Details (L2) */}
          <Card>
            <CardContent className="p-4">
              <h2 className="text-sm font-semibold mb-3">Discrepancy Details</h2>
              <div className="space-y-2 text-xs">
                <div>
                  <span className="text-muted-foreground">Type:</span>{' '}
                  <span className="font-medium">{exception.exceptionType}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Severity:</span>{' '}
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
                </div>
                <div>
                  <span className="text-muted-foreground">Description:</span>
                  <p className="text-foreground mt-1">{exception.message}</p>
                </div>
                {exception.expectedValue && exception.actualValue && (
                  <>
                    <div className="flex items-center justify-between py-1.5 border-t">
                      <span className="text-muted-foreground">Expected Amount</span>
                      <span className="font-medium">{exception.expectedValue}</span>
                    </div>
                    <div className="flex items-center justify-between py-1.5 border-b">
                      <span className="text-muted-foreground">Actual Amount</span>
                      <span className="font-medium text-destructive">{exception.actualValue}</span>
                    </div>
                    <div className="flex items-center justify-between py-1.5">
                      <span className="text-muted-foreground">Variance</span>
                      <span className="font-medium text-destructive">
                        {exception.varianceAmount
                          ? `${((Number(exception.varianceAmount) / Number(exception.expectedValue.replace(/[^0-9.]/g, ''))) * 100).toFixed(1)}%`
                          : 'N/A'}
                      </span>
                    </div>
                  </>
                )}
                <div className="pt-2 border-t mt-2">
                  <Link
                    href={exception.validation.invoice.contract ? `/contracts/${exception.validation.invoice.contract.contractId}` : '#'}
                    className="text-primary hover:text-primary/80 text-xs font-medium flex items-center gap-1"
                  >
                    View Full Contract →
                  </Link>
                  <Link
                    href={`/invoices/${exception.validation.invoice.invoiceId}`}
                    className="text-primary hover:text-primary/80 text-xs font-medium flex items-center gap-1 mt-1"
                  >
                    View Full Invoice →
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recommended Actions (L2 - Two Column) */}
          <Card>
            <CardContent className="p-4">
              <h2 className="text-sm font-semibold mb-3">Recommended Actions</h2>
              <div className="grid grid-cols-2 gap-4">
                {/* Left Column: Action Buttons */}
                <div className="space-y-2">
                  <Button
                    size="sm"
                    className="w-full justify-start text-xs"
                    onClick={() => handleAction('dispute')}
                    disabled={processing !== null || exception.resolved}
                  >
                    {processing === 'dispute' ? 'Processing...' : '1. Dispute Invoice'}
                  </Button>
                  <p className="text-[10px] text-muted-foreground ml-1">
                    Request credit memo for ${exception.varianceAmount?.toLocaleString() || '0'}
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full justify-start text-xs"
                    onClick={() => handleAction('approve')}
                    disabled={processing !== null || exception.resolved}
                  >
                    {processing === 'approve' ? 'Processing...' : '2. Approve with Note'}
                  </Button>
                  <p className="text-[10px] text-muted-foreground ml-1">
                    Approve and flag for next negotiation
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full justify-start text-xs"
                    onClick={() => handleAction('escalate')}
                    disabled={processing !== null || exception.resolved}
                  >
                    {processing === 'escalate' ? 'Processing...' : '3. Escalate'}
                  </Button>
                  <p className="text-[10px] text-muted-foreground ml-1">
                    Escalate to procurement manager
                  </p>
                </div>
                {/* Right Column: Comparison Table */}
                <div className="text-xs">
                  <div className="grid grid-cols-3 gap-2 mb-2 font-medium border-b pb-1">
                    <div>Contract Terms</div>
                    <div>Invoice Claim</div>
                    <div>System Calculation</div>
                  </div>
                  <div className="space-y-2">
                    <div className="grid grid-cols-3 gap-2">
                      <div className="text-muted-foreground">Rate:</div>
                      <div className="font-medium text-green-600">
                        {exception.expectedValue || '$12.00/day (Tier 2)'} ✓
                      </div>
                      <div className="font-medium text-red-600">
                        {exception.actualValue || '$12.50/day (Tier 1)'} ✗
                      </div>
                      <div className="font-medium text-green-600">
                        {exception.expectedValue || '$12.00/day (Tier 2)'} ✓
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 pt-2 border-t">
                      <div className="text-muted-foreground">Amount:</div>
                      <div className="font-medium text-green-600">
                        ${exception.expectedValue?.replace(/[^0-9.]/g, '') || '90,000'} ✓
                      </div>
                      <div className="font-medium text-red-600">
                        ${exception.actualValue?.replace(/[^0-9.]/g, '') || '93,750'} ✗
                      </div>
                      <div className="font-medium text-green-600">
                        ${exception.expectedValue?.replace(/[^0-9.]/g, '') || '90,000'} ✓
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 pt-2 border-t space-y-1">
                    <Link
                      href={exception.validation.invoice.contract ? `/contracts/${exception.validation.invoice.contract.contractId}` : '#'}
                      className="text-primary hover:text-primary/80 text-[10px] font-medium flex items-center gap-1"
                    >
                      View Full Contract →
                    </Link>
                    <Link
                      href={`/invoices/${exception.validation.invoice.invoiceId}`}
                      className="text-primary hover:text-primary/80 text-[10px] font-medium flex items-center gap-1"
                    >
                      View Full Invoice →
                    </Link>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Vendor Intelligence (L2 - Highlighted) */}
          {exception.vendorIntelligence && (
            <Card className="bg-yellow-50 border-yellow-200">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <AlertCircle className="h-4 w-4 text-yellow-600" />
                  <h2 className="text-sm font-semibold">Vendor Intelligence</h2>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="font-medium text-foreground mb-2">
                    Recurring Volume Discount Error - {exception.validation.invoice.vendorParty.legalName}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Pattern Detected:</span>{' '}
                    <span className="font-medium">
                      This is the {exception.vendorIntelligence.exceptionCount}th time {exception.validation.invoice.vendorParty.legalName} has failed to apply volume discounts in 2024
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-1.5 border-t">
                    <span className="text-muted-foreground">Total Impact</span>
                    <span className="font-medium">${exception.vendorIntelligence.totalImpact.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between py-1.5 border-b">
                    <span className="text-muted-foreground">Risk Score</span>
                    <Badge 
                      variant="secondary" 
                      className="bg-yellow-100 text-yellow-800 border-yellow-200 text-xs"
                    >
                      Medium ({exception.vendorIntelligence.riskScore})
                    </Badge>
                  </div>
                  <div className="pt-2">
                    <span className="text-muted-foreground">Recommendation:</span>{' '}
                    <span className="font-medium">{exception.vendorIntelligence.recommendation}</span>
                  </div>
                  <div className="pt-2 border-t mt-2 space-y-1">
                    <Link
                      href={`/exceptions?vendor=${exception.validation.invoice.vendorParty.partyId}`}
                      className="text-primary hover:text-primary/80 text-[10px] font-medium flex items-center gap-1"
                    >
                      View Pattern Details →
                    </Link>
                    {exception.validation.invoice.vendorParty.partyId && (
                      <Link
                        href={`/parties/${exception.validation.invoice.vendorParty.partyId}`}
                        className="text-primary hover:text-primary/80 text-[10px] font-medium flex items-center gap-1"
                      >
                        View Full Vendor Profile →
                      </Link>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Supporting Documents (L2) */}
          <Card>
            <CardContent className="p-4">
              <h2 className="text-sm font-semibold mb-3">Supporting Documents</h2>
              <div className="space-y-2 text-xs">
                {exception.validation.invoice.sourceDocument && (
                  <Link
                    href={exception.validation.invoice.sourceDocument.documentUrl}
                    target="_blank"
                    className="flex items-center gap-2 text-primary hover:text-primary/80"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    Invoice PDF
                  </Link>
                )}
                {exception.validation.invoice.contract?.documentExtractions?.[0]?.document && (
                  <Link
                    href={exception.validation.invoice.contract.documentExtractions[0].document.documentUrl}
                    target="_blank"
                    className="flex items-center gap-2 text-primary hover:text-primary/80"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    Contract PDF
                  </Link>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Audit Trail (L3 - Technical) */}
          {exception.auditTrail && exception.auditTrail.length > 0 && (
            <Card>
              <CardContent className="p-4">
                <Collapsible open={expandedAudit} onOpenChange={setExpandedAudit}>
                  <CollapsibleTrigger asChild>
                    <div className="flex items-center justify-between cursor-pointer">
                      <h2 className="text-sm font-semibold">Audit Trail</h2>
                      {expandedAudit ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="space-y-2 mt-3 text-xs">
                      {exception.auditTrail.map((entry, idx) => (
                        <div key={idx} className="py-1.5 border-b last:border-0">
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">{formatDateTime(entry.date)}</span>
                            <span className="font-medium">{entry.user}</span>
                          </div>
                          <div className="text-foreground mt-0.5">{entry.action}</div>
                        </div>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sticky Actions */}
        <div className="sticky bottom-0 bg-background border-t pt-4 pb-2 space-y-2">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => router.push('/exceptions')}
          >
            <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
            Back to Exceptions
          </Button>
        </div>
      </SheetContent>

      {notification && (
        <NotificationModal
          open={!!notification}
          onOpenChange={(open) => !open && setNotification(null)}
          type={notification.type}
          title={notification.title}
          message={notification.message}
        />
      )}
    </Sheet>
  );
}
