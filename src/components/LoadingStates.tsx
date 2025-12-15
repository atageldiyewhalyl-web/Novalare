import { ReactNode } from 'react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'purple' | 'blue';
  className?: string;
}

/**
 * Reusable loading spinner component
 */
export function LoadingSpinner({ 
  size = 'md', 
  variant = 'purple',
  className = '' 
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'w-6 h-6 border-2',
    md: 'w-12 h-12 border-4',
    lg: 'w-16 h-16 border-4',
  };

  const variantClasses = {
    default: 'border-gray-200 border-t-gray-600',
    purple: 'border-purple-500/30 border-t-purple-500',
    blue: 'border-blue-200 border-t-blue-600',
  };

  return (
    <div
      className={`rounded-full animate-spin ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
    />
  );
}

interface PageLoaderProps {
  message?: string;
  variant?: 'dark' | 'light';
}

/**
 * Full-page loading state
 */
export function PageLoader({ 
  message = 'Loading...', 
  variant = 'dark' 
}: PageLoaderProps) {
  const bgClass = variant === 'dark' ? 'bg-black' : 'bg-white';
  const textClass = variant === 'dark' ? 'text-purple-200' : 'text-gray-600';
  const spinnerVariant = variant === 'dark' ? 'purple' : 'blue';

  return (
    <div className={`min-h-screen ${bgClass} flex items-center justify-center`}>
      <div className="text-center">
        <LoadingSpinner size="lg" variant={spinnerVariant} className="mx-auto mb-4" />
        <p 
          className={textClass}
          style={{
            fontFamily: "'Manrope', sans-serif",
            fontWeight: 500,
          }}
        >
          {message}
        </p>
      </div>
    </div>
  );
}

interface SectionLoaderProps {
  message?: string;
  variant?: 'dark' | 'light';
  className?: string;
}

/**
 * Section-level loading state for cards, panels, etc.
 */
export function SectionLoader({ 
  message = 'Loading...', 
  variant = 'light',
  className = ''
}: SectionLoaderProps) {
  const textClass = variant === 'dark' ? 'text-gray-400' : 'text-gray-600';
  const spinnerVariant = variant === 'dark' ? 'purple' : 'blue';

  return (
    <div className={`flex items-center justify-center py-12 ${className}`}>
      <div className="text-center">
        <LoadingSpinner size="md" variant={spinnerVariant} className="mx-auto mb-4" />
        <p className={`text-sm ${textClass}`}>{message}</p>
      </div>
    </div>
  );
}

interface InlineLoaderProps {
  message?: string;
  className?: string;
}

/**
 * Inline loading state for buttons, inputs, etc.
 */
export function InlineLoader({ message, className = '' }: InlineLoaderProps) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <LoadingSpinner size="sm" variant="default" />
      {message && <span className="text-sm text-gray-500">{message}</span>}
    </span>
  );
}

interface SkeletonProps {
  className?: string;
  variant?: 'dark' | 'light';
}

/**
 * Skeleton placeholder for content loading
 */
export function Skeleton({ className = '', variant = 'light' }: SkeletonProps) {
  const bgClass = variant === 'dark' 
    ? 'bg-purple-500/10' 
    : 'bg-gray-200';

  return (
    <div 
      className={`animate-pulse rounded ${bgClass} ${className}`} 
    />
  );
}

interface SkeletonTextProps {
  lines?: number;
  variant?: 'dark' | 'light';
  className?: string;
}

/**
 * Skeleton for text content
 */
export function SkeletonText({ 
  lines = 3, 
  variant = 'light',
  className = '' 
}: SkeletonTextProps) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton 
          key={i} 
          variant={variant}
          className={`h-4 ${i === lines - 1 ? 'w-3/4' : 'w-full'}`} 
        />
      ))}
    </div>
  );
}

interface SkeletonCardProps {
  variant?: 'dark' | 'light';
  className?: string;
}

/**
 * Skeleton for card content
 */
export function SkeletonCard({ variant = 'light', className = '' }: SkeletonCardProps) {
  const borderClass = variant === 'dark' 
    ? 'border-purple-500/20 bg-gray-900/50' 
    : 'border-gray-200 bg-white';

  return (
    <div className={`rounded-lg border p-6 ${borderClass} ${className}`}>
      <div className="flex items-center gap-4 mb-4">
        <Skeleton variant={variant} className="w-12 h-12 rounded-full" />
        <div className="flex-1">
          <Skeleton variant={variant} className="h-4 w-1/3 mb-2" />
          <Skeleton variant={variant} className="h-3 w-1/2" />
        </div>
      </div>
      <SkeletonText variant={variant} lines={3} />
    </div>
  );
}

interface LoadingOverlayProps {
  isLoading: boolean;
  children: ReactNode;
  message?: string;
}

/**
 * Overlay that shows loading state over existing content
 */
export function LoadingOverlay({ 
  isLoading, 
  children, 
  message = 'Loading...' 
}: LoadingOverlayProps) {
  return (
    <div className="relative">
      {children}
      {isLoading && (
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center rounded-lg z-10">
          <div className="text-center">
            <LoadingSpinner size="md" variant="purple" className="mx-auto mb-2" />
            <p className="text-white text-sm">{message}</p>
          </div>
        </div>
      )}
    </div>
  );
}

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  variant?: 'dark' | 'light';
  className?: string;
}

/**
 * Empty state component for when there's no data
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  variant = 'light',
  className = '',
}: EmptyStateProps) {
  const textClass = variant === 'dark' ? 'text-white' : 'text-gray-900';
  const descClass = variant === 'dark' ? 'text-gray-400' : 'text-gray-500';

  return (
    <div className={`text-center py-12 ${className}`}>
      {icon && (
        <div className="mb-4 flex justify-center">
          {icon}
        </div>
      )}
      <h3 
        className={`text-lg font-semibold ${textClass} mb-1`}
        style={{ fontFamily: "'Outfit', sans-serif" }}
      >
        {title}
      </h3>
      {description && (
        <p 
          className={`text-sm ${descClass} mb-4`}
          style={{ fontFamily: "'Manrope', sans-serif" }}
        >
          {description}
        </p>
      )}
      {action && <div>{action}</div>}
    </div>
  );
}

