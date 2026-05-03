export type CommentRow = { verdict: string }

export function summarizeComments(comments: CommentRow[]) {
  const total = comments.length
  if (!total) {
    return {
      total: 0,
      pct: { deal: 0, negotiate: 0, walk: 0 },
      counts: { deal: 0, negotiate: 0, walk: 0 },
    }
  }

  let deal = 0
  let negotiate = 0
  let walk = 0

  for (const c of comments) {
    if (c.verdict === "DEAL") deal++
    else if (c.verdict === "NEGOTIATE") negotiate++
    else if (c.verdict === "WALK_AWAY") walk++
  }

  const pct = (n: number) => Math.round((n / total) * 1000) / 10

  return {
    total,
    pct: { deal: pct(deal), negotiate: pct(negotiate), walk: pct(walk) },
    counts: { deal, negotiate, walk },
  }
}
