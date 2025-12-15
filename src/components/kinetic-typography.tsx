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
  { color: '#FB923C', shadow: 'rgba(251, 146, 60, 0.6)' },      // Orange
  { color: '#F472B6', shadow: 'rgba(244, 114, 182, 0.6)' }      // Pink
];

type AnimationPhase = 
  | 'intro'
  | 'we-rotating'
  | 'features'
  | 'finale'
  | 'brand'
  | 'complete';

const rotatingPhrases = [
  { text: 'increase efficiency', color: '#00d4aa' },
  { text: 'reduce costs', color: '#ff375f' }
];

const featureStatements = [
  { 
    text: 'Automate your Month-End', 
    highlights: ['Month-End'], 
    duration: 2000,
    animation: 'slideUp'
  },
  { 
    text: 'Manage your clients better', 
    highlights: ['Manage', 'clients'], 
    duration: 2000,
    animation: 'glideRight'
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
    text: 'Streamline your emails and follow-ups', 
    highlights: ['Streamline', 'emails', 'follow-ups'], 
    duration: 2000,
    animation: 'typeIn'
  },
  { 
    text: 'Automate invoice processing and data entry', 
    highlights: ['invoice', 'processing', 'data', 'entry'], 
    duration: 3000,
    animation: 'zoomIn'
  },
  { 
    text: 'Build end-to-end systems that work without your involvement', 
    highlights: ['Build', 'end-to-end', 'systems', 'work'], 
    duration: 3000,
    animation: 'rotate'
  },
  { 
    text: 'Give your accountants more time for client service', 
    highlights: ['accountants', 'time', 'client service'], 
    duration: 3000,
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
    <span className="inline-flex flex-wrap justify-center gap-x-1.5 md:gap-x-3">
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
    case 'typeIn':
      return {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0, scale: 0.96 }
      };
    case 'zoomIn':
      return {
        initial: { opacity: 0, scale: 0.96 },
        animate: { opacity: 1, scale: 1 },
        exit: { opacity: 0, scale: 0.98 }
      };
    case 'bounce':
      return {
        initial: { opacity: 0, y: -20 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: 15 }
      };
    case 'rotate':
      return {
        initial: { opacity: 0, rotate: -1 },
        animate: { opacity: 1, rotate: 0 },
        exit: { opacity: 0, rotate: 1 }
      };
    default:
      return {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 }
      };
  }
};

interface KineticTypographyProps {
  onComplete?: () => void;
}

