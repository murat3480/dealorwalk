import OpenAI from "openai"
import { supabase } from "@/src/lib/supabase"
import { calculateScore, estimateMarketPrice, getDecision } from "@/src/lib/engine"
import { buildCarPresentation, type CarVerdict } from "@/src/lib/dealPresentation"
import type { DealCurrency } from "@/src/lib/currency"
import {
  buildCarProductIntelligence,
  buildExplanationContextClause,
  mergeExplanationWithProductContext,
  type BuyingIntentGuidance,
  type MarketContext,
} from "@/src/lib/productContext"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

function roundTo(value: number, increment: number) {
  return Math.round(value / increment) * increment
}

export type CarAnalysisRequest = {
  /** Asking price in USD (for valuation engine). */
  price: number
  /** User-entered price in their selected currency (stored in `car_inputs` / display). */
  listing_price_original: number
  currency: DealCurrency
  mileage: number
  year: number
  brand: string
  model: string
  state: string | null
  city: string | null
  condition: string
  vehicle_type: string
  listing_url: string | null
  listing_description: string | null
}

export type CarAnalysisResponse = {
  estimate: number
  score: number
  decision: string
  price: number
  mileage: number
  year: number
  condition: string
  brand: string
  model: string
  formula_estimate: number
  ai_estimate_low: number
  ai_estimate_high: number
  final_estimate: number
  price_difference: number
  price_difference_percent: number
  ai_summary: string
  negotiation_script: string
  explanation: string
  red_flags: string[]
  verdict: CarVerdict
  deal_score: number
  risk_score: number
  fair_price_low: number
  fair_price_high: number
  recommended_next_action: string
  car_input_id: string
  car_result_id: string
  market_context: MarketContext
  buying_intent_guidance: BuyingIntentGuidance
}

