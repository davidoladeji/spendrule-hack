'use client';

import { useEffect, useState } from 'react';
import { fetchWithAuth } from '@/lib/auth-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus } from 'lucide-react';
import { LocationModal } from '@/components/modals/LocationModal';

interface Location {
  locationId: string;
  locationCode: string;
  locationName: string;
  locationType?: string;
  city?: string;
  stateProvince?: string;
  facilityType?: string;
  bedCount?: number;
}

export default function LocationsPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [locationModalOpen, setLocationModalOpen] = useState(false);

  useEffect(() => {
    loadLocations();
  }, []);

  const loadLocations = async () => {
    try {
      const response = await fetchWithAuth('/api/locations');
      if (response.ok) {
        const data = await response.json();
        setLocations(data.locations || []);
      }
    } catch (error) {
      console.error('Error loading locations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddLocation = () => {
    setLocationModalOpen(true);
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
          <h1 className="text-lg font-semibold text-foreground">Locations</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Manage facility locations</p>
        </div>
        <Button size="sm" onClick={handleAddLocation}>
          <Plus className="h-3.5 w-3.5" />
          Add Location
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
        {locations.map((location) => (
          <Card key={location.locationId} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-sm">{location.locationName}</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {location.city}, {location.stateProvince}
                  </p>
                </div>
                <Badge variant="outline" className="ml-2 text-xs">
                  {location.locationCode}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Type:</span>
                  <span className="font-medium">{location.locationType || 'N/A'}</span>
                </div>
                {location.bedCount !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Beds:</span>
                    <span className="font-medium">{location.bedCount}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <LocationModal
        open={locationModalOpen}
        onOpenChange={setLocationModalOpen}
        onSuccess={() => {
          loadLocations();
        }}
      />
    </div>
  );
}
