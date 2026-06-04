"use client"

import { useRef, useEffect } from 'react'
import { gsap } from 'gsap'

export default function LabHeader() {
  const headerRef = useRef<HTMLDivElement>(null)
  const leftIconRef = useRef<HTMLImageElement>(null)
  const rightIconRef = useRef<HTMLImageElement>(null)
  const leftLineRef = useRef<HTMLSpanElement>(null)
  const rightLineRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const header = headerRef.current
    const leftIcon = leftIconRef.current
    const rightIcon = rightIconRef.current
    const leftLine = leftLineRef.current
    const rightLine = rightLineRef.current
    if (!header || !leftIcon || !rightIcon || !leftLine || !rightLine) return

    const setup = () => {
      // Lines start at scale 0
      gsap.set(leftLine,  { scaleX: 0, transformOrigin: 'right center', opacity: 0 })
      gsap.set(rightLine, { scaleX: 0, transformOrigin: 'left center',  opacity: 0 })

      // Icons start pushed inward (no translateX — they're already next to the text)
      // We'll animate them outward as the lines expand
      const tl = gsap.timeline({ defaults: { duration: 1.1, ease: 'power3.inOut' } })

      tl.to(leftLine,  { scaleX: 1, opacity: 1, ease: 'power2.inOut' }, 0)
        .to(rightLine, { scaleX: 1, opacity: 1, ease: 'power2.inOut' }, 0)
        .from(leftIcon,  { x: 80, opacity: 0, ease: 'power3.inOut', duration: 1.1 }, 0)
        .from(rightIcon, { x: -80, opacity: 0, ease: 'power3.inOut', duration: 1.1 }, 0)
    }

    document.fonts.ready.then(() => requestAnimationFrame(setup))
  }, [])

  return (
    <div ref={headerRef} className="flex items-center gap-4 mb-12">
      <img ref={leftIconRef} src="/images/HomeImages/HandC-sm.webp" alt="" style={{ height: '28px', objectFit: 'contain', flexShrink: 0 }} />
      <span ref={leftLineRef} style={{ flex: 1, height: '1px', background: '#d1d5db', display: 'block' }} />
      <h1
        className="text-2xl md:text-3xl font-light text-black"
        style={{ fontFamily: 'SatishSans, sans-serif', flexShrink: 0 }}
      >
        <span style={{ fontFamily: 'SatishCapsSans, sans-serif', fontSize: '1.5em' }}>T</span><span style={{ marginLeft: '4px' }}>he</span>{' '}
        <span style={{ fontFamily: 'SatishSans, sans-serif' }}>Lab</span>
      </h1>
      <span ref={rightLineRef} style={{ flex: 1, height: '1px', background: '#d1d5db', display: 'block' }} />
      <img ref={rightIconRef} src="/images/HomeImages/HandC-sm.webp" alt="" style={{ height: '28px', objectFit: 'contain', flexShrink: 0 }} />
    </div>
  )
}
