import { motion, AnimatePresence } from "motion/react";
import { useRef, useState, useEffect, forwardRef } from "react";
import {
  Mail,
  Download,
  FileSearch,
  Sheet,
  Send,
  Bell,
  Archive,
  ChevronLeft,
  ChevronRight,
  Calculator,
  Receipt,
  CheckCircle2,
  Upload,
  FileText,
  FolderOpen,
  Clock,
  DollarSign,
  BarChart3,
  FileCheck,
  Sparkles,
} from "lucide-react";

interface Step {
  id: number;
  title: string;
  subtitle: string;
  icon: React.ElementType;
  color: string;
}

interface Workflow {
  id: number;
  name: string;
  description: string;
  steps: Step[];
}

const workflows: Workflow[] = [
  {
    id: 1,
    name: "Invoice Extraction",
    description: "AI extracts invoice data from emails and PDFs, categorizes with GL codes, and exports to QuickBooks",
    steps: [
      {
        id: 1,
        title: "Upload Invoice",
        subtitle: "Email or manual upload",
        icon: Mail,
        color: "#4F46E5",
      },
      {
        id: 2,
        title: "AI Extraction",
        subtitle: "Vendor, amount, date, line items",
        icon: FileSearch,
        color: "#6366F1",
      },
      {
        id: 3,
        title: "Auto-Categorize",
        subtitle: "GL codes & expense accounts",
        icon: Calculator,
        color: "#4F46E5",
      },
      {
        id: 4,
        title: "Review & Edit",
        subtitle: "Accountant approval",
        icon: CheckCircle2,
        color: "#6366F1",
      },
      {
        id: 5,
        title: "Export to QB",
        subtitle: "Bill created automatically",
        icon: Send,
        color: "#4F46E5",
      },
      {
        id: 6,
        title: "Archive",
        subtitle: "Stored & indexed",
        icon: Archive,
        color: "#10B981",
      },
    ],
  },
  {
    id: 2,
    name: "Bank Reconciliation",
    description: "Match bank statement transactions with accounting records, auto-categorize, and flag exceptions",
    steps: [
      {
        id: 1,
        title: "Import Statement",
        subtitle: "Bank CSV or API feed",
        icon: Upload,
        color: "#4F46E5",
      },
      {
        id: 2,
        title: "Match Transactions",
        subtitle: "AI finds QB counterparts",
        icon: FileSearch,
        color: "#6366F1",
      },
      {
        id: 3,
        title: "Categorize Unmatched",
        subtitle: "Suggest GL codes",
        icon: FolderOpen,
        color: "#4F46E5",
      },
      {
        id: 4,
        title: "Flag Discrepancies",
        subtitle: "Missing or duplicate entries",
        icon: Bell,
        color: "#F59E0B",
      },
      {
        id: 5,
        title: "Review Dashboard",
        subtitle: "Accountant approves",
        icon: CheckCircle2,
        color: "#6366F1",
      },
      {
        id: 6,
        title: "Export to QB",
        subtitle: "Reconciliation complete",
        icon: Send,
        color: "#10B981",
      },
    ],
  },
  {
    id: 3,
    name: "AP Reconciliation",
    description: "Match vendor invoices with bills in QuickBooks and identify payment discrepancies automatically",
    steps: [
      {
        id: 1,
        title: "Pull AP Data",
        subtitle: "Import from QuickBooks",
        icon: Download,
        color: "#4F46E5",
      },
      {
        id: 2,
        title: "Gather Invoices",
        subtitle: "Email & document portal",
        icon: Receipt,
        color: "#6366F1",
      },
      {
        id: 3,
        title: "Match & Compare",
        subtitle: "AI cross-references amounts",
        icon: FileSearch,
        color: "#4F46E5",
      },
      {
        id: 4,
        title: "Flag Exceptions",
        subtitle: "Missing invoices, duplicates",
        icon: Bell,
        color: "#F59E0B",
      },
      {
        id: 5,
        title: "Review Findings",
        subtitle: "Resolve discrepancies",
        icon: CheckCircle2,
        color: "#6366F1",
      },
      {
        id: 6,
        title: "Update Records",
        subtitle: "Export corrections to QB",
        icon: Send,
        color: "#10B981",
      },
    ],
  },
  {
    id: 4,
    name: "Trial Balance & Journal Entries",
    description: "Analyze trial balance, suggest adjusting entries, and prepare month-end close journal entries",
    steps: [
      {
        id: 1,
        title: "Pull Trial Balance",
        subtitle: "Extract from QuickBooks",
        icon: Download,
        color: "#4F46E5",
      },
      {
        id: 2,
        title: "AI Analysis",
        subtitle: "Detect anomalies & patterns",
        icon: FileSearch,
        color: "#6366F1",
      },
      {
        id: 3,
        title: "Suggest Entries",
        subtitle: "Accruals, reclasses, adjustments",
        icon: FileText,
        color: "#4F46E5",
      },
      {
        id: 4,
        title: "Review Proposals",
        subtitle: "Accountant edits & approves",
        icon: CheckCircle2,
        color: "#6366F1",
      },
      {
        id: 5,
        title: "Export to QB",
        subtitle: "Journal entries posted",
        icon: Send,
        color: "#4F46E5",
      },
      {
        id: 6,
        title: "Updated Balance",
        subtitle: "Ready for financial statements",
        icon: BarChart3,
        color: "#10B981",
      },
    ],
  },
  {
    id: 5,
    name: "Month-End Close",
    description: "Orchestrate all reconciliations, journal entries, and reports in a single automated workflow",
    steps: [
      {
        id: 1,
        title: "Trigger Close",
        subtitle: "Scheduled or manual start",
        icon: Clock,
        color: "#4F46E5",
      },
      {
        id: 2,
        title: "Run Reconciliations",
        subtitle: "Bank, AP, AR, credit cards",
        icon: Calculator,
        color: "#6366F1",
      },
      {
        id: 3,
        title: "Suggest JEs",
        subtitle: "AI proposes adjustments",
        icon: FileText,
        color: "#4F46E5",
      },
      {
        id: 4,
        title: "Review & Approve",
        subtitle: "Manager sign-off",
        icon: CheckCircle2,
        color: "#6366F1",
      },
      {
        id: 5,
        title: "Generate Reports",
        subtitle: "P&L, Balance Sheet, Cash Flow",
        icon: BarChart3,
        color: "#4F46E5",
      },
      {
        id: 6,
        title: "Export & Distribute",
        subtitle: "Send to stakeholders",
        icon: Send,
        color: "#10B981",
      },
    ],
  },
];

