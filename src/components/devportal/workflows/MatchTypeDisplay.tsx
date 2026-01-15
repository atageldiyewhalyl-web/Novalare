// Simple display component for match types (no nested Badge)
import { Badge } from '@/components/ui/badge';

interface MatchTypeDisplayProps {
  matchType: string;
  additionalCount?: number;
}

export function MatchTypeDisplay({ matchType, additionalCount = 0 }: MatchTypeDisplayProps) {
  const getClassName = () => {
    switch (matchType) {
      case 'exact_match':
        return 'bg-violet-50 text-violet-700 border-violet-200';
      case 'fx_adjusted_match':
        return 'bg-cyan-50 text-cyan-700 border-cyan-200';
      case 'fx_tolerance':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'one_to_many':
        return 'bg-green-50 text-green-700 border-green-200';
      case 'many_to_one':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      default:
        return 'bg-gray-50 text-gray-600 border-gray-200';
    }
  };

  const getLabel = () => {
    switch (matchType) {
      case 'exact_match':
        return 'Exact';
      case 'fx_adjusted_match':
        return 'FX Match';
      case 'fx_tolerance':
        return 'Tolerance';
      case 'one_to_many':
        return '1:Many';
      case 'many_to_one':
        return `${additionalCount + 1}:1`;
      default:
        return matchType;
    }
  };

  return (
    <Badge variant="outline" className={getClassName()}>
      {getLabel()}
    </Badge>
  );
}