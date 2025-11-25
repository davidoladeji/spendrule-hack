'use client';

import { useState, useEffect } from 'react';

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

interface PDFViewerClientProps {
  documentUrl: string;
  citations?: Citation[];
  highlightColor?: string;
}

export default function PDFViewerClient({
  documentUrl,
  citations = [],
  highlightColor = 'yellow',
}: PDFViewerClientProps) {
  const [useIframe, setUseIframe] = useState(true);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return (
      <div className="p-4 text-sm text-muted-foreground text-center">
        Initializing PDF viewer...
      </div>
    );
  }

  if (!documentUrl) {
    return (
      <div className="p-4 text-sm text-muted-foreground text-center">
        No document URL provided
      </div>
    );
  }

  // Use iframe as the primary method - more reliable and doesn't require react-pdf
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between bg-muted/50 p-4 rounded-lg border">
        <div className="flex items-center gap-2">
          <span className="text-sm text-foreground">PDF Viewer</span>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={documentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-primary hover:underline flex items-center gap-1"
          >
            Open in new tab
            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>
      </div>

      <div className="bg-background rounded-lg border overflow-hidden">
        <iframe
          src={`${documentUrl}#toolbar=1&navpanes=1&scrollbar=1`}
          className="w-full h-[600px] border-0"
          title="PDF Document"
          onError={() => {
            // If iframe fails, show download link
            setUseIframe(false);
          }}
        />
      </div>

      {citations.length > 0 && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <h3 className="font-semibold text-sm mb-2">Document Citations:</h3>
          <ul className="space-y-1 text-sm">
            {citations.map((citation, idx) => (
              <li key={idx} className="text-foreground">
                • Page {citation.pageNumber}: {citation.text || 'Extracted field'}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
