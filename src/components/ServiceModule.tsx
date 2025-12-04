import { LucideIcon } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";

interface ServiceModuleProps {
  icon: LucideIcon;
  heading: string;
  description: string;
  glowColor: string;
  hideIcon?: boolean;
  index?: number;
}

export function ServiceModule({ 
  icon: Icon, 
  heading, 
  description, 
  glowColor,
  hideIcon = false,
  index = 0
}: ServiceModuleProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.div 
      className="relative w-full max-w-[680px] mx-auto h-full" 
      style={{ zIndex: 1 }}
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ 
        duration: 0.5, 
        delay: index * 0.08,
        ease: [0.22, 1, 0.36, 1]
      }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
    >
      {/* White card with clean aesthetic */}
      <motion.div 
        className="relative rounded-3xl p-8 md:p-10 lg:p-12 h-full flex flex-col bg-white"
        animate={{
          scale: isHovered ? 1.02 : 1,
          y: isHovered ? -6 : 0,
        }}
        transition={{ 
          duration: 0.4, 
          ease: [0.22, 1, 0.36, 1]
        }}
        style={{
          border: '1px solid rgba(0, 0, 0, 0.06)',
          boxShadow: isHovered 
            ? '0 24px 64px rgba(0, 0, 0, 0.08), 0 8px 24px rgba(0, 0, 0, 0.04)' 
            : '0 8px 32px rgba(0, 0, 0, 0.04), 0 2px 8px rgba(0, 0, 0, 0.02)',
        }}
      >
        {/* Icon and Heading - Horizontally aligned */}
        <div className="flex items-center gap-4 mb-5 md:mb-6">
          {/* Icon - minimalist with color */}
          {!hideIcon && (
            <motion.div
              className="flex-shrink-0"
              animate={{
                rotate: isHovered ? 5 : 0,
                scale: isHovered ? 1.05 : 1,
              }}
              transition={{ duration: 0.3 }}
            >
              <div
                style={{
                  color: glowColor,
                }}
              >
                <Icon 
                  size={28}
                  strokeWidth={1.5}
                />
              </div>
            </motion.div>
          )}
          
          {/* Heading - aligned with icon */}
          <motion.h3 
            className="flex-1"
            animate={{
              color: isHovered ? '#111827' : '#1f2937',
            }}
            transition={{ duration: 0.3 }}
            style={{ 
              fontSize: 'clamp(18px, 4vw, 24px)',
              fontWeight: '600',
              fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif',
              letterSpacing: '-0.02em',
              lineHeight: '1.2',
            }}
          >
            {heading}
          </motion.h3>
        </div>

        {/* Description - clean and readable */}
        <motion.p 
          className="leading-relaxed"
          animate={{
            color: isHovered ? '#4b5563' : '#6b7280',
          }}
          transition={{ duration: 0.3 }}
          style={{ 
            fontSize: 'clamp(14px, 3.5vw, 16px)',
            fontWeight: '400',
            fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif',
            lineHeight: '1.6',
          }}
        >
          {description}
        </motion.p>
      </motion.div>
    </motion.div>
  );
}