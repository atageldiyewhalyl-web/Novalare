import { CheckCircle2, Clock, Calendar, Building2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useTheme } from '@/contexts/ThemeContext';

interface CompanyCardProps {
    id: string;
    name: string;
    qboConnected: boolean;
    currentMonthStatus: 'locked' | 'in-progress' | 'not-started';
    pendingItemsCount: number;
    lastActivity: string;
    status?: 'Active' | 'Inactive' | 'Archived';
    onClick: () => void;
}

export function CompanyCard({
    id,
    name,
    qboConnected,
    currentMonthStatus,
    pendingItemsCount,
    lastActivity,
    status,
    onClick
}: CompanyCardProps) {
    const { theme } = useTheme();

    const getStatusBadge = () => {
        switch (currentMonthStatus) {
            case 'locked':
                return (
                    <div className="flex items-center gap-2 min-w-[75px] px-3 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-[10px] font-bold uppercase tracking-wider">
                        <span className="flex size-1.5 relative">
                            <span className="relative inline-flex rounded-full size-1.5 bg-emerald-500"></span>
                        </span>
                        <span>Locked</span>
                    </div>
                );
            case 'in-progress':
                return (
                    <div className="flex items-center gap-2 min-w-[100px] px-3 py-0.5 rounded-full bg-[#65D3FD]/10 border border-[#65D3FD]/20 text-[#65D3FD] text-[10px] font-bold uppercase tracking-wider">
                        <span className="flex size-1.5 relative">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#65D3FD]/40 opacity-75"></span>
                            <span className="relative inline-flex rounded-full size-1.5 bg-[#65D3FD]"></span>
                        </span>
                        <span>In Progress</span>
                    </div>
                );
            case 'not-started':
                return (
                    <div className="flex items-center gap-2 min-w-[100px] px-3 py-0.5 rounded-full bg-gray-500/10 border border-gray-500/20 text-gray-500 text-[10px] font-bold uppercase tracking-wider">
                        <span className="flex size-1.5 relative">
                            <span className="relative inline-flex rounded-full size-1.5 bg-gray-500 opacity-50"></span>
                        </span>
                        <span>Not Started</span>
                    </div>
                );
        }
    };

    const getCurrentMonth = () => {
        const now = new Date();
        return now.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    };

    const formatLastActivity = (timestamp: string) => {
        if (!timestamp) return 'Never';
        try {
            const date = new Date(timestamp);
            if (isNaN(date.getTime())) return 'Never';
            const now = new Date();
            const diffInMs = now.getTime() - date.getTime();
            const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
            const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
            if (diffInHours < 1) {
                const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
                if (diffInMinutes < 1) return 'Just now';
                return `${diffInMinutes}m ago`;
            } else if (diffInHours < 24) {
                return `${diffInHours}h ago`;
            } else if (diffInDays < 7) {
                return `${diffInDays}d ago`;
            } else {
                return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            }
        } catch (error) {
            return 'Never';
        }
    };

    return (
        <button
            onClick={() => {
                if (id && id !== 'undefined') onClick();
            }}
            className={`
        group relative w-full text-left rounded-3xl p-6 transition-all duration-500 transform hover:scale-[1.02] border
        ${theme === 'dark'
                    ? 'bg-gradient-to-br from-white/[0.07] to-white/[0.02] border-white/10 backdrop-blur-xl hover:border-[#65D3FD]/50 hover:shadow-[0_20px_50px_-20px_rgba(101,211,253,0.4)]'
                    : 'bg-white border-gray-100 shadow-sm hover:border-[#65D3FD]/30 hover:shadow-[0_20px_50px_-20px_rgba(101,211,253,0.15)]'}
        ${status === 'Archived' ? 'opacity-60 grayscale' : ''}
        ${!id || id === 'undefined' ? 'pointer-events-none opacity-50' : ''}
      `}
        >
            {/* Dynamic Glow Accent */}
            <div className={`
        absolute -inset-px rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-sm pointer-events-none
        ${theme === 'dark' ? 'bg-gradient-to-br from-[#65D3FD]/10 to-transparent' : 'bg-gradient-to-br from-[#65D3FD]/5 to-transparent'}
      `} />

            <div className="relative z-10 w-full space-y-5">
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                        {/* Icon Container with BRAND Gradient */}
                        <div className={`
              size-14 rounded-2xl flex items-center justify-center p-[1px] transition-all duration-500 group-hover:rotate-6 group-hover:shadow-[0_0_20px_rgba(101,211,253,0.3)]
              ${theme === 'dark'
                                ? 'bg-gradient-to-br from-[#65D3FD] via-[#65D3FD]/50 to-[#4F5CFE]'
                                : 'bg-gradient-to-br from-[#65D3FD] to-[#4F5CFE]'}
            `}>
                            <div className={`
                w-full h-full rounded-[15px] flex items-center justify-center
                ${theme === 'dark' ? 'bg-[#0a0a0f]' : 'bg-white'}
              `}>
                                <Building2 className={`size-7 transition-colors duration-300 ${theme === 'dark' ? 'text-[#65D3FD]' : 'text-[#65D3FD]'}`} />
                            </div>
                        </div>

                        <div className="flex-1 min-w-0">
                            <h3
                                className={`text-lg font-bold truncate leading-tight transition-colors duration-300 ${theme === 'dark' ? 'text-white group-hover:text-[#65D3FD]' : 'text-gray-900 group-hover:text-[#65D3FD]'}`}
                                style={{ fontFamily: "'Outfit', sans-serif" }}
                            >
                                {name || 'Unnamed Company'}
                            </h3>
                            <div className="flex items-center gap-2 mt-1">
                                {status && status !== 'Active' && (
                                    <span className={`text-[10px] font-bold uppercase tracking-widest ${status === 'Inactive' ? 'text-amber-500' : 'text-gray-500'}`}>
                                        {status}
                                    </span>
                                )}
                                {status && status !== 'Active' && <span className="size-1 rounded-full bg-gray-600 opacity-30" />}
                                <span className={`text-xs font-medium transition-colors duration-300 ${theme === 'dark' ? 'text-gray-400 group-hover:text-gray-300' : 'text-gray-500 group-hover:text-gray-600'}`} style={{ fontFamily: "'Manrope', sans-serif" }}>
                                    {qboConnected ? 'QBO Integrated' : 'Direct Link'}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Month Status & Pending Counts */}
                <div className={`
          p-4 rounded-2xl flex items-center justify-between transition-all duration-500
          ${theme === 'dark'
                        ? 'bg-white/5 border border-white/5 group-hover:bg-[#65D3FD]/5 group-hover:border-[#65D3FD]/10'
                        : 'bg-gray-50 border border-gray-100 group-hover:bg-[#65D3FD]/5 group-hover:border-[#65D3FD]/20'}
        `}>
                    <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] uppercase tracking-wider text-[#65D3FD] font-bold" style={{ fontFamily: "'Manrope', sans-serif" }}>Period Status</span>
                        <span className={`text-xs font-semibold ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`} style={{ fontFamily: "'Outfit', sans-serif" }}>{getCurrentMonth()}</span>
                    </div>
                    {getStatusBadge()}
                </div>

                {/* Bottom Metadata */}
                <div className="flex items-center justify-between text-[11px] font-medium" style={{ fontFamily: "'Manrope', sans-serif" }}>
                    <div className="flex items-center gap-2">
                        {pendingItemsCount > 0 ? (
                            <span className="flex items-center gap-1.5 text-amber-500 font-bold">
                                <span className="size-1.5 rounded-full bg-amber-500 animate-pulse" />
                                {pendingItemsCount} Actions Required
                            </span>
                        ) : (
                            <span className="text-gray-500 group-hover:text-[#65D3FD]/60 transition-colors">No pending items</span>
                        )}
                    </div>
                    <span className="text-gray-500 uppercase tracking-tighter tabular-nums group-hover:text-gray-400 transition-colors">
                        Active {formatLastActivity(lastActivity)}
                    </span>
                </div>
            </div>
        </button>

    );
}
