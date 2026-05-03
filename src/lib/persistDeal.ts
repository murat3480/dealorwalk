import { randomUUID } from "crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { supabase } from "@/src/lib/supabase"
import { getServiceSupabase } from "@/src/lib/supabaseServer"

/** Only these keys may be sent to PostgREST for `deals` inserts. */
const DEALS_INSERT_FORBIDDEN = new Set([
  "media_photo_url",
  "media_video_url",
  "asking_price",
  "engine",
  "listing_url",
  "listing_description",
])

function extFromMime(mime: string) {
  if (mime === "image/jpeg" || mime === "image/jpg") return "jpg"
  if (mime === "image/png") return "png"
  if (mime === "image/webp") return "webp"
  if (mime === "image/gif") return "gif"
  if (mime === "video/mp4") return "mp4"
  if (mime === "video/webm") return "webm"
  if (mime === "video/quicktime") return "mov"
  return "bin"
}

export type MediaUpload = {
  buffer: Buffer
  contentType: string
}

function pickExplanation(analysis: Record<string, unknown>): string {
  if (typeof analysis.explanation === "string" && analysis.explanation.trim()) {
    return analysis.explanation.trim()
  }
  const summary = typeof analysis.ai_summary === "string" ? analysis.ai_summary : ""
  const m = summary.match(/Explanation:\s*([\s\S]*?)(?:\n\nMessage to Seller:|$)/i)
  const extracted = m?.[1]?.replace(/\s+/g, " ").trim()
  return extracted || "See fair range and scores below."
}

function pickRedFlags(analysis: Record<string, unknown>): unknown[] {
  const rf = analysis.red_flags
  if (Array.isArray(rf)) return rf.filter((x) => typeof x === "string")
  return []
}

/**
 * Persists the analysis snapshot plus media URLs only on `result_json` (never as top-level `deals` columns).
 * `media_photo_url` from the client API is passed through as `photoUrl` when upload happened client-side.
 */
function buildResultJson(
  analysis: Record<string, unknown>,
  photoUrl: string | null,
  videoUrl: string | null,
): Record<string, unknown> {
  const base = JSON.parse(JSON.stringify(analysis)) as Record<string, unknown>
  return {
    ...base,
    media_photo_url: photoUrl,
    media_video_url: videoUrl,
  }
}

type DealsInsertRow = {
  share_id: string
  title: string
  category: string
  price: number
  currency: string
  source_url: string | null
  description: string | null
  verdict: string
  deal_score: number
  risk_score: number
  fair_price_low: number
  fair_price_high: number
  explanation: string
  red_flags: unknown[]
  seller_message: string | null
  recommended_action: string | null
  result_json: Record<string, unknown>
  car_input_id: string | null
  car_result_id: string | null
  is_public: boolean
}

function buildDealsInsertRow(p: DealsInsertRow): DealsInsertRow {
  return {
    share_id: p.share_id,
    title: p.title,
    category: p.category,
    price: p.price,
    currency: p.currency,
    source_url: p.source_url,
    description: p.description,
    verdict: p.verdict,
    deal_score: p.deal_score,
    risk_score: p.risk_score,
    fair_price_low: p.fair_price_low,
    fair_price_high: p.fair_price_high,
    explanation: p.explanation,
    red_flags: p.red_flags,
    seller_message: p.seller_message,
    recommended_action: p.recommended_action,
    result_json: p.result_json,
    car_input_id: p.car_input_id,
    car_result_id: p.car_result_id,
    is_public: p.is_public,
  }
}

/**
 * Persists to `public.deals` using only known columns. Analysis + media URLs live in `result_json`.
 */
