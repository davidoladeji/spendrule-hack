'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { cn } from '@/lib/utils';

interface TrendDataPoint {
  date: string;
  high: number;
  medium: number;
  low: number;
}

interface ExceptionTrendsChartProps {
  data: TrendDataPoint[];
  className?: string;
  onPointDoubleClick?: (date: string) => void;
}

export function ExceptionTrendsChart({ data, className, onPointDoubleClick }: ExceptionTrendsChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className={cn('h-64 flex items-center justify-center text-muted-foreground', className)}>
        No data available
      </div>
    );
  }

  const handleDoubleClick = (e: any) => {
    if (e && e.activePayload && e.activePayload[0] && onPointDoubleClick) {
      const date = e.activePayload[0].payload.date;
      onPointDoubleClick(date);
    }
  };

  return (
    <div className={cn('h-64', className)}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          onDoubleClick={handleDoubleClick}
          style={{ cursor: 'pointer' }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            dataKey="date"
            stroke="hsl(var(--muted-foreground))"
            style={{ fontSize: '12px' }}
          />
          <YAxis
            stroke="hsl(var(--muted-foreground))"
            style={{ fontSize: '12px' }}
            domain={[0, 100]}
            ticks={[0, 50, 100]}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--background))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '6px',
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: '12px' }}
            iconType="circle"
            formatter={(value) => {
              if (value === 'high') return 'Red';
              if (value === 'medium') return 'Yellow';
              if (value === 'low') return 'Green';
              return value;
            }}
          />
          <Line
            type="monotone"
            dataKey="high"
            stroke="#ef4444"
            strokeWidth={2}
            name="high"
            dot={{ r: 4 }}
          />
          <Line
            type="monotone"
            dataKey="medium"
            stroke="#f59e0b"
            strokeWidth={2}
            name="medium"
            dot={{ r: 4 }}
          />
          <Line
            type="monotone"
            dataKey="low"
            stroke="#10b981"
            strokeWidth={2}
            name="low"
            dot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

