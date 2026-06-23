'use client'

// Classic/vintage broadcast mic — pure SVG with metallic chrome gradients and a
// mesh grille. Doubles as the record button (the centre lamp lights when armed).
export default function VintageMic({ size = 116, recording = false }: { size?: number; recording?: boolean }) {
  return (
    <svg width={size} height={size * 1.18} viewBox="0 0 120 142" fill="none" aria-hidden
      style={{ filter: `drop-shadow(0 8px 16px rgba(0,0,0,0.55))${recording ? ' drop-shadow(0 0 10px rgba(232,70,60,0.55))' : ''}` }}>
      <defs>
        {/* cylindrical chrome (vertical sheen) */}
        <linearGradient id="vm-chrome" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#6c7280" />
          <stop offset="0.16" stopColor="#eef2f8" />
          <stop offset="0.36" stopColor="#aeb5c2" />
          <stop offset="0.5" stopColor="#dfe5ee" />
          <stop offset="0.66" stopColor="#9097a4" />
          <stop offset="0.85" stopColor="#e9eef5" />
          <stop offset="1" stopColor="#5f6573" />
        </linearGradient>
        <linearGradient id="vm-ring" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f4f7fb" />
          <stop offset="0.45" stopColor="#9aa1ae" />
          <stop offset="0.55" stopColor="#7c8390" />
          <stop offset="1" stopColor="#cdd3dc" />
        </linearGradient>
        <radialGradient id="vm-grille" cx="0.4" cy="0.34" r="0.8">
          <stop offset="0" stopColor="#3a3e47" />
          <stop offset="0.55" stopColor="#23262d" />
          <stop offset="1" stopColor="#0e1014" />
        </radialGradient>
        <linearGradient id="vm-band" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e7ecf3" />
          <stop offset="0.5" stopColor="#aab1be" />
          <stop offset="1" stopColor="#7b828f" />
        </linearGradient>
        <linearGradient id="vm-stem" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#7a8090" />
          <stop offset="0.5" stopColor="#e6ebf2" />
          <stop offset="1" stopColor="#6a7080" />
        </linearGradient>
        <radialGradient id="vm-base" cx="0.5" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#cfd5de" />
          <stop offset="1" stopColor="#6b7280" />
        </radialGradient>
        {/* mesh dots */}
        <pattern id="vm-mesh" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(0)">
          <circle cx="1.6" cy="1.6" r="1.15" fill="rgba(255,255,255,0.10)" />
          <circle cx="4.6" cy="4.6" r="1.15" fill="rgba(255,255,255,0.10)" />
        </pattern>
      </defs>

      {/* base */}
      <ellipse cx="60" cy="132" rx="30" ry="8" fill="url(#vm-base)" />
      <ellipse cx="60" cy="130" rx="30" ry="8" fill="#15171c" opacity="0.25" />
      {/* stem */}
      <rect x="54" y="96" width="12" height="34" rx="5" fill="url(#vm-stem)" />

      {/* shock-mount ring behind head */}
      <circle cx="60" cy="54" r="49" fill="none" stroke="url(#vm-ring)" strokeWidth="7" />
      <circle cx="60" cy="54" r="49" fill="none" stroke="rgba(0,0,0,0.35)" strokeWidth="1" />

      {/* head outer ring */}
      <circle cx="60" cy="54" r="42" fill="url(#vm-chrome)" />
      <circle cx="60" cy="54" r="42" fill="none" stroke="rgba(0,0,0,0.35)" strokeWidth="1" />

      {/* grille */}
      <circle cx="60" cy="54" r="34" fill="url(#vm-grille)" />
      <circle cx="60" cy="54" r="34" fill="url(#vm-mesh)" />
      {/* concentric grille lines */}
      {[30, 24, 18, 12, 6].map((r) => (
        <circle key={r} cx="60" cy="54" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
      ))}
      {/* specular highlight */}
      <ellipse cx="48" cy="40" rx="14" ry="9" fill="rgba(255,255,255,0.22)" transform="rotate(-28 48 40)" />

      {/* brand band across head */}
      <rect x="26" y="50" width="68" height="9" rx="4.5" fill="url(#vm-band)" />
      <rect x="26" y="50" width="68" height="9" rx="4.5" fill="none" stroke="rgba(0,0,0,0.25)" strokeWidth="0.8" />
      {/* status lamp — lights + pulses while recording */}
      <circle cx="60" cy="54.5" r="2.6" fill={recording ? '#ff3b30' : '#7c2620'} />
      {recording && (
        <circle cx="60" cy="54.5" r="2.6" fill="#ff3b30">
          <animate attributeName="r" values="2.6;7;2.6" dur="1.1s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.9;0;0.9" dur="1.1s" repeatCount="indefinite" />
        </circle>
      )}

      {/* pivot screws on the ring */}
      <circle cx="11" cy="54" r="4.5" fill="url(#vm-ring)" stroke="rgba(0,0,0,0.4)" strokeWidth="0.8" />
      <circle cx="109" cy="54" r="4.5" fill="url(#vm-ring)" stroke="rgba(0,0,0,0.4)" strokeWidth="0.8" />
      <path d="M9 54h4M11 52v4" stroke="rgba(0,0,0,0.35)" strokeWidth="0.8" />
      <path d="M107 54h4M109 52v4" stroke="rgba(0,0,0,0.35)" strokeWidth="0.8" />
    </svg>
  )
}
