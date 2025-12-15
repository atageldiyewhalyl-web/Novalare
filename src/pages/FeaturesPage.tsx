import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner@2.0.3";
import { 
  FileText, 
  Landmark, 
  ReceiptText, 
  Calendar, 
  Zap, 
  Shield, 
  CheckCircle,
  Check,
  ArrowRight,
  Sparkles,
  Brain,
  Clock,
  TrendingUp,
  TrendingDown
} from "lucide-react";

export function FeaturesPage() {
  const navigate = useNavigate();

  const handleTrialClick = () => {
    toast.info("Coming Soon", {
      description: "Free trial will be available soon. Stay tuned!",
      duration: 3000,
    });
  };

  const features = [
    {
      icon: FileText,
      title: "Invoice Extraction",
      description: "AI-powered invoice data extraction with 99.9% accuracy. Upload invoices and let AI extract vendor, amount, date, line items, and tax codes automatically.",
      benefits: [
        "Support for PDF, PNG, JPG formats",
        "Automatic vendor matching",
        "Line-item level extraction",
        "Multi-currency support"
      ],
      gradient: "from-purple-500 to-pink-500"
    },
    {
      icon: Landmark,
      title: "Bank Reconciliation",
      description: "Automate bank reconciliation with intelligent transaction matching. Upload bank statements and let AI match transactions to your ledger entries.",
      benefits: [
        "Smart transaction matching",
        "Duplicate detection",
        "Suggested GL accounts",
        "One-click reconciliation"
      ],
      gradient: "from-blue-500 to-cyan-500"
    },
    {
      icon: ReceiptText,
      title: "AP Reconciliation",
      description: "Streamline accounts payable reconciliation with automated matching between invoices and payments. Identify discrepancies instantly.",
      benefits: [
        "Invoice-to-payment matching",
        "Aging analysis",
        "Vendor statement reconciliation",
        "Payment status tracking"
      ],
      gradient: "from-orange-500 to-red-500"
    },
    {
      icon: Calendar,
      title: "Month-End Close",
      description: "Accelerate month-end close with AI-powered trial balance analysis, automatic adjusting entries, and variance detection.",
      benefits: [
        "Trial balance validation",
        "AI-suggested adjustments",
        "Variance analysis",
        "Close checklist automation"
      ],
      gradient: "from-green-500 to-emerald-500"
    }
  ];

  const integrations = [
    { name: "QuickBooks", logo: "📊" },
    { name: "Xero", logo: "🔵" },
    { name: "DATEV", logo: "🇩🇪" }
  ];

  return (
    <div className="relative bg-black min-h-screen">
      <SEO 
        title="Features - AI Accounting Automation | Novalare"
        description="Explore Novalare's AI-powered features: invoice extraction, bank reconciliation, AP reconciliation, and month-end close automation. Supports QuickBooks, Xero, and DATEV."
        keywords="invoice extraction software, bank reconciliation automation, AP reconciliation, month-end close automation, QuickBooks integration, Xero integration, DATEV software"
      />
      
      <Header />

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-4 sm:px-6 overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-purple-900/20 via-transparent to-transparent" />
        
        <div className="relative max-w-6xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-500/10 border border-purple-500/20 rounded-full mb-6">
            <Sparkles className="size-4 text-purple-400" />
            <span className="text-sm text-purple-300" style={{ fontFamily: "'Outfit', sans-serif", fontWeight: '600' }}>
              AI-Powered Features
            </span>
          </div>

          <h1 
            className="text-white mb-6 px-4"
            style={{
              fontSize: 'clamp(32px, 5vw, 64px)',
              fontWeight: '800',
              fontFamily: "'Outfit', sans-serif",
              letterSpacing: '-0.02em',
              lineHeight: '1.1'
            }}
          >
            Everything You Need to
            <br />
            <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-orange-400 bg-clip-text text-transparent">
              10x Your Accounting
            </span>
          </h1>

          <p 
            className="text-gray-300 max-w-2xl mx-auto mb-10 px-4"
            style={{
              fontSize: 'clamp(15px, 2vw, 20px)',
              fontFamily: "'Manrope', sans-serif",
              fontWeight: '500',
              lineHeight: '1.6'
            }}
          >
            Novalare combines cutting-edge AI with accounting expertise to automate tedious workflows and give you more time for strategic work.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 px-4">
            <Button
              onClick={handleTrialClick}
              className="h-14 px-8 w-full sm:w-auto bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white border-0 shadow-lg shadow-purple-500/25"
              style={{ fontFamily: "'Outfit', sans-serif", fontWeight: '600' }}
            >
              Start Free Trial
              <ArrowRight className="ml-2 size-5" />
            </Button>
            <Button
              onClick={() => navigate('/invoice-demo')}
              variant="outline"
              className="h-14 px-8 w-full sm:w-auto bg-white/5 border-white/10 text-white hover:bg-white/10"
              style={{ fontFamily: "'Outfit', sans-serif", fontWeight: '600' }}
            >
              Try Demo
            </Button>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="relative py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {features.map((feature, index) => (
              <div 
                key={index}
                className="relative group"
              >
                {/* Glow effect */}
                <div className={`absolute -inset-0.5 bg-gradient-to-r ${feature.gradient} rounded-3xl opacity-0 group-hover:opacity-20 blur-xl transition-opacity duration-500`} />
                
                {/* Card */}
                <div className="relative bg-gray-900/50 backdrop-blur-sm border border-white/10 rounded-3xl p-8 hover:border-white/20 transition-all duration-300">
                  {/* Icon */}
                  <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-6 shadow-lg`}>
                    <feature.icon className="size-8 text-white" strokeWidth={2} />
                  </div>

                  {/* Title */}
                  <h3 
                    className="text-white mb-4"
                    style={{
                      fontSize: 'clamp(20px, 2.5vw, 28px)',
                      fontWeight: '700',
                      fontFamily: "'Outfit', sans-serif",
                      letterSpacing: '-0.01em'
                    }}
                  >
                    {feature.title}
                  </h3>

                  {/* Description */}
                  <p 
                    className="text-gray-400 mb-6"
                    style={{
                      fontSize: '16px',
                      fontFamily: "'Manrope', sans-serif",
                      fontWeight: '500',
                      lineHeight: '1.6'
                    }}
                  >
                    {feature.description}
                  </p>

                  {/* Benefits */}
                  <ul className="space-y-3">
                    {feature.benefits.map((benefit, idx) => (
                      <li key={idx} className="flex items-start gap-3">
                        <CheckCircle className="size-5 text-green-400 flex-shrink-0 mt-0.5" />
                        <span 
                          className="text-gray-300"
                          style={{
                            fontSize: '14px',
                            fontFamily: "'Manrope', sans-serif",
                            fontWeight: '500'
                          }}
                        >
                          {benefit}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Differentiation Section - Most Tools Stop at OCR */}
      <section className="relative py-20 px-6 bg-gradient-to-b from-transparent via-purple-900/10 to-transparent">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 
              className="text-white mb-4"
              style={{
                fontSize: 'clamp(32px, 4vw, 48px)',
                fontWeight: '800',
                fontFamily: "'Outfit', sans-serif",
                letterSpacing: '-0.02em'
              }}
            >
              Most Tools Stop at{' '}
              <span className="text-gray-500 line-through">Invoice Extraction</span>
              <br />
              <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-orange-400 bg-clip-text text-transparent">
                Novalare Understands Your Workflow
              </span>
            </h2>
            <p 
              className="text-gray-300 max-w-3xl mx-auto"
              style={{
                fontSize: '18px',
                fontFamily: "'Manrope', sans-serif",
                fontWeight: '500',
                lineHeight: '1.6'
              }}
            >
              Competitors offer "dumb OCR" that just extracts fields. We understand how invoices flow into reconciliation and journal entries — automatically.
            </p>
          </div>

          {/* Comparison Grid */}
          <div className="grid grid-cols-1 gap-8 mb-16">
            {/* Competitors */}
            <div className="bg-gray-900/30 border border-red-500/20 rounded-3xl p-6 sm:p-8">
              <div className="flex items-start sm:items-center gap-3 mb-6 flex-wrap">
                <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-2xl">❌</span>
                </div>
                <h3 
                  className="text-red-400"
                  style={{
                    fontSize: 'clamp(18px, 3vw, 24px)',
                    fontWeight: '700',
                    fontFamily: "'Outfit', sans-serif"
                  }}
                >
                  Other Tools
                </h3>
              </div>

              <ul className="space-y-4">
                {[
                  "Just extract invoice fields (vendor, date, amount)",
                  "Email forwarding with no intelligence at intake",
                  "No duplicate detection across sources",
                  "No understanding of bank ↔ invoice ↔ ledger context",
                  "Human still decides: AP vs Expense vs Prepaid",
                  "Reconciliation happens weeks later manually",
                  "Month-end = chaos, unmatched transactions, cleanup",
                  "JEs are still entirely manual guesswork"
                ].map((item, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <div className="w-2 h-2 rounded-full bg-red-500" />
                    </div>
                    <span 
                      className="text-gray-400"
                      style={{
                        fontSize: 'clamp(14px, 2vw, 15px)',
                        fontFamily: "'Manrope', sans-serif",
                        fontWeight: '500',
                        lineHeight: '1.5'
                      }}
                    >
                      {item}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Novalare */}
            <div className="bg-gradient-to-br from-purple-900/20 to-pink-900/20 border border-purple-500/30 rounded-3xl p-6 sm:p-8">
              <div className="flex items-start sm:items-center gap-3 mb-6 flex-wrap">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0">
                  <span className="text-2xl">✨</span>
                </div>
                <h3 
                  className="text-purple-300"
                  style={{
                    fontSize: 'clamp(18px, 3vw, 24px)',
                    fontWeight: '700',
                    fontFamily: "'Outfit', sans-serif"
                  }}
                >
                  Novalare (Context-Aware AI)
                </h3>
              </div>

              <ul className="space-y-4">
                {[
                  "Understands bank ↔ invoice ↔ ledger relationships",
                  "Smart intake: detects duplicates at upload time",
                  "Knows if invoice is already paid from bank data",
                  "Auto-categorizes: AP vs Expense vs Prepaid vs Timing",
                  "Reconciliation awareness from day 1, not month-end",
                  "Matches invoices to bank transactions automatically",
                  "Month-end = review & approve, not manual cleanup",
                  "AI suggests journal entries based on full context"
                ].map((item, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <Check className="size-5 text-green-400 flex-shrink-0 mt-0.5" />
                    <span 
                      className="text-gray-200"
                      style={{
                        fontSize: 'clamp(14px, 2vw, 15px)',
                        fontFamily: "'Manrope', sans-serif",
                        fontWeight: '500',
                        lineHeight: '1.5'
                      }}
                    >
                      {item}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Key Message Banner */}
          <div className="relative">
            <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 via-pink-600 to-orange-600 rounded-3xl opacity-20 blur-2xl" />
            <div className="relative bg-gradient-to-br from-purple-900/40 to-pink-900/40 border border-purple-500/30 rounded-3xl p-10 text-center">
              <p 
                className="text-purple-200 mb-4"
                style={{
                  fontSize: '18px',
                  fontFamily: "'Manrope', sans-serif",
                  fontWeight: '600'
                }}
              >
                The difference that saves you 100+ hours per month:
              </p>
              <p 
                className="text-white mb-2"
                style={{
                  fontSize: 'clamp(24px, 3vw, 36px)',
                  fontWeight: '800',
                  fontFamily: "'Outfit', sans-serif",
                  letterSpacing: '-0.02em',
                  lineHeight: '1.2'
                }}
              >
                No more month-end cleanup.<br />
                No unmatched transactions.<br />
                JE suggestions you can actually approve.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ROI & Value Section */}
      <section className="relative py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 
              className="text-white mb-4"
              style={{
                fontSize: 'clamp(32px, 4vw, 48px)',
                fontWeight: '800',
                fontFamily: "'Outfit', sans-serif",
                letterSpacing: '-0.02em'
              }}
            >
              Why This Is An{' '}
              <span className="bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">
                Incredible Bargain
              </span>
            </h2>
            <p 
              className="text-gray-300 max-w-3xl mx-auto"
              style={{
                fontSize: '18px',
                fontFamily: "'Manrope', sans-serif",
                fontWeight: '500',
                lineHeight: '1.6'
              }}
            >
              Let's do the math for a mid-tier German accounting firm
            </p>
          </div>

          {/* Calculation Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
            {/* Manual Reality */}
            <div className="bg-red-900/10 border border-red-500/20 rounded-2xl p-6 sm:p-8">
              <h3 
                className="text-red-400 mb-6"
                style={{
                  fontSize: 'clamp(18px, 3vw, 22px)',
                  fontWeight: '700',
                  fontFamily: "'Outfit', sans-serif"
                }}
              >
                ❌ Manual Reality (100 clients)
              </h3>
              
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-0 pb-3 border-b border-red-500/10">
                  <span className="text-gray-300 text-sm sm:text-base" style={{ fontFamily: "'Manrope', sans-serif", fontWeight: '500' }}>
                    Invoices/receipts per month
                  </span>
                  <span className="text-white text-sm sm:text-base" style={{ fontFamily: "'Outfit', sans-serif", fontWeight: '700' }}>
                    4,000-6,000
                  </span>
                </div>
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-0 pb-3 border-b border-red-500/10">
                  <span className="text-gray-300 text-sm sm:text-base" style={{ fontFamily: "'Manrope', sans-serif", fontWeight: '500' }}>
                    Time per document
                  </span>
                  <span className="text-white text-sm sm:text-base" style={{ fontFamily: "'Outfit', sans-serif", fontWeight: '700' }}>
                    2-4 min
                  </span>
                </div>
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-0 pb-3 border-b border-red-500/10">
                  <span className="text-gray-300 text-sm sm:text-base" style={{ fontFamily: "'Manrope', sans-serif", fontWeight: '500' }}>
                    Total time/month
                  </span>
                  <span className="text-white text-sm sm:text-base" style={{ fontFamily: "'Outfit', sans-serif", fontWeight: '700' }}>
                    130-400 hours
                  </span>
                </div>
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-0 pt-3">
                  <span className="text-red-400 text-sm sm:text-base" style={{ fontFamily: "'Manrope', sans-serif", fontWeight: '600' }}>
                    Cost @ €30/hour
                  </span>
                  <span className="text-red-400" style={{ fontSize: 'clamp(20px, 3vw, 24px)', fontFamily: "'Outfit', sans-serif", fontWeight: '800' }}>
                    €3,900-€12,000
                  </span>
                </div>
              </div>
            </div>

            {/* Novalare Reality */}
            <div className="bg-green-900/10 border border-green-500/20 rounded-2xl p-6 sm:p-8">
              <h3 
                className="text-green-400 mb-6"
                style={{
                  fontSize: 'clamp(18px, 3vw, 22px)',
                  fontWeight: '700',
                  fontFamily: "'Outfit', sans-serif"
                }}
              >
                ✅ With Novalare
              </h3>
              
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-0 pb-3 border-b border-green-500/10">
                  <span className="text-gray-300 text-sm sm:text-base" style={{ fontFamily: "'Manrope', sans-serif", fontWeight: '500' }}>
                    Same documents processed
                  </span>
                  <span className="text-white text-sm sm:text-base" style={{ fontFamily: "'Outfit', sans-serif", fontWeight: '700' }}>
                    4,000-6,000
                  </span>
                </div>
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-0 pb-3 border-b border-green-500/10">
                  <span className="text-gray-300 text-sm sm:text-base" style={{ fontFamily: "'Manrope', sans-serif", fontWeight: '500' }}>
                    AI processing time
                  </span>
                  <span className="text-white text-sm sm:text-base" style={{ fontFamily: "'Outfit', sans-serif", fontWeight: '700' }}>
                    ~10 seconds
                  </span>
                </div>
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-0 pb-3 border-b border-green-500/10">
                  <span className="text-gray-300 text-sm sm:text-base" style={{ fontFamily: "'Manrope', sans-serif", fontWeight: '500' }}>
                    Review time saved
                  </span>
                  <span className="text-white text-sm sm:text-base" style={{ fontFamily: "'Outfit', sans-serif", fontWeight: '700' }}>
                    100-200 hours
                  </span>
                </div>
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-0 pt-3">
                  <span className="text-green-400 text-sm sm:text-base" style={{ fontFamily: "'Manrope', sans-serif", fontWeight: '600' }}>
                    Monthly cost
                  </span>
                  <span className="text-green-400" style={{ fontSize: 'clamp(20px, 3vw, 24px)', fontFamily: "'Outfit', sans-serif", fontWeight: '800' }}>
                    €299-€699
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Line */}
          <div className="relative">
            <div className="absolute -inset-1 bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 rounded-3xl opacity-20 blur-2xl" />
            <div className="relative bg-gradient-to-br from-green-900/30 to-emerald-900/30 border border-green-500/30 rounded-3xl p-8 text-center">
              <p 
                className="text-gray-300 mb-4"
                style={{
                  fontSize: '18px',
                  fontFamily: "'Manrope', sans-serif",
                  fontWeight: '500'
                }}
              >
                You save €3,600 - €11,700 per month
              </p>
              <p 
                className="text-green-400 mb-2"
                style={{
                  fontSize: '42px',
                  fontWeight: '800',
                  fontFamily: "'Outfit', sans-serif",
                  letterSpacing: '-0.02em'
                }}
              >
                That's a 12-39x ROI
              </p>
              <p 
                className="text-gray-400"
                style={{
                  fontSize: '15px',
                  fontFamily: "'Manrope', sans-serif",
                  fontWeight: '500'
                }}
              >
                €299-€699/month replaces €3,900-€12,000 worth of manual labor
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Why Choose Novalare */}
      <section className="relative py-20 px-6 bg-gradient-to-b from-transparent via-purple-900/10 to-transparent">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 
              className="text-white mb-4"
              style={{
                fontSize: 'clamp(32px, 4vw, 48px)',
                fontWeight: '800',
                fontFamily: "'Outfit', sans-serif",
                letterSpacing: '-0.02em'
              }}
            >
              Why Choose Novalare?
            </h2>
            <p 
              className="text-gray-400 max-w-2xl mx-auto"
              style={{
                fontSize: '18px',
                fontFamily: "'Manrope', sans-serif",
                fontWeight: '500'
              }}
            >
              Built specifically for European accounting firms with unique needs
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: Brain, title: "AI-Powered", desc: "99.9% accuracy with machine learning" },
              { icon: Clock, title: "10x Faster", desc: "Complete reconciliations in minutes" },
              { icon: Shield, title: "Secure & Compliant", desc: "SOC 2, GDPR compliant" },
              { icon: TrendingUp, title: "Scalable", desc: "From 10 to 10,000 clients" }
            ].map((item, index) => (
              <div 
                key={index}
                className="bg-gray-900/30 border border-white/10 rounded-2xl p-6 text-center hover:border-purple-500/30 transition-all duration-300"
              >
                <item.icon className="size-10 text-purple-400 mx-auto mb-4" strokeWidth={2} />
                <h3 
                  className="text-white mb-2"
                  style={{
                    fontSize: '18px',
                    fontWeight: '700',
                    fontFamily: "'Outfit', sans-serif"
                  }}
                >
                  {item.title}
                </h3>
                <p 
                  className="text-gray-400"
                  style={{
                    fontSize: '14px',
                    fontFamily: "'Manrope', sans-serif",
                    fontWeight: '500'
                  }}
                >
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Integrations */}
      <section className="relative py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h2 
            className="text-white mb-6"
            style={{
              fontSize: 'clamp(28px, 3.5vw, 42px)',
              fontWeight: '800',
              fontFamily: "'Outfit', sans-serif",
              letterSpacing: '-0.02em'
            }}
          >
            Seamless Integrations
          </h2>
          <p 
            className="text-gray-400 mb-12"
            style={{
              fontSize: '18px',
              fontFamily: "'Manrope', sans-serif",
              fontWeight: '500'
            }}
          >
            Export directly to your favorite accounting software
          </p>

          <div className="flex flex-wrap items-center justify-center gap-6">
            {/* QuickBooks */}
            <div className="bg-gray-900/50 border border-white/10 rounded-2xl px-8 py-6 hover:border-purple-500/30 transition-all duration-300 min-w-[200px]">
              <div className="flex items-center gap-4">
                <div className="flex gap-1">
                  <div className="w-1 h-8 bg-green-500 rounded-sm"></div>
                  <div className="w-1 h-8 bg-blue-500 rounded-sm"></div>
                  <div className="w-1 h-8 bg-yellow-500 rounded-sm"></div>
                  <div className="w-1 h-8 bg-orange-500 rounded-sm"></div>
                </div>
                <span 
                  className="text-white"
                  style={{
                    fontSize: '24px',
                    fontWeight: '700',
                    fontFamily: "'Outfit', sans-serif"
                  }}
                >
                  QuickBooks
                </span>
              </div>
            </div>

            {/* Xero */}
            <div className="bg-gray-900/50 border border-white/10 rounded-2xl px-8 py-6 hover:border-purple-500/30 transition-all duration-300 min-w-[200px]">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
                  <div className="w-6 h-6 rounded-full bg-blue-500"></div>
                </div>
                <span 
                  className="text-white"
                  style={{
                    fontSize: '24px',
                    fontWeight: '700',
                    fontFamily: "'Outfit', sans-serif"
                  }}
                >
                  Xero
                </span>
              </div>
            </div>

            {/* DATEV */}
            <div className="bg-gray-900/50 border border-white/10 rounded-2xl px-8 py-6 hover:border-purple-500/30 transition-all duration-300 min-w-[200px]">
              <div className="flex items-center gap-4">
                <div className="flex flex-col gap-0.5">
                  <div className="w-10 h-2.5 bg-black rounded-sm"></div>
                  <div className="w-10 h-2.5 bg-red-600 rounded-sm"></div>
                  <div className="w-10 h-2.5 bg-yellow-400 rounded-sm"></div>
                </div>
                <span 
                  className="text-white"
                  style={{
                    fontSize: '24px',
                    fontWeight: '700',
                    fontFamily: "'Outfit', sans-serif"
                  }}
                >
                  DATEV
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="relative">
            <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 via-pink-600 to-orange-600 rounded-3xl opacity-20 blur-2xl" />
            <div className="relative bg-gradient-to-br from-purple-900/50 to-pink-900/50 border border-purple-500/20 rounded-3xl p-12">
              <h2 
                className="text-white mb-4"
                style={{
                  fontSize: 'clamp(28px, 3.5vw, 42px)',
                  fontWeight: '800',
                  fontFamily: "'Outfit', sans-serif",
                  letterSpacing: '-0.02em'
                }}
              >
                Ready to Transform Your Workflow?
              </h2>
              <p 
                className="text-purple-200 mb-8"
                style={{
                  fontSize: '18px',
                  fontFamily: "'Manrope', sans-serif",
                  fontWeight: '500'
                }}
              >
                Join hundreds of accounting firms already using Novalare
              </p>
              <Button
                onClick={handleTrialClick}
                className="h-14 px-10 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white border-0 shadow-lg shadow-purple-500/25"
                style={{ fontFamily: "'Outfit', sans-serif", fontWeight: '700' }}
              >
                Start Your Free Trial
                <ArrowRight className="ml-2 size-5" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}