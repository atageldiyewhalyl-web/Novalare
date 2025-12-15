import { motion, useInView, AnimatePresence } from "motion/react";
import { useRef, useState, useEffect } from "react";

interface JournalEntry {
  debit: { account: string; amount: string };
  credit: { account: string; amount: string };
}

interface Example {
  input: string;
  entry: JournalEntry;
}

export function JournalEntrySection() {
  const sectionRef = useRef(null);
  const isInView = useInView(sectionRef, { once: false, amount: 0.3 });
  const [currentExample, setCurrentExample] = useState(0);
  const [displayedText, setDisplayedText] = useState("");
  const [showEntry, setShowEntry] = useState(false);
  const [currentLanguage, setCurrentLanguage] = useState(0);

  const languages = ["English", "German", "Russian", "Italian", "French"];

  const examples: Example[] = [
    {
      input: "record $500 depreciation expense",
      entry: {
        debit: { account: "Depreciation Expense", amount: "$500.00" },
        credit: { account: "Accumulated Depreciation", amount: "$500.00" }
      }
    },
    {
      input: "pay $2,400 rent for office space",
      entry: {
        debit: { account: "Rent Expense", amount: "$2,400.00" },
        credit: { account: "Cash", amount: "$2,400.00" }
      }
    },
    {
      input: "invoice client $5,000 for consulting",
      entry: {
        debit: { account: "Accounts Receivable", amount: "$5,000.00" },
        credit: { account: "Service Revenue", amount: "$5,000.00" }
      }
    }
  ];

  useEffect(() => {
    if (!isInView) return;

    const currentInput = examples[currentExample].input;
    let charIndex = 0;

    // Reset states
    setDisplayedText("");
    setShowEntry(false);

    // Typing animation
    const typingInterval = setInterval(() => {
      if (charIndex < currentInput.length) {
        setDisplayedText(currentInput.slice(0, charIndex + 1));
        charIndex++;
      } else {
        clearInterval(typingInterval);
        // Show journal entry after typing completes
        setTimeout(() => setShowEntry(true), 300);
      }
    }, 50);

    // Cycle to next example
    const cycleTimeout = setTimeout(() => {
      setCurrentExample((prev) => (prev + 1) % examples.length);
    }, 6000);

    return () => {
      clearInterval(typingInterval);
      clearTimeout(cycleTimeout);
    };
  }, [isInView, currentExample]);

  // Language cycling effect
  useEffect(() => {
    if (!isInView) return;

    const languageInterval = setInterval(() => {
      setCurrentLanguage((prev) => (prev + 1) % languages.length);
    }, 2500); // Change language every 2.5 seconds

    return () => {
      clearInterval(languageInterval);
    };
  }, [isInView]);

  const currentEntry = examples[currentExample].entry;

  return (
    <section
      ref={sectionRef}
      className="relative min-h-screen bg-black flex flex-col items-center justify-center px-4 md:px-6 py-16 md:py-20"
    >
      <div className="relative z-10 max-w-5xl mx-auto w-full">
        {/* Main headline */}
        <div className="text-center mb-12 md:mb-20">
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-8xl font-bold text-white mb-4 md:mb-6 tracking-tight leading-none">
            Just type
            <br />
            <span className="relative inline-block">
              in plain{" "}
              <span className="relative inline-block min-w-[180px] sm:min-w-[240px] md:min-w-[280px] lg:min-w-[400px]">
                <AnimatePresence mode="wait">
                  <motion.span
                    key={languages[currentLanguage]}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.5, ease: "easeInOut" }}
                    className="absolute left-0 top-0 w-full text-center"
                  >
                    {languages[currentLanguage]}
                  </motion.span>
                </AnimatePresence>
                <span className="opacity-0">{languages[currentLanguage]}</span>
              </span>
            </span>
          </h1>
          <p className="text-base sm:text-lg md:text-xl lg:text-2xl text-gray-500 max-w-3xl mx-auto leading-relaxed px-4 md:px-0">
            No forms. No dropdowns. No accounting jargon required.
            <br className="hidden sm:block" />
            <span className="sm:inline block mt-1 sm:mt-0"> Type what you need, and we'll create the perfect journal entry.</span>
          </p>
        </div>

        {/* Main demo area */}
        <div className="max-w-3xl mx-auto">
          {/* Input field */}
          <div className="mb-8 md:mb-12">
            <div className="bg-gradient-to-r from-gray-900/90 to-gray-800/90 border border-gray-700/50 rounded-xl md:rounded-2xl px-4 sm:px-6 md:px-8 py-4 md:py-6 backdrop-blur-sm">
              <div className="flex items-center gap-2 md:gap-3 mb-2 md:mb-3">
                <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-blue-500 animate-pulse" />
                <span className="text-gray-500 text-xs md:text-sm">Novalare AI</span>
              </div>
              <div className="text-white text-lg sm:text-xl md:text-2xl font-light min-h-[1.5rem] md:min-h-[2rem]">
                {displayedText}
                <motion.span
                  animate={{ opacity: [1, 0] }}
                  transition={{ duration: 0.8, repeat: Infinity }}
                  className="inline-block w-0.5 h-5 md:h-6 bg-blue-500 ml-1 align-middle"
                />
              </div>
            </div>
          </div>

          {/* Generated journal entry */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ 
              opacity: showEntry ? 1 : 0,
              scale: showEntry ? 1 : 0.95,
              y: showEntry ? 0 : 20
            }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          >
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3 md:mb-4">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: showEntry ? 1 : 0 }}
                  transition={{ duration: 0.4, delay: 0.2 }}
                  className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-green-500/20 flex items-center justify-center"
                >
                  <svg className="w-4 h-4 md:w-5 md:h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </motion.div>
                <span className="text-gray-400 text-xs md:text-sm">Journal Entry Created</span>
              </div>

              <div className="bg-gradient-to-br from-gray-900/50 to-gray-800/50 border border-gray-700/30 rounded-xl md:rounded-2xl overflow-hidden">
                {/* Header */}
                <div className="px-4 sm:px-6 md:px-8 py-3 md:py-4 border-b border-gray-700/30">
                  <div className="grid grid-cols-3 gap-2 md:gap-4 text-gray-500 text-xs md:text-sm">
                    <div>Account</div>
                    <div className="text-right">Debit</div>
                    <div className="text-right">Credit</div>
                  </div>
                </div>

                {/* Debit Entry */}
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ 
                    opacity: showEntry ? 1 : 0,
                    x: showEntry ? 0 : -20
                  }}
                  transition={{ duration: 0.5, delay: 0.3 }}
                  className="px-4 sm:px-6 md:px-8 py-4 md:py-5 border-b border-gray-700/20"
                >
                  <div className="grid grid-cols-3 gap-2 md:gap-4 items-center">
                    <div className="text-white font-medium text-sm md:text-base truncate">{currentEntry.debit.account}</div>
                    <div className="text-right text-green-400 font-semibold text-base md:text-lg">
                      {currentEntry.debit.amount}
                    </div>
                    <div className="text-right text-gray-600">—</div>
                  </div>
                </motion.div>

                {/* Credit Entry */}
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ 
                    opacity: showEntry ? 1 : 0,
                    x: showEntry ? 0 : -20
                  }}
                  transition={{ duration: 0.5, delay: 0.5 }}
                  className="px-4 sm:px-6 md:px-8 py-4 md:py-5"
                >
                  <div className="grid grid-cols-3 gap-2 md:gap-4 items-center">
                    <div className="text-white font-medium text-sm md:text-base truncate">{currentEntry.credit.account}</div>
                    <div className="text-right text-gray-600">—</div>
                    <div className="text-right text-blue-400 font-semibold text-base md:text-lg">
                      {currentEntry.credit.amount}
                    </div>
                  </div>
                </motion.div>

                {/* Total line */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: showEntry ? 1 : 0 }}
                  transition={{ duration: 0.5, delay: 0.7 }}
                  className="px-4 sm:px-6 md:px-8 py-3 md:py-4 bg-gray-900/50 border-t border-gray-700/30"
                >
                  <div className="grid grid-cols-3 gap-2 md:gap-4 text-gray-500 text-xs md:text-sm">
                    <div>Total</div>
                    <div className="text-right text-green-400 font-semibold">{currentEntry.debit.amount}</div>
                    <div className="text-right text-blue-400 font-semibold">{currentEntry.credit.amount}</div>
                  </div>
                </motion.div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Bottom text */}
        <div className="text-center mt-12 md:mt-20">
          <p className="text-gray-600 text-base md:text-lg px-4 md:px-0">
            Our AI understands context, amounts, and accounting rules.
            <br className="hidden sm:block" />
            <span className="sm:inline block mt-1 sm:mt-0 text-gray-500">No training needed.</span>
          </p>
        </div>
      </div>
    </section>
  );
}