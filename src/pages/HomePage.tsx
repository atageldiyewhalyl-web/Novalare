import { ReconciliationSection } from "../components/ReconciliationSection";
import { JournalEntrySection } from "../components/JournalEntrySection";
import { InvoiceAutomationSection } from "../components/InvoiceAutomationSection";
import { SEO } from "../components/SEO";
import { Header } from "../components/Header";
import { ShaderBackground } from "../components/shader-background";
import { KineticTypography } from "../components/kinetic-typography";
import { HeroValueSection } from "../components/HeroValueSection";
import { MagneticText } from "../components/magnetic-text";
import { ScrollAnimatedIcons } from "../components/scroll-animated-icons";
import { AnimatedTestimonial } from "../components/animated-testimonial";
import { WorkflowSection } from "../components/WorkflowSection";
import { ConsultationSection } from "../components/ConsultationSection";
import { PhilosophySection } from "../components/PhilosophySection";
import { Footer } from "../components/Footer";
import { TrendingDown, DollarSign, PiggyBank, Clock, Zap, Timer, Moon, Sun, CloudMoon, Users, Heart, Star, FileText, Calendar } from "lucide-react";
import { useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";

export function HomePage() {
  const helixSectionRef = useRef<HTMLDivElement>(null);
  const servicesSectionRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  return (
    <div className="relative bg-black min-h-screen overflow-x-hidden">
      {/* SEO Meta Tags */}
      <SEO 
        title="Novalare - AI Copilot for Accountants | 10x Faster Bookkeeping"
        description="AI-powered accounting automation for European firms. Automate invoice extraction, bank reconciliation, and month-end close. Supports QuickBooks, Xero, and DATEV integration."
        keywords="accounting automation, AI bookkeeping, DATEV integration, invoice extraction, bank reconciliation, QuickBooks automation, Xero integration, AI copilot accountants, European accounting software"
      />
      
      {/* Header */}
      <Header />
      
      {/* SECTION 1: Intro with Kinetic Typography */}
      <section className="relative w-full h-screen overflow-hidden">
        <ShaderBackground />
        <KineticTypography />
      </section>

      {/* SECTION 2: Hero Value Proposition */}
      <HeroValueSection />

      {/* Demo Buttons Section - Centered in Black Space */}
      <section id="demos" className="relative w-full py-12 md:py-16 lg:py-24 flex items-center justify-center px-4">
        <div className="max-w-5xl mx-auto w-full">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
            viewport={{ once: true }}
            className="text-center text-white mb-8 md:mb-12"
            style={{
              fontSize: 'clamp(28px, 4vw, 36px)',
              fontWeight: '800',
              fontFamily: "'Outfit', sans-serif",
              letterSpacing: '-0.02em',
            }}
          >
            Try Our AI Demos
          </motion.h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 lg:gap-8">
            {/* Invoice Demo */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.1, ease: [0.25, 0.1, 0.25, 1] }}
              viewport={{ once: true }}
              className="flex flex-col items-center"
            >
              <button
                onClick={() => navigate('/invoice-demo')}
                className="group inline-flex items-center justify-center gap-2 md:gap-3 px-5 md:px-6 lg:px-8 py-3 md:py-4 rounded-full transition-all duration-300 hover:scale-105 active:scale-95 relative w-full"
                style={{
                  background: 'linear-gradient(135deg, #8b5cf6 0%, #d946ef 50%, #f97316 100%)',
                  boxShadow: '0 20px 60px rgba(139, 92, 246, 0.5), 0 0 80px rgba(139, 92, 246, 0.3)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = '0 25px 80px rgba(139, 92, 246, 0.7), 0 0 100px rgba(139, 92, 246, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = '0 20px 60px rgba(139, 92, 246, 0.5), 0 0 80px rgba(139, 92, 246, 0.3)';
                }}
              >
                <FileText className="w-4 h-4 md:w-5 md:h-5 lg:w-6 lg:h-6 text-white transition-transform duration-300 group-hover:scale-110" strokeWidth={2.5} />
                <span
                  className="text-white"
                  style={{
                    fontSize: 'clamp(14px, 1.8vw, 16px)',
                    fontWeight: '700',
                    fontFamily: "'Outfit', sans-serif",
                    letterSpacing: '-0.01em',
                  }}
                >
                  Invoice Extraction
                </span>
              </button>
              
              <p 
                className="text-purple-200/80 mt-2 md:mt-3 text-center px-2"
                style={{
                  fontSize: 'clamp(12px, 1.3vw, 14px)',
                  fontWeight: '500',
                  fontFamily: "'Manrope', sans-serif",
                }}
              >
                Extract invoice data instantly
              </p>
            </motion.div>

            {/* PE Demo */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
              viewport={{ once: true }}
              className="flex flex-col items-center"
            >
              <button
                onClick={() => navigate('/pe-demo')}
                className="group inline-flex items-center justify-center gap-2 md:gap-3 px-5 md:px-6 lg:px-8 py-3 md:py-4 rounded-full transition-all duration-300 hover:scale-105 active:scale-95 relative w-full"
                style={{
                  background: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 50%, #8b5cf6 100%)',
                  boxShadow: '0 20px 60px rgba(6, 182, 212, 0.5), 0 0 80px rgba(6, 182, 212, 0.3)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = '0 25px 80px rgba(6, 182, 212, 0.7), 0 0 100px rgba(6, 182, 212, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = '0 20px 60px rgba(6, 182, 212, 0.5), 0 0 80px rgba(6, 182, 212, 0.3)';
                }}
              >
                <FileText className="w-4 h-4 md:w-5 md:h-5 lg:w-6 lg:h-6 text-white transition-transform duration-300 group-hover:scale-110" strokeWidth={2.5} />
                <span
                  className="text-white"
                  style={{
                    fontSize: 'clamp(14px, 1.8vw, 16px)',
                    fontWeight: '700',
                    fontFamily: "'Outfit', sans-serif",
                    letterSpacing: '-0.01em',
                  }}
                >
                  10-K Analyzer
                </span>
              </button>
              
              <p 
                className="text-cyan-200/80 mt-2 md:mt-3 text-center px-2"
                style={{
                  fontSize: 'clamp(12px, 1.3vw, 14px)',
                  fontWeight: '500',
                  fontFamily: "'Manrope', sans-serif",
                }}
              >
                Extract financial metrics from 10-Ks
              </p>
            </motion.div>

            {/* Bank Rec Demo */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
              viewport={{ once: true }}
              className="flex flex-col items-center"
            >
              <button
                onClick={() => navigate('/bank-demo')}
                className="group inline-flex items-center justify-center gap-2 md:gap-3 px-5 md:px-6 lg:px-8 py-3 md:py-4 rounded-full transition-all duration-300 hover:scale-105 active:scale-95 relative w-full"
                style={{
                  background: 'linear-gradient(135deg, #10b981 0%, #14b8a6 50%, #06b6d4 100%)',
                  boxShadow: '0 20px 60px rgba(16, 185, 129, 0.5), 0 0 80px rgba(16, 185, 129, 0.3)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = '0 25px 80px rgba(16, 185, 129, 0.7), 0 0 100px rgba(16, 185, 129, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = '0 20px 60px rgba(16, 185, 129, 0.5), 0 0 80px rgba(16, 185, 129, 0.3)';
                }}
              >
                <FileText className="w-4 h-4 md:w-5 md:h-5 lg:w-6 lg:h-6 text-white transition-transform duration-300 group-hover:scale-110" strokeWidth={2.5} />
                <span
                  className="text-white"
                  style={{
                    fontSize: 'clamp(14px, 1.8vw, 16px)',
                    fontWeight: '700',
                    fontFamily: "'Outfit', sans-serif",
                    letterSpacing: '-0.01em',
                  }}
                >
                  Bank Reconciliation
                </span>
              </button>
              
              <p 
                className="text-emerald-200/80 mt-2 md:mt-3 text-center px-2"
                style={{
                  fontSize: 'clamp(12px, 1.3vw, 14px)',
                  fontWeight: '500',
                  fontFamily: "'Manrope', sans-serif",
                }}
              >
                Auto-match transactions & detect issues
              </p>
            </motion.div>
          </div>

          {/* Second Row - AP Reconciliation centered */}
          <div className="mt-6 md:mt-8 flex justify-center">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
              viewport={{ once: true }}
              className="flex flex-col items-center max-w-xs w-full"
            >
              <button
                onClick={() => navigate('/ap-demo')}
                className="group inline-flex items-center justify-center gap-2 md:gap-3 px-5 md:px-6 lg:px-8 py-3 md:py-4 rounded-full transition-all duration-300 hover:scale-105 active:scale-95 relative w-full"
                style={{
                  background: 'linear-gradient(135deg, #f59e0b 0%, #f97316 50%, #ef4444 100%)',
                  boxShadow: '0 20px 60px rgba(245, 158, 11, 0.5), 0 0 80px rgba(245, 158, 11, 0.3)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = '0 25px 80px rgba(245, 158, 11, 0.7), 0 0 100px rgba(245, 158, 11, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = '0 20px 60px rgba(245, 158, 11, 0.5), 0 0 80px rgba(245, 158, 11, 0.3)';
                }}
              >
                <FileText className="w-4 h-4 md:w-5 md:h-5 lg:w-6 lg:h-6 text-white transition-transform duration-300 group-hover:scale-110" strokeWidth={2.5} />
                <span
                  className="text-white"
                  style={{
                    fontSize: 'clamp(14px, 1.8vw, 16px)',
                    fontWeight: '700',
                    fontFamily: "'Outfit', sans-serif",
                    letterSpacing: '-0.01em',
                  }}
                >
                  AP Reconciliation
                </span>
              </button>
              
              <p 
                className="text-orange-200/80 mt-2 md:mt-3 text-center px-2"
                style={{
                  fontSize: 'clamp(12px, 1.3vw, 14px)',
                  fontWeight: '500',
                  fontFamily: "'Manrope', sans-serif",
                }}
              >
                Reconcile vendor statements instantly
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Reconciliation Animation Section */}
      <ReconciliationSection />

      {/* Invoice Automation Section */}
      <InvoiceAutomationSection />

      {/* Journal Entry Section */}
      <JournalEntrySection />

      {/* SECTIONS 3-10: Content with helix animations spanning all sections including services */}
      <div ref={helixSectionRef} className="relative">
        <ScrollAnimatedIcons 
          containerRef={helixSectionRef} 
          servicesSectionRef={servicesSectionRef}
        />
        
        {/* SECTION 3: Why Choose Novalare */}
        <section id="benefits" className="relative min-h-screen flex items-center justify-center px-4 sm:px-6 pb-8 pt-16 md:pt-0">
          <div className="relative z-10 text-center max-w-4xl">
            <h1 className="text-4xl sm:text-5xl md:text-6xl text-white mb-4 md:mb-6 font-extrabold">
              <MagneticText 
                text="Why choose " 
                className="text-white"
                magnetStrength={0.15}
              />
              <MagneticText 
                text="Novalare" 
                className="text-white"
                magnetStrength={0.35}
                isGradient={false}
                style={{ 
                  fontWeight: '700',
                  textShadow: '0 0 40px rgba(255, 255, 255, 0.3), 0 0 80px rgba(255, 255, 255, 0.15)',
                }}
              />
              <MagneticText 
                text="?" 
                className="text-white"
                magnetStrength={0.15}
              />
            </h1>
            <p className="text-lg sm:text-xl md:text-2xl text-purple-200 px-6 sm:px-8">
              <span className="hidden sm:inline">
                <MagneticText 
                  text="Your processes, rebuilt for speed and clarity." 
                  className="text-purple-200"
                  magnetStrength={0.12}
                />
              </span>
              <span className="sm:hidden text-center block">
                <MagneticText 
                  text="Your processes, rebuilt " 
                  className="text-purple-200"
                  magnetStrength={0.12}
                />
                <br />
                <MagneticText 
                  text="for speed and clarity." 
                  className="text-purple-200"
                  magnetStrength={0.12}
                />
              </span>
            </p>
          </div>
        </section>

        {/* SECTION 4: Testimonials Section - iMessage Style */}
        <section className="relative flex items-center justify-center px-4 sm:px-6 py-8 md:py-12">
          <div className="relative z-10 max-w-3xl w-full space-y-12 md:space-y-16">
            <AnimatedTestimonial 
              question="How much did you save with Novalare?"
              answer="We cut operational costs by 55% in the first 6 months. The ROI was incredible!"
              delay={0}
            />

            <AnimatedTestimonial 
              question="What about time savings?"
              answer="Our team recovered 8 hours per employee every week. No more manual document sorting!"
              delay={0}
            />

            <AnimatedTestimonial 
              question="Does it really work around the clock?"
              answer="Yes! Processes that used to wait until morning now happen instantly, even at 3 AM."
              delay={0}
            />

            <AnimatedTestimonial 
              question="How do your customers feel about it?"
              answer="Customer satisfaction jumped 40%. They love the faster response times and personalized service."
              delay={0}
            />
          </div>
        </section>

        {/* SECTION 5: Cost Reduction */}
        <section className="relative min-h-screen flex items-center justify-center px-4 sm:px-6 py-12 md:py-0">
          <div className="relative z-10 text-center max-w-5xl">
            <h2 className="text-3xl sm:text-4xl text-white mb-3 md:mb-4">
              <span style={{ fontWeight: '700' }}>40-60%</span> <span style={{ fontWeight: '600' }}>Cost Reduction</span>
            </h2>
            <p className="text-base sm:text-lg md:text-2xl text-purple-200 mb-8 md:mb-12 px-4" style={{ fontWeight: '400' }}>
              Significantly reduce operational costs by automating routine tasks and improving efficiency.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
              <div className="bg-white/5 md:backdrop-blur-sm border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-all">
                <div className="w-12 h-12 md:w-16 md:h-16 mx-auto mb-4 rounded-full bg-white/10 border border-white/20 flex items-center justify-center hover:bg-white/15 hover:shadow-[0_0_40px_rgba(255,255,255,0.15)] transition-all duration-300">
                  <TrendingDown className="w-6 h-6 md:w-8 md:h-8 text-white" />
                </div>
                <h3 className="text-white mb-2">Lower Overhead</h3>
                <p className="text-purple-200/80 text-sm">Reduce staffing costs with intelligent automation</p>
              </div>
              <div className="bg-white/5 md:backdrop-blur-sm border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-all">
                <div className="w-12 h-12 md:w-16 md:h-16 mx-auto mb-4 rounded-full bg-white/10 border border-white/20 flex items-center justify-center hover:bg-white/15 hover:shadow-[0_0_40px_rgba(255,255,255,0.15)] transition-all duration-300">
                  <DollarSign className="w-6 h-6 md:w-8 md:h-8 text-white" />
                </div>
                <h3 className="text-white mb-2">Better ROI</h3>
                <p className="text-purple-200/80 text-sm">See returns within the first quarter</p>
              </div>
              <div className="bg-white/5 md:backdrop-blur-sm border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-all">
                <div className="w-12 h-12 md:w-16 md:h-16 mx-auto mb-4 rounded-full bg-white/10 border border-white/20 flex items-center justify-center hover:bg-white/15 hover:shadow-[0_0_40px_rgba(255,255,255,0.15)] transition-all duration-300">
                  <PiggyBank className="w-6 h-6 md:w-8 md:h-8 text-white" />
                </div>
                <h3 className="text-white mb-2">Smart Savings</h3>
                <p className="text-purple-200/80 text-sm">Optimize resource allocation automatically</p>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 6: Time Savings */}
        <section className="relative min-h-screen flex items-center justify-center px-4 sm:px-6 py-12 md:py-0">
          <div className="relative z-10 text-center max-w-5xl">
            <h2 className="text-3xl sm:text-4xl text-white mb-3 md:mb-4">
              <span style={{ fontWeight: '700' }}>Instant</span> <span style={{ fontWeight: '600' }}>time savings</span>
            </h2>
            <p className="text-base sm:text-lg md:text-2xl text-purple-200 mb-8 md:mb-12 px-4" style={{ fontWeight: '400' }}>
              Eliminate sorting, and manual document handling. Recover 5-10 hours per employee every week.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
              <div className="bg-white/5 md:backdrop-blur-sm border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-all">
                <div className="w-12 h-12 md:w-16 md:h-16 mx-auto mb-4 rounded-full bg-white/10 border border-white/20 flex items-center justify-center hover:bg-white/15 hover:shadow-[0_0_40px_rgba(255,255,255,0.15)] transition-all duration-300">
                  <Clock className="w-6 h-6 md:w-8 md:h-8 text-white" />
                </div>
                <h3 className="text-white mb-2">Instant Processing</h3>
                <p className="text-purple-200/80 text-sm">Process documents in seconds, not hours</p>
              </div>
              <div className="bg-white/5 md:backdrop-blur-sm border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-all">
                <div className="w-12 h-12 md:w-16 md:h-16 mx-auto mb-4 rounded-full bg-white/10 border border-white/20 flex items-center justify-center hover:bg-white/15 hover:shadow-[0_0_40px_rgba(255,255,255,0.15)] transition-all duration-300">
                  <Zap className="w-6 h-6 md:w-8 md:h-8 text-white" />
                </div>
                <h3 className="text-white mb-2">Rapid Deployment</h3>
                <p className="text-purple-200/80 text-sm">Get up and running in days, not months</p>
              </div>
              <div className="bg-white/5 md:backdrop-blur-sm border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-all">
                <div className="w-12 h-12 md:w-16 md:h-16 mx-auto mb-4 rounded-full bg-white/10 border border-white/20 flex items-center justify-center hover:bg-white/15 hover:shadow-[0_0_40px_rgba(255,255,255,0.15)] transition-all duration-300">
                  <Timer className="w-6 h-6 md:w-8 md:h-8 text-white" />
                </div>
                <h3 className="text-white mb-2">Time Recovery</h3>
                <p className="text-purple-200/80 text-sm">Free up staff for strategic work</p>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 7: 24/7 Operations */}
        <section className="relative min-h-screen flex items-center justify-center px-4 sm:px-6 py-12 md:py-0">
          <div className="relative z-10 text-center max-w-5xl">
            <h2 className="text-3xl sm:text-4xl text-white mb-3 md:mb-4">
              <span style={{ fontWeight: '700' }}>24/7</span> <span style={{ fontWeight: '600' }}>Operations</span>
            </h2>
            <p className="text-base sm:text-lg md:text-2xl text-purple-200 mb-8 md:mb-12 px-4" style={{ fontWeight: '400' }}>
              AI systems work around the clock, providing continuous service without breaks or downtime
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
              <div className="bg-white/5 md:backdrop-blur-sm border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-all">
                <div className="w-12 h-12 md:w-16 md:h-16 mx-auto mb-4 rounded-full bg-white/10 border border-white/20 flex items-center justify-center hover:bg-white/15 hover:shadow-[0_0_40px_rgba(255,255,255,0.15)] transition-all duration-300">
                  <Sun className="w-6 h-6 md:w-8 md:h-8 text-white" />
                </div>
                <h3 className="text-white mb-2">Day Operations</h3>
                <p className="text-purple-200/80 text-sm">Peak performance during business hours</p>
              </div>
              <div className="bg-white/5 md:backdrop-blur-sm border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-all">
                <div className="w-12 h-12 md:w-16 md:h-16 mx-auto mb-4 rounded-full bg-white/10 border border-white/20 flex items-center justify-center hover:bg-white/15 hover:shadow-[0_0_40px_rgba(255,255,255,0.15)] transition-all duration-300">
                  <CloudMoon className="w-6 h-6 md:w-8 md:h-8 text-white" />
                </div>
                <h3 className="text-white mb-2">Night Processing</h3>
                <p className="text-purple-200/80 text-sm">Handle workload while you sleep</p>
              </div>
              <div className="bg-white/5 md:backdrop-blur-sm border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-all">
                <div className="w-12 h-12 md:w-16 md:h-16 mx-auto mb-4 rounded-full bg-white/10 border border-white/20 flex items-center justify-center hover:bg-white/15 hover:shadow-[0_0_40px_rgba(255,255,255,0.15)] transition-all duration-300">
                  <Moon className="w-6 h-6 md:w-8 md:h-8 text-white" />
                </div>
                <h3 className="text-white mb-2">No Downtime</h3>
                <p className="text-purple-200/80 text-sm">Always available, always reliable</p>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 8: Enhanced Customer Experience */}
        <section className="relative min-h-screen flex items-center justify-center px-4 sm:px-6 py-12 md:py-0">
          <div className="relative z-10 text-center max-w-5xl">
            <h2 className="text-3xl sm:text-4xl text-white mb-3 md:mb-4">
              <span style={{ fontWeight: '700' }}>Enhanced</span> <span style={{ fontWeight: '600' }}>Customer Experience</span>
            </h2>
            <p className="text-base sm:text-lg md:text-2xl text-purple-200 mb-8 md:mb-12 px-4" style={{ fontWeight: '400' }}>
              Faster response times and personalized interactions lead to higher customer satisfaction.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
              <div className="bg-white/5 md:backdrop-blur-sm border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-all">
                <div className="w-12 h-12 md:w-16 md:h-16 mx-auto mb-4 rounded-full bg-white/10 border border-white/20 flex items-center justify-center hover:bg-white/15 hover:shadow-[0_0_40px_rgba(255,255,255,0.15)] transition-all duration-300">
                  <Users className="w-6 h-6 md:w-8 md:h-8 text-white" />
                </div>
                <h3 className="text-white mb-2">Personal Touch</h3>
                <p className="text-purple-200/80 text-sm">Tailored interactions for every customer</p>
              </div>
              <div className="bg-white/5 md:backdrop-blur-sm border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-all">
                <div className="w-12 h-12 md:w-16 md:h-16 mx-auto mb-4 rounded-full bg-white/10 border border-white/20 flex items-center justify-center hover:bg-white/15 hover:shadow-[0_0_40px_rgba(255,255,255,0.15)] transition-all duration-300">
                  <Heart className="w-6 h-6 md:w-8 md:h-8 text-white" />
                </div>
                <h3 className="text-white mb-2">Higher Satisfaction</h3>
                <p className="text-purple-200/80 text-sm">Delight customers with quick solutions</p>
              </div>
              <div className="bg-white/5 md:backdrop-blur-sm border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-all">
                <div className="w-12 h-12 md:w-16 md:h-16 mx-auto mb-4 rounded-full bg-white/10 border border-white/20 flex items-center justify-center hover:bg-white/15 hover:shadow-[0_0_40px_rgba(255,255,255,0.15)] transition-all duration-300">
                  <Star className="w-6 h-6 md:w-8 md:h-8 text-white" />
                </div>
                <h3 className="text-white mb-2">Premium Service</h3>
                <p className="text-purple-200/80 text-sm">Deliver excellence at every touchpoint</p>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 9: Workflow Section - NOW INSIDE THE ANIMATION CONTAINER */}
        <div id="workflow">
          <WorkflowSection ref={servicesSectionRef} />
        </div>
      </div>

      {/* Consultation Section - Book Now CTA */}
      <ConsultationSection />

      {/* Philosophy Section - What Drives Us */}
      <PhilosophySection />

      {/* Footer - Outside helix section */}
      <Footer />
    </div>
  );
}