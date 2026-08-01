'use client';

import { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';

interface GrowthPoint {
  timestamp: number;
  holders: number;
}

interface HolderGrowthChartProps {
  growthData?: GrowthPoint[];
  holderSpike?: boolean;
}

/**
 * Holder Growth Chart Component
 * Renders a line chart showing the time-series trend of unique token holders
 */
export function HolderGrowthChart({ growthData = [], holderSpike = false }: HolderGrowthChartProps) {
  const formattedData = useMemo(() => {
    return growthData.map(point => ({
      ...point,
      date: new Date(point.timestamp).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    }));
  }, [growthData]);

  if (growthData.length < 2) {
    return (
      <div className="glass-card p-6 rounded-xl border border-white/10 bg-slate-900/10 flex flex-col items-center justify-center min-h-[300px]">
        <span className="text-xl mb-2">📊</span>
        <p className="text-xs text-slate-500 italic">Not enough transaction history to generate growth chart.</p>
      </div>
    );
  }

  return (
    <div className="glass-card p-6 rounded-xl border border-white/10 bg-slate-900/5 flex flex-col gap-4">
      <div className="flex items-center justify-between border-b border-white/10 pb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-black italic uppercase text-slate-200">
            📈 Holder Count Growth Trend
          </span>
          {holderSpike && (
            <span className="bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[9px] px-1.5 py-0.5 rounded font-black tracking-wider uppercase animate-pulse">
              🔥 Spike Detected
            </span>
          )}
        </div>
        <span className="text-[10px] text-slate-500 font-mono">
          Scanned Period: {formattedData.length} data points
        </span>
      </div>

      <div className="w-full h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={formattedData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" />
            <XAxis 
              dataKey="date" 
              stroke="#64748b" 
              fontSize={9}
              tickLine={false}
              axisLine={false}
            />
            <YAxis 
              stroke="#64748b" 
              fontSize={9}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(15, 23, 42, 0.95)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '8px',
                fontFamily: 'monospace',
                fontSize: '11px',
                color: '#fff'
              }}
              labelStyle={{ fontWeight: 'bold', marginBottom: '4px', color: '#94a3b8' }}
              itemStyle={{ color: holderSpike ? '#fb7185' : '#60a5fa' }}
            />
            <Line
              type="monotone"
              dataKey="holders"
              name="Unique Holders"
              stroke={holderSpike ? "#f43f5e" : "#3b82f6"}
              strokeWidth={2.5}
              dot={{ stroke: holderSpike ? "#f43f5e" : "#3b82f6", strokeWidth: 1.5, r: 2 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
