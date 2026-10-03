"use client"

import { useEffect, useRef } from 'react'
import { onScrollFrame, prefersReducedMotion } from '@/lib/motion'

// top = px from page top. edgeOffset = how far behind the screen edge to push it.
const BRANCHES = [
  // Left side — starts after hero, spaced ~1100px apart
  { side: 'left',  top: 1800, height: 370, rot: -25, speed: 0.08, tiltDir: -1, opacity: 0.09, flip: true,  edgeOffset: 105 },
  { side: 'left',  top: 3800, height: 360, rot: -22, speed: 0.07, tiltDir: -1, opacity: 0.08, flip: true,  edgeOffset: 100 },
  { side: 'right', top: 2700, height: 365, rot: -24, speed: 0.07, tiltDir:  1, opacity: 0.08, flip: false, edgeOffset: 110 },
  { side: 'right', top: 4700, height: 355, rot: -20, speed: 0.06, tiltDir:  1, opacity: 0.08, flip: false, edgeOffset: 100 },
]

export default function PageBranches() {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (prefersReducedMotion()) return
    const els = Array.from(containerRef.current?.querySelectorAll<HTMLImageElement>('[data-branch]') ?? [])
    // read config once instead of parsing data attributes every frame
    const items = els.map((el, i) => ({ el, ...BRANCHES[i] }))

    return onScrollFrame((y) => {
      const vh   = window.innerHeight
      const tilt = Math.min(y * 0.012, 6)
      for (const b of items) {
        // Parallax relative to each branch: 0 displacement when branch is at viewport centre
        const dy  = (y - (b.top - vh)) * b.speed * -1
        const rot = b.rot + b.tiltDir * tilt
        b.el.style.transform = b.flip
          ? `translateY(${dy}px) scaleX(-1) rotate(${rot}deg)`
          : `translateY(${dy}px) rotate(${rot}deg)`
      }
    })
  }, [])

  return (
    <div
      ref={containerRef}
      className="hidden md:block absolute inset-0 pointer-events-none select-none"
      style={{ zIndex: 0, overflow: 'clip' }}
    >
      {BRANCHES.map((b, i) => (
        <img
          key={i}
          data-branch
          src="/images/HomeImages/branch.webp"
          alt=""
          aria-hidden="true"
          loading="lazy"
          decoding="async"
          style={{
            position: 'absolute',
            top: b.top,
            [b.side]: `calc(50% - 50vw - ${b.edgeOffset}px)`,
            width: 'auto',
            height: `${b.height}px`,
            transform: b.flip
              ? `translateY(0px) scaleX(-1) rotate(${b.rot}deg)`
              : `translateY(0px) rotate(${b.rot}deg)`,
            // the art is already black, so plain opacity replaces the old
            // brightness(0) filter that had to be re-applied as it moved
            opacity: b.opacity,
            willChange: 'transform',
          }}
        />
      ))}
    </div>
  )
}
