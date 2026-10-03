"use client"

import Link from 'next/link'
import Image from 'next/image'
import SectionHeader from './SectionHeader'

const items = [
  {
    num: '01',
    title: 'Corner Table',
    description: 'Built a corner table from scratch: cut, assembled, painted, and finished. A hands-on experiment in furniture making with zero prior woodworking experience.',
    image: '/images/Unplugged/table/thumbnail.png',
    href: '/unplugged/table',
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

export default function UnpluggedGallery() {

  return (
    <div className="mt-20 md:mt-28">

      <SectionHeader left={['U', 'nplugged']} />

      {/* ── Items list ─────────────────────────────────────── */}
      <div className="flex flex-col gap-20 md:gap-28">
        {items.map((item) => (
          <div
            key={item.num}
            className="relative border border-gray-200 grid grid-cols-1 md:grid-cols-2"
          >
            <Plus h="left"  v="top" />
            <Plus h="right" v="top" />
            <Plus h="left"  v="bottom" />
            <Plus h="right" v="bottom" />

            {/* Info */}
            <div className="px-6 md:px-10 py-10 md:py-14 flex flex-col justify-between order-2 md:order-1">
              <div>
                <h3
                  className="text-2xl md:text-3xl font-light text-black mb-4"
                  style={{ fontFamily: 'SatishSans, sans-serif' }}
                >
                  {item.title}
                </h3>
                <p
                  className="text-sm text-gray-500 leading-relaxed max-w-sm"
                  style={{ fontFamily: 'FunnelDisplay, sans-serif' }}
                >
                  {item.description}
                </p>
              </div>

              <div className="mt-8 flex items-end justify-between">
                <span
                  className="text-xs text-gray-400"
                  style={{ fontFamily: 'FunnelDisplay, sans-serif' }}
                >
                  {item.year}
                </span>
                {item.available && item.href && (
                  <Link
                    href={item.href}
                    className="px-4 py-2 border border-gray-900 text-xs text-gray-900 hover:bg-gray-900 hover:text-white transition-colors duration-200 shrink-0"
                    style={{ fontFamily: 'FunnelDisplay, sans-serif' }}
                  >
                    View Project
                  </Link>
                )}
              </div>
            </div>

            {/* Image */}
            <div className="relative overflow-hidden order-1 md:order-2 cursor-pointer">
              <Image
                src={item.image}
                alt={item.title}
                width={800}
                height={600}
                sizes="(max-width: 768px) 100vw, 50vw"
                className={`w-full h-auto block${item.available ? '' : ' blur-sm brightness-75'}`}
              />
              {!item.available && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span
                    className="text-white/70 text-xs tracking-widest uppercase"
                    style={{ fontFamily: 'FunnelDisplay, sans-serif' }}
                  >
                    Posting soon
                  </span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

    </div>
  )
}
