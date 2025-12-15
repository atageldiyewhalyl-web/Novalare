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
  FileText,
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
  const [reconciliationResult, setReconciliationResult] = useState<APReconciliationResult | null>(null);
  const [isLoadingReconciliation, setIsLoadingReconciliation] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showFollowUpDialog, setShowFollowUpDialog] = useState(false);
  const [selectedVendorItem, setSelectedVendorItem] = useState<UnmatchedVendor | null>(null);
  const [selectedAPItem, setSelectedAPItem] = useState<UnmatchedAP | null>(null);
  const [followUpNote, setFollowUpNote] = useState('');
  const [activeTab, setActiveTab] = useState<'needs-attention' | 'follow-up' | 'resolved' | 'pre-matched'>('needs-attention');
  const [editingItem, setEditingItem] = useState<any>(null);
  const [editingType, setEditingType] = useState<'vendor' | 'ap' | null>(null);
  const [showMatchDialog, setShowMatchDialog] = useState(false);
  const [matchingVendorItem, setMatchingVendorItem] = useState<UnmatchedVendor | null>(null);
  
  // Multi-select matching state
  const [selectedVendorItems, setSelectedVendorItems] = useState<UnmatchedVendor[]>([]);
  const [selectedAPItems, setSelectedAPItems] = useState<UnmatchedAP[]>([]);
  
  // Loading states for individual actions
  const [loadingActions, setLoadingActions] = useState<Record<string, boolean>>({});
  
  // Expanded match groups in resolved section
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  
  // Optimistic update state - separate from reconciliationResult for real-time updates
  const [unmatchedVendorItems, setUnmatchedVendorItems] = useState<UnmatchedVendor[]>([]);
  const [unmatchedAPItems, setUnmatchedAPItems] = useState<UnmatchedAP[]>([]);
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
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/ap-rec/reconciliation?companyId=${companyId}&period=${period}`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        console.log('AP Reconciliation data loaded:', data);
        
        // Transform the data structure to match our expected format
        const transformedData: APReconciliationResult = {
          unmatched_vendor: data.unmatchedVendor || data.unmatched_vendor || [],
          unmatched_ap: data.unmatchedAP || data.unmatched_ap || [],
          summary: data.summary || {
            total_vendor_transactions: (data.matches?.length || 0) + (data.unmatchedVendor?.length || 0),
            total_ap_entries: (data.matches?.length || 0) + (data.unmatchedAP?.length || 0),
            matched_count: data.matches?.length || 0,
            unmatched_vendor_count: data.unmatchedVendor?.length || 0,
            unmatched_ap_count: data.unmatchedAP?.length || 0,
          },
          resolved_items: data.resolved_items || [],
          follow_up_items: data.follow_up_items || [],
          timing_differences: data.timing_differences || [],
          ignored_items: data.ignored_items || [],
          pre_matched_items: [],
          locked: data.locked || false,
        };

        // Convert matched_pairs to pre_matched_items format
        if (data.matches && data.matches.length > 0) {
          transformedData.pre_matched_items = data.matches.map((match: any, idx: number) => ({
            matchGroupId: `pre-match-${idx}`,
            vendorTransactions: Array.isArray(match.vendor_transaction) ? match.vendor_transaction : [match.vendor_transaction],
            apEntries: match.ap_entries || [],
            matchedAt: new Date().toISOString(),
            confidence: match.match_confidence || match.confidence,
          }));
        }
        
        setReconciliationResult(transformedData);
        
        // Initialize optimistic update state
        setUnmatchedVendorItems(transformedData.unmatched_vendor || []);
        setUnmatchedAPItems(transformedData.unmatched_ap || []);
        setResolvedItems(transformedData.resolved_items || []);
        setFollowUpItems(transformedData.follow_up_items || []);
      } else {
        const errorText = await response.text();
        console.error('Failed to load AP reconciliation data:', response.status, errorText);
        setReconciliationResult(null);
      }
    } catch (error) {
      console.error('Failed to load AP reconciliation data:', error);
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

  const getPeriodLabel = (period: string) => {
    const [year, month] = period.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const handleEditVendorTransaction = (item: UnmatchedVendor) => {
    setEditingItem({...item.transaction});
    setEditingType('vendor');
    setSelectedVendorItem(item);
    setShowEditDialog(true);
  };

  const handleEditAPEntry = (item: UnmatchedAP) => {
    setEditingItem({...item.entry});
    setEditingType('ap');
    setSelectedAPItem(item);
    setShowEditDialog(true);
  };

  const handleSaveEdit = async () => {
    if (!editingItem) return;

    console.log('Saving edited item:', editingItem, editingType);
    
    const originalItem = editingType === 'vendor' 
      ? selectedVendorItem?.transaction 
      : selectedAPItem?.entry;
    
    if (!originalItem) {
      toast.error('Original item not found');
      return;
    }

    // Optimistic update
    if (editingType === 'vendor' && editingItem) {
      setUnmatchedVendorItems(prev => prev.map(item => 
        item.transaction.id === editingItem.id 
          ? { ...item, transaction: { ...item.transaction, ...editingItem } }
          : item
      ));
      
      setFollowUpItems(prev => prev.map(followUpItem => {
        if (followUpItem.type === 'vendor' && followUpItem.item?.transaction?.id === editingItem.id) {
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
      
      setResolvedItems(prev => prev.map(resolvedItem => {
        if (resolvedItem.type === 'vendor' && resolvedItem.item?.transaction?.id === editingItem.id) {
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
    } else if (editingType === 'ap' && editingItem) {
      setUnmatchedAPItems(prev => prev.map(item => 
        item.entry.id === editingItem.id 
          ? { ...item, entry: { ...item.entry, ...editingItem } }
          : item
      ));
      
      setFollowUpItems(prev => prev.map(followUpItem => {
        if (followUpItem.type === 'ap' && followUpItem.item?.entry?.id === editingItem.id) {
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
      
      setResolvedItems(prev => prev.map(resolvedItem => {
        if (resolvedItem.type === 'ap' && resolvedItem.item?.entry?.id === editingItem.id) {
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
        console.log('✅ Transaction updated successfully in backend');
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
    const itemId = type === 'vendor' ? (item as UnmatchedVendor).transaction.id : (item as UnmatchedAP).entry.id;
    const actionKey = `approve-${type}-${itemId}`;
    setLoadingActions(prev => ({ ...prev, [actionKey]: true }));
    
    // Optimistic update
    if (type === 'vendor') {
      setUnmatchedVendorItems(prev => prev.filter(i => i.transaction.id !== itemId));
      setResolvedItems(prev => [...prev, {
        type: 'vendor' as const,
        item: item as UnmatchedVendor,
        markedAt: new Date().toISOString(),
        status: 'resolved',
        resolution: 'Transaction sent to Journal Entries section to be recorded'
      }]);
    } else {
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
        if (type === 'vendor') {
          setUnmatchedVendorItems(prev => [...prev, item as UnmatchedVendor]);
          setResolvedItems(prev => prev.filter(i => 
            !(i.type === 'vendor' && i.item?.transaction?.id === itemId)
          ));
        } else {
          setUnmatchedAPItems(prev => [...prev, item as UnmatchedAP]);
          setResolvedItems(prev => prev.filter(i => 
            !(i.type === 'ap' && i.item?.entry?.id === itemId)
          ));
        }
      }
    } catch (error) {
      console.error('Failed to approve transaction:', error);
      toast.error('Failed to approve transaction. Please try again.');
      // Revert optimistic update on error
      if (type === 'vendor') {
        setUnmatchedVendorItems(prev => [...prev, item as UnmatchedVendor]);
        setResolvedItems(prev => prev.filter(i => 
          !(i.type === 'vendor' && i.item?.transaction?.id === itemId)
        ));
      } else {
        setUnmatchedAPItems(prev => [...prev, item as UnmatchedAP]);
        setResolvedItems(prev => prev.filter(i => 
          !(i.type === 'ap' && i.item?.entry?.id === itemId)
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
    const itemId = type === 'vendor' ? (item as UnmatchedVendor).transaction.id : (item as UnmatchedAP).entry.id;
    const actionKey = `timing-${type}-${itemId}`;
    setLoadingActions(prev => ({ ...prev, [actionKey]: true }));
    
    // Optimistic update
    if (type === 'vendor') {
      setUnmatchedVendorItems(prev => prev.filter(i => i.transaction.id !== itemId));
      setResolvedItems(prev => [...prev, {
        type: 'vendor' as const,
        item: item as UnmatchedVendor,
        markedAt: new Date().toISOString(),
        status: 'timing_difference',
        resolution: 'Will clear next period',
        matchGroupId: `timing-${itemId}`
      }]);
    } else {
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
        if (type === 'vendor') {
          setUnmatchedVendorItems(prev => [...prev, item as UnmatchedVendor]);
          setResolvedItems(prev => prev.filter(r => r.matchGroupId !== `timing-${itemId}`));
        } else {
          setUnmatchedAPItems(prev => [...prev, item as UnmatchedAP]);
          setResolvedItems(prev => prev.filter(r => r.matchGroupId !== `timing-${itemId}`));
        }
      }
    } catch (error) {
      console.error('Failed to mark as timing difference:', error);
      toast.error('Failed to mark as timing difference.');
      // Revert optimistic update
      if (type === 'vendor') {
        setUnmatchedVendorItems(prev => [...prev, item as UnmatchedVendor]);
        setResolvedItems(prev => prev.filter(r => r.matchGroupId !== `timing-${itemId}`));
      } else {
        setUnmatchedAPItems(prev => [...prev, item as UnmatchedAP]);
        setResolvedItems(prev => prev.filter(r => r.matchGroupId !== `timing-${itemId}`));
      }
    } finally {
      setLoadingActions(prev => ({ ...prev, [actionKey]: false }));
    }
  };

  const handleMarkAsIgnored = async (item: UnmatchedVendor | UnmatchedAP, type: 'vendor' | 'ap') => {
    const itemId = type === 'vendor' ? (item as UnmatchedVendor).transaction.id : (item as UnmatchedAP).entry.id;
    const actionKey = `ignore-${type}-${itemId}`;
    setLoadingActions(prev => ({ ...prev, [actionKey]: true }));
    
    // Optimistic update
    if (type === 'vendor') {
      setUnmatchedVendorItems(prev => prev.filter(i => i.transaction.id !== itemId));
      setResolvedItems(prev => [...prev, {
        type: 'vendor' as const,
        item: item as UnmatchedVendor,
        markedAt: new Date().toISOString(),
        status: 'ignored',
        resolution: 'Marked as non-issue',
        matchGroupId: `ignored-${itemId}`
      }]);
    } else {
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
        if (type === 'vendor') {
          setUnmatchedVendorItems(prev => [...prev, item as UnmatchedVendor]);
          setResolvedItems(prev => prev.filter(r => r.matchGroupId !== `ignored-${itemId}`));
        } else {
          setUnmatchedAPItems(prev => [...prev, item as UnmatchedAP]);
          setResolvedItems(prev => prev.filter(r => r.matchGroupId !== `ignored-${itemId}`));
        }
      }
    } catch (error) {
      console.error('Failed to mark as ignored:', error);
      toast.error('Failed to mark as ignored.');
      // Revert optimistic update
      if (type === 'vendor') {
        setUnmatchedVendorItems(prev => [...prev, item as UnmatchedVendor]);
        setResolvedItems(prev => prev.filter(r => r.matchGroupId !== `ignored-${itemId}`));
      } else {
        setUnmatchedAPItems(prev => [...prev, item as UnmatchedAP]);
        setResolvedItems(prev => prev.filter(r => r.matchGroupId !== `ignored-${itemId}`));
      }
    } finally {
      setLoadingActions(prev => ({ ...prev, [actionKey]: false }));
    }
  };

  const handleOpenFollowUpDialog = (item: UnmatchedVendor | UnmatchedAP, type: 'vendor' | 'ap') => {
    if (type === 'vendor') {
      setSelectedVendorItem(item as UnmatchedVendor);
      setSelectedAPItem(null);
    } else {
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
    const itemId = type === 'vendor' ? (item as UnmatchedVendor)?.transaction.id : (item as UnmatchedAP)?.entry.id;

    // Optimistic update
    if (type === 'vendor' && item) {
      setUnmatchedVendorItems(prev => prev.filter(i => i.transaction.id !== itemId));
      setFollowUpItems(prev => [...prev, {
        item: item as UnmatchedVendor,
        type: 'vendor' as const,
        note: followUpNote,
        markedAt: new Date().toISOString()
      }]);
    } else if (type === 'ap' && item) {
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

  const handleOpenMatchDialog = (item: UnmatchedVendor) => {
    setMatchingVendorItem(item);
    setSelectedVendorItems([item]); // Pre-select the clicked item
    setSelectedAPItems([]);
    setShowMatchDialog(true);
  };

  const toggleVendorSelection = (item: UnmatchedVendor) => {
    setSelectedVendorItems(prev => {
      const isSelected = prev.some(i => i.transaction.id === item.transaction.id);
      if (isSelected) {
        return prev.filter(i => i.transaction.id !== item.transaction.id);
      } else {
        return [...prev, item];
      }
    });
  };

  const toggleAPSelection = (item: UnmatchedAP) => {
    setSelectedAPItems(prev => {
      const isSelected = prev.some(i => i.entry.id === item.entry.id);
      if (isSelected) {
        return prev.filter(i => i.entry.id !== item.entry.id);
      } else {
        return [...prev, item];
      }
    });
  };

  const getTotalAmount = (items: (UnmatchedVendor | UnmatchedAP)[]) => {
    return items.reduce((sum, item) => {
      const amount = 'transaction' in item ? item.transaction.amount : item.entry.amount;
      return sum + amount;
    }, 0);
  };

  const handleMatchItems = async (apItem?: UnmatchedAP) => {
    // If apItem is provided (old single-select flow), use it
    // Otherwise use the multi-select arrays
    const vendorItems = selectedVendorItems.length > 0 ? selectedVendorItems : (matchingVendorItem ? [matchingVendorItem] : []);
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
        setMatchingVendorItem(null);
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

  const groupResolvedItems = () => {
    if (!resolvedItems) return [];
    
    const groups = new Map<string, ResolvedItem[]>();
    
    resolvedItems
      .filter(item => item && item.item)
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

  if (isLoadingReconciliation) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Loader2 className="size-8 text-gray-400 animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">Loading AP reconciliation data...</p>
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
      <Toaster />
      
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
        <TabsContent value="needs-attention" className="space-y-6">
          {/* Unmatched Vendor Transactions */}
          <Card>
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
                          <div className={`text-lg font-medium mb-2 ${item.transaction.amount >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                            €{formatCurrency(Math.abs(item.transaction.amount))}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 pt-2 border-t border-red-200">
                        <Button 
                          type="button"
                          size="sm" 
                          className="gap-2 bg-green-600 hover:bg-green-700"
                          onClick={() => handleApproveForJE(item, 'vendor')}
                          disabled={isMonthLocked || loadingActions[`approve-vendor-${item.transaction.id}`]}
                        >
                          {loadingActions[`approve-vendor-${item.transaction.id}`] ? (
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
                              Match to AP Entry
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>

                        <Button 
                          type="button"
                          size="sm" 
                          variant="outline"
                          className="gap-2"
                          onClick={() => handleEditVendorTransaction(item)}
                          disabled={isMonthLocked}
                        >
                          <Edit2 className="size-3" />
                          Edit / Correct
                        </Button>

                        <DropdownMenu modal={false}>
                          <DropdownMenuTrigger asChild>
                            <Button type="button" size="sm" variant="outline" className="gap-2">
                              More Actions
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" side="bottom" sideOffset={8} className="w-64">
                            <DropdownMenuItem 
                              className="cursor-pointer"
                              onClick={() => handleMarkAsTimingDifference(item, 'vendor')}
                            >
                              <Clock className="size-4 mr-2 text-blue-600" />
                              <div>
                                <div className="text-sm">Mark as Timing Difference</div>
                                <div className="text-xs text-gray-500">Clears next month/period</div>
                              </div>
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              className="cursor-pointer"
                              onClick={() => handleMarkAsIgnored(item, 'vendor')}
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
                              onClick={() => handleOpenFollowUpDialog(item, 'vendor')}
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
                              onClick={() => handleDeleteTransaction(item, 'vendor')}
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
                  <p className="text-sm text-gray-600">All vendor transactions have been matched!</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Unmatched AP Entries */}
          <Card>
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
                          <div className={`text-lg font-medium ${item.entry.amount >= 0 ? 'text-red-600' : 'text-green-600'}`}>
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
                          disabled={isMonthLocked || loadingActions[`reverse-ap-${item.entry.id}`]}
                        >
                          {loadingActions[`reverse-ap-${item.entry.id}`] ? (
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
                          onClick={() => handleEditAPEntry(item)}
                          disabled={isMonthLocked}
                        >
                          <Edit2 className="size-3" />
                          Edit / Correct
                        </Button>

                        <DropdownMenu modal={false}>
                          <DropdownMenuTrigger asChild>
                            <Button type="button" size="sm" variant="outline" className="gap-2">
                              More Actions
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" side="bottom" sideOffset={8} className="w-64">
                            <DropdownMenuItem 
                              className="cursor-pointer"
                              onClick={() => handleMarkAsTimingDifference(item, 'ap')}
                            >
                              <Clock className="size-4 mr-2 text-blue-600" />
                              <div>
                                <div className="text-sm">Mark as Timing Difference</div>
                                <div className="text-xs text-gray-500">Clears next month/period</div>
                              </div>
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              className="cursor-pointer"
                              onClick={() => handleMarkAsIgnored(item, 'ap')}
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
                              onClick={() => handleOpenFollowUpDialog(item, 'ap')}
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
                              onClick={() => handleDeleteTransaction(item, 'ap')}
                            >
                              <Trash2 className="size-4 mr-2" />
                              <div>
                                <div className="text-sm">Delete Entry</div>
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
                  <p className="text-sm text-gray-600">All AP entries have been matched!</p>
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
                              €{formatCurrency(Math.abs(transaction.amount))}
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
                                        €{formatCurrency(Math.abs(transaction.amount))}
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
                                <p>Vendor Total: €{formatCurrency(vendorTotal)}</p>
                                <p>AP Total: €{formatCurrency(apTotal)}</p>
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
                                      €{formatCurrency(Math.abs(transaction.amount))}
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
                                      €{formatCurrency(Math.abs(entry.amount))}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="ml-4">
                            <div className="text-lg font-medium text-blue-600">
                              €{formatCurrency(vendorTotal)}
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
                  onChange={(e) => setEditingItem({ ...editingItem, description: e.target.value })}
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
                  AP statement clarification
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
              Select one or more vendor transactions and one or more AP entries to match them together. Supports many-to-many matching.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto">
            <div className="grid grid-cols-2 gap-6">
              {/* Vendor Transactions Column */}
              <div className="space-y-3">
                <div className="sticky top-0 bg-white pb-3 border-b border-gray-200 z-10">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-gray-900 flex items-center gap-2">
                      <FileSpreadsheet className="size-4 text-red-600" />
                      Vendor Transactions
                    </h3>
                    <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                      {selectedVendorItems.length} selected
                    </Badge>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded p-3">
                    <div className="text-sm font-medium text-blue-900">Selected Total:</div>
                    <div className={`text-2xl font-medium ${getTotalAmount(selectedVendorItems) >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                      €{formatCurrency(Math.abs(getTotalAmount(selectedVendorItems)))}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  {unmatchedVendorItems && unmatchedVendorItems.map((item, idx) => {
                    const isSelected = selectedVendorItems.some(i => i.transaction.id === item.transaction.id);
                    return (
                      <div 
                        key={idx} 
                        className={`p-3 rounded-lg border-2 transition-all cursor-pointer ${
                          isSelected 
                            ? 'bg-blue-100 border-blue-500 shadow-md' 
                            : 'bg-red-50 border-red-200 hover:border-red-400'
                        }`}
                        onClick={() => toggleVendorSelection(item)}
                      >
                        <div className="flex items-start gap-3">
                          <Checkbox 
                            checked={isSelected}
                            onCheckedChange={() => toggleVendorSelection(item)}
                            className="mt-1"
                          />
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-medium text-gray-900">{item.transaction.description}</span>
                              <div className={`text-lg font-medium ${item.transaction.amount >= 0 ? 'text-red-600' : 'text-green-600'}`}>
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

              {/* AP Entries Column */}
              <div className="space-y-3">
                <div className="sticky top-0 bg-white pb-3 border-b border-gray-200 z-10">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-gray-900 flex items-center gap-2">
                      <BookOpen className="size-4 text-amber-600" />
                      AP Entries
                    </h3>
                    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                      {selectedAPItems.length} selected
                    </Badge>
                  </div>
                  <div className="bg-purple-50 border border-purple-200 rounded p-3">
                    <div className="text-sm font-medium text-purple-900">Selected Total:</div>
                    <div className={`text-2xl font-medium ${getTotalAmount(selectedAPItems) >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                      €{formatCurrency(Math.abs(getTotalAmount(selectedAPItems)))}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  {unmatchedAPItems && unmatchedAPItems.map((item, idx) => {
                    const isSelected = selectedAPItems.some(i => i.entry.id === item.entry.id);
                    return (
                      <div 
                        key={idx} 
                        className={`p-3 rounded-lg border-2 transition-all cursor-pointer ${
                          isSelected 
                            ? 'bg-purple-100 border-purple-500 shadow-md' 
                            : 'bg-amber-50 border-amber-200 hover:border-amber-400'
                        }`}
                        onClick={() => toggleAPSelection(item)}
                      >
                        <div className="flex items-start gap-3">
                          <Checkbox 
                            checked={isSelected}
                            onCheckedChange={() => toggleAPSelection(item)}
                            className="mt-1"
                          />
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-medium text-gray-900">{item.entry.description}</span>
                              <div className={`text-lg font-medium ${item.entry.amount >= 0 ? 'text-red-600' : 'text-green-600'}`}>
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
          {(selectedVendorItems.length > 0 || selectedAPItems.length > 0) && (
            <div className="border-t border-gray-200 pt-4">
              <div className={`p-4 rounded-lg border-2 ${
                Math.abs(getTotalAmount(selectedVendorItems) - getTotalAmount(selectedAPItems)) < 0.01
                  ? 'bg-green-50 border-green-500'
                  : 'bg-yellow-50 border-yellow-500'
              }`}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-gray-900 mb-1">
                      {Math.abs(getTotalAmount(selectedVendorItems) - getTotalAmount(selectedAPItems)) < 0.01 ? (
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
                      Vendor: €{formatCurrency(Math.abs(getTotalAmount(selectedVendorItems)))} | 
                      AP: €{formatCurrency(Math.abs(getTotalAmount(selectedAPItems)))} | 
                      Diff: €{formatCurrency(Math.abs(getTotalAmount(selectedVendorItems) - getTotalAmount(selectedAPItems)))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setShowMatchDialog(false)}>
              Cancel
            </Button>
            <Button 
              type="button"
              onClick={() => handleMatchItems()}
              disabled={isMonthLocked || selectedVendorItems.length === 0 || selectedAPItems.length === 0}
            >
              Match Selected Items
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
