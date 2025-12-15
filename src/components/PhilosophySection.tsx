import { motion, useScroll, useTransform } from "motion/react";
import { useRef, useState, useEffect } from "react";
import { Zap, Rocket, Globe } from "lucide-react";

interface Statement {
  id: number;
  title: string;
  text: string;
  icon: React.ReactNode;
  gradient: string;
}

const statements: Statement[] = [
  {
    id: 1,
    title: "Built for Speed",
    text: "Every second counts in accounting. We built Novalare to eliminate waiting — from document processing to data extraction, everything happens instantly.",
    icon: <Zap className="w-full h-full" />,
    gradient: "from-purple-500 via-violet-500 to-blue-500",
  },
  {
    id: 2,
    title: "Designed for Month-End",
    text: "Month-end is where accounting pressure peaks. Novalare brings structure, visibility, and control to close — so nothing slips through, and nothing gets guessed.",
    icon: <Globe className="w-full h-full" />,
    gradient: "from-orange-500 via-red-500 to-pink-500",
  },
  {
    id: 3,
    title: "Human + AI",
    text: "We don't replace accountants. We supercharge them. The future isn't AI vs humans — it's brilliant people amplified by intelligent automation.",
    icon: <Rocket className="w-full h-full" />,
    gradient: "from-blue-500 via-cyan-500 to-teal-500",
  },
];

export const PhilosophySection = () => {
  return (
    <section
      className="relative w-full px-4 md:px-6 lg:px-8 py-20 md:py-32 lg:py-40 xl:py-48"
      style={{ zIndex: 1 }}
    >
      {/* Gradient background orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div 
          className="absolute top-1/4 left-1/4 w-64 h-64 md:w-96 md:h-96 rounded-full opacity-20 blur-3xl"
          style={{
            background: 'radial-gradient(circle, rgba(147, 51, 234, 0.4) 0%, transparent 70%)'
          }}
        />
        <div 
          className="absolute bottom-1/4 right-1/4 w-64 h-64 md:w-96 md:h-96 rounded-full opacity-20 blur-3xl"
          style={{
            background: 'radial-gradient(circle, rgba(249, 115, 22, 0.4) 0%, transparent 70%)'
          }}
        />
      </div>

      <div className="relative max-w-6xl mx-auto w-full">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-12 md:mb-20 lg:mb-28"
        >
          <h2
            className="text-white mb-3 md:mb-4"
            style={{
              fontSize: 'clamp(32px, 7vw, 72px)',
              fontWeight: '800',
              fontFamily: "'Outfit', sans-serif",
              letterSpacing: '-0.04em',
              lineHeight: '1.05',
            }}
          >
            What Drives Us
          </h2>
          <p
            className="text-white/60 max-w-2xl mx-auto"
            style={{
              fontSize: 'clamp(14px, 2vw, 20px)',
              fontWeight: '500',
              fontFamily: "'Manrope', sans-serif",
              lineHeight: '1.6'
            }}
          >
            Three principles that shape everything we build
          </p>
        </motion.div>

        {/* Statements Grid */}
        <div className="space-y-12 md:space-y-16">
          {statements.map((statement, index) => (
            <StatementCard key={statement.id} statement={statement} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
};

interface StatementCardProps {
  statement: Statement;
  index: number;
}

const StatementCard = ({ statement, index }: StatementCardProps) => {
  const ref = useRef<HTMLDivElement>(null);
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
    target: ref,
    offset: ["start end", "end start"]
  });

  // Simplified: Just a gentle fade-in, no horizontal movement
  const opacity = useTransform(
    scrollYProgress, 
    [0, 0.3, 1], 
    [0, 1, 1]
  );

  return (
    <motion.div
      ref={ref}
      style={{ opacity }}
      className="relative"
    >
      <div className={`flex flex-col ${index % 2 === 0 ? 'md:flex-row' : 'md:flex-row-reverse'} items-center gap-8 md:gap-12`}>
        {/* Icon with gradient - Simplified: just fade in with subtle scale */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          viewport={{ once: true }}
          className="relative flex-shrink-0"
        >
          <div 
            className={`w-24 h-24 md:w-32 md:h-32 rounded-2xl bg-gradient-to-br ${statement.gradient} p-6 md:p-8 shadow-2xl`}
            style={{
              boxShadow: `0 20px 60px -15px ${statement.gradient.includes('purple') ? 'rgba(147, 51, 234, 0.5)' : statement.gradient.includes('orange') ? 'rgba(249, 115, 22, 0.5)' : 'rgba(59, 130, 246, 0.5)'}`
            }}
          >
            <div className="text-white">
              {statement.icon}
            </div>
          </div>
        </motion.div>

        {/* Content - Simplified: just fade in with minimal movement */}
        <div className="flex-1 text-center md:text-left">
          <motion.h3
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            viewport={{ once: true }}
            className="text-white mb-4"
            style={{
              fontSize: 'clamp(28px, 5vw, 48px)',
              fontWeight: '800',
              fontFamily: "'Outfit', sans-serif",
              letterSpacing: '-0.03em',
              lineHeight: '1.1',
            }}
          >
            {statement.title}
          </motion.h3>
          
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            viewport={{ once: true }}
            className="text-white/70"
            style={{
              fontSize: 'clamp(16px, 2vw, 20px)',
              fontWeight: '500',
              fontFamily: "'Manrope', sans-serif",
              lineHeight: '1.7',
            }}
          >
            {statement.text}
          </motion.p>

          {/* Gradient accent bar - Simplified */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className={`mt-6 h-1 rounded-full bg-gradient-to-r ${statement.gradient}`}
            style={{ 
              width: 'clamp(80px, 20%, 150px)',
              marginLeft: index % 2 === 0 && window.innerWidth >= 768 ? '0' : 'auto',
              marginRight: index % 2 !== 0 && window.innerWidth >= 768 ? '0' : 'auto',
            }}
          />
        </div>
      </div>
    </motion.div>
  );
};