'use client'

// Vertical segmented LED level meter (premium hardware look).
export default function LEDMeter({ level, segments = 16, width = 9, height = 150 }: {
  level: number // 0..1
  segments?: number
  width?: number
  height?: number
}) {
  const on = Math.round(level * segments)
  const segH = (height - (segments - 1) * 2) / segments
  return (
    <div style={{
      display: 'flex', flexDirection: 'column-reverse', gap: 2, width, height,
      padding: 2, borderRadius: 4, background: '#090a0d',
      boxShadow: 'inset 0 1px 4px rgba(0,0,0,0.9)', border: '1px solid #1b1d23',
    }}>
      {Array.from({ length: segments }).map((_, i) => {
        const active = i < on
        const color = i >= segments - 2 ? '#ff4b3e' : i >= segments - 5 ? '#ffd23f' : '#3fd17a'
        return (
          <div key={i} style={{
            height: segH, borderRadius: 1.5,
            background: active ? color : '#15171c',
            boxShadow: active ? `0 0 4px ${color}, inset 0 0 1px rgba(255,255,255,0.4)` : 'none',
            transition: 'background 0.04s, box-shadow 0.04s',
          }} />
        )
      })}
    </div>
  )
}
