export function CompanySkeleton() {
  return (
    <div
      className={`
        group relative overflow-hidden rounded-xl border transition-all duration-300
        bg-white border-gray-200
      `}
    >
      {/* Card Header */}
      <div className="p-6">
        <div className="flex items-start gap-4">
          {/* Company Logo Skeleton */}
          <div className={`
            relative size-14 rounded-xl flex-shrink-0 overflow-hidden
            bg-gray-200
          `}>
            <div className={`
              absolute inset-0 -translate-x-full animate-shimmer
              bg-gradient-to-r from-transparent via-white/60 to-transparent
            `} />
          </div>

          {/* Company Name & Info */}
          <div className="flex-1 min-w-0 space-y-3">
            {/* Company Name */}
            <div className={`
              relative h-6 rounded-md overflow-hidden
              bg-gray-200
            `}
            style={{ width: '75%' }}>
              <div className={`
                absolute inset-0 -translate-x-full animate-shimmer
                bg-gradient-to-r from-transparent via-white/10 to-transparent
              `} />
            </div>

            {/* Company Type */}
            <div className={`
              relative h-4 rounded-md overflow-hidden
              bg-gray-200
            `}
            style={{ width: '45%' }}>
              <div className={`
                absolute inset-0 -translate-x-full animate-shimmer
                bg-gradient-to-r from-transparent via-white/10 to-transparent
              `} />
            </div>
          </div>
        </div>

        {/* Stats Row */}
        <div className="flex items-center gap-4 pt-4">
          {/* Stat 1 */}
          <div className="flex-1">
            <div className={`
              relative h-3 rounded-md overflow-hidden mb-2
              bg-gray-200
            `}
            style={{ width: '60%' }}>
              <div className={`
                absolute inset-0 -translate-x-full animate-shimmer
                bg-gradient-to-r from-transparent via-white/10 to-transparent
              `} />
            </div>
            <div className={`
              relative h-5 rounded-md overflow-hidden
              bg-gray-200
            `}
            style={{ width: '40%' }}>
              <div className={`
                absolute inset-0 -translate-x-full animate-shimmer
                bg-gradient-to-r from-transparent via-white/10 to-transparent
              `} />
            </div>
          </div>

          {/* Stat 2 */}
          <div className="flex-1">
            <div className={`
              relative h-3 rounded-md overflow-hidden mb-2
              bg-gray-200
            `}
            style={{ width: '55%' }}>
              <div className={`
                absolute inset-0 -translate-x-full animate-shimmer
                bg-gradient-to-r from-transparent via-white/10 to-transparent
              `} />
            </div>
            <div className={`
              relative h-5 rounded-md overflow-hidden
              bg-gray-200
            `}
            style={{ width: '35%' }}>
              <div className={`
                absolute inset-0 -translate-x-full animate-shimmer
                bg-gradient-to-r from-transparent via-white/10 to-transparent
              `} />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Badge */}
      <div className={`
        px-6 py-3
        bg-gray-50
      `}>
        <div className={`
          relative h-5 rounded-full overflow-hidden
          bg-gray-200
        `}
        style={{ width: '90px' }}>
          <div className={`
            absolute inset-0 -translate-x-full animate-shimmer
            bg-gradient-to-r from-transparent via-white/10 to-transparent
          `} />
        </div>
      </div>
    </div>
  );
}