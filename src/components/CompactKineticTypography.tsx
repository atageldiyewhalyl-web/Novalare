import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';

// Apple-style easing curves
const appleEase = [0.4, 0, 0.2, 1];
const smoothEase = [0.25, 0.1, 0.25, 1];

// Highlight colors palette
const highlightColors = [
  { color: '#60A5FA', shadow: 'rgba(96, 165, 250, 0.6)' },      // Blue
  { color: '#C084FC', shadow: 'rgba(192, 132, 252, 0.6)' },     // Purple
  { color: '#22D3EE', shadow: 'rgba(34, 211, 238, 0.6)' },      // Cyan
  { color: '#34D399', shadow: 'rgba(52, 211, 153, 0.6)' },      // Green
];

type AnimationPhase = 
  | 'intro'
  | 'features'
  | 'brand';

const featureStatements = [
  { 
    text: 'Automate your Month-End', 
    highlights: ['Month-End'], 
    duration: 2000,
    animation: 'slideUp'
  },
  { 
    text: 'Reduce operational workload', 
    highlights: ['Reduce','workload'], 
    duration: 1800,
    animation: 'slideUp'
  },
  { 
    text: 'Strengthen your accuracy', 
    highlights: ['Strengthen', 'accuracy'], 
    duration: 1800,
    animation: 'glideRight'
  },
  { 
    text: 'Automate invoice processing', 
    highlights: ['invoice', 'processing'], 
    duration: 2000,
    animation: 'zoomIn'
  },
];

// Word-by-word animated text component
const HighlightedText = ({ text, highlights, delay = 0, colorIndex = 0 }: { 
  text: string; 
  highlights: string[]; 
  delay?: number;
  colorIndex?: number;
}) => {
  const words = text.split(' ');
  const selectedColor = highlightColors[colorIndex % highlightColors.length];
  
  return (
    <span className="inline-flex flex-wrap justify-center gap-x-1.5 md:gap-x-2">
      {words.map((word, index) => {
        const isHighlighted = highlights.some(h => 
          word.toLowerCase().includes(h.toLowerCase().replace(/[.,!?]/g, ''))
        );
        
        return (
          <motion.span
            key={index}
            className="inline-block"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ 
              duration: 0.3, 
              delay: delay + (index * 0.02),
              ease: appleEase 
            }}
          >
            {isHighlighted ? (
              <motion.span
                className="inline-block relative"
                initial={{ color: '#ffffff' }}
                animate={{ 
                  color: selectedColor.color,
                  textShadow: `0 0 20px ${selectedColor.shadow}`
                }}
                transition={{ 
                  delay: delay + 0.2,
                  duration: 0.6,
                  ease: smoothEase
                }}
              >
                {word}
              </motion.span>
            ) : (
              <span>{word}</span>
            )}
          </motion.span>
        );
      })}
    </span>
  );
};

// Feature animation variants
const getFeatureAnimation = (animationType: string) => {
  switch (animationType) {
    case 'slideUp':
      return {
        initial: { opacity: 0, y: 30 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -15 }
      };
    case 'glideRight':
      return {
        initial: { opacity: 0, x: -40 },
        animate: { opacity: 1, x: 0 },
        exit: { opacity: 0, x: 30 }
      };
    case 'zoomIn':
      return {
        initial: { opacity: 0, scale: 0.96 },
        animate: { opacity: 1, scale: 1 },
        exit: { opacity: 0, scale: 0.98 }
      };
    default:
      return {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 }
      };
  }
};

export const CompactKineticTypography = () => {
  const [phase, setPhase] = useState<AnimationPhase>('intro');
  const [featureIndex, setFeatureIndex] = useState(0);

  useEffect(() => {
    // SECTION 1: Intro phrase
    if (phase === 'intro') {
      const timer = setTimeout(() => {
        setPhase('features');
      }, 2500);
      return () => clearTimeout(timer);
    }

    // SECTION 2: Feature statements
    if (phase === 'features') {
      if (featureIndex < featureStatements.length - 1) {
        const timer = setTimeout(() => {
          setFeatureIndex(featureIndex + 1);
        }, featureStatements[featureIndex].duration);
        return () => clearTimeout(timer);
      } else {
        const timer = setTimeout(() => {
          setPhase('brand');
        }, featureStatements[featureIndex].duration);
        return () => clearTimeout(timer);
      }
    }

    // SECTION 3: Brand - show for 3 seconds then loop back
    if (phase === 'brand') {
      const timer = setTimeout(() => {
        setPhase('intro');
        setFeatureIndex(0);
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [phase, featureIndex]);

  return (
    <div className="relative flex items-center justify-center py-16 md:py-20 bg-black overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-black via-gray-900/50 to-black pointer-events-none" />
      
      <div 
        className="w-full max-w-5xl px-4 md:px-8 relative z-10"
        style={{
          fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", Arial, sans-serif'
        }}
      >
        
        <AnimatePresence mode="wait">
          {/* SECTION 1: Intro */}
          {phase === 'intro' && (
            <motion.div
              key="intro"
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.6, ease: appleEase }}
              className="text-center"
            >
              <h2 className="text-white text-2xl sm:text-3xl md:text-4xl lg:text-5xl tracking-tight" style={{ fontWeight: 700 }}>
                <HighlightedText 
                  text="Transform your accounting practice"
                  highlights={['Transform', 'accounting']}
                  colorIndex={0}
                />
              </h2>
            </motion.div>
          )}

          {/* SECTION 2: Features with varied animations */}
          {phase === 'features' && (
            <motion.div
              key={`feature-${featureIndex}`}
              {...getFeatureAnimation(featureStatements[featureIndex].animation)}
              transition={{
                duration: 0.6,
                ease: appleEase,
              }}
              className="text-center"
            >
              <h2 className="text-white text-2xl sm:text-3xl md:text-4xl lg:text-5xl tracking-tight" style={{ fontWeight: 700 }}>
                <HighlightedText 
                  text={featureStatements[featureIndex].text}
                  highlights={featureStatements[featureIndex].highlights}
                  colorIndex={featureIndex}
                />
              </h2>
            </motion.div>
          )}

          {/* SECTION 3: Brand - Novalare */}
          {phase === 'brand' && (
            <motion.div
              key="brand"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ 
                opacity: 1, 
                scale: 1,
                transition: {
                  duration: 1.0,
                  ease: smoothEase
                }
              }}
              className="text-center"
            >
              <motion.h2
                className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl tracking-tight"
                style={{
                  fontWeight: 700,
                  color: '#ffffff'
                }}
                animate={{
                  textShadow: [
                    '0 0 40px rgba(255,255,255,0.6), 0 0 80px rgba(255,255,255,0.3)',
                    '0 0 60px rgba(255,255,255,0.8), 0 0 120px rgba(255,255,255,0.5)',
                    '0 0 40px rgba(255,255,255,0.6), 0 0 80px rgba(255,255,255,0.3)'
                  ]
                }}
                transition={{
                  duration: 3,
                  ease: smoothEase,
                  repeat: Infinity,
                  repeatType: 'reverse'
                }}
              >
                Novalare
              </motion.h2>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
};