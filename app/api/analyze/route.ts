import OpenAI from "openai"
import { supabase } from "@/src/lib/supabase"
import { estimateMarketPrice, calculateScore, getDecision } from "@/src/lib/engine"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

function roundTo(value: number, increment: number) {
  return Math.round(value / increment) * increment
}

export async function POST(req: Request) {
  try {
    const body = await req.json()

    const price = Number(body.price)
    const mileage = Number(body.mileage)
    const year = Number(body.year)
    const brand = body.brand || ""
    const model = body.model || ""
    const state = body.state ?? null
    const city = body.city ?? null
    const condition = body.condition || "good"
    const listing_url = body.listing_url ?? null
    const listing_description = body.listing_description ?? null

    if (!price || !mileage || !year) {
      return Response.json(
        { error: "VALIDATION_ERROR", message: "price, mileage and year are required" },
        { status: 400 }
      )
    }

    console.log("brand:", brand, "model:", model)

    const formula_estimate = estimateMarketPrice(year, mileage, condition, brand, model)
    const score = calculateScore(year, mileage)
    let estimate = formula_estimate
    let decision = getDecision(price, estimate)
    let ai_estimate_low = estimate
    let ai_estimate_high = estimate
    let negotiation_script = ""
    let ai_summary = "Analysis completed, but AI summary could not be generated."

    const price_difference = price - estimate
    const price_difference_percent =
      Math.round(((price - estimate) / estimate) * 1000) / 10

    const prompt = `
You are a car buying expert.

Goal:
Estimate a realistic fair market price range for this exact car. The asking price is for comparison only; do NOT treat it as fair price by default.
Always generate a fair market price range.

Return ONLY valid JSON exactly matching this schema (no extra keys):
{
  "ai_estimate_low": number,
  "ai_estimate_high": number,
  "recommended_offer": number,
  "walk_away_price": number,
  "explanation": string,
  "message_to_seller": string
}

Constraints:
- ai_estimate_low and ai_estimate_high must be numbers (low < high)
- recommended_offer and walk_away_price must be numbers, and walk_away_price MUST be higher than recommended_offer
- explanation: 2-3 short sentences, professional tone, mention price vs market + mileage/condition + any red flags if present. No labels. No bullet points.
- message_to_seller: 1 short sentence, confident, market-based, no emotional language. No labels. No bullet points. Do not say "fair offer". Use this exact phrasing pattern: "Based on current market value and mileage, I’d be comfortable moving forward at $X."
- Do not include markdown, code fences, or any text outside JSON

Inputs:
- Brand: ${brand}
- Model: ${model}
- Year: ${year}
- Mileage: ${mileage}
- Condition: ${condition}
- Asking price: ${price}
- State: ${state ?? ""}
- City: ${city ?? ""}
- Listing description: ${listing_description ?? ""}
- Formula estimate (internal reference only): ${formula_estimate}
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
        ai_estimate_low?: unknown
        ai_estimate_high?: unknown
        recommended_offer?: unknown
        walk_away_price?: unknown
        explanation?: unknown
        message_to_seller?: unknown
      }

      const low = Number(parsed.ai_estimate_low)
      const high = Number(parsed.ai_estimate_high)
      const offer = Number(parsed.recommended_offer)
      const walkAway = Number(parsed.walk_away_price)
      const explanation = typeof parsed.explanation === "string" ? parsed.explanation.trim() : ""
      const messageToSeller =
        typeof parsed.message_to_seller === "string" ? parsed.message_to_seller.trim() : ""

      if (Number.isFinite(low) && Number.isFinite(high) && low > 0 && high > low) {
        const roundedLow = roundTo(low, 500)
        const roundedHigh = roundTo(high, 500)
        ai_estimate_low = Math.min(roundedLow, roundedHigh)
        ai_estimate_high = Math.max(roundedLow, roundedHigh)

        const rawMidpoint = (low + high) / 2
        estimate = rawMidpoint
      } else {
        estimate = formula_estimate
      }

      if (price <= estimate * 0.95) decision = "BUY"
      else if (price <= estimate * 1.15) decision = "NEGOTIATE"
      else decision = "WALK_AWAY"

      estimate = roundTo(estimate, 250)

      const finalOffer = roundTo(estimate * 0.97, 500)

      let finalWalkAway = roundTo(ai_estimate_high as number, 500)
      if (!Number.isFinite(finalWalkAway) || finalWalkAway <= 0) finalWalkAway = Math.round(estimate * 1.05)

      if (finalWalkAway <= finalOffer) finalWalkAway = finalOffer + 500

      const askingInsideFairRange =
        Number.isFinite(ai_estimate_low as number) &&
        Number.isFinite(ai_estimate_high as number) &&
        price >= (ai_estimate_low as number) &&
        price <= (ai_estimate_high as number)

      if (askingInsideFairRange && (decision === "BUY" || decision === "NEGOTIATE") && finalWalkAway < price) {
        finalWalkAway = roundTo(price, 500)
      }

      const cleanExplanation = explanation
        .replace(/^\s*[-*]\s*/gm, '')
        .replace(/\s*\n+\s*/g, ' ')
        .trim()
      const cleanMessageToSeller = messageToSeller
        .replace(/^"+|"+$/g, '')
        .replace(/\s*\n+\s*/g, ' ')
        .trim()

      ai_summary = `Fair Price Range: $${Math.round(ai_estimate_low as number)} - $${Math.round(ai_estimate_high as number)}
Recommended Offer: $${Math.round(finalOffer)}
Walk Away Price: $${Math.round(finalWalkAway)}

Explanation:
${cleanExplanation}

Message to Seller:
${cleanMessageToSeller}`

      negotiation_script = messageToSeller
    } catch (openAiError) {
      console.error("OpenAI error:", openAiError)
    }

    const final_price_difference = price - estimate
    const final_price_difference_percent =
      Math.round(((price - estimate) / estimate) * 1000) / 10

    const { data: input, error: inputError } = await supabase
      .from("car_inputs")
      .insert([
        {
          price,
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
      return Response.json(
        { error: "SUPABASE_ERROR", message: inputError.message },
        { status: 500 }
      )
    }

    const { error: resultError } = await supabase.from("car_results").insert([
      {
        input_id: input.id,
        market_estimate: estimate,
        risk_score: score,
        final_score: score,
        decision,
        ai_summary,
      },
    ])

    if (resultError) {
      return Response.json(
        { error: "SUPABASE_ERROR", message: resultError.message },
        { status: 500 }
      )
    }

    return Response.json({
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
    })
  } catch (error) {
    console.error("Server error:", error)

    return Response.json(
      { error: "SERVER_ERROR", message: "Something went wrong" },
      { status: 500 }
    )
  }
}