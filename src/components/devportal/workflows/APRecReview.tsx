import React, { useState, useEffect } from 'react';
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
  FileText,
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
import { toast, Toaster } from 'sonner';
import { formatCurrency, getCurrencySymbol } from '@/utils/currency';
import { UnmatchedItemCard } from './shared/ReconciliationItemCard';
import { ReconciliationMatchDialog, MatchItem } from './shared/ReconciliationMatchDialog';
import { ReconciliationFollowUpDialog } from './shared/ReconciliationFollowUpDialog';

interface APRecReviewProps {
  companyId: string;
  companyName: string;
  period: string;
  onBack: () => void;
}

interface VendorTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  balance?: number;
  statementId: string;
  statementName: string;
  invoiceNumber?: string;
  vendor?: string;
}

interface APEntry {
  id: string;
  date: string;
  description: string;
  amount: number;
  account?: string;
  reference?: string;
  vendor?: string;
}

interface UnmatchedVendor {
  transaction: VendorTransaction;
  suggested_action: string;
  suggested_je?: {
    description: string;
    debit_account: string;
    credit_account: string;
    amount: number;
  };
}

interface UnmatchedAP {
  entry: APEntry;
  reason: string;
  action: string;
}

interface ResolvedItem {
  type: 'vendor' | 'ap';
  item: UnmatchedVendor | UnmatchedAP;
  markedAt: string;
  status: string;
  resolution: string;
  matchGroupId?: string;
}

interface FollowUpItem {
  type: 'vendor' | 'ap';
  item: UnmatchedVendor | UnmatchedAP;
  note: string;
  markedAt: string;
  status?: string;
}

interface PreMatchedItem {
  matchGroupId: string;
  vendorTransactions: VendorTransaction[];
  apEntries: APEntry[];
  matchedAt: string;
  confidence?: number;
}

interface APReconciliationResult {
  unmatched_vendor: UnmatchedVendor[];
  unmatched_ap: UnmatchedAP[];
  summary: {
    total_vendor_transactions: number;
    total_ap_entries: number;
    matched_count: number;
    unmatched_vendor_count: number;
    unmatched_ap_count: number;
  };
  resolved_items: ResolvedItem[];
  follow_up_items: FollowUpItem[];
  timing_differences: any[];
  ignored_items: any[];
  pre_matched_items?: PreMatchedItem[];
  locked?: boolean;
}


