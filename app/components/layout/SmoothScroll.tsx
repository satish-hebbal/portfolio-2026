"use client"

import { useEffect } from 'react'
import Lenis from 'lenis'
import { prefersReducedMotion } from '@/lib/motion'

export default function SmoothScroll() {
  useEffect(() => {
    // Smoothed wheel scrolling is motion; people who ask for less get the
    // browser's native scroll, and every caller already falls back to it
    if (prefersReducedMotion()) return

    const lenis = new Lenis({
      duration:  1.2,
      easing:    (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    })

    ;(window as any).__lenis = lenis

    let id = 0
    const raf = (time: number) => {
      lenis.raf(time)
      id = requestAnimationFrame(raf)
    }

    id = requestAnimationFrame(raf)

    return () => {
      // stop the loop too, otherwise it keeps ticking a destroyed instance
      cancelAnimationFrame(id)
      lenis.destroy()
      ;(window as any).__lenis = null
    }
  }, [])

  return null
}
