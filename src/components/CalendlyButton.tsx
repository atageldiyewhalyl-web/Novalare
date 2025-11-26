import { motion } from "motion/react";
import { Calendar } from "lucide-react";
import { useEffect, useState } from "react";

interface CalendlyButtonProps {
  url: string; // Your Calendly URL (e.g., "https://calendly.com/your-username/30min")
  text?: string;
  variant?: "primary" | "glass";
}

export function CalendlyButton({ 
  url, 
  text = "Schedule a Call",
  variant = "primary" 
}: CalendlyButtonProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Load Calendly widget script
    const script = document.createElement("script");
    script.src = "https://assets.calendly.com/assets/external/widget.js";
    script.async = true;
    script.onload = () => setIsLoaded(true);
    document.body.appendChild(script);

    return () => {
      // Cleanup
      const existingScript = document.querySelector('script[src="https://assets.calendly.com/assets/external/widget.js"]');
      if (existingScript) {
        document.body.removeChild(existingScript);
      }
    };
  }, []);

  const openCalendly = () => {
    if (isLoaded && window.Calendly) {
      window.Calendly.initPopupWidget({ url });
    }
  };

  if (variant === "glass") {
    return (
      <motion.button
        onClick={openCalendly}
        onHoverStart={() => setIsHovered(true)}
        onHoverEnd={() => setIsHovered(false)}
        className="relative group"
        whileTap={{ scale: 0.98 }}
      >
        {/* Animated glow */}
        <motion.div
          className="absolute inset-0 rounded-2xl"
          animate={{
            opacity: isHovered ? 0.4 : 0.25,
            scale: isHovered ? 1.05 : 1.02,
          }}
          transition={{ duration: 0.3 }}
          style={{
            background: '#007AFF',
            filter: `blur(${isHovered ? '20px' : '16px'})`,
            zIndex: 0
          }}
        />

        {/* Glass button */}
        <motion.div
          className="relative backdrop-blur-xl rounded-2xl px-8 py-4 border flex items-center gap-3"
          animate={{
            y: isHovered ? -4 : 0,
            borderColor: isHovered ? 'rgba(0, 122, 255, 0.5)' : 'rgba(0, 122, 255, 0.3)',
          }}
          transition={{ duration: 0.3 }}
          style={{
            background: 'rgba(15, 15, 15, 0.8)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
            zIndex: 1
          }}
        >
          <motion.div
            animate={{
              rotate: isHovered ? 360 : 0,
              scale: isHovered ? 1.1 : 1,
            }}
            transition={{ duration: 0.5 }}
          >
            <Calendar 
              size={20} 
              style={{ 
                color: '#007AFF',
                filter: 'drop-shadow(0 0 8px rgba(0, 122, 255, 0.5))'
              }} 
            />
          </motion.div>
          <span
            className="font-semibold"
            style={{
              color: '#ffffff',
              fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif',
              fontSize: '16px'
            }}
          >
            {text}
          </span>
        </motion.div>
      </motion.button>
    );
  }

  // Primary variant (solid gradient)
  return (
    <motion.button
      onClick={openCalendly}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      className="relative group overflow-hidden rounded-2xl"
      whileTap={{ scale: 0.98 }}
    >
      {/* Animated gradient background */}
      <motion.div
        className="absolute inset-0"
        animate={{
          opacity: isHovered ? 1 : 0.95,
        }}
        transition={{ duration: 0.3 }}
        style={{
          background: '#007AFF',
        }}
      />

      {/* Glow effect */}
      <motion.div
        className="absolute inset-0"
        animate={{
          opacity: isHovered ? 0.5 : 0,
          scale: isHovered ? 1.1 : 1,
        }}
        transition={{ duration: 0.3 }}
        style={{
          background: 'radial-gradient(circle, rgba(255, 255, 255, 0.3) 0%, transparent 70%)',
          filter: 'blur(20px)',
        }}
      />

      {/* Button content */}
      <div className="relative px-8 py-4 flex items-center gap-3">
        <motion.div
          animate={{
            rotate: isHovered ? 360 : 0,
            scale: isHovered ? 1.1 : 1,
          }}
          transition={{ duration: 0.5 }}
        >
          <Calendar size={20} style={{ color: '#ffffff' }} />
        </motion.div>
        <span
          className="font-semibold"
          style={{
            color: '#ffffff',
            fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif',
            fontSize: '16px'
          }}
        >
          {text}
        </span>
      </div>

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
    </motion.button>
  );
}

// TypeScript declaration for Calendly
declare global {
  interface Window {
    Calendly: {
      initPopupWidget: (options: { url: string }) => void;
    };
  }
}