import { motion } from "motion/react";
import { Calendar, Clock, CheckCircle2, Sparkles, Zap, Shield } from "lucide-react";
import { toast } from "sonner@2.0.3";

export function ConsultationSection() {
  const handleStartTrial = () => {
    // Show coming soon notification
    toast.info("Coming Soon", {
      description: "We're working hard to launch soon!",
      duration: 3000,
    });
  };

  return (
    <section className="relative w-full py-20 md:py-32 px-4 md:px-6 lg:px-8">
      {/* Background Glow */}
      <div
        className="absolute inset-0 opacity-20"
        style={{
          background: "radial-gradient(ellipse at center, rgba(79, 70, 229, 0.3) 0%, transparent 70%)",
        }}
      />

      <div className="relative max-w-5xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="text-center mb-12 md:mb-16"
        >
          <motion.div
            initial={{ scale: 0 }}
            whileInView={{ scale: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 mb-6"
          >
            <Sparkles className="w-4 h-4 text-indigo-400" />
            <span
              className="text-indigo-300"
              style={{
                fontSize: "14px",
                fontWeight: "600",
                fontFamily: "'Outfit', sans-serif",
              }}
            >
              Limited Time Offer
            </span>
          </motion.div>

          <h2
            className="text-white mb-4"
            style={{
              fontSize: "clamp(32px, 6vw, 56px)",
              fontWeight: "700",
              fontFamily: "'Outfit', sans-serif",
              letterSpacing: "-0.02em",
            }}
          >
            Start Your 2-Month Free Trial
          </h2>
          <p
            className="text-white/60 max-w-2xl mx-auto"
            style={{
              fontSize: "clamp(16px, 2vw, 20px)",
              fontWeight: "500",
              fontFamily: "'Manrope', sans-serif",
              lineHeight: "1.6",
            }}
          >
            Experience the full power of Novalare with zero risk. Automate your accounting processes and save 10+ hours per week—completely free for 2 months.
          </p>
        </motion.div>

        {/* Benefits Grid */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          viewport={{ once: true }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12"
        >
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
              <Shield className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h3
                className="text-white mb-1"
                style={{
                  fontSize: "16px",
                  fontWeight: "600",
                  fontFamily: "'Outfit', sans-serif",
                }}
              >
                No Credit Card Required
              </h3>
              <p
                className="text-white/50"
                style={{
                  fontSize: "14px",
                  fontWeight: "500",
                  fontFamily: "'Manrope', sans-serif",
                }}
              >
                Start immediately, risk-free
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h3
                className="text-white mb-1"
                style={{
                  fontSize: "16px",
                  fontWeight: "600",
                  fontFamily: "'Outfit', sans-serif",
                }}
              >
                Full Platform Access
              </h3>
              <p
                className="text-white/50"
                style={{
                  fontSize: "14px",
                  fontWeight: "500",
                  fontFamily: "'Manrope', sans-serif",
                }}
              >
                All features unlocked
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
              <Zap className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h3
                className="text-white mb-1"
                style={{
                  fontSize: "16px",
                  fontWeight: "600",
                  fontFamily: "'Outfit', sans-serif",
                }}
              >
                Cancel Anytime
              </h3>
              <p
                className="text-white/50"
                style={{
                  fontSize: "14px",
                  fontWeight: "500",
                  fontFamily: "'Manrope', sans-serif",
                }}
              >
                No long-term commitment
              </p>
            </div>
          </div>
        </motion.div>

        {/* CTA Button */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <motion.button
            onClick={handleStartTrial}
            className="group inline-flex items-center gap-3 px-10 py-5 rounded-full transition-all duration-300"
            style={{
              background: "linear-gradient(135deg, #4F46E5 0%, #6366F1 50%, #818CF8 100%)",
              boxShadow: "0 20px 60px rgba(79, 70, 229, 0.6), 0 0 80px rgba(79, 70, 229, 0.3)",
            }}
            whileHover={{
              scale: 1.05,
              boxShadow: "0 25px 80px rgba(79, 70, 229, 0.8), 0 0 100px rgba(79, 70, 229, 0.4)",
            }}
            whileTap={{ scale: 0.95 }}
          >
            <Zap className="w-6 h-6 text-white" strokeWidth={2.5} />
            <span
              className="text-white"
              style={{
                fontSize: "18px",
                fontWeight: "700",
                fontFamily: "'Outfit', sans-serif",
                letterSpacing: "-0.01em",
              }}
            >
              Start Free 2-Month Trial
            </span>
          </motion.button>

          <p
            className="text-white/40 mt-4"
            style={{
              fontSize: "14px",
              fontWeight: "500",
              fontFamily: "'Manrope', sans-serif",
            }}
          >
            No credit card required • Get started in under 2 minutes
          </p>
        </motion.div>
      </div>
    </section>
  );
}