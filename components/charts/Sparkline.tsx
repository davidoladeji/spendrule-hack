'use client';

import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { cn } from '@/lib/utils';

interface SparklineProps {
  data: number[];
  className?: string;
  color?: string;
}

export function Sparkline({ data, className, color = 'hsl(var(--primary))' }: SparklineProps) {
  if (!data || data.length === 0) {
    return <div className={cn('h-8 w-full', className)} />;
  }

  const chartData = data.map((value, index) => ({ value, index }));

  return (
    <div className={cn('h-8 w-full', className)}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

