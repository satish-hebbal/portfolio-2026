'use client'

// Studio-Kapi — illustrated covers for the demo songs (hand-built SVG scenes)
import type { ReactNode } from 'react'
import { Play } from 'lucide-react'
import s from '../studioKapi.module.css'
import type { DemoCover as Cover, DemoScene } from '../audio/demos'

const W = 176
const H = 116

// ─── Psych Groove: psychedelic sun rings, rolling hills, electric guitar ─────
function Psych() {
  const rings = ['#ffb36b', '#ff6f91', '#c04bd6', '#6f3ae0', '#3a1f9e']
  return (
    <>
      <defs>
        <linearGradient id="ps-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#23105a" /><stop offset="1" stopColor="#4a1466" /></linearGradient>
        <linearGradient id="ps-gtr" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff4e0" /><stop offset="1" stopColor="#ffc9a8" /></linearGradient>
      </defs>
      <rect width={W} height={H} fill="url(#ps-bg)" />
      {Array.from({ length: 10 }).map((_, i) => (
        <circle key={i} cx="126" cy="42" r={100 - i * 10} fill={rings[i % rings.length]} opacity={0.18 + i * 0.07} />
      ))}
      <circle cx="126" cy="42" r="9" fill="#fff1c9" />
      <path d="M0 84C26 72 48 96 82 86S136 70 176 84V116H0Z" fill="#2c0b52" />
      <path d="M0 98C34 88 62 110 102 100S150 90 176 100V116H0Z" fill="#170631" />
      {/* electric guitar */}
      <g transform="translate(22 6) rotate(32 36 52)">
        <rect x="32.6" y="-2" width="6.8" height="52" rx="1.4" fill="#3a1a14" />
        <path d="M31.4 -8l1.6 7h6.8l1.8-8.6Z" fill="#3a1a14" />
        {[4, 10, 16, 22, 28, 34, 40].map((y) => <rect key={y} x="32.6" y={y} width="6.8" height=".9" fill="#caa37a" />)}
        <path d="M30 50c-4-7-13-7.8-14 .4-.4 4.6 4.6 7.2 2.2 13-2.2 5.4-5.4 9-4.8 15.8 1 10.4 11.6 14.6 23 14 11.6-.4 21.6-5.4 22-15.4.4-8-6.4-10.8-4.6-18 1.4-5.4 6.8-7.6 5.8-13.4-1.4-7.2-10.4-5.8-14 1.4-1.8 3.2-5.4 4-8.6 4-2.6 0-5.8-.4-7.6-1.8Z" fill="url(#ps-gtr)" />
        <path d="M24 66c2-3 6-4 10-2 5 2 9 1 12 3 3 3 2 9-2 12-5 3-12 3-17 1-4-3-5-9-3-14Z" fill="#e0518a" opacity=".9" />
        <rect x="29" y="63" width="14" height="3.2" rx="1" fill="#1d0b36" />
        <rect x="29" y="70" width="14" height="3.2" rx="1" fill="#1d0b36" />
        <circle cx="47" cy="82" r="2" fill="#1d0b36" /><circle cx="42" cy="86" r="2" fill="#1d0b36" />
      </g>
      {[[20, 20], [60, 12], [96, 88], [160, 96], [40, 44]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r="1" fill="#fff" opacity=".7" />)}
    </>
  )
}

