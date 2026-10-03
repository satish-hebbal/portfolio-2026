"use client"

import Link from 'next/link'
import Image from 'next/image'
import { useRef, useEffect } from 'react'
import SectionHeader from './SectionHeader'
import { onScrollFrame, prefersReducedMotion } from '@/lib/motion'

const works = [
  {
    num: '01',
    title: 'Smart Nation',
    description: 'Brand, product, and motion design for a smart home IoT startup. 280+ units installed across 40+ spaces. Shipped in 3 months.',
    image: '/images/WorkImages/smartNationImages/SN-thumb.png',
    href: '/works/smartNation',
    year: '2025',
    available: true,
  },
  {
    num: '02',
    title: 'Healthcare SaaS',
    description: 'Designed V1 of a SaaS that puts solo physicians on 40+ patient platforms from one profile. $350+ MRR within weeks of launch. Shipped in 3 weeks.',
    image: '/images/WorkImages/hsaasImages/hs-thumbnail.png',
    href: '/works/healthcare-saas',
    year: '2025',
    available: true,
  },
  {
    num: '03',
    title: 'SkinSage',
    description: 'Designed the full product for a personalised skincare app: skin assessment, dermatologist consultation, and AI routine builder. 73% day-7 retention.',
    image: '/images/WorkImages/skinSageImages/SS-thumnail-1.png',
    href: '/works/skinSage',
    year: '2025',
    available: true,
  },
  {
    num: '04',
    title: 'SkillRadius',
    description: 'Designed the full product for a job-skill learning platform: courses, video lessons, notes, quizzes, and dashboard. Zero to V1, end to end.',
    image: '/images/WorkImages/skillradius/SR-thumnail.png',
    href: '/works/skillRadius',
    year: '2025',
    available: true,
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

export default function WorkGallery() {
  const branchContainerRef = useRef<HTMLDivElement>(null)

  // Parallax + tilt for all branches via data attributes
  useEffect(() => {
    if (prefersReducedMotion()) return
    // parse the data attributes once, not on every frame
    const items = Array.from(branchContainerRef.current?.querySelectorAll<HTMLImageElement>('[data-branch]') ?? []).map(el => ({
      el,
      speed:   parseFloat(el.dataset.speed   ?? '0.1'),
      baseRot: parseFloat(el.dataset.rot     ?? '-25'),
      tiltDir: parseFloat(el.dataset.tiltdir ?? '1'),
      flip:    el.dataset.flip === 'true',
    }))
    return onScrollFrame((y) => {
      const tilt = Math.min(y * 0.015, 8)
      for (const b of items) {
        const dy = -(y * b.speed)
        const rot = b.baseRot + b.tiltDir * tilt
        b.el.style.transform = b.flip
          ? `translateY(${dy}px) scaleX(-1) rotate(${rot}deg)`
          : `translateY(${dy}px) rotate(${rot}deg)`
      }
    })
  }, [])

  return (
    <div>

      <SectionHeader left={['S', 'elected']} right={['W', 'orks']} />

      {/* ── Works list ─────────────────────────────────────── */}
      <div className="relative" ref={branchContainerRef}>

        {/* Left branches */}
        <img data-branch data-speed="0.18" data-rot="-25" data-tiltdir="-1" data-flip="true"
          src="/images/HomeImages/branch.webp" alt="" aria-hidden="true" loading="lazy" decoding="async"
          className="hidden md:block absolute pointer-events-none select-none"
          style={{ width: 'auto', height: '460px', top: '5%',  left: 'calc(50% - 50vw - 35px)', transform: 'translateY(0px) scaleX(-1) rotate(-25deg)', opacity: 0.13, willChange: 'transform' }}
        />
        <img data-branch data-speed="0.13" data-rot="-20" data-tiltdir="-1" data-flip="true"
          src="/images/HomeImages/branch.webp" alt="" aria-hidden="true" loading="lazy" decoding="async"
          className="hidden md:block absolute pointer-events-none select-none"
          style={{ width: 'auto', height: '420px', top: '38%', left: 'calc(50% - 50vw - 45px)', transform: 'translateY(0px) scaleX(-1) rotate(-20deg)', opacity: 0.11, willChange: 'transform' }}
        />
        <img data-branch data-speed="0.20" data-rot="-28" data-tiltdir="-1" data-flip="true"
          src="/images/HomeImages/branch.webp" alt="" aria-hidden="true" loading="lazy" decoding="async"
          className="hidden md:block absolute pointer-events-none select-none"
          style={{ width: 'auto', height: '400px', top: '72%', left: 'calc(50% - 50vw - 30px)', transform: 'translateY(0px) scaleX(-1) rotate(-28deg)', opacity: 0.10, willChange: 'transform' }}
        />

        {/* Right branches */}
        <img data-branch data-speed="0.09" data-rot="-25" data-tiltdir="1" data-flip="false"
          src="/images/HomeImages/branch.webp" alt="" aria-hidden="true" loading="lazy" decoding="async"
          className="hidden md:block absolute pointer-events-none select-none"
          style={{ width: 'auto', height: '430px', top: '20%', right: 'calc(50% - 50vw - 30px)', transform: 'translateY(0px) rotate(-25deg)', opacity: 0.11, willChange: 'transform' }}
        />
        <img data-branch data-speed="0.15" data-rot="-22" data-tiltdir="1" data-flip="false"
          src="/images/HomeImages/branch.webp" alt="" aria-hidden="true" loading="lazy" decoding="async"
          className="hidden md:block absolute pointer-events-none select-none"
          style={{ width: 'auto', height: '450px', top: '55%', right: 'calc(50% - 50vw - 40px)', transform: 'translateY(0px) rotate(-22deg)', opacity: 0.12, willChange: 'transform' }}
        />
        <img data-branch data-speed="0.11" data-rot="-18" data-tiltdir="1" data-flip="false"
          src="/images/HomeImages/branch.webp" alt="" aria-hidden="true" loading="lazy" decoding="async"
          className="hidden md:block absolute pointer-events-none select-none"
          style={{ width: 'auto', height: '390px', top: '85%', right: 'calc(50% - 50vw - 25px)', transform: 'translateY(0px) rotate(-18deg)', opacity: 0.10, willChange: 'transform' }}
        />

      <div className="flex flex-col gap-10 md:gap-16">
        {works.map((work) => (
          <div
            key={work.num}
            className="relative border border-gray-200 grid grid-cols-1 md:grid-cols-2"
          >
            {/* Corner plus markers */}
            <Plus h="left"  v="top" />
            <Plus h="right" v="top" />
            <Plus h="left"  v="bottom" />
            <Plus h="right" v="bottom" />

            {/* Info — left on desktop, below image on mobile */}
            <div className="p-6 md:p-10 flex flex-col justify-between order-2 md:order-1 bg-white/80">
              <div>
                <h3
                  className="text-2xl md:text-3xl font-light text-black mb-4"
                  style={{ fontFamily: 'SatishSans, sans-serif' }}
                >
                  {work.title}
                </h3>
                <p
                  className="text-sm text-gray-400 leading-relaxed max-w-sm"
                  style={{ fontFamily: 'FunnelDisplay, sans-serif' }}
                >
                  {work.description}
                </p>
              </div>

              <div className="mt-8 flex items-end justify-between">
                <span
                  className="text-xs text-gray-400"
                  style={{ fontFamily: 'FunnelDisplay, sans-serif' }}
                >
                  {work.year}
                </span>
                {work.available && work.href && (
                  <Link
                    href={work.href}
                    className="px-4 py-2 border border-gray-900 text-xs text-gray-900 hover:bg-gray-900 hover:text-white transition-colors duration-200 shrink-0 flex items-center gap-2"
                    style={{ fontFamily: 'FunnelDisplay, sans-serif' }}
                  >
                    View Work
                    <svg xmlns="http://www.w3.org/2000/svg" height="14px" viewBox="0 -960 960 960" width="14px" fill="currentColor">
                      <path d="M251.77-254.23 210-296l393.62-394H245.77v-60h460v460h-60v-357.85l-394 393.62Z"/>
                    </svg>
                  </Link>
                )}
              </div>
            </div>

            {/* Image — right on desktop, above info on mobile */}
            <Link href={work.href ?? '#'} className="relative overflow-hidden order-1 md:order-2 aspect-square block bg-gray-100">
              {work.image && (
                <Image
                  src={work.image}
                  alt={work.title}
                  fill
                  sizes="(max-width: 768px) 100vw, 50vw"
                  className={`object-cover${work.available ? '' : ' blur-sm brightness-75'}`}
                />
              )}
              {!work.available && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span
                    className="text-gray-400 text-xs tracking-widest uppercase"
                    style={{ fontFamily: 'FunnelDisplay, sans-serif' }}
                  >
                    Posting soon
                  </span>
                </div>
              )}
            </Link>
          </div>
        ))}
      </div>

      </div>{/* end relative wrapper */}

    </div>
  )
}
