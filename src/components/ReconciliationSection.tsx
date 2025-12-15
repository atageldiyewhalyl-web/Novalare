import { motion, useInView } from "motion/react";
import { useRef, useState, useEffect } from "react";

interface ConnectionLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  delay: number;
}

export function ReconciliationSection() {
  const sectionRef = useRef(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(sectionRef, { once: false, amount: 0.3 });
  const [lines, setLines] = useState<ConnectionLine[]>([]);

  // Transaction data for animation
  const ledgerTransactions = [
    { id: 1, amount: "$2,500", label: "Office Supplies", type: "exact", matchTo: [0], matchNum: 1 },
    { id: 2, amount: "$1,200", label: "Software License", type: "exact", matchTo: [1], matchNum: 2 },
    { id: 3, amount: "$850", label: "Equipment", type: "one-to-many", matchTo: [2], matchNum: 3 },
    { id: 4, amount: "$450", label: "Equipment", type: "one-to-many", matchTo: [2], matchNum: 3 },
    { id: 5, amount: "€3,200", label: "Consulting", type: "fx", matchTo: [3], matchNum: 4 },
    { id: 6, amount: "$5,100", label: "Marketing", type: "many-to-one", matchTo: [4, 5], matchNum: 5 },
  ];

  const bankTransactions = [
    { id: 1, amount: "$2,500", label: "Office Depot", type: "exact", matchNum: 1 },
    { id: 2, amount: "$1,200", label: "Adobe", type: "exact", matchNum: 2 },
    { id: 3, amount: "$1,300", label: "Equipment Purchase", type: "many-to-one", matchNum: 3 },
    { id: 4, amount: "$3,840", label: "EU Consulting", type: "fx", matchNum: 4 },
    { id: 5, amount: "$2,000", label: "Meta Ads", type: "one-to-many", matchNum: 5 },
    { id: 6, amount: "$3,100", label: "Google Ads", type: "one-to-many", matchNum: 5 },
  ];

  // Helper function to get color for transaction type
  const getMatchColor = (type: string) => {
    switch(type) {
      case "exact": return "#3b82f6";
      case "fx": return "#a855f7";
      case "one-to-many": return "#06b6d4";
      case "many-to-one": return "#8b5cf6";
      default: return "#3b82f6";
    }
  };

  useEffect(() => {
    if (!containerRef.current || !isInView) {
      setLines([]);
      return;
    }

    const updateLines = () => {
      const container = containerRef.current;
      if (!container) return;

      const ledgerCards = container.querySelectorAll('[data-ledger-index]');
      const bankCards = container.querySelectorAll('[data-bank-index]');

      const newLines: ConnectionLine[] = [];

      ledgerTransactions.forEach((transaction, ledgerIndex) => {
        transaction.matchTo.forEach((bankIndex, matchIndex) => {
          const ledgerCard = ledgerCards[ledgerIndex] as HTMLElement;
          const bankCard = bankCards[bankIndex] as HTMLElement;

          if (ledgerCard && bankCard) {
            const ledgerRect = ledgerCard.getBoundingClientRect();
            const bankRect = bankCard.getBoundingClientRect();
            const containerRect = container.getBoundingClientRect();

            // Start point: right edge of ledger card, centered vertically
            const x1 = ledgerRect.right - containerRect.left;
            const y1 = ledgerRect.top + ledgerRect.height / 2 - containerRect.top;
            
            // End point: left edge of bank card, centered vertically
            const x2 = bankRect.left - containerRect.left;
            const y2 = bankRect.top + bankRect.height / 2 - containerRect.top;

            const getColor = (type: string) => {
              switch(type) {
                case "exact": return "#3b82f6";
                case "fx": return "#a855f7";
                case "one-to-many": return "#06b6d4";
                case "many-to-one": return "#8b5cf6";
                default: return "#3b82f6";
              }
            };

            newLines.push({
              x1,
              y1,
              x2,
              y2,
              color: getColor(transaction.type),
              delay: ledgerIndex * 0.3 + matchIndex * 0.15
            });
          }
        });
      });

      setLines(newLines);
    };

    // Initial update with slight delay for element rendering
    const timeout = setTimeout(updateLines, 100);
    
    // Update on resize
    window.addEventListener('resize', updateLines);
    
    // Update on scroll to handle position changes
    window.addEventListener('scroll', updateLines);

    return () => {
      clearTimeout(timeout);
      window.removeEventListener('resize', updateLines);
      window.removeEventListener('scroll', updateLines);
    };
  }, [isInView]);

  return (
    <section
      ref={sectionRef}
      className="relative min-h-screen bg-black flex flex-col items-center justify-center px-4 md:px-6 py-16 md:py-20"
    >
      <div className="relative z-10 max-w-7xl mx-auto w-full">
        {/* Main headline */}
        <div className="text-center mb-8 md:mb-12 lg:mb-20">
          <h1 className="text-3xl sm:text-4xl md:text-6xl lg:text-8xl font-bold text-white mb-4 md:mb-4 lg:mb-6 tracking-tight leading-tight sm:leading-tight md:leading-[1.1]">
            Reconciliation
            <br />
            in seconds
          </h1>
          <p className="text-sm sm:text-base md:text-xl lg:text-2xl text-gray-400 max-w-3xl mx-auto leading-relaxed px-4 md:px-0">
            Automatically match internal ledgers and bank statements instantly.
          </p>
          <p className="text-sm sm:text-base md:text-xl lg:text-2xl text-gray-400 max-w-3xl mx-auto leading-relaxed px-4 md:px-0 mt-2">
            Exact matches, one-to-many, FX transactions, and time differences—all handled.
          </p>
        </div>

        {/* Main matching visualization */}
        <div ref={containerRef} className="relative max-w-6xl mx-auto">
          {/* MOBILE: Stacked list with color-coded matches */}
          <div className="md:hidden space-y-8">
            {/* Group transactions by match number - Show only 1, 3, 4, 5 on mobile (skip second Direct Match) */}
            {[1, 3, 4, 5].map((matchNum) => {
              const ledgerItems = ledgerTransactions.filter(t => t.matchNum === matchNum);
              const bankItems = bankTransactions.filter(t => t.matchNum === matchNum);
              const matchType = ledgerItems[0]?.type || 'exact';
              const matchColor = getMatchColor(matchType);
              
              return (
                <div key={matchNum} className="relative">
                  {/* Match indicator */}
                  <div className="flex items-center gap-3 mb-4">
                    <div 
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold shadow-lg"
                      style={{ backgroundColor: matchColor }}
                    >
                      {matchNum}
                    </div>
                    <div>
                      <p className="text-white font-semibold text-sm">
                        {matchType === "exact" && "Direct Match"}
                        {matchType === "one-to-many" && "Split Transaction"}
                        {matchType === "many-to-one" && "Combined Entry"}
                        {matchType === "fx" && "Currency Conversion"}
                      </p>
                      <p className="text-gray-500 text-xs">
                        {ledgerItems.length} ledger → {bankItems.length} bank
                      </p>
                    </div>
                  </div>

                  {/* Ledger items */}
                  <div className="mb-3">
                    <p className="text-purple-400 text-xs font-semibold mb-2 uppercase tracking-wide">From Ledger</p>
                    <div className="space-y-2">
                      {ledgerItems.map((transaction) => (
                        <div
                          key={transaction.id}
                          className="bg-gradient-to-r from-gray-900/90 to-gray-800/90 border rounded-xl px-4 py-3 flex items-center justify-between backdrop-blur-sm"
                          style={{ borderColor: `${matchColor}40` }}
                        >
                          <div className="flex-1 min-w-0 pr-3">
                            <p className="text-white font-medium text-sm">{transaction.label}</p>
                            <p className="text-gray-500 text-xs mt-0.5">
                              {transaction.type === "exact" && "Exact match"}
                              {transaction.type === "one-to-many" && "Part of split"}
                              {transaction.type === "many-to-one" && "Combined entry"}
                              {transaction.type === "fx" && "FX transaction"}
                            </p>
                          </div>
                          <div className="text-white font-semibold text-sm">{transaction.amount}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Visual connector arrow */}
                  <div className="flex justify-center my-2">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                      <path 
                        d="M12 5v14m0 0l-4-4m4 4l4-4" 
                        stroke={matchColor} 
                        strokeWidth="2" 
                        strokeLinecap="round" 
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>

                  {/* Bank items */}
                  <div>
                    <p className="text-cyan-400 text-xs font-semibold mb-2 uppercase tracking-wide">Matched To Bank</p>
                    <div className="space-y-2">
                      {bankItems.map((transaction) => (
                        <div
                          key={transaction.id}
                          className="bg-gradient-to-r from-gray-800/90 to-gray-900/90 border rounded-xl px-4 py-3 flex items-center justify-between backdrop-blur-sm"
                          style={{ borderColor: `${matchColor}40` }}
                        >
                          <div className="flex-1 min-w-0 pr-3">
                            <p className="text-white font-medium text-sm">{transaction.label}</p>
                            <p className="text-gray-500 text-xs mt-0.5">
                              {transaction.type === "exact" && "Direct match"}
                              {transaction.type === "one-to-many" && "Receives split"}
                              {transaction.type === "many-to-one" && "Multiple sources"}
                              {transaction.type === "fx" && "Currency converted"}
                            </p>
                          </div>
                          <div className="text-white font-semibold text-sm">{transaction.amount}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* DESKTOP: Side-by-side with connecting lines */}
          <div className="hidden md:grid grid-cols-2 gap-16 lg:gap-24 relative">
            {/* Left side - Internal Ledger */}
            <div>
              <div className="mb-6 lg:mb-8">
                <h3 className="text-xl md:text-2xl font-semibold text-white mb-2">Internal Ledger</h3>
                <p className="text-gray-500 text-sm">Your accounting records</p>
              </div>
              
              <div className="space-y-3">
                {ledgerTransactions.map((transaction, index) => (
                  <div
                    key={transaction.id}
                    data-ledger-index={index}
                    className="relative"
                  >
                    <div className="bg-gradient-to-r from-gray-900/80 to-gray-800/80 border border-gray-700/50 rounded-xl px-5 py-4 flex items-center justify-between backdrop-blur-sm">
                      <div className="flex-1 min-w-0 pr-3">
                        <p className="text-white font-medium text-base truncate">{transaction.label}</p>
                        <p className="text-gray-500 text-xs mt-1 leading-tight">
                          {transaction.type === "exact" && "Exact match"}
                          {transaction.type === "one-to-many" && "Part of split"}
                          {transaction.type === "many-to-one" && "Combined entry"}
                          {transaction.type === "fx" && "FX transaction"}
                        </p>
                      </div>
                      <div className="text-white font-semibold text-lg flex-shrink-0">{transaction.amount}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right side - Bank Statement */}
            <div>
              <div className="mb-6 lg:mb-8">
                <h3 className="text-xl md:text-2xl font-semibold text-white mb-2">Bank Statement</h3>
                <p className="text-gray-500 text-sm">External transactions</p>
              </div>
              
              <div className="space-y-3">
                {bankTransactions.map((transaction, index) => (
                  <div
                    key={transaction.id}
                    data-bank-index={index}
                    className="relative"
                  >
                    <div className="bg-gradient-to-r from-gray-800/80 to-gray-900/80 border border-gray-700/50 rounded-xl px-5 py-4 flex items-center justify-between backdrop-blur-sm">
                      <div className="flex-1 min-w-0 pr-3">
                        <p className="text-white font-medium text-base truncate">{transaction.label}</p>
                        <p className="text-gray-500 text-xs mt-1 leading-tight">
                          {transaction.type === "exact" && "Direct match"}
                          {transaction.type === "one-to-many" && "Receives split"}
                          {transaction.type === "many-to-one" && "Multiple sources"}
                          {transaction.type === "fx" && "Currency converted"}
                        </p>
                      </div>
                      <div className="text-white font-semibold text-lg flex-shrink-0">{transaction.amount}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Connecting lines - SVG overlay (DESKTOP ONLY) */}
          <svg
            className="hidden md:block absolute inset-0 w-full h-full pointer-events-none"
            style={{ top: 0, left: 0 }}
          >
            {lines.map((line, index) => {
              // Detect if we're on mobile (single column layout)
              const isMobile = window.innerWidth < 768;
              
              if (isMobile) {
                // Mobile: Vertical connection from ledger to bank (bottom to top of next section)
                const ledgerBottom = line.y1;
                const bankTop = line.y2;
                
                // Calculate center X position of the container
                const centerX = line.x1 / 2;
                
                // Vertical path with slight curve
                const path = `M ${centerX} ${ledgerBottom} L ${centerX} ${bankTop}`;
                
                return (
                  <g key={index}>
                    {/* Connection point at ledger bottom */}
                    <motion.circle
                      cx={centerX}
                      cy={ledgerBottom}
                      r="3"
                      fill={line.color}
                      initial={{ opacity: 0, scale: 0 }}
                      animate={{ 
                        opacity: [0, 1, 0],
                        scale: [0, 1, 0]
                      }}
                      transition={{ 
                        duration: 2,
                        delay: line.delay + 1,
                        ease: "easeInOut",
                        repeat: Infinity,
                        repeatDelay: 3,
                      }}
                    />
                    
                    {/* Connection point at bank top */}
                    <motion.circle
                      cx={centerX}
                      cy={bankTop}
                      r="3"
                      fill={line.color}
                      initial={{ opacity: 0, scale: 0 }}
                      animate={{ 
                        opacity: [0, 0, 1, 0],
                        scale: [0, 0, 1, 0]
                      }}
                      transition={{ 
                        duration: 2,
                        delay: line.delay + 1,
                        ease: "easeInOut",
                        repeat: Infinity,
                        repeatDelay: 3,
                        times: [0, 0.3, 0.7, 1]
                      }}
                    />
                    
                    {/* Animated vertical line */}
                    <motion.path
                      d={path}
                      stroke={line.color}
                      strokeWidth="2"
                      fill="none"
                      initial={{ pathLength: 0, opacity: 0 }}
                      animate={{ 
                        pathLength: [0, 1],
                        opacity: [0, 0.7, 0],
                      }}
                      transition={{ 
                        duration: 2,
                        delay: line.delay + 1,
                        ease: "easeInOut",
                        repeat: Infinity,
                        repeatDelay: 3,
                        times: [0, 0.6, 1]
                      }}
                    />
                  </g>
                );
              }
              
              // Desktop: Horizontal connection (original code)
              const yDiff = Math.abs(line.y2 - line.y1);
              const isNearlyHorizontal = yDiff < 5;
              
              // Adjust line start and end to match dot positions (outside the cards)
              const lineStartX = line.x1 + 8;
              const lineEndX = line.x2 - 8;
              
              let path;
              if (isNearlyHorizontal) {
                // For horizontal lines, use a very subtle curve
                const midX = (lineStartX + lineEndX) / 2;
                const curveAmount = 10; // Small vertical offset for visual interest
                path = `M ${lineStartX} ${line.y1} Q ${midX} ${line.y1 - curveAmount}, ${lineEndX} ${line.y2}`;
              } else {
                // For angled lines, use cubic bezier
                const controlPointOffset = (lineEndX - lineStartX) * 0.5;
                path = `M ${lineStartX} ${line.y1} C ${lineStartX + controlPointOffset} ${line.y1}, ${lineEndX - controlPointOffset} ${line.y2}, ${lineEndX} ${line.y2}`;
              }

              return (
                <g key={index}>
                  {/* Connection point at start - positioned outside ledger card */}
                  <motion.circle
                    cx={lineStartX}
                    cy={line.y1}
                    r="4"
                    fill={line.color}
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ 
                      opacity: [0, 1, 0],
                      scale: [0, 1, 0]
                    }}
                    transition={{ 
                      duration: 2,
                      delay: line.delay + 1,
                      ease: "easeInOut",
                      repeat: Infinity,
                      repeatDelay: 3,
                    }}
                  />
                  
                  {/* Connection point at end - positioned outside bank card */}
                  <motion.circle
                    cx={lineEndX}
                    cy={line.y2}
                    r="4"
                    fill={line.color}
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ 
                      opacity: [0, 0, 1, 0],
                      scale: [0, 0, 1, 0]
                    }}
                    transition={{ 
                      duration: 2,
                      delay: line.delay + 1,
                      ease: "easeInOut",
                      repeat: Infinity,
                      repeatDelay: 3,
                      times: [0, 0.3, 0.7, 1]
                    }}
                  />
                  
                  {/* Animated line - connects the dots */}
                  <motion.path
                    d={path}
                    stroke={line.color}
                    strokeWidth="2"
                    fill="none"
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ 
                      pathLength: [0, 1],
                      opacity: [0, 0.7, 0],
                    }}
                    transition={{ 
                      duration: 2,
                      delay: line.delay + 1,
                      ease: "easeInOut",
                      repeat: Infinity,
                      repeatDelay: 3,
                      times: [0, 0.6, 1]
                    }}
                  />
                </g>
              );
            })}
          </svg>
        </div>
      </div>
    </section>
  );
}