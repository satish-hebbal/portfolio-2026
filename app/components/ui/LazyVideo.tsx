"use client"

import { useEffect, useRef } from 'react'
import { prefersReducedMotion } from '@/lib/motion'

type Props = {
  src: string
  poster?: string
  className?: string
}

// A muted looping clip that downloads nothing until it is about to scroll
// into view, plays only while visible, and stays on its poster frame for
// people who prefer reduced motion. Replaces bare autoPlay videos, which all
// started downloading and decoding the moment a case study opened.
export default function LazyVideo({ src, poster, className }: Props) {
  const ref = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const video = ref.current
    if (!video || prefersReducedMotion()) return
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        if (!video.src) video.src = src
        video.play().catch(() => {})
      } else {
        video.pause()
      }
    }, { rootMargin: '200px 0px' })
    io.observe(video)
    return () => io.disconnect()
  }, [src])

  return (
    <video
      ref={ref}
      className={className}
      poster={poster}
      preload="none"
      loop
      muted
      playsInline
      aria-hidden="true"
    />
  )
}
