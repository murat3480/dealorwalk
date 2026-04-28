import OpenAI from 'openai'
import { NextResponse } from 'next/server'

export async function POST() {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'Missing OPENAI_API_KEY' }, { status: 500 })

  const client = new OpenAI({ apiKey })
  const response = await client.responses.create({
    model: 'gpt-4o-mini',
    input: 'Say hello in one sentence',
  })

  return NextResponse.json({ text: response.output_text })
}
