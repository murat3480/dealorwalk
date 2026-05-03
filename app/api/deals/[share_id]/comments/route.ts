import { supabase } from "@/src/lib/supabase"
import { summarizeComments } from "@/src/lib/commentSummary"

const SHARE_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const VERDICTS = new Set(["DEAL", "NEGOTIATE", "WALK_AWAY"])

export async function POST(req: Request, ctx: { params: Promise<{ share_id: string }> }) {
  try {
    const { share_id } = await ctx.params
    if (!SHARE_ID_RE.test(share_id)) {
      return Response.json({ error: "NOT_FOUND" }, { status: 404 })
    }

    const body = (await req.json()) as Record<string, unknown>
    const verdict = typeof body.verdict === "string" ? body.verdict.trim() : ""
    const reason = typeof body.reason === "string" ? body.reason.trim() : ""

    let suggested_price: number | null = null
    if (body.suggested_price !== undefined && body.suggested_price !== null && body.suggested_price !== "") {
      const n = Number(body.suggested_price)
      if (Number.isFinite(n) && n > 0) suggested_price = n
    }

    if (!VERDICTS.has(verdict)) {
      return Response.json(
        { error: "VALIDATION_ERROR", message: "verdict must be DEAL, NEGOTIATE, or WALK_AWAY" },
        { status: 400 }
      )
    }
    if (reason.length < 2) {
      return Response.json({ error: "VALIDATION_ERROR", message: "reason is required" }, { status: 400 })
    }

    const { data: deal, error: dealErr } = await supabase
      .from("deals")
      .select("id")
      .eq("share_id", share_id)
      .maybeSingle()

    if (dealErr || !deal) {
      return Response.json({ error: "NOT_FOUND" }, { status: 404 })
    }

    const { data: comment, error: insErr } = await supabase
      .from("deal_comments")
      .insert({
        deal_id: deal.id,
        verdict,
        reason,
        suggested_price,
      })
      .select()
      .single()

    if (insErr || !comment) {
      return Response.json({ error: "SERVER_ERROR", message: insErr?.message ?? "insert failed" }, { status: 500 })
    }

    const { data: all } = await supabase.from("deal_comments").select("verdict").eq("deal_id", deal.id)

    const summary = summarizeComments(all ?? [])

    return Response.json({ comment, summary })
  } catch (e) {
    console.error(e)
    return Response.json({ error: "SERVER_ERROR" }, { status: 500 })
  }
}
