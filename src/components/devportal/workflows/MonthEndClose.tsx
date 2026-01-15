import { useState, useEffect, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import {
  ChevronDown,
  Calendar,
  Loader2,
  CheckCircle2,
  Circle,
  Lock
} from 'lucide-react';
import { Company } from '@/utils/api-client';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { projectId, publicAnonKey } from '@/utils/supabase/info';
import { BankRecReview } from './BankRecReview';
import { APRecReview } from './APRecReview';
import { CCRecReview } from './CCRecReview';
import { ARRecReview } from './ARRecReview';

import { toast } from 'sonner';
import { ChecklistItem, SectionCard, StatusBadge, RequirementGrid } from './shared';
import { useNavigate, useSearchParams } from 'react-router-dom';

interface MonthEndCloseProps {
  companyId?: string;
  companyName?: string;
}

interface ReconciliationResult {
  unmatched_bank: any[];
  unmatched_ledger: any[];
  summary: {
    matched_count: number;
    unmatched_bank_count: number;
    unmatched_ledger_count: number;
  };
  locked: boolean;
  lockedAt?: string;
}

export function MonthEndClose({ companyId: initialCompanyId, companyName: initialCompanyName }: MonthEndCloseProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [initialAccountId, setInitialAccountId] = useState<string | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState('');
  const [reconciliationResult, setReconciliationResult] = useState<ReconciliationResult | null>(null);
  const [isLoadingReconciliation, setIsLoadingReconciliation] = useState(false);
  const [showBankRecReview, setShowBankRecReview] = useState(false);
  const [showAPRecReview, setShowAPRecReview] = useState(false);
  const [showCCRecReview, setShowCCRecReview] = useState(false);
  const [showARRecReview, setShowARRecReview] = useState(false);


  // AP Reconciliation state
  const [apReconciliationResult, setAPReconciliationResult] = useState<any>(null);
  const [isLoadingAPReconciliation, setIsLoadingAPReconciliation] = useState(false);

  // CC Reconciliation state
  const [ccReconciliationResult, setCCReconciliationResult] = useState<any>(null);
  const [isLoadingCCReconciliation, setIsLoadingCCReconciliation] = useState(false);

  // AR Reconciliation state
  const [arReconciliationResult, setARReconciliationResult] = useState<any>(null);
  const [isLoadingARReconciliation, setIsLoadingARReconciliation] = useState(false);



  // Month close/lock state
  const [isMonthLocked, setIsMonthLocked] = useState(false);
  const [lockDetails, setLockDetails] = useState<any>(null);
  const [isClosingMonth, setIsClosingMonth] = useState(false);
  const [showCloseConfirmation, setShowCloseConfirmation] = useState(false);



  // Initialize company from props
  useEffect(() => {
    if (initialCompanyId && initialCompanyName) {
      setSelectedCompany({
        id: initialCompanyId,
        name: initialCompanyName,
        industry: '',
        status: 'active',
        created_at: new Date().toISOString()
      });
    }

    // Set default period to current month ONLY if not provided in URL
    const params = new URLSearchParams(window.location.search);
    const periodParam = params.get('period');

    console.log('🔍 MonthEndClose: Init Effect', { periodParam, currentSelectedPeriod: selectedPeriod });

    if (!periodParam) {
      const currentDate = new Date();
      const year = currentDate.getFullYear();
      const month = (currentDate.getMonth() + 1).toString().padStart(2, '0');
      const defaultPeriod = `${year}-${month}`;
      console.log('📅 MonthEndClose: Setting default period', defaultPeriod);
      setSelectedPeriod(defaultPeriod);
    } else {
      console.log('📅 MonthEndClose: Skipping default set, period param exists', periodParam);
    }
  }, [initialCompanyId, initialCompanyName]);

  // Generate period options (current and previous 12 months)
  const generatePeriodOptions = () => {
    const options: { value: string; label: string }[] = [];
    const currentDate = new Date();

    for (let i = 0; i < 12; i++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
      const year = date.getFullYear();
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const value = `${year}-${month}`;
      const label = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      options.push({ value, label });
    }

    return options;
  };

  const periods = useMemo(() => generatePeriodOptions(), []);

  // Load reconciliation data when company or period changes
  useEffect(() => {
    if (selectedCompany && selectedPeriod) {
      loadLockStatus();
      loadReconciliationData();
      loadAPReconciliationData();
      loadCCReconciliationData();
      loadARReconciliationData();

    }
  }, [selectedCompany, selectedPeriod]);

  // Refresh bank rec status when user returns to page (e.g., after locking from Bank Rec page)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && selectedCompany && selectedPeriod) {
        // Check if a bank rec was recently locked
        const notificationKey = `month-end-notification-${selectedCompany.id}`;
        const wasLocked = localStorage.getItem(notificationKey);

        if (wasLocked) {
          console.log('🔄 Detected bank rec lock notification - refreshing status...');
          localStorage.removeItem(notificationKey); // Clear the flag
          loadReconciliationData(); // Refresh the status
        }
      }
    };

    // Listen for visibility changes (when user switches back to this tab)
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Also check immediately on mount
    if (selectedCompany && selectedPeriod) {
      const notificationKey = `month-end-notification-${selectedCompany.id}`;
      const wasLocked = localStorage.getItem(notificationKey);

      if (wasLocked) {
        console.log('🔄 Detected bank rec lock notification on mount - refreshing status...');
        localStorage.removeItem(notificationKey);
        loadReconciliationData();
      }
    }

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [selectedCompany, selectedPeriod]);

  // Handle URL query parameters for direct navigation
  useEffect(() => {
    const tab = searchParams.get('tab');
    const accountId = searchParams.get('accountId');
    const periodParam = searchParams.get('period');

    // Debug log to confirm this effect is running
    console.log('🔍 MonthEndClose: Checking params', { tab, accountId, periodParam });

    // Set period if provided in URL
    if (periodParam && periodParam !== selectedPeriod) {
      console.log('📅 MonthEndClose: Setting period from URL', periodParam);
      setSelectedPeriod(periodParam);
    }

    if (tab === 'bank-rec-review') {
      console.log('✅ MonthEndClose: Switch TRIGGERED', { accountId });
      if (accountId) {
        setInitialAccountId(accountId);
      }
      setShowBankRecReview(true);
    } else if (tab === 'ap-rec-review') {
      console.log('✅ MonthEndClose: AP Review Switch TRIGGERED');
      setShowAPRecReview(true);
    } else if (tab === 'ar-rec-review') {
      setShowARRecReview(true);
    } else if (tab === 'cc-rec-review') {
      console.log('✅ MonthEndClose: CC Review Switch TRIGGERED');
      setShowCCRecReview(true);
    }
  }, [searchParams]);

  const loadReconciliationData = async () => {
    if (!selectedCompany || !selectedPeriod) return;

    setIsLoadingReconciliation(true);
    try {
      // ⚡ OPTIMIZED: Use lightweight status-summary endpoint (80% faster)
      // This skips COA fetch and full reconciliation data loading
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/bank-rec/status-summary?companyId=${selectedCompany.id}&period=${selectedPeriod}`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (!response.ok) {
        console.log('Month-End Close - Failed to fetch bank rec status summary');
        setReconciliationResult(null);
        return;
      }

      const statusData = await response.json();
      console.log('Month-End Close - Bank rec status loaded (fast):', statusData);
      if (statusData.accounts) {
        console.log('Month-End Close - Bank accounts found:', statusData.accounts.map((a: any) => a.name).join(', '));
      }

      // If no reconciliation exists, set null
      if (!statusData.exists) {
        setReconciliationResult(null);
        return;
      }

      // Convert status summary to reconciliation result format
      // Note: We don't load the full unmatched arrays for checklist status
      // Those will be loaded only when user clicks "Review" button
      const result = {
        unmatched_bank: [], // Empty arrays - not needed for status display
        unmatched_ledger: [],
        locked: statusData.locked,
        lockedAt: statusData.lockedAt,
        summary: {
          matched_count: statusData.matchedCount || 0,
          unmatched_bank_count: statusData.unmatchedBankCount || 0,
          unmatched_ledger_count: statusData.unmatchedLedgerCount || 0,
        },
        accountCount: statusData.accountCount,
        lockedCount: statusData.lockedCount || 0
      };

      setReconciliationResult(result);

    } catch (error) {
      console.error('Month-End Close - Failed to load bank rec status:', error);
      setReconciliationResult(null);
    } finally {
      setIsLoadingReconciliation(false);
    }
  };

  const loadAPReconciliationData = async () => {
    if (!selectedCompany || !selectedPeriod) return;

    setIsLoadingAPReconciliation(true);
    try {
      // ⚡ OPTIMIZED: Use lightweight status-summary endpoint
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/ap-rec/status-summary?companyId=${selectedCompany.id}&period=${selectedPeriod}`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (response.ok) {
        const statusData = await response.json();
        console.log('Month-End Close - AP status loaded (fast):', statusData);

        if (!statusData.exists && statusData.accountCount === undefined) {
          setAPReconciliationResult(null);
        } else {
          setAPReconciliationResult(statusData);
        }
      } else {
        console.error('Month-End Close - Failed to load AP status');
        setAPReconciliationResult(null);
      }
    } catch (error) {
      console.error('Month-End Close - Failed to load AP status:', error);
      setAPReconciliationResult(null);
    } finally {
      setIsLoadingAPReconciliation(false);
    }
  };

  const loadCCReconciliationData = async () => {
    if (!selectedCompany || !selectedPeriod) return;

    setIsLoadingCCReconciliation(true);
    try {
      // ⚡ OPTIMIZED: Use lightweight status-summary endpoint
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/cc-rec/status-summary?companyId=${selectedCompany.id}&period=${selectedPeriod}`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (response.ok) {
        const statusData = await response.json();
        console.log('Month-End Close - CC status loaded (fast):', statusData);

        if (!statusData.exists && statusData.accountCount === undefined) {
          setCCReconciliationResult(null);
        } else {
          setCCReconciliationResult(statusData);
        }
      } else {
        console.error('Month-End Close - Failed to load CC status');
        setCCReconciliationResult(null);
      }
    } catch (error) {
      console.error('Month-End Close - Failed to load CC status:', error);
      setCCReconciliationResult(null);
    } finally {
      setIsLoadingCCReconciliation(false);
    }
  };

  const loadARReconciliationData = async () => {
    if (!selectedCompany || !selectedPeriod) return;

    setIsLoadingARReconciliation(true);
    try {
      // ⚡ OPTIMIZED: Use lightweight status-summary endpoint
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/ar-rec/status-summary?companyId=${selectedCompany.id}&period=${selectedPeriod}`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (response.ok) {
        const statusData = await response.json();
        console.log('Month-End Close - AR status loaded (fast):', statusData);

        if (!statusData.exists && statusData.accountCount === undefined) {
          setARReconciliationResult(null);
        } else {
          setARReconciliationResult(statusData);
        }
      } else {
        console.error('Month-End Close - Failed to load AR status');
        setARReconciliationResult(null);
      }
    } catch (error) {
      console.error('Month-End Close - Failed to load AR status:', error);
      setARReconciliationResult(null);
    } finally {
      setIsLoadingARReconciliation(false);
    }
  };



  const loadLockStatus = async () => {
    if (!selectedCompany || !selectedPeriod) return;

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/month-close/status?companyId=${selectedCompany.id}&period=${selectedPeriod}`,
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
        console.log('Month lock status:', data);
      }
    } catch (error) {
      console.error('Failed to load lock status:', error);
    }
  };

  const handleCloseMonth = async () => {
    setIsClosingMonth(true);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/month-close/close`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            companyId: selectedCompany.id,
            period: selectedPeriod,
            closedBy: 'current-user', // TODO: Replace with actual user
          }),
        }
      );

      // Read response as text first, then parse
      const responseText = await response.text();

      if (response.ok) {
        try {
          const data = JSON.parse(responseText);
          console.log('Month close response:', data);
          toast.success('Month closed and locked successfully!');
          setShowCloseConfirmation(false);
          await loadLockStatus(); // Reload lock status
        } catch (parseError) {
          console.error('Error parsing success response:', parseError, responseText);
          toast.error('Unexpected response format from server');
        }
      } else {
        let errorMessage = 'Failed to close month';
        try {
          const errorData = JSON.parse(responseText);
          errorMessage = errorData.error || errorMessage;
        } catch (parseError) {
          // If response is not JSON, use the text as-is
          console.error('Non-JSON error response:', responseText);
          errorMessage = responseText || errorMessage;
        }
        toast.error(errorMessage);
      }
    } catch (error) {
      console.error('Error closing month:', error);
      toast.error(`Failed to close month: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsClosingMonth(false);
    }
  };

  const getStatusBadge = () => {
    if (!reconciliationResult) {
      return <StatusBadge status="not-started" />;
    }

    const hasUnmatched = (reconciliationResult.unmatched_bank?.length || 0) > 0 ||
      (reconciliationResult.unmatched_ledger?.length || 0) > 0;

    if (hasUnmatched) {
      return <StatusBadge status="in-progress" />;
    }

    return <StatusBadge status="ready" />;
  };

  const bankRecCompleted = reconciliationResult &&
    (reconciliationResult.unmatched_bank?.length || 0) === 0 &&
    (reconciliationResult.unmatched_ledger?.length || 0) === 0;

  const apRecCompleted = apReconciliationResult &&
    (apReconciliationResult.summary?.unmatched_vendor_count || apReconciliationResult.unmatchedVendor?.length || 0) === 0 &&
    (apReconciliationResult.summary?.unmatched_ap_count || apReconciliationResult.unmatchedAP?.length || 0) === 0;

  const ccRecCompleted = ccReconciliationResult &&
    (ccReconciliationResult.summary?.unmatched_cc_count || ccReconciliationResult.unmatched_cc?.length || 0) === 0 &&
    (ccReconciliationResult.summary?.unmatched_ledger_count || ccReconciliationResult.unmatched_ledger?.length || 0) === 0;

  const arRecCompleted = arReconciliationResult &&
    (arReconciliationResult.summary?.unmatched_payment_count || arReconciliationResult.unmatched_payments?.length || 0) === 0 &&
    (arReconciliationResult.summary?.unmatched_invoice_count || arReconciliationResult.unmatched_invoices?.length || 0) === 0;



  const isAccountless = (res: any) => res && (res.accountCount === 0 || res.totalAccounts === 0);

  // Helper to ensure boolean values for completion status
  const isBankRecComplete = !!bankRecCompleted || isAccountless(reconciliationResult);
  const isAPRecComplete = !!apRecCompleted || isAccountless(apReconciliationResult);
  const isCCRecComplete = !!ccRecCompleted || isAccountless(ccReconciliationResult);
  const isARRecComplete = !!arRecCompleted || isAccountless(arReconciliationResult);


  // Helper functions for ChecklistItem status
  const getBankRecStatus = () => {
    if (isLoadingReconciliation) return 'loading';

    // No reconciliation exists
    if (!reconciliationResult) return 'not-started';

    // Check if no accounts exist
    if (isAccountless(reconciliationResult)) return 'completed';

    // Check if we have multiple accounts with partial locks
    const lockedCount = (reconciliationResult as any).lockedCount || 0;
    const totalAccounts = (reconciliationResult as any).totalAccounts || (reconciliationResult as any).accountCount || 0;

    // Reconciliation exists but not all accounts locked
    if (!reconciliationResult.locked) {
      // If some accounts are locked, show in-progress
      if (lockedCount > 0) return 'in-progress';
      // If no accounts locked, show in-progress (they've started but haven't locked)
      return 'in-progress';
    }

    // Check if there are unmatched items
    const hasUnmatched =
      (reconciliationResult.unmatched_bank?.length || 0) > 0 ||
      (reconciliationResult.unmatched_ledger?.length || 0) > 0;

    // Locked but has unmatched items
    if (hasUnmatched) return 'in-progress';

    // Locked and fully matched
    return 'completed';
  };

  const getAPRecStatus = () => {
    if (isLoadingAPReconciliation) return 'loading';

    // No reconciliation exists
    if (!apReconciliationResult) return 'not-started';

    // Check if no accounts exist
    if (isAccountless(apReconciliationResult)) return 'completed';

    // Reconciliation exists but not locked
    if (!apReconciliationResult.locked) return 'in-progress';

    // Check if there are unmatched items using summary counts
    const unmatchedVendor = apReconciliationResult.summary?.unmatched_vendor_count || apReconciliationResult.unmatchedVendor?.length || 0;
    const unmatchedAP = apReconciliationResult.summary?.unmatched_ap_count || apReconciliationResult.unmatchedAP?.length || 0;
    const hasUnmatched = unmatchedVendor > 0 || unmatchedAP > 0;

    // Locked but has unmatched items
    if (hasUnmatched) return 'in-progress';

    // Locked and fully matched
    return 'completed';
  };

  const getCCRecStatus = () => {
    if (isLoadingCCReconciliation) return 'loading';

    // No reconciliation exists
    if (!ccReconciliationResult) return 'not-started';

    // Check if no accounts exist
    if (isAccountless(ccReconciliationResult)) return 'completed';

    // Reconciliation exists but not locked
    if (!ccReconciliationResult.locked) return 'in-progress';

    // Check if there are unmatched items using summary counts
    const unmatchedCC = ccReconciliationResult.summary?.unmatched_cc_count || ccReconciliationResult.unmatched_cc?.length || 0;
    const unmatchedLedger = ccReconciliationResult.summary?.unmatched_ledger_count || ccReconciliationResult.unmatched_ledger?.length || 0;
    const hasUnmatched = unmatchedCC > 0 || unmatchedLedger > 0;

    // Locked but has unmatched items
    if (hasUnmatched) return 'in-progress';

    // Locked and fully matched
    return 'completed';
  };

  const getARRecStatus = () => {
    if (isLoadingARReconciliation) return 'loading';

    // No reconciliation exists
    if (!arReconciliationResult) return 'not-started';

    // Check if no accounts exist
    if (isAccountless(arReconciliationResult)) return 'completed';

    // Reconciliation exists but not locked
    if (!arReconciliationResult.locked) return 'in-progress';

    // Check if there are unmatched items using summary counts
    const unmatchedPayments = arReconciliationResult.summary?.unmatched_payment_count || arReconciliationResult.unmatched_payments?.length || 0;
    const unmatchedInvoices = arReconciliationResult.summary?.unmatched_invoice_count || arReconciliationResult.unmatched_invoices?.length || 0;
    const hasUnmatched = unmatchedPayments > 0 || unmatchedInvoices > 0;

    // Locked but has unmatched items
    if (hasUnmatched) return 'in-progress';

    // Locked and fully matched
    return 'completed';
  };

  // Get status description for each reconciliation
  const getBankRecDescription = () => {
    if (isLoadingReconciliation) return 'Loading reconciliation data...';

    if (!reconciliationResult) {
      return 'No reconciliation found - please run bank reconciliation first';
    }

    // Check if we have multiple accounts
    const lockedCount = (reconciliationResult as any).lockedCount || 0;
    const totalAccounts = (reconciliationResult as any).totalAccounts || (reconciliationResult as any).accountCount || 0;

    if (isAccountless(reconciliationResult)) {
      return 'No bank accounts found - not applicable';
    }

    if (!reconciliationResult.locked) {
      // Show how many accounts are locked if we have multiple
      if (totalAccounts > 1) {
        return `${lockedCount} of ${totalAccounts} accounts locked - please lock remaining accounts`;
      }
      return 'Reconciliation not locked - please save and lock in bank reconciliation';
    }

    // Use summary counts for performance (arrays are not loaded in status check)
    const unmatchedBank = reconciliationResult.summary?.unmatched_bank_count || 0;
    const unmatchedLedger = reconciliationResult.summary?.unmatched_ledger_count || 0;

    if (unmatchedBank > 0 || unmatchedLedger > 0) {
      return `${unmatchedBank} unmatched bank, ${unmatchedLedger} unmatched ledger - review required`;
    }

    return 'Reconciliation complete - all items matched';
  };

  const getAPRecDescription = () => {
    if (isLoadingAPReconciliation) return 'Loading AP reconciliation data...';

    if (!apReconciliationResult) {
      return 'No AP reconciliation found - please run AP reconciliation first';
    }

    if (isAccountless(apReconciliationResult)) {
      return 'No AP accounts found - not applicable';
    }

    if (!apReconciliationResult.locked) {
      return 'Reconciliation not locked - please save and lock in AP reconciliation';
    }

    const unmatchedVendor = apReconciliationResult.summary?.unmatched_vendor_count || apReconciliationResult.unmatchedVendor?.length || 0;
    const unmatchedAP = apReconciliationResult.summary?.unmatched_ap_count || apReconciliationResult.unmatchedAP?.length || 0;

    if (unmatchedVendor > 0 || unmatchedAP > 0) {
      return `${unmatchedVendor} unmatched vendor, ${unmatchedAP} unmatched AP - review required`;
    }

    return 'Reconciliation complete - all items matched';
  };

  const getCCRecDescription = () => {
    if (isLoadingCCReconciliation) return 'Loading CC reconciliation data...';

    if (!ccReconciliationResult) {
      return 'No CC reconciliation found - please run credit card reconciliation first';
    }

    if (isAccountless(ccReconciliationResult)) {
      return 'No credit card accounts found - not applicable';
    }

    if (!ccReconciliationResult.locked) {
      return 'Reconciliation not locked - please save and lock in CC reconciliation';
    }

    const unmatchedCC = ccReconciliationResult.summary?.unmatched_cc_count || ccReconciliationResult.unmatched_cc?.length || 0;
    const unmatchedLedger = ccReconciliationResult.summary?.unmatched_ledger_count || ccReconciliationResult.unmatched_ledger?.length || 0;

    if (unmatchedCC > 0 || unmatchedLedger > 0) {
      return `${unmatchedCC} unmatched CC, ${unmatchedLedger} unmatched ledger - review required`;
    }

    return 'Reconciliation complete - all items matched';
  };

  const getARRecDescription = () => {
    if (isLoadingARReconciliation) return 'Loading AR reconciliation data...';

    if (!arReconciliationResult) {
      return 'No AR reconciliation found - please run accounts receivable reconciliation first';
    }

    if (isAccountless(arReconciliationResult)) {
      return 'No AR accounts found - not applicable';
    }

    if (!arReconciliationResult.locked) {
      return 'Reconciliation not locked - please save and lock in AR reconciliation';
    }

    const unmatchedPayments = arReconciliationResult.summary?.unmatched_payment_count || arReconciliationResult.unmatched_payments?.length || 0;
    const unmatchedInvoices = arReconciliationResult.summary?.unmatched_invoice_count || arReconciliationResult.unmatched_invoices?.length || 0;

    if (unmatchedPayments > 0 || unmatchedInvoices > 0) {
      return `${unmatchedPayments} unmatched payments, ${unmatchedInvoices} unmatched invoices - review required`;
    }

    return 'Reconciliation complete - all items matched';
  };

  // DEBUG LOGGING
  // console.log('MonthEndClose RENDER:', { 
  //   showBankRecReview, 
  //   hasSelectedCompany: !!selectedCompany, 
  //   params: searchParams.toString(),
  //   tab: searchParams.get('tab')
  // });

  // Show Bank Rec Review page if navigated to it
  if (showBankRecReview) {
    if (!selectedCompany) {
      return <div className="p-10">Loading company for review...</div>;
    }

    return (
      <BankRecReview
        companyId={selectedCompany.id}
        companyName={selectedCompany.name}
        period={selectedPeriod}
        initialAccountId={initialAccountId}
        onBack={() => {
          setShowBankRecReview(false);
          setInitialAccountId(null); // Clear initial account ID when going back
          loadReconciliationData(); // Reload data when coming back
        }}
      />
    );
  }

  // Show AP Rec Review page if navigated to it
  if (showAPRecReview && selectedCompany) {
    return (
      <APRecReview
        companyId={selectedCompany.id}
        companyName={selectedCompany.name}
        period={selectedPeriod}
        onBack={() => {
          setShowAPRecReview(false);
          loadReconciliationData(); // Reload data when coming back
          loadAPReconciliationData(); // Reload AP data when coming back
        }}
      />
    );
  }

  // Show CC Rec Review page if navigated to it
  if (showCCRecReview && selectedCompany) {
    return (
      <CCRecReview
        companyId={selectedCompany.id}
        companyName={selectedCompany.name}
        period={selectedPeriod}
        onBack={() => {
          setShowCCRecReview(false);
          loadCCReconciliationData(); // Reload CC data when coming back
        }}
      />
    );
  }

  // Show AR Rec Review page if navigated to it
  if (showARRecReview && selectedCompany) {
    return (
      <ARRecReview
        companyId={selectedCompany.id}
        companyName={selectedCompany.name}
        period={selectedPeriod}
        onBack={() => {
          setShowARRecReview(false);
          loadARReconciliationData(); // Reload AR data when coming back
        }}
      />
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 py-8 px-6">
      {/* Premium Header */}
      <div className="relative">
        <div className="relative flex flex-col md:flex-row md:items-end justify-between gap-6 pb-8 border-b border-gray-100 dark:border-white/10">
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400" style={{ fontFamily: "'Manrope', sans-serif" }}>
              <span className="px-2 py-1 rounded-md bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/5 text-xs font-medium">Review Hub</span>
              <span>/</span>
              <span>{selectedCompany?.name}</span>
            </div>

            <div>
              <h1
                className="text-4xl md:text-5xl font-bold tracking-tight text-gray-900 dark:text-white mb-2"
                style={{ fontFamily: "'Outfit', sans-serif" }}
              >
                {periods.find(p => p.value === selectedPeriod)?.label.split(' ')[0]}
                <span className="text-gray-400 dark:text-gray-500 font-light ml-2">
                  {periods.find(p => p.value === selectedPeriod)?.label.split(' ')[1]}
                </span>
              </h1>
              <p
                className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl"
                style={{ fontFamily: "'Manrope', sans-serif" }}
              >
                Orchestrate your month-end close with AI-powered reconciliation and anomaly detection.
              </p>
            </div>

            <div className="flex items-center gap-4 pt-2">
              {isMonthLocked && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-50 text-purple-600 border border-purple-100 dark:bg-violet-500/10 dark:text-violet-400 dark:border-violet-500/20">
                  <Lock className="size-3" />
                  <span className="text-xs font-medium" style={{ fontFamily: "'Manrope', sans-serif" }}>Period Locked</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col items-end gap-4 min-w-[280px]">
            {/* Period Selector - Premium Style */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-between bg-white/80 dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-900 dark:text-white hover:bg-white dark:hover:bg-white/10 backdrop-blur-md transition-all duration-300"
                  style={{ fontFamily: "'Outfit', sans-serif" }}
                >
                  <span className="flex items-center gap-2">
                    <Calendar className="size-4 text-sky-500 dark:text-[#65D3FD]" />
                    {periods.find(p => p.value === selectedPeriod)?.label}
                  </span>
                  <ChevronDown className="size-4 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[280px] bg-white dark:bg-[#0a0a0f] border-gray-100 dark:border-white/10 text-gray-900 dark:text-white shadow-xl">
                {periods.map((period) => (
                  <DropdownMenuItem
                    key={period.value}
                    onClick={() => setSelectedPeriod(period.value)}
                    className={`focus:bg-gray-50 dark:focus:bg-white/10 cursor-pointer ${selectedPeriod === period.value ? 'bg-sky-50 dark:bg-white/10 text-sky-600 dark:text-[#65D3FD]' : 'text-gray-700 dark:text-gray-300'}`}
                    style={{ fontFamily: "'Manrope', sans-serif" }}
                  >
                    {period.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Overall Progress */}
            <div className="w-full p-5 rounded-xl bg-white dark:bg-gradient-to-b dark:from-gray-900/60 dark:to-black/60 border border-gray-100 dark:border-white/10 shadow-lg dark:shadow-xl backdrop-blur-md">
              <div className="flex justify-between items-center mb-3">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider" style={{ fontFamily: "'Outfit', sans-serif" }}>Close Progress</span>
                <span className="text-sm font-bold text-gray-900 dark:text-white font-mono">
                  {isMonthLocked ? '100%' :
                    isBankRecComplete && isAPRecComplete && isCCRecComplete && isARRecComplete ? '90%' :
                      '35%'}
                </span>
              </div>
              <div className="h-2 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden border border-gray-50 dark:border-white/5">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-sky-400 dark:from-[#4F5CFE] dark:to-[#65D3FD] rounded-full transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(56,189,248,0.5)] dark:shadow-[0_0_10px_rgba(101,211,253,0.5)]"
                  style={{
                    width: isMonthLocked ? '100%' :
                      isBankRecComplete && isAPRecComplete && isCCRecComplete && isARRecComplete ? '90%' :
                        '35%'
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="relative pl-0 md:pl-12 space-y-10">
        {/* Timeline Line (Desktop Only) */}
        <div className="absolute left-0 md:left-5 top-4 bottom-4 w-px bg-gradient-to-b from-gray-200 via-gray-200 to-transparent dark:from-white/10 dark:via-white/10 hidden md:block" />

        {/* Pre-Close Checklist */}
        <SectionCard
          number={1}
          title="Consolidate & Reconcile"
          description="Ensure all transaction sources match your ledger."
          isActive={true}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ChecklistItem
              title="Bank Reconciliation"
              description={getBankRecDescription()}
              status={getBankRecStatus()}
              onAction={() => !reconciliationResult ? navigate(`/company/${selectedCompany?.id}/reconciliations/bank`) : setShowBankRecReview(true)}
              actionLabel={!reconciliationResult ? "Start Reconciling" : undefined}
            />

            <ChecklistItem
              title="AP Reconciliation"
              description={getAPRecDescription()}
              status={getAPRecStatus()}
              onAction={() => !apReconciliationResult ? navigate(`/company/${selectedCompany?.id}/reconciliations/ap`) : setShowAPRecReview(true)}
              actionLabel={!apReconciliationResult ? "Start Reconciling" : undefined}
            />

            <ChecklistItem
              title="CC Reconciliation"
              description={getCCRecDescription()}
              status={getCCRecStatus()}
              onAction={() => !ccReconciliationResult ? navigate(`/company/${selectedCompany?.id}/reconciliations/cc`) : setShowCCRecReview(true)}
              actionLabel={!ccReconciliationResult ? "Start Reconciling" : undefined}
            />

            <ChecklistItem
              title="AR Reconciliation"
              description={getARRecDescription()}
              status={getARRecStatus()}
              onAction={() => !arReconciliationResult ? navigate(`/company/${selectedCompany?.id}/reconciliations/ar`) : setShowARRecReview(true)}
              actionLabel={!arReconciliationResult ? "Start Reconciling" : undefined}
            />
          </div>
        </SectionCard>



        {/* Close Month Section */}
        <SectionCard
          number={2}
          title="Lock Period"
          description="Finalize the month and prevent further changes."
          isActive={isBankRecComplete && isAPRecComplete && isCCRecComplete && isARRecComplete}
        >
          {isMonthLocked ? (
            <div className="p-8 rounded-xl bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 flex flex-col items-center text-center">
              <div className="size-16 rounded-full bg-gray-200 dark:bg-zinc-800 flex items-center justify-center mb-4">
                <Lock className="size-8 text-gray-500 dark:text-gray-400" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Period Locked</h3>
              <p className="text-gray-500 max-w-md mb-6">
                This period was closed on {lockDetails?.closedAt ? new Date(lockDetails.closedAt).toLocaleDateString() : 'Unknown date'}.
                All transactions are now read-only.
              </p>
              <Button variant="outline" disabled>
                Contact Admin to Unlock
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <RequirementStatus label="Bank Rec" isMet={isBankRecComplete} />
                <RequirementStatus label="AP Rec" isMet={isAPRecComplete} />
                <RequirementStatus label="CC Rec" isMet={isCCRecComplete} />
                <RequirementStatus label="AR Rec" isMet={isARRecComplete} />

              </div>

              <div className="p-6 rounded-xl bg-gradient-to-br from-gray-900 to-gray-800 text-white shadow-xl dark:from-zinc-900 dark:to-black dark:border dark:border-zinc-800">
                <div className="flex flex-col md:flex-row items-center justify-between gap-6 mr-10">
                  <div>
                    <h3 className="text-xl font-bold mb-2">Ready to Close?</h3>
                    <p className="text-gray-300 text-sm">
                      Closing the period will lock all associated journals and reconciliations.
                      This action can only be undone by an administrator.
                    </p>
                  </div>
                  <Button
                    size="lg"
                    onClick={() => {
                      setShowCloseConfirmation(true);
                    }}
                    disabled={!(isBankRecComplete && isAPRecComplete && isCCRecComplete && isARRecComplete)}
                    className="bg-white text-black hover:bg-gray-100 whitespace-nowrap min-w-[120px]"
                  >
                    {isClosingMonth ? <Loader2 className="size-4 animate-spin" /> : 'Close Period'}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </SectionCard>
      </div>

      {/* Confirmation Modal */}
      {showCloseConfirmation && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => !isClosingMonth && setShowCloseConfirmation(false)}>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100 dark:border-zinc-800 transform transition-all scale-100" onClick={(e) => e.stopPropagation()}>
            <div className="text-center mb-6">
              <div className="size-12 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto mb-4">
                <Lock className="size-6" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">Confirm Month Close</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                You are about to close <span className="font-semibold text-gray-900 dark:text-gray-200">{periods.find(p => p.value === selectedPeriod)?.label}</span>.
              </p>
            </div>

            <div className="bg-gray-50 dark:bg-zinc-800/50 rounded-xl p-4 mb-6 space-y-3 text-sm">
              <div className="flex items-center gap-3 text-gray-700 dark:text-gray-300">
                <CheckCircle2 className={`size-4 ${isBankRecComplete ? 'text-emerald-500' : 'text-gray-400'}`} />
                <span>Lock all reconciliations</span>
              </div>

              <div className="flex items-center gap-3 text-gray-700 dark:text-gray-300">
                <CheckCircle2 className="size-4 text-emerald-500" />
                <span>Prevent new transactions</span>
              </div>
            </div>



            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setShowCloseConfirmation(false)}
                disabled={isClosingMonth}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCloseMonth}
                disabled={isClosingMonth}
                className="flex-1 bg-gray-900 hover:bg-gray-800 text-white dark:bg-white dark:text-black dark:hover:bg-gray-200"
              >
                {isClosingMonth ? (
                  <>
                    <Loader2 className="size-4 mr-2 animate-spin" />
                    Closing...
                  </>
                ) : (
                  'Confirm Close'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper component for requirement status
function RequirementStatus({ label, isMet }: { label: string; isMet: boolean }) {
  return (
    <div className={`
         flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all duration-300
         ${isMet
        ? 'bg-emerald-50 border-emerald-200 text-emerald-600 dark:bg-emerald-500/10 dark:border-emerald-500/20 dark:text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
        : 'bg-white/50 border-gray-100 text-gray-400 dark:bg-white/5 dark:border-white/5 dark:text-gray-500 opacity-60'
      }
      `}>
      {isMet ? <CheckCircle2 className="size-5 mb-1" /> : <Circle className="size-5 mb-1" />}
      <span className="text-xs font-medium" style={{ fontFamily: "'Manrope', sans-serif" }}>{label}</span>
    </div>
  );
}