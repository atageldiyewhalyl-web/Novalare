import { motion, AnimatePresence } from "motion/react";
import { Upload, FileText, Brain, Sparkles, CheckCircle, Search, TrendingUp, Database } from "lucide-react";
import { useEffect, useState } from "react";

interface ProcessingStagesProps {
  type: 'invoice' | 'pe' | 'bank-rec' | 'ap-rec';
}

export function ProcessingStages({ type }: ProcessingStagesProps) {
  const [currentStage, setCurrentStage] = useState(0);

  // ACTUAL processing stages based on backend code
  const getStages = () => {
    switch (type) {
      case 'invoice':
        return [
          { icon: Upload, label: "Receiving File", color: "#A370FF", duration: 300 },
          { icon: FileText, label: "Reading Document", color: "#4EA8FF", duration: 700 },
          { icon: Brain, label: "AI Extracting Data", color: "#3FE3C5", duration: 1500 },
          { icon: Sparkles, label: "Formatting Results", color: "#10b981", duration: 500 },
        ];
      case 'pe':
        return [
          { icon: Upload, label: "Receiving 10-K", color: "#06b6d4", duration: 500 },
          { icon: FileText, label: "Parsing PDF", color: "#8b5cf6", duration: 1500 },
          { icon: Search, label: "Finding Financials", color: "#A370FF", duration: 1500 },
          { icon: Brain, label: "AI Analysis", color: "#3b82f6", duration: 4000 },
          { icon: Sparkles, label: "Formatting Results", color: "#10b981", duration: 1000 },
        ];
      case 'bank-rec':
        return [
          { icon: Upload, label: "Uploading Files", color: "#8b5cf6", duration: 400 },
          { icon: FileText, label: "Parsing Data", color: "#7c3aed", duration: 1000 },
          { icon: TrendingUp, label: "Matching Transactions", color: "#6d28d9", duration: 2500 },
          { icon: Brain, label: "AI Analysis", color: "#5b21b6", duration: 2000 },
          { icon: Sparkles, label: "Generating Report", color: "#8b5cf6", duration: 500 },
        ];
      case 'ap-rec':
        return [
          { icon: Upload, label: "Uploading Files", color: "#A370FF", duration: 400 },
          { icon: Database, label: "Processing Data", color: "#8b5cf6", duration: 1000 },
          { icon: Search, label: "Finding Matches", color: "#06b6d4", duration: 2500 },
          { icon: Brain, label: "AI Reconciliation", color: "#3b82f6", duration: 2000 },
          { icon: Sparkles, label: "Generating Report", color: "#10b981", duration: 500 },
        ];
      default:
        return [
          { icon: Upload, label: "Uploading Files", color: "#8b5cf6", duration: 400 },
          { icon: FileText, label: "Processing Data", color: "#7c3aed", duration: 1000 },
          { icon: Brain, label: "AI Analysis", color: "#6d28d9", duration: 2000 },
          { icon: Sparkles, label: "Generating Report", color: "#10b981", duration: 500 },
        ];
    }
  };

  const stages = getStages();

  useEffect(() => {
    let stageTimeout: ReturnType<typeof setTimeout>;

    const runStage = (stageIndex: number) => {
      if (stageIndex >= stages.length) return;

      setCurrentStage(stageIndex);

      stageTimeout = setTimeout(() => {
        runStage(stageIndex + 1);
      }, stages[stageIndex].duration);
    };

    runStage(0);

    return () => {
      clearTimeout(stageTimeout);
    };
  }, [type]);

  return (
    <div className="relative py-12">
      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center">
        {/* Large central icon area */}
        <div className="relative w-32 h-32 mb-8">
          {/* Outer rotating ring */}
          <motion.div
            className="absolute inset-0 rounded-full"
            style={{
              background: `conic-gradient(from 0deg, ${stages[currentStage]?.color || '#A370FF'}, transparent, ${stages[currentStage]?.color || '#A370FF'})`
            }}
            animate={{ rotate: 360 }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "linear"
            }}
          />
          
          {/* Inner glow circle */}
          <motion.div
            className="absolute inset-2 rounded-full flex items-center justify-center"
            style={{
              background: 'radial-gradient(circle, rgba(255,255,255,1) 0%, rgba(249,250,251,1) 100%)',
              boxShadow: `inset 0 0 30px ${stages[currentStage]?.color || '#8b5cf6'}20, 0 0 40px ${stages[currentStage]?.color || '#8b5cf6'}20`
            }}
            animate={{
              boxShadow: [
                `inset 0 0 30px ${stages[currentStage]?.color}20, 0 0 40px ${stages[currentStage]?.color}20`,
                `inset 0 0 50px ${stages[currentStage]?.color}30, 0 0 60px ${stages[currentStage]?.color}30`,
                `inset 0 0 30px ${stages[currentStage]?.color}20, 0 0 40px ${stages[currentStage]?.color}20`,
              ]
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          >
            <AnimatePresence mode="wait">
              {stages.map((stage, index) => {
                if (index !== currentStage) return null;
                const Icon = stage.icon;
                
                return (
                  <motion.div
                    key={index}
                    initial={{ scale: 0, rotate: -180, opacity: 0 }}
                    animate={{ scale: 1, rotate: 0, opacity: 1 }}
                    exit={{ scale: 0, rotate: 180, opacity: 0 }}
                    transition={{ duration: 0.5, type: "spring", stiffness: 200 }}
                  >
                    <Icon 
                      size={48} 
                      color={stage.color}
                      strokeWidth={1.5}
                    />
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </motion.div>

          {/* Particle effects */}
          {[...Array(8)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-2 h-2 rounded-full"
              style={{
                background: stages[currentStage]?.color || '#A370FF',
                left: '50%',
                top: '50%',
              }}
              animate={{
                x: [0, Math.cos(i * 45 * Math.PI / 180) * 80],
                y: [0, Math.sin(i * 45 * Math.PI / 180) * 80],
                opacity: [1, 0],
                scale: [1, 0],
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                delay: i * 0.1,
                ease: "easeOut"
              }}
            />
          ))}
        </div>

        {/* Stage label with smooth transitions */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStage}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="text-center mb-8"
          >
            <h3 
              className="text-3xl font-bold mb-2"
              style={{ color: stages[currentStage]?.color || '#8b5cf6' }}
            >
              {stages[currentStage]?.label}
            </h3>
            <p className="text-gray-600">
              {currentStage === stages.length - 1 
                ? 'Processing complete!' 
                : type === 'invoice'
                ? 'AI is working on your invoice...'
                : type === 'pe'
                ? 'AI is working on your 10-K filing...'
                : type === 'bank-rec'
                ? 'AI is matching your transactions...'
                : 'AI is reconciling your data...'
              }
            </p>
          </motion.div>
        </AnimatePresence>

        {/* Progress dots */}
        <div className="flex gap-3">
          {stages.map((stage, index) => (
            <motion.div
              key={index}
              className="relative w-3 h-3 rounded-full"
              initial={{ scale: 0.5, opacity: 0.3 }}
              animate={{
                scale: index === currentStage ? 1.5 : index < currentStage ? 1 : 0.8,
                opacity: index <= currentStage ? 1 : 0.3,
                backgroundColor: index <= currentStage ? stage.color : '#d1d5db',
              }}
              transition={{ duration: 0.3 }}
            >
              {/* Ripple effect for current stage */}
              {index === currentStage && (
                <motion.div
                  className="absolute inset-0 rounded-full"
                  style={{ backgroundColor: stage.color }}
                  animate={{
                    scale: [1, 2.5, 2.5],
                    opacity: [0.5, 0, 0],
                  }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    ease: "easeOut"
                  }}
                />
              )}
            </motion.div>
          ))}
        </div>

        {/* Time estimate */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-gray-500 text-sm mt-6"
        >
          Usually takes {
            type === 'invoice' ? '2-3' 
            : type === 'pe' ? '7-10' 
            : type === 'bank-rec' ? '5-8'
            : '5-8'
          } seconds
        </motion.p>
      </div>
    </div>
  );
}