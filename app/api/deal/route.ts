import { executeDealAnalysis, parseDealCategory, type ExecuteDealInput } from "@/src/lib/executeDealAnalysis"
import { buildDealTitle } from "@/src/lib/buildDealTitle"
import { persistDeal } from "@/src/lib/persistDeal"
import { parseDealCurrency } from "@/src/lib/currency"

function readString(form: FormData, key: string) {
  const v = form.get(key)
  return typeof v === "string" ? v : ""
}

function fileOrNull(v: FormDataEntryValue | null): File | null {
  if (v instanceof File && v.size > 0) return v
  return null
}

/** Supports legacy/alternate field name `asking_price` from clients. */
function priceFromUnknown(raw: unknown): number {
  const n = typeof raw === "number" ? raw : Number(raw)
  return Number.isFinite(n) ? n : NaN
}

function logPersistDealPayload(payload: {
  analysis_engine: string | null
  category: string
  title: string
  price: number
  listing_url: string | null
  listing_description: string | null
  hasPhoto: boolean
  hasVideo: boolean
  photoBytes: number
  videoBytes: number
  car_input_id: string | null
  car_result_id: string | null
}) {
  console.log("[api/deal] persistDeal payload:", JSON.stringify(payload, null, 2))
}

export async function POST(req: Request) {
  console.log("[api/deal] route hit")
  try {
    const contentType = req.headers.get("content-type") || ""

    let photoFile: File | null = null
    let videoFile: File | null = null
    let clientMediaPhotoUrl: string | null = null
    let dealCurrency = "USD"
    let payload: ExecuteDealInput

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData()
      const category = parseDealCategory(readString(form, "category"))
      if (!category) {
        return Response.json(
          { error: "VALIDATION_ERROR", message: "category is invalid", debug_route: "api/deal" },
          { status: 400 }
        )
      }

      const priceRaw = readString(form, "price") || readString(form, "asking_price")
      const price = Number(priceRaw)
      const listing_url = readString(form, "listing_url").trim() || null
      const listing_description = readString(form, "listing_description").trim() || null

      photoFile = fileOrNull(form.get("photo"))
      videoFile = fileOrNull(form.get("video"))
      clientMediaPhotoUrl = readString(form, "media_photo_url").trim() || null
      dealCurrency = parseDealCurrency(readString(form, "currency"))

      payload = {
        category,
        price,
        currency: dealCurrency,
        listing_url,
        listing_description,
        photo_included: Boolean(photoFile) || Boolean(clientMediaPhotoUrl),
        video_included: Boolean(videoFile),
        mileage: readString(form, "mileage") ? Number(readString(form, "mileage")) : undefined,
        year: readString(form, "year") ? Number(readString(form, "year")) : undefined,
        brand: readString(form, "brand"),
        model: readString(form, "model"),
        state: readString(form, "state").trim() || null,
        city: readString(form, "city").trim() || null,
        condition: readString(form, "condition") || "good",
        vehicle_type: readString(form, "vehicle_type") || "auto",
        use_car_engine: readString(form, "use_car_engine") !== "false",
      }
    } else {
      const body = (await req.json()) as Record<string, unknown>

      const category = parseDealCategory(body.category)
      if (!category) {
        return Response.json(
          { error: "VALIDATION_ERROR", message: "category is invalid", debug_route: "api/deal" },
          { status: 400 }
        )
      }

      const resolvedPrice = priceFromUnknown(body.price ?? body.asking_price)
      const jsonMediaPhoto =
        typeof body.media_photo_url === "string" ? body.media_photo_url.trim() : ""
      clientMediaPhotoUrl = jsonMediaPhoto || null
      dealCurrency = parseDealCurrency(body.currency)

      payload = {
        category,
        price: resolvedPrice,
        currency: dealCurrency,
        listing_url: typeof body.listing_url === "string" ? body.listing_url : null,
        listing_description: typeof body.listing_description === "string" ? body.listing_description : null,
        photo_included: Boolean(body.photo_included) || Boolean(clientMediaPhotoUrl),
        video_included: Boolean(body.video_included),
        mileage: body.mileage !== undefined ? Number(body.mileage) : undefined,
        year: body.year !== undefined ? Number(body.year) : undefined,
        brand: typeof body.brand === "string" ? body.brand : undefined,
        model: typeof body.model === "string" ? body.model : undefined,
        state: typeof body.state === "string" ? body.state : null,
        city: typeof body.city === "string" ? body.city : null,
        condition: typeof body.condition === "string" ? body.condition : "good",
        vehicle_type: typeof body.vehicle_type === "string" ? body.vehicle_type : "auto",
        use_car_engine: body.use_car_engine !== false,
        use_vehicle_engine: body.use_vehicle_engine !== false,
      }
    }

    const out = await executeDealAnalysis(payload)
    if ("error" in out) {
      return Response.json(
        { error: out.error, message: out.message, debug_route: "api/deal" },
        { status: out.status }
      )
    }

    const data = out.data
    const category = String(data.category ?? payload.category)
    let dealPrice =
      typeof data.price === "number" && Number.isFinite(data.price) ? data.price : payload.price
    if (!Number.isFinite(dealPrice)) {
      dealPrice = priceFromUnknown((data as Record<string, unknown>).asking_price ?? payload.price)
    }

    let photo: { buffer: Buffer; contentType: string } | null = null
    let video: { buffer: Buffer; contentType: string } | null = null
    if (photoFile) {
      const buf = Buffer.from(await photoFile.arrayBuffer())
      photo = { buffer: buf, contentType: photoFile.type || "application/octet-stream" }
    }
    if (videoFile) {
      const buf = Buffer.from(await videoFile.arrayBuffer())
      video = { buffer: buf, contentType: videoFile.type || "application/octet-stream" }
    }

    const title = buildDealTitle(data, category, payload.listing_description)

    if (!Number.isFinite(dealPrice) || dealPrice <= 0) {
      console.error("[api/deal] invalid dealPrice after analysis:", dealPrice)
      return Response.json(
        {
          error: "VALIDATION_ERROR",
          message: "Could not resolve a valid listing price for persistence.",
          debug_route: "api/deal",
        },
        { status: 400 }
      )
    }

    logPersistDealPayload({
      analysis_engine: typeof data.engine === "string" ? data.engine : String(data.engine ?? "generic"),
      category,
      title,
      price: dealPrice,
      listing_url: payload.listing_url,
      listing_description: payload.listing_description,
      hasPhoto: Boolean(photo) || Boolean(clientMediaPhotoUrl),
      hasVideo: Boolean(video),
      photoBytes: photo?.buffer.length ?? 0,
      videoBytes: video?.buffer.length ?? 0,
      car_input_id: typeof data.car_input_id === "string" ? data.car_input_id : null,
      car_result_id: typeof data.car_result_id === "string" ? data.car_result_id : null,
    })

    const persisted = await persistDeal({
      analysis: data,
      category,
      title,
      price: dealPrice,
      currency: dealCurrency,
      listing_url: payload.listing_url,
      listing_description: payload.listing_description,
      photo,
      video,
      media_photo_url: clientMediaPhotoUrl,
      car_input_id: typeof data.car_input_id === "string" ? data.car_input_id : null,
      car_result_id: typeof data.car_result_id === "string" ? data.car_result_id : null,
    })

    if ("error" in persisted) {
      console.error("[api/deal] persistDeal Supabase error:", persisted.error)
      return Response.json(
        {
          error: "PERSIST_ERROR",
          message: persisted.error,
          debug_route: "api/deal",
        },
        { status: 500 }
      )
    }

    const share_path = `/d/${persisted.share_id}`

    return Response.json({
      ...data,
      share_id: persisted.share_id,
      share_path,
      redirect_url: share_path,
      media_photo_url: persisted.media_photo_url,
      media_video_url: persisted.media_video_url,
      debug_route: "api/deal",
    })
  } catch (error) {
    console.error("Server error (deal):", error)
    const message = error instanceof Error ? error.message : "Something went wrong"
    return Response.json({ error: "SERVER_ERROR", message, debug_route: "api/deal" }, { status: 500 })
  }
}
