import { supabase } from "@/src/lib/supabase"
import { summarizeComments } from "@/src/lib/commentSummary"

const SHARE_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function GET(_req: Request, ctx: { params: Promise<{ share_id: string }> }) {
  try {
    const { share_id } = await ctx.params
    if (!SHARE_ID_RE.test(share_id)) {
      return Response.json({ error: "NOT_FOUND" }, { status: 404 })
    }

    const { data: deal, error: dErr } = await supabase.from("deals").select("*").eq("share_id", share_id).maybeSingle()

    if (dErr || !deal) {
      return Response.json({ error: "NOT_FOUND" }, { status: 404 })
    }

    const { data: comments, error: cErr } = await supabase
      .from("deal_comments")
      .select("*")
      .eq("deal_id", deal.id)
      .order("created_at", { ascending: true })

    if (cErr) {
      return Response.json({ error: "SERVER_ERROR", message: cErr.message }, { status: 500 })
    }

    const summary = summarizeComments(comments ?? [])

    return Response.json({ deal, comments: comments ?? [], summary })
  } catch (e) {
    console.error(e)
    return Response.json({ error: "SERVER_ERROR" }, { status: 500 })
  }
}
