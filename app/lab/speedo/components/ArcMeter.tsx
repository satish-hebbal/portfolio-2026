'use client'

import { forwardRef, ReactNode, useImperativeHandle, useState } from 'react'

export interface ArcMeterHandle {
  setValue: (v: number) => void
}

interface Props {
  side: 'left' | 'right'
  value: number       // 0..1 fill from bottom (initial / static value)
  kind: 'temp' | 'fuel' // drives the dynamic warning colour zones
  topLabel: string    // 'H' | 'F'
  bottomLabel: string // 'C' | 'E'
  glow: string        // themed lit-segment colour (the "normal" zone)
  icon: ReactNode     // thermo / fuel glyph near the bottom
  segments?: number
}

const WARN = '#ffb43c' // amber: warm coolant / low fuel
const DANGER = '#ff4126' // red: overheating / reserve fuel

// fill colour by reading: temp heats upward (red near H), fuel drains downward
// (red near E). Returns the "normal" themed colour outside the warning zones.
function fillColorFor(kind: 'temp' | 'fuel', v: number, normal: string): string {
  if (kind === 'temp') return v >= 0.82 ? DANGER : v >= 0.66 ? WARN : normal
  return v <= 0.12 ? DANGER : v <= 0.28 ? WARN : normal
}

const W = 72
const H = 168

// virtual arc circle — segments are radial spokes on the inner edge of the
// adjacent round dial, so the bar curves like the bezel beside it. A large
// radius keeps the bend gentle so it parallels the meter rim rather than
// over-curving.
const R = 250
const CY = H / 2
const SPAN = 0.255        // half angular spread (radians) — gentle curve
const SEG_LEN = 15        // radial length of a lit segment (pill width)

/**
 * Chrysler-style curved segmented meter (temperature / fuel). Lit teal segments
 * stack from the bottom, the current level is marked by a single yellow segment,
 * and a fine silver tick scale caps the top — all bent along a dial-matching arc.
 */
const ArcMeter = forwardRef<ArcMeterHandle, Props>(function ArcMeter({
  side, value, kind, topLabel, bottomLabel, glow, icon, segments = 15,
}, ref) {
  const left = side === 'left'
  // arc centre sits off-screen to one side so the bar bulges toward the LCD centre
  const cx = left ? W - 6 - R : 6 + R
  const base = left ? 0 : Math.PI            // 0 → points right, π → points left
  const dir = left ? 1 : -1                  // mirror the sweep horizontally

  // map a segment fraction (0 = bottom, 1 = top) to an angle on the arc
  const angleAt = (f: number) => base + dir * (SPAN - f * 2 * SPAN)
  const pt = (f: number, r: number) => {
    const a = angleAt(f)
    return [cx + Math.cos(a) * r, CY + Math.sin(a) * r] as const
  }

  const glowId = `segGlow-${side}`
  // lit count is the only thing the value drives — store it so live updates
  // re-render at most once per crossed segment, not every animation frame
  const [lit, setLit] = useState(() => Math.round(Math.min(Math.max(value, 0), 1) * segments))
  useImperativeHandle(ref, () => ({
    setValue: (v: number) => setLit(Math.round(Math.min(Math.max(v, 0), 1) * segments)),
  }), [segments])

  // current reading drives the fill colour zone (normal / warm / danger)
  const fillColor = fillColorFor(kind, lit / segments, glow)

  const segEls: ReactNode[] = []
  for (let i = 0; i < segments; i++) {
    const f = i / (segments - 1)
    const a = angleAt(f)
    const inner = SEG_LEN
    const [x1, y1] = [cx + Math.cos(a) * (R - inner), CY + Math.sin(a) * (R - inner)]
    const [x2, y2] = [cx + Math.cos(a) * R, CY + Math.sin(a) * R]
    const isOn = i < lit
    const isMarker = i === lit - 1            // top of the fill = bright reading marker
    const color = isMarker ? '#f4f9ff' : isOn ? fillColor : '#11212e'
    segEls.push(
      <line
        key={i}
        x1={x1} y1={y1} x2={x2} y2={y2}
        stroke={color}
        strokeWidth={4}
        strokeLinecap="round"
        opacity={isOn ? 1 : 0.55}
        filter={isOn ? `url(#${glowId})` : undefined}
      />,
    )
  }

  // label + icon anchor points — on the OUTER (convex) edge of the arc,
  // capping the top/bottom ends of the bar
  const [tlx, tly] = pt(1.06, R + 6)
  const [blx, bly] = pt(-0.06, R + 6)
  // icon sits lower and at a smaller radius so it pulls toward the adjacent
  // dial, clear of the C/E label rather than stuck against it
  const [icx, icy] = pt(-0.13, R - 12)

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        {/* userSpaceOnUse so thin near-horizontal pills aren't clipped by a
            bounding-box-relative filter region (was cutting middle pills off) */}
        <filter id={glowId} filterUnits="userSpaceOnUse" x={-20} y={-20} width={W + 40} height={H + 40}>
          <feGaussianBlur stdDeviation="1.6" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {segEls}

      <text x={tlx} y={tly} dy="0.32em" textAnchor="middle"
        fontSize="13" fontWeight={800} fill="#ff5a44"
        style={{ filter: 'drop-shadow(0 0 4px rgba(255,70,50,0.6))' }}>{topLabel}</text>
      <text x={blx} y={bly} dy="0.32em" textAnchor="middle"
        fontSize="13" fontWeight={800} fill="#ff5a44"
        style={{ filter: 'drop-shadow(0 0 4px rgba(255,70,50,0.6))' }}>{bottomLabel}</text>

      <g transform={`translate(${icx - 8}, ${icy - 8})`}
        style={{ color: '#bfe3ff', filter: 'drop-shadow(0 0 4px rgba(120,190,255,0.7))' }}>
        {icon}
      </g>
    </svg>
  )
})

export default ArcMeter
