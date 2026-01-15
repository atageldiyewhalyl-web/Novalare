import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@/contexts/ThemeContext';
import { Button } from '@/components/ui/button';
import {
  FileText,
  Receipt,
  Landmark,
  CreditCard,
  Calendar,
  FileSpreadsheet,
  ArrowRight,
  Clock,
  Building2,
  Loader2
} from 'lucide-react';
import { invoicesApi, receiptsApi } from '@/utils/api-client';
import { motion } from 'framer-motion';

interface CompanyOverviewProps {
  companyId: string;
  companyName: string;
}

interface OverviewStats {
  pendingInvoices: number;
  pendingReceipts: number;
  bankRecStatus: 'completed' | 'in-progress' | 'not-started';
  apRecStatus: 'completed' | 'in-progress' | 'not-started';
  arRecStatus: 'completed' | 'in-progress' | 'not-started';
  ccRecStatus: 'completed' | 'in-progress' | 'not-started';
  monthEndStatus: 'locked' | 'in-progress' | 'not-started';
  pendingJournalEntries: number;
}

export function CompanyOverview({ companyId, companyName }: CompanyOverviewProps) {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [stats, setStats] = useState<OverviewStats>({
    pendingInvoices: 0,
    pendingReceipts: 0,
    bankRecStatus: 'not-started',
    apRecStatus: 'not-started',
    arRecStatus: 'not-started',
    ccRecStatus: 'not-started',
    monthEndStatus: 'not-started',
    pendingJournalEntries: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadOverviewStats();
  }, [companyId]);

  const loadOverviewStats = async () => {
    try {
      setLoading(true);

      const [invoices, receipts] = await Promise.all([
        invoicesApi.getByCompany(companyId).catch(() => []),
        receiptsApi.getByCompany(companyId).catch(() => []),
      ]);

      const pendingInvoices = invoices.filter((inv: any) => inv.status === 'Pending').length;
      const pendingReceipts = receipts.filter((rec: any) => rec.status === 'Pending').length;

      setStats({
        pendingInvoices,
        pendingReceipts,
        bankRecStatus: 'not-started',
        apRecStatus: 'not-started',
        arRecStatus: 'not-started',
        ccRecStatus: 'not-started',
        monthEndStatus: 'not-started',
        pendingJournalEntries: 0
      });
    } catch (err) {
      console.error('Failed to load overview stats:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: 'completed' | 'in-progress' | 'not-started' | 'locked') => {
    const config = {
      completed: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', text: 'text-emerald-500', dot: 'bg-emerald-500', label: 'Completed' },
      locked: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', text: 'text-emerald-500', dot: 'bg-emerald-500', label: 'Locked' },
      'in-progress': { bg: 'bg-[#65D3FD]/10', border: 'border-[#65D3FD]/20', text: 'text-[#65D3FD]', dot: 'bg-[#65D3FD]', label: 'In Progress' },
      'not-started': { bg: 'bg-gray-500/10', border: 'border-gray-500/20', text: 'text-gray-500', dot: 'bg-gray-500', label: 'Not Started' }
    };

    const s = config[status];
    return (
      <div className={`flex items-center justify-center relative min-w-[100px] px-6 py-1 rounded-full border ${s.bg} ${s.border} ${s.text} text-[10px] font-bold uppercase tracking-wider`}>
        <span className="absolute left-2.5 flex size-1.5">
          {status === 'in-progress' && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#65D3FD]/40 opacity-75"></span>}
          <span className={`relative inline-flex rounded-full size-1.5 ${s.dot} ${status === 'not-started' ? 'opacity-50' : ''}`}></span>
        </span>
        {s.label}
      </div>
    );
  };

  const getCurrentMonth = () => {
    const now = new Date();
    return now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[500px]">
        <div className="relative">
          <div className="size-24 rounded-full border-t-2 border-[#65D3FD] animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="size-8 text-[#65D3FD] animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="max-w-7xl mx-auto space-y-12 pb-20 px-4 md:px-0"
    >
      {/* Background Glow Blobs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className={`absolute -top-1/4 -right-1/4 size-[500px] rounded-full blur-[120px] opacity-10 transition-colors duration-500 ${theme === 'dark' ? 'bg-[#65D3FD]/20' : 'bg-[#65D3FD]/30'}`} />
        <div className={`absolute top-1/2 -left-1/4 size-[500px] rounded-full blur-[120px] opacity-10 transition-colors duration-500 ${theme === 'dark' ? 'bg-[#4F5CFE]/10' : 'bg-[#4F5CFE]/20'}`} />
      </div>

      {/* Header - Ultra Premium */}
      <div className="relative">
        <div className="absolute -left-6 top-1/2 -translate-y-1/2 w-1.5 h-16 bg-[#65D3FD] rounded-full hidden lg:block shadow-[0_0_15px_rgba(101,211,253,0.5)]" />
        <h1
          className={`text-6xl font-black tracking-tighter mb-3 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
          style={{ fontFamily: "'Outfit', sans-serif" }}
        >
          {companyName}
        </h1>
        <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400" style={{ fontFamily: "'Manrope', sans-serif" }}>
          <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${theme === 'dark' ? 'bg-[#65D3FD]/10 text-[#65D3FD] border-[#65D3FD]/20' : 'bg-[#65D3FD]/5 text-[#65D3FD] border-[#65D3FD]/10'}`}>
            Entity Overview
          </span>
          <div className="size-1 rounded-full bg-gray-500 opacity-30" />
          <Calendar className="w-4 h-4 text-[#65D3FD]" />
          <span className="text-sm font-bold tracking-tight">{getCurrentMonth()} Dashboard</span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {[
          { title: 'Bank Reconciliation', icon: Landmark, status: stats.bankRecStatus, path: 'reconciliations/bank', color: '#65D3FD', desc: stats.bankRecStatus === 'completed' ? 'All accounts are balanced and reconciled.' : 'Manage bank statements and ledger matches.' },
          { title: 'AP Reconciliation', icon: FileText, status: stats.apRecStatus, path: 'reconciliations/ap', color: '#65D3FD', desc: stats.apRecStatus === 'completed' ? 'Accounts payable matched and verified.' : 'Verify vendor payments against ledger entries.' },
          { title: 'Card Reconciliation', icon: CreditCard, status: stats.ccRecStatus, path: 'reconciliations/cc', color: '#65D3FD', desc: stats.ccRecStatus === 'completed' ? 'All transactions verified and matched.' : 'Match business expenses with statements.' },
          {
            title: 'Invoices & Receipts',
            icon: Receipt,
            customBadge: (stats.pendingInvoices + stats.pendingReceipts) > 0 ? `${stats.pendingInvoices + stats.pendingReceipts} Pending` : null,
            path: 'receipts',
            color: '#4F5CFE',
            desc: 'Review and approve digital document entries.'
          },
          { title: 'Month-End Close', icon: Calendar, status: stats.monthEndStatus, path: 'month-end', color: '#A855F7', desc: 'Finalize period transactions and lock books.' },
          {
            title: 'Journal Entries',
            icon: FileSpreadsheet,
            customBadge: stats.pendingJournalEntries > 0 ? `${stats.pendingJournalEntries} Adjustments` : null,
            path: 'journal-entries',
            color: '#F59E0B',
            desc: stats.pendingJournalEntries > 0 ? `${stats.pendingJournalEntries} adjustments need approval.` : 'All journals posted and reviewed.'
          }
        ].map((item, idx) => (
          <motion.button
            key={item.title}
            whileHover={{ scale: 1.02, translateY: -5 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate(`/company/${companyId}/${item.path}`)}
            className={`
              group relative text-left rounded-3xl p-8 transition-all duration-500 border
              ${theme === 'dark'
                ? 'bg-gradient-to-br from-white/[0.07] to-white/[0.02] border-white/10 backdrop-blur-xl hover:border-[#65D3FD]/50 hover:shadow-[0_20px_50px_-20px_rgba(101,211,253,0.4)]'
                : 'bg-white border-gray-100 shadow-sm hover:border-[#65D3FD]/30 hover:shadow-[0_20px_50px_-20px_rgba(101,211,253,0.15)]'}
            `}
          >
            <div className={`
              absolute -inset-px rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-sm pointer-events-none
              ${theme === 'dark' ? 'bg-gradient-to-br from-[#65D3FD]/10 to-transparent' : 'bg-gradient-to-br from-[#65D3FD]/5 to-transparent'}
            `} />

            <div className="relative z-10 flex flex-col h-full space-y-6">
              <div className="flex items-start justify-between">
                <div className="size-14 rounded-2xl flex items-center justify-center p-[1px] transition-all duration-500 group-hover:rotate-6 group-hover:shadow-[0_0_20px_rgba(101,211,253,0.3)] bg-gradient-to-br from-[#65D3FD] to-[#4F5CFE]">
                  <div className={`w-full h-full rounded-[15px] flex items-center justify-center ${theme === 'dark' ? 'bg-[#0a0a0f]' : 'bg-white'}`}>
                    <item.icon className="size-7 text-[#65D3FD]" />
                  </div>
                </div>
                {item.status ? getStatusBadge(item.status) : item.customBadge && (
                  <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${theme === 'dark' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
                    {item.customBadge}
                  </div>
                )}
              </div>

              <div>
                <h3 className={`text-xl font-bold mb-2 ${theme === 'dark' ? 'text-white group-hover:text-[#65D3FD]' : 'text-gray-900 group-hover:text-[#65D3FD]'}`} style={{ fontFamily: "'Outfit', sans-serif" }}>
                  {item.title}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 font-medium leading-relaxed" style={{ fontFamily: "'Manrope', sans-serif" }}>
                  {item.desc}
                </p>
              </div>

              <div className="mt-auto pt-6 border-t border-gray-100 dark:border-white/5 flex items-center justify-between text-xs font-black uppercase tracking-[2px] text-[#65D3FD]">
                <span>Manage Workflow</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-2 transition-transform" />
              </div>
            </div>
          </motion.button>
        ))}
      </div>

      {/* Recent Activity Section */}
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <h2 className={`text-2xl font-black flex items-center gap-3 tracking-tight ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`} style={{ fontFamily: "'Outfit', sans-serif" }}>
            <span className="size-10 rounded-2xl bg-[#65D3FD]/10 flex items-center justify-center">
              <Clock className="size-5 text-[#65D3FD]" />
            </span>
            Recent Activity
          </h2>
          <Button variant="ghost" className="text-[#65D3FD] font-bold hover:bg-[#65D3FD]/5 rounded-xl px-6">View All Activity</Button>
        </div>

        <div className={`
          p-20 text-center rounded-[48px] border-2 border-dashed transition-all
          ${theme === 'dark' ? 'border-white/10 bg-gradient-to-br from-white/[0.05] to-transparent' : 'border-gray-100 bg-gray-50'}
        `}>
          <div className="size-20 rounded-3xl bg-gray-900/5 dark:bg-white/5 flex items-center justify-center mx-auto mb-8 border border-gray-100 dark:border-white/5 shadow-inner">
            <Clock className="size-10 text-gray-400 opacity-20" />
          </div>
          <h3 className="text-2xl font-bold text-gray-500" style={{ fontFamily: "'Outfit', sans-serif" }}>Journal Empty</h3>
          <p className="text-gray-400 mt-2 font-medium max-w-sm mx-auto" style={{ fontFamily: "'Manrope', sans-serif" }}>
            Real-time synchronization will populate this space as you orchestrate entity workflows.
          </p>
        </div>
      </div>
    </motion.div>
  );
}