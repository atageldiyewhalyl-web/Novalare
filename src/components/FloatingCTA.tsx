import { motion, useScroll, useTransform } from "motion/react";
import { Calendar } from "lucide-react";
import { useState, useEffect } from "react";

export function FloatingCTA() {
  const [isVisible, setIsVisible] = useState(false);
  const { scrollY } = useScroll();
  
  useEffect(() => {
    const unsubscribe = scrollY.on("change", (latest) => {
      // Show after scrolling 300px
      setIsVisible(latest > 300);
    });
    
    return () => unsubscribe();
  }, [scrollY]);

  const handleBookConsultation = () => {
    // Open Calendly booking page
    window.open("https://calendly.com/atageldiyevhalyl/30min", "_blank");
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 100 }}
      animate={{ 
        opacity: isVisible ? 1 : 0,
        y: isVisible ? 0 : 100,
        pointerEvents: isVisible ? "auto" : "none"
      }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="fixed bottom-8 right-8 z-50"
      style={{ willChange: "transform, opacity" }}
    >
      <motion.button
        onClick={handleBookConsultation}
        className="group flex items-center gap-3 px-6 py-4 rounded-full shadow-2xl"
        style={{
          background: "linear-gradient(135deg, #4F46E5 0%, #6366F1 50%, #818CF8 100%)",
          boxShadow: "0 20px 60px rgba(79, 70, 229, 0.6), 0 0 80px rgba(79, 70, 229, 0.3)",
        }}
        whileHover={{ 
          scale: 1.05,
          boxShadow: "0 25px 80px rgba(79, 70, 229, 0.8), 0 0 100px rgba(79, 70, 229, 0.4)"
        }}
        whileTap={{ scale: 0.95 }}
      >
        <Calendar className="w-5 h-5 text-white" strokeWidth={2.5} />
        <span
          className="text-white hidden sm:inline"
          style={{
            fontSize: "15px",
            fontWeight: "700",
            fontFamily: "'Outfit', sans-serif",
            letterSpacing: "-0.01em",
          }}
        >
          Book Consultation
        </span>
      </motion.button>
    </motion.div>
  );
}