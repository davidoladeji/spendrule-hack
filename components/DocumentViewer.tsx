'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { FileText, ExternalLink } from 'lucide-react';

// Dynamically import the PDF viewer to avoid SSR issues
const PDFViewer = dynamic(() => import('./PDFViewerClient'), {
  ssr: false,
  loading: () => (
    <div className="p-8 text-sm text-muted-foreground text-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
      <p>Loading PDF viewer...</p>
    </div>
  ),
});

interface Citation {
  pageNumber: number;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  text?: string;
}

interface DocumentViewerProps {
  documentUrl: string;
  citations?: Citation[];
  highlightColor?: string;
}

export default function DocumentViewer({
  documentUrl,
  citations = [],
  highlightColor = 'yellow',
}: DocumentViewerProps) {
  const [showFallback, setShowFallback] = useState(false);

  if (!documentUrl) {
    return (
      <div className="p-4 text-sm text-muted-foreground text-center border border-dashed rounded-lg">
        <FileText className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
        <p>No document URL provided</p>
      </div>
    );
  }

  // Check if URL is valid
  let isValidUrl = false;
  try {
    const url = new URL(documentUrl);
    isValidUrl = url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    isValidUrl = false;
  }

  if (!isValidUrl && !documentUrl.startsWith('/')) {
    return (
      <div className="p-4 text-sm text-destructive text-center border border-destructive rounded-lg">
        <p className="font-medium mb-2">Invalid document URL</p>
        <p className="text-xs text-muted-foreground">{documentUrl}</p>
      </div>
    );
  }

  if (showFallback) {
    return (
      <div className="p-6 text-center border border-dashed rounded-lg">
        <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <p className="text-sm font-medium mb-2">PDF Viewer Unavailable</p>
        <p className="text-xs text-muted-foreground mb-4">
          The PDF viewer could not be loaded. You can still view the document directly.
        </p>
        <Button
          size="sm"
          variant="outline"
          onClick={() => window.open(documentUrl, '_blank')}
        >
          <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
          Open PDF in New Tab
        </Button>
      </div>
    );
  }

  return (
    <div>
      <PDFViewer
        documentUrl={documentUrl}
        citations={citations}
        highlightColor={highlightColor}
      />
      <div className="mt-2 text-center">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => window.open(documentUrl, '_blank')}
          className="text-xs"
        >
          <ExternalLink className="h-3 w-3 mr-1" />
          Open in New Tab
        </Button>
      </div>
    </div>
  );
}

