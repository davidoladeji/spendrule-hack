'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchWithAuth, getStoredTokens } from '@/lib/auth-client';
import { hasPermission } from '@/lib/permissions';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowUp, ArrowDown, TrendingUp, AlertCircle, Bell, DollarSign, BarChart3 } from 'lucide-react';
import { NotificationModal } from '@/components/ui/notification-modal';
import { PriorityIcon } from '@/components/ui/priority-icon';
import { Sparkline } from '@/components/charts/Sparkline';
import { ExceptionTrendsChart } from '@/components/charts/ExceptionTrendsChart';

interface DashboardStats {
  todaysPreventedOverpayments: number;
  monthToDatePrevented: number;
  ytdRealizedSavings: number;
  ytdSavingsGoal: number;
  ytdSavingsProgress: number;
  ytdSavingsMoMChange: number;
  spendMonitored: number;
  totalSpend: number;
  spendMonitoredPercent: number;
  autoApprovalRate: number;
  autoApprovalTrend: 'up' | 'down';
  openExceptionsOver10k: number;
  previousExceptionsOver10k: number;
  criticalExceptionsCount: number;
  complianceRate: number;
  complianceTrend: 'up' | 'down';
  activeContractsCount: number;
  complianceSparklineData: number[];
  savingsWaterfall: {
    priceVariance: number;
    quantity: number;
    wrongItem: number;
    duplicate: number;
    other: number;
    total: number;
  };
  contractExpirations: {
    days0to90: { count: number; totalSpend: number };
    days91to180: { count: number; totalSpend: number };
    daysOver180: { count: number; totalSpend: number };
  };
}

