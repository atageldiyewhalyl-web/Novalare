import { motion, useInView } from "motion/react";
import { useRef, useState, useEffect, forwardRef } from "react";
import {
  Mail,
  Download,
  FileSearch,
  Sheet,
  Send,
  Bell,
  Check,
  Archive,
} from "lucide-react";

interface Step {
  id: number;
  title: string;
  subtitle: string;
  icon: React.ElementType;
  color: string; // Apple system color
}

const steps: Step[] = [
  {
    id: 1,
    title: "Email Received",
    subtitle: "Client submission",
    icon: Mail,
    color: "#007AFF", // SF Blue
  },
  {
    id: 2,
    title: "Download Document",
    subtitle: "Extracting attachment",
    icon: Download,
    color: "#AF52DE", // SF Purple
  },
  {
    id: 3,
    title: "Parsing Data",
    subtitle: "AI processing",
    icon: FileSearch,
    color: "#5856D6", // SF Indigo
  },
  {
    id: 4,
    title: "Excel Entry",
    subtitle: "Data organization",
    icon: Sheet,
    color: "#34C759", // SF Green
  },
  {
    id: 5,
    title: "Archive for review",
    subtitle: "Renamed, classified, saved",
    icon: Archive,
    color: "#5AC8FA", // SF Teal
  },
  {
    id: 6,
    title: "Confirmation Email",
    subtitle: "Client follow-up",
    icon: Send,
    color: "#FF9500", // SF Orange
  },
  {
    id: 7,
    title: "Team Notification",
    subtitle: "Process complete",
    icon: Bell,
    color: "#FF2D55", // SF Pink
  },
];

