'use client'

// The tape deck: one pill that takes a search, a pasted link, or a tap on a
// cassette from the shelf. Opens upward from the bottom of the stage.
//
//   - empty: the shelf (hand-picked tapes) + the last few tapes you played
//   - a YouTube link: one row, "play this link"
//   - anything else: live search results (debounced), arrow keys + enter
//
// "/" focuses it from anywhere; Esc closes it.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

const PHOSPHOR = '#7dff8a' // the green the Walkman's screens glow

export interface Tape { id: string; title: string; author: string; duration?: string }

interface Shelf extends Tape { body: string; label: string; stripe: string }

// every one of these is checked embeddable (oEmbed 200), so the shelf never
// hands you a tape that refuses to play
const SHELF: Shelf[] = [
  { id: 'djV11Xbc914', title: 'Take On Me', author: 'a-ha', body: '#d9d4c7', label: '#f4efe2', stripe: '#2f6fd6' },
  { id: 'FTQbiNvZqaY', title: 'Africa', author: 'Toto', body: '#2a2622', label: '#efe2c4', stripe: '#e07a2e' },
  { id: 'Zi_XLOBDo_Y', title: 'Billie Jean', author: 'Michael Jackson', body: '#1d1d1f', label: '#f2f2f2', stripe: '#d8283a' },
  { id: 'aGCdLKXNF3w', title: 'Everybody Wants to Rule the World', author: 'Tears for Fears', body: '#c9d6d2', label: '#fbf7ee', stripe: '#1f8a70' },
  { id: 'wp43OdtAAkM', title: 'Running Up That Hill', author: 'Kate Bush', body: '#3a2d4a', label: '#ece4f4', stripe: '#9b6ad6' },
  { id: 'AU-hut9lGQ4', title: 'Ajib Dastan Hai Yeh', author: 'Lata Mangeshkar', body: '#7a2f22', label: '#f6e7cf', stripe: '#d9a441' },
  { id: '4NRXx6U8ABQ', title: 'Blinding Lights', author: 'The Weeknd', body: '#151515', label: '#ffe9ea', stripe: '#ff2e4d' },
  { id: '5NV6Rdv1a3I', title: 'Get Lucky', author: 'Daft Punk', body: '#b9a27a', label: '#fff6e0', stripe: '#1b1b1b' },
  { id: 'jfKfPfyJRdk', title: 'lofi hip hop radio', author: 'Lofi Girl', body: '#e9d9ef', label: '#fffaf2', stripe: '#6a5acd', duration: 'LIVE' },
]

const RECENT_KEY = 'walkman:recent'
const RECENT_MAX = 6

export function loadRecent(): Tape[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY)
    const list = raw ? (JSON.parse(raw) as Tape[]) : []
    return Array.isArray(list) ? list.filter((t) => t && typeof t.id === 'string').slice(0, RECENT_MAX) : []
  } catch { return [] }
}

// remember a tape once it actually starts playing
export function rememberTape(t: Tape) {
  try {
    const next = [t, ...loadRecent().filter((r) => r.id !== t.id)].slice(0, RECENT_MAX)
    localStorage.setItem(RECENT_KEY, JSON.stringify(next))
  } catch { /* storage blocked: recents are a nicety */ }
}

export function extractVideoId(url: string): string | null {
  const match = url.match(
    /(?:youtube\.com\/watch\?(?:.*&)?v=|youtu\.be\/|music\.youtube\.com\/watch\?(?:.*&)?v=|youtube\.com\/embed\/|youtube\.com\/shorts\/|youtube\.com\/live\/)([A-Za-z0-9_-]{11})/
  )
  return match ? match[1] : null
}

// a stable tape colourway for tapes that aren't on the shelf
const PALETTE: [string, string, string][] = [
  ['#d9d4c7', '#f4efe2', '#2f6fd6'], ['#2a2622', '#efe2c4', '#e07a2e'], ['#c9d6d2', '#fbf7ee', '#1f8a70'],
  ['#3a2d4a', '#ece4f4', '#9b6ad6'], ['#151515', '#ffe9ea', '#ff2e4d'], ['#b9a27a', '#fff6e0', '#1b1b1b'],
]
const colourway = (id: string) => {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0
  const [body, label, stripe] = PALETTE[Math.abs(h) % PALETTE.length]
  return { body, label, stripe }
}

