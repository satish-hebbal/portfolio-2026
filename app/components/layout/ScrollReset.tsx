"use client"

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { scrollToSection } from '@/lib/motion'

export default function ScrollReset() {
  const pathname = usePathname()

  useEffect(() => {
    // Give the new page DOM a frame to mount, then jump to top immediately.
    // Tries Lenis first (smooth scroll engine), falls back to native.
    requestAnimationFrame(() => {
      const lenis = (window as any).__lenis
      if (lenis) {
        lenis.scrollTo(0, { immediate: true })
      } else {
        window.scrollTo(0, 0)
      }

      // Arriving on a section link such as /#work: start from the top, then
      // glide down to the section once the page has had a frame to lay out
      const hash = window.location.hash.slice(1)
      if (hash) requestAnimationFrame(() => scrollToSection(hash))
    })
  }, [pathname])

  return null
}
