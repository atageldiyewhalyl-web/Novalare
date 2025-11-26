import { motion, useScroll, useTransform } from "motion/react";
import { Mail, FileText, Settings, Download, Sheet, Bell } from "lucide-react";
import { RefObject, useState, useEffect } from "react";

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

export function ScrollAnimatedIcons({ containerRef, servicesSectionRef }: ScrollAnimatedIconsProps) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"]
  });

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 1 }}>
      {icons.map((item, index) => {
        const { Icon, color } = item;

        // Hide icons 3-5 on mobile (only show first 3)
        const shouldHide = isMobile && index >= 3;

        // Each icon has an offset angle for spiral effect
        // Use total icon count for proper spacing
        const totalIcons = isMobile ? 3 : icons.length;
        const baseAngle = index * (360 / totalIcons);

        // Fade in at the start
        const opacity = useTransform(scrollYProgress, [0, 0.1, 0.9, 1], [0, 1, 1, 0]);

        // CIRCULAR SPIRAL - X position
        const x = useTransform(scrollYProgress, (progress) => {
          const centerX = window.innerWidth / 2 - 36;
          const radius = Math.min(window.innerWidth * 0.25, 350);
          
          if (isMobile) {
            // MOBILE: Enhanced figure-8 pattern with easing
            const waveAmplitude = window.innerWidth * 0.2; // Slightly larger radius
            const waveFrequency = 2.5; // Smooth flowing waves
            const phaseOffset = (index * Math.PI * 2 / totalIcons);
            
            // Add some easing for more organic movement
            const easedProgress = progress < 0.5 
              ? 2 * progress * progress 
              : 1 - Math.pow(-2 * progress + 2, 2) / 2;
            
            return centerX + Math.sin(easedProgress * Math.PI * 2 * waveFrequency + phaseOffset) * waveAmplitude;
          }
          
          // DESKTOP: Complex helix pattern
          const rotations = 4; // Number of full rotations as you scroll down
          const currentAngle = baseAngle + (progress * 360 * rotations);
          const angleRad = (currentAngle * Math.PI) / 180;
          
          // X follows circular path (horizontal circle)
          return centerX + Math.cos(angleRad) * radius;
        });

        // DNA HELIX - Y position (vertical descent with elliptical motion)
        const y = useTransform(scrollYProgress, (progress) => {
          const startY = window.innerHeight * 0; // Start at very top of viewport
          const totalVerticalTravel = window.innerHeight * 1.5; // Total distance to travel
          
          if (isMobile) {
            // MOBILE: Add gentle vertical wave for floating effect
            const verticalWaveAmplitude = 30; // Subtle bounce
            const verticalWaveFrequency = 3;
            const phaseOffset = (index * Math.PI * 0.5); // Different phase per icon
            
            const baseY = startY + (progress * totalVerticalTravel);
            const wave = Math.sin(progress * Math.PI * 2 * verticalWaveFrequency + phaseOffset) * verticalWaveAmplitude;
            
            return baseY + wave;
          }
          
          // DESKTOP: Complex helix with pitch
          const rotations = 4; // Match the X rotation speed
          const currentAngle = baseAngle + (progress * 360 * rotations);
          
          // HELIX = Circular motion (X) + Linear forward motion (Y)
          // The Y position increases continuously based on the angle
          // This creates the spiral staircase effect
          const helixPitch = totalVerticalTravel / (rotations * 360); // Vertical distance per degree
          const verticalPosition = startY + (currentAngle * helixPitch);
          
          // Continuous linear descent tied to rotation angle - TRUE HELIX!
          return verticalPosition;
        });

        // 3D DEPTH - Scale based on Z-depth in helix
        const scale = useTransform(scrollYProgress, (progress) => {
          if (isMobile) {
            // MOBILE: Add subtle breathing/pulsing effect
            const pulseFrequency = 2 + (index * 0.3); // Each icon pulses at slightly different rate
            const pulseAmount = 0.12; // Subtle scale change
            
            const pulse = Math.sin(progress * Math.PI * 2 * pulseFrequency) * pulseAmount;
            return 0.95 + pulse; // Range: 0.83 to 1.07
          }
          
          // DESKTOP: Dynamic scale based on helix depth
          const rotations = 4; // Match the rotation speed
          const currentAngle = baseAngle + (progress * 360 * rotations);
          const angleRad = (currentAngle * Math.PI) / 180;
          
          // Z-depth simulation: sin gives us the front/back position
          // When sin(angle) = 0, icon is at center depth
          // When sin(angle) = 1, icon is closest to viewer (front)
          // When sin(angle) = -1, icon is farthest from viewer (back)
          const depth = Math.sin(angleRad);
          
          // Larger when close, smaller when far
          return 0.6 + (depth + 1) * 0.3; // Range: 0.6 to 1.2
        });

        // 3D DEPTH - Opacity based on depth (dimmer when farther away)
        const depthOpacity = useTransform(scrollYProgress, (progress) => {
          if (isMobile) {
            // MOBILE: Add gentle opacity pulse for shimmer effect
            const pulseFrequency = 1.5 + (index * 0.2);
            const pulseAmount = 0.15; // Subtle opacity change
            
            const pulse = Math.sin(progress * Math.PI * 2 * pulseFrequency) * pulseAmount;
            return 0.75 + pulse; // Range: 0.6 to 0.9
          }
          
          // DESKTOP: Dynamic opacity based on depth
          const rotations = 4; // Match the rotation speed
          const currentAngle = baseAngle + (progress * 360 * rotations);
          const angleRad = (currentAngle * Math.PI) / 180;
          
          const depth = Math.sin(angleRad);
          
          // Icons in front are brighter, icons in back are dimmer
          return 0.3 + (depth + 1) * 0.35; // Range: 0.3 to 1.0
        });

        // Combine with fade in/out opacity
        const combinedOpacity = useTransform(
          [scrollYProgress, depthOpacity],
          ([progress, depth]) => {
            // Hide this icon completely on mobile if index >= 3
            if (shouldHide) {
              return 0;
            }
            
            // Fade in at start only, no fade out
            let fadeOpacity = 1;
            if (progress < 0.1) {
              fadeOpacity = progress / 0.1;
            }
            return fadeOpacity * depth;
          }
        );

        // 3D DEPTH - Subtle blur for distance
        const blur = useTransform(scrollYProgress, (progress) => {
          if (isMobile) {
            // MOBILE: No blur effect
            return 0;
          }
          
          // DESKTOP: Dynamic blur based on depth
          const rotations = 4; // Match the rotation speed
          const currentAngle = baseAngle + (progress * 360 * rotations);
          const angleRad = (currentAngle * Math.PI) / 180;
          
          const depth = Math.sin(angleRad);
          
          // More blur when farther away (negative depth)
          const blurAmount = depth < 0 ? Math.abs(depth) * 2 : 0;
          
          return blurAmount;
        });

        // Icon rotation for added effect
        const rotate = useTransform(scrollYProgress, [0, 1], isMobile ? [0, 360] : [0, 720]);

        return (
          <motion.div
            key={index}
            style={{
              x,
              y,
              scale,
              rotate,
              opacity: combinedOpacity,
              filter: useTransform(blur, (b) => `blur(${b}px)`),
              position: "absolute",
            }}
            className="relative"
          >
            {/* Glow effect */}
            <div
              className="absolute inset-0 blur-xl"
              style={{
                backgroundColor: color,
                opacity: 0.6,
              }}
            />
            
            {/* Icon */}
            <Icon
              size={72}
              color={color}
              strokeWidth={1.5}
              className="relative drop-shadow-2xl"
            />
          </motion.div>
        );
      })}
    </div>
  );
}