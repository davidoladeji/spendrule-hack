'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  FileText,
  Building,
  TrendingUp,
  Users,
  FileCheck,
  AlertTriangle,
  BarChart3,
  Settings,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { canAccessRoute, hasPermission } from '@/lib/permissions';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Contracts', href: '/contracts', icon: FileCheck },
  { name: 'Invoices', href: '/invoices', icon: FileText },
  { name: 'Exceptions', href: '/exceptions', icon: AlertTriangle },
  { name: 'Reports', href: '/reports', icon: BarChart3 },
  { name: 'Vendors', href: '/parties', icon: Building },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Filter navigation items based on user permissions
  // Only filter permission-based items after client mount to avoid hydration mismatch
  const visibleNavigation = navigation.filter((item) => {
    // If item has a specific permission requirement, check that (only after mount)
    if ('permission' in item && item.permission) {
      if (!mounted) return false; // Don't show permission-based items during SSR
      return hasPermission(item.permission);
    }
    // Otherwise use the route-based permission check
    // For non-permission items, show them during SSR (they'll be filtered by canAccessRoute on client)
    if (!mounted) return true; // Show all non-permission items during SSR
    return canAccessRoute(item.href);
  });

  return (
    <aside
      className="hidden md:flex w-64 bg-sidebar border-r border-sidebar-border flex-col shadow-sm"
      role="navigation"
      aria-label="Main navigation"
    >
      <div className="px-4 py-3 border-b border-sidebar-border">
        <h1 className="text-xl font-bold text-sidebar-foreground tracking-tight">
          spend<span className="text-primary">rule</span>
        </h1>
        <p className="text-[10px] text-muted-foreground mt-1">Advocate Health System</p>
      </div>

      <nav className="flex-1 flex flex-col p-2 space-y-0.5 overflow-y-auto">
        {visibleNavigation.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname?.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link key={item.name} href={item.href}>
              <Button
                variant="ghost"
                className={`w-full justify-start gap-2 h-9 text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground shadow-sm border border-sidebar-border'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground'
                }`}
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                {item.name}
              </Button>
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-sidebar-border">
        <div className="text-[10px] text-muted-foreground space-y-0.5">
          <div>© 2025 SpendRule</div>
          <div className="text-[9px]">Confidential & Proprietary</div>
        </div>
      </div>
    </aside>
  );
}
