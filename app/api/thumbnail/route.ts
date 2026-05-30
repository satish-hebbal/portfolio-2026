import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const sizes = ['hqdefault', 'mqdefault', '0']
  for (const size of sizes) {
    try {
      const res = await fetch(`https://img.youtube.com/vi/${id}/${size}.jpg`, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
      })
      if (!res.ok) continue
      const blob = await res.blob()
      return new Response(blob, {
        headers: {
          'Content-Type': res.headers.get('Content-Type') || 'image/jpeg',
          'Cache-Control': 'public, max-age=86400',
        },
      })
    } catch {
      continue
    }
  }

  return NextResponse.json({ error: 'Failed to fetch thumbnail' }, { status: 502 })
}
