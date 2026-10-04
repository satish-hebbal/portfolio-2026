'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'

// --- Types ---
interface HSV { h: number; s: number; v: number }
interface Round { target: HSV; guess: HSV; score: number }
type GameStep = 'memorize' | 'guess' | 'reveal'
type FrontContent = 'memorize' | 'reveal'

// --- Color Utils ---
function hsvToHsl(h: number, s: number, v: number) {
  const sv = s / 100, vv = v / 100
  const l = vv * (1 - sv / 2)
  const sl = l === 0 || l === 1 ? 0 : (vv - l) / Math.min(l, 1 - l)
  return { h, s: sl * 100, l: l * 100 }
}
function hsvToCss(h: number, s: number, v: number): string {
  const { h: hh, s: ss, l } = hsvToHsl(h, s, v)
  return `hsl(${hh.toFixed(1)}, ${ss.toFixed(1)}%, ${l.toFixed(1)}%)`
}
// OKLab: a colour space where equal distances look equally different, so a
// hue slip on a near-black (barely visible) costs little and a clearly wrong
// brightness costs a lot. Raw HSV distance got both of those backwards.
function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const sv = s / 100, vv = v / 100
  const f = (n: number) => { const k = (n + h / 60) % 6; return vv - vv * sv * Math.max(0, Math.min(k, 4 - k, 1)) }
  return [f(5), f(3), f(1)]
}
function hsvToOklab({ h, s, v }: HSV): [number, number, number] {
  const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  const [r, g, b] = hsvToRgb(h, s, v).map(lin)
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const q = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * q,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * q,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * q,
  ]
}
// Curve fitted so typical guesses land where they did under the old formula
// (same quartiles over thousands of simulated rounds): the leaderboard stays fair.
function scoreColor(t: HSV, g: HSV): number {
  const [l1, a1, b1] = hsvToOklab(t)
  const [l2, a2, b2] = hsvToOklab(g)
  const dE = Math.hypot(l1 - l2, a1 - a2, b1 - b2)
  return Math.round(10 * Math.exp(-Math.pow(dE / 0.575, 1.05)) * 100) / 100
}

// what was off, in words: the one or two biggest misses
const HUE_NAMES: [number, string][] = [
  [15, 'red'], [45, 'orange'], [70, 'yellow'], [100, 'lime'], [160, 'green'], [190, 'teal'],
  [210, 'cyan'], [250, 'blue'], [275, 'indigo'], [300, 'purple'], [330, 'magenta'], [345, 'pink'], [360, 'red'],
]
const hueName = (h: number) => (HUE_NAMES.find(([edge]) => h < edge) ?? HUE_NAMES[0])[1]
function missHint(t: HSV, g: HSV): string {
  const [l1, a1, b1] = hsvToOklab(t)
  const [l2, a2, b2] = hsvToOklab(g)
  const c1 = Math.hypot(a1, b1), c2 = Math.hypot(a2, b2)
  const issues: { size: number; text: string }[] = []
  const dL = l2 - l1
  if (Math.abs(dL) > 0.035) issues.push({ size: Math.abs(dL), text: `${Math.abs(dL) < 0.08 ? 'a touch ' : ''}too ${dL > 0 ? 'light' : 'dark'}` })
  const dC = c2 - c1
  if (Math.abs(dC) > 0.03) issues.push({ size: Math.abs(dC) * 1.2, text: `${Math.abs(dC) < 0.06 ? 'a little ' : ''}too ${dC > 0 ? 'vivid' : 'muted'}` })
  const dh = Math.min(Math.abs(t.h - g.h), 360 - Math.abs(t.h - g.h))
  if (c1 > 0.04 && dh > 12) {
    const toward = hueName(g.h)
    issues.push({ size: (dh / 180) * c1 * 4, text: toward !== hueName(t.h) ? `drifted toward ${toward}` : 'hue slightly off' })
  }
  if (!issues.length) return 'Nearly identical.'
  return issues.sort((x, y) => y.size - x.size).slice(0, 2).map((i) => i.text).join(' · ')
}
function scoreMessage(score: number): string {
  if (score >= 9.5) return 'Perfection.'
  if (score >= 8.5) return 'Dialed in.'
  if (score >= 7.0) return 'Not bad at all.'
  if (score >= 5.0) return 'Getting there.'
  if (score >= 3.0) return 'Colors are hard.'
  return 'Keep practicing.'
}
function randomColor(): HSV {
  return { h: Math.floor(Math.random() * 360), s: 35 + Math.floor(Math.random() * 55), v: 25 + Math.floor(Math.random() * 60) }
}

const TOTAL_ROUNDS = 5
const MEMORIZE_SECONDS = 5
const CARD_H = 340

