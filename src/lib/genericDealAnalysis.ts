import OpenAI from "openai"
import type { DealCurrency } from "@/src/lib/currency"
import { buildGenericPresentation, type GenericCategory } from "@/src/lib/dealPresentation"
import {
  buildExplanationContextClause,
  buildGenericProductIntelligence,
  mergeExplanationWithProductContext,
  type BuyingIntentGuidance,
  type MarketContext,
} from "@/src/lib/productContext"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

function roundMoney(n: number) {
  return Math.round(n / 10) * 10
}

function keywordRiskAdjustment(description: string) {
  const t = description.toLowerCase()
  let penalty = 0

  const severe = ["broken", "doesn't work", "does not work", "not working", "no power", "water damage", "cracked screen"]
  const moderate = ["scratch", "scratches", "wear", "stains", "dent", "needs repair", "for parts"]
  const suspicious = ["cash only", "must sell today", "urgent", "as-is", "as is"]

  if (severe.some((k) => t.includes(k))) penalty += 0.14
  if (moderate.some((k) => t.includes(k))) penalty += 0.06
  if (suspicious.some((k) => t.includes(k))) penalty += 0.05

  return clamp(penalty, 0, 0.35)
}

function fairAnchorFromSignals(input: {
  category: GenericCategory
  askingPrice: number
  description: string
  hasUrl: boolean
}) {
  const { category, askingPrice, description, hasUrl } = input
  const desc = description || ""

  const baseCategoryShift =
    category === "real_estate" ? 0.0 : category === "electronics" ? -0.01 : category === "fashion" ? 0.0 : 0.0

  const shortDesc = desc.trim().length < 40 ? 0.04 : 0
  const noUrl = hasUrl ? 0 : 0.03

  const keyword = keywordRiskAdjustment(desc)

  const combined = clamp(baseCategoryShift - keyword - shortDesc - noUrl, -0.25, 0.1)
  return roundMoney(askingPrice * (1 + combined))
}

function categoryLabel(category: GenericCategory) {
  switch (category) {
    case "electronics":
      return "Electronics"
    case "furniture":
      return "Furniture"
    case "fashion":
      return "Fashion"
    case "real_estate":
      return "Real estate"
    case "other":
    default:
      return "Other"
  }
}

export type GenericDealRequest = {
  category: GenericCategory
  price: number
  listing_url: string | null
  listing_description: string | null
  photo_included: boolean
  video_included: boolean
}

export type GenericDealResponse = {
  engine: "generic"
  category: GenericCategory
  price: number
  decision: "BUY" | "NEGOTIATE" | "WALK_AWAY"
  fair_anchor: number
  price_difference: number
  price_difference_percent: number
  ai_summary: string
  negotiation_script: string
  explanation: string
  verdict: "DEAL" | "NEGOTIATE" | "WALK_AWAY"
  deal_score: number
  risk_score: number
  fair_price_low: number
  fair_price_high: number
  red_flags: string[]
  recommended_next_action: string
  assets: { photo_included: boolean; video_included: boolean }
  market_context: MarketContext
  buying_intent_guidance: BuyingIntentGuidance
  /** Set after localization in `executeDealAnalysis`; omitted during raw USD assembly. */
  currency?: DealCurrency
}

