import { useRef } from "react";
import { AnimatedJournalEntry } from './AnimatedJournalEntry';
import { AnimatedPieChartIcon, AnimatedAIDocumentIcon, AnimatedSyncArrowIcon } from './AnimatedStepIcons';

export function JournalEntryIntroSection() {
  return (
    <section
      className="relative py-24 md:py-32 bg-gradient-to-b from-black via-blue-950/10 to-black overflow-hidden"
    >
      {/* Gradient Orbs for depth */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Top-right orb - purple */}
        <div
          className="absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full opacity-20"
          style={{
            background: 'radial-gradient(circle, rgba(168, 85, 247, 0.4) 0%, transparent 70%)',
            filter: 'blur(60px)',
          }}
        />
        {/* Bottom-left orb - blue */}
        <div
          className="absolute -bottom-40 -left-40 w-[600px] h-[600px] rounded-full opacity-15"
          style={{
            background: 'radial-gradient(circle, rgba(59, 130, 246, 0.5) 0%, transparent 70%)',
            filter: 'blur(80px)',
          }}
        />
        {/* Center-right orb - cyan */}
        <div
          className="absolute top-1/2 right-0 w-[400px] h-[400px] rounded-full opacity-10 -translate-y-1/2"
          style={{
            background: 'radial-gradient(circle, rgba(101, 211, 253, 0.4) 0%, transparent 70%)',
            filter: 'blur(50px)',
          }}
        />
      </div>

      <div className="max-w-6xl mx-auto px-6 relative z-10">
        {/* Main Headline with Illustration */}
        <div className="mb-16 md:mb-20">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Text Content */}
            <div className="text-center lg:text-left">
              <h2
                className="text-4xl md:text-5xl lg:text-7xl text-white mb-6 leading-tight"
                style={{ fontFamily: "'Outfit', sans-serif", fontWeight: '700', letterSpacing: '-0.02em' }}
              >
                AI Drafts.<br />
                You Approve.
              </h2>
              <p
                className="text-gray-400 text-lg md:text-xl max-w-2xl mx-auto lg:mx-0"
                style={{ fontFamily: "'Manrope', sans-serif", fontWeight: '500' }}
              >
                No more manually recording unmatched transactions. Novalare does it all for you.
              </p>
            </div>

            {/* Animated Journal Entry Illustration */}
            <div className="flex justify-center lg:justify-end">
              <AnimatedJournalEntry className="w-full max-w-sm md:max-w-md" />
            </div>
          </div>
        </div>

        {/* Workflow Steps */}
        <div className="max-w-5xl mx-auto">
          {/* Step 1 */}
          <div className="relative mb-12 md:mb-16">
            <div className="flex flex-col md:flex-row items-start gap-6">
              {/* Animated Icon */}
              <div className="flex-shrink-0">
                <AnimatedPieChartIcon size={96} />
              </div>

              {/* Content */}
              <div className="flex-1">
                <h3
                  className="text-2xl md:text-3xl text-white mb-3"
                  style={{ fontFamily: "'Outfit', sans-serif", fontWeight: '600' }}
                >
                  Unmatched transactions automatically converted
                </h3>
                <p
                  className="text-gray-400 text-lg leading-relaxed"
                  style={{ fontFamily: "'Manrope', sans-serif", fontWeight: '400' }}
                >
                  All unmatched transactions from your Bank, AP, AR, and Credit Card reconciliations
                  are automatically converted into journal entries and prepared for review.
                  No manual data entry required.
                </p>
              </div>
            </div>

            {/* Connecting line to next step */}
            <div className="hidden md:block absolute left-12 top-24 w-0.5 h-16 bg-gradient-to-b from-white/20 to-transparent" />
          </div>

          {/* Step 2 */}
          <div className="relative mb-12 md:mb-16">
            <div className="flex flex-col md:flex-row items-start gap-6">
              {/* Animated Icon */}
              <div className="flex-shrink-0">
                <AnimatedAIDocumentIcon size={96} />
              </div>

              {/* Content */}
              <div className="flex-1">
                <h3
                  className="text-2xl md:text-3xl text-white mb-3"
                  style={{ fontFamily: "'Outfit', sans-serif", fontWeight: '600' }}
                >
                  AI suggests, you review
                </h3>
                <p
                  className="text-gray-400 text-lg leading-relaxed"
                  style={{ fontFamily: "'Manrope', sans-serif", fontWeight: '400' }}
                >
                  Every journal entry is intelligently suggested by AI with the correct accounts,
                  amounts, and descriptions. You simply review for accuracy and approve with one click.
                </p>
              </div>
            </div>

            {/* Connecting line to next step */}
            <div className="hidden md:block absolute left-12 top-24 w-0.5 h-16 bg-gradient-to-b from-white/20 to-transparent" />
          </div>

          {/* Step 3 */}
          <div className="relative">
            <div className="flex flex-col md:flex-row items-start gap-6">
              {/* Animated Icon */}
              <div className="flex-shrink-0">
                <AnimatedSyncArrowIcon size={96} />
              </div>

              {/* Content */}
              <div className="flex-1">
                <h3
                  className="text-2xl md:text-3xl text-white mb-3"
                  style={{ fontFamily: "'Outfit', sans-serif", fontWeight: '600' }}
                >
                  Automatically pushed to your accounting software
                </h3>
                <p
                  className="text-gray-400 text-lg leading-relaxed"
                  style={{ fontFamily: "'Manrope', sans-serif", fontWeight: '400' }}
                >
                  Once approved, journal entries are automatically synced to QuickBooks, Xero, or DATEV.
                  Your books stay up-to-date without any manual posting.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
