'use client'

import { useEffect } from 'react'

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('Application error:', error)
  }, [error])

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6" dir="rtl">
      <section className="w-full max-w-md rounded-3xl border border-red-100 bg-white p-8 text-center shadow-xl shadow-slate-200/60">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-3xl">⚠️</div>
        <h1 className="mt-5 text-xl font-extrabold text-slate-800">حدث خطأ مؤقت</h1>
        <p className="mt-2 text-sm leading-7 text-slate-500">لم نتمكن من تحميل هذا القسم. يمكنك إعادة المحاولة أو تحديث المنصة.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button onClick={() => reset()} className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700">إعادة المحاولة</button>
          <button onClick={() => window.location.reload()} className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50">تحديث المنصة</button>
        </div>
      </section>
    </main>
  )
}
