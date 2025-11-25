'use client';

import { useState, useEffect } from 'react';
import { getStoredTokens, clearStoredTokens } from '@/lib/auth-client';
import { useRouter } from 'next/navigation';
import { Search, Bell, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { GlobalSearch } from '@/components/command/GlobalSearch';

export default function Header() {
  const router = useRouter();
  const [tokens, setTokens] = useState<ReturnType<typeof getStoredTokens>>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setTokens(getStoredTokens());
  }, []);

  const handleLogout = async () => {
    if (tokens?.refreshToken) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: tokens.refreshToken }),
        });
      } catch (error) {
        console.error('Logout error:', error);
      }
    }
    clearStoredTokens();
    router.push('/login');
  };

  return (
    <>
      <GlobalSearch />
      <header
        className="bg-card/50 backdrop-blur-sm border-b border-border/50 h-16 flex items-center"
        role="banner"
      >
        <div className="w-full max-w-[1440px] mx-auto px-4 flex items-center justify-between gap-3">
          {/* Logo on left */}
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-foreground tracking-tight">
              spend<span className="text-primary">rule</span>
            </h1>
          </div>

          {/* Search bar centered */}
          <div className="flex-1 flex justify-center max-w-2xl">
            <Button
              variant="outline"
              className="hidden md:flex items-center gap-1.5 h-8 px-3 w-full text-xs text-muted-foreground hover:text-foreground bg-background/50 border-border/50 hover:border-border justify-start"
              onClick={() => {
                if (typeof window !== 'undefined' && (window as any).openGlobalSearch) {
                  (window as any).openGlobalSearch();
                }
              }}
            >
              <Search className="h-3.5 w-3.5" />
              <span>Search vendors, invoices...</span>
              <kbd className="ml-auto pointer-events-none inline-flex h-4 select-none items-center gap-0.5 rounded border bg-muted px-1 font-mono text-[9px] font-medium opacity-100">
                ⌘K
              </kbd>
            </Button>
          </div>

          {/* User profile on right */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              className="md:hidden"
              onClick={() => {
                if (typeof window !== 'undefined' && (window as any).openGlobalSearch) {
                  (window as any).openGlobalSearch();
                }
              }}
            >
              <Search className="h-3.5 w-3.5" />
            </Button>

          <Button
            variant="ghost"
            size="icon-sm"
            className="relative hover:bg-secondary/50"
            onClick={() => console.log('Notifications clicked')}
          >
            <Bell className="h-3.5 w-3.5" />
            <Badge className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 flex items-center justify-center p-0 bg-destructive text-destructive-foreground text-[9px] border-2 border-card">
              3
            </Badge>
          </Button>

          <div className="hidden sm:block h-5 w-px bg-border/50 mx-0.5" />

          {mounted && tokens && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-1.5 h-7 px-1.5 hover:bg-secondary/50">
                  <Avatar className="h-6 w-6">
                    <AvatarFallback className="bg-primary text-primary-foreground text-[10px] font-medium">
                      {tokens.user.firstName?.[0] || tokens.user.email[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="hidden lg:flex flex-col items-start">
                    <span className="text-xs font-medium leading-none">
                      {tokens.user.firstName || tokens.user.email.split('@')[0]}
                    </span>
                    <span className="text-[9px] text-muted-foreground leading-none mt-0.5">
                      {tokens.user.roles[0] || 'User'}
                    </span>
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="mr-2 h-3.5 w-3.5" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          </div>
        </div>
      </header>
    </>
  );
}