export const WorkflowSection = forwardRef<HTMLDivElement>((props, ref) => {
  const sectionRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(sectionRef, { once: false, amount: 0.2 });
  const [activeStep, setActiveStep] = useState(0);

  // Scroll-triggered animation - advances when in view
  useEffect(() => {
    if (isInView && activeStep < steps.length) {
      const timer = setTimeout(() => {
        setActiveStep(activeStep + 1);
      }, 800); // Faster progression for scroll-trigger
      return () => clearTimeout(timer);
    } else if (!isInView && activeStep > 0) {
      // Reset when out of view
      setActiveStep(0);
    }
  }, [isInView, activeStep]);

  return (
    <section
      ref={sectionRef}
      className="relative w-full min-h-screen px-4 md:px-6 lg:px-8 py-16 md:py-24 lg:py-32 flex items-center justify-center"
      style={{ zIndex: 1 }}
    >
      {/* Subtle radial gradient background */}
      <div 
        className="absolute inset-0 opacity-10"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(255, 255, 255, 0.03) 0%, transparent 70%)',
          zIndex: 0
        }}
      />

      <div className="relative max-w-5xl mx-auto w-full">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="text-center mb-16 md:mb-20"
        >
          <h2
            className="text-white mb-4"
            style={{
              fontSize: 'clamp(32px, 6vw, 56px)',
              fontWeight: '600',
              fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif',
              letterSpacing: '-0.02em'
            }}
          >
            Sample Workflow
          </h2>
          <p
            className="text-white/50 max-w-2xl mx-auto"
            style={{
              fontSize: 'clamp(13px, 1.8vw, 15px)',
              fontWeight: '400',
              fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif',
              lineHeight: '1.6'
            }}
          >
            Any step can be added, removed, or reinvented — every workflow adapts to the way your firm works.
          </p>
        </motion.div>

        {/* Vertical Flow */}
        <div className="relative">
          {/* Connection Line */}
          <div className="absolute left-8 sm:left-1/2 top-0 bottom-0 w-px bg-white/10 sm:-translate-x-1/2" />
          
          {/* Animated Progress Line */}
          <motion.div
            className="absolute left-8 sm:left-1/2 top-0 w-0.5 sm:-translate-x-1/2 origin-top"
            style={{
              background: 'linear-gradient(180deg, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0.1) 100%)',
              height: "100%"
            }}
            initial={{ scaleY: 0 }}
            animate={{ scaleY: isInView ? activeStep / steps.length : 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          />

          <div className="space-y-16 sm:space-y-20 md:space-y-24">
            {steps.map((step, index) => {
              const isActive = activeStep === index + 1;
              const isPassed = activeStep > index + 1;
              const isLeft = index % 2 === 0;

              return (
                <div
                  key={step.id}
                  className={`relative flex items-center ${
                    isLeft ? "justify-start" : "justify-end"
                  }`}
                >
                  {/* Center Icon */}
                  <motion.div
                    className="absolute left-8 sm:left-1/2 sm:-translate-x-1/2 z-20 -translate-x-1/2"
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{
                      scale: activeStep >= index + 1 ? 1 : 0,
                      opacity: activeStep >= index + 1 ? 1 : 0,
                    }}
                    transition={{
                      duration: 0.4,
                      delay: 0.1,
                      type: "spring",
                      stiffness: 200,
                      damping: 15,
                    }}
                  >
                    <motion.div
                      className="w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center relative"
                      style={{
                        backgroundColor: step.color,
                        boxShadow: `0 8px 32px ${step.color}40`
                      }}
                      animate={{
                        scale: isActive ? [1, 1.08, 1] : 1,
                        boxShadow: isActive
                          ? [
                              `0 8px 32px ${step.color}40`,
                              `0 12px 48px ${step.color}60`,
                              `0 8px 32px ${step.color}40`,
                            ]
                          : `0 8px 32px ${step.color}40`,
                      }}
                      transition={{
                        duration: 2,
                        repeat: isActive ? Infinity : 0,
                        ease: "easeInOut"
                      }}
                    >
                      <step.icon className="w-6 h-6 sm:w-7 sm:h-7 md:w-9 md:h-9 text-white" strokeWidth={2} />
                      
                      {/* Subtle Pulse Ring */}
                      {isActive && (
                        <motion.div
                          className="absolute inset-0 rounded-full"
                          style={{ backgroundColor: step.color }}
                          initial={{ scale: 1, opacity: 0.4 }}
                          animate={{ scale: 1.6, opacity: 0 }}
                          transition={{
                            duration: 2,
                            repeat: Infinity,
                            ease: "easeOut",
                          }}
                        />
                      )}

                      {/* Checkmark for completed */}
                      {isPassed && (
                        <motion.div
                          initial={{ scale: 0, rotate: -90 }}
                          animate={{ scale: 1, rotate: 0 }}
                          transition={{
                            type: "spring",
                            stiffness: 200,
                            damping: 12,
                            duration: 0.5,
                          }}
                          className="absolute -bottom-1 -right-1 w-6 h-6 sm:w-7 sm:h-7 bg-white rounded-full flex items-center justify-center shadow-lg"
                        >
                          <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-black" strokeWidth={3} />
                        </motion.div>
                      )}
                    </motion.div>
                  </motion.div>

                  {/* Content */}
                  <motion.div
                    className={`pl-20 text-left sm:pl-0 sm:w-5/12 ${isLeft ? "sm:pr-12 md:pr-16 sm:text-right" : "sm:pl-12 md:pl-16 sm:text-left"}`}
                    initial={{ opacity: 0, x: isLeft ? 50 : -50 }}
                    animate={{
                      opacity: activeStep >= index + 1 ? 1 : 0.3,
                      x: 0,
                    }}
                    transition={{
                      duration: 0.6,
                      delay: 0.15,
                      ease: [0.25, 0.1, 0.25, 1],
                    }}
                  >
                    <h3
                      className="text-white mb-1"
                      style={{
                        fontWeight: '600',
                        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif',
                        fontSize: 'clamp(16px, 2.5vw, 20px)',
                      }}
                    >
                      {step.title}
                    </h3>
                    <p
                      className="text-white/50"
                      style={{
                        fontWeight: '400',
                        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif',
                        fontSize: 'clamp(13px, 1.8vw, 15px)',
                      }}
                    >
                      {step.subtitle}
                    </p>
                  </motion.div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
});

WorkflowSection.displayName = "WorkflowSection";