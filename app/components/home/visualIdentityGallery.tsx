"use client"

import Image from 'next/image'
import { useRef, useEffect, useState } from 'react'
import SectionHeader from './SectionHeader'

const fuellstackImages = [
  '/images/Visuals/fuellstack-V/FS-1.png',
  '/images/Visuals/fuellstack-V/FS-2.png',
  '/images/Visuals/fuellstack-V/FS-3.png',
  '/images/Visuals/fuellstack-V/FS-4.png',
]

// 4-box layout matching reference:
// [ large square (cycling) ] [ wide rectangle ]
// [ large square (cycling) ] [ sq ] [ sq     ]
const items = [
  { image: 'cycling', alt: 'Fuellstack Visual Identity', col: '1 / 3', row: '1 / 3' },
  { image: '',        alt: 'Visual 02',                  col: '3 / 5', row: '1 / 2' },
  { image: '',        alt: 'Visual 03',                  col: '3 / 4', row: '2 / 3' },
  { image: '',        alt: 'Visual 04',                  col: '4 / 5', row: '2 / 3' },
]

export default function VisualIdentityGallery() {
  const rootRef = useRef<HTMLDivElement>(null)
  const [cycleIndex, setCycleIndex] = useState(0)

  // Cycle only while the collage is on screen; it used to re-render twice a
  // second for the whole visit, wherever the reader was on the page
  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    let id: ReturnType<typeof setInterval> | undefined
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !id) {
        id = setInterval(() => setCycleIndex(i => (i + 1) % fuellstackImages.length), 500)
      } else if (!entry.isIntersecting && id) {
        clearInterval(id)
        id = undefined
      }
    })
    io.observe(el)
    return () => { io.disconnect(); if (id) clearInterval(id) }
  }, [])

  return (
    <div ref={rootRef} className="mt-20 md:mt-28">

      <SectionHeader left={['V', 'isual']} right={['I', 'dentity']} />

      {/* ── Desktop collage (md+) ─────────────────────────────── */}
      <div className="hidden md:flex gap-2">

        {/* Left: cycling square — aspect-ratio makes it truly 1:1 */}
        <div
          className="relative overflow-hidden bg-gray-50 shrink-0"
          style={{ flexBasis: 'calc(50% - 4px)', aspectRatio: '1 / 1' }}
        >
          {fuellstackImages.map((src, idx) => (
            <Image
              key={src}
              src={src}
              alt="Fuellstack Visual Identity"
              fill
              sizes="50vw"
              className="object-cover"
              style={{
                opacity: cycleIndex === idx ? 1 : 0,
                transition: 'opacity 0.15s ease-in-out',
                position: 'absolute',
              }}
            />
          ))}
        </div>

        {/* Right column: landscape top + 2 squares bottom */}
        <div className="flex flex-col gap-2 flex-1">
          <div className="relative overflow-hidden bg-gray-50 flex-1">
            <Image src="/images/Visuals/fuellstack-V/FS-bl0.png" alt="Fuellstack Visual" fill sizes="50vw" className="object-cover" />
          </div>
          <div className="flex gap-2">
            <div className="relative overflow-hidden bg-gray-50 flex-1" style={{ aspectRatio: '1 / 1' }}>
              <Image src="/images/Visuals/fuellstack-V/FS-m0.png" alt="Fuellstack Visual" fill sizes="25vw" className="object-cover" />
            </div>
            <div className="relative overflow-hidden bg-gray-50 flex-1" style={{ aspectRatio: '1 / 1' }}>
              <Image src="/images/Visuals/fuellstack-V/FS-ma1.png" alt="Fuellstack Visual" fill sizes="25vw" className="object-cover" />
            </div>
          </div>
        </div>

      </div>

      {/* ── Mobile collage ────────────────────────────────────── */}
      <div className="grid md:hidden gap-1.5">
        {/* Cycling box: full width, 1:1 */}
        <div className="relative overflow-hidden bg-gray-50" style={{ aspectRatio: '1/1' }}>
          {fuellstackImages.map((src, idx) => (
            <Image
              key={src}
              src={src}
              alt="Fuellstack Visual Identity"
              fill
              sizes="100vw"
              className="object-cover"
              style={{
                opacity: cycleIndex === idx ? 1 : 0,
                transition: 'opacity 0.15s ease-in-out',
                position: 'absolute',
              }}
            />
          ))}
        </div>
        {/* Wide rectangle */}
        <div className="relative overflow-hidden bg-gray-50" style={{ aspectRatio: '2/1' }}>
          <Image src="/images/Visuals/fuellstack-V/FS-bl0.png" alt="Fuellstack Visual" fill sizes="100vw" className="object-cover" />
        </div>
        {/* Two small squares */}
        <div className="grid grid-cols-2 gap-1.5">
          <div className="relative overflow-hidden bg-gray-50" style={{ aspectRatio: '1/1' }}>
            <Image src="/images/Visuals/fuellstack-V/FS-m0.png" alt="Fuellstack Visual" fill sizes="50vw" className="object-cover" />
          </div>
          <div className="relative overflow-hidden bg-gray-50" style={{ aspectRatio: '1/1' }}>
            <Image src="/images/Visuals/fuellstack-V/FS-ma1.png" alt="Fuellstack Visual" fill sizes="50vw" className="object-cover" />
          </div>
        </div>
      </div>

    </div>
  )
}
