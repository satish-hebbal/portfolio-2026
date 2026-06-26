'use client'

import { useCallback, useRef } from 'react'

interface Props {
  value: number            // 0..1
  onChange: (v: number) => void
  label?: string
  size?: number
  accent?: string
  bipolar?: boolean        // center detent (pan / EQ)
  defaultValue?: number
  display?: (v: number) => string
}

// Realistic metallic rotary knob, drag vertically to adjust. Premium black finish.
export default function Knob({
  value, onChange, label, size = 44, accent = '#ff7a45', bipolar = false, defaultValue, display,
}: Props) {
  const startY = useRef(0)
  const startV = useRef(0)

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    startY.current = e.clientY
    startV.current = value
  }, [value])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!(e.buttons & 1)) return
    const dy = startY.current - e.clientY
    const speed = e.shiftKey ? 600 : 180 // shift = fine
    onChange(Math.max(0, Math.min(1, startV.current + dy / speed)))
  }, [onChange])

  const onDoubleClick = useCallback(() => {
    onChange(defaultValue ?? (bipolar ? 0.5 : 0))
  }, [onChange, defaultValue, bipolar])

  const angle = -135 + value * 270
  const ringDash = 2 * Math.PI * 17
  // arc fill: from center for bipolar, from min otherwise
  const arcFrac = bipolar ? Math.abs(value - 0.5) * 2 : value

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, userSelect: 'none' }}>
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onDoubleClick={onDoubleClick}
        style={{ width: size, height: size, position: 'relative', cursor: 'ns-resize', touchAction: 'none' }}
      >
        {/* progress ring */}
        <svg width={size} height={size} style={{ position: 'absolute', inset: 0, transform: 'rotate(135deg)' }}>
          <circle cx={size / 2} cy={size / 2} r={17 * (size / 44)} fill="none" stroke="#0c0e12" strokeWidth={3} />
          <circle
            cx={size / 2} cy={size / 2} r={17 * (size / 44)} fill="none" stroke={accent} strokeWidth={3}
            strokeLinecap="round"
            strokeDasharray={`${ringDash * (size / 44)}`}
            strokeDashoffset={`${ringDash * (size / 44) * (1 - arcFrac * 0.75)}`}
            transform={bipolar && value < 0.5 ? `scale(-1,1) translate(${-size},0)` : undefined}
            style={{ filter: `drop-shadow(0 0 3px ${accent}66)` }}
          />
        </svg>
        {/* metallic cap */}
        <div style={{
          position: 'absolute', inset: size * 0.18, borderRadius: '50%',
          background: 'radial-gradient(120% 120% at 32% 25%, #4a4d57 0%, #34373f 32%, #23252b 62%, #15171b 100%)',
          boxShadow: 'inset 0 1px 1px rgba(150,160,185,0.25), inset 0 -2px 4px rgba(0,0,0,0.7), 0 2px 5px rgba(0,0,0,0.6)',
          border: '1px solid #0c0e12',
        }} />
        {/* brushed top */}
        <div style={{
          position: 'absolute', inset: size * 0.26, borderRadius: '50%',
          background: `conic-gradient(from 0deg, #3a3d45, #1c1e23, #44474f, #202229, #3a3d45)`,
          opacity: 0.5,
        }} />
        {/* indicator */}
        <div style={{
          position: 'absolute', left: '50%', top: '50%', width: 2.5, height: size * 0.30,
          background: accent, borderRadius: 2, transformOrigin: '50% 100%',
          transform: `translate(-50%, -100%) rotate(${angle}deg)`,
          boxShadow: `0 0 4px ${accent}`,
        }} />
      </div>
      {label && (
        <div style={{ fontSize: 8.5, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#7b8294' }}>{label}</div>
      )}
      {display && <div style={{ fontSize: 9, color: '#aeb6c6', fontVariantNumeric: 'tabular-nums' }}>{display(value)}</div>}
    </div>
  )
}
