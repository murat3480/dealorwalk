import { runCarAnalysis } from "@/src/lib/carAnalysis"
import { persistDeal } from "@/src/lib/persistDeal"
import { buildDealTitle } from "@/src/lib/buildDealTitle"

export async function POST(req: Request) {
  console.log("[api/analyze] route hit")
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
    const vehicle_type = body.vehicle_type || "auto"
    const listing_url = body.listing_url ?? null
    const listing_description = body.listing_description ?? null

    if (!price || !mileage || !year) {
      return Response.json(
        { error: "VALIDATION_ERROR", message: "price, mileage and year are required", debug_route: "api/analyze" },
        { status: 400 }
      )
    }

    console.log("brand:", brand, "model:", model)

    try {
      const result = await runCarAnalysis({
        price,
        listing_price_original: price,
        currency: "USD",
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
      })

      const analysisPayload = { engine: "car", category: "car", ...result } as Record<string, unknown>

      const persisted = await persistDeal({
        analysis: analysisPayload,
        category: "car",
        title: buildDealTitle(analysisPayload, "car", listing_description),
        price,
        currency: "USD",
        listing_url,
        listing_description,
        photo: null,
        video: null,
        car_input_id: result.car_input_id,
        car_result_id: result.car_result_id,
      })

      if ("error" in persisted) {
        return Response.json(
          { ...result, error: "PERSIST_ERROR", message: persisted.error, debug_route: "api/analyze" },
          { status: 500 }
        )
      }

      const share_path = `/d/${persisted.share_id}`

      return Response.json({
        ...result,
        share_id: persisted.share_id,
        share_path,
        redirect_url: share_path,
        debug_route: "api/analyze",
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (msg.startsWith("SUPABASE_ERROR:")) {
        return Response.json(
          { error: "SUPABASE_ERROR", message: msg.replace("SUPABASE_ERROR:", ""), debug_route: "api/analyze" },
          { status: 500 }
        )
      }
      throw e
    }
  } catch (error) {
    console.error("Server error:", error)

    return Response.json(
      { error: "SERVER_ERROR", message: "Something went wrong", debug_route: "api/analyze" },
      { status: 500 }
    )
  }
}
