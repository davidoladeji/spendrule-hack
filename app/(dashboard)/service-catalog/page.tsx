'use client';

import { useEffect, useState } from 'react';
import { fetchWithAuth } from '@/lib/auth-client';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Upload, Package } from 'lucide-react';
import { ServiceItemModal } from '@/components/modals/ServiceItemModal';
import { CSVImportModal } from '@/components/modals/CSVImportModal';

interface ServiceItem {
  itemId: string;
  itemName: string;
  listPrice: number | string;
  contractPrice?: number | string | null;
  currency: string;
  sku?: string | null;
}

export default function ServiceCatalogPage() {
  const [items, setItems] = useState<ServiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [csvModalOpen, setCsvModalOpen] = useState(false);

  useEffect(() => {
    loadItems();
  }, []);

  const loadItems = async () => {
    try {
      const response = await fetchWithAuth('/api/service-catalog');
      if (response.ok) {
        const data = await response.json();
        setItems(data.items || []);
      }
    } catch (error) {
      console.error('Error loading service catalog:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = () => {
    setItemModalOpen(true);
  };

  const handleImportCSV = () => {
    setCsvModalOpen(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Service Catalog</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Taxonomy and Billable Items</p>
        </div>
        <div className="flex gap-1.5">
          <Button size="sm" variant="outline" onClick={handleImportCSV}>
            <Upload className="h-3.5 w-3.5" />
            Import CSV
          </Button>
          <Button size="sm" onClick={handleAddItem}>
            <Plus className="h-3.5 w-3.5" />
            Add Item
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-3">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">SKU</TableHead>
                  <TableHead className="text-xs">Item Name</TableHead>
                  <TableHead className="text-xs">List Price</TableHead>
                  <TableHead className="text-xs">Contract Price</TableHead>
                  <TableHead className="text-xs">Variance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => {
                  const listPrice = typeof item.listPrice === 'string' ? parseFloat(item.listPrice) : item.listPrice;
                  const contractPrice =
                    item.contractPrice && typeof item.contractPrice === 'string'
                      ? parseFloat(item.contractPrice)
                      : item.contractPrice
                        ? item.contractPrice
                        : null;
                  const variance =
                    contractPrice && listPrice ? ((listPrice - contractPrice) / listPrice) * 100 : 0;
                  return (
                    <TableRow key={item.itemId}>
                      <TableCell className="py-2.5 text-xs text-muted-foreground">
                        {item.sku || 'N/A'}
                      </TableCell>
                      <TableCell className="py-2.5 text-xs font-medium">{item.itemName}</TableCell>
                      <TableCell className="py-2.5 text-xs text-muted-foreground">
                        {item.currency} {listPrice.toFixed(2)}
                      </TableCell>
                      <TableCell className="py-2.5 text-xs font-medium">
                        {contractPrice ? `${item.currency} ${contractPrice.toFixed(2)}` : 'N/A'}
                      </TableCell>
                      <TableCell className="py-2.5">
                        {contractPrice && variance > 0 ? (
                          <Badge variant="default" className="text-xs">
                            {variance.toFixed(0)}% Off
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">N/A</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <Package className="h-8 w-8 text-muted-foreground mb-2" />
                        <p className="text-xs font-medium text-foreground mb-0.5">No items found</p>
                        <p className="text-xs text-muted-foreground">Add items to the service catalog</p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <ServiceItemModal
        open={itemModalOpen}
        onOpenChange={setItemModalOpen}
        onSuccess={() => {
          loadItems();
        }}
      />

      <CSVImportModal
        open={csvModalOpen}
        onOpenChange={setCsvModalOpen}
        onSuccess={() => {
          loadItems();
        }}
      />
    </div>
  );
}
