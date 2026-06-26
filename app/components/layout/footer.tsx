"use client"

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const links = [
  { label: 'LinkedIn',  href: 'https://www.linkedin.com/in/satish-hebbal/' },
  { label: 'Instagram', href: 'https://www.instagram.com/sat_dez' },
  { label: 'GitHub',    href: 'https://github.com/satish-hebbal' },
]

const navLinks = [
  { label: 'Works',     href: '/#work' },
  { label: 'Unplugged', href: '/#unplugged' },
  { label: 'About',     href: '/about' },
]

export default function Footer() {
  const pathname = usePathname()
  const isUnpluggedPage = pathname?.startsWith('/unplugged/')
  const isProposalPage = pathname?.startsWith('/proposals')
  // fullscreen lab projects render their own chrome (back button) and must not
  // show the site footer bleeding into their fixed-overlay layout
  const isFullscreenLab = pathname?.startsWith('/lab/studio-kapi') || pathname?.startsWith('/lab/speedo')

  if (isProposalPage || isFullscreenLab) return null

  return (
    <footer className={`mt-16 relative overflow-visible${isUnpluggedPage ? ' md:hidden' : ''}`}>

<div className="max-w-5xl mx-auto px-6 md:px-10">

        {/* Big name */}
        <div className="pt-4 pb-8 text-center relative flex items-center justify-center gap-0">

          {/* Left branch */}
          <img
            src="/images/HomeImages/branch.svg"
            aria-hidden="true"
            className="hidden md:block shrink-0 pointer-events-none select-none"
            style={{
              height: '160px', width: 'auto',
              transform: 'rotate(90deg)',
              filter: 'brightness(0) opacity(0.18)',
              marginRight: '-30px',
            }}
          />

          <div className="flex flex-col items-center">
          <h2
            className="text-[clamp(3rem,12vw,9rem)] leading-none tracking-tight text-black select-none"
            aria-hidden="true"
          >
            <span style={{ fontFamily: 'SatishCapsSans, sans-serif', fontSize: '1.4em' }}>S</span>
            <span style={{ fontFamily: 'SatishSans, sans-serif', marginLeft: '6px' }}>atish</span>
          </h2>
          <p
            className="mt-4 text-sm text-gray-400"
            style={{ fontFamily: 'FunnelDisplay, sans-serif', fontWeight: 300 }}
          >
            Product Designer &amp; Developer
          </p>
          </div>

          {/* Right branch — mirrored */}
          <img
            src="/images/HomeImages/branch.svg"
            aria-hidden="true"
            className="hidden md:block shrink-0 pointer-events-none select-none"
            style={{
              height: '160px', width: 'auto',
              transform: 'rotate(90deg) scaleX(-1)',
              filter: 'brightness(0) opacity(0.18)',
              marginLeft: '-30px',
            }}
          />

        </div>

        <div className="border-t border-gray-100" />

        {/* Bottom row */}
        <div className="py-5 flex flex-col md:flex-row items-center justify-between gap-6">

          {/* Logo + year */}
          <div className="flex items-center gap-3">
            <Image
              src="/images/common/sa26.svg"
              alt="SA26"
              width={28}
              height={28}
              className="opacity-40"
            />
            <span
              className="text-xs text-gray-400"
              style={{ fontFamily: 'FunnelDisplay, sans-serif' }}
            >
              © 2026 Satish Hebbal
            </span>
          </div>

          {/* Nav links */}
          <nav className="flex items-center gap-6">
            {navLinks.map((l) => (
              <Link
                key={l.label}
                href={l.href}
                className="text-xs text-gray-400 hover:text-black transition-colors duration-200"
                style={{ fontFamily: 'FunnelDisplay, sans-serif' }}
              >
                {l.label}
              </Link>
            ))}
          </nav>

          {/* Social links */}
          <div className="flex items-center gap-6">
            {links.map((l) => (
              <a
                key={l.label}
                href={l.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-gray-400 hover:text-black transition-colors duration-200"
                style={{ fontFamily: 'FunnelDisplay, sans-serif' }}
              >
                {l.label}
              </a>
            ))}
          </div>

        </div>
      </div>
    </footer>
  )
}
