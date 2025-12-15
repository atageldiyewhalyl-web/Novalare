import { motion } from "motion/react";
import { ArrowRight, FileText } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ConsultationModal } from "./ConsultationModal";

export function HeroValueSection() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <section className="relative w-full px-4 sm:px-6 md:px-12 lg:px-20 py-8 md:py-12 lg:py-16 flex items-center justify-center">
      <div className="relative max-w-6xl mx-auto w-full">
        {/* Full Width Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1] }}
          viewport={{ once: true }}
          className="text-white mb-6 md:mb-8 leading-[0.95] tracking-tight text-center"
          style={{
            fontSize: 'clamp(24px, 5vw, 64px)',
            fontWeight: '900',
            fontFamily: "'Outfit', sans-serif",
            letterSpacing: '-0.04em',
          }}
        >
          AUTOMATION FOR ACCOUNTING FIRMS
        </motion.h1>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6 lg:gap-8 items-center">
          {/* Description Box */}
          <div className="lg:col-span-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
              viewport={{ once: true }}
              className="relative rounded-xl md:rounded-2xl p-4 md:p-5 lg:p-6 backdrop-blur-sm transition-all duration-500"
              style={{
                border: '2px solid transparent',
                backgroundImage: 'linear-gradient(black, black), linear-gradient(135deg, rgba(147, 51, 234, 0.5), rgba(249, 115, 22, 0.5))',
                backgroundOrigin: 'border-box',
                backgroundClip: 'padding-box, border-box',
              }}
            >
              <p
                className="text-white/80 leading-relaxed"
                style={{
                  fontSize: 'clamp(14px, 1.8vw, 17px)',
                  fontWeight: '500',
                  fontFamily: "'Manrope', sans-serif",
                  lineHeight: '1.6',
                }}
              >
                Cut hours of manual work with AI-powered workflows that handle{' '}
                <span style={{ fontWeight: '700', color: 'rgba(255, 255, 255, 1)' }}>
                  emails, documents, CRM updates, spreadsheets, and reporting
                </span>
                —automatically.
              </p>
            </motion.div>
          </div>

          {/* CTA Button */}
          <div className="lg:col-span-4 flex items-center justify-center lg:justify-end">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
              viewport={{ once: true }}
              className="w-full lg:w-auto"
            >
              <button
                onClick={() => setIsModalOpen(true)}
                className="group inline-flex items-center justify-center gap-2 md:gap-3 px-6 md:px-7 py-3 md:py-3.5 rounded-full transition-all duration-300 hover:scale-105 active:scale-95 w-full lg:w-auto"
                style={{
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  boxShadow: '0 8px 32px rgba(102, 126, 234, 0.4)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = '0 12px 48px rgba(102, 126, 234, 0.6)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = '0 8px 32px rgba(102, 126, 234, 0.4)';
                }}
              >
                <span
                  className="text-white"
                  style={{
                    fontSize: 'clamp(14px, 1.8vw, 17px)',
                    fontWeight: '700',
                    fontFamily: "'Outfit', sans-serif",
                    letterSpacing: '-0.01em',
                  }}
                >
                  Get Free Consulting
                </span>
                <ArrowRight className="w-4 h-4 md:w-5 md:h-5 text-white transition-transform duration-300 group-hover:translate-x-1" strokeWidth={2.5} />
              </button>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Consultation Modal */}
      <ConsultationModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </section>
  );
}