export function APRecReview({ companyId, companyName, period, onBack }: APRecReviewProps) {
  const [activeTab, setActiveTab] = useState('needs-attention');
  const [isLoadingReconciliation, setIsLoadingReconciliation] = useState(true);
  const [reconciliationResult, setReconciliationResult] = useState<APReconciliationResult | null>(null);

  // Lists
  const [unmatchedVendorItems, setUnmatchedVendorItems] = useState<UnmatchedVendor[]>([]);
  const [unmatchedAPItems, setUnmatchedAPItems] = useState<UnmatchedAP[]>([]);
  const [resolvedItems, setResolvedItems] = useState<ResolvedItem[]>([]);
  const [followUpItems, setFollowUpItems] = useState<FollowUpItem[]>([]);

  // Counts


  // Lock State
  const [isMonthLocked, setIsMonthLocked] = useState(false);
  const [lockDetails, setLockDetails] = useState<any>(null);

  // Dialog States
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [editingType, setEditingType] = useState<'vendor' | 'ap'>('vendor');
  const [selectedVendorItem, setSelectedVendorItem] = useState<UnmatchedVendor | null>(null);
  const [selectedAPItem, setSelectedAPItem] = useState<UnmatchedAP | null>(null);

  const [showFollowUpDialog, setShowFollowUpDialog] = useState(false);
  const [followUpNote, setFollowUpNote] = useState('');

  const [showMatchDialog, setShowMatchDialog] = useState(false);
  const [selectedVendorItems, setSelectedVendorItems] = useState<UnmatchedVendor[]>([]);
  const [selectedAPItems, setSelectedAPItems] = useState<UnmatchedAP[]>([]);

  // Actions
  const [loadingActions, setLoadingActions] = useState<Record<string, boolean>>({});
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const getCurrencySymbol = (currencyCode?: string) => {
    const code = currencyCode || 'USD';
    try {
      return (0).toLocaleString('en-US', { style: 'currency', currency: code, minimumFractionDigits: 0, maximumFractionDigits: 0 }).replace(/\d/g, '').trim();
    } catch {
      return '$';
    }
  };

  // Helper functions
  const toggleGroupExpansion = (groupId: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupId)) {
      newExpanded.delete(groupId);
    } else {
      newExpanded.add(groupId);
    }
    setExpandedGroups(newExpanded);
  };

  const groupResolvedItems = () => {
    const groups: { groupId: string; items: ResolvedItem[] }[] = [];
    const grouped = new Map<string, ResolvedItem[]>();
    const ungrouped: ResolvedItem[] = [];

    resolvedItems.forEach(item => {
      if (item.matchGroupId) {
        if (!grouped.has(item.matchGroupId)) {
          grouped.set(item.matchGroupId, []);
        }
        grouped.get(item.matchGroupId)?.push(item);
      } else {
        ungrouped.push(item);
      }
    });

    grouped.forEach((items, groupId) => {
      groups.push({ groupId, items });
    });

    ungrouped.forEach(item => {
      groups.push({ groupId: `single-${item.markedAt}-${Math.random()}`, items: [item] });
    });

    return groups;
  };

  const getTotalAmount = (items: (UnmatchedVendor | UnmatchedAP)[]) => {
    return items.reduce((sum, i) => {
      const val = 'transaction' in i ? i.transaction.amount : (i as UnmatchedAP).entry.amount;
      return sum + val;
    }, 0);
  };

  const toggleVendorSelection = (item: UnmatchedVendor) => {
    if (selectedVendorItems.some(i => i.transaction.id === item.transaction.id)) {
      setSelectedVendorItems(prev => prev.filter(i => i.transaction.id !== item.transaction.id));
    } else {
      setSelectedVendorItems(prev => [...prev, item]);
    }
  };

  const toggleAPSelection = (item: UnmatchedAP) => {
    if (selectedAPItems.some(i => i.entry.id === item.entry.id)) {
      setSelectedAPItems(prev => prev.filter(i => i.entry.id !== item.entry.id));
    } else {
      setSelectedAPItems(prev => [...prev, item]);
    }
  };

  useEffect(() => {
    if (companyId && period) {
      loadLockStatus();
      loadReconciliationData();
    }
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
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/ap-reconciliation?companyId=${companyId}&period=${period}`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        console.log('AP Reconciliation data loaded:', data);

        // Safety check: ensure we have an object
        if (!data) {
          console.error('No data received');
          setReconciliationResult(null);
          return;
        }

        // Unwrap the reconciliation object from the API response
        const reconciliation = data.reconciliation || data;

        // Double check structure to prevent crash
        if (!reconciliation) {
          console.log('Reconciliation object missing');
          setReconciliationResult(null);
          return;
        }

        // Set the reconciliation result with defaults
        const reconciliationData: APReconciliationResult = {
          unmatched_vendor: (reconciliation.unmatched_vendor || []).filter((i: any) => i && i.transaction),
          unmatched_ap: (reconciliation.unmatched_ap || []).filter((i: any) => i && i.entry),
          summary: reconciliation.summary || {
            total_vendor_transactions: 0,
            total_ap_entries: 0,
            matched_count: 0,
            unmatched_vendor_count: 0,
            unmatched_ap_count: 0,
          },
          resolved_items: reconciliation.resolved_items || [],
          follow_up_items: reconciliation.follow_up_items || [],
          timing_differences: reconciliation.timing_differences || [],
          ignored_items: reconciliation.ignored_items || [],
          pre_matched_items: reconciliation.pre_matched_items || [],
          locked: reconciliation.locked || false,
        };

        setReconciliationResult(reconciliationData);

        // Initialize optimistic update state
        setUnmatchedVendorItems(reconciliationData.unmatched_vendor || []);
        setUnmatchedAPItems(reconciliationData.unmatched_ap || []);
        setResolvedItems(reconciliationData.resolved_items || []);
        setFollowUpItems(reconciliationData.follow_up_items || []);
      } else {
        const errorText = await response.text();
        console.error('Failed to load AP reconciliation:', response.status, errorText);
        setReconciliationResult(null);
      }
    } catch (error) {
      console.error('Failed to load AP reconciliation data:', error);
      setReconciliationResult(null);
    } finally {
      setIsLoadingReconciliation(false);
    }
  };



  const getPeriodLabel = (period: string) => {
    const [year, month] = period.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const handleEditVendorTransaction = (item: UnmatchedVendor) => {
    setEditingItem({ ...item.transaction });
    setEditingType('vendor');
    setSelectedVendorItem(item);
    setShowEditDialog(true);
  };

  const handleEditAPEntry = (item: UnmatchedAP) => {
    setEditingItem({ ...item.entry });
    setEditingType('ap');
    setSelectedAPItem(item);
    setShowEditDialog(true);
  };

  const handleSaveEdit = async () => {
    if (!editingItem) return;

    const originalItem = editingType === 'vendor'
      ? selectedVendorItem?.transaction
      : selectedAPItem?.entry;

    if (!originalItem) {
      toast.error('Original item not found');
      return;
    }

    // Optimistic update
    if (editingType === 'vendor' && selectedVendorItem) {
      setUnmatchedVendorItems(prev => prev.map(item =>
        item.transaction.id === editingItem.id
          ? { ...item, transaction: { ...item.transaction, ...editingItem } }
          : item
      ));

      setFollowUpItems(prev => prev.map(followUpItem => {
        if (followUpItem.type === 'vendor' && 'transaction' in followUpItem.item && followUpItem.item.transaction.id === editingItem.id) {
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
    } else if (editingType === 'ap' && selectedAPItem) {
      setUnmatchedAPItems(prev => prev.map(item =>
        item.entry.id === editingItem.id
          ? { ...item, entry: { ...item.entry, ...editingItem } }
          : item
      ));

      setFollowUpItems(prev => prev.map(followUpItem => {
        if (followUpItem.type === 'ap' && 'entry' in followUpItem.item && followUpItem.item.entry.id === editingItem.id) {
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

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/ap-rec/update-transaction`,
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
        toast.success('Transaction updated successfully!');
      } else {
        const errorText = await response.text();
        console.error('Failed to update transaction:', response.status, errorText);
        toast.error('Failed to save changes. Please try again.');
        await loadReconciliationData();
      }
    } catch (error) {
      console.error('Error updating transaction:', error);
      toast.error('Network error. Please check your connection and try again.');
      await loadReconciliationData();
    }
  };

  const handleApproveForJE = async (item: UnmatchedVendor | UnmatchedAP, type: 'vendor' | 'ap') => {
    const itemId = 'transaction' in item ? item.transaction.id : item.entry.id;
    const actionKey = `approve-${type}-${itemId}`;
    setLoadingActions(prev => ({ ...prev, [actionKey]: true }));

    // Optimistic update
    if (type === 'vendor' && 'transaction' in item) {
      setUnmatchedVendorItems(prev => prev.filter(i => i.transaction.id !== itemId));
      setResolvedItems(prev => [...prev, {
        type: 'vendor' as const,
        item: item as UnmatchedVendor,
        markedAt: new Date().toISOString(),
        status: 'resolved',
        resolution: 'Transaction sent to Journal Entries section to be recorded'
      }]);
    } else if (type === 'ap' && 'entry' in item) {
      setUnmatchedAPItems(prev => prev.filter(i => i.entry.id !== itemId));
      setResolvedItems(prev => [...prev, {
        type: 'ap' as const,
        item: item as UnmatchedAP,
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
        if (type === 'vendor' && 'transaction' in item) {
          setUnmatchedVendorItems(prev => [...prev, item as UnmatchedVendor]);
          setResolvedItems(prev => prev.filter(i =>
            !(i.type === 'vendor' && i.item && 'transaction' in i.item && i.item.transaction.id === itemId)
          ));
        } else if (type === 'ap' && 'entry' in item) {
          setUnmatchedAPItems(prev => [...prev, item as UnmatchedAP]);
          setResolvedItems(prev => prev.filter(i =>
            !(i.type === 'ap' && i.item && 'entry' in i.item && i.item.entry.id === itemId)
          ));
        }
      }
    } catch (error) {
      console.error('Failed to approve transaction:', error);
      toast.error('Failed to approve transaction. Please try again.');
      // Revert optimistic update on error
      if (type === 'vendor' && 'transaction' in item) {
        setUnmatchedVendorItems(prev => [...prev, item as UnmatchedVendor]);
        setResolvedItems(prev => prev.filter(i =>
          !(i.type === 'vendor' && i.item && 'transaction' in i.item && i.item.transaction.id === itemId)
        ));
      } else if (type === 'ap' && 'entry' in item) {
        setUnmatchedAPItems(prev => [...prev, item as UnmatchedAP]);
        setResolvedItems(prev => prev.filter(i =>
          !(i.type === 'ap' && i.item && 'entry' in i.item && i.item.entry.id === itemId)
        ));
      }
    } finally {
      setLoadingActions(prev => ({ ...prev, [actionKey]: false }));
    }
  };

  const handleReverseJE = async (item: UnmatchedAP) => {
    const itemId = item.entry.id;
    const actionKey = `reverse-ap-${itemId}`;
    setLoadingActions(prev => ({ ...prev, [actionKey]: true }));

    // Optimistic update
    setUnmatchedAPItems(prev => prev.filter(i => i.entry.id !== itemId));
    setResolvedItems(prev => [...prev, {
      type: 'ap' as const,
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
        setUnmatchedAPItems(prev => [...prev, item]);
        setResolvedItems(prev => prev.filter(i =>
          !(i.type === 'ap' && i.item?.entry?.id === itemId)
        ));
      }
    } catch (error) {
      console.error('Failed to create reversing JE:', error);
      toast.error('Failed to create reversing JE. Please try again.');
      // Revert optimistic update on error
      setUnmatchedAPItems(prev => [...prev, item]);
      setResolvedItems(prev => prev.filter(i =>
        !(i.type === 'ap' && i.item?.entry?.id === itemId)
      ));
    } finally {
      setLoadingActions(prev => ({ ...prev, [actionKey]: false }));
    }
  };

  const handleMarkAsTimingDifference = async (item: UnmatchedVendor | UnmatchedAP, type: 'vendor' | 'ap') => {
    const itemId = 'transaction' in item ? item.transaction.id : item.entry.id;
    const actionKey = `timing-${type}-${itemId}`;
    setLoadingActions(prev => ({ ...prev, [actionKey]: true }));

    // Optimistic update
    if (type === 'vendor' && 'transaction' in item) {
      setUnmatchedVendorItems(prev => prev.filter(i => i.transaction.id !== itemId));
      setResolvedItems(prev => [...prev, {
        type: 'vendor' as const,
        item: item as UnmatchedVendor,
        markedAt: new Date().toISOString(),
        status: 'timing_difference',
        resolution: 'Will clear next period',
        matchGroupId: `timing-${itemId}`
      }]);
    } else if (type === 'ap' && 'entry' in item) {
      setUnmatchedAPItems(prev => prev.filter(i => i.entry.id !== itemId));
      setResolvedItems(prev => [...prev, {
        type: 'ap' as const,
        item: item as UnmatchedAP,
        markedAt: new Date().toISOString(),
        status: 'timing_difference',
        resolution: 'Will clear next period',
        matchGroupId: `timing-${itemId}`
      }]);
    }

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/ap-rec/mark-timing-difference`,
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
        const errorText = await response.text();
        console.error('Failed to mark as timing difference:', response.status, errorText);
        toast.error('Failed to mark as timing difference.');
        // Revert optimistic update
        if (type === 'vendor' && 'transaction' in item) {
          setUnmatchedVendorItems(prev => [...prev, item as UnmatchedVendor]);
          setResolvedItems(prev => prev.filter(r => r.matchGroupId !== `timing-${itemId}`));
        } else if (type === 'ap' && 'entry' in item) {
          setUnmatchedAPItems(prev => [...prev, item as UnmatchedAP]);
          setResolvedItems(prev => prev.filter(r => r.matchGroupId !== `timing-${itemId}`));
        }
      }
    } catch (error) {
      console.error('Failed to mark as timing difference:', error);
      toast.error('Failed to mark as timing difference.');
      // Revert optimistic update
      if (type === 'vendor' && 'transaction' in item) {
        setUnmatchedVendorItems(prev => [...prev, item as UnmatchedVendor]);
        setResolvedItems(prev => prev.filter(r => r.matchGroupId !== `timing-${itemId}`));
      } else if (type === 'ap' && 'entry' in item) {
        setUnmatchedAPItems(prev => [...prev, item as UnmatchedAP]);
        setResolvedItems(prev => prev.filter(r => r.matchGroupId !== `timing-${itemId}`));
      }
    } finally {
      setLoadingActions(prev => ({ ...prev, [actionKey]: false }));
    }
  };

  const handleMarkAsIgnored = async (item: UnmatchedVendor | UnmatchedAP, type: 'vendor' | 'ap') => {
    const itemId = 'transaction' in item ? item.transaction.id : item.entry.id;
    const actionKey = `ignore-${type}-${itemId}`;
    setLoadingActions(prev => ({ ...prev, [actionKey]: true }));

    // Optimistic update
    if (type === 'vendor' && 'transaction' in item) {
      setUnmatchedVendorItems(prev => prev.filter(i => i.transaction.id !== itemId));
      setResolvedItems(prev => [...prev, {
        type: 'vendor' as const,
        item: item as UnmatchedVendor,
        markedAt: new Date().toISOString(),
        status: 'ignored',
        resolution: 'Marked as non-issue',
        matchGroupId: `ignored-${itemId}`
      }]);
    } else if (type === 'ap' && 'entry' in item) {
      setUnmatchedAPItems(prev => prev.filter(i => i.entry.id !== itemId));
      setResolvedItems(prev => [...prev, {
        type: 'ap' as const,
        item: item as UnmatchedAP,
        markedAt: new Date().toISOString(),
        status: 'ignored',
        resolution: 'Marked as non-issue',
        matchGroupId: `ignored-${itemId}`
      }]);
    }

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/ap-rec/mark-ignored`,
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
        const errorText = await response.text();
        console.error('Failed to mark as ignored:', response.status, errorText);
        toast.error('Failed to mark as ignored.');
        // Revert optimistic update
        if (type === 'vendor' && 'transaction' in item) {
          setUnmatchedVendorItems(prev => [...prev, item as UnmatchedVendor]);
          setResolvedItems(prev => prev.filter(r => r.matchGroupId !== `ignored-${itemId}`));
        } else if (type === 'ap' && 'entry' in item) {
          setUnmatchedAPItems(prev => [...prev, item as UnmatchedAP]);
          setResolvedItems(prev => prev.filter(r => r.matchGroupId !== `ignored-${itemId}`));
        }
      }
    } catch (error) {
      console.error('Failed to mark as ignored:', error);
      toast.error('Failed to mark as ignored.');
      // Revert optimistic update
      if (type === 'vendor' && 'transaction' in item) {
        setUnmatchedVendorItems(prev => [...prev, item as UnmatchedVendor]);
        setResolvedItems(prev => prev.filter(r => r.matchGroupId !== `ignored-${itemId}`));
      } else if (type === 'ap' && 'entry' in item) {
        setUnmatchedAPItems(prev => [...prev, item as UnmatchedAP]);
        setResolvedItems(prev => prev.filter(r => r.matchGroupId !== `ignored-${itemId}`));
      }
    } finally {
      setLoadingActions(prev => ({ ...prev, [actionKey]: false }));
    }
  };

  const handleOpenFollowUpDialog = (item: UnmatchedVendor | UnmatchedAP, type: 'vendor' | 'ap') => {
    if (type === 'vendor' && 'transaction' in item) {
      setSelectedVendorItem(item as UnmatchedVendor);
      setSelectedAPItem(null);
    } else if (type === 'ap' && 'entry' in item) {
      setSelectedAPItem(item as UnmatchedAP);
      setSelectedVendorItem(null);
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

    const item = selectedVendorItem || selectedAPItem;
    const type = editingType;
    if (!item) return;

    const itemId = 'transaction' in item ? (item as UnmatchedVendor).transaction.id : (item as UnmatchedAP).entry.id;

    // Optimistic update
    if (type === 'vendor' && 'transaction' in item) {
      setUnmatchedVendorItems(prev => prev.filter(i => i.transaction.id !== itemId));
      setFollowUpItems(prev => [...prev, {
        item: item as UnmatchedVendor,
        type: 'vendor' as const,
        note: followUpNote,
        markedAt: new Date().toISOString()
      }]);
    } else if (type === 'ap' && 'entry' in item) {
      setUnmatchedAPItems(prev => prev.filter(i => i.entry.id !== itemId));
      setFollowUpItems(prev => [...prev, {
        item: item as UnmatchedAP,
        type: 'ap' as const,
        note: followUpNote,
        markedAt: new Date().toISOString()
      }]);
    }

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/ap-rec/request-information`,
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
        const errorText = await response.text();
        console.error('Failed to flag for follow-up:', response.status, errorText);
        toast.error('Failed to flag for follow-up.');
        // Revert optimistic update
        if (type === 'vendor' && item) {
          setUnmatchedVendorItems(prev => [...prev, item as UnmatchedVendor]);
          setFollowUpItems(prev => prev.filter(i =>
            i.type === 'vendor' ? (i.item as UnmatchedVendor).transaction.id !== itemId : true
          ));
        } else if (type === 'ap' && item) {
          setUnmatchedAPItems(prev => [...prev, item as UnmatchedAP]);
          setFollowUpItems(prev => prev.filter(i =>
            i.type === 'ap' ? (i.item as UnmatchedAP).entry.id !== itemId : true
          ));
        }
      }
    } catch (error) {
      console.error('Failed to flag for follow-up:', error);
      toast.error('Failed to flag for follow-up.');
      // Revert optimistic update
      if (type === 'vendor' && item) {
        setUnmatchedVendorItems(prev => [...prev, item as UnmatchedVendor]);
        setFollowUpItems(prev => prev.filter(i =>
          i.type === 'vendor' ? (i.item as UnmatchedVendor).transaction.id !== itemId : true
        ));
      } else if (type === 'ap' && item) {
        setUnmatchedAPItems(prev => [...prev, item as UnmatchedAP]);
        setFollowUpItems(prev => prev.filter(i =>
          i.type === 'ap' ? (i.item as UnmatchedAP).entry.id !== itemId : true
        ));
      }
    }
  };

  const handleOpenMatchDialog = (item: UnmatchedVendor | UnmatchedAP) => {
    if ('transaction' in item) {
      setSelectedVendorItems([item]);
      setSelectedAPItems([]);
    } else {
      setSelectedAPItems([item]);
      setSelectedVendorItems([]);
    }
    setShowMatchDialog(true);
  };



  const handleMatchItems = async (apItem?: UnmatchedAP) => {
    // If apItem is provided (old single-select flow), use it
    // Otherwise use the multi-select arrays
    const vendorItems = selectedVendorItems;
    const apItems = apItem ? [apItem] : selectedAPItems;

    if (vendorItems.length === 0 || apItems.length === 0) {
      toast.error('Please select at least one item from each side to match.');
      return;
    }

    // Generate unique match group ID
    const matchGroupId = `match-${Date.now()}`;

    // Optimistic update
    const vendorIds = vendorItems.map(i => i.transaction.id);
    const apIds = apItems.map(i => i.entry.id);

    setUnmatchedVendorItems(prev => prev.filter(i => !vendorIds.includes(i.transaction.id)));
    setUnmatchedAPItems(prev => prev.filter(i => !apIds.includes(i.entry.id)));

    // Add to resolved items
    const newResolvedItems: any[] = [];
    vendorItems.forEach(item => {
      newResolvedItems.push({
        type: 'vendor' as const,
        item: item,
        markedAt: new Date().toISOString(),
        status: 'matched',
        resolution: 'Matched items',
        matchGroupId
      });
    });
    apItems.forEach(item => {
      newResolvedItems.push({
        type: 'ap' as const,
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
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/ap-rec/match-items`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            companyId,
            period,
            vendorItems,
            apItems,
          }),
        }
      );

      if (response.ok) {
        toast.success(`Successfully matched ${vendorItems.length} vendor transaction(s) with ${apItems.length} AP entry(ies)!`);
        setShowMatchDialog(false);
        setSelectedVendorItems([]);
        setSelectedAPItems([]);
      } else {
        toast.error('Failed to match items.');
        // Revert optimistic update
        setUnmatchedVendorItems(prev => [...prev, ...vendorItems]);
        setUnmatchedAPItems(prev => [...prev, ...apItems]);
        setResolvedItems(prev => prev.filter(r => r.matchGroupId !== matchGroupId));
      }
    } catch (error) {
      console.error('Failed to match items:', error);
      toast.error('Failed to match items.');
      // Revert optimistic update
      setUnmatchedVendorItems(prev => [...prev, ...vendorItems]);
      setUnmatchedAPItems(prev => [...prev, ...apItems]);
      setResolvedItems(prev => prev.filter(r => r.matchGroupId !== matchGroupId));
    }
  };

  const handleDeleteTransaction = async (item: UnmatchedVendor | UnmatchedAP, type: 'vendor' | 'ap') => {
    const itemId = type === 'vendor' ? (item as UnmatchedVendor).transaction.id : (item as UnmatchedAP).entry.id;

    if (!confirm('Are you sure you want to delete this transaction? This action cannot be undone.')) {
      return;
    }

    const actionKey = `delete-${type}-${itemId}`;
    setLoadingActions(prev => ({ ...prev, [actionKey]: true }));

    // Optimistic update
    if (type === 'vendor') {
      setUnmatchedVendorItems(prev => prev.filter(i => i.transaction.id !== itemId));
    } else {
      setUnmatchedAPItems(prev => prev.filter(i => i.entry.id !== itemId));
    }

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/ap-rec/delete-transaction`,
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
        toast.error('Failed to delete transaction.');
        // Revert optimistic update
        if (type === 'vendor') {
          setUnmatchedVendorItems(prev => [...prev, item as UnmatchedVendor]);
        } else {
          setUnmatchedAPItems(prev => [...prev, item as UnmatchedAP]);
        }
      }
    } catch (error) {
      console.error('Failed to delete transaction:', error);
      toast.error('Failed to delete transaction.');
      // Revert optimistic update
      if (type === 'vendor') {
        setUnmatchedVendorItems(prev => [...prev, item as UnmatchedVendor]);
      } else {
        setUnmatchedAPItems(prev => [...prev, item as UnmatchedAP]);
      }
    } finally {
      setLoadingActions(prev => ({ ...prev, [actionKey]: false }));
    }
  };

  const handleMoveBackToNeedsAttention = async (item: FollowUpItem) => {
    const itemId = item.type === 'vendor' ? (item.item as UnmatchedVendor).transaction.id : (item.item as UnmatchedAP).entry.id;

    // Optimistic update
    setFollowUpItems(prev => prev.filter(i => {
      const id = i.type === 'vendor' ? (i.item as UnmatchedVendor).transaction.id : (i.item as UnmatchedAP).entry.id;
      return id !== itemId;
    }));

    if (item.type === 'vendor') {
      setUnmatchedVendorItems(prev => [...prev, item.item as UnmatchedVendor]);
    } else {
      setUnmatchedAPItems(prev => [...prev, item.item as UnmatchedAP]);
    }

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/ap-rec/move-to-needs-attention`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            companyId,
            period,
            type: item.type,
            item: item.item,
          }),
        }
      );

      if (response.ok) {
        toast.success('Moved back to Needs Attention.');
      } else {
        toast.error('Failed to move item.');
        // Revert on error
        await loadReconciliationData();
      }
    } catch (error) {
      console.error('Failed to move item:', error);
      toast.error('Failed to move item.');
      await loadReconciliationData();
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
    const unmatchedVendorItems: UnmatchedVendor[] = matchGroup.vendorTransactions.map(transaction => ({
      transaction,
      suggested_action: 'Review this unmatched vendor transaction',
    }));

    const unmatchedAPEntries: UnmatchedAP[] = matchGroup.apEntries.map(entry => ({
      entry,
      reason: 'Unmatched from pre-matched group',
      action: 'Review this unmatched AP entry',
    }));

    // Add to needs attention (unmatched items)
    setUnmatchedVendorItems(prev => [...prev, ...unmatchedVendorItems]);
    setUnmatchedAPItems(prev => [...prev, ...unmatchedAPEntries]);

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/ap-rec/unmatch-group`,
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
        toast.success(`Unmatched ${matchGroup.vendorTransactions.length} vendor and ${matchGroup.apEntries.length} AP transactions. Moved to Needs Attention.`);
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
        setUnmatchedVendorItems(prev => prev.filter(i => !unmatchedVendorItems.some(v => v.transaction.id === i.transaction.id)));
        setUnmatchedAPItems(prev => prev.filter(i => !unmatchedAPEntries.some(a => a.entry.id === i.entry.id)));
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
      setUnmatchedVendorItems(prev => prev.filter(i => !unmatchedVendorItems.some(v => v.transaction.id === i.transaction.id)));
      setUnmatchedAPItems(prev => prev.filter(i => !unmatchedAPEntries.some(a => a.entry.id === i.entry.id)));
    } finally {
      setLoadingActions(prev => ({ ...prev, [actionKey]: false }));
    }
  };



  if (isLoadingReconciliation) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-gray-200 border-t-[#65D3FD] rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading AP reconciliation data...</p>
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
            No AP reconciliation found for {companyName} - {getPeriodLabel(period)}.
            Please run an AP reconciliation first.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const needsAttentionCount = (unmatchedVendorItems?.length || 0) +
    (unmatchedAPItems?.length || 0);
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
            <h1 className="text-3xl text-gray-900">Review AP Reconciliation</h1>
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
        <TabsContent value="needs-attention" className="h-[calc(100vh-400px)]">
          <div className="grid grid-cols-2 gap-4 h-full overflow-hidden">
            {/* Left Column: Unmatched Vendor Transactions */}
            <div className="overflow-y-auto pr-2 overscroll-contain h-full">
              <Card className="h-fit">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <FileText className="size-5 text-red-600" />
                        Unmatched Vendor Transactions
                      </CardTitle>
                      <CardDescription className="mt-2">
                        These transactions appear in vendor statements but have no matching ledger entries.
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                      {unmatchedVendorItems?.length || 0} items
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {unmatchedVendorItems && unmatchedVendorItems.length > 0 ? (
                    <div className="space-y-3">
                      {unmatchedVendorItems.map((item, idx) => (
                        <UnmatchedItemCard
                          key={idx}
                          type="vendor"
                          item={{
                            data: {
                              id: item.transaction.id,
                              date: item.transaction.date,
                              description: item.transaction.description,
                              amount: item.transaction.amount,
                              currency: item.transaction.currency
                              // details: item.suggested_je  <-- REMOVED: This raw object caused the crash
                            },
                            suggested_je: item.suggested_je
                          }}
                          currency={(item.transaction as any).currency}
                          loadingActions={loadingActions}
                          isMonthLocked={isMonthLocked}
                          onApproveJE={() => handleApproveForJE(item, 'vendor')}
                          onMatch={() => handleOpenMatchDialog(item)}
                          onEdit={() => handleEditVendorTransaction(item)}
                          onIgnore={() => handleMarkAsIgnored(item, 'vendor')}
                          onTimingDifference={() => handleMarkAsTimingDifference(item, 'vendor')}
                          onRequestInfo={() => handleOpenFollowUpDialog(item, 'vendor')}
                          onDelete={() => handleDeleteTransaction(item, 'vendor')}
                          matchActionLabel="Match to AP Entry"
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <CheckCircle2 className="size-12 text-green-500 mx-auto mb-3" />
                      <p className="text-sm text-gray-600">All vendor transactions have been matched!</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Right Column: Unmatched AP Entries */}
            <div className="overflow-y-auto pl-2 overscroll-contain h-full">
              <Card className="h-fit">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <BookOpen className="size-5 text-amber-600" />
                        Unmatched AP Entries
                      </CardTitle>
                      <CardDescription className="mt-2">
                        These entries appear in the AP ledger but have no matching vendor transactions.
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                      {unmatchedAPItems?.length || 0} items
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {unmatchedAPItems && unmatchedAPItems.length > 0 ? (
                    <div className="space-y-3">
                      {unmatchedAPItems.map((item, idx) => (
                        <UnmatchedItemCard
                          key={idx}
                          type="ap"
                          item={{
                            data: {
                              id: item.entry.id,
                              date: item.entry.date,
                              description: item.entry.description,
                              amount: item.entry.amount,
                              currency: (item.entry as any).currency,
                              details: (
                                <div className="text-xs text-gray-500 mt-1">
                                  Vendor: {item.entry.vendor}
                                </div>
                              )
                            }
                          }}
                          currency={(item.entry as any).currency}
                          loadingActions={loadingActions}
                          isMonthLocked={isMonthLocked}
                          primaryActionLabel="Reverse JE"
                          primaryActionIcon={<Undo2 className="size-3" />}
                          primaryActionClassName="gap-2 bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-200"
                          onApproveJE={() => handleReverseJE(item)}
                          onMatch={() => handleOpenMatchDialog(item)}
                          onEdit={() => handleEditAPEntry(item)}
                          onIgnore={() => handleMarkAsIgnored(item, 'ap')}
                          onTimingDifference={() => handleMarkAsTimingDifference(item, 'ap')}
                          onRequestInfo={() => handleOpenFollowUpDialog(item, 'ap')}
                          onDelete={() => handleDeleteTransaction(item, 'ap')}
                          matchActionLabel="Match to Vendor Transaction"
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <CheckCircle2 className="size-12 text-green-500 mx-auto mb-3" />
                      <p className="text-sm text-gray-600">All AP entries have been matched!</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Tab 2: Follow-Up Needed */}
        <TabsContent value="follow-up" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="size-5 text-purple-600" />
                Items Awaiting Information
              </CardTitle>
              <CardDescription>
                These items have been flagged for follow-up and are awaiting additional information.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {followUpItems && followUpItems.length > 0 ? (
                <div className="space-y-3">
                  {followUpItems.map((followUpItem, idx) => {
                    const item = followUpItem.item;
                    const transaction = followUpItem.type === 'vendor'
                      ? (item as UnmatchedVendor).transaction
                      : (item as UnmatchedAP).entry;

                    return (
                      <div key={idx} className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge variant="outline" className="text-xs bg-purple-100 text-purple-700">
                                {followUpItem.type === 'vendor' ? 'Vendor Transaction' : 'AP Entry'}
                              </Badge>
                              <span className="text-sm font-medium text-gray-900">{transaction.description}</span>
                              <Badge variant="outline" className="text-xs">
                                {transaction.date}
                              </Badge>
                            </div>
                            <div className="bg-white border border-purple-200 rounded p-3 mt-2">
                              <div className="text-xs font-medium text-gray-900 mb-1">Follow-up Note:</div>
                              <p className="text-xs text-gray-600">{followUpItem.note}</p>
                            </div>
                          </div>
                          <div className="ml-4">
                            <div className={`text-lg font-medium ${transaction.amount >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                              {getCurrencySymbol((transaction as any).currency)}{formatCurrency(Math.abs(transaction.amount))}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2 pt-2 border-t border-purple-200">
                          <Button
                            type="button"
                            size="sm"
                            className="gap-2 bg-blue-600 hover:bg-blue-700"
                            onClick={() => handleMoveBackToNeedsAttention(followUpItem)}
                            disabled={isMonthLocked}
                          >
                            <ArrowLeft className="size-3" />
                            Move to Needs Attention
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8">
                  <CheckCircle2 className="size-12 text-green-500 mx-auto mb-3" />
                  <p className="text-sm text-gray-600">No items awaiting follow-up!</p>
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
              <CardDescription>
                Items that have been resolved, matched, or marked as timing differences/non-issues.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {resolvedItems && resolvedItems.length > 0 ? (
                <div className="space-y-3">
                  {groupResolvedItems().map(({ groupId, items }) => {
                    const isExpanded = expandedGroups.has(groupId);
                    const isGroup = items.length > 1;

                    return (
                      <div key={groupId} className="border border-green-200 rounded-lg overflow-hidden">
                        <div
                          className={`p-4 bg-green-50 ${isGroup ? 'cursor-pointer hover:bg-green-100' : ''}`}
                          onClick={() => isGroup && toggleGroupExpansion(groupId)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <CheckCircle2 className="size-5 text-green-600" />
                              <div>
                                <div className="text-sm font-medium text-gray-900">
                                  {items[0].status === 'matched' && (
                                    items.length === 2 ? 'Matched Vendor & AP Entry' : `Matched ${items.length} Items`
                                  )}
                                  {items[0].status === 'resolved' && 'Resolved'}
                                  {items[0].status === 'timing_difference' && 'Timing Difference'}
                                  {items[0].status === 'ignored' && 'Marked as Non-Issue'}
                                </div>
                                <div className="text-xs text-gray-600 mt-1">
                                  {items[0].status === 'matched' ? (
                                    (() => {
                                      const vendorItems = items.filter(i => i.type === 'vendor');
                                      const apItems = items.filter(i => i.type === 'ap');
                                      const vendorTotal = vendorItems.reduce((sum, i) => {
                                        const txn = i.type === 'vendor' ? (i.item as UnmatchedVendor).transaction : (i.item as UnmatchedAP).entry;
                                        return sum + Math.abs(txn.amount);
                                      }, 0);
                                      const apTotal = apItems.reduce((sum, i) => {
                                        const txn = i.type === 'vendor' ? (i.item as UnmatchedVendor).transaction : (i.item as UnmatchedAP).entry;
                                        return sum + Math.abs(txn.amount);
                                      }, 0);
                                      return `${vendorItems.length} vendor transaction${vendorItems.length !== 1 ? 's' : ''} (€${formatCurrency(vendorTotal)}) matched with ${apItems.length} AP entr${apItems.length !== 1 ? 'ies' : 'y'} (€${formatCurrency(apTotal)})`;
                                    })()
                                  ) : items[0].resolution}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <Badge variant="outline" className="bg-green-100 text-green-700">
                                {items.length} {items.length === 1 ? 'item' : 'items'}
                              </Badge>
                              {isGroup && (
                                isExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />
                              )}
                            </div>
                          </div>
                        </div>

                        {(isExpanded || !isGroup) && (
                          <div className="bg-white border-t border-green-200">
                            {items.map((resolvedItem, idx) => {
                              const item = resolvedItem.item;
                              const transaction = resolvedItem.type === 'vendor'
                                ? (item as UnmatchedVendor).transaction
                                : (item as UnmatchedAP).entry;

                              return (
                                <div key={idx} className={`p-3 ${idx > 0 ? 'border-t border-gray-200' : ''}`}>
                                  <div className="flex items-center justify-between">
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2">
                                        <Badge variant="outline" className="text-xs">
                                          {resolvedItem.type === 'vendor' ? 'Vendor' : 'AP'}
                                        </Badge>
                                        <span className="text-sm text-gray-900">{transaction.description}</span>
                                        <span className="text-xs text-gray-500">{transaction.date}</span>
                                      </div>
                                    </div>
                                    <div className="ml-4">
                                      <div className={`text-sm font-medium ${transaction.amount >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                                        {getCurrencySymbol((transaction as any).currency)}{formatCurrency(Math.abs(transaction.amount))}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
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
                    Pre-Matched Items
                  </CardTitle>
                  <CardDescription className="mt-2">
                    Items that were automatically matched during reconciliation. Review and unmatch if needed.
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
                    const vendorTotal = matchGroup.vendorTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
                    const apTotal = matchGroup.apEntries.reduce((sum, e) => sum + Math.abs(e.amount), 0);

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
                                {matchGroup.vendorTransactions.length} Vendor ↔ {matchGroup.apEntries.length} AP
                              </span>
                              <Badge variant="outline" className="text-xs">
                                {new Date(matchGroup.matchedAt).toLocaleDateString()}
                              </Badge>
                            </div>

                            <div className="text-xs bg-white border border-blue-200 rounded p-3 mt-2">
                              <div className="font-medium text-gray-900 mb-2">Match Summary:</div>
                              <div className="space-y-1 text-gray-600">
                                <p>Vendor Total: {getCurrencySymbol()}{formatCurrency(vendorTotal)}</p>
                                <p>AP Total: {getCurrencySymbol()}{formatCurrency(apTotal)}</p>
                                <p className="text-gray-400 mt-2">Match ID: {matchGroup.matchGroupId}</p>
                              </div>
                            </div>

                            {/* Vendor Transactions */}
                            <div className="mt-3 space-y-2">
                              <div className="text-xs font-medium text-gray-700">Vendor Transactions:</div>
                              {matchGroup.vendorTransactions.map((transaction, tIdx) => (
                                <div key={tIdx} className="p-2 bg-white border border-blue-200 rounded text-xs">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700">
                                        Vendor
                                      </Badge>
                                      <span className="text-gray-900">{transaction.description}</span>
                                      <span className="text-gray-500">{transaction.date}</span>
                                    </div>
                                    <span className={`font-medium ${transaction.amount >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                                      {getCurrencySymbol((transaction as any).currency)}{formatCurrency(Math.abs(transaction.amount))}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>

                            {/* AP Entries */}
                            <div className="mt-3 space-y-2">
                              <div className="text-xs font-medium text-gray-700">AP Entries:</div>
                              {matchGroup.apEntries.map((entry, eIdx) => (
                                <div key={eIdx} className="p-2 bg-white border border-blue-200 rounded text-xs">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700">
                                        AP
                                      </Badge>
                                      <span className="text-gray-900">{entry.description}</span>
                                      <span className="text-gray-500">{entry.date}</span>
                                    </div>
                                    <span className={`font-medium ${entry.amount >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                                      {getCurrencySymbol((entry as any).currency)}{formatCurrency(Math.abs(entry.amount))}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="ml-4">
                            <div className="text-lg font-medium text-blue-600">
                              {getCurrencySymbol()}{formatCurrency(vendorTotal)}
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
                  <p className="text-sm text-gray-600">No pre-matched items found.</p>
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
            <DialogTitle>Edit {editingType === 'vendor' ? 'Vendor Transaction' : 'AP Entry'}</DialogTitle>
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
                  value={editingItem.date}
                  readOnly
                  disabled
                  className="bg-gray-100 cursor-not-allowed"
                />
              </div>
              <div>
                <Label htmlFor="edit-description">Description</Label>
                <Input
                  id="edit-description"
                  value={editingItem.description}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditingItem({ ...editingItem, description: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit-amount">Amount</Label>
                <Input
                  id="edit-amount"
                  type="number"
                  step="0.01"
                  value={editingItem.amount}
                  readOnly
                  disabled
                  className="bg-gray-100 cursor-not-allowed"
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
      {/* Follow Up Dialog */}
      <ReconciliationFollowUpDialog
        open={showFollowUpDialog}
        onOpenChange={setShowFollowUpDialog}
        note={followUpNote}
        onNoteChange={setFollowUpNote}
        onConfirm={handleRequestInformation}
        isLoading={false}
      />

      {/* Match Dialog */}
      <ReconciliationMatchDialog
        open={showMatchDialog}
        onOpenChange={setShowMatchDialog}
        title="Match Transactions - Multi-Select"
        leftItems={unmatchedVendorItems.map(i => ({
          id: i.transaction.id,
          date: i.transaction.date,
          description: i.transaction.description,
          amount: i.transaction.amount,
          originalItem: i
        }))}
        leftTitle="Vendor Transactions"
        onSelectLeft={(mItem) => toggleVendorSelection(mItem.originalItem as UnmatchedVendor)}
        selectedLeftItems={selectedVendorItems.map(i => ({
          id: i.transaction.id,
          date: i.transaction.date,
          description: i.transaction.description,
          amount: i.transaction.amount,
          originalItem: i
        }))}
        rightItems={unmatchedAPItems.map(i => ({
          id: i.entry.id,
          date: i.entry.date,
          description: i.entry.description,
          amount: i.entry.amount,
          originalItem: i
        }))}
        rightTitle="AP Entries"
        onSelectRight={(mItem) => toggleAPSelection(mItem.originalItem as UnmatchedAP)}
        selectedRightItems={selectedAPItems.map(i => ({
          id: i.entry.id,
          date: i.entry.date,
          description: i.entry.description,
          amount: i.entry.amount,
          originalItem: i
        }))}
        onMatch={() => handleMatchItems()}
        isMatching={false}
        currency={(selectedVendorItems[0]?.transaction as any)?.currency || 'USD'}
      />
    </div>
  );
}