export async function runGenericDealAnalysis(req: GenericDealRequest): Promise<GenericDealResponse> {
  const description = (req.listing_description || "").trim()
  const hasUrl = Boolean(req.listing_url && req.listing_url.trim().length > 0)

  const fair_anchor = fairAnchorFromSignals({
    category: req.category,
    askingPrice: req.price,
    description,
    hasUrl,
  })

  const presentation = buildGenericPresentation({
    category: req.category,
    askingPrice: req.price,
    fairAnchor: fair_anchor,
    listingDescription: description,
    listingUrl: req.listing_url,
  })

  const productIntel = buildGenericProductIntelligence({
    category: req.category,
    listingDescription: description,
    askingPrice: req.price,
    fairLow: presentation.fair_price_low,
    fairHigh: presentation.fair_price_high,
    verdict: presentation.verdict,
  })
  const explanationContext = buildExplanationContextClause(
    productIntel.market_context.product_type,
    productIntel.market_context.authenticity_signal,
    categoryLabel(req.category),
  )

  const price_difference = req.price - fair_anchor
  const price_difference_percent = Math.round(((req.price - fair_anchor) / fair_anchor) * 1000) / 10

  const internalDecision: GenericDealResponse["decision"] =
    presentation.verdict === "DEAL" ? "BUY" : presentation.verdict === "NEGOTIATE" ? "NEGOTIATE" : "WALK_AWAY"

  const fairLowText = presentation.fair_price_low.toLocaleString("en-US")
  const fairHighText = presentation.fair_price_high.toLocaleString("en-US")
  const askText = Math.round(req.price).toLocaleString("en-US")

  let negotiation_script = ""
  let ai_summary = "Analysis completed, but AI summary could not be generated."

  const prompt = `
You help buyers evaluate marketplace listings.

Return ONLY valid JSON exactly matching this schema (no extra keys):
{
  "explanation": string,
  "message_to_seller": string,
  "red_flags": string[]
}

Hard rules:
- In explanation, acknowledge product/market context (mass-market vs design-led vs collectible-style) in plain language when it fits the category and description.
- Do NOT claim you inspected photos/videos. Media may be provided by the app separately.
- Use ONLY these numeric anchors when referencing value:
  - Asking price: $${askText}
  - Fair range (rough anchor): $${fairLowText} - $${fairHighText}
- Keep it practical and non-legal. No bullet characters in strings. No markdown.

Context:
- Category: ${categoryLabel(req.category)}
- Listing URL: ${req.listing_url ?? ""}
- Description: ${description}
- App market hints (for narrative only): product archetype ${productIntel.market_context.product_type}, authenticity signal ${productIntel.market_context.authenticity_signal}
`

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: prompt }],
    })

    const content = completion.choices[0]?.message?.content || ""
    const parsed = JSON.parse(content) as {
      explanation?: unknown
      message_to_seller?: unknown
      red_flags?: unknown
    }

    const explanation = typeof parsed.explanation === "string" ? parsed.explanation.trim() : ""
    const messageToSeller =
      typeof parsed.message_to_seller === "string" ? parsed.message_to_seller.trim() : ""

    const parsedFlags = Array.isArray(parsed.red_flags)
      ? parsed.red_flags
          .filter((x): x is string => typeof x === "string")
          .map((s) => s.trim())
          .filter(Boolean)
      : []

    const mergedFlags = Array.from(new Set([...presentation.red_flags, ...parsedFlags])).slice(0, 8)

    const explanationBody =
      explanation ||
      "This is a quick sanity check based on your description and asking price. Treat it as a starting point, not a guarantee."
    const explanationMerged = mergeExplanationWithProductContext(explanationBody, explanationContext)

    negotiation_script =
      messageToSeller ||
      `I’m interested at $${Math.round(req.price * (internalDecision === "BUY" ? 0.98 : 0.95)).toLocaleString("en-US")} given what’s described—can you confirm condition and what’s included?`

    ai_summary = `Fair Price Range (rough anchor): $${fairLowText} - $${fairHighText}

Explanation:
${explanationMerged}

Message to Seller:
${negotiation_script}

Red flags:
${mergedFlags.length ? mergedFlags.map((x) => `- ${x}`).join("\n") : "- None obvious from the text you provided"}`

    return {
      engine: "generic",
      category: req.category,
      price: req.price,
      decision: internalDecision,
      fair_anchor,
      price_difference,
      price_difference_percent,
      ai_summary,
      negotiation_script,
      explanation: explanationMerged,
      verdict: presentation.verdict,
      deal_score: presentation.deal_score,
      risk_score: presentation.risk_score,
      fair_price_low: presentation.fair_price_low,
      fair_price_high: presentation.fair_price_high,
      red_flags: mergedFlags,
      recommended_next_action: presentation.recommended_next_action,
      assets: { photo_included: req.photo_included, video_included: req.video_included },
      market_context: productIntel.market_context,
      buying_intent_guidance: productIntel.buying_intent_guidance,
    }
  } catch (e) {
    console.error("OpenAI error (generic deal):", e)
    negotiation_script = `I’m interested—before I commit at $${askText}, can you confirm condition, what’s included, and any issues not shown in the listing?`
    const fallbackExplanation = mergeExplanationWithProductContext(
      "This is a quick sanity check based on your description and asking price. Treat it as a starting point, not a guarantee.",
      explanationContext,
    )
    ai_summary = `Fair Price Range (rough anchor): $${fairLowText} - $${fairHighText}

Explanation:
${fallbackExplanation}

Message to Seller:
${negotiation_script}

Red flags:
${presentation.red_flags.length ? presentation.red_flags.map((x) => `- ${x}`).join("\n") : "- None obvious from the text you provided"}`

    return {
      engine: "generic",
      category: req.category,
      price: req.price,
      decision: internalDecision,
      fair_anchor,
      price_difference,
      price_difference_percent,
      ai_summary,
      negotiation_script,
      explanation: fallbackExplanation,
      verdict: presentation.verdict,
      deal_score: presentation.deal_score,
      risk_score: presentation.risk_score,
      fair_price_low: presentation.fair_price_low,
      fair_price_high: presentation.fair_price_high,
      red_flags: presentation.red_flags,
      recommended_next_action: presentation.recommended_next_action,
      assets: { photo_included: req.photo_included, video_included: req.video_included },
      market_context: productIntel.market_context,
      buying_intent_guidance: productIntel.buying_intent_guidance,
    }
  }
}
