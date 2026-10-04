"use client"

import Image from 'next/image'
import { useEffect, useRef } from 'react'
import { onScrollFrame, prefersReducedMotion } from '@/lib/motion'
import { buildGrid, type Grid } from './dither/engine'
import { getSettings, subscribe, GRID_KEYS, type DitherSettings } from './dither/settings'
import { attachShaderReveal } from './dither/shaderReveal'

/*
 * An engraved hero figure that turns into print dots under the pointer.
 *
 * In "lens" mode (the default) this is just the <img> at rest and nothing
 * runs. When the pointer comes near, a canvas takes over and redraws the
 * figure with the engraving erased in a soft disc and a dithered grid of the
 * figure drawn there instead, its cells thrown outward and healing back.
 * Points the pointer has passed keep their disc for a moment, so a stroke
 * leaves a wake. Once everything has healed the canvas hides and the loop
 * stops. "always" keeps the whole figure dithered; "reveal" keeps it dithered
 * and shows the engraving through the disc.
 *
 * Every knob lives in ./dither/settings and can be tuned live from the
 * temporary DitherPanel. The scatter field is adapted from the Mockup Studio
 * ASCII tool: throw direction comes from a hash of each cell's position, so
 * the cloud moves as one piece, and a cell takes the strongest influence on
 * it rather than the sum, so a slow stroke can't fling it off the figure.
 */

const BUCKETS = 10
const easeOut = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3)

type Source = { x: number; y: number; a: number }

type Props = {
  name: 'abhay' | 'tejas'
  src: string
  /** the painted version of the same figure, revealed by the shader effect */
  paintedSrc?: string
  natW: number
  natH: number
  sizes: string
  className?: string
  /** always use the scroll wave instead of hover (the phone figures) */
  wave?: boolean
}

export default function DitherFigure({ name, src, paintedSrc, natW, natH, sizes, className, wave = false }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const glRef = useRef<HTMLCanvasElement>(null)

  // the shader reveal runs on its own WebGL canvas; it stays idle unless the
  // "shader" effect is selected
  useEffect(() => {
    const wrap = wrapRef.current, canvas = glRef.current
    if (!wrap || !canvas || !paintedSrc) return
    if (prefersReducedMotion()) return
    // touch has no hover: there the reveal is a wave that runs with the scroll
    const touch = wave || !window.matchMedia('(pointer: fine)').matches
    return attachShaderReveal(wrap, canvas, name, paintedSrc, touch) ?? undefined
  }, [name, paintedSrc, wave])

  useEffect(() => {
    const wrap = wrapRef.current, canvas = canvasRef.current
    if (!wrap || !canvas) return
    // a dissolving figure is motion, and touch has no hover to follow
    if (prefersReducedMotion() || !window.matchMedia('(pointer: fine)').matches) return

    const ctx = canvas.getContext('2d')!
    // union of the pointer discs, used to cut the engraving in or out
    const mask = document.createElement('canvas')
    const mctx = mask.getContext('2d')!
    let img: HTMLImageElement | null = null
    let grid: Grid | null = null
    let buckets: Int32Array[] = []
    let bucketLen = new Int32Array(BUCKETS + 1)
    let srcIdx = new Int16Array(0)
    let kVal = new Float32Array(0)
    let frame = 0
    let pointer: { x: number; y: number } | null = null
    let head: { x: number; y: number } | null = null
    let dropped = { x: 0, y: 0 }
    let enteredAt = 0
    let stamps: { x: number; y: number; t: number }[] = []
    let theta = 0
    let showing = false

    const isActive = (s: DitherSettings) => s.enabled && s.effect === 'dither' && (s.target === 'both' || s.target === name)

    const setup = () => {
      img = wrap.querySelector('img')
      if (!img || !img.complete || !img.naturalWidth) return
      const w = wrap.clientWidth, h = wrap.clientHeight
      if (!w || !h) return
      const s = getSettings()
      const dpr = Math.min(window.devicePixelRatio || 1, s.dprCap)
      canvas.width = mask.width = Math.round(w * dpr)
      canvas.height = mask.height = Math.round(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      mctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      grid = buildGrid(img, w, h, s)
      const n = Math.max(grid.count, grid.paperCount)
      buckets = Array.from({ length: BUCKETS + 1 }, () => new Int32Array(n))
      bucketLen = new Int32Array(BUCKETS + 1)
      srcIdx = new Int16Array(n)
      kVal = new Float32Array(n)
      kick()
    }

    const show = (on: boolean) => {
      if (on === showing || !img) return
      showing = on
      canvas.style.visibility = on ? 'visible' : 'hidden'
      img.style.visibility = on ? 'hidden' : 'visible'
    }

    // Client point -> figure-local point. The figure sits inside a rotated,
    // parallax-translated wrapper; both are about the element's centre, so its
    // bounding-box centre is its true centre.
    const toLocal = (px: number, py: number) => {
      const t = getComputedStyle(wrap.parentElement!).transform
      const m = new DOMMatrix(t === 'none' ? undefined : t)
      theta = Math.atan2(m.b, m.a)
      const r = wrap.getBoundingClientRect()
      const dx = px - (r.left + r.width / 2), dy = py - (r.top + r.height / 2)
      const cos = Math.cos(-theta), sin = Math.sin(-theta)
      return { x: dx * cos - dy * sin + wrap.clientWidth / 2, y: dx * sin + dy * cos + wrap.clientHeight / 2 }
    }

    const track = (now: number, s: DitherSettings) => {
      if (!grid) return
      const near = (p: { x: number; y: number }) =>
        p.x > -s.radius && p.y > -s.radius && p.x < grid!.w + s.radius && p.y < grid!.h + s.radius
      const p = pointer ? toLocal(pointer.x, pointer.y) : null
      if (!p || !near(p)) {
        if (head && s.trail) stamps.push({ x: head.x, y: head.y, t: now })
        head = null
        return
      }
      if (!head) {
        enteredAt = now
        dropped = p
      } else if (s.trail && Math.hypot(p.x - dropped.x, p.y - dropped.y) >= s.radius * s.spacing) {
        stamps.push({ x: dropped.x, y: dropped.y, t: now })
        while (stamps.length > s.maxStamps) stamps.shift()
        dropped = p
      }
      head = p
    }

    // one cell's shape, added to the current path
    const addShape = (s: DitherSettings, cx: number, cy: number, size: number) => {
      const r = size / 2
      const c = grid!.cell
      switch (s.shape) {
        case 'circle': ctx.moveTo(cx + r, cy); ctx.arc(cx, cy, r, 0, Math.PI * 2); break
        case 'diamond': ctx.moveTo(cx, cy - r); ctx.lineTo(cx + r, cy); ctx.lineTo(cx, cy + r); ctx.lineTo(cx - r, cy); ctx.closePath(); break
        case 'hline': { const th = Math.max(0.6, size * 0.4); ctx.rect(cx - c / 2, cy - th / 2, c, th); break }
        case 'vline': { const th = Math.max(0.6, size * 0.4); ctx.rect(cx - th / 2, cy - c / 2, th, c); break }
        case 'cross': { const th = Math.max(0.6, size * 0.3); ctx.rect(cx - r, cy - th / 2, size, th); ctx.rect(cx - th / 2, cy - r, th, size); break }
        case 'slash': { const th = Math.max(0.6, size * 0.3) / 2; const l = c / 2; ctx.moveTo(cx - l - th, cy + l); ctx.lineTo(cx - l + th, cy + l); ctx.lineTo(cx + l + th, cy - l); ctx.lineTo(cx + l - th, cy - l); ctx.closePath(); break }
        default: ctx.rect(cx - r, cy - r, size, size)
      }
    }

    const draw = (now: number) => {
      frame = 0
      const s = getSettings()
      if (!grid || !img) return
      if (!isActive(s)) { stamps = []; head = null; show(false); return }
      track(now, s)
      stamps = s.trail ? stamps.filter((p) => now - p.t <= s.healMs) : []

      const sources: Source[] = []
      for (const p of stamps) {
        const a = 1 - easeOut((now - p.t) / Math.max(1, s.healMs))
        if (a > 0.01) sources.push({ x: p.x, y: p.y, a })
      }
      if (head) sources.push({ x: head.x, y: head.y, a: s.enterMs > 0 ? easeOut((now - enteredAt) / s.enterMs) : 1 })

      const persistent = s.mode !== 'lens'
      if (!sources.length && !persistent) { show(false); return }
      show(true)

      const { w, h, cell } = grid
      const R = s.radius, R2 = R * R
      ctx.globalCompositeOperation = 'source-over'
      ctx.globalAlpha = 1
      ctx.clearRect(0, 0, w, h)

      // union of the discs, with the same (1 - d²/R²)^falloff curve the cells use
      mctx.clearRect(0, 0, w, h)
      mctx.globalCompositeOperation = 'source-over'
      for (const p of sources) {
        const g = mctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, R)
        for (const r of [0, 0.25, 0.5, 0.75, 0.9, 1]) {
          const v = Math.pow(1 - r * r, s.falloff) * p.a * s.erase
          g.addColorStop(r, `rgba(0,0,0,${Math.min(1, v * (s.mode === 'reveal' ? s.alphaBoost : 1))})`)
        }
        mctx.fillStyle = g
        mctx.fillRect(p.x - R, p.y - R, R * 2, R * 2)
      }

      if (s.mode === 'lens') {
        // engraving with the discs cut out of it
        ctx.drawImage(img, 0, 0, w, h)
        ctx.globalCompositeOperation = 'destination-out'
        ctx.drawImage(mask, 0, 0, w, h)
        ctx.globalCompositeOperation = 'source-over'
      }

      // bounding box of everything the pointer is touching
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
      for (const p of sources) {
        x0 = Math.min(x0, p.x - R); y0 = Math.min(y0, p.y - R)
        x1 = Math.max(x1, p.x + R); y1 = Math.max(y1, p.y + R)
      }
      const influence = (cx: number, cy: number, i: number) => {
        let k = 0, best = -1
        if (cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1) {
          for (let j = 0; j < sources.length; j++) {
            const p = sources[j]
            const dx = cx - p.x, dy = cy - p.y
            const d2 = dx * dx + dy * dy
            if (d2 >= R2) continue
            const v = p.a * Math.pow(1 - d2 / R2, s.falloff)
            if (v > k) { k = v; best = j }
          }
        }
        kVal[i] = k
        srcIdx[i] = best
        return k
      }
      const dotAlpha = (k: number) =>
        s.mode === 'lens' ? Math.min(1, k * s.alphaBoost)
        : s.mode === 'reveal' ? 1 - Math.min(1, k * s.alphaBoost) * s.erase
        : 1

      const flush = (color: string, opacity: number, paint: (i: number) => void) => {
        ctx.fillStyle = color
        for (let b = 1; b <= BUCKETS; b++) {
          const len = bucketLen[b]
          if (!len) continue
          ctx.globalAlpha = (b / BUCKETS) * opacity
          ctx.beginPath()
          const list = buckets[b]
          for (let n = 0; n < len; n++) paint(list[n])
          ctx.fill()
        }
        ctx.globalAlpha = 1
      }

      // optional paper: the blank cells inside the silhouette, never scattered
      if (s.paper) {
        bucketLen.fill(0)
        for (let i = 0; i < grid.paperCount; i++) {
          const k = influence(grid.px[i] + cell / 2, grid.py[i] + cell / 2, i)
          const a = dotAlpha(k)
          const b = Math.round(a * BUCKETS)
          if (b > 0) buckets[b][bucketLen[b]++] = i
        }
        flush(s.paperColor, s.paperOpacity, (i) => ctx.rect(grid!.px[i], grid!.py[i], cell, cell))
      }

      // ink
      bucketLen.fill(0)
      for (let i = 0; i < grid.count; i++) {
        const k = influence(grid.x[i] + cell / 2, grid.y[i] + cell / 2, i)
        const a = dotAlpha(k)
        const b = Math.round(a * BUCKETS)
        if (b > 0) buckets[b][bucketLen[b]++] = i
      }
      const downX = Math.sin(theta), downY = Math.cos(theta) // screen-down in figure space
      flush(s.inkColor, s.inkOpacity, (i) => {
        let cx = grid!.x[i] + cell / 2, cy = grid!.y[i] + cell / 2
        const k = kVal[i]
        if (k > 0.002 && s.scatter !== 'none') {
          // square root so thrown cells fill the disc evenly instead of bunching
          const dist = Math.sqrt(grid!.hb[i]) * s.throw * R * k
          let ux: number, uy: number
          const p = srcIdx[i] >= 0 ? sources[srcIdx[i]] : null
          if (s.scatter === 'random' || !p) {
            const ang = grid!.ha[i] * Math.PI * 2
            ux = Math.cos(ang); uy = Math.sin(ang)
          } else if (s.scatter === 'fall') {
            ux = downX + (grid!.ha[i] - 0.5) * 0.6; uy = downY
          } else {
            const dx = cx - p.x, dy = cy - p.y
            const len = Math.hypot(dx, dy) || 1
            ux = dx / len; uy = dy / len
            if (s.scatter === 'pull') { ux = -ux; uy = -uy }
            if (s.scatter === 'swirl') { const t = ux; ux = -uy; uy = t }
          }
          cx += ux * dist; cy += uy * dist
        }
        if (s.jitter > 0 && k > 0.002) {
          cx += (Math.random() - 0.5) * 2 * s.jitter * k
          cy += (Math.random() - 0.5) * 2 * s.jitter * k
        }
        let size = cell * s.dotScale
        if (s.algo === 'amplitude') size *= Math.sqrt(grid!.tone[i])
        addShape(s, cx, cy, size)
      })

      if (s.mode === 'reveal' && sources.length) {
        // engraving only inside the discs, laid over the dots
        mctx.globalCompositeOperation = 'source-in'
        mctx.drawImage(img, 0, 0, w, h)
        mctx.globalCompositeOperation = 'source-over'
        ctx.drawImage(mask, 0, 0, w, h)
      }

      // Keep going only while something changes by itself: a trail healing,
      // the disc growing in, or jitter. A resting pointer draws once and stops;
      // the next move, scroll or settings change starts the loop again.
      const entering = head && now - enteredAt < s.enterMs
      if (stamps.length || entering || (s.jitter > 0 && sources.length)) frame = requestAnimationFrame(draw)
    }

    const kick = () => { if (!frame && grid) frame = requestAnimationFrame(draw) }

    const onMove = (e: MouseEvent) => { pointer = { x: e.clientX, y: e.clientY }; kick() }
    const onLeave = () => { pointer = null; kick() }

    const imgEl = wrap.querySelector('img')
    if (imgEl?.complete) setup()
    else imgEl?.addEventListener('load', setup, { once: true })

    let resizeTimer: ReturnType<typeof setTimeout> | undefined
    const onResize = () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(setup, 150) }

    // rebuild the grid for tone/algorithm changes, otherwise just redraw
    let rebuildTimer: ReturnType<typeof setTimeout> | undefined
    const unSub = subscribe((_, changed) => {
      if (changed.some((k) => GRID_KEYS.includes(k))) {
        clearTimeout(rebuildTimer)
        rebuildTimer = setTimeout(setup, 60)
      } else kick()
    })

    window.addEventListener('mousemove', onMove, { passive: true })
    document.documentElement.addEventListener('mouseleave', onLeave)
    window.addEventListener('resize', onResize)
    // the figure drifts on scroll while the mouse holds still; re-aim at it
    const unScroll = onScrollFrame(() => { if (pointer || getSettings().mode !== 'lens') kick() })

    return () => {
      window.removeEventListener('mousemove', onMove)
      document.documentElement.removeEventListener('mouseleave', onLeave)
      window.removeEventListener('resize', onResize)
      imgEl?.removeEventListener('load', setup)
      unSub()
      unScroll()
      clearTimeout(resizeTimer)
      clearTimeout(rebuildTimer)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [name])

  return (
    <div ref={wrapRef} className="relative">
      <Image src={src} alt="" width={natW} height={natH} loading="lazy" fetchPriority="high" sizes={sizes} className={className} />
      <canvas
        ref={glRef}
        aria-hidden="true"
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ visibility: 'hidden' }}
      />
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ visibility: 'hidden' }}
      />
    </div>
  )
}