// ─── Teentaal Evening: dusk sky, mandala sun, sitar + tabla silhouettes ──────
function Teentaal() {
  const ink = '#3b0d18'
  return (
    <>
      <defs>
        <linearGradient id="tt-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffd98a" /><stop offset=".42" stopColor="#f3913f" /><stop offset=".78" stopColor="#c0412e" /><stop offset="1" stopColor="#6c1726" />
        </linearGradient>
      </defs>
      <rect width={W} height={H} fill="url(#tt-bg)" />
      {/* mandala around the setting sun */}
      <g transform="translate(118 58)" opacity=".5">
        {Array.from({ length: 16 }).map((_, i) => (
          <ellipse key={i} cx="0" cy="-36" rx="4.5" ry="10" fill="none" stroke="#fff1cf" strokeWidth=".9" transform={`rotate(${i * 22.5})`} />
        ))}
        <circle r="44" fill="none" stroke="#fff1cf" strokeWidth=".8" strokeDasharray="1.5 3" />
      </g>
      <circle cx="118" cy="58" r="22" fill="#ffe7a8" />
      <path d="M40 22q3-3 6 0q3-3 6 0M58 14q2-2 4 0q2-2 4 0" fill="none" stroke={ink} strokeWidth="1.2" strokeLinecap="round" opacity=".7" />
      <rect y="104" width={W} height="12" fill={ink} />
      {/* sitar */}
      <g fill={ink}>
        <circle cx="28" cy="84" r="16" />
        <path d="M40 72l4.4 4.4 58-58-4.4-4.4Z" />
        <circle cx="103" cy="15" r="6" />
        <path d="M52 62l6 6M60 54l6 6M68 46l6 6M76 38l6 6" stroke={ink} strokeWidth="2" strokeLinecap="round" />
      </g>
      <path d="M26 88L100 16" stroke="#ffd98a" strokeWidth=".6" opacity=".6" />
      {/* tabla pair */}
      <g transform="translate(-4 -8)">
        <path d="M122 92c0 12 5 18 13 18s13-6 13-18Z" fill={ink} />
        <ellipse cx="135" cy="92" rx="13" ry="4.5" fill="#f4cf8e" />
        <ellipse cx="132" cy="92" rx="4" ry="1.5" fill="#1a0509" />
        <path d="M151 82l2 27q7 3 14 0l2-27Z" fill={ink} />
        <path d="M155 84l.8 24M160 84v25M165 84l-.8 24" stroke="#8a3a2a" strokeWidth="1" />
        <ellipse cx="160" cy="82" rx="9" ry="3.2" fill="#f4cf8e" />
        <ellipse cx="160" cy="82" rx="3.2" ry="1.1" fill="#1a0509" />
      </g>
    </>
  )
}

// ─── Carnatic Adi Talam: temple gopuram, kolam, mridangam ─────────────────────
function Carnatic() {
  const gold = '#e2b84a'
  const tiers = [[92, 78, 60], [96, 66, 52], [100, 55, 44], [104, 45, 36], [108, 36, 28], [111, 28, 22]]
  return (
    <>
      <defs>
        <linearGradient id="cn-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0f5a4c" /><stop offset="1" stopColor="#082a26" /></linearGradient>
        <radialGradient id="cn-halo" cx=".5" cy=".5" r=".5"><stop offset="0" stopColor="#ffe3a0" stopOpacity=".55" /><stop offset="1" stopColor="#ffe3a0" stopOpacity="0" /></radialGradient>
      </defs>
      <rect width={W} height={H} fill="url(#cn-bg)" />
      <circle cx="130" cy="40" r="46" fill="url(#cn-halo)" />
      {/* gopuram: stacked tiers */}
      <g fill={gold}>
        <rect x="104" y="78" width="52" height="24" />
        {tiers.map(([x, y, w], i) => <path key={i} d={`M${x + (i ? 2 : 0)} ${y + 12}h${w - (i ? 4 : 0)}l-3 -12h${-(w - 6 - (i ? 4 : 0))}Z`} opacity={1 - i * 0.06} transform="translate(8 0)" />)}
        <path d="M120 16h20l-2 -6h-16Z" />
        {[122, 127, 132, 137].map((x) => <circle key={x} cx={x + 1} cy="8" r="1.8" />)}
      </g>
      <g fill="#082a26" opacity=".55">
        <rect x="124" y="84" width="12" height="18" rx="6" />
        {[82, 70, 59].map((y) => <rect key={y} x="114" y={y} width="32" height="1.4" />)}
      </g>
      {/* kolam dots + loops */}
      <rect y="102" width={W} height="14" fill="#06201d" />
      {Array.from({ length: 22 }).map((_, i) => <circle key={i} cx={6 + i * 8} cy="109" r="1" fill="#f3e9d2" opacity=".8" />)}
      <path d="M2 109q4-6 8 0t8 0 8 0 8 0 8 0 8 0 8 0 8 0 8 0 8 0 8 0 8 0 8 0 8 0 8 0 8 0 8 0 8 0 8 0 8 0 8 0 8 0" fill="none" stroke="#f3e9d2" strokeWidth=".6" opacity=".6" />
      {/* mridangam */}
      <g transform="translate(8 50)">
        <path d="M8 6Q40 -6 76 8V38Q40 52 8 42Z" fill="#6b3316" />
        <path d="M14 8Q40 0 70 10M14 40Q40 48 70 36" fill="none" stroke="#3a1a0a" strokeWidth="1.2" />
        {[16, 24, 32].map((y) => <path key={y} d={`M12 ${y}H72`} stroke="#e9c98a" strokeWidth="1" opacity=".7" />)}
        <ellipse cx="8" cy="24" rx="6" ry="18" fill="#f1dcae" />
        <ellipse cx="8" cy="24" rx="2.4" ry="7" fill="#1e0e05" />
        <ellipse cx="76" cy="23" rx="5" ry="15" fill="#f1dcae" />
        <ellipse cx="76" cy="23" rx="2" ry="5.5" fill="#1e0e05" />
      </g>
    </>
  )
}

