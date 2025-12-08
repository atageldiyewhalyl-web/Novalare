import { motion, AnimatePresence } from "motion/react";
import { X, ArrowRight, Calendar, Video, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { createPortal } from "react-dom";

interface ConsultationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ConsultationModal = ({ isOpen, onClose }: ConsultationModalProps) => {
  const [step, setStep] = useState<'form' | 'options'>('form');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company: '',
    phone: '',
    message: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStep('options');
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 backdrop-blur-md z-[9998]"
            style={{
              background: 'rgba(0, 0, 0, 0.85)',
            }}
          />

          {/* Modal */}
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative w-full h-full max-h-[95vh] bg-[#0a0a0a] rounded-3xl overflow-y-auto"
              style={{
                border: '1px solid rgba(255, 255, 255, 0.1)',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close Button */}
              <button
                onClick={onClose}
                className="absolute top-6 right-6 w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center transition-all duration-300 z-50"
              >
                <X className="w-5 h-5 text-white/60 hover:text-white transition-colors" />
              </button>

              {step === 'form' ? (
                <FormStep 
                  formData={formData}
                  handleInputChange={handleInputChange}
                  handleSubmit={handleSubmit}
                />
              ) : (
                <OptionsStep onClose={onClose} />
              )}
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );

  return createPortal(modalContent, document.body);
};

interface FormStepProps {
  formData: any;
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  handleSubmit: (e: React.FormEvent) => void;
}

const FormStep = ({ formData, handleInputChange, handleSubmit }: FormStepProps) => {
  return (
    <div className="p-8 md:p-10 flex items-center justify-center min-h-full">
      <div className="w-full max-w-2xl">
      {/* Header */}
      <div className="text-center mb-8">
        <h2 
          className="mb-4 text-white"
          style={{
            fontSize: 'clamp(28px, 5vw, 42px)',
            fontWeight: '800',
            fontFamily: "'Outfit', sans-serif",
            letterSpacing: '-0.03em',
            lineHeight: '1.1',
          }}
        >
          Start Automating Your Accounting Tasks
        </h2>
        <p 
          className="text-white/60 max-w-lg mx-auto"
          style={{
            fontSize: 'clamp(15px, 2vw, 17px)',
            fontWeight: '500',
            fontFamily: "'Manrope', sans-serif",
            lineHeight: '1.6'
          }}
        >
          Tell us about your accounting workflows and we'll pinpoint what can be automated
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Name & Email Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label 
              htmlFor="name"
              className="block mb-2 text-white/80"
              style={{
                fontSize: '14px',
                fontWeight: '600',
                fontFamily: "'Outfit', sans-serif",
              }}
            >
              Name <span className="text-white/50">*</span>
            </label>
            <input
              type="text"
              id="name"
              name="name"
              required
              value={formData.name}
              onChange={handleInputChange}
              placeholder="Your full name"
              className="w-full px-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/40 focus:border-white/30 focus:outline-none transition-all"
              style={{
                fontSize: '15px',
                fontWeight: '500',
                fontFamily: "'Manrope', sans-serif",
              }}
            />
          </div>

          <div>
            <label 
              htmlFor="email"
              className="block mb-2 text-white/80"
              style={{
                fontSize: '14px',
                fontWeight: '600',
                fontFamily: "'Outfit', sans-serif",
              }}
            >
              Email <span className="text-white/50">*</span>
            </label>
            <input
              type="email"
              id="email"
              name="email"
              required
              value={formData.email}
              onChange={handleInputChange}
              placeholder="your@email.com"
              className="w-full px-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/40 focus:border-white/30 focus:outline-none transition-all"
              style={{
                fontSize: '15px',
                fontWeight: '500',
                fontFamily: "'Manrope', sans-serif",
              }}
            />
          </div>
        </div>

        {/* Company */}
        <div>
          <label 
            htmlFor="company"
            className="block mb-2 text-white/80"
            style={{
              fontSize: '14px',
              fontWeight: '600',
              fontFamily: "'Outfit', sans-serif",
            }}
          >
            Company
          </label>
          <input
            type="text"
            id="company"
            name="company"
            value={formData.company}
            onChange={handleInputChange}
            placeholder="Your company name"
            className="w-full px-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/40 focus:border-white/30 focus:outline-none transition-all"
            style={{
              fontSize: '15px',
              fontWeight: '500',
              fontFamily: "'Manrope', sans-serif",
            }}
          />
        </div>

        {/* Phone */}
        <div>
          <label 
            htmlFor="phone"
            className="block mb-2 text-white/80"
            style={{
              fontSize: '14px',
              fontWeight: '600',
              fontFamily: "'Outfit', sans-serif",
            }}
          >
            Phone Number
          </label>
          <input
            type="tel"
            id="phone"
            name="phone"
            value={formData.phone}
            onChange={handleInputChange}
            placeholder="(555) 123-4567"
            className="w-full px-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/40 focus:border-white/30 focus:outline-none transition-all"
            style={{
              fontSize: '15px',
              fontWeight: '500',
              fontFamily: "'Manrope', sans-serif",
            }}
          />
        </div>

        {/* Message */}
        <div>
          <label 
            htmlFor="message"
            className="block mb-2 text-white/80"
            style={{
              fontSize: '14px',
              fontWeight: '600',
              fontFamily: "'Outfit', sans-serif",
            }}
          >
            Tell us about your business
          </label>
          <textarea
            id="message"
            name="message"
            rows={4}
            value={formData.message}
            onChange={handleInputChange}
            placeholder="What challenges are you facing? What processes would you like to automate?"
            className="w-full px-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/40 focus:border-white/30 focus:outline-none transition-all resize-none"
            style={{
              fontSize: '15px',
              fontWeight: '500',
              fontFamily: "'Manrope', sans-serif",
              lineHeight: '1.6'
            }}
          />
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          className="group w-full py-4 px-6 rounded-xl bg-white text-black transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3"
        >
          <span
            style={{
              fontSize: '17px',
              fontWeight: '700',
              fontFamily: "'Outfit', sans-serif",
            }}
          >
            Schedule Free Consultation
          </span>
          <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
        </button>

        {/* Privacy Note */}
        <p 
          className="text-white/40 text-center"
          style={{
            fontSize: '13px',
            fontWeight: '500',
            fontFamily: "'Manrope', sans-serif",
          }}
        >
          * Required fields. We respect your privacy and will never share your information.
        </p>
      </form>
      </div>
    </div>
  );
};

interface OptionsStepProps {
  onClose: () => void;
}

const OptionsStep = ({ onClose }: OptionsStepProps) => {
  return (
    <div className="p-8 md:p-10 relative z-10">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-3 mb-4">
          <Calendar className="w-8 h-8 text-white/80" />
          <h2 
            className="text-white"
            style={{
              fontSize: 'clamp(28px, 5vw, 38px)',
              fontWeight: '800',
              fontFamily: "'Outfit', sans-serif",
              letterSpacing: '-0.03em',
              lineHeight: '1.1',
            }}
          >
            Book Your Automation Session
          </h2>
        </div>
        <p 
          className="text-white/60 max-w-2xl mx-auto"
          style={{
            fontSize: 'clamp(14px, 2vw, 16px)',
            fontWeight: '500',
            fontFamily: "'Manrope', sans-serif",
            lineHeight: '1.6'
          }}
        >
          Our experts will evaluate your workflows and outline where automation can create real impact.
        </p>
      </div>

      {/* Consultation Options */}
      <div className="space-y-6 mb-8">
        {/* AI Strategy Consultation */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:border-white/20 transition-all duration-300 group">
          <div className="flex items-start gap-3 mb-4">
            <div 
              className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0"
            >
              <CheckCircle2 className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <h3 
                className="text-white mb-1"
                style={{
                  fontSize: '20px',
                  fontWeight: '700',
                  fontFamily: "'Outfit', sans-serif",
                }}
              >
                AI Strategy Consultation
              </h3>
              <p 
                className="text-white/50 mb-3"
                style={{
                  fontSize: '14px',
                  fontWeight: '500',
                  fontFamily: "'Manrope', sans-serif",
                }}
              >
                ⏱️ 15 minutes
              </p>
              <p 
                className="text-white/70 mb-4"
                style={{
                  fontSize: '15px',
                  fontWeight: '500',
                  fontFamily: "'Manrope', sans-serif",
                  lineHeight: '1.5'
                }}
              >
                Perfect for understanding how AI can transform your business
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-5">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-white/60 flex-shrink-0" />
              <span className="text-white/70 text-sm" style={{ fontFamily: "'Manrope', sans-serif", fontWeight: '500' }}>Business analysis</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-white/60 flex-shrink-0" />
              <span className="text-white/70 text-sm" style={{ fontFamily: "'Manrope', sans-serif", fontWeight: '500' }}>AI opportunity assessment</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-white/60 flex-shrink-0" />
              <span className="text-white/70 text-sm" style={{ fontFamily: "'Manrope', sans-serif", fontWeight: '500' }}>Implementation roadmap</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-white/60 flex-shrink-0" />
              <span className="text-white/70 text-sm" style={{ fontFamily: "'Manrope', sans-serif", fontWeight: '500' }}>ROI projections</span>
            </div>
          </div>

          <a
            href="https://calendly.com/atageldiyevhalyl/new-meeting"
            target="_blank"
            rel="noopener noreferrer"
            className="group/btn w-full py-3.5 px-5 rounded-xl bg-white text-black transition-all duration-300 hover:scale-[1.02] flex items-center justify-center gap-3"
          >
            <span
              style={{
                fontSize: '16px',
                fontWeight: '700',
                fontFamily: "'Outfit', sans-serif",
              }}
            >
              Book AI Strategy Consultation
            </span>
            <ArrowRight className="w-4 h-4 transition-transform group-hover/btn:translate-x-1" />
          </a>
        </div>

        {/* Technical Deep Dive */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:border-white/20 transition-all duration-300 group">
          <div className="flex items-start gap-3 mb-4">
            <div 
              className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0"
            >
              <Video className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <h3 
                className="text-white mb-1"
                style={{
                  fontSize: '20px',
                  fontWeight: '700',
                  fontFamily: "'Outfit', sans-serif",
                }}
              >
                Technical Deep Dive
              </h3>
              <p 
                className="text-white/50 mb-3"
                style={{
                  fontSize: '14px',
                  fontWeight: '500',
                  fontFamily: "'Manrope', sans-serif",
                }}
              >
                ⏱️ 30 minutes
              </p>
              <p 
                className="text-white/70 mb-4"
                style={{
                  fontSize: '15px',
                  fontWeight: '500',
                  fontFamily: "'Manrope', sans-serif",
                  lineHeight: '1.5'
                }}
              >
                Detailed technical discussion for complex AI implementations
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-5">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-white/60 flex-shrink-0" />
              <span className="text-white/70 text-sm" style={{ fontFamily: "'Manrope', sans-serif", fontWeight: '500' }}>Architecture review</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-white/60 flex-shrink-0" />
              <span className="text-white/70 text-sm" style={{ fontFamily: "'Manrope', sans-serif", fontWeight: '500' }}>Technical feasibility</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-white/60 flex-shrink-0" />
              <span className="text-white/70 text-sm" style={{ fontFamily: "'Manrope', sans-serif", fontWeight: '500' }}>Integration planning</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-white/60 flex-shrink-0" />
              <span className="text-white/70 text-sm" style={{ fontFamily: "'Manrope', sans-serif", fontWeight: '500' }}>Custom solution design</span>
            </div>
          </div>

          <a
            href="https://calendly.com/atageldiyevhalyl/30min"
            target="_blank"
            rel="noopener noreferrer"
            className="group/btn w-full py-3.5 px-5 rounded-xl bg-white text-black transition-all duration-300 hover:scale-[1.02] flex items-center justify-center gap-3"
          >
            <span
              style={{
                fontSize: '16px',
                fontWeight: '700',
                fontFamily: "'Outfit', sans-serif",
              }}
            >
              Book Technical Deep Dive
            </span>
            <ArrowRight className="w-4 h-4 transition-transform group-hover/btn:translate-x-1" />
          </a>
        </div>
      </div>

      {/* What to Expect */}
      <div 
        className="rounded-2xl p-6 bg-white/5 border border-white/10"
      >
        <div className="flex items-center gap-2 mb-4">
          <Video className="w-5 h-5 text-white/80" />
          <h4 
            className="text-white"
            style={{
              fontSize: '16px',
              fontWeight: '700',
              fontFamily: "'Outfit', sans-serif",
            }}
          >
            What to Expect
          </h4>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="text-center">
            <div 
              className="w-12 h-12 mx-auto mb-3 rounded-full flex items-center justify-center bg-white/10 border border-white/20"
              style={{
                fontSize: '20px',
                fontWeight: '800',
                fontFamily: "'Outfit', sans-serif",
                color: '#ffffff'
              }}
            >
              1
            </div>
            <p className="text-white/70" style={{ fontSize: '14px', fontWeight: '500', fontFamily: "'Manrope', sans-serif" }}>
              Choose your time
            </p>
          </div>
          <div className="text-center">
            <div 
              className="w-12 h-12 mx-auto mb-3 rounded-full flex items-center justify-center bg-white/10 border border-white/20"
              style={{
                fontSize: '20px',
                fontWeight: '800',
                fontFamily: "'Outfit', sans-serif",
                color: '#ffffff'
              }}
            >
              2
            </div>
            <p className="text-white/70" style={{ fontSize: '14px', fontWeight: '500', fontFamily: "'Manrope', sans-serif" }}>
              Join video call
            </p>
          </div>
          <div className="text-center">
            <div 
              className="w-12 h-12 mx-auto mb-3 rounded-full flex items-center justify-center bg-white/10 border border-white/20"
              style={{
                fontSize: '20px',
                fontWeight: '800',
                fontFamily: "'Outfit', sans-serif",
                color: '#ffffff'
              }}
            >
              3
            </div>
            <p className="text-white/70" style={{ fontSize: '14px', fontWeight: '500', fontFamily: "'Manrope', sans-serif" }}>
              Receive Your Automation Roadmap
            </p>
          </div>
        </div>

        <p 
          className="text-center text-white/50"
          style={{
            fontSize: '13px',
            fontWeight: '500',
            fontFamily: "'Manrope', sans-serif",
          }}
        >
          * Free consultation • No strings attached • Get actionable insights
        </p>
      </div>
    </div>
  );
};