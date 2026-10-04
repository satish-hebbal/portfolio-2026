"use client"

import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { prefersReducedMotion } from '@/lib/motion'
import { ABHAY, TEJAS } from './ParallaxImages'
import DitherFigure from './DitherFigure'

gsap.registerPlugin(ScrollTrigger)

// Phone-only hero figures. They are anchored to the top of the page so they
// scroll away with the first fold while sliding out to their sides. (They
// used to be position:fixed, and only scrolled away because a stray transform
// on <main> turned fixed into absolute; this keeps that look on purpose.)
// Rendered at the page root rather than inside the hero, whose overflow
// would clip them. Phones have no hover, so the painting under each engraving
// is shown by a wave that crosses the figures as the first fold scrolls.
export default function ParallaxMobile() {
  const abhay = useRef<HTMLDivElement>(null)
  const tejas = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (prefersReducedMotion()) return
    const ctx = gsap.context(() => {
      const st = { trigger: document.body, start: 'top top', end: '25% top', scrub: true }
      gsap.to(abhay.current, { x: () => -window.innerWidth * 0.6, opacity: 0, ease: 'none', scrollTrigger: st })
      gsap.to(tejas.current, { x: () => window.innerWidth * 0.6, opacity: 0, ease: 'none', scrollTrigger: st })
    })
    return () => ctx.revert()
  }, [])

  return (
    <>
      <div
        ref={abhay}
        className="absolute block md:hidden pointer-events-none"
        style={{ width: 300, left: -135, top: '12vh', transform: 'rotate(22deg)', zIndex: 10, willChange: 'transform' }}
      >
        <DitherFigure wave name="abhay" src={ABHAY.src} paintedSrc="/images/HomeImages/abhay-painted.webp" natW={ABHAY.natW} natH={ABHAY.natH} sizes="300px" className="w-full h-auto object-contain block" />
      </div>
      <div
        ref={tejas}
        className="absolute block md:hidden pointer-events-none"
        style={{ width: 240, left: 'calc(100vw - 130px)', top: '22vh', transform: 'rotate(-18deg)', zIndex: 10, willChange: 'transform' }}
      >
        <DitherFigure wave name="tejas" src={TEJAS.src} paintedSrc="/images/HomeImages/tejas-painted.webp" natW={TEJAS.natW} natH={TEJAS.natH} sizes="240px" className="w-full h-auto object-contain block" />
      </div>
    </>
  )
}
