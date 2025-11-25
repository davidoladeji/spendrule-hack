'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

interface PillsProps {
  items: string[];
  maxVisible?: number;
  className?: string;
}

export function Pills({ items, maxVisible = 2, className }: PillsProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  if (!items || items.length === 0) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  const visibleItems = items.slice(0, maxVisible);
  const remainingCount = items.length - maxVisible;
  const hasMore = remainingCount > 0;

  return (
    <div
      className={cn('flex items-center gap-1 flex-wrap', className)}
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
    >
      {(isExpanded ? items : visibleItems).map((item, idx) => (
        <span
          key={idx}
          className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-secondary text-secondary-foreground"
        >
          {item}
        </span>
      ))}
      {hasMore && !isExpanded && (
        <span className="text-xs text-muted-foreground">
          +{remainingCount} more
        </span>
      )}
    </div>
  );
}

