import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  ArrowLeft, 
  CheckCircle2, 
  CreditCard, 
  BookOpen, 
  AlertCircle,
  Edit2,
  Link,
  MessageSquare,
  Loader2,
  ThumbsUp,
  ChevronDown,
  Undo2,
  EyeOff,
  Clock,
  ChevronUp,
  FileSpreadsheet,
  Lock
} from 'lucide-react';
import { projectId, publicAnonKey } from '@/utils/supabase/info';
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
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner@2.0.3';
import { Toaster } from 'sonner@2.0.3';

interface CCRecReviewProps {
  companyId: string;
  companyName: string;
  period: string;
  onBack: () => void;
}

interface CCTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  category?: string;
  merchant?: string;
  statementId: string;
  cardName: string;
}

interface LedgerEntry {
  id: string;
  date: string;
  description?: string;  // Optional for backwards compatibility  
  vendor?: string;       // Primary field for CC ledger entries
  memo?: string;         // Secondary description field
  amount?: number;       // Optional for backwards compatibility
  debit?: number;        // Primary field for CC ledger entries
  credit?: number;       // Refunds/adjustments for CC ledger entries
  glAccount?: string;    // GL Account number
  account?: string;      // Legacy field name
  reference?: string;
  cardAccount?: string;  // Credit card liability account
}

interface UnmatchedCC {
  transaction: CCTransaction;
  suggested_action: string;
}

interface UnmatchedLedger {
  entry: LedgerEntry;
  reason: string;
  action: string;
}

interface ResolvedItem {
  type: 'cc' | 'ledger';
  item: UnmatchedCC | UnmatchedLedger;
  markedAt: string;
  status: string;
  resolution: string;
  matchGroupId?: string;
}

interface FollowUpItem {
  type: 'cc' | 'ledger';
  item: UnmatchedCC | UnmatchedLedger;
  note: string;
  markedAt: string;
}

interface PreMatchedItem {
  matchGroupId: string;
  ccTransactions: CCTransaction[];
  ledgerEntries: LedgerEntry[];
  matchedAt: string;
  confidence?: number;
  matchType?: string;
  explanation?: string;
}

interface ReconciliationResult {
  unmatched_cc: UnmatchedCC[];
  unmatched_ledger: UnmatchedLedger[];
  summary: {
    total_cc_transactions: number;
    total_ledger_entries: number;
    matched_count: number;
    unmatched_cc_count: number;
    unmatched_ledger_count: number;
  };
  resolved_items?: ResolvedItem[];
  follow_up_items?: FollowUpItem[];
  pre_matched_items?: PreMatchedItem[];
  matched_pairs?: any[]; // Legacy field from reconciliation
}

