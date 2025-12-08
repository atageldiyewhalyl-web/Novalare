import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sparkles, Plus, Trash2, Download, Clock, CheckCircle2, AlertCircle, Settings, Building2, ChevronDown } from 'lucide-react';
import { projectId, publicAnonKey } from '@/utils/supabase/info';
import { Account } from '@/utils/coa-templates';
import { companiesApi, Company } from '@/utils/api-client';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface JournalEntriesProps {
  companyId?: string;
  companyName?: string;
}

interface LineItem {
  account: string;
  accountCode: string;
  debit: string;
  credit: string;
  memo?: string;
}

interface JournalEntry {
  id: string;
  date: string;
  description: string;
  lines: LineItem[];
  totalDebit: number;
  totalCredit: number;
  isBalanced: boolean;
  createdAt: string;
  createdBy: string;
}

export function JournalEntries({ companyId: initialCompanyId, companyName: initialCompanyName }: JournalEntriesProps) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [chartOfAccounts, setChartOfAccounts] = useState<Account[]>([]);
  const [currentEntry, setCurrentEntry] = useState<JournalEntry | null>(null);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [accountSearch, setAccountSearch] = useState<{ [key: number]: string }>({});
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Load companies list
  useEffect(() => {
    loadCompanies();
  }, []);

  const loadCompanies = async () => {
    try {
      const data = await companiesApi.getAll();
      setCompanies(data || []);
      
      // Set initial company
      if (initialCompanyId) {
        const company = data.find((c: Company) => c.id === initialCompanyId);
        if (company) {
          setSelectedCompany(company);
        }
      } else if (data.length > 0) {
        setSelectedCompany(data[0]);
      }
    } catch (error) {
      console.error('Failed to load companies:', error);
    }
  };

  // Load chart of accounts for selected company
  useEffect(() => {
    if (selectedCompany) {
      loadChartOfAccounts();
      loadHistory();
    }
  }, [selectedCompany]);

  const loadChartOfAccounts = async () => {
    if (!selectedCompany) return;
    
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/companies/${selectedCompany.id}/coa`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        setChartOfAccounts(data.accounts || []);
      }
    } catch (error) {
      console.error('Failed to load chart of accounts for company:', selectedCompany.id, error);
    }
  };

  // Load journal entries for selected company
  const loadHistory = async () => {
    if (!selectedCompany) return;
    
    setIsLoadingHistory(true);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/companies/${selectedCompany.id}/journal-entries`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        setEntries(data.entries || []);
      }
    } catch (error) {
      console.error('Failed to load journal entry history for company:', selectedCompany.id, error);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleAIGenerate = async () => {
    if (!aiPrompt.trim()) return;
    
    setIsGenerating(true);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/journal-entries/generate`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            prompt: aiPrompt,
            chartOfAccounts: chartOfAccounts,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to generate journal entry');
      }

      const data = await response.json();
      
      // Create new entry from AI response
      const newEntry: JournalEntry = {
        id: `je_draft_${Date.now()}`,
        date: new Date().toISOString().split('T')[0],
        description: data.description,
        lines: data.lines.map((line: any, idx: number) => ({
          account: line.accountName,
          accountCode: line.account,
          debit: line.debit || 0,
          credit: line.credit || 0,
        })),
        totalDebit: 0,
        totalCredit: 0,
        isBalanced: false,
        createdAt: Date.now().toString(),
        createdBy: 'AI',
      };

      setCurrentEntry(newEntry);
      setAiPrompt('');
    } catch (error) {
      console.error('AI generation error:', error);
      alert('Failed to generate journal entry. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const addNewLine = () => {
    if (!currentEntry) {
      // Create new blank entry
      const newEntry: JournalEntry = {
        id: `je_draft_${Date.now()}`,
        date: new Date().toISOString().split('T')[0],
        description: '',
        lines: [{
          account: '',
          accountCode: '',
          debit: '0.00',
          credit: '0.00',
        }],
        totalDebit: 0,
        totalCredit: 0,
        isBalanced: false,
        createdAt: Date.now().toString(),
        createdBy: 'User',
      };
      setCurrentEntry(newEntry);
    } else {
      setCurrentEntry({
        ...currentEntry,
        lines: [
          ...currentEntry.lines,
          {
            account: '',
            accountCode: '',
            debit: '0.00',
            credit: '0.00',
          },
        ],
      });
    }
  };

  const removeLine = (lineIndex: number) => {
    if (!currentEntry) return;
    setCurrentEntry({
      ...currentEntry,
      lines: currentEntry.lines.filter((_, index) => index !== lineIndex),
    });
  };

  const updateLine = (lineIndex: number, field: keyof LineItem, value: any) => {
    if (!currentEntry) return;
    setCurrentEntry({
      ...currentEntry,
      lines: currentEntry.lines.map((line, index) =>
        index === lineIndex ? { ...line, [field]: value } : line
      ),
    });
  };

  const selectAccount = (lineIndex: number, accountCode: string) => {
    const account = chartOfAccounts.find(a => a.code === accountCode);
    if (!account) return;
    
    updateLine(lineIndex, 'account', account.name);
    updateLine(lineIndex, 'accountCode', accountCode);
    
    // Clear search
    setAccountSearch(prev => ({ ...prev, [lineIndex]: '' }));
  };

  const calculateBalance = () => {
    if (!currentEntry) return { debit: 0, credit: 0, balanced: true };
    
    const debitTotal = currentEntry.lines.reduce((sum, line) => sum + parseFloat(line.debit || '0'), 0);
    const creditTotal = currentEntry.lines.reduce((sum, line) => sum + parseFloat(line.credit || '0'), 0);
    
    return {
      debit: debitTotal,
      credit: creditTotal,
      balanced: Math.abs(debitTotal - creditTotal) < 0.01,
    };
  };

  const postEntry = async () => {
    if (!currentEntry) return;
    
    const balance = calculateBalance();
    if (!balance.balanced) {
      alert('Entry is not balanced! Debits must equal Credits.');
      return;
    }
    
    if (!currentEntry.description.trim()) {
      alert('Please add a description for this journal entry.');
      return;
    }
    
    if (currentEntry.lines.some(line => !line.accountCode)) {
      alert('All lines must have an account selected.');
      return;
    }

    try {
      const postedEntry = {
        ...currentEntry,
        status: 'posted' as const,
        id: `je_${Date.now()}`,
        createdAt: Date.now(),
      };

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/companies/${selectedCompany?.id}/journal-entries`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(postedEntry),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to post journal entry');
      }

      // Clear current entry and reload history
      setCurrentEntry(null);
      loadHistory();
      
      alert('Journal entry posted successfully!');
    } catch (error) {
      console.error('Failed to post entry:', error);
      alert('Failed to post journal entry. Please try again.');
    }
  };

  const clearEntry = () => {
    setCurrentEntry(null);
    setAccountSearch({});
  };

  const exportToExcel = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/journal-entries/export`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Export error details:', errorData);
        throw new Error(errorData.details || 'Export failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Journal_Entries_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Export error:', error);
      alert('Failed to export journal entries: ' + error.message);
    }
  };

  const formatCurrency = (amount: number) => {
    return `€${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const balance = calculateBalance();
  const filteredAccounts = (lineIndex: number) => {
    const search = accountSearch[lineIndex] || '';
    if (!search) return chartOfAccounts;
    
    const searchLower = search.toLowerCase();
    return chartOfAccounts.filter(
      acc => acc.code.includes(searchLower) || acc.name.toLowerCase().includes(searchLower)
    );
  };

  return (
    <div className="space-y-6">
      {/* Header with Company Selector */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <h1 className="text-3xl text-gray-900">Journal Entries</h1>
          <p className="text-gray-500 mt-1">Create and manage journal entries with AI assistance</p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Company Selector */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2 h-10 min-w-[200px]">
                <Building2 className="size-4 text-purple-600" />
                <span className="flex-1 text-left truncate">
                  {selectedCompany?.name || 'Select Company'}
                </span>
                <ChevronDown className="size-4 text-gray-500" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[250px]">
              {companies.length === 0 ? (
                <div className="px-3 py-2 text-sm text-gray-500">
                  No companies available
                </div>
              ) : (
                companies.map((company) => (
                  <DropdownMenuItem
                    key={company.id}
                    onClick={() => setSelectedCompany(company)}
                    className={`cursor-pointer ${
                      selectedCompany?.id === company.id ? 'bg-purple-50' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3 w-full">
                      <Building2 className={`size-4 ${
                        selectedCompany?.id === company.id ? 'text-purple-600' : 'text-gray-400'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-gray-900 truncate">{company.name}</div>
                        <div className="text-xs text-gray-500">{company.country}</div>
                      </div>
                      {selectedCompany?.id === company.id && (
                        <CheckCircle2 className="size-4 text-purple-600 flex-shrink-0" />
                      )}
                    </div>
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          
          <Button 
            variant="outline" 
            className="gap-2 h-10"
            onClick={exportToExcel}
          >
            <Download className="size-4" />
            <span className="text-sm hidden sm:inline">Export</span>
          </Button>
        </div>
      </div>

      {/* Chart of Accounts Status */}
      {selectedCompany && (
        <Card className="bg-blue-50/50 border-blue-100">
          <CardContent className="py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="size-8 rounded-lg bg-blue-100 flex items-center justify-center">
                  <Building2 className="size-4 text-blue-600" />
                </div>
                <div>
                  <div className="text-sm text-gray-900">
                    Working on: <span className="font-medium">{selectedCompany.name}</span>
                  </div>
                  <div className="text-xs text-gray-600">
                    {chartOfAccounts.length} accounts available • {entries.length} entries posted
                  </div>
                </div>
              </div>
              {chartOfAccounts.length === 0 && (
                <div className="flex items-center gap-2 text-orange-600 text-sm">
                  <AlertCircle className="size-4" />
                  <span>No Chart of Accounts configured</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* AI Entry Generator */}
      <Card className="border-2 border-purple-100 bg-gradient-to-br from-purple-50/50 to-violet-50/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="size-5 text-purple-600" />
            AI Journal Entry Generator
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm text-gray-600 mb-2 block">
              Describe the journal entry you want to create
            </label>
            <div className="flex gap-3">
              <Input
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="e.g., Record $5,000 rent payment for December"
                className="flex-1 h-12"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !isGenerating) {
                    handleAIGenerate();
                  }
                }}
              />
              <Button
                onClick={handleAIGenerate}
                disabled={isGenerating || !aiPrompt.trim()}
                className="h-12 px-6 bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700"
              >
                {isGenerating ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="size-4 mr-2" />
                    Generate Entry
                  </>
                )}
              </Button>
            </div>
          </div>
          
          <div className="text-xs text-gray-500 space-y-1">
            <p className="font-medium">Examples:</p>
            <ul className="list-disc list-inside space-y-0.5 ml-2">
              <li>"Record €3,500 rent expense for January"</li>
              <li>"Accrue €1,200 salary expense"</li>
              <li>"Depreciate equipment by €500"</li>
              <li>"Record €10,000 cash sale"</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Manual Entry Editor */}
      {currentEntry && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Journal Entry Editor</CardTitle>
              <div className="flex items-center gap-3">
                {balance.balanced ? (
                  <div className="flex items-center gap-2 text-green-600 text-sm">
                    <CheckCircle2 className="size-4" />
                    <span>Balanced</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-red-600 text-sm">
                    <AlertCircle className="size-4" />
                    <span>Out of Balance</span>
                  </div>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Entry Header */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-600 mb-1 block">Date</label>
                <Input
                  type="date"
                  value={currentEntry.date}
                  onChange={(e) => setCurrentEntry({ ...currentEntry, date: e.target.value })}
                  className="h-10"
                />
              </div>
              <div>
                <label className="text-sm text-gray-600 mb-1 block">Description</label>
                <Input
                  value={currentEntry.description}
                  onChange={(e) => setCurrentEntry({ ...currentEntry, description: e.target.value })}
                  placeholder="Enter description"
                  className="h-10"
                />
              </div>
            </div>

            {/* Lines Table */}
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left py-3 px-4 text-gray-600 text-sm w-[25%]">Account</th>
                    <th className="text-left py-3 px-4 text-gray-600 text-sm w-[20%]">Debit</th>
                    <th className="text-left py-3 px-4 text-gray-600 text-sm w-[20%]">Credit</th>
                    <th className="text-left py-3 px-4 text-gray-600 text-sm w-[25%]">Memo</th>
                    <th className="text-left py-3 px-4 text-gray-600 text-sm w-[10%]"></th>
                  </tr>
                </thead>
                <tbody>
                  {currentEntry.lines.map((line, index) => (
                    <tr key={index} className="border-t border-gray-100">
                      <td className="py-3 px-4">
                        {line.accountCode ? (
                          <div className="text-sm">
                            <div className="text-gray-900">{line.accountCode} - {line.account}</div>
                            <button
                              onClick={() => updateLine(index, 'accountCode', '')}
                              className="text-xs text-purple-600 hover:text-purple-700"
                            >
                              Change
                            </button>
                          </div>
                        ) : (
                          <div className="relative">
                            <Input
                              value={accountSearch[index] || ''}
                              onChange={(e) => setAccountSearch({ ...accountSearch, [index]: e.target.value })}
                              placeholder="Search account..."
                              className="h-9 text-sm"
                            />
                            {accountSearch[index] && (
                              <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                                {filteredAccounts(index).map((acc) => (
                                  <button
                                    key={acc.code}
                                    onClick={() => selectAccount(index, acc.code)}
                                    className="w-full text-left px-3 py-2 hover:bg-purple-50 text-sm border-b border-gray-100 last:border-b-0"
                                  >
                                    <div className="text-gray-900">{acc.code} - {acc.name}</div>
                                    <div className="text-xs text-gray-500">{acc.type}</div>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <Input
                          type="number"
                          step="0.01"
                          value={line.debit || ''}
                          onChange={(e) => updateLine(index, 'debit', e.target.value)}
                          placeholder="0.00"
                          className="h-9 text-sm"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <Input
                          type="number"
                          step="0.01"
                          value={line.credit || ''}
                          onChange={(e) => updateLine(index, 'credit', e.target.value)}
                          placeholder="0.00"
                          className="h-9 text-sm"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <Input
                          value={line.memo}
                          onChange={(e) => updateLine(index, 'memo', e.target.value)}
                          placeholder="Optional memo"
                          className="h-9 text-sm"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeLine(index)}
                          className="h-8 w-8 p-0 text-gray-400 hover:text-red-600"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                  <tr>
                    <td className="py-3 px-4 text-sm text-gray-600">Totals</td>
                    <td className="py-3 px-4 text-sm text-gray-900">{formatCurrency(balance.debit)}</td>
                    <td className="py-3 px-4 text-sm text-gray-900">{formatCurrency(balance.credit)}</td>
                    <td colSpan={2}></td>
                  </tr>
                  <tr>
                    <td colSpan={5} className="py-2 px-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {balance.balanced ? (
                            <div className="flex items-center gap-2 text-green-600 text-sm">
                              <CheckCircle2 className="size-4" />
                              <span>Entry is balanced</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 text-red-600 text-sm">
                              <AlertCircle className="size-4" />
                              <span>Difference: {formatCurrency(Math.abs(balance.debit - balance.credit))}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Actions */}
            <div className="flex gap-3 justify-between">
              <Button
                variant="outline"
                onClick={addNewLine}
                className="gap-2"
              >
                <Plus className="size-4" />
                Add Line
              </Button>
              
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={clearEntry}
                >
                  Clear
                </Button>
                <Button
                  onClick={postEntry}
                  disabled={!balance.balanced}
                  className="bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700"
                >
                  Post Entry
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      {!currentEntry && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-center">
              <Button
                onClick={addNewLine}
                variant="outline"
                className="gap-2 h-12"
              >
                <Plus className="size-4" />
                Create Manual Entry
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="size-5" />
            Posted Entries
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingHistory ? (
            <div className="text-center py-12 text-gray-500">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-purple-600 border-t-transparent mx-auto mb-3" />
              Loading entries...
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              No journal entries posted yet. Create your first entry above!
            </div>
          ) : (
            <div className="space-y-4">
              {entries.map((entry) => {
                const entryBalance = {
                  debit: entry.lines.reduce((sum, line) => sum + parseFloat(line.debit || '0'), 0),
                  credit: entry.lines.reduce((sum, line) => sum + parseFloat(line.credit || '0'), 0),
                };
                
                return (
                  <div key={entry.id} className="border border-gray-200 rounded-lg p-4 hover:border-purple-200 transition-colors">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-gray-500">{entry.id}</span>
                          <span className="text-sm text-gray-500">
                            {new Date(entry.date).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric'
                            })}
                          </span>
                        </div>
                        <p className="text-gray-900 mt-1">{entry.description}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="size-4 text-green-600" />
                        <span className="text-sm text-green-600">Posted</span>
                      </div>
                    </div>
                    
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="border-b border-gray-200">
                          <tr>
                            <th className="text-left py-2 text-gray-600">Account</th>
                            <th className="text-right py-2 text-gray-600">Debit</th>
                            <th className="text-right py-2 text-gray-600">Credit</th>
                            <th className="text-left py-2 text-gray-600">Memo</th>
                          </tr>
                        </thead>
                        <tbody>
                          {entry.lines.map((line) => (
                            <tr key={line.accountCode} className="border-b border-gray-100 last:border-b-0">
                              <td className="py-2 text-gray-900">
                                {line.accountCode} - {line.account}
                              </td>
                              <td className="py-2 text-right text-gray-900">
                                {line.debit ? formatCurrency(parseFloat(line.debit)) : '-'}
                              </td>
                              <td className="py-2 text-right text-gray-900">
                                {line.credit ? formatCurrency(parseFloat(line.credit)) : '-'}
                              </td>
                              <td className="py-2 text-gray-600">{line.memo || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="border-t-2 border-gray-200">
                          <tr>
                            <td className="py-2 text-gray-600">Total</td>
                            <td className="py-2 text-right text-gray-900">{formatCurrency(entryBalance.debit)}</td>
                            <td className="py-2 text-right text-gray-900">{formatCurrency(entryBalance.credit)}</td>
                            <td></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}