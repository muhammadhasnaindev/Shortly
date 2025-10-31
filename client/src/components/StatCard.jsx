/**
 * StatCard — small metric display card
 *
 * Summary:
 * - Shows title, value, and optional hint with a subtle hover scale.

 */

/**
 * @param {{ title: string, value: React.ReactNode, hint?: string }} props
 */
export default function StatCard({ title, value, hint }) {
  return (
    <div className="card p-5 transition-all duration-200 hover:scale-[1.02]">
      <div className="text-sm text-muted">{title}</div>
      <div className="mt-1 text-3xl font-semibold">{value}</div>
      {hint ? <div className="mt-1 text-xs text-muted">{hint}</div> : null}
    </div>
  );
}
