"use client"

import Image from 'next/image'
import { useEffect, useRef } from 'react'
import { prefersReducedMotion } from '@/lib/motion'
import { getSettings, subscribe } from './dither/settings'

// The two engraved temple pillars that frame the first fold. They sit at the
// top of the page and scroll away with the hero.
//
// Optional "lamp" cursor light: a warm glow that falls only on the stone, like
// an oil lamp carried along a temple corridor. Each pillar has a glow layer
// masked to the pillar's own silhouette, so the light can't spill onto the
// figures, the text or the page. The glow is a fixed-size circle moved with
// transform, so following the pointer never repaints the pillar.

const PILLARS = [
  { src: '/images/HomeImages/piller-v.webp', w: 2143, h: 1800, sizes: '120vh', side: { left: '-70px' } },
  { src: '/images/HomeImages/piller-2-v.webp', w: 621, h: 1800, sizes: '35vh', side: { right: '-40px' } },
]

export default function Pillars() {
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    if (prefersReducedMotion() || !window.matchMedia('(pointer: fine)').matches) return

    const lamps = Array.from(root.querySelectorAll<HTMLDivElement>('[data-lamp]'))
    const glows = lamps.map((l) => l.firstElementChild as HTMLDivElement)
    let pointer: { x: number; y: number } | null = null
    let frame = 0

    const style = () => {
      const s = getSettings()
      const on = s.cursorLight === 'lamp'
      const d = s.lampRadius * 2
      for (const g of glows) {
        g.style.width = g.style.height = `${d}px`
        g.style.background = `radial-gradient(circle closest-side, ${s.lampColor} 0%, transparent 100%)`
      }
      for (const l of lamps) {
        // the mask image is only requested once the lamp is actually used
        if (on && !l.style.maskImage) {
          const url = `url(${l.dataset.lamp})`
          l.style.maskImage = url
          l.style.setProperty('-webkit-mask-image', url)
        }
        l.style.opacity = on && pointer ? String(s.lampOpacity) : '0'
      }
      return on
    }

    const paint = () => {
      frame = 0
      if (!style() || !pointer) return
      const r = getSettings().lampRadius
      lamps.forEach((l, i) => {
        const b = l.getBoundingClientRect()
        glows[i].style.transform = `translate3d(${pointer!.x - b.left - r}px, ${pointer!.y - b.top - r}px, 0)`
      })
    }
    const kick = () => { if (!frame) frame = requestAnimationFrame(paint) }
    const onMove = (e: MouseEvent) => { pointer = { x: e.clientX, y: e.clientY }; kick() }
    const onLeave = () => { pointer = null; style() }
    const onScroll = () => { if (pointer) kick() }

    style()
    const unSub = subscribe(() => kick())
    window.addEventListener('mousemove', onMove, { passive: true })
    window.addEventListener('scroll', onScroll, { passive: true })
    document.documentElement.addEventListener('mouseleave', onLeave)
    return () => {
      unSub()
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('scroll', onScroll)
      document.documentElement.removeEventListener('mouseleave', onLeave)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [])

  return (
    <div ref={rootRef} aria-hidden="true">
      {PILLARS.map((p) => (
        <div
          key={p.src}
          className="absolute top-0 h-screen pointer-events-none select-none hidden md:block"
          style={{ zIndex: 0, ...p.side }}
        >
          <Image
            src={p.src}
            alt=""
            width={p.w}
            height={p.h}
            sizes={p.sizes}
            className="h-full w-auto block"
            style={{ opacity: 0.18 }}
          />
          {/* lamp light, cut to the pillar's silhouette */}
          <div
            data-lamp={p.src}
            className="absolute inset-0 overflow-hidden"
            style={{
              opacity: 0,
              transition: 'opacity 0.4s ease',
              WebkitMaskSize: '100% 100%',
              maskSize: '100% 100%',
              WebkitMaskRepeat: 'no-repeat',
              maskRepeat: 'no-repeat',
            }}
          >
            <div className="absolute top-0 left-0" style={{ willChange: 'transform' }} />
          </div>
        </div>
      ))}
    </div>
  )
}