export async function persistDeal(input: {
  analysis: Record<string, unknown>
  category: string
  title: string
  price: number
  /** Stored on `deals.currency` (ISO code). */
  currency?: string
  /** Mapped to column `source_url` */
  listing_url: string | null
  /** Mapped to column `description` */
  listing_description: string | null
  photo: MediaUpload | null
  video: MediaUpload | null
  /** Public URL when the client uploaded to Storage first; skips server photo upload. */
  media_photo_url?: string | null
  car_input_id?: string | null
  car_result_id?: string | null
}): Promise<
  { share_id: string; media_photo_url: string | null; media_video_url: string | null } | { error: string }
> {
  console.log("[persistDeal] function reached")
  const share_id = randomUUID()
  const admin = getServiceSupabase()
  let media_photo_url: string | null = null
  let media_video_url: string | null = null

  const clientPhotoUrl =
    typeof input.media_photo_url === "string" && input.media_photo_url.trim()
      ? input.media_photo_url.trim()
      : null
  if (clientPhotoUrl) {
    media_photo_url = clientPhotoUrl
  } else if (admin && input.photo) {
    const path = `${share_id}/photo.${extFromMime(input.photo.contentType)}`
    const { error } = await admin.storage.from("deal-media").upload(path, input.photo.buffer, {
      contentType: input.photo.contentType,
      upsert: true,
    })
    if (!error) {
      const { data: publicUrl } = admin.storage.from("deal-media").getPublicUrl(path)
      media_photo_url = publicUrl.publicUrl
    }
  }

  if (admin && input.video) {
    const path = `${share_id}/video.${extFromMime(input.video.contentType)}`
    const { error } = await admin.storage.from("deal-media").upload(path, input.video.buffer, {
      contentType: input.video.contentType,
      upsert: true,
    })
    if (!error) {
      const { data: publicUrl } = admin.storage.from("deal-media").getPublicUrl(path)
      media_video_url = publicUrl.publicUrl
    }
  }

  const a = input.analysis
  const fairLow =
    typeof a.fair_price_low === "number"
      ? a.fair_price_low
      : typeof a.ai_estimate_low === "number"
        ? a.ai_estimate_low
        : 0
  const fairHigh =
    typeof a.fair_price_high === "number"
      ? a.fair_price_high
      : typeof a.ai_estimate_high === "number"
        ? a.ai_estimate_high
        : 0

  const result_json = buildResultJson(a, media_photo_url, media_video_url)

  const row = buildDealsInsertRow({
    share_id,
    title: input.title,
    category: input.category,
    price: input.price,
    currency: typeof input.currency === "string" && input.currency.trim() ? input.currency.trim().toUpperCase() : "USD",
    source_url: input.listing_url,
    description: input.listing_description,
    verdict: String(a.verdict ?? ""),
    deal_score: Math.round(Number(a.deal_score ?? 0)),
    risk_score: Math.round(Number(a.risk_score ?? 0)),
    fair_price_low: fairLow,
    fair_price_high: fairHigh,
    explanation: pickExplanation(a),
    red_flags: pickRedFlags(a),
    seller_message: typeof a.negotiation_script === "string" ? a.negotiation_script : null,
    recommended_action: typeof a.recommended_next_action === "string" ? a.recommended_next_action : null,
    result_json,
    car_input_id: input.car_input_id ?? null,
    car_result_id: input.car_result_id ?? null,
    is_public: false,
  })

  const keys = Object.keys(row)
  for (const k of keys) {
    if (DEALS_INSERT_FORBIDDEN.has(k)) {
      console.error("[persistDeal] forbidden key leaked onto insert row:", k)
      return { error: `persistDeal internal error: disallowed column ${k}` }
    }
  }

  console.log("[persistDeal] inserting deals row keys:", keys.sort())

  const db: SupabaseClient = getServiceSupabase() ?? supabase
  const { error } = await db.from("deals").insert(row)

  if (error) {
    const parts = [error.message]
    if (error.details) parts.push(String(error.details))
    if (error.hint) parts.push(String(error.hint))
    if ("code" in error && error.code) parts.push(`code:${String(error.code)}`)
    return { error: parts.filter(Boolean).join(" | ") }
  }

  return { share_id, media_photo_url, media_video_url }
}
