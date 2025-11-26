"use client";

import { useEffect, useRef, useState } from "react";

interface AnimatedTestimonialProps {
  question: string;
  answer: string;
  delay?: number;
}

export function AnimatedTestimonial({ question, answer, delay = 0 }: AnimatedTestimonialProps) {
  const [scrollProgress, setScrollProgress] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      if (!ref.current) return;

      const rect = ref.current.getBoundingClientRect();
      const windowHeight = window.innerHeight;
      
      // Calculate how far the element is in the viewport
      // 0 = just entering from bottom, 1 = centered, 2 = exiting from top
      const elementCenter = rect.top + rect.height / 2;
      const progress = 1 - (elementCenter - windowHeight / 2) / (windowHeight / 2);
      
      // Clamp between 0 and 1
      const clampedProgress = Math.max(0, Math.min(1, progress));
      setScrollProgress(clampedProgress);
    };

    handleScroll(); // Initial call
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Calculate individual animation values based on scroll progress
  const questionOpacity = Math.max(0, Math.min(1, scrollProgress * 2)) || 0;
  const questionTranslateX = (1 - scrollProgress) * 50 || 0;
  
  const answerOpacity = Math.max(0, Math.min(1, (scrollProgress - 0.2) * 2)) || 0;
  const answerTranslateX = -(1 - scrollProgress) * 50 || 0;
  
  const deliveredOpacity = Math.max(0, Math.min(1, (scrollProgress - 0.4) * 2)) || 0;

  return (
    <div ref={ref} className="space-y-3">
      {/* Question - Blue bubble from right */}
      <div 
        className="flex justify-end"
        style={{
          opacity: questionOpacity,
          transform: `translateX(${questionTranslateX}px)`,
        }}
      >
        <div className="bg-[#007AFF] text-white rounded-[20px] rounded-tr-sm px-5 py-3 max-w-[80%] shadow-lg shadow-blue-500/20">
          <p className="text-sm sm:text-base">{question}</p>
        </div>
      </div>

      {/* Answer - Gray bubble from left */}
      <div 
        className="flex justify-start"
        style={{
          opacity: answerOpacity,
          transform: `translateX(${answerTranslateX}px)`,
        }}
      >
        <div className="bg-gradient-to-br from-gray-700 to-gray-800 text-white rounded-[20px] rounded-tl-sm px-5 py-3 max-w-[80%] shadow-lg">
          <p className="text-sm sm:text-base">{answer}</p>
        </div>
      </div>

      {/* Delivered status */}
      <div 
        className="flex justify-start pl-4"
        style={{
          opacity: deliveredOpacity,
        }}
      >
        <p className="text-xs text-gray-400">Delivered</p>
      </div>
    </div>
  );
}