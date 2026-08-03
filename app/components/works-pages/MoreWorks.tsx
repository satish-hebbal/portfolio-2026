"use client"

import Link from 'next/link'
import Image from 'next/image'

const allWorks = [
  {
    title: 'Smart Nation',
    href: '/works/smartNation',
    image: '/images/WorkImages/smartNationImages/SN-thumb.png',
    tags: ['IoT', 'App UI', 'Brand Identity'],
  },
  {
    title: 'Healthcare SaaS',
    href: '/works/healthcare-saas',
    image: '/images/WorkImages/hsaasImages/hs-thumbnail.png',
    tags: ['SaaS'],
  },
  {
    title: 'SkinSage',
    href: '/works/skinSage',
    image: '/images/WorkImages/skinSageImages/SS-thumnail-1.png',
    tags: ['AI', 'Consultation'],
  },
  {
    title: 'SkillRadius',
    href: '/works/skillRadius',
    image: '/images/WorkImages/skillradius/SR-thumnail.png',
    tags: ['LMS'],
  },
]

export default function MoreWorks({ current }: { current: string }) {
  const others = allWorks.filter((w) => w.href !== current)

  return (
    <div className="mt-16 max-w-5xl mx-auto">
      <h2
        className="text-2xl md:text-3xl text-gray-900 mb-6 px-6 md:px-10"
        style={{ fontFamily: 'SatishSans, sans-serif', fontWeight: 'normal' }}
      >
        More Works
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5 px-6 md:px-0">
        {others.map((work) => (
          <Link
            key={work.href}
            href={work.href}
            className="group block"
          >
            {/* Image */}
            <div className="relative overflow-hidden aspect-video bg-gray-50 border border-gray-200">
              <Image
                src={work.image}
                alt={work.title}
                fill
                sizes="(max-width: 768px) 100vw, 33vw"
                className="object-cover transition-transform duration-500 group-hover:scale-105"
              />
            </div>

            {/* Always-visible label below */}
            <div className="pt-2">
              <p
                className="text-sm text-gray-900 font-light leading-snug"
                style={{ fontFamily: 'SatishSans, sans-serif' }}
              >
                {work.title}
              </p>
              <p
                className="text-[10px] uppercase tracking-widest text-gray-400 mt-0.5"
                style={{ fontFamily: 'FunnelDisplay, sans-serif' }}
              >
                {work.tags.join(' · ')}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
