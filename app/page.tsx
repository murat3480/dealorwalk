"use client"

import { useState } from 'react'

type Condition = 'excellent' | 'good' | 'fair' | 'poor'

function isAnalyzeSuccess(
  value: unknown,
): value is {
  decision: string
  score: number
  estimate: number
  price_difference?: number
  price_difference_percent?: number
  ai_summary?: string
} {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return typeof v.decision === 'string' && typeof v.score === 'number' && typeof v.estimate === 'number'
}

function formatUsd(value: number) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value)
}

function isApiError(value: unknown): value is { error: string; message?: string } {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return typeof v.error === 'string'
}

export default function Home() {
  const [price, setPrice] = useState<string>('')
  const [mileage, setMileage] = useState<string>('')
  const [brand, setBrand] = useState<string>('')
  const [model, setModel] = useState<string>('')
  const [state, setState] = useState<string>('')
  const [city, setCity] = useState<string>('')
  const [year, setYear] = useState<string>('')
  const [condition, setCondition] = useState<Condition>('good')
  const [vehicle_type, setVehicleType] = useState<string>('auto')
  const [listing_url, setListingUrl] = useState<string>('')
  const [listing_description, setListingDescription] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<unknown>(null)

  function scrollToForm() {
    document.getElementById('analyze-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setResult(null)
    try {
      const priceNumber = Number(price)
      const mileageNumber = Number(mileage)
      const yearNumber = Number(year)

      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          price: priceNumber,
          mileage: mileageNumber,
          brand,
          model,
          state,
          city,
          year: yearNumber,
          condition,
          vehicle_type,
          listing_url,
          listing_description,
        }),
      })
      const data = (await res.json()) as unknown
      if (!res.ok) {
        setResult(data)
        return
      }
      setResult(data)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-10 text-zinc-900">
      <div className="mx-auto flex w-full max-w-xl flex-col items-center">
        <section className="w-full pb-8 pt-2 text-center">
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Stop Overpaying for Cars.</h1>
          <p className="mx-auto mt-4 max-w-prose text-base text-zinc-700 sm:text-lg">
            Know if a car is a good deal before you buy. Get a clear BUY / NEGOTIATE / WALK AWAY decision, a fair price
            range, and a ready-to-send negotiation message.
          </p>

          <div className="mt-6 flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={scrollToForm}
              className="inline-flex items-center justify-center rounded-lg bg-zinc-900 px-5 py-3 text-sm font-semibold text-white hover:bg-zinc-800"
            >
              Analyze a Car
            </button>
            <div className="text-sm text-zinc-600">No signup required. Get your first analysis in seconds.</div>
          </div>
        </section>

        <section className="w-full pb-8">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-zinc-200 bg-white p-4">
              <div className="text-sm font-semibold text-zinc-900">Fair Price Range</div>
              <div className="mt-1 text-sm text-zinc-700">See what the car is actually worth.</div>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white p-4">
              <div className="text-sm font-semibold text-zinc-900">Clear Decision</div>
              <div className="mt-1 text-sm text-zinc-700">Get BUY, NEGOTIATE, or WALK AWAY.</div>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white p-4">
              <div className="text-sm font-semibold text-zinc-900">Negotiation Target</div>
              <div className="mt-1 text-sm text-zinc-700">Know exactly what price to offer.</div>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white p-4">
              <div className="text-sm font-semibold text-zinc-900">Seller Message</div>
              <div className="mt-1 text-sm text-zinc-700">Copy a ready-to-send negotiation message.</div>
            </div>
          </div>
        </section>

        <section className="w-full pb-8">
          <div className="rounded-xl border border-zinc-200 bg-white p-6">
            <h2 className="text-xl font-semibold tracking-tight">Most buyers don’t know the real price.</h2>
            <div className="mt-4 grid grid-cols-1 gap-6 md:grid-cols-2">
              <div>
                <div className="text-sm font-semibold text-zinc-900">The problem</div>
                <p className="mt-2 text-sm text-zinc-700">
                  Car listings often look fair until you compare price, mileage, condition, and market range together.
                </p>
              </div>
              <div>
                <div className="text-sm font-semibold text-zinc-900">The solution</div>
                <p className="mt-2 text-sm text-zinc-700">
                  Our AI gives you a clear decision, a fair price range, a target offer, and a seller message in seconds.
                </p>
              </div>
            </div>
          </div>
        </section>

        <div className="w-full rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="text-sm font-semibold text-zinc-700">Try it now</div>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight">Analyze any used car listing</h2>
          <p className="mt-2 text-sm text-zinc-700">
            Enter the car details and get a decision, fair price range, walk-away price, and negotiation message.
          </p>

          <div className="mt-6 text-sm font-semibold text-zinc-900">Enter Car Details</div>

          <form id="analyze-form" onSubmit={onSubmit} className="mt-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-zinc-700">Brand</label>
                <input
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-base outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200"
                  type="text"
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700">Model</label>
                <input
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-base outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200"
                  type="text"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-zinc-700">Price</label>
                <input
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-base outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200"
                  type="number"
                  value={price}
                  placeholder="18000"
                  onChange={(e) => setPrice(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700">Mileage</label>
                <input
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-base outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200"
                  type="number"
                  value={mileage}
                  placeholder="120000"
                  onChange={(e) => setMileage(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-zinc-700">Year</label>
                <input
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-base outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200"
                  type="number"
                  value={year}
                  placeholder="2018"
                  onChange={(e) => setYear(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700">Condition</label>
                <select
                  className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-base outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200"
                  value={condition}
                  onChange={(e) => setCondition(e.target.value as Condition)}
                >
                  <option value="excellent">excellent</option>
                  <option value="good">good</option>
                  <option value="fair">fair</option>
                  <option value="poor">poor</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700">Vehicle Type</label>
                <select
                  className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-base outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200"
                  value={vehicle_type}
                  onChange={(e) => setVehicleType(e.target.value)}
                >
                  <option value="auto">auto</option>
                  <option value="sedan">sedan</option>
                  <option value="suv">suv</option>
                  <option value="truck">truck</option>
                  <option value="coupe">coupe</option>
                  <option value="hatchback">hatchback</option>
                  <option value="van">van</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-zinc-700">State</label>
                <input
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-base outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200"
                  type="text"
                  value={state}
                  placeholder="California"
                  onChange={(e) => setState(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700">City</label>
                <input
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-base outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200"
                  type="text"
                  value={city}
                  placeholder="Los Angeles"
                  onChange={(e) => setCity(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700">Listing URL</label>
              <input
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-base outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200"
                type="text"
                value={listing_url}
                onChange={(e) => setListingUrl(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700">Listing Description</label>
              <textarea
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-base outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200"
                rows={4}
                value={listing_description}
                onChange={(e) => setListingDescription(e.target.value)}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="inline-flex w-full items-center justify-center rounded-lg bg-zinc-900 px-4 py-3 text-sm font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Analyzing…' : 'Analyze Car'}
            </button>
          </form>

          {result && isAnalyzeSuccess(result) ? (
            <div className="mt-6 space-y-3">
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
                <div className="text-sm text-zinc-600">Decision</div>
                <div className="text-2xl font-semibold">Decision: {result.decision}</div>
              </div>

              <div className="rounded-lg border border-zinc-200 bg-white p-4 text-sm text-zinc-900">
                <div>Score: {result.score} / 100</div>
                <div>Estimated Fair Price: ${formatUsd(result.estimate)}</div>

                {typeof result.price_difference === 'number' ? (
                  <div>Price Difference: ${formatUsd(Math.abs(result.price_difference))}</div>
                ) : null}

                {typeof result.price_difference === 'number' ? (
                  result.price_difference > 0 ? (
                    <div className="font-semibold">You are paying ${formatUsd(result.price_difference)} above fair value</div>
                  ) : result.price_difference < 0 ? (
                    <div className="font-semibold">
                      You are getting a deal worth ${formatUsd(Math.abs(result.price_difference))}
                    </div>
                  ) : null
                ) : null}

                {typeof result.price_difference_percent === 'number' ? (
                  <div>
                    {result.price_difference_percent >= 0 ? 'Overpriced by' : 'Underpriced by'}:{' '}
                    {Math.abs(result.price_difference_percent)}%
                  </div>
                ) : null}
              </div>

              {'ai_summary' in result && typeof result.ai_summary === 'string' ? (
                <div className="rounded-lg border border-zinc-200 bg-white p-4">
                  <div className="text-sm font-medium text-zinc-900">AI Explanation</div>
                  <p className="mt-2 text-sm text-zinc-800">{result.ai_summary}</p>
                </div>
              ) : null}
            </div>
          ) : result && isApiError(result) ? (
            <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900">
              <div className="font-medium">{result.error}</div>
              {typeof result.message === 'string' ? <div className="mt-1">{result.message}</div> : null}
            </div>
          ) : null}
        </div>

        <section className="mt-8 w-full pb-2">
          <h2 className="text-xl font-semibold tracking-tight">Built for smarter car buyers.</h2>
          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="rounded-xl border border-zinc-200 bg-white p-4">
              <div className="text-sm font-semibold text-zinc-900">No guesswork</div>
              <div className="mt-1 text-sm text-zinc-700">See the numbers before you contact the seller.</div>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white p-4">
              <div className="text-sm font-semibold text-zinc-900">Better negotiation</div>
              <div className="mt-1 text-sm text-zinc-700">Know your offer and walk-away price.</div>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white p-4">
              <div className="text-sm font-semibold text-zinc-900">Fast decision</div>
              <div className="mt-1 text-sm text-zinc-700">Get a clear answer in seconds.</div>
            </div>
          </div>
        </section>

        <footer className="mt-12 w-full pb-4 text-center text-sm text-zinc-500">
          <div>Car decisions made clearer.</div>
          <p className="mx-auto mt-2 max-w-prose text-xs leading-relaxed text-zinc-500">
            This tool provides estimated analysis based on user input and market data. It is not financial advice.
            Always verify vehicle condition, title status, and compare with real listings before making a purchase.
          </p>
        </footer>
      </div>
    </main>
  )
}