export async function runCarAnalysis(req: CarAnalysisRequest): Promise<CarAnalysisResponse> {
  const {
    price,
    listing_price_original,
    mileage,
    year,
    brand,
    model,
    state,
    city,
    condition,
    vehicle_type,
    listing_url,
    listing_description,
  } = req

  const formula_estimate = estimateMarketPrice(year, mileage, condition, brand, model)
  const score = calculateScore(year, mileage)
  let estimate = formula_estimate
  let decision = getDecision(price, estimate)
  let ai_estimate_low = estimate
  let ai_estimate_high = estimate
  let negotiation_script = ""
  let ai_summary = "Analysis completed, but AI summary could not be generated."
  let redFlags: string[] = []
  let explanationForDeal =
    "We could not generate a tailored explanation. Use the fair range and scores below as a starting point."

  const prompt = `
You are a car buying expert.

Important:
Do not use the asking price to determine fair market value. Use it only after valuation to compare whether the listing is overpriced or underpriced.

Return ONLY valid JSON exactly matching this schema (no extra keys):
{
  "explanation": string,
  "message_to_seller": string,
  "red_flags": string[]
}

Constraints:
- explanation: 2-3 short sentences, professional tone, mention price vs market + mileage/condition + any red flags if present, and include a clear action/implication. Avoid generic phrases like "competitive offer would be advisable". No labels. No bullet points. Do not invent or suggest different numbers than the provided Recommended Offer.
- message_to_seller: 1 short sentence, confident, market-based, no emotional language. No labels. No bullet points. Do not say "fair offer". Use this exact phrasing pattern and the exact Recommended Offer number: "Based on current market value and mileage, I’d be comfortable moving forward at $X."
- red_flags: 0-5 short items. Only include real concerns implied by the listing description (or empty array if none). No bullet characters inside strings.
- Do not include markdown, code fences, or any text outside JSON

Context:
- Brand: ${brand}
- Model: ${model}
- Year: ${year}
- Mileage: ${mileage}
- Condition: ${condition}
- Vehicle type: ${vehicle_type}
- State: ${state ?? ""}
- City: ${city ?? ""}
- Listing description: ${listing_description ?? ""}

Normalized outputs (use these numbers exactly where relevant):
- Asking price: ${price}
- Final estimate: ${estimate}
`

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
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

    estimate = roundTo(estimate, 250)

    const modelLower = (model || "").toLowerCase()
    const vt = (vehicle_type || "auto").toLowerCase()

    const TRUCK = ["silverado", "f-150", "ram", "tacoma", "tundra", "sierra", "frontier", "ridgeline"]
    const SUV = [
      "cr-v",
      "rav4",
      "highlander",
      "pilot",
      "explorer",
      "escape",
      "x5",
      "x3",
      "cx-5",
      "kona",
      "sportage",
      "sorento",
      "tucson",
    ]
    const SEDAN = [
      "corolla",
      "civic",
      "camry",
      "accord",
      "altima",
      "elantra",
      "sonata",
      "malibu",
      "fusion",
      "a4",
      "3 series",
      "5 series",
    ]

    const detectedSegment =
      vt === "truck"
        ? "TRUCK"
        : vt === "suv"
          ? "SUV"
          : vt === "sedan" || vt === "hatchback"
            ? "SEDAN"
            : vt === "coupe" || vt === "van"
              ? "OTHER"
              : TRUCK.some((k) => modelLower.includes(k))
                ? "TRUCK"
                : SUV.some((k) => modelLower.includes(k))
                  ? "SUV"
                  : SEDAN.some((k) => modelLower.includes(k))
                    ? "SEDAN"
                    : "OTHER"

    const age = 2026 - year
    const conditionLower = (condition || "").toLowerCase()
    const descLower = (listing_description || "").toLowerCase()

    const junkKeywords = [
      "salvage",
      "rebuilt",
      "non-running",
      "non running",
      "nonrunning",
      "won't start",
      "wont start",
      "engine",
      "transmission",
      "mechanical issue",
      "mechanical issues",
      "major damage",
      "frame damage",
      "flood",
      "parts",
    ]

    const hasMajorIssueMention = junkKeywords.some((k) => descLower.includes(k))

    const allowTwoThousandOnly =
      age >= 20 && conditionLower === "poor" && mileage >= 250000 && hasMajorIssueMention

    const yearFloor =
      year >= 2020 ? 12000 : year >= 2017 ? 8000 : year >= 2014 ? 6000 : year >= 2010 ? 4500 : year >= 2005 ? 3000 : 2000

    const segmentFloor =
      detectedSegment === "TRUCK" && year >= 2010
        ? 10000
        : detectedSegment === "SUV" && year >= 2012
          ? 8000
          : detectedSegment === "SEDAN" && year >= 2010
            ? 4500
            : 2000

    const marketFloor = Math.max(yearFloor, segmentFloor)

    if (!allowTwoThousandOnly && estimate < marketFloor) {
      estimate = marketFloor
    }

    let fairLow = roundTo(estimate * 0.9, 500)
    let fairHigh = roundTo(estimate * 1.1, 500)
    if (fairLow > estimate) fairLow = roundTo(estimate, 500)
    if (fairHigh < estimate) fairHigh = roundTo(estimate, 500)

    ai_estimate_low = fairLow
    ai_estimate_high = fairHigh

    if (price <= estimate * 0.95) decision = "BUY"
    else if (price <= estimate * 1.15) decision = "NEGOTIATE"
    else decision = "WALK_AWAY"

    let recommendedOffer =
      decision === "BUY" ? Math.min(price, estimate * 0.95) : decision === "NEGOTIATE" ? estimate * 0.9 : estimate * 0.85
    recommendedOffer = roundTo(recommendedOffer, 500)

    let finalWalkAway = roundTo(fairHigh, 500)
    if (finalWalkAway < recommendedOffer) finalWalkAway = roundTo(recommendedOffer + 500, 500)

    const recommendedOfferText = Math.round(recommendedOffer).toLocaleString("en-US")
    const fairLowText = Math.round(fairLow).toLocaleString("en-US")
    const fairHighText = Math.round(fairHigh).toLocaleString("en-US")
    const finalWalkAwayText = Math.round(finalWalkAway).toLocaleString("en-US")

    let cleanExplanation = explanation
      .replace(/^\s*[-*]\s*/gm, "")
      .replace(/\s*\n+\s*/g, " ")
      .trim()

    const explanationOfferRef = `$${recommendedOfferText}`
    if (decision === "BUY") {
      cleanExplanation = `This looks like a fair deal for the current market. You could try a small negotiation closer to ${explanationOfferRef}, but it’s already reasonably priced.`
    } else if (decision === "NEGOTIATE") {
      cleanExplanation = `This is priced above fair value. Only proceed if the price comes down to around ${explanationOfferRef}.`
    } else {
      cleanExplanation = `This is priced above fair value. Only proceed if the price comes down to around ${explanationOfferRef}.`
    }
    const cleanMessageToSeller = `Based on current market value and mileage, I’d be comfortable moving forward at $${recommendedOfferText}.`

    explanationForDeal = cleanExplanation

    redFlags = parsedFlags

    const heuristicFlags: string[] = []
    if (descLower.includes("salvage") || descLower.includes("rebuilt")) heuristicFlags.push("Title/branding risk mentioned in listing text")
    if (descLower.includes("accident") || descLower.includes("damage")) heuristicFlags.push("Damage history mentioned in listing text")
    if (descLower.includes("as-is") || descLower.includes("as is")) heuristicFlags.push("Sold as-is (limited recourse)")
    if (mileage >= 200000) heuristicFlags.push("Very high mileage for the age")

    redFlags = Array.from(new Set([...redFlags, ...heuristicFlags])).slice(0, 8)

    ai_summary = `Fair Price Range: $${fairLowText} - $${fairHighText}
Recommended Offer: $${recommendedOfferText}
Walk Away Price: $${finalWalkAwayText}

Explanation:
${cleanExplanation}

Message to Seller:
${cleanMessageToSeller}`

    negotiation_script = cleanMessageToSeller
  } catch (openAiError) {
    console.error("OpenAI error:", openAiError)
  }

  const final_price_difference = price - estimate
  const final_price_difference_percent = Math.round(((price - estimate) / estimate) * 1000) / 10

  const { data: input, error: inputError } = await supabase
    .from("car_inputs")
    .insert([
      {
        price: listing_price_original,
        mileage,
        year,
        brand,
        model,
        state,
        city,
        condition,
        listing_url,
        listing_description,
      },
    ])
    .select()
    .single()

  if (inputError) {
    throw new Error(`SUPABASE_ERROR:${inputError.message}`)
  }

  const { data: carResultRow, error: resultError } = await supabase
    .from("car_results")
    .insert([
      {
        input_id: input.id,
        market_estimate: estimate,
        risk_score: score,
        final_score: score,
        decision,
        ai_summary,
      },
    ])
    .select("id")
    .single()

  if (resultError || !carResultRow) {
    throw new Error(`SUPABASE_ERROR:${resultError?.message ?? "car_results insert failed"}`)
  }

  const presentation = buildCarPresentation({
    internalDecision: decision,
    vehicleRiskScore: score,
    fairLow: ai_estimate_low,
    fairHigh: ai_estimate_high,
    priceDifferencePercent: final_price_difference_percent,
    listingDescription: listing_description,
    redFlagsFromModel: redFlags,
  })

  const carIntel = buildCarProductIntelligence({
    listingDescription: listing_description ?? "",
    brand,
    model,
    year,
    askingPrice: price,
    fairLow: presentation.fair_price_low,
    fairHigh: presentation.fair_price_high,
    verdict: presentation.verdict,
  })
  const explanationWithContext = mergeExplanationWithProductContext(
    explanationForDeal,
    buildExplanationContextClause(
      carIntel.market_context.product_type,
      carIntel.market_context.authenticity_signal,
      "vehicles",
    ),
  )

  return {
    estimate,
    score,
    decision,
    price,
    mileage,
    year,
    condition,
    brand,
    model,
    formula_estimate,
    ai_estimate_low,
    ai_estimate_high,
    final_estimate: estimate,
    price_difference: final_price_difference,
    price_difference_percent: final_price_difference_percent,
    ai_summary,
    negotiation_script,
    explanation: explanationWithContext,
    red_flags: presentation.red_flags,
    verdict: presentation.verdict,
    deal_score: presentation.deal_score,
    risk_score: presentation.risk_score,
    fair_price_low: presentation.fair_price_low,
    fair_price_high: presentation.fair_price_high,
    recommended_next_action: presentation.recommended_next_action,
    car_input_id: input.id,
    car_result_id: carResultRow.id as string,
    market_context: carIntel.market_context,
    buying_intent_guidance: carIntel.buying_intent_guidance,
  }
}