export const WorkflowSection = forwardRef<HTMLDivElement>((props, ref) => {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [currentWorkflowIndex, setCurrentWorkflowIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  const [activeStep, setActiveStep] = useState(0);

  const currentWorkflow = workflows[currentWorkflowIndex];

  // Auto-play through steps once
  useEffect(() => {
    if (activeStep < currentWorkflow.steps.length) {
      const timer = setTimeout(() => {
        setActiveStep(activeStep + 1);
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [activeStep, currentWorkflow.steps.length]);

  const handlePrevious = () => {
    setDirection(-1);
    setCurrentWorkflowIndex((prev) => (prev === 0 ? workflows.length - 1 : prev - 1));
    setActiveStep(0);
  };

  const handleNext = () => {
    setDirection(1);
    setCurrentWorkflowIndex((prev) => (prev === workflows.length - 1 ? 0 : prev + 1));
    setActiveStep(0);
  };

  return (
    <section
      ref={sectionRef}
      className="relative w-full min-h-screen px-4 md:px-6 lg:px-8 py-12 md:py-16 lg:py-24 xl:py-32 flex items-center justify-center"
      style={{ zIndex: 1 }}
    >
      {/* Background */}
      <div
        className="absolute inset-0 opacity-10"
        style={{
          background: "radial-gradient(ellipse at center, rgba(79, 70, 229, 0.15) 0%, transparent 70%)",
          zIndex: 0,
        }}
      />

      <div className="relative max-w-7xl mx-auto w-full">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="text-center mb-8 md:mb-12 lg:mb-20"
        >
          <h2
            className="text-white mb-3 md:mb-4"
            style={{
              fontSize: "clamp(28px, 6vw, 56px)",
              fontWeight: "700",
              fontFamily: "'Outfit', sans-serif",
              letterSpacing: "-0.02em",
            }}
          >
            Sample Workflows
          </h2>
          <p
            className="text-white/60 max-w-2xl mx-auto mb-6 md:mb-8 px-4 md:px-0"
            style={{
              fontSize: "clamp(14px, 1.8vw, 16px)",
              fontWeight: "500",
              fontFamily: "'Manrope', sans-serif",
              lineHeight: "1.6",
            }}
          >
            Watch AI automation in action — every step customizable to your firm
          </p>

          {/* Workflow Navigation */}
          <div className="flex items-center justify-center gap-3 md:gap-4">
            <button
              onClick={handlePrevious}
              className="group p-2 md:p-3 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 hover:border-indigo-500/30 transition-all duration-300"
              aria-label="Previous workflow"
            >
              <ChevronLeft className="w-5 h-5 md:w-6 md:h-6 text-white/70 group-hover:text-indigo-400 transition-colors" strokeWidth={2.5} />
            </button>

            <AnimatePresence mode="wait">
              <motion.div
                key={currentWorkflow.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="min-w-[280px] sm:min-w-[400px]"
              >
                <h3
                  className="text-white mb-2"
                  style={{
                    fontSize: "clamp(20px, 3vw, 28px)",
                    fontWeight: "700",
                    fontFamily: "'Outfit', sans-serif",
                    letterSpacing: "-0.01em",
                  }}
                >
                  {currentWorkflow.name}
                </h3>
                <p
                  className="text-white/50"
                  style={{
                    fontSize: "clamp(13px, 1.5vw, 15px)",
                    fontWeight: "500",
                    fontFamily: "'Manrope', sans-serif",
                    lineHeight: "1.5",
                  }}
                >
                  {currentWorkflow.description}
                </p>
              </motion.div>
            </AnimatePresence>

            <button
              onClick={handleNext}
              className="group p-2 md:p-3 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 hover:border-indigo-500/30 transition-all duration-300"
              aria-label="Next workflow"
            >
              <ChevronRight className="w-5 h-5 md:w-6 md:h-6 text-white/70 group-hover:text-indigo-400 transition-colors" strokeWidth={2.5} />
            </button>
          </div>

          {/* Workflow Indicator Dots */}
          <div className="flex items-center justify-center gap-2 mt-6">
            {workflows.map((workflow, index) => (
              <button
                key={workflow.id}
                onClick={() => {
                  setDirection(index > currentWorkflowIndex ? 1 : -1);
                  setCurrentWorkflowIndex(index);
                  setActiveStep(0);
                }}
                className="group"
                aria-label={`Go to ${workflow.name}`}
              >
                <div
                  className={`h-2 rounded-full transition-all duration-300 ${
                    index === currentWorkflowIndex
                      ? "w-8 bg-indigo-500"
                      : "w-2 bg-white/20 group-hover:bg-white/40"
                  }`}
                />
              </button>
            ))}
          </div>
        </motion.div>

        {/* Workflow Animation */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentWorkflow.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="relative"
          >
            {/* Vertical Timeline */}
            <div className="relative max-w-3xl mx-auto">
              {/* Vertical Connection Line */}
              <div className="absolute left-1/2 -translate-x-1/2 w-0.5" style={{ top: '10%', bottom: '10%' }}>
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/10 to-transparent" />
                
                {/* Animated progress line */}
                <motion.div
                  className="absolute top-0 left-0 w-full bg-gradient-to-b from-indigo-500 to-blue-500"
                  initial={{ height: "0%" }}
                  animate={{ height: `${(activeStep / currentWorkflow.steps.length) * 100}%` }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                />

                {/* Flowing particles */}
                {activeStep > 0 && activeStep <= currentWorkflow.steps.length && (
                  <>
                    <motion.div
                      className="absolute left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-indigo-400 shadow-lg shadow-indigo-500/50"
                      initial={{ top: "0%" }}
                      animate={{ top: `${(activeStep / currentWorkflow.steps.length) * 100}%` }}
                      transition={{ duration: 0.8, ease: "easeInOut" }}
                    />
                    <motion.div
                      className="absolute left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-blue-400 shadow-lg shadow-blue-500/50"
                      initial={{ top: "0%", opacity: 0 }}
                      animate={{ 
                        top: `${(activeStep / currentWorkflow.steps.length) * 100}%`,
                        opacity: [0, 1, 1, 0]
                      }}
                      transition={{ duration: 0.8, ease: "easeInOut", delay: 0.1 }}
                    />
                  </>
                )}
              </div>

              {/* Steps - Vertical Layout */}
              <div className="space-y-20 relative">{currentWorkflow.steps.map((step, index) => {
                const isActive = activeStep === index + 1;
                const isPassed = activeStep > index + 1;
                const isUpcoming = activeStep < index + 1;
                const isLeft = index % 2 === 0;

                return (
                  <motion.div
                    key={step.id}
                    initial={{ opacity: 0, scale: 0.8, y: 20 }}
                    animate={{ 
                      opacity: 1, 
                      scale: 1, 
                      y: 0 
                    }}
                    transition={{ 
                      delay: index * 0.1,
                      duration: 0.5,
                      type: "spring",
                      stiffness: 200,
                      damping: 20
                    }}
                    className="relative flex items-center justify-center"
                  >
                    {/* Alternating layout */}
                    <div className={`flex items-center gap-6 md:gap-12 w-full ${isLeft ? 'flex-row' : 'flex-row-reverse'}`}>
                      {/* Content side */}
                      <motion.div
                        className={`flex-1 ${isLeft ? 'text-right' : 'text-left'}`}
                        animate={{
                          opacity: isUpcoming ? 0.4 : 1,
                        }}
                      >
                        <h3
                          className={`mb-1 ${isActive ? "text-white" : isPassed ? "text-white" : "text-white/50"}`}
                          style={{
                            fontWeight: "600",
                            fontFamily: "'Outfit', sans-serif",
                            fontSize: "clamp(18px, 2.5vw, 22px)",
                          }}
                        >
                          {step.title}
                        </h3>
                        <p
                          className={`${isActive ? "text-indigo-300" : isPassed ? "text-white/60" : "text-white/40"}`}
                          style={{
                            fontWeight: "500",
                            fontFamily: "'Manrope', sans-serif",
                            fontSize: "clamp(14px, 1.8vw, 16px)",
                            lineHeight: "1.5",
                          }}
                        >
                          {step.subtitle}
                        </p>
                      </motion.div>

                      {/* Icon in center */}
                      <motion.div
                        className="relative flex-shrink-0"
                        animate={{
                          scale: isActive ? 1.15 : 1,
                        }}
                        transition={{
                          duration: 0.6,
                          ease: "easeOut",
                        }}
                      >
                        {/* Outer glow ring */}
                        <motion.div
                          className="absolute inset-0 rounded-full blur-xl"
                          style={{
                            background: `radial-gradient(circle, ${step.color}80 0%, transparent 70%)`,
                          }}
                          animate={{
                            opacity: isActive ? 0.8 : isPassed ? 0.4 : 0,
                          }}
                          transition={{
                            duration: 0.6,
                          }}
                        />

                        {/* Icon circle */}
                        <motion.div
                          className="relative w-24 h-24 md:w-28 md:h-28 rounded-full flex items-center justify-center backdrop-blur-sm"
                          style={{
                            backgroundColor: isPassed || isActive ? step.color : "rgba(255,255,255,0.05)",
                            border: `2px solid ${isUpcoming ? "rgba(255,255,255,0.1)" : step.color}`,
                          }}
                          animate={{
                            boxShadow: isActive 
                              ? `0 12px 40px ${step.color}60`
                              : isPassed
                                ? `0 8px 24px ${step.color}40`
                                : "0 0 0 rgba(0,0,0,0)",
                          }}
                          transition={{
                            duration: 0.6,
                          }}
                        >
                          <step.icon 
                            className={`w-11 h-11 md:w-12 md:h-12 ${isUpcoming ? "text-white/30" : "text-white"}`} 
                            strokeWidth={2} 
                          />

                          {/* Checkmark for completed */}
                          {isPassed && (
                            <motion.div
                              initial={{ scale: 0, rotate: -180 }}
                              animate={{ scale: 1, rotate: 0 }}
                              transition={{
                                type: "spring",
                                stiffness: 300,
                                damping: 15,
                              }}
                              className="absolute -bottom-2 -right-2 w-9 h-9 rounded-full flex items-center justify-center"
                              style={{
                                backgroundColor: "#10B981",
                                boxShadow: "0 4px 12px rgba(16, 185, 129, 0.4)",
                              }}
                            >
                              <CheckCircle2 className="w-5 h-5 text-white" strokeWidth={2.5} />
                            </motion.div>
                          )}
                        </motion.div>

                        {/* Step number */}
                        <motion.div
                          className="absolute -top-3 -left-3 w-8 h-8 rounded-full flex items-center justify-center backdrop-blur-sm"
                          style={{
                            backgroundColor: isActive || isPassed ? step.color : "rgba(255,255,255,0.1)",
                            border: "1px solid rgba(255,255,255,0.2)",
                          }}
                        >
                          <span
                            className="text-white"
                            style={{
                              fontSize: "13px",
                              fontWeight: "700",
                              fontFamily: "'Outfit', sans-serif",
                            }}
                          >
                            {index + 1}
                          </span>
                        </motion.div>
                      </motion.div>

                      {/* Empty space on other side */}
                      <div className="flex-1" />
                    </div>
                  </motion.div>
                );
              })}
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
});

WorkflowSection.displayName = "WorkflowSection";