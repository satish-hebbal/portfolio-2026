"use client"

import Image from 'next/image'
import { useEffect, useRef } from 'react'
import { onScrollFrame, prefersReducedMotion } from '@/lib/motion'

/*
 * An engraved hero figure that turns into print dots under the pointer.
 *
 * At rest this is just the <img>: nothing runs. When the pointer comes near,
 * a canvas takes over and redraws the figure every frame with two layers:
 *
 *   the engraving  the same image, erased in a soft disc around the pointer
 *   the dither     an Atkinson-dithered grid of the figure, drawn only inside
 *                  that disc, its cells thrown outward and healing back
 *
 * Points the pointer has passed keep their disc for a moment and heal on an
 * ease-out, so a quick stroke leaves a wake of loose dots behind it. Once the
 * last one has healed the canvas hides, the <img> comes back and the loop stops.
 *
 * Adapted from the scatter field in the Mockup Studio ASCII tool: each cell's
 * throw direction comes from a hash of its grid position, so the cloud moves
 * with the pointer as one piece instead of boiling, and a cell takes the
 * strongest influence on it rather than the sum, so a slow stroke can't fling
 * it off the figure.
 */

/** Grid cell in CSS px. Small enough to read as dither, big enough to see. */
const CELL = 4
/** Reach of the pointer in CSS px. */
const RADIUS = 120
/** How far a fully disturbed cell is thrown, as a share of the radius. */
const THROW = 0.35
/** How long a spot the pointer left takes to settle back. */
const HEAL_MS = 900
/** How long the disc takes to grow when the pointer arrives. */
const ENTER_MS = 180
/** Trail points are dropped this far apart, as a share of the radius. */
const SPACING = 0.2
const MAX_STAMPS = 40
const INK = '#0a0a0a'

const easeOut = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3)

function hash2(x: number, y: number, salt: number): number {
  let h = (x * 374761393 + y * 668265263 + salt * 2246822519) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  h = h ^ (h >>> 16)
  return ((h >>> 0) % 100000) / 100000
}

interface Grid {
  w: number
  h: number
  // one entry per inked cell: top-left in CSS px, and its fixed throw vector
  x: Float32Array
  y: Float32Array
  tx: Float32Array
  ty: Float32Array
  count: number
}

/**
 * Downsample the figure to the cell grid and dither it to 1-bit.
 *
 * Tone is darkness times coverage, so transparent margins carry no ink.
 * Error is only diffused onto cells inside the silhouette, otherwise it
 * leaks out as stray dots in the empty space around the figure.
 */
function buildGrid(img: HTMLImageElement, w: number, h: number): Grid {
  const cols = Math.ceil(w / CELL)
  const rows = Math.ceil(h / CELL)
  const c = document.createElement('canvas')
  c.width = cols
  c.height = rows
  const cx = c.getContext('2d', { willReadFrequently: true })!
  cx.drawImage(img, 0, 0, cols, rows)
  const px = cx.getImageData(0, 0, cols, rows).data

  const tone = new Float32Array(cols * rows)
  const inside = new Uint8Array(cols * rows)
  for (let i = 0; i < cols * rows; i++) {
    const a = px[i * 4 + 3] / 255
    if (a < 0.15) continue
    inside[i] = 1
    const lum = (0.2126 * px[i * 4] + 0.7152 * px[i * 4 + 1] + 0.0722 * px[i * 4 + 2]) / 255
    // a little contrast, so the hatched mid-tones don't all collapse to 50%
    tone[i] = Math.min(1, Math.max(0, ((1 - lum) * a - 0.08) / 0.8))
  }

  // Atkinson: six neighbours, 1/8 each; the missing quarter keeps whites clean
  const taps = [[1, 0], [2, 0], [-1, 1], [0, 1], [1, 1], [0, 2]]
  const ink: number[] = []
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const i = y * cols + x
      if (!inside[i]) continue
      const v = tone[i]
      const on = v >= 0.5 ? 1 : 0
      if (on) ink.push(i)
      const err = (v - on) / 8
      for (const [dx, dy] of taps) {
        const nx = x + dx, ny = y + dy
        if (nx < 0 || nx >= cols || ny >= rows) continue
        const j = ny * cols + nx
        if (inside[j]) tone[j] += err
      }
    }
  }

  const n = ink.length
  const grid: Grid = { w, h, x: new Float32Array(n), y: new Float32Array(n), tx: new Float32Array(n), ty: new Float32Array(n), count: n }
  for (let k = 0; k < n; k++) {
    const col = ink[k] % cols, row = (ink[k] / cols) | 0
    const angle = hash2(col, row, 31) * Math.PI * 2
    // square root so thrown cells fill the disc evenly instead of bunching
    const dist = Math.sqrt(hash2(col, row, 32)) * THROW * RADIUS
    grid.x[k] = col * CELL
    grid.y[k] = row * CELL
    grid.tx[k] = Math.cos(angle) * dist
    grid.ty[k] = Math.sin(angle) * dist
  }
  return grid
}

