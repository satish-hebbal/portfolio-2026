"use client"

import { useRef, useEffect } from 'react'

// ─── Bloom config ─────────────────────────────────────────────────────────────
const BLOOM = {
  radius:  140,                        // px — size of the color circle
  color:   'rgba(59, 130, 246, 0.85)', // blue — change hue/opacity here
  // Try: 'rgba(168, 85, 247, 0.8)'  → purple
  // Try: 'rgba(239, 68, 68, 0.8)'   → red
  // Try: 'rgba(16, 185, 129, 0.8)'  → green
}

// A circle the size of the bloom, moved with transform. The old version was a
// full-viewport layer whose gradient was rewritten on every mousemove, which
// made the browser re-blend the whole page each time; this only blends the
// circle's own area and the move itself stays on the compositor.
export default function MouseColorBloom() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    // touch screens have no hover position to follow
    if (!window.matchMedia('(pointer: fine)').matches) return

    let x = 0, y = 0, frame = 0
    const paint = () => {
      frame = 0
      el.style.transform = `translate3d(${x - BLOOM.radius}px, ${y - BLOOM.radius}px, 0)`
      el.style.opacity = '1'
    }
    const onMove = (e: MouseEvent) => {
      x = e.clientX
      y = e.clientY
      if (!frame) frame = requestAnimationFrame(paint)
    }
    const onLeave = () => { el.style.opacity = '0' }

    window.addEventListener('mousemove', onMove, { passive: true })
    document.documentElement.addEventListener('mouseleave', onLeave)
    return () => {
      window.removeEventListener('mousemove', onMove)
      document.documentElement.removeEventListener('mouseleave', onLeave)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [])

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="fixed top-0 left-0 pointer-events-none"
      style={{
        zIndex: 2,
        width: BLOOM.radius * 2,
        height: BLOOM.radius * 2,
        opacity: 0,
        borderRadius: '50%',
        background: `radial-gradient(circle closest-side, ${BLOOM.color} 0%, transparent 100%)`,
        mixBlendMode: 'color',
        willChange: 'transform',
      }}
    />
  )
}
