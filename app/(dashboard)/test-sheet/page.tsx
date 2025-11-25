'use client';

import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function TestSheetPage() {
  const [openDefault, setOpenDefault] = useState(false);
  const [openL3, setOpenL3] = useState(false);

  return (
    <div className="space-y-4 p-4">
      <h1 className="text-lg font-semibold">Sheet Component Demo</h1>
      
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          Click the buttons below to open different Sheet component sizes
        </p>
        
        <div className="flex gap-2">
          <Sheet open={openDefault} onOpenChange={setOpenDefault}>
            <SheetTrigger asChild>
              <Button>Open Sheet (Default Size)</Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Default Sheet</SheetTitle>
                <SheetDescription>This is the default Sheet size (max-w-sm)</SheetDescription>
              </SheetHeader>
              <div className="mt-4 space-y-4">
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm">This is a default sized sheet component.</p>
                  </CardContent>
                </Card>
              </div>
            </SheetContent>
          </Sheet>

          <Sheet open={openL3} onOpenChange={setOpenL3}>
            <SheetTrigger asChild>
              <Button variant="outline">Open L3 Sheet (480px)</Button>
            </SheetTrigger>
            <SheetContent size="l3" side="right">
              <SheetHeader>
                <SheetTitle>L3 Side Panel</SheetTitle>
                <SheetDescription>
                  This is the L3 side panel with 480px width, used for entity details
                </SheetDescription>
              </SheetHeader>
              
              <div className="flex-1 overflow-y-auto py-4 space-y-3">
                <Card>
                  <CardContent className="p-4">
                    <h2 className="text-sm font-semibold mb-3">Overview</h2>
                    <div className="space-y-2 text-xs">
                      <div className="flex items-center justify-between py-1.5 border-b">
                        <span className="text-muted-foreground">Status</span>
                        <Badge variant="destructive">Failed</Badge>
                      </div>
                      <div className="flex items-center justify-between py-1.5 border-b">
                        <span className="text-muted-foreground">Amount</span>
                        <span className="font-bold text-sm text-destructive">$12,500</span>
                      </div>
                      <div className="flex items-center justify-between py-1.5">
                        <span className="text-muted-foreground">Date</span>
                        <span className="font-medium">Jan 15, 2024</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <h2 className="text-sm font-semibold mb-3">Details</h2>
                    <p className="text-xs text-muted-foreground">
                      This is a demonstration of the L3 side panel. It slides in from the right,
                      has a 480px width, and overlays the main content with a dimmed background.
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <h2 className="text-sm font-semibold mb-3">Features</h2>
                    <ul className="text-xs space-y-1 text-muted-foreground">
                      <li>• 480px fixed width</li>
                      <li>• Slides from right</li>
                      <li>• Overlay background (dimmed)</li>
                      <li>• Scrollable content</li>
                      <li>• Close button in top-right</li>
                    </ul>
                  </CardContent>
                </Card>
              </div>

              <div className="sticky bottom-0 bg-background border-t pt-4 pb-2">
                <Button className="w-full" onClick={() => setOpenL3(false)}>
                  Close Panel
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      <div className="mt-8 p-4 bg-muted/30 rounded-lg">
        <h2 className="text-sm font-semibold mb-2">How to View in Production:</h2>
        <ul className="text-xs space-y-1 text-muted-foreground">
          <li>1. Go to <code className="bg-background px-1 rounded">/exceptions</code> and click any exception row</li>
          <li>2. Go to <code className="bg-background px-1 rounded">/dashboard</code> and click a row in the Priority Queue</li>
          <li>3. Navigate directly to <code className="bg-background px-1 rounded">/exceptions/[id]</code> with a valid exception ID</li>
        </ul>
      </div>
    </div>
  );
}

