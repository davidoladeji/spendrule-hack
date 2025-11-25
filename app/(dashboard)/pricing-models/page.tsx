'use client';

import { useEffect, useState } from 'react';
import { fetchWithAuth } from '@/lib/auth-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Calculator } from 'lucide-react';
import { PricingModelModal } from '@/components/modals/PricingModelModal';

interface PricingModel {
  modelId: string;
  modelName: string;
  modelType: string;
  currency: string;
  pricingTiers: Array<{
    tierSequence: number;
    minValue: number | string;
    maxValue?: number | string | null;
    rate: number | string;
  }>;
}

export default function PricingModelsPage() {
  const [models, setModels] = useState<PricingModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [pricingModalOpen, setPricingModalOpen] = useState(false);

  useEffect(() => {
    loadModels();
  }, []);

  const loadModels = async () => {
    try {
      const response = await fetchWithAuth('/api/pricing-models');
      if (response.ok) {
        const data = await response.json();
        setModels(data.models || []);
      }
    } catch (error) {
      console.error('Error loading pricing models:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateModel = () => {
    setPricingModalOpen(true);
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
          <h1 className="text-lg font-semibold text-foreground">Pricing Models</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Manage calculation logic and tiered rates</p>
        </div>
        <Button size="sm" onClick={handleCreateModel}>
          <Plus className="h-3.5 w-3.5" />
          Create Model
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
        {models.map((model) => (
          <Card key={model.modelId} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-sm">{model.modelName}</CardTitle>
                  <div className="flex gap-1.5 mt-2">
                    <Badge variant="outline" className="text-xs">
                      {model.modelType}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {model.currency}
                    </Badge>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {model.pricingTiers && model.pricingTiers.length > 0 && (
                <div className="mt-2">
                  <h4 className="text-xs font-semibold mb-2">Pricing Tiers</h4>
                  <div className="space-y-1.5">
                    {model.pricingTiers.map((tier) => {
                      const minValue = typeof tier.minValue === 'string' ? parseFloat(tier.minValue) : tier.minValue;
                      const maxValue =
                        tier.maxValue && typeof tier.maxValue === 'string'
                          ? parseFloat(tier.maxValue)
                          : tier.maxValue;
                      const rate = typeof tier.rate === 'string' ? parseFloat(tier.rate) : tier.rate;
                      return (
                        <div
                          key={tier.tierSequence}
                          className="flex items-center justify-between p-2 bg-muted/30 rounded text-xs"
                        >
                          <span className="text-muted-foreground">Tier {tier.tierSequence}:</span>
                          <span className="font-medium">
                            {minValue} - {maxValue === null || maxValue === undefined ? '∞' : maxValue}
                          </span>
                          <span className="font-semibold">${rate.toFixed(2)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="mt-3 pt-3 border-t">
                <Button size="sm" variant="ghost" className="w-full text-xs">
                  Edit Configuration
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {models.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <div className="flex flex-col items-center justify-center">
                <Calculator className="h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-xs font-medium text-foreground mb-0.5">No pricing models found</p>
                <p className="text-xs text-muted-foreground">Create a pricing model to get started</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <PricingModelModal
        open={pricingModalOpen}
        onOpenChange={setPricingModalOpen}
        onSuccess={() => {
          loadModels();
        }}
      />
    </div>
  );
}
