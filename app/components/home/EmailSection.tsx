"use client"

import { useState, useEffect, useRef } from 'react'
import EmailCopy from './EmailCopy'
import { onScrollFrame } from '@/lib/motion'

export default function EmailSection() {
  const [hovered, setHovered] = useState(false)
  const hoveredRef = useRef(false)
  const leftRef  = useRef<HTMLDivElement>(null)
  const rightRef = useRef<HTMLDivElement>(null)

  // Keep ref in sync with state so scroll handler sees latest hover
  useEffect(() => { hoveredRef.current = hovered }, [hovered])

  useEffect(() => onScrollFrame((y) => {
    const deg = Math.min(y / 60, 8)
    const isHovered = hoveredRef.current
    if (leftRef.current)
      leftRef.current.style.transform = `translateX(${isHovered ? -10 : 0}px) rotate(-${deg}deg)`
    if (rightRef.current)
      rightRef.current.style.transform = `translateX(${isHovered ? 10 : 0}px) rotate(-${deg}deg)`
  }), [])

  // Re-apply transform when hover changes (scroll handler won't re-fire)
  useEffect(() => {
    const deg = Math.min(window.scrollY / 60, 8)
    if (leftRef.current)
      leftRef.current.style.transform = `translateX(${hovered ? -10 : 0}px) rotate(-${deg}deg)`
    if (rightRef.current)
      rightRef.current.style.transform = `translateX(${hovered ? 10 : 0}px) rotate(-${deg}deg)`
  }, [hovered])

  return (
    <div
      className="flex justify-center items-center"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Left branch */}
      <div
        ref={leftRef}
        style={{
          width: '120px', height: '60px', position: 'relative', flexShrink: 0,
          marginRight: '-55px', zIndex: 1,
          transition: 'transform 0.6s ease',
        }}
      >
        <img
          src="/images/HomeImages/branch.webp"
          alt=""
          aria-hidden="true"
          style={{
            position: 'absolute', top: '50%', left: '50%',
            height: '120px', width: 'auto',
            transform: 'translate(-50%, -50%) rotate(90deg)',
            opacity: 0.75,
          }}
        />
      </div>

      {/* Email button */}
      <div style={{
        position: 'relative', zIndex: 2, flexShrink: 0,
        boxShadow: hovered ? '0 2px 14px 0px rgba(30, 120, 60, 0.22)' : '0 2px 14px 0px rgba(30, 120, 60, 0)',
        transition: 'box-shadow 0.5s ease',
      }}>
        <EmailCopy />
      </div>

      {/* Right branch — mirrored */}
      <div
        ref={rightRef}
        style={{
          width: '120px', height: '60px', position: 'relative', flexShrink: 0,
          marginLeft: '-55px', zIndex: 1,
          transition: 'transform 0.6s ease',
        }}
      >
        <img
          src="/images/HomeImages/branch.webp"
          alt=""
          aria-hidden="true"
          style={{
            position: 'absolute', top: '50%', left: '50%',
            height: '120px', width: 'auto',
            transform: 'translate(-50%, -50%) rotate(90deg) scaleX(-1)',
            opacity: 0.75,
          }}
        />
      </div>
    </div>
  )
}
