import Link from "next/link"

export default function Home() {
  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-12 pb-28 text-zinc-900 sm:py-16 sm:pb-24">
      <div className="mx-auto flex w-full max-w-2xl flex-col items-center">
        <section className="w-full pb-10 pt-2 text-center">
          <h1 className="mx-auto max-w-xl text-3xl font-semibold leading-tight tracking-tight sm:text-4xl md:text-[2.75rem] md:leading-[1.15]">
            Don’t buy something you’ll regret tomorrow.
          </h1>
          <p className="mx-auto mt-5 max-w-md text-base leading-relaxed text-zinc-600 sm:text-lg">
            Upload it. Know if it’s a deal — or a mistake.
          </p>

          <div className="mt-8">
            <Link
              href="/check"
              className="inline-flex min-h-[48px] min-w-[200px] items-center justify-center rounded-full bg-zinc-900 px-8 py-3.5 text-sm font-semibold text-white transition hover:bg-zinc-800"
            >
              Check before you buy
            </Link>
          </div>
        </section>

        <section className="w-full pb-10">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
            <div className="flex min-h-[4.5rem] items-center rounded-2xl border border-zinc-200/80 bg-white px-5 py-4 shadow-sm">
              <div className="text-sm font-semibold leading-snug text-zinc-900">Know the real price</div>
            </div>
            <div className="flex min-h-[4.5rem] items-center rounded-2xl border border-zinc-200/80 bg-white px-5 py-4 shadow-sm">
              <div className="text-sm font-semibold leading-snug text-zinc-900">Get a clear decision</div>
            </div>
            <div className="flex min-h-[4.5rem] items-center rounded-2xl border border-zinc-200/80 bg-white px-5 py-4 shadow-sm">
              <div className="text-sm font-semibold leading-snug text-zinc-900">Understand the risk</div>
            </div>
            <div className="flex min-h-[4.5rem] items-center rounded-2xl border border-zinc-200/80 bg-white px-5 py-4 shadow-sm">
              <div className="text-sm font-semibold leading-snug text-zinc-900">Make the right offer</div>
            </div>
          </div>
        </section>

        <section className="w-full pb-10" aria-labelledby="example-result-heading">
          <h2 id="example-result-heading" className="text-center text-xl font-semibold tracking-tight sm:text-2xl">
            Example result
          </h2>
          <p className="mt-2 text-center text-xs font-medium text-zinc-500 sm:text-sm">
            This is what you’ll see after upload
          </p>

          <div className="mx-auto mt-6 w-full max-w-md">
            <div className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-sm">
              <div className="border-b border-amber-200/80 bg-amber-50 px-4 py-4 sm:px-5 sm:py-5">
                <div className="flex flex-wrap items-center gap-2 text-sm sm:text-base">
                  <span className="font-medium text-zinc-800">Verdict:</span>
                  <span className="inline-flex items-center rounded-full border border-amber-300 bg-amber-100 px-3 py-1 text-sm font-semibold tracking-wide text-amber-950">
                    NEGOTIATE
                  </span>
                </div>
              </div>

              <div className="divide-y divide-zinc-100 px-4 py-1 sm:px-5">
                <div className="flex flex-col gap-1 py-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
                  <span className="text-xs font-semibold leading-snug text-zinc-600">Fair price:</span>
                  <span className="text-base font-semibold tabular-nums leading-snug text-zinc-900 sm:text-right">
                    $3,500 – $4,200
                  </span>
                </div>
                <div className="flex flex-col gap-1 py-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
                  <span className="text-xs font-semibold leading-snug text-zinc-600">Your price:</span>
                  <span className="text-base font-semibold tabular-nums leading-snug text-zinc-900 sm:text-right">$4,800</span>
                </div>
                <div className="flex flex-col gap-1 py-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
                  <span className="text-xs font-semibold leading-snug text-zinc-600">Suggested offer:</span>
                  <span className="text-base font-semibold tabular-nums leading-snug text-zinc-900 sm:text-right">$3,900</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 text-center">
            <p className="text-sm font-medium text-zinc-800 sm:text-base">Ready to check yours?</p>
            <div className="mt-4">
              <Link
                href="/check"
                className="inline-flex min-h-[48px] w-full max-w-sm items-center justify-center rounded-full bg-zinc-900 px-8 py-3.5 text-sm font-semibold text-white transition hover:bg-zinc-800 sm:w-auto sm:min-w-[220px]"
              >
                Upload & get verdict
              </Link>
            </div>
          </div>
        </section>

        <section className="w-full pb-10">
          <div className="rounded-2xl border border-zinc-200/80 bg-white p-6 sm:p-8">
            <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">You’re not seeing the full picture.</h2>
            <p className="mt-2 text-sm font-medium text-zinc-800 sm:text-base">We show you:</p>
            <ul className="mt-4 space-y-3 text-left text-sm leading-relaxed text-zinc-700 sm:text-base">
              <li className="flex gap-3">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-400" aria-hidden />
                the real price
              </li>
              <li className="flex gap-3">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-400" aria-hidden />
                the hidden risks
              </li>
              <li className="flex gap-3">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-400" aria-hidden />
                the smarter move
              </li>
            </ul>

            <div className="mt-8">
              <Link
                href="/check"
                className="inline-flex text-sm font-semibold text-zinc-900 underline-offset-4 hover:underline"
              >
                Check your deal now →
              </Link>
            </div>
          </div>
        </section>

        <section className="w-full pb-2">
          <p className="text-center text-sm text-zinc-600">
            Cars, electronics, furniture, and more—upload or paste a link and get a structured readout.
          </p>
        </section>

        <footer className="mt-14 w-full border-t border-zinc-200/80 pt-8 text-center text-sm text-zinc-500">
          <p className="mx-auto max-w-prose text-xs leading-relaxed text-zinc-500">
            This tool provides estimated analysis based on user input. It is not financial or legal advice. Always verify
            condition, authenticity, and seller claims—especially for vehicles and high-value purchases.
          </p>
        </footer>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-zinc-200/80 bg-zinc-50/95 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-2xl justify-center px-4 py-3 sm:py-3.5 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <Link
            href="/check"
            className="inline-flex min-h-[48px] w-full max-w-md items-center justify-center rounded-full bg-zinc-900 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 sm:max-w-none sm:min-w-[280px]"
          >
            Check before you buy
          </Link>
        </div>
      </div>
    </main>
  )
}
