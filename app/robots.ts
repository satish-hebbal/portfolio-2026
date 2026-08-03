import type { MetadataRoute } from 'next'

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.satishhebbal.design'

// Deliberately minimal.
//
// /works/private/* is NOT listed here. robots.txt is a public file, so a Disallow
// line would advertise the exact path we are trying to keep unlisted, and it
// would also stop crawlers from reading the noindex directive on the page. That
// route is kept out of search by the X-Robots-Tag header in next.config.ts plus
// its own noindex metadata, which is both stronger and quieter.
//
// Retired URLs are handled in middleware.ts with a 410, not blocked here, for the
// same reason: a blocked URL can never be crawled, so its removal signal is never
// seen.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  }
}
