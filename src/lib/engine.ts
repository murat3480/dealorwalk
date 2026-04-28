export function estimateMarketPrice(
  year: number,
  mileage: number,
  condition?: string,
  brand?: string | null,
  model?: string | null,
) {
  console.log('brand:', brand, 'model:', model)

  const b = brand?.trim().toLowerCase()
  const m = model?.trim().toLowerCase()

  const age = 2026 - year

  let basePrice = 20000

  if (age <= 3) basePrice = 22000
  else if (age <= 5) basePrice = 18000
  else if (age <= 8) basePrice = 13000
  else if (age <= 12) basePrice = 8500
  else basePrice = 6500

  let overridePrice: number | null = null

  if (b && m) {
    if (b.includes('volkswagen') && m.includes('rabbit')) {
      console.log('Rabbit detected')
      overridePrice = 7500
    } else if (b.includes('toyota') && m.includes('corolla')) {
      overridePrice = 6500
    } else if (b.includes('honda') && m.includes('civic')) {
      overridePrice = 6500
    } else if (b.includes('ford') && m.includes('focus')) {
      overridePrice = 5000
    } else if (b.includes('hyundai') && m.includes('elantra')) {
      overridePrice = 5500
    } else if (b.includes('nissan') && m.includes('altima')) {
      overridePrice = 5500
    }
  }

  if (overridePrice !== null && overridePrice > basePrice) basePrice = overridePrice

  const agePenalty = age * 120
  const mileagePenalty = mileage * 0.015
  const estimate = basePrice - agePenalty - mileagePenalty

  const multiplier =
    condition?.toLowerCase() === 'excellent'
      ? 1.08
      : condition?.toLowerCase() === 'fair'
        ? 0.9
        : condition?.toLowerCase() === 'poor'
          ? 0.78
          : 1

  return Math.max(2000, estimate * multiplier)
}

export function calculateScore(year: number, mileage: number) {
  const age = 2026 - year
  const score = 100 - age * 2 - mileage / 20000
  return Math.max(0, Math.round(score))
}

export function getDecision(price: number, estimate: number) {
  if (price <= estimate * 0.95) return 'BUY'
  if (price <= estimate * 1.15) return 'NEGOTIATE'
  return 'WALK_AWAY'
}
