import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  ArrowLeft,
  CheckCircle2,
  FileSpreadsheet,
  AlertCircle,
  Clock,
  MessageSquare,
  Loader2,
  ThumbsUp,
  X,
  Trash2,
  Undo2,
  Receipt,
  Lock,
  FileText,
  Link,
  ChevronDown,
  Edit2
} from 'lucide-react';
import { projectId, publicAnonKey } from '@/utils/supabase/info';
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
import { motion, AnimatePresence } from 'motion/react';
import { UnmatchedItemCard } from './shared/ReconciliationItemCard';
import { ReconciliationMatchDialog } from './shared/ReconciliationMatchDialog';
import { ReconciliationFollowUpDialog } from './shared/ReconciliationFollowUpDialog';

interface ARRecReviewProps {
  companyId: string;
  companyName: string;
  period: string;
  onBack: () => void;
}

interface Payment {
  id: string;
  date: string;
  description: string;
  amount: number;
  balance?: number;
  statementId?: string;
  statement?: string;
  customer?: string;
  currency?: string;
}

interface Invoice {
  id: string;
  invoice_number: string;
  customer: string;
  date: string;
  due_date?: string;
  amount: number;
  currency?: string;
  gross_amount?: number;
  applied_credits?: number;
  credit_memo_refs?: string;
}

interface UnmatchedPayment {
  payment: Payment;
  suggested_action: string;
  reason?: string;
  suggested_je?: {
    description: string;
    debit_account: string;
    credit_account: string;
    amount: number;
  };
}

interface UnmatchedInvoice {
  invoice: Invoice;
  reason: string;
  action: string;
}

interface ResolvedItem {
  type: 'payment' | 'invoice';
  item: UnmatchedPayment | UnmatchedInvoice;
  markedAt: string;
  status: string;
  resolution: string;
  matchGroupId?: string;
}

interface FollowUpItem {
  type: 'payment' | 'invoice';
  item: UnmatchedPayment | UnmatchedInvoice;
  note: string;
  markedAt: string;
  status?: string;
}

interface PreMatchedItem {
  matchGroupId: string;
  payments: Payment[];
  invoices: Invoice[];
  matchedAt: string;
  confidence?: number;
}

interface ARReconciliationResult {
  unmatched_payments: UnmatchedPayment[];
  unmatched_invoices: UnmatchedInvoice[];
  summary: {
    total_payments: number;
    total_invoices: number;
    matched_count: number;
    unmatched_payments_count: number;
    unmatched_invoices_count: number;
  };
  resolved_items: ResolvedItem[];
  follow_up_items: FollowUpItem[];
  timing_differences: any[];
  ignored_items: any[];
  pre_matched_items?: PreMatchedItem[];
  locked?: boolean;
}

