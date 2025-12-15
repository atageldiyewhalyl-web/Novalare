import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Edit, Trash2, Eye, CheckCircle2, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { projectId, publicAnonKey } from '@/utils/supabase/info';

interface AdjustingEntry {
  id: string;
  date: string;
  description: string;
  lines: Array<{
    account: string;
    accountCode: string;
    debit: string;
    credit: string;
    memo?: string;
  }>;
  totalDebit: number;
  totalCredit: number;
  status: 'draft' | 'exported';
  exportedAt?: string;
}

interface AdjustingEntriesReviewProps {
  entries: AdjustingEntry[];
  companyId: string;
  period: string;
  onRefresh: () => void;
}

export function AdjustingEntriesReview({ entries, companyId, period, onRefresh }: AdjustingEntriesReviewProps) {
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const handleDeleteEntry = async (entryId: string) => {
    setIsDeleting(entryId);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/companies/${companyId}/month-end-close/${period}/adjusting-entries/${entryId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (response.ok) {
        onRefresh();
      }
    } catch (error) {
      console.error('Failed to delete entry:', error);
    } finally {
      setIsDeleting(null);
    }
  };

  const toggleExpanded = (entryId: string) => {
    setExpandedEntry(expandedEntry === entryId ? null : entryId);
  };

  const draftEntries = entries.filter(e => e.status === 'draft');
  const exportedEntries = entries.filter(e => e.status === 'exported');

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-sm">
              4
            </div>
            <CardTitle>Review Adjusting Entries</CardTitle>
          </div>
          <Badge className="bg-purple-100 text-purple-700 border-purple-200">
            {draftEntries.length} draft · {exportedEntries.length} exported
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-gray-600 mb-4">
          Review your adjusting journal entries before exporting to QuickBooks.
        </p>

        {draftEntries.length > 0 && (
          <>
            <h4 className="text-sm text-gray-900 mb-2">Draft Entries</h4>
            {draftEntries.map((entry) => (
              <div
                key={entry.id}
                className="border border-gray-200 rounded-lg overflow-hidden hover:border-purple-300 transition-colors"
              >
                <div className="p-4 bg-gray-50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-sm text-gray-900">{entry.id}</h4>
                        <Badge variant="outline" className="text-xs">
                          {entry.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-600 mb-1">{entry.description}</p>
                      <p className="text-xs text-gray-500">Date: {entry.date}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-900">
                        ${entry.totalDebit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                      <p className="text-xs text-gray-500">{entry.lines.length} lines</p>
                    </div>
                  </div>
                </div>

                {expandedEntry === entry.id && (
                  <div className="p-4 border-t bg-white">
                    <div className="space-y-2 mb-3">
                      {entry.lines.map((line, idx) => (
                        <div key={idx} className="flex justify-between text-xs">
                          <div className="flex-1">
                            <span className="text-gray-600">
                              {line.accountCode} - {line.account}
                            </span>
                            {line.memo && (
                              <p className="text-gray-500 text-xs ml-2">{line.memo}</p>
                            )}
                          </div>
                          <div className="flex gap-6 w-48">
                            <span className="w-20 text-right text-gray-900">
                              {line.debit ? `$${parseFloat(line.debit).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '-'}
                            </span>
                            <span className="w-20 text-right text-gray-900">
                              {line.credit ? `$${parseFloat(line.credit).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '-'}
                            </span>
                          </div>
                        </div>
                      ))}
                      <div className="flex justify-between text-xs border-t pt-2 mt-2">
                        <span className="text-gray-900">Totals:</span>
                        <div className="flex gap-6 w-48">
                          <span className="w-20 text-right text-gray-900">
                            ${entry.totalDebit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </span>
                          <span className="w-20 text-right text-gray-900">
                            ${entry.totalCredit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>
                    </div>

                    {entry.totalDebit === entry.totalCredit && (
                      <div className="bg-green-50 border border-green-200 rounded px-3 py-2 flex items-center gap-2 mb-3">
                        <CheckCircle2 className="size-4 text-green-600" />
                        <span className="text-xs text-green-900">Entry is balanced</span>
                      </div>
                    )}
                  </div>
                )}

                <div className="p-3 bg-white border-t flex items-center justify-between">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => toggleExpanded(entry.id)}
                    className="gap-1"
                  >
                    <Eye className="size-3" />
                    {expandedEntry === entry.id ? 'Hide Details' : 'View Details'}
                  </Button>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" className="gap-1">
                      <Edit className="size-3" />
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDeleteEntry(entry.id)}
                      disabled={isDeleting === entry.id}
                      className="gap-1 text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="size-3" />
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </>
        )}

        {exportedEntries.length > 0 && (
          <div className="mt-6">
            <h4 className="text-sm text-gray-900 mb-2">Exported Entries</h4>
            {exportedEntries.map((entry) => (
              <div
                key={entry.id}
                className="border border-green-200 bg-green-50 rounded-lg p-4"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="size-5 text-green-600 mt-0.5" />
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-sm text-green-900">{entry.id}</h4>
                        <Badge className="bg-green-100 text-green-700 border-green-200">
                          Exported
                        </Badge>
                      </div>
                      <p className="text-xs text-green-700">{entry.description}</p>
                      <p className="text-xs text-green-600 mt-1">
                        Exported on {entry.exportedAt ? new Date(entry.exportedAt).toLocaleString() : 'N/A'}
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => toggleExpanded(entry.id)}
                    className="gap-1"
                  >
                    <Eye className="size-3" />
                    {expandedEntry === entry.id ? 'Hide' : 'View'}
                  </Button>
                </div>

                {expandedEntry === entry.id && (
                  <div className="mt-3 pl-8 space-y-1">
                    {entry.lines.map((line, idx) => (
                      <div key={idx} className="flex justify-between text-xs text-green-800">
                        <span>{line.accountCode} - {line.account}</span>
                        <span>
                          {line.debit ? `Debit: $${parseFloat(line.debit).toFixed(2)}` : `Credit: $${parseFloat(line.credit).toFixed(2)}`}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {draftEntries.length === 0 && exportedEntries.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <Clock className="size-8 mx-auto mb-2 text-gray-400" />
            <p className="text-sm">No adjusting entries yet</p>
            <p className="text-xs">Upload trial balance and let AI suggest entries</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
