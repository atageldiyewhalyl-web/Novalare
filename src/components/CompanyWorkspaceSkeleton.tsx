export function CompanyWorkspaceSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      {/* Header skeleton */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="size-16 rounded-2xl bg-gray-200 animate-pulse" />
          <div className="space-y-2">
            <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
            <div className="h-4 w-32 bg-gray-100 rounded animate-pulse" />
          </div>
        </div>
        <div className="h-10 w-32 bg-gray-100 rounded-lg animate-pulse" />
      </div>

      {/* Tabs skeleton */}
      <div className="flex gap-4 border-b border-gray-200 pb-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="h-10 w-32 bg-gray-100 rounded-lg animate-pulse"
          />
        ))}
      </div>

      {/* Content skeleton */}
      <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="bg-white border border-gray-200 rounded-xl p-4 space-y-3 animate-pulse"
          >
            <div className="h-4 bg-gray-200 rounded w-3/4" />
            <div className="h-3 bg-gray-100 rounded w-1/2" />
            <div className="h-6 bg-gray-100 rounded w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}