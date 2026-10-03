"use client"

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { onScrollFrame, prefersReducedMotion } from '@/lib/motion'

export default function ScrollToTop() {
  const [mounted, setMounted] = useState(false)
  // only offer "back to top" once there is a top to go back to
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    setMounted(true)
    return onScrollFrame((y) => setVisible(y > window.innerHeight))
  }, [])

  if (!mounted) return null

  return createPortal(
    <button
      onClick={() => {
        const lenis = (window as any).__lenis
        if (lenis) {
          lenis.scrollTo(0, { duration: 1.2 })
        } else {
          window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
        }
      }}
      aria-label="Back to top"
      tabIndex={visible ? 0 : -1}
      className={`fixed bottom-8 right-8 z-[9999] w-10 h-10 flex items-center justify-center border border-gray-300 bg-white text-gray-500 hover:border-gray-900 hover:text-gray-900 transition-all duration-200 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'}`}
      style={{ borderRadius: '10px 0px 10px 0px' }}
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <polyline points="18 15 12 9 6 15" />
      </svg>
    </button>,
    document.body
  )
}
