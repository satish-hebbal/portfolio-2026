'use client'

// Studio-Kapi — hand-drawn instrument icons (24×24, lucide-style strokes) for the
// real recorded instruments. Percussion icons light up the drum head each
// stroke is played on (e.g. Tabla Na = small drum, Ge = big drum, Dha = both).
import type { ReactNode } from 'react'
import {
  Drum, Disc3, Bell, Waves, Zap, Sparkles, Music, Layers, Wind, AudioWaveform, Hand, Piano, Mic,
  type LucideIcon,
} from 'lucide-react'
import { getPreset } from '../audio/presets'

type Hit = 'a' | 'b' | 'both' | 'none'   // a = left / bass head, b = right / treble head
const HEAD = { fill: 'currentColor', fillOpacity: 0.38 }
const SOLID = { fill: 'currentColor', stroke: 'none' }

function Svg({ size = 16, children }: { size?: number; children: ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {children}
    </svg>
  )
}

// little strike marks above a drum head
const Strike = ({ x, y }: { x: number; y: number }) => (
  <path d={`M${x} ${y}v-1.7M${x - 2.6} ${y + 0.8}l-.9-1.2M${x + 2.6} ${y + 0.8}l.9-1.2`} strokeWidth={1.2} />
)

function Tabla({ hit }: { hit: Hit }) {
  const bayan = hit === 'a' || hit === 'both'
  const dayan = hit === 'b' || hit === 'both'
  return (
    <>
      {/* bayan: round bass bowl */}
      <path d="M2.5 12.5C2.5 18.3 4.9 21 8 21s5.5-2.7 5.5-8.5" />
      <ellipse cx="8" cy="12.5" rx="5.5" ry="2" {...(bayan ? HEAD : {})} />
      <ellipse cx="6.9" cy="12.5" rx="1.6" ry=".55" {...SOLID} />
      {/* dayan: tall treble drum with straps */}
      <path d="M14.2 8.5l.7 11.2q2.6 1.3 5.2 0l.7-11.2" />
      <path d="M16 9.9l.3 9.9M17.5 10v10.3M19 9.9l-.3 9.9" strokeWidth={1} strokeOpacity={0.6} />
      <ellipse cx="17.5" cy="8.5" rx="3.3" ry="1.25" {...(dayan ? HEAD : {})} />
      <ellipse cx="17.5" cy="8.5" rx="1.2" ry=".42" {...SOLID} />
      {bayan && <Strike x={8} y={8.2} />}
      {dayan && <Strike x={17.5} y={4.6} />}
    </>
  )
}

function Dholak({ hit }: { hit: Hit }) {
  return (
    <>
      <path d="M5 8Q12 5.6 19 8M5 16Q12 18.4 19 16" />
      <ellipse cx="5" cy="12" rx="1.6" ry="4" {...(hit === 'a' ? HEAD : {})} />
      <ellipse cx="19" cy="12" rx="1.3" ry="4" {...(hit === 'b' ? HEAD : {})} />
      <path d="M6.6 8.4l2.6 7.6 2.8-8.7 2.8 8.7 2.6-7.6" strokeWidth={1.1} strokeOpacity={0.7} />
      {hit === 'a' && <path d="M1.4 9.5l-.9-.6M1 12H0M1.4 14.5l-.9.6" strokeWidth={1.2} />}
      {hit === 'b' && <path d="M22.6 9.5l.9-.6M23 12h1M22.6 14.5l.9.6" strokeWidth={1.2} />}
    </>
  )
}

function Mridangam({ hit }: { hit: Hit }) {
  const l = hit === 'a' || hit === 'both'
  const r = hit === 'b' || hit === 'both'
  return (
    <>
      <path d="M4.5 7.4Q12 4.4 20 8.6M4.5 16.6Q12 19.6 20 15.4" />
      <ellipse cx="4.5" cy="12" rx="1.7" ry="4.6" {...(l ? HEAD : {})} />
      <ellipse cx="20" cy="12" rx="1.3" ry="3.4" {...(r ? HEAD : {})} />
      <path d="M6.2 9.4l12.2.9M6.2 12h12.2M6.2 14.6l12.2-.9" strokeWidth={1} strokeOpacity={0.6} />
      <path d="M12 5.9v12.2" strokeWidth={1.1} />
      {l && <path d="M1.2 9l-.9-.6M.9 12H-.1M1.2 15l-.9.6" strokeWidth={1.2} />}
      {r && <path d="M22.8 9.6l.9-.6M23.1 12h1M22.8 14.4l.9.6" strokeWidth={1.2} />}
    </>
  )
}

const Sitar = () => (
  <>
    <circle cx="6.5" cy="17.5" r="4.5" />
    <path d="M9 13.7l8.9-8.9M10.3 15l8.9-8.9" />
    <circle cx="19.7" cy="4.3" r="1.6" />
    <path d="M10.5 11.6l1.9 1.9M12.3 9.8l1.9 1.9M14.1 8l1.9 1.9M15.9 6.3l1.9 1.9" strokeWidth={1.1} />
    <path d="M5.3 17.3l2.2 2.2" />
    <path d="M7.4 18.4l11.2-11.2" strokeWidth={0.8} strokeOpacity={0.7} />
    {/* sympathetic-string pegs along the side of the neck */}
    <path d="M13.4 12.6l1.5 1.5M15.2 10.8l1.5 1.5M17 9l1.5 1.5" strokeWidth={1.1} />
    <path d="M4.2 15.1a3.3 3.3 0 0 1 2.3-.9" strokeWidth={0.9} strokeOpacity={0.7} />
  </>
)

const Tanpura = () => (
  <>
    <circle cx="12" cy="17" r="5" />
    <path d="M11 12.1V2.6M13 12.1V2.6M11 2.6h2" />
    <path d="M11 4.5H9.4M13 4.5h1.6M11 6.7H9.4M13 6.7h1.6" strokeWidth={1.2} />
    <path d="M11.6 3.2v16.3M12.4 3.2v16.3" strokeWidth={0.7} strokeOpacity={0.75} />
    <path d="M9.6 19.6h4.8" />
  </>
)

const Santoor = () => (
  <>
    <path d="M3 19h18L17.6 8.5H6.4Z" />
    <path d="M5.5 11.5h13M4.6 14.2h14.8M3.8 16.8h16.4" strokeWidth={0.8} strokeOpacity={0.7} />
    <circle cx="9" cy="11.5" r=".7" {...SOLID} /><circle cx="8.3" cy="14.2" r=".7" {...SOLID} /><circle cx="7.6" cy="16.8" r=".7" {...SOLID} />
    <circle cx="15" cy="11.5" r=".7" {...SOLID} /><circle cx="15.7" cy="14.2" r=".7" {...SOLID} /><circle cx="16.4" cy="16.8" r=".7" {...SOLID} />
    <path d="M7.5 6.5L11 2.6M16.5 6.5L13 2.6" strokeWidth={1.2} />
    <circle cx="7.3" cy="6.8" r=".9" /><circle cx="16.7" cy="6.8" r=".9" />
  </>
)

const Sarangi = () => (
  <>
    <path d="M8.2 21.3h7.6l.6-6.8-1.5-1.6.5-3.6H8.6l.5 3.6-1.5 1.6Z" />
    <path d="M9.4 9.3V3.2q2.6-1.3 5.2 0v6.1" />
    <path d="M9.4 4.8H7.9M14.6 4.8h1.5M9.4 7H7.9M14.6 7h1.5" strokeWidth={1.2} />
    <path d="M8.3 16.4h7.4" strokeWidth={1} />
    <path d="M11.3 3.8v16.6M12.7 3.8v16.6" strokeWidth={0.7} strokeOpacity={0.75} />
    <path d="M2.8 13.6Q12 9.6 21.2 13.6" strokeWidth={1.2} />
    <path d="M2.8 13.6h18.4" strokeWidth={0.7} strokeOpacity={0.7} />
  </>
)

const Bansuri = () => (
  <g transform="rotate(-38 12 12)">
    <rect x="1" y="10.4" width="22" height="3.2" rx="1.6" />
    <circle cx="4.4" cy="12" r=".75" {...SOLID} />
    {[8.4, 10.4, 12.4, 14.4, 16.4, 18.4].map((x) => <circle key={x} cx={x} cy="12" r=".55" {...SOLID} />)}
    <path d="M6.6 10.5v3M20.6 10.5v3" strokeWidth={0.9} strokeOpacity={0.6} />
  </g>
)

const Flute = () => (
  <g transform="rotate(-24 12 12)">
    <rect x="1" y="10.8" width="22" height="2.4" rx=".7" />
    <ellipse cx="4.3" cy="10.8" rx="1.2" ry=".6" />
    <path d="M7.3 10.8v2.4M19.8 10.8v2.4" strokeWidth={1} />
    {[10, 12.4, 14.8, 17.2].map((x) => <circle key={x} cx={x} cy="12" r=".95" strokeWidth={1.1} />)}
  </g>
)

const Harmonium = () => (
  <>
    <path d="M4.5 10.5V6.3h15v4.2M4.5 7.7h15M4.5 9.1h15" strokeWidth={1.1} />
    <rect x="3" y="10.5" width="18" height="9" rx="1" />
    <rect x="4.6" y="13.2" width="14.8" height="4.8" rx=".4" strokeWidth={1.1} />
    <path d="M7.1 13.2V18M9.6 13.2V18M12 13.2V18M14.4 13.2V18M16.9 13.2V18" strokeWidth={0.8} />
    <path d="M6.3 13.2v2.6M8.8 13.2v2.6M13.2 13.2v2.6M15.6 13.2v2.6M18.1 13.2v2.6" strokeWidth={1.5} />
    <circle cx="7" cy="11.9" r=".55" {...SOLID} /><circle cx="10" cy="11.9" r=".55" {...SOLID} />
    <circle cx="14" cy="11.9" r=".55" {...SOLID} /><circle cx="17" cy="11.9" r=".55" {...SOLID} />
  </>
)

const Morsing = () => (
  <>
    {/* jaw harp on its side: round loop, two long arms, tongue with a bent tip */}
    <path d="M9.5 7.6C5 7.6 2.5 9.4 2.5 12s2.5 4.4 7 4.4" />
    <path d="M9.5 7.6l9.5 3M9.5 16.4l9.5-3" />
    <path d="M5.5 12h15.6q1.4 0 1.4-1.6V9" strokeWidth={1.2} />
    <path d="M20.4 6.4l.6-1.2M22.8 6.8l.9-.9" strokeWidth={1.1} strokeOpacity={0.8} />
  </>
)

// figure-eight string body, used by violin and cello
const BOWED_BODY = 'M12 8.5C9 8.5 8.2 10 8.5 11.8c.2 1.2 1.1 1.5 1.1 2.5s-2 1.5-2 3.7c0 2.3 2.1 3.5 4.4 3.5s4.4-1.2 4.4-3.5c0-2.2-2-2.7-2-3.7s.9-1.3 1.1-2.5c.3-1.8-.5-3.3-3.5-3.3Z'
const Bowed = ({ cello }: { cello?: boolean }) => (
  <>
    <path d={BOWED_BODY} />
    <path d="M11.3 8.5V3.6M12.7 8.5V3.6" />
    <circle cx="12" cy="2.6" r=".95" />
    <path d="M10.2 14.6q-.4 1.2 0 2.4M13.8 14.6q.4 1.2 0 2.4" strokeWidth={1} />
    <path d="M10.8 17h2.4M12 17.6v2.6" strokeWidth={1} />
    {cello && <path d="M12 21.5v2" />}
  </>
)
const Violin = () => (
  <>
    <g transform="rotate(-32 12 12)"><Bowed /></g>
  </>
)
const Cello = () => <g transform="translate(0 -1) scale(1 1.02)"><Bowed cello /></g>

const Harp = () => (
  <>
    <path d="M5.5 21V4.2" strokeWidth={2} />
    <path d="M5.5 4.2C9.5 2.8 12.5 6.8 19.8 7.8" />
    <path d="M5.5 21l14.3-13.2" strokeWidth={1.8} />
    <path d="M8.5 4.3v13.9M11.3 5.4v10.2M14.1 6.6v6.4M16.9 7.4v3" strokeWidth={0.8} strokeOpacity={0.8} />
    <path d="M4 21.3h4" />
  </>
)

const Xylophone = () => (
  <>
    {[[3, 9, 11], [6.8, 10, 10], [10.6, 11, 9], [14.4, 12, 8], [18.2, 13, 7]].map(([x, y, h]) => (
      <rect key={x} x={x} y={y} width="2.6" height={h} rx=".6" />
    ))}
    <path d="M8.5 7.5L13 3M15.5 8.5L20 4" strokeWidth={1.2} />
    <circle cx="13.8" cy="2.3" r="1.1" {...SOLID} />
    <circle cx="20.8" cy="3.3" r="1.1" {...SOLID} />
  </>
)

const ACOUSTIC_BODY = 'M12 10c-2.7 0-3.4 1.6-3.1 3.2.2 1.1-.9 1.6-.9 4.1 0 2.7 1.9 4.2 4 4.2s4-1.5 4-4.2c0-2.5-1.1-3-.9-4.1.3-1.6-.4-3.2-3.1-3.2Z'
const Acoustic = ({ nylon }: { nylon?: boolean }) => (
  <g transform="rotate(35 12 12)">
    <path d={ACOUSTIC_BODY} />
    <circle cx="12" cy="15.1" r="1.35" />
    {nylon && <circle cx="12" cy="15.1" r="2.15" strokeWidth={0.8} strokeDasharray="1 .9" />}
    <path d="M10.8 18.8h2.4" />
    <path d="M11.3 10V3.4M12.7 10V3.4" />
    <path d="M10.7 3.4h2.6l.3-2.4h-3.2Z" />
    {nylon && <path d="M11.5 1.6v1.2M12.5 1.6v1.2" strokeWidth={0.7} />}
    <path d="M11.3 8h1.4M11.3 6.3h1.4M11.3 4.8h1.4" strokeWidth={0.8} />
  </g>
)

const Electric = ({ bass }: { bass?: boolean }) => (
  <g transform="rotate(35 12 12)">
    <path d="M10.5 12.4c-.9-1.6-2.8-1.7-3 .1-.1 1 1 1.6.5 2.9-.5 1.2-1.2 2-1.1 3.5.2 2.3 2.6 3.2 5.1 3.1 2.6-.1 4.8-1.2 4.9-3.4.1-1.8-1.4-2.4-1-4 .3-1.2 1.5-1.7 1.3-3-.3-1.6-2.3-1.3-3.1.3-.4.7-1.2.9-1.9.9-.6 0-1.3-.1-1.7-.4Z" />
    <path d={bass ? 'M11.3 12.4V1.5M12.7 12.4V1.5' : 'M11.3 12.4V3.4M12.7 12.4V3.4'} />
    <path d={bass ? 'M11.2 1.5l-.3-1.3h3l-.2 1.3' : 'M11.2 3.4l-.4-2.4 2.8.5-.9 1.9'} />
    <rect x="10.3" y={bass ? 15.2 : 14.3} width="3.4" height="1" rx=".3" strokeWidth={1} />
    {!bass && <rect x="10.3" y="16.4" width="3.4" height="1" rx=".3" strokeWidth={1} />}
    <circle cx="14.7" cy="18.9" r=".55" {...SOLID} />
    {bass && <circle cx="13.3" cy="19.9" r=".55" {...SOLID} />}
  </g>
)

const Sax = () => (
  <>
    <path d="M10.5 4v10.2c0 4.4 2.3 7.3 5.6 7.3 2.9 0 4.2-1.9 4.2-4.3V15" />
    <path d="M12.3 4.3v9.7c0 3.3 1.5 5.7 3.8 5.7 1.4 0 2.4-.9 2.4-2.4V15" />
    <path d="M17.6 14.5l-.5-1.6h4.6l-.6 1.6" />
    <path d="M10.5 4c0-1.4-1-2-2.8-1.6" />
    <path d="M12.3 4.3c0-1.8-.6-2.6-1.8-2.3" strokeWidth={1} />
    {[7, 9.3, 11.6].map((y) => <circle key={y} cx="11.4" cy={y} r=".6" {...SOLID} />)}
  </>
)

const Trumpet = () => (
  <>
    <path d="M1.8 12.5h2.4M4.2 11.7v1.6" />
    <path d="M4.2 12.5h10.8" />
    <path d="M15 11.3l6.7-3.1v8.6L15 13.7Z" />
    <path d="M5.5 12.5c0 4 0 4 2 4h6c1 0 1-1.6 1-2.8" strokeWidth={1.2} />
    <path d="M8.2 12.5V8.7M10.4 12.5V8.7M12.6 12.5V8.7" />
    <path d="M7.4 8.7h1.6M9.6 8.7h1.6M11.8 8.7h1.6" />
  </>
)

// preset id -> custom drawing
const CUSTOM: Record<string, () => ReactNode> = {
  'tabla-dha': () => <Tabla hit="both" />, 'tabla-dhin': () => <Tabla hit="both" />,
  'tabla-na': () => <Tabla hit="b" />, 'tabla-tin': () => <Tabla hit="b" />, 'tabla-tun': () => <Tabla hit="b" />, 'tabla-te': () => <Tabla hit="b" />,
  'tabla-ge': () => <Tabla hit="a" />, 'tabla-ke': () => <Tabla hit="a" />,
  tabla: () => <Tabla hit="none" />,
  'dholak-bass': () => <Dholak hit="a" />, 'dholak-treble': () => <Dholak hit="b" />,
  'mridangam-thom': () => <Mridangam hit="a" />, 'mridangam-nam': () => <Mridangam hit="b" />, 'mridangam-dheem': () => <Mridangam hit="both" />,
  morsing: Morsing, sitar: Sitar, tanpura: Tanpura, santoor: Santoor, sarangi: Sarangi, bansuri: Bansuri,
  harmonium: Harmonium, violin: Violin, cello: Cello, flute: Flute, harp: Harp, xylophone: Xylophone,
  'guitar-acoustic': () => <Acoustic />, 'guitar-nylon': () => <Acoustic nylon />,
  'guitar-electric': () => <Electric />, 'bass-electric': () => <Electric bass />,
  sax: Sax, trumpet: Trumpet,
}

// lucide fallbacks for the synth / electronic kit
const PRESET_ICON: Record<string, LucideIcon> = {
  'hat-closed': Disc3, 'hat-open': Disc3, ride: Disc3, crash: Disc3, disco: Disc3,
  clap: Hand, cowbell: Bell, bell: Bell, digibell: Bell,
  bass: Waves, sub: Waves, reese: Waves, acid: Waves, funkbass: Waves,
  supersaw: AudioWaveform, lead: Zap, stab: Zap, pad: Layers, prophet: Layers, hoover: Wind,
  pluck: Music, arp: Sparkles, piano: Piano, audio: Mic,
}
const GROUP_ICON: Record<string, LucideIcon> = {
  Drums: Drum, '808 & Perc': Drum, Bass: Waves, Synth: Zap, Electronic: Sparkles, Keys: Piano,
}

export function InstrumentIcon({ presetId, group, size = 16 }: { presetId: string; group?: string | null; size?: number }) {
  const draw = CUSTOM[presetId]
  if (draw) return <Svg size={size}>{draw()}</Svg>
  const Icon = PRESET_ICON[presetId] ?? GROUP_ICON[group ?? getPreset(presetId)?.group ?? ''] ?? Music
  return <Icon size={size} />
}

export const CUSTOM_ICON_IDS = Object.keys(CUSTOM)
