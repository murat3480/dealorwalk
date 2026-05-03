"use client"

import { formatDealMoney, parseDealCurrency } from "@/src/lib/currency"

export type DealVerdict = "DEAL" | "NEGOTIATE" | "WALK_AWAY"

export function isDealResult(value: unknown): value is {
  verdict: DealVerdict
  deal_score: number
  risk_score: number
  fair_price_low: number
  fair_price_high: number
  red_flags: string[]
  negotiation_script?: string
  recommended_next_action: string
} {
  if (!value || typeof value !== "object") return false
  const v = value as Record<string, unknown>
  return (
    (v.verdict === "DEAL" || v.verdict === "NEGOTIATE" || v.verdict === "WALK_AWAY") &&
    typeof v.deal_score === "number" &&
    typeof v.risk_score === "number" &&
    typeof v.fair_price_low === "number" &&
    typeof v.fair_price_high === "number" &&
    Array.isArray(v.red_flags) &&
    v.red_flags.every((x) => typeof x === "string") &&
    typeof v.recommended_next_action === "string"
  )
}

function verdictStyles(verdict: DealVerdict) {
  if (verdict === "DEAL") return "border-emerald-200 bg-emerald-50 text-emerald-950"
  if (verdict === "NEGOTIATE") return "border-amber-200 bg-amber-50 text-amber-950"
  return "border-rose-200 bg-rose-50 text-rose-950"
}

export function DealResultPanel(props: { result: unknown; negotiationLabel?: string }) {
  const { result, negotiationLabel = "Negotiation Message" } = props

  const currency = parseDealCurrency((result as Record<string, unknown>).currency)

  if (!isDealResult(result)) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-700">
        Unexpected response shape. Try again.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className={`rounded-xl border p-4 ${verdictStyles(result.verdict)}`}>
        <div className="text-xs font-semibold uppercase tracking-wide opacity-80">Verdict</div>
        <div className="mt-1 text-2xl font-semibold">{result.verdict.replace(/_/g, " ")}</div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          <div className="text-xs font-semibold text-zinc-600">Deal Score</div>
          <div className="mt-1 text-2xl font-semibold">{result.deal_score}</div>
          <div className="mt-1 text-xs text-zinc-600">Higher is better (0–100).</div>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          <div className="text-xs font-semibold text-zinc-600">Risk Score</div>
          <div className="mt-1 text-2xl font-semibold">{result.risk_score}</div>
          <div className="mt-1 text-xs text-zinc-600">Higher usually means lower risk (0–100).</div>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        <div className="text-xs font-semibold text-zinc-600">Fair Price Range</div>
        <div className="mt-1 text-lg font-semibold text-zinc-900">
          {formatDealMoney(result.fair_price_low, currency)} – {formatDealMoney(result.fair_price_high, currency)}
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        <div className="text-xs font-semibold text-zinc-600">Red Flags</div>
        {result.red_flags.length ? (
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-zinc-800">
            {result.red_flags.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        ) : (
          <div className="mt-2 text-sm text-zinc-700">None flagged automatically.</div>
        )}
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        <div className="text-xs font-semibold text-zinc-600">{negotiationLabel}</div>
        <p className="mt-2 text-sm text-zinc-900">
          {typeof result.negotiation_script === "string" && result.negotiation_script.trim().length
            ? result.negotiation_script
            : "No message returned."}
        </p>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        <div className="text-xs font-semibold text-zinc-600">Recommended Next Action</div>
        <p className="mt-2 text-sm text-zinc-900">{result.recommended_next_action}</p>
      </div>
    </div>
  )
}
