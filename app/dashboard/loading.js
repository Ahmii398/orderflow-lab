// app/dashboard/loading.js
// Next.js App Router convention: this renders automatically (as a Suspense
// fallback) while the async Server Component in page.js is fetching data —
// no manual loading state wiring needed in page.js itself.

export default function DashboardLoading() {
  return (
    <main className="min-h-screen bg-paper pb-16">
      <div aria-hidden="true" className="h-1.5 w-full bg-line" />
      <div className="border-b border-line bg-white">
        <div className="mx-auto max-w-6xl px-6 py-8 sm:px-8">
          <div className="h-5 w-32 animate-pulse rounded-full bg-neutral-soft" />
          <div className="mt-4 h-8 w-72 max-w-full animate-pulse rounded bg-neutral-soft" />
          <div className="mt-3 h-4 w-full max-w-2xl animate-pulse rounded bg-neutral-soft" />
        </div>
      </div>

      <div className="mx-auto mt-6 flex max-w-6xl flex-col gap-8 px-6 sm:px-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-2xl border border-line bg-white" />
          ))}
        </div>
        <div className="h-72 animate-pulse rounded-2xl border border-line bg-white" />
        <div className="h-64 animate-pulse rounded-2xl border border-line bg-white" />
      </div>
    </main>
  );
}
