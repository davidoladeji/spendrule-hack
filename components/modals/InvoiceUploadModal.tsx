'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { fetchWithAuth } from '@/lib/auth-client';
import { CheckCircle, XCircle, FileText, FileCheck } from 'lucide-react';

interface InvoiceUploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  forceDocumentType?: 'invoice' | 'contract'; // Lock document type if provided
}

export function InvoiceUploadModal({ open, onOpenChange, onSuccess, forceDocumentType }: InvoiceUploadModalProps) {
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState<'invoice' | 'contract'>(forceDocumentType || 'invoice');
  const [progress, setProgress] = useState(0);
  const [processingStatus, setProcessingStatus] = useState<string | null>(null);
  const [documentId, setDocumentId] = useState<string | null>(null);

  // Sync documentType with forceDocumentType prop
  useEffect(() => {
    if (forceDocumentType) {
      setDocumentType(forceDocumentType);
    }
  }, [forceDocumentType]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  // Poll for processing status
  useEffect(() => {
    if (!documentId || !open) return;

    let shouldContinuePolling = true;

    const pollStatus = async () => {
      if (!shouldContinuePolling) return;

      try {
        const response = await fetchWithAuth(`/api/documents/${documentId}/status`);
        
        // Handle authentication errors
        if (response.status === 401) {
          shouldContinuePolling = false;
          setProcessingStatus('Error: Authentication failed. Please refresh the page and try again.');
          setProgress(0);
          return;
        }

        if (response.ok) {
          let data;
          try {
            const responseText = await response.text();
            if (!responseText || responseText.trim() === '') {
              return; // Skip this poll if response is empty
            }
            data = JSON.parse(responseText);
          } catch (parseError) {
            console.error('Error parsing status response:', parseError);
            return; // Skip this poll if parsing fails
          }

          if (data && typeof data === 'object' && data !== null) {
            if (typeof data.progress === 'number') {
              setProgress(data.progress);
            }
            if (typeof data.stage === 'string') {
              setProcessingStatus(data.stage);
            }

            if (data.status === 'completed') {
              shouldContinuePolling = false;
              setProcessingStatus('Complete');
              setProgress(100);
              onSuccess?.();
            } else if (data.status === 'error') {
              shouldContinuePolling = false;
              const errorMsg = (data.error && typeof data.error === 'string') ? data.error : 'Processing failed';
              setProcessingStatus(`Error: ${errorMsg}`);
              setProgress(0);
            }
          }
        } else if (response.status === 403) {
          shouldContinuePolling = false;
          setProcessingStatus('Error: You do not have permission to view this document.');
          setProgress(0);
        } else if (response.status === 404) {
          shouldContinuePolling = false;
          setProcessingStatus('Error: Document not found.');
          setProgress(0);
        } else {
          // For other errors, continue polling but log the error
          console.error('Status check failed:', response.status, response.statusText);
        }
      } catch (error) {
        // Only stop polling on authentication errors
        if (error instanceof Error && error.message.includes('Not authenticated')) {
          shouldContinuePolling = false;
          setProcessingStatus('Error: Authentication failed. Please refresh the page and try again.');
          setProgress(0);
        } else {
          console.error('Error polling status:', error);
          // Continue polling for other errors
        }
      }
    };

    // Poll every 2 seconds
    const interval = setInterval(() => {
      if (shouldContinuePolling) {
        pollStatus();
      }
    }, 2000);
    pollStatus(); // Initial poll

    return () => {
      shouldContinuePolling = false;
      clearInterval(interval);
    };
  }, [documentId, open, onSuccess]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      // Show error inline - don't use nested modal
      setProcessingStatus('Error: Please select a file to upload.');
      return;
    }

    setLoading(true);
    setProgress(0);
    setProcessingStatus('Uploading...');

    try {
      if (!file) {
        setProcessingStatus('Error: Please select a file to upload.');
        setLoading(false);
        return;
      }

      const formData = new FormData();
      formData.append('file', file);
      formData.append('documentType', documentType);

      let response: Response;
      try {
        response = await fetchWithAuth('/api/documents/upload', {
          method: 'POST',
          body: formData,
        });
      } catch (fetchError) {
        console.error('Fetch error:', fetchError);
        setProcessingStatus(`Error: Failed to connect to server. Please try again.`);
        setLoading(false);
        setProgress(0);
        return;
      }

      if (!response || typeof response !== 'object') {
        setProcessingStatus('Error: Invalid response from server');
        setLoading(false);
        setProgress(0);
        return;
      }

      if (response.ok) {
        let data;
        try {
          const responseText = await response.text();
          if (!responseText || responseText.trim() === '') {
            throw new Error('Empty response from server');
          }
          data = JSON.parse(responseText);
        } catch (parseError) {
          console.error('Error parsing response:', parseError);
          setProcessingStatus('Error: Invalid response from server');
          setLoading(false);
          setProgress(0);
          return;
        }

        if (data && typeof data === 'object' && 'documentId' in data && data.documentId) {
          setDocumentId(String(data.documentId));
          setProgress(10);
          setProcessingStatus('Uploaded - Processing started');
          // Don't close modal yet - show progress
        } else {
          setProcessingStatus('Error: Invalid response from server - missing documentId');
          setLoading(false);
          setProgress(0);
        }
      } else {
        let errorMessage = 'Failed to upload document. Please check the file and try again.';
        try {
          const responseText = await response.text();
          if (responseText && responseText.trim() !== '') {
            const errorData = JSON.parse(responseText);
            if (errorData && typeof errorData === 'object' && 'error' in errorData) {
              errorMessage = String(errorData.error) || errorMessage;
            }
          }
        } catch (parseError) {
          // If JSON parsing fails, use the status text
          errorMessage = response.statusText || errorMessage;
        }
        setProcessingStatus(`Error: ${errorMessage}`);
        setLoading(false);
        setProgress(0);
      }
    } catch (error) {
      console.error('Error uploading document:', error);
      let errorMessage = 'Unknown error';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      setProcessingStatus(`Error: Failed to upload document: ${errorMessage}. Please try again.`);
      setLoading(false);
      setProgress(0);
    }
  };

  const handleClose = () => {
    if (processingStatus === 'Complete' || !processingStatus) {
      onOpenChange(false);
      setFile(null);
      setDocumentType('invoice');
      setProgress(0);
      setProcessingStatus(null);
      setDocumentId(null);
      setLoading(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Document</DialogTitle>
            <DialogDescription>Upload a contract or invoice document for processing</DialogDescription>
          </DialogHeader>
          {!processingStatus ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              {!forceDocumentType && (
                <div className="space-y-2">
                  <Label htmlFor="documentType" className="text-sm font-semibold">Document Type *</Label>
                  <p className="text-xs text-muted-foreground mb-2">
                    Select whether this document is a contract or invoice. The system will verify your selection after upload.
                  </p>
                  <Select value={documentType} onValueChange={(value: 'invoice' | 'contract') => setDocumentType(value)}>
                    <SelectTrigger className="h-11">
                      <div className="flex items-center gap-2">
                        {documentType === 'invoice' ? (
                          <FileText className="h-4 w-4" />
                        ) : (
                          <FileCheck className="h-4 w-4" />
                        )}
                        <SelectValue />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="invoice">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          <span>Invoice</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="contract">
                        <div className="flex items-center gap-2">
                          <FileCheck className="h-4 w-4" />
                          <span>Contract</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              {forceDocumentType && (
                <div className="rounded-md border p-3 bg-muted/50">
                  <div className="flex items-center gap-2 text-sm">
                    {forceDocumentType === 'invoice' ? (
                      <FileText className="h-4 w-4 text-primary" />
                    ) : (
                      <FileCheck className="h-4 w-4 text-primary" />
                    )}
                    <span className="font-medium">Document Type: {forceDocumentType === 'invoice' ? 'Invoice' : 'Contract'}</span>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="file">File *</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="file"
                    type="file"
                    accept=".pdf,.doc,.docx"
                    onChange={handleFileChange}
                    required
                    className="cursor-pointer"
                    disabled={loading}
                  />
                  {file && (
                    <span className="text-xs text-muted-foreground">
                      {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                    </span>
                  )}
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
                  Cancel
                </Button>
                <Button type="submit" disabled={loading || !file}>
                  {loading ? 'Uploading...' : 'Upload'}
                </Button>
              </DialogFooter>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Processing Status</span>
                  <span className={`font-medium ${processingStatus?.startsWith('Error') ? 'text-red-600' : processingStatus === 'Complete' ? 'text-green-600' : ''}`}>
                    {processingStatus}
                  </span>
                </div>
                {!processingStatus?.startsWith('Error') && (
                  <>
                    <Progress value={progress} />
                    <div className="text-xs text-muted-foreground text-center">
                      {progress}% complete
                    </div>
                  </>
                )}
                {processingStatus?.startsWith('Error') && (
                  <div className="rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3">
                    <div className="flex items-start gap-2">
                      <XCircle className="h-4 w-4 text-red-600 mt-0.5" />
                      <p className="text-xs text-red-800 dark:text-red-200">{processingStatus.replace('Error: ', '')}</p>
                    </div>
                  </div>
                )}
                {processingStatus === 'Complete' && (
                  <div className="rounded-md bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-3">
                    <div className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                      <p className="text-xs text-green-800 dark:text-green-200">Document has been successfully processed and is ready for review.</p>
                    </div>
                  </div>
                )}
              </div>
              {(processingStatus === 'Complete' || processingStatus?.startsWith('Error')) && (
                <DialogFooter>
                  <Button onClick={handleClose}>Close</Button>
                </DialogFooter>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

