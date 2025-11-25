'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchWithAuth } from '@/lib/auth-client';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Plus, Building2, TrendingUp, Edit, Trash2 } from 'lucide-react';
import { PartyModal } from '@/components/modals/PartyModal';
import { NotificationModal } from '@/components/ui/notification-modal';

interface Party {
  partyId: string;
  legalName: string;
  tradingName?: string;
  partyType: string;
  partyStatus: string;
  taxId?: string;
}

export default function PartiesPage() {
  const [parties, setParties] = useState<Party[]>([]);
  const [loading, setLoading] = useState(true);
  const [partyModalOpen, setPartyModalOpen] = useState(false);
  const [editParty, setEditParty] = useState<Party | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [notification, setNotification] = useState<{type: 'success' | 'error' | 'info' | 'warning', title: string, message: string} | null>(null);

  useEffect(() => {
    loadParties();
  }, []);

  const loadParties = async () => {
    try {
      const response = await fetchWithAuth('/api/parties');
      if (response.ok) {
        const data = await response.json();
        setParties(data.parties || []);
      }
    } catch (error) {
      console.error('Error loading parties:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddParty = () => {
    setEditParty(null);
    setPartyModalOpen(true);
  };

  const handleEditParty = (party: Party) => {
    setEditParty(party);
    setPartyModalOpen(true);
  };

  const handleDeleteParty = async (partyId: string) => {
    if (!confirm('Are you sure you want to delete this party? This action cannot be undone.')) {
      return;
    }

    setDeleting(partyId);
    try {
      const response = await fetchWithAuth(`/api/parties/${partyId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setNotification({
          type: 'success',
          title: 'Success',
          message: 'Party deleted successfully',
        });
        loadParties();
      } else {
        const error = await response.json();
        setNotification({
          type: 'error',
          title: 'Error',
          message: error.error || 'Failed to delete party',
        });
      }
    } catch (error) {
      console.error('Error deleting party:', error);
      setNotification({
        type: 'error',
        title: 'Error',
        message: 'Failed to delete party. Please try again.',
      });
    } finally {
      setDeleting(null);
    }
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
          <h1 className="text-lg font-semibold text-foreground">Vendor Management</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Manage vendors and customers</p>
        </div>
        <Button size="sm" onClick={handleAddParty}>
          <Plus className="h-3.5 w-3.5" />
          Add Party
        </Button>
      </div>

      <Card>
        <CardContent className="p-3">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Entity Name</TableHead>
                  <TableHead className="text-xs">Type</TableHead>
                  <TableHead className="text-xs">Tax ID</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {parties.map((party) => (
                  <TableRow key={party.partyId}>
                    <TableCell className="py-2.5">
                      <div>
                        <Link
                          href={`/parties/${party.partyId}`}
                          className="text-xs font-medium text-primary hover:text-primary/80"
                        >
                          {party.legalName}
                        </Link>
                        {party.tradingName && (
                          <p className="text-xs text-muted-foreground mt-0.5">{party.tradingName}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="py-2.5">
                      <Badge variant="outline" className="text-xs">
                        {party.partyType}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-2.5 text-xs text-muted-foreground">
                      {party.taxId || 'N/A'}
                    </TableCell>
                    <TableCell className="py-2.5">
                      <Badge
                        variant={party.partyStatus === 'Active' ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {party.partyStatus}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-2.5">
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="px-2 text-xs"
                          onClick={() => handleEditParty(party)}
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="px-2 text-xs text-destructive hover:text-destructive"
                          onClick={() => handleDeleteParty(party.partyId)}
                          disabled={deleting === party.partyId}
                        >
                          <Trash2 className={`h-3 w-3 ${deleting === party.partyId ? 'animate-pulse' : ''}`} />
                        </Button>
                        <Link href={`/vendors/${party.partyId}`}>
                          <Button size="sm" variant="ghost" className="px-2 text-xs">
                            <TrendingUp className="h-3 w-3 mr-1" />
                            Intelligence
                          </Button>
                        </Link>
                        <Link href={`/parties/${party.partyId}`}>
                          <Button size="sm" variant="ghost" className="px-2 text-xs">
                            View
                          </Button>
                        </Link>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {parties.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <Building2 className="h-8 w-8 text-muted-foreground mb-2" />
                        <p className="text-xs font-medium text-foreground mb-0.5">No parties found</p>
                        <p className="text-xs text-muted-foreground">Get started by adding a new party</p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <PartyModal
        open={partyModalOpen}
        onOpenChange={(open) => {
          setPartyModalOpen(open);
          if (!open) setEditParty(null);
        }}
        onSuccess={() => {
          loadParties();
          setEditParty(null);
        }}
        party={editParty}
      />
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
