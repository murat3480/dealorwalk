"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { useCallback, useEffect, useMemo, useState } from "react"
import { formatDealMoney, parseDealCurrency } from "@/src/lib/currency"

type DealRow = {
  id: string
  share_id: string
  created_at: string
  category: string
  title: string
  price: number
  currency?: string | null
  source_url: string | null
  description: string | null
  verdict: string
  deal_score: number
  risk_score: number
  fair_price_low: number
  fair_price_high: number
  explanation: string
  red_flags: unknown
  seller_message: string | null
  recommended_action: string | null
  result_json: Record<string, unknown> | null
  is_public?: boolean | null
}

type CommentRow = {
  id: string
  created_at: string
  verdict: string
  reason: string
  suggested_price: number | null
}

type Summary = {
  total: number
  pct: { deal: number; negotiate: number; walk: number }
}

function verdictLabel(v: string) {
  if (v === "WALK_AWAY") return "Walk"
  if (v === "NEGOTIATE") return "Negotiate"
  if (v === "DEAL") return "Deal"
  return v.replace(/_/g, " ")
}

function verdictCardClass(v: string) {
  if (v === "DEAL") return "border-emerald-200 bg-emerald-50 text-emerald-950"
  if (v === "NEGOTIATE") return "border-amber-200 bg-amber-50 text-amber-950"
  return "border-rose-200 bg-rose-50 text-rose-950"
}

function asRedFlagList(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v.filter((x): x is string => typeof x === "string")
}

function normalizeResultJson(raw: unknown): Record<string, unknown> | null {
  if (!raw) return null
  if (typeof raw === "string") {
    try {
      const p = JSON.parse(raw) as unknown
      return p && typeof p === "object" && !Array.isArray(p) ? (p as Record<string, unknown>) : null
    } catch {
      return null
    }
  }
  if (typeof raw === "object" && !Array.isArray(raw)) return raw as Record<string, unknown>
  return null
}

/** Media URLs are read from `deal.result_json` only (not top-level deal columns). */
function mediaFromResultJson(resultJson: Record<string, unknown> | null): {
  photo: string | null
  video: string | null
} {
  if (!resultJson) return { photo: null, video: null }
  const p = resultJson["media_photo_url"]
  const v = resultJson["media_video_url"]
  const photo = typeof p === "string" && p.trim() ? p.trim() : null
  const video = typeof v === "string" && v.trim() ? v.trim() : null
  return { photo, video }
}

