import type { GenericCategory } from "@/src/lib/dealPresentation"

export type ProductType = "design_object" | "commodity" | "collectible" | "mixed"

export type AuthenticitySignal = "original" | "replica" | "unknown"

export type MarketTier = {
  label: string
  low: number
  high: number
}

export type IntentRating = "good" | "neutral" | "bad"

export type MarketContext = {
  product_type: ProductType
  authenticity_signal: AuthenticitySignal
  market_tiers: MarketTier[]
}

export type BuyingIntentGuidance = {
  usage: IntentRating
  investment: IntentRating
}

function roundBand(n: number) {
  return Math.max(0, Math.round(n / 10) * 10)
}

function clampLow(low: number, high: number) {
  if (high <= low) return { low: Math.max(0, low - 10), high: low + 10 }
  return { low: Math.max(0, low), high }
}

/** Builds three contextual price bands around the fair range (not separate valuations). */
export function buildMarketTiers(fairLow: number, fairHigh: number, askingPrice: number): MarketTier[] {
  const low = Math.max(1, fairLow)
  const high = Math.max(low + 1, fairHigh)
  const mid = (low + high) / 2
  const span = Math.max(high - low, askingPrice * 0.08, mid * 0.06)

  const a = clampLow(roundBand(low - span * 0.35), roundBand(low))
  const b = clampLow(roundBand(low), roundBand(high))
  const c = clampLow(roundBand(high), roundBand(high + span * 0.4))

  return [
    { label: "Lower / heavier wear comps", low: a.low, high: a.high },
    { label: "Typical transaction band", low: b.low, high: b.high },
    { label: "Cleaner / premium comps", low: c.low, high: c.high },
  ]
}

function inferAuthenticity(text: string): AuthenticitySignal {
  const t = text.toLowerCase()
  if (
    /\breplica\b|\brepro(duction)?\b|\bfake\b|\bknock[\s-]?off\b|\bcounterfeit\b|\bcopy\b|\blookalike\b/i.test(t)
  ) {
    return "replica"
  }
  if (
    /\bauthentic\b|\bgenuine\b|\boriginal\b|\boem\b|\bserial\b|\bproof of purchase\b|\bcertificate\b|\bcoa\b/i.test(t)
  ) {
    return "original"
  }
  return "unknown"
}

function inferProductTypeGeneric(category: GenericCategory, description: string): ProductType {
  const t = description.toLowerCase()

  const designHints =
    /\b(eames|herman miller|vitra|knoll|wegner|jacobsen|designer|iconic|mid[\s-]?century|bauhaus|memphis milano)\b/i
  const collectibleHints =
    /\b(collectible|limited edition|numbered|vintage|rare|first edition|discontinued|grail|archive)\b/i
  const commodityHints =
    /\b(mass market|consumer grade|big[\s-]?box|refurb|open box|bulk)\b/i

  if (designHints.test(t)) return "design_object"
  if (collectibleHints.test(t)) return "collectible"
  if (commodityHints.test(t)) return "commodity"

  if (category === "fashion" || category === "furniture") {
    if (/art\b|sculpture|gallery|studio/i.test(t)) return "design_object"
    if (/vintage|patina|wood\b|hand[\s-]?made/i.test(t)) return "mixed"
  }
  if (category === "electronics") return "commodity"
  if (category === "real_estate") return "commodity"
  return "mixed"
}

function inferProductTypeCar(description: string, brand: string, model: string, year: number): ProductType {
  const t = `${description} ${brand} ${model}`.toLowerCase()
  const age = 2026 - year

  if (
    /\b(classic|collector|collectible|garage kept|low miles|investment|show car|restored|numbers matching)\b/i.test(t)
  ) {
    return "collectible"
  }
  if (year <= 1995 || age >= 28) return "collectible"
  if (/\b(corolla|civic|camry|elantra|sentra|forte|altima|malibu|impala|fusion)\b/i.test(t)) return "commodity"
  if (/\b(m|amg|rs|type r|gt\b|ss\b|track pack)\b/i.test(t)) return "mixed"
  return "commodity"
}

