import type { MetadataRoute } from 'next'

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.satishhebbal.design'

// Public routes only. /works/private/* is intentionally absent, as are the
// retired URLs served as 410 by middleware.ts. Listing the new
// /works/healthcare-saas URL here is what gets it discovered and indexed quickly
// in place of the old one.
const routes = [
  '/',
  '/about',
  '/works/healthcare-saas',
  '/works/smartNation',
  '/works/skinSage',
  '/works/skillRadius',
  '/works/abhiyantrikWebsite',
  '/lab',
]

export default function sitemap(): MetadataRoute.Sitemap {
  return routes.map((route) => ({
    url: `${siteUrl}${route}`,
    changeFrequency: 'monthly' as const,
    priority: route === '/' ? 1 : 0.7,
  }))
}