export function CCRecReview({ companyId, companyName, period, onBack }: CCRecReviewProps) {
  const [reconciliationResult, setReconciliationResult] = useState<ReconciliationResult | null>(null);
  const [isLoadingReconciliation, setIsLoadingReconciliation] = useState(false);
  const [activeTab, setActiveTab] = useState<'needs-attention' | 'follow-up' | 'resolved' | 'pre-matched'>('needs-attention');
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showFollowUpDialog, setShowFollowUpDialog] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [editingType, setEditingType] = useState<'cc' | 'ledger' | null>(null);
  const [selectedCCItem, setSelectedCCItem] = useState<UnmatchedCC | null>(null);
  const [selectedLedgerItem, setSelectedLedgerItem] = useState<UnmatchedLedger | null>(null);
  const [followUpNote, setFollowUpNote] = useState('');
  const [loadingActions, setLoadingActions] = useState<Record<string, boolean>>({});
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  
  // Optimistic update state
  const [unmatchedCCItems, setUnmatchedCCItems] = useState<UnmatchedCC[]>([]);
  const [unmatchedLedgerItems, setUnmatchedLedgerItems] = useState<UnmatchedLedger[]>([]);
  const [resolvedItems, setResolvedItems] = useState<ResolvedItem[]>([]);
  const [followUpItems, setFollowUpItems] = useState<FollowUpItem[]>([]);

  // Matching state
  const [showMatchDialog, setShowMatchDialog] = useState(false);
  const [selectedCCItemsForMatch, setSelectedCCItemsForMatch] = useState<UnmatchedCC[]>([]);
  const [selectedLedgerItemsForMatch, setSelectedLedgerItemsForMatch] = useState<UnmatchedLedger[]>([]);

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
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/cc-rec/reconciliation?companyId=${companyId}&period=${period}`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        console.log('CC Reconciliation data loaded:', data);
        const recData = data.reconciliation || data;
        
        // Convert matched_pairs to pre_matched_items if needed
        if (recData.matched_pairs && (!recData.pre_matched_items || recData.pre_matched_items.length === 0)) {
          console.log('Converting matched_pairs to pre_matched_items...');
          recData.pre_matched_items = recData.matched_pairs.map((pair: any, index: number) => ({
            matchGroupId: `cc-match-${Date.now()}-${index}`,
            ccTransactions: Array.isArray(pair.cc_transaction) ? pair.cc_transaction : [pair.cc_transaction],
            ledgerEntries: Array.isArray(pair.ledger_entries) ? pair.ledger_entries : [pair.ledger_entries],
            matchedAt: recData.reconciled_at || new Date().toISOString(),
            confidence: pair.match_confidence || 100,
            matchType: pair.match_type || 'exact',
            explanation: pair.explanation || 'Matched by AI'
          }));
        }
        
        setReconciliationResult(recData);
        
        // Initialize optimistic update state
        setUnmatchedCCItems(recData.unmatched_cc || []);
        setUnmatchedLedgerItems(recData.unmatched_ledger || []);
        setResolvedItems(recData.resolved_items || []);
        setFollowUpItems(recData.follow_up_items || []);
      } else if (response.status === 404) {
        console.log('No CC reconciliation found for this period (not yet run)');
        setReconciliationResult(null);
      } else {
        const errorText = await response.text();
        console.error('Failed to load CC reconciliation data:', response.status, errorText);
        setReconciliationResult(null);
      }
    } catch (error) {
      console.error('Failed to load CC reconciliation data:', error);
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

  const getPeriodLabel = (periodValue: string) => {
    const [year, month] = periodValue.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  // Helper function to get amount from ledger entry (supports both amount and debit/credit fields)
  const getLedgerAmount = (entry: LedgerEntry): number => {
    // For CC reconciliation, ledger entries have debit/credit fields
    if (entry.debit !== undefined) {
      return entry.debit || 0;
    }
    // Fallback to amount field for backwards compatibility
    return entry.amount || 0;
  };

  // Helper function to get description from ledger entry (supports both description and vendor fields)
  const getLedgerDescription = (entry: LedgerEntry): string => {
    // For CC reconciliation, ledger entries have vendor field as primary description
    if (entry.vendor) {
      return entry.vendor;
    }
    // Fallback to description field for backwards compatibility
    return entry.description || 'No description';
  };

  const handleEditTransaction = (item: UnmatchedCC | UnmatchedLedger, type: 'cc' | 'ledger') => {
    if (type === 'cc') {
      setEditingItem({...(item as UnmatchedCC).transaction});
      setSelectedCCItem(item as UnmatchedCC);
      setSelectedLedgerItem(null);
    } else {
      setEditingItem({...(item as UnmatchedLedger).entry});
      setSelectedLedgerItem(item as UnmatchedLedger);
      setSelectedCCItem(null);
    }
    setEditingType(type);
    setShowEditDialog(true);
  };

  const handleSaveEdit = async () => {
    if (!editingItem) return;

    // Optimistic update
    if (editingType === 'cc' && editingItem) {
      setUnmatchedCCItems(prev => prev.map(item => 
        item.transaction.id === editingItem.id 
          ? { ...item, transaction: { ...item.transaction, ...editingItem } }
          : item
      ));
    } else if (editingType === 'ledger' && editingItem) {
      setUnmatchedLedgerItems(prev => prev.map(item => 
        item.entry.id === editingItem.id 
          ? { ...item, entry: { ...item.entry, ...editingItem } }
          : item
      ));
    }
    
    setShowEditDialog(false);
    toast.success('Transaction updated successfully!');
  };

  const handleApproveForJE = async (item: UnmatchedCC | UnmatchedLedger, type: 'cc' | 'ledger') => {
    const itemId = type === 'cc' ? (item as UnmatchedCC).transaction.id : (item as UnmatchedLedger).entry.id;
    const actionKey = `approve-${type}-${itemId}`;
    setLoadingActions(prev => ({ ...prev, [actionKey]: true }));
    
    // Optimistic update - remove from unmatched immediately and add to resolved
    if (type === 'cc') {
      setUnmatchedCCItems(prev => prev.filter(i => i.transaction.id !== itemId));
      setResolvedItems(prev => [...prev, {
        type: 'cc' as const,
        item: item as UnmatchedCC,
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
            source: 'cc-rec' // Add source identifier for CC reconciliation
          }),
        }
      );

      if (response.ok) {
        console.log('CC transaction approved for AI journal entry generation');
        toast.success('Transaction approved! AI will generate a suggested journal entry in the Draft/Suggested tab.');
      } else {
        const errorText = await response.text();
        console.error('Failed to approve CC transaction:', response.status, errorText);
        toast.error('Failed to approve transaction. Please try again.');
        
        // Revert optimistic update on error - reload data from backend
        await loadReconciliationData();
      }
    } catch (error) {
      console.error('Error approving CC transaction:', error);
      toast.error('Network error. Please check your connection and try again.');
      
      // Revert optimistic update on error - reload data from backend
      await loadReconciliationData();
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
        console.log('Ledger entry marked for reversal');
        toast.success('Reversing JE sent to Journal Entries section!');
      } else {
        const errorText = await response.text();
        console.error('Failed to reverse ledger entry:', response.status, errorText);
        toast.error('Failed to reverse entry. Please try again.');
        
        // Revert optimistic update on error
        await loadReconciliationData();
      }
    } catch (error) {
      console.error('Error reversing ledger entry:', error);
      toast.error('Network error. Please check your connection and try again.');
      
      // Revert optimistic update on error
      await loadReconciliationData();
    } finally {
      setLoadingActions(prev => ({ ...prev, [actionKey]: false }));
    }
  };

  const handleOpenFollowUpDialog = (item: UnmatchedCC | UnmatchedLedger, type: 'cc' | 'ledger') => {
    if (type === 'cc') {
      setSelectedCCItem(item as UnmatchedCC);
      setSelectedLedgerItem(null);
    } else {
      setSelectedLedgerItem(item as UnmatchedLedger);
      setSelectedCCItem(null);
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

    const item = selectedCCItem || selectedLedgerItem;
    const type = editingType;
    const itemId = type === 'cc' ? (item as UnmatchedCC)?.transaction.id : (item as UnmatchedLedger)?.entry.id;

    // Optimistic update
    if (type === 'cc' && item) {
      setUnmatchedCCItems(prev => prev.filter(i => i.transaction.id !== itemId));
      setFollowUpItems(prev => [...prev, {
        item: item as UnmatchedCC,
        type: 'cc',
        note: followUpNote,
        markedAt: new Date().toISOString()
      }]);
    } else if (type === 'ledger' && item) {
      setUnmatchedLedgerItems(prev => prev.filter(i => i.entry.id !== itemId));
      setFollowUpItems(prev => [...prev, {
        item: item as UnmatchedLedger,
        type: 'ledger',
        note: followUpNote,
        markedAt: new Date().toISOString()
      }]);
    }

    setShowFollowUpDialog(false);
    
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/cc-rec/request-information`,
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
        toast.success('Item added to Follow-Up. You can provide more information later.');
      } else {
        toast.error('Failed to save follow-up item.');
        // Revert optimistic update
        await loadReconciliationData();
      }
    } catch (error) {
      console.error('Failed to request information:', error);
      toast.error('Failed to save follow-up item.');
      // Revert optimistic update
      await loadReconciliationData();
    }
  };

  const handleMarkAsTimingDifference = async (item: UnmatchedCC | UnmatchedLedger, type: 'cc' | 'ledger') => {
    const itemId = type === 'cc' ? (item as UnmatchedCC).transaction.id : (item as UnmatchedLedger).entry.id;
    const actionKey = `timing-${type}-${itemId}`;
    setLoadingActions(prev => ({ ...prev, [actionKey]: true }));
    
    // Optimistic update
    if (type === 'cc') {
      setUnmatchedCCItems(prev => prev.filter(i => i.transaction.id !== itemId));
      setResolvedItems(prev => [...prev, {
        type: 'cc',
        item: item as UnmatchedCC,
        markedAt: new Date().toISOString(),
        status: 'timing_difference',
        resolution: 'Will clear next period',
        matchGroupId: `timing-${itemId}`
      }]);
    } else {
      setUnmatchedLedgerItems(prev => prev.filter(i => i.entry.id !== itemId));
      setResolvedItems(prev => [...prev, {
        type: 'ledger',
        item: item as UnmatchedLedger,
        markedAt: new Date().toISOString(),
        status: 'timing_difference',
        resolution: 'Will clear next period',
        matchGroupId: `timing-${itemId}`
      }]);
    }
    
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/cc-rec/mark-timing-difference`,
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
        if (type === 'cc') {
          setUnmatchedCCItems(prev => [...prev, item as UnmatchedCC]);
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
      if (type === 'cc') {
        setUnmatchedCCItems(prev => [...prev, item as UnmatchedCC]);
        setResolvedItems(prev => prev.filter(r => r.matchGroupId !== `timing-${itemId}`));
      } else {
        setUnmatchedLedgerItems(prev => [...prev, item as UnmatchedLedger]);
        setResolvedItems(prev => prev.filter(r => r.matchGroupId !== `timing-${itemId}`));
      }
    } finally {
      setLoadingActions(prev => ({ ...prev, [actionKey]: false }));
    }
  };

  const handleMarkAsIgnored = async (item: UnmatchedCC | UnmatchedLedger, type: 'cc' | 'ledger') => {
    const itemId = type === 'cc' ? (item as UnmatchedCC).transaction.id : (item as UnmatchedLedger).entry.id;
    const actionKey = `ignore-${type}-${itemId}`;
    setLoadingActions(prev => ({ ...prev, [actionKey]: true }));
    
    // Optimistic update
    if (type === 'cc') {
      setUnmatchedCCItems(prev => prev.filter(i => i.transaction.id !== itemId));
      setResolvedItems(prev => [...prev, {
        type: 'cc',
        item: item as UnmatchedCC,
        markedAt: new Date().toISOString(),
        status: 'ignored',
        resolution: 'Marked as non-issue',
        matchGroupId: `ignored-${itemId}`
      }]);
    } else {
      setUnmatchedLedgerItems(prev => prev.filter(i => i.entry.id !== itemId));
      setResolvedItems(prev => [...prev, {
        type: 'ledger',
        item: item as UnmatchedLedger,
        markedAt: new Date().toISOString(),
        status: 'ignored',
        resolution: 'Marked as non-issue',
        matchGroupId: `ignored-${itemId}`
      }]);
    }
    
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/cc-rec/mark-ignored`,
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
        if (type === 'cc') {
          setUnmatchedCCItems(prev => [...prev, item as UnmatchedCC]);
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
      if (type === 'cc') {
        setUnmatchedCCItems(prev => [...prev, item as UnmatchedCC]);
        setResolvedItems(prev => prev.filter(r => r.matchGroupId !== `ignored-${itemId}`));
      } else {
        setUnmatchedLedgerItems(prev => [...prev, item as UnmatchedLedger]);
        setResolvedItems(prev => prev.filter(r => r.matchGroupId !== `ignored-${itemId}`));
      }
    } finally {
      setLoadingActions(prev => ({ ...prev, [actionKey]: false }));
    }
  };

  const handleReverseResolved = async (resolvedItem: ResolvedItem) => {
    const matchGroupId = resolvedItem.matchGroupId;
    
    if (matchGroupId) {
      // This is part of a match group - unmatch the entire group
      const groupItems = resolvedItems.filter(r => r.matchGroupId === matchGroupId);
      
      // Remove all items in the group from resolved
      setResolvedItems(prev => prev.filter(r => r.matchGroupId !== matchGroupId));
      
      // Restore all items to unmatched
      groupItems.forEach(item => {
        if (item.type === 'cc') {
          setUnmatchedCCItems(prev => [...prev, item.item as UnmatchedCC]);
        } else {
          setUnmatchedLedgerItems(prev => [...prev, item.item as UnmatchedLedger]);
        }
      });
      
      toast.success('Match group unmatched. All items restored to Needs Attention.');
    } else {
      // Single item - just move it back
      setResolvedItems(prev => prev.filter(r => r !== resolvedItem));
      
      if (resolvedItem.type === 'cc') {
        setUnmatchedCCItems(prev => [...prev, resolvedItem.item as UnmatchedCC]);
      } else {
        setUnmatchedLedgerItems(prev => [...prev, resolvedItem.item as UnmatchedLedger]);
      }
      
      toast.success('Item moved back to Needs Attention.');
    }
  };

  const handleReverseFollowUp = async (followUpItem: FollowUpItem) => {
    // Optimistic update - move from follow-up back to unmatched
    setFollowUpItems(prev => prev.filter(f => f !== followUpItem));
    
    if (followUpItem.type === 'cc') {
      setUnmatchedCCItems(prev => [...prev, followUpItem.item as UnmatchedCC]);
    } else {
      setUnmatchedLedgerItems(prev => [...prev, followUpItem.item as UnmatchedLedger]);
    }
    
    toast.success('Item moved back to Needs Attention.');
  };

  const handleUnmatchGroup = async (matchGroup: PreMatchedItem) => {
    const actionKey = `unmatch-${matchGroup.matchGroupId}`;
    setLoadingActions(prev => ({ ...prev, [actionKey]: true }));
    
    // Optimistically remove from pre-matched items and add to unmatched
    setReconciliationResult(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        pre_matched_items: prev.pre_matched_items?.filter(g => g.matchGroupId !== matchGroup.matchGroupId) || [],
      };
    });
    
    // Create unmatched items from the match group
    const unmatchedCCs: UnmatchedCC[] = matchGroup.ccTransactions.map(transaction => ({
      transaction,
      suggested_action: 'Review this unmatched CC transaction',
    }));
    
    const unmatchedLedgers: UnmatchedLedger[] = matchGroup.ledgerEntries.map(entry => ({
      entry,
      reason: 'Previously matched, now unmatched',
      action: 'Review and re-match if needed'
    }));
    
    setUnmatchedCCItems(prev => [...prev, ...unmatchedCCs]);
    setUnmatchedLedgerItems(prev => [...prev, ...unmatchedLedgers]);
    
    toast.success(`Unmatched group with ${matchGroup.ccTransactions.length} CC transaction(s) and ${matchGroup.ledgerEntries.length} ledger entry(ies).`);
    setLoadingActions(prev => ({ ...prev, [actionKey]: false }));
  };

  // Matching functions
  const handleOpenMatchDialog = (item: UnmatchedCC) => {
    setSelectedCCItemsForMatch([item]);
    setSelectedLedgerItemsForMatch([]);
    setShowMatchDialog(true);
  };

  const toggleCCSelection = (item: UnmatchedCC) => {
    setSelectedCCItemsForMatch(prev => {
      const isSelected = prev.some(i => i.transaction.id === item.transaction.id);
      if (isSelected) {
        return prev.filter(i => i.transaction.id !== item.transaction.id);
      } else {
        return [...prev, item];
      }
    });
  };

  const toggleLedgerSelection = (item: UnmatchedLedger) => {
    setSelectedLedgerItemsForMatch(prev => {
      const isSelected = prev.some(i => i.entry.id === item.entry.id);
      if (isSelected) {
        return prev.filter(i => i.entry.id !== item.entry.id);
      } else {
        return [...prev, item];
      }
    });
  };

  const getTotalCCAmount = () => {
    return selectedCCItemsForMatch.reduce((sum, item) => sum + item.transaction.amount, 0);
  };

  const getTotalLedgerAmount = () => {
    return selectedLedgerItemsForMatch.reduce((sum, item) => sum + getLedgerAmount(item.entry), 0);
  };

  // Group resolved items by matchGroupId
  const groupResolvedItems = () => {
    if (!resolvedItems) return [];
    
    console.log('groupResolvedItems - All resolved items:', resolvedItems);
    
    const groups = new Map<string, ResolvedItem[]>();
    
    resolvedItems
      .filter(item => item && item.item) // Filter out invalid items
      .forEach(item => {
        const groupId = item.matchGroupId || `single-${item.markedAt}`;
        console.log(`Item with matchGroupId: ${item.matchGroupId}, status: ${item.status}, groupId: ${groupId}`);
        if (!groups.has(groupId)) {
          groups.set(groupId, []);
        }
        groups.get(groupId)!.push(item);
      });
    
    const result = Array.from(groups.entries()).map(([groupId, items]) => ({
      groupId,
      items,
    }));
    
    console.log('groupResolvedItems - Grouped result:', result);
    return result;
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

  const handleMatchItems = async () => {
    const ccItems = selectedCCItemsForMatch;
    const ledgerItems = selectedLedgerItemsForMatch;
    const matchGroupId = `match-${Date.now()}`;

    // Optimistic update - remove from unmatched
    setUnmatchedCCItems(prev => prev.filter(i => !ccItems.some(cc => cc.transaction.id === i.transaction.id)));
    setUnmatchedLedgerItems(prev => prev.filter(i => !ledgerItems.some(l => l.entry.id === i.entry.id)));

    // Add to resolved items with matchGroupId (NOT to pre-matched - manual matches go directly to resolved)
    const newResolvedItems: ResolvedItem[] = [];
    ccItems.forEach(item => {
      newResolvedItems.push({
        type: 'cc' as const,
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
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/cc-rec/match-items`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            companyId,
            period,
            ccItems: ccItems.map(i => i.transaction),
            ledgerItems: ledgerItems.map(i => i.entry),
          }),
        }
      );

      if (response.ok) {
        toast.success(`Successfully matched ${ccItems.length} CC transaction(s) with ${ledgerItems.length} ledger entry(ies)!`);
        setShowMatchDialog(false);
        setSelectedCCItemsForMatch([]);
        setSelectedLedgerItemsForMatch([]);
      } else {
        toast.error('Failed to match items.');
        // Revert optimistic update
        setUnmatchedCCItems(prev => [...prev, ...ccItems]);
        setUnmatchedLedgerItems(prev => [...prev, ...ledgerItems]);
        setResolvedItems(prev => prev.filter(r => !newResolvedItems.includes(r)));
      }
    } catch (error) {
      console.error('Failed to match items:', error);
      toast.error('Failed to match items.');
      // Revert optimistic update
      setUnmatchedCCItems(prev => [...prev, ...ccItems]);
      setUnmatchedLedgerItems(prev => [...prev, ...ledgerItems]);
      setResolvedItems(prev => prev.filter(r => !newResolvedItems.includes(r)));
    }
  };

  if (isLoadingReconciliation) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Loader2 className="size-8 text-gray-400 animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">Loading CC reconciliation data...</p>
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
            No CC reconciliation found for {companyName} - {getPeriodLabel(period)}. 
            Please run a credit card reconciliation first.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const needsAttentionCount = (unmatchedCCItems?.length || 0) + (unmatchedLedgerItems?.length || 0);
  const followUpCount = followUpItems?.length || 0;
  const resolvedCount = resolvedItems?.length || 0;
  const preMatchedCount = reconciliationResult?.pre_matched_items?.filter(m => m.matchType !== 'manual').length || 0;

  return (
    <div className="space-y-6">
      <Toaster position="bottom-right" />
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button type="button" variant="ghost" onClick={onBack} className="gap-2">
            <ArrowLeft className="size-4" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl text-gray-900">Review CC Reconciliation</h1>
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
            <div className="text-2xl text-blue-600">{preMatchedCount}</div>
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
            {preMatchedCount > 0 && (
              <Badge variant="outline" className="ml-1 bg-blue-50 text-blue-700 border-blue-200">
                {preMatchedCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Needs Attention */}
        <TabsContent value="needs-attention" className="space-y-6">
          {/* Unmatched CC Transactions */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="size-5 text-red-600" />
                    Unmatched Credit Card Transactions
                  </CardTitle>
                  <CardDescription className="mt-2">
                    These transactions appear in credit card statements but have no matching ledger entries.
                  </CardDescription>
                </div>
                <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                  {unmatchedCCItems.length} items
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {unmatchedCCItems && unmatchedCCItems.length > 0 ? (
                <div className="space-y-3">
                  {unmatchedCCItems.map((item, idx) => (
                    <div key={idx} className="p-4 bg-red-50 rounded-lg">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-gray-900">{item.transaction.description}</span>
                            <span className="text-xs text-gray-500">{item.transaction.date}</span>
                          </div>
                          {item.transaction.merchant && (
                            <p className="text-xs text-gray-600">Merchant: {item.transaction.merchant}</p>
                          )}
                          <p className="text-xs text-gray-600 mt-1">
                            Suggested Action: {item.suggested_action}
                          </p>
                        </div>
                        <div className="ml-4">
                          <div className={`text-2xl font-medium ${item.transaction.amount < 0 ? 'text-red-600' : 'text-green-600'}`}>
                            €{formatCurrency(Math.abs(item.transaction.amount))}
                          </div>
                        </div>
                      </div>
                      
                      {/* Action Buttons */}
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          className="gap-1 bg-green-600 hover:bg-green-700 text-white"
                          onClick={() => handleApproveForJE(item, 'cc')}
                          disabled={isMonthLocked}
                        >
                          <ThumbsUp className="size-3.5" />
                          Approve for JE
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1 bg-white"
                          onClick={() => handleOpenMatchDialog(item)}
                          disabled={isMonthLocked}
                        >
                          <Link className="size-3.5" />
                          Match
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1 bg-white"
                          onClick={() => handleEditTransaction(item, 'cc')}
                          disabled={isMonthLocked}
                        >
                          <Edit2 className="size-3.5" />
                          Edit / Correct
                        </Button>
                        <DropdownMenu modal={false}>
                          <DropdownMenuTrigger asChild>
                            <Button size="sm" variant="outline" className="gap-1 bg-white" disabled={isMonthLocked}>
                              More Actions
                              <ChevronDown className="size-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleOpenFollowUpDialog(item, 'cc')}>
                              <MessageSquare className="size-4 mr-2" />
                              Request Information
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleMarkAsTimingDifference(item, 'cc')}>
                              <Clock className="size-4 mr-2" />
                              Mark as Timing Difference
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleMarkAsIgnored(item, 'cc')}>
                              <EyeOff className="size-4 mr-2" />
                              Mark as Non-Issue
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
                  <p className="text-sm text-gray-600">All credit card transactions have been matched!</p>
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
                    These entries appear in the general ledger but have no matching credit card transactions.
                  </CardDescription>
                </div>
                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                  {unmatchedLedgerItems.length} items
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
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-gray-900">{getLedgerDescription(item.entry)}</span>
                            <span className="text-xs text-gray-500">{item.entry.date}</span>
                          </div>
                          <p className="text-xs text-gray-600">
                            Suggested Action: {item.action}
                          </p>
                          {(item.entry.glAccount || item.entry.account) && (
                            <p className="text-xs text-gray-600">
                              Account: {item.entry.glAccount || item.entry.account}
                            </p>
                          )}
                        </div>
                        <div className="ml-4">
                          <div className={`text-2xl font-medium ${getLedgerAmount(item.entry) < 0 ? 'text-green-600' : 'text-red-600'}`}>
                            €{formatCurrency(Math.abs(getLedgerAmount(item.entry)))}
                          </div>
                        </div>
                      </div>
                      
                      {/* Action Buttons */}
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1 bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-200"
                          onClick={() => handleReverseJE(item)}
                          disabled={isMonthLocked || loadingActions[`reverse-ledger-${item.entry.id}`]}
                        >
                          {loadingActions[`reverse-ledger-${item.entry.id}`] ? (
                            <>
                              <Loader2 className="size-3.5 animate-spin" />
                              Processing...
                            </>
                          ) : (
                            <>
                              <Undo2 className="size-3.5" />
                              Reverse JE
                            </>
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1 bg-white"
                          onClick={() => handleOpenMatchDialog(item)}
                          disabled={isMonthLocked}
                        >
                          <Link className="size-3.5" />
                          Match
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1 bg-white"
                          onClick={() => handleEditTransaction(item, 'ledger')}
                          disabled={isMonthLocked}
                        >
                          <Edit2 className="size-3.5" />
                          Edit / Correct
                        </Button>
                        <DropdownMenu modal={false}>
                          <DropdownMenuTrigger asChild>
                            <Button size="sm" variant="outline" className="gap-1 bg-white" disabled={isMonthLocked}>
                              More Actions
                              <ChevronDown className="size-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleOpenFollowUpDialog(item, 'ledger')}>
                              <MessageSquare className="size-4 mr-2" />
                              Request Information
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleMarkAsTimingDifference(item, 'ledger')}>
                              <Clock className="size-4 mr-2" />
                              Mark as Timing Difference
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleMarkAsIgnored(item, 'ledger')}>
                              <EyeOff className="size-4 mr-2" />
                              Mark as Non-Issue
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
        <TabsContent value="follow-up" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="size-5 text-purple-600" />
                Items Awaiting Information
              </CardTitle>
              <CardDescription className="mt-2">
                These items require additional information from your team before they can be resolved.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {followUpItems && followUpItems.length > 0 ? (
                <div className="space-y-3">
                  {followUpItems.map((followUpItem, idx) => {
                    const item = followUpItem.item;
                    const isCC = followUpItem.type === 'cc';
                    const transaction = isCC ? (item as UnmatchedCC).transaction : (item as UnmatchedLedger).entry;
                    
                    return (
                      <div key={idx} className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-gray-900">{transaction.description}</span>
                              <span className="text-xs text-gray-500">{transaction.date}</span>
                              <Badge variant="outline" className="bg-purple-100 text-purple-700 border-purple-300 text-xs">
                                {isCC ? 'CC Transaction' : 'Ledger Entry'}
                              </Badge>
                            </div>
                            <p className="text-xs text-gray-600 mt-2">
                              <span className="font-medium">Follow-up Note:</span> {followUpItem.note}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              Added on {new Date(followUpItem.markedAt).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="ml-4">
                            <div className="text-lg font-medium text-gray-900">
                              €{formatCurrency(Math.abs(transaction.amount))}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2 pt-3 border-t border-purple-200">
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1"
                            onClick={() => handleReverseFollowUp(followUpItem)}
                            disabled={isMonthLocked}
                          >
                            <Undo2 className="size-3.5" />
                            Move Back to Needs Attention
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8">
                  <MessageSquare className="size-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-sm text-gray-600">No items waiting for follow-up.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Resolved / Completed */}
        <TabsContent value="resolved" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="size-5 text-green-600" />
                Resolved Items
              </CardTitle>
              <CardDescription className="mt-2">
                These items have been resolved and no longer require attention.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {resolvedItems && resolvedItems.length > 0 ? (
                <div className="space-y-3">
                  {groupResolvedItems().map((group, groupIdx) => {
                    const { groupId, items } = group;
                    const isExpanded = expandedGroups.has(groupId);
                    const isMatchGroup = items[0]?.matchGroupId && items[0]?.status === 'matched';
                    
                    // Calculate totals for the group
                    const ccItems = items.filter(i => i && i.item && i.type === 'cc');
                    const ledgerItems = items.filter(i => i && i.item && i.type === 'ledger');
                    const ccTotal = ccItems.reduce((sum, item) => {
                      if (!item?.item) return sum;
                      const transaction = (item.item as UnmatchedCC)?.transaction;
                      if (!transaction) return sum;
                      return sum + Math.abs(transaction.amount);
                    }, 0);
                    const ledgerTotal = ledgerItems.reduce((sum, item) => {
                      if (!item?.item) return sum;
                      const entry = (item.item as UnmatchedLedger)?.entry;
                      if (!entry) return sum;
                      return sum + Math.abs(getLedgerAmount(entry));
                    }, 0);
                    
                    if (isMatchGroup) {
                      // Show grouped match - with detailed view
                      return (
                        <div key={groupIdx} className="p-4 bg-green-50 border border-green-200 rounded-lg">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <CheckCircle2 className="size-4 text-green-600" />
                                <Badge variant="outline" className="text-xs bg-green-100 text-green-700 border-green-300">
                                  Matched Group
                                </Badge>
                                <span className="text-xs text-gray-500">
                                  {items[0].markedAt && new Date(items[0].markedAt).toLocaleDateString()}
                                </span>
                              </div>
                              <div className="text-sm text-gray-900">
                                <strong>{ccItems.length}</strong> CC transaction(s) matched with <strong>{ledgerItems.length}</strong> ledger entry(ies)
                              </div>
                              <div className="flex items-center gap-4 mt-2 text-xs">
                                <span className="text-red-600">CC Total: €{formatCurrency(ccTotal)}</span>
                                <span className="text-amber-600">Ledger Total: €{formatCurrency(ledgerTotal)}</span>
                                {Math.abs(ccTotal - ledgerTotal) < 0.01 && (
                                  <Badge className="bg-green-600 text-white">Perfect Match</Badge>
                                )}
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => toggleGroupExpansion(groupId)}
                              className="gap-1"
                            >
                              {isExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                              {isExpanded ? 'Collapse' : 'Expand'}
                            </Button>
                          </div>

                          {isExpanded && (
                            <div className="mt-4 grid grid-cols-2 gap-4 pt-4 border-t border-green-300">
                              {/* CC Transactions */}
                              <div>
                                <h4 className="text-xs font-medium text-gray-700 mb-2 flex items-center gap-1">
                                  <CreditCard className="size-3 text-red-600" />
                                  CC Transactions
                                </h4>
                                <div className="space-y-2">
                                  {ccItems.map((item, idx) => {
                                    const transaction = (item.item as UnmatchedCC).transaction;
                                    return (
                                      <div key={idx} className="p-2 bg-white rounded border border-red-200">
                                        <div className="flex items-center justify-between">
                                          <span className="text-xs font-medium">{transaction.description}</span>
                                          <span className="text-xs text-red-600 font-medium">
                                            €{formatCurrency(Math.abs(transaction.amount))}
                                          </span>
                                        </div>
                                        <div className="text-xs text-gray-500 mt-1">{transaction.date}</div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>

                              {/* Ledger Entries */}
                              <div>
                                <h4 className="text-xs font-medium text-gray-700 mb-2 flex items-center gap-1">
                                  <BookOpen className="size-3 text-amber-600" />
                                  Ledger Entries
                                </h4>
                                <div className="space-y-2">
                                  {ledgerItems.map((item, idx) => {
                                    const entry = (item.item as UnmatchedLedger).entry;
                                    return (
                                      <div key={idx} className="p-2 bg-white rounded border border-amber-200">
                                        <div className="flex items-center justify-between">
                                          <span className="text-xs font-medium">{getLedgerDescription(entry)}</span>
                                          <span className="text-xs text-amber-600 font-medium">
                                            €{formatCurrency(Math.abs(getLedgerAmount(entry)))}
                                          </span>
                                        </div>
                                        <div className="text-xs text-gray-500 mt-1">{entry.date}</div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          )}

                          <div className="flex items-center gap-2 pt-3 border-t border-green-300 mt-3">
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1"
                              onClick={() => handleReverseResolved(items[0])}
                              disabled={isMonthLocked}
                            >
                              <Undo2 className="size-3.5" />
                              Unmatch & Restore
                            </Button>
                          </div>
                        </div>
                      );
                    } else {
                      // Single item (not part of a match group)
                      const resolvedItem = items[0];
                      const item = resolvedItem.item;
                      const isCC = resolvedItem.type === 'cc';
                      const transaction = isCC ? (item as UnmatchedCC).transaction : (item as UnmatchedLedger).entry;
                      
                      const bgColor = resolvedItem.status === 'timing_difference' ? 'bg-blue-50' : 
                                     resolvedItem.status === 'ignored' ? 'bg-gray-50' : 'bg-green-50';
                      const borderColor = resolvedItem.status === 'timing_difference' ? 'border-blue-200' : 
                                         resolvedItem.status === 'ignored' ? 'border-gray-200' : 'border-green-200';
                      
                      return (
                        <div key={groupIdx} className={`p-4 ${bgColor} border ${borderColor} rounded-lg`}>
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium text-gray-900">{transaction.description}</span>
                                <span className="text-xs text-gray-500">{transaction.date}</span>
                                <Badge variant="outline" className="text-xs">
                                  {resolvedItem.status.replace('_', ' ')}
                                </Badge>
                              </div>
                              <p className="text-xs text-gray-600 mt-1">
                                <span className="font-medium">Resolution:</span> {resolvedItem.resolution}
                              </p>
                              <p className="text-xs text-gray-500 mt-1">
                                Resolved on {new Date(resolvedItem.markedAt).toLocaleDateString()}
                              </p>
                            </div>
                            <div className="ml-4">
                              <div className="text-lg font-medium text-gray-900">
                                €{formatCurrency(Math.abs(transaction.amount))}
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2 pt-3 border-t border-gray-200">
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1"
                              onClick={() => handleReverseResolved(resolvedItem)}
                              disabled={isMonthLocked}
                            >
                              <Undo2 className="size-3.5" />
                              Undo Resolution
                            </Button>
                          </div>
                        </div>
                      );
                    }
                  })}
                </div>
              ) : (
                <div className="text-center py-8">
                  <CheckCircle2 className="size-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-sm text-gray-600">No resolved items yet.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 4: Pre-Matched */}
        <TabsContent value="pre-matched" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Link className="size-5 text-blue-600" />
                Pre-Matched Groups
              </CardTitle>
              <CardDescription className="mt-2">
                These transactions were automatically matched by our AI during reconciliation.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {reconciliationResult?.pre_matched_items && reconciliationResult.pre_matched_items.filter(m => m.matchType !== 'manual').length > 0 ? (
                <div className="space-y-4">
                  {reconciliationResult.pre_matched_items
                    .filter(matchGroup => matchGroup.matchType !== 'manual') // Exclude manual matches - they go to Resolved tab
                    .map((matchGroup, idx) => {
                    const isExpanded = expandedGroups.has(matchGroup.matchGroupId);
                    const ccTotal = matchGroup.ccTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
                    const ledgerTotal = matchGroup.ledgerEntries.reduce((sum, e) => sum + Math.abs(getLedgerAmount(e)), 0);
                    
                    return (
                      <div key={idx} className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        {/* Header with expand/collapse */}
                        <div 
                          className="flex items-start justify-between mb-3 cursor-pointer"
                          onClick={() => {
                            const newExpanded = new Set(expandedGroups);
                            if (isExpanded) {
                              newExpanded.delete(matchGroup.matchGroupId);
                            } else {
                              newExpanded.add(matchGroup.matchGroupId);
                            }
                            setExpandedGroups(newExpanded);
                          }}
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              {isExpanded ? (
                                <ChevronUp className="size-4 text-blue-600" />
                              ) : (
                                <ChevronDown className="size-4 text-blue-600" />
                              )}
                              <CheckCircle2 className="size-4 text-blue-600" />
                              <Badge variant="outline" className="text-xs bg-blue-100 text-blue-700 border-blue-300">
                                {matchGroup.matchType || 'Matched'}
                              </Badge>
                              <span className="text-sm font-medium text-gray-900">
                                {matchGroup.ccTransactions.length} CC ↔ {matchGroup.ledgerEntries.length} Ledger
                              </span>
                              <Badge variant="outline" className="text-xs">
                                {new Date(matchGroup.matchedAt).toLocaleDateString()}
                              </Badge>
                              {matchGroup.confidence && (
                                <Badge variant="outline" className="text-xs bg-green-50 text-green-700">
                                  {matchGroup.confidence}% confidence
                                </Badge>
                              )}
                            </div>
                            
                            {!isExpanded && matchGroup.explanation && (
                              <p className="text-xs text-gray-600 mt-1">{matchGroup.explanation}</p>
                            )}
                          </div>
                          <div className="ml-4">
                            <div className="text-lg font-medium text-blue-600">
                              €{formatCurrency(ccTotal)}
                            </div>
                          </div>
                        </div>

                        {/* Expanded Details */}
                        {isExpanded && (
                          <div className="mt-3">
                            <div className="text-xs bg-white border border-blue-200 rounded p-3 mb-3">
                              <div className="font-medium text-gray-900 mb-2">Match Summary:</div>
                              <div className="space-y-1 text-gray-600">
                                <p>CC Total: €{formatCurrency(ccTotal)}</p>
                                <p>Ledger Total: €{formatCurrency(ledgerTotal)}</p>
                                {matchGroup.explanation && (
                                  <p className="mt-2 text-blue-700">{matchGroup.explanation}</p>
                                )}
                              </div>
                            </div>

                            {/* CC Transactions */}
                            <div className="mt-3 space-y-2">
                              <div className="text-xs font-medium text-gray-700">Credit Card Transactions:</div>
                              {matchGroup.ccTransactions.map((transaction, tIdx) => (
                                <div key={tIdx} className="p-2 bg-white border border-blue-200 rounded text-xs">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700">
                                        CC
                                      </Badge>
                                      <span className="text-gray-900">{transaction.description}</span>
                                      <span className="text-gray-500">{transaction.date}</span>
                                      {transaction.merchant && (
                                        <span className="text-gray-400">• {transaction.merchant}</span>
                                      )}
                                    </div>
                                    <span className={`font-medium ${transaction.amount >= 0 ? 'text-red-600' : 'text-green-600'}`}>
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
                                      {entry.account && (
                                        <span className="text-gray-400">• {entry.account}</span>
                                      )}
                                    </div>
                                    <span className={`font-medium ${getLedgerAmount(entry) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                      €{formatCurrency(Math.abs(getLedgerAmount(entry)))}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>

                            {/* Unmatch Button */}
                            <div className="flex gap-2 pt-3 mt-3 border-t border-blue-200">
                              <Button 
                                type="button"
                                size="sm" 
                                variant="outline"
                                className="gap-2 bg-red-50 hover:bg-red-100 text-red-700 border-red-200"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleUnmatchGroup(matchGroup);
                                }}
                                disabled={loadingActions[`unmatch-${matchGroup.matchGroupId}`]}
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
                        )}
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

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Transaction</DialogTitle>
            <DialogDescription>
              Make corrections to the transaction details below.
            </DialogDescription>
          </DialogHeader>
          {editingItem && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-date">Date</Label>
                <Input
                  id="edit-date"
                  type="date"
                  value={editingItem.date || ''}
                  disabled
                  className="bg-gray-50 cursor-not-allowed"
                />
              </div>
              <div>
                <Label htmlFor="edit-description">Description</Label>
                <Input
                  id="edit-description"
                  value={editingItem.description || ''}
                  onChange={(e) => setEditingItem({ ...editingItem, description: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit-amount">Amount</Label>
                <Input
                  id="edit-amount"
                  type="number"
                  step="0.01"
                  value={editingItem.amount || ''}
                  disabled
                  className="bg-gray-50 cursor-not-allowed"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit}>
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
                  Credit card statement clarification
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
              Select one or more CC transactions and one or more ledger entries to match them together. Supports many-to-many matching.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto">
            <div className="grid grid-cols-2 gap-6">
              {/* CC Transactions Column */}
              <div className="space-y-3">
                <div className="sticky top-0 bg-white pb-3 border-b border-gray-200 z-10">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-gray-900 flex items-center gap-2">
                      <CreditCard className="size-4 text-red-600" />
                      CC Transactions
                    </h3>
                    <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                      {selectedCCItemsForMatch.length} selected
                    </Badge>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded p-3">
                    <div className="text-sm font-medium text-blue-900">Selected Total:</div>
                    <div className={`text-2xl font-medium ${getTotalCCAmount() < 0 ? 'text-red-600' : 'text-green-600'}`}>
                      €{formatCurrency(Math.abs(getTotalCCAmount()))}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  {unmatchedCCItems && unmatchedCCItems.map((item, idx) => {
                    const isSelected = selectedCCItemsForMatch.some(i => i.transaction.id === item.transaction.id);
                    return (
                      <div 
                        key={idx} 
                        className={`p-3 rounded-lg border-2 transition-all cursor-pointer ${
                          isSelected 
                            ? 'bg-blue-100 border-blue-500 shadow-md' 
                            : 'bg-red-50 border-red-200 hover:border-red-400'
                        }`}
                        onClick={() => toggleCCSelection(item)}
                      >
                        <div className="flex items-start gap-3">
                          <Checkbox 
                            checked={isSelected}
                            onCheckedChange={() => toggleCCSelection(item)}
                            className="mt-1"
                          />
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-medium text-gray-900">{item.transaction.description}</span>
                              <div className={`text-lg font-medium ${item.transaction.amount < 0 ? 'text-red-600' : 'text-green-600'}`}>
                                €{formatCurrency(Math.abs(item.transaction.amount))}
                              </div>
                            </div>
                            <div className="text-xs text-gray-600">{item.transaction.date}</div>
                            {item.transaction.merchant && (
                              <div className="text-xs text-gray-500">Merchant: {item.transaction.merchant}</div>
                            )}
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
                      {selectedLedgerItemsForMatch.length} selected
                    </Badge>
                  </div>
                  <div className="bg-purple-50 border border-purple-200 rounded p-3">
                    <div className="text-sm font-medium text-purple-900">Selected Total:</div>
                    <div className={`text-2xl font-medium ${getTotalLedgerAmount() < 0 ? 'text-green-600' : 'text-red-600'}`}>
                      €{formatCurrency(Math.abs(getTotalLedgerAmount()))}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  {unmatchedLedgerItems && unmatchedLedgerItems.map((item, idx) => {
                    const isSelected = selectedLedgerItemsForMatch.some(i => i.entry.id === item.entry.id);
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
                              <span className="text-sm font-medium text-gray-900">{getLedgerDescription(item.entry)}</span>
                              <div className={`text-lg font-medium ${getLedgerAmount(item.entry) < 0 ? 'text-green-600' : 'text-red-600'}`}>
                                €{formatCurrency(Math.abs(getLedgerAmount(item.entry)))}
                              </div>
                            </div>
                            <div className="text-xs text-gray-600">{item.entry.date}</div>
                            {(item.entry.glAccount || item.entry.account) && (
                              <div className="text-xs text-gray-500">Account: {item.entry.glAccount || item.entry.account}</div>
                            )}
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
          {(selectedCCItemsForMatch.length > 0 || selectedLedgerItemsForMatch.length > 0) && (
            <div className="border-t border-gray-200 pt-4">
              <div className={`p-4 rounded-lg border-2 ${
                Math.abs(getTotalCCAmount() - getTotalLedgerAmount()) < 0.01
                  ? 'bg-green-50 border-green-500'
                  : 'bg-yellow-50 border-yellow-500'
              }`}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-gray-900 mb-1">
                      {Math.abs(getTotalCCAmount() - getTotalLedgerAmount()) < 0.01 ? (
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
                      CC: €{formatCurrency(Math.abs(getTotalCCAmount()))} | 
                      Ledger: €{formatCurrency(Math.abs(getTotalLedgerAmount()))} | 
                      Diff: €{formatCurrency(Math.abs(getTotalCCAmount() - getTotalLedgerAmount()))}
                    </div>
                  </div>
                  <Button 
                    type="button"
                    className="gap-2 bg-green-600 hover:bg-green-700"
                    onClick={() => handleMatchItems()}
                    disabled={isMonthLocked || selectedCCItemsForMatch.length === 0 || selectedLedgerItemsForMatch.length === 0}
                  >
                    <Link className="size-4" />
                    Match {selectedCCItemsForMatch.length} CC ↔ {selectedLedgerItemsForMatch.length} Ledger
                  </Button>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => {
              setShowMatchDialog(false);
              setSelectedCCItemsForMatch([]);
              setSelectedLedgerItemsForMatch([]);
            }}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}