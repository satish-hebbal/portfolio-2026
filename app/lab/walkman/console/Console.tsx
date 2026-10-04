'use client'

// WM-01: the Walkman's control console, a slim rail of hardware at the right
// edge holding every setting on the page. Few words on it: the visualizer is
// a detented rotary (its name engraved under it), intensity a small dial,
// palettes a row of colour dots, then one strip of switches: song / auto,
// dither, grain, vignette, hold. The cover of the tape that's in sits in a
// cutout at the bottom and stays on screen even when the rail is stowed.
//
// Stowing is a single smooth slide; only the lip (stow handle, fullscreen) stays
// with a couple of detent stops, and only the handle and the cover remain.

import { useCallback, useEffect, useRef, useState } from 'react'
import s from './console.module.css'
import { mech } from './mechSound'
import type { AudioSignal, TrackStatus } from '../visualizer/audioSignal'
import { PALETTES, VIZ_LIST, type PaletteId, type ThemeMode, type VizSettings } from '../visualizer/vizConfig'

interface Props {
  darkBg: boolean
  theme: ThemeMode
  onTheme: (t: ThemeMode) => void
  albumRoom: [number, number, number] // the album theme's room colour (0..255)
  isFullscreen: boolean
  onFullscreen: () => void
  isMobile: boolean
  deckOpen?: boolean // phones: the tape deck needs the screen, so the module tucks away
  settings: VizSettings
  onChange: (s: VizSettings) => void
  albumColors: string[]
  trackStatus: TrackStatus
  signal: AudioSignal
  status: string // PLAYING / PAUSED / LOADING / ...
  thumbUrl: string
  meta: { title: string; author: string } | null
  onPlayPause: () => void
  onRewind: () => void
  onForward: () => void
  onStop: () => void
  onInsert: () => void // empty tile: open the tape deck
}

const DIAL = [...VIZ_LIST.map((v) => ({ id: v.id as VizSettings['viz'], name: v.name })), { id: 'off' as const, name: 'Off' }]
const ARC = 270
const angleOf = (i: number, n: number) => -ARC / 2 + (i * ARC) / (n - 1)

// rail geometry (logical px; the whole dock scales to fit short screens)
const W = 228          // body width = how far the drawer travels
const TILE = 112       // album tile
const M = 10           // tile inset from the screen corner
const MIN_H = 480      // below this the dock scales down instead of cramping
const OPEN_KEY = 'walkman:console-open'

// ── the tape module, docked in the bottom-right corner ──
// Flush to the bottom and right edges, a rounded top-left corner, and small
// inner curves where it meets each edge, so it reads as part of the frame.
const AM = { art: 104, pad: 9, keys: 22, gap: 8, flare: 14, fillet: 11, corner: 20 }
const AM_W = AM.pad * 2 + AM.art                          // body width
const AM_H = AM.pad * 2 + AM.art + AM.gap + AM.keys       // body height
const AM_BOX = { w: AM_W + AM.flare, h: AM_H + AM.flare } // with room for the flares
function albumModulePath() {
  const F = AM.flare, f = AM.fillet, R = AM.corner, W2 = AM_BOX.w, H2 = AM_BOX.h
  return [
    `M ${F + R} ${F} H ${W2 - f}`,
    `A ${f} ${f} 0 0 0 ${W2} ${F - f}`, // curves up into the right edge
    `V ${H2} H ${F - f}`,
    `A ${f} ${f} 0 0 0 ${F} ${H2 - f}`, // curves down into the bottom edge
    `V ${F + R} Q ${F} ${F} ${F + R} ${F} Z`,
  ].join(' ')
}
const AM_PATH = albumModulePath()

const TAB = 28         // the lip on the module's left edge that you pull it out by
const LIP_X = 5        // the lip's straight edge (the knuckle swells out past it)
const HANDLE_H = 66
const LIP_KEY = 24
// the fullscreen key sits in a rounded knuckle that swells out of the lip
const KNUCKLE = { x: (LIP_X + TAB) / 2, y: HANDLE_H + 4 + LIP_KEY / 2, r: LIP_KEY / 2 + 3.5 }
const KNUCKLE_FILLET = 5

// the module hangs in the top-right corner: flush to the top and right edges,
// one soft corner at the bottom left, and a lip grown out of its left edge at
// the top. The lip is part of the same piece (one outline, one material), so
// when the module is stowed it's the lip that stays peeking in from the edge.
// The left side, read upward: the module's edge rises to the knuckle, a small
// inner curve turns it out around the fullscreen key, another turns it back
// onto the lip's straight edge, which runs up to the top.
function knuckleSide() {
  const K = KNUCKLE, f = KNUCKLE_FILLET
  // inner curve against a vertical line at lineX, touching the knuckle circle
  // from outside; `below` picks the one under the knuckle
  const fillet = (lineX: number, below: boolean) => {
    const cx = lineX - f
    const d = Math.sqrt(Math.max(0, (K.r + f) ** 2 - (K.x - cx) ** 2))
    const c = { x: cx, y: K.y + (below ? d : -d) }
    const len = Math.hypot(c.x - K.x, c.y - K.y)
    const onCircle = { x: K.x + ((c.x - K.x) * K.r) / len, y: K.y + ((c.y - K.y) * K.r) / len }
    return { onLine: { x: lineX, y: c.y }, onCircle }
  }
  const lo = fillet(TAB, true)    // where the module's edge meets the knuckle
  const hi = fillet(LIP_X, false) // where the knuckle meets the lip
  const n = (v: number) => v.toFixed(2)
  return [
    `V ${n(lo.onLine.y)}`,
    `A ${f} ${f} 0 0 0 ${n(lo.onCircle.x)} ${n(lo.onCircle.y)}`,
    `A ${K.r} ${K.r} 0 0 1 ${n(hi.onCircle.x)} ${n(hi.onCircle.y)}`,
    `A ${f} ${f} 0 0 0 ${n(hi.onLine.x)} ${n(hi.onLine.y)}`,
    `V 0 Z`,
  ].join(' ')
}
const KNUCKLE_SIDE = knuckleSide()

// `r` rounds the lip's top corner: used when the module hangs below the nav
// (phones) instead of meeting the top edge of the screen
function bodyPath(bottom: number, r = 0) {
  const x = TAB // the module's own left edge
  return [
    `M ${LIP_X + r} 0 H ${W + x} V ${bottom}`,
    `H ${x + 26} Q ${x} ${bottom} ${x} ${bottom - 26}`,
    r ? KNUCKLE_SIDE.replace('V 0 Z', `V ${r} Q ${LIP_X} 0 ${LIP_X + r} 0 Z`) : KNUCKLE_SIDE,
  ].join(' ')
}

// phones: the nav bar spans the full width, so the module hangs just below it
const NAV_CLEAR = 68

// The knob module is a wood inlay cut to follow its two dials: a circle around
// each knob, a straight run along the top between them (their outer tangent),
// and a rounded inner corner underneath (a fillet circle touching both).
// Local coordinates of the knob row.
const PLATE = { w: 198, h: 132 } // a little taller than the inlay: the gate's marks sit below it
const VIZ_C = { x: 54, y: 56, r: 54 }   // big dial + its stop dots
const LVL_C = { x: 166, y: 31, r: 30 }  // level dial + its ticks
const FILLET = 27                       // the inner curve, centred on the theme gate's top corner;
                                        // wide enough to leave room for the album mark above the gate

// centre of the inner curve: a circle of radius FILLET touching both dial circles
function filletCentre() {
  const c1 = VIZ_C, c2 = LVL_C
  const dx = c2.x - c1.x, dy = c2.y - c1.y
  const D = Math.hypot(dx, dy)
  const a = c1.r + FILLET, b = c2.r + FILLET
  const x = (a * a - b * b + D * D) / (2 * D)
  const h = Math.sqrt(Math.max(0, a * a - x * x))
  const ux = dx / D, uy = dy / D
  const mx = c1.x + ux * x, my = c1.y + uy * x
  const cands = [{ x: mx - uy * h, y: my + ux * h }, { x: mx + uy * h, y: my - ux * h }]
  return cands[0].y > cands[1].y ? cands[0] : cands[1]
}
const FILLET_C = filletCentre()

function inlayPath() {
  const c1 = VIZ_C, c2 = LVL_C
  const dx = c2.x - c1.x, dy = c2.y - c1.y
  const D = Math.hypot(dx, dy)
  const base = Math.atan2(dy, dx)
  // outer tangent on the top side (screen y grows downward, so "up" is -y)
  const phi = Math.acos((c1.r - c2.r) / D)
  const nTop = base - phi
  const p1 = { x: c1.x + c1.r * Math.cos(nTop), y: c1.y + c1.r * Math.sin(nTop) }
  const p2 = { x: c2.x + c2.r * Math.cos(nTop), y: c2.y + c2.r * Math.sin(nTop) }
  // the inner curve: the fillet circle below, touching both dial circles
  const cf = FILLET_C
  const a = c1.r + FILLET, b = c2.r + FILLET
  const t1 = { x: c1.x + (cf.x - c1.x) * (c1.r / a), y: c1.y + (cf.y - c1.y) * (c1.r / a) }
  const t2 = { x: c2.x + (cf.x - c2.x) * (c2.r / b), y: c2.y + (cf.y - c2.y) * (c2.r / b) }
  // clockwise span on screen between two points of a circle
  const span = (c: { x: number; y: number }, from: { x: number; y: number }, to: { x: number; y: number }) => {
    let d = Math.atan2(to.y - c.y, to.x - c.x) - Math.atan2(from.y - c.y, from.x - c.x)
    while (d < 0) d += Math.PI * 2
    return d
  }
  const f = (n: number) => n.toFixed(2)
  return [
    `M ${f(p1.x)} ${f(p1.y)} L ${f(p2.x)} ${f(p2.y)}`,
    `A ${c2.r} ${c2.r} 0 ${span(c2, p2, t2) > Math.PI ? 1 : 0} 1 ${f(t2.x)} ${f(t2.y)}`,
    `A ${FILLET} ${FILLET} 0 0 0 ${f(t1.x)} ${f(t1.y)}`,
    `A ${c1.r} ${c1.r} 0 ${span(c1, t1, p1) > Math.PI ? 1 : 0} 1 ${f(p1.x)} ${f(p1.y)} Z`,
  ].join(' ')
}
const PLATE_PATH = inlayPath()

// tiny glyphs instead of words
const VIZ_ICON: Record<string, React.ReactNode> = {
  aura: <path d="M12 4c4 0 8 3 7 8s-5 8-9 7-6-4-6-8 4-7 8-7z" fill="currentColor" opacity="0.85" />,
  pulse: <g fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="2.5" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="9.5" strokeDasharray="2 2.5" /></g>,
  halftone: <g fill="currentColor"><circle cx="6" cy="6" r="1.2" /><circle cx="12" cy="6" r="2" /><circle cx="18" cy="6" r="1.2" /><circle cx="6" cy="12" r="2" /><circle cx="12" cy="12" r="3" /><circle cx="18" cy="12" r="2" /><circle cx="6" cy="18" r="1.2" /><circle cx="12" cy="18" r="2" /><circle cx="18" cy="18" r="1.2" /></g>,
  vhs: <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M2 12c2.5-6 5-6 7.5 0s5 6 7.5 0 3-4 5-2" /><path d="M3 5h18M3 19h18" opacity="0.5" /></g>,
  contours: <g fill="none" stroke="currentColor" strokeWidth="1.8"><ellipse cx="12" cy="12" rx="9.5" ry="7" /><ellipse cx="12.5" cy="12" rx="6" ry="4.2" /><ellipse cx="13" cy="12" rx="2.5" ry="1.8" /></g>,
  tunnel: <g fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="2.5" y="2.5" width="19" height="19" rx="2" /><rect x="7" y="7" width="10" height="10" rx="1.5" /><rect x="10.5" y="10.5" width="3" height="3" rx="0.5" /></g>,
  warp: <g stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 9V3M12 15v6M9 12H3M15 12h6M9.5 9.5 6 6M14.5 14.5 18 18M14.5 9.5 18 6M9.5 14.5 6 18" /></g>,
  off: <g fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 3v8" /><path d="M6.3 6.5a8 8 0 1 0 11.4 0" /></g>,
}
const Icon = ({ children, size = 10 }: { children: React.ReactNode; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>{children}</svg>
)
const FX_ICON = {
  // dither: a 2-tone checker
  dither: <g fill="currentColor"><rect x="3" y="3" width="6" height="6" /><rect x="15" y="3" width="6" height="6" /><rect x="9" y="9" width="6" height="6" /><rect x="3" y="15" width="6" height="6" /><rect x="15" y="15" width="6" height="6" /></g>,
  // grain: scattered specks
  grain: <g fill="currentColor"><circle cx="5" cy="6" r="1.6" /><circle cx="14" cy="4" r="1.2" /><circle cx="19" cy="10" r="1.6" /><circle cx="9" cy="12" r="1.2" /><circle cx="15" cy="16" r="1.6" /><circle cx="5" cy="18" r="1.2" /><circle cx="20" cy="20" r="1.2" /></g>,
  // vignette: a frame darkening toward the corners
  vignette: <g><rect x="3" y="3" width="18" height="18" rx="3" fill="currentColor" /><ellipse cx="12" cy="12" rx="6" ry="5" fill="var(--recess)" /></g>,
} as const
// ── three-way theme gate ─────────────────────────────────────────────────────
// A single triangular track with a metal ball riding in it: from any corner
// the ball slides straight along an edge to the next. Album sits at the top, light bottom-left, dark bottom-right; the
// printed marks stand off from the gate on the body.
const GATE = { w: 68, h: 56 }
const CH = 7 // half the track width (the ball rides on its centre line)
const GATE_V: Record<ThemeMode, { x: number; y: number }> = {
  album: { x: 34, y: 10 },
  light: { x: 12, y: 46 },
  dark: { x: 56, y: 46 },
}
const GATE_ORDER: ThemeMode[] = ['album', 'dark', 'light'] // clockwise on screen
type P2 = { x: number; y: number }

// a triangle grown outward by r: straight offsets joined by corner arcs
function roundTri(pts: P2[], r: number) {
  const n = (a: P2, b: P2) => {
    const dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy)
    return { x: dy / l, y: -dx / l } // outward for a clockwise loop (y down)
  }
  const f = (v: number) => v.toFixed(2)
  let d = ''
  pts.forEach((a, i) => {
    const b = pts[(i + 1) % 3], c = pts[(i + 2) % 3]
    const n1 = n(a, b), n2 = n(b, c)
    if (i === 0) d += `M ${f(a.x + n1.x * r)} ${f(a.y + n1.y * r)} `
    d += `L ${f(b.x + n1.x * r)} ${f(b.y + n1.y * r)} A ${r} ${r} 0 0 1 ${f(b.x + n2.x * r)} ${f(b.y + n2.y * r)} `
  })
  return d + 'Z'
}
const CENTRE_LINE = GATE_ORDER.map((k) => GATE_V[k])
const TRACK = roundTri(CENTRE_LINE, 0.01) // the ball's path; drawn as a thick, round-jointed groove

function TriGate({ value, onChange, albumRoom }: { value: ThemeMode; onChange: (t: ThemeMode) => void; albumRoom: [number, number, number] }) {
  const ball = GATE_V[value]
  const room = `rgb(${albumRoom.join(',')})`
  const LABEL: Record<ThemeMode, string> = { light: 'Light', dark: 'Dark', album: 'Album colours' }
  return (
    <div className={s.gate} role="radiogroup" aria-label="Theme" style={{ width: GATE.w, height: GATE.h }}
      onKeyDown={(e) => {
        const i = GATE_ORDER.indexOf(value)
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); onChange(GATE_ORDER[(i + 1) % 3]) }
        if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); onChange(GATE_ORDER[(i + 2) % 3]) }
      }}>
      <svg width={GATE.w} height={GATE.h} aria-hidden style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
        {/* one recessed track: a rim, a shadow under its top edge, the floor */}
        <path d={TRACK} fill="none" stroke="var(--hi)" strokeWidth={CH * 2 + 3} strokeLinejoin="round" transform="translate(0 1)" />
        <path d={TRACK} fill="none" stroke="var(--btn-rim)" strokeWidth={CH * 2 + 2} strokeLinejoin="round" />
        <path d={TRACK} fill="none" stroke="rgba(0,0,0,0.22)" strokeWidth={CH * 2} strokeLinejoin="round" />
        <path d={TRACK} fill="none" stroke="var(--track-solid)" strokeWidth={CH * 2 - 1.5} strokeLinejoin="round" transform="translate(0 1)" />
        {/* a single groove down the middle of the track: the line the ball rides */}
        <path d={TRACK} fill="none" stroke="var(--hi)" strokeWidth="1" strokeLinejoin="round" transform="translate(0 1.4)" />
        <path d={TRACK} fill="none" stroke="var(--groove-solid)" strokeWidth="1.4" strokeLinejoin="round" transform="translate(0 0.6)" />
      </svg>

      {/* corner marks, standing off from the gate */}
      <span className={s.gateMark} data-lit={value === 'album'} style={{ left: GATE_V.album.x, top: GATE_V.album.y - (CH + 1 + FILLET) / 2 }}>
        <svg width="12" height="8" viewBox="0 0 30 20" aria-hidden>
          <rect x="1.5" y="1.5" width="27" height="17" rx="3" fill={value === 'album' ? room : 'none'} stroke="currentColor" strokeWidth="2.5" />
          <circle cx="10" cy="10" r="3" fill="none" stroke="currentColor" strokeWidth="2.5" /><circle cx="20" cy="10" r="3" fill="none" stroke="currentColor" strokeWidth="2.5" />
        </svg>
      </span>
      <span className={s.gateMark} data-lit={value === 'light'} style={{ left: GATE_V.light.x - 13, top: GATE_V.light.y + 14 }}>
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden>
          <circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      </span>
      <span className={s.gateMark} data-lit={value === 'dark'} style={{ left: GATE_V.dark.x + 13, top: GATE_V.dark.y + 14 }}>
        <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" /></svg>
      </span>

      {/* the ball rides the channel's centre line, corner to corner */}
      <span className={s.gateBall} style={{ left: ball.x, top: ball.y }} />
      {GATE_ORDER.map((k) => (
        <button key={k} role="radio" aria-checked={value === k} aria-label={LABEL[k]} title={LABEL[k]}
          tabIndex={value === k ? 0 : -1} className={s.gateHit}
          style={{ left: GATE_V[k].x, top: GATE_V[k].y }}
          onClick={() => { if (value !== k) onChange(k) }} />
      ))}
    </div>
  )
}

const SRC_ICON = {
  song: <path d="M9 17V6l10-2v11" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />,
  auto: <path d="M7 8c-3 0-4 2-4 4s1 4 4 4c4 0 6-8 10-8 3 0 4 2 4 4s-1 4-4 4c-4 0-6-8-10-8z" fill="none" stroke="currentColor" strokeWidth="2" />,
}
const NOTE_HEAD = <><circle cx="7" cy="17" r="2.6" fill="currentColor" /><circle cx="17" cy="15" r="2.6" fill="currentColor" /></>
const HOLD_ICON = <path d="M9 3h6l-1 6 3 3v2h-4v7l-1 1-1-1v-7H7v-2l3-3z" fill="currentColor" />

