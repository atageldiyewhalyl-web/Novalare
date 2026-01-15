import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@/contexts/ThemeContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CreditCard, ArrowRight, AlertCircle, RefreshCw, Plus, ArrowLeft } from 'lucide-react';
import { projectId, publicAnonKey } from '@/utils/supabase/info';
import { toast } from 'sonner@2.0.3';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getCreditCardLogo } from '@/utils/creditCardLogoDetection';

interface CreditCardAccount {
  id: string;
  code: string;
  name: string;
  type: string;
  subtype?: string;
  balance?: number;
  isActive: boolean;
  qbo_id?: string;
}

interface CreditCardAccountListProps {
  companyId: string;
}

export function CreditCardAccountList({ companyId }: CreditCardAccountListProps) {
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
    subtype: 'CreditCard',
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

  // Filter for credit card accounts only
  const creditCardAccounts = (coaData || []).filter(
    (acc: CreditCardAccount) => acc.type === 'Credit Card' && acc.isActive !== false
  );

  // Fetch balances for all credit card accounts in parallel using React Query
  const balanceQueries = useQuery({
    queryKey: ['cc-balances', companyId, getCurrentPeriod(), creditCardAccounts.map((a: CreditCardAccount) => a.id)],
    queryFn: async () => {
      const period = getCurrentPeriod();
      
      // Fetch all balances in parallel
      const balancePromises = creditCardAccounts.map(async (account: CreditCardAccount) => {
        try {
          const response = await fetch(
            `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/cc-rec/account-balance?company_id=${companyId}&account_id=${account.id}&period=${period}`,
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
    enabled: creditCardAccounts.length > 0,
    staleTime: 2 * 60 * 1000, // Cache for 2 minutes
  });

  // Enrich credit card accounts with balances
  const enrichedCCAccounts = creditCardAccounts.map((account: CreditCardAccount) => ({
    ...account,
    balance: balanceQueries.data?.[account.id] ?? account.balance,
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
      toast.loading('Creating manual credit card account...', { id: 'create-account' });

      // Use cached COA data
      const existingAccounts = coaData || [];

      // Check for duplicate code
      if (existingAccounts.some((acc: CreditCardAccount) => acc.code === newAccountForm.code)) {
        toast.error('Account code already exists', { id: 'create-account' });
        return;
      }

      // Create new account
      const newAccount: CreditCardAccount = {
        id: `manual-cc-${Date.now()}`,
        code: newAccountForm.code.trim(),
        name: newAccountForm.name.trim(),
        type: 'Credit Card',
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

      toast.success('Manual credit card account created!', { id: 'create-account' });
      
      // Reset form and close dialog
      setNewAccountForm({
        name: '',
        code: '',
        subtype: 'CreditCard',
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
            Loading credit card accounts...
          </p>
        </div>
      </div>
    );
  }

  // No credit card accounts found
  if (creditCardAccounts.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className={`text-2xl mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              Credit Card Reconciliations
            </h1>
            <p className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
              No credit card accounts found in your Chart of Accounts
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              onClick={() => setShowCreateDialog(true)}
              className="bg-[#65D3FD] hover:bg-[#65D3FD]/90 text-black"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Manual Account
            </Button>
            <Button
              onClick={handleSyncAccounts}
              disabled={isSyncing}
              variant="outline"
              className={theme === 'dark' ? 'border-zinc-700 text-white hover:bg-zinc-800' : ''}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
              Sync from QuickBooks
            </Button>
          </div>
        </div>

        <Alert className={theme === 'dark' ? 'bg-blue-500/10 border-blue-500/30' : 'bg-blue-50 border-blue-200'}>
          <AlertCircle className={theme === 'dark' ? 'size-4 text-blue-400' : 'size-4 text-blue-600'} />
          <AlertDescription className={theme === 'dark' ? 'text-blue-200' : 'text-blue-900'}>
            No credit card accounts found. Create a manual account to get started with reconciliations.
          </AlertDescription>
        </Alert>

        {/* Manual Account Creation Dialog */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent className={theme === 'dark' ? 'bg-zinc-900 border-zinc-800 text-white' : 'bg-white'}>
            <DialogHeader>
              <DialogTitle className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>
                Create Manual Credit Card Account
              </DialogTitle>
              <DialogDescription className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
                Add a credit card account to your Chart of Accounts to begin reconciliations.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="account-name" className={theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}>
                  Account Name *
                </Label>
                <Input
                  id="account-name"
                  placeholder="e.g., Chase Sapphire Business"
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
                  placeholder="e.g., 2100"
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
                    <SelectItem value="CreditCard">Credit Card</SelectItem>
                    <SelectItem value="BusinessCreditCard">Business Credit Card</SelectItem>
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

  // Main view: List of credit card accounts
  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Button
        onClick={() => navigate(`/company/${companyId}/reconciliations`)}
        variant="ghost"
        size="sm"
        className={theme === 'dark' ? 'text-gray-400 hover:text-white hover:bg-zinc-800' : 'text-gray-600 hover:text-gray-900'}
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back
      </Button>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-2xl mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            Credit Card Reconciliations
          </h1>
          <p className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
            Select which credit card account you want to reconcile
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={() => {
              queryClient.invalidateQueries(['coa', companyId]);
              queryClient.invalidateQueries(['cc-balances']);
            }}
            disabled={isLoading || isLoadingBalances}
            variant="outline"
            className={theme === 'dark' ? 'border-zinc-700 text-white hover:bg-zinc-800' : ''}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${(isLoading || isLoadingBalances) ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            onClick={() => setShowCreateDialog(true)}
            className="bg-[#65D3FD] hover:bg-[#65D3FD]/90 text-black"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Manual Account
          </Button>
          <Button
            onClick={handleSyncAccounts}
            disabled={isSyncing}
            variant="outline"
            className={theme === 'dark' ? 'border-zinc-700 text-white hover:bg-zinc-800' : ''}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
            Sync from QuickBooks
          </Button>
        </div>
      </div>

      {/* Credit Card Account Cards */}
      <div className="grid grid-cols-1 gap-4">
        {enrichedCCAccounts.map((account) => {
          const cardLogo = getCreditCardLogo(account.name);
          
          return (
            <Card
              key={account.id}
              onClick={() => navigate(`/company/${companyId}/reconciliations/cc/${account.id}`)}
              className={`
                p-6 cursor-pointer transition-all duration-200
                hover:shadow-lg hover:scale-[1.01]
                ${theme === 'dark'
                  ? 'bg-zinc-900 hover:bg-zinc-800 border-zinc-800'
                  : 'bg-white hover:bg-gray-50 border-gray-200'
                }
              `}
            >
              <div className="flex items-center gap-4">
                {/* Credit Card Logo or Generic Icon */}
                {cardLogo ? (
                  <img 
                    src={cardLogo} 
                    alt={account.name}
                    className="w-16 h-16 object-contain"
                  />
                ) : (
                  <div className={`p-3 rounded-xl ${theme === 'dark' ? 'bg-[#65D3FD]/10' : 'bg-[#65D3FD]/10'}`}>
                    <CreditCard className="w-8 h-8 text-[#65D3FD]" />
                  </div>
                )}

                {/* Content */}
                <div className="flex-1">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className={`text-lg ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                        {account.name}
                      </h3>
                      <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                        Account #{account.code}
                        {account.subtype && ` • ${account.subtype}`}
                      </p>
                    </div>
                    <ArrowRight className={`w-5 h-5 flex-shrink-0 ${theme === 'dark' ? 'text-gray-600' : 'text-gray-400'} group-hover:translate-x-1 transition-transform`} />
                  </div>
                  
                  <div className="flex items-center gap-6 mt-3">
                    <div>
                      <p className={`text-xs ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>
                        Current Balance
                      </p>
                      <p className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                        {isLoadingBalances ? (
                          <span className="text-xs">Loading...</span>
                        ) : (
                          formatCurrency(account.balance)
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Help Section */}
      <div className={`p-4 rounded-lg border ${theme === 'dark' ? 'bg-zinc-900/50 border-zinc-800' : 'bg-gray-50 border-gray-200'}`}>
        <p className={`text-xs ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>
          <strong className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>Tip:</strong> Each credit card account must be reconciled separately. Upload the matching credit card statement PDF and we'll automatically match transactions.
        </p>
      </div>

      {/* Manual Account Creation Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className={theme === 'dark' ? 'bg-zinc-900 border-zinc-800 text-white' : 'bg-white'}>
          <DialogHeader>
            <DialogTitle className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>
              Create Manual Credit Card Account
            </DialogTitle>
            <DialogDescription className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
              Add a credit card account to your Chart of Accounts to begin reconciliations.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="account-name" className={theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}>
                Account Name *
              </Label>
              <Input
                id="account-name"
                placeholder="e.g., Chase Sapphire Business"
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
                placeholder="e.g., 2100"
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
                  <SelectItem value="CreditCard">Credit Card</SelectItem>
                  <SelectItem value="BusinessCreditCard">Business Credit Card</SelectItem>
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