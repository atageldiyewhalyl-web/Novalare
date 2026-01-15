import { useState, useEffect } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft,
  CheckCircle2,
  FileSpreadsheet,
  BookOpen,
  AlertCircle,
  Edit2,
  Plus,
  Link,
  Clock,
  EyeOff,
  MessageSquare,
  Loader2,
  ThumbsUp,
  Filter,
  Search,
  X,
  ChevronDown,
  ChevronUp,
  Trash2,
  Undo2,
  Lock,
  ArrowRight,
  Calculator,
  Calendar,
  TrendingUp,
  Building2
} from 'lucide-react';
import { projectId, publicAnonKey } from '@/utils/supabase/info';
import { companiesApi, Company } from '@/utils/api-client';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Toaster } from 'sonner';
import { formatCurrency, getCurrencySymbol } from '@/utils/currency';
import { UnmatchedItemCard } from './shared/ReconciliationItemCard';
import { ReconciliationMatchDialog } from './shared/ReconciliationMatchDialog';
import { ReconciliationFollowUpDialog } from './shared/ReconciliationFollowUpDialog';
import { FxAdjustmentDialog } from './shared/FxAdjustmentDialog';

interface BankRecReviewProps {
  companyId: string;
  companyName: string;
  period: string;
  onBack: () => void;
  initialAccountId?: string | null;
}

interface BankTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  balance?: number;
  statementId: string;
  statementName: string;
}

interface LedgerEntry {
  id: string;
  date: string;
  description: string;
  amount: number;
  account?: string;
  reference?: string;
}

interface UnmatchedBank {
  transaction: BankTransaction;
  suggested_action: string;
  suggested_je?: {
    description: string;
    debit_account: string;
    credit_account: string;
    amount: number;
  };
}

interface UnmatchedLedger {
  entry: LedgerEntry;
  reason: string;
  action: string;
}


type ResolvedItem = {
  type: 'bank';
  item: UnmatchedBank;
  markedAt: string;
  status: string;
  resolution: string;
  matchGroupId?: string;
} | {
  type: 'ledger';
  item: UnmatchedLedger;
  markedAt: string;
  status: string;
  resolution: string;
  matchGroupId?: string;
};

type FollowUpItem = {
  type: 'bank';
  item: UnmatchedBank;
  note: string;
  markedAt: string;
  status?: string;
} | {
  type: 'ledger';
  item: UnmatchedLedger;
  note: string;
  markedAt: string;
  status?: string;
};

interface PreMatchedItem {
  matchGroupId: string;
  bankTransactions: BankTransaction[];
  ledgerEntries: LedgerEntry[];
  matchedAt: string;
  confidence?: number;
  match_type?: string;
  explanation?: string;
}

interface ReconciliationResult {
  unmatched_bank: UnmatchedBank[];
  unmatched_ledger: UnmatchedLedger[];
  summary: {
    total_bank_transactions: number;
    total_ledger_entries: number;
    matched_count: number;
    unmatched_bank_count: number;
    unmatched_ledger_count: number;
  };
  resolved_items: ResolvedItem[];
  follow_up_items: FollowUpItem[];
  timing_differences: any[];
  ignored_items: any[];
  pre_matched_items?: PreMatchedItem[];
  locked?: boolean;
}

interface JournalEntry {
  date: string;
  description: string;
  debit_account: string;
  credit_account: string;
  amount: number;
  memo?: string;
}