type Props = {
  src: string
  natW: number
  natH: number
  sizes: string
  className?: string
}

export default function DitherFigure({ src, natW, natH, sizes, className }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const wrap = wrapRef.current, canvas = canvasRef.current
    if (!wrap || !canvas) return
    // a dissolving figure is motion, and touch has no hover to follow
    if (prefersReducedMotion() || !window.matchMedia('(pointer: fine)').matches) return

    const ctx = canvas.getContext('2d')!
    let img: HTMLImageElement | null = null
    let grid: Grid | null = null
    let frame = 0
    let pointer: { x: number; y: number } | null = null
    let head: { x: number; y: number } | null = null
    let dropped = { x: 0, y: 0 }
    let enteredAt = 0
    let stamps: { x: number; y: number; t: number }[] = []
    let showing = false

    const setup = () => {
      img = wrap.querySelector('img')
      if (!img || !img.complete || !img.naturalWidth) return
      const w = wrap.clientWidth, h = wrap.clientHeight
      if (!w || !h) return
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      grid = buildGrid(img, w, h)
    }

    const show = (on: boolean) => {
      if (on === showing || !img) return
      showing = on
      canvas.style.visibility = on ? 'visible' : 'hidden'
      img.style.visibility = on ? 'hidden' : 'visible'
    }

    // Client point -> figure-local point. The figure sits inside a rotated,
    // parallax-translated wrapper; rotation and translation are about the
    // element's centre, so its bounding-box centre is its true centre.
    const toLocal = (px: number, py: number) => {
      const t = getComputedStyle(wrap.parentElement!).transform
      const m = new DOMMatrix(t === 'none' ? undefined : t)
      const theta = Math.atan2(m.b, m.a)
      const r = wrap.getBoundingClientRect()
      const dx = px - (r.left + r.width / 2), dy = py - (r.top + r.height / 2)
      const cos = Math.cos(-theta), sin = Math.sin(-theta)
      return { x: dx * cos - dy * sin + wrap.clientWidth / 2, y: dx * sin + dy * cos + wrap.clientHeight / 2 }
    }

    const track = (now: number) => {
      if (!pointer || !grid) return
      const p = toLocal(pointer.x, pointer.y)
      const near = p.x > -RADIUS && p.y > -RADIUS && p.x < grid.w + RADIUS && p.y < grid.h + RADIUS
      if (!near) {
        if (head) stamps.push({ x: head.x, y: head.y, t: now })
        head = null
        return
      }
      if (!head) {
        enteredAt = now
        dropped = p
      } else if (Math.hypot(p.x - dropped.x, p.y - dropped.y) >= RADIUS * SPACING) {
        stamps.push({ x: dropped.x, y: dropped.y, t: now })
        if (stamps.length > MAX_STAMPS) stamps.shift()
        dropped = p
      }
      head = p
    }

    const draw = (now: number) => {
      frame = 0
      if (!grid || !img) return
      track(now)
      stamps = stamps.filter((s) => now - s.t <= HEAL_MS)

      const sources: { x: number; y: number; a: number }[] = []
      for (const s of stamps) {
        const a = 1 - easeOut((now - s.t) / HEAL_MS)
        if (a > 0.01) sources.push({ x: s.x, y: s.y, a })
      }
      if (head) sources.push({ x: head.x, y: head.y, a: easeOut((now - enteredAt) / ENTER_MS) })

      if (!sources.length) { show(false); return }
      show(true)

      const { w, h } = grid
      ctx.globalCompositeOperation = 'source-over'
      ctx.globalAlpha = 1
      ctx.clearRect(0, 0, w, h)
      ctx.drawImage(img, 0, 0, w, h)

      // erase the engraving where the dither is about to be, with the same
      // (1 - d²/R²)² falloff the cells use, so the two cross-fade at the rim
      ctx.globalCompositeOperation = 'destination-out'
      for (const s of sources) {
        const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, RADIUS)
        g.addColorStop(0, `rgba(0,0,0,${s.a})`)
        g.addColorStop(0.5, `rgba(0,0,0,${s.a * 0.56})`)
        g.addColorStop(0.75, `rgba(0,0,0,${s.a * 0.19})`)
        g.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.fillStyle = g
        ctx.fillRect(s.x - RADIUS, s.y - RADIUS, RADIUS * 2, RADIUS * 2)
      }

      ctx.globalCompositeOperation = 'source-over'
      ctx.fillStyle = INK
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
      for (const s of sources) {
        x0 = Math.min(x0, s.x - RADIUS); y0 = Math.min(y0, s.y - RADIUS)
        x1 = Math.max(x1, s.x + RADIUS); y1 = Math.max(y1, s.y + RADIUS)
      }
      const R2 = RADIUS * RADIUS
      const size = CELL - 1
      for (let i = 0; i < grid.count; i++) {
        const cx = grid.x[i] + CELL / 2, cy = grid.y[i] + CELL / 2
        if (cx < x0 || cx > x1 || cy < y0 || cy > y1) continue
        let k = 0
        for (const s of sources) {
          const dx = cx - s.x, dy = cy - s.y
          const d2 = dx * dx + dy * dy
          if (d2 >= R2) continue
          const f = 1 - d2 / R2
          const v = s.a * f * f
          if (v > k) k = v
        }
        if (k <= 0.02) continue
        ctx.globalAlpha = Math.min(1, k * 2.5)
        ctx.fillRect(grid.x[i] + grid.tx[i] * k, grid.y[i] + grid.ty[i] * k, size, size)
      }
      ctx.globalAlpha = 1

      // Keep going only while something is still changing by itself: a trail
      // healing or the disc growing in. A resting pointer draws once and stops;
      // the next move or scroll starts the loop again.
      if (stamps.length || (head && now - enteredAt < ENTER_MS)) frame = requestAnimationFrame(draw)
    }

    const kick = () => { if (!frame && grid) frame = requestAnimationFrame(draw) }

    const onMove = (e: MouseEvent) => { pointer = { x: e.clientX, y: e.clientY }; kick() }
    const onLeave = () => { pointer = null; if (head) { stamps.push({ ...head, t: performance.now() }); head = null } }

    const ready = () => setup()
    const imgEl = wrap.querySelector('img')
    if (imgEl?.complete) ready()
    else imgEl?.addEventListener('load', ready, { once: true })

    let resizeTimer: ReturnType<typeof setTimeout> | undefined
    const onResize = () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(setup, 150) }

    window.addEventListener('mousemove', onMove, { passive: true })
    document.documentElement.addEventListener('mouseleave', onLeave)
    window.addEventListener('resize', onResize)
    // the figure drifts on scroll while the mouse holds still; re-aim at it
    const unScroll = onScrollFrame(() => { if (pointer) kick() })

    return () => {
      window.removeEventListener('mousemove', onMove)
      document.documentElement.removeEventListener('mouseleave', onLeave)
      window.removeEventListener('resize', onResize)
      imgEl?.removeEventListener('load', ready)
      unScroll()
      clearTimeout(resizeTimer)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [])

  return (
    <div ref={wrapRef} className="relative">
      <Image src={src} alt="" width={natW} height={natH} loading="lazy" fetchPriority="high" sizes={sizes} className={className} />
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ visibility: 'hidden' }}
      />
    </div>
  )
}
