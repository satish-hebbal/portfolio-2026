'use client'

import { useEffect, useRef, useState, useCallback, useMemo, Suspense } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, useGLTF, Environment, useProgress, Html, PerformanceMonitor } from '@react-three/drei'
import * as THREE from 'three'
import Link from 'next/link'
import TapeDeck, { extractVideoId, rememberTape, type Tape } from './TapeDeck'
import VisualizerBG from './visualizer/VisualizerBG'
import Console from './console/Console'
import { AudioSignal, type TrackStatus } from './visualizer/audioSignal'
import { DEFAULT_SETTINGS, albumBackground, loadSettings, loadTheme, resolvePalette, saveSettings, saveTheme, type ThemeMode, type VizSettings } from './visualizer/vizConfig'

declare global {
  interface Window {
    YT: any
    onYouTubeIframeAPIReady: () => void
    ytPlayer: any
  }
}

// the LCD font is ASCII-only: keep what it can draw, uppercase, trimmed. If a
// title is mostly another script, fall back to the artist, then to "NOW PLAYING".
function lcdText(title: string, author: string): string {
  const clean = (s: string) => s
    .replace(/\(official[^)]*\)|\[official[^\]]*\]|official (music )?video|\(lyrics?\)|\[4k\]|\bhd\b/gi, '')
    .replace(/[^\x20-\x7e]/g, '').replace(/\s+/g, ' ').trim().toUpperCase()
  const t = clean(title)
  const a = clean(author).replace(/VEVO$/, '').trim()
  if (t.length >= 3) return a && !t.includes(a) ? `${t} - ${a}` : t
  return a.length >= 3 ? a : 'NOW PLAYING'
}

// ─── cursor label ─────────────────────────────────────────────────────────────
// Hovering a control on the Walkman shows what it'll do in a small tag that
// rides along with the pointer (not pinned to the model).
type HoverControl = 'paste' | 'mute' | 'forward' | 'rewind' | 'play' | 'stop' | 'volume'

function CursorLabel({ control, playing, muted, darkBg }: { control: HoverControl | null; playing: boolean; muted: boolean; darkBg: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const last = useRef<string>('')
  useEffect(() => {
    // Stick to the pointer with as little delay as the browser allows:
    // pointerrawupdate fires ahead of the frame's regular pointermove
    // (Chromium), and the newest coalesced sample is the freshest position.
    // The bubble's square corner sits just off the cursor's tip.
    const move = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || !ref.current) return
      const pts = e.getCoalescedEvents?.()
      const at = pts && pts.length ? pts[pts.length - 1] : e
      ref.current.style.transform = `translate3d(${at.clientX + 12}px, ${at.clientY + 16}px, 0)`
    }
    const evt = 'onpointerrawupdate' in window ? 'pointerrawupdate' : 'pointermove'
    window.addEventListener(evt, move as EventListener, { passive: true })
    return () => window.removeEventListener(evt, move as EventListener)
  }, [])
  const text = control === 'play' ? (playing ? 'Pause' : 'Play')
    : control === 'mute' ? (muted ? 'Unmute' : 'Mute')
    : control === 'forward' ? 'Skip 10 seconds'
    : control === 'rewind' ? 'Back 10 seconds'
    : control === 'stop' ? 'Stop'
    : control === 'paste' ? 'Paste a link'
    : control === 'volume' ? 'Drag for volume'
    : ''
  if (text) last.current = text // keep the last words while it fades out
  return (
    <div ref={ref} aria-hidden style={{ position: 'fixed', left: 0, top: 0, zIndex: 10020, pointerEvents: 'none', willChange: 'transform', contain: 'layout style' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        // a message bubble: the square corner points back at the cursor
        padding: '6px 11px 6px 9px', borderRadius: '3px 12px 12px 12px',
        fontFamily: 'FunnelDisplay, system-ui, sans-serif', fontSize: 12, fontWeight: 500, letterSpacing: '0.01em', lineHeight: 1.1,
        color: darkBg ? 'rgba(255,255,255,0.94)' : 'rgba(0,0,0,0.84)',
        // near-solid: a backdrop blur would have to be recomputed on every move
        background: darkBg ? 'rgba(22,22,26,0.96)' : 'rgba(255,255,255,0.97)',
        border: `1px solid ${darkBg ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)'}`,
        boxShadow: '0 4px 14px rgba(0,0,0,0.18)',
        whiteSpace: 'nowrap',
        opacity: control ? 1 : 0, transform: control ? 'scale(1)' : 'scale(0.9)', transformOrigin: 'top left',
        transition: 'opacity 0.14s ease, transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1)',
      }}>
        <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#3eff52', boxShadow: '0 0 5px rgba(62,255,82,0.7)' }} />
        {text || last.current}
      </div>
    </div>
  )
}

// ─── cassette window ─────────────────────────────────────────────────────────
// The smoked window in the lid is a dark patch of the shared texture atlas, on
// the lid mesh only (other meshes reuse that patch of the atlas, so the effect
// is applied to the lid's own copy of the material). Within that patch the
// shader lays the current album cover in, darkened and softly blurred, like a
// cassette label seen through tinted plastic. u runs along the window, v up it.
const WINDOW_UV = new THREE.Vector4(0.0, 0.5083, 0.2603, 0.6162) // u0, v0, u1, v1
const WINDOW_ASPECT = 2.42 // the patch's width / height in texels (texel density is uniform)

