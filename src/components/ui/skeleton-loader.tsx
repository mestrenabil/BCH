'use client'

/**
 * Reusable skeleton loaders matching the platform's card/table/chart patterns.
 * Reduces layout shift during data fetching and improves perceived performance.
 */

export function CardSkeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm animate-pulse ${className}`}
      role="status"
      aria-label="جاري التحميل"
    >
      <div className="h-4 w-1/3 bg-slate-200 dark:bg-slate-700 rounded mb-3" />
      <div className="h-8 w-2/3 bg-slate-100 dark:bg-slate-700/60 rounded mb-2" />
      <div className="h-3 w-1/2 bg-slate-100 dark:bg-slate-700/60 rounded" />
    </div>
  )
}

export function StatCardSkeleton() {
  return (
    <div
      className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm animate-pulse"
      role="status"
      aria-label="جاري التحميل"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="h-3 w-20 bg-slate-200 dark:bg-slate-700 rounded" />
        <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700/60" />
      </div>
      <div className="h-7 w-16 bg-slate-200 dark:bg-slate-700 rounded" />
    </div>
  )
}

export function TableRowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 animate-pulse" role="status" aria-label="جاري التحميل">
      <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700/60 shrink-0" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3 w-1/3 bg-slate-100 dark:bg-slate-700/60 rounded" />
        <div className="h-2.5 w-1/2 bg-slate-50 dark:bg-slate-700/40 rounded" />
      </div>
      <div className="h-5 w-14 bg-slate-100 dark:bg-slate-700/60 rounded-full" />
    </div>
  )
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="divide-y divide-slate-100 dark:divide-slate-700/60">
      {Array.from({ length: rows }).map((_, i) => <TableRowSkeleton key={i} />)}
    </div>
  )
}

export function ChartSkeleton() {
  return (
    <div
      className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm animate-pulse"
      role="status"
      aria-label="جاري تحميل الرسم البياني"
    >
      <div className="h-4 w-1/4 bg-slate-200 dark:bg-slate-700 rounded mb-4" />
      <div className="flex items-end gap-2 h-40">
        {Array.from({ length: 7 }).map((_, i) => (
          <div
            key={i}
            className="flex-1 bg-slate-100 dark:bg-slate-700/60 rounded-t-md"
            style={{ height: `${30 + Math.random() * 60}%` }}
          />
        ))}
      </div>
    </div>
  )
}

export function GridSkeleton({ count = 6, cols = 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' }: { count?: number; cols?: string }) {
  return (
    <div className={`grid ${cols} gap-4`}>
      {Array.from({ length: count }).map((_, i) => <CardSkeleton key={i} />)}
    </div>
  )
}

/** Generic inline spinner for buttons and small areas. */
export function InlineSpinner({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin ${className}`}
      role="status"
      aria-label="جاري التحميل"
    />
  )
}