export default function SharedDealPage() {
  const params = useParams()
  const shareId = typeof params?.share_id === "string" ? params.share_id : ""

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deal, setDeal] = useState<DealRow | null>(null)
  const [comments, setComments] = useState<CommentRow[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)

  const [verdict, setVerdict] = useState<"DEAL" | "NEGOTIATE" | "WALK_AWAY">("NEGOTIATE")
  const [reason, setReason] = useState("")
  const [suggestedPrice, setSuggestedPrice] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [copied, setCopied] = useState(false)

  const load = useCallback(async () => {
    if (!shareId) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/deals/${shareId}`)
      const data = (await res.json()) as unknown
      if (!res.ok || !data || typeof data !== "object") {
        setError("Could not load this deal.")
        setDeal(null)
        return
      }
      const d = data as Record<string, unknown>
      if (d.error === "NOT_FOUND") {
        setError("This link is invalid or the deal was removed.")
        setDeal(null)
        return
      }
      setDeal(d.deal as DealRow)
      setComments((d.comments as CommentRow[]) ?? [])
      setSummary(d.summary as Summary)
    } catch {
      setError("Something went wrong.")
      setDeal(null)
    } finally {
      setLoading(false)
    }
  }, [shareId])

  useEffect(() => {
    void load()
  }, [load])

  const dealCurrency = useMemo(() => parseDealCurrency(deal?.currency), [deal?.currency])

  const shareUrl = typeof window !== "undefined" && shareId ? `${window.location.origin}/d/${shareId}` : ""

  function copyLink() {
    if (!shareUrl) return
    void navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function openWhatsApp() {
    if (!shareUrl) return
    const text = encodeURIComponent(`Can you look at this deal and tell me what you think? ${shareUrl}`)
    window.open(`https://wa.me/?text=${text}`, "_blank", "noopener,noreferrer")
  }

  async function submitComment(e: React.FormEvent) {
    e.preventDefault()
    if (!shareId || reason.trim().length < 2) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/deals/${shareId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          verdict,
          reason: reason.trim(),
          suggested_price: suggestedPrice.trim() ? Number(suggestedPrice) : null,
        }),
      })
      const data = (await res.json()) as { comment?: CommentRow; summary?: Summary; error?: string }
      if (!res.ok) {
        setError(data.error ?? "Could not save your response.")
        return
      }
      if (data.comment) {
        setComments((prev) => [...prev, data.comment!])
      }
      if (data.summary) {
        setSummary(data.summary)
      }
      setReason("")
      setSuggestedPrice("")
    } finally {
      setSubmitting(false)
    }
  }

  if (!shareId) {
    return (
      <main className="min-h-screen bg-zinc-50 px-4 py-10 text-zinc-900">
        <p className="text-sm text-zinc-600">Invalid link.</p>
      </main>
    )
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-zinc-50 px-4 py-10 text-zinc-900">
        <p className="text-sm text-zinc-600">Loading…</p>
      </main>
    )
  }

  if (error || !deal) {
    return (
      <main className="min-h-screen bg-zinc-50 px-4 py-10 text-zinc-900">
        <div className="mx-auto max-w-lg rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-800">
          {error ?? "Not found."}
          <div className="mt-4">
            <Link href="/check" className="text-sm font-semibold text-zinc-900 hover:underline">
              Start a new check
            </Link>
          </div>
        </div>
      </main>
    )
  }

  const flags = asRedFlagList(deal.red_flags)
  const resultJson = normalizeResultJson(deal.result_json)
  const { photo: mediaPhoto, video: mediaVideo } = mediaFromResultJson(resultJson)

  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-10 text-zinc-900">
      <div className="mx-auto w-full max-w-2xl">
        <div className="flex items-center justify-between gap-3">
          <Link href="/check" className="text-sm font-semibold text-zinc-900 hover:underline">
            ← New check
          </Link>
          <div className="text-xs text-zinc-500">Private link</div>
        </div>

        {(mediaPhoto || mediaVideo) && (
          <div className="mt-6 space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Uploaded media</div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:items-start">
              {mediaPhoto ? (
                <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-100 shadow-sm sm:col-span-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={mediaPhoto}
                    alt="Photo included with this deal check"
                    className="h-auto w-full max-h-[min(70vh,32rem)] object-contain sm:max-h-80"
                    decoding="async"
                  />
                </div>
              ) : null}
              {mediaVideo ? (
                <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-black shadow-sm sm:col-span-2">
                  <video
                    src={mediaVideo}
                    controls
                    className="max-h-[min(70vh,20rem)] w-full sm:max-h-80"
                    playsInline
                    preload="metadata"
                  />
                </div>
              ) : null}
            </div>
          </div>
        )}

        <h1 className="mt-6 text-2xl font-semibold tracking-tight sm:text-3xl">{deal.title}</h1>
        <p className="mt-2 text-sm text-zinc-600">
          <span className="font-medium capitalize text-zinc-800">{deal.category.replace(/_/g, " ")}</span>
          {" · "}
          <span className="font-semibold text-zinc-900">{formatDealMoney(deal.price, dealCurrency)}</span> ask
        </p>

        <div className={`mt-8 rounded-xl border p-4 ${verdictCardClass(deal.verdict)}`}>
          <div className="text-xs font-semibold uppercase tracking-wide opacity-80">Verdict</div>
          <div className="mt-1 text-2xl font-semibold">{verdictLabel(deal.verdict)}</div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-zinc-200 bg-white p-4">
            <div className="text-xs font-semibold text-zinc-600">Deal score</div>
            <div className="mt-1 text-2xl font-semibold">{deal.deal_score}</div>
            <div className="mt-1 text-xs text-zinc-600">Higher is better (0–100).</div>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-4">
            <div className="text-xs font-semibold text-zinc-600">Risk score</div>
            <div className="mt-1 text-2xl font-semibold">{deal.risk_score}</div>
            <div className="mt-1 text-xs text-zinc-600">Higher usually means lower risk (0–100).</div>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-zinc-200 bg-white p-4">
          <div className="text-xs font-semibold text-zinc-600">Fair price range</div>
          <div className="mt-1 text-lg font-semibold text-zinc-900">
            {formatDealMoney(deal.fair_price_low, dealCurrency)} – {formatDealMoney(deal.fair_price_high, dealCurrency)}
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-zinc-200 bg-white p-4">
          <div className="text-xs font-semibold text-zinc-600">Explanation</div>
          <p className="mt-2 text-sm leading-relaxed text-zinc-900">{deal.explanation}</p>
        </div>

        <div className="mt-4 rounded-xl border border-zinc-200 bg-white p-4">
          <div className="text-xs font-semibold text-zinc-600">Red flags</div>
          {flags.length ? (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-zinc-800">
              {flags.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          ) : (
            <div className="mt-2 text-sm text-zinc-700">None flagged automatically.</div>
          )}
        </div>

        <div className="mt-4 rounded-xl border border-zinc-200 bg-white p-4">
          <div className="text-xs font-semibold text-zinc-600">Seller message</div>
          <p className="mt-2 text-sm leading-relaxed text-zinc-900">
            {deal.seller_message?.trim() ? deal.seller_message : "—"}
          </p>
        </div>

        <div className="mt-4 rounded-xl border border-zinc-200 bg-white p-4">
          <div className="text-xs font-semibold text-zinc-600">Recommended action</div>
          <p className="mt-2 text-sm leading-relaxed text-zinc-900">
            {deal.recommended_action?.trim() ? deal.recommended_action : "—"}
          </p>
        </div>

        <section className="mt-10 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold tracking-tight">Ask your friends</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Only people with this link can view and respond. Invite someone you trust.
          </p>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={copyLink}
              className="inline-flex flex-1 items-center justify-center rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
            >
              {copied ? "Copied" : "Copy link"}
            </button>
            <button
              type="button"
              onClick={openWhatsApp}
              className="inline-flex flex-1 items-center justify-center rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              WhatsApp
            </button>
          </div>

          <div className="mt-3 truncate rounded-xl bg-zinc-50 px-3 py-2 font-mono text-xs text-zinc-700">{shareUrl}</div>
        </section>

        <section className="mt-8 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold tracking-tight">Community snapshot</h2>
          {summary && summary.total > 0 ? (
            <div className="mt-4 space-y-3">
              <div className="text-sm text-zinc-700">
                <span className="font-semibold text-zinc-900">{summary.total}</span> responses
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-3">
                  <div className="font-semibold text-emerald-950">Deal</div>
                  <div className="mt-1 text-lg font-semibold">{summary.pct.deal}%</div>
                </div>
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-3">
                  <div className="font-semibold text-amber-950">Negotiate</div>
                  <div className="mt-1 text-lg font-semibold">{summary.pct.negotiate}%</div>
                </div>
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-2 py-3">
                  <div className="font-semibold text-rose-950">Walk</div>
                  <div className="mt-1 text-lg font-semibold">{summary.pct.walk}%</div>
                </div>
              </div>
            </div>
          ) : (
            <p className="mt-2 text-sm text-zinc-600">No responses yet—be the first to weigh in below.</p>
          )}
        </section>

        <section className="mt-8 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold tracking-tight">Your take</h2>
          <form onSubmit={submitComment} className="mt-4 space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-700">Verdict</label>
              <select
                className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200"
                value={verdict}
                onChange={(e) => setVerdict(e.target.value as typeof verdict)}
              >
                <option value="DEAL">Deal</option>
                <option value="NEGOTIATE">Negotiate</option>
                <option value="WALK_AWAY">Walk</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700">Reason</label>
              <textarea
                className="mt-2 w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200"
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="What would you check, change, or avoid?"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700">Suggested price (optional)</label>
              <input
                className="mt-2 w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200"
                inputMode="decimal"
                value={suggestedPrice}
                onChange={(e) => setSuggestedPrice(e.target.value)}
                placeholder="e.g. 1200"
              />
            </div>
            <button
              type="submit"
              disabled={submitting || reason.trim().length < 2}
              className="inline-flex w-full items-center justify-center rounded-xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Sending…" : "Share feedback"}
            </button>
          </form>
        </section>

        {comments.length > 0 ? (
          <section className="mt-8 space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Responses</h2>
            {comments.map((c) => (
              <div key={c.id} className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-900">
                    {verdictLabel(c.verdict)}
                  </span>
                  {typeof c.suggested_price === "number" ? (
                    <span className="text-xs font-medium text-zinc-700">
                      Suggested {formatDealMoney(c.suggested_price, dealCurrency)}
                    </span>
                  ) : null}
                </div>
                <p className="mt-3 text-sm leading-relaxed text-zinc-800">{c.reason}</p>
              </div>
            ))}
          </section>
        ) : null}

        <footer className="mt-12 pb-6 text-center text-xs text-zinc-500">
          Friends’ opinions are informal. Always verify condition and details yourself.
        </footer>
      </div>
    </main>
  )
}