function addCassetteWindow(mat: THREE.MeshStandardMaterial) {
  const uniforms = {
    uAlbum: { value: null as THREE.Texture | null },
    uAlbumMix: { value: 0 },
    uAlbumAspect: { value: 16 / 9 },
    uWindowUv: { value: WINDOW_UV },
    uWindowAspect: { value: WINDOW_ASPECT },
  }
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
uniform sampler2D uAlbum;
uniform float uAlbumMix;
uniform float uAlbumAspect;
uniform vec4 uWindowUv;
uniform float uWindowAspect;`)
      .replace('#include <map_fragment>', `#include <map_fragment>
  vec3 wmGlow = vec3(0.0);
#ifdef USE_MAP
  if (uAlbumMix > 0.001) {
    vec2 q = (vMapUv - uWindowUv.xy) / (uWindowUv.zw - uWindowUv.xy);
    if (q.x >= 0.0 && q.x <= 1.0 && q.y >= 0.0 && q.y <= 1.0) {
      // cover-fit the album into the wide window: keep its middle band
      vec2 st = vec2(q.x, (q.y - 0.5) * (uAlbumAspect / uWindowAspect) + 0.5);
      vec3 alb = texture2D(uAlbum, st, 1.2).rgb;          // a little soft, it's behind plastic
      float l = dot(alb, vec3(0.299, 0.587, 0.114));
      alb = mix(vec3(l), alb, 0.8) * 0.34;                  // smoked: darker, a touch less saturated
      // fade in from the window's edges so it sits inside the frame, not on it
      vec2 e = smoothstep(vec2(0.0), vec2(0.06, 0.16), q) * smoothstep(vec2(0.0), vec2(0.06, 0.16), 1.0 - q);
      float m = e.x * e.y * uAlbumMix;
      diffuseColor.rgb = mix(diffuseColor.rgb, alb, m * 0.8);
      wmGlow = alb * m * 0.06; // a faint light of its own, so it reads through the tint in shadow
    }
  }
#endif`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
  totalEmissiveRadiance += wmGlow;`)
  }
  mat.customProgramCacheKey = () => 'wm-cassette-window'
  mat.needsUpdate = true
  return uniforms
}

// ─── dev params ───────────────────────────────────────────────────────────────

interface DevParams {
  texRotation: number
  texOffsetX: number
  texOffsetY: number
  texRepeatX: number
  texRepeatY: number
  canvasRotation: number
  canvasW: number
  canvasH: number
  fontSize: number
  textX: number
  textY: number
  flipY: boolean
  mirrorX: boolean
  emissiveIntensity: number
  showBorder: boolean
}

const defaultDevParams: DevParams = {
  texRotation: -1.576,
  texOffsetX: -0.33,
  texOffsetY: 0.275,
  texRepeatX: 2,
  texRepeatY: 1,
  canvasRotation: 3.138,
  canvasW: 204,
  canvasH: 64,
  fontSize: 4,
  textX: 1,
  textY: -2,
  flipY: true,
  mirrorX: false,
  emissiveIntensity: 1.6,
  showBorder: false,
}

// ─── canvas texture display ───────────────────────────────────────────────────

// The screen texture is drawn at RES times the tuned layout size: the layout
// (and its UV mapping above) stays exactly as dialled in, but the glyphs get
// real pixels instead of a 4px font stretched across the whole screen.
const RES = 8

function createDisplayUpdater(mesh: THREE.Mesh, devParamsRef: { current: DevParams }, invalidate: () => void) {
  const canvas = document.createElement('canvas')
  canvas.width = defaultDevParams.canvasW * RES
  canvas.height = defaultDevParams.canvasH * RES
  const ctx = canvas.getContext('2d')!

  let interval: ReturnType<typeof setInterval> | null = null
  let cursorOn = true
  let lastText = 'PASTE URL'
  let lastBlinking = true

  let isScrolling = false
  let scrollText = ''
  let scrollOffset = 0
  let lastTextWidth = 100

  // scrollX: how far the marquee has run, in canvas pixels (undefined = static text)
  function draw(text: string, showCursor: boolean, scrollX?: number) {
    const p = devParamsRef.current
    const cw = Math.max(1, Math.round(p.canvasW * RES))
    const ch = Math.max(1, Math.round(p.canvasH * RES))

    if (canvas.width !== cw) canvas.width = cw
    if (canvas.height !== ch) canvas.height = ch

    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, cw, ch)

    if (p.showBorder) {
      ctx.strokeStyle = '#ff00ff'
      ctx.lineWidth = Math.max(2, Math.round(cw / 64))
      ctx.strokeRect(1, 1, cw - 2, ch - 2)
      ctx.strokeStyle = 'rgba(255,255,255,0.25)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(cw / 2, 0); ctx.lineTo(cw / 2, ch)
      ctx.moveTo(0, ch / 2); ctx.lineTo(cw, ch / 2)
      ctx.stroke()
      const ms = Math.max(4, Math.round(cw / 20))
      ctx.fillStyle = '#ff0000'
      ctx.fillRect(0, 0, ms, ms)
      const tx = cw / 2 + p.textX
      const ty = ch / 2 + p.textY
      ctx.strokeStyle = '#00ffff'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(tx - 8, ty); ctx.lineTo(tx + 8, ty)
      ctx.moveTo(tx, ty - 8); ctx.lineTo(tx, ty + 8)
      ctx.stroke()
      ctx.fillStyle = '#00ffff'
      ctx.fillRect(tx - 2, ty - 2, 4, 4)
    }

    ctx.save()
    // Press Start 2P is an 8x8 pixel font: one font pixel is fs/8. Every glyph
    // lands on that pixel grid, so the LCD matrix drawn over it lines up exactly.
    const px = Math.max(1, Math.round((p.fontSize * RES) / 8))
    const fs = px * 8
    const snap = (v: number) => Math.round(v / px) * px
    ctx.translate(Math.round(cw / 2 + p.textX * RES), Math.round(ch / 2 + p.textY * RES))
    ctx.rotate(p.canvasRotation)
    if (p.mirrorX) ctx.scale(-1, 1)
    ctx.font = `${fs}px "Press Start 2P", monospace`
    ctx.textBaseline = 'top'
    ctx.textAlign = 'left'

    const displayChars = (scrollX !== undefined ? text : text.slice(0, 16)).split('')
    const spacing = px * 10 // 8px glyph + 2px gap
    lastTextWidth = displayChars.length * spacing
    const xStart = scrollX !== undefined ? snap(cw / 2) - snap(scrollX) : snap(-lastTextWidth / 2)
    const yTop = snap(-fs / 2)

    // unlit pixels: the faint green of an LCD that's on but not showing anything
    ctx.fillStyle = 'rgba(0, 255, 136, 0.02)'
    ctx.fillRect(-cw * 2, -cw * 2, cw * 4, cw * 4)

    // lit pixels, with a little bloom
    ctx.fillStyle = '#00ff88'
    ctx.shadowColor = 'rgba(0, 255, 136, 0.55)'
    ctx.shadowBlur = px * 1.5
    const drawRun = (x0: number) => displayChars.forEach((c, i) => ctx.fillText(c, x0 + i * spacing, yTop))
    if (scrollX === undefined) {
      drawRun(xStart)
      if (showCursor) ctx.fillText('>', xStart + lastTextWidth + px * 2, yTop)
    } else {
      // seamless marquee: copies follow each other a six-character gap apart, as
      // many as it takes to fill the screen, so it is never blank between passes
      const cycle = lastTextWidth + px * 6 * 8
      for (let x = xStart; x < cw; x += cycle) drawRun(x)
    }
    ctx.shadowBlur = 0

    // the dot matrix: thin dark gaps between every pixel, on the font's grid
    const gap = Math.max(1, Math.round(px * 0.22))
    ctx.fillStyle = 'rgba(0, 0, 0, 0.62)'
    const x0 = snap(-cw * 2), x1 = cw * 2
    const yA = yTop - snap(cw), yB = yTop + snap(cw)
    for (let x = x0; x < x1; x += px) ctx.fillRect(x, yA, gap, yB - yA)
    for (let y = yA; y <= yB; y += px) ctx.fillRect(-cw * 2, y, cw * 4, gap)

    ctx.restore()

    tex.flipY = p.flipY
    tex.rotation = p.texRotation
    tex.center.set(0.5, 0.5)
    tex.offset.set(p.texOffsetX, p.texOffsetY)
    tex.wrapS = THREE.RepeatWrapping
    tex.wrapT = THREE.RepeatWrapping
    tex.repeat.set(p.texRepeatX, p.texRepeatY)
    tex.needsUpdate = true
    invalidate()

    if (mesh.material instanceof THREE.MeshStandardMaterial) {
      mesh.material.emissiveIntensity = p.emissiveIntensity
    }
  }

  const tex = new THREE.CanvasTexture(canvas)
  tex.anisotropy = 8
  tex.flipY = defaultDevParams.flipY
  tex.rotation = defaultDevParams.texRotation
  tex.center.set(0.5, 0.5)
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping

  mesh.material = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0x000000),
    emissiveMap: tex,
    emissive: new THREE.Color(1, 1, 1),
    emissiveIntensity: defaultDevParams.emissiveIntensity,
    roughness: 0,
    metalness: 0,
  })
  ;(mesh.material as THREE.Material).needsUpdate = true

  function updateDisplay(text: string, blinking = false) {
    lastText = text
    lastBlinking = blinking
    isScrolling = false
    if (interval) { clearInterval(interval); interval = null }
    if (blinking) {
      cursorOn = true
      draw(text, true)
      interval = setInterval(() => {
        cursorOn = !cursorOn
        draw(text, cursorOn)
      }, 500)
    } else {
      draw(text, false)
    }
  }

  function redrawCurrent() {
    if (isScrolling) return
    updateDisplay(lastText, lastBlinking)
  }

  function startScroll(text: string) {
    if (interval) { clearInterval(interval); interval = null }
    isScrolling = true
    scrollText = text
    scrollOffset = 0 // the text enters from the right edge
  }

  function stopScroll() {
    isScrolling = false
  }

  function tickScroll() {
    if (!isScrolling) return
    // step one font pixel at a time, like a real LCD marquee (never between pixels)
    const p = devParamsRef.current
    const px = Math.max(1, Math.round((p.fontSize * RES) / 8))
    scrollOffset += px
    // once the lead copy is well past the left edge, drop it: the next copy takes
    // its place exactly, so the wrap is invisible
    const cw = Math.round(p.canvasW * RES)
    const cycle = lastTextWidth + px * 6 * 8
    if (cw / 2 - scrollOffset + cycle <= -cw) scrollOffset -= cycle
    draw(scrollText, false, scrollOffset)
  }

  function dispose() {
    if (interval) clearInterval(interval)
    tex.dispose()
    ;(mesh.material as THREE.MeshStandardMaterial).dispose()
  }

  return { updateDisplay, redrawCurrent, startScroll, stopScroll, tickScroll, dispose }
}

// ─── dev panel ────────────────────────────────────────────────────────────────

function DevPanel({
  devParamsRef,
  onParamsChange,
}: {
  devParamsRef: { current: DevParams }
  onParamsChange: () => void
}) {
  if (process.env.NODE_ENV !== 'development') return null

  const [params, setParams] = useState<DevParams>({ ...devParamsRef.current })
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [pos, setPos] = useState({ x: 16, y: 16 })
  const [collapsed, setCollapsed] = useState(false)
  const [copied, setCopied] = useState(false)
  const dragging = useRef(false)
  const dragStart = useRef({ mx: 0, my: 0, px: 0, py: 0 })

  type SliderKey = Exclude<keyof DevParams, 'flipY' | 'showBorder'>
  const sliders: { key: SliderKey; min: number; max: number; step: number; label: string }[] = [
    { key: 'texRotation',       min: -Math.PI, max: Math.PI, step: 0.001, label: 'tex rotation'    },
    { key: 'texOffsetX',        min: -1,       max: 1,       step: 0.005, label: 'tex offset X'    },
    { key: 'texOffsetY',        min: -1,       max: 1,       step: 0.005, label: 'tex offset Y'    },
    { key: 'texRepeatX',        min: 0.1,      max: 4,       step: 0.05,  label: 'tex repeat X'    },
    { key: 'texRepeatY',        min: 0.1,      max: 4,       step: 0.05,  label: 'tex repeat Y'    },
    { key: 'canvasRotation',    min: -Math.PI, max: Math.PI, step: 0.001, label: 'canvas rotation' },
    { key: 'canvasW',           min: 16,       max: 1024,    step: 1,     label: 'canvas W'        },
    { key: 'canvasH',           min: 16,       max: 1024,    step: 1,     label: 'canvas H'        },
    { key: 'emissiveIntensity', min: 0,        max: 10,      step: 0.1,   label: 'emissive'        },
    { key: 'fontSize',          min: 0,        max: 120,     step: 1,     label: 'font size'       },
    { key: 'textX',             min: -512,     max: 512,     step: 1,     label: 'text X'          },
    { key: 'textY',             min: -512,     max: 512,     step: 1,     label: 'text Y'          },
  ]

  const isInt = (k: SliderKey) => k === 'fontSize' || k === 'textX' || k === 'textY' || k === 'canvasW' || k === 'canvasH'
  const fmt = (k: SliderKey, v: number) => isInt(k) ? String(v) : v.toFixed(3)

  const applyValue = (key: SliderKey, raw: string) => {
    const val = parseFloat(raw)
    if (isNaN(val)) return
    const cfg = sliders.find(s => s.key === key)!
    const clamped = Math.max(cfg.min, Math.min(cfg.max, val))
    const next = { ...params, [key]: clamped }
    setParams(next)
    devParamsRef.current = next
    onParamsChange()
  }

  const update = (key: SliderKey, val: number) => {
    const next = { ...params, [key]: val }
    setParams(next)
    setDrafts(d => ({ ...d, [key]: fmt(key, val) }))
    devParamsRef.current = next
    onParamsChange()
  }

  const toggleBool = (key: 'flipY' | 'mirrorX' | 'showBorder') => {
    const next = { ...params, [key]: !params[key] }
    setParams(next)
    devParamsRef.current = next
    onParamsChange()
  }

  const reset = () => {
    setParams({ ...defaultDevParams })
    setDrafts({})
    devParamsRef.current = { ...defaultDevParams }
    onParamsChange()
  }

  const copyValues = () => {
    const out = JSON.stringify(devParamsRef.current, null, 2)
    navigator.clipboard?.writeText(out).catch(() => {})
    console.log('Dev params:', out)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const onMouseDown = (e: React.MouseEvent) => {
    dragging.current = true
    dragStart.current = { mx: e.clientX, my: e.clientY, px: pos.x, py: pos.y }
    const onMove = (ev: MouseEvent) => {
      if (!dragging.current) return
      setPos({ x: dragStart.current.px + ev.clientX - dragStart.current.mx, y: dragStart.current.py + ev.clientY - dragStart.current.my })
    }
    const onUp = () => { dragging.current = false; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const btn = (accent?: boolean): React.CSSProperties => ({
    background: accent ? '#00ff88' : 'rgba(255,255,255,0.08)',
    color: accent ? '#000' : '#ccc',
    border: accent ? 'none' : '1px solid rgba(255,255,255,0.12)',
    borderRadius: 5, padding: '4px 10px', fontSize: 10,
    cursor: 'pointer', fontFamily: 'monospace', fontWeight: 700,
    letterSpacing: '0.04em', whiteSpace: 'nowrap' as const,
  })

  const toggleStyle = (on: boolean): React.CSSProperties => ({
    background: on ? 'rgba(0,255,136,0.15)' : 'rgba(255,255,255,0.04)',
    border: `1px solid ${on ? 'rgba(0,255,136,0.4)' : 'rgba(255,255,255,0.1)'}`,
    borderRadius: 5, padding: '5px 10px', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  })

  return (
    <div style={{
      position: 'fixed', left: pos.x, top: pos.y, zIndex: 9999, width: 310,
      background: '#0e0e0e', border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 10, boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
      fontFamily: 'monospace', fontSize: 11, color: '#ddd',
      userSelect: 'none', overflow: 'hidden',
    }}>
      {/* Header */}
      <div onMouseDown={onMouseDown} style={{
        padding: '9px 12px', background: 'rgba(255,255,255,0.05)',
        borderBottom: collapsed ? 'none' : '1px solid rgba(255,255,255,0.07)',
        cursor: 'grab', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#00ff88', display: 'inline-block' }} />
          <span style={{ fontWeight: 700, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#fff' }}>
            Texture Debug
          </span>
        </div>
        <div style={{ display: 'flex', gap: 5 }} onMouseDown={e => e.stopPropagation()}>
          <button onClick={reset} style={btn()}>Reset</button>
          <button onClick={copyValues} style={btn(true)}>{copied ? 'Copied!' : 'Copy'}</button>
          <button onClick={() => setCollapsed(c => !c)} style={{ ...btn(), padding: '4px 8px', color: '#666' }}>
            {collapsed ? '▾' : '▴'}
          </button>
        </div>
      </div>

      {!collapsed && (
        <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>

          {/* Sliders */}
          {sliders.map(({ key, min, max, step, label }) => {
            const val = params[key] as number
            const draft = drafts[key] ?? fmt(key, val)
            return (
              <div key={key}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span style={{ color: '#777', fontSize: 10 }}>{label}</span>
                  <input
                    type="text" value={draft}
                    onChange={e => setDrafts(d => ({ ...d, [key]: e.target.value }))}
                    onBlur={e => { applyValue(key, e.target.value); setDrafts(d => { const n = { ...d }; delete n[key]; return n }) }}
                    onKeyDown={e => { if (e.key === 'Enter') { applyValue(key, (e.target as HTMLInputElement).value); setDrafts(d => { const n = { ...d }; delete n[key]; return n }); (e.target as HTMLInputElement).blur() } }}
                    style={{ width: 64, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 4, color: '#00ff88', fontSize: 10, fontFamily: 'monospace', padding: '2px 5px', textAlign: 'right', outline: 'none' }}
                  />
                </div>
                <input type="range" min={min} max={max} step={step} value={val}
                  onChange={e => update(key, parseFloat(e.target.value))}
                  style={{ width: '100%', accentColor: '#00ff88', cursor: 'pointer', margin: 0 }}
                />
                {key === 'canvasRotation' && (
                  <div style={{ display: 'flex', gap: 4, marginTop: 5 }}>
                    {([
                      { label: '↺ -90°', act: (c: number) => c - Math.PI / 2 },
                      { label: '↻ +90°', act: (c: number) => c + Math.PI / 2 },
                      { label: '↕ 180°', act: (c: number) => c + Math.PI },
                      { label: '⇄ flip', act: (c: number) => -c },
                      { label: '0',      act: () => 0 },
                    ] as { label: string; act: (c: number) => number }[]).map(({ label, act }) => (
                      <button key={label} onClick={() => update('canvasRotation', Math.max(-Math.PI, Math.min(Math.PI, act(params.canvasRotation))))}
                        style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 4, color: '#aaa', fontSize: 9, fontFamily: 'monospace', cursor: 'pointer', padding: '3px 0' }}>
                        {label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}

          {/* Toggles */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 2 }}>
            <button onClick={() => toggleBool('flipY')} style={toggleStyle(params.flipY)}>
              <span style={{ color: '#777', fontSize: 10 }}>tex flipY</span>
              <span style={{ color: params.flipY ? '#00ff88' : '#555', fontSize: 10, fontWeight: 700 }}>{params.flipY ? 'true' : 'false'}</span>
            </button>
            <button onClick={() => toggleBool('mirrorX')} style={toggleStyle(params.mirrorX)}>
              <span style={{ color: '#777', fontSize: 10 }}>canvas mirror X</span>
              <span style={{ color: params.mirrorX ? '#00ff88' : '#555', fontSize: 10, fontWeight: 700 }}>{params.mirrorX ? 'ON' : 'OFF'}</span>
            </button>
            <button onClick={() => toggleBool('showBorder')} style={toggleStyle(params.showBorder)}>
              <span style={{ color: '#777', fontSize: 10 }}>show canvas border</span>
              <span style={{ color: params.showBorder ? '#00ff88' : '#555', fontSize: 10, fontWeight: 700 }}>{params.showBorder ? 'ON' : 'OFF'}</span>
            </button>
          </div>

          {/* Border legend */}
          {params.showBorder && (
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 5, padding: '7px 9px', fontSize: 9, color: '#666', lineHeight: 1.8 }}>
              <div><span style={{ color: '#ff00ff' }}>■</span> magenta border = canvas edge</div>
              <div><span style={{ color: '#ff0000' }}>■</span> red square = canvas origin (0,0)</div>
              <div><span style={{ color: '#00ffff' }}>+</span> cyan crosshair = text anchor point</div>
              <div><span style={{ color: 'rgba(255,255,255,0.3)' }}>+</span> white cross = canvas center (256,256)</div>
            </div>
          )}

          {/* Defaults reference */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 8, color: '#444', fontSize: 9, lineHeight: 1.7 }}>
            {sliders.map(({ key, label }) => (
              <div key={key} style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>{label}</span>
                <span style={{ color: '#555' }}>{fmt(key, defaultDevParams[key] as number)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── walkman model ────────────────────────────────────────────────────────────

interface WalkmanProps {
  onPasteClick: () => void
  onPlayPause: () => void
  onMuteToggle: () => void
  onStop: () => void
  onForward: () => void
  onRewind: () => void
  onVolumeChange: (vol: number) => void
  onVolumeEnd: () => void
  onReady: (fn: (text: string, blinking?: boolean) => void, redraw: () => void, startScroll: (text: string) => void) => void
  onHoverControl?: (control: HoverControl | null) => void // which button is under the pointer
  hoverBeat?: { current: number } // stamped every time the pointer is over a button
  modelBeat?: { current: number } // stamped every time the pointer is over any part of the model
  devParamsRef: { current: DevParams }
  darkBg: boolean
  albumId?: string | null // the tape that's in: its cover shows faintly in the cassette window
}

function WalkmanModel({ onPasteClick, onPlayPause, onMuteToggle, onStop, onForward, onRewind, onVolumeChange, onVolumeEnd, onReady, onHoverControl, hoverBeat, modelBeat, devParamsRef, darkBg, albumId }: WalkmanProps) {
  // 2048² WebP textures (was 3 × 4096² PNG: ~25 MB download, ~270 MB of GPU
  // memory). Anisotropic filtering below keeps the label print crisp at angles.
  const { scene } = useGLTF('/models/walkman/walkman01-2k.glb')
  const { invalidate, gl } = useThree()

  // the cursor label lives in the page, outside the canvas; tell it what's hovered
  const onHoverRef = useRef(onHoverControl)
  onHoverRef.current = onHoverControl

  const disposeRef = useRef<(() => void) | null>(null)
  const hasInteractedRef = useRef(false)
  const onPasteClickRef = useRef(onPasteClick)
  const onPlayPauseRef = useRef<(() => void) | null>(null)
  const onMuteToggleRef = useRef<(() => void) | null>(null)
  const onStopRef = useRef<(() => void) | null>(null)
  const onForwardRef = useRef<(() => void) | null>(null)
  const onRewindRef = useRef<(() => void) | null>(null)
  const onVolumeChangeRef = useRef(onVolumeChange)
  const onVolumeEndRef = useRef(onVolumeEnd)
  useEffect(() => { onPasteClickRef.current = onPasteClick }, [onPasteClick])
  useEffect(() => {
    onPlayPauseRef.current = onPlayPause
    onMuteToggleRef.current = onMuteToggle
    onStopRef.current = onStop
    onForwardRef.current = onForward
    onRewindRef.current = onRewind
  }, [onPlayPause, onMuteToggle, onStop, onForward, onRewind])
  useEffect(() => { onVolumeChangeRef.current = onVolumeChange }, [onVolumeChange])
  useEffect(() => { onVolumeEndRef.current = onVolumeEnd }, [onVolumeEnd])

  const controlOf = (n: string): HoverControl | null => {
    if (n.includes('Paste_click_button') || n.includes('Cube003')) return 'paste'
    if (n.includes('Button1_low001')) return 'mute'
    if (n.includes('Button2_low001')) return 'forward'
    if (n.includes('Button3_low001')) return 'rewind'
    if (n.includes('Button4_low001')) return 'play'
    if (n.includes('Button5_low001')) return 'stop'
    if (n.includes('Slider1_low001') || n.includes('Slider2_low001')) return 'volume'
    return null
  }

  useEffect(() => {
    gl.setClearColor(new THREE.Color(darkBg ? '#000000' : '#ffffff'), 0)
    invalidate()
  }, [darkBg])

  const btnGroups = useRef<Record<string, THREE.Object3D[]>>({ paste: [], play: [], stop: [], forward: [], rewind: [], stopeject: [] })
  const btnOriginals = useRef<Map<THREE.Object3D, { scale: THREE.Vector3; pos: THREE.Vector3 }>>(new Map())
  const animatingGroup = useRef<THREE.Object3D[]>([])
  const btnPress = useRef(0)
  const stopejectPress = useRef(0)

  const isDraggingSlider = useRef(false)
  const sliderStartY = useRef(0)
  const sliderStartVol = useRef(50)

  // Mechanical click sound for button presses
  const clickAudioRef = useRef<HTMLAudioElement | null>(null)
  useEffect(() => {
    const a = new Audio('/images/lab/walkman-click-01.mp3')
    a.preload = 'auto'
    a.volume = 0.55
    clickAudioRef.current = a
    return () => { clickAudioRef.current = null }
  }, [])
  const playClick = useCallback(() => {
    const a = clickAudioRef.current
    if (!a) return
    a.currentTime = 0
    a.play().catch(() => {})
  }, [])

  const tickScrollRef = useRef<() => void>(() => {})
  const windowUniforms = useRef<ReturnType<typeof addCassetteWindow> | null>(null)
  const albumTarget = useRef(0) // where the window's album fade is heading

  // load the cover for the cassette window (same-origin proxy, so WebGL may read it)
  useEffect(() => {
    const u = windowUniforms.current
    if (!albumId) { albumTarget.current = 0; return }
    let cancelled = false
    new THREE.TextureLoader().load(`/api/thumbnail?id=${albumId}&size=mqdefault`, (tex) => {
      if (cancelled) { tex.dispose(); return }
      tex.colorSpace = THREE.SRGBColorSpace
      tex.anisotropy = 4
      const img = tex.image as { width: number; height: number }
      const w = windowUniforms.current
      if (!w) return
      w.uAlbum.value?.dispose()
      w.uAlbum.value = tex
      w.uAlbumAspect.value = img.width / img.height
      albumTarget.current = 1
      invalidate()
    })
    if (u) albumTarget.current = 0 // fade the old cover out while the new one loads
    return () => { cancelled = true }
  }, [albumId, invalidate])
  const stopScrollRef = useRef<() => void>(() => {})
  const wasPlayingRef = useRef(false)
  const isHovered = useRef(false)
  const scrollFrameCount = useRef(0)
  const driftTimeRef = useRef(0)
  const idleTimeRef = useRef(0)
  const sceneBasePosY = useRef(-1.07)
  const pivotRef = useRef<THREE.Group>(null!)
  const clearHoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastHoveredLabelRef = useRef('')

  useEffect(() => {
    scene.rotation.y = 4.4
    scene.rotation.x = 0.9084
    scene.scale.setScalar(2.35)

    const box = new THREE.Box3().setFromObject(scene)
    const center = new THREE.Vector3()
    box.getCenter(center)
    // Center scene at pivot's local origin so rotation is around the visual center
    scene.position.set(-center.x, -center.y, -center.z)
    const basePosY = center.y - 1.07
    sceneBasePosY.current = basePosY
    pivotRef.current.position.set(0.03, basePosY, 0)

    let screenMesh: THREE.Mesh | null = null
    const maxAniso = Math.min(8, gl.capabilities.getMaxAnisotropy())
    btnGroups.current = { paste: [], play: [], stop: [], forward: [], rewind: [], stopeject: [] }
    btnOriginals.current = new Map()
    animatingGroup.current = []

    scene.traverse((obj) => {
      const n = obj.name

      const addToGroup = (group: string) => {
        btnGroups.current[group].push(obj)
        btnOriginals.current.set(obj, { scale: obj.scale.clone(), pos: obj.position.clone() })
      }
      if (n.includes('Paste_click_button') || n.includes('Cube003')) addToGroup('paste')
      else if (n.includes('Button1_low001')) addToGroup('play')
      else if (n.includes('Button2_low001')) addToGroup('stop')
      else if (n.includes('Button3_low001')) addToGroup('forward')
      else if (n.includes('Button4_low001')) addToGroup('rewind')
      else if (n.includes('Button5_low001')) addToGroup('stopeject')

      if (n === '8Bit_screen') screenMesh = obj as THREE.Mesh

      if (n !== '8Bit_screen' && (obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh
        const solidify = (m: THREE.Material) => {
          if (m instanceof THREE.MeshStandardMaterial) {
            for (const t of [m.map, m.normalMap, m.roughnessMap, m.metalnessMap]) if (t) t.anisotropy = maxAniso
          }
          m.side = THREE.DoubleSide
          m.transparent = false
          m.depthWrite = true
          if (m instanceof THREE.MeshStandardMaterial) { m.opacity = 1; m.alphaTest = 0 }
          m.needsUpdate = true
        }
        if (Array.isArray(mesh.material)) mesh.material.forEach(solidify)
        else if (mesh.material) solidify(mesh.material)
      }
    })


    // the lid gets its own copy of the material, with the cassette window patch
    scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh
      if (!mesh.isMesh || !obj.name.includes('Walkman3_low')) return
      const own = (mesh.material as THREE.MeshStandardMaterial).clone()
      mesh.material = own
      windowUniforms.current = addCassetteWindow(own)
    })

    if (screenMesh) {
      const { updateDisplay, redrawCurrent, startScroll, stopScroll, tickScroll, dispose } = createDisplayUpdater(screenMesh as THREE.Mesh, devParamsRef, invalidate)
      disposeRef.current = dispose
      tickScrollRef.current = tickScroll
      stopScrollRef.current = stopScroll
      onReady(updateDisplay, redrawCurrent, startScroll)
      updateDisplay('PASTE URL', true)
      document.fonts.load('4px "Press Start 2P"').then(() => {
        updateDisplay('PASTE URL', true)
      })
    }

    return () => {
      disposeRef.current?.()
      scene.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          (obj as THREE.Mesh).geometry.dispose()
        }
      })
    }
  }, [scene])

  useFrame((_, delta) => {
    const wu = windowUniforms.current
    if (wu && Math.abs(wu.uAlbumMix.value - albumTarget.current) > 0.002) {
      wu.uAlbumMix.value += (albumTarget.current - wu.uAlbumMix.value) * Math.min(1, delta * 2.5)
      invalidate()
    }
    const playing = window.ytPlayer?.getPlayerState?.() === 1
    if (playing) {
      scrollFrameCount.current++
      if (scrollFrameCount.current % 2 === 0) tickScrollRef.current()

      driftTimeRef.current += delta
      const t = driftTimeRef.current
      pivotRef.current.rotation.y = t * 0.25
      pivotRef.current.rotation.x = Math.sin(t * 0.19) * 0.013
      pivotRef.current.position.y = THREE.MathUtils.lerp(pivotRef.current.position.y, sceneBasePosY.current, Math.min(1, delta * 4))

      invalidate()
    } else {
      idleTimeRef.current += delta
      pivotRef.current.position.y = sceneBasePosY.current + Math.sin(idleTimeRef.current * 0.65) * 0.2
      invalidate()
    }
    if (!playing && wasPlayingRef.current) {
      stopScrollRef.current()
    }
    wasPlayingRef.current = playing

    if (btnPress.current > 0) {
      btnPress.current = Math.max(0, btnPress.current - delta * 9)
      const t = Math.sin(btnPress.current * Math.PI)
      animatingGroup.current.forEach((mesh) => {
        const orig = btnOriginals.current.get(mesh)
        if (!orig) return
        mesh.scale.set(orig.scale.x * (1 - t * 0.08), orig.scale.y * (1 - t * 0.05), orig.scale.z * (1 - t * 0.08))
        mesh.position.copy(orig.pos)
        mesh.position.y -= t * 0.008
      })
      if (btnPress.current === 0) {
        animatingGroup.current.forEach((mesh) => {
          const orig = btnOriginals.current.get(mesh)
          if (orig) { mesh.scale.copy(orig.scale); mesh.position.copy(orig.pos) }
        })
        animatingGroup.current = []
      }
      invalidate()
    }

    if (stopejectPress.current > 0) {
      stopejectPress.current = Math.max(0, stopejectPress.current - delta * 7)
      const t = Math.sin(stopejectPress.current * Math.PI)
      btnGroups.current.stopeject.forEach((mesh) => {
        const orig = btnOriginals.current.get(mesh)
        if (!orig) return
        mesh.position.copy(orig.pos)
        mesh.position.z += t * 0.04
      })
      if (stopejectPress.current === 0) {
        btnGroups.current.stopeject.forEach((mesh) => {
          const orig = btnOriginals.current.get(mesh)
          if (orig) mesh.position.copy(orig.pos)
        })
      }
      invalidate()
    }
  })

  const isBtn = (name: string) =>
    name.includes('Paste_click_button') || name.includes('Cube003') ||
    name.includes('Button1_low001') || name.includes('Button2_low001') ||
    name.includes('Button3_low001') || name.includes('Button4_low001') ||
    name.includes('Button5_low001') ||
    name.includes('Slider1_low001') || name.includes('Slider2_low001')

  const isSliderMesh = (name: string) =>
    name.includes('Slider1_low001') || name.includes('Slider2_low001')

  const pressGroup = (n: string) => {
    if (n.includes('Button5_low001')) {
      stopejectPress.current = 1
      invalidate()
      return
    }
    btnPress.current = 1
    if (n.includes('Paste_click_button') || n.includes('Cube003'))
      animatingGroup.current = btnGroups.current.paste
    else if (n.includes('Button1_low001')) animatingGroup.current = btnGroups.current.play
    else if (n.includes('Button2_low001')) animatingGroup.current = btnGroups.current.stop
    else if (n.includes('Button3_low001')) animatingGroup.current = btnGroups.current.forward
    else if (n.includes('Button4_low001')) animatingGroup.current = btnGroups.current.rewind
    invalidate()
  }

  const showControl = (n: string) => {
    const c = controlOf(n)
    if (!c) return
    if (hoverBeat) hoverBeat.current = performance.now()
    if (clearHoverTimerRef.current) { clearTimeout(clearHoverTimerRef.current); clearHoverTimerRef.current = null }
    document.body.style.cursor = c === 'volume' ? 'ns-resize' : 'pointer'
    isHovered.current = true
    if (c !== lastHoveredLabelRef.current) {
      lastHoveredLabelRef.current = c
      onHoverRef.current?.(c)
    }
  }

  // one pointer event reaches every mesh along the ray (the button, then the
  // body behind it); only the nearest one decides what's under the cursor
  const isNearest = (e: any) => !e.intersections?.length || e.intersections[0].object === e.object

  const handlePointerOver = useCallback((e: any) => {
    if (modelBeat) modelBeat.current = performance.now()
    if (!isNearest(e)) return
    showControl(e.object?.name ?? '')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handlePointerOut = useCallback((e: any) => {
    if (isBtn(e.object?.name ?? '')) {
      document.body.style.cursor = 'default'
      isHovered.current = false
      lastHoveredLabelRef.current = ''
      // a short grace period, so sliding between neighbouring buttons doesn't flicker
      clearHoverTimerRef.current = setTimeout(() => {
        if (!isDraggingSlider.current) onHoverRef.current?.(null)
        clearHoverTimerRef.current = null
      }, 120)
    }
  }, [])

  const handlePointerDown = useCallback((e: any) => {
    const n = e.object?.name ?? ''
    if (isSliderMesh(n)) {
      e.stopPropagation()
      isDraggingSlider.current = true
      sliderStartY.current = e.clientY ?? 0
      sliderStartVol.current = window.ytPlayer?.getVolume?.() ?? 50
    } else if (isBtn(n) && !isSliderMesh(n)) {
      e.stopPropagation()
      playClick()
      pressGroup(n)
    }
  }, [playClick])

  const handlePointerMove = useCallback((e: any) => {
    if (modelBeat) modelBeat.current = performance.now()
    if (isDraggingSlider.current) {
      if (hoverBeat) hoverBeat.current = performance.now() // keep the volume label up while dragging
      const dy = sliderStartY.current - (e.clientY ?? 0)
      const newVol = Math.max(0, Math.min(100, sliderStartVol.current + dy))
      onVolumeChangeRef.current(Math.round(newVol))
      return
    }
    // onPointerOver can miss when the cursor is already over a mesh (e.g. right
    // after a click), so pointer-move keeps the label in step too; showControl
    // only reports when the control under the cursor actually changes
    if (!isNearest(e)) return
    if (isBtn(e.object?.name ?? '')) showControl(e.object?.name ?? '')
    else if (lastHoveredLabelRef.current) {
      // straight from a button onto the body: drop the label right away
      lastHoveredLabelRef.current = ''
      document.body.style.cursor = 'default'
      onHoverRef.current?.(null)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handlePointerUp = useCallback(() => {
    if (isDraggingSlider.current) {
      isDraggingSlider.current = false
      onVolumeEndRef.current()
    }
  }, [])

  const handleClick = useCallback((e: any) => {
    e.stopPropagation()
    hasInteractedRef.current = true
    const name = e.object?.name ?? ''
    if (name.includes('Paste_click_button') || name.includes('Cube003')) {
      onPasteClickRef.current()
    } else if (name.includes('Button1_low001')) {
      onMuteToggleRef.current?.()
    } else if (name.includes('Button2_low001')) {
      onForwardRef.current?.()
    } else if (name.includes('Button3_low001')) {
      onRewindRef.current?.()
    } else if (name.includes('Button4_low001')) {
      onPlayPauseRef.current?.()
    } else if (name.includes('Button5_low001')) {
      onStopRef.current?.()
    }
  }, [])


  return (
    <>
      <group ref={pivotRef}>
        <primitive
          object={scene}
          onClick={handleClick}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          onPointerOver={handlePointerOver}
          onPointerOut={handlePointerOut}
        />
      </group>

    </>
  )
}

// No module-level useGLTF.preload here: it ran whenever this module was
// evaluated, which pulled the 25 MB model in on other pages too. The model
// still starts loading as soon as <WalkmanModel> mounts on this page.

// ─── soft shadow ─────────────────────────────────────────────────────────────

function SoftShadow() {
  const texture = useMemo(() => {
    const size = 256
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')!
    const cx = size / 2
    const gradient = ctx.createRadialGradient(cx, cx, 0, cx, cx, cx)
    gradient.addColorStop(0,    'rgba(0,0,0,0.45)')
    gradient.addColorStop(0.38, 'rgba(0,0,0,0.28)')
    gradient.addColorStop(0.72, 'rgba(0,0,0,0.09)')
    gradient.addColorStop(1,    'rgba(0,0,0,0)')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, size, size)
    return new THREE.CanvasTexture(canvas)
  }, [])

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -3.07, 0]} scale={[2.5, 1.2, 1]}>
      <planeGeometry args={[2, 2]} />
      <meshBasicMaterial map={texture} transparent depthWrite={false} />
    </mesh>
  )
}

// ─── model loader overlay ─────────────────────────────────────────────────────

function WalkmanLoaderOverlay({ darkBg }: { darkBg: boolean }) {
  const { progress } = useProgress()
  const [gone, setGone] = useState(false)
  const done = progress >= 100

  useEffect(() => {
    if (!done) return
    const t = setTimeout(() => setGone(true), 750)
    return () => clearTimeout(t)
  }, [done])

  if (gone) return null

  const fg = '#00ff88'
  const fgDim = darkBg ? 'rgba(0,255,136,0.18)' : 'rgba(0,160,80,0.14)'
  const textColor = darkBg ? 'rgba(0,255,136,0.75)' : 'rgba(0,130,70,0.82)'
  const subColor = darkBg ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.22)'

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9990,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      background: darkBg ? '#000' : '#fff',
      opacity: done ? 0 : 1,
      transition: 'opacity 0.7s ease',
      pointerEvents: done ? 'none' : 'all',
    }}>
      {/* Spinning arc — cassette reel feel */}
      <div style={{
        width: 38, height: 38,
        borderRadius: '50%',
        borderWidth: 2, borderStyle: 'solid',
        borderColor: `${fg} ${fgDim} ${fgDim} ${fgDim}`,
        animation: 'reelSpin 1.1s linear infinite',
        marginBottom: 28,
      }} />

      {/* Progress track */}
      <div style={{ width: 160, height: 2, background: fgDim, borderRadius: 1, overflow: 'hidden', marginBottom: 12 }}>
        <div style={{
          width: `${progress}%`, height: '100%',
          background: fg, borderRadius: 1,
          transition: 'width 0.3s ease',
        }} />
      </div>

      <div style={{
        fontFamily: '"Press Start 2P", monospace',
        fontSize: 8, color: textColor, letterSpacing: '0.1em',
      }}>
        {Math.round(progress)}%
      </div>

      <div style={{
        fontFamily: '"Courier New", monospace',
        fontSize: 10, color: subColor,
        marginTop: 10, letterSpacing: '0.05em',
      }}>
        warming up the tape
      </div>
    </div>
  )
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default function Walkman() {
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => { setIsMobile(window.innerWidth < 768) }, [])

  const [url, setUrl] = useState('')
  const [displayStatus, setDisplayStatus] = useState('')
  const [thumbUrl, setThumbUrl] = useState('')
  const [videoMeta, setVideoMeta] = useState<{ title: string; author: string } | null>(null)
  const [bgGlows, setBgGlows] = useState<{ r: number; g: number; b: number }[]>([])
  // light / dark / album: album tints the whole room with the cover's colour
  const [themeMode, setThemeModeState] = useState<ThemeMode>('dark')
  useEffect(() => { setThemeModeState(loadTheme()) }, [])
  const setThemeMode = useCallback((t: ThemeMode) => { setThemeModeState(t); saveTheme(t) }, [])
  const albumRoom = useMemo(() => albumBackground(bgGlows) ?? ([58, 54, 52] as [number, number, number]), [bgGlows])
  const darkBg = themeMode !== 'light' // the album room is always a mid-dark colour
  const [glowKey, setGlowKey] = useState(0)
  const [apiReady, setApiReady] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [hoverControl, setHoverControl] = useState<HoverControl | null>(null)
  // The scene's pointer-out events can be skipped (fast moves, leaving the
  // canvas, sliding onto an overlay), so the label also checks itself: the
  // model stamps hoverBeat whenever the pointer is over a button, and any mouse
  // move without a fresh stamp means the pointer is no longer on one.
  const hoverBeat = useRef(0)
  const hoverControlRef = useRef(hoverControl)
  hoverControlRef.current = hoverControl
  useEffect(() => {
    const check = () => {
      if (hoverControlRef.current && performance.now() - hoverBeat.current > 80) {
        setHoverControl(null)
        document.body.style.cursor = 'default'
      }
    }
    const clear = () => setHoverControl(null)
    window.addEventListener('pointermove', check, { passive: true })
    document.addEventListener('pointerleave', check)
    window.addEventListener('blur', clear)
    return () => {
      window.removeEventListener('pointermove', check)
      document.removeEventListener('pointerleave', check)
      window.removeEventListener('blur', clear)
    }
  }, [])
  const [deckSignal, setDeckSignal] = useState<{ n: number; query?: string }>({ n: 0 })
  const openDeck = useCallback((query?: string) => setDeckSignal((d) => ({ n: d.n + 1, query })), [])
  const [deckOpen, setDeckOpen] = useState(false)
  const [dpr, setDpr] = useState(1.5)

  // background visualizer: settings persist on the device; the signal object
  // outlives renders so a live tab-audio share isn't dropped on re-render
  const [vizSettings, setVizSettings] = useState<VizSettings>(DEFAULT_SETTINGS)
  useEffect(() => { setVizSettings(loadSettings()) }, [])
  const updateViz = useCallback((s: VizSettings) => { setVizSettings(s); saveSettings(s) }, [])
  const signalRef = useRef<AudioSignal | null>(null)
  if (!signalRef.current) signalRef.current = new AudioSignal()
  const [trackStatus, setTrackStatus] = useState<TrackStatus>('none')
  useEffect(() => {
    const sig = signalRef.current!
    sig.onTrackStatus = setTrackStatus
    return () => { sig.onTrackStatus = undefined }
  }, [])
  useEffect(() => { signalRef.current!.useTrack = vizSettings.source === 'song' }, [vizSettings.source])
  // fetch the song's analysis as soon as a tape is picked (shipped file, or analysed on demand)
  useEffect(() => { signalRef.current!.loadTrack(currentId) }, [currentId])
  const [toast, setToast] = useState<{ title: string; hint: string; thumb?: string } | null>(null)
  const showToast = useCallback((title: string, hint: string, thumb?: string) => {
    setToast({ title, hint, thumb })
  }, [])

  const [isFullscreen, setIsFullscreen] = useState(false)

  // Scroll zooms the Walkman only while the pointer is on it; anywhere else the
  // wheel is left alone. The model stamps modelBeat whenever the pointer is over
  // any of its parts; a capture-phase wheel listener (it runs before the orbit
  // controls' own) switches zoom on or off for that one wheel event.
  const controlsRef = useRef<React.ComponentRef<typeof OrbitControls> | null>(null)
  const modelBeat = useRef(0)
  const overModel = useRef(false)
  useEffect(() => {
    const onMove = () => { overModel.current = performance.now() - modelBeat.current < 80 }
    const onWheel = () => {
      const c = controlsRef.current
      if (!c) return
      c.enableZoom = overModel.current
      // back on straight after, so pinch-zoom on touch screens still works
      setTimeout(() => { if (controlsRef.current) controlsRef.current.enableZoom = true }, 0)
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('wheel', onWheel, { capture: true, passive: true })
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('wheel', onWheel, { capture: true })
    }
  }, [])
  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onFsChange)
    return () => document.removeEventListener('fullscreenchange', onFsChange)
  }, [])
  // full screen is just the Walkman: the site nav slides away
  useEffect(() => {
    document.documentElement.toggleAttribute('data-walkman-fs', isFullscreen)
    return () => document.documentElement.removeAttribute('data-walkman-fs')
  }, [isFullscreen])
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {})
    } else {
      document.exitFullscreen().catch(() => {})
    }
  }, [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      if (e.key === 'f' || e.key === 'F') toggleFullscreen()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggleFullscreen])
  const updateDisplayRef = useRef<((text: string, blinking?: boolean) => void) | null>(null)
  const redrawCurrentRef = useRef<(() => void) | null>(null)
  const startScrollRef = useRef<((text: string) => void) | null>(null)
  const currentUrlRef = useRef('')
  // what the LCD marquee scrolls: the song + artist once known, else the link
  const scrollTextRef = useRef('')
  const pendingVideoRef = useRef<string | null>(null)
  const playerReadyRef = useRef(false)
  const isMutedRef = useRef(false)
  const devParamsRef = useRef<DevParams>({ ...defaultDevParams })
  const urlRef = useRef(url)
  useEffect(() => { urlRef.current = url }, [url])

  useEffect(() => {
    if (!darkBg) {
      document.body.setAttribute('data-light-page', 'true')
      document.documentElement.removeAttribute('data-cassette-dark')
    } else {
      document.body.removeAttribute('data-light-page')
      document.documentElement.setAttribute('data-cassette-dark', 'true')
    }
    return () => {
      document.body.removeAttribute('data-light-page')
      document.documentElement.removeAttribute('data-cassette-dark')
    }
  }, [darkBg])

  useEffect(() => {
    if (!document.querySelector('link[href*="Press+Start+2P"]')) {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = 'https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap'
      document.head.appendChild(link)
    }
  }, [])

  useEffect(() => {
    if ((window as any).YT?.Player) { setApiReady(true); return }
    const prev = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => { setApiReady(true); prev?.() }
    if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
      const tag = document.createElement('script')
      tag.src = 'https://www.youtube.com/iframe_api'
      document.head.appendChild(tag)
    }
  }, [])

  // Pre-initialize the YT player as soon as the API is ready.
  // Uses muted autoplay (always allowed by browsers) then unmutes at state=1,
  // bypassing Android Chrome's cross-origin user-activation restriction.
  useEffect(() => {
    if (!apiReady) return

    // window.ytPlayer may survive Next.js client-side navigation even though
    // refs reset on remount. Destroy the stale player so onReady fires fresh.
    if (window.ytPlayer) {
      window.ytPlayer.destroy?.()
      window.ytPlayer = null
    }

    window.ytPlayer = new window.YT.Player('yt-player', {
      height: '113', width: '200',
      playerVars: { autoplay: 1, mute: 1, controls: 0, rel: 0, playsinline: 1 },
      events: {
        onReady: () => {
          playerReadyRef.current = true
          if (pendingVideoRef.current) {
            const id = pendingVideoRef.current
            pendingVideoRef.current = null
            window.ytPlayer.mute()
            window.ytPlayer.loadVideoById(id)
            window.ytPlayer.playVideo()
          }
        },
        onStateChange: (e: any) => {
          const st = e.data
          if (st === 1) {
            if (!isMutedRef.current) window.ytPlayer?.unMute?.()
            const data = window.ytPlayer?.getVideoData?.()
            if (data?.title) {
              setVideoMeta({ title: data.title, author: data.author ?? '' })
              scrollTextRef.current = lcdText(data.title, data.author ?? '')
              const id = data.video_id || extractVideoId(currentUrlRef.current)
              if (id) rememberTape({ id, title: data.title, author: data.author ?? '' })
            }
            startScrollRef.current?.(scrollTextRef.current || currentUrlRef.current)
            setDisplayStatus('PLAYING')
          } else if (st === 2) {
            updateDisplayRef.current?.('PAUSED', false)
            setDisplayStatus('PAUSED')
          } else if (st === 0) {
            updateDisplayRef.current?.('PASTE URL', true)
            setDisplayStatus('')
          }
        },
        onError: (e: any) => {
          const code = e.data
          // 101/150 = owner disabled embedding · 100 = not found/private
          // 2 = bad video ID · 5 = HTML5 player error
          const t = (code === 101 || code === 150)
            ? { disp: 'BLOCKED', title: "Can't play this one", hint: 'The owner disabled embedding. Try a normal youtube.com link instead of YouTube Music.' }
            : code === 100
            ? { disp: 'NOT FOUND', title: 'Video unavailable', hint: 'It may be private, deleted, or region locked.' }
            : { disp: 'ERROR :(', title: 'Playback error', hint: 'Something went wrong loading that track. Try another link.' }
          const failedId = extractVideoId(currentUrlRef.current)
          const thumb = failedId ? `https://img.youtube.com/vi/${failedId}/hqdefault.jpg` : undefined
          updateDisplayRef.current?.(t.disp, true)
          setDisplayStatus('')
          setThumbUrl('')
          showToast(t.title, t.hint, thumb)
          setTimeout(() => updateDisplayRef.current?.('PASTE URL', true), 2500)
        },
      },
    })

    return () => {
      window.ytPlayer?.destroy?.()
      window.ytPlayer = null
      playerReadyRef.current = false
    }
  }, [apiReady, setDisplayStatus, setVideoMeta, showToast])

  const handlePlayPause = useCallback(() => {
    if (!window.ytPlayer) return
    const state = window.ytPlayer.getPlayerState?.()
    if (state === 1) {
      window.ytPlayer.pauseVideo()
      updateDisplayRef.current?.('PAUSED', false)
      setDisplayStatus('PAUSED')
    } else {
      window.ytPlayer.playVideo()
      updateDisplayRef.current?.(urlRef.current, false)
    }
  }, [setDisplayStatus])

  const handleMuteToggle = useCallback(() => {
    if (!window.ytPlayer) return
    if (window.ytPlayer.isMuted?.()) {
      window.ytPlayer.unMute()
      setIsMuted(false)
      isMutedRef.current = false
      updateDisplayRef.current?.('UNMUTED', false)
      setDisplayStatus('UNMUTED')
    } else {
      window.ytPlayer.mute()
      setIsMuted(true)
      isMutedRef.current = true
      updateDisplayRef.current?.('MUTED', false)
      setDisplayStatus('MUTED')
    }
    setTimeout(() => {
      const st = window.ytPlayer?.getPlayerState?.()
      if (st === 1) { startScrollRef.current?.(scrollTextRef.current || currentUrlRef.current); setDisplayStatus('PLAYING') }
      else if (st === 2) { updateDisplayRef.current?.('PAUSED', false); setDisplayStatus('PAUSED') }
      else { updateDisplayRef.current?.('PASTE URL', true); setDisplayStatus('') }
    }, 1000)
  }, [setDisplayStatus])

  const handleStop = useCallback(() => {
    window.ytPlayer?.stopVideo?.()
    updateDisplayRef.current?.('PASTE URL', true)
    setDisplayStatus('')
    setIsMuted(false)
    setThumbUrl('')
    setVideoMeta(null)
    setBgGlows([])
    setGlowKey(0)
    setCurrentId(null)
    scrollTextRef.current = ''
  }, [setDisplayStatus])

  const handleForward = useCallback(() => {
    const t = window.ytPlayer?.getCurrentTime?.() ?? 0
    window.ytPlayer?.seekTo?.(t + 10, true)
    updateDisplayRef.current?.('+10s', false)
    setDisplayStatus('+10s')
    setTimeout(() => {
      updateDisplayRef.current?.(urlRef.current || 'PASTE URL', !urlRef.current)
      const st = window.ytPlayer?.getPlayerState?.()
      setDisplayStatus(st === 1 ? 'PLAYING' : st === 2 ? 'PAUSED' : '')
    }, 1000)
  }, [setDisplayStatus])

  const handleRewind = useCallback(() => {
    const t = window.ytPlayer?.getCurrentTime?.() ?? 0
    window.ytPlayer?.seekTo?.(Math.max(0, t - 10), true)
    updateDisplayRef.current?.('-10s', false)
    setDisplayStatus('-10s')
    setTimeout(() => {
      updateDisplayRef.current?.(urlRef.current || 'PASTE URL', !urlRef.current)
      const st = window.ytPlayer?.getPlayerState?.()
      setDisplayStatus(st === 1 ? 'PLAYING' : st === 2 ? 'PAUSED' : '')
    }, 1000)
  }, [setDisplayStatus])

  const handleVolumeChange = useCallback((vol: number) => {
    window.ytPlayer?.setVolume?.(vol)
    updateDisplayRef.current?.(`VOL: ${vol}`, false)
  }, [])

  const handleVolumeEnd = useCallback(() => {
    const state = window.ytPlayer?.getPlayerState?.()
    if (state === 1) {
      startScrollRef.current?.(scrollTextRef.current || currentUrlRef.current)
    } else if (state === 2) {
      updateDisplayRef.current?.('PAUSED', false)
    } else {
      updateDisplayRef.current?.('PASTE URL', true)
    }
  }, [])

  const extractColors = useCallback(async (videoId: string) => {
    try {
      const response = await fetch(`/api/thumbnail?id=${videoId}`)
      // no thumbnail to read colours from: keep the current palette, quietly
      if (!response.ok) return
      const blob = await response.blob()
      const objectUrl = URL.createObjectURL(blob)

      const img = new Image()
      img.src = objectUrl
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = () => reject(new Error('image load failed'))
      })

      const canvas = document.createElement('canvas')
      canvas.width = img.width || 120
      canvas.height = img.height || 90
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0)
      URL.revokeObjectURL(objectUrl)

      const w = canvas.width, h = canvas.height
      type RGB = { r: number; g: number; b: number }

      // 8×8 grid = 64 samples for better coverage
      const samples: RGB[] = []
      for (let x = 0; x < 8; x++) {
        for (let y = 0; y < 8; y++) {
          const px = Math.floor((x / 7) * (w - 1))
          const py = Math.floor((y / 7) * (h - 1))
          const d = ctx.getImageData(px, py, 1, 1).data
          samples.push({ r: d[0], g: d[1], b: d[2] })
        }
      }

      // K-means to find 5 genuinely distinct color clusters
      const K = 5
      let centroids: RGB[] = Array.from({ length: K }, (_, i) => ({
        ...samples[Math.floor((i / K) * samples.length)]
      }))
      for (let iter = 0; iter < 10; iter++) {
        const clusters: RGB[][] = Array.from({ length: K }, () => [])
        for (const s of samples) {
          let minD = Infinity, minI = 0
          centroids.forEach((c, i) => {
            const d = (s.r - c.r) ** 2 + (s.g - c.g) ** 2 + (s.b - c.b) ** 2
            if (d < minD) { minD = d; minI = i }
          })
          clusters[minI].push(s)
        }
        centroids = clusters.map((cluster, i) => {
          if (!cluster.length) return centroids[i]
          return {
            r: Math.round(cluster.reduce((a, c) => a + c.r, 0) / cluster.length),
            g: Math.round(cluster.reduce((a, c) => a + c.g, 0) / cluster.length),
            b: Math.round(cluster.reduce((a, c) => a + c.b, 0) / cluster.length),
          }
        })
      }

      // Score: prefer vibrant mid-brightness colors; penalize near-black and near-white/gray
      const score = (c: RGB) => {
        const max = Math.max(c.r, c.g, c.b)
        const min = Math.min(c.r, c.g, c.b)
        const brightness = (c.r + c.g + c.b) / 3
        if (brightness < 18) return 0
        if (brightness > 230 && max - min < 25) return 0.05
        return (max - min) / (max + 1)
      }

      centroids.sort((a, b) => score(b) - score(a))
      setBgGlows(centroids)
      setGlowKey(k => k + 1)
    } catch (e) {
      // a cover that won't decode just means no new colours this time
      console.warn('[walkman] couldn’t read the cover colours', e)
    }
  }, [])

  const processUrl = useCallback((trimmed: string) => {
    // nothing usable to play: open the deck instead of scolding. Short text
    // (probably a song name) goes straight in as a search.
    if (!trimmed) { openDeck(); return }
    const id = extractVideoId(trimmed)
    if (!id) { openDeck(trimmed.length <= 80 ? trimmed : undefined); return }
    setToast(null)
    setUrl(trimmed)
    currentUrlRef.current = trimmed
    scrollTextRef.current = ''
    setCurrentId(id)
    setThumbUrl(`https://img.youtube.com/vi/${id}/hqdefault.jpg`)
    extractColors(id)
    updateDisplayRef.current?.('LOADING..', false)
    setDisplayStatus('LOADING')
    if (playerReadyRef.current && window.ytPlayer?.loadVideoById) {
      window.ytPlayer.mute()
      window.ytPlayer.loadVideoById(id)
      window.ytPlayer.playVideo()
    } else {
      pendingVideoRef.current = id
    }
  }, [extractColors, setDisplayStatus, openDeck])

  // a tape from the deck: show its name on the LCD right away
  const playTape = useCallback((t: Tape) => {
    processUrl(`https://youtu.be/${t.id}`)
    if (t.title !== 'Play this link') scrollTextRef.current = lcdText(t.title, t.author)
  }, [processUrl])

  // paste anywhere on the page: a link plays, plain text becomes a search
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      const text = e.clipboardData?.getData('text')?.trim() ?? ''
      if (!text) return
      e.preventDefault()
      processUrl(text)
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [processUrl])

  const stableHandlePasteClick = useCallback(async () => {
    // Mobile: clipboard reads are unreliable over HTTP, so always open the
    // input popup fresh. This also lets the user paste a NEW link after one
    // has already played (the old behavior re-loaded the stale URL instead).
    if (isMobile) {
      openDeck()
      return
    }
    // Desktop: clipboard read works (sticky user activation).
    let trimmed = ''
    try {
      const clip = await navigator.clipboard.readText()
      trimmed = clip.trim()
    } catch { /* clipboard permission denied */ }
    if (!trimmed) trimmed = urlRef.current.trim()
    processUrl(trimmed)
  }, [isMobile, processUrl, openDeck])

  const bgBase = themeMode === 'album' ? `rgb(${albumRoom.join(',')})` : darkBg ? '#000000' : '#ffffff'
  const bgRgb: [number, number, number] = themeMode === 'album' ? [albumRoom[0] / 255, albumRoom[1] / 255, albumRoom[2] / 255] : darkBg ? [0, 0, 0] : [1, 1, 1]
  const vizPalette = useMemo(() => resolvePalette(vizSettings.palette, darkBg, bgGlows), [vizSettings.palette, darkBg, bgGlows])
  const albumSwatches = useMemo(() => bgGlows.slice(0, 4).map((c) => `rgb(${c.r},${c.g},${c.b})`), [bgGlows])

  return (
    <div style={{ width: '100vw', height: '100vh', background: bgBase, transition: 'background 0.6s ease', position: 'relative', overflow: 'hidden' }}>
      <style>{`
        div:has(> nav[aria-label="Main"]) { transition: opacity 0.35s ease, transform 0.45s cubic-bezier(0.22, 1, 0.36, 1); }
        html[data-walkman-fs] div:has(> nav[aria-label="Main"]) { opacity: 0; transform: translateY(-120%); pointer-events: none !important; }
        html[data-walkman-fs] div:has(> nav[aria-label="Main"]) * { pointer-events: none !important; }
        .wm-back { display: block; border-radius: 18px; text-decoration: none; }
        .wm-back-key { width: 36px; height: 36px; border-radius: 18px; display: flex; align-items: center; justify-content: center; color: #1fa83a;
          border: 1px solid #b0b0b0; background: linear-gradient(145deg, #e8e8e8, #c8c8c8); box-shadow: 3px 3px 6px #b0b0b0, -2px -2px 5px #f4f4f4; transition: all 0.1s; }
        .wm-back[data-dark='true'] .wm-back-key { color: rgba(62,255,82,0.7); border-color: #1b1b26; background: linear-gradient(145deg, #393944, #2b2b36); box-shadow: 3px 3px 6px #11111a, -2px -2px 5px #373742; }
        .wm-back:hover .wm-back-key { color: #0f9a2c; }
        .wm-back[data-dark='true']:hover .wm-back-key { color: #3EFF52; filter: drop-shadow(0 0 3px rgba(62,255,82,0.5)); }
        .wm-back:active .wm-back-key { box-shadow: inset 2px 2px 4px #a8a8a8, inset -1px -1px 3px #f0f0f0; }
        .wm-back[data-dark='true']:active .wm-back-key { box-shadow: inset 2px 2px 4px #11111a, inset -1px -1px 3px #373742; }
        .wm-back:focus-visible { outline: 2px solid #3EFF52; outline-offset: 2px; }
        @keyframes reelSpin {
          to { transform: rotate(360deg); }
        }
        @keyframes iconPop {
          0%   { opacity: 0; transform: scale(0.55) rotate(-15deg); }
          100% { opacity: 1; transform: scale(1) rotate(0deg); }
        }
        @keyframes toastIn {
          0%   { opacity: 0; transform: translateX(-50%) translateY(-12px); }
          100% { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        @keyframes ambientFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        html[data-cassette-dark] {
          scrollbar-color: rgba(255,255,255,0.22) #0d0d0d;
          scrollbar-width: thin;
        }
        html[data-cassette-dark]::-webkit-scrollbar {
          width: 8px;
        }
        html[data-cassette-dark]::-webkit-scrollbar-track {
          background: #0d0d0d;
        }
        html[data-cassette-dark]::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.22);
          border-radius: 4px;
        }
        html[data-cassette-dark]::-webkit-scrollbar-thumb:hover {
          background: rgba(255,255,255,0.4);
        }
        @keyframes ambientDrift0 {
          0%,100% { transform: translate(-50%,-50%) scale(1); }
          50%     { transform: translate(calc(-50% - 3.5vw), calc(-50% + 2vh)) scale(1.14); }
        }
        @keyframes ambientDrift1 {
          0%,100% { transform: translate(-50%,-50%) scale(1.06); }
          50%     { transform: translate(calc(-50% + 4vw), calc(-50% - 3.5vh)) scale(0.88); }
        }
        @keyframes ambientDrift2 {
          0%,100% { transform: translate(-50%,-50%) scale(0.94); }
          50%     { transform: translate(calc(-50% - 2.5vw), calc(-50% - 4vh)) scale(1.1); }
        }
        @keyframes ambientDrift3 {
          0%,100% { transform: translate(-50%,-50%) scale(1.08); }
          50%     { transform: translate(calc(-50% + 3vw), calc(-50% + 3.5vh)) scale(0.87); }
        }
        @keyframes ambientDrift4 {
          0%,100% { transform: translate(-50%,-50%) scale(1); }
          50%     { transform: translate(calc(-50% + 1.5vw), calc(-50% - 2.5vh)) scale(1.12); }
        }
        @keyframes textShine {
          0%   { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
      `}</style>

      <WalkmanLoaderOverlay darkBg={darkBg} />
      <CursorLabel control={hoverControl} playing={displayStatus === 'PLAYING'} muted={isMuted} darkBg={darkBg} />

      <div style={{ position: 'fixed', top: 0, left: 0, width: 1, height: 1, opacity: 0, pointerEvents: 'none', overflow: 'hidden' }}>
        <div id="yt-player" />
      </div>

      {/* audio-reactive background (replaces the old drifting colour blobs) */}
      <VisualizerBG settings={vizSettings} palette={vizPalette} darkBg={darkBg} bg={bgRgb} videoId={currentId}
        hasTrack={!!thumbUrl} signal={signalRef.current!} />
      <Console
        darkBg={darkBg} theme={themeMode} onTheme={setThemeMode} albumRoom={albumRoom} isFullscreen={isFullscreen} onFullscreen={toggleFullscreen} isMobile={isMobile} deckOpen={deckOpen}
        settings={vizSettings} onChange={updateViz} albumColors={albumSwatches} trackStatus={trackStatus}
        signal={signalRef.current!} status={displayStatus} thumbUrl={thumbUrl} meta={videoMeta}
        onPlayPause={handlePlayPause} onRewind={handleRewind} onForward={handleForward} onStop={handleStop} onInsert={() => openDeck()} />

      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: '55%',
        background: `linear-gradient(to top, ${bgBase} 0%, transparent 100%)`,
        transition: 'background 0.6s ease', pointerEvents: 'none', zIndex: 2,
      }} />

      <Canvas
        camera={{ position: isMobile ? [0, 0.88, 22] : [0, 0.88, 11.32], fov: isMobile ? 36 : 43 }}
        gl={{ antialias: true, powerPreference: 'high-performance', stencil: false, depth: true, alpha: true }}
        frameloop="demand"
        dpr={dpr}
        style={{ position: 'relative', zIndex: 1 }}
      >
        {/* drop resolution on devices that can't hold the frame rate */}
        <PerformanceMonitor onDecline={() => setDpr(1)} onIncline={() => setDpr(1.5)} flipflops={3} onFallback={() => setDpr(1)} />
        <ambientLight intensity={0.6} />
        <directionalLight position={[6.99, 20, -3.2]} intensity={3.06} />

        <Suspense fallback={null}>
          <WalkmanModel
            onPasteClick={stableHandlePasteClick}
            onPlayPause={handlePlayPause}
            onMuteToggle={handleMuteToggle}
            onStop={handleStop}
            onForward={handleForward}
            onRewind={handleRewind}
            onVolumeChange={handleVolumeChange}
            onVolumeEnd={handleVolumeEnd}
            devParamsRef={devParamsRef}
            darkBg={darkBg}
            onReady={(fn, redraw, startScroll) => { updateDisplayRef.current = fn; redrawCurrentRef.current = redraw; startScrollRef.current = startScroll }}
            onHoverControl={setHoverControl}
            hoverBeat={hoverBeat}
            modelBeat={modelBeat}
            albumId={thumbUrl ? currentId : null}
          />
          <SoftShadow />
          <Environment preset="studio" resolution={64} />
        </Suspense>

        <OrbitControls
          ref={controlsRef}
          enablePan={false}
          minDistance={isMobile ? 6 : 4}
          maxDistance={isMobile ? 22 : 18}
          minPolarAngle={Math.PI * 0.05}
          maxPolarAngle={Math.PI * 0.85}
          enableDamping
          dampingFactor={0.06}
          regress
        />
      </Canvas>

      {/* back to the Lab: a single hardware key, same as the search bar's */}
      <Link href="/lab" aria-label="Back to Lab" className="wm-back" data-dark={darkBg}
        style={{ position: 'absolute', top: isMobile && !isFullscreen ? 72 : isMobile ? 14 : 20, left: isMobile ? 14 : 20, zIndex: 30, transition: 'top 0.45s cubic-bezier(0.22, 1, 0.36, 1)' }}>
        <span className="wm-back-key" aria-hidden>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M15 5l-7 7 7 7" /></svg>
        </span>
      </Link>

      <div
        style={{
          // phones: bottom-left, beside the tape module in the corner
          position: 'absolute', bottom: isMobile ? 'calc(16px + env(safe-area-inset-bottom))' : '2rem', left: isMobile ? 12 : '50%',
          transform: isMobile ? 'none' : 'translateX(-50%)',
          zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: isMobile ? 'flex-start' : 'center', gap: '0.45rem',
        }}
      >
        <TapeDeck darkBg={darkBg} isMobile={isMobile} currentId={currentId} compact={isFullscreen || displayStatus === 'PLAYING'}
          playing={displayStatus === 'PLAYING'} onPick={playTape} openSignal={deckSignal} onOpenChange={setDeckOpen} />
      </div>

      {/* <DevPanel devParamsRef={devParamsRef} onParamsChange={() => redrawCurrentRef.current?.()} /> */}

      {/* Toast — slides in from top, stays until dismissed */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            top: isMobile ? '4.5rem' : '5.5rem',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 99998,
            width: 'calc(100% - 2rem)',
            maxWidth: '360px',
            background: 'rgba(255,255,255,0.48)',
            border: '1px solid rgba(255,255,255,0.55)',
            borderRadius: '12px',
            padding: '0.8rem 0.9rem',
            boxShadow: '0 8px 32px rgba(0,0,0,0.14)',
            backdropFilter: 'blur(22px)',
            WebkitBackdropFilter: 'blur(22px)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.7rem',
            animation: 'toastIn 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          {toast.thumb && (
            <div style={{
              flexShrink: 0,
              width: '44px', height: '44px',
              borderRadius: '8px',
              overflow: 'hidden',
              border: darkBg ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.07)',
              position: 'relative',
            }}>
              <img src={toast.thumb} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scale(1.38)', transformOrigin: 'center', filter: 'grayscale(0.35) brightness(0.65)' }} />
              <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="8" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </div>
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Row 1: icon + title inline */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', paddingRight: '1.4rem' }}>
              {!toast.thumb && (
                <img src="/images/lab/youtube-color-icon.svg" alt="" style={{ flexShrink: 0, width: 18, height: 18 }} />
              )}
              <span style={{
                fontFamily: 'FunnelDisplay, sans-serif',
                fontSize: '13px', fontWeight: 600,
                color: 'rgba(0,0,0,0.82)',
                lineHeight: 1.3,
              }}>
                {toast.title}
              </span>
            </div>
            {/* Row 2: hint */}
            <div style={{
              fontFamily: '"Courier New", monospace',
              fontSize: '10.5px',
              letterSpacing: '0.02em',
              color: 'rgba(0,0,0,0.48)',
              lineHeight: 1.5,
              marginTop: '5px',
            }}>
              {toast.hint}
            </div>
          </div>
          <button
            onClick={() => setToast(null)}
            aria-label="Dismiss"
            style={{
              position: 'absolute',
              top: '0.5rem', right: '0.5rem',
              width: '20px', height: '20px',
              padding: 0, border: 'none',
              borderRadius: '50%',
              background: 'rgba(0,0,0,0.06)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(0,0,0,0.4)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}

    </div>
  )
}