function deriveBuyingIntent(
  verdict: "DEAL" | "NEGOTIATE" | "WALK_AWAY",
  productType: ProductType,
  authenticity: AuthenticitySignal,
): BuyingIntentGuidance {
  if (authenticity === "replica") {
    return { usage: "bad", investment: "bad" }
  }

  if (verdict === "WALK_AWAY") {
    return { usage: "bad", investment: "bad" }
  }

  if (verdict === "DEAL") {
    const usage: IntentRating =
      productType === "commodity" ? "good" : productType === "design_object" || productType === "collectible" ? "good" : "neutral"
    let investment: IntentRating = "neutral"
    if (productType === "collectible") investment = "good"
    else if (productType === "commodity") investment = "neutral"
    else if (productType === "design_object") investment = authenticity === "original" ? "neutral" : "neutral"
    return { usage, investment }
  }

  // NEGOTIATE
  const usage: IntentRating = productType === "commodity" ? "neutral" : "neutral"
  let investment: IntentRating = "neutral"
  if (productType === "collectible") investment = "neutral"
  if (productType === "design_object" && authenticity === "original") investment = "neutral"
  return { usage, investment }
}

function productTypeLabel(p: ProductType): string {
  if (p === "design_object") return "a design-led or iconic piece"
  if (p === "commodity") return "a mass-market / utility purchase"
  if (p === "collectible") return "a collectible or enthusiast-oriented item"
  return "a mixed market (part everyday, part specialty)"
}

function authenticityLabel(a: AuthenticitySignal): string {
  if (a === "original") return "authenticity reads as original or documented"
  if (a === "replica") return "replica or reproduction signals present"
  return "authenticity is unclear from the listing"
}

/** One sentence to weave into the explanation (category / market framing). */
export function buildExplanationContextClause(
  productType: ProductType,
  authenticity: AuthenticitySignal,
  categoryLabel: string,
): string {
  return `Market context: this sits as ${productTypeLabel(productType)} in ${categoryLabel}; ${authenticityLabel(authenticity)}.`
}

export type ProductIntelligence = {
  market_context: MarketContext
  buying_intent_guidance: BuyingIntentGuidance
}

export function buildGenericProductIntelligence(input: {
  category: GenericCategory
  listingDescription: string
  askingPrice: number
  fairLow: number
  fairHigh: number
  verdict: "DEAL" | "NEGOTIATE" | "WALK_AWAY"
}): ProductIntelligence {
  const description = input.listingDescription || ""
  const product_type = inferProductTypeGeneric(input.category, description)
  const authenticity_signal = inferAuthenticity(description)
  const market_tiers = buildMarketTiers(input.fairLow, input.fairHigh, input.askingPrice)
  const buying_intent_guidance = deriveBuyingIntent(input.verdict, product_type, authenticity_signal)

  return {
    market_context: { product_type, authenticity_signal, market_tiers },
    buying_intent_guidance,
  }
}

export function buildCarProductIntelligence(input: {
  listingDescription: string
  brand: string
  model: string
  year: number
  askingPrice: number
  fairLow: number
  fairHigh: number
  verdict: "DEAL" | "NEGOTIATE" | "WALK_AWAY"
}): ProductIntelligence {
  const description = input.listingDescription || ""
  const product_type = inferProductTypeCar(description, input.brand, input.model, input.year)
  const authenticity_signal = inferAuthenticity(description)
  const market_tiers = buildMarketTiers(input.fairLow, input.fairHigh, input.askingPrice)
  const buying_intent_guidance = deriveBuyingIntent(input.verdict, product_type, authenticity_signal)

  return {
    market_context: { product_type, authenticity_signal, market_tiers },
    buying_intent_guidance,
  }
}

export function mergeExplanationWithProductContext(
  baseExplanation: string,
  contextSentence: string,
): string {
  const base = baseExplanation.trim()
  const ctx = contextSentence.trim()
  if (!base) return ctx
  if (!ctx) return base
  if (base.toLowerCase().includes("market context:")) return base
  return `${ctx} ${base}`
}
