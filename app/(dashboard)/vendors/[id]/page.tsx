'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { fetchWithAuth } from '@/lib/auth-client';

interface VendorIntelligence {
  vendorId: string;
  metrics: {
    totalInvoices: number;
    totalExceptions: number;
    errorRate: string;
    onTimePercentage: string;
    avgVariance: string;
    totalImpact: number;
  };
  riskScore: string;
  riskLevel: string;
  recurringPatterns: Array<{ type: string; count: number }>;
  scorecard: {
    errorRate: string;
    onTimePerformance: string;
    varianceControl: string;
  };
}

export default function VendorIntelligencePage() {
  const params = useParams();
  const [intelligence, setIntelligence] = useState<VendorIntelligence | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadIntelligence();
  }, [params.id]);

  const loadIntelligence = async () => {
    try {
      const response = await fetchWithAuth(`/api/vendors/${params.id}/intelligence`);
      if (response.ok) {
        const data = await response.json();
        setIntelligence(data);
      }
    } catch (error) {
      console.error('Error loading vendor intelligence:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!intelligence) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400">Vendor intelligence not found</p>
      </div>
    );
  }

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'High':
        return 'badge-error';
      case 'Medium':
        return 'badge-warning';
      case 'Low':
        return 'badge-success';
      default:
        return 'badge-info';
    }
  };

  const getScoreColor = (score: string) => {
    switch (score) {
      case 'Excellent':
        return 'text-green-600';
      case 'Good':
        return 'text-blue-600';
      case 'Fair':
        return 'text-yellow-600';
      case 'Poor':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Vendor Intelligence</h1>
          <p className="text-gray-500 mt-1">Performance metrics and risk analysis</p>
        </div>
        <Link href="/parties" className="text-blue-600 hover:text-blue-800 text-sm font-medium">
          ← Back to Parties
        </Link>
      </div>

      {/* Scorecard */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card hover:shadow-md transition-shadow">
          <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">Error Rate</h3>
          <p className={`text-3xl font-bold ${getScoreColor(intelligence.scorecard.errorRate)}`}>
            {intelligence.scorecard.errorRate}
          </p>
          <p className="text-sm text-gray-500 mt-2">
            {intelligence.metrics.errorRate}% of invoices have exceptions
          </p>
        </div>

        <div className="card hover:shadow-md transition-shadow">
          <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">On-Time Performance</h3>
          <p
            className={`text-3xl font-bold ${getScoreColor(intelligence.scorecard.onTimePerformance)}`}
          >
            {intelligence.scorecard.onTimePerformance}
          </p>
          <p className="text-sm text-gray-500 mt-2">
            {intelligence.metrics.onTimePercentage}% on-time
          </p>
        </div>

        <div className="card hover:shadow-md transition-shadow">
          <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">Variance Control</h3>
          <p
            className={`text-3xl font-bold ${getScoreColor(intelligence.scorecard.varianceControl)}`}
          >
            {intelligence.scorecard.varianceControl}
          </p>
          <p className="text-sm text-gray-500 mt-2">
            Avg variance: ${intelligence.metrics.avgVariance}
          </p>
        </div>
      </div>

      {/* Risk Score */}
      <div className="card">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Risk Score</h2>
            <p className="text-sm text-gray-500 mt-1">Overall vendor risk assessment</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-gray-900">{intelligence.riskScore}</div>
            <span className={`badge ${getRiskColor(intelligence.riskLevel)} mt-2 inline-block`}>
              {intelligence.riskLevel} Risk
            </span>
          </div>
        </div>
      </div>

      {/* Recurring Patterns */}
      {intelligence.recurringPatterns.length > 0 && (
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Recurring Patterns Detected</h2>
          <div className="space-y-3">
            {intelligence.recurringPatterns.map((pattern, idx) => (
              <div key={idx} className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium text-gray-900">{pattern.type}</span>
                    <p className="text-sm text-gray-600 mt-1">Occurred {pattern.count} times</p>
                  </div>
                  <span className="text-sm font-medium text-gray-900">
                    Total Impact: ${intelligence.metrics.totalImpact.toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Metrics Summary */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Performance Metrics</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div>
            <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">Total Invoices</p>
            <p className="text-3xl font-bold text-gray-900 mt-2">{intelligence.metrics.totalInvoices}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">Total Exceptions</p>
            <p className="text-3xl font-bold text-gray-900 mt-2">{intelligence.metrics.totalExceptions}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">Error Rate</p>
            <p className="text-3xl font-bold text-gray-900 mt-2">{intelligence.metrics.errorRate}%</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">Total Impact</p>
            <p className="text-3xl font-bold text-red-600 mt-2">
              ${intelligence.metrics.totalImpact.toLocaleString()}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
