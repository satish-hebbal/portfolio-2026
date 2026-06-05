"use client"

import Link from 'next/link'
import Image from 'next/image'
import { useRef, useEffect } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

const proposals = [
  {
    num: '01',
    title: 'xPay Card Installments',
    description: "Identified a real support cost in xPay's Card Installments flow. Designed the fix.",
    logoColor: '/images/proposals/Xpay/Xpay-logo.png',
    href: '/proposals/xpay',
    year: '2025',
    tag: 'UX Redesign',
    external: false,
    bigLogo: false,
  },
  {
    num: '02',
    title: 'xPay Lander Redesign',
    description: "A fresh take on the xPay marketing website. Cleaner hierarchy, sharper conversion focus.",
    logoColor: '/images/proposals/Xpay/hero-asset-1.png',
    href: 'https://xpay-lander-proposal.satishhebbal.design/',
    year: '2025',
    tag: 'Web Redesign',
    external: true,
    bigLogo: true,
  },
]

// Corner plus marker
const Plus = ({ h, v = 'bottom' }: { h: 'left' | 'right'; v?: 'top' | 'bottom' }) => (
  <span
    className="absolute select-none pointer-events-none"
    style={{
      [h]: 0,
      [v]: 0,
      transform: `translate(${h === 'left' ? '-50%' : '50%'}, ${v === 'top' ? '-50%' : '50%'})`,
      fontFamily: 'monospace',
      fontSize: '13px',
      lineHeight: 1,
      color: '#9ca3af',
      zIndex: 10,
    }}
  >+</span>
)

export default function ProposalsGallery() {
  const headerRef  = useRef<HTMLDivElement>(null)
  const designEl   = useRef<HTMLHeadingElement>(null)
  const proposalEl = useRef<HTMLHeadingElement>(null)
  const lineEl     = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const header   = headerRef.current
    const design   = designEl.current
    const proposal = proposalEl.current
    const line     = lineEl.current
    if (!header || !design || !proposal || !line) return

    let tl: gsap.core.Timeline

    const setup = () => {
      const cRect = header.getBoundingClientRect()
      const dRect = design.getBoundingClientRect()
      const pRect = proposal.getBoundingClientRect()

      const paddingX     = parseFloat(window.getComputedStyle(header).paddingLeft)
      const contentLeft  = cRect.left + paddingX
      const contentRight = cRect.right - paddingX

      const designFinalX   = contentLeft - dRect.left
      const proposalFinalX = (contentRight - pRect.width) - pRect.left

      gsap.set(line, { scaleX: 0, transformOrigin: 'center center', opacity: 0 })

      tl = gsap.timeline({
        defaults: { duration: 1.1, ease: 'power3.inOut' },
        scrollTrigger: {
          trigger: header,
          start: 'top 80%',
          toggleActions: 'play none none reverse',
        },
      })

      tl.to(design,   { x: designFinalX }, 0)
        .to(line,     { scaleX: 1, opacity: 1, ease: 'power2.inOut' }, 0)
        .to(proposal, { x: proposalFinalX }, 0)
    }

    document.fonts.ready.then(() => requestAnimationFrame(setup))

    return () => { tl?.kill() }
  }, [])

  return (
    <div className="mt-20 md:mt-28">

      {/* Section header */}
      <div
        ref={headerRef}
        className="px-6 md:px-10 pb-8 md:pb-12 overflow-hidden"
      >
        <div className="relative">
          <div
            ref={lineEl}
            className="absolute inset-x-0 border-t border-gray-300"
            style={{ top: '50%' }}
          />
          <div className="relative flex items-baseline justify-center gap-2">
            <h2
              ref={designEl}
              className="relative bg-white pr-3 text-2xl md:text-3xl font-light text-black shrink-0 whitespace-nowrap"
            >
              <span style={{ fontFamily: 'SatishCapsSans, sans-serif', fontSize: '1.5em' }}>D</span><span style={{ fontFamily: 'SatishSans, sans-serif' }}>esign</span>
            </h2>
            <h2
              ref={proposalEl}
              className="relative bg-white pl-3 text-2xl md:text-3xl font-light text-black shrink-0 whitespace-nowrap"
            >
              <span style={{ fontFamily: 'SatishCapsSans, sans-serif', fontSize: '1.5em' }}>P</span><span style={{ fontFamily: 'SatishSans, sans-serif' }}>roposals</span>
            </h2>
          </div>
        </div>
      </div>

      {/* Cards */}
      <div className="flex flex-col gap-3">
        {proposals.map((item) => {
          const inner = (
            <>
              <Plus h="left" v="top" />
              <Plus h="right" v="top" />
              <Plus h="left" v="bottom" />
              <Plus h="right" v="bottom" />

              {item.bigLogo ? (
                <>
                  <div
                    className="absolute left-0 hidden md:block"
                    style={{ bottom: -25, width: 90, height: 140, pointerEvents: 'none' }}
                  >
                    <Image
                      src={item.logoColor}
                      alt={item.title}
                      fill
                      sizes="90px"
                      className="object-contain object-left-bottom"
                    />
                  </div>
                  <div className="flex flex-row items-stretch md:pl-[110px]" style={{ minHeight: 80 }}>
                    <div className="relative shrink-0 md:hidden self-stretch" style={{ width: 80 }}>
                      <Image
                        src={item.logoColor}
                        alt={item.title}
                        fill
                        sizes="80px"
                        className="object-contain"
                      />
                    </div>
                    <div className="flex flex-1 items-center justify-between px-4 md:px-7 gap-4 py-4 md:py-0">
                      <div className="flex flex-col gap-1 min-w-0">
                        <h3
                          className="text-sm md:text-lg font-light text-black leading-tight"
                          style={{ fontFamily: 'SatishSans, sans-serif' }}
                        >
                          {item.title}
                        </h3>
                        <p
                          className="text-xs text-gray-400 leading-snug line-clamp-2"
                          style={{ fontFamily: 'FunnelDisplay, sans-serif', fontWeight: 300 }}
                        >
                          {item.description}
                        </p>
                      </div>
                      <span
                        className="text-xs text-black shrink-0 group-hover:translate-x-1 transition-transform duration-200 inline-flex items-center gap-1"
                        style={{ fontFamily: 'FunnelDisplay, sans-serif' }}
                      >
                        View
                        <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
                          <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex flex-row items-center">

                  {/* Logo */}
                  <div className="relative overflow-hidden shrink-0 flex items-center justify-center w-20 md:w-[110px] h-[72px]">
                    <Image
                      src={item.logoColor}
                      alt={item.title}
                      fill
                      sizes="110px"
                      className="object-contain p-3 md:p-4"
                    />
                  </div>

                  {/* Meta */}
                  <div className="flex flex-1 items-center justify-between px-4 md:px-7 gap-4 py-3 md:py-0">
                    <div className="flex flex-col gap-1 min-w-0">
                      <h3
                        className="text-sm md:text-lg font-light text-black leading-tight"
                        style={{ fontFamily: 'SatishSans, sans-serif' }}
                      >
                        {item.title}
                      </h3>
                      <p
                        className="text-xs text-gray-400 leading-snug line-clamp-2"
                        style={{ fontFamily: 'FunnelDisplay, sans-serif', fontWeight: 300 }}
                      >
                        {item.description}
                      </p>
                    </div>
                    <span
                      className="text-xs text-black shrink-0 group-hover:translate-x-1 transition-transform duration-200 inline-flex items-center gap-1"
                      style={{ fontFamily: 'FunnelDisplay, sans-serif' }}
                    >
                      View
                      <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
                        <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                  </div>

                </div>
              )}
            </>
          )

          const cardClass = `group block relative border border-gray-200 bg-white hover:border-gray-400 transition-colors duration-300 overflow-hidden`

          return item.external ? (
            <a
              key={item.num}
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
              className={cardClass}
            >
              {inner}
            </a>
          ) : (
            <Link
              key={item.num}
              href={item.href}
              className={cardClass}
            >
              {inner}
            </Link>
          )
        })}
      </div>

    </div>
  )
}
