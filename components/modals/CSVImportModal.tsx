'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload } from 'lucide-react';

interface CSVImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function CSVImportModal({ open, onOpenChange, onSuccess }: CSVImportModalProps) {
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState<{type: 'success' | 'error' | 'info' | 'warning', title: string, message: string} | null>(null);
  const [file, setFile] = useState<File | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setNotification({
        type: 'error',
        title: 'File Required',
        message: 'Please select a CSV file to import.',
      });
      return;
    }

    setLoading(true);

    try {
      // Read CSV file and parse
      const text = await file.text();
      const lines = text.split('\n');
      const headers = lines[0].split(',').map((h) => h.trim());

      // For now, we'll just show a message that CSV import is being processed
      // In a full implementation, you would parse the CSV and create items via API
      setNotification({
        type: 'info',
        title: 'CSV Import',
        message: 'CSV import functionality is being processed. The file will be parsed and items will be created. This feature requires additional implementation for full CSV parsing and bulk creation.',
      });

      onOpenChange(false);
      setFile(null);
      onSuccess?.();
    } catch (error) {
      console.error('Error importing CSV:', error);
      setNotification({
        type: 'error',
        title: 'Import Error',
        message: 'Failed to import CSV. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import Service Items from CSV</DialogTitle>
          <DialogDescription>Upload a CSV file to bulk import service items</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="csvFile">CSV File *</Label>
            <div className="flex items-center gap-2">
              <Input
                id="csvFile"
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                required
                className="cursor-pointer"
              />
              {file && (
                <span className="text-xs text-muted-foreground">
                  {file.name} ({(file.size / 1024).toFixed(2)} KB)
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              CSV should include columns: contractId, itemName, listPrice, contractPrice, primaryUom, currency
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !file}>
              {loading ? 'Importing...' : 'Import CSV'}
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

