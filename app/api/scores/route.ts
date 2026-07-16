import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '../../../lib/supabase'
import { supabaseAdmin } from '../../../lib/supabaseAdmin'

export async function GET() {
  const { data, error } = await supabase
    .from('leaderboard')
    .select('name, avg_score, country')
    .order('avg_score', { ascending: false })
    .limit(10)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { name, avg_score, country } = body

  if (!name || typeof avg_score !== 'number') {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  const cleanName = String(name).trim().slice(0, 32)
  const score = Math.max(0, Math.min(10, Number(avg_score.toFixed(2))))
  const cleanCountry = typeof country === 'string' ? country.slice(0, 2).toUpperCase() : ''

  // Use the service-role client: the leaderboard table's RLS blocks anon
  // inserts, so writes must go through a server-side privileged client.
  const { error } = await supabaseAdmin
    .from('leaderboard')
    .insert({ name: cleanName, avg_score: score, country: cleanCountry })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
