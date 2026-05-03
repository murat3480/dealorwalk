export type CarVerdict = "DEAL" | "NEGOTIATE" | "WALK_AWAY"

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

function uniq(items: string[]) {
  const out: string[] = []
  const seen = new Set<string>()
  for (const item of items) {
    const key = item.trim()
    if (!key) continue
    if (seen.has(key)) continue
    seen.add(key)
    out.push(key)
  }
  return out
}

function heuristicFlagsFromText(text: string | null | undefined) {
  if (!text) return []
  const t = text.toLowerCase()
  const flags: string[] = []
  if (t.includes("salvage") || t.includes("rebuilt")) flags.push("Possible title/branding concern (based on listing language)")
  if (t.includes("accident") || t.includes("crash") || t.includes("collision")) flags.push("Damage history mentioned")
  if (t.includes("as-is") || t.includes("as is")) flags.push("As-is sale language")
  if (t.includes("unknown") && (t.includes("service") || t.includes("maintenance"))) flags.push("Unclear maintenance history")
  if (t.includes("cash only") || t.includes("wire")) flags.push("Unusual payment terms mentioned")
  return flags
}

export function mapInternalDecisionToVerdict(internal: string): CarVerdict {
  if (internal === "BUY") return "DEAL"
  if (internal === "NEGOTIATE") return "NEGOTIATE"
  return "WALK_AWAY"
}

export function dealScoreFromSignals(input: {
  verdict: CarVerdict
  absPercentOffFair: number
}) {
  const { verdict, absPercentOffFair } = input
  const magnitude = clamp(absPercentOffFair, 0, 60)

  if (verdict === "DEAL") {
    return clamp(Math.round(92 - magnitude * 0.35), 55, 98)
  }
  if (verdict === "NEGOTIATE") {
    return clamp(Math.round(78 - magnitude * 0.55), 35, 85)
  }
  return clamp(Math.round(45 - magnitude * 0.65), 8, 55)
}

export function nextActionFromVerdict(verdict: CarVerdict) {
  if (verdict === "DEAL") return "If condition checks out on inspection, move forward confidently."
  if (verdict === "NEGOTIATE") return "Send the negotiation message, then pause until the seller responds with a counter."
  return "Skip unless the price drops materially; otherwise keep looking."
}

export function buildCarPresentation(input: {
  internalDecision: string
  vehicleRiskScore: number
  fairLow: number
  fairHigh: number
  priceDifferencePercent: number
  listingDescription: string | null | undefined
  redFlagsFromModel: string[]
}) {
  const verdict = mapInternalDecisionToVerdict(input.internalDecision)
  const absPercent = Math.abs(Number.isFinite(input.priceDifferencePercent) ? input.priceDifferencePercent : 0)

  const deal_score = dealScoreFromSignals({ verdict, absPercentOffFair: absPercent })
  const risk_score = clamp(Math.round(input.vehicleRiskScore), 0, 100)

  const red_flags = uniq([
    ...input.redFlagsFromModel,
    ...heuristicFlagsFromText(input.listingDescription),
  ]).slice(0, 8)

  return {
    verdict,
    deal_score,
    risk_score,
    fair_price_low: input.fairLow,
    fair_price_high: input.fairHigh,
    red_flags,
    recommended_next_action: nextActionFromVerdict(verdict),
  }
}

export type GenericCategory =
  | "electronics"
  | "furniture"
  | "fashion"
  | "real_estate"
  | "other"

export function buildGenericPresentation(input: {
  category: GenericCategory
  askingPrice: number
  fairAnchor: number
  listingDescription: string | null | undefined
  listingUrl: string | null | undefined
}) {
  const fair = Math.max(1, input.fairAnchor)
  const ratio = input.askingPrice / fair

  const verdict: CarVerdict =
    ratio <= 0.97 ? "DEAL" : ratio <= 1.08 ? "NEGOTIATE" : "WALK_AWAY"

  const percentOff = Math.abs(Math.round(((input.askingPrice - fair) / fair) * 1000) / 10)
  const deal_score = dealScoreFromSignals({ verdict, absPercentOffFair: percentOff })

  const descRisk = 68 - Math.min(40, Math.round((input.listingDescription || "").length / 40))
  const urlRisk = input.listingUrl ? 62 : 72
  const categoryRisk =
    input.category === "real_estate" ? 48 : input.category === "electronics" ? 58 : 64

  const risk_score = clamp(Math.round((descRisk + urlRisk + categoryRisk) / 3), 0, 100)

  const flags = uniq([
    ...heuristicFlagsFromText(input.listingDescription),
    ...(input.listingUrl ? [] : ["No listing URL provided (harder to verify details)"]),
    ...(input.listingDescription && input.listingDescription.trim().length < 40
      ? ["Very short description (missing key details)"]
      : []),
  ]).slice(0, 8)

  const fairLow = Math.round(fair * 0.92)
  const fairHigh = Math.round(fair * 1.08)

  return {
    verdict,
    deal_score,
    risk_score,
    fair_price_low: fairLow,
    fair_price_high: fairHigh,
    red_flags: flags,
    recommended_next_action: nextActionFromVerdict(verdict),
  }
}