// ─── cassette drawing ────────────────────────────────────────────────────────

function Cassette({ body, label, stripe, spinning, title }: { body: string; label: string; stripe: string; spinning: boolean; title: string }) {
  const reel = (cx: number) => (
    <g className={spinning ? 'td-reel td-spin' : 'td-reel'} style={{ transformOrigin: `${cx}px 31px` }}>
      <circle cx={cx} cy={31} r={6.2} fill="#f6f3ec" stroke="rgba(0,0,0,0.35)" strokeWidth={0.8} />
      {[0, 60, 120, 180, 240, 300].map((a) => (
        <rect key={a} x={cx - 0.7} y={31 - 5.6} width={1.4} height={2.4} rx={0.5} fill="rgba(0,0,0,0.55)" transform={`rotate(${a} ${cx} 31)`} />
      ))}
      <circle cx={cx} cy={31} r={1.6} fill="rgba(0,0,0,0.6)" />
    </g>
  )
  return (
    <svg viewBox="0 0 88 56" width="100%" style={{ display: 'block' }} aria-hidden>
      <rect x={0.5} y={0.5} width={87} height={55} rx={5} fill={body} stroke="rgba(0,0,0,0.25)" />
      {/* screws */}
      {[[5, 5], [83, 5], [5, 51], [83, 51]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r={1.3} fill="rgba(0,0,0,0.3)" />)}
      {/* label */}
      <rect x={7} y={6} width={74} height={34} rx={2.5} fill={label} />
      <rect x={7} y={6} width={74} height={6} rx={2.5} fill={stripe} />
      <rect x={7} y={10} width={74} height={2} fill={stripe} />
      <text x={11} y={20.5} fontSize={5.4} fontFamily="FunnelDisplay, system-ui, sans-serif" fontWeight={600} fill="rgba(0,0,0,0.72)">
        {title.length > 24 ? title.slice(0, 23) + '…' : title}
      </text>
      {/* tape window */}
      <rect x={20} y={24} width={48} height={14} rx={7} fill="rgba(20,16,12,0.82)" />
      <rect x={34} y={27} width={20} height={8} rx={1} fill="rgba(90,60,40,0.55)" />
      {reel(28)}
      {reel(60)}
      {/* bottom trapezoid */}
      <path d="M22 55 L26 44 H62 L66 55" fill="rgba(0,0,0,0.14)" />
      <circle cx={34} cy={50} r={1.6} fill="rgba(0,0,0,0.35)" />
      <circle cx={54} cy={50} r={1.6} fill="rgba(0,0,0,0.35)" />
    </svg>
  )
}

// ─── deck ────────────────────────────────────────────────────────────────────

interface Props {
  darkBg: boolean
  isMobile: boolean
  currentId: string | null
  playing: boolean
  onPick: (tape: Tape) => void
  // bumped by the page to open the deck (e.g. the Walkman's paste button on mobile,
  // or plain text pasted onto the page), optionally pre-filled with a query
  openSignal?: { n: number; query?: string }
  // full screen: rest folded into a small pill (search + slash), unfold to use
  compact?: boolean
  onOpenChange?: (open: boolean) => void
}

