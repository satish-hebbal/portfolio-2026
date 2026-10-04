import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id')
  if (!id || !/^[A-Za-z0-9_-]{11}$/.test(id)) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  // mqdefault is 16:9 with no letterbox bars (the Walkman's cassette window
  // uses it); everything else asks for the default order
  const preferred = request.nextUrl.searchParams.get('size')
  const sizes = preferred === 'mqdefault' ? ['mqdefault', 'hqdefault', '0'] : ['hqdefault', 'mqdefault', '0']
  // two image hosts, a few sizes each, and a short timeout per try: one slow
  // or missing thumbnail shouldn't hold the request (or the page) hostage
  const hosts = ['https://i.ytimg.com', 'https://img.youtube.com']
  for (const size of [...sizes, 'default']) {
    for (const host of hosts) {
      try {
        const res = await fetch(`${host}/vi/${id}/${size}.jpg`, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          signal: AbortSignal.timeout(4000),
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
  }

  return NextResponse.json({ error: 'No thumbnail available' }, { status: 404 })
}
