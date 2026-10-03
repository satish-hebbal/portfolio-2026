"use client"

import { usePathname } from "next/navigation"
import { Fragment, useEffect, useRef, useState } from "react"
import Image from "next/image"
import { gsap } from "gsap"
import SectionLink from "./SectionLink"
import { prefersReducedMotion } from "@/lib/motion"

const navItems = [
  { name: "Work",   href: "/#work",      section: "work" },
  { name: "Unplugged", href: "/#unplugged", section: "unplugged" },
  { name: "Home",   href: "/" },
  { name: "Lab",    href: "/lab" },
  { name: "About",  href: "/about" },
]

// Pages flag their own nav treatment with data attributes on <body>
const readModes = () => ({
  light: document.body.hasAttribute('data-light-page'),
  dark:  document.body.hasAttribute('data-dark-page'),
  qr:    document.body.hasAttribute('data-qr-page'),
})

export default function Navbar() {
  const pathname = usePathname()
  const navRef = useRef<HTMLElement>(null)
  const firstRender = useRef(true)
  const [modes, setModes] = useState({ light: false, dark: false, qr: false })

  // One observer for all three page-mode attributes
  useEffect(() => {
    setModes(readModes())
    const observer = new MutationObserver(() => setModes(readModes()))
    observer.observe(document.body, { attributes: true, attributeFilter: ['data-light-page', 'data-dark-page', 'data-qr-page'] })
    return () => observer.disconnect()
  }, [])

  // Short fade-in for the incoming page. Skipped on the very first render,
  // where the Loader or the server-rendered page is already in place.
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return }
    if (prefersReducedMotion()) return
    gsap.fromTo("main", { y: 12, opacity: 0 }, { y: 0, opacity: 1, duration: 0.35, ease: "power2.out", clearProps: "transform,opacity" })
  }, [pathname])

  // nav is white-text when on walkman dark mode, or any page that sets data-dark-page
  const showWhiteNav = (pathname === '/lab/walkman' && !modes.light) || modes.dark

  const press = () => {
    if (!navRef.current || prefersReducedMotion()) return
    gsap.to(navRef.current, { scale: 0.97, duration: 0.08, yoyo: true, repeat: 1, ease: "power2.inOut" })
  }

  const handleHome = (e: React.MouseEvent) => {
    if (pathname !== '/') return
    // already home: glide back to the top instead of reloading the route
    e.preventDefault()
    const lenis = (window as any).__lenis
    if (lenis) lenis.scrollTo(0, { duration: 1.2 })
    else window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
  }

  const colorFor = (item: typeof navItems[0]) => {
    if (
      (pathname === item.href) ||
      (item.name === "Work" && pathname.startsWith('/works/')) ||
      (item.name === "Lab" && pathname.startsWith('/lab/'))
    ) return "text-orange-500"
    if (item.name === "Unplugged" && pathname.startsWith('/unplugged/')) return "text-orange-400"
    if (pathname.startsWith('/unplugged/') || showWhiteNav) return "text-white"
    if (modes.qr) return "text-stone-900"
    return "text-zinc-700"
  }

  const dot = (
    <span aria-hidden="true" className={`${showWhiteNav ? 'text-white/25' : 'text-zinc-300'} text-[7px] md:text-[10px]`}>•</span>
  )

  const link = (item: typeof navItems[0]) => (
    <SectionLink
      href={item.href}
      section={item.section}
      onClick={(e) => { press(); if (item.name === "Home") handleHome(e) }}
      aria-label={item.name === "Home" ? "Home" : undefined}
      aria-current={pathname === item.href ? "page" : undefined}
      className={`cursor-pointer font-light transition-colors duration-300 relative hover:text-orange-500 text-xs md:text-sm ${colorFor(item)} ${item.name === "Home" ? 'flex items-center justify-center' : ''}`}
      style={{ fontFamily: 'FunnelDisplay, sans-serif', fontWeight: '400' }}
    >
      {item.name === "Home" ? (
        <Image
          src="/images/common/sa26-filled.svg"
          alt=""
          // the mark is 645x614, so the box matches it instead of padding it
          width={22}
          height={21}
          className={`block transition-opacity duration-300 ${pathname === '/' ? 'opacity-100' : 'opacity-40 hover:opacity-70'}`}
          style={{
            ...((pathname.startsWith('/unplugged/') || showWhiteNav) ? { filter: 'invert(1)' } : {}),
            // Optical correction, measured from rendered pixels: the mark's
            // visual weight sits ~0.3px right of its box and its centre reads
            // ~0.7px below the bar centre and the cap band of the words beside
            // it. Nudging it back makes it look centred, not just measure so.
            transform: 'translate(-0.2px, -0.7px)',
          }}
        />
      ) : item.name}
    </SectionLink>
  )

  return (
    <div className="fixed top-0 left-0 right-0 flex justify-center px-3 py-4 pointer-events-none" style={{ zIndex: 10005 }}>
      <nav
        ref={navRef}
        aria-label="Main"
        className="nav-enter grid grid-cols-[1fr_auto_1fr] items-center rounded-none py-1 relative transition-shadow duration-300 hover:shadow-lg pointer-events-auto w-full max-w-full md:w-auto gap-x-0 px-3 md:px-6"
        style={{
          // Dark text needs a mostly opaque frost behind it, or it disappears
          // when the bar passes over dark imagery (the identity gallery)
          // (white-text pages keep the clear glass: white frost would hide their text)
          background: showWhiteNav ? 'rgba(255,255,255,0.06)'
            : pathname.startsWith('/unplugged/') ? 'rgba(255, 255, 255, 0.08)'
            : 'rgba(255, 255, 255, 0.72)',
          // A plain blur keeps the frosted look. The old SVG displacement lens
          // was re-filtered on every scroll frame and only rendered in Chromium.
          backdropFilter: 'blur(10px) saturate(140%)',
          WebkitBackdropFilter: 'blur(10px) saturate(140%)',
          border: showWhiteNav ? '2px solid rgba(255,255,255,0.09)' : '2px solid rgba(180,180,185,0.55)',
          boxShadow: `
            inset 0 1px 0 rgba(255, 255, 255, 0.2),
            inset 0 -1px 0 rgba(255, 255, 255, 0.1),
            0 8px 24px rgba(0, 0, 0, 0.1)
          `
        }}
      >
        {/* Corner squares - half outside */}
        <div className={`absolute -top-1 -left-1 w-2 h-2 ${showWhiteNav ? 'bg-white/10' : 'bg-zinc-300/50'}`} />
        <div className={`absolute -top-1 -right-1 w-2 h-2 ${showWhiteNav ? 'bg-white/10' : 'bg-zinc-300/50'}`} />
        <div className={`absolute -bottom-1 -left-1 w-2 h-2 ${showWhiteNav ? 'bg-white/10' : 'bg-zinc-300/50'}`} />
        <div className={`absolute -bottom-1 -right-1 w-2 h-2 ${showWhiteNav ? 'bg-white/10' : 'bg-zinc-300/50'}`} />
        {/* Logo in its own centre column, with the links split into two
            equal-width columns either side. The logo is then the true centre
            of the bar whatever the word widths, and the dots flank it
            symmetrically. */}
        <div className="flex items-center justify-between gap-1 md:gap-6">
          {navItems.slice(0, 2).map((item) => (
            <Fragment key={item.name}>{link(item)}{dot}</Fragment>
          ))}
          {/* zero-width end stop, so the dot-to-logo gap is spread like the rest */}
          <span aria-hidden="true" className="w-0" />
        </div>
        {link(navItems[2])}
        <div className="flex items-center justify-between gap-1 md:gap-6">
          <span aria-hidden="true" className="w-0" />
          {navItems.slice(3).map((item) => (
            <Fragment key={item.name}>{dot}{link(item)}</Fragment>
          ))}
        </div>
      </nav>
    </div>
  )
}