// --- Vertical Slider ---
function VerticalSlider({ value, onChange, background, min = 0, max = 360, label, thumbColor, wrap = false }: {
  value: number; onChange: (v: number) => void; background: string; min?: number; max?: number
  label: string; thumbColor: string; wrap?: boolean
}) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState(false)
  const handleY = useCallback((clientY: number) => {
    if (!trackRef.current) return
    const rect = trackRef.current.getBoundingClientRect()
    const ratio = 1 - Math.max(0, Math.min(1, (clientY - rect.top) / rect.height))
    onChange(Math.round(min + ratio * (max - min)))
  }, [min, max, onChange])

  // one pointer path for mouse, pen and touch; capture keeps the drag alive off the track
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    e.currentTarget.focus({ preventScroll: true })
    setDragging(true)
    handleY(e.clientY)
  }
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => { if (dragging) handleY(e.clientY) }
  const endDrag = () => setDragging(false)

  // arrows nudge by 1 (Shift: 10) for the last bit of precision a drag can't give
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 10 : 1
    let next: number | null = null
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') next = value + step
    else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') next = value - step
    else if (e.key === 'PageUp') next = value + 10
    else if (e.key === 'PageDown') next = value - 10
    else if (e.key === 'Home') next = min
    else if (e.key === 'End') next = max
    if (next === null) return
    e.preventDefault()
    const span = max - min + 1
    onChange(wrap ? ((((next - min) % span) + span) % span) + min : Math.max(min, Math.min(max, next)))
  }

  const thumbPos = 1 - (value - min) / (max - min)
  return (
    <div
      ref={trackRef}
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-orientation="vertical"
      className="cm-slider"
      style={{ width: '40px', height: '100%', background, borderRadius: '20px', position: 'relative', cursor: dragging ? 'grabbing' : 'pointer', flexShrink: 0, touchAction: 'none', outline: 'none' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={onKeyDown}
    >
      <div style={{
        position: 'absolute', left: '50%', width: dragging ? '24px' : '20px', height: dragging ? '24px' : '20px', background: thumbColor,
        border: '3px solid white', boxSizing: 'border-box',
        borderRadius: '50%', top: `${thumbPos * 100}%`, transform: 'translate(-50%, -50%)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.45)', pointerEvents: 'none',
        transition: 'width 0.15s ease, height 0.15s ease',
      }} />
      {dragging && (
        <div style={{
          position: 'absolute', left: 'calc(100% + 6px)', top: `${thumbPos * 100}%`, transform: 'translateY(-50%)',
          fontSize: '10px', fontVariantNumeric: 'tabular-nums', color: 'rgba(255,255,255,0.8)', pointerEvents: 'none',
          background: 'rgba(0,0,0,0.55)', padding: '2px 5px', borderRadius: '4px',
        }}>{value}</div>
      )}
    </div>
  )
}

// --- Grainy gradient CSS ---
const GRAINY_CSS = `
  /* Same drift as before, expressed as transforms. Animating top/left/right/bottom
     moved the blobs through layout, which counted as layout shift and re-blurred
     them every frame; transforms stay on the compositor. Offsets are the old
     percentage moves converted to viewport units (the stage fills the screen). */
  @keyframes grainy-yellow {
    0%   { transform: translate(0, 0) scale(1); }
    30%  { transform: translate(10vw, 20vh) scale(1.2); }
    60%  { transform: translate(25vw, -5vh) scale(1.3); }
    100% { transform: translate(0, 0) scale(1); }
  }
  @keyframes grainy-green {
    0%   { transform: translate(0, 0) scale(1.2); }
    30%  { transform: translate(0, 40vh) scale(1); }
    60%  { transform: translate(-15vw, 25vh) scale(1); }
    100% { transform: translate(0, 0) scale(1.2); }
  }
  @keyframes grainy-red {
    0%   { transform: translate(0, 0) scale(1); }
    30%  { transform: translate(-20vw, -10vh) scale(1.4); }
    60%  { transform: translate(-10vw, 0) scale(1); }
    100% { transform: translate(0, 0) scale(1); }
  }
  /* Soft blobs drawn as radial gradients instead of filter: blur(80px). The
     blur had to be recomputed for every animation frame; a gradient is painted
     once and then just moved. Each box is grown by the old blur radius (80px a
     side, pulled back with negative margins) so the falloff covers the same
     area the blur used to. */
  .grainy-blob { position: absolute; pointer-events: none; will-change: transform; margin: -80px; }
  .grainy-yellow { background: radial-gradient(closest-side, rgb(255, 174, 68) 8%, rgba(255, 174, 68, 0) 100%); width: 440px; height: 440px; animation: grainy-yellow 8s infinite ease; top: 20%; left: 10%; }
  .grainy-green  { background: radial-gradient(closest-side, rgb(178, 255, 225) 8%, rgba(178, 255, 225, 0) 100%); width: 510px; height: 460px; animation: grainy-green 8s infinite ease; top: 10%; right: 5%; }
  .grainy-red    { background: radial-gradient(closest-side, rgb(255, 156, 202) 8%, rgba(255, 156, 202, 0) 100%); width: 460px; height: 480px; animation: grainy-red 8s infinite linear; bottom: 20%; right: 5%; }
`

// --- Shine + arcade CSS ---
const GAME_CSS = `
  @keyframes digitDrop {
    0%   { transform: translateY(-120%); opacity: 0; }
    55%  { opacity: 1; }
    72%  { transform: translateY(6%); }
    86%  { transform: translateY(-2%); }
    100% { transform: translateY(0%); opacity: 1; }
  }
  .start-btn { position: relative; overflow: hidden; }
  .start-btn::after {
    content: '';
    position: absolute;
    top: 0; left: -80%;
    width: 55%; height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.52), transparent);
    transform: skewX(-16deg);
    pointer-events: none;
  }
  .start-btn:hover::after {
    animation: shineSweep 0.52s ease-out forwards;
  }
  @keyframes shineSweep {
    from { left: -80%; }
    to   { left: 140%; }
  }
  @keyframes color-wheel-spin {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
  }
  .color-wheel-spin {
    animation: color-wheel-spin 12s linear infinite;
  }
  .cm-slider:focus-visible { box-shadow: 0 0 0 2px #111, 0 0 0 4px rgba(255,255,255,0.7); }
  @keyframes cm-drain { from { transform: scaleX(1); } to { transform: scaleX(0); } }
  @keyframes cm-rise { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
  @media (prefers-reduced-motion: reduce) { .cm-drain { animation: none !important; } }
`

function CountdownDigit({ value, urgent }: { value: number; urgent: boolean }) {
  return (
    <div style={{ overflow: 'hidden', display: 'inline-block', lineHeight: 1, height: '1em' }}>
      <span
        key={value}
        style={{
          display: 'block',
          fontFamily: 'SatishSans, sans-serif',
          fontSize: '96px',
          fontWeight: 700,
          lineHeight: 1,
          color: urgent ? 'rgba(255,255,255,0.42)' : 'rgba(255,255,255,0.88)',
          animation: 'digitDrop 0.42s cubic-bezier(0.22, 1, 0.36, 1) both',
          transition: 'color 0.5s',
        }}
      >
        {value}
      </span>
    </div>
  )
}

// --- Shared aluminum gradient (module-level so ArrowBtn can use it) ---
const ALUMINUM_BTN = `
  repeating-linear-gradient(105deg, transparent 0px, rgba(255,255,255,0.14) 1px, transparent 2px, transparent 5px),
  linear-gradient(145deg, #d0d0d0 0%, #f4f4f4 20%, #a6a6a6 38%, #ebebeb 55%, #b2b2b2 70%, #f2f2f2 85%, #c6c6c6 100%)
`

// --- Arrow Button ---
function ArrowBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '46px', height: '46px', borderRadius: '50%',
        background: ALUMINUM_BTN,
        border: 'none', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        boxShadow: '0 4px 14px rgba(0,0,0,0.35), 0 1px 3px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.6)',
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2a2a2a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12h14M13 6l6 6-6 6" />
      </svg>
    </button>
  )
}

