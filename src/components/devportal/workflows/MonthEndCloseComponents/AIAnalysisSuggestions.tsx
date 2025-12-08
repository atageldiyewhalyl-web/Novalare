import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles, TrendingDown, Calendar, RefreshCw, CheckCircle2, Loader2, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface AISuggestion {
  id: string;
  type: 'depreciation' | 'amortization' | 'accrual' | 'reclassification';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  amount: number;
  suggestedEntry: {
    debit: { account: string; accountCode: string; amount: number };
    credit: { account: string; accountCode: string; amount: number };
  };
  reasoning: string;
}

interface AIAnalysisSuggestionsProps {
  suggestions: AISuggestion[];
  isAnalyzing: boolean;
  onGenerateEntry: (suggestion: AISuggestion) => void;
  onGenerateAll: () => void;
}

export function AIAnalysisSuggestions({ 
  suggestions, 
  isAnalyzing,
  onGenerateEntry,
  onGenerateAll 
}: AIAnalysisSuggestionsProps) {
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'depreciation':
        return <TrendingDown className="size-4" />;
      case 'amortization':
        return <Calendar className="size-4" />;
      case 'accrual':
        return <RefreshCw className="size-4" />;
      default:
        return <AlertTriangle className="size-4" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'low':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  if (isAnalyzing) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-sm">
              3
            </div>
            <CardTitle>AI Analysis</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="size-8 text-purple-600 animate-spin mb-3" />
            <p className="text-sm text-gray-600">Analyzing trial balance...</p>
            <p className="text-xs text-gray-500 mt-1">AI is reviewing accounts for adjustments</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (suggestions.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-sm">
              3
            </div>
            <CardTitle>AI Analysis & Suggestions</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-purple-600" />
            <span className="text-sm text-gray-600">{suggestions.length} suggestions found</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-gray-600">
          AI analyzed your trial balance and identified the following recommended adjusting entries:
        </p>

        <div className="space-y-3">
          {suggestions.map((suggestion) => (
            <div
              key={suggestion.id}
              className="border border-gray-200 rounded-lg p-4 hover:border-purple-300 transition-colors"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-start gap-3">
                  <div className="mt-1">
                    {getTypeIcon(suggestion.type)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="text-sm text-gray-900">{suggestion.title}</h4>
                      <Badge className={getPriorityColor(suggestion.priority)}>
                        {suggestion.priority} priority
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-600">{suggestion.description}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-900">${suggestion.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-3 mb-3">
                <p className="text-xs text-gray-600 mb-2">💡 AI Reasoning:</p>
                <p className="text-xs text-gray-700">{suggestion.reasoning}</p>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-3 mb-3">
                <p className="text-xs text-gray-600 mb-2">Suggested Journal Entry:</p>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-600">
                      Debit: {suggestion.suggestedEntry.debit.accountCode} - {suggestion.suggestedEntry.debit.account}
                    </span>
                    <span className="text-gray-900">
                      ${suggestion.suggestedEntry.debit.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">
                      Credit: {suggestion.suggestedEntry.credit.accountCode} - {suggestion.suggestedEntry.credit.account}
                    </span>
                    <span className="text-gray-900">
                      ${suggestion.suggestedEntry.credit.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {/* Handle dismiss */}}
                >
                  Dismiss
                </Button>
                <Button
                  size="sm"
                  onClick={() => onGenerateEntry(suggestion)}
                  className="gap-1"
                >
                  <CheckCircle2 className="size-3" />
                  Generate Entry
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="border-t pt-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Review all suggestions or generate all entries at once
            </p>
            <Button onClick={onGenerateAll} className="gap-2">
              <Sparkles className="size-4" />
              Generate All Entries
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
