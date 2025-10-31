/**
 * TableSkeleton — placeholder while table data loads
 *
 * Summary:
 * - Simple pulse rows to hint layout.
 */

const ROWS = 6;

/**
 * TableSkeleton component
 */
export function TableSkeleton() {
  return (
    <div className="card p-4">
      <div className="animate-pulse space-y-3">
        {Array.from({ length: ROWS }).map((_, i) => (
          <div key={i} className="h-6 bg-stone-800 rounded"></div>
        ))}
      </div>
    </div>
  );
}
