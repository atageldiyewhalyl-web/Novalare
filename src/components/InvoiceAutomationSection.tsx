import { motion, useInView } from "motion/react";
import { useRef, useState } from "react";

export function InvoiceAutomationSection() {
  const sectionRef = useRef(null);
  const isInView = useInView(sectionRef, { once: false, amount: 0.3 });
  const [invoicesPerWeek, setInvoicesPerWeek] = useState(400);

  // Calculate time savings (4 minutes per invoice)
  const minutesPerInvoice = 4;
  const totalMinutes = invoicesPerWeek * minutesPerInvoice;
  const hours = (totalMinutes / 60).toFixed(1);

  return (
    <section
      ref={sectionRef}
      className="relative min-h-screen md:min-h-[200vh] bg-black flex flex-col items-center justify-center px-4 md:px-6 py-20 md:py-40"
    >
      <div className="relative z-10 max-w-6xl mx-auto w-full">
        {/* Main headline */}
        <div className="text-center mb-8 md:mb-12">
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-8xl font-bold text-white mb-4 md:mb-6 tracking-tight leading-none">
            Automate invoice &<br />
            receipt recording
          </h1>
          <p className="text-base sm:text-lg md:text-xl lg:text-2xl text-gray-500 max-w-3xl mx-auto leading-relaxed px-4 md:px-0">
            Forward invoices and receipts to your unique Novalare email.
            <br className="hidden sm:block" />
            <span className="sm:inline block mt-1 sm:mt-0"> We extract, structure, and prepare everything for review and export.</span>
          </p>
        </div>

        {/* Central animation area */}
        <div className="relative h-[300px] sm:h-[400px] md:h-[500px] flex items-center justify-center my-10 md:my-20">
          {/* Inbox/Mail icon center */}
          <div className="absolute inset-0 flex items-center justify-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: isInView ? 1 : 0, scale: isInView ? 1 : 0.8 }}
              transition={{ duration: 1, delay: 0.3 }}
              className="relative"
            >
              {/* Mail envelope - simplified */}
              <div className="relative w-20 h-16 sm:w-28 sm:h-20 md:w-32 md:h-24 border-2 border-gray-700 rounded-lg bg-gradient-to-br from-gray-900 to-black flex items-center justify-center">
                <div className="absolute inset-0 rounded-lg bg-blue-500/5" />
                <svg
                  className="w-10 h-10 sm:w-14 sm:h-14 md:w-16 md:h-16 text-gray-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
                  />
                </svg>
              </div>
            </motion.div>
          </div>

          {/* Invoices flying in from left - continuous loop */}
          {[...Array(4)].map((_, i) => {
            return (
              <motion.div
                key={`invoice-${i}`}
                initial={{ 
                  x: -300, 
                  y: -80 + (i % 3) * 40,
                  opacity: 0,
                  rotate: -15,
                  scale: 0.9
                }}
                animate={{ 
                  x: [-300, 0],
                  y: [-80 + (i % 3) * 40, 0],
                  opacity: [0, 1, 1, 0],
                  rotate: [-15, 0],
                  scale: [0.9, 1, 0.8],
                }}
                transition={{
                  duration: 2.5,
                  delay: i * 0.7,
                  ease: "easeInOut",
                  times: [0, 0.3, 0.6, 1],
                  repeat: Infinity,
                  repeatDelay: (4 - 1) * 0.7
                }}
                className="absolute hidden sm:block"
              >
                <div className="w-20 h-28 sm:w-24 sm:h-32 md:w-28 md:h-36 bg-gradient-to-br from-white to-gray-200 rounded-lg shadow-2xl p-2 sm:p-3 border border-gray-300">
                  {/* Invoice content lines */}
                  <div className="space-y-1.5 sm:space-y-2">
                    <div className="h-1 sm:h-1.5 bg-gray-800 rounded w-3/4" />
                    <div className="h-0.5 sm:h-1 bg-gray-400 rounded w-1/2" />
                    <div className="h-0.5 sm:h-1 bg-gray-400 rounded w-2/3" />
                    <div className="mt-2 sm:mt-4 space-y-0.5 sm:space-y-1">
                      <div className="h-0.5 bg-gray-300 rounded" />
                      <div className="h-0.5 bg-gray-300 rounded" />
                      <div className="h-0.5 bg-gray-300 rounded w-4/5" />
                    </div>
                    <div className="mt-2 sm:mt-4 flex justify-between items-end">
                      <div className="h-0.5 sm:h-1 bg-gray-300 rounded w-1/3" />
                      <div className="h-1 sm:h-2 bg-blue-600 rounded w-1/4" />
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}

          {/* MOBILE ONLY: Single invoice animation */}
          <motion.div
            initial={{ 
              x: -200, 
              y: -40,
              opacity: 0,
              rotate: -10,
              scale: 0.9
            }}
            animate={{ 
              x: [-200, 0],
              y: [-40, 0],
              opacity: [0, 1, 1, 0],
              rotate: [-10, 0],
              scale: [0.9, 1, 0.8],
            }}
            transition={{
              duration: 2.5,
              ease: "easeInOut",
              times: [0, 0.3, 0.6, 1],
              repeat: Infinity,
              repeatDelay: 1.5
            }}
            className="absolute sm:hidden"
          >
            <div className="w-16 h-24 bg-gradient-to-br from-white to-gray-200 rounded-lg shadow-2xl p-2 border border-gray-300">
              {/* Invoice content lines */}
              <div className="space-y-1.5">
                <div className="h-1 bg-gray-800 rounded w-3/4" />
                <div className="h-0.5 bg-gray-400 rounded w-1/2" />
                <div className="h-0.5 bg-gray-400 rounded w-2/3" />
                <div className="mt-3 space-y-0.5">
                  <div className="h-0.5 bg-gray-300 rounded" />
                  <div className="h-0.5 bg-gray-300 rounded" />
                  <div className="h-0.5 bg-gray-300 rounded w-4/5" />
                </div>
                <div className="mt-3 flex justify-between items-end">
                  <div className="h-0.5 bg-gray-300 rounded w-1/3" />
                  <div className="h-1 bg-blue-600 rounded w-1/4" />
                </div>
              </div>
            </div>
          </motion.div>

          {/* MOBILE ONLY: Single output data card */}
          <motion.div
            initial={{ 
              x: 0, 
              y: 0,
              opacity: 0,
              scale: 0.8
            }}
            animate={{ 
              x: [0, 200],
              y: [0, -50],
              opacity: [0, 1, 1, 0],
              scale: [0.8, 1, 1],
            }}
            transition={{
              duration: 2.5,
              delay: 1.2,
              ease: "easeInOut",
              times: [0, 0.2, 0.7, 1],
              repeat: Infinity,
              repeatDelay: 1.5
            }}
            className="absolute sm:hidden"
          >
            <div className="px-4 py-2 bg-gradient-to-r from-blue-500/90 to-purple-500/90 backdrop-blur-xl rounded-full border border-white/20 shadow-2xl">
              <p className="text-white font-medium text-xs whitespace-nowrap">
                Amount: $2,847
              </p>
            </div>
          </motion.div>

          {/* Data cards flying out to right - continuous loop */}
          {[...Array(4)].map((_, i) => {
            const labels = ['Amount: $2,847', 'Date: Dec 14', 'Vendor: Acme Corp', 'Tax: $284'];
            
            return (
              <motion.div
                key={`data-${i}`}
                initial={{ 
                  x: 0, 
                  y: 0,
                  opacity: 0,
                  scale: 0.8
                }}
                animate={{ 
                  x: [0, 300],
                  y: [0, -100 + (i % 3) * 50],
                  opacity: [0, 1, 1, 0],
                  scale: [0.8, 1, 1],
                }}
                transition={{
                  duration: 2.5,
                  delay: i * 0.7 + 1.2,
                  ease: "easeInOut",
                  times: [0, 0.2, 0.7, 1],
                  repeat: Infinity,
                  repeatDelay: (4 - 1) * 0.7
                }}
                className="absolute hidden sm:block"
              >
                <div className="px-4 sm:px-5 md:px-6 py-2 sm:py-2.5 md:py-3 bg-gradient-to-r from-blue-500/90 to-purple-500/90 backdrop-blur-xl rounded-full border border-white/20 shadow-2xl">
                  <p className="text-white font-medium text-xs sm:text-sm whitespace-nowrap">
                    {labels[i % labels.length]}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Time Savings Calculator - Minimal */}
        <div className="text-center space-y-6 md:space-y-8 max-w-md mx-auto px-4 md:px-0">
          {/* Slider */}
          <div className="space-y-4 md:space-y-6">
            <label className="text-gray-400 text-base sm:text-lg md:text-xl block">
              How many invoices per week?
            </label>
            <div className="flex items-center gap-2 sm:gap-3 md:gap-4">
              <span className="text-gray-500 text-xs sm:text-sm">100</span>
              <div className="flex-1 relative">
                <input
                  type="range"
                  min="100"
                  max="700"
                  step="50"
                  value={invoicesPerWeek}
                  onChange={(e) => setInvoicesPerWeek(parseInt(e.target.value))}
                  className="w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-purple-500 [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-purple-500 [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-pointer"
                />
              </div>
              <span className="text-gray-500 text-xs sm:text-sm">700</span>
              <div className="min-w-[50px] sm:min-w-[60px] px-2 sm:px-3 py-1 sm:py-1.5 bg-gray-900/50 border border-gray-800 rounded-lg">
                <span className="text-white text-xs sm:text-sm">{invoicesPerWeek}</span>
              </div>
            </div>
          </div>

          {/* Time Savings Display */}
          <div className="py-6 md:py-8 px-4 md:px-6 bg-gray-900/30 border border-gray-800 rounded-2xl">
            <div className="text-4xl sm:text-5xl md:text-6xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent mb-2">
              {hours} Hours
            </div>
            <div className="text-gray-400 text-xs sm:text-sm">
              Saved per week with automation
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}