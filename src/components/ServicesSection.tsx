import { ServiceModule } from "./ServiceModule";
import { FileText, Mail, Settings, Download, Sheet, Sparkles } from "lucide-react";
import { forwardRef } from "react";
import { motion } from "motion/react";
import { useNavigate } from "react-router-dom";

export const ServicesSection = forwardRef<HTMLDivElement>((props, ref) => {
  const navigate = useNavigate();
  
  const services = [
    {
      icon: FileText,
      heading: "Invoice Extraction",
      description: "We pull key data from invoices and receipts—such as vendor name, dates, line items, totals, and taxes—and convert it into a clean, structured Excel or CSV format. Every document is read, organized, and exported automatically, so your team never has to copy-paste numbers again.",
      glowColor: "#4EA8FF",
      hideIcon: false
    },
    {
      icon: Mail,
      heading: "Email to Accounting",
      description: "Novalare connects to your inbox and pulls invoices, receipts, and expense reports from specific senders or folders. Documents are automatically extracted, validated, and routed to your system. All you do is send or forward an email. We handle the rest.",
      glowColor: "#FF6B6B",
      hideIcon: false
    },
    {
      icon: Settings,
      heading: "Reconciliation Prep",
      description: "We extract transaction details from bank statements, categorize them, clean the formatting, and prepare structured data files ready for your accountant to reconcile. Your team receives pre-processed transaction lists instead of raw statements, cutting hours of manual formatting and data entry.",
      glowColor: "#3FE3C5",
      hideIcon: false
    },
    {
      icon: Download,
      heading: "Document Collection",
      description: "We build simple, automated workflows that remind clients to upload missing documents, validate the files they submit, and store everything in organized folders automatically. Your team no longer has to chase clients or sort through random uploads—everything arrives clean and ready to use.",
      glowColor: "#FF6F9E",
      hideIcon: false
    },
    {
      icon: Sheet,
      heading: "Expense Categorization",
      description: "We read receipts, emails, and statements, extract expense details, and categorize each entry using your chart of accounts. This gives your team a clean, pre-sorted expense list that's ready for review, instead of manually matching expenses one by one.",
      glowColor: "#FFCE73",
      hideIcon: false
    }
  ];

  return (
    <section ref={ref} className="relative w-full min-h-screen px-4 md:px-6 lg:px-8 py-16 md:py-24 lg:py-32 flex items-center justify-center bg-white" style={{ zIndex: 1 }}>
      {/* Subtle gradient background */}
      <div 
        className="absolute inset-0 opacity-30"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(147, 51, 234, 0.03) 0%, rgba(249, 115, 22, 0.02) 50%, transparent 70%)',
          zIndex: 0
        }}
      />

      <div className="relative max-w-[1400px] mx-auto w-full">
        {/* Header - Clean and minimal */}
        <div className="mb-16 md:mb-24 lg:mb-32 text-center">
          <h1 
            className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3"
            style={{ 
              fontSize: 'clamp(36px, 8vw, 72px)',
              fontWeight: '600',
              fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif',
              letterSpacing: '-0.03em'
            }}
          >
            <span
              style={{
                background: 'linear-gradient(135deg, #7c3aed 0%, #ec4899 50%, #f97316 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                fontWeight: '700',
              }}
            >
              Novalare
            </span>
            <span style={{ color: '#1f2937' }}>Services</span>
          </h1>
          <style>{`
            @keyframes gradientShift {
              0%, 100% {
                background-position: 0% 50%;
              }
              50% {
                background-position: 100% 50%;
              }
            }
          `}</style>
        </div>

        {/* Services modules in centered grid with generous spacing */}
        <div className="flex items-center justify-center">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 lg:gap-10 mx-auto w-full">
            {services.slice(0, 3).map((service, index) => (
              <div key={index} data-service-card={index}>
                <ServiceModule
                  icon={service.icon}
                  heading={service.heading}
                  description={service.description}
                  glowColor={service.glowColor}
                  hideIcon={service.hideIcon}
                  index={index}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Bottom two modules centered with generous spacing */}
        <div className="flex items-center justify-center mt-6 md:mt-8 lg:mt-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 lg:gap-10 mx-auto w-full" style={{ maxWidth: '960px' }}>
            {services.slice(3, 5).map((service, index) => (
              <div key={index + 3} data-service-card={index + 3}>
                <ServiceModule
                  icon={service.icon}
                  heading={service.heading}
                  description={service.description}
                  glowColor={service.glowColor}
                  hideIcon={service.hideIcon}
                  index={index + 3}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Footer Text */}
        <div className="mt-12 text-center max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
          >
            <button
              onClick={() => {
                navigate('/');
                setTimeout(() => {
                  const demosSection = document.getElementById('demos');
                  if (demosSection) {
                    demosSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }
                }, 100);
              }}
              className="group inline-flex items-center gap-3 px-8 py-4 rounded-full transition-all duration-300 hover:scale-105 active:scale-95"
              style={{
                background: 'linear-gradient(135deg, #7c3aed 0%, #ec4899 50%, #f97316 100%)',
                boxShadow: '0 8px 32px rgba(124, 58, 237, 0.4)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 12px 40px rgba(124, 58, 237, 0.6)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = '0 8px 32px rgba(124, 58, 237, 0.4)';
              }}
            >
              <Sparkles className="w-5 h-5 text-white" />
              <span
                className="text-white"
                style={{
                  fontSize: '18px',
                  fontWeight: '700',
                  fontFamily: "'Outfit', sans-serif",
                  letterSpacing: '-0.01em',
                }}
              >
                Try Our Demos
              </span>
            </button>
            <p className="mt-4 text-gray-600 text-sm">
              See our AI in action - Try all our interactive demos
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  );
});