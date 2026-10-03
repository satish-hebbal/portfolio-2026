// Shared motion helpers for the client.
//
// Every scroll-driven effect on the home page used to add its own window scroll
// listener and write styles straight from it, so one scroll event could trigger
// several unbatched style writes per frame. onScrollFrame funnels them all
// through a single passive listener and at most one requestAnimationFrame per
// frame, and hands every subscriber the same scrollY so nobody re-reads layout.

type ScrollCallback = (y: number) => void

const subscribers = new Set<ScrollCallback>()
let frame = 0

const flush = () => {
  frame = 0
  const y = window.scrollY
  subscribers.forEach((cb) => cb(y))
}

const schedule = () => {
  if (!frame) frame = requestAnimationFrame(flush)
}

export function onScrollFrame(cb: ScrollCallback): () => void {
  if (subscribers.size === 0) window.addEventListener('scroll', schedule, { passive: true })
  subscribers.add(cb)
  cb(window.scrollY)
  return () => {
    subscribers.delete(cb)
    if (subscribers.size === 0) {
      window.removeEventListener('scroll', schedule)
      if (frame) cancelAnimationFrame(frame)
      frame = 0
    }
  }
}

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

// Smooth-scrolls to a home page section through Lenis when it is running, so
// the scroll stays on the same easing curve as the wheel. offset leaves room
// for the fixed navbar.
export function scrollToSection(id: string, offset = -100): boolean {
  const el = document.getElementById(id)
  if (!el) return false
  const lenis = (window as any).__lenis
  if (lenis) lenis.scrollTo(el, { offset, duration: prefersReducedMotion() ? 0 : 1.2 })
  else window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY + offset, behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
  return true
}
