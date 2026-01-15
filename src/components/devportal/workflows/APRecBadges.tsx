// Helper component for AP Reconciliation Match Type and Status Badges
// To use: import { MatchTypeBadge, MatchStatusBadge, getMatchTypeClassName, getMatchTypeLabel } from './APRecBadges';

import { Badge } from '@/components/ui/badge';

interface MatchTypeBadgeProps {
  matchType: string;
  additionalTransactionsCount?: number;
}

// Export helper to get className for external Badge wrappers
export function getMatchTypeClassName(matchType: string): string {
  switch (matchType) {
    case 'exact_match':
      return 'bg-violet-50 text-violet-700 border-violet-200';
    case 'one_to_many':
      return 'bg-green-50 text-green-700 border-green-200';
    case 'many_to_one':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'fx_tolerance':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    default:
      return 'bg-gray-50 text-gray-600 border-gray-200';
  }
}

// Export helper to get label text
export function getMatchTypeLabel(matchType: string, additionalCount: number = 0): string {
  switch (matchType) {
    case 'exact_match':
      return 'exact';
    case 'one_to_many':
      return '1:many';
    case 'many_to_one':
      return `${additionalCount + 1}:1`;
    case 'fx_tolerance':
      return 'Tolerance';
    default:
      return matchType;
  }
}

export function MatchTypeBadge({ matchType, additionalTransactionsCount = 0 }: MatchTypeBadgeProps) {
  return (
    <Badge variant="outline" className={getMatchTypeClassName(matchType)}>
      {getMatchTypeLabel(matchType, additionalTransactionsCount)}
    </Badge>
  );
}

interface MatchStatusBadgeProps {
  matchStatus?: 'auto_approved' | 'review_recommended' | 'manual_review_required';
  confidence: number;
}

export function MatchStatusBadge({ matchStatus, confidence }: MatchStatusBadgeProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-gray-600">
        {typeof confidence === 'number' ? Math.round(confidence) : confidence}%
      </span>
      {matchStatus === 'manual_review_required' && (
        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-xs">
          Review Required
        </Badge>
      )}
      {matchStatus === 'review_recommended' && (
        <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 text-xs">
          Review
        </Badge>
      )}
      {matchStatus === 'auto_approved' && (
        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">
          ✓
        </Badge>
      )}
    </div>
  );
}
