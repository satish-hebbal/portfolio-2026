'use client'

import { useId } from 'react'

/**
 * A raised hood/cap that arches over the top of a big dial. It is rendered
 * BEHIND the dial canvas and overlaps inward, so the bezel covers its inner
 * part and its arc ends fade out (horizontal mask) — the cap appears to wrap
 * around behind the dial for a 3D depth effect instead of stopping sharply.
 */
export default function DialHood({ size, glow = '#ff9d2f', dx = 0 }: { size: number; glow?: string; dx?: number }) {
  const id = useId().replace(/:/g, '')
  const cx = size / 2, cy = size / 2
  // sits up above the dial (mostly visible); only the inner edge tucks just
  // behind the bezel (rendered under the canvas) for the depth effect
  const Ri = size * 0.485
  const Ro = size * 0.62
  const Rg = Ro - size * 0.028
  const A1 = 194, A2 = 346  // crescent over the top
  const polar = (a: number, r: number) =>
    [cx + r * Math.cos((a * Math.PI) / 180), cy + r * Math.sin((a * Math.PI) / 180)] as const
  const arc = (a1: number, a2: number, r: number) => {
    const [x1, y1] = polar(a1, r), [x2, y2] = polar(a2, r)
    return `M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`
  }

  const [ox1, oy1] = polar(A1, Ro), [ox2, oy2] = polar(A2, Ro)
  const [ix2, iy2] = polar(A2, Ri), [ix1, iy1] = polar(A1, Ri)
  const band = `M ${ox1} ${oy1} A ${Ro} ${Ro} 0 0 1 ${ox2} ${oy2} L ${ix2} ${iy2} A ${Ri} ${Ri} 0 0 0 ${ix1} ${iy1} Z`
  const crown = arc(A1, A2, Ro)
  const groove = arc(A1, A2, Rg)
  const pad = size * 0.14

  const leftX = cx + Ro * Math.cos((A1 * Math.PI) / 180)
  const rightX = cx + Ro * Math.cos((A2 * Math.PI) / 180)

  return (
    <svg width={size + 2 * pad} height={size + 2 * pad}
      viewBox={`${-pad} ${-pad} ${size + 2 * pad} ${size + 2 * pad}`}
      style={{
        position: 'absolute', left: -pad, top: -pad, overflow: 'visible', pointerEvents: 'none', zIndex: 0,
        // push well behind every dial in 3D; scale compensates the perspective
        // shrink so it stays aligned with the dial it caps
        transform: `translateX(${dx}px) translateZ(-120px) scale(1.047)`, transformOrigin: 'center',
      }}>
      <defs>
        {/* dark detailing shade — a recessed ridge, no bright highlights */}
        <linearGradient id={`hb-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2c2e33" />
          <stop offset="0.4" stopColor="#16181c" />
          <stop offset="1" stopColor="#08090b" />
        </linearGradient>
        {/* border line: dark at the ends, bright across the top, dark again */}
        <linearGradient id={`hc-${id}`} gradientUnits="userSpaceOnUse" x1={leftX} y1={cy} x2={rightX} y2={cy}>
          <stop offset="0" stopColor="#16181c" />
          <stop offset="0.28" stopColor="#565c64" />
          <stop offset="0.5" stopColor="#e8edf4" />
          <stop offset="0.72" stopColor="#565c64" />
          <stop offset="1" stopColor="#16181c" />
        </linearGradient>
        {/* horizontal fade — ends dissolve into the dial for depth */}
        <linearGradient id={`hf-${id}`} gradientUnits="userSpaceOnUse" x1={leftX} y1={cy} x2={rightX} y2={cy}>
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.2" stopColor="#fff" stopOpacity="1" />
          <stop offset="0.8" stopColor="#fff" stopOpacity="1" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <mask id={`hm-${id}`} maskUnits="userSpaceOnUse" x={-pad} y={-pad} width={size + 2 * pad} height={size + 2 * pad}>
          <rect x={leftX} y={cy - Ro - 24} width={rightX - leftX} height={Ro + 48} fill={`url(#hf-${id})`} />
        </mask>
      </defs>

      <g mask={`url(#hm-${id})`}>
        {/* dark hood body, soft shadow only */}
        <path d={band} fill={`url(#hb-${id})`} stroke="rgba(0,0,0,0.55)" strokeWidth={1}
          style={{ filter: 'drop-shadow(0 6px 8px rgba(0,0,0,0.6))' }} />
        {/* machined border edge — dark → bright(top) → dark gradient */}
        <path d={crown} fill="none" stroke={`url(#hc-${id})`} strokeWidth={1.8} strokeLinecap="round" />
        {/* dark groove (detailing line) */}
        <path d={groove} fill="none" stroke="rgba(0,0,0,0.5)" strokeWidth={1.4} strokeLinecap="round" />
      </g>
    </svg>
  )
}
