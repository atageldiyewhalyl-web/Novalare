import { useNavigate } from 'react-router-dom';
import { useTheme } from '@/contexts/ThemeContext';
import { Card } from '@/components/ui/card';
import { Landmark, FileText, Receipt, CreditCard, ArrowRight, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ReconciliationsLandingProps {
  companyId: string;
}

export function ReconciliationsLanding({ companyId }: ReconciliationsLandingProps) {
  const { theme } = useTheme();
  const navigate = useNavigate();

  const reconciliationTypes = [
    {
      id: 'bank',
      title: 'Bank Reconciliation',
      description: 'Reconcile bank statements with your general ledger',
      icon: Landmark,
      color: 'blue',
      path: `/company/${companyId}/reconciliations/bank`
    },
    {
      id: 'ap',
      title: 'AP Reconciliation',
      description: 'Reconcile accounts payable with vendor statements',
      icon: FileText,
      color: 'purple',
      path: `/company/${companyId}/reconciliations/ap`
    },
    {
      id: 'ar',
      title: 'AR Reconciliation',
      description: 'Reconcile accounts receivable with customer statements',
      icon: Receipt,
      color: 'green',
      path: `/company/${companyId}/reconciliations/ar`
    },
    {
      id: 'cc',
      title: 'Credit Card Reconciliation',
      description: 'Reconcile credit card statements with expenses',
      icon: CreditCard,
      color: 'orange',
      path: `/company/${companyId}/reconciliations/cc`
    }
  ];

  const getColorClasses = (color: string) => {
    const colors: Record<string, { bg: string; text: string; border: string; glow: string }> = {
      blue: {
        bg: theme === 'dark' ? 'bg-[#65D3FD]/10' : 'bg-blue-50',
        text: theme === 'dark' ? 'text-[#65D3FD]' : 'text-blue-600',
        border: theme === 'dark' ? 'border-[#65D3FD]/20' : 'border-blue-100',
        glow: 'group-hover:shadow-[0_0_30px_-5px_rgba(101,211,253,0.3)]'
      },
      purple: {
        bg: theme === 'dark' ? 'bg-purple-500/10' : 'bg-purple-50',
        text: theme === 'dark' ? 'text-purple-400' : 'text-purple-600',
        border: theme === 'dark' ? 'border-purple-500/20' : 'border-purple-100',
        glow: 'group-hover:shadow-[0_0_30px_-5px_rgba(168,85,247,0.3)]'
      },
      green: {
        bg: theme === 'dark' ? 'bg-emerald-500/10' : 'bg-emerald-50',
        text: theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600',
        border: theme === 'dark' ? 'border-emerald-500/20' : 'border-emerald-100',
        glow: 'group-hover:shadow-[0_0_30px_-5px_rgba(52,211,153,0.3)]'
      },
      orange: {
        bg: theme === 'dark' ? 'bg-orange-500/10' : 'bg-orange-50',
        text: theme === 'dark' ? 'text-orange-400' : 'text-orange-600',
        border: theme === 'dark' ? 'border-orange-500/20' : 'border-orange-100',
        glow: 'group-hover:shadow-[0_0_30px_-5px_rgba(251,146,60,0.3)]'
      }
    };
    return colors[color] || colors.blue;
  };

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
            Reconciliations
          </h1>
          <p className="text-gray-500 font-medium text-lg max-w-xl leading-relaxed" style={{ fontFamily: "'Manrope', sans-serif" }}>
            Select a reconciliation type to get started with automated, AI-powered matching.
          </p>
        </div>

        <Button
          variant="ghost"
          onClick={() => navigate(`/company/${companyId}`)}
          className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>
      </div>

      {/* Reconciliation Type Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {reconciliationTypes.map((type) => {
          const Icon = type.icon;
          const colors = getColorClasses(type.color);

          return (
            <div
              key={type.id}
              onClick={() => navigate(type.path)}
              className={`
                group relative p-8 rounded-3xl cursor-pointer transition-all duration-300
                border hover:scale-[1.01] ${colors.glow}
                ${theme === 'dark'
                  ? 'bg-gradient-to-br from-white/[0.07] to-white/[0.02] border-white/10 backdrop-blur-xl'
                  : 'bg-white border-gray-100 shadow-sm'
                }
              `}
            >
              <div className="flex items-start gap-6">
                <div className={`size-16 rounded-2xl flex items-center justify-center transition-colors duration-300 ${colors.bg} ${colors.border} border`}>
                  <Icon className={`size-8 ${colors.text}`} />
                </div>

                <div className="flex-1 pt-1">
                  <h3 className={`text-2xl font-bold mb-2 tracking-tight ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`} style={{ fontFamily: "'Outfit', sans-serif" }}>
                    {type.title}
                  </h3>
                  <p className={`text-base font-medium mb-6 leading-relaxed ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`} style={{ fontFamily: "'Manrope', sans-serif" }}>
                    {type.description}
                  </p>

                  <div className="flex items-center gap-3">
                    <span className={`text-sm font-bold uppercase tracking-widest ${colors.text}`} style={{ fontFamily: "'Outfit', sans-serif" }}>
                      Start Reconciliation
                    </span>
                    <div className={`size-8 rounded-full flex items-center justify-center transition-all duration-300 group-hover:translate-x-2 ${colors.bg}`}>
                      <ArrowRight className={`size-4 ${colors.text}`} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Help Section */}
      <div className={`p-8 rounded-[32px] border ${theme === 'dark' ? 'bg-white/[0.02] border-white/5' : 'bg-blue-50/50 border-blue-100'}`}>
        <h3 className={`text-lg font-bold mb-3 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-900'}`} style={{ fontFamily: "'Outfit', sans-serif" }}>
          Need help getting started?
        </h3>
        <p className={`text-sm mb-6 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-600'}`} style={{ fontFamily: "'Manrope', sans-serif" }}>
          Reconciliations help ensure your books are accurate by matching your records with external statements.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="flex items-start gap-3">
            <div className={`mt-1 size-1.5 rounded-full ${theme === 'dark' ? 'bg-[#65D3FD]' : 'bg-blue-500'}`} />
            <span className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
              <strong className={theme === 'dark' ? 'text-gray-200' : 'text-gray-900'}>Bank Rec:</strong> Compare bank statements with GL
            </span>
          </div>
          <div className="flex items-start gap-3">
            <div className={`mt-1 size-1.5 rounded-full ${theme === 'dark' ? 'bg-purple-500' : 'bg-purple-500'}`} />
            <span className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
              <strong className={theme === 'dark' ? 'text-gray-200' : 'text-gray-900'}>AP Rec:</strong> Match vendor statements with AP
            </span>
          </div>
          <div className="flex items-start gap-3">
            <div className={`mt-1 size-1.5 rounded-full ${theme === 'dark' ? 'bg-emerald-500' : 'bg-emerald-500'}`} />
            <span className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
              <strong className={theme === 'dark' ? 'text-gray-200' : 'text-gray-900'}>AR Rec:</strong> Verify customer payments with AR
            </span>
          </div>
          <div className="flex items-start gap-3">
            <div className={`mt-1 size-1.5 rounded-full ${theme === 'dark' ? 'bg-orange-500' : 'bg-orange-500'}`} />
            <span className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
              <strong className={theme === 'dark' ? 'text-gray-200' : 'text-gray-900'}>CC Rec:</strong> Reconcile CC statements with expenses
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}