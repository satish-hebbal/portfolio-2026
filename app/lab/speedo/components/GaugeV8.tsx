'use client'

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'

export interface GaugeV8Handle {
  setValue: (v: number) => void
}

interface Props {
  size: number
  min: number
  max: number
  majorStep: number
  minorPerMajor: number
  labelDivisor?: number
  redlineStart?: number
  startDeg?: number      // angle of `min` (canvas degrees, 0 = east, + = clockwise)
  sweepDeg?: number      // total span to `max`
  accent?: string        // needle + redline
  arcColor?: string      // illuminated progress arc
  tickColor?: string
  smoothing?: number
  labelScale?: number
  numbers?: boolean      // draw numeric labels
  numberFontFamily?: string // override the numeral font (default FunnelDisplay)
  tickLenScale?: number  // scale graduation lengths (1 = default)
  numberInset?: number   // numeral radius = tickOuter - size * numberInset (default 0.155)
  rimWidth?: number      // bezel thickness as a fraction of size (default 0.085)
  bare?: boolean         // rim + face only (no ticks / needle) — used by the gear dial
  screenDeg?: [number, number] // angular sector rendered as a flat dark screen
  powered?: boolean      // backlight on — needle glow + progress glow illuminate
  warnStart?: number     // value past which the progress glow blends arc→accent (red)
}

const DPR = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2.5) : 1
const rad = (d: number) => (d * Math.PI) / 180
const withA = (hex: string, a: number) => {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.split('').map(x => x + x).join('') : h, 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`
}
// blend two hex colours (t: 0 → a, 1 → b), returns a 6-digit hex
const mixHex = (a: string, b: string, t: number) => {
  const pa = parseInt(a.replace('#', ''), 16), pb = parseInt(b.replace('#', ''), 16)
  const r = Math.round(((pa >> 16) & 255) + (((pb >> 16) & 255) - ((pa >> 16) & 255)) * t)
  const g = Math.round(((pa >> 8) & 255) + (((pb >> 8) & 255) - ((pa >> 8) & 255)) * t)
  const bl = Math.round((pa & 255) + ((pb & 255) - (pa & 255)) * t)
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1)
}

/**
 * V8 instrument dial — machined dark-bronze/silver bezel, deeply detailed
 * multi-layer graduations, tangentially-rotated numerals, optional flat LCD
 * sector cut into the face (for the tach's bottom screen).
 */
const GaugeV8 = forwardRef<GaugeV8Handle, Props>(function GaugeV8(
  {
    size, min, max, majorStep, minorPerMajor, labelDivisor = 1, redlineStart,
    startDeg = 150, sweepDeg = 240, accent = '#ff3b2a', arcColor = '#ffc24d',
    tickColor = '#f1ebdf', smoothing = 0.2, labelScale = 1, numbers = true,
    rimWidth = 0.085, bare = false, screenDeg, powered = true, warnStart,
    numberFontFamily, tickLenScale = 1, numberInset = 0.155,
  },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const staticRef = useRef<HTMLCanvasElement | null>(null)
  const target = useRef(min)
  const display = useRef(min)
  const rafRef = useRef(0)

  useImperativeHandle(ref, () => ({ setValue: (v) => { target.current = v } }), [])

  // canvas doesn't trigger a webfont load and silently falls back; when a custom
  // numeral font is requested, wait for it then redraw the static layer
  const [fontReady, setFontReady] = useState(0)
  useEffect(() => {
    if (!numberFontFamily || typeof document === 'undefined' || !('fonts' in document)) return
    let alive = true
    document.fonts.load(`24px ${numberFontFamily}`).then(() => { if (alive) setFontReady((t) => t + 1) }).catch(() => {})
    return () => { alive = false }
  }, [numberFontFamily])

  const valToAngle = (v: number) => rad(startDeg + ((v - min) / (max - min)) * sweepDeg)

  // ── static layer: bezel, face, screen sector, graduations, numbers ──
  useEffect(() => {
    const px = size * DPR
    const off = document.createElement('canvas')
    off.width = px; off.height = px
    const c = off.getContext('2d')!
    c.scale(DPR, DPR)
    const R = size / 2
    const cx = R, cy = R

    // ── brushed-silver metal bezel: conic sheen + top-lit radial + specular ──
    const rimOuter = R - 1
    const rimInner = R - size * rimWidth
    const conic = c.createConicGradient(rad(-95), cx, cy)
    const stops: [number, string][] = [
      [0.00, '#31343a'], [0.06, '#777d86'], [0.12, '#c3c9d1'], [0.18, '#eef1f6'],
      [0.25, '#9aa0a9'], [0.30, '#7b818a'], [0.40, '#34373d'],
      [0.50, '#5b6068'], [0.58, '#c9cfd7'], [0.63, '#f3f6fb'], [0.70, '#838991'],
      [0.80, '#2f3238'], [0.88, '#777d86'], [0.94, '#c3c9d1'], [1.00, '#31343a'],
    ]
    for (const [o, col] of stops) conic.addColorStop(o, col)
    c.beginPath(); c.arc(cx, cy, rimOuter, 0, Math.PI * 2); c.fillStyle = conic; c.fill()

    // fine brushed-metal striations (concentric hairlines on the rim)
    c.save(); c.beginPath(); c.arc(cx, cy, rimOuter, 0, Math.PI * 2)
    c.arc(cx, cy, rimInner, 0, Math.PI * 2); c.clip('evenodd')
    c.globalAlpha = 0.06
    for (let r = rimInner; r < rimOuter; r += 1.4) {
      c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2)
      c.lineWidth = 0.7; c.strokeStyle = (r % 2.8 < 1.4) ? '#ffffff' : '#000000'; c.stroke()
    }
    c.restore()

    // top-down lighting wash over the metal
    const lit = c.createLinearGradient(0, 0, 0, size)
    lit.addColorStop(0, 'rgba(255,255,255,0.5)')
    lit.addColorStop(0.4, 'rgba(255,255,255,0)')
    lit.addColorStop(0.62, 'rgba(0,0,0,0)')
    lit.addColorStop(1, 'rgba(0,0,0,0.55)')
    c.save(); c.beginPath(); c.arc(cx, cy, rimOuter, 0, Math.PI * 2); c.clip()
    c.fillStyle = lit; c.fillRect(0, 0, size, size); c.restore()

    // bright specular sweep across the top of the rim
    c.save()
    c.beginPath(); c.arc(cx, cy, (rimOuter + rimInner) / 2, rad(198), rad(342))
    c.lineWidth = size * rimWidth * 0.62; c.lineCap = 'round'
    c.strokeStyle = 'rgba(255,255,255,0.62)'
    c.shadowColor = 'rgba(235,242,255,0.6)'; c.shadowBlur = size * 0.03
    c.stroke(); c.restore()

    // inner bevel groove
    c.beginPath(); c.arc(cx, cy, rimInner, 0, Math.PI * 2)
    c.lineWidth = size * 0.012; c.strokeStyle = 'rgba(0,0,0,0.72)'; c.stroke()
    c.beginPath(); c.arc(cx, cy, rimInner - size * 0.006, 0, Math.PI * 2)
    c.lineWidth = size * 0.004; c.strokeStyle = 'rgba(210,220,235,0.28)'; c.stroke()

    // ── dial face ──
    const faceR = rimInner - size * 0.01
    const face = c.createRadialGradient(cx, cy - faceR * 0.34, faceR * 0.08, cx, cy, faceR)
    face.addColorStop(0, '#1b1c1f')
    face.addColorStop(0.5, '#111214')
    face.addColorStop(1, '#070708')
    c.beginPath(); c.arc(cx, cy, faceR, 0, Math.PI * 2); c.fillStyle = face; c.fill()

    // faint concentric machine rings on the face
    c.save(); c.beginPath(); c.arc(cx, cy, faceR, 0, Math.PI * 2); c.clip()
    c.strokeStyle = 'rgba(255,255,255,0.015)'; c.lineWidth = 1
    for (let r = faceR * 0.3; r < faceR; r += 4) { c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.stroke() }
    c.restore()

    // bare dial (e.g. gear): rim + face only, no graduations/needle
    if (bare) { staticRef.current = off; return }

    const inScreen = (a: number) => {
      if (!screenDeg) return false
      let [s0, s1] = screenDeg
      let a2 = a
      // normalise into [s0, s0+360)
      while (a2 < s0) a2 += 360
      while (a2 >= s0 + 360) a2 -= 360
      return a2 <= s1
    }

    // ── LCD screen sector cut into the face ──
    if (screenDeg) {
      const [s0, s1] = screenDeg
      const scR = faceR - size * 0.006
      const sector = () => { c.beginPath(); c.moveTo(cx, cy); c.arc(cx, cy, scR, rad(s0), rad(s1)); c.closePath() }
      c.save()
      sector()
      const sg = c.createLinearGradient(0, cy - scR * 0.3, 0, cy + scR)
      sg.addColorStop(0, '#070b10'); sg.addColorStop(0.5, '#05080c'); sg.addColorStop(1, '#0a1016')
      c.fillStyle = sg; c.fill()

      // clip to the screen and lay down LCD detail (horizontal scan lines only)
      c.save(); sector(); c.clip()
      c.strokeStyle = 'rgba(255,255,255,0.05)'; c.lineWidth = 1
      for (let y = cy - scR; y < cy + scR; y += 3) { c.beginPath(); c.moveTo(cx - scR, y); c.lineTo(cx + scR, y); c.stroke() }
      // glossy top sheen
      const sheen = c.createLinearGradient(0, cy - scR * 0.2, 0, cy + scR * 0.55)
      sheen.addColorStop(0, 'rgba(255,255,255,0.05)'); sheen.addColorStop(1, 'rgba(255,255,255,0)')
      c.fillStyle = sheen; c.fillRect(cx - scR, cy - scR, scR * 2, scR * 2)
      c.restore()

      // screen border bevel
      sector(); c.lineWidth = size * 0.006; c.strokeStyle = 'rgba(140,120,80,0.35)'; c.stroke()
      c.restore()
    }

    // ── graduations: ultra-fine + minor + half + major (multi-layered) ──
    const tickOuter = faceR * 0.97
    const subPerMinor = 2 // ultra-fine graduations between minor ticks
    const stepFine = majorStep / minorPerMajor / subPerMinor
    let idx = 0
    for (let v = min; v <= max + 1e-6; v += stepFine, idx++) {
      const a = valToAngle(v)
      const aDeg = (startDeg + ((v - min) / (max - min)) * sweepDeg) % 360
      if (inScreen(aDeg)) continue
      const isMinor = idx % subPerMinor === 0
      const isMajor = Math.abs((v - min) % majorStep) < 1e-6 || Math.abs(((v - min) % majorStep) - majorStep) < 1e-6
      const isHalf = !isMajor && Math.abs((v - min) % (majorStep / 2)) < 1e-6
      const past = redlineStart !== undefined && v >= redlineStart - 1e-6
      const ca = Math.cos(a), sa = Math.sin(a)

      if (isMajor) {
        // dark base + bright core + inner glow dot
        const o = tickOuter, i = tickOuter - size * 0.085 * tickLenScale
        c.beginPath(); c.moveTo(cx + ca * o, cy + sa * o); c.lineTo(cx + ca * i, cy + sa * i)
        c.lineWidth = size * 0.020; c.strokeStyle = 'rgba(0,0,0,0.85)'; c.lineCap = 'butt'; c.stroke()
        c.beginPath(); c.moveTo(cx + ca * o, cy + sa * o); c.lineTo(cx + ca * i, cy + sa * i)
        c.lineWidth = size * 0.010; c.strokeStyle = past ? accent : tickColor
        if (past) { c.shadowColor = accent; c.shadowBlur = size * 0.02 }
        c.stroke(); c.shadowBlur = 0
      } else if (isHalf) {
        const o = tickOuter, i = tickOuter - size * 0.052 * tickLenScale
        c.beginPath(); c.moveTo(cx + ca * o, cy + sa * o); c.lineTo(cx + ca * i, cy + sa * i)
        c.lineWidth = size * 0.0075; c.strokeStyle = past ? accent : 'rgba(225,231,238,0.85)'; c.stroke()
      } else if (isMinor) {
        const o = tickOuter, i = tickOuter - size * 0.034 * tickLenScale
        c.beginPath(); c.moveTo(cx + ca * o, cy + sa * o); c.lineTo(cx + ca * i, cy + sa * i)
        c.lineWidth = size * 0.005; c.strokeStyle = past ? 'rgba(255,90,70,0.8)' : 'rgba(190,198,208,0.6)'; c.stroke()
      } else {
        // ultra-fine hairline
        const o = tickOuter, i = tickOuter - size * 0.016 * tickLenScale
        c.beginPath(); c.moveTo(cx + ca * o, cy + sa * o); c.lineTo(cx + ca * i, cy + sa * i)
        c.lineWidth = 1; c.strokeStyle = past ? 'rgba(255,90,70,0.5)' : 'rgba(150,158,168,0.4)'; c.stroke()
      }
    }

    // redline band hugging the rim inside the redline zone
    if (redlineStart !== undefined) {
      c.beginPath(); c.arc(cx, cy, tickOuter + size * 0.012, valToAngle(redlineStart), valToAngle(max))
      c.lineWidth = size * 0.012; c.strokeStyle = accent
      c.shadowColor = accent; c.shadowBlur = size * 0.02; c.stroke(); c.shadowBlur = 0
    }

    // ── numerals, tangentially rotated ──
    if (numbers) {
      for (let v = min; v <= max + 1e-6; v += majorStep) {
        const a = valToAngle(v)
        const aDeg = (startDeg + ((v - min) / (max - min)) * sweepDeg) % 360
        if (inScreen(aDeg)) continue
        const numR = tickOuter - size * numberInset
        const x = cx + Math.cos(a) * numR, y = cy + Math.sin(a) * numR
        const past = redlineStart !== undefined && v >= redlineStart - 1e-6
        // numerals stay upright (not rotated along the curve). For a custom font
        // we omit the weight prefix (single-weight faces fall back if a weight
        // they don't define is requested).
        const fs = size * 0.085 * labelScale
        const fontStr = numberFontFamily
          ? `${fs}px ${numberFontFamily}, sans-serif`
          : `700 ${fs}px FunnelDisplay, sans-serif`
        const label = String(Math.round(v / labelDivisor))
        // render the numeral on a scratch canvas so we can shave its outline
        // (thin out a heavy face) without erasing the dial behind it
        const box = Math.ceil(fs * 3)
        const tcv = document.createElement('canvas'); tcv.width = box; tcv.height = box
        const tc = tcv.getContext('2d')!
        tc.font = fontStr; tc.textAlign = 'center'; tc.textBaseline = 'middle'
        tc.fillStyle = past ? accent : tickColor
        tc.fillText(label, box / 2, box / 2)
        // carve ~fs*0.045 off each edge → strokes read noticeably thinner
        tc.globalCompositeOperation = 'destination-out'
        tc.lineWidth = fs * 0.09; tc.lineJoin = 'round'; tc.strokeStyle = '#000'
        tc.strokeText(label, box / 2, box / 2)
        c.textAlign = 'center'; c.textBaseline = 'middle'
        c.shadowColor = 'rgba(0,0,0,0.8)'; c.shadowBlur = 3
        c.drawImage(tcv, x - box / 2, y - box / 2)
        c.shadowBlur = 0
      }
    }

    staticRef.current = off
  }, [size, min, max, majorStep, minorPerMajor, labelDivisor, redlineStart, startDeg, sweepDeg, accent, arcColor, tickColor, labelScale, numbers, rimWidth, bare, screenDeg, numberFontFamily, fontReady, tickLenScale, numberInset])

  // ── dynamic layer: progress arc + needle + hub ──
  useEffect(() => {
    const canvas = canvasRef.current!
    canvas.width = size * DPR; canvas.height = size * DPR
    const c = canvas.getContext('2d')!
    const R = size / 2, cx = R, cy = R
    const faceR = R - size * 0.095

    const draw = () => {
      display.current += (target.current - display.current) * smoothing
      const v = display.current
      c.setTransform(DPR, 0, 0, DPR, 0, 0)
      c.clearRect(0, 0, size, size)
      if (staticRef.current) c.drawImage(staticRef.current, 0, 0, size, size)
      if (bare) { rafRef.current = requestAnimationFrame(draw); return }

      const ang = valToAngle(v)
      const inRed = redlineStart !== undefined && v >= redlineStart

      // progress visualization — a gradient that bleeds INWARD from the inner
      // rim across the swept sector (bright at the rim, fading toward center)
      {
        const a0 = valToAngle(min)
        const rOut = faceR * 0.995     // hugs the inner rim
        const rIn = faceR * 0.66       // how far the glow reaches toward center
        let col = inRed ? accent : arcColor
        // gradual orange→red shift once the value climbs past warnStart (e.g.
        // the speedo above 160 km/h) so the glow slowly bleeds to red near the top
        if (warnStart !== undefined && v > warnStart) {
          // reach full red quickly (within ~40 units past warnStart) and bias the
          // curve earlier so it already reads strongly red around 180–200
          const t = Math.min(1, (v - warnStart) / 40)
          col = mixHex(arcColor, accent, Math.pow(t, 0.7))
        }
        if (powered && ang > a0 + 0.001) {
          c.save()
          c.beginPath()
          c.arc(cx, cy, rOut, a0, ang)
          c.arc(cx, cy, rIn, ang, a0, true)
          c.closePath()
          c.clip()
          const rg = c.createRadialGradient(cx, cy, rIn, cx, cy, rOut)
          rg.addColorStop(0, withA(col, 0))
          rg.addColorStop(0.55, withA(col, 0.08))
          rg.addColorStop(0.85, withA(col, 0.34))
          rg.addColorStop(1, withA(col, 0.62))
          c.globalCompositeOperation = 'lighter'
          c.fillStyle = rg
          c.fillRect(cx - rOut, cy - rOut, rOut * 2, rOut * 2)
          // crisp bright lip riding the inner rim
          c.globalCompositeOperation = 'source-over'
          c.beginPath(); c.arc(cx, cy, rOut * 0.985, a0, ang)
          c.lineWidth = size * 0.01; c.lineCap = 'round'
          c.strokeStyle = withA(col, 0.9)
          c.shadowColor = col; c.shadowBlur = size * 0.03
          c.stroke()
          c.restore()
        }
      }

      const ca = Math.cos(ang), sa = Math.sin(ang)
      const px = -sa, py = ca // perpendicular
      const hubR = size * 0.07

      // machined hub cap + center pin — drawn FIRST so the needle rides over EVERYTHING
      const hub = c.createRadialGradient(cx - hubR * 0.3, cy - hubR * 0.3, hubR * 0.1, cx, cy, hubR)
      hub.addColorStop(0, '#e8ebef'); hub.addColorStop(0.45, '#80868e'); hub.addColorStop(1, '#191b1e')
      c.beginPath(); c.arc(cx, cy, hubR, 0, Math.PI * 2); c.fillStyle = hub; c.fill()
      c.lineWidth = 1; c.strokeStyle = 'rgba(0,0,0,0.7)'; c.stroke()
      c.beginPath(); c.arc(cx, cy, hubR * 0.42, 0, Math.PI * 2); c.fillStyle = inRed ? accent : '#141518'; c.fill()

      // needle: tapered blade, SHARP only at the pointing tip; rounded flat rear.
      // Sits completely ON TOP of the hub + pin, with a soft self-illuminating glow.
      const len = faceR * 0.92, tail = faceR * 0.14
      const baseW = size * 0.02      // rear half-width
      const blade = () => {
        c.beginPath()
        c.moveTo(cx + ca * len, cy + sa * len)                                  // sharp tip
        c.lineTo(cx - ca * tail + px * baseW, cy - sa * tail + py * baseW)       // rear-right
        c.quadraticCurveTo(cx - ca * (tail + baseW * 0.9), cy - sa * (tail + baseW * 0.9),
                           cx - ca * tail - px * baseW, cy - sa * tail - py * baseW) // rounded rear-left
        c.closePath()
      }
      // drop shadow pass
      c.save()
      c.shadowColor = 'rgba(0,0,0,0.55)'; c.shadowBlur = size * 0.02; c.shadowOffsetX = 2; c.shadowOffsetY = 3
      blade()
      const ng = c.createLinearGradient(cx - ca * tail, cy - sa * tail, cx + ca * len, cy + sa * len)
      ng.addColorStop(0, '#7a1410'); ng.addColorStop(0.5, accent); ng.addColorStop(1, '#ff7a5a')
      c.fillStyle = ng; c.fill()
      c.restore()
      // self-illuminating glow — only when backlight is on (engine powered)
      if (powered) {
        c.save()
        c.globalCompositeOperation = 'lighter'
        c.shadowColor = inRed ? accent : '#ff6a44'; c.shadowBlur = size * 0.05
        blade(); c.fillStyle = 'rgba(255,90,60,0.35)'; c.fill()
        c.restore()
        // bright filament down the needle spine
        c.beginPath(); c.moveTo(cx - ca * tail, cy - sa * tail); c.lineTo(cx + ca * len, cy + sa * len)
        c.lineWidth = size * 0.004; c.strokeStyle = 'rgba(255,230,210,0.95)'
        c.save(); c.globalCompositeOperation = 'lighter'
        c.shadowColor = accent; c.shadowBlur = size * 0.04; c.stroke(); c.restore()
      }

      rafRef.current = requestAnimationFrame(draw)
    }
    rafRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(rafRef.current)
  }, [size, min, max, redlineStart, accent, arcColor, startDeg, sweepDeg, smoothing, bare, powered, warnStart])

  // position + raised z so a DialHood placed behind tucks under the dial
  return <canvas ref={canvasRef} style={{ width: size, height: size, display: 'block', position: 'relative', zIndex: 1 }} />
})

export default GaugeV8
