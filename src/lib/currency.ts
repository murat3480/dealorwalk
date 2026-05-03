import type { MarketContext } from "@/src/lib/productContext"

/** ISO-style codes stored in `deals.currency`. */
export type DealCurrency = "USD" | "EUR" | "TRY" | "GBP"

const ALLOWED = new Set<string>(["USD", "EUR", "TRY", "GBP"])

/**
 * Units of local currency per 1 USD (static rates).
 * TRY: 1 USD = 32 TRY
 * EUR / GBP: illustrative wholesale-style anchors for MVP.
 */
export const LOCAL_CURRENCY_PER_USD: Record<DealCurrency, number> = {
  USD: 1,
  TRY: 32,
  EUR: 1 / 1.06,
  GBP: 1 / 1.27,
}

export function parseDealCurrency(raw: unknown): DealCurrency {
  if (typeof raw !== "string") return "USD"
  const u = raw.trim().toUpperCase()
  if (ALLOWED.has(u)) return u as DealCurrency
  return "USD"
}

/** Listing amount in user's currency → USD for internal analysis. */
export function convertListingPriceToUsd(amount: number, currency: DealCurrency): number {
  if (!Number.isFinite(amount) || currency === "USD") return amount
  const perUsd = LOCAL_CURRENCY_PER_USD[currency]
  return amount / perUsd
}

/** USD → listing currency for display / persistence. */
export function convertUsdToListingPrice(usd: number, currency: DealCurrency): number {
  if (!Number.isFinite(usd) || currency === "USD") return usd
  const perUsd = LOCAL_CURRENCY_PER_USD[currency]
  return Math.round(usd * perUsd)
}

export function formatDealMoney(amount: number, currency: DealCurrency): string {
  const code =
    currency === "USD" ? "USD" : currency === "EUR" ? "EUR" : currency === "TRY" ? "TRY" : "GBP"
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code,
      maximumFractionDigits: 0,
    }).format(amount)
  } catch {
    const sym = currency === "USD" ? "$" : currency === "TRY" ? "₺" : currency === "EUR" ? "€" : "£"
    return `${sym}${Math.round(amount).toLocaleString("en-US")}`
  }
}

/** Replace $123 / $1,200 style amounts in copy (model output still uses USD internally). */
export function rewriteUsdAmountsInText(text: string, currency: DealCurrency): string {
  if (currency === "USD" || !text) return text
  return text.replace(/\$\s*([\d,]+(?:\.\d+)?)/g, (_, num) => {
    const usd = Number(String(num).replace(/,/g, ""))
    if (!Number.isFinite(usd)) return `$${num}`
    const local = convertUsdToListingPrice(usd, currency)
    return formatDealMoney(local, currency)
  })
}

function localizeMarketContext(mc: MarketContext, currency: DealCurrency): MarketContext {
  if (currency === "USD") return mc
  return {
    ...mc,
    market_tiers: mc.market_tiers.map((t) => ({
      ...t,
      low: convertUsdToListingPrice(t.low, currency),
      high: convertUsdToListingPrice(t.high, currency),
    })),
  }
}

export function localizeGenericDealRecord(
  raw: Record<string, unknown>,
  listingOriginal: number,
  currency: DealCurrency,
): Record<string, unknown> {
  if (currency === "USD") {
    return { ...raw, price: listingOriginal, currency }
  }

  const u = (v: unknown) => convertUsdToListingPrice(Number(v), currency)

  const fairAnchorUsd = Number(raw.fair_anchor)
  const fairAnchorLocal = u(fairAnchorUsd)

  const out: Record<string, unknown> = {
    ...raw,
    currency,
    price: listingOriginal,
    fair_anchor: fairAnchorLocal,
    fair_price_low: u(raw.fair_price_low),
    fair_price_high: u(raw.fair_price_high),
    price_difference: listingOriginal - fairAnchorLocal,
  }

  if (raw.market_context && typeof raw.market_context === "object") {
    out.market_context = localizeMarketContext(raw.market_context as MarketContext, currency)
  }

  const strKeys = ["ai_summary", "negotiation_script", "explanation"] as const
  for (const k of strKeys) {
    const s = raw[k]
    if (typeof s === "string") out[k] = rewriteUsdAmountsInText(s, currency)
  }

  return out
}

export function localizeCarDealRecord(
  raw: Record<string, unknown>,
  listingOriginal: number,
  currency: DealCurrency,
): Record<string, unknown> {
  if (currency === "USD") {
    return { ...raw, price: listingOriginal, currency }
  }

  const u = (v: unknown) => convertUsdToListingPrice(Number(v), currency)

  const estimateUsd = Number(raw.estimate)
  const estimateLocal = u(estimateUsd)

  const out: Record<string, unknown> = {
    ...raw,
    currency,
    price: listingOriginal,
    estimate: estimateLocal,
    formula_estimate: u(raw.formula_estimate),
    ai_estimate_low: u(raw.ai_estimate_low),
    ai_estimate_high: u(raw.ai_estimate_high),
    final_estimate: u(raw.final_estimate),
    fair_price_low: u(raw.fair_price_low),
    fair_price_high: u(raw.fair_price_high),
    price_difference: listingOriginal - estimateLocal,
  }

  if (raw.market_context && typeof raw.market_context === "object") {
    out.market_context = localizeMarketContext(raw.market_context as MarketContext, currency)
  }

  const strKeys = ["ai_summary", "negotiation_script", "explanation"] as const
  for (const k of strKeys) {
    const s = raw[k]
    if (typeof s === "string") out[k] = rewriteUsdAmountsInText(s, currency)
  }

  return out
}