interface PriorityQueueItem {
  exceptionId: string;
  priority: 'high' | 'medium' | 'low';
  type: string;
  vendor: {
    partyId?: string;
    name: string;
  };
  issue: string;
  impact: number;
  dueDate: string;
  daysUntilDue: number;
  isUrgent: boolean;
  severity: string;
  invoiceId: string;
  invoiceNumber: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [priorityQueue, setPriorityQueue] = useState<PriorityQueueItem[]>([]);
  const [exceptionTrends, setExceptionTrends] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState<string>('');
  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'info' | 'warning';
    title: string;
    message: string;
  } | null>(null);

  useEffect(() => {
    // Get user name from stored tokens
    const tokens = getStoredTokens();
    if (tokens?.user) {
      setUserName(tokens.user.firstName || tokens.user.email.split('@')[0] || 'User');
    }

    // Only fetch dashboard stats if user has permission
    if (!hasPermission('dashboard:view')) {
      setLoading(false);
      return;
    }

    // Fetch all dashboard data
    const loadDashboard = async () => {
      try {
        const [statsRes, queueRes, trendsRes] = await Promise.all([
          fetchWithAuth('/api/dashboard/stats'),
          fetchWithAuth('/api/dashboard/priority-queue'),
          fetchWithAuth('/api/dashboard/exception-trends'),
        ]);

        if (statsRes.ok) {
          const statsData = await statsRes.json();
          setStats(statsData);
        }

        if (queueRes.ok) {
          const queueData = await queueRes.json();
          setPriorityQueue(queueData.queue || []);
        }

        if (trendsRes.ok) {
          const trendsData = await trendsRes.json();
          setExceptionTrends(trendsData.trends || []);
        }
      } catch (error) {
        console.error('Error loading dashboard:', error);
        setNotification({
          type: 'error',
          title: 'Error Loading Dashboard',
          message: 'An unexpected error occurred. Please try again later.',
        });
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, []);

  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) {
      return `$${(amount / 1000000).toFixed(2)}M`;
    }
    return `$${(amount / 1000).toFixed(0)}K`;
  };

  const formatLargeCurrency = (amount: number) => {
    if (amount >= 1000000) {
      return `$${(amount / 1000000).toFixed(2)}M`;
    }
    return `$${amount.toLocaleString()}`;
  };

  const formatRelativeDate = (daysUntilDue: number) => {
    if (daysUntilDue < 0) return 'Overdue';
    if (daysUntilDue === 0) return 'Today';
    if (daysUntilDue === 1) return 'Tomorrow';
    return `${daysUntilDue} days`;
  };

  const handleRowClick = (exceptionId: string) => {
    // Open L3 panel (will be implemented with EntityDetailPanel)
    router.push(`/exceptions/${exceptionId}`);
  };

  const handleRowDoubleClick = (exceptionId: string) => {
    router.push(`/exceptions/${exceptionId}`);
  };

  const handleCardClick = (type: 'exceptions' | 'invoices' | 'contracts') => {
    if (type === 'exceptions') router.push('/exceptions');
    else if (type === 'invoices') router.push('/invoices');
    else if (type === 'contracts') router.push('/contracts');
  };

  const handleChartPointDoubleClick = (date: string) => {
    router.push(`/exceptions?date=${date}`);
  };

  // Check if user has dashboard access
  if (!hasPermission('dashboard:view')) {
    return (
      <div className="flex items-center justify-center h-64">
        <Card>
          <CardContent className="p-6 text-center">
            <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm font-medium text-foreground mb-1">Access Denied</p>
            <p className="text-xs text-muted-foreground">You do not have permission to view the dashboard.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-[1440px] mx-auto px-4">
      {/* Welcome Section - Horizontal Layout */}
      <div className="flex items-center justify-between pt-20">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            Welcome back, {userName}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          {/* Summary Metrics - Compact Cards */}
          <Card
            className="cursor-pointer hover:bg-muted/50 transition-colors min-w-[140px]"
            onClick={() => handleCardClick('exceptions')}
          >
            <CardContent className="p-3 flex items-center gap-2">
              <Bell className="h-4 w-4 text-destructive flex-shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Critical Exceptions</p>
                <p className="text-base font-bold">{stats?.criticalExceptionsCount || 0}</p>
              </div>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer hover:bg-muted/50 transition-colors min-w-[140px]"
            onClick={() => handleCardClick('invoices')}
          >
            <CardContent className="p-3 flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-green-600 flex-shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Saved This Month</p>
                <p className="text-base font-bold">{formatCurrency(stats?.monthToDatePrevented || 0)}</p>
              </div>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer hover:bg-muted/50 transition-colors min-w-[140px]"
            onClick={() => handleCardClick('exceptions')}
          >
            <CardContent className="p-3 flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary flex-shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Compliance Rate</p>
                <div className="flex items-center gap-1">
                  <p className="text-base font-bold">{stats?.complianceRate?.toFixed(1) || 0}%</p>
                  {stats?.complianceTrend === 'up' ? (
                    <ArrowUp className="h-3 w-3 text-green-600" />
                  ) : (
                    <ArrowDown className="h-3 w-3 text-red-600" />
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* KPI Cards - 16px spacing */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Prevented Overpayments */}
        <Card
          className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200 cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => handleCardClick('invoices')}
          onDoubleClick={() => router.push('/invoices?filter=savings')}
        >
          <CardContent className="p-4">
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Prevented Overpayments</p>
              <p className="text-2xl font-bold text-foreground">{formatCurrency(stats?.ytdRealizedSavings || 0)} YTD</p>
              <p className="text-xs text-muted-foreground">{formatCurrency(stats?.monthToDatePrevented || 0)} This Month</p>
            </div>
          </CardContent>
        </Card>

        {/* Service Compliance */}
        <Card
          className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200 cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => handleCardClick('exceptions')}
          onDoubleClick={() => router.push('/exceptions?filter=compliance')}
        >
          <CardContent className="p-4">
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Service Compliance</p>
              <div className="flex items-center gap-2">
                <p className="text-2xl font-bold text-foreground">{stats?.complianceRate?.toFixed(1) || 0}%</p>
                {stats?.complianceTrend === 'up' ? (
                  <ArrowUp className="h-4 w-4 text-green-600" />
                ) : (
                  <ArrowDown className="h-4 w-4 text-red-600" />
                )}
              </div>
              <div className="h-8">
                <Sparkline data={stats?.complianceSparklineData || []} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Active Contracts */}
        <Card
          className="bg-gradient-to-br from-purple-50 to-violet-50 border-purple-200 cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => handleCardClick('contracts')}
          onDoubleClick={() => router.push('/contracts?status=Active')}
        >
          <CardContent className="p-4">
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Active Contracts</p>
              <p className="text-2xl font-bold text-foreground">{stats?.activeContractsCount || 0}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Action Priority Queue */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold">Action Priority Queue</h2>
            <Link href="/exceptions" className="text-xs text-primary hover:text-primary/80 font-medium">
              View All →
            </Link>
          </div>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs w-12">Priority</TableHead>
                  <TableHead className="text-xs">Type</TableHead>
                  <TableHead className="text-xs">Vendor</TableHead>
                  <TableHead className="text-xs">Issue</TableHead>
                  <TableHead className="text-xs text-right">Impact</TableHead>
                  <TableHead className="text-xs">Due Date</TableHead>
                  <TableHead className="text-xs">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {priorityQueue.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-xs text-muted-foreground py-8">
                      No priority items
                    </TableCell>
                  </TableRow>
                ) : (
                  priorityQueue.map((item) => (
                    <TableRow
                      key={item.exceptionId}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleRowClick(item.exceptionId)}
                      onDoubleClick={() => handleRowDoubleClick(item.exceptionId)}
                    >
                      <TableCell className="py-2.5">
                        <PriorityIcon priority={item.priority} />
                      </TableCell>
                      <TableCell className="py-2.5">
                        <span className="text-xs font-medium">{item.type}</span>
                      </TableCell>
                      <TableCell className="py-2.5">
                        {item.vendor.partyId ? (
                          <Link
                            href={`/parties/${item.vendor.partyId}`}
                            className="text-xs text-primary hover:text-primary/80"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {item.vendor.name}
                          </Link>
                        ) : (
                          <span className="text-xs">{item.vendor.name}</span>
                        )}
                      </TableCell>
                      <TableCell className="py-2.5">
                        <span className="text-xs text-muted-foreground line-clamp-1">{item.issue}</span>
                      </TableCell>
                      <TableCell className="py-2.5 text-right">
                        <span
                          className={`text-xs font-semibold ${
                            item.impact >= 10000 ? 'text-destructive' : 'text-foreground'
                          }`}
                        >
                          {formatCurrency(item.impact)}
                        </span>
                      </TableCell>
                      <TableCell className="py-2.5">
                        <span
                          className={`text-xs ${
                            item.isUrgent ? 'text-yellow-600 font-medium' : 'text-muted-foreground'
                          }`}
                        >
                          {formatRelativeDate(item.daysUntilDue)}
                        </span>
                      </TableCell>
                      <TableCell className="py-2.5">
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/exceptions/${item.exceptionId}`);
                            }}
                          >
                            View
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Exception Trends Graph */}
      <Card>
        <CardContent className="p-4">
          <h2 className="text-sm font-semibold mb-3">Exception Trends (Last 90 Days)</h2>
          <div className="h-[300px]">
            <ExceptionTrendsChart
              data={exceptionTrends}
              onPointDoubleClick={handleChartPointDoubleClick}
            />
          </div>
        </CardContent>
      </Card>

      {/* Savings Waterfall */}
      <Card>
        <CardContent className="p-4">
          <h2 className="text-sm font-semibold mb-3">Savings Waterfall</h2>
          <div className="space-y-2">
            {[
              { label: 'Price Variance', value: stats?.savingsWaterfall.priceVariance || 0, color: 'bg-blue-500' },
              { label: 'Quantity', value: stats?.savingsWaterfall.quantity || 0, color: 'bg-green-500' },
              { label: 'Wrong Item', value: stats?.savingsWaterfall.wrongItem || 0, color: 'bg-yellow-500' },
              { label: 'Duplicate', value: stats?.savingsWaterfall.duplicate || 0, color: 'bg-orange-500' },
              { label: 'Other', value: stats?.savingsWaterfall.other || 0, color: 'bg-purple-500' },
            ].map((item, idx) => {
              const total = stats?.savingsWaterfall.total || 1;
              const percentage = (item.value / total) * 100;
              return (
                <div key={idx} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{item.label}</span>
                    <span className="font-medium">{formatCurrency(item.value)}</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full ${item.color} transition-all`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
            <div className="pt-2 border-t flex items-center justify-between text-xs font-semibold">
              <span>Total Savings</span>
              <span>{formatCurrency(stats?.savingsWaterfall.total || 0)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contract Expirations */}
      {hasPermission('contracts:read') && (
        <Card>
          <CardContent className="p-4">
            <h2 className="text-sm font-semibold mb-3">Contract Expirations</h2>
            <div className="space-y-2">
              {[
                {
                  label: '0-90 Days',
                  data: stats?.contractExpirations.days0to90,
                  color: 'text-red-600',
                  badge: 'destructive',
                },
                {
                  label: '91-180 Days',
                  data: stats?.contractExpirations.days91to180,
                  color: 'text-yellow-600',
                  badge: 'secondary',
                },
                {
                  label: 'Over 180 Days',
                  data: stats?.contractExpirations.daysOver180,
                  color: 'text-green-600',
                  badge: 'outline',
                },
              ].map((item, idx) => (
                <div key={idx} className="flex items-center justify-between p-2.5 bg-muted/30 rounded-md">
                  <div className="flex items-center gap-2">
                    <Badge variant={item.badge as any} className="text-xs">
                      {item.label}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{item.data?.count || 0} contracts</span>
                  </div>
                  <span className="text-xs font-medium">{formatCurrency(item.data?.totalSpend || 0)}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 pt-3 border-t">
              <Link href="/contracts">
                <span className="text-xs text-primary hover:text-primary/80 font-medium cursor-pointer">
                  View All Contracts →
                </span>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {notification && (
        <NotificationModal
          open={!!notification}
          onOpenChange={(open) => !open && setNotification(null)}
          type={notification.type}
          title={notification.title}
          message={notification.message}
        />
      )}
    </div>
  );
}
