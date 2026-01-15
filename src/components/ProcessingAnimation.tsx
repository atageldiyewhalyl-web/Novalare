import { motion, AnimatePresence } from 'motion/react';
import { FileSpreadsheet } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useState, useEffect } from 'react';

interface ProcessingAnimationProps {
  processingStage: string;
}

const TIPS = [
  '💡 Our Split & Map architecture processes each page in parallel using OpenAI, achieving 3-6 second extraction times.',
  '🚀 No templates needed! Our AI adapts to any bank statement format automatically.',
  '⚡ Processing hundreds of transactions? Sit back and relax - this usually takes 3-10 seconds.',
  '🎯 Each page is analyzed independently, then mapped to a unified schema for consistency.',
  '🧠 AI-powered extraction means 99%+ accuracy on transaction amounts and dates.',
];

export function ProcessingAnimation({ processingStage }: ProcessingAnimationProps) {
  const [currentTipIndex, setCurrentTipIndex] = useState(0);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTipIndex((prev) => (prev + 1) % TIPS.length);
    }, 4000); // Change tip every 4 seconds
    
    return () => clearInterval(interval);
  }, []);
  
  return (
    <Card className="bg-gradient-to-br from-[#65D3FD]/10 to-[#65D3FD]/5 border-[#65D3FD]/30 rounded-2xl">
      <CardContent className="py-16">
        <div className="flex flex-col items-center justify-center space-y-8">
          {/* Animated Circle Progress */}
          <motion.div
            className="relative"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            {/* Outer rotating ring */}
            <motion.div
              className="size-32 rounded-full border-4 border-[#65D3FD]/20 border-t-[#65D3FD]"
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            />
            
            {/* Inner pulsing circle */}
            <motion.div
              className="absolute inset-4 rounded-full bg-[#65D3FD]/20 flex items-center justify-center"
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            >
              <FileSpreadsheet className="size-12 text-[#65D3FD]" />
            </motion.div>
          </motion.div>
          
          {/* Animated Processing Stage Text */}
          <AnimatePresence mode="wait">
            <motion.div
              key={processingStage}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="text-center space-y-2"
            >
              <p className="text-lg font-medium text-gray-900">
                Processing Your Statement
              </p>
              <p className="text-sm text-[#65D3FD]">
                {processingStage || '🚀 Starting extraction...'}
              </p>
            </motion.div>
          </AnimatePresence>
          
          {/* Fun Facts / Tips - Rotating */}
          <div className="max-w-md text-center px-6 py-4 bg-white/80 border border-[#65D3FD]/20 rounded-xl min-h-[80px] flex items-center">
            <AnimatePresence mode="wait">
              <motion.p
                key={currentTipIndex}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.5 }}
                className="text-xs text-gray-600"
              >
                {TIPS[currentTipIndex]}
              </motion.p>
            </AnimatePresence>
          </div>
          
          {/* Progress Dots */}
          <div className="flex gap-2">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="size-2 rounded-full bg-[#65D3FD]"
                animate={{
                  scale: [1, 1.5, 1],
                  opacity: [0.3, 1, 0.3],
                }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  delay: i * 0.2,
                }}
              />
            ))}
          </div>
          
          {/* Floating particles for visual interest */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {[...Array(8)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute size-1 rounded-full bg-[#65D3FD]/30"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                }}
                animate={{
                  y: [0, -30, 0],
                  opacity: [0, 1, 0],
                }}
                transition={{
                  duration: 3 + Math.random() * 2,
                  repeat: Infinity,
                  delay: Math.random() * 2,
                }}
              />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}