import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Download, Upload, Trash2, Edit2, Check, X, BookOpen } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Account, COA_TEMPLATES, TemplateKey } from '@/utils/coa-templates';
import { projectId, publicAnonKey } from '@/utils/supabase/info';

interface ChartOfAccountsManagerProps {
  companyId: string;
  companyName: string;
}

export function ChartOfAccountsManager({ companyId, companyName }: ChartOfAccountsManagerProps) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Account | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [newAccount, setNewAccount] = useState<Account>({
    code: '',
    name: '',
    type: 'Expense',
    subtype: '',
    description: '',
    isActive: true,
  });
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showTemplates, setShowTemplates] = useState(false);

  useEffect(() => {
    loadChartOfAccounts();
  }, [companyId]);

  const loadChartOfAccounts = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/companies/${companyId}/coa`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setAccounts(data.accounts || []);
      }
    } catch (error) {
      console.error('Failed to load chart of accounts:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveChartOfAccounts = async (updatedAccounts: Account[]) => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/companies/${companyId}/coa`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ accounts: updatedAccounts }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to save chart of accounts');
      }

      setAccounts(updatedAccounts);
      return true;
    } catch (error) {
      console.error('Failed to save COA:', error);
      alert('Failed to save changes. Please try again.');
      return false;
    }
  };

  const handleLoadTemplate = async (templateKey: TemplateKey) => {
    const template = COA_TEMPLATES[templateKey];
    if (!template) return;

    const confirmLoad = confirm(
      `Load ${template.name} template?\n\nThis will replace your current chart of accounts with ${template.accounts.length} accounts.`
    );

    if (!confirmLoad) return;

    const success = await saveChartOfAccounts(template.accounts);
    if (success) {
      setShowTemplates(false);
      alert(`${template.name} template loaded successfully!`);
    }
  };

  const handleAddAccount = async () => {
    if (!newAccount.code || !newAccount.name) {
      alert('Please enter both account code and name.');
      return;
    }

    // Check for duplicate code
    if (accounts.some(acc => acc.code === newAccount.code)) {
      alert('An account with this code already exists.');
      return;
    }

    const updatedAccounts = [...accounts, { ...newAccount }];
    const success = await saveChartOfAccounts(updatedAccounts);
    
    if (success) {
      setIsAdding(false);
      setNewAccount({
        code: '',
        name: '',
        type: 'Expense',
        subtype: '',
        description: '',
        isActive: true,
      });
    }
  };

  const handleEditAccount = (account: Account) => {
    setEditingId(account.code);
    setEditForm({ ...account });
  };

  const handleSaveEdit = async () => {
    if (!editForm) return;

    const updatedAccounts = accounts.map(acc =>
      acc.code === editingId ? editForm : acc
    );

    const success = await saveChartOfAccounts(updatedAccounts);
    if (success) {
      setEditingId(null);
      setEditForm(null);
    }
  };

  const handleDeleteAccount = async (code: string) => {
    const confirmDelete = confirm('Are you sure you want to delete this account?');
    if (!confirmDelete) return;

    const updatedAccounts = accounts.filter(acc => acc.code !== code);
    await saveChartOfAccounts(updatedAccounts);
  };

  const toggleAccountStatus = async (code: string) => {
    const updatedAccounts = accounts.map(acc =>
      acc.code === code ? { ...acc, isActive: !acc.isActive } : acc
    );
    await saveChartOfAccounts(updatedAccounts);
  };

  const exportToCSV = () => {
    const headers = ['Code', 'Name', 'Type', 'Subtype', 'Description', 'Status'];
    const rows = accounts.map(acc => [
      acc.code,
      acc.name,
      acc.type,
      acc.subtype || '',
      acc.description || '',
      acc.isActive ? 'Active' : 'Inactive'
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${companyName}_Chart_of_Accounts_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const filteredAccounts = accounts.filter(acc => {
    const matchesType = filterType === 'all' || acc.type === filterType;
    const matchesSearch = 
      acc.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      acc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (acc.description && acc.description.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesType && matchesSearch;
  });

  const accountsByType = {
    Asset: filteredAccounts.filter(a => a.type === 'Asset'),
    Liability: filteredAccounts.filter(a => a.type === 'Liability'),
    Equity: filteredAccounts.filter(a => a.type === 'Equity'),
    Revenue: filteredAccounts.filter(a => a.type === 'Revenue'),
    Expense: filteredAccounts.filter(a => a.type === 'Expense'),
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'Asset': return 'bg-blue-100 text-blue-700';
      case 'Liability': return 'bg-red-100 text-red-700';
      case 'Equity': return 'bg-purple-100 text-purple-700';
      case 'Revenue': return 'bg-green-100 text-green-700';
      case 'Expense': return 'bg-orange-100 text-orange-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl text-gray-900">Chart of Accounts</h1>
            <p className="text-gray-500 mt-1">{companyName}</p>
          </div>
        </div>
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-purple-600 border-t-transparent mx-auto mb-3" />
              <p className="text-gray-500">Loading chart of accounts...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl text-gray-900">Chart of Accounts</h1>
          <p className="text-gray-500 mt-1">{companyName}</p>
        </div>
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={exportToCSV}
            className="gap-2"
          >
            <Download className="size-4" />
            Export CSV
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowTemplates(!showTemplates)}
            className="gap-2"
          >
            <BookOpen className="size-4" />
            Templates
          </Button>
          <Button
            onClick={() => setIsAdding(true)}
            className="gap-2 bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700"
          >
            <Plus className="size-4" />
            Add Account
          </Button>
        </div>
      </div>

      {/* Templates Selector */}
      {showTemplates && (
        <Card className="border-2 border-purple-200">
          <CardHeader>
            <CardTitle>Choose Industry Template</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(COA_TEMPLATES).map(([key, template]) => (
                <button
                  key={key}
                  onClick={() => handleLoadTemplate(key as TemplateKey)}
                  className="text-left p-4 border border-gray-200 rounded-lg hover:border-purple-300 hover:bg-purple-50 transition-colors"
                >
                  <div className="text-gray-900 mb-1">{template.name}</div>
                  <div className="text-sm text-gray-600 mb-2">{template.description}</div>
                  <div className="text-xs text-gray-500">{template.accounts.length} accounts</div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4 items-center">
            <div className="flex-1">
              <Input
                placeholder="Search accounts by code, name, or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-10"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant={filterType === 'all' ? 'default' : 'outline'}
                onClick={() => setFilterType('all')}
                size="sm"
              >
                All ({accounts.length})
              </Button>
              <Button
                variant={filterType === 'Asset' ? 'default' : 'outline'}
                onClick={() => setFilterType('Asset')}
                size="sm"
              >
                Assets ({accountsByType.Asset.length})
              </Button>
              <Button
                variant={filterType === 'Liability' ? 'default' : 'outline'}
                onClick={() => setFilterType('Liability')}
                size="sm"
              >
                Liabilities ({accountsByType.Liability.length})
              </Button>
              <Button
                variant={filterType === 'Equity' ? 'default' : 'outline'}
                onClick={() => setFilterType('Equity')}
                size="sm"
              >
                Equity ({accountsByType.Equity.length})
              </Button>
              <Button
                variant={filterType === 'Revenue' ? 'default' : 'outline'}
                onClick={() => setFilterType('Revenue')}
                size="sm"
              >
                Revenue ({accountsByType.Revenue.length})
              </Button>
              <Button
                variant={filterType === 'Expense' ? 'default' : 'outline'}
                onClick={() => setFilterType('Expense')}
                size="sm"
              >
                Expenses ({accountsByType.Expense.length})
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Add New Account Form */}
      {isAdding && (
        <Card className="border-2 border-purple-200">
          <CardHeader>
            <CardTitle>Add New Account</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-600 mb-1 block">Account Code *</label>
                <Input
                  value={newAccount.code}
                  onChange={(e) => setNewAccount({ ...newAccount, code: e.target.value })}
                  placeholder="e.g., 7000"
                />
              </div>
              <div>
                <label className="text-sm text-gray-600 mb-1 block">Account Name *</label>
                <Input
                  value={newAccount.name}
                  onChange={(e) => setNewAccount({ ...newAccount, name: e.target.value })}
                  placeholder="e.g., Custom Expense"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-600 mb-1 block">Type *</label>
                <select
                  value={newAccount.type}
                  onChange={(e) => setNewAccount({ ...newAccount, type: e.target.value as any })}
                  className="w-full h-10 px-3 border border-gray-200 rounded-md"
                >
                  <option value="Asset">Asset</option>
                  <option value="Liability">Liability</option>
                  <option value="Equity">Equity</option>
                  <option value="Revenue">Revenue</option>
                  <option value="Expense">Expense</option>
                </select>
              </div>
              <div>
                <label className="text-sm text-gray-600 mb-1 block">Subtype</label>
                <Input
                  value={newAccount.subtype}
                  onChange={(e) => setNewAccount({ ...newAccount, subtype: e.target.value })}
                  placeholder="e.g., Operating Expense"
                />
              </div>
            </div>
            <div>
              <label className="text-sm text-gray-600 mb-1 block">Description</label>
              <Input
                value={newAccount.description}
                onChange={(e) => setNewAccount({ ...newAccount, description: e.target.value })}
                placeholder="Optional description"
              />
            </div>
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setIsAdding(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleAddAccount}
                className="bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700"
              >
                Add Account
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Accounts Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            Accounts ({filteredAccounts.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredAccounts.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 mb-4">
                {accounts.length === 0 
                  ? 'No accounts configured yet. Load a template or add accounts manually.'
                  : 'No accounts match your search criteria.'}
              </p>
              {accounts.length === 0 && (
                <Button
                  onClick={() => setShowTemplates(true)}
                  variant="outline"
                  className="gap-2"
                >
                  <BookOpen className="size-4" />
                  Load Industry Template
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-gray-600 text-sm">Code</th>
                    <th className="text-left py-3 px-4 text-gray-600 text-sm">Name</th>
                    <th className="text-left py-3 px-4 text-gray-600 text-sm">Type</th>
                    <th className="text-left py-3 px-4 text-gray-600 text-sm">Subtype</th>
                    <th className="text-left py-3 px-4 text-gray-600 text-sm">Description</th>
                    <th className="text-left py-3 px-4 text-gray-600 text-sm">Status</th>
                    <th className="text-left py-3 px-4 text-gray-600 text-sm">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAccounts.map((account) => (
                    <tr key={account.code} className="border-b border-gray-100 hover:bg-gray-50">
                      {editingId === account.code && editForm ? (
                        <>
                          <td className="py-3 px-4">
                            <Input
                              value={editForm.code}
                              disabled
                              className="h-8 text-sm bg-gray-100"
                            />
                          </td>
                          <td className="py-3 px-4">
                            <Input
                              value={editForm.name}
                              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                              className="h-8 text-sm"
                            />
                          </td>
                          <td className="py-3 px-4">
                            <select
                              value={editForm.type}
                              onChange={(e) => setEditForm({ ...editForm, type: e.target.value as any })}
                              className="h-8 px-2 border border-gray-200 rounded text-sm"
                            >
                              <option value="Asset">Asset</option>
                              <option value="Liability">Liability</option>
                              <option value="Equity">Equity</option>
                              <option value="Revenue">Revenue</option>
                              <option value="Expense">Expense</option>
                            </select>
                          </td>
                          <td className="py-3 px-4">
                            <Input
                              value={editForm.subtype || ''}
                              onChange={(e) => setEditForm({ ...editForm, subtype: e.target.value })}
                              className="h-8 text-sm"
                            />
                          </td>
                          <td className="py-3 px-4">
                            <Input
                              value={editForm.description || ''}
                              onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                              className="h-8 text-sm"
                            />
                          </td>
                          <td className="py-3 px-4">
                            <Badge variant={editForm.isActive ? 'default' : 'secondary'}>
                              {editForm.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleSaveEdit}
                                className="h-8 w-8 p-0 text-green-600"
                              >
                                <Check className="size-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setEditingId(null);
                                  setEditForm(null);
                                }}
                                className="h-8 w-8 p-0 text-gray-400"
                              >
                                <X className="size-4" />
                              </Button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="py-3 px-4 text-sm text-gray-900">{account.code}</td>
                          <td className="py-3 px-4 text-sm text-gray-900">{account.name}</td>
                          <td className="py-3 px-4">
                            <Badge className={`text-xs ${getTypeColor(account.type)}`}>
                              {account.type}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-600">{account.subtype || '-'}</td>
                          <td className="py-3 px-4 text-sm text-gray-600">{account.description || '-'}</td>
                          <td className="py-3 px-4">
                            <button
                              onClick={() => toggleAccountStatus(account.code)}
                              className="text-sm"
                            >
                              <Badge 
                                variant={account.isActive ? 'default' : 'secondary'}
                                className="cursor-pointer hover:opacity-80"
                              >
                                {account.isActive ? 'Active' : 'Inactive'}
                              </Badge>
                            </button>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditAccount(account)}
                                className="h-8 w-8 p-0 text-gray-400 hover:text-purple-600"
                              >
                                <Edit2 className="size-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteAccount(account.code)}
                                className="h-8 w-8 p-0 text-gray-400 hover:text-red-600"
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