export const KineticTypography = ({ onComplete }: KineticTypographyProps) => {
  const [phase, setPhase] = useState<AnimationPhase>('intro');
  const [rotatingIndex, setRotatingIndex] = useState(0);
  const [featureIndex, setFeatureIndex] = useState(0);

  useEffect(() => {
    // SECTION 1: Intro phrase
    if (phase === 'intro') {
      const timer = setTimeout(() => {
        setPhase('we-rotating');
      }, 2200);
      return () => clearTimeout(timer);
    }

    // SECTION 2: "We" + rotating phrases
    if (phase === 'we-rotating') {
      if (rotatingIndex < rotatingPhrases.length - 1) {
        const timer = setTimeout(() => {
          setRotatingIndex(rotatingIndex + 1);
        }, 1600);
        return () => clearTimeout(timer);
      } else {
        const timer = setTimeout(() => {
          setPhase('features');
        }, 1800);
        return () => clearTimeout(timer);
      }
    }

    // SECTION 3: Feature statements
    if (phase === 'features') {
      if (featureIndex < featureStatements.length - 1) {
        const timer = setTimeout(() => {
          setFeatureIndex(featureIndex + 1);
        }, featureStatements[featureIndex].duration);
        return () => clearTimeout(timer);
      } else {
        const timer = setTimeout(() => {
          setPhase('finale');
        }, featureStatements[featureIndex].duration);
        return () => clearTimeout(timer);
      }
    }

    // SECTION 4: Finale
    if (phase === 'finale') {
      const timer = setTimeout(() => {
        setPhase('brand');
      }, 2200);
      return () => clearTimeout(timer);
    }

    // SECTION 5: Brand - stays visible indefinitely
  }, [phase, rotatingIndex, featureIndex, onComplete]);

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      {/* Dark overlay to dim background - persistent throughout */}
      <div className="absolute inset-0 bg-black/40 pointer-events-none" />
      
      <div 
        className="w-full max-w-7xl px-4 md:px-8 lg:px-16 relative z-10"
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
              <h1 className="text-white text-3xl sm:text-4xl md:text-6xl lg:text-7xl xl:text-8xl tracking-tight" style={{ fontWeight: 700 }}>
                <HighlightedText 
                  text="Our solutions automate every part of your business"
                  highlights={['automate', 'every', 'part', 'business']}
                  colorIndex={0}
                />
              </h1>
            </motion.div>
          )}

          {/* SECTION 2: "We" + Rotating Phrases */}
          {phase === 'we-rotating' && (
            <motion.div
              key="we-rotating"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.5, ease: smoothEase }}
              className="text-center w-full px-4"
            >
              <h1 className="text-white text-3xl sm:text-4xl md:text-6xl lg:text-7xl xl:text-8xl tracking-tight inline-flex items-baseline gap-3 sm:gap-4 md:gap-6 whitespace-nowrap" style={{ fontWeight: 700 }}>
                <motion.span 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.6, ease: appleEase }}
                >
                  We
                </motion.span>
                
                <span className="relative inline-block" style={{ minWidth: 'clamp(280px, 40vw, 700px)' }}>
                  <AnimatePresence mode="wait">
                    <motion.span
                      key={rotatingIndex}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ 
                        opacity: 1, 
                        y: 0,
                        transition: {
                          duration: 0.5,
                          ease: appleEase
                        }
                      }}
                      exit={{ 
                        opacity: 0, 
                        y: -20,
                        transition: { duration: 0.4, ease: appleEase }
                      }}
                      className="inline-block whitespace-nowrap"
                    >
                      <motion.span
                        initial={{ color: '#ffffff' }}
                        animate={{ color: rotatingPhrases[rotatingIndex].color }}
                        transition={{ delay: 0.2, duration: 0.5 }}
                      >
                        {rotatingPhrases[rotatingIndex].text}
                      </motion.span>
                    </motion.span>
                  </AnimatePresence>
                </span>
              </h1>
            </motion.div>
          )}

          {/* SECTION 3: Features with varied animations */}
          {phase === 'features' && (
            <motion.div
              key={`feature-${featureIndex}`}
              {...getFeatureAnimation(featureStatements[featureIndex].animation)}
              transition={{
                duration: 0.6,
                ease: appleEase,
                ...(featureStatements[featureIndex].animation === 'bounce' && {
                  type: 'spring',
                  stiffness: 260,
                  damping: 20
                })
              }}
              className="text-center"
            >
              <h2 className="text-white text-2xl sm:text-3xl md:text-5xl lg:text-6xl xl:text-7xl tracking-tight" style={{ fontWeight: 700 }}>
                <HighlightedText 
                  text={featureStatements[featureIndex].text}
                  highlights={featureStatements[featureIndex].highlights}
                  colorIndex={featureIndex}
                />
              </h2>
            </motion.div>
          )}

          {/* SECTION 4: Finale */}
          {phase === 'finale' && (
            <motion.div
              key="finale"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ 
                opacity: 1, 
                scale: 1.01,
                transition: {
                  duration: 1.0,
                  ease: smoothEase
                }
              }}
              exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.6 } }}
              className="text-center px-2"
            >
              <motion.h1 
                className="text-white text-4xl sm:text-5xl md:text-7xl lg:text-8xl xl:text-9xl tracking-tight"
                style={{ fontWeight: 700 }}
                animate={{
                  filter: [
                    'brightness(1) drop-shadow(0 0 0px rgba(255,255,255,0))',
                    'brightness(1.1) drop-shadow(0 0 20px rgba(255,255,255,0.3))',
                    'brightness(1) drop-shadow(0 0 0px rgba(255,255,255,0))'
                  ]
                }}
                transition={{
                  duration: 2,
                  ease: smoothEase,
                  times: [0, 0.5, 1]
                }}
              >
                Accounting made{' '}
                <motion.span
                  className="inline-block"
                  initial={{ color: '#ffffff' }}
                  animate={{ color: '#0071e3' }}
                  transition={{ delay: 0.4, duration: 0.8 }}
                >
                  simple
                </motion.span>
              </motion.h1>
            </motion.div>
          )}

          {/* SECTION 5: Brand - Novalare */}
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
                className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl xl:text-9xl tracking-tight"
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