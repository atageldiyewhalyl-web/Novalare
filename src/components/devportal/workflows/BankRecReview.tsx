import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
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
  Lock
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

interface BankRecReviewProps {
  companyId: string;
  companyName: string;
  period: string;
  onBack: () => void;
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

interface ResolvedItem {
  type: 'bank' | 'ledger';
  item: UnmatchedBank | UnmatchedLedger;
  markedAt: string;
  status: string;
  resolution: string;
  matchGroupId?: string;
}

interface FollowUpItem {
  type: 'bank' | 'ledger';
  item: UnmatchedBank | UnmatchedLedger;
  note: string;
  markedAt: string;
  status?: string;
}

interface PreMatchedItem {
  matchGroupId: string;
  bankTransactions: BankTransaction[];
  ledgerEntries: LedgerEntry[];
  matchedAt: string;
  confidence?: number;
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

export function BankRecReview({ companyId, companyName, period, onBack }: BankRecReviewProps) {
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

  useEffect(() => {
    loadLockStatus();
    loadReconciliationData();
  }, [companyId, period]);

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
    setIsLoadingReconciliation(true);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/bank-rec/reconciliation?companyId=${companyId}&period=${period}`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        console.log('Reconciliation data loaded:', data);
        
        // Check if pre_matched_items is missing and matched_pairs exists - migrate if needed
        if ((!data.pre_matched_items || data.pre_matched_items.length === 0) && 
            data.matched_pairs && data.matched_pairs.length > 0) {
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
                body: JSON.stringify({ companyId, period }),
              }
            );
            
            if (migrateResponse.ok) {
              console.log('✅ Migration successful, reloading data...');
              // Reload the data to get the updated pre_matched_items
              const reloadResponse = await fetch(
                `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/bank-rec/reconciliation?companyId=${companyId}&period=${period}`,
                {
                  headers: {
                    'Authorization': `Bearer ${publicAnonKey}`,
                  },
                }
              );
              if (reloadResponse.ok) {
                const updatedData = await reloadResponse.json();
                setReconciliationResult(updatedData);
                setUnmatchedBankItems(updatedData.unmatched_bank || []);
                setUnmatchedLedgerItems(updatedData.unmatched_ledger || []);
                setResolvedItems(updatedData.resolved_items || []);
                setFollowUpItems(updatedData.follow_up_items || []);
                return;
              }
            }
          } catch (migrationError) {
            console.error('Migration failed, using original data:', migrationError);
          }
        }
        
        setReconciliationResult(data);
        
        // Initialize optimistic update state
        setUnmatchedBankItems(data.unmatched_bank || []);
        setUnmatchedLedgerItems(data.unmatched_ledger || []);
        setResolvedItems(data.resolved_items || []);
        setFollowUpItems(data.follow_up_items || []);
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

  const formatCurrency = (amount: number): string => {
    return amount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  const handleEditBankTransaction = (item: UnmatchedBank) => {
    setEditingItem({...item.transaction});
    setEditingType('bank');
    setSelectedBankItem(item);
    setShowEditDialog(true);
  };

  const handleEditLedgerEntry = (item: UnmatchedLedger) => {
    setEditingItem({...item.entry});
    setEditingType('ledger');
    setSelectedLedgerItem(item);
    setShowEditDialog(true);
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
          body: JSON.stringify(requestPayload),
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
            type,
            item,
            note: followUpNote,
          }),
        }
      );

      if (response.ok) {
        toast.success('Flagged for follow-up.');
        setShowFollowUpDialog(false);
        setFollowUpNote('');
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

  const handleOpenMatchDialog = (item: UnmatchedBank) => {
    setMatchingBankItem(item);
    setSelectedBankItems([item]); // Pre-select the clicked item
    setSelectedLedgerItems([]);
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
      .filter(item => item && item.item) // Filter out invalid items
      .forEach(item => {
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

  if (isLoadingReconciliation) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Loader2 className="size-8 text-gray-400 animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">Loading reconciliation data...</p>
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button type="button" variant="ghost" onClick={onBack} className="gap-2">
            <ArrowLeft className="size-4" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl text-gray-900">Review Bank Reconciliation</h1>
            <p className="text-gray-500 mt-1">{companyName} - {getPeriodLabel(period)}</p>
          </div>
        </div>
      </div>

      {/* Locked Banner */}
      {isMonthLocked && (
        <div className="bg-gray-900 text-white p-3 rounded-lg border border-gray-800">
          <div className="flex items-center gap-2">
            <Lock className="size-4" />
            <p className="text-sm">
              Period locked · Closed {lockDetails?.closedAt ? new Date(lockDetails.closedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''} · Read-only mode
            </p>
          </div>
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-gray-600">Pre-Matched</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl text-blue-600">{reconciliationResult?.pre_matched_items?.length || 0}</div>
            <p className="text-xs text-gray-500 mt-1">Auto-matched groups</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-gray-600">Needs Attention</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl text-red-600">{needsAttentionCount}</div>
            <p className="text-xs text-gray-500 mt-1">Unmatched items</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-gray-600">Follow-Up Needed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl text-purple-600">{followUpCount}</div>
            <p className="text-xs text-gray-500 mt-1">Awaiting information</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-gray-600">Resolved</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl text-green-600">{resolvedCount}</div>
            <p className="text-xs text-gray-500 mt-1">Completed</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(value: any) => setActiveTab(value)} className="space-y-4">
        <TabsList>
          <TabsTrigger value="needs-attention" className="gap-2">
            <AlertCircle className="size-4" />
            Needs Attention
            {needsAttentionCount > 0 && (
              <Badge variant="outline" className="ml-1 bg-red-50 text-red-700 border-red-200">
                {needsAttentionCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="follow-up" className="gap-2">
            <MessageSquare className="size-4" />
            Follow-Up Needed
            {followUpCount > 0 && (
              <Badge variant="outline" className="ml-1 bg-purple-50 text-purple-700 border-purple-200">
                {followUpCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="resolved" className="gap-2">
            <CheckCircle2 className="size-4" />
            Resolved / Completed
            {resolvedCount > 0 && (
              <Badge variant="outline" className="ml-1 bg-green-50 text-green-700 border-green-200">
                {resolvedCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="pre-matched" className="gap-2">
            <Link className="size-4" />
            Pre-Matched
            {(reconciliationResult?.pre_matched_items?.length || 0) > 0 && (
              <Badge variant="outline" className="ml-1 bg-blue-50 text-blue-700 border-blue-200">
                {reconciliationResult?.pre_matched_items?.length || 0}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Needs Attention */}
        <TabsContent value="needs-attention" className="space-y-6">
          {/* Unmatched Bank Transactions */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <FileSpreadsheet className="size-5 text-red-600" />
                    Unmatched Bank Transactions
                  </CardTitle>
                  <CardDescription className="mt-2">
                    These transactions appear in bank statements but have no matching ledger entries.
                  </CardDescription>
                </div>
                <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                  {unmatchedBankItems?.length || 0} items
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {unmatchedBankItems && unmatchedBankItems.length > 0 ? (
                <div className="space-y-3">
                  {unmatchedBankItems.map((item, idx) => (
                    <div key={idx} className="p-4 bg-red-50 border border-red-200 rounded-lg">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-sm font-medium text-gray-900">{item.transaction.description}</span>
                            <Badge variant="outline" className="text-xs">
                              {item.transaction.date}
                            </Badge>
                          </div>
                          <p className="text-xs text-gray-600 mb-2">
                            <span className="font-medium">Suggested Action:</span> {item.suggested_action}
                          </p>
                          {item.suggested_je && (
                            <div className="text-xs bg-white border border-red-200 rounded p-3 mt-2">
                              <div className="font-medium text-gray-900 mb-1">AI Suggested Journal Entry:</div>
                              <div className="space-y-1 text-gray-600">
                                <div>• Debit: {item.suggested_je.debit_account}</div>
                                <div>• Credit: {item.suggested_je.credit_account}</div>
                                <div>• Amount: €{formatCurrency(item.suggested_je.amount)}</div>
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="ml-4">
                          <div className={`text-lg font-medium mb-2 ${item.transaction.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            €{formatCurrency(Math.abs(item.transaction.amount))}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 pt-2 border-t border-red-200">
                        <Button 
                          type="button"
                          size="sm" 
                          className="gap-2 bg-green-600 hover:bg-green-700"
                          onClick={() => handleApproveForJE(item, 'bank')}
                          disabled={loadingActions[`approve-bank-${item.transaction.id}`]}
                        >
                          {loadingActions[`approve-bank-${item.transaction.id}`] ? (
                            <>
                              <Loader2 className="size-3 animate-spin" />
                              Processing...
                            </>
                          ) : (
                            <>
                              <ThumbsUp className="size-3" />
                              Approve for JE
                            </>
                          )}
                        </Button>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button type="button" size="sm" variant="outline" className="gap-2">
                              <Link className="size-3" />
                              Match
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="w-56">
                            <DropdownMenuItem 
                              className="cursor-pointer"
                              onClick={() => handleOpenMatchDialog(item)}
                            >
                              <Link className="size-4 mr-2" />
                              Match to Ledger Entry
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>

                        <Button 
                          type="button"
                          size="sm" 
                          variant="outline"
                          className="gap-2"
                          onClick={() => handleEditBankTransaction(item)}
                          disabled={isMonthLocked}
                        >
                          <Edit2 className="size-3" />
                          Edit / Correct
                        </Button>

                        <DropdownMenu modal={false}>
                          <DropdownMenuTrigger asChild>
                            <Button type="button" size="sm" variant="outline" className="gap-2" disabled={isMonthLocked}>
                              More Actions
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" side="bottom" sideOffset={8} className="w-64">
                            <DropdownMenuItem 
                              className="cursor-pointer"
                              onClick={() => handleMarkAsTimingDifference(item, 'bank')}
                            >
                              <Clock className="size-4 mr-2 text-blue-600" />
                              <div>
                                <div className="text-sm">Mark as Timing Difference</div>
                                <div className="text-xs text-gray-500">Clears next month/period</div>
                              </div>
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              className="cursor-pointer"
                              onClick={() => handleMarkAsIgnored(item, 'bank')}
                            >
                              <EyeOff className="size-4 mr-2 text-gray-600" />
                              <div>
                                <div className="text-sm">Mark as Non-Issue / Ignore</div>
                                <div className="text-xs text-gray-500">Reviewed, no action needed</div>
                              </div>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              className="cursor-pointer"
                              onClick={() => handleOpenFollowUpDialog(item, 'bank')}
                            >
                              <MessageSquare className="size-4 mr-2 text-purple-600" />
                              <div>
                                <div className="text-sm">Request Information</div>
                                <div className="text-xs text-gray-500">Flag for follow-up</div>
                              </div>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              className="cursor-pointer text-red-600"
                              onClick={() => handleDeleteTransaction(item, 'bank')}
                            >
                              <Trash2 className="size-4 mr-2" />
                              <div>
                                <div className="text-sm">Delete Transaction</div>
                                <div className="text-xs text-gray-500">Permanently remove</div>
                              </div>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <CheckCircle2 className="size-12 text-green-500 mx-auto mb-3" />
                  <p className="text-sm text-gray-600">All bank transactions have been matched!</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Unmatched Ledger Entries */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <BookOpen className="size-5 text-amber-600" />
                    Unmatched Ledger Entries
                  </CardTitle>
                  <CardDescription className="mt-2">
                    These entries appear in the general ledger but have no matching bank transactions.
                  </CardDescription>
                </div>
                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                  {unmatchedLedgerItems?.length || 0} items
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {unmatchedLedgerItems && unmatchedLedgerItems.length > 0 ? (
                <div className="space-y-3">
                  {unmatchedLedgerItems.map((item, idx) => (
                    <div key={idx} className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-sm font-medium text-gray-900">{item.entry.description}</span>
                            <Badge variant="outline" className="text-xs">
                              {item.entry.date}
                            </Badge>
                          </div>
                          <div className="space-y-1 text-xs text-gray-600">
                            <p>
                              <span className="font-medium">Reason:</span> {item.reason}
                            </p>
                            <p>
                              <span className="font-medium">Recommended Action:</span> {item.action}
                            </p>
                            {item.entry.account && (
                              <p>
                                <span className="font-medium">Account:</span> {item.entry.account}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className={`text-lg font-medium ${item.entry.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            €{formatCurrency(Math.abs(item.entry.amount))}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 pt-2 border-t border-amber-200">
                        <Button 
                          type="button"
                          size="sm" 
                          variant="outline"
                          className="gap-2 bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-200"
                          onClick={() => handleReverseJE(item)}
                          disabled={isMonthLocked || loadingActions[`reverse-ledger-${item.entry.id}`]}
                        >
                          {loadingActions[`reverse-ledger-${item.entry.id}`] ? (
                            <>
                              <Loader2 className="size-3 animate-spin" />
                              Processing...
                            </>
                          ) : (
                            <>
                              <Undo2 className="size-3" />
                              Reverse JE
                            </>
                          )}
                        </Button>

                        <Button 
                          type="button"
                          size="sm" 
                          variant="outline"
                          className="gap-2"
                          onClick={() => handleEditLedgerEntry(item)}
                          disabled={isMonthLocked}
                        >
                          <Edit2 className="size-3" />
                          Edit / Correct
                        </Button>

                        <DropdownMenu modal={false}>
                          <DropdownMenuTrigger asChild>
                            <Button type="button" size="sm" variant="outline" className="gap-2" disabled={isMonthLocked}>
                              More Actions
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" side="bottom" sideOffset={8} className="w-64">
                            <DropdownMenuItem 
                              className="cursor-pointer"
                              onClick={() => handleMarkAsTimingDifference(item, 'ledger')}
                            >
                              <Clock className="size-4 mr-2 text-blue-600" />
                              <div>
                                <div className="text-sm">Mark as Timing Difference</div>
                                <div className="text-xs text-gray-500">Clears next month/period</div>
                              </div>
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              className="cursor-pointer"
                              onClick={() => handleMarkAsIgnored(item, 'ledger')}
                            >
                              <EyeOff className="size-4 mr-2 text-gray-600" />
                              <div>
                                <div className="text-sm">Mark as Non-Issue / Ignore</div>
                                <div className="text-xs text-gray-500">Reviewed, no action needed</div>
                              </div>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              className="cursor-pointer"
                              onClick={() => handleOpenFollowUpDialog(item, 'ledger')}
                            >
                              <MessageSquare className="size-4 mr-2 text-purple-600" />
                              <div>
                                <div className="text-sm">Request Information</div>
                                <div className="text-xs text-gray-500">Flag for follow-up</div>
                              </div>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              className="cursor-pointer text-red-600"
                              onClick={() => handleDeleteTransaction(item, 'ledger')}
                            >
                              <Trash2 className="size-4 mr-2" />
                              <div>
                                <div className="text-sm">Delete Transaction</div>
                                <div className="text-xs text-gray-500">Permanently remove</div>
                              </div>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <CheckCircle2 className="size-12 text-green-500 mx-auto mb-3" />
                  <p className="text-sm text-gray-600">All ledger entries have been matched!</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Follow-Up Needed */}
        <TabsContent value="follow-up">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="size-5 text-purple-600" />
                    Follow-Up Needed
                  </CardTitle>
                  <CardDescription className="mt-2">
                    Items awaiting vendor documents, client responses, or team clarification.
                  </CardDescription>
                </div>
                <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                  {followUpCount} items
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {followUpCount > 0 ? (
                <div className="space-y-3">
                  {followUpItems.map((followUpItem, idx) => {
                    const item = followUpItem.item;
                    const isBank = followUpItem.type === 'bank';
                    const transaction = isBank ? (item as UnmatchedBank).transaction : (item as UnmatchedLedger).entry;
                    
                    return (
                      <div key={idx} className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge variant="outline" className="text-xs bg-purple-100 text-purple-700 border-purple-300">
                                {isBank ? 'Bank' : 'Ledger'}
                              </Badge>
                              <span className="text-sm font-medium text-gray-900">{transaction.description}</span>
                              <Badge variant="outline" className="text-xs">
                                {transaction.date}
                              </Badge>
                            </div>
                            <div className="text-xs bg-white border border-purple-200 rounded p-3 mt-2">
                              <div className="font-medium text-gray-900 mb-1">Follow-up Note:</div>
                              <p className="text-gray-600">{followUpItem.note}</p>
                              <p className="text-gray-400 mt-2">Flagged on: {new Date(followUpItem.markedAt).toLocaleDateString()}</p>
                            </div>
                          </div>
                          <div className="ml-4">
                            <div className={`text-lg font-medium ${transaction.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              €{formatCurrency(Math.abs(transaction.amount))}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2 pt-2 border-t border-purple-200">
                          <Button 
                            type="button"
                            size="sm" 
                            className="gap-2 bg-red-600 hover:bg-red-700"
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
                                <X className="size-3" />
                                Reverse
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8">
                  <CheckCircle2 className="size-12 text-green-500 mx-auto mb-3" />
                  <p className="text-sm text-gray-600">No items waiting for follow-up!</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Resolved/Completed */}
        <TabsContent value="resolved">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle2 className="size-5 text-green-600" />
                    Resolved / Completed
                  </CardTitle>
                  <CardDescription className="mt-2">
                    All reconciled and cleared items for this period.
                  </CardDescription>
                </div>
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  {resolvedCount} items
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {resolvedCount > 0 ? (
                <div className="space-y-3">
                  {groupResolvedItems().map((group, groupIdx) => {
                    const { groupId, items } = group;
                    const isExpanded = expandedGroups.has(groupId);
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
                        <div key={groupIdx} className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <CheckCircle2 className="size-4 text-yellow-600" />
                                <Badge variant="outline" className="text-xs bg-yellow-100 text-yellow-700 border-yellow-300">
                                  Matched
                                </Badge>
                                <span className="text-sm font-medium text-gray-900">
                                  {bankItems.length} Bank ↔ {ledgerItems.length} Ledger
                                </span>
                                <Badge variant="outline" className="text-xs">
                                  {items[0].markedAt ? new Date(items[0].markedAt).toLocaleDateString() : ''}
                                </Badge>
                              </div>
                              
                              <div className="text-xs bg-white border border-yellow-200 rounded p-3 mt-2">
                                <div className="font-medium text-gray-900 mb-2">Match Summary:</div>
                                <div className="space-y-1 text-gray-600">
                                  <p>Bank Total: €{formatCurrency(bankTotal)}</p>
                                  <p>Ledger Total: €{formatCurrency(ledgerTotal)}</p>
                                </div>
                              </div>

                              {/* Bank Transactions */}
                              {bankItems.length > 0 && (
                                <div className="mt-3 space-y-2">
                                  <div className="text-xs font-medium text-gray-700">Bank Transactions:</div>
                                  {bankItems.map((resolvedItem, itemIdx) => {
                                    const item = resolvedItem?.item;
                                    const transaction = (item as UnmatchedBank)?.transaction;
                                    if (!transaction) return null;
                                    
                                    return (
                                      <div key={itemIdx} className="p-2 bg-white border border-yellow-200 rounded text-xs">
                                        <div className="flex items-center justify-between">
                                          <div className="flex items-center gap-2">
                                            <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700">
                                              Bank
                                            </Badge>
                                            <span className="text-gray-900">{transaction.description}</span>
                                            <span className="text-gray-500">{transaction.date}</span>
                                          </div>
                                          <span className={`font-medium ${transaction.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                            €{formatCurrency(Math.abs(transaction.amount))}
                                          </span>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}

                              {/* Ledger Entries */}
                              {ledgerItems.length > 0 && (
                                <div className="mt-3 space-y-2">
                                  <div className="text-xs font-medium text-gray-700">Ledger Entries:</div>
                                  {ledgerItems.map((resolvedItem, itemIdx) => {
                                    const item = resolvedItem?.item;
                                    const entry = (item as UnmatchedLedger)?.entry;
                                    if (!entry) return null;
                                    
                                    return (
                                      <div key={itemIdx} className="p-2 bg-white border border-yellow-200 rounded text-xs">
                                        <div className="flex items-center justify-between">
                                          <div className="flex items-center gap-2">
                                            <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700">
                                              Ledger
                                            </Badge>
                                            <span className="text-gray-900">{entry.description}</span>
                                            <span className="text-gray-500">{entry.date}</span>
                                          </div>
                                          <span className={`font-medium ${entry.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                            €{formatCurrency(Math.abs(entry.amount))}
                                          </span>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}

                              {/* Resolution Details */}
                              {items[0].resolution && (
                                <div className="text-xs bg-white border border-yellow-200 rounded p-3 mt-3">
                                  <div className="font-medium text-gray-900 mb-1">Resolution:</div>
                                  <p className="text-gray-600">{items[0].resolution}</p>
                                  <p className="text-gray-400 mt-2">Resolved on: {new Date(items[0].markedAt).toLocaleDateString()}</p>
                                </div>
                              )}
                            </div>
                            <div className="ml-4">
                              <div className="text-lg font-medium text-yellow-600">
                                €{formatCurrency(bankTotal)}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    } else {
                      // Show single item (not a match group)
                      const resolvedItem = items[0];
                      const item = resolvedItem.item;
                      
                      // Handle different item types: vendor (AP Rec), bank, ledger
                      let transaction;
                      let itemTypeLabel;
                      
                      if (resolvedItem.type === 'vendor') {
                        // AP Reconciliation: transaction is directly on item
                        transaction = (item as any)?.transaction;
                        itemTypeLabel = 'Vendor';
                      } else if (resolvedItem.type === 'bank') {
                        transaction = (item as UnmatchedBank)?.transaction;
                        itemTypeLabel = 'Bank';
                      } else {
                        // ledger
                        transaction = (item as UnmatchedLedger)?.entry;
                        itemTypeLabel = 'Ledger';
                      }
                      
                      const styling = getResolutionStyling(resolvedItem);
                      
                      // Skip if transaction is undefined
                      if (!transaction) {
                        console.warn('Transaction is undefined in resolved item:', resolvedItem);
                        return null;
                      }
                      
                      return (
                        <div key={groupIdx} className={`p-4 ${styling.bgColor} border ${styling.borderColor} rounded-lg`}>
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <CheckCircle2 className={`size-4 ${styling.iconColor}`} />
                                <Badge variant="outline" className={`text-xs ${styling.badgeBg} ${styling.badgeText} ${styling.badgeBorder}`}>
                                  {itemTypeLabel}
                                </Badge>
                                <span className="text-sm font-medium text-gray-900">{transaction.description}</span>
                                <Badge variant="outline" className="text-xs">
                                  {transaction.date}
                                </Badge>
                              </div>
                              <div className={`text-xs bg-white border ${styling.borderColor} rounded p-3 mt-2`}>
                                <div className="font-medium text-gray-900 mb-1">Resolution:</div>
                                <p className="text-gray-600">{resolvedItem.resolution}</p>
                                <p className="text-gray-400 mt-2">Resolved on: {new Date(resolvedItem.markedAt).toLocaleDateString()}</p>
                              </div>
                            </div>
                            <div className="ml-4">
                              <div className={`text-lg font-medium ${transaction.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                €{formatCurrency(Math.abs(transaction.amount))}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    }
                  })}
                </div>
              ) : (
                <div className="text-center py-8">
                  <AlertCircle className="size-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-sm text-gray-600">No resolved items yet.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 4: Pre-Matched */}
        <TabsContent value="pre-matched">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Link className="size-5 text-blue-600" />
                    Pre-Matched Transactions
                  </CardTitle>
                  <CardDescription className="mt-2">
                    Transactions that were automatically matched during reconciliation. Review and unmatch if needed.
                  </CardDescription>
                </div>
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                  {reconciliationResult?.pre_matched_items?.length || 0} groups
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {(reconciliationResult?.pre_matched_items?.length || 0) > 0 ? (
                <div className="space-y-3">
                  {reconciliationResult?.pre_matched_items?.map((matchGroup, idx) => {
                    const bankTotal = matchGroup.bankTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
                    const ledgerTotal = matchGroup.ledgerEntries.reduce((sum, e) => sum + Math.abs(e.amount), 0);
                    
                    return (
                      <div key={idx} className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Link className="size-4 text-blue-600" />
                              <Badge variant="outline" className="text-xs bg-blue-100 text-blue-700 border-blue-300">
                                Auto-Matched
                              </Badge>
                              <span className="text-sm font-medium text-gray-900">
                                {matchGroup.bankTransactions.length} Bank ↔ {matchGroup.ledgerEntries.length} Ledger
                              </span>
                              <Badge variant="outline" className="text-xs">
                                {new Date(matchGroup.matchedAt).toLocaleDateString()}
                              </Badge>
                            </div>
                            
                            <div className="text-xs bg-white border border-blue-200 rounded p-3 mt-2">
                              <div className="font-medium text-gray-900 mb-2">Match Summary:</div>
                              <div className="space-y-1 text-gray-600">
                                <p>Bank Total: €{formatCurrency(bankTotal)}</p>
                                <p>Ledger Total: €{formatCurrency(ledgerTotal)}</p>
                                <p className="text-gray-400 mt-2">Match ID: {matchGroup.matchGroupId}</p>
                              </div>
                            </div>

                            {/* Bank Transactions */}
                            <div className="mt-3 space-y-2">
                              <div className="text-xs font-medium text-gray-700">Bank Transactions:</div>
                              {matchGroup.bankTransactions.map((transaction, tIdx) => (
                                <div key={tIdx} className="p-2 bg-white border border-blue-200 rounded text-xs">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700">
                                        Bank
                                      </Badge>
                                      <span className="text-gray-900">{transaction.description}</span>
                                      <span className="text-gray-500">{transaction.date}</span>
                                    </div>
                                    <span className={`font-medium ${transaction.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                      €{formatCurrency(Math.abs(transaction.amount))}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>

                            {/* Ledger Entries */}
                            <div className="mt-3 space-y-2">
                              <div className="text-xs font-medium text-gray-700">Ledger Entries:</div>
                              {matchGroup.ledgerEntries.map((entry, eIdx) => (
                                <div key={eIdx} className="p-2 bg-white border border-blue-200 rounded text-xs">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700">
                                        Ledger
                                      </Badge>
                                      <span className="text-gray-900">{entry.description}</span>
                                      <span className="text-gray-500">{entry.date}</span>
                                    </div>
                                    <span className={`font-medium ${entry.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                      €{formatCurrency(Math.abs(entry.amount))}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="ml-4">
                            <div className="text-lg font-medium text-blue-600">
                              €{formatCurrency(bankTotal)}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2 pt-2 border-t border-blue-200">
                          <Button 
                            type="button"
                            size="sm" 
                            variant="outline"
                            className="gap-2 bg-red-50 hover:bg-red-100 text-red-700 border-red-200"
                            onClick={() => handleUnmatchGroup(matchGroup.matchGroupId)}
                            disabled={isMonthLocked || loadingActions[`unmatch-${matchGroup.matchGroupId}`]}
                          >
                            {loadingActions[`unmatch-${matchGroup.matchGroupId}`] ? (
                              <>
                                <Loader2 className="size-3 animate-spin" />
                                Processing...
                              </>
                            ) : (
                              <>
                                <Undo2 className="size-3" />
                                Unmatch
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Link className="size-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-sm text-gray-600">No pre-matched transactions found.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Transaction Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit {editingType === 'bank' ? 'Bank Transaction' : 'Ledger Entry'}</DialogTitle>
            <DialogDescription>
              Update the transaction details if needed.
            </DialogDescription>
          </DialogHeader>
          {editingItem && (
            <div className="space-y-4">
              <div>
                <Label>Date</Label>
                <Input 
                  type="date"
                  value={editingItem.date || ''}
                  onChange={(e) => setEditingItem({...editingItem, date: e.target.value})}
                />
              </div>
              <div>
                <Label>Description</Label>
                <Input 
                  value={editingItem.description || ''}
                  onChange={(e) => setEditingItem({...editingItem, description: e.target.value})}
                />
              </div>
              <div>
                <Label>Amount</Label>
                <Input 
                  type="number"
                  step="0.01"
                  value={editingItem.amount || 0}
                  onChange={(e) => setEditingItem({...editingItem, amount: parseFloat(e.target.value)})}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSaveEdit}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Follow-Up Dialog */}
      <Dialog open={showFollowUpDialog} onOpenChange={setShowFollowUpDialog}>
        <DialogContent className="max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <MessageSquare className="size-5 text-purple-600" />
              Request Information
            </DialogTitle>
            <DialogDescription className="text-gray-600">
              Add a note about what information is needed for this transaction.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium text-gray-700 mb-2">What information do you need?</Label>
              <Textarea 
                value={followUpNote}
                onChange={(e) => setFollowUpNote(e.target.value)}
                placeholder="e.g., Need vendor invoice from supplier, Waiting for client approval, Need clarification on purpose..."
                rows={5}
                className="mt-2 resize-none"
              />
            </div>
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <div className="flex items-start gap-2 mb-3">
                <ThumbsUp className="size-4 text-purple-600 mt-0.5" />
                <span className="text-sm font-medium text-purple-900">Common follow-ups:</span>
              </div>
              <ul className="space-y-2 ml-6">
                <li className="flex items-center gap-2 text-sm text-purple-800">
                  <div className="size-1.5 rounded-full bg-purple-400"></div>
                  Vendor invoice required
                </li>
                <li className="flex items-center gap-2 text-sm text-purple-800">
                  <div className="size-1.5 rounded-full bg-purple-400"></div>
                  Client inquiry needed
                </li>
                <li className="flex items-center gap-2 text-sm text-purple-800">
                  <div className="size-1.5 rounded-full bg-purple-400"></div>
                  Bank statement clarification
                </li>
                <li className="flex items-center gap-2 text-sm text-purple-800">
                  <div className="size-1.5 rounded-full bg-purple-400"></div>
                  Team member approval required
                </li>
              </ul>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setShowFollowUpDialog(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleRequestInformation} className="bg-purple-600 hover:bg-purple-700">
              Flag for Follow-Up
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Match Dialog */}
      <Dialog open={showMatchDialog} onOpenChange={setShowMatchDialog}>
        <DialogContent className="max-w-[90vw] w-[1600px] max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Match Transactions - Multi-Select</DialogTitle>
            <DialogDescription>
              Select one or more bank transactions and one or more ledger entries to match them together. Supports many-to-many matching.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto">
            <div className="grid grid-cols-2 gap-6">
              {/* Bank Transactions Column */}
              <div className="space-y-3">
                <div className="sticky top-0 bg-white pb-3 border-b border-gray-200 z-10">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-gray-900 flex items-center gap-2">
                      <FileSpreadsheet className="size-4 text-red-600" />
                      Bank Transactions
                    </h3>
                    <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                      {selectedBankItems.length} selected
                    </Badge>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded p-3">
                    <div className="text-sm font-medium text-blue-900">Selected Total:</div>
                    <div className={`text-2xl font-medium ${getTotalAmount(selectedBankItems) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      €{formatCurrency(Math.abs(getTotalAmount(selectedBankItems)))}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  {unmatchedBankItems && unmatchedBankItems.map((item, idx) => {
                    const isSelected = selectedBankItems.some(i => i.transaction.id === item.transaction.id);
                    return (
                      <div 
                        key={idx} 
                        className={`p-3 rounded-lg border-2 transition-all cursor-pointer ${
                          isSelected 
                            ? 'bg-blue-100 border-blue-500 shadow-md' 
                            : 'bg-red-50 border-red-200 hover:border-red-400'
                        }`}
                        onClick={() => toggleBankSelection(item)}
                      >
                        <div className="flex items-start gap-3">
                          <Checkbox 
                            checked={isSelected}
                            onCheckedChange={() => toggleBankSelection(item)}
                            className="mt-1"
                          />
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-medium text-gray-900">{item.transaction.description}</span>
                              <div className={`text-lg font-medium ${item.transaction.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                €{formatCurrency(Math.abs(item.transaction.amount))}
                              </div>
                            </div>
                            <div className="text-xs text-gray-600">{item.transaction.date}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Ledger Entries Column */}
              <div className="space-y-3">
                <div className="sticky top-0 bg-white pb-3 border-b border-gray-200 z-10">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-gray-900 flex items-center gap-2">
                      <BookOpen className="size-4 text-amber-600" />
                      Ledger Entries
                    </h3>
                    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                      {selectedLedgerItems.length} selected
                    </Badge>
                  </div>
                  <div className="bg-purple-50 border border-purple-200 rounded p-3">
                    <div className="text-sm font-medium text-purple-900">Selected Total:</div>
                    <div className={`text-2xl font-medium ${getTotalAmount(selectedLedgerItems) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      €{formatCurrency(Math.abs(getTotalAmount(selectedLedgerItems)))}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  {unmatchedLedgerItems && unmatchedLedgerItems.map((item, idx) => {
                    const isSelected = selectedLedgerItems.some(i => i.entry.id === item.entry.id);
                    return (
                      <div 
                        key={idx} 
                        className={`p-3 rounded-lg border-2 transition-all cursor-pointer ${
                          isSelected 
                            ? 'bg-purple-100 border-purple-500 shadow-md' 
                            : 'bg-amber-50 border-amber-200 hover:border-amber-400'
                        }`}
                        onClick={() => toggleLedgerSelection(item)}
                      >
                        <div className="flex items-start gap-3">
                          <Checkbox 
                            checked={isSelected}
                            onCheckedChange={() => toggleLedgerSelection(item)}
                            className="mt-1"
                          />
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-medium text-gray-900">{item.entry.description}</span>
                              <div className={`text-lg font-medium ${item.entry.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                €{formatCurrency(Math.abs(item.entry.amount))}
                              </div>
                            </div>
                            <div className="text-xs text-gray-600">{item.entry.date}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Match Validation Banner */}
          {(selectedBankItems.length > 0 || selectedLedgerItems.length > 0) && (
            <div className="border-t border-gray-200 pt-4">
              <div className={`p-4 rounded-lg border-2 ${
                Math.abs(getTotalAmount(selectedBankItems) - getTotalAmount(selectedLedgerItems)) < 0.01
                  ? 'bg-green-50 border-green-500'
                  : 'bg-yellow-50 border-yellow-500'
              }`}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-gray-900 mb-1">
                      {Math.abs(getTotalAmount(selectedBankItems) - getTotalAmount(selectedLedgerItems)) < 0.01 ? (
                        <span className="text-green-700 flex items-center gap-2">
                          <CheckCircle2 className="size-5" />
                          Amounts Match - Ready to Reconcile
                        </span>
                      ) : (
                        <span className="text-yellow-700 flex items-center gap-2">
                          <AlertCircle className="size-5" />
                          Amount Difference
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-600">
                      Bank: €{formatCurrency(Math.abs(getTotalAmount(selectedBankItems)))} | 
                      Ledger: €{formatCurrency(Math.abs(getTotalAmount(selectedLedgerItems)))} | 
                      Diff: €{formatCurrency(Math.abs(getTotalAmount(selectedBankItems) - getTotalAmount(selectedLedgerItems)))}
                    </div>
                  </div>
                  <Button 
                    type="button"
                    className="gap-2 bg-green-600 hover:bg-green-700"
                    onClick={() => handleMatchItems()}
                    disabled={isMonthLocked || selectedBankItems.length === 0 || selectedLedgerItems.length === 0}
                  >
                    <Link className="size-4" />
                    Match {selectedBankItems.length} Bank ↔ {selectedLedgerItems.length} Ledger
                  </Button>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => {
              setShowMatchDialog(false);
              setSelectedBankItems([]);
              setSelectedLedgerItems([]);
            }}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Toaster */}
      <Toaster />
    </div>
  );
}