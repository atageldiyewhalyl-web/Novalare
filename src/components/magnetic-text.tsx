import { motion, useMotionValue, useSpring, useTransform } from "motion/react";
import { useRef, useState, MouseEvent } from "react";

interface MagneticTextProps {
  text: string;
  className?: string;
  magnetStrength?: number;
  isGradient?: boolean;
}

export function MagneticText({ 
  text, 
  className = "", 
  magnetStrength = 0.2,
  isGradient = false 
}: MagneticTextProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const handleMouseMove = (e: MouseEvent<HTMLSpanElement>) => {
    if (!ref.current) return;
    
    const rect = ref.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    mouseX.set(e.clientX - centerX);
    mouseY.set(e.clientY - centerY);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    mouseX.set(0);
    mouseY.set(0);
  };

  return (
    <span
      ref={ref}
      className="inline-block"
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={handleMouseLeave}
    >
      {text.split("").map((char, index) => (
        <MagneticChar
          key={index}
          char={char}
          mouseX={mouseX}
          mouseY={mouseY}
          magnetStrength={magnetStrength}
          isHovered={isHovered}
          isGradient={isGradient}
          className={className}
        />
      ))}
    </span>
  );
}

interface MagneticCharProps {
  char: string;
  mouseX: any;
  mouseY: any;
  magnetStrength: number;
  isHovered: boolean;
  isGradient: boolean;
  className: string;
}

function MagneticChar({ 
  char, 
  mouseX, 
  mouseY, 
  magnetStrength,
  isHovered,
  isGradient,
  className
}: MagneticCharProps) {
  const ref = useRef<HTMLSpanElement>(null);
  
  const distance = useMotionValue(0);
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const springConfig = { damping: 20, stiffness: 150, mass: 0.1 };
  const springX = useSpring(x, springConfig);
  const springY = useSpring(y, springConfig);

  const handleMouseMove = () => {
    if (!ref.current) return;
    
    const rect = ref.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    const dx = mouseX.get();
    const dy = mouseY.get();
    
    // Calculate distance from mouse to character
    const charDx = dx - (centerX - rect.left - rect.width / 2);
    const charDy = dy - (centerY - rect.top - rect.height / 2);
    const dist = Math.sqrt(charDx * charDx + charDy * charDy);
    
    distance.set(dist);
    
    if (isHovered && dist < 200) {
      const force = (200 - dist) / 200;
      x.set(charDx * magnetStrength * force);
      y.set(charDy * magnetStrength * force);
    } else {
      x.set(0);
      y.set(0);
    }
  };

  // Update position when mouse moves
  mouseX.on("change", handleMouseMove);
  mouseY.on("change", handleMouseMove);

  const gradientGlow = useTransform(
    distance,
    [200, 0],
    [
      "brightness(1) drop-shadow(0 0 20px rgba(16, 185, 129, 0.3))",
      "brightness(1.5) drop-shadow(0 0 40px rgba(16, 185, 129, 1))"
    ]
  );

  return (
    <motion.span
      ref={ref}
      style={{
        display: "inline-block",
        x: springX,
        y: springY,
        filter: isGradient ? gradientGlow : undefined,
      }}
      className={char === " " ? "w-[0.3em]" : className}
    >
      {char === " " ? "\u00A0" : char}
    </motion.span>
  );
}