// ─── Dholak Shaadi: marigold toran, confetti, dholak ─────────────────────────
function Dholak() {
  const flowers = Array.from({ length: 12 }).map((_, i) => i * 16 + 4)
  return (
    <>
      <defs>
        <radialGradient id="dh-bg" cx=".5" cy=".7" r=".9"><stop offset="0" stopColor="#ff5c8a" /><stop offset="1" stopColor="#8a0f4a" /></radialGradient>
        <linearGradient id="dh-body" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#c0502a" /><stop offset="1" stopColor="#6e2410" /></linearGradient>
      </defs>
      <rect width={W} height={H} fill="url(#dh-bg)" />
      {/* mehndi dots */}
      {Array.from({ length: 40 }).map((_, i) => <circle key={i} cx={(i * 37) % W} cy={30 + ((i * 53) % 80)} r=".9" fill="#ffd6e4" opacity=".35" />)}
      {/* toran garland */}
      <path d="M0 4Q8 18 16 4T32 4T48 4T64 4T80 4T96 4T112 4T128 4T144 4T160 4T176 4" fill="none" stroke="#2f7d32" strokeWidth="1.2" />
      {flowers.map((x, i) => (
        <g key={x}>
          <path d={`M${x + 4} 14l-3 9 3-2 3 2Z`} fill="#3aa04a" />
          <circle cx={x + 4} cy="12" r="5" fill={i % 2 ? '#ffb300' : '#ff7a00'} />
          <circle cx={x + 4} cy="12" r="2" fill={i % 2 ? '#ff7a00' : '#ffd24a'} />
        </g>
      ))}
      {[[20, 40, '#ffe14a'], [150, 36, '#4fe3c1'], [36, 96, '#4fe3c1'], [158, 90, '#ffe14a'], [100, 30, '#fff']].map(([x, y, c]) => (
        <rect key={`${x}`} x={x as number} y={y as number} width="4" height="2" fill={c as string} transform={`rotate(35 ${x} ${y})`} />
      ))}
      {/* dholak */}
      <g transform="translate(34 44)">
        <path d="M6 8Q54 -4 102 8V52Q54 64 6 52Z" fill="url(#dh-body)" />
        <path d="M10 10l12 40 12-44 12 46 12-46 12 46 12-44 12 40" fill="none" stroke="#ffe3b0" strokeWidth="1.4" strokeLinejoin="round" />
        <ellipse cx="6" cy="30" rx="7" ry="22" fill="#ffe9c4" />
        <ellipse cx="102" cy="30" rx="6" ry="22" fill="#ffe9c4" />
        <ellipse cx="6" cy="30" rx="3" ry="9" fill="#d9b98a" opacity=".6" />
        <path d="M-2 52q-2 8 2 12M110 52q2 8-2 12" stroke="#ffb300" strokeWidth="2" strokeLinecap="round" fill="none" />
        <circle cx="0" cy="66" r="2.2" fill="#ffb300" /><circle cx="108" cy="66" r="2.2" fill="#ffb300" />
      </g>
    </>
  )
}

