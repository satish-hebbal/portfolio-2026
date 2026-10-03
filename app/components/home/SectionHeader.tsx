"use client"

import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { prefersReducedMotion } from '@/lib/motion'

gsap.registerPlugin(ScrollTrigger)

// A word is its swash capital plus the rest, e.g. ['S', 'elected']
type Word = [cap: string, rest: string]

let fontsRefreshQueued = false

// Home page section title: the words start centred side by side, then part to
// the edges of the content column while a hairline grows between them.
//
// Target positions come from offsetLeft/offsetWidth, which ignore transforms,
// so they can be recomputed at any time, including mid-animation. That lets
// ScrollTrigger's invalidateOnRefresh re-measure on every resize; the old
// per-section copies measured once and drifted after a window resize.
export default function SectionHeader({ left, right }: { left: Word; right?: Word }) {
  const rowRef   = useRef<HTMLHeadingElement>(null)
  const leftRef  = useRef<HTMLSpanElement>(null)
  const rightRef = useRef<HTMLSpanElement>(null)
  const lineRef  = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const row = rowRef.current, l = leftRef.current, r = rightRef.current, line = lineRef.current
    if (!row || !l || !line) return

    const ctx = gsap.context(() => {
      gsap.set(line, { scaleX: 0, transformOrigin: 'center center', opacity: 0 })

      const reduced = prefersReducedMotion()
      const tl = gsap.timeline({
        defaults: { duration: 1.1, ease: 'power3.inOut' },
        scrollTrigger: reduced ? undefined : {
          trigger: row,
          start: 'top 80%',
          toggleActions: 'play none none reverse',
          invalidateOnRefresh: true,
        },
      })

      tl.to(l, { x: () => -l.offsetLeft }, 0)
        .to(line, { scaleX: 1, opacity: 1, ease: 'power2.inOut' }, 0)
      if (r) tl.to(r, { x: () => row.clientWidth - r.offsetWidth - r.offsetLeft }, 0)

      if (reduced) tl.progress(1)
    })

    // Swash capitals change word widths once the custom fonts arrive;
    // one refresh for the whole page re-measures every header
    if (!fontsRefreshQueued && document.fonts) {
      fontsRefreshQueued = true
      document.fonts.ready.then(() => { fontsRefreshQueued = false; ScrollTrigger.refresh() })
    }

    return () => ctx.revert()
  }, [])

  const word = (w: Word) => (
    <>
      <span style={{ fontFamily: 'SatishCapsSans, sans-serif', fontSize: '1.5em' }}>{w[0]}</span><span style={{ fontFamily: 'SatishSans, sans-serif' }}>{w[1]}</span>
    </>
  )

  return (
    <div className="px-6 md:px-10 pb-8 md:pb-12 overflow-hidden">
      {/* Inner wrapper: height = text height only, so top:50% = text midline */}
      <div className="relative">
        {/* Line: spans full content width, vertically centred with the text */}
        <div
          ref={lineRef}
          className="absolute inset-x-0 border-t border-gray-300"
          style={{ top: '50%' }}
        />

        {/* Words: start naturally centered side-by-side. One heading for the
            whole title so it reads as "Selected Works", not two headings */}
        <h2 ref={rowRef} className="relative flex items-baseline justify-center gap-2 text-2xl md:text-3xl font-light text-black">
          <span
            ref={leftRef}
            className="relative bg-white pr-3 shrink-0 whitespace-nowrap"
          >
            {word(left)}
          </span>
          {right && (
            <>
              {' '}
              <span
                ref={rightRef}
                className="relative bg-white pl-3 shrink-0 whitespace-nowrap"
              >
                {word(right)}
              </span>
            </>
          )}
        </h2>
      </div>
    </div>
  )
}
