import { NextResponse } from 'next/server'

// Permanently retired URLs.
//
// These return 410 Gone rather than 404. Both drop out of search eventually, but
// 410 is an explicit "this is never coming back" signal and Google acts on it
// faster. The X-Robots-Tag covers the case where a crawler indexes the response
// anyway, and applies to the image files too, which a page-level meta tag cannot
// reach.
//
// Do NOT also add these paths to robots.ts. Blocking the crawl would stop Google
// from ever seeing the 410, and the URL can then sit in the index as a bare
// listing indefinitely. Let them be crawled, seen, and dropped first.
export function proxy() {
  return new NextResponse(null, {
    status: 410,
    headers: {
      'X-Robots-Tag': 'noindex, nofollow, noimageindex',
    },
  })
}

export const config = {
  matcher: [
    '/works/blumeHealth',
    '/works/blumeHealth/:path*',
    '/images/WorkImages/blumeHealthImages/:path*',
  ],
}
