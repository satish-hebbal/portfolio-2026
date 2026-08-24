"use client"

import { useRef, useEffect } from 'react'
import { gsap } from 'gsap'

export default function LabHeader() {
  const headerRef = useRef<HTMLHeadingElement>(null)
  const lineRef = useRef<HTMLSpanElement>(null)
  const labRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const header = headerRef.current
    const line = lineRef.current
    const lab = labRef.current
    if (!header || !line || !lab) return

    let cancelled = false
    let raf = 0
    let ctx: ReturnType<typeof gsap.context> | undefined

    const setup = () => {
      if (cancelled) return
      // Scoped context so a second run (StrictMode, fast refresh, remount) reverts
      // the first one instead of inheriting whatever mid-flight values it left behind
      ctx = gsap.context(() => {
        const tl = gsap.timeline({ defaults: { duration: 1.1, ease: 'power3.inOut' } })

        // fromTo, never from: explicit start AND end values, so re-running can't
        // capture a half-played opacity as the final state and leave "Lab" invisible
        tl.fromTo(
          line,
          { scaleX: 0, opacity: 0, transformOrigin: 'left center' },
          { scaleX: 1, opacity: 1, ease: 'power2.inOut' },
          0,
        ).fromTo(
          lab,
          { x: -80, opacity: 0 },
          { x: 0, opacity: 1, ease: 'power3.inOut' },
          0,
        )
      }, header)
    }

    // document.fonts.ready can stall or never settle; cap the wait so the
    // header always reveals itself even if font loading misbehaves
    const fontsReady: Promise<unknown> = document.fonts
      ? document.fonts.ready
      : Promise.resolve()

    Promise.race([
      fontsReady,
      new Promise((resolve) => setTimeout(resolve, 1200)),
    ]).then(() => {
      raf = requestAnimationFrame(setup)
    })

    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      ctx?.revert()
    }
  }, [])

  return (
    <h1
      ref={headerRef}
      className="flex items-center gap-4 mb-12 text-2xl md:text-3xl font-light text-black"
      style={{ fontFamily: 'SatishSans, sans-serif' }}
    >
      <span style={{ flexShrink: 0 }}>
        <span style={{ fontFamily: 'SatishCapsSans, sans-serif', fontSize: '1.5em' }}>T</span><span style={{ marginLeft: '4px' }}>he</span>
      </span>
      <span ref={lineRef} style={{ flex: 1, height: '1px', background: '#d1d5db', display: 'block' }} />
      <span ref={labRef} style={{ flexShrink: 0, fontFamily: 'SatishSans, sans-serif' }}>Lab</span>
    </h1>
  )
}