// --- Main ---
export default function ColorGame() {
  const [screen, setScreen] = useState<'start' | 'game' | 'final'>('start')
  const [step, setStep] = useState<GameStep>('memorize')
  const [frontContent, setFrontContent] = useState<FrontContent>('memorize')
  const [flipped, setFlipped] = useState(false)

  const [round, setRound] = useState(0)
  const [targets, setTargets] = useState<HSV[]>([])
  const [timer, setTimer] = useState(MEMORIZE_SECONDS)
  const [guess, setGuess] = useState<HSV>({ h: 180, s: 50, v: 50 })
  const [rounds, setRounds] = useState<Round[]>([])

  const [displayScore, setDisplayScore] = useState(0)
  const animRef = useRef<number | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [playerName, setPlayerName] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('color_player_name') ?? ''
    return ''
  })
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(false)
  const [leaderboard, setLeaderboard] = useState<{ name: string; avg_score: number; country: string }[]>([])
  const [showLeaderboard, setShowLeaderboard] = useState(false)
  const [borderFlash, setBorderFlash] = useState(false)
  const [leaderboardLoading, setLeaderboardLoading] = useState(false)
  const [leaderboardOffline, setLeaderboardOffline] = useState(false)
  const [country, setCountry] = useState('')
  const [best, setBest] = useState<number | null>(null)
  const [newBest, setNewBest] = useState(false)
  const [shareNote, setShareNote] = useState('')
  useEffect(() => {
    try { const b = parseFloat(localStorage.getItem('color_best') ?? ''); if (!Number.isNaN(b)) setBest(b) } catch {}
  }, [])

  // Detect country + pre-fetch leaderboard on mount
  useEffect(() => {
    fetch('https://ipapi.co/json/')
      .then(r => r.json())
      .then(d => { if (d.country_code) setCountry(d.country_code) })
      .catch(() => {})

    // Pre-fetch so leaderboard is ready before the panel slides in
    fetch('/api/scores')
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) { setLeaderboard(d); setLeaderboardOffline(false) } else setLeaderboardOffline(true) })
      .catch(() => setLeaderboardOffline(true))
  }, [])


  const fetchLeaderboard = async () => {
    setShowLeaderboard(true)
    // Refresh silently in background — no loading state
    try {
      const res = await fetch('/api/scores')
      const data = await res.json()
      if (Array.isArray(data)) { setLeaderboard(data); setLeaderboardOffline(false) } else setLeaderboardOffline(true)
    } catch { setLeaderboardOffline(true) }
  }

  const submitScore = async () => {
    if (!playerName.trim()) return
    setSubmitting(true)
    setSubmitError(false)
    localStorage.setItem('color_player_name', playerName.trim())
    try {
      const res = await fetch('/api/scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: playerName.trim(), avg_score: avgScore, country }),
      })
      if (!res.ok) throw new Error('save failed')
      setSubmitted(true)
      fetchLeaderboard()
    } catch {
      setSubmitError(true)
    } finally {
      setSubmitting(false)
    }
  }

  // Score count-up after flip settles
  useEffect(() => {
    if (frontContent !== 'reveal' || rounds.length === 0) return
    if (animRef.current) cancelAnimationFrame(animRef.current)
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    const target = rounds[rounds.length - 1].score
    setDisplayScore(0)
    timeoutRef.current = setTimeout(() => {
      const duration = 1300
      const startTime = performance.now()
      const tick = (now: number) => {
        const t = Math.min((now - startTime) / duration, 1)
        const eased = 1 - Math.pow(1 - t, 3)
        setDisplayScore(Math.round(eased * target * 100) / 100)
        if (t < 1) animRef.current = requestAnimationFrame(tick)
      }
      animRef.current = requestAnimationFrame(tick)
    }, 700)
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [frontContent, rounds])

  // Timer countdown -> flip to guess
  useEffect(() => {
    if (screen !== 'game' || step !== 'memorize') return
    if (timer <= 0) {
      setFlipped(true)
      setStep('guess')
      return
    }
    const id = setTimeout(() => setTimer((t) => t - 1), 1000)
    return () => clearTimeout(id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, step, timer])

  const startGame = () => {
    const t = Array.from({ length: TOTAL_ROUNDS }, randomColor)
    setTargets(t)
    setRounds([])
    setRound(0)
    setTimer(MEMORIZE_SECONDS)
    setGuess({ h: 180, s: 50, v: 50 })
    setFrontContent('memorize')
    setStep('memorize')
    setScreen('game')
    try { setPlayerName(localStorage.getItem('color_player_name') ?? '') } catch {}
    setSubmitted(false)
    setNewBest(false)
    setShareNote('')
    setSubmitting(false)
    setSubmitError(false)
    setShowLeaderboard(false)
    setLeaderboard([])
  }

  const submitGuess = () => {
    const target = targets[round]
    const score = scoreColor(target, guess)
    setRounds((prev) => [...prev, { target, guess, score }])
    try { navigator.vibrate?.(score >= 9 ? [12, 40, 12] : 14) } catch {}
    // Switch front content while back is still facing the user
    setFrontContent('reveal')
    setFlipped(false)
    setStep('reveal')
  }

  const nextRound = () => {
    if (round + 1 >= TOTAL_ROUNDS) {
      setScreen('final')
      return
    }
    setRound((r) => r + 1)
    setTimer(MEMORIZE_SECONDS)
    setGuess({ h: 180, s: 50, v: 50 })
    setFrontContent('memorize')
    setStep('memorize')
    // flipped stays false (front already visible from reveal)
  }

  const currentTarget = targets[round] || { h: 0, s: 50, v: 50 }
  const targetCss = hsvToCss(currentTarget.h, currentTarget.s, currentTarget.v)
  const guessCss = hsvToCss(guess.h, guess.s, guess.v)
  const lastRound = rounds[rounds.length - 1]

  const hueGrad = 'linear-gradient(to top, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)'
  const satGrad = `linear-gradient(to top, ${hsvToCss(guess.h, 0, guess.v)}, ${hsvToCss(guess.h, 100, guess.v)})`
  const valGrad = `linear-gradient(to top, #000000, ${hsvToCss(guess.h, guess.s, 100)})`

  const avgScore = rounds.length > 0
    ? Math.round(rounds.reduce((s, r) => s + r.score, 0) / rounds.length * 100) / 100
    : 0

  // personal best, recorded once per finished game
  useEffect(() => {
    if (screen !== 'final' || rounds.length < TOTAL_ROUNDS) return
    if (best === null || avgScore > best) {
      setNewBest(best !== null)
      setBest(avgScore)
      try { localStorage.setItem('color_best', String(avgScore)) } catch {}
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen])

  // Enter moves the game along: start, skip the countdown, lock in, next colour
  const keyActions = useRef({ startGame, submitGuess, nextRound, skip: () => { setFlipped(true); setStep('guess') } })
  keyActions.current = { startGame, submitGuess, nextRound, skip: () => { setFlipped(true); setStep('guess') } }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || e.repeat) return
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'BUTTON' || t.tagName === 'A')) return
      if (showLeaderboard) return
      const a = keyActions.current
      if (screen === 'start') a.startGame()
      else if (screen === 'game' && step === 'memorize') a.skip()
      else if (screen === 'game' && step === 'guess') a.submitGuess()
      else if (screen === 'game' && step === 'reveal') a.nextRound()
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [screen, step, showLeaderboard])

  // a shareable card: the five colours you saw beside the five you made
  const shareResult = async () => {
    const W = 1080, H = 1350
    const c = document.createElement('canvas')
    c.width = W; c.height = H
    const g = c.getContext('2d')!
    g.fillStyle = '#0b0b0b'; g.fillRect(0, 0, W, H)
    try { await document.fonts.ready } catch {}
    g.fillStyle = 'rgba(255,255,255,0.4)'
    g.font = '500 34px FunnelDisplay, sans-serif'
    g.fillText('COLOR MEMO', 90, 130)
    g.fillStyle = '#fff'
    g.font = '700 220px SatishSans, sans-serif'
    g.fillText(avgScore.toFixed(2), 80, 360)
    g.fillStyle = 'rgba(255,255,255,0.45)'
    g.font = '400 40px FunnelDisplay, sans-serif'
    g.fillText(`${scoreMessage(avgScore)}  out of 10`, 90, 430)
    const rowH = 132, top = 520, sw = 400, gap = 20
    rounds.forEach((r, i) => {
      const y = top + i * (rowH + 22)
      const pill = (x: number, col: string) => {
        g.fillStyle = col
        g.beginPath(); g.roundRect(x, y, sw, rowH, 26); g.fill()
      }
      pill(90, hsvToCss(r.target.h, r.target.s, r.target.v))
      pill(90 + sw + gap, hsvToCss(r.guess.h, r.guess.s, r.guess.v))
      g.fillStyle = '#fff'
      g.font = '700 48px SatishSans, sans-serif'
      g.textAlign = 'right'
      g.fillText(r.score.toFixed(2), W - 90, y + rowH / 2 + 16)
      g.textAlign = 'left'
    })
    g.fillStyle = 'rgba(255,255,255,0.3)'
    g.font = '400 30px FunnelDisplay, sans-serif'
    g.fillText('saw  ·  made', 90, H - 70)
    g.textAlign = 'right'
    g.fillText(`${window.location.host}/lab/color`, W - 90, H - 70)
    const blob: Blob | null = await new Promise((res) => c.toBlob(res, 'image/png'))
    if (!blob) return
    const file = new File([blob], `color-memo-${avgScore.toFixed(2)}.png`, { type: 'image/png' })
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Color Memo', text: `I scored ${avgScore.toFixed(2)}/10 on Color Memo` })
        return
      }
    } catch (err) { if ((err as Error).name === 'AbortError') return }
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = file.name
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 2000)
    setShareNote('Saved to your downloads')
  }

  // Confetti on high score
  useEffect(() => {
    if (screen !== 'final' || avgScore <= 7) return
    const canvas = document.createElement('canvas')
    canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9999'
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight
    document.body.appendChild(canvas)
    const ctx = canvas.getContext('2d')!
    const colors = ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#ff6bdb', '#ff9a3c', '#a78bfa']
    const particles = Array.from({ length: 140 }, () => ({
      x: Math.random() * canvas.width,
      y: -10 - Math.random() * canvas.height * 0.4,
      vx: (Math.random() - 0.5) * 3,
      vy: 1.5 + Math.random() * 3.5,
      size: 7 + Math.random() * 7,
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.18,
      rect: Math.random() > 0.4,
    }))
    let frame: number
    const duration = 4000
    const startTime = performance.now()
    const tick = (now: number) => {
      const elapsed = now - startTime
      const fade = elapsed > duration - 1000 ? 1 - (elapsed - (duration - 1000)) / 1000 : 1
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.globalAlpha = Math.max(0, fade)
      for (const p of particles) {
        p.x += p.vx; p.y += p.vy; p.vy += 0.07; p.rotation += p.rotSpeed
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rotation); ctx.fillStyle = p.color
        if (p.rect) { ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2) }
        else { ctx.beginPath(); ctx.ellipse(0, 0, p.size / 2, p.size / 4, 0, 0, Math.PI * 2); ctx.fill() }
        ctx.restore()
      }
      if (elapsed < duration) { frame = requestAnimationFrame(tick) } else { canvas.remove() }
    }
    frame = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(frame); canvas.remove() }
  }, [screen, avgScore])

  const ALUMINUM = `
    repeating-linear-gradient(93deg, transparent 0px, rgba(255,255,255,0.13) 1px, transparent 2px, transparent 5px),
    linear-gradient(158deg, #c4c4c4 0%, #f2f2f2 14%, #a2a2a2 30%, #e8e8e8 46%, #ababab 61%, #f0f0f0 76%, #c0c0c0 100%)
  `
  const CARD_SHADOW = '0 32px 80px rgba(0,0,0,0.44), 0 16px 36px rgba(0,0,0,0.28), 0 6px 14px rgba(0,0,0,0.18)'
  const BORDER = 6   // px — aluminum frame thickness
  const INNER_R = 16 - BORDER // inner border-radius

  // The face IS the aluminum frame — rotates with the card in 3D
  const cardFace = (extra?: React.CSSProperties): React.CSSProperties => ({
    position: 'absolute', inset: 0,
    backfaceVisibility: 'hidden',
    borderRadius: '16px',
    padding: `${BORDER}px`,
    background: ALUMINUM,
    boxShadow: CARD_SHADOW,
    boxSizing: 'border-box',
    ...extra,
  })

  // Inner content area — clips to rounded rect inside the aluminum
  const cardInner = (extra?: React.CSSProperties): React.CSSProperties => ({
    width: '100%', height: '100%',
    borderRadius: `${INNER_R}px`,
    overflow: 'hidden',
    ...extra,
  })

  // For flat (non-3D) cards
  const flatCard = (extra?: React.CSSProperties): React.CSSProperties => ({
    borderRadius: '16px',
    padding: `${BORDER}px`,
    background: ALUMINUM,
    boxShadow: CARD_SHADOW,
    boxSizing: 'border-box',
    ...extra,
  })

  return (
    <div style={{ height: '100vh', overflow: 'hidden', background: 'rgb(255, 255, 255)', fontFamily: 'FunnelDisplay, sans-serif', position: 'relative' }}>

      {/* Grainy gradient background */}
      <style>{GRAINY_CSS}</style>
      <svg style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}>
        <filter id="grainyNoiseFilter">
          <feTurbulence type="fractalNoise" baseFrequency="0.6" stitchTiles="stitch" />
          <feColorMatrix in="colorNoise" type="matrix" values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 1 0" />
          <feComposite operator="in" in2="SourceGraphic" result="monoNoise" />
          <feBlend in="SourceGraphic" in2="monoNoise" mode="screen" />
        </filter>
      </svg>
      <div style={{ position: 'absolute', inset: 0, background: '#8C8C8C', filter: 'url(#grainyNoiseFilter)', opacity: 0.4, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        <div className="grainy-blob grainy-yellow" />
        <div className="grainy-blob grainy-red" />
        <div className="grainy-blob grainy-green" />
      </div>

      {/* Leaderboard button — fixed, centered, always above the card, never moves */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', zIndex: 10 }}>
        <div style={{ width: '100%', maxWidth: '560px', display: 'flex', justifyContent: 'center', marginBottom: '200px', pointerEvents: 'none' }}>
          <button
            onClick={() => {
                setBorderFlash(true)
                setTimeout(() => setBorderFlash(false), 500)
                if (showLeaderboard) setShowLeaderboard(false)
                else fetchLeaderboard()
              }}
            style={{
              pointerEvents: 'auto',
              padding: '7px 18px', border: `1px solid ${borderFlash ? '#111' : '#e5e7eb'}`, background: 'white', width: '148px', justifyContent: 'center',
              color: '#6b7280', fontSize: '11px', fontFamily: 'FunnelDisplay, sans-serif',
              cursor: 'pointer', borderRadius: showLeaderboard ? '0 6px 0 6px' : '6px 0 6px 0', letterSpacing: '0.04em',
              display: 'flex', alignItems: 'center', gap: '6px',
              transition: 'border-color 0.35s ease, color 0.2s, border-radius 0.4s cubic-bezier(0.77, 0, 0.175, 1)',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', width: '16px', height: '16px', position: 'relative' }}>
              <img
                src="/images/HomeImages/eagle-head.svg"
                alt=""
                style={{ width: '16px', height: '16px', objectFit: 'contain', position: 'absolute', opacity: showLeaderboard ? 0 : 1, transform: showLeaderboard ? 'scale(0.6)' : 'scale(1)', transition: 'opacity 0.35s ease, transform 0.35s ease' }}
              />
              <svg
                width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                style={{ position: 'absolute', opacity: showLeaderboard ? 1 : 0, transform: showLeaderboard ? 'scale(1)' : 'scale(0.6)', transition: 'opacity 0.35s ease, transform 0.35s ease' }}
              >
                <path d="M19 12H5M12 5l-7 7 7 7" />
              </svg>
            </span>
            {showLeaderboard ? 'Back to game' : 'Leaderboard'}
          </button>
        </div>
        {/* Spacer to push button above card — matches card height roughly */}
        <div style={{ height: `${CARD_H}px`, width: '100%', maxWidth: '560px' }} />
        {/* Back to Lab link below card */}
        <div style={{ marginTop: '24px', pointerEvents: 'auto' }}>
          <a href="/lab" style={{ fontSize: '11px', color: '#9ca3af', letterSpacing: '0.04em', textDecoration: 'none', fontFamily: 'FunnelDisplay, sans-serif', transition: 'color 0.2s', display: 'flex', alignItems: 'center', gap: '6px' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#111')}
            onMouseLeave={e => (e.currentTarget.style.color = '#9ca3af')}
          >
            <img src="/images/HomeImages/HandC-sm.webp" alt="" style={{ height: '14px', objectFit: 'contain', opacity: 0.5 }} />
            Back to lab
          </a>
        </div>
      </div>

      {/* Sliding track — two panels side by side, transitions on showLeaderboard */}
      <div style={{
        display: 'flex',
        width: '200%',
        height: '100%',
        transform: showLeaderboard ? 'translateX(-50%)' : 'translateX(0)',
        transition: 'transform 0.55s cubic-bezier(0.77, 0, 0.175, 1)',
        willChange: 'transform',
      }}>

        {/* Panel 1 — Game */}
        <div style={{ width: '50%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', gap: '16px' }}>

      {/* START — flat card, no flip */}
      {screen === 'start' && (
        <>
          <style>{GAME_CSS}</style>
          <div style={flatCard({ width: '100%', maxWidth: '560px', height: `${CARD_H}px` })}>
          <div style={{ ...cardInner(), background: 'black', overflow: 'hidden' }}>
            <div style={{ padding: '28px 32px', color: 'white', height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', position: 'relative' }}>
              <img
                src="/images/HomeImages/color-wheel.webp"
                alt=""
                className="color-wheel-spin"
                style={{ position: 'absolute', bottom: '-50px', right: '-50px', width: '200px', height: '200px', objectFit: 'contain', pointerEvents: 'none' }}
              />
              <div>
                <h1 style={{ fontFamily: 'SatishSans, sans-serif', fontSize: '40px', fontWeight: 700, lineHeight: 1, letterSpacing: '-1px', marginBottom: '16px' }}>Color</h1>
                <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.45)', lineHeight: 1.7, marginBottom: '8px' }}>
                  Humans can&rsquo;t reliably recall colors. This is a simple game to see how good (or bad) you are at it.
                </p>
                <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.45)', lineHeight: 1.7 }}>
                  You&rsquo;ll see five colors, then try to recreate them.
                </p>
                {best !== null && (
                  <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.32)', marginTop: '14px', letterSpacing: '0.04em' }}>
                    Your best <span style={{ color: 'rgba(255,255,255,0.8)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{best.toFixed(2)}</span>
                  </p>
                )}
              </div>
              <div>
                <button className="start-btn" onClick={startGame} style={{
                  width: 'calc(100% + 32px)', marginLeft: '-32px', padding: '13px 13px 13px 32px', borderRadius: '0 9999px 9999px 0', border: 'none',
                  background: `repeating-linear-gradient(88deg, transparent 0px, rgba(255,255,255,0.13) 1px, transparent 2px, transparent 5px), linear-gradient(160deg, #c4c4c4 0%, #f4f4f4 18%, #a8a8a8 34%, #ececec 50%, #b0b0b0 65%, #f2f2f2 80%, #c8c8c8 100%)`,
                  color: '#1a1a1a', fontFamily: 'FunnelDisplay, sans-serif', fontSize: '13px', fontWeight: 700,
                  cursor: 'pointer', letterSpacing: '0.04em',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.4), 0 1px 3px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.65)',
                  display: 'flex', alignItems: 'center', gap: '10px',
                }}>
                  <span>Start</span>
                  <span style={{ flex: 1 }} />
                  <span style={{ display: 'flex', alignItems: 'center', width: '110px' }}>
                    <span style={{ flex: 1, height: '1.5px', background: 'linear-gradient(to right, transparent, #1a1a1a)' }} />
                    <svg width="18" height="12" viewBox="0 0 18 12" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
                      <path d="M0 6 C3 6 5 4 9 1" stroke="#1a1a1a" strokeWidth="1.5" strokeLinecap="round" fill="none" />
                      <path d="M0 6 C3 6 5 8 9 11" stroke="#1a1a1a" strokeWidth="1.5" strokeLinecap="round" fill="none" />
                      <path d="M18 6 C15 6 13 4 9 1" stroke="#1a1a1a" strokeWidth="1.5" strokeLinecap="round" fill="none" />
                      <path d="M18 6 C15 6 13 8 9 11" stroke="#1a1a1a" strokeWidth="1.5" strokeLinecap="round" fill="none" />
                    </svg>
                  </span>
                </button>
              </div>
            </div>
          </div>
          </div>
        </>
      )}

      {/* GAME — flip card */}
      {screen === 'game' && (
        <>
          <style>{GAME_CSS}</style>
          <div style={{ perspective: '1200px', width: '100%', maxWidth: '560px' }}>
            <div style={{
              position: 'relative', width: '100%', height: `${CARD_H}px`,
              transformStyle: 'preserve-3d',
              transition: 'transform 0.65s cubic-bezier(0.4, 0.0, 0.2, 1)',
              transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
            }}>

              {/* FRONT: memorize or reveal */}
              <div style={cardFace()}>
              <div style={cardInner()}>
                {frontContent === 'memorize' && (
                  <div style={{ position: 'relative', width: '100%', height: '100%', backgroundColor: targetCss, padding: '22px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)' }}>{round + 1}/{TOTAL_ROUNDS}</span>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{
                          fontFamily: 'SatishSans, sans-serif', fontSize: '96px', fontWeight: 700, lineHeight: 1,
                          color: `rgba(255,255,255,${timer > 2 ? 0.88 : 0.5})`,
                          transition: 'color 0.4s',
                        }}>
                          {timer}
                        </div>
                        <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', marginTop: '4px' }}>Seconds to remember</p>
                      </div>
                    </div>
                    <div aria-hidden style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '3px', background: 'rgba(255,255,255,0.12)' }}>
                      <div key={round} className="cm-drain" style={{
                        height: '100%', background: 'rgba(255,255,255,0.7)', transformOrigin: 'left',
                        animation: `cm-drain ${MEMORIZE_SECONDS}s linear forwards`,
                      }} />
                    </div>
                    <button
                      onClick={() => { setFlipped(true); setStep('guess') }}
                      style={{ alignSelf: 'flex-end', background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.5)', fontSize: '11px', cursor: 'pointer', fontFamily: 'FunnelDisplay, sans-serif' }}
                    >
                      Go
                    </button>
                  </div>
                )}

                {frontContent === 'reveal' && lastRound && (
                  <div style={{ width: '100%', height: '100%', display: 'flex' }}>
                    {/* Left: original */}
                    <div style={{ flex: 1, backgroundColor: hsvToCss(lastRound.target.h, lastRound.target.s, lastRound.target.v), padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxSizing: 'border-box' }}>
                      <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>{round + 1}/{TOTAL_ROUNDS}</span>
                      <div>
                        <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', marginBottom: '3px' }}>Original</div>
                        <div style={{ fontSize: '11px', fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>H{lastRound.target.h} S{lastRound.target.s} B{lastRound.target.v}</div>
                      </div>
                    </div>
                    {/* Right: guess + score */}
                    <div style={{ flex: 1, backgroundColor: hsvToCss(lastRound.guess.h, lastRound.guess.s, lastRound.guess.v), padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxSizing: 'border-box' }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontFamily: 'SatishSans, sans-serif', fontSize: '64px', fontWeight: 700, lineHeight: 1, color: 'white' }}>
                          {displayScore.toFixed(2)}
                        </div>
                        <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>{scoreMessage(lastRound.score)}</div>
                        <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.2)', marginTop: '2px' }}>out of 10</div>
                        <div style={{
                          display: 'inline-block', marginTop: '12px', fontSize: '10.5px', color: 'rgba(255,255,255,0.85)',
                          background: 'rgba(0,0,0,0.22)', padding: '4px 9px', borderRadius: '999px',
                          animation: 'cm-rise 0.5s 1.6s ease both',
                        }}>
                          {missHint(lastRound.target, lastRound.guess)}
                        </div>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                        <div>
                          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', marginBottom: '3px' }}>Your selection</div>
                          <div style={{ fontSize: '11px', fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>H{lastRound.guess.h} S{lastRound.guess.s} B{lastRound.guess.v}</div>
                        </div>
                        <ArrowBtn onClick={nextRound} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
              </div>

              {/* BACK: guess sliders */}
              <div style={cardFace({ transform: 'rotateY(180deg)' })}>
              <div style={cardInner({ display: 'flex', background: '#111', flexDirection: 'row' })}>
                <div style={{ background: '#111', display: 'flex', flexDirection: 'column', padding: '14px', flexShrink: 0, boxSizing: 'border-box', height: '100%' }}>
                  <div style={{ display: 'flex', gap: '8px', flex: 1, minHeight: 0 }}>
                    <VerticalSlider label="Hue" wrap thumbColor={hsvToCss(guess.h, 100, 100)} value={guess.h} onChange={(h) => setGuess((g) => ({ ...g, h }))} background={hueGrad} min={0} max={359} />
                    <VerticalSlider label="Saturation" thumbColor={guessCss} value={guess.s} onChange={(s) => setGuess((g) => ({ ...g, s }))} background={satGrad} min={0} max={100} />
                    <VerticalSlider label="Brightness" thumbColor={guessCss} value={guess.v} onChange={(v) => setGuess((g) => ({ ...g, v }))} background={valGrad} min={0} max={100} />
                  </div>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '7px' }}>
                    {['Hue', 'Sat', 'Bri'].map((l) => (
                      <div key={l} style={{ width: '40px', textAlign: 'center', fontSize: '7px', color: 'rgba(255,255,255,0.28)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>{l}</div>
                    ))}
                  </div>
                </div>
                <div style={{ flex: 1, backgroundColor: guessCss, padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxSizing: 'border-box', borderRadius: `${INNER_R}px 0 0 ${INNER_R}px` }}>
                  <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)' }}>{round + 1}/{TOTAL_ROUNDS}</span>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                    <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)' }}>H{guess.h} S{guess.s} B{guess.v}</div>
                    <ArrowBtn onClick={submitGuess} />
                  </div>
                </div>
              </div>
              </div>

            </div>
          </div>

        </>
      )}

      {/* FINAL */}
      {screen === 'final' && (
        <>
        <div style={flatCard({ width: '100%', maxWidth: '560px' })}>
        <style>{GAME_CSS}</style>
        <div style={{ ...cardInner(), background: 'black', padding: '28px', color: 'white', overflowY: 'auto', maxHeight: '80vh' }}>

          <div style={{ fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)', marginBottom: '8px' }}>Final Score</div>
              <div style={{ fontFamily: 'SatishSans, sans-serif', fontSize: '72px', fontWeight: 700, lineHeight: 1, marginBottom: '4px' }}>{avgScore.toFixed(2)}</div>
              <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.35)', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                {scoreMessage(avgScore)}
                {newBest && (
                  <span style={{ fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#111', background: 'linear-gradient(160deg, #f4f4f4, #b0b0b0)', padding: '3px 8px', borderRadius: '999px', fontWeight: 700, animation: 'cm-rise 0.5s 0.3s ease both' }}>
                    New personal best
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
                {rounds.map((r, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '18px', height: '18px', borderRadius: '50%', backgroundColor: hsvToCss(r.target.h, r.target.s, r.target.v), flexShrink: 0 }} />
                    <div style={{ width: '18px', height: '18px', borderRadius: '50%', backgroundColor: hsvToCss(r.guess.h, r.guess.s, r.guess.v), flexShrink: 0 }} />
                    <div style={{ flex: 1, fontSize: '11px', color: 'rgba(255,255,255,0.25)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      Round {i + 1} <span style={{ color: 'rgba(255,255,255,0.18)' }}>· {missHint(r.target, r.guess)}</span>
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{r.score.toFixed(2)}</div>
                  </div>
                ))}
              </div>

              {!submitted ? (
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)', marginBottom: '8px' }}>Add to leaderboard</div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      placeholder="Your name"
                      maxLength={32}
                      value={playerName}
                      onChange={(e) => setPlayerName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && submitScore()}
                      style={{
                        flex: 1, padding: '10px 12px', background: 'rgba(255,255,255,0.07)',
                        border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px',
                        color: 'white', fontSize: '13px', fontFamily: 'FunnelDisplay, sans-serif', outline: 'none',
                      }}
                    />
                    <button onClick={submitScore} disabled={submitting || !playerName.trim()} style={{
                      padding: '10px 16px', borderRadius: '8px', border: 'none',
                      background: playerName.trim() ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.15)',
                      color: playerName.trim() ? '#111' : 'rgba(255,255,255,0.3)',
                      fontSize: '12px', fontWeight: 700, cursor: playerName.trim() ? 'pointer' : 'default',
                      fontFamily: 'FunnelDisplay, sans-serif', transition: 'all 0.2s',
                    }}>
                      {submitting ? '...' : 'Submit'}
                    </button>
                  </div>
                  {submitError && (
                    <div style={{ fontSize: '11px', color: '#ff8a8a', marginTop: '8px' }}>
                      Couldn&rsquo;t save your score. Please try again.
                    </div>
                  )}
                </div>
              ) : null}

              <button className="start-btn" onClick={startGame} style={{
                width: '100%', padding: '12px', borderRadius: '9999px', border: 'none',
                background: `repeating-linear-gradient(88deg, transparent 0px, rgba(255,255,255,0.13) 1px, transparent 2px, transparent 5px), linear-gradient(160deg, #c4c4c4 0%, #f4f4f4 18%, #a8a8a8 34%, #ececec 50%, #b0b0b0 65%, #f2f2f2 80%, #c8c8c8 100%)`,
                color: '#1a1a1a', fontFamily: 'FunnelDisplay, sans-serif', fontSize: '13px', fontWeight: 700,
                cursor: 'pointer', letterSpacing: '0.04em',
                boxShadow: '0 4px 16px rgba(0,0,0,0.4), 0 1px 3px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.65)',
              }}>
                Play again
              </button>
              <button onClick={shareResult} style={{
                width: '100%', marginTop: '10px', padding: '11px', borderRadius: '9999px',
                border: '1px solid rgba(255,255,255,0.14)', background: 'transparent',
                color: 'rgba(255,255,255,0.75)', fontFamily: 'FunnelDisplay, sans-serif', fontSize: '12px',
                fontWeight: 600, cursor: 'pointer', letterSpacing: '0.04em',
              }}>
                {shareNote || 'Share my colors'}
              </button>

        </div>
        </div>
        </>
      )}

        </div>{/* end Panel 1 */}

        {/* Panel 2 — Leaderboard */}
        <div style={{ width: '50%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div style={{ width: '100%', maxWidth: '400px' }}>

            {/* Header */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontFamily: 'SatishSans, sans-serif', fontSize: '24px', fontWeight: 300, color: '#111' }}>
                <span style={{ whiteSpace: 'nowrap' }}>Top 10</span>
                <span style={{ flex: 1, height: '1px', background: '#111' }} />
                <span style={{ whiteSpace: 'nowrap' }}>Scores</span>
              </div>
              {leaderboardOffline && leaderboard.length === 0 && (
                <div style={{ marginTop: '10px', fontSize: '12px', color: '#6b7280', fontFamily: 'FunnelDisplay, sans-serif' }}>
                  The scoreboard is offline right now. Scores will show here once it is back.
                </div>
              )}
            </div>

            {/* Always 10 rows */}
            {(
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {Array.from({ length: 10 }).map((_, i) => {
                  const entry = leaderboard[i]
                  const mine = submitted && !!entry && entry.name === playerName.trim() && Math.abs(Number(entry.avg_score) - avgScore) < 0.006
                  return (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: '12px',
                      padding: '11px 14px',
                      borderBottom: '1px solid #f3f4f6',
                      background: mine ? 'rgba(255,214,120,0.28)' : 'transparent',
                      borderRadius: mine ? '8px' : 0,
                    }}>
                      <div style={{ width: '22px', fontSize: '12px', color: i === 0 && entry ? '#111' : '#9ca3af', fontWeight: i === 0 && entry ? 700 : 400, flexShrink: 0, textAlign: 'center' }}>{i + 1}</div>
                      {entry?.country ? <img src={`https://flagsapi.com/${entry.country.toUpperCase()}/flat/24.png`} alt={entry.country} style={{ width: '24px', height: '16px', objectFit: 'cover', borderRadius: '2px', flexShrink: 0 }} /> : <span style={{ width: '24px', display: 'inline-block' }} />}
                      <div style={{ flex: 1, fontSize: '13px', color: i === 0 && entry ? '#111' : '#374151', fontWeight: i === 0 && entry ? 600 : 400 }}>{entry?.name ?? ''}</div>
                      <div style={{ fontSize: '14px', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: i === 0 && entry ? '#111' : '#6b7280' }}>{entry ? Number(entry.avg_score).toFixed(2) : ''}</div>
                    </div>
                  )
                })}
              </div>
            )}

          </div>
        </div>{/* end Panel 2 */}

      </div>{/* end sliding track */}
    </div>
  )
}
