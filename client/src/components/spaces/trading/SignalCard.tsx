import React from 'react';
import { ArrowUpIcon, ArrowDownIcon, MinusIcon } from 'lucide-react';

export type SignalDirection = 'bullish' | 'bearish' | 'neutral';

interface SignalCardProps {
  title: string;
  value: string;
  direction: SignalDirection;
  confidence?: number; // 0-100
  subtitle?: string;
}

const directionConfig: Record<SignalDirection, { icon: React.ElementType; color: string; bg: string; border: string; glow: string }> = {
  bullish: {
    icon: ArrowUpIcon,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
    glow: 'shadow-emerald-900/20'
  },
  bearish: {
    icon: ArrowDownIcon,
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
    glow: 'shadow-red-900/20'
  },
  neutral: {
    icon: MinusIcon,
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/20',
    glow: 'shadow-yellow-900/20'
  }
};

const SignalCard: React.FC<SignalCardProps> = ({ title, value, direction, confidence, subtitle }) => {
  const cfg = directionConfig[direction];
  const Icon = cfg.icon;

  return (
    <div className={`relative flex flex-col gap-2 p-4 rounded-2xl ${cfg.bg} border ${cfg.border} shadow-lg ${cfg.glow} backdrop-blur-sm transition-all hover:scale-[1.02] hover:shadow-xl`}>
      {/* Confidence bar */}
      {confidence !== undefined && (
        <div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl overflow-hidden bg-white/5">
          <div
            className={`h-full ${direction === 'bullish' ? 'bg-emerald-500' : direction === 'bearish' ? 'bg-red-500' : 'bg-yellow-500'} transition-all duration-700 ease-out`}
            style={{ width: `${confidence}%` }}
          />
        </div>
      )}

      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{title}</span>
        <div className={`p-1 rounded-lg ${cfg.bg}`}>
          <Icon className={`w-3.5 h-3.5 ${cfg.color}`} />
        </div>
      </div>

      <p className={`text-xl font-black ${cfg.color} tracking-tight`}>{value}</p>

      {subtitle && (
        <p className="text-[10px] text-gray-500 font-medium">{subtitle}</p>
      )}

      {confidence !== undefined && (
        <p className="text-[9px] text-gray-500 font-bold uppercase tracking-wider mt-1">
          Confidence: {confidence}%
        </p>
      )}
    </div>
  );
};

export default SignalCard;
