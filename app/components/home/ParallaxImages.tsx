"use client"

import Image from 'next/image'
import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { prefersReducedMotion } from '@/lib/motion'
import DitherFigure from './DitherFigure'
import DitherPanel from './dither/DitherPanel'

gsap.registerPlugin(ScrollTrigger)

// Config mirrors ABHAY / TEJAS in page.tsx
const ABHAY = {
  src:    '/images/HomeImages/abhay-v.webp',
  // raster export of the traced SVG at 2x; the SVG was a 2.7 MB single path
  natW:   1312,
  natH:   1014,
  width:  590,
  left:   '-35%',
  top:    '-2%',
  rotate: 35,
}

const TEJAS = {
  src:    '/images/HomeImages/tejas-v.webp',
  natW:   1020,
  natH:   1240,
  width:  510,
  right:  '-35%',
  top:    '40%',
  rotate: -15,
}

export default function ParallaxImages() {
  const abhayDesktop = useRef<HTMLDivElement>(null)
  const tejasDesktop = useRef<HTMLDivElement>(null)
  const abhayMobile  = useRef<HTMLDivElement>(null)
  const tejasMobile  = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (prefersReducedMotion()) return
    const ctx = gsap.context(() => {
      const st = {
        trigger: document.body,
        start: 'top top',
        end: 'bottom bottom',
        scrub: true,
      }

      // Desktop: drift down + slide outward
      gsap.to(abhayDesktop.current, {
        y: () =>  window.innerHeight * 0.35,
        x: () => -window.innerWidth  * 0.25,
        ease: 'none',
        scrollTrigger: st,
      })
      gsap.to(tejasDesktop.current, {
        y: () =>  window.innerHeight * 0.35,
        x: () =>  window.innerWidth  * 0.25,
        ease: 'none',
        scrollTrigger: st,
      })

      // Mobile: slide off-screen to their respective sides on scroll
      const mobileScrollST = {
        trigger: document.body,
        start:   'top top',
        end:     '25% top',
        scrub:   true,
      }
      gsap.to(abhayMobile.current, {
        x:       () => -window.innerWidth * 0.6,
        opacity:  0,
        ease:    'none',
        scrollTrigger: mobileScrollST,
      })
      gsap.to(tejasMobile.current, {
        x:       () => window.innerWidth * 0.6,
        opacity:  0,
        ease:    'none',
        scrollTrigger: mobileScrollST,
      })
    })

    return () => ctx.revert()
  }, [])

  return (
    <>
      {/* temporary: dev or ?dither only */}
      <DitherPanel />
      {/* ── Desktop ──────────────────────────────────────────── */}
      <div
        ref={abhayDesktop}
        className="absolute h-auto hidden md:block pointer-events-none"
        style={{ width: ABHAY.width, left: ABHAY.left, top: ABHAY.top, transform: `rotate(${ABHAY.rotate}deg)`, zIndex: 10, willChange: 'transform' }}
      >
        <DitherFigure name="abhay" src={ABHAY.src} paintedSrc="/images/HomeImages/abhay-painted.webp" natW={ABHAY.natW} natH={ABHAY.natH} sizes="590px" className="w-full h-auto object-contain block" />
      </div>
      <div
        ref={tejasDesktop}
        className="absolute h-auto hidden md:block pointer-events-none"
        style={{ width: TEJAS.width, right: TEJAS.right, top: TEJAS.top, transform: `rotate(${TEJAS.rotate}deg)`, zIndex: 10, willChange: 'transform' }}
      >
        <DitherFigure name="tejas" src={TEJAS.src} paintedSrc="/images/HomeImages/tejas-painted.webp" natW={TEJAS.natW} natH={TEJAS.natH} sizes="510px" className="w-full h-auto object-contain block" />
      </div>

      {/* ── Mobile — fixed to viewport, no container clipping ───────────────── */}
      <div
        ref={abhayMobile}
        className="fixed block md:hidden pointer-events-none"
        style={{ width: 300, left: -135, top: '12vh', transform: 'rotate(22deg)', zIndex: 10, willChange: 'transform' }}
      >
        <Image src={ABHAY.src} alt="" width={ABHAY.natW} height={ABHAY.natH} loading="lazy" fetchPriority="high" sizes="300px" className="w-full h-auto object-contain block" />
      </div>
      <div
        ref={tejasMobile}
        className="fixed block md:hidden pointer-events-none"
        style={{ width: 240, left: 'calc(100vw - 130px)', top: '22vh', transform: 'rotate(-18deg)', zIndex: 10, willChange: 'transform' }}
      >
        <Image src={TEJAS.src} alt="" width={TEJAS.natW} height={TEJAS.natH} loading="lazy" fetchPriority="high" sizes="240px" className="w-full h-auto object-contain block" />
      </div>
    </>
  )
}
