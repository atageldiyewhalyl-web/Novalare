import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@/contexts/ThemeContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Landmark, ArrowRight, AlertCircle, RefreshCw, Plus, ArrowLeft } from 'lucide-react';
import { projectId, publicAnonKey } from '@/utils/supabase/info';
import { toast } from 'sonner@2.0.3';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getBankLogo } from '@/utils/bankLogoDetection';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/utils/supabase/client';

interface BankAccount {
  id: string;
  code: string;
  name: string;
  type: string;
  subtype?: string;
  balance?: number;
  isActive: boolean;
  qbo_id?: string;
}

interface BankAccountListProps {
  companyId: string;
}

export function BankAccountList({ companyId }: BankAccountListProps) {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Manual Account Creation
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [newAccountForm, setNewAccountForm] = useState({
    name: '',
    code: '',
    subtype: 'Checking',
    openingBalance: '',
  });

  // Get current period for balance queries
  const getCurrentPeriod = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  };

  // Fetch Chart of Accounts with React Query
  const { data: coaData, isLoading: isLoadingCOA, refetch: refetchCOA } = useQuery({
    queryKey: ['coa', companyId],
    queryFn: async () => {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/companies/${companyId}/coa`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch COA');
      }

      const data = await response.json();
      return data.accounts || [];
    },
    enabled: !!companyId,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Filter for bank accounts only
  const bankAccounts = (coaData || []).filter(
    (acc: BankAccount) => acc.type === 'Bank' && acc.isActive !== false
  );

  // Fetch balances for all bank accounts in parallel using React Query
  const balanceQueries = useQuery({
    queryKey: ['bank-balances', companyId, getCurrentPeriod(), bankAccounts.map((a: BankAccount) => a.id)],
    queryFn: async () => {
      const period = getCurrentPeriod();

      // Fetch all balances in parallel
      const balancePromises = bankAccounts.map(async (account: BankAccount) => {
        try {
          const response = await fetch(
            `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/bank-rec/account-balance?company_id=${companyId}&account_id=${account.id}&period=${period}`,
            {
              headers: {
                'Authorization': `Bearer ${publicAnonKey}`,
              },
            }
          );

          if (response.ok) {
            const data = await response.json();
            return { accountId: account.id, balance: data.balance };
          }
        } catch (err) {
          console.error(`Failed to fetch balance for account ${account.id}:`, err);
        }
        return { accountId: account.id, balance: null };
      });

      const results = await Promise.all(balancePromises);

      // Convert to map for easy lookup
      const balanceMap: Record<string, number | null> = {};
      results.forEach(result => {
        balanceMap[result.accountId] = result.balance;
      });

      return balanceMap;
    },
    enabled: bankAccounts.length > 0,
    staleTime: 2 * 60 * 1000, // Cache for 2 minutes
  });

  // Enrich bank accounts with balances
  const enrichedBankAccounts = bankAccounts.map((account: BankAccount) => ({
    ...account,
    statementBalance: balanceQueries.data?.[account.id],
    bookBalance: account.balance, // Original balance from COA is the Book Balance
  }));

  const handleSyncAccounts = async () => {
    try {
      setIsSyncing(true);
      toast.loading('Syncing accounts from QuickBooks...', { id: 'sync-accounts' });

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/companies/${companyId}/sync-qbo-accounts`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Sync failed');
      }

      const result = await response.json();
      toast.success(`Synced ${result.accountCount} accounts successfully!`, { id: 'sync-accounts' });

      // Invalidate queries to refetch
      queryClient.invalidateQueries(['coa', companyId]);
    } catch (error: any) {
      console.error('Failed to sync accounts:', error);
      toast.error(`Failed to sync accounts: ${error.message}`, { id: 'sync-accounts' });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCreateManualAccount = async () => {
    // Validation
    if (!newAccountForm.name.trim()) {
      toast.error('Account name is required');
      return;
    }
    if (!newAccountForm.code.trim()) {
      toast.error('Account code is required');
      return;
    }

    try {
      setIsCreating(true);
      toast.loading('Creating manual bank account...', { id: 'create-account' });

      // Use cached COA data
      const existingAccounts = coaData || [];

      // Check for duplicate code
      if (existingAccounts.some((acc: BankAccount) => acc.code === newAccountForm.code)) {
        toast.error('Account code already exists', { id: 'create-account' });
        return;
      }

      // Create new account
      const newAccount: BankAccount = {
        id: `manual-${Date.now()}`,
        code: newAccountForm.code.trim(),
        name: newAccountForm.name.trim(),
        type: 'Bank',
        subtype: newAccountForm.subtype,
        balance: newAccountForm.openingBalance ? parseFloat(newAccountForm.openingBalance) : 0,
        isActive: true,
      };

      // Save updated COA
      const saveResponse = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/companies/${companyId}/coa`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ accounts: [...existingAccounts, newAccount] }),
        }
      );

      if (!saveResponse.ok) {
        throw new Error('Failed to save account');
      }

      toast.success('Manual bank account created!', { id: 'create-account' });

      // Reset form and close dialog
      setNewAccountForm({
        name: '',
        code: '',
        subtype: 'Checking',
        openingBalance: '',
      });
      setShowCreateDialog(false);

      // Invalidate queries to refetch
      queryClient.invalidateQueries(['coa', companyId]);
    } catch (error) {
      console.error('Failed to create manual account:', error);
      toast.error('Failed to create account', { id: 'create-account' });
    } finally {
      setIsCreating(false);
    }
  };

  const formatCurrency = (amount?: number | null) => {
    if (amount === undefined || amount === null) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const isLoading = isLoadingCOA;
  const isLoadingBalances = balanceQueries.isLoading;

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <RefreshCw className={`w-8 h-8 animate-spin mx-auto ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`} />
          <p className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
            Loading bank accounts...
          </p>
        </div>
      </div>
    );
  }

  // No bank accounts found
  if (bankAccounts.length === 0) {
    return (
      <div className="max-w-7xl mx-auto space-y-12 pb-20 px-4 md:px-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className={`text-4xl font-black mb-2 tracking-tighter ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`} style={{ fontFamily: "'Outfit', sans-serif" }}>
              Bank Reconciliations
            </h1>
            <p className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'} style={{ fontFamily: "'Manrope', sans-serif" }}>
              No bank accounts found in your Chart of Accounts
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              onClick={() => setShowCreateDialog(true)}
              className="px-6 h-11 bg-[#65D3FD] hover:bg-[#65D3FD]/90 text-black font-bold tracking-tight rounded-xl shadow-lg shadow-[#65D3FD]/20 transition-all hover:scale-105"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Manual Account
            </Button>
            <Button
              onClick={handleSyncAccounts}
              disabled={isSyncing}
              variant="outline"
              className={`px-6 h-11 rounded-xl bg-white border-gray-200 text-gray-900 shadow-sm font-bold tracking-tight ${theme === 'dark' ? 'bg-white/5 border-white/10 text-white hover:bg-white/10' : 'hover:bg-gray-50'}`}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
              Sync from QuickBooks
            </Button>
          </div>
        </div>

        <Alert className={theme === 'dark' ? 'bg-blue-500/10 border-blue-500/30' : 'bg-blue-50 border-blue-200'}>
          <AlertCircle className={theme === 'dark' ? 'size-4 text-blue-400' : 'size-4 text-blue-600'} />
          <AlertDescription className={theme === 'dark' ? 'text-blue-200' : 'text-blue-900'}>
            No bank accounts found. Create a manual account to get started with reconciliations.
          </AlertDescription>
        </Alert>

        {/* Manual Account Creation Dialog */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent className={theme === 'dark' ? 'bg-zinc-900 border-zinc-800 text-white' : 'bg-white'}>
            <DialogHeader>
              <DialogTitle className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>
                Create Manual Bank Account
              </DialogTitle>
              <DialogDescription className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
                Add a bank account to your Chart of Accounts to begin reconciliations.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="account-name" className={theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}>
                  Account Name *
                </Label>
                <Input
                  id="account-name"
                  placeholder="e.g., Chase Business Checking"
                  value={newAccountForm.name}
                  onChange={(e) => setNewAccountForm({ ...newAccountForm, name: e.target.value })}
                  className={theme === 'dark' ? 'bg-zinc-800 border-zinc-700 text-white' : ''}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="account-code" className={theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}>
                  Account Code *
                </Label>
                <Input
                  id="account-code"
                  placeholder="e.g., 1001"
                  value={newAccountForm.code}
                  onChange={(e) => setNewAccountForm({ ...newAccountForm, code: e.target.value })}
                  className={theme === 'dark' ? 'bg-zinc-800 border-zinc-700 text-white' : ''}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="account-subtype" className={theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}>
                  Account Subtype
                </Label>
                <Select
                  value={newAccountForm.subtype}
                  onValueChange={(value) => setNewAccountForm({ ...newAccountForm, subtype: value })}
                >
                  <SelectTrigger className={theme === 'dark' ? 'bg-zinc-800 border-zinc-700 text-white' : ''}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className={theme === 'dark' ? 'bg-zinc-800 border-zinc-700 text-white' : ''}>
                    <SelectItem value="Checking">Checking</SelectItem>
                    <SelectItem value="Savings">Savings</SelectItem>
                    <SelectItem value="MoneyMarket">Money Market</SelectItem>
                    <SelectItem value="CashOnHand">Cash on Hand</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="opening-balance" className={theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}>
                  Opening Balance (Optional)
                </Label>
                <Input
                  id="opening-balance"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={newAccountForm.openingBalance}
                  onChange={(e) => setNewAccountForm({ ...newAccountForm, openingBalance: e.target.value })}
                  className={theme === 'dark' ? 'bg-zinc-800 border-zinc-700 text-white' : ''}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowCreateDialog(false)}
                disabled={isCreating}
                className={theme === 'dark' ? 'border-zinc-700 text-white hover:bg-zinc-800' : ''}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateManualAccount}
                disabled={isCreating}
                className="bg-[#65D3FD] hover:bg-[#65D3FD]/90 text-black"
              >
                {isCreating ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Account
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Main view: List of bank accounts
  return (
    <div className="max-w-7xl mx-auto space-y-12 pb-20 px-4 md:px-0">
      {/* Background Glow Blobs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className={`absolute -top-1/4 -right-1/4 size-[600px] rounded-full blur-[120px] opacity-10 transition-colors duration-500 ${theme === 'dark' ? 'bg-[#65D3FD]/20' : 'bg-[#65D3FD]/30'}`} />
        <div className={`absolute -bottom-1/4 -left-1/4 size-[600px] rounded-full blur-[120px] opacity-10 transition-colors duration-500 ${theme === 'dark' ? 'bg-[#4F5CFE]/10' : 'bg-[#4F5CFE]/20'}`} />
      </div>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-10">
        <div className="relative">
          <div className="absolute -left-6 top-1/2 -translate-y-1/2 w-1.5 h-16 bg-[#65D3FD] rounded-full hidden lg:block shadow-[0_0_15px_rgba(101,211,253,0.5)]" />
          <h1 className={`text-6xl font-black tracking-tighter mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`} style={{ fontFamily: "'Outfit', sans-serif" }}>
            Bank Accounts
          </h1>
          <p className="text-gray-500 font-medium text-lg max-w-xl leading-relaxed" style={{ fontFamily: "'Manrope', sans-serif" }}>
            Select a financial account to reconcile with your general ledger.
          </p>
        </div>

        <div className="flex flex-col items-end gap-3">
          <Button
            onClick={() => navigate(`/company/${companyId}/reconciliations`)}
            variant="ghost"
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 mb-2"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Reconciliations
          </Button>

          <div className="flex items-center gap-3">

            <Button
              onClick={handleSyncAccounts}
              disabled={isSyncing}
              variant="outline"
              className={`h-11 px-6 rounded-xl border font-bold tracking-tight shadow-sm ${theme === 'dark' ? 'bg-white/5 border-white/10 text-white hover:bg-white/10' : 'bg-white border-gray-200 hover:bg-gray-50'}`}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
              Sync QuickBooks
            </Button>
            <Button
              onClick={() => setShowCreateDialog(true)}
              className="h-11 px-6 bg-[#65D3FD] hover:bg-[#65D3FD]/90 text-black font-bold tracking-tight rounded-xl shadow-lg shadow-[#65D3FD]/20 transition-all hover:scale-105"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Account
            </Button>
          </div>
        </div>
      </div>

      {/* Bank Account Cards */}
      <div className="grid grid-cols-1 gap-6">
        {enrichedBankAccounts.map((account) => {
          const bankLogo = getBankLogo(account.name);

          return (
            <div
              key={account.id}
              onClick={() => navigate(`/company/${companyId}/reconciliations/bank/${account.id}`)}
              className={`
                group relative p-8 rounded-3xl cursor-pointer transition-all duration-300
                border hover:scale-[1.01]
                ${theme === 'dark'
                  ? 'bg-gradient-to-br from-white/[0.07] to-white/[0.02] border-white/10 backdrop-blur-xl hover:border-[#65D3FD]/50 hover:shadow-[0_20px_50px_-20px_rgba(101,211,253,0.4)]'
                  : 'bg-white border-gray-100 shadow-sm hover:border-[#65D3FD]/30 hover:shadow-[0_20px_50px_-20px_rgba(101,211,253,0.15)]'
                }
              `}
            >
              {/* Dynamic Glow Accent */}
              <div className={`
                absolute -inset-px rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-sm pointer-events-none
                ${theme === 'dark' ? 'bg-gradient-to-br from-[#65D3FD]/10 to-transparent' : 'bg-gradient-to-br from-[#65D3FD]/5 to-transparent'}
              `} />

              <div className="relative z-10 flex items-center gap-8">
                {/* Bank Logo or Generic Icon */}
                <div className="flex-shrink-0">
                  {bankLogo ? (
                    <div className="w-20 h-20 flex items-center justify-center rounded-2xl overflow-hidden bg-white p-3 shadow-sm border border-gray-100">
                      <img
                        src={bankLogo}
                        alt={account.name}
                        className="w-full h-full object-contain"
                      />
                    </div>
                  ) : (
                    <div className={`w-20 h-20 rounded-2xl flex items-center justify-center border ${theme === 'dark' ? 'bg-gradient-to-br from-[#65D3FD] via-[#65D3FD]/50 to-[#4F5CFE] border-transparent' : 'bg-gradient-to-br from-[#65D3FD] to-[#4F5CFE]'}`}>
                      <div className={`w-[76px] h-[76px] rounded-[14px] flex items-center justify-center ${theme === 'dark' ? 'bg-[#0a0a0f]' : 'bg-white'}`}>
                        <Landmark className={`w-10 h-10 ${theme === 'dark' ? 'text-[#65D3FD]' : 'text-[#65D3FD]'}`} />
                      </div>
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className={`text-2xl font-bold truncate transition-colors duration-300 ${theme === 'dark' ? 'text-white group-hover:text-[#65D3FD]' : 'text-gray-900 group-hover:text-[#65D3FD]'}`} style={{ fontFamily: "'Outfit', sans-serif" }}>
                        {account.name}
                      </h3>
                      <div className="flex items-center gap-3 mt-1">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide border ${theme === 'dark' ? 'bg-white/5 border-white/10 text-gray-400' : 'bg-gray-50 border-gray-100 text-gray-500'}`}>
                          #{account.code}
                        </span>
                        {account.subtype && (
                          <span className={`text-sm font-medium ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>
                            {account.subtype}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 group-hover:translate-x-2 ${theme === 'dark' ? 'bg-[#65D3FD]/10 text-[#65D3FD]' : 'bg-blue-50 text-blue-500'}`}>
                      <ArrowRight className="w-5 h-5" />
                    </div>
                  </div>

                  <div className="mt-6 pt-6 border-t border-dashed border-gray-200 dark:border-white/5">
                    <div className="flex items-center gap-12">
                      {/* Statement Balance */}
                      <div>
                        <p className={`text-xs font-bold uppercase tracking-widest mb-1 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>
                          Statement Balance
                        </p>
                        <p className={`text-3xl font-black tracking-tight ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`} style={{ fontFamily: "'Manrope', sans-serif" }}>
                          {isLoadingBalances ? (
                            <span className="text-lg opacity-50 animate-pulse">Loading...</span>
                          ) : (
                            formatCurrency(account.statementBalance)
                          )}
                        </p>
                      </div>

                      {/* Book Balance */}
                      <div>
                        <p className={`text-xs font-bold uppercase tracking-widest mb-1 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>
                          Book Balance
                        </p>
                        <p className={`text-3xl font-black tracking-tight ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`} style={{ fontFamily: "'Manrope', sans-serif" }}>
                          {formatCurrency(account.bookBalance)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Help Section */}
      <div className={`p-6 rounded-[24px] border ${theme === 'dark' ? 'bg-white/[0.02] border-white/5' : 'bg-blue-50/50 border-blue-100'}`}>
        <div className="flex items-start gap-4">
          <div className={`p-2 rounded-xl mt-1 ${theme === 'dark' ? 'bg-[#65D3FD]/10 text-[#65D3FD]' : 'bg-blue-100 text-blue-600'}`}>
            <AlertCircle className="size-5" />
          </div>
          <div>
            <h4 className={`text-sm font-bold mb-1 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-900'}`} style={{ fontFamily: "'Outfit', sans-serif" }}>
              Reconciliation Tip
            </h4>
            <p className={`text-sm ${theme === 'dark' ? 'text-gray-500' : 'text-gray-600'}`} style={{ fontFamily: "'Manrope', sans-serif" }}>
              Each bank account must be reconciled separately. Start by selecting an account above, then upload the matching bank statement PDF. Our AI will automatically extract transactions and match them with your general ledger.
            </p>
          </div>
        </div>
      </div>

      {/* Manual Account Creation Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className={theme === 'dark' ? 'bg-zinc-900 border-zinc-800 text-white' : 'bg-white'}>
          <DialogHeader>
            <DialogTitle className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>
              Create Manual Bank Account
            </DialogTitle>
            <DialogDescription className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
              Add a bank account to your Chart of Accounts to begin reconciliations.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="account-name" className={theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}>
                Account Name *
              </Label>
              <Input
                id="account-name"
                placeholder="e.g., Chase Business Checking"
                value={newAccountForm.name}
                onChange={(e) => setNewAccountForm({ ...newAccountForm, name: e.target.value })}
                className={theme === 'dark' ? 'bg-zinc-800 border-zinc-700 text-white' : ''}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="account-code" className={theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}>
                Account Code *
              </Label>
              <Input
                id="account-code"
                placeholder="e.g., 1001"
                value={newAccountForm.code}
                onChange={(e) => setNewAccountForm({ ...newAccountForm, code: e.target.value })}
                className={theme === 'dark' ? 'bg-zinc-800 border-zinc-700 text-white' : ''}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="account-subtype" className={theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}>
                Account Subtype
              </Label>
              <Select
                value={newAccountForm.subtype}
                onValueChange={(value) => setNewAccountForm({ ...newAccountForm, subtype: value })}
              >
                <SelectTrigger className={theme === 'dark' ? 'bg-zinc-800 border-zinc-700 text-white' : ''}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className={theme === 'dark' ? 'bg-zinc-800 border-zinc-700 text-white' : ''}>
                  <SelectItem value="Checking">Checking</SelectItem>
                  <SelectItem value="Savings">Savings</SelectItem>
                  <SelectItem value="MoneyMarket">Money Market</SelectItem>
                  <SelectItem value="CashOnHand">Cash on Hand</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="opening-balance" className={theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}>
                Opening Balance (Optional)
              </Label>
              <Input
                id="opening-balance"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={newAccountForm.openingBalance}
                onChange={(e) => setNewAccountForm({ ...newAccountForm, openingBalance: e.target.value })}
                className={theme === 'dark' ? 'bg-zinc-800 border-zinc-700 text-white' : ''}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCreateDialog(false)}
              disabled={isCreating}
              className={theme === 'dark' ? 'border-zinc-700 text-white hover:bg-zinc-800' : ''}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateManualAccount}
              disabled={isCreating}
              className="bg-[#65D3FD] hover:bg-[#65D3FD]/90 text-black"
            >
              {isCreating ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Account
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