export function BankRecReview({ companyId, companyName, period, onBack, initialAccountId }: BankRecReviewProps) {
  const { theme } = useTheme();
  const [reconciliationResult, setReconciliationResult] = useState<ReconciliationResult | null>(null);
  const [isLoadingReconciliation, setIsLoadingReconciliation] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showFollowUpDialog, setShowFollowUpDialog] = useState(false);
  const [selectedBankItem, setSelectedBankItem] = useState<UnmatchedBank | null>(null);
  const [selectedLedgerItem, setSelectedLedgerItem] = useState<UnmatchedLedger | null>(null);
  const [followUpNote, setFollowUpNote] = useState('');
  const [activeTab, setActiveTab] = useState<'needs-attention' | 'follow-up' | 'resolved' | 'pre-matched'>('needs-attention');
  const [editingItem, setEditingItem] = useState<any>(null);
  const [editingType, setEditingType] = useState<'bank' | 'ledger' | null>(null);
  const [showMatchDialog, setShowMatchDialog] = useState(false);
  const [matchingBankItem, setMatchingBankItem] = useState<UnmatchedBank | null>(null);

  // Multi-select matching state
  const [selectedBankItems, setSelectedBankItems] = useState<UnmatchedBank[]>([]);
  const [selectedLedgerItems, setSelectedLedgerItems] = useState<UnmatchedLedger[]>([]);

  // Loading states for individual actions
  const [loadingActions, setLoadingActions] = useState<Record<string, boolean>>({});

  // Expanded match groups in resolved section
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Optimistic update state - separate from reconciliationResult for real-time updates
  const [unmatchedBankItems, setUnmatchedBankItems] = useState<UnmatchedBank[]>([]);
  const [unmatchedLedgerItems, setUnmatchedLedgerItems] = useState<UnmatchedLedger[]>([]);
  const [resolvedItems, setResolvedItems] = useState<any[]>([]);
  const [followUpItems, setFollowUpItems] = useState<FollowUpItem[]>([]);

  // Period lock state
  const [isMonthLocked, setIsMonthLocked] = useState(false);
  const [lockDetails, setLockDetails] = useState<any>(null);

  // Bank account selector state
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [chartOfAccounts, setChartOfAccounts] = useState<any[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(initialAccountId || null);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(false);

  // FX Adjustment Dialog state
  const [showFxDialog, setShowFxDialog] = useState(false);
  const [selectedFxGroup, setSelectedFxGroup] = useState<PreMatchedItem | null>(null);
  const [isProcessingFx, setIsProcessingFx] = useState(false);

  const selectedAccount = bankAccounts.find(acc => acc.id === selectedAccountId);
  const accountCurrency = selectedAccount?.currency || 'USD';

  // Load bank accounts on mount
  useEffect(() => {
    loadBankAccounts();
  }, [companyId]);

  // Load reconciliation when account or period changes
  useEffect(() => {
    if (selectedAccountId) {
      loadLockStatus();
      loadReconciliationData();
    }
  }, [companyId, period, selectedAccountId]);

  const loadBankAccounts = async () => {
    setIsLoadingAccounts(true);
    try {
      // Fetch Chart of Accounts and filter for bank accounts
      const coaResponse = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/companies/${companyId}/coa`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (!coaResponse.ok) {
        console.error('Failed to fetch COA for bank accounts');
        return;
      }

      const coaData = await coaResponse.json();
      const allAccounts = coaData.accounts || [];
      setChartOfAccounts(allAccounts);

      // Filter for bank accounts only
      const accounts = allAccounts.filter(
        (acc: any) => acc.type === 'Bank' && acc.isActive !== false
      );

      setBankAccounts(accounts);

      // Auto-select first account if available
      // If we have an initial account ID, set it
      if (initialAccountId) {
        // Verify the account exists in the list
        const accountExists = accounts.some((acc: any) => acc.id === initialAccountId);
        if (accountExists) {
          setSelectedAccountId(initialAccountId);
        } else if (accounts.length > 0 && !selectedAccountId) {
          // Fallback to first account if initial doesn't exist AND nothing else is selected
          setSelectedAccountId(accounts[0].id);
        }
      } else if (accounts.length > 0 && !selectedAccountId) {
        // Default to first account if no selection
        setSelectedAccountId(accounts[0].id);
      }
    } catch (error) {
      console.error('Error loading bank accounts:', error);
      toast.error('Failed to load bank accounts');
    } finally {
      setIsLoadingAccounts(false);
    }
  };

  const loadLockStatus = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/month-close/status?companyId=${companyId}&period=${period}`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setIsMonthLocked(data.isLocked || false);
        setLockDetails(data.isLocked ? data : null);
        console.log('Period lock status:', data);
      }
    } catch (error) {
      console.error('Failed to load lock status:', error);
    }
  };

  const loadReconciliationData = async () => {
    if (!selectedAccountId) {
      console.log('No account selected, skipping reconciliation load');
      return;
    }

    setIsLoadingReconciliation(true);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/bank-rec/reconciliation-data?company_id=${companyId}&account_id=${selectedAccountId}&period=${period}`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        console.log('Reconciliation data loaded for account', selectedAccountId, ':', data);

        // Extract the result from the response
        const reconciliationData = data.result || data;

        // Check if pre_matched_items is missing and matched_pairs exists - migrate if needed
        if ((!reconciliationData.pre_matched_items || reconciliationData.pre_matched_items.length === 0) &&
          reconciliationData.matched_pairs && reconciliationData.matched_pairs.length > 0) {
          console.log('🔄 Pre-matched items missing, triggering migration...');
          try {
            const migrateResponse = await fetch(
              `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/bank-rec/migrate-prematched`,
              {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${publicAnonKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ companyId, period, accountId: selectedAccountId }),
              }
            );

            if (migrateResponse.ok) {
              console.log('✅ Migration successful, reloading data...');
              // Reload the data to get the updated pre_matched_items
              const reloadResponse = await fetch(
                `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/bank-rec/reconciliation-data?company_id=${companyId}&account_id=${selectedAccountId}&period=${period}`,
                {
                  headers: {
                    'Authorization': `Bearer ${publicAnonKey}`,
                  },
                }
              );
              if (reloadResponse.ok) {
                const updatedData = await reloadResponse.json();
                const updatedRecData = updatedData.result || updatedData;
                setReconciliationResult(updatedRecData);
                setUnmatchedBankItems(updatedRecData.unmatched_bank || []);
                setUnmatchedLedgerItems(updatedRecData.unmatched_ledger || []);
                setResolvedItems(updatedRecData.resolved_items || []);
                setFollowUpItems(updatedRecData.follow_up_items || []);
                return;
              }
            }
          } catch (migrationError) {
            console.error('Migration failed, using original data:', migrationError);
          }
        }

        setReconciliationResult(reconciliationData);

        // Initialize optimistic update state
        console.log('🔍 DEBUG: Setting resolved items from API response:', reconciliationData.resolved_items?.length || 0, 'items');
        setUnmatchedBankItems(reconciliationData.unmatched_bank || []);
        setUnmatchedLedgerItems(reconciliationData.unmatched_ledger || []);
        setResolvedItems(reconciliationData.resolved_items || []);
        setFollowUpItems(reconciliationData.follow_up_items || []);
      } else {
        const errorText = await response.text();
        console.error('Failed to load reconciliation data:', response.status, errorText);
        setReconciliationResult(null);
      }
    } catch (error) {
      console.error('Failed to load reconciliation data:', error);
      setReconciliationResult(null);
    } finally {
      setIsLoadingReconciliation(false);
    }
  };



  const handleEditBankTransaction = (item: UnmatchedBank) => {
    setEditingItem({ ...item.transaction });
    setEditingType('bank');
    setSelectedBankItem(item);
    setShowEditDialog(true);
  };

  const handleEditLedgerEntry = (item: UnmatchedLedger) => {
    setEditingItem({ ...item.entry });
    setEditingType('ledger');
    setSelectedLedgerItem(item);
    setShowEditDialog(true);
  };

  const handleOpenFxDialog = (group: PreMatchedItem) => {
    setSelectedFxGroup(group);
    setShowFxDialog(true);
  };

  const handleConfirmFxAdjustment = async (adjustmentAccount: any, variance: number, description: string) => {
    if (!selectedFxGroup) return;
    setIsProcessingFx(true);

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/bank-rec/resolve-adjust-match`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            companyId,
            period,
            accountId: selectedAccountId,
            matchGroupId: selectedFxGroup.matchGroupId,
            adjustmentAccount,
            description,
            variance
          }),
        }
      );

      if (response.ok) {
        toast.success('Adjustment created and match confirmed!');
        setShowFxDialog(false);
        // Reload to refresh lists
        loadReconciliationData();
      } else {
        const errorText = await response.text();
        console.error('Failed to create adjustment:', errorText);
        toast.error('Failed to create adjustment. Please try again.');
      }
    } catch (error) {
      console.error('Error creating adjustment:', error);
      toast.error('Network error creating adjustment.');
    } finally {
      setIsProcessingFx(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingItem) return;

    console.log('Saving edited item:', editingItem, editingType);

    // Get the original item for backend comparison
    const originalItem = editingType === 'bank'
      ? selectedBankItem?.transaction
      : selectedLedgerItem?.entry;

    if (!originalItem) {
      toast.error('Original item not found');
      return;
    }

    // Optimistic update - update the item in place immediately in all tabs
    if (editingType === 'bank' && editingItem) {
      // Update in Needs Attention tab
      setUnmatchedBankItems(prev => prev.map(item =>
        item.transaction.id === editingItem.id
          ? { ...item, transaction: { ...item.transaction, ...editingItem } }
          : item
      ));

      // Update in Follow-Up tab
      setFollowUpItems(prev => prev.map(followUpItem => {
        if (followUpItem.type === 'bank' && followUpItem.item?.transaction?.id === editingItem.id) {
          return {
            ...followUpItem,
            item: {
              ...followUpItem.item,
              transaction: { ...followUpItem.item.transaction, ...editingItem }
            }
          };
        }
        return followUpItem;
      }));

      // Update in Resolved tab
      setResolvedItems(prev => prev.map(resolvedItem => {
        if (resolvedItem.type === 'bank' && resolvedItem.item?.transaction?.id === editingItem.id) {
          return {
            ...resolvedItem,
            item: {
              ...resolvedItem.item,
              transaction: { ...resolvedItem.item.transaction, ...editingItem }
            }
          };
        }
        return resolvedItem;
      }));
    } else if (editingType === 'ledger' && editingItem) {
      // Update in Needs Attention tab
      setUnmatchedLedgerItems(prev => prev.map(item =>
        item.entry.id === editingItem.id
          ? { ...item, entry: { ...item.entry, ...editingItem } }
          : item
      ));

      // Update in Follow-Up tab
      setFollowUpItems(prev => prev.map(followUpItem => {
        if (followUpItem.type === 'ledger' && followUpItem.item?.entry?.id === editingItem.id) {
          return {
            ...followUpItem,
            item: {
              ...followUpItem.item,
              entry: { ...followUpItem.item.entry, ...editingItem }
            }
          };
        }
        return followUpItem;
      }));

      // Update in Resolved tab
      setResolvedItems(prev => prev.map(resolvedItem => {
        if (resolvedItem.type === 'ledger' && resolvedItem.item?.entry?.id === editingItem.id) {
          return {
            ...resolvedItem,
            item: {
              ...resolvedItem.item,
              entry: { ...resolvedItem.item.entry, ...editingItem }
            }
          };
        }
        return resolvedItem;
      }));
    }

    setShowEditDialog(false);

    // Call backend to persist changes
    try {
      const requestPayload = {
        companyId,
        period,
        type: editingType,
        originalItem: {
          id: originalItem.id,
          date: originalItem.date,
          description: originalItem.description,
          amount: originalItem.amount
        },
        updatedData: {
          date: editingItem.date,
          description: editingItem.description,
          amount: editingItem.amount
        }
      };

      console.log('📤 Sending update request:', requestPayload);

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/bank-rec/update-transaction`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ ...requestPayload, accountId: selectedAccountId }),
        }
      );

      if (response.ok) {
        console.log('✅ Transaction updated successfully in backend');
        toast.success('Transaction updated successfully!');
      } else {
        const errorText = await response.text();
        console.error('Failed to update transaction:', response.status, errorText);
        toast.error('Failed to save changes. Please try again.');

        // Revert optimistic update on error - reload data from backend
        await loadReconciliationData();
      }
    } catch (error) {
      console.error('Error updating transaction:', error);
      toast.error('Network error. Please check your connection and try again.');

      // Revert optimistic update on error - reload data from backend
      await loadReconciliationData();
    }
  };

  const handleApproveForJE = async (item: UnmatchedBank | UnmatchedLedger, type: 'bank' | 'ledger') => {
    const itemId = type === 'bank' ? (item as UnmatchedBank).transaction.id : (item as UnmatchedLedger).entry.id;
    const actionKey = `approve-${type}-${itemId}`;
    setLoadingActions(prev => ({ ...prev, [actionKey]: true }));

    // Optimistic update - remove from unmatched immediately and add to resolved
    if (type === 'bank') {
      setUnmatchedBankItems(prev => prev.filter(i => i.transaction.id !== itemId));
      setResolvedItems(prev => [...prev, {
        type: 'bank' as const,
        item: item as UnmatchedBank,
        markedAt: new Date().toISOString(),
        status: 'resolved',
        resolution: 'Transaction sent to Journal Entries section to be recorded'
      }]);
    } else {
      setUnmatchedLedgerItems(prev => prev.filter(i => i.entry.id !== itemId));
      setResolvedItems(prev => [...prev, {
        type: 'ledger' as const,
        item: item as UnmatchedLedger,
        markedAt: new Date().toISOString(),
        status: 'resolved',
        resolution: 'Transaction sent to Journal Entries section to be recorded'
      }]);
    }

    try {
      console.log('🔍 DEBUG: Sending approve-suggestion request with:', { companyId, period, accountId: selectedAccountId, type });
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/journal-entries/approve-suggestion`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            companyId,
            period,
            accountId: selectedAccountId,
            sourceAccountName: selectedAccount?.name,  // Pass the account name for AI context
            type,
            item,
          }),
        }
      );

      if (response.ok) {
        console.log('Transaction approved for AI journal entry generation');
        toast.success('Transaction approved! AI will generate a suggested journal entry in the Draft/Suggested tab.');
      } else {
        const errorText = await response.text();
        console.error('Failed to approve transaction:', response.status, errorText);
        toast.error('Failed to approve transaction. Please try again.');
        // Revert optimistic update on error
        if (type === 'bank') {
          setUnmatchedBankItems(prev => [...prev, item as UnmatchedBank]);
          setResolvedItems(prev => prev.filter(i =>
            !(i.type === 'bank' && i.item?.transaction?.id === itemId)
          ));
        } else {
          setUnmatchedLedgerItems(prev => [...prev, item as UnmatchedLedger]);
          setResolvedItems(prev => prev.filter(i =>
            !(i.type === 'ledger' && i.item?.entry?.id === itemId)
          ));
        }
      }
    } catch (error) {
      console.error('Failed to approve transaction:', error);
      toast.error('Failed to approve transaction. Please try again.');
      // Revert optimistic update on error
      if (type === 'bank') {
        setUnmatchedBankItems(prev => [...prev, item as UnmatchedBank]);
        setResolvedItems(prev => prev.filter(i =>
          !(i.type === 'bank' && i.item?.transaction?.id === itemId)
        ));
      } else {
        setUnmatchedLedgerItems(prev => [...prev, item as UnmatchedLedger]);
        setResolvedItems(prev => prev.filter(i =>
          !(i.type === 'ledger' && i.item?.entry?.id === itemId)
        ));
      }
    } finally {
      setLoadingActions(prev => ({ ...prev, [actionKey]: false }));
    }
  };

  const handleReverseJE = async (item: UnmatchedLedger) => {
    const itemId = item.entry.id;
    const actionKey = `reverse-ledger-${itemId}`;
    setLoadingActions(prev => ({ ...prev, [actionKey]: true }));

    // Optimistic update - remove from unmatched immediately and add to resolved
    setUnmatchedLedgerItems(prev => prev.filter(i => i.entry.id !== itemId));
    setResolvedItems(prev => [...prev, {
      type: 'ledger' as const,
      item: item,
      markedAt: new Date().toISOString(),
      status: 'resolved',
      resolution: 'Reversing journal entry sent to Journal Entries section'
    }]);

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/journal-entries/reverse-je`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            companyId,
            period,
            item,
          }),
        }
      );

      if (response.ok) {
        console.log('Reversing journal entry approved');
        toast.success('Reversing JE created! Check the Draft/Suggested tab to review before posting.');
      } else {
        const errorText = await response.text();
        console.error('Failed to create reversing JE:', response.status, errorText);
        toast.error('Failed to create reversing JE. Please try again.');
        // Revert optimistic update on error
        setUnmatchedLedgerItems(prev => [...prev, item]);
        setResolvedItems(prev => prev.filter(i =>
          !(i.type === 'ledger' && i.item?.entry?.id === itemId)
        ));
      }
    } catch (error) {
      console.error('Failed to create reversing JE:', error);
      toast.error('Failed to create reversing JE. Please try again.');
      // Revert optimistic update on error
      setUnmatchedLedgerItems(prev => [...prev, item]);
      setResolvedItems(prev => prev.filter(i =>
        !(i.type === 'ledger' && i.item?.entry?.id === itemId)
      ));
    } finally {
      setLoadingActions(prev => ({ ...prev, [actionKey]: false }));
    }
  };

  const handleMarkAsTimingDifference = async (item: UnmatchedBank | UnmatchedLedger, type: 'bank' | 'ledger') => {
    const itemId = type === 'bank' ? (item as UnmatchedBank).transaction.id : (item as UnmatchedLedger).entry.id;
    const actionKey = `timing-${type}-${itemId}`;
    setLoadingActions(prev => ({ ...prev, [actionKey]: true }));

    // Optimistic update
    if (type === 'bank') {
      setUnmatchedBankItems(prev => prev.filter(i => i.transaction.id !== itemId));
      setResolvedItems(prev => [...prev, {
        type: 'bank' as const,
        item: item as UnmatchedBank,
        markedAt: new Date().toISOString(),
        status: 'timing_difference',
        resolution: 'Will clear next period',
        matchGroupId: `timing-${itemId}`
      }]);
    } else {
      setUnmatchedLedgerItems(prev => prev.filter(i => i.entry.id !== itemId));
      setResolvedItems(prev => [...prev, {
        type: 'ledger' as const,
        item: item as UnmatchedLedger,
        markedAt: new Date().toISOString(),
        status: 'timing_difference',
        resolution: 'Will clear next period',
        matchGroupId: `timing-${itemId}`
      }]);
    }

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/bank-rec/mark-timing-difference`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            companyId,
            period,
            accountId: selectedAccountId,
            type,
            item,
          }),
        }
      );

      if (response.ok) {
        toast.success('Marked as timing difference. Will clear next period.');
      } else {
        toast.error('Failed to mark as timing difference.');
        // Revert optimistic update
        if (type === 'bank') {
          setUnmatchedBankItems(prev => [...prev, item as UnmatchedBank]);
          setResolvedItems(prev => prev.filter(r => r.matchGroupId !== `timing-${itemId}`));
        } else {
          setUnmatchedLedgerItems(prev => [...prev, item as UnmatchedLedger]);
          setResolvedItems(prev => prev.filter(r => r.matchGroupId !== `timing-${itemId}`));
        }
      }
    } catch (error) {
      console.error('Failed to mark as timing difference:', error);
      toast.error('Failed to mark as timing difference.');
      // Revert optimistic update
      if (type === 'bank') {
        setUnmatchedBankItems(prev => [...prev, item as UnmatchedBank]);
        setResolvedItems(prev => prev.filter(r => r.matchGroupId !== `timing-${itemId}`));
      } else {
        setUnmatchedLedgerItems(prev => [...prev, item as UnmatchedLedger]);
        setResolvedItems(prev => prev.filter(r => r.matchGroupId !== `timing-${itemId}`));
      }
    } finally {
      setLoadingActions(prev => ({ ...prev, [actionKey]: false }));
    }
  };

  const handleMarkAsIgnored = async (item: UnmatchedBank | UnmatchedLedger, type: 'bank' | 'ledger') => {
    const itemId = type === 'bank' ? (item as UnmatchedBank).transaction.id : (item as UnmatchedLedger).entry.id;
    const actionKey = `ignore-${type}-${itemId}`;
    setLoadingActions(prev => ({ ...prev, [actionKey]: true }));

    // Optimistic update
    if (type === 'bank') {
      setUnmatchedBankItems(prev => prev.filter(i => i.transaction.id !== itemId));
      setResolvedItems(prev => [...prev, {
        type: 'bank' as const,
        item: item as UnmatchedBank,
        markedAt: new Date().toISOString(),
        status: 'ignored',
        resolution: 'Marked as non-issue',
        matchGroupId: `ignored-${itemId}`
      }]);
    } else {
      setUnmatchedLedgerItems(prev => prev.filter(i => i.entry.id !== itemId));
      setResolvedItems(prev => [...prev, {
        type: 'ledger' as const,
        item: item as UnmatchedLedger,
        markedAt: new Date().toISOString(),
        status: 'ignored',
        resolution: 'Marked as non-issue',
        matchGroupId: `ignored-${itemId}`
      }]);
    }

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/bank-rec/mark-ignored`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            companyId,
            period,
            accountId: selectedAccountId,
            type,
            item,
          }),
        }
      );

      if (response.ok) {
        toast.success('Marked as non-issue. Will not appear again.');
      } else {
        toast.error('Failed to mark as ignored.');
        // Revert optimistic update
        if (type === 'bank') {
          setUnmatchedBankItems(prev => [...prev, item as UnmatchedBank]);
          setResolvedItems(prev => prev.filter(r => r.matchGroupId !== `ignored-${itemId}`));
        } else {
          setUnmatchedLedgerItems(prev => [...prev, item as UnmatchedLedger]);
          setResolvedItems(prev => prev.filter(r => r.matchGroupId !== `ignored-${itemId}`));
        }
      }
    } catch (error) {
      console.error('Failed to mark as ignored:', error);
      toast.error('Failed to mark as ignored.');
      // Revert optimistic update
      if (type === 'bank') {
        setUnmatchedBankItems(prev => [...prev, item as UnmatchedBank]);
        setResolvedItems(prev => prev.filter(r => r.matchGroupId !== `ignored-${itemId}`));
      } else {
        setUnmatchedLedgerItems(prev => [...prev, item as UnmatchedLedger]);
        setResolvedItems(prev => prev.filter(r => r.matchGroupId !== `ignored-${itemId}`));
      }
    } finally {
      setLoadingActions(prev => ({ ...prev, [actionKey]: false }));
    }
  };

  const handleOpenFollowUpDialog = (item: UnmatchedBank | UnmatchedLedger, type: 'bank' | 'ledger') => {
    if (type === 'bank') {
      setSelectedBankItem(item as UnmatchedBank);
      setSelectedLedgerItem(null);
    } else {
      setSelectedLedgerItem(item as UnmatchedLedger);
      setSelectedBankItem(null);
    }
    setEditingType(type);
    setFollowUpNote('');
    setShowFollowUpDialog(true);
  };

  const handleRequestInformation = async () => {
    if (!followUpNote.trim()) {
      alert('Please enter a note about what information is needed.');
      return;
    }

    const item = selectedBankItem || selectedLedgerItem;
    const type = editingType;
    const itemId = type === 'bank' ? (item as UnmatchedBank)?.transaction.id : (item as UnmatchedLedger)?.entry.id;

    // Optimistic update
    if (type === 'bank' && item) {
      setUnmatchedBankItems(prev => prev.filter(i => i.transaction.id !== itemId));
      setFollowUpItems(prev => [...prev, {
        item: item as UnmatchedBank,
        type: 'bank' as const,
        note: followUpNote,
        markedAt: new Date().toISOString()
      }]);
    } else if (type === 'ledger' && item) {
      setUnmatchedLedgerItems(prev => prev.filter(i => i.entry.id !== itemId));
      setFollowUpItems(prev => [...prev, {
        item: item as UnmatchedLedger,
        type: 'ledger' as const,
        note: followUpNote,
        markedAt: new Date().toISOString()
      }]);
    }

    setShowFollowUpDialog(false);
    setFollowUpNote('');

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/bank-rec/request-information`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            companyId,
            period,
            accountId: selectedAccountId,
            type,
            item,
            note: followUpNote,
          }),
        }
      );

      if (response.ok) {
        toast.success('Flagged for follow-up.');
      } else {
        toast.error('Failed to flag for follow-up.');
        // Revert optimistic update
        if (type === 'bank' && item) {
          setUnmatchedBankItems(prev => [...prev, item as UnmatchedBank]);
          setFollowUpItems(prev => prev.filter(i =>
            i.type === 'bank' ? (i.item as UnmatchedBank).transaction.id !== itemId : true
          ));
        } else if (type === 'ledger' && item) {
          setUnmatchedLedgerItems(prev => [...prev, item as UnmatchedLedger]);
          setFollowUpItems(prev => prev.filter(i =>
            i.type === 'ledger' ? (i.item as UnmatchedLedger).entry.id !== itemId : true
          ));
        }
      }
    } catch (error) {
      console.error('Failed to flag for follow-up:', error);
      toast.error('Failed to flag for follow-up.');
      // Revert optimistic update
      if (type === 'bank' && item) {
        setUnmatchedBankItems(prev => [...prev, item as UnmatchedBank]);
        setFollowUpItems(prev => prev.filter(i =>
          i.type === 'bank' ? (i.item as UnmatchedBank).transaction.id !== itemId : true
        ));
      } else if (type === 'ledger' && item) {
        setUnmatchedLedgerItems(prev => [...prev, item as UnmatchedLedger]);
        setFollowUpItems(prev => prev.filter(i =>
          i.type === 'ledger' ? (i.item as UnmatchedLedger).entry.id !== itemId : true
        ));
      }
    }
  };

  const handleOpenMatchDialog = (item: UnmatchedBank | UnmatchedLedger) => {
    if ('transaction' in item) {
      setMatchingBankItem(item);
      setSelectedBankItems([item]);
      setSelectedLedgerItems([]);
    } else {
      setMatchingBankItem(null);
      setSelectedLedgerItems([item]);
      setSelectedBankItems([]);
    }
    setShowMatchDialog(true);
  };

  const toggleBankSelection = (item: UnmatchedBank) => {
    setSelectedBankItems(prev => {
      const isSelected = prev.some(i => i.transaction.id === item.transaction.id);
      if (isSelected) {
        return prev.filter(i => i.transaction.id !== item.transaction.id);
      } else {
        return [...prev, item];
      }
    });
  };

  const toggleLedgerSelection = (item: UnmatchedLedger) => {
    setSelectedLedgerItems(prev => {
      const isSelected = prev.some(i => i.entry.id === item.entry.id);
      if (isSelected) {
        return prev.filter(i => i.entry.id !== item.entry.id);
      } else {
        return [...prev, item];
      }
    });
  };

  const getTotalAmount = (items: (UnmatchedBank | UnmatchedLedger)[]) => {
    return items.reduce((sum, item) => {
      const amount = 'transaction' in item ? item.transaction.amount : item.entry.amount;
      return sum + amount;
    }, 0);
  };

  // Group resolved items by matchGroupId
  const groupResolvedItems = () => {
    if (!resolvedItems) return [];

    const groups = new Map<string, ResolvedItem[]>();

    resolvedItems
      .filter(item => (item && item.item) || (item && item.type === 'confirmed_match')) // Allow confirmed_match items too
      .forEach(item => {
        // Handle 'confirmed_match' type (grouped item from backend)
        if (item.type === 'confirmed_match') {
          const groupId = item.id;
          // Initialize group if needed
          if (!groups.has(groupId)) {
            groups.set(groupId, []);
          }

          // Decompose match group into individual virtual items for display
          const group = (item as any).matchGroup;
          if (group) {
            // Add bank transactions
            group.bankTransactions?.forEach((bt: any) => {
              groups.get(groupId)!.push({
                id: `virt-bank-${bt.id}-${groupId}`,
                type: 'bank',
                item: { transaction: bt },
                matchGroupId: groupId,
                markedAt: item.markedAt || (item as any).resolvedAt,
                markedBy: item.markedBy || (item as any).resolvedBy,
                notes: item.notes
              } as any);
            });

            // Add ledger entries
            group.ledgerEntries?.forEach((le: any) => {
              groups.get(groupId)!.push({
                id: `virt-ledger-${le.id}-${groupId}`,
                type: 'ledger',
                item: { entry: le },
                matchGroupId: groupId,
                markedAt: item.markedAt || (item as any).resolvedAt,
                markedBy: item.markedBy || (item as any).resolvedBy,
                notes: item.notes
              } as any);
            });
          }
          return;
        }

        // Existing logic for standard resolved items
        const groupId = item.matchGroupId || `single-${item.markedAt}`;
        if (!groups.has(groupId)) {
          groups.set(groupId, []);
        }
        groups.get(groupId)!.push(item);
      });

    return Array.from(groups.entries()).map(([groupId, items]) => ({
      groupId,
      items,
    }));
  };

  const toggleGroupExpansion = (groupId: string) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(groupId)) {
        newSet.delete(groupId);
      } else {
        newSet.add(groupId);
      }
      return newSet;
    });
  };

  const handleMatchItems = async (ledgerItem?: UnmatchedLedger) => {
    // If ledgerItem is provided (old single-select flow), use it
    // Otherwise use the multi-select arrays
    const bankItems = selectedBankItems.length > 0 ? selectedBankItems : (matchingBankItem ? [matchingBankItem] : []);
    const ledgerItems = ledgerItem ? [ledgerItem] : selectedLedgerItems;

    if (bankItems.length === 0 || ledgerItems.length === 0) {
      toast.error('Please select at least one item from each side to match.');
      return;
    }

    // Generate unique match group ID
    const matchGroupId = `match-${Date.now()}`;

    // Optimistic update
    const bankIds = bankItems.map(i => i.transaction.id);
    const ledgerIds = ledgerItems.map(i => i.entry.id);

    setUnmatchedBankItems(prev => prev.filter(i => !bankIds.includes(i.transaction.id)));
    setUnmatchedLedgerItems(prev => prev.filter(i => !ledgerIds.includes(i.entry.id)));

    // Add to resolved items
    const newResolvedItems: any[] = [];
    bankItems.forEach(item => {
      newResolvedItems.push({
        type: 'bank' as const,
        item: item,
        markedAt: new Date().toISOString(),
        status: 'matched',
        resolution: 'Matched items',
        matchGroupId
      });
    });
    ledgerItems.forEach(item => {
      newResolvedItems.push({
        type: 'ledger' as const,
        item: item,
        markedAt: new Date().toISOString(),
        status: 'matched',
        resolution: 'Matched items',
        matchGroupId
      });
    });
    setResolvedItems(prev => [...prev, ...newResolvedItems]);

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/bank-rec/match-items`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            companyId,
            period,
            bankItems,
            ledgerItems,
          }),
        }
      );

      if (response.ok) {
        toast.success(`Successfully matched ${bankItems.length} bank transaction(s) with ${ledgerItems.length} ledger entry(ies)!`);
        setShowMatchDialog(false);
        setMatchingBankItem(null);
        setSelectedBankItems([]);
        setSelectedLedgerItems([]);
      } else {
        toast.error('Failed to match items.');
        // Revert optimistic update
        setUnmatchedBankItems(prev => [...prev, ...bankItems]);
        setUnmatchedLedgerItems(prev => [...prev, ...ledgerItems]);
        setResolvedItems(prev => prev.filter(r => r.matchGroupId !== matchGroupId));
      }
    } catch (error) {
      console.error('Failed to match items:', error);
      toast.error('Failed to match items.');
      // Revert optimistic update
      setUnmatchedBankItems(prev => [...prev, ...bankItems]);
      setUnmatchedLedgerItems(prev => [...prev, ...ledgerItems]);
      setResolvedItems(prev => prev.filter(r => r.matchGroupId !== matchGroupId));
    }
  };

  const handleReverseResolved = async (item: UnmatchedBank | UnmatchedLedger, type: 'bank' | 'ledger') => {
    const itemId = type === 'bank' ? (item as UnmatchedBank).transaction.id : (item as UnmatchedLedger).entry.id;
    const actionKey = `reverse-${type}-${itemId}`;
    setLoadingActions(prev => ({ ...prev, [actionKey]: true }));

    // Optimistic update - find and remove from resolved, add back to unmatched
    const resolvedItemToRemove = resolvedItems.find(r => {
      if (!r?.item) return false;
      const id = 'transaction' in r.item ? r.item.transaction.id : r.item.entry.id;
      return id === itemId;
    });

    if (resolvedItemToRemove) {
      setResolvedItems(prev => prev.filter(r => {
        if (!r?.item) return true;
        const id = 'transaction' in r.item ? r.item.transaction.id : r.item.entry.id;
        return id !== itemId;
      }));
      if (type === 'bank') {
        setUnmatchedBankItems(prev => [...prev, item as UnmatchedBank]);
      } else {
        setUnmatchedLedgerItems(prev => [...prev, item as UnmatchedLedger]);
      }
    }

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/bank-rec/reverse-resolved`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            companyId,
            period,
            type,
            item,
          }),
        }
      );

      if (response.ok) {
        toast.success('Item moved back to Needs Attention. Any JE suggestions have been removed.');
      } else {
        toast.error('Failed to reverse item.');
        // Revert optimistic update
        if (resolvedItemToRemove) {
          setResolvedItems(prev => [...prev, resolvedItemToRemove]);
          if (type === 'bank') {
            setUnmatchedBankItems(prev => prev.filter(i => i.transaction.id !== itemId));
          } else {
            setUnmatchedLedgerItems(prev => prev.filter(i => i.entry.id !== itemId));
          }
        }
      }
    } catch (error) {
      console.error('Failed to reverse item:', error);
      toast.error('Failed to reverse item.');
      // Revert optimistic update
      if (resolvedItemToRemove) {
        setResolvedItems(prev => [...prev, resolvedItemToRemove]);
        if (type === 'bank') {
          setUnmatchedBankItems(prev => prev.filter(i => i.transaction.id !== itemId));
        } else {
          setUnmatchedLedgerItems(prev => prev.filter(i => i.entry.id !== itemId));
        }
      }
    } finally {
      setLoadingActions(prev => ({ ...prev, [actionKey]: false }));
    }
  };

  const handleReverseFollowUp = async (followUpItem: FollowUpItem) => {
    const item = followUpItem.item;
    const type = followUpItem.type;
    const itemId = type === 'bank' ? (item as UnmatchedBank).transaction.id : (item as UnmatchedLedger).entry.id;
    const actionKey = `reverse-followup-${type}-${itemId}`;
    setLoadingActions(prev => ({ ...prev, [actionKey]: true }));

    // Optimistic update - remove from follow-up items, add back to unmatched
    setFollowUpItems(prev => prev.filter(f => {
      const fItemId = f.type === 'bank' ? (f.item as UnmatchedBank).transaction.id : (f.item as UnmatchedLedger).entry.id;
      return fItemId !== itemId;
    }));

    if (type === 'bank') {
      setUnmatchedBankItems(prev => [...prev, item as UnmatchedBank]);
    } else {
      setUnmatchedLedgerItems(prev => [...prev, item as UnmatchedLedger]);
    }

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/bank-rec/reverse-follow-up`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            companyId,
            period,
            type,
            item,
          }),
        }
      );

      if (response.ok) {
        toast.success('Item moved back to Needs Attention.');
      } else {
        toast.error('Failed to reverse follow-up item.');
        // Revert optimistic update
        setFollowUpItems(prev => [...prev, followUpItem]);
        if (type === 'bank') {
          setUnmatchedBankItems(prev => prev.filter(i => i.transaction.id !== itemId));
        } else {
          setUnmatchedLedgerItems(prev => prev.filter(i => i.entry.id !== itemId));
        }
      }
    } catch (error) {
      console.error('Failed to reverse follow-up item:', error);
      toast.error('Failed to reverse follow-up item.');
      // Revert optimistic update
      setFollowUpItems(prev => [...prev, followUpItem]);
      if (type === 'bank') {
        setUnmatchedBankItems(prev => prev.filter(i => i.transaction.id !== itemId));
      } else {
        setUnmatchedLedgerItems(prev => prev.filter(i => i.entry.id !== itemId));
      }
    } finally {
      setLoadingActions(prev => ({ ...prev, [actionKey]: false }));
    }
  };

  const handleReverseMatchGroup = async (groupId: string, items: ResolvedItem[]) => {
    const actionKey = `reverse-group-${groupId}`;
    setLoadingActions(prev => ({ ...prev, [actionKey]: true }));

    // Optimistic update - extract all items and restore them
    const bankItemsToRestore: UnmatchedBank[] = [];
    const ledgerItemsToRestore: UnmatchedLedger[] = [];

    items.forEach(resolvedItem => {
      if (resolvedItem?.item) {
        if ('transaction' in resolvedItem.item) {
          bankItemsToRestore.push(resolvedItem.item as UnmatchedBank);
        } else if ('entry' in resolvedItem.item) {
          ledgerItemsToRestore.push(resolvedItem.item as UnmatchedLedger);
        }
      }
    });

    // Remove from resolved items
    setResolvedItems(prev => prev.filter(r => r.matchGroupId !== groupId));
    // Add back to unmatched
    setUnmatchedBankItems(prev => [...prev, ...bankItemsToRestore]);
    setUnmatchedLedgerItems(prev => [...prev, ...ledgerItemsToRestore]);

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/bank-rec/reverse-match-group`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            companyId,
            period,
            matchGroupId: groupId,
            items,
          }),
        }
      );

      if (response.ok) {
        toast.success(`Reversed match group with ${items.length} item(s). All items moved back to Needs Attention.`);
      } else {
        toast.error('Failed to reverse match group.');
        // Revert optimistic update
        setResolvedItems(prev => [...prev, ...items]);
        setUnmatchedBankItems(prev => prev.filter(i => !bankItemsToRestore.some(b => b.transaction.id === i.transaction.id)));
        setUnmatchedLedgerItems(prev => prev.filter(i => !ledgerItemsToRestore.some(l => l.entry.id === i.entry.id)));
      }
    } catch (error) {
      console.error('Failed to reverse match group:', error);
      toast.error('Failed to reverse match group.');
      // Revert optimistic update
      setResolvedItems(prev => [...prev, ...items]);
      setUnmatchedBankItems(prev => prev.filter(i => !bankItemsToRestore.some(b => b.transaction.id === i.transaction.id)));
      setUnmatchedLedgerItems(prev => prev.filter(i => !ledgerItemsToRestore.some(l => l.entry.id === i.entry.id)));
    } finally {
      setLoadingActions(prev => ({ ...prev, [actionKey]: false }));
    }
  };

  const handleUnmatchGroup = async (matchGroupId: string) => {
    const actionKey = `unmatch-${matchGroupId}`;
    setLoadingActions(prev => ({ ...prev, [actionKey]: true }));

    // Find the pre-matched group
    const matchGroup = reconciliationResult?.pre_matched_items?.find(g => g.matchGroupId === matchGroupId);
    if (!matchGroup) {
      toast.error('Match group not found.');
      setLoadingActions(prev => ({ ...prev, [actionKey]: false }));
      return;
    }

    // Optimistically remove from pre-matched items
    setReconciliationResult(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        pre_matched_items: prev.pre_matched_items?.filter(g => g.matchGroupId !== matchGroupId) || [],
      };
    });

    // Create unmatched items from the match group
    const unmatchedBankItems: UnmatchedBank[] = matchGroup.bankTransactions.map(transaction => ({
      transaction,
      suggested_action: 'Review this unmatched bank transaction',
    }));

    const unmatchedLedgerItems: UnmatchedLedger[] = matchGroup.ledgerEntries.map(entry => ({
      entry,
      reason: 'Unmatched from pre-matched group',
      action: 'Review this unmatched ledger entry',
    }));

    // Add to needs attention (unmatched items)
    setUnmatchedBankItems(prev => [...prev, ...unmatchedBankItems]);
    setUnmatchedLedgerItems(prev => [...prev, ...unmatchedLedgerItems]);

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/bank-rec/unmatch-group`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            companyId,
            period,
            matchGroupId,
          }),
        }
      );

      if (response.ok) {
        toast.success(`Unmatched ${matchGroup.bankTransactions.length} bank and ${matchGroup.ledgerEntries.length} ledger transactions. Moved to Needs Attention.`);
        // Switch to Needs Attention tab to show the unmatched items
        setActiveTab('needs-attention');
      } else {
        const errorText = await response.text();
        console.error('Failed to unmatch group:', response.status, errorText);
        toast.error('Failed to unmatch group. Please try again.');
        // Revert optimistic updates
        setReconciliationResult(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            pre_matched_items: [...(prev.pre_matched_items || []), matchGroup],
          };
        });
        setUnmatchedBankItems(prev => prev.filter(i => !unmatchedBankItems.some(b => b.transaction.id === i.transaction.id)));
        setUnmatchedLedgerItems(prev => prev.filter(i => !unmatchedLedgerItems.some(l => l.entry.id === i.entry.id)));
      }
    } catch (error) {
      console.error('Failed to unmatch group:', error);
      toast.error('Failed to unmatch group. Please try again.');
      // Revert optimistic updates
      setReconciliationResult(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          pre_matched_items: [...(prev.pre_matched_items || []), matchGroup],
        };
      });
      setUnmatchedBankItems(prev => prev.filter(i => !unmatchedBankItems.some(b => b.transaction.id === i.transaction.id)));
      setUnmatchedLedgerItems(prev => prev.filter(i => !unmatchedLedgerItems.some(l => l.entry.id === i.entry.id)));
    } finally {
      setLoadingActions(prev => ({ ...prev, [actionKey]: false }));
    }
  };

  const handleDeleteTransaction = async (item: UnmatchedBank | UnmatchedLedger, type: 'bank' | 'ledger') => {
    const itemId = type === 'bank' ? (item as UnmatchedBank).transaction.id : (item as UnmatchedLedger).entry.id;
    const actionKey = `delete-${type}-${itemId}`;
    setLoadingActions(prev => ({ ...prev, [actionKey]: true }));

    // Optimistic update - remove from unmatched immediately
    if (type === 'bank') {
      setUnmatchedBankItems(prev => prev.filter(i => i.transaction.id !== itemId));
    } else {
      setUnmatchedLedgerItems(prev => prev.filter(i => i.entry.id !== itemId));
    }

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/bank-rec/delete-transaction`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            companyId,
            period,
            type,
            item,
          }),
        }
      );

      if (response.ok) {
        toast.success('Transaction deleted successfully.');
      } else {
        const errorText = await response.text();
        console.error('Failed to delete transaction:', response.status, errorText);
        toast.error('Failed to delete transaction. Please try again.');
        // Revert optimistic update on error
        if (type === 'bank') {
          setUnmatchedBankItems(prev => [...prev, item as UnmatchedBank]);
        } else {
          setUnmatchedLedgerItems(prev => [...prev, item as UnmatchedLedger]);
        }
      }
    } catch (error) {
      console.error('Failed to delete transaction:', error);
      toast.error('Failed to delete transaction. Please try again.');
      // Revert optimistic update on error
      if (type === 'bank') {
        setUnmatchedBankItems(prev => [...prev, item as UnmatchedBank]);
      } else {
        setUnmatchedLedgerItems(prev => [...prev, item as UnmatchedLedger]);
      }
    } finally {
      setLoadingActions(prev => ({ ...prev, [actionKey]: false }));
    }
  };

  const getPeriodLabel = (periodValue: string) => {
    const [year, month] = periodValue.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  // Helper function to get styling based on resolution status
  const getResolutionStyling = (resolvedItem: ResolvedItem) => {
    const resolution = resolvedItem.resolution || '';
    const status = resolvedItem.status || '';

    // Yellow for transactions sent to JE section
    if (resolution.includes('Journal Entries section')) {
      return {
        bgColor: 'bg-yellow-50',
        borderColor: 'border-yellow-200',
        badgeBg: 'bg-yellow-100',
        badgeText: 'text-yellow-700',
        badgeBorder: 'border-yellow-300',
        iconColor: 'text-yellow-600',
        buttonBg: 'bg-yellow-100 hover:bg-yellow-200 border-yellow-300',
        buttonText: 'text-yellow-700'
      };
    }

    // Blue for timing differences
    if (status === 'timing_difference') {
      return {
        bgColor: 'bg-blue-50',
        borderColor: 'border-blue-200',
        badgeBg: 'bg-blue-100',
        badgeText: 'text-blue-700',
        badgeBorder: 'border-blue-300',
        iconColor: 'text-blue-600',
        buttonBg: 'bg-blue-100 hover:bg-blue-200 border-blue-300',
        buttonText: 'text-blue-700'
      };
    }

    // Gray for ignored items (subtle, less prominent)
    if (status === 'ignored') {
      return {
        bgColor: 'bg-white',
        borderColor: 'border-gray-300',
        badgeBg: 'bg-gray-50',
        badgeText: 'text-gray-600',
        badgeBorder: 'border-gray-200',
        iconColor: 'text-gray-400',
        buttonBg: 'bg-gray-50 hover:bg-gray-100 border-gray-200',
        buttonText: 'text-gray-600'
      };
    }

    // Green for matched transactions (default)
    return {
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
      badgeBg: 'bg-green-100',
      badgeText: 'text-green-700',
      badgeBorder: 'border-green-300',
      iconColor: 'text-green-600',
      buttonBg: 'bg-green-100 hover:bg-green-200 border-green-300',
      buttonText: 'text-green-700'
    };
  };

  // Helper function to get clean, short resolution labels
  const getCleanResolutionLabel = (resolution: string): string => {
    if (!resolution) return 'Resolved';

    // Map long texts to clean labels
    if (resolution.includes('Journal Entries section')) {
      return 'Sent to Journal';
    }
    if (resolution.includes('Reversing journal')) {
      return 'Reversal Created';
    }
    if (resolution === 'timing_difference' || resolution === 'timing difference') {
      return 'Timing Difference';
    }
    if (resolution === 'ignored') {
      return 'Ignored';
    }
    if (resolution === 'matched' || resolution.includes('matched')) {
      return 'Matched';
    }

    // Fallback: capitalize and clean up underscores
    return resolution.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  // Placeholder functions for new pre-matched tab actions
  const handleConfirmMatch = async (matchGroup: PreMatchedItem) => {
    const actionKey = `confirm-${matchGroup.matchGroupId}`;
    setLoadingActions(prev => ({ ...prev, [actionKey]: true }));

    // Optimistically remove from pre-matched items
    setReconciliationResult(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        pre_matched_items: prev.pre_matched_items?.filter(g => g.matchGroupId !== matchGroup.matchGroupId) || [],
      };
    });

    // Create resolved item from the match group
    const resolvedItem = {
      id: matchGroup.matchGroupId,
      type: 'confirmed_match' as const,
      bankTransaction: matchGroup.bankTransactions[0],
      ledgerEntry: matchGroup.ledgerEntries[0],
      matchGroup: matchGroup,
      resolvedAt: new Date().toISOString(),
      resolvedBy: 'user',
      notes: `Confirmed ${matchGroup.match_type || 'auto'} match`,
    };

    // Add to resolved items
    setResolvedItems(prev => [...prev, resolvedItem]);

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/bank-rec/confirm-match`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            companyId,
            period,
            accountId: selectedAccountId,
            matchGroupId: matchGroup.matchGroupId,
          }),
        }
      );

      if (response.ok) {
        toast.success('Match confirmed!');
      } else {
        const errorText = await response.text();
        console.error('Failed to confirm match:', response.status, errorText);
        toast.error('Failed to confirm match. Rolling back...');
        // Rollback: add back to pre_matched and remove from resolved
        setReconciliationResult(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            pre_matched_items: [...(prev.pre_matched_items || []), matchGroup],
          };
        });
        setResolvedItems(prev => prev.filter(r => r.id !== matchGroup.matchGroupId));
      }
    } catch (error) {
      console.error('Error confirming match:', error);
      toast.error('Network error. Rolling back...');
      // Rollback
      setReconciliationResult(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          pre_matched_items: [...(prev.pre_matched_items || []), matchGroup],
        };
      });
      setResolvedItems(prev => prev.filter(r => r.id !== matchGroup.matchGroupId));
    } finally {
      setLoadingActions(prev => ({ ...prev, [actionKey]: false }));
    }
  };

  const handleConfirmAllMatches = async () => {
    // Get all safe matches (high confidence, non-FX)
    const items = reconciliationResult?.pre_matched_items || [];
    const safeMatches = items.filter(i => {
      const isFxVariance = i.match_type === 'fx' ||
        i.match_type === 'fx_adjusted' ||
        (i.explanation && i.explanation.includes('FX'));
      const confidencePercent = i.confidence && i.confidence > 1 ? i.confidence : (i.confidence || 1) * 100;
      const isLowConfidence = confidencePercent <= 85;
      return !isFxVariance && !isLowConfidence;
    });

    if (safeMatches.length === 0) {
      toast.info('No safe matches to confirm.');
      return;
    }

    // Optimistically remove all safe matches from pre-matched items
    setReconciliationResult(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        pre_matched_items: prev.pre_matched_items?.filter(g =>
          !safeMatches.some(s => s.matchGroupId === g.matchGroupId)
        ) || [],
      };
    });

    // Create resolved items from all safe matches
    const newResolvedItems = safeMatches.map(matchGroup => ({
      id: matchGroup.matchGroupId,
      type: 'confirmed_match' as const,
      bankTransaction: matchGroup.bankTransactions[0],
      ledgerEntry: matchGroup.ledgerEntries[0],
      matchGroup: matchGroup,
      resolvedAt: new Date().toISOString(),
      resolvedBy: 'user',
      notes: `Bulk confirmed ${matchGroup.match_type || 'auto'} match`,
    }));

    // Add all to resolved items
    setResolvedItems(prev => [...prev, ...newResolvedItems]);

    toast.success(`${safeMatches.length} matches confirmed!`);

    // Call API for each match (in background, don't wait)
    safeMatches.forEach(async (matchGroup) => {
      try {
        await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/bank-rec/confirm-match`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${publicAnonKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              companyId,
              period,
              accountId: selectedAccountId,
              matchGroupId: matchGroup.matchGroupId,
            }),
          }
        );
      } catch (error) {
        console.error('Error confirming match:', matchGroup.matchGroupId, error);
      }
    });
  };

  if (isLoadingReconciliation || isLoadingAccounts || !selectedAccountId) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-gray-200 border-t-[#65D3FD] rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading reconciliation data...</p>
        </div>
      </div>
    );
  }

  if (!reconciliationResult) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button type="button" variant="ghost" onClick={onBack} className="gap-2">
            <ArrowLeft className="size-4" />
            Back to Month-End Close
          </Button>
        </div>
        <Alert>
          <AlertCircle className="size-4" />
          <AlertDescription>
            No reconciliation found for {companyName} - {getPeriodLabel(period)}.
            Please run a bank reconciliation first.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const needsAttentionCount = (unmatchedBankItems?.length || 0) +
    (unmatchedLedgerItems?.length || 0);
  const followUpCount = followUpItems?.length || 0;
  const resolvedCount = resolvedItems?.length || 0;

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            type="button"
            variant="ghost"
            onClick={onBack}
            className="gap-2 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="size-4" />
            Back
          </Button>
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="text-3xl font-bold font-outfit text-gray-900 dark:text-white tracking-tight">
              Review Bank Reconciliation
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-2">
              <span className="font-medium">{companyName}</span>
              <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
              <span>{new Date(period + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
            </p>
          </motion.div>
        </div>

        {/* Account Selector */}
        {bankAccounts.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2 min-w-[200px] h-11 bg-white/50 dark:bg-black/20 backdrop-blur-sm border-gray-200 dark:border-white/10 hover:bg-white/80 dark:hover:bg-black/40 transition-all">
                {isLoadingAccounts ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Loading accounts...
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-left truncate font-medium">
                      {bankAccounts.find(a => a.id === selectedAccountId)?.name || 'Select Account'}
                    </span>
                    <ChevronDown className="size-4 opacity-50" />
                  </>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[250px] bg-white/90 dark:bg-black/90 backdrop-blur-xl border-gray-200 dark:border-white/10">
              {bankAccounts.map((account) => (
                <DropdownMenuItem
                  key={account.id}
                  onClick={() => setSelectedAccountId(account.id)}
                  className={`
                    cursor-pointer my-1
                    ${selectedAccountId === account.id ? 'bg-purple-50 dark:bg-purple-900/20' : ''}
                  `}
                >
                  <div className="flex flex-col flex-1">
                    <span className="text-sm font-medium">{account.name}</span>
                    <span className="text-xs text-gray-500">{account.code}</span>
                  </div>
                  {selectedAccountId === account.id && (
                    <CheckCircle2 className="size-4 text-purple-600 dark:text-purple-400" />
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Locked Banner */}
      {isMonthLocked && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gray-900/95 text-white p-4 rounded-xl border border-gray-800 shadow-lg backdrop-blur-md flex items-center gap-3"
        >
          <div className="p-2 bg-white/10 rounded-lg">
            <Lock className="size-4" />
          </div>
          <div>
            <p className="font-medium text-sm">Period Locked</p>
            <p className="text-xs text-gray-400">
              Closed {lockDetails?.closedAt ? new Date(lockDetails.closedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''} · Read-only mode
            </p>
          </div>
        </motion.div>
      )}

      {/* No Accounts State */}
      {!isLoadingAccounts && bankAccounts.length === 0 && (
        <Card className="border-0 shadow-lg bg-white/50 dark:bg-black/20 backdrop-blur-xl">
          <CardContent className="py-16 text-center">
            <div className="size-16 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="size-8 text-gray-400" />
            </div>
            <h3 className="text-xl font-medium text-gray-900 dark:text-white mb-2">No Bank Accounts Found</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
              Please add bank accounts to your Chart of Accounts before reviewing reconciliation.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Loading Accounts State */}
      {isLoadingAccounts && (
        <Card className="border-0 shadow-lg bg-white/50 dark:bg-black/20 backdrop-blur-xl">
          <CardContent className="py-16 text-center">
            <Loader2 className="size-12 text-[#65D3FD] mx-auto mb-4 animate-spin" />
            <p className="text-gray-600 dark:text-gray-300 font-medium">Loading bank accounts...</p>
          </CardContent>
        </Card>
      )}

      {/* Main Content - Only show if account is selected */}
      {!isLoadingAccounts && bankAccounts.length > 0 && selectedAccountId && (
        <>
          {/* Summary Stats */}
          <div className="grid grid-cols-4 gap-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="group relative overflow-hidden rounded-2xl bg-white/80 dark:bg-black/40 backdrop-blur-xl border border-white/20 dark:border-white/5 shadow-sm hover:shadow-md transition-all duration-300"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#65D3FD]/10 rounded-full blur-3xl -mr-16 -mt-16 transition-opacity group-hover:opacity-100" />
              <div className="p-6 relative z-10">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Pre-Matched</span>
                  <div className="size-2 rounded-full bg-[#65D3FD] shadow-[0_0_10px_rgba(101,211,253,0.5)]" />
                </div>
                <div className="text-4xl font-bold text-gray-900 dark:text-white tracking-tight mb-1">
                  {reconciliationResult?.pre_matched_items?.length || 0}
                </div>
                <p className="text-xs font-medium text-[#65D3FD] flex items-center gap-1">
                  Auto-matched groups
                </p>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="group relative overflow-hidden rounded-2xl bg-white/80 dark:bg-black/40 backdrop-blur-xl border border-white/20 dark:border-white/5 shadow-sm hover:shadow-md transition-all duration-300"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 rounded-full blur-3xl -mr-16 -mt-16 transition-opacity group-hover:opacity-100" />
              <div className="p-6 relative z-10">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Needs Attention</span>
                  <div className="size-2 rounded-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]" />
                </div>
                <div className="text-4xl font-bold text-gray-900 dark:text-white tracking-tight mb-1">
                  {needsAttentionCount}
                </div>
                <p className="text-xs font-medium text-red-500 flex items-center gap-1">
                  Unmatched items
                </p>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="group relative overflow-hidden rounded-2xl bg-white/80 dark:bg-black/40 backdrop-blur-xl border border-white/20 dark:border-white/5 shadow-sm hover:shadow-md transition-all duration-300"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl -mr-16 -mt-16 transition-opacity group-hover:opacity-100" />
              <div className="p-6 relative z-10">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Follow-Up Needed</span>
                  <div className="size-2 rounded-full bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.5)]" />
                </div>
                <div className="text-4xl font-bold text-gray-900 dark:text-white tracking-tight mb-1">
                  {followUpCount}
                </div>
                <p className="text-xs font-medium text-purple-500 flex items-center gap-1">
                  Awaiting information
                </p>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="group relative overflow-hidden rounded-2xl bg-white/80 dark:bg-black/40 backdrop-blur-xl border border-white/20 dark:border-white/5 shadow-sm hover:shadow-md transition-all duration-300"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/10 rounded-full blur-3xl -mr-16 -mt-16 transition-opacity group-hover:opacity-100" />
              <div className="p-6 relative z-10">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Resolved</span>
                  <div className="size-2 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]" />
                </div>
                <div className="text-4xl font-bold text-gray-900 dark:text-white tracking-tight mb-1">
                  {resolvedCount}
                </div>
                <p className="text-xs font-medium text-green-500 flex items-center gap-1">
                  Completed
                </p>
              </div>
            </motion.div>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={(value: any) => setActiveTab(value)} className="space-y-6">
            <TabsList className="bg-gray-100/80 dark:bg-white/[0.03] border border-gray-200/50 dark:border-white/10 h-14 p-1.5 rounded-2xl gap-1.5 w-auto">
              <TabsTrigger
                value="needs-attention"
                className="h-11 rounded-xl px-5 font-medium text-gray-500 hover:text-gray-700 hover:bg-white/50 dark:text-gray-400 dark:hover:text-white dark:hover:bg-white/5 data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:ring-2 data-[state=active]:ring-[#65D3FD]/50 dark:data-[state=active]:bg-white/10 dark:data-[state=active]:ring-[#65D3FD]/30 data-[state=active]:text-gray-900 dark:data-[state=active]:text-white transition-all"
              >
                <div className="flex items-center gap-2">
                  <AlertCircle className="size-4" />
                  Needs Attention
                  {needsAttentionCount > 0 && (
                    <span className="ml-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-100 dark:bg-red-500/20 px-1.5 text-xs font-semibold text-red-600 dark:text-red-400">
                      {needsAttentionCount}
                    </span>
                  )}
                </div>
              </TabsTrigger>
              <TabsTrigger
                value="follow-up"
                className="h-11 rounded-xl px-5 font-medium text-gray-500 hover:text-gray-700 hover:bg-white/50 dark:text-gray-400 dark:hover:text-white dark:hover:bg-white/5 data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:ring-2 data-[state=active]:ring-[#65D3FD]/50 dark:data-[state=active]:bg-white/10 dark:data-[state=active]:ring-[#65D3FD]/30 data-[state=active]:text-gray-900 dark:data-[state=active]:text-white transition-all"
              >
                <div className="flex items-center gap-2">
                  <MessageSquare className="size-4" />
                  Follow-Up Needed
                  {followUpCount > 0 && (
                    <span className="ml-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-500/20 px-1.5 text-xs font-semibold text-purple-600 dark:text-purple-400">
                      {followUpCount}
                    </span>
                  )}
                </div>
              </TabsTrigger>
              <TabsTrigger
                value="resolved"
                className="h-11 rounded-xl px-5 font-medium text-gray-500 hover:text-gray-700 hover:bg-white/50 dark:text-gray-400 dark:hover:text-white dark:hover:bg-white/5 data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:ring-2 data-[state=active]:ring-[#65D3FD]/50 dark:data-[state=active]:bg-white/10 dark:data-[state=active]:ring-[#65D3FD]/30 data-[state=active]:text-gray-900 dark:data-[state=active]:text-white transition-all"
              >
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-4" />
                  Resolved / Completed
                  {resolvedCount > 0 && (
                    <span className="ml-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-green-100 dark:bg-green-500/20 px-1.5 text-xs font-semibold text-green-600 dark:text-green-400">
                      {resolvedCount}
                    </span>
                  )}
                </div>
              </TabsTrigger>
              <TabsTrigger
                value="pre-matched"
                className="h-11 rounded-xl px-5 font-medium text-gray-500 hover:text-gray-700 hover:bg-white/50 dark:text-gray-400 dark:hover:text-white dark:hover:bg-white/5 data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:ring-2 data-[state=active]:ring-[#65D3FD]/50 dark:data-[state=active]:bg-white/10 dark:data-[state=active]:ring-[#65D3FD]/30 data-[state=active]:text-gray-900 dark:data-[state=active]:text-white transition-all"
              >
                <div className="flex items-center gap-2">
                  <Link className="size-4" />
                  Pre-Matched
                  {(reconciliationResult?.pre_matched_items?.length || 0) > 0 && (
                    <span className="ml-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-500/20 px-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400">
                      {reconciliationResult?.pre_matched_items?.length || 0}
                    </span>
                  )}
                </div>
              </TabsTrigger>
            </TabsList>

            {/* Tab 1: Needs Attention */}
            <TabsContent value="needs-attention" className="mt-0">
              <div className="grid grid-cols-2 gap-8">
                {/* Left Column: Unmatched Bank Transactions */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-white/5">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                        <FileSpreadsheet className="size-5 text-red-500" />
                        Bank Transactions
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Unmatched items from bank statement</p>
                    </div>
                    <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-900/30">
                      {unmatchedBankItems?.length || 0}
                    </Badge>
                  </div>

                  <AnimatePresence mode="popLayout">
                    {unmatchedBankItems && unmatchedBankItems.length > 0 ? (
                      <motion.div
                        className="space-y-3"
                        initial="hidden"
                        animate="visible"
                        variants={{
                          visible: { transition: { staggerChildren: 0.05 } }
                        }}
                      >
                        {unmatchedBankItems.map((item, idx) => (
                          <motion.div
                            key={`${item.transaction.id}-${idx}`}
                            variants={{
                              hidden: { opacity: 0, y: 10 },
                              visible: { opacity: 1, y: 0 }
                            }}
                            layout
                          >
                            <UnmatchedItemCard
                              type="bank"
                              currency={accountCurrency}
                              item={{
                                data: {
                                  id: item.transaction.id,
                                  date: item.transaction.date,
                                  description: item.transaction.description,
                                  amount: item.transaction.amount,
                                },
                                suggested_je: item.suggested_je
                              }}
                              loadingActions={loadingActions}
                              isMonthLocked={isMonthLocked}
                              onApproveJE={() => handleApproveForJE(item, 'bank')}
                              onMatch={() => handleOpenMatchDialog(item)}
                              onEdit={() => handleEditBankTransaction(item)}
                              onTimingDifference={() => handleMarkAsTimingDifference(item, 'bank')}
                              onIgnore={() => handleMarkAsIgnored(item, 'bank')}
                              onRequestInfo={() => handleOpenFollowUpDialog(item, 'bank')}
                              onDelete={() => handleDeleteTransaction(item, 'bank')}
                            />
                          </motion.div>
                        ))}
                      </motion.div>
                    ) : (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-center py-12 rounded-xl bg-white/50 dark:bg-white/5 border border-dashed border-gray-200 dark:border-white/10"
                      >
                        <div className="size-12 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center mx-auto mb-3">
                          <CheckCircle2 className="size-6 text-green-600 dark:text-green-400" />
                        </div>
                        <p className="font-medium text-gray-900 dark:text-white">All caught up!</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">No unmatched bank transactions found.</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Right Column: Unmatched Ledger Entries */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-white/5">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                        <BookOpen className="size-5 text-amber-500" />
                        Ledger Entries
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Unmatched items from general ledger</p>
                    </div>
                    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-900/30">
                      {unmatchedLedgerItems?.length || 0}
                    </Badge>
                  </div>

                  <AnimatePresence mode="popLayout">
                    {unmatchedLedgerItems && unmatchedLedgerItems.length > 0 ? (
                      <motion.div
                        className="space-y-3"
                        initial="hidden"
                        animate="visible"
                        variants={{
                          visible: { transition: { staggerChildren: 0.05 } }
                        }}
                      >
                        {unmatchedLedgerItems.map((item, idx) => (
                          <motion.div
                            key={`${item.entry.id}-${idx}`}
                            variants={{
                              hidden: { opacity: 0, y: 10 },
                              visible: { opacity: 1, y: 0 }
                            }}
                            layout
                          >
                            <UnmatchedItemCard
                              type="ledger"
                              currency={accountCurrency}
                              item={{
                                data: {
                                  id: item.entry.id,
                                  date: item.entry.date,
                                  description: item.entry.description,
                                  amount: item.entry.amount,
                                }
                              }}
                              loadingActions={loadingActions}
                              isMonthLocked={isMonthLocked}
                              onApproveJE={() => handleReverseJE(item)}
                              onMatch={() => handleOpenMatchDialog(item)}
                              onEdit={() => handleEditLedgerEntry(item)}
                              onTimingDifference={() => handleMarkAsTimingDifference(item, 'ledger')}
                              onIgnore={() => handleMarkAsIgnored(item, 'ledger')}
                              onRequestInfo={() => handleOpenFollowUpDialog(item, 'ledger')}
                              onDelete={() => handleDeleteTransaction(item, 'ledger')}
                              primaryActionLabel="Reverse JE"
                              primaryActionIcon={<Undo2 className="size-3" />}
                              primaryActionClassName="gap-2 bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:hover:bg-purple-900/50 dark:text-purple-300 dark:border-purple-800"
                            />
                          </motion.div>
                        ))}
                      </motion.div>
                    ) : (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-center py-12 rounded-xl bg-white/50 dark:bg-white/5 border border-dashed border-gray-200 dark:border-white/10"
                      >
                        <div className="size-12 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center mx-auto mb-3">
                          <CheckCircle2 className="size-6 text-green-600 dark:text-green-400" />
                        </div>
                        <p className="font-medium text-gray-900 dark:text-white">All caught up!</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">No unmatched ledger entries found.</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </TabsContent>

            {/* Tab 2: Follow-Up Needed */}
            <TabsContent value="follow-up" className="mt-0">
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-white/5">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                      <MessageSquare className="size-5 text-purple-600" />
                      Follow-Up Items
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Items awaiting external action or clarification</p>
                  </div>
                  <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-900/30">
                    {followUpCount} items
                  </Badge>
                </div>

                <AnimatePresence mode="popLayout">
                  {followUpCount > 0 ? (
                    <motion.div
                      className="space-y-3"
                      initial="hidden"
                      animate="visible"
                      variants={{
                        visible: { transition: { staggerChildren: 0.05 } }
                      }}
                    >
                      {followUpItems.map((followUpItem, idx) => {
                        const item = followUpItem.item;
                        const isBank = followUpItem.type === 'bank';
                        const transaction = isBank ? (item as UnmatchedBank).transaction : (item as UnmatchedLedger).entry;

                        return (
                          <motion.div
                            key={`${transaction.id}-${idx}`}
                            layout
                            variants={{
                              hidden: { opacity: 0, scale: 0.95 },
                              visible: { opacity: 1, scale: 1 }
                            }}
                            className="p-5 bg-white/60 dark:bg-black/40 backdrop-blur-md border border-purple-100 dark:border-purple-900/30 rounded-xl shadow-sm hover:shadow-md transition-all group"
                          >
                            <div className="flex items-start justify-between mb-4">
                              <div className="flex-1 space-y-3">
                                <div className="flex items-center gap-3">
                                  <Badge variant="outline" className={`
                                        text-xs border px-2 py-0.5 rounded-full
                                        ${isBank
                                      ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800'
                                      : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800'}
                                     `}>
                                    {isBank ? 'Bank Transaction' : 'Ledger Entry'}
                                  </Badge>
                                  <span className="text-sm text-gray-400">|</span>
                                  <span className="text-sm text-gray-500 dark:text-gray-400 font-mono">{transaction.date}</span>
                                  <span className="text-sm text-gray-400">|</span>
                                  <span className="text-xs text-gray-400">Flagged on {new Date(followUpItem.markedAt).toLocaleDateString()}</span>
                                </div>

                                <div className="flex justify-between items-start pr-4">
                                  <h4 className="font-medium text-gray-900 dark:text-white text-base">
                                    {transaction.description}
                                  </h4>
                                  <span className={`text-lg font-bold font-mono tracking-tight ${transaction.amount >= 0 ? 'text-green-600 dark:text-green-400' : 'text-gray-900 dark:text-white'}`}>
                                    {formatCurrency(transaction.amount)}
                                  </span>
                                </div>

                                <div className="mt-4 bg-gray-50 dark:bg-white/5 rounded-xl p-4 border border-gray-100 dark:border-white/5 flex gap-4">
                                  <div className="shrink-0 size-8 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                                    <MessageSquare className="size-4 text-purple-600 dark:text-purple-400" />
                                  </div>
                                  <div className="space-y-1">
                                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Request Note</p>
                                    <p className="text-sm text-gray-900 dark:text-white leading-relaxed">{followUpItem.note}</p>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="flex justify-end pt-3 border-t border-gray-100 dark:border-white/5 gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-8 gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                                onClick={() => handleReverseFollowUp(followUpItem)}
                                disabled={isMonthLocked || loadingActions[`reverse-followup-${followUpItem.type}-${transaction.id}`]}
                              >
                                {loadingActions[`reverse-followup-${followUpItem.type}-${transaction.id}`] ? (
                                  <>
                                    <Loader2 className="size-3 animate-spin" />
                                    Processing...
                                  </>
                                ) : (
                                  <>
                                    <Undo2 className="size-3" />
                                    Return to Review
                                  </>
                                )}
                              </Button>
                            </div>
                          </motion.div>
                        );
                      })}
                    </motion.div>
                  ) : (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-center py-16 rounded-xl bg-white/50 dark:bg-white/5 border border-dashed border-gray-200 dark:border-white/10"
                    >
                      <div className="size-16 rounded-full bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center mx-auto mb-4">
                        <MessageSquare className="size-8 text-purple-500 dark:text-purple-400" />
                      </div>
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white">All Clear</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mx-auto mt-1">
                        No items are currently flagged for follow-up.
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </TabsContent>

            {/* Tab 3: Resolved/Completed */}
            <TabsContent value="resolved" className="mt-0">
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-white/5">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                      <CheckCircle2 className="size-5 text-green-600" />
                      Resolved Items
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Reconciled and cleared transactions</p>
                  </div>
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-900/30">
                    {resolvedCount} items
                  </Badge>
                </div>

                <AnimatePresence mode="popLayout">
                  {resolvedCount > 0 ? (
                    <motion.div
                      className="space-y-3"
                      initial="hidden"
                      animate="visible"
                      variants={{
                        visible: { transition: { staggerChildren: 0.05 } }
                      }}
                    >
                      {groupResolvedItems().map((group, groupIdx) => {
                        const { groupId, items } = group;
                        // const isExpanded = expandedGroups.has(groupId); // Not currently used in old logic but good to have if we add expand/collapse
                        const isMatchGroup = items.length > 1 && items[0].matchGroupId;

                        // Calculate totals for the group
                        const bankItems = items.filter(i => i && i.item && i.type === 'bank');
                        const ledgerItems = items.filter(i => i && i.item && i.type === 'ledger');
                        const bankTotal = bankItems.reduce((sum, item) => {
                          if (!item?.item) return sum;
                          const transaction = (item.item as UnmatchedBank)?.transaction;
                          if (!transaction) return sum;
                          return sum + Math.abs(transaction.amount);
                        }, 0);
                        const ledgerTotal = ledgerItems.reduce((sum, item) => {
                          if (!item?.item) return sum;
                          const entry = (item.item as UnmatchedLedger)?.entry;
                          if (!entry) return sum;
                          return sum + Math.abs(entry.amount);
                        }, 0);

                        if (isMatchGroup) {
                          // Show grouped match - with detailed view like Pre-Matched
                          return (
                            <motion.div
                              key={`group-${groupId}-${groupIdx}`}
                              layout
                              variants={{
                                hidden: { opacity: 0, scale: 0.95 },
                                visible: { opacity: 1, scale: 1 }
                              }}
                              className="p-5 bg-yellow-50/50 dark:bg-yellow-900/10 backdrop-blur-md border border-yellow-200 dark:border-yellow-900/30 rounded-xl shadow-sm hover:shadow-md transition-all"
                            >
                              <div className="flex items-start justify-between mb-4">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-2">
                                    <CheckCircle2 className="size-4 text-yellow-600 dark:text-yellow-400" />
                                    <Badge variant="outline" className="text-xs bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-900/40 dark:text-yellow-300 dark:border-yellow-800">
                                      Matched Group
                                    </Badge>
                                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                                      {bankItems.length} Bank ↔ {ledgerItems.length} Ledger
                                    </span>
                                    <span className="text-gray-400 mx-2">•</span>
                                    <span className="text-xs text-gray-400">
                                      {items[0].markedAt ? new Date(items[0].markedAt).toLocaleDateString() : ''}
                                    </span>
                                  </div>

                                  <div className="text-xs bg-white/50 dark:bg-black/20 border border-yellow-200 dark:border-yellow-900/30 rounded-lg p-3 mt-3">
                                    <div className="flex items-center gap-4 text-gray-600 dark:text-gray-400">
                                      <div className="font-medium">Summary:</div>
                                      <div>Bank: <span className="font-mono text-gray-900 dark:text-white">{formatCurrency(bankTotal, accountCurrency)}</span></div>
                                      <div>Ledger: <span className="font-mono text-gray-900 dark:text-white">{formatCurrency(ledgerTotal, accountCurrency)}</span></div>
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-2 gap-4 mt-4">
                                    {/* Bank Transactions */}
                                    {bankItems.length > 0 && (
                                      <div className="space-y-2">
                                        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider pl-1">Bank Transactions</div>
                                        {bankItems.map((resolvedItem, itemIdx) => {
                                          const item = resolvedItem?.item;
                                          const transaction = (item as UnmatchedBank)?.transaction;
                                          if (!transaction) return null;

                                          return (
                                            <div key={itemIdx} className="p-2.5 bg-white dark:bg-black/20 border border-gray-100 dark:border-white/5 rounded-lg text-xs flex justify-between items-center hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                                              <div className="flex flex-col gap-0.5">
                                                <span className="font-medium text-gray-900 dark:text-white line-clamp-1">{transaction.description}</span>
                                                <span className="text-gray-500 font-mono text-[10px]">{transaction.date}</span>
                                              </div>
                                              <span className={`font-mono font-medium ${transaction.amount >= 0 ? 'text-green-600 dark:text-green-400' : 'text-gray-900 dark:text-white'}`}>
                                                {formatCurrency(Math.abs(transaction.amount), accountCurrency)}
                                              </span>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}

                                    {/* Ledger Entries */}
                                    {ledgerItems.length > 0 && (
                                      <div className="space-y-2">
                                        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider pl-1">Ledger Entries</div>
                                        {ledgerItems.map((resolvedItem, itemIdx) => {
                                          const item = resolvedItem?.item;
                                          const entry = (item as UnmatchedLedger)?.entry;
                                          if (!entry) return null;

                                          return (
                                            <div key={itemIdx} className="p-2.5 bg-white dark:bg-black/20 border border-gray-100 dark:border-white/5 rounded-lg text-xs flex justify-between items-center hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                                              <div className="flex flex-col gap-0.5">
                                                <span className="font-medium text-gray-900 dark:text-white line-clamp-1">{entry.description}</span>
                                                <span className="text-gray-500 font-mono text-[10px]">{entry.date}</span>
                                              </div>
                                              <span className={`font-mono font-medium ${entry.amount >= 0 ? 'text-green-600 dark:text-green-400' : 'text-gray-900 dark:text-white'}`}>
                                                {formatCurrency(Math.abs(entry.amount), accountCurrency)}
                                              </span>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                </div>

                                <div className="ml-4">
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                                    onClick={() => handleUnmatchGroup(groupId)}
                                    disabled={isMonthLocked || loadingActions[`unmatch-${groupId}`]}
                                    title="Unmatch Group"
                                  >
                                    <Undo2 className="size-4" />
                                  </Button>
                                </div>
                              </div>
                            </motion.div>
                          );
                        }

                        // Regular single matched item (e.g. marked as something else or just single)
                        // ... but wait, Bank Rec typically matches 1 to 1 or 1 to many. 
                        // If it's a single resolved item (not in a match group), strictly speaking it might be "Ignored" or "Timing Difference" or "Single Match"?
                        // The implementation below handles standard ResolvedItems.

                        const resolvedItem = items[0];
                        const item = resolvedItem?.item;
                        const isBank = resolvedItem.type === 'bank';
                        const transaction = isBank ? (item as UnmatchedBank)?.transaction : (item as UnmatchedLedger)?.entry;

                        if (!transaction) return null;

                        // Determine status badge color
                        let statusColor = 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700';
                        if (resolvedItem.resolution === 'timing_difference') {
                          statusColor = 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-300 dark:border-orange-800';
                        } else if (resolvedItem.resolution === 'ignored') {
                          statusColor = 'bg-gray-100 text-gray-500 border-gray-200 dark:bg-gray-800/50 dark:text-gray-400 dark:border-gray-700';
                        }

                        return (
                          <motion.div
                            key={`single-${groupId}-${groupIdx}`}
                            layout
                            variants={{
                              hidden: { opacity: 0, scale: 0.95 },
                              visible: { opacity: 1, scale: 1 }
                            }}
                            className="p-4 bg-white/60 dark:bg-black/40 backdrop-blur-md border border-gray-100 dark:border-white/10 rounded-xl shadow-sm hover:shadow-md transition-all group flex items-start justify-between"
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <Badge variant="outline" className={`text-xs px-2 py-0.5 rounded-full ${statusColor}`}>
                                  {getCleanResolutionLabel(resolvedItem.resolution || '')}
                                </Badge>
                                <span className="text-sm font-medium text-gray-900 dark:text-white">{transaction.description}</span>
                                <Badge variant="outline" className="text-xs border-transparent bg-gray-50 dark:bg-white/5 text-gray-500">
                                  {transaction.date}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                                <span>{isBank ? 'Bank Transaction' : 'Ledger Entry'}</span>
                                <span>•</span>
                                <span>Resolved on {new Date(resolvedItem.markedAt).toLocaleDateString()}</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-4">
                              <span className={`font-mono font-bold text-lg ${transaction.amount >= 0 ? 'text-green-600 dark:text-green-400' : 'text-gray-900 dark:text-white'}`}>
                                {formatCurrency(Math.abs(transaction.amount), accountCurrency)}
                              </span>

                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => handleUnmatchGroup(groupId)} // Assuming unmatch works for single items too if they have groupId
                                disabled={isMonthLocked || loadingActions[`unmatch-${groupId}`]}
                                title="Revert Resolution"
                              >
                                <Undo2 className="size-4" />
                              </Button>
                            </div>
                          </motion.div>
                        );
                      })}
                    </motion.div>
                  ) : (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-center py-16 rounded-xl bg-white/50 dark:bg-white/5 border border-dashed border-gray-200 dark:border-white/10"
                    >
                      <div className="size-16 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center mx-auto mb-4">
                        <CheckCircle2 className="size-8 text-green-600 dark:text-green-400" />
                      </div>
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white">Nothing Resolved Yet</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mx-auto mt-1">
                        Start matching transactions to see them here.
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </TabsContent>

            {/* Tab 4: Pre-Matched */}
            <TabsContent value="pre-matched" className="mt-0 focus-visible:outline-none">
              {!reconciliationResult?.pre_matched_items || reconciliationResult.pre_matched_items.length === 0 ? (
                <EmptyState
                  icon={CheckCircle2}
                  title="No Pre-Matched Items"
                  description="We couldn't automatically match any remaining transactions. Please review the lists below to match items manually."
                />
              ) : (
                <div className="space-y-6">
                  {/* Logic for splitting items */}
                  {(() => {
                    const items = reconciliationResult.pre_matched_items || [];
                    // Items need attention if: FX variance OR confidence <= 85%
                    const reviewNeeded = items.filter(i => {
                      const isFxVariance = i.match_type === 'fx' ||
                        i.match_type === 'fx_adjusted' ||
                        (i.explanation && i.explanation.includes('FX'));
                      // Confidence is stored as 0-1 (e.g., 0.92 = 92%) or as 0-100
                      const confidencePercent = i.confidence && i.confidence > 1 ? i.confidence : (i.confidence || 1) * 100;
                      const isLowConfidence = confidencePercent <= 85;
                      return isFxVariance || isLowConfidence;
                    });
                    const safeMatches = items.filter(i => !reviewNeeded.includes(i));

                    return (
                      <>
                        {/* SECTION 1: ATTENTION REQUIRED */}
                        {reviewNeeded.length > 0 && (
                          <div className="space-y-3">
                            {/* Section Header - matches "Ready for Approval" style */}
                            <div className="flex items-center justify-between px-1">
                              <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                Attention Required ({reviewNeeded.length})
                              </h3>
                            </div>

                            {/* Items */}
                            {reviewNeeded.map((matchGroup) => {
                              const bankTotal = matchGroup.bankTransactions.reduce((sum, t) => sum + t.amount, 0);
                              const ledgerTotal = matchGroup.ledgerEntries.reduce((sum, e) => sum + e.amount, 0);
                              const difference = Math.abs(bankTotal - ledgerTotal);

                              return (
                                <motion.div
                                  layout
                                  initial={{ opacity: 0, y: 10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, scale: 0.95 }}
                                  key={matchGroup.matchGroupId}
                                  className="group relative overflow-hidden rounded-xl border border-amber-200 dark:border-amber-900/30 bg-white dark:bg-white/5 shadow-sm hover:shadow-md transition-all"
                                >
                                  {/* Left accent bar - solid amber */}
                                  <div className="absolute top-0 left-0 w-1 h-full bg-amber-500" />

                                  {/* Header */}
                                  <div className="flex items-center justify-between gap-4 p-4 pl-5 border-b border-gray-100 dark:border-white/5">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <Link className="size-4 text-amber-600 dark:text-amber-400" />
                                      <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800">
                                        Review Needed
                                      </Badge>

                                      {(matchGroup.match_type === 'fx' || matchGroup.match_type === 'fx_adjusted' || (matchGroup.explanation && matchGroup.explanation.includes('FX'))) && (
                                        <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-800">
                                          FX Variance
                                        </Badge>
                                      )}

                                      {matchGroup.confidence && matchGroup.confidence < 1.0 && (
                                        <Badge variant="outline" className="text-xs bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-900/20 dark:text-gray-300 dark:border-gray-800">
                                          {Math.round((matchGroup.confidence > 1 ? matchGroup.confidence : matchGroup.confidence * 100))}% Confidence
                                        </Badge>
                                      )}
                                    </div>

                                    <div className="flex items-center gap-2">
                                      {/* Show different button based on match type */}
                                      {(matchGroup.match_type === 'fx' || matchGroup.match_type === 'fx_adjusted' || (matchGroup.explanation && matchGroup.explanation.includes('FX'))) ? (
                                        // FX Match - needs adjustment
                                        <Button
                                          size="sm"
                                          onClick={() => handleOpenFxDialog(matchGroup)}
                                          className="h-8 text-white border-none shadow-sm gap-2"
                                          style={{ backgroundColor: '#f59e0b' }}
                                        >
                                          <Calculator className="size-3.5" />
                                          Adjust & Match
                                        </Button>
                                      ) : (
                                        // Low confidence match - just needs confirmation
                                        <Button
                                          size="sm"
                                          onClick={() => handleConfirmMatch(matchGroup)}
                                          className="h-8 bg-white dark:bg-white/10 hover:bg-gray-50 dark:hover:bg-white/20 text-gray-700 dark:text-white border border-gray-200 dark:border-white/10 shadow-sm gap-2"
                                        >
                                          <CheckCircle2 className="size-3.5" />
                                          Confirm
                                        </Button>
                                      )}
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-8 px-3 text-gray-500 hover:text-red-500 hover:border-red-300 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 gap-1.5"
                                        onClick={() => handleUnmatchGroup(matchGroup.matchGroupId)}
                                      >
                                        <X className="size-3.5" />
                                        Unmatch
                                      </Button>
                                    </div>
                                  </div>

                                  {/* Content Grid */}
                                  <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-100 dark:divide-white/5">
                                    {/* Bank Side */}
                                    <div className="p-4 pl-5 bg-white dark:bg-transparent">
                                      <div className="flex items-center justify-between mb-3">
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                                          Bank Transactions ({matchGroup.bankTransactions.length})
                                        </p>
                                        <p className="text-base font-mono font-bold text-gray-900 dark:text-white">
                                          {formatCurrency(bankTotal, accountCurrency)}
                                        </p>
                                      </div>
                                      <div className="space-y-2">
                                        {matchGroup.bankTransactions.map(txn => (
                                          <div key={txn.id} className="flex justify-between items-start text-xs text-gray-600 dark:text-gray-300 py-2 border-b border-gray-50 last:border-0 dark:border-white/5">
                                            <div className="flex-1 min-w-0 pr-2">
                                              <p className="font-medium truncate text-gray-900 dark:text-white" title={txn.description}>{txn.description}</p>
                                              <p className="text-[10px] text-gray-400 font-mono">{txn.date}</p>
                                            </div>
                                            <span className="font-mono whitespace-nowrap text-gray-900 dark:text-white">{formatCurrency(txn.amount, accountCurrency)}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>

                                    {/* Ledger Side */}
                                    <div className="p-4 bg-gray-50/50 dark:bg-white/[0.02]">
                                      <div className="flex items-center justify-between mb-3">
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                                          Ledger Entries ({matchGroup.ledgerEntries.length})
                                        </p>
                                        <p className="text-base font-mono font-bold text-gray-900 dark:text-white">
                                          {formatCurrency(ledgerTotal, accountCurrency)}
                                        </p>
                                      </div>
                                      <div className="space-y-2">
                                        {matchGroup.ledgerEntries.map(entry => (
                                          <div key={entry.id} className="flex justify-between items-start text-xs text-gray-600 dark:text-gray-300 py-2 border-b border-gray-100/50 last:border-0 dark:border-white/5">
                                            <div className="flex-1 min-w-0 pr-2">
                                              <p className="font-medium truncate text-gray-900 dark:text-white" title={entry.description}>{entry.description}</p>
                                              <p className="text-[10px] text-gray-400 font-mono">{entry.date}</p>
                                            </div>
                                            <span className="font-mono whitespace-nowrap text-gray-900 dark:text-white">{formatCurrency(entry.amount, accountCurrency)}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Difference Footer */}
                                  {difference > 0.01 && (
                                    <div className="px-4 pl-5 py-3 bg-amber-50/50 dark:bg-amber-900/10 border-t border-amber-100 dark:border-amber-900/20">
                                      <div className="flex items-center justify-between">
                                        <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
                                          Variance to resolve
                                        </span>
                                        <span className="text-sm font-bold font-mono text-amber-600 dark:text-amber-400">
                                          {formatCurrency(difference, accountCurrency)}
                                        </span>
                                      </div>
                                    </div>
                                  )}
                                </motion.div>
                              );
                            })}
                          </div>
                        )}

                        {/* SECTION 2: SAFE MATCHES */}
                        {safeMatches.length > 0 && (
                          <div className="space-y-3 pt-4 border-t border-gray-100 dark:border-white/5">
                            <div className="flex items-center justify-between px-1">
                              <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                Ready for Approval ({safeMatches.length})
                              </h3>
                              <Button size="sm" variant="ghost" className="text-xs text-blue-600 hover:text-blue-700 h-7" onClick={() => handleConfirmAllMatches()}>
                                Approve All Safe Matches
                              </Button>
                            </div>

                            {safeMatches.map((matchGroup) => (
                              <motion.div
                                layout
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                key={matchGroup.matchGroupId}
                                className="group relative overflow-hidden rounded-xl border border-gray-100 dark:border-white/5 bg-white dark:bg-white/5 shadow-sm hover:shadow-md transition-all"
                              >
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4">
                                  {/* Left side: Match info */}
                                  <div className="flex-1 min-w-0 space-y-3">
                                    <div className="flex items-center gap-2 mb-2">
                                      <Link className="size-4 text-blue-600 dark:text-blue-400" />
                                      <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800">
                                        {matchGroup.match_type === 'exact' ? 'Exact Match' :
                                          matchGroup.match_type === 'tolerance' ? 'Tolerance Match' :
                                            matchGroup.match_type === 'one_to_many' ? 'Split Match' :
                                              matchGroup.match_type === 'many_to_one' ? 'Grouped Match' :
                                                'Auto-Matched'}
                                      </Badge>
                                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                                        {formatCurrency(matchGroup.bankTransactions.reduce((s, t) => s + t.amount, 0), accountCurrency)}
                                      </span>
                                    </div>

                                    {/* Preview of items (Condensed) */}
                                    <div className="flex items-center gap-4 text-xs text-gray-500">
                                      <div className="flex items-center gap-1.5">
                                        <span className="font-medium text-gray-700 dark:text-gray-300">{matchGroup.bankTransactions[0].description}</span>
                                        {matchGroup.bankTransactions.length > 1 && <span className="text-[10px] bg-gray-100 px-1 rounded">+{matchGroup.bankTransactions.length - 1} more</span>}
                                      </div>
                                      <ArrowRight className="size-3 text-gray-300" />
                                      <div className="flex items-center gap-1.5">
                                        <span className="font-medium text-gray-700 dark:text-gray-300">{matchGroup.ledgerEntries[0].description}</span>
                                        {matchGroup.ledgerEntries.length > 1 && <span className="text-[10px] bg-gray-100 px-1 rounded">+{matchGroup.ledgerEntries.length - 1} more</span>}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Right side: Actions */}
                                  <div className="flex items-center gap-2 self-end sm:self-center">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleUnmatchGroup(matchGroup.matchGroupId)}
                                      className="h-8 w-8 p-0 text-gray-400 hover:text-red-500"
                                      title="Unmatch"
                                    >
                                      <Trash2 className="size-4" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      onClick={() => handleConfirmMatch(matchGroup)}
                                      className="h-8 bg-white dark:bg-white/10 hover:bg-gray-50 dark:hover:bg-white/20 text-gray-700 dark:text-white border border-gray-200 dark:border-white/10 shadow-sm"
                                    >
                                      Confirm
                                    </Button>
                                  </div>
                                </div>
                              </motion.div>
                            ))}
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}
            </TabsContent>
          </Tabs>

          {/* Edit Transaction Dialog */}
          <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
            <DialogContent className="bg-white/95 dark:bg-black/95 backdrop-blur-xl border-gray-200 dark:border-white/10 sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle className="font-outfit text-xl">Edit {editingType === 'bank' ? 'Bank Transaction' : 'Ledger Entry'}</DialogTitle>
                <DialogDescription className="text-gray-500 dark:text-gray-400">
                  Update the transaction details if needed.
                </DialogDescription>
              </DialogHeader>
              {editingItem && (
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="date" className="text-xs font-medium uppercase text-gray-500">Date</Label>
                    <Input
                      id="date"
                      type="date"
                      className="bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10"
                      value={editingItem.date || ''}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditingItem({ ...editingItem, date: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description" className="text-xs font-medium uppercase text-gray-500">Description</Label>
                    <Input
                      id="description"
                      className="bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10"
                      value={editingItem.description || ''}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditingItem({ ...editingItem, description: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="amount" className="text-xs font-medium uppercase text-gray-500">Amount</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-gray-500">{getCurrencySymbol(accountCurrency)}</span>
                      <Input
                        id="amount"
                        type="number"
                        step="0.01"
                        className="pl-7 bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 font-mono"
                        value={editingItem.amount || 0}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditingItem({ ...editingItem, amount: parseFloat(e.target.value) })}
                      />
                    </div>
                  </div>
                </div>
              )}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowEditDialog(false)} className="border-gray-200 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/5">
                  Cancel
                </Button>
                <Button type="button" onClick={handleSaveEdit} className="bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-300 text-white dark:text-gray-900 border-0 hover:opacity-90 transition-opacity">
                  Save Changes
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Follow-Up Dialog */}
          <ReconciliationFollowUpDialog
            open={showFollowUpDialog}
            onOpenChange={setShowFollowUpDialog}
            note={followUpNote}
            onNoteChange={setFollowUpNote}
            onConfirm={handleRequestInformation}
            isLoading={!!(
              (editingType === 'bank' && selectedBankItem && loadingActions[`request-info-bank-${selectedBankItem.transaction.id}`]) ||
              (editingType === 'ledger' && selectedLedgerItem && loadingActions[`request-info-ledger-${selectedLedgerItem.entry.id}`])
            )}
          />

          {/* Match Dialog */}
          <ReconciliationMatchDialog
            open={showMatchDialog}
            onOpenChange={setShowMatchDialog}
            title="Match Transactions - Multi-Select"

            leftItems={unmatchedBankItems?.map(item => ({
              id: item.transaction.id,
              date: item.transaction.date,
              description: item.transaction.description,
              amount: item.transaction.amount,
              originalItem: item
            })) || []}
            leftTitle="Bank Transactions"
            onSelectLeft={(item) => toggleBankSelection(item.originalItem as UnmatchedBank)}
            selectedLeftItems={selectedBankItems.map(item => ({
              id: item.transaction.id,
              date: item.transaction.date,
              description: item.transaction.description,
              amount: item.transaction.amount,
              originalItem: item
            }))}

            rightItems={unmatchedLedgerItems?.map(item => ({
              id: item.entry.id,
              date: item.entry.date,
              description: item.entry.description,
              amount: item.entry.amount,
              originalItem: item
            })) || []}
            rightTitle="Ledger Entries"
            onSelectRight={(item) => toggleLedgerSelection(item.originalItem as UnmatchedLedger)}
            selectedRightItems={selectedLedgerItems.map(item => ({
              id: item.entry.id,
              date: item.entry.date,
              description: item.entry.description,
              amount: item.entry.amount,
              originalItem: item
            }))}

            onMatch={handleMatchItems}
            isMatching={false}
          />

          {/* Toaster */}
          <Toaster />
        </>
      )}

      {/* FX Adjustment Dialog */}
      <FxAdjustmentDialog
        isOpen={showFxDialog}
        onClose={() => setShowFxDialog(false)}
        onConfirm={handleConfirmFxAdjustment}
        bankAmount={selectedFxGroup ? selectedFxGroup.bankTransactions.reduce((s, t) => s + t.amount, 0) : 0}
        ledgerAmount={selectedFxGroup ? selectedFxGroup.ledgerEntries.reduce((s, e) => s + e.amount, 0) : 0}
        currency={accountCurrency}
        bankAccountName={selectedAccount?.name || 'Bank Account'}
        chartOfAccounts={chartOfAccounts}
        isProcessing={isProcessingFx}
      />
    </div>
  );
}