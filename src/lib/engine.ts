type Segment = 'TRUCK' | 'SUV' | 'SEDAN' | 'OTHER'

function detectSegment(brand?: string | null, model?: string | null): Segment {
  const m = (model || '').toLowerCase()

  const TRUCK = ['silverado','f-150','ram','tacoma','tundra','sierra','frontier','ridgeline']
  const SUV = ['cr-v','rav4','highlander','pilot','explorer','escape','x5','x3','cx-5','kona','sportage','sorento','tucson']
  const SEDAN = ['corolla','civic','camry','accord','altima','elantra','sonata','malibu','fusion','a4','3 series','5 series']

  if (TRUCK.some(k => m.includes(k))) return 'TRUCK'
  if (SUV.some(k => m.includes(k))) return 'SUV'
  if (SEDAN.some(k => m.includes(k))) return 'SEDAN'
  return 'OTHER'
}

function getBasePrice(year: number, segment: Segment, brand?: string | null) {
  const b = (brand || '').toLowerCase()

  const brandMultiplier =
    ['toyota','honda'].includes(b) ? 1.1 :
    ['bmw','audi','mercedes'].includes(b) ? 1.2 :
    ['hyundai','kia','nissan'].includes(b) ? 0.95 :
    1

  const segmentBase =
    segment === 'TRUCK' ? 30000 :
    segment === 'SUV' ? 28000 :
    segment === 'SEDAN' ? 24000 :
    25000

  const age = 2026 - year

  const yearlyDrop =
    segment === 'TRUCK' ? 1200 :
    segment === 'SUV' ? 1500 :
    1800

  return (segmentBase - age * yearlyDrop) * brandMultiplier
}

function applyMileage(base: number, mileage: number, segment: Segment) {
  const rate =
    segment === 'TRUCK' ? 0.03 :
    segment === 'SUV' ? 0.045 :
    0.06

  return base - (mileage * rate)
}

function applyCondition(price: number, condition?: string) {
  const c = (condition || '').toLowerCase()

  const multiplier =
    c === 'excellent' ? 1.1 :
    c === 'good' ? 1 :
    c === 'fair' ? 0.9 :
    c === 'poor' ? 0.75 :
    1

  return price * multiplier
}

function applyFloor(price: number, year: number, segment: Segment) {
  if (segment === 'TRUCK' && year >= 2010) {
    return Math.max(price, 10000)
  }

  if (segment === 'SUV' && year >= 2012) {
    return Math.max(price, 8000)
  }

  return Math.max(price, 2000)
}

export function estimateMarketPrice(
  year: number,
  mileage: number,
  condition?: string,
  brand?: string | null,
  model?: string | null,
) {
  const segment = detectSegment(brand, model)

  let price = getBasePrice(year, segment, brand)
  price = applyMileage(price, mileage, segment)
  price = applyCondition(price, condition)
  price = applyFloor(price, year, segment)

  return Math.round(price)
}

export function getPriceRange(estimate: number) {
  const low = Math.round(estimate * 0.9)
  const high = Math.round(estimate * 1.1)
  return { low, high }
}

export function calculateScore(year: number, mileage: number) {
  const age = 2026 - year
  const score = 100 - age * 2 - mileage / 20000
  return Math.max(0, Math.round(score))
}

export function getDecision(price: number, estimate: number) {
  if (price < estimate * 0.9) return 'BUY'
  if (price <= estimate * 1.1) return 'NEGOTIATE'
  return 'WALK_AWAY'
}
