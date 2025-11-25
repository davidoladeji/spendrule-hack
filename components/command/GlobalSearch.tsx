'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem, CommandShortcut } from '@/components/ui/command';
import { fetchWithAuth } from '@/lib/auth-client';
import { FileText, Building2, AlertCircle, Users } from 'lucide-react';

interface SearchResult {
  id: string;
  type: 'contract' | 'invoice' | 'exception' | 'party';
  title: string;
  subtitle?: string;
  status?: string;
  severity?: string;
  amount?: string;
  url: string;
}

interface SearchResults {
  contracts: SearchResult[];
  invoices: SearchResult[];
  exceptions: SearchResult[];
  parties: SearchResult[];
}

interface GlobalSearchProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function GlobalSearch({ open: controlledOpen, onOpenChange }: GlobalSearchProps = {}) {
  const router = useRouter();
  const [internalOpen, setInternalOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults>({
    contracts: [],
    invoices: [],
    exceptions: [],
    parties: [],
  });
  const [loading, setLoading] = useState(false);

  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = onOpenChange || setInternalOpen;

  // Keyboard shortcut: Cmd/Ctrl+K
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [setOpen]);

  // Expose open function globally for button clicks
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).openGlobalSearch = () => setOpen(true);
    }
    return () => {
      if (typeof window !== 'undefined') {
        delete (window as any).openGlobalSearch;
      }
    };
  }, [setOpen]);

  // Search when query changes
  useEffect(() => {
    if (!open || query.length < 2) {
      setResults({ contracts: [], invoices: [], exceptions: [], parties: [] });
      return;
    }

    const search = async () => {
      setLoading(true);
      try {
        const response = await fetchWithAuth(`/api/search?q=${encodeURIComponent(query)}`);
        if (response.ok) {
          const data = await response.json();
          setResults(data.results || { contracts: [], invoices: [], exceptions: [], parties: [] });
        }
      } catch (error) {
        console.error('Search error:', error);
      } finally {
        setLoading(false);
      }
    };

    const timeoutId = setTimeout(search, 300);
    return () => clearTimeout(timeoutId);
  }, [query, open]);

  const handleSelect = (url: string) => {
    setOpen(false);
    router.push(url);
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'contract':
        return <FileText className="h-4 w-4" />;
      case 'invoice':
        return <FileText className="h-4 w-4" />;
      case 'exception':
        return <AlertCircle className="h-4 w-4" />;
      case 'party':
        return <Users className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const totalResults = results.contracts.length + results.invoices.length + results.exceptions.length + results.parties.length;

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Search contracts, invoices, exceptions, vendors..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        {loading && (
          <div className="py-6 text-center text-sm text-muted-foreground">
            Searching...
          </div>
        )}
        {!loading && totalResults === 0 && query.length >= 2 && (
          <CommandEmpty>No results found.</CommandEmpty>
        )}
        {!loading && query.length < 2 && (
          <CommandEmpty>Type at least 2 characters to search...</CommandEmpty>
        )}
        {!loading && results.contracts.length > 0 && (
          <CommandGroup heading="Contracts">
            {results.contracts.map((result) => (
              <CommandItem
                key={result.id}
                onSelect={() => handleSelect(result.url)}
              >
                {getIcon(result.type)}
                <div className="flex flex-col">
                  <span>{result.title}</span>
                  {result.subtitle && (
                    <span className="text-xs text-muted-foreground">{result.subtitle}</span>
                  )}
                </div>
                {result.status && (
                  <CommandShortcut>{result.status}</CommandShortcut>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {!loading && results.invoices.length > 0 && (
          <CommandGroup heading="Invoices">
            {results.invoices.map((result) => (
              <CommandItem
                key={result.id}
                onSelect={() => handleSelect(result.url)}
              >
                {getIcon(result.type)}
                <div className="flex flex-col">
                  <span>{result.title}</span>
                  {result.subtitle && (
                    <span className="text-xs text-muted-foreground">{result.subtitle}</span>
                  )}
                </div>
                {result.amount && (
                  <CommandShortcut>{result.amount}</CommandShortcut>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {!loading && results.exceptions.length > 0 && (
          <CommandGroup heading="Exceptions">
            {results.exceptions.map((result) => (
              <CommandItem
                key={result.id}
                onSelect={() => handleSelect(result.url)}
              >
                {getIcon(result.type)}
                <div className="flex flex-col">
                  <span>{result.title}</span>
                  {result.subtitle && (
                    <span className="text-xs text-muted-foreground">{result.subtitle}</span>
                  )}
                </div>
                {result.severity && (
                  <CommandShortcut>{result.severity}</CommandShortcut>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {!loading && results.parties.length > 0 && (
          <CommandGroup heading="Vendors & Parties">
            {results.parties.map((result) => (
              <CommandItem
                key={result.id}
                onSelect={() => handleSelect(result.url)}
              >
                {getIcon(result.type)}
                <div className="flex flex-col">
                  <span>{result.title}</span>
                  {result.subtitle && (
                    <span className="text-xs text-muted-foreground">{result.subtitle}</span>
                  )}
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}

