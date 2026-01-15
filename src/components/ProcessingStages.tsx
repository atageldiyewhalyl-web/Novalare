import { motion, AnimatePresence } from "motion/react";
import { Upload, FileText, Brain, Sparkles, CheckCircle, Search, TrendingUp, Database } from "lucide-react";
import { useEffect, useState } from "react";

interface ProcessingStagesProps {
  type: 'invoice' | 'pe' | 'bank-rec' | 'ap-rec' | 'cc-rec';
}

export function ProcessingStages({ type }: ProcessingStagesProps) {
  const [currentStage, setCurrentStage] = useState(0);

  // ACTUAL processing stages based on backend code
  const getStages = () => {
    switch (type) {
      case 'invoice':
        return [
          { icon: Upload, label: "Receiving File", color: "#65D3FD", duration: 300 },
          { icon: FileText, label: "Reading Document", color: "#4EA8FF", duration: 700 },
          { icon: Brain, label: "AI Extracting Data", color: "#8b5cf6", duration: 1500 },
          { icon: Sparkles, label: "Formatting Results", color: "#10b981", duration: 500 },
        ];
      case 'pe':
        return [
          { icon: Upload, label: "Receiving 10-K", color: "#65D3FD", duration: 500 },
          { icon: FileText, label: "Parsing PDF", color: "#8b5cf6", duration: 1500 },
          { icon: Search, label: "Finding Financials", color: "#A370FF", duration: 1500 },
          { icon: Brain, label: "AI Analysis", color: "#3b82f6", duration: 4000 },
          { icon: Sparkles, label: "Formatting Results", color: "#10b981", duration: 1000 },
        ];
      case 'bank-rec':
        return [
          { icon: Upload, label: "Uploading Files", color: "#65D3FD", duration: 400 },
          { icon: FileText, label: "Parsing Data", color: "#4EA8FF", duration: 1000 },
          { icon: TrendingUp, label: "Matching Transactions", color: "#8b5cf6", duration: 2500 },
          { icon: Brain, label: "AI Analysis", color: "#A370FF", duration: 2000 },
          { icon: Sparkles, label: "Generating Report", color: "#10b981", duration: 500 },
        ];
      case 'ap-rec':
        return [
          { icon: Upload, label: "Uploading Files", color: "#65D3FD", duration: 400 },
          { icon: Database, label: "Processing Data", color: "#4EA8FF", duration: 1000 },
          { icon: Search, label: "Finding Matches", color: "#8b5cf6", duration: 2500 },
          { icon: Brain, label: "AI Reconciliation", color: "#A370FF", duration: 2000 },
          { icon: Sparkles, label: "Generating Report", color: "#10b981", duration: 500 },
        ];
      case 'cc-rec':
        return [
          { icon: Upload, label: "Uploading Files", color: "#65D3FD", duration: 400 },
          { icon: FileText, label: "Processing Data", color: "#4EA8FF", duration: 1000 },
          { icon: Brain, label: "AI Analysis", color: "#8b5cf6", duration: 2000 },
          { icon: Sparkles, label: "Generating Report", color: "#10b981", duration: 500 },
        ];
      default:
        return [
          { icon: Upload, label: "Uploading Files", color: "#65D3FD", duration: 400 },
          { icon: FileText, label: "Processing Data", color: "#4EA8FF", duration: 1000 },
          { icon: Brain, label: "AI Analysis", color: "#8b5cf6", duration: 2000 },
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

  const currentColor = stages[currentStage]?.color || '#65D3FD';

  return (
    <div className="relative py-16">
      {/* Animated background gradient */}
      <div className="absolute inset-0 overflow-hidden opacity-30">
        <motion.div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(circle at 50% 50%, ${currentColor}20, transparent 70%)`
          }}
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3]
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
      </div>

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center">
        {/* Large central icon area */}
        <div className="relative w-36 h-36 mb-10">
          {/* Outer rotating gradient ring */}
          <motion.div
            className="absolute inset-0 rounded-full"
            style={{
              background: `conic-gradient(from 0deg, ${currentColor}, ${currentColor}00 50%, ${currentColor} 100%)`,
              opacity: 0.6
            }}
            animate={{ rotate: 360 }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: "linear"
            }}
          />
          
          {/* Middle pulsing ring */}
          <motion.div
            className="absolute inset-3 rounded-full"
            style={{
              background: `linear-gradient(135deg, ${currentColor}40, ${currentColor}10)`,
              filter: 'blur(8px)'
            }}
            animate={{
              scale: [1, 1.1, 1],
              opacity: [0.6, 0.8, 0.6]
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
          
          {/* Inner glow circle */}
          <motion.div
            className="absolute inset-6 rounded-full flex items-center justify-center bg-white"
            style={{
              boxShadow: `0 0 40px ${currentColor}40, inset 0 0 30px ${currentColor}15`
            }}
            animate={{
              boxShadow: [
                `0 0 40px ${currentColor}40, inset 0 0 30px ${currentColor}15`,
                `0 0 60px ${currentColor}60, inset 0 0 40px ${currentColor}25`,
                `0 0 40px ${currentColor}40, inset 0 0 30px ${currentColor}15`,
              ]
            }}
            transition={{
              duration: 2,
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
                    animate={{ 
                      scale: [0.8, 1.1, 1],
                      rotate: 0, 
                      opacity: 1 
                    }}
                    exit={{ scale: 0, rotate: 180, opacity: 0 }}
                    transition={{ 
                      duration: 0.6,
                      scale: {
                        duration: 0.8,
                        times: [0, 0.5, 1],
                        type: "spring",
                        stiffness: 200
                      }
                    }}
                  >
                    <Icon 
                      size={56} 
                      color={stage.color}
                      strokeWidth={2}
                    />
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </motion.div>

          {/* Orbital particles */}
          {[...Array(12)].map((_, i) => {
            const angle = (i * 360) / 12;
            return (
              <motion.div
                key={i}
                className="absolute w-2 h-2 rounded-full"
                style={{
                  background: currentColor,
                  left: '50%',
                  top: '50%',
                  marginLeft: '-4px',
                  marginTop: '-4px',
                }}
                animate={{
                  x: [
                    0,
                    Math.cos(angle * Math.PI / 180) * 75,
                    Math.cos(angle * Math.PI / 180) * 85,
                  ],
                  y: [
                    0,
                    Math.sin(angle * Math.PI / 180) * 75,
                    Math.sin(angle * Math.PI / 180) * 85,
                  ],
                  opacity: [0, 0.8, 0],
                  scale: [0, 1, 0.5],
                }}
                transition={{
                  duration: 2.5,
                  repeat: Infinity,
                  delay: i * 0.15,
                  ease: "easeOut"
                }}
              />
            );
          })}
        </div>

        {/* Stage label with smooth transitions */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStage}
            initial={{ opacity: 0, y: 20, filter: "blur(10px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -20, filter: "blur(10px)" }}
            transition={{ duration: 0.4 }}
            className="text-center mb-10"
          >
            <motion.h3 
              className="text-4xl font-bold mb-3"
              style={{ color: currentColor }}
              animate={{
                scale: [1, 1.02, 1]
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            >
              {stages[currentStage]?.label}
            </motion.h3>
            <p className="text-gray-600 text-lg">
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

        {/* Progress dots with wave animation */}
        <div className="flex gap-4 mb-8">
          {stages.map((stage, index) => (
            <motion.div
              key={index}
              className="relative"
            >
              {/* Main dot */}
              <motion.div
                className="w-4 h-4 rounded-full"
                initial={{ scale: 0.5, opacity: 0.3 }}
                animate={{
                  scale: index === currentStage ? [1.2, 1.5, 1.2] : index < currentStage ? 1 : 0.7,
                  opacity: index <= currentStage ? 1 : 0.3,
                  backgroundColor: index <= currentStage ? stage.color : '#d1d5db',
                }}
                transition={{ 
                  duration: 0.4,
                  scale: index === currentStage ? {
                    duration: 1.5,
                    repeat: Infinity,
                    ease: "easeInOut"
                  } : {}
                }}
              />
              
              {/* Ripple effect for current stage */}
              {index === currentStage && (
                <>
                  <motion.div
                    className="absolute inset-0 rounded-full"
                    style={{ backgroundColor: stage.color }}
                    animate={{
                      scale: [1, 3, 3],
                      opacity: [0.6, 0, 0],
                    }}
                    transition={{
                      duration: 1.5,
                      repeat: Infinity,
                      ease: "easeOut"
                    }}
                  />
                  <motion.div
                    className="absolute inset-0 rounded-full"
                    style={{ backgroundColor: stage.color }}
                    animate={{
                      scale: [1, 2.5, 2.5],
                      opacity: [0.4, 0, 0],
                    }}
                    transition={{
                      duration: 1.5,
                      repeat: Infinity,
                      delay: 0.3,
                      ease: "easeOut"
                    }}
                  />
                </>
              )}
              
              {/* Checkmark for completed stages */}
              {index < currentStage && (
                <motion.div
                  className="absolute inset-0 flex items-center justify-center"
                  initial={{ scale: 0, rotate: -90 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  <CheckCircle 
                    size={16} 
                    className="text-white"
                    strokeWidth={3}
                    fill={stage.color}
                  />
                </motion.div>
              )}
            </motion.div>
          ))}
        </div>

        {/* Time estimate with subtle pulse */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: [0.6, 1, 0.6] }}
          transition={{ 
            opacity: {
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut"
            }
          }}
          className="text-gray-500 text-sm"
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