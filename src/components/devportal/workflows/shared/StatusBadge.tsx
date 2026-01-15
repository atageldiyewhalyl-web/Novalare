import { Badge } from '@/components/ui/badge';

type StatusType = 'not-started' | 'in-progress' | 'ready' | 'locked' | 'completed' | 'loading' | 'warning' | 'error';

interface StatusBadgeProps {
  status: StatusType;
  customLabel?: string;
  className?: string; // Allow overriding classes
}

export function StatusBadge({ status, customLabel, className }: StatusBadgeProps) {
  const getStatusConfig = () => {
    switch (status) {
      case 'not-started':
        return {
          label: customLabel || 'Not Started',
          className: 'bg-gray-100 text-gray-500 border-gray-200 dark:bg-white/5 dark:text-gray-400 dark:border-white/5',
          dotColor: 'bg-gray-400 dark:bg-gray-500'
        };
      case 'in-progress':
      case 'warning':
        return {
          label: customLabel || 'In Progress',
          className: 'bg-sky-50 text-sky-600 border-sky-100 dark:bg-[#65D3FD]/10 dark:text-[#65D3FD] dark:border-[#65D3FD]/20',
          dotColor: 'bg-sky-500 dark:bg-[#65D3FD] animate-pulse'
        };
      case 'ready':
      case 'completed':
        return {
          label: customLabel || 'Ready',
          className: 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20',
          dotColor: 'bg-emerald-500'
        };
      case 'locked':
        return {
          label: customLabel || 'Locked',
          className: 'bg-purple-50 text-purple-600 border-purple-100 dark:bg-violet-500/10 dark:text-violet-400 dark:border-violet-500/20',
          dotColor: 'bg-purple-500 dark:bg-violet-500'
        };
      case 'error':
        return {
          label: customLabel || 'Action Required',
          className: 'bg-red-50 text-red-600 border-red-100 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20',
          dotColor: 'bg-red-500'
        };
      case 'loading':
        return {
          label: customLabel || 'Loading...',
          className: 'bg-gray-50 text-gray-400 border-transparent dark:bg-white/5',
          dotColor: 'bg-gray-400 animate-pulse'
        };
      default:
        return {
          label: customLabel || 'Unknown',
          className: 'bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-gray-400',
          dotColor: 'bg-gray-500'
        };
    }
  };

  const config = getStatusConfig();
  const finalClass = className ? className : `${config.className} border px-2.5 py-0.5 transition-colors duration-200 font-medium font-sans`;

  return (
    <Badge variant="outline" className={finalClass}>
      <span className={`size-1.5 rounded-full mr-2 ${config.dotColor}`} />
      {config.label}
    </Badge>
  );
}