export default function Console(p: Props) {
  const { darkBg, settings } = p
  const set = <K extends keyof VizSettings>(k: K, v: VizSettings[K]) => p.onChange({ ...settings, [k]: v })

  // ── drawer ──
  const [open, setOpen] = useState(true)
  const drawerRef = useRef<HTMLDivElement>(null)
  const busy = useRef(false)

  useEffect(() => {
    let o = !p.isMobile
    try { const v = localStorage.getItem(OPEN_KEY); if (v !== null) o = v === '1' } catch {}
    setOpen(o)
    if (drawerRef.current) drawerRef.current.style.transform = `translateX(${o ? 0 : W}px)`
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toggle = useCallback(() => {
    const el = drawerRef.current
    if (!el || busy.current) return
    busy.current = true
    const opening = !open
    const from = `translateX(${opening ? W : 0}px)`
    const to = `translateX(${opening ? 0 : W}px)`
    // one smooth, quiet slide
    const anim = el.animate([{ transform: from }, { transform: to }], { duration: 420, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'forwards' })
    // settle on finish, or on a timer if the browser held the animation back
    // (background tabs): the module must never get stuck mid-travel
    let settled = false
    const settle = () => {
      if (settled) return
      settled = true
      el.style.transform = to
      anim.cancel()
      busy.current = false
    }
    anim.onfinish = settle
    window.setTimeout(settle, 560)
    setOpen(opening)
    try { localStorage.setItem(OPEN_KEY, opening ? '1' : '0') } catch {}
  }, [open])

  // going full screen tucks the module away (the lip, with the fullscreen key,
  // stays at the edge to get back out)
  const wasFullscreen = useRef(p.isFullscreen)
  useEffect(() => {
    if (p.isFullscreen && !wasFullscreen.current && open) toggle()
    wasFullscreen.current = p.isFullscreen
  }, [p.isFullscreen, open, toggle])

  // phones: opening the tape deck tucks the module away so the shelf has the screen
  const wasDeckOpen = useRef(false)
  useEffect(() => {
    if (p.isMobile && p.deckOpen && !wasDeckOpen.current && open) toggle()
    wasDeckOpen.current = !!p.deckOpen
  }, [p.isMobile, p.deckOpen, open, toggle])

  // the rail is always exactly screen-tall: shorter screens scale it down
  const [fit, setFit] = useState({ scale: 1, h: 820 })
  useEffect(() => {
    const onResize = () => {
      const scale = Math.min(1, window.innerHeight / MIN_H, window.innerWidth / (W + TAB + 12))
      setFit({ scale, h: window.innerHeight / scale })
    }
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // the controls sit just above the album pocket; the top scoop takes the rest
  const contentRef = useRef<HTMLDivElement>(null)
  const [contentH, setContentH] = useState(240)
  useEffect(() => {
    const el = contentRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setContentH(el.offsetHeight))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const top = 0
  const bottom = contentH + 12 // the module is exactly as tall as its controls
  const dropped = p.isMobile && !p.isFullscreen // in fullscreen the nav is gone
  const path = bodyPath(bottom, dropped ? 10 : 0)

  // ── live bit: the handle's level meter (no React renders) ──
  const meterRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let raf = 0
    const frame = () => {
      raf = requestAnimationFrame(frame)
      const f = p.signal.f
      Array.from(meterRef.current?.children ?? []).forEach((el, i, arr) => {
        const on = (i + 0.5) / arr.length < f.level ? 'true' : 'false'
        const h = el as HTMLElement
        if (h.dataset.on !== on) h.dataset.on = on
      })
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [p.signal])

  // ── visualizer rotary ──
  const vizIdx = Math.max(0, DIAL.findIndex((d) => d.id === settings.viz))
  const pickViz = (i: number) => {
    const next = Math.max(0, Math.min(DIAL.length - 1, i))
    if (DIAL[next].id !== settings.viz) { mech('detent'); set('viz', DIAL[next].id) }
  }
  const dialDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2
    const deg = (Math.atan2(e.clientX - cx, cy - e.clientY) * 180) / Math.PI
    const clamped = Math.max(-ARC / 2 - 20, Math.min(ARC / 2 + 20, deg))
    pickViz(Math.round(((clamped + ARC / 2) / ARC) * (DIAL.length - 1)))
  }

  // ── intensity dial (continuous, vertical drag) ──
  const intRef = useRef<{ y: number; v: number } | null>(null)
  const lastTick = useRef(0)
  const setIntensity = (v: number) => {
    const nv = Math.round(Math.max(0.2, Math.min(1, v)) * 100) / 100
    if (Math.floor(nv * 20) !== Math.floor(lastTick.current * 20)) mech('detent')
    lastTick.current = nv
    set('intensity', nv)
  }
  const intAngle = -ARC / 2 + ((settings.intensity - 0.2) / 0.8) * ARC

  // ── palette, stepped through with the drum ──
  const palIdx = Math.max(0, PALETTES.findIndex((x) => x.id === settings.palette))
  const palCols = PALETTES[palIdx].id === 'album' ? p.albumColors : PALETTES[palIdx].colors
  const stepPalette = (dir: 1 | -1) => {
    const next = (palIdx + dir + PALETTES.length) % PALETTES.length
    set('palette', PALETTES[next].id as PaletteId)
  }

  // ── source: song analysis or the auto groove ──
  const song = settings.source === 'song'
  const srcTone = !song ? 'green'
    : p.trackStatus === 'ready' ? 'green' : p.trackStatus === 'loading' ? 'amber' : p.trackStatus === 'unavailable' ? 'red' : 'off'
  const srcTitle = !song ? 'Auto groove: an invented beat timed to the player'
    : p.trackStatus === 'ready' ? 'Song: following this tape’s real beats'
    : p.trackStatus === 'loading' ? 'Song: reading the tape…'
    : p.trackStatus === 'unavailable' ? 'Song: couldn’t read this tape, auto groove is standing in'
    : 'Song: follows the tape’s real beats'

  const playing = p.status === 'PLAYING'

  // dial geometry (inside the 116 x 112 dial box)
  const DC = { x: VIZ_C.x, y: VIZ_C.y }, KNOB = 72, DOT_R = 45
  const LV = { x: LVL_C.x, y: LVL_C.y }, LV_KNOB = 40

  return (
    <div className={s.dock} data-theme={darkBg ? 'dark' : 'light'}
      style={{ width: W + TAB, height: fit.h, transform: `scale(${fit.scale})` }}>

      <div ref={drawerRef} className={s.drawer} style={{ top: dropped ? NAV_CLEAR / fit.scale : 0, transition: 'top 0.45s cubic-bezier(0.22, 1, 0.36, 1)' }}>
        <div className={s.unit} style={{ width: W + TAB, height: fit.h, clipPath: `path('${path}')` }} inert={!open || undefined}>
          {/* a single 1px grey rim (the stroke is centred on the cut, so half shows) */}
          <svg className={s.outline} width={W + TAB} height={fit.h} aria-hidden>
            <path d={path} fill="none" stroke="var(--rim)" strokeWidth="2" />
          </svg>

          <div ref={contentRef} className={s.content} style={{ top, left: TAB }}>
            {/* the knob module: one recessed sub-plate in its own finish */}
            <div className={s.knobRow} style={{ height: PLATE.h }}>
              <div className={s.plate} style={{ clipPath: `path('${PLATE_PATH}')` }}>
                {/* sunk into the body: a soft shadow under the top-left lip, a faint catch-light
                    along the bottom-right, and a hairline where the cut edge meets the wood */}
                <svg width={PLATE.w} height={PLATE.h} aria-hidden style={{ position: 'absolute', inset: 0 }}>
                  <defs><filter id="wm-plate-blur" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="3.5" /></filter></defs>
                  <path d={PLATE_PATH} transform="translate(2.5 3.5)" fill="none" stroke="rgba(0,0,0,0.62)" strokeWidth="10" filter="url(#wm-plate-blur)" />
                  <path d={PLATE_PATH} transform="translate(-2.5 -3)" fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="8" filter="url(#wm-plate-blur)" />
                  <path d={PLATE_PATH} fill="none" stroke="rgba(0,0,0,0.4)" strokeWidth="1.5" />
                </svg>
              </div>

              {/* visualizer rotary */}
              {DIAL.map((d, i) => {
                const a = (angleOf(i, DIAL.length) * Math.PI) / 180
                return (
                  <button key={d.id} className={s.dialDot} data-on={i === vizIdx} onClick={() => pickViz(i)}
                    aria-label={d.name} title={d.name}
                    style={{ left: DC.x + Math.sin(a) * DOT_R, top: DC.y - Math.cos(a) * DOT_R }} />
                )
              })}
              <div
                className={s.knob}
                role="slider" tabIndex={0} aria-label="Visualizer" aria-valuetext={DIAL[vizIdx].name}
                aria-valuemin={0} aria-valuemax={DIAL.length - 1} aria-valuenow={vizIdx}
                style={{ left: DC.x - KNOB / 2, top: DC.y - KNOB / 2, width: KNOB, height: KNOB }}
                onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); dialDrag(e) }}
                onPointerMove={(e) => { if (e.currentTarget.hasPointerCapture(e.pointerId)) dialDrag(e) }}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); pickViz(vizIdx + 1) }
                  if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); pickViz(vizIdx - 1) }
                }}
              >
                <div className={s.knobCap} style={{ transform: `rotate(${angleOf(vizIdx, DIAL.length)}deg)` }}><span className={s.pointer} /></div>
                {/* the disc turns; the screen in its middle stays put and redraws */}
                <div className={`${s.phosphor} ${s.knobScreen}`} title={DIAL[vizIdx].name}>
                  <span key={vizIdx} className={s.screenGlyph}><Icon size={14}>{VIZ_ICON[DIAL[vizIdx].id]}</Icon></span>
                </div>
              </div>

              {/* level: a ridged ring turns around a fixed little phosphor screen */}
              {Array.from({ length: 11 }, (_, i) => {
                const a = ((-ARC / 2 + (i * ARC) / 10) * Math.PI) / 180
                return <span key={i} className={s.tick} data-on={i / 10 <= (settings.intensity - 0.2) / 0.8 + 0.001}
                  style={{ left: LV.x + Math.sin(a) * 25, top: LV.y - Math.cos(a) * 25 }} />
              })}
              <div
                className={s.levelKnob}
                role="slider" tabIndex={0} aria-label="Intensity" title="Intensity"
                aria-valuemin={20} aria-valuemax={100} aria-valuenow={Math.round(settings.intensity * 100)}
                style={{ left: LV.x - LV_KNOB / 2, top: LV.y - LV_KNOB / 2, width: LV_KNOB, height: LV_KNOB }}
                onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); intRef.current = { y: e.clientY, v: settings.intensity } }}
                onPointerMove={(e) => { if (intRef.current) setIntensity(intRef.current.v + (intRef.current.y - e.clientY) * 0.006) }}
                onPointerUp={() => { intRef.current = null }}
                onPointerCancel={() => { intRef.current = null }}
                onWheel={(e) => setIntensity(settings.intensity - Math.sign(e.deltaY) * 0.05)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowUp' || e.key === 'ArrowRight') { e.preventDefault(); setIntensity(settings.intensity + 0.05) }
                  if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') { e.preventDefault(); setIntensity(settings.intensity - 0.05) }
                }}
              >
                <div className={s.levelRing} style={{ transform: `rotate(${intAngle}deg)` }}><span className={s.levelNotch} /></div>
                <div className={s.phosphor}><span>{Math.round(settings.intensity * 100)}</span></div>
              </div>

              {/* the theme gate, its top corner nested in the inlay's inner curve */}
              <div className={s.notch} style={{ left: FILLET_C.x - GATE_V.album.x, top: FILLET_C.y - GATE_V.album.y }}>
                <TriGate value={p.theme} onChange={(t) => { mech('lever'); p.onTheme(t) }} albumRoom={p.albumRoom} />
              </div>
            </div>

            {/* palette: up / down keys either side of a lit colour window, and Remix */}
            <div className={s.paletteLine}>
            <div className={`${s.tray} ${s.paletteRow}`}>
              <button className={s.arrowKey} onClick={() => { mech('key'); stepPalette(-1) }} aria-label="Previous palette" title="Previous palette">
                <svg width="9" height="6" viewBox="0 0 12 8" aria-hidden><path d="M1.5 6.5 6 2l4.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
              <div className={s.colourWindow} data-remix={settings.remix}
                title={settings.remix ? 'Remix: every colour, drifting' : PALETTES[palIdx].id === 'album' ? 'Album cover colours' : PALETTES[palIdx].name}
                aria-live="polite" aria-label={settings.remix ? 'Palette: remix' : `Palette: ${PALETTES[palIdx].name}`}>
                <div key={palIdx} className={s.colourCard}>
                  {palCols.length
                    ? palCols.slice(0, 4).map((c, i) => <i key={i} style={{ background: c }} />)
                    : <span className={s.colourEmpty}>
                        <svg width="16" height="10" viewBox="0 0 32 20" aria-hidden fill="none" stroke="currentColor" strokeWidth="2.2">
                          <rect x="2" y="2" width="28" height="16" rx="3" /><circle cx="11" cy="10" r="3" /><circle cx="21" cy="10" r="3" />
                        </svg>
                      </span>}
                </div>
              </div>
              <button className={s.arrowKey} onClick={() => { mech('key'); stepPalette(1) }} aria-label="Next palette" title="Next palette">
                <svg width="9" height="6" viewBox="0 0 12 8" aria-hidden><path d="M1.5 1.5 6 6l4.5-4.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
            </div>
            <button className={s.remixKey} data-on={settings.remix} aria-pressed={settings.remix}
              title="Remix: drift through every colour" onClick={() => { mech('key'); set('remix', !settings.remix) }}>
              Remix
            </button>
            </div>

            {/* one strip of switches */}
            <div className={`${s.tray} ${s.strip}`}>
              <button className={s.cell} data-on={song} aria-pressed={song} title={srcTitle}
                onClick={() => { mech('lever'); set('source', song ? 'auto' : 'song') }}>
                <span className={s.cellTop}><span className={s.led} data-tone={srcTone} /><span className={s.toggle}><span className={s.toggleKnob} /></span></span>
                <span className={s.glyph}><Icon>{song ? <>{SRC_ICON.song}{NOTE_HEAD}</> : SRC_ICON.auto}</Icon></span>
              </button>
              <span className={s.divider} />
              {(['dither', 'grain', 'vignette'] as const).map((k) => (
                <button key={k} className={s.cell} data-on={settings[k]} aria-pressed={settings[k]} aria-label={k} title={k}
                  onClick={() => { mech('lever'); set(k, !settings[k]) }}>
                  <span className={s.cellTop}><span className={s.leverSlot}><span className={s.leverStick} /></span></span>
                  <span className={s.glyph}><Icon>{FX_ICON[k]}</Icon></span>
                </button>
              ))}
              <span className={s.divider} />
              <button className={s.cell} data-on={settings.idle} aria-pressed={settings.idle} title="Keep the background running with no tape"
                onClick={() => { mech('key'); set('idle', !settings.idle) }}>
                <span className={s.cellTop}><span className={s.round} /></span>
                <span className={s.glyph}><Icon>{HOLD_ICON}</Icon></span>
              </button>
            </div>
          </div>

        </div>
        {/* stow tab on the module's left edge: rides with it, so when the module is
              stowed off-screen the tab is what's left peeking in from the edge */}
        <button className={s.handle} onClick={toggle} aria-expanded={open} style={{ left: LIP_X, width: TAB - LIP_X, height: HANDLE_H }}
          aria-label={open ? 'Stow the console' : 'Pull out the console'} title={open ? 'Stow console' : 'Console'}>
          <svg width="8" height="8" viewBox="0 0 10 10" aria-hidden style={{ transform: open ? 'none' : 'rotate(180deg)' }}>
            <path d="M3 1.5 6.5 5 3 8.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          </svg>
          <div ref={meterRef} className={s.handleMeter}>{Array.from({ length: 5 }, (_, i) => <i key={i} />)}</div>
        </button>
        {/* fullscreen lives on the lip too, so it's reachable with the module stowed */}
        <button className={s.lipKey} style={{ top: KNUCKLE.y - LIP_KEY / 2, left: KNUCKLE.x - LIP_KEY / 2, width: LIP_KEY, height: LIP_KEY }} data-on={p.isFullscreen}
          onClick={() => { mech('key'); p.onFullscreen() }}
          aria-label={p.isFullscreen ? 'Exit fullscreen' : 'Fullscreen'} title="Fullscreen (F)">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" aria-hidden>
            {p.isFullscreen
              ? <path d="M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3M16 21v-3a2 2 0 0 1 2-2h3" />
              : <path d="M3 8V3h5M21 8V3h-5M3 16v5h5M21 16v5h-5" />}
          </svg>
        </button>
      </div>

      {/* the tape that's in: a module docked in the corner, cover above, transport below */}
      <div className={s.albumDock} style={{
        width: AM_BOX.w, height: AM_BOX.h,
        transform: p.isMobile && !open ? 'scale(0.6)' : undefined, transformOrigin: 'bottom right',
        // phones: the open tape deck needs the full width, so the module steps aside
        ...(p.isMobile && p.deckOpen ? { opacity: 0, visibility: 'hidden' as const } : {}),
        transition: 'opacity 0.2s ease, visibility 0.2s',
      }}>
        <div className={s.albumBody} style={{ clipPath: `path('${AM_PATH}')` }}>
          <svg className={s.outline} width={AM_BOX.w} height={AM_BOX.h} aria-hidden>
            <path d={AM_PATH} fill="none" stroke="var(--rim)" strokeWidth="2" />
          </svg>
        </div>

        <button className={s.album} data-playing={playing} data-paused={p.status === 'PAUSED'}
          style={{ left: AM.flare + AM.pad, top: AM.flare + AM.pad, width: AM.art, height: AM.art }}
          onClick={() => { mech('key'); if (p.thumbUrl) p.onPlayPause(); else p.onInsert() }}
          aria-label={p.thumbUrl ? (playing ? 'Pause' : 'Play') : 'Insert a tape'}
          title={p.meta ? `${p.meta.title}${p.meta.author ? ' · ' + p.meta.author : ''}` : 'Insert a tape'}>
          <span className={s.albumLed} />
          <div className={s.albumFace}>
            {p.thumbUrl ? (
              <img src={p.thumbUrl} alt="" draggable={false} />
            ) : (
              <div className={s.empty}>
                <div className={s.emptyReels}><i /><i /></div>
                <span className={s.emptyText}>INSERT TAPE</span>
              </div>
            )}
          </div>
        </button>

        {/* transport: small raised keys */}
        <div className={s.transport} style={{ left: AM.flare + AM.pad, top: AM.flare + AM.pad + AM.art + AM.gap, width: AM.art, height: AM.keys }}>
          <button className={s.tKey} disabled={!p.thumbUrl} onClick={() => { mech('key'); p.onRewind() }} aria-label="Back 10 seconds" title="Back 10 seconds">
            <svg width="10" height="8" viewBox="0 0 20 14" fill="currentColor" aria-hidden><path d="M9 1.5v11L1.5 7zM18.5 1.5v11L11 7z" /></svg>
          </button>
          <button className={`${s.tKey} ${s.tKeyMain}`} data-on={playing} onClick={() => { mech('key'); if (p.thumbUrl) p.onPlayPause(); else p.onInsert() }}
            aria-label={playing ? 'Pause' : 'Play'} title={playing ? 'Pause' : 'Play'}>
            {playing
              ? <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor" aria-hidden><rect x="5" y="4" width="5" height="16" rx="1" /><rect x="14" y="4" width="5" height="16" rx="1" /></svg>
              : <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M7 4.5v15a1 1 0 0 0 1.5.86l12-7.5a1 1 0 0 0 0-1.72l-12-7.5A1 1 0 0 0 7 4.5z" /></svg>}
          </button>
          <button className={s.tKey} disabled={!p.thumbUrl} onClick={() => { mech('key'); p.onForward() }} aria-label="Forward 10 seconds" title="Forward 10 seconds">
            <svg width="10" height="8" viewBox="0 0 20 14" fill="currentColor" aria-hidden><path d="M1.5 1.5v11L9 7zM11 1.5v11L18.5 7z" /></svg>
          </button>
          <button className={s.tKey} disabled={!p.thumbUrl} onClick={() => { mech('key'); p.onStop() }} aria-label="Stop" title="Stop">
            <svg width="7" height="7" viewBox="0 0 10 10" fill="currentColor" aria-hidden><rect x="0.5" y="0.5" width="9" height="9" rx="1.5" /></svg>
          </button>
        </div>
      </div>
    </div>
  )
}
