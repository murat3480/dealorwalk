/**
 * Future home for DealorWalk **vision** AI: photo / video visual inspection
 * (condition cues, damage, listing-photo quality, red flags in frames, etc.).
 * Not wired into routes or persistence yet—placeholder only.
 */

export async function analyzeDealImage(input: { imageUrl: string }) {
  void input
  return {
    visual_summary: null,
    visible_condition: null,
    risk_signals: [] as string[],
  }
}
