import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export function TestimonialsSection() {
  const [currentIndex, setCurrentIndex] = useState(0);

  const testimonials = [
    {
      quote: [
        { text: "Novalare significantly reduced the time we spend on reconciliations. Instead of jumping between spreadsheets and bank feeds, ", highlight: false },
        { text: "everything is laid out visually in one place. Matches, partials, and exceptions are immediately obvious,", highlight: true },
        { text: " which makes reviews much faster.", highlight: false }
      ],
      author: "Sarah Mitchell",
      role: "Senior Accountant",
      company: "Sterling & Partners CPA"
    },
    {
      quote: [
        { text: "What stood out most was how visually manageable reconciliations became. ", highlight: false },
        { text: "You can clearly see what's matched, what needs attention, and why.", highlight: true },
        { text: " This removed a lot of back-and-forth during month-end close and helped us stay organized without manually tracking issues outside the system.", highlight: false }
      ],
      author: "James Chen",
      role: "Manager of Finance Consolidation & Controls",
      company: "Broadview Financial Services"
    },
    {
      quote: [
        { text: "Generating journal entries with AI changed how we handle clean-up at month-end. ", highlight: false },
        { text: "The suggestions are structured, understandable, and tied directly to the reconciliation context.", highlight: true },
        { text: " It reduces manual work while still keeping us in control of the final posting.", highlight: false }
      ],
      author: "Emma Williams",
      role: "Head of Accounting Operations",
      company: "Pinnacle Accounting Group"
    },
    {
      quote: [
        { text: "Before Novalare, ", highlight: false },
        { text: "bank reconciliation took our team 2-3 days per month. Now we complete it in hours", highlight: true },
        { text: " and spend the rest of our time on value-added analysis and client advisory.", highlight: false }
      ],
      author: "David Kumar",
      role: "Financial Controller",
      company: "Clearwater Advisory Partners"
    }
  ];

  const nextTestimonial = () => {
    setCurrentIndex((prev) => (prev + 1) % testimonials.length);
  };

  const prevTestimonial = () => {
    setCurrentIndex((prev) => (prev - 1 + testimonials.length) % testimonials.length);
  };

  const current = testimonials[currentIndex];

  return (
    <section className="relative py-24 md:py-32 bg-white overflow-hidden">
      <div className="max-w-6xl mx-auto px-6 relative z-10">
        {/* Testimonial Content */}
        <div className="mb-16">
          {/* Quote - fixed min-height to prevent layout shift */}
          <blockquote className="text-2xl md:text-3xl lg:text-4xl mb-12 leading-relaxed min-h-[320px] md:min-h-[260px]">
            {current.quote.map((segment, idx) => (
              <span
                key={idx}
                style={{
                  fontFamily: "'Manrope', sans-serif",
                  fontWeight: segment.highlight ? '700' : '600',
                  letterSpacing: '-0.01em',
                  backgroundColor: segment.highlight ? '#bae6fd' : 'transparent',
                  padding: segment.highlight ? '0 4px' : '0',
                  borderRadius: segment.highlight ? '2px' : '0',
                }}
              >
                {segment.text}
              </span>
            ))}
          </blockquote>

          {/* Author Info */}
          <div className="space-y-1">
            <p
              className="text-lg"
              style={{ fontFamily: "'Manrope', sans-serif", fontWeight: '700' }}
            >
              {current.author}
            </p>
            <p
              className="text-base text-gray-600"
              style={{ fontFamily: "'Manrope', sans-serif", fontWeight: '500' }}
            >
              {current.role}
            </p>
            <p
              className="text-base text-gray-800"
              style={{ fontFamily: "'Manrope', sans-serif", fontWeight: '600' }}
            >
              {current.company}
            </p>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex items-center gap-4">
          <button
            onClick={prevTestimonial}
            className="w-12 h-12 rounded-full border-2 border-gray-300 flex items-center justify-center hover:border-gray-800 hover:bg-gray-50 transition-all"
            aria-label="Previous testimonial"
          >
            <ChevronLeft className="w-5 h-5 text-gray-800" />
          </button>
          <button
            onClick={nextTestimonial}
            className="w-12 h-12 rounded-full border-2 border-gray-300 flex items-center justify-center hover:border-gray-800 hover:bg-gray-50 transition-all"
            aria-label="Next testimonial"
          >
            <ChevronRight className="w-5 h-5 text-gray-800" />
          </button>

          {/* Indicators */}
          <div className="flex gap-2 ml-4">
            {testimonials.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentIndex(idx)}
                className={`w-2 h-2 rounded-full transition-all ${idx === currentIndex ? 'bg-gray-800 w-8' : 'bg-gray-300'
                  }`}
                aria-label={`Go to testimonial ${idx + 1}`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}