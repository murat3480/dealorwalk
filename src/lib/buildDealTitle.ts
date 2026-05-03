export function buildDealTitle(
  data: Record<string, unknown>,
  category: string,
  listing_description: string | null,
): string {
  const engine = String(data.engine ?? "")
  if (engine === "car" || (typeof data.brand === "string" && data.brand.trim())) {
    const parts = [data.year, data.brand, data.model].filter(
      (x) => x !== undefined && x !== null && String(x).trim() !== "",
    )
    const t = parts.map(String).join(" ").trim()
    if (t) return t.slice(0, 200)
    return "Vehicle"
  }
  const desc = (listing_description || "").trim()
  if (desc.length) return desc.slice(0, 120)
  const c = category.replace(/_/g, " ")
  return `${c.charAt(0).toUpperCase() + c.slice(1)} deal`
}
