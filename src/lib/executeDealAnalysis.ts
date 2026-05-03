import { runCarAnalysis } from "@/src/lib/carAnalysis"
import {
  convertListingPriceToUsd,
  localizeCarDealRecord,
  localizeGenericDealRecord,
  parseDealCurrency,
} from "@/src/lib/currency"
import { runGenericDealAnalysis, type GenericDealRequest } from "@/src/lib/genericDealAnalysis"
import type { GenericCategory } from "@/src/lib/dealPresentation"

export function parseDealCategory(raw: unknown): GenericCategory | "car" | null {
  if (typeof raw !== "string") return null
  const v = raw.trim().toLowerCase().replace(/\s+/g, "_")
  if (v === "car" || v === "vehicle" || v === "automotive") return "car"
  if (v === "electronics" || v === "electronic") return "electronics"
  if (v === "furniture") return "furniture"
  if (v === "fashion" || v === "clothing" || v === "apparel") return "fashion"
  if (v === "real_estate" || v === "realestate" || v === "real-estate" || v === "home" || v === "housing") {
    return "real_estate"
  }
  if (v === "other") return "other"
  return null
}

export type ExecuteDealInput = {
  category: GenericCategory | "car"
  price: number
  /** ISO currency code (USD, EUR, TRY, GBP). Listing price is in this currency. */
  currency?: string
  listing_url: string | null
  listing_description: string | null
  photo_included: boolean
  video_included: boolean
  mileage?: number
  year?: number
  brand?: string
  model?: string
  state?: string | null
  city?: string | null
  condition?: string
  vehicle_type?: string
  use_car_engine?: boolean
  use_vehicle_engine?: boolean
}

export type ExecuteDealError = { error: string; message: string; status: number }
export type ExecuteDealSuccess = { data: Record<string, unknown> }

export async function executeDealAnalysis(input: ExecuteDealInput): Promise<ExecuteDealError | ExecuteDealSuccess> {
  const {
    category,
    price: listingPriceRaw,
    listing_url,
    listing_description,
    photo_included,
    video_included,
  } = input

  const currency = parseDealCurrency(input.currency)
  const listingPrice = listingPriceRaw

  if (!category) {
    return { error: "VALIDATION_ERROR", message: "category is invalid", status: 400 }
  }
  if (!listingPrice || listingPrice <= 0) {
    return { error: "VALIDATION_ERROR", message: "price is required", status: 400 }
  }

  const priceUsd = convertListingPriceToUsd(listingPrice, currency)

  const mileage = Number(input.mileage)
  const year = Number(input.year)
  const brand = typeof input.brand === "string" ? input.brand : ""
  const model = typeof input.model === "string" ? input.model : ""

  const wantsCarEngine =
    category === "car" &&
    Boolean(input.use_car_engine ?? input.use_vehicle_engine ?? true) &&
    Boolean(mileage) &&
    Boolean(year) &&
    brand.trim().length > 0 &&
    model.trim().length > 0

  if (category === "car" && !wantsCarEngine) {
    return {
      error: "VALIDATION_ERROR",
      message:
        "For vehicles, include year, mileage, brand, and model (or submit via /api/analyze). Set use_car_engine=false to run a quick non-vehicle-style estimate.",
      status: 400,
    }
  }

  if (wantsCarEngine) {
    const state = input.state ?? null
    const city = input.city ?? null
    const condition = input.condition || "good"
    const vehicle_type = input.vehicle_type || "auto"

    try {
      const result = await runCarAnalysis({
        price: priceUsd,
        listing_price_original: listingPrice,
        currency,
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
      const data = localizeCarDealRecord(
        { engine: "car", category: "car", ...(result as unknown as Record<string, unknown>) },
        listingPrice,
        currency,
      )
      return { data }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (msg.startsWith("SUPABASE_ERROR:")) {
        return { error: "SUPABASE_ERROR", message: msg.replace("SUPABASE_ERROR:", ""), status: 500 }
      }
      throw e
    }
  }

  const genericCategory = category as GenericCategory

  const genericReq: GenericDealRequest = {
    category: genericCategory,
    price: priceUsd,
    listing_url,
    listing_description,
    photo_included,
    video_included,
  }

  const generic = await runGenericDealAnalysis(genericReq)
  const data = localizeGenericDealRecord(generic as unknown as Record<string, unknown>, listingPrice, currency)
  return { data }
}