export default function TapeDeck({ darkBg, isMobile, currentId, playing, onPick, openSignal, compact = false, onOpenChange }: Props) {
  const [open, setOpen] = useState(false)
  useEffect(() => { onOpenChange?.(open) }, [open, onOpenChange])
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Tape[]>([])
  const [searching, setSearching] = useState(false)
  const [failed, setFailed] = useState(false)
  const [active, setActive] = useState(0)
  const [recent, setRecent] = useState<Tape[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  const linkId = useMemo(() => extractVideoId(query.trim()), [query])
  const searchTerm = !linkId && query.trim().length >= 2 ? query.trim() : ''

  const openDeck = useCallback((q?: string) => {
    setRecent(loadRecent())
    if (q !== undefined) setQuery(q)
    setOpen(true)
    requestAnimationFrame(() => inputRef.current?.focus())
  }, [])

  const close = useCallback(() => {
    setOpen(false)
    inputRef.current?.blur()
  }, [])

  // external open requests
  useEffect(() => {
    if (openSignal && openSignal.n > 0) openDeck(openSignal.query)
  }, [openSignal, openDeck])

  // "/" from anywhere focuses the deck
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      if (e.key === '/') { e.preventDefault(); openDeck() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openDeck])

  // click outside closes
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('pointerdown', onDown)
    return () => window.removeEventListener('pointerdown', onDown)
  }, [open])

  // debounced search; stale responses are dropped
  useEffect(() => {
    if (!searchTerm) { setResults([]); setSearching(false); setFailed(false); return }
    setSearching(true)
    const ctrl = new AbortController()
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/yt-search?q=${encodeURIComponent(searchTerm)}`, { signal: ctrl.signal })
        const data = await res.json()
        setResults(Array.isArray(data.results) ? data.results : [])
        setFailed(!res.ok)
        setActive(0)
      } catch (e) {
        if ((e as Error).name !== 'AbortError') { setResults([]); setFailed(true) }
      } finally {
        if (!ctrl.signal.aborted) setSearching(false)
      }
    }, 320)
    return () => { clearTimeout(t); ctrl.abort() }
  }, [searchTerm])

  const pick = useCallback((t: Tape) => {
    onPick(t)
    setQuery('')
    setResults([])
    close()
  }, [onPick, close])

  // rows the keyboard walks through, in display order
  const rows: Tape[] = linkId
    ? [{ id: linkId, title: 'Play this link', author: query.trim() }]
    : searchTerm ? results : [...recent, ...SHELF.filter((s) => !recent.some((r) => r.id === s.id))]

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') { e.preventDefault(); if (query) setQuery(''); else close(); return }
    if (!rows.length) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => (a + 1) % rows.length) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => (a - 1 + rows.length) % rows.length) }
    else if (e.key === 'Enter') { e.preventDefault(); pick(rows[Math.min(active, rows.length - 1)]) }
  }
  useEffect(() => { setActive(0) }, [linkId, searchTerm, open])

  // ── tokens: the console's hardware palette (aluminium by day, slate by night) ──
  const ink = darkBg ? '#d7dbe8' : '#3f3f3f'
  const sub = darkBg ? '#6a6e80' : '#8a8a8a'
  const faint = darkBg ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)'
  const well = darkBg
    ? { background: 'linear-gradient(160deg, #252530, #1e1e28)', boxShadow: 'inset 2px 2px 8px #0d0d18, inset -1px -1px 4px #31313e', border: '1px solid #16161f' }
    : { background: 'linear-gradient(160deg, #c8c8c8, #dadada)', boxShadow: 'inset 2px 2px 8px #a8a8a8, inset -1px -1px 4px #ececec', border: '1px solid #a8a8a8' }
  // phones: the pill sits bottom-left, leaving the corner to the tape module (136px + gutters)
  const width = isMobile ? 'calc(100vw - 168px)' : 'min(90vw, 460px)'
  // the search bar wears the console's hardware: aluminium (or slate) bezel,
  // a grey rim, soft raised keys
  const hw = darkBg
    ? {
        body: 'linear-gradient(160deg, #3d3d4a 0%, #2c2c34 40%, #252528 70%, #303038 100%)', rim: '#1c1c26',
        shadow: '0 12px 28px rgba(0,0,0,0.55), inset 0 1px 0 rgba(120,140,200,0.18)',
        key: { width: 32, height: 32, flexShrink: 0, borderRadius: 16, border: '1px solid #1b1b26', background: 'linear-gradient(145deg, #393944, #2b2b36)', boxShadow: '3px 3px 6px #11111a, -2px -2px 5px #373742', color: '#8890a8', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 } as React.CSSProperties,
      }
    : {
        body: 'linear-gradient(160deg, #e8e8e8 0%, #d4d4d4 40%, #c8c8c8 70%, #d8d8d8 100%)', rim: '#a0a0a0',
        shadow: '0 12px 28px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.6)',
        key: { width: 32, height: 32, flexShrink: 0, borderRadius: 16, border: '1px solid #b0b0b0', background: 'linear-gradient(145deg, #e8e8e8, #c8c8c8)', boxShadow: '3px 3px 6px #b0b0b0, -2px -2px 5px #f4f4f4', color: '#555', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 } as React.CSSProperties,
      }

  const shelfRows = !linkId && !searchTerm
  // folded: only in compact mode, and only while nobody is using it
  const folded = compact && !open && !query
  const RELAX = 'cubic-bezier(0.32, 0.72, 0, 1)' // slow, settling ease for the fold
  const recentIds = new Set(recent.map((r) => r.id))

  return (
    <div ref={rootRef} style={{ position: 'relative', width: folded ? 88 : width, zIndex: 30, transition: `width 0.7s ${RELAX}` }}>
      <style>{`
        @keyframes tdSpin { to { transform: rotate(360deg) } }
        @keyframes tdUp { from { opacity: 0; transform: translateY(10px) scale(0.985) } to { opacity: 1; transform: none } }
        .td-reel { transition: transform 0.6s ease; }
        .td-spin { animation: tdSpin 1.6s linear infinite; }
        /* a tape in its sleeve: the cover sits in front, the cassette half tucked
           behind it; hover (or keyboard focus, or playing) slides it out */
        .td-card { --out: 0; }
        .td-card:hover, .td-card[data-active="true"], .td-card[data-current="true"] { --out: 1; }
        .td-cas { transform: translateX(calc(-14% + var(--out) * 20%)) rotate(calc(var(--out) * 4deg)); transition: transform 0.45s cubic-bezier(0.34, 1.4, 0.64, 1); }
        .td-sleeve { transform: translateX(calc(var(--out) * -3px)) rotate(calc(var(--out) * -2deg)); transition: transform 0.45s cubic-bezier(0.34, 1.4, 0.64, 1); }
        .td-card:hover .td-reel, .td-card[data-active="true"] .td-reel { animation: tdSpin 1.6s linear infinite; }
        .td-scroll::-webkit-scrollbar { width: 6px } .td-scroll::-webkit-scrollbar-thumb { background: ${faint}; border-radius: 3px }
        .td-input::placeholder { color: rgba(125, 255, 138, 0.4); text-shadow: none; font-weight: 400; }
        @media (prefers-reduced-motion: reduce) { .td-spin, .td-card .td-reel { animation: none !important } .td-cas, .td-sleeve { transition: none } }
      `}</style>

      {open && (
        <div
          style={{
            // phones: the shelf spans the screen above the (tucked) tape module
            ...(isMobile
              ? { position: 'fixed', left: 12, right: 12, bottom: 112 }
              : { position: 'absolute', bottom: 'calc(100% + 10px)', left: `calc(50% - ${width} / 2)`, width }),
            padding: 6, borderRadius: 22, background: hw.body, border: `1px solid ${hw.rim}`, boxShadow: hw.shadow,
            animation: 'tdUp 0.32s cubic-bezier(.16,1,.3,1)',
          }}
        >
          <div
            role="listbox"
            aria-label={shelfRows ? 'Tapes' : 'Search results'}
            className="td-scroll"
            // the shelf scrolls by itself: wheel and touch never carry on to the page behind it
            onWheel={(e) => e.stopPropagation()}
            style={{
              ...well,
              maxHeight: isMobile ? 'calc(100dvh - 112px - 96px)' : 'min(60vh, 480px)', overflowY: 'auto', overscrollBehavior: 'contain',
              scrollbarWidth: 'thin', borderRadius: 16, padding: '12px 12px 4px',
            }}
          >
            {shelfRows && (
              <>
                {recent.length > 0 && (
                  <>
                    <SectionLabel color={sub}>Recently played</SectionLabel>
                    <TapeGrid tapes={recent.map((r) => ({ ...r, ...colourway(r.id) }))} offset={0} active={active}
                      currentId={currentId} playing={playing} onPick={pick} ink={ink} sub={sub} isMobile={isMobile} onHover={setActive} />
                  </>
                )}
                <SectionLabel color={sub}>On the shelf</SectionLabel>
                <TapeGrid tapes={SHELF.filter((x) => !recentIds.has(x.id))} offset={recent.length} active={active}
                  currentId={currentId} playing={playing} onPick={pick} ink={ink} sub={sub} isMobile={isMobile} onHover={setActive} />
              </>
            )}

            {!shelfRows && (
              <>
                {searching && rows.length === 0 && <Note color={sub}>Rewinding the tape<Dots /></Note>}
                {!searching && searchTerm && rows.length === 0 && (
                  <Note color={sub}>{failed ? 'Search is offline right now. Paste a YouTube link instead.' : 'Nothing on that tape. Try another search.'}</Note>
                )}
                {rows.length > 0 && (
                  <>
                    <SectionLabel color={sub}>{linkId ? 'From your link' : 'Found'}</SectionLabel>
                    <TapeGrid tapes={rows.map((r) => ({ ...r, ...colourway(r.id) }))} offset={0} active={active}
                      currentId={currentId} playing={playing} onPick={pick} ink={ink} sub={sub} isMobile={isMobile} onHover={setActive} />
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* the pill: an aluminium bezel around a phosphor screen, like the console */}
      <label
        style={{
          display: 'flex', alignItems: 'center', gap: 6, height: 46, padding: 5,
          background: hw.body, border: `1px solid ${hw.rim}`, borderRadius: 23, cursor: 'text',
          boxShadow: hw.shadow, transition: 'background 0.65s ease',
        }}
      >
        <span style={{
          flex: 1, minWidth: 0, height: '100%', display: 'flex', alignItems: 'center', gap: folded ? 0 : 9,
          padding: folded ? '0 0 0 11px' : '0 14px', borderRadius: 18, position: 'relative', overflow: 'hidden',
          background: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.3) 0 1px, transparent 1px 2px), radial-gradient(ellipse at 50% 40%, #0f2416, #050a07 80%)',
          boxShadow: `inset 0 0 0 2px #111, inset 0 2px 8px rgba(0,0,0,0.9)${open ? ', inset 0 0 14px rgba(62,255,82,0.12)' : ''}`,
          transition: `box-shadow 0.25s ease, padding 0.7s ${RELAX}, gap 0.7s ${RELAX}`,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={PHOSPHOR} strokeWidth="2.4" strokeLinecap="round" aria-hidden
            style={{ flexShrink: 0, opacity: open ? 1 : 0.6, filter: open ? `drop-shadow(0 0 3px ${PHOSPHOR})` : 'none' }}>
            <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
          </svg>
          <input
            ref={inputRef}
            className="td-input"
            value={query}
            onChange={(e) => { setQuery(e.target.value); if (!open) openDeck() }}
            onFocus={() => { if (!open) openDeck() }}
            onKeyDown={onKeyDown}
            placeholder={isMobile ? 'search or paste a link' : 'search a song, or paste a youtube link'}
            aria-label="Search a song or paste a YouTube link"
            spellCheck={false}
            autoComplete="off"
            enterKeyHint="go"
            style={{
              flex: 1, minWidth: 0, height: '100%', border: 'none', outline: 'none', background: 'transparent',
              color: PHOSPHOR, caretColor: PHOSPHOR, textShadow: '0 0 4px rgba(62,255,82,0.55)',
              fontFamily: 'FunnelDisplay, system-ui, sans-serif', fontSize: isMobile ? 16 : 13.5, fontWeight: 500, letterSpacing: '0.01em',
              // folded: the field is still there (click or "/" focuses it), just not shown
              opacity: folded ? 0 : 1, transition: folded ? 'opacity 0.18s ease' : 'opacity 0.35s ease 0.25s',
            }}
          />
          {/* glass sheen over the screen */}
          <span aria-hidden style={{ position: 'absolute', inset: 0, borderRadius: 'inherit', pointerEvents: 'none', background: 'linear-gradient(170deg, rgba(255,255,255,0.08), transparent 45%)' }} />
        </span>
        {query ? (
          <button onClick={() => { setQuery(''); inputRef.current?.focus() }} aria-label="Clear" title="Clear"
            style={{ ...hw.key, fontSize: 11 }}>
            ✕
          </button>
        ) : (
          <span aria-hidden title="Press / to search" style={{ ...hw.key, cursor: 'default', fontFamily: 'FunnelDisplay, system-ui, sans-serif', fontSize: 13, fontWeight: 500 }}>/</span>
        )}
      </label>
    </div>
  )
}

