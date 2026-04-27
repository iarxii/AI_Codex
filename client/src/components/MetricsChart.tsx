import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

interface MetricsData {
  time: string;
  cpu: number;
  ram: number;
  igpu: number;
  npu: number;
  latency: number;
}

interface MetricsChartProps {
  data: MetricsData[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white/90 backdrop-blur-md border border-black/[0.08] p-3 rounded-xl shadow-xl">
        <p className="text-[10px] font-bold text-[#7A7D8E] mb-2 uppercase tracking-widest">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2 py-0.5">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-[11px] font-medium text-[#1A1D2E] uppercase tracking-wide">
              {entry.name}: {entry.value.toFixed(1)}{entry.name === 'Latency' ? 'ms' : '%'}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

const MetricsChart: React.FC<MetricsChartProps> = ({ data }) => {
  return (
    <div className="w-full h-80 mt-4 bg-white/40 backdrop-blur-sm border border-black/[0.04] rounded-2xl p-4 animate-in fade-in slide-in-from-top-4 duration-500 overflow-hidden flex flex-col">
      <div className="flex items-center justify-between mb-4 px-2">
        <h3 className="text-[8px] font-bold text-[#7A7D8E] uppercase tracking-[0.2em]">
          Real-time Neural Hardware Performance Telemetry
        </h3>
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" />
          <span className="text-[9px] font-medium text-[#10B981] uppercase tracking-widest">Live Stream</span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 30 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.04)" />
          <XAxis 
            dataKey="time" 
            hide={true} 
          />
          <YAxis 
            domain={[0, 100]} 
            tick={{ fontSize: 9, fill: '#7A7D8E', fontWeight: 600 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend 
            verticalAlign="bottom" 
            align="center" 
            iconType="circle"
            wrapperStyle={{ 
              paddingTop: '20px', 
              fontSize: '8px', 
              fontWeight: 700, 
              textTransform: 'uppercase',
              letterSpacing: '0.1em'
            }}
          />
          <Line
            name="CPU"
            type="monotone"
            dataKey="cpu"
            stroke="#FF6600" // AdaptivOrange
            strokeWidth={3}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
            isAnimationActive={false}
          />
          <Line
            name="RAM"
            type="monotone"
            dataKey="ram"
            stroke="#4A4D5E"
            strokeWidth={3}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
            isAnimationActive={false}
          />
          <Line
            name="GPU"
            type="monotone"
            dataKey="igpu"
            stroke="#06B6D4" // Cyan
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={false}
            isAnimationActive={false}
          />
          <Line
            name="NPU"
            type="monotone"
            dataKey="npu"
            stroke="#8B5CF6" // Purple
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={false}
            isAnimationActive={false}
          />
          <Line
            name="Latency"
            type="monotone"
            dataKey="latency"
            stroke="#10B981" // Green
            strokeWidth={1}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default MetricsChart;
