import React, { useEffect, useState } from 'react';
import { Pie } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js';
import api from '../../config/api';

ChartJS.register(ArcElement, Tooltip, Legend);

interface LeadSource {
  source: string;
  count: number;
  conversionRate: number;
}

interface LeadSourcesChartProps {
  refreshKey: number;
}

const COLORS = [
  '#6366f1', // indigo
  '#f59e0b', // amber
  '#10b981', // emerald
  '#ef4444', // red
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#14b8a6', // teal
];

const LeadSourcesChart: React.FC<LeadSourcesChartProps> = ({ refreshKey }) => {
  const [sources, setSources] = useState<LeadSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    api
      .get('/api/crm/analytics/lead-sources')
      .then((res) => {
        if (!cancelled) {
          setSources(res.data?.data ?? res.data ?? []);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError('Failed to load lead sources.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
        <svg className="animate-spin h-5 w-5 mr-2 text-indigo-500" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        Loading lead sources…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-48 text-red-500 text-sm">
        {error}
      </div>
    );
  }

  if (sources.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-gray-400 text-sm gap-2">
        <svg className="h-10 w-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
        </svg>
        No lead source data yet.
      </div>
    );
  }

  const chartData = {
    labels: sources.map((s) => s.source),
    datasets: [
      {
        data: sources.map((s) => s.count),
        backgroundColor: sources.map((_, i) => COLORS[i % COLORS.length]),
        borderColor: '#ffffff',
        borderWidth: 2,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right' as const,
        labels: {
          boxWidth: 12,
          padding: 16,
          font: { size: 12 },
        },
      },
      tooltip: {
        callbacks: {
          label: (ctx: any) => {
            const src = sources[ctx.dataIndex];
            return [
              ` Count: ${src.count}`,
              ` Conversion: ${src.conversionRate}%`,
            ];
          },
        },
      },
    },
  };

  return (
    <div className="space-y-4">
      {/* Pie chart */}
      <div className="relative h-56">
        <Pie data={chartData} options={chartOptions} />
      </div>

      {/* Summary table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead>
            <tr className="border-b border-gray-200 text-gray-500 text-xs uppercase tracking-wide">
              <th className="pb-2 pr-4">Source</th>
              <th className="pb-2 pr-4 text-right">Count</th>
              <th className="pb-2 text-right">Conversion</th>
            </tr>
          </thead>
          <tbody>
            {sources.map((s, i) => (
              <tr key={s.source} className="border-b border-gray-100 last:border-0">
                <td className="py-2 pr-4 flex items-center gap-2">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: COLORS[i % COLORS.length] }}
                  />
                  <span className="capitalize text-gray-700">{s.source.replace(/_/g, ' ')}</span>
                </td>
                <td className="py-2 pr-4 text-right text-gray-700 font-medium">{s.count}</td>
                <td className="py-2 text-right text-gray-500">{s.conversionRate}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default LeadSourcesChart;
