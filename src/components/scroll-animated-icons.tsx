import { motion, useScroll, useTransform, MotionValue } from "motion/react";
import { Mail, FileText, Settings, Download, Sheet, Bell, LucideIcon } from "lucide-react";
import { RefObject, useState, useEffect, useMemo } from "react";

const icons = [
  { Icon: Mail, color: "#A370FF" },
  { Icon: FileText, color: "#4EA8FF" },
  { Icon: Settings, color: "#3FE3C5" },
  { Icon: Download, color: "#FF6F9E" },
  { Icon: Sheet, color: "#FFCE73" },
  { Icon: Bell, color: "#fb7185" },
];

interface ScrollAnimatedIconsProps {
  containerRef: RefObject<HTMLDivElement>;
  servicesSectionRef: RefObject<HTMLDivElement>;
}

// Pre-compute constants outside component for performance
const DEG_TO_RAD = Math.PI / 180;
const ROTATIONS = 3;

// Separate component for each icon to properly use hooks
interface AnimatedIconProps {
  Icon: LucideIcon;
  color: string;
  index: number;
  scrollYProgress: MotionValue<number>;
  isMobile: boolean;
  config: {
    baseAngle: number;
    centerX: number;
    radius: number;
    startY: number;
    totalVerticalTravel: number;
    helixPitch: number;
    waveAmplitude: number;
    phaseOffset: number;
  };
}

function AnimatedIcon({ Icon, color, index, scrollYProgress, isMobile, config }: AnimatedIconProps) {
  // Simplified opacity - just fade in at start
  const opacity = useTransform(scrollYProgress, [0, 0.1], [0, 0.8]);

  // Optimized X position
  const x = useTransform(scrollYProgress, (progress) => {
    if (isMobile) {
      const easedProgress = progress * progress * (3 - 2 * progress);
      return config.centerX + Math.sin(easedProgress * Math.PI * 5 + config.phaseOffset) * config.waveAmplitude;
    }
    const angle = (config.baseAngle + progress * 360 * ROTATIONS) * DEG_TO_RAD;
    return config.centerX + Math.cos(angle) * config.radius;
  });

  // Optimized Y position
  const y = useTransform(scrollYProgress, (progress) => {
    if (isMobile) {
      const baseY = config.startY + progress * config.totalVerticalTravel;
      const wave = Math.sin(progress * Math.PI * 6 + config.phaseOffset) * 25;
      return baseY + wave;
    }
    const currentAngle = config.baseAngle + progress * 360 * ROTATIONS;
    return config.startY + currentAngle * config.helixPitch;
  });

  // Simplified scale
  const scale = useTransform(scrollYProgress, (progress) => {
    if (isMobile) {
      const pulse = Math.sin(progress * Math.PI * 4) * 0.1;
      return 0.9 + pulse;
    }
    const angle = (config.baseAngle + progress * 360 * ROTATIONS) * DEG_TO_RAD;
    const depth = Math.sin(angle);
    return 0.65 + (depth + 1) * 0.25;
  });

  // Simple rotation
  const rotate = useTransform(scrollYProgress, [0, 1], isMobile ? [0, 360] : [0, 540]);

  return (
    <motion.div
      style={{
        x,
        y,
        scale,
        rotate,
        opacity,
        position: "absolute",
        willChange: "transform, opacity",
      }}
      className="relative"
    >
      {/* Simplified glow */}
      <div
        className="absolute inset-0 blur-lg"
        style={{
          backgroundColor: color,
          opacity: 0.4,
        }}
      />
      
      {/* Icon */}
      <Icon
        size={isMobile ? 56 : 72}
        color={color}
        strokeWidth={1.5}
        className="relative drop-shadow-lg"
      />
    </motion.div>
  );
}

export function ScrollAnimatedIcons({ containerRef, servicesSectionRef }: ScrollAnimatedIconsProps) {
  const [isMobile, setIsMobile] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const updateDimensions = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight
      });
    };
    
    updateDimensions();
    
    let timeoutId: ReturnType<typeof setTimeout>;
    const handleResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(updateDimensions, 100);
    };
    
    window.addEventListener('resize', handleResize, { passive: true });
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timeoutId);
    };
  }, []);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"]
  });

  // Pre-compute static values
  const computedValues = useMemo(() => {
    const totalIcons = isMobile ? 3 : icons.length;
    const centerX = dimensions.width / 2 - 36;
    const radius = Math.min(dimensions.width * 0.25, 350);
    const startY = 0;
    const totalVerticalTravel = dimensions.height * 1.5;
    const helixPitch = totalVerticalTravel / (ROTATIONS * 360);

    return icons.map((_, index) => ({
      baseAngle: index * (360 / totalIcons),
      shouldHide: isMobile && index >= 3,
      centerX,
      radius,
      startY,
      totalVerticalTravel,
      helixPitch,
      waveAmplitude: dimensions.width * 0.2,
      phaseOffset: (index * Math.PI * 2 / totalIcons),
    }));
  }, [isMobile, dimensions]);

  // Don't render until dimensions are set
  if (dimensions.width === 0) return null;

  return (
    <div 
      className="fixed inset-0 pointer-events-none overflow-hidden" 
      style={{ zIndex: 1 }}
    >
      {icons.map((item, index) => {
        const config = computedValues[index];
        
        if (config.shouldHide) return null;

        return (
          <AnimatedIcon
            key={index}
            Icon={item.Icon}
            color={item.color}
            index={index}
            scrollYProgress={scrollYProgress}
            isMobile={isMobile}
            config={config}
          />
        );
      })}
    </div>
  );
}