function SectionLabel({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <div style={{ fontFamily: 'UniversNext, FunnelDisplay, system-ui, sans-serif', fontSize: 9, letterSpacing: '0.16em', textTransform: 'uppercase', color, margin: '2px 2px 10px' }}>
      {children}
    </div>
  )
}

function Note({ children, color }: { children: React.ReactNode; color: string }) {
  return <div style={{ fontFamily: 'FunnelDisplay, system-ui, sans-serif', fontSize: 12, color, padding: '14px 6px 18px' }}>{children}</div>
}

function Dots() {
  const [n, setN] = useState(0)
  useEffect(() => { const id = setInterval(() => setN((x) => (x + 1) % 4), 320); return () => clearInterval(id) }, [])
  return <span>{'.'.repeat(n).padEnd(3, ' ')}</span>
}

function TapeGrid({ tapes, offset, active, currentId, playing, onPick, ink, sub, isMobile, onHover }: {
  tapes: (Tape & { body: string; label: string; stripe: string })[]
  offset: number; active: number; currentId: string | null; playing: boolean
  onPick: (t: Tape) => void; ink: string; sub: string; isMobile: boolean; onHover: (i: number) => void
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: isMobile ? '14px 10px' : '16px 12px', marginBottom: 16 }}>
      {tapes.map((t, i) => {
        const idx = offset + i
        const isCurrent = t.id === currentId
        return (
          <button
            key={t.id + idx}
            role="option"
            aria-selected={idx === active}
            aria-label={`${t.title} by ${t.author}`}
            className="td-card"
            data-active={idx === active}
            data-current={isCurrent}
            onMouseEnter={() => onHover(idx)}
            onClick={() => onPick(t)}
            style={{ border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', textAlign: 'left', minWidth: 0 }}
          >
            {/* the art: cassette tucked behind its cover */}
            <div style={{ position: 'relative', width: '100%', aspectRatio: '1.8', marginBottom: 8 }}>
              <div className="td-cas" style={{ position: 'absolute', right: 0, top: '50%', width: '74%', marginTop: '-23.25%', filter: 'drop-shadow(0 3px 5px rgba(0,0,0,0.3))' }}>
                <Cassette body={t.body} label={t.label} stripe={t.stripe} title={t.title} spinning={isCurrent && playing} />
              </div>
              <div className="td-sleeve" style={{
                position: 'absolute', left: 0, top: 0, height: '100%', aspectRatio: '1', borderRadius: 6, overflow: 'hidden',
                background: '#111', boxShadow: '0 6px 12px -4px rgba(0,0,0,0.5), 0 2px 3px rgba(0,0,0,0.3), inset 0 0 0 1px rgba(255,255,255,0.08)',
              }}>
                <img src={`https://i.ytimg.com/vi/${t.id}/mqdefault.jpg`} alt="" loading="lazy" draggable={false}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                {/* gloss + a spine shadow on the right, where the cassette slides out */}
                <span aria-hidden style={{ position: 'absolute', inset: 0, background: 'linear-gradient(140deg, rgba(255,255,255,0.22), transparent 42%), linear-gradient(to left, rgba(0,0,0,0.35), transparent 18%)' }} />
                {isCurrent && (
                  <span aria-hidden style={{ position: 'absolute', top: 5, left: 5, width: 5, height: 5, borderRadius: '50%', background: '#3eff52', boxShadow: '0 0 5px rgba(62,255,82,0.8)' }} />
                )}
              </div>
            </div>
            <div style={{ fontFamily: 'FunnelDisplay, system-ui, sans-serif', fontSize: 12, fontWeight: 600, color: ink, lineHeight: 1.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {t.title}
            </div>
            <div style={{ fontFamily: 'UniversNext, FunnelDisplay, system-ui, sans-serif', fontSize: 9, color: sub, letterSpacing: '0.08em', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textTransform: 'uppercase' }}>
              {t.author}{t.duration ? ` · ${t.duration}` : ''}
            </div>
          </button>
        )
      })}
    </div>
  )
}
