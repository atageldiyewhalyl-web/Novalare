import { CheckCircle2, Circle, AlertCircle, Loader2, ChevronRight, Lock, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatusBadge } from './StatusBadge';

interface ChecklistItemProps {
  title: string;
  description: string;
  status: 'completed' | 'in-progress' | 'not-started' | 'loading' | 'warning' | 'error' | 'locked' | 'ready';
  onAction: () => void;
  actionLabel?: string;
  className?: string;
}

export function ChecklistItem({
  title,
  description,
  status,
  onAction,
  actionLabel,
  className
}: ChecklistItemProps) {

  // Helper to determine active state styling
  const isActive = status !== 'not-started' && status !== 'loading';
  const isCompleted = status === 'completed' || status === 'locked' || status === 'ready';

  return (
    <div
      className={`
        group relative flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 
        border border-gray-100 dark:border-white/5 rounded-xl
        bg-white/50 dark:bg-gray-900/20 backdrop-blur-sm shadow-sm
        hover:bg-white/80 dark:hover:bg-white/5 hover:border-gray-200 dark:hover:border-white/10 transition-all duration-300
        ${className || ''}
      `}
      role="button"
      onClick={onAction}
    >
      <div className="flex items-start gap-4">
        {/* Status Icon Indicator */}
        <div className={`mt-1 rounded-full p-2 transition-colors ${isCompleted
          ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400'
          : status === 'in-progress' || status === 'warning'
            ? 'bg-sky-100 text-sky-600 dark:bg-[#65D3FD]/10 dark:text-[#65D3FD]'
            : 'bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-gray-500'
          }`}>
          {status === 'loading' ? (
            <Loader2 className="size-4 animate-spin" />
          ) : isCompleted ? (
            <CheckCircle2 className="size-4" />
          ) : status === 'warning' ? (
            <AlertCircle className="size-4" />
          ) : (
            <Circle className="size-4 group-hover:text-gray-700 dark:group-hover:text-gray-400 transition-colors" />
          )}
        </div>

        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h3
              className={`font-semibold text-sm ${isCompleted ? 'text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300'}`}
              style={{ fontFamily: "'Outfit', sans-serif" }}
            >
              {title}
            </h3>
            {/* Show badge for locked status specifically */}
            {status === 'locked' && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-100 text-purple-700 dark:bg-white/10 dark:text-gray-400 border border-purple-200 dark:border-white/5">
                <Lock className="size-3 mr-1" /> Locked
              </span>
            )}
            {/* Show Badge for important statues */}
            {(status === 'warning' || status === 'in-progress') && (
              <StatusBadge status={status} className="h-5 text-[10px] px-1.5 py-0" />
            )}
          </div>
          <p
            className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed max-w-xl"
            style={{ fontFamily: "'Manrope', sans-serif" }}
          >
            {description}
          </p>
        </div>
      </div>

      <div className="flex items-center self-end sm:self-center pl-10 sm:pl-0">
        <Button
          size="sm"
          variant={isCompleted ? "ghost" : "outline"}
          className={`
            gap-2 text-xs font-medium h-9
            ${!isCompleted
              ? 'border-gray-200 dark:border-white/10 hover:bg-sky-50 dark:hover:bg-white/5 text-sky-600 dark:text-[#65D3FD] hover:text-sky-700 dark:hover:text-[#65D3FD]'
              : 'text-gray-500 dark:text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5'
            }
          `}
          style={{ fontFamily: "'Manrope', sans-serif" }}
          onClick={(e: React.MouseEvent) => {
            e.stopPropagation();
            onAction();
          }}
        >
          {actionLabel || (isCompleted ? 'Review info' : 'Start now')}
          {isCompleted ? <ChevronRight className="size-3.5" /> : <ArrowRight className="size-3.5" />}
        </Button>
      </div>
    </div>
  );
}