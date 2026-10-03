"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import { gsap } from "gsap"
import { prefersReducedMotion } from "@/lib/motion"

// Longest the curtain may stay up, however slow the network is
const MAX_WAIT_MS = 1200

// Module state survives client-side navigation but not a reload, so the
// curtain shows on a fresh visit and never again when coming back to Home
// from another page inside the site.
let shownThisVisit = false

export default function Loader() {
  const [active] = useState(() => !shownThisVisit)
  const loaderRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!active) return
    shownThisVisit = true
    let done = false

    const exit = () => {
      if (done || !loaderRef.current) return
      done = true
      const el = loaderRef.current
      const hide = () => { el.style.display = "none" }
      if (prefersReducedMotion()) {
        gsap.to(el, { opacity: 0, duration: 0.2, onComplete: hide })
      } else {
        gsap.to(el, { y: "-100%", duration: 0.9, ease: "power3.inOut", onComplete: hide })
      }
    }

    // What the first fold actually needs: the custom fonts and the two hero
    // figures. The old version waited for window.load, i.e. every image on
    // the page, which held a blank screen for ~5s on a cold visit. Only the
    // copies rendered at this breakpoint count: desktop and mobile are
    // separate lazy images, and the hidden one never loads.
    const heroes = Array.from(document.querySelectorAll<HTMLImageElement>('img[src*="abhay-v"], img[src*="tejas-v"]'))
      .filter((img) => img.getClientRects().length > 0)
    const ready = Promise.all([
      document.fonts ? document.fonts.ready : Promise.resolve(),
      ...heroes.map((img) => img.decode().catch(() => undefined)),
    ])

    const timer = setTimeout(exit, MAX_WAIT_MS)
    ready.then(exit)

    return () => clearTimeout(timer)
  }, [active])

  if (!active) return null

  return (
    <div
      ref={loaderRef}
      aria-hidden="true"
      className="fixed inset-0 bg-white flex flex-col items-center justify-center"
      style={{ zIndex: 99999 }}
    >
      <Image
        src="/images/common/sa26.svg"
        alt=""
        width={48}
        height={48}
        priority
        className="w-10 h-10 object-contain opacity-80"
      />
    </div>
  )
}
