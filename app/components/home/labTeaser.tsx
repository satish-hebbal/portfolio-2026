import Link from 'next/link'
import SectionHeader from './SectionHeader'

// The last chapter of the home page: a glimpse of the Lab, so the side
// projects are part of the story and not only a nav link.

const items = [
  { title: 'Studio-Kapi', note: 'A mini music studio in the browser', href: '/lab/studio-kapi', image: '/images/lab/studio-kapi-tumbnail.webp', tint: '#f4f1ff' },
  { title: 'Speedoo',     note: 'An instrument cluster you can rev',   href: '/lab/speedo',      image: '/images/lab/tumbnail-speedoo.webp',    tint: '#f3f6ff' },
  { title: 'YT Walkman',  note: 'YouTube on a vintage Walkman',        href: '/lab/walkman',     image: '/images/lab/walkman-card.webp',        tint: '#eef4ff' },
]

const font = { fontFamily: 'FunnelDisplay, sans-serif' }

export default function LabTeaser() {
  return (
    <div className="mt-20 md:mt-28">
      <SectionHeader left={['T', 'he']} right={['L', 'ab']} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
        {items.map((it) => (
          <Link
            key={it.href}
            href={it.href}
            className="group relative block h-40 md:h-48 overflow-hidden border border-gray-200 px-5 py-5"
            style={{ background: `linear-gradient(135deg, ${it.tint} 0%, #ffffff 65%)` }}
          >
            <p className="text-xl font-light text-gray-900" style={{ fontFamily: 'SatishSans, sans-serif' }}>{it.title}</p>
            <p className="mt-1 text-xs text-gray-500 max-w-[60%]" style={font}>{it.note}</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={it.image}
              alt=""
              loading="lazy"
              decoding="async"
              className="absolute -right-6 -bottom-8 w-44 h-44 object-contain transition-transform duration-500 group-hover:scale-105 group-hover:-translate-y-1"
            />
          </Link>
        ))}
      </div>

      <div className="mt-5 flex justify-end">
        <Link href="/lab" className="text-sm text-gray-700 hover:text-black underline decoration-gray-300 underline-offset-4 hover:decoration-black transition-colors" style={font}>
          See all experiments →
        </Link>
      </div>
    </div>
  )
}