// ─── Mountain King House: neon peaks under a disco ball ─────────────────────
function Mountain() {
  const eq = [14, 22, 10, 30, 18, 26, 12, 34, 20, 16, 28, 12, 24, 18, 30, 14, 22, 10, 26, 16, 20, 12]
  return (
    <>
      <defs>
        <linearGradient id="mk-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0b0a2e" /><stop offset="1" stopColor="#4a1060" /></linearGradient>
        <linearGradient id="mk-neon" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#4fe3ff" /><stop offset="1" stopColor="#ff4fd8" /></linearGradient>
        <radialGradient id="mk-ball" cx=".35" cy=".3" r=".8"><stop offset="0" stopColor="#ffffff" /><stop offset=".5" stopColor="#b9c3d9" /><stop offset="1" stopColor="#4d5670" /></radialGradient>
        <clipPath id="mk-clip"><circle cx="88" cy="30" r="15" /></clipPath>
      </defs>
      <rect width={W} height={H} fill="url(#mk-bg)" />
      {[[12, 10], [30, 26], [150, 14], [164, 40], [120, 8], [60, 18], [140, 30]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r=".9" fill="#fff" opacity=".8" />)}
      {/* light beams from the ball */}
      {[-60, -30, 30, 60, 150, 200].map((a) => (
        <path key={a} d={`M88 30L${88 + Math.cos((a * Math.PI) / 180) * 120} ${30 + Math.sin((a * Math.PI) / 180) * 120}`} stroke="#fff" strokeWidth="6" opacity=".05" />
      ))}
      <path d="M88 0V15" stroke="#9aa3b8" strokeWidth="1" />
      <circle cx="88" cy="30" r="15" fill="url(#mk-ball)" />
      <g clipPath="url(#mk-clip)" stroke="#3a4158" strokeWidth=".6" opacity=".7">
        {[-10, -5, 0, 5, 10].map((d) => <path key={`h${d}`} d={`M70 ${30 + d}H106`} />)}
        {[-10, -5, 0, 5, 10].map((d) => <path key={`v${d}`} d={`M${88 + d} 12V48`} />)}
      </g>
      <path d="M82 22l3 3M94 20l-2 3" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" />
      {/* the king's mountains */}
      <path d="M0 96L34 56L52 74L84 40L116 80L138 60L176 92V116H0Z" fill="#140b33" />
      <path d="M0 96L34 56L52 74L84 40L116 80L138 60L176 92" fill="none" stroke="url(#mk-neon)" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M78 47L84 40L90 48L86 46L83 49Z" fill="#e8ecff" />
      <path d="M79 36l2-5 3 3 3-3 2 5Z" fill="#ffd24a" />
      {eq.map((h, i) => <rect key={i} x={3 + i * 8} y={116 - h * 0.6} width="5" height={h * 0.6} rx="1" fill={i % 2 ? '#ff4fd8' : '#4fe3ff'} opacity=".75" />)}
    </>
  )
}

// ─── Korobeiniki 8-bit: pixel onion domes under a pixel night sky ─────────────
const DOME = [
  '....G....',
  '...GGG...',
  '....G....',
  '...ABA...',
  '..ABABA..',
  '.ABABABA.',
  '.BABABAB.',
  '..ABABA..',
  '...ABA...',
  '..TTTTT..',
  '..TKTKT..',
  '..TTTTT..',
  '..TKTKT..',
  '..TTTTT..',
  '..TTTTT..',
]
function Dome({ x, y, px, a, b }: { x: number; y: number; px: number; a: string; b: string }) {
  const col: Record<string, string> = { G: '#ffd24a', A: a, B: b, T: '#f1e3c4', K: '#2a1f5a' }
  const cells: ReactNode[] = []
  DOME.forEach((row, r) => [...row].forEach((c, k) => {
    if (c !== '.') cells.push(<rect key={`${r}-${k}`} x={x + k * px} y={y + r * px} width={px} height={px} fill={col[c]} />)
  }))
  return <>{cells}</>
}
function Chip() {
  return (
    <>
      <rect width={W} height={H} fill="#1a1440" />
      <rect y="40" width={W} height="40" fill="#241a57" />
      <rect y="64" width={W} height="30" fill="#2f2170" />
      {[[10, 8], [34, 20], [60, 6], [150, 10], [166, 28], [120, 22], [84, 14]].map(([x, y]) => <rect key={`${x}${y}`} x={x} y={y} width="2" height="2" fill="#fff" />)}
      <rect x="140" y="12" width="12" height="12" fill="#fff4c2" /><rect x="144" y="12" width="8" height="8" fill="#1a1440" />
      <Dome x={16} y={40} px={4} a="#e53950" b="#ffffff" />
      <Dome x={66} y={16} px={6} a="#2bb673" b="#ffd24a" />
      <Dome x={128} y={46} px={3.6} a="#3a7bfd" b="#ffffff" />
      <rect y="100" width={W} height="16" fill="#e8f0ff" />
      {Array.from({ length: 22 }).map((_, i) => <rect key={i} x={i * 8} y="98" width="4" height="2" fill="#e8f0ff" />)}
      {/* pixel note */}
      <g fill="#ffd24a">
        <rect x="46" y="20" width="3" height="14" /><rect x="49" y="20" width="6" height="3" /><rect x="40" y="31" width="6" height="5" />
      </g>
    </>
  )
}

const SCENES: Record<DemoScene, () => ReactNode> = {
  psych: Psych, teentaal: Teentaal, carnatic: Carnatic, dholak: Dholak, mountain: Mountain, chip: Chip,
}

export default function DemoCover({ cover }: { cover: Cover }) {
  const Scene = SCENES[cover.scene]
  return (
    <span className={s.demoCover}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" preserveAspectRatio="xMidYMid slice" aria-hidden>
        <Scene />
      </svg>
      <span className={s.coverPlay}><Play size={13} fill="currentColor" /></span>
    </span>
  )
}
