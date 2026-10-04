import { NextRequest, NextResponse } from 'next/server'

// Song search for the YT Walkman.
//
// Uses the YouTube Data API when YOUTUBE_API_KEY is set (and filters to
// embeddable videos, so every result actually plays). Without a key it falls
// back to reading the public results page, which needs no setup but can break
// if YouTube changes its markup; the Walkman still accepts pasted links either way.

export interface YtResult {
  id: string
  title: string
  author: string
  duration: string
}

const MAX_RESULTS = 8

export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get('q') ?? '').trim().slice(0, 100)
  if (!q) return NextResponse.json({ results: [] })

  try {
    const results = process.env.YOUTUBE_API_KEY ? await viaApi(q, process.env.YOUTUBE_API_KEY) : await viaResultsPage(q)
    return NextResponse.json(
      { results },
      { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' } },
    )
  } catch {
    return NextResponse.json({ results: [], error: 'search unavailable' }, { status: 502 })
  }
}

async function viaApi(q: string, key: string): Promise<YtResult[]> {
  const params = new URLSearchParams({
    part: 'snippet', type: 'video', videoEmbeddable: 'true', maxResults: String(MAX_RESULTS), q, key,
  })
  const res = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`)
  if (!res.ok) throw new Error(`api ${res.status}`)
  const data = await res.json()
  return (data.items ?? []).map((it: { id: { videoId: string }; snippet: { title: string; channelTitle: string } }) => ({
    id: it.id.videoId,
    title: decodeEntities(it.snippet.title),
    author: decodeEntities(it.snippet.channelTitle),
    duration: '',
  }))
}

async function viaResultsPage(q: string): Promise<YtResult[]> {
  const res = await fetch(`https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
      Cookie: 'SOCS=CAI', // skip the EU consent interstitial
    },
    next: { revalidate: 3600 },
  })
  if (!res.ok) throw new Error(`page ${res.status}`)
  const html = await res.text()
  const m = html.match(/ytInitialData\s*=\s*(\{[\s\S]+?\});\s*<\/script>/)
  if (!m) throw new Error('no data')

  const out: YtResult[] = []
  const walk = (o: unknown) => {
    if (out.length >= MAX_RESULTS || !o || typeof o !== 'object') return
    const v = (o as { videoRenderer?: VideoRenderer }).videoRenderer
    if (v) {
      // skip live streams' "upcoming" placeholders and anything without an id
      if (v.videoId && v.title?.runs?.[0]?.text) {
        out.push({
          id: v.videoId,
          title: v.title.runs[0].text,
          author: v.ownerText?.runs?.[0]?.text ?? '',
          duration: v.lengthText?.simpleText ?? 'LIVE',
        })
      }
      return
    }
    for (const k in o as Record<string, unknown>) walk((o as Record<string, unknown>)[k])
  }
  walk(JSON.parse(m[1]))
  return out
}

interface VideoRenderer {
  videoId?: string
  title?: { runs?: { text: string }[] }
  ownerText?: { runs?: { text: string }[] }
  lengthText?: { simpleText?: string }
}

const decodeEntities = (s: string) =>
  s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
