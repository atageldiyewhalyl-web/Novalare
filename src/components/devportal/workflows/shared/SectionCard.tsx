import { Card, CardContent } from '@/components/ui/card';

interface SectionCardProps {
  number?: number;
  title: string;
  description?: string;
  children: React.ReactNode;
  isActive?: boolean;
}

export function SectionCard({
  number,
  title,
  description,
  children,
  isActive = false
}: SectionCardProps) {
  return (
    <div className={`
      relative pl-8 md:pl-0 md:ml-0
      transition-all duration-500 ease-in-out
    `}>
      {/* Timeline connector for md+ screens */}
      {number && (
        <div className="absolute left-0 top-0 bottom-0 w-px bg-white/10 hidden md:block -ml-5 lg:-ml-8" />
      )}

      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          {number && (
            <div className={`
              size-8 rounded-full flex items-center justify-center text-sm font-bold border z-10
              transition-all duration-300
              ${isActive
                ? 'bg-[#65D3FD] text-black border-[#65D3FD] shadow-[0_0_15px_rgba(101,211,253,0.3)]'
                : 'bg-gray-100 text-gray-400 border-gray-200 dark:bg-gray-900/80 dark:text-gray-500 dark:border-white/10 backdrop-blur-sm'
              }
            `} style={{ fontFamily: "'Outfit', sans-serif" }}>
              {number}
            </div>
          )}

          <div>
            <h2
              className={`text-lg font-semibold tracking-tight ${isActive ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'}`}
              style={{ fontFamily: "'Outfit', sans-serif" }}
            >
              {title}
            </h2>
            {description && (
              <p
                className="text-sm text-gray-500 dark:text-gray-400"
                style={{ fontFamily: "'Manrope', sans-serif" }}
              >
                {description}
              </p>
            )}
          </div>
        </div>

        <div className={`
          rounded-xl transition-all duration-300
          ${isActive
            ? 'opacity-100'
            : 'opacity-50 grayscale hover:opacity-100 hover:grayscale-0'
          }
        `}>
          {children}
        </div>
      </div>
    </div>
  );
}