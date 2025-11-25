'use client';

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

interface EntityDetailPanelProps {
  open: boolean;
  onClose: () => void;
  entityType: 'invoice' | 'contract' | 'exception' | 'vendor' | 'party';
  entityId: string;
  title?: string;
  description?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}

export function EntityDetailPanel({
  open,
  onClose,
  entityType,
  entityId,
  title,
  description,
  children,
  actions,
}: EntityDetailPanelProps) {
  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent size="l3" side="right" className="overflow-y-auto">
        <SheetHeader>
          {title && <SheetTitle>{title}</SheetTitle>}
          {description && <SheetDescription>{description}</SheetDescription>}
        </SheetHeader>

        <div className="flex-1 overflow-y-auto py-4">
          {children}
        </div>

        {actions && (
          <div className="sticky bottom-0 bg-background border-t pt-4 pb-2">
            {actions}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

