import { NewHeader } from "@/components/NewHeader";
import { Footer } from "@/components/Footer";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Check, Zap, Building2, Rocket, ArrowRight, Sparkles, Clock, TrendingDown, Shield } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner@2.0.3";

export function PricingPage() {
  const navigate = useNavigate();
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'annual'>('monthly');

  const handleTrialClick = () => {
    toast.info("Coming Soon", {
      description: "We're working hard to launch soon!",
      duration: 3000,
    });
  };

  const plans = [
    {
      name: "Starter",
      icon: Zap,
      description: "Perfect for small firms getting started with automation",
      monthlyPrice: 35,
      annualPrice: 28,
      gradient: "from-blue-500 to-cyan-500",
      clientLimit: "5-10 clients",
      transactionLimit: "1,000 invoices & receipts/month",
      timesSaved: "~45 hours/month",
      costSaved: "~$1,350/month",
      roi: "~38x",
      features: [
        "5-10 client companies",
        "1,000 invoices & receipts/month",
        "Invoice & receipt extraction",
        "Bank reconciliation",
        "AP & AR reconciliation",
        "QuickBooks, Xero & DATEV export",
        "Email support",
        "5 user seats"
      ],
      cta: "Start Free Trial",
      popular: false
    },
    {
      name: "Professional",
      icon: Building2,
      description: "For growing firms managing multiple clients",
      monthlyPrice: 59,
      annualPrice: 47,
      gradient: "from-purple-500 to-pink-500",
      clientLimit: "10-30 clients",
      transactionLimit: "5,000 invoices & receipts/month",
      timesSaved: "~225 hours/month",
      costSaved: "~$6,750/month",
      roi: "~114x",
      features: [
        "10-30 client companies",
        "5,000 invoices & receipts/month",
        "Invoice & receipt extraction",
        "Bank, AP & AR reconciliation",
        "Month-end close automation",
        "Journal entry suggestions",
        "QuickBooks, Xero & DATEV export",
        "Priority support",
        "15 user seats",
        "Custom chart of accounts",
        "Workflow templates"
      ],
      cta: "Start Free Trial",
      popular: true
    },
    {
      name: "Enterprise",
      icon: Rocket,
      description: "For large firms with advanced requirements",
      monthlyPrice: null,
      annualPrice: null,
      gradient: "from-orange-500 to-red-500",
      clientLimit: "Unlimited clients",
      transactionLimit: "Unlimited transactions",
      timesSaved: "1,000+ hours/month",
      costSaved: "$30,000+/month",
      roi: "Custom",
      features: [
        "Unlimited client companies",
        "Unlimited transactions",
        "All reconciliation workflows",
        "Month-end close automation",
        "All integrations + API access",
        "Dedicated account manager",
        "Unlimited user seats",
        "Custom integrations",
        "SLA guarantee",
        "On-premise deployment option",
        "White-label option"
      ],
      cta: "Contact Sales",
      popular: false
    }
  ];

  return (
    <div className="relative bg-black min-h-screen">
      <SEO 
        title="Pricing - Per-Firm Plans for German Accounting Firms | Novalare"
        description="Transparent per-firm pricing for AI accounting automation. Save 100+ hours/month for €299-€699. 14-day free trial. Supports QuickBooks, Xero, and DATEV."
        keywords="accounting software pricing, AI bookkeeping cost, DATEV integration pricing, QuickBooks automation pricing, accounting firm software plans, German accounting automation"
      />
      
      <NewHeader />

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-6 overflow-hidden">
        <div className="relative max-w-6xl mx-auto text-center">
          <h1 
            className="text-white mb-6"
            style={{
              fontSize: 'clamp(36px, 5vw, 64px)',
              fontWeight: '800',
              fontFamily: "'Outfit', sans-serif",
              letterSpacing: '-0.02em',
              lineHeight: '1.1'
            }}
          >
            Simple, Predictable Pricing
          </h1>

          <p 
            className="text-gray-400 max-w-2xl mx-auto mb-10"
            style={{
              fontSize: 'clamp(16px, 2vw, 20px)',
              fontFamily: "'Manrope', sans-serif",
              fontWeight: '500',
              lineHeight: '1.6'
            }}
          >
            All plans include a 1 month free trial. No credit card required. Cancel anytime.
          </p>

          {/* Billing Toggle */}
          <div className="inline-flex items-center gap-4 bg-gray-900/50 border border-white/10 rounded-full p-2">
            <button
              onClick={() => setBillingPeriod('monthly')}
              className={`px-6 py-2 rounded-full transition-all duration-300 ${
                billingPeriod === 'monthly'
                  ? 'bg-white text-black'
                  : 'text-gray-400 hover:text-white'
              }`}
              style={{ fontFamily: "'Outfit', sans-serif", fontWeight: '600' }}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingPeriod('annual')}
              className={`px-6 py-2 rounded-full transition-all duration-300 relative ${
                billingPeriod === 'annual'
                  ? 'bg-white text-black'
                  : 'text-gray-400 hover:text-white'
              }`}
              style={{ fontFamily: "'Outfit', sans-serif", fontWeight: '600' }}
            >
              Annual
              <span className="absolute -top-2 -right-2 bg-green-500 text-white text-xs px-2 py-0.5 rounded-full">
                Save 20%
              </span>
            </button>
          </div>
        </div>
      </section>

      {/* Value Prop Banner */}
      <section className="relative py-12 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gray-900/50 border border-white/10 rounded-2xl p-6 text-center">
              <Clock className="size-10 text-white/80 mx-auto mb-3" />
              <div 
                className="text-white mb-1"
                style={{
                  fontSize: '32px',
                  fontWeight: '800',
                  fontFamily: "'Outfit', sans-serif"
                }}
              >
                40+ hours
              </div>
              <p 
                className="text-gray-400"
                style={{
                  fontSize: '14px',
                  fontFamily: "'Manrope', sans-serif",
                  fontWeight: '500'
                }}
              >
                saved every month
              </p>
            </div>

            <div className="bg-gray-900/50 border border-white/10 rounded-2xl p-6 text-center">
              <TrendingDown className="size-10 text-white/80 mx-auto mb-3" />
              <div 
                className="text-white mb-1"
                style={{
                  fontSize: '32px',
                  fontWeight: '800',
                  fontFamily: "'Outfit', sans-serif"
                }}
              >
                10x+ ROI
              </div>
              <p 
                className="text-gray-400"
                style={{
                  fontSize: '14px',
                  fontFamily: "'Manrope', sans-serif",
                  fontWeight: '500'
                }}
              >
                Return on investment vs. manual work
              </p>
            </div>

            <div className="bg-gray-900/50 border border-white/10 rounded-2xl p-6 text-center">
              <Shield className="size-10 text-white/80 mx-auto mb-3" />
              <div 
                className="text-white mb-1"
                style={{
                  fontSize: '32px',
                  fontWeight: '800',
                  fontFamily: "'Outfit', sans-serif"
                }}
              >
                $59/mo
              </div>
              <p 
                className="text-gray-400"
                style={{
                  fontSize: '14px',
                  fontFamily: "'Manrope', sans-serif",
                  fontWeight: '500'
                }}
              >
                Simple, flat-rate pricing
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="relative py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {plans.map((plan, index) => (
              <div 
                key={index}
                className={`relative group ${plan.popular ? 'lg:scale-105' : ''}`}
              >
                {/* Popular badge */}
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10">
                    <div className="bg-white text-black px-4 py-1 rounded-full text-sm"
                      style={{ fontFamily: "'Outfit', sans-serif", fontWeight: '700' }}
                    >
                      Most Popular
                    </div>
                  </div>
                )}

                {/* Card */}
                <div className={`relative bg-gray-900/50 backdrop-blur-sm border ${plan.popular ? 'border-white/20' : 'border-white/10'} rounded-3xl p-8 hover:border-white/30 transition-all duration-300 h-full flex flex-col`}>
                  {/* Icon */}
                  <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center mb-6">
                    <plan.icon className="size-7 text-white" strokeWidth={2} />
                  </div>

                  {/* Plan name */}
                  <h3 
                    className="text-white mb-2"
                    style={{
                      fontSize: '24px',
                      fontWeight: '700',
                      fontFamily: "'Outfit', sans-serif"
                    }}
                  >
                    {plan.name}
                  </h3>

                  {/* Description */}
                  <p 
                    className="text-gray-400 mb-6"
                    style={{
                      fontSize: '14px',
                      fontFamily: "'Manrope', sans-serif",
                      fontWeight: '500',
                      lineHeight: '1.5'
                    }}
                  >
                    {plan.description}
                  </p>

                  {/* Price */}
                  <div className="mb-6">
                    {plan.monthlyPrice ? (
                      <>
                        <div className="flex items-baseline gap-2">
                          <span 
                            className="text-white"
                            style={{
                              fontSize: '48px',
                              fontWeight: '800',
                              fontFamily: "'Outfit', sans-serif",
                              letterSpacing: '-0.02em'
                            }}
                          >
                            ${billingPeriod === 'monthly' ? plan.monthlyPrice : plan.annualPrice}
                          </span>
                          <span 
                            className="text-gray-400"
                            style={{
                              fontSize: '16px',
                              fontFamily: "'Manrope', sans-serif",
                              fontWeight: '500'
                            }}
                          >
                            /month
                          </span>
                        </div>
                        {billingPeriod === 'annual' && (
                          <p 
                            className="text-green-400 mt-1"
                            style={{
                              fontSize: '13px',
                              fontFamily: "'Manrope', sans-serif",
                              fontWeight: '600'
                            }}
                          >
                            Billed annually at ${(plan.annualPrice || 0) * 12}
                          </p>
                        )}
                      </>
                    ) : (
                      <span 
                        className="text-white"
                        style={{
                          fontSize: '32px',
                          fontWeight: '800',
                          fontFamily: "'Outfit', sans-serif"
                        }}
                      >
                        Custom
                      </span>
                    )}
                  </div>

                  {/* Features */}
                  <ul className="space-y-3 mb-8 flex-1">
                    {plan.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-3">
                        <Check className="size-5 text-green-400 flex-shrink-0 mt-0.5" />
                        <span 
                          className="text-gray-300"
                          style={{
                            fontSize: '14px',
                            fontFamily: "'Manrope', sans-serif",
                            fontWeight: '500'
                          }}
                        >
                          {feature}
                        </span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA Button */}
                  <Button
                    onClick={handleTrialClick}
                    className={`w-full h-12 ${
                      plan.popular
                        ? 'bg-white text-black hover:bg-gray-100'
                        : 'bg-white/5 border border-white/10 text-white hover:bg-white/10'
                    } transition-all duration-300`}
                    style={{ fontFamily: "'Outfit', sans-serif", fontWeight: '600' }}
                  >
                    {plan.cta}
                    {plan.monthlyPrice && <ArrowRight className="ml-2 size-4" />}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="relative py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 
            className="text-white text-center mb-12"
            style={{
              fontSize: 'clamp(32px, 4vw, 48px)',
              fontWeight: '800',
              fontFamily: "'Outfit', sans-serif",
              letterSpacing: '-0.02em'
            }}
          >
            Frequently Asked Questions
          </h2>

          <div className="space-y-6">
            {[
              {
                q: "What's included in the free trial?",
                a: "All plans include a full-featured 1 month trial. No credit card required. You get access to all features of your chosen plan including all reconciliation workflows, invoice extraction, and DATEV/QuickBooks/Xero exports."
              },
              {
                q: "Can I upgrade or downgrade later?",
                a: "Yes! You can upgrade or downgrade your plan at any time. Changes take effect on your next billing cycle. We also offer custom enterprise pricing for firms with 1,000+ clients."
              },
              {
                q: "What integrations are supported?",
                a: "We support QuickBooks Online, Xero, and DATEV. DATEV integration is especially important for German firms, so we've built native support. Enterprise plans include API access for custom integrations."
              },
              {
                q: "What happens if I exceed my transaction limit?",
                a: "We'll notify you before you hit your limit. You can either upgrade to the next tier or purchase additional transaction capacity at discounted rates. We never stop your service mid-month."
              },
              {
                q: "Do you offer volume discounts for large firms?",
                a: "Yes! Firms managing 500+ clients or processing 50k+ transactions/month should contact our sales team for custom Enterprise pricing. We offer significant discounts based on volume and commitment."
              }
            ].map((faq, index) => (
              <div 
                key={index}
                className="bg-gray-900/30 border border-white/10 rounded-2xl p-6 hover:border-purple-500/20 transition-all duration-300"
              >
                <h3 
                  className="text-white mb-3"
                  style={{
                    fontSize: '18px',
                    fontWeight: '700',
                    fontFamily: "'Outfit', sans-serif"
                  }}
                >
                  {faq.q}
                </h3>
                <p 
                  className="text-gray-400"
                  style={{
                    fontSize: '15px',
                    fontFamily: "'Manrope', sans-serif",
                    fontWeight: '500',
                    lineHeight: '1.6'
                  }}
                >
                  {faq.a}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="bg-gray-900/50 border border-white/10 rounded-3xl p-12">
            <h2 
              className="text-white mb-4"
              style={{
                fontSize: 'clamp(28px, 3.5vw, 42px)',
                fontWeight: '800',
                fontFamily: "'Outfit', sans-serif",
                letterSpacing: '-0.02em'
              }}
            >
              Ready to Get Started?
            </h2>
            <p 
              className="text-gray-400 mb-8"
              style={{
                fontSize: '18px',
                fontFamily: "'Manrope', sans-serif",
                fontWeight: '500'
              }}
            >
              Start your 1 month free trial today. No credit card required.
            </p>
            <Button
              onClick={handleTrialClick}
              className="h-14 px-10 bg-white text-black hover:bg-gray-100 transition-all"
              style={{ fontFamily: "'Outfit', sans-serif", fontWeight: '700' }}
            >
              Start Free Trial
              <ArrowRight className="ml-2 size-5" />
            </Button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}