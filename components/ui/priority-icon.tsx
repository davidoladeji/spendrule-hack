'use client';

import { cn } from '@/lib/utils';

interface PriorityIconProps {
  priority: 'high' | 'medium' | 'low';
  className?: string;
}

export function PriorityIcon({ priority, className }: PriorityIconProps) {
  const colorClass = {
    high: 'bg-red-500',
    medium: 'bg-orange-500',
    low: 'bg-yellow-500',
  }[priority];

  return (
    <div
      className={cn('h-2.5 w-2.5 rounded-full', colorClass, className)}
      aria-label={`${priority} priority`}
    />
  );
}