export function ARRecReview({ companyId, companyName, period, onBack }: ARRecReviewProps) {
  const [reconciliationResult, setReconciliationResult] = useState<ARReconciliationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showFollowUpDialog, setShowFollowUpDialog] = useState(false);
  const [followUpNote, setFollowUpNote] = useState('');
  const [activeTab, setActiveTab] = useState<'needs-attention' | 'follow-up' | 'resolved' | 'pre-matched'>('needs-attention');

  // Loading states for individual actions
  const [loadingActions, setLoadingActions] = useState<Record<string, boolean>>({});

  // Match Dialog state
  const [showMatchDialog, setShowMatchDialog] = useState(false);
  const [matchSelectedPayments, setMatchSelectedPayments] = useState<any[]>([]); // Using any[] to avoid import complexity for now, or match MatchItem structure
  const [matchSelectedInvoices, setMatchSelectedInvoices] = useState<any[]>([]);
  const [isMatching, setIsMatching] = useState(false);

  // Optimistic update state - separate from reconciliationResult for real-time updates
  const [unmatchedPaymentItems, setUnmatchedPaymentItems] = useState<UnmatchedPayment[]>([]);
  const [unmatchedInvoiceItems, setUnmatchedInvoiceItems] = useState<UnmatchedInvoice[]>([]);
  const [resolvedItems, setResolvedItems] = useState<ResolvedItem[]>([]);
  const [followUpItems, setFollowUpItems] = useState<FollowUpItem[]>([]);
  const [currentFollowUpItem, setCurrentFollowUpItem] = useState<{ type: 'payment' | 'invoice', item: any } | null>(null);

  // Period lock state
  const [isMonthLocked, setIsMonthLocked] = useState(false);
  const [lockDetails, setLockDetails] = useState<any>(null);

  // Load reconciliation data on mount
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
    setIsLoading(true);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/ar-rec/reconciliation?companyId=${companyId}&period=${period}`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        console.log('AR Reconciliation data loaded:', data);

        // Unwrap the reconciliation object from the API response
        const reconciliation = data.reconciliation || data;

        // Set the reconciliation result with defaults
        const reconciliationData: ARReconciliationResult = {
          unmatched_payments: reconciliation.unmatched_payments || [],
          unmatched_invoices: reconciliation.unmatched_invoices || [],
          summary: reconciliation.summary || {
            total_payments: 0,
            total_invoices: 0,
            matched_count: 0,
            unmatched_payments_count: 0,
            unmatched_invoices_count: 0,
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
        setUnmatchedPaymentItems(reconciliationData.unmatched_payments || []);
        setUnmatchedInvoiceItems(reconciliationData.unmatched_invoices || []);
        setResolvedItems(reconciliationData.resolved_items || []);
        setFollowUpItems(reconciliationData.follow_up_items || []);
      } else {
        const errorText = await response.text();
        console.error('Failed to load AR reconciliation:', response.status, errorText);
        setReconciliationResult(null);
      }
    } catch (error) {
      console.error('Failed to load AR reconciliation data:', error);
      setReconciliationResult(null);
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (amount: number, currency?: string) => {
    const symbol = currency === 'EUR' ? '€' : '$';
    return `${symbol}${Math.abs(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const handleApproveForJE = async (item: UnmatchedPayment | UnmatchedInvoice, type: 'payment' | 'invoice') => {
    const itemId = type === 'payment' ? (item as UnmatchedPayment).payment.id : (item as UnmatchedInvoice).invoice.id;
    const actionKey = `approve-${type}-${itemId}`;
    setLoadingActions(prev => ({ ...prev, [actionKey]: true }));

    // Optimistic update - remove from unmatched, add to resolved
    if (type === 'payment') {
      setUnmatchedPaymentItems(prev => prev.filter(i => i.payment.id !== itemId));
      setResolvedItems(prev => [...prev, {
        type: 'payment' as const,
        item: item as UnmatchedPayment,
        markedAt: new Date().toISOString(),
        status: 'approved_for_je',
        resolution: 'Approved for journal entry',
        matchGroupId: `je-${itemId}`
      }]);
    } else {
      setUnmatchedInvoiceItems(prev => prev.filter(i => i.invoice.id !== itemId));
      setResolvedItems(prev => [...prev, {
        type: 'invoice' as const,
        item: item as UnmatchedInvoice,
        markedAt: new Date().toISOString(),
        status: 'approved_for_je',
        resolution: 'Approved for journal entry',
        matchGroupId: `je-${itemId}`
      }]);
    }

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/ar-rec/approve-for-je`,
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
        toast.success('Approved for journal entry! This will be included in month-end JE package.');
      } else {
        toast.error('Failed to approve for journal entry.');
        // Revert optimistic update
        if (type === 'payment') {
          setUnmatchedPaymentItems(prev => [...prev, item as UnmatchedPayment]);
          setResolvedItems(prev => prev.filter(r => r.matchGroupId !== `je-${itemId}`));
        } else {
          setUnmatchedInvoiceItems(prev => [...prev, item as UnmatchedInvoice]);
          setResolvedItems(prev => prev.filter(r => r.matchGroupId !== `je-${itemId}`));
        }
      }
    } catch (error) {
      console.error('Failed to approve for journal entry:', error);
      toast.error('Failed to approve for journal entry.');
      // Revert optimistic update
      if (type === 'payment') {
        setUnmatchedPaymentItems(prev => [...prev, item as UnmatchedPayment]);
        setResolvedItems(prev => prev.filter(r => r.matchGroupId !== `je-${itemId}`));
      } else {
        setUnmatchedInvoiceItems(prev => [...prev, item as UnmatchedInvoice]);
        setResolvedItems(prev => prev.filter(r => r.matchGroupId !== `je-${itemId}`));
      }
    } finally {
      setLoadingActions(prev => ({ ...prev, [actionKey]: false }));
    }
  };

  const handleMarkAsTimingDifference = async (item: UnmatchedPayment | UnmatchedInvoice, type: 'payment' | 'invoice') => {
    const itemId = type === 'payment' ? (item as UnmatchedPayment).payment.id : (item as UnmatchedInvoice).invoice.id;
    const actionKey = `timing-${type}-${itemId}`;
    setLoadingActions(prev => ({ ...prev, [actionKey]: true }));

    // Optimistic update
    if (type === 'payment') {
      setUnmatchedPaymentItems(prev => prev.filter(i => i.payment.id !== itemId));
      setResolvedItems(prev => [...prev, {
        type: 'payment' as const,
        item: item as UnmatchedPayment,
        markedAt: new Date().toISOString(),
        status: 'timing_difference',
        resolution: 'Timing difference - will clear next period',
        matchGroupId: `timing-${itemId}`
      }]);
    } else {
      setUnmatchedInvoiceItems(prev => prev.filter(i => i.invoice.id !== itemId));
      setResolvedItems(prev => [...prev, {
        type: 'invoice' as const,
        item: item as UnmatchedInvoice,
        markedAt: new Date().toISOString(),
        status: 'timing_difference',
        resolution: 'Timing difference - will clear next period',
        matchGroupId: `timing-${itemId}`
      }]);
    }

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/ar-rec/mark-timing-difference`,
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
        if (type === 'payment') {
          setUnmatchedPaymentItems(prev => [...prev, item as UnmatchedPayment]);
          setResolvedItems(prev => prev.filter(r => r.matchGroupId !== `timing-${itemId}`));
        } else {
          setUnmatchedInvoiceItems(prev => [...prev, item as UnmatchedInvoice]);
          setResolvedItems(prev => prev.filter(r => r.matchGroupId !== `timing-${itemId}`));
        }
      }
    } catch (error) {
      console.error('Failed to mark as timing difference:', error);
      toast.error('Failed to mark as timing difference.');
      // Revert optimistic update
      if (type === 'payment') {
        setUnmatchedPaymentItems(prev => [...prev, item as UnmatchedPayment]);
        setResolvedItems(prev => prev.filter(r => r.matchGroupId !== `timing-${itemId}`));
      } else {
        setUnmatchedInvoiceItems(prev => [...prev, item as UnmatchedInvoice]);
        setResolvedItems(prev => prev.filter(r => r.matchGroupId !== `timing-${itemId}`));
      }
    } finally {
      setLoadingActions(prev => ({ ...prev, [actionKey]: false }));
    }
  };

  const handleMarkAsIgnored = async (item: UnmatchedPayment | UnmatchedInvoice, type: 'payment' | 'invoice') => {
    const itemId = type === 'payment' ? (item as UnmatchedPayment).payment.id : (item as UnmatchedInvoice).invoice.id;
    const actionKey = `ignore-${type}-${itemId}`;
    setLoadingActions(prev => ({ ...prev, [actionKey]: true }));

    // Optimistic update
    if (type === 'payment') {
      setUnmatchedPaymentItems(prev => prev.filter(i => i.payment.id !== itemId));
      setResolvedItems(prev => [...prev, {
        type: 'payment' as const,
        item: item as UnmatchedPayment,
        markedAt: new Date().toISOString(),
        status: 'ignored',
        resolution: 'Marked as non-issue',
        matchGroupId: `ignored-${itemId}`
      }]);
    } else {
      setUnmatchedInvoiceItems(prev => prev.filter(i => i.invoice.id !== itemId));
      setResolvedItems(prev => [...prev, {
        type: 'invoice' as const,
        item: item as UnmatchedInvoice,
        markedAt: new Date().toISOString(),
        status: 'ignored',
        resolution: 'Marked as non-issue',
        matchGroupId: `ignored-${itemId}`
      }]);
    }

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/ar-rec/mark-ignored`,
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
        if (type === 'payment') {
          setUnmatchedPaymentItems(prev => [...prev, item as UnmatchedPayment]);
          setResolvedItems(prev => prev.filter(r => r.matchGroupId !== `ignored-${itemId}`));
        } else {
          setUnmatchedInvoiceItems(prev => [...prev, item as UnmatchedInvoice]);
          setResolvedItems(prev => prev.filter(r => r.matchGroupId !== `ignored-${itemId}`));
        }
      }
    } catch (error) {
      console.error('Failed to mark as ignored:', error);
      toast.error('Failed to mark as ignored.');
      // Revert optimistic update
      if (type === 'payment') {
        setUnmatchedPaymentItems(prev => [...prev, item as UnmatchedPayment]);
        setResolvedItems(prev => prev.filter(r => r.matchGroupId !== `ignored-${itemId}`));
      } else {
        setUnmatchedInvoiceItems(prev => [...prev, item as UnmatchedInvoice]);
        setResolvedItems(prev => prev.filter(r => r.matchGroupId !== `ignored-${itemId}`));
      }
    } finally {
      setLoadingActions(prev => ({ ...prev, [actionKey]: false }));
    }
  };

  const handleOpenFollowUpDialog = (item: UnmatchedPayment | UnmatchedInvoice, type: 'payment' | 'invoice') => {
    setCurrentFollowUpItem({ type, item });
    setFollowUpNote('');
    setShowFollowUpDialog(true);
  };

  const handleRequestInformation = async (note?: string) => {
    const noteToUse = note || followUpNote;
    if (!noteToUse.trim()) {
      alert('Please enter a note about what information is needed.');
      return;
    }

    const item = currentFollowUpItem?.item;
    const type = currentFollowUpItem?.type;
    if (!item || !type) return;

    const itemId = type === 'payment' ? (item as UnmatchedPayment).payment.id : (item as UnmatchedInvoice).invoice.id;

    // Optimistic update
    if (type === 'payment') {
      setUnmatchedPaymentItems(prev => prev.filter(i => i.payment.id !== itemId));
      setFollowUpItems(prev => [...prev, {
        item: item as UnmatchedPayment,
        type: 'payment' as const,
        note: noteToUse,
        markedAt: new Date().toISOString()
      }]);
    } else {
      setUnmatchedInvoiceItems(prev => prev.filter(i => i.invoice.id !== itemId));
      setFollowUpItems(prev => [...prev, {
        item: item as UnmatchedInvoice,
        type: 'invoice' as const,
        note: noteToUse,
        markedAt: new Date().toISOString()
      }]);
    }

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/ar-rec/request-information`,
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
            note: noteToUse,
          }),
        }
      );

      if (response.ok) {
        toast.success('Marked for follow-up. A notification has been created.');
        setShowFollowUpDialog(false);
      } else {
        toast.error('Failed to mark for follow-up.');
        // Revert optimistic update
        if (type === 'payment') {
          setUnmatchedPaymentItems(prev => [...prev, item as UnmatchedPayment]);
          setFollowUpItems(prev => prev.filter(f => {
            const fItemId = f.type === 'payment' ? (f.item as UnmatchedPayment).payment.id : null;
            return fItemId !== itemId;
          }));
        } else {
          setUnmatchedInvoiceItems(prev => [...prev, item as UnmatchedInvoice]);
          setFollowUpItems(prev => prev.filter(f => {
            const fItemId = f.type === 'invoice' ? (f.item as UnmatchedInvoice).invoice.id : null;
            return fItemId !== itemId;
          }));
        }
      }
    } catch (error) {
      console.error('Failed to request information:', error);
      toast.error('Failed to mark for follow-up.');
      // Revert optimistic update
      if (type === 'payment') {
        setUnmatchedPaymentItems(prev => [...prev, item as UnmatchedPayment]);
        setFollowUpItems(prev => prev.filter(f => {
          const fItemId = f.type === 'payment' ? (f.item as UnmatchedPayment).payment.id : null;
          return fItemId !== itemId;
        }));
      } else {
        setUnmatchedInvoiceItems(prev => [...prev, item as UnmatchedInvoice]);
        setFollowUpItems(prev => prev.filter(f => {
          const fItemId = f.type === 'invoice' ? (f.item as UnmatchedInvoice).invoice.id : null;
          return fItemId !== itemId;
        }));
      }
    }
  };

  const handleReverseResolvedItem = async (resolvedItem: ResolvedItem) => {
    const item = resolvedItem.item;
    const type = resolvedItem.type;
    const itemId = type === 'payment' ? (item as UnmatchedPayment).payment.id : (item as UnmatchedInvoice).invoice.id;
    const actionKey = `reverse-${type}-${itemId}`;
    setLoadingActions(prev => ({ ...prev, [actionKey]: true }));

    // Optimistic update - remove from resolved, add back to unmatched
    const resolvedItemToRemove = resolvedItems.find(r => {
      if (type === 'payment') {
        return r.type === 'payment' && (r.item as UnmatchedPayment).payment.id === itemId;
      } else {
        return r.type === 'invoice' && (r.item as UnmatchedInvoice).invoice.id === itemId;
      }
    });

    setResolvedItems(prev => prev.filter(r => {
      if (type === 'payment') {
        return !(r.type === 'payment' && (r.item as UnmatchedPayment).payment.id === itemId);
      } else {
        return !(r.type === 'invoice' && (r.item as UnmatchedInvoice).invoice.id === itemId);
      }
    }));

    if (type === 'payment') {
      setUnmatchedPaymentItems(prev => [...prev, item as UnmatchedPayment]);
    } else {
      setUnmatchedInvoiceItems(prev => [...prev, item as UnmatchedInvoice]);
    }

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/ar-rec/reverse-resolved`,
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
          if (type === 'payment') {
            setUnmatchedPaymentItems(prev => prev.filter(i => i.payment.id !== itemId));
          } else {
            setUnmatchedInvoiceItems(prev => prev.filter(i => i.invoice.id !== itemId));
          }
        }
      }
    } catch (error) {
      console.error('Failed to reverse item:', error);
      toast.error('Failed to reverse item.');
      // Revert optimistic update
      if (resolvedItemToRemove) {
        setResolvedItems(prev => [...prev, resolvedItemToRemove]);
        if (type === 'payment') {
          setUnmatchedPaymentItems(prev => prev.filter(i => i.payment.id !== itemId));
        } else {
          setUnmatchedInvoiceItems(prev => prev.filter(i => i.invoice.id !== itemId));
        }
      }
    } finally {
      setLoadingActions(prev => ({ ...prev, [actionKey]: false }));
    }
  };

  const handleReverseFollowUp = async (followUpItem: FollowUpItem) => {
    const item = followUpItem.item;
    const type = followUpItem.type;
    const itemId = type === 'payment' ? (item as UnmatchedPayment).payment.id : (item as UnmatchedInvoice).invoice.id;
    const actionKey = `reverse-followup-${type}-${itemId}`;
    setLoadingActions(prev => ({ ...prev, [actionKey]: true }));

    // Optimistic update - remove from follow-up items, add back to unmatched
    setFollowUpItems(prev => prev.filter(f => {
      const fItemId = f.type === 'payment' ? (f.item as UnmatchedPayment).payment.id : (f.item as UnmatchedInvoice).invoice.id;
      return fItemId !== itemId;
    }));

    if (type === 'payment') {
      setUnmatchedPaymentItems(prev => [...prev, item as UnmatchedPayment]);
    } else {
      setUnmatchedInvoiceItems(prev => [...prev, item as UnmatchedInvoice]);
    }

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/ar-rec/reverse-follow-up`,
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
        if (type === 'payment') {
          setUnmatchedPaymentItems(prev => prev.filter(i => i.payment.id !== itemId));
        } else {
          setUnmatchedInvoiceItems(prev => prev.filter(i => i.invoice.id !== itemId));
        }
      }
    } catch (error) {
      console.error('Failed to reverse follow-up item:', error);
      toast.error('Failed to reverse follow-up item.');
      // Revert optimistic update
      setFollowUpItems(prev => [...prev, followUpItem]);
      if (type === 'payment') {
        setUnmatchedPaymentItems(prev => prev.filter(i => i.payment.id !== itemId));
      } else {
        setUnmatchedInvoiceItems(prev => prev.filter(i => i.invoice.id !== itemId));
      }
    } finally {
      setLoadingActions(prev => ({ ...prev, [actionKey]: false }));
    }
  };

  const handleOpenMatchDialog = (item?: UnmatchedPayment | UnmatchedInvoice, type?: 'payment' | 'invoice') => {
    setMatchSelectedPayments([]);
    setMatchSelectedInvoices([]);

    if (item && type) {
      const matchItem = {
        id: type === 'payment' ? (item as UnmatchedPayment).payment.id : (item as UnmatchedInvoice).invoice.id,
        date: type === 'payment' ? (item as UnmatchedPayment).payment.date : (item as UnmatchedInvoice).invoice.date,
        description: type === 'payment' ? (item as UnmatchedPayment).payment.description : `Invoice #${(item as UnmatchedInvoice).invoice.invoice_number}`,
        amount: type === 'payment' ? (item as UnmatchedPayment).payment.amount : (item as UnmatchedInvoice).invoice.amount,
        originalItem: item
      };

      if (type === 'payment') {
        setMatchSelectedPayments([matchItem]);
      } else {
        setMatchSelectedInvoices([matchItem]);
      }
    }
    setShowMatchDialog(true);
  };

  const handleMatch = async () => {
    if (matchSelectedPayments.length === 0 && matchSelectedInvoices.length === 0) return;

    setIsMatching(true);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/ar-rec/manual-match`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            companyId,
            period,
            paymentIds: matchSelectedPayments.map(i => i.id),
            invoiceIds: matchSelectedInvoices.map(i => i.id),
          }),
        }
      );

      if (response.ok) {
        toast.success('Items matched successfully!');

        // Optimistic update
        const paymentIds = matchSelectedPayments.map(i => i.id);
        const invoiceIds = matchSelectedInvoices.map(i => i.id);

        setUnmatchedPaymentItems(prev => prev.filter(i => !paymentIds.includes(i.payment.id)));
        setUnmatchedInvoiceItems(prev => prev.filter(i => !invoiceIds.includes(i.invoice.id)));

        loadReconciliationData();

        setShowMatchDialog(false);
        setMatchSelectedPayments([]);
        setMatchSelectedInvoices([]);
      } else {
        toast.error('Failed to match items. Please try again.');
      }
    } catch (error) {
      console.error('Failed to match items:', error);
      toast.error('Failed to match items.');
    } finally {
      setIsMatching(false);
    }
  };

  // Calculate counts
  const needsAttentionCount = (unmatchedPaymentItems?.length || 0) + (unmatchedInvoiceItems?.length || 0);
  const followUpCount = followUpItems?.length || 0;
  const resolvedCount = resolvedItems?.length || 0;

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-gray-200 border-t-[#65D3FD] rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading AR reconciliation data...</p>
        </div>
      </div>
    );
  }

  // No data state
  if (!reconciliationResult) {
    return (
      <div className="min-h-screen bg-white p-8">
        <Button variant="ghost" onClick={onBack} className="mb-6">
          <ArrowLeft className="size-4 mr-2" />
          Back to Month-End Close
        </Button>
        <Alert>
          <AlertCircle className="size-4" />
          <AlertDescription>
            No AR reconciliation data found for this period. Please run AR reconciliation first.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Toaster position="top-right" />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button type="button" variant="ghost" onClick={onBack} className="gap-2 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors">
            <ArrowLeft className="size-4" />
            Back
          </Button>
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="text-3xl font-bold font-outfit text-gray-900 dark:text-white tracking-tight">
              Review AR Reconciliation
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-2">
              <span className="font-medium">{companyName}</span>
              <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
              <span>{new Date(period + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
            </p>
          </motion.div>
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
            <CardTitle className="text-sm text-blue-600">Pre-Matched</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl text-blue-600">{reconciliationResult?.pre_matched_items?.length || 0}</div>
            <p className="text-xs text-gray-500 mt-1">Auto-matched groups</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-red-600">Needs Attention</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl text-red-600">{needsAttentionCount}</div>
            <p className="text-xs text-gray-500 mt-1">Unmatched items</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-purple-600">Follow-Up Needed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl text-purple-600">{followUpCount}</div>
            <p className="text-xs text-gray-500 mt-1">Awaiting information</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-green-600">Resolved</CardTitle>
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
            <Receipt className="size-4" />
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
            {/* Left Column: Unmatched Payments */}
            <div className="overflow-y-auto pr-2 overscroll-contain h-full">
              <Card className="h-fit">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Receipt className="size-5 text-red-600" />
                        Unmatched Customer Payments
                      </CardTitle>
                      <CardDescription className="mt-2">
                        These payments appear in bank statements but have no matching AR invoice.
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                      {unmatchedPaymentItems?.length || 0} items
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {unmatchedPaymentItems && unmatchedPaymentItems.length > 0 ? (
                    <div className="space-y-3">
                      {unmatchedPaymentItems.map((item, idx) => (
                        <UnmatchedItemCard
                          key={item.payment.id}
                          type="payment"
                          currency={item.payment.currency}
                          loadingActions={loadingActions}
                          isMonthLocked={isMonthLocked}
                          item={{
                            data: {
                              id: item.payment.id,
                              date: item.payment.date,
                              description: item.payment.description,
                              amount: item.payment.amount,
                              currency: item.payment.currency,
                              statementName: item.payment.statement
                            },
                            suggested_je: item.suggested_je
                          }}
                          onApproveJE={() => handleApproveForJE(item, 'payment')}
                          onMatch={() => handleOpenMatchDialog(item, 'payment')}
                          onEdit={() => { /* Implement Edit if needed, or keeping empty for now as it wasn't explicit in old code */ }}
                          onIgnore={() => handleMarkAsIgnored(item, 'payment')}
                          onTimingDifference={() => handleMarkAsTimingDifference(item, 'payment')}
                          onRequestInfo={() => handleOpenFollowUpDialog(item, 'payment')}
                          primaryActionLabel="Prepare Journal Entry"
                          primaryActionIcon={<ThumbsUp className="size-3" />}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="py-12 text-center">
                      <CheckCircle2 className="size-12 text-green-600 mx-auto mb-4" />
                      <p className="text-sm text-gray-600">All customer payments have been matched!</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Right Column: Unmatched Invoices */}
            <div className="overflow-y-auto pr-2 overscroll-contain h-full">
              <Card className="h-fit">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <FileText className="size-5 text-orange-600" />
                        Unmatched AR Invoices
                      </CardTitle>
                      <CardDescription className="mt-2">
                        These invoices appear in the AR ledger but have no matching customer payment.
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                      {unmatchedInvoiceItems?.length || 0} items
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {unmatchedInvoiceItems && unmatchedInvoiceItems.length > 0 ? (
                    <div className="space-y-3">
                      {unmatchedInvoiceItems.map((item, idx) => (
                        <UnmatchedItemCard
                          key={item.invoice.id}
                          type="invoice"
                          currency={item.invoice.currency}
                          loadingActions={loadingActions}
                          isMonthLocked={isMonthLocked}
                          item={{
                            data: {
                              id: item.invoice.id,
                              date: item.invoice.date,
                              description: `Invoice #${item.invoice.invoice_number}`,
                              amount: item.invoice.amount,
                              currency: item.invoice.currency,
                              details: item.invoice.applied_credits && item.invoice.applied_credits > 0 ? (
                                <div className="flex flex-col items-end">
                                  <Badge variant="outline" className="text-[10px] bg-white border-orange-200 text-orange-700 h-5 px-1.5 mb-1">
                                    Net Balance
                                  </Badge>
                                  <p className="text-[10px] text-gray-500 line-through">
                                    Gross: {formatCurrency(item.invoice.gross_amount || 0, item.invoice.currency)}
                                  </p>
                                  <p className="text-[10px] text-orange-600 font-medium">
                                    -{formatCurrency(item.invoice.applied_credits, item.invoice.currency)} Credit
                                  </p>
                                </div>
                              ) : null
                            }
                          }}
                          onApproveJE={() => handleApproveForJE(item, 'invoice')}
                          onMatch={() => handleOpenMatchDialog(item, 'invoice')}
                          onEdit={() => { /* Implement Edit */ }}
                          onIgnore={() => handleMarkAsIgnored(item, 'invoice')}
                          onTimingDifference={() => handleMarkAsTimingDifference(item, 'invoice')}
                          onRequestInfo={() => handleOpenFollowUpDialog(item, 'invoice')}
                          primaryActionLabel="Prepare Journal Entry"
                          primaryActionIcon={<ThumbsUp className="size-3" />}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="py-12 text-center">
                      <CheckCircle2 className="size-12 text-green-600 mx-auto mb-4" />
                      <p className="text-sm text-gray-600">All AR invoices have been matched!</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Tab 2: Follow-Up Needed */}
        <TabsContent value="follow-up" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Items Awaiting Information</CardTitle>
              <CardDescription>These items need additional information before they can be resolved.</CardDescription>
            </CardHeader>
            <CardContent>
              {followUpItems.length > 0 ? (
                <div className="space-y-3">
                  {followUpItems.map((item, idx) => {
                    const isPayment = item.type === 'payment';
                    const data = isPayment ? (item.item as UnmatchedPayment).payment : (item.item as UnmatchedInvoice).invoice;
                    const itemId = isPayment ? data.id : data.id;

                    return (
                      <div key={idx} className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge variant={isPayment ? "default" : "secondary"}>
                                {isPayment ? 'Payment' : 'Invoice'}
                              </Badge>
                              <span className="text-sm text-gray-500">
                                {new Date(item.markedAt).toLocaleString()}
                              </span>
                            </div>
                            <p className="text-sm text-gray-900 mb-2">
                              {isPayment ? (data as Payment).description : `Invoice #${(data as Invoice).invoice_number}`}
                            </p>
                            <div className="text-xs bg-white border border-purple-200 rounded p-3">
                              <p className="font-medium text-gray-900 mb-1">Follow-up Note:</p>
                              <p className="text-gray-700">{item.note}</p>
                            </div>
                          </div>
                          <div className="ml-4 flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleReverseFollowUp(item)}
                              disabled={loadingActions[`reverse-followup-${item.type}-${itemId}`]}
                            >
                              {loadingActions[`reverse-followup-${item.type}-${itemId}`] ? (
                                <Loader2 className="size-3 animate-spin" />
                              ) : (
                                <Undo2 className="size-3" />
                              )}
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-12 text-center">
                  <MessageSquare className="size-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-sm text-gray-600">No items awaiting follow-up.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Resolved / Completed */}
        <TabsContent value="resolved" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Resolved Items</CardTitle>
              <CardDescription>Items that have been approved, marked as timing differences, or marked as non-issues.</CardDescription>
            </CardHeader>
            <CardContent>
              {resolvedItems.length > 0 ? (
                <div className="space-y-3">
                  {resolvedItems.map((item, idx) => {
                    const isPayment = item.type === 'payment';
                    const data = isPayment ? (item.item as UnmatchedPayment).payment : (item.item as UnmatchedInvoice).invoice;
                    const itemId = data.id;

                    return (
                      <div key={idx} className="p-4 bg-green-50 border border-green-200 rounded-lg">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge
                                variant={
                                  item.status === 'approved_for_je' ? 'default' :
                                    item.status === 'timing_difference' ? 'secondary' :
                                      'outline'
                                }
                              >
                                {item.status === 'approved_for_je' && '✓ Approved for JE'}
                                {item.status === 'timing_difference' && '⏱ Timing Difference'}
                                {item.status === 'ignored' && '✗ Non-Issue'}
                              </Badge>
                              <Badge variant={isPayment ? "default" : "secondary"}>
                                {isPayment ? 'Payment' : 'Invoice'}
                              </Badge>
                              <span className="text-sm text-gray-500">
                                {new Date(item.markedAt).toLocaleString()}
                              </span>
                            </div>
                            <p className="text-sm text-gray-900">
                              {isPayment ? (data as Payment).description : `Invoice #${(data as Invoice).invoice_number}`}
                            </p>
                          </div>
                          <div className="ml-4 flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleReverseResolvedItem(item)}
                              disabled={loadingActions[`reverse-${item.type}-${itemId}`]}
                            >
                              {loadingActions[`reverse-${item.type}-${itemId}`] ? (
                                <Loader2 className="size-3 animate-spin" />
                              ) : (
                                <Undo2 className="size-3" />
                              )}
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-12 text-center">
                  <CheckCircle2 className="size-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-sm text-gray-600">No items resolved yet.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 4: Pre-Matched */}
        <TabsContent value="pre-matched" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Pre-Matched Groups</CardTitle>
              <CardDescription>Payments and invoices that were automatically matched by the AI.</CardDescription>
            </CardHeader>
            <CardContent>
              {reconciliationResult?.pre_matched_items && reconciliationResult.pre_matched_items.length > 0 ? (
                <div className="space-y-3">
                  {reconciliationResult.pre_matched_items.map((group, idx) => (
                    <div key={idx} className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-center gap-2 mb-3">
                        <Badge variant="outline" className="bg-blue-100 text-blue-700">
                          Match Group #{idx + 1}
                        </Badge>
                        {group.confidence && (
                          <Badge variant="outline">
                            {Math.round(group.confidence * 100)}% Confidence
                          </Badge>
                        )}
                        <span className="text-sm text-gray-500 ml-auto">
                          {new Date(group.matchedAt).toLocaleString()}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-gray-600 mb-1">Payments ({group.payments.length})</p>
                          {group.payments.map((payment, pidx) => (
                            <p key={pidx} className="text-gray-900">• {payment.description}</p>
                          ))}
                        </div>
                        <div>
                          <p className="text-gray-600 mb-1">Invoices ({group.invoices.length})</p>
                          {group.invoices.map((invoice, iidx) => (
                            <p key={iidx} className="text-gray-900">• Invoice #{invoice.invoice_number}</p>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center">
                  <Receipt className="size-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-sm text-gray-600">No pre-matched items found.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs >

      {/* Follow-up Dialog */}
      < Dialog open={showFollowUpDialog} onOpenChange={setShowFollowUpDialog} >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Information</DialogTitle>
            <DialogDescription>
              Describe what information is needed to resolve this item
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Textarea
              placeholder="What information do you need?"
              value={followUpNote}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFollowUpNote(e.target.value)}
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFollowUpDialog(false)}>
              Cancel
            </Button>
            <Button onClick={() => handleRequestInformation(followUpNote)}>
              Submit Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog >

      <ReconciliationMatchDialog
        open={showMatchDialog}
        onOpenChange={setShowMatchDialog}
        title="Match Payments to Invoices"
        leftItems={unmatchedPaymentItems.map(i => ({
          id: i.payment.id,
          date: i.payment.date,
          description: i.payment.description,
          amount: i.payment.amount,
          originalItem: i
        }))}
        leftTitle="Bank Payments"
        onSelectLeft={(item) => {
          setMatchSelectedPayments(prev => {
            const exists = prev.some(i => i.id === item.id);
            if (exists) return prev.filter(i => i.id !== item.id);
            return [...prev, item];
          });
        }}
        selectedLeftItems={matchSelectedPayments}
        rightItems={unmatchedInvoiceItems.map(i => ({
          id: i.invoice.id,
          date: i.invoice.date,
          description: `Invoice #${i.invoice.invoice_number}`,
          amount: i.invoice.amount,
          originalItem: i
        }))}
        rightTitle="AR Invoices"
        onSelectRight={(item) => {
          setMatchSelectedInvoices(prev => {
            const exists = prev.some(i => i.id === item.id);
            if (exists) return prev.filter(i => i.id !== item.id);
            return [...prev, item];
          });
        }}
        selectedRightItems={matchSelectedInvoices}
        onMatch={handleMatch}
        isMatching={isMatching}
      />
    </div >
  );
}