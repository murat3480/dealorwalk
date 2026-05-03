"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { DealResultPanel, isDealResult } from "@/components/DealResultPanel"
import { supabase } from "@/src/lib/supabase"

type Category = "Car" | "Electronics" | "Furniture" | "Fashion" | "Real Estate" | "Other"
type Condition = "excellent" | "good" | "fair" | "poor"
type DealCurrency = "USD" | "EUR" | "TRY" | "GBP"

function isApiError(value: unknown): value is { error: string; message?: string } {
  if (!value || typeof value !== "object") return false
  const v = value as Record<string, unknown>
  return typeof v.error === "string"
}

function hasShareMeta(value: unknown): value is { share_id: string; share_path: string } {
  if (!value || typeof value !== "object") return false
  const v = value as Record<string, unknown>
  return typeof v.share_id === "string" && typeof v.share_path === "string"
}

function categoryToApiValue(category: Category) {
  if (category === "Real Estate") return "real_estate"
  return category.toLowerCase()
}

function extensionForImageFile(file: File): string {
  const m = file.name.match(/\.([a-zA-Z0-9]+)$/)
  if (m) return m[1].toLowerCase()
  const t = file.type
  if (t === "image/jpeg" || t === "image/jpg") return "jpg"
  if (t === "image/png") return "png"
  if (t === "image/webp") return "webp"
  if (t === "image/gif") return "gif"
  return "jpg"
}

/** Parses price from input; accepts commas, trims whitespace. Returns null if empty or invalid. */
function parsePriceInput(raw: string): number | null {
  const normalized = raw.trim().replace(/,/g, "")
  if (normalized === "") return null
  const n = Number(normalized)
  if (!Number.isFinite(n)) return null
  return n
}

export default function CheckPage() {
  const router = useRouter()
  const [category, setCategory] = useState<Category>("Electronics")
  const [price, setPrice] = useState<string>("")
  const [currency, setCurrency] = useState<DealCurrency>("USD")
  const [listingUrl, setListingUrl] = useState<string>("")
  const [description, setDescription] = useState<string>("")

  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [videoFile, setVideoFile] = useState<File | null>(null)

  // Vehicle / advanced manual engine fields (only used when category === Car)
  const [mileage, setMileage] = useState<string>("")
  const [year, setYear] = useState<string>("")
  const [brand, setBrand] = useState<string>("")
  const [model, setModel] = useState<string>("")
  const [state, setState] = useState<string>("")
  const [city, setCity] = useState<string>("")
  const [condition, setCondition] = useState<Condition>("good")
  const [vehicle_type, setVehicleType] = useState<string>("auto")

  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<unknown>(null)
  const [mediaUploadWarning, setMediaUploadWarning] = useState<string | null>(null)

  const isCar = category === "Car"

  const canSubmit = useMemo(() => {
    const priceNum = parsePriceInput(price)
    const priceOk = priceNum !== null && priceNum > 0
    const categoryOk = Boolean(category)
    const hasListingContext =
      description.trim().length > 0 ||
      listingUrl.trim().length > 0 ||
      photoFile !== null ||
      videoFile !== null

    if (!priceOk || !categoryOk || !hasListingContext) return false
    if (!isCar) return true
    return (
      mileage.trim().length > 0 &&
      year.trim().length > 0 &&
      brand.trim().length > 0 &&
      model.trim().length > 0
    )
  }, [price, category, description, listingUrl, photoFile, videoFile, isCar, mileage, year, brand, model])

  const submitBlockedReason = useMemo(() => {
    const priceNum = parsePriceInput(price)
    if (priceNum === null || priceNum <= 0) {
      return "Enter a price greater than 0."
    }
    const hasListingContext =
      description.trim().length > 0 ||
      listingUrl.trim().length > 0 ||
      photoFile !== null ||
      videoFile !== null
    if (!hasListingContext) {
      return "Add a short description, a listing link, a photo, or a video (at least one)."
    }
    if (
      isCar &&
      (!mileage.trim() || !year.trim() || !brand.trim() || !model.trim())
    ) {
      return "For vehicles, add year, mileage, brand, and model."
    }
    return null
  }, [price, description, listingUrl, photoFile, videoFile, isCar, mileage, year, brand, model])

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setResult(null)
    setMediaUploadWarning(null)

    try {
      const priceNumber = parsePriceInput(price)
      if (priceNumber === null || priceNumber <= 0) {
        return
      }

      let mediaPhotoUrl: string | null = null
      if (photoFile) {
        const ext = extensionForImageFile(photoFile)
        const path = `deals/${Date.now()}-${crypto.randomUUID()}.${ext}`
        const { error } = await supabase.storage.from("deal-media").upload(path, photoFile, {
          contentType: photoFile.type || "image/jpeg",
          upsert: false,
        })
        if (!error) {
          const { data: publicUrl } = supabase.storage.from("deal-media").getPublicUrl(path)
          mediaPhotoUrl = publicUrl.publicUrl
        } else {
          setMediaUploadWarning("Photo upload failed — continuing without the hosted image.")
        }
      }

      const fd = new FormData()
      fd.append("category", categoryToApiValue(category))
      fd.append("price", String(priceNumber))
      fd.append("currency", currency)
      if (listingUrl.trim()) fd.append("listing_url", listingUrl.trim())
      if (description.trim()) fd.append("listing_description", description.trim())
      if (mediaPhotoUrl) {
        fd.append("media_photo_url", mediaPhotoUrl)
      } else if (photoFile) {
        fd.append("photo", photoFile)
      }
      if (videoFile) fd.append("video", videoFile)

      if (isCar) {
        fd.append("mileage", mileage)
        fd.append("year", year)
        fd.append("brand", brand)
        fd.append("model", model)
        if (state.trim()) fd.append("state", state.trim())
        if (city.trim()) fd.append("city", city.trim())
        fd.append("condition", condition)
        fd.append("vehicle_type", vehicle_type)
        fd.append("use_car_engine", "true")
      }

      const res = await fetch("/api/deal", {
        method: "POST",
        body: fd,
      })

      const data = (await res.json()) as unknown
      if (res.ok && hasShareMeta(data)) {
        router.replace(data.share_path)
        return
      }
      setResult(data)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-10 text-zinc-900">
      <div className="mx-auto w-full max-w-2xl">
        <div className="flex items-center justify-between gap-3">
          <Link href="/" className="text-sm font-semibold text-zinc-900 hover:underline">
            ← Home
          </Link>
          <div className="text-xs text-zinc-500">DealorWalk</div>
        </div>

        <div className="mt-6">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Check the deal before you buy</h1>
          <p className="mt-3 text-sm leading-relaxed text-zinc-700 sm:text-base">
            Upload a photo or video, paste a listing link, add the price, and tell us what you’re looking at. You’ll get a
            clear DEAL / NEGOTIATE / WALK AWAY readout with scores and a seller-ready message.
          </p>
        </div>

        <form onSubmit={onSubmit} className="mt-8 space-y-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-zinc-700">Photo (optional)</label>
              <input
                type="file"
                accept="image/*"
                className="mt-2 block w-full text-sm text-zinc-900 file:mr-3 file:rounded-lg file:border file:border-zinc-200 file:bg-white file:px-3 file:py-2 file:text-sm file:font-semibold hover:file:bg-zinc-50"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null
                  if (f && !f.type.startsWith("image/")) {
                    e.target.value = ""
                    setPhotoFile(null)
                    setMediaUploadWarning("Please choose an image file.")
                    return
                  }
                  setMediaUploadWarning(null)
                  setPhotoFile(f)
                }}
              />
              <div className="mt-2 space-y-1 text-xs text-zinc-500">
                <p>Upload a photo to make the result page easier to review and share.</p>
                <p>On analyze, the image is uploaded to secure storage and linked to your deal.</p>
              </div>
              {mediaUploadWarning ? (
                <div className="mt-2 text-xs text-amber-800">{mediaUploadWarning}</div>
              ) : null}
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700">Video (optional)</label>
              <input
                type="file"
                accept="video/*"
                className="mt-2 block w-full text-sm text-zinc-900 file:mr-3 file:rounded-lg file:border file:border-zinc-200 file:bg-white file:px-3 file:py-2 file:text-sm file:font-semibold hover:file:bg-zinc-50"
                onChange={(e) => setVideoFile(e.target.files?.[0] ?? null)}
              />
              <div className="mt-2 text-xs text-zinc-500">
                Stored locally in your browser for this session (used as a signal that visuals were provided).
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700">Listing URL (optional)</label>
            <input
              className="mt-2 w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-base outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200"
              value={listingUrl}
              onChange={(e) => setListingUrl(e.target.value)}
              placeholder="https://..."
            />
            <p className="mt-2 text-xs leading-relaxed text-zinc-500">
              Links are currently used as context. Full automatic listing extraction will be added later.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-zinc-700">Category</label>
              <select
                className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-base outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200"
                value={category}
                onChange={(e) => setCategory(e.target.value as Category)}
              >
                <option>Car</option>
                <option>Electronics</option>
                <option>Furniture</option>
                <option>Fashion</option>
                <option>Real Estate</option>
                <option>Other</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700">Price</label>
              <input
                className="mt-2 w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-base outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200"
                inputMode="decimal"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="e.g. 1800"
                name="price"
                autoComplete="off"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700">Currency</label>
              <select
                className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-base outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200"
                value={currency}
                onChange={(e) => setCurrency(e.target.value as DealCurrency)}
              >
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="TRY">TRY (₺)</option>
                <option value="GBP">GBP (£)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700">Short description</label>
            <textarea
              className="mt-2 w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-base outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200"
              rows={5}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is it, what’s included, condition, any issues, seller claims, etc."
            />
            <p className="mt-2 text-xs leading-relaxed text-zinc-500">
              For best results, describe the item clearly: condition, what’s included, seller claims, and anything that feels
              suspicious.
            </p>
          </div>

          {isCar ? (
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <div className="text-sm font-semibold text-zinc-900">Vehicle details (advanced engine)</div>
              <p className="mt-1 text-xs text-zinc-600">
                This uses the full vehicle model (the same engine as the original DealorWalk car checker).
              </p>

              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-zinc-700">Brand</label>
                  <input
                    className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-base outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200"
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    required={isCar}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700">Model</label>
                  <input
                    className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-base outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    required={isCar}
                  />
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-700">Year</label>
                  <input
                    className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-base outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200"
                    inputMode="numeric"
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
                    placeholder="2018"
                    required={isCar}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700">Mileage</label>
                  <input
                    className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-base outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200"
                    inputMode="numeric"
                    value={mileage}
                    onChange={(e) => setMileage(e.target.value)}
                    placeholder="120000"
                    required={isCar}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700">Vehicle Type</label>
                  <select
                    className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-base outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200"
                    value={vehicle_type}
                    onChange={(e) => setVehicleType(e.target.value)}
                  >
                    <option value="auto">auto</option>
                    <option value="sedan">sedan</option>
                    <option value="suv">suv</option>
                    <option value="truck">truck</option>
                    <option value="coupe">coupe</option>
                    <option value="hatchback">hatchback</option>
                    <option value="van">van</option>
                  </select>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-700">Condition</label>
                  <select
                    className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-base outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200"
                    value={condition}
                    onChange={(e) => setCondition(e.target.value as Condition)}
                  >
                    <option value="excellent">excellent</option>
                    <option value="good">good</option>
                    <option value="fair">fair</option>
                    <option value="poor">poor</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700">State</label>
                  <input
                    className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-base outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    placeholder="California"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700">City</label>
                  <input
                    className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-base outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Los Angeles"
                  />
                </div>
              </div>
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading || !canSubmit}
            className="inline-flex w-full items-center justify-center rounded-xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Analyzing…" : "Analyze Deal"}
          </button>

          {!canSubmit && submitBlockedReason ? (
            <div className="text-xs text-zinc-600">{submitBlockedReason}</div>
          ) : null}
        </form>

        <div className="mt-8 space-y-6">
          {result && isApiError(result) && isDealResult(result) ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
              <div className="font-medium">Could not save the share link</div>
              <div className="mt-1">
                {typeof result.message === "string" ? result.message : "Check Supabase tables (see supabase/shared-deals.sql)."}
              </div>
            </div>
          ) : null}

          {result && isDealResult(result) ? <DealResultPanel result={result} /> : null}

          {result && isApiError(result) && !isDealResult(result) ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
              <div className="font-medium">{result.error}</div>
              {typeof result.message === "string" ? <div className="mt-1">{result.message}</div> : null}
            </div>
          ) : null}

          {result && !isDealResult(result) && !isApiError(result) ? (
            <div className="rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-700">
              Received a response, but it doesn’t include the new structured fields yet.
            </div>
          ) : null}
        </div>

        <footer className="mt-12 pb-6 text-center text-xs text-zinc-500">
          Estimates are informational and depend on what you provide. Always verify details with the seller and (for big
          purchases) independent inspection where applicable.
        </footer>
      </div>
    </main>
  )
}
