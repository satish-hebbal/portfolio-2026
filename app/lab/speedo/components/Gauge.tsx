'use client'

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'

export interface GaugeHandle {
  setValue: (v: number) => void
}

interface Props {
  size: number
  min: number
  max: number
  majorStep: number
  minorPerMajor: number
  labelDivisor?: number // numbers shown = value / divisor
  unit?: string
  unitSub?: string
  redlineStart?: number
  accent?: string // active arc / needle glow
  startDeg?: number
  sweepDeg?: number
  smoothing?: number // 0..1 needle responsiveness per frame
  labelScale?: number // shrink the number labels (dense dials)
  arcColor?: string // illuminated progress arc colour
  tickColor?: string // major tick / number colour
  tickLenScale?: number // scale graduation length (1 = default)
  halfTick?: boolean // emphasise the half-way minor tick (taller + brighter)
  tickOuterScale?: number // outer radius of the tick ring as a fraction of faceR (default 0.88)
  layeredRim?: boolean // thin silver rim nested inside a thicker black-metallic ring
  numberFontFamily?: string // override the numeral font (default FunnelDisplay)
  needleReach?: number // needle tip as a fraction of faceR (default 0.84)
  centerScreen?: boolean // big black centre disc with a black+silver layered rim
  centerScreenScale?: number // centre disc outer radius as a fraction of faceR (default 0.56)
  sweepFill?: boolean // value shown as a gradient wedge filling the swept arc (vs a thin line)
  redlineZone?: boolean // redline drawn as a filled sector from knob rim to tick rim
  numberInset?: number // number radius = tickOuter - size * numberInset (default 0.135)
  numbers?: boolean // draw numeric labels (default true)
  bare?: boolean // rim + face + ticks + centre screen only (no needle / value sweep)
  unitSubR?: number // unitSub caption distance below centre, as a fraction of faceR (default 0.556)
}

const DPR = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2.5) : 1
const withA = (hex: string, a: number) => {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.split('').map((x) => x + x).join('') : h, 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`
}
// blend two hex colours (t: 0 → a, 1 → b) → 6-digit hex
const mixHex = (a: string, b: string, t: number) => {
  const pa = parseInt(a.replace('#', ''), 16), pb = parseInt(b.replace('#', ''), 16)
  const r = Math.round(((pa >> 16) & 255) + (((pb >> 16) & 255) - ((pa >> 16) & 255)) * t)
  const g = Math.round(((pa >> 8) & 255) + (((pb >> 8) & 255) - ((pa >> 8) & 255)) * t)
  const bl = Math.round((pa & 255) + ((pb & 255) - (pa & 255)) * t)
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1)
}

const Gauge = forwardRef<GaugeHandle, Props>(function Gauge(
  {
    size, min, max, majorStep, minorPerMajor,
    labelDivisor = 1, unit, unitSub, redlineStart,
    accent = '#ff2d2d', startDeg = 135, sweepDeg = 270, smoothing = 0.18, labelScale = 1,
    arcColor = '#36e0ff', tickColor = '#f4f6f8', tickLenScale = 1, halfTick = false,
    tickOuterScale = 0.88, layeredRim = false, numberFontFamily,
    needleReach = 0.84, centerScreen = false, centerScreenScale = 0.56, sweepFill = false,
    redlineZone = false, numberInset = 0.135, numbers = true, bare = false, unitSubR = 0.556,
  },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const staticRef = useRef<HTMLCanvasElement | null>(null)
  const target = useRef(min)
  const display = useRef(min)
  const rafRef = useRef(0)

  useImperativeHandle(ref, () => ({ setValue: (v: number) => { target.current = v } }), [])

  // when a custom numeral font is requested, wait for it to load then redraw the
  // static layer (canvas needs the font present at paint time). Default font path
  // is unaffected — fontReady stays at its initial tick.
  const [fontReady, setFontReady] = useState(0)
  useEffect(() => {
    if (!numberFontFamily || typeof document === 'undefined' || !('fonts' in document)) return
    let alive = true
    document.fonts.load(`24px ${numberFontFamily}`).then(() => { if (alive) setFontReady((t) => t + 1) }).catch(() => {})
    return () => { alive = false }
  }, [numberFontFamily])

  const valToAngle = (v: number) => {
    const t = (v - min) / (max - min)
    return ((startDeg + t * sweepDeg) * Math.PI) / 180
  }

  // ── build the static layers once (bezel, face, texture, ticks, numbers, redline) ──
  useEffect(() => {
    const px = size * DPR
    const off = document.createElement('canvas')
    off.width = px
    off.height = px
    const c = off.getContext('2d')!
    c.scale(DPR, DPR)
    const R = size / 2
    const cx = R
    const cy = R

    if (layeredRim) {
      // ── outer BLACK-METALLIC ring (the thicker rim) ──
      const blk = c.createLinearGradient(0, 0, 0, size)
      blk.addColorStop(0, '#3c3f46'); blk.addColorStop(0.4, '#1d2025')
      blk.addColorStop(0.72, '#0c0d10'); blk.addColorStop(1, '#2a2d34')
      c.beginPath(); c.arc(cx, cy, R - 1, 0, Math.PI * 2); c.fillStyle = blk; c.fill()
      // faint metallic sheen along the top of the black ring — fades out at both ends
      c.save()
      const blkShR = R - size * 0.014
      const blkSh = c.createLinearGradient(cx - blkShR, 0, cx + blkShR, 0)
      blkSh.addColorStop(0, 'rgba(210,218,230,0)')
      blkSh.addColorStop(0.5, 'rgba(210,218,230,0.24)')
      blkSh.addColorStop(1, 'rgba(210,218,230,0)')
      c.beginPath(); c.arc(cx, cy, blkShR, Math.PI * 1.1, Math.PI * 1.9)
      c.lineWidth = size * 0.02; c.lineCap = 'round'
      c.strokeStyle = blkSh
      c.stroke(); c.restore()
      // crisp seam where black meets silver
      c.beginPath(); c.arc(cx, cy, R - size * 0.034, 0, Math.PI * 2)
      c.lineWidth = 1; c.strokeStyle = 'rgba(0,0,0,0.7)'; c.stroke()

      // ── thin SILVER rim, nested inside the black ring ──
      const bezel = c.createLinearGradient(0, 0, 0, size)
      bezel.addColorStop(0, '#eef1f6'); bezel.addColorStop(0.18, '#b3b9c3')
      bezel.addColorStop(0.5, '#5e636c'); bezel.addColorStop(0.82, '#2a2d33')
      bezel.addColorStop(1, '#3a3d44')
      c.beginPath(); c.arc(cx, cy, R - size * 0.034, 0, Math.PI * 2); c.fillStyle = bezel; c.fill()
      // specular kiss on the silver — fades out at both ends
      c.save()
      const slvShR = R - size * 0.043
      const slvSh = c.createLinearGradient(cx - slvShR, 0, cx + slvShR, 0)
      slvSh.addColorStop(0, 'rgba(255,255,255,0)')
      slvSh.addColorStop(0.5, 'rgba(255,255,255,0.62)')
      slvSh.addColorStop(1, 'rgba(255,255,255,0)')
      c.beginPath(); c.arc(cx, cy, slvShR, Math.PI * 1.14, Math.PI * 1.86)
      c.lineWidth = size * 0.012; c.lineCap = 'round'
      c.strokeStyle = slvSh
      c.stroke(); c.restore()
    } else {
      // outer metallic bezel — lit from above: bright silver top, dark bottom
      const bezel = c.createLinearGradient(0, 0, 0, size)
      bezel.addColorStop(0, '#dfe3ea')      // near-white specular top
      bezel.addColorStop(0.09, '#b3b9c3')
      bezel.addColorStop(0.26, '#6f747e')
      bezel.addColorStop(0.48, '#3a3d44')
      bezel.addColorStop(0.74, '#1e2025')
      bezel.addColorStop(0.92, '#0e0f13')
      bezel.addColorStop(1, '#34373e')       // bottom reflected rim-light
      c.beginPath(); c.arc(cx, cy, R - 1, 0, Math.PI * 2); c.fillStyle = bezel; c.fill()

      // specular highlight across the top of the rim (light from above)
      const rimR = R - size * 0.028
      const hi = c.createLinearGradient(0, 0, 0, size * 0.4)
      hi.addColorStop(0, 'rgba(255,255,255,0.65)')
      hi.addColorStop(1, 'rgba(255,255,255,0)')
      c.save()
      c.beginPath()
      c.arc(cx, cy, rimR, Math.PI * 1.16, Math.PI * 1.84)
      c.lineWidth = size * 0.034
      c.lineCap = 'round'
      c.strokeStyle = hi
      c.shadowColor = 'rgba(255,255,255,0.45)'
      c.shadowBlur = size * 0.022
      c.stroke()
      c.restore()
    }

    // inner bezel shadow ring (shared) — separates rim from the dial face
    c.beginPath(); c.arc(cx, cy, R - size * 0.052, 0, Math.PI * 2)
    c.fillStyle = '#0a0b0d'; c.fill()

    // dial face: deep radial gradient
    const faceR = R - size * 0.06
    const face = c.createRadialGradient(cx, cy - faceR * 0.3, faceR * 0.1, cx, cy, faceR)
    face.addColorStop(0, '#26282d')
    face.addColorStop(0.55, '#161719')
    face.addColorStop(1, '#0a0a0c')
    c.beginPath(); c.arc(cx, cy, faceR, 0, Math.PI * 2); c.fillStyle = face; c.fill()

    // perforated carbon texture (concentric dot rings)
    c.save()
    c.beginPath(); c.arc(cx, cy, faceR, 0, Math.PI * 2); c.clip()
    c.fillStyle = 'rgba(255,255,255,0.025)'
    for (let r = faceR * 0.35; r < faceR; r += 7) {
      const circ = 2 * Math.PI * r
      const count = Math.floor(circ / 7)
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2
        const x = cx + Math.cos(a) * r
        const y = cy + Math.sin(a) * r
        c.beginPath(); c.arc(x, y, 1.1, 0, Math.PI * 2); c.fill()
      }
    }
    c.restore()

    // ticks + numbers
    const tickOuter = faceR * tickOuterScale

    // redline
    if (redlineStart !== undefined) {
      if (redlineZone) {
        // filled red sector spanning from the knob rim out to the tick rim
        const rOut = tickOuter, rIn = faceR * centerScreenScale
        c.save()
        c.beginPath()
        c.arc(cx, cy, rOut, valToAngle(redlineStart), valToAngle(max))
        c.arc(cx, cy, rIn, valToAngle(max), valToAngle(redlineStart), true)
        c.closePath()
        const rg = c.createRadialGradient(cx, cy, rIn, cx, cy, rOut)
        rg.addColorStop(0, '#3a0604')
        rg.addColorStop(0.55, '#a81212')
        rg.addColorStop(1, accent)
        c.fillStyle = rg
        c.shadowColor = accent; c.shadowBlur = size * 0.02
        c.fill()
        c.restore()
      } else {
        c.beginPath()
        c.arc(cx, cy, faceR * 0.82, valToAngle(redlineStart), valToAngle(max))
        c.strokeStyle = accent
        c.lineWidth = size * 0.03
        c.shadowColor = accent
        c.shadowBlur = 10
        c.stroke()
        c.shadowBlur = 0
      }
    }
    c.textAlign = 'center'
    c.textBaseline = 'middle'
    for (let v = min; v <= max + 1e-6; v += majorStep / minorPerMajor) {
      const isMajor = Math.abs((v - min) % majorStep) < 1e-6 || Math.abs(((v - min) % majorStep) - majorStep) < 1e-6
      // half-way tick (e.g. the 5th line between two numbers): taller + brighter
      const isHalf = halfTick && !isMajor && Math.abs((v - min) % (majorStep / 2)) < 1e-6
      const a = valToAngle(v)
      const past = redlineStart !== undefined && v >= redlineStart
      const minorLen = isHalf ? size * 0.052 : size * 0.035
      const inner = isMajor ? tickOuter - size * 0.07 * tickLenScale : tickOuter - minorLen * tickLenScale
      c.beginPath()
      c.moveTo(cx + Math.cos(a) * tickOuter, cy + Math.sin(a) * tickOuter)
      c.lineTo(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner)
      c.lineWidth = isMajor ? size * 0.012 : (isHalf ? size * 0.0075 : size * 0.006)
      c.strokeStyle = past ? accent
        : (isMajor ? tickColor : (isHalf ? 'rgba(238,242,247,0.82)' : 'rgba(220,226,232,0.5)'))
      if (past) { c.shadowColor = accent; c.shadowBlur = 6 }
      c.stroke()
      c.shadowBlur = 0

      if (isMajor && numbers) {
        const numR = tickOuter - size * numberInset
        const n = Math.round(v / labelDivisor)
        c.font = numberFontFamily
          ? `${size * 0.072 * labelScale}px ${numberFontFamily}, sans-serif`
          : `600 ${size * 0.072 * labelScale}px FunnelDisplay, sans-serif`
        c.fillStyle = past ? accent : tickColor
        c.fillText(String(n), cx + Math.cos(a) * numR, cy + Math.sin(a) * numR)
      }
    }

    // unit text
    if (unit) {
      c.font = `500 ${size * 0.05}px FunnelDisplay, sans-serif`
      c.fillStyle = 'rgba(200,206,214,0.65)'
      c.fillText(unit, cx, cy + faceR * 0.42)
    }
    if (unitSub) {
      c.font = `400 ${size * 0.038}px FunnelDisplay, sans-serif`
      c.fillStyle = 'rgba(200,206,214,0.4)'
      c.fillText(unitSub, cx, cy + faceR * unitSubR)
    }

    staticRef.current = off
  }, [size, min, max, majorStep, minorPerMajor, labelDivisor, unit, unitSub, redlineStart, accent, startDeg, sweepDeg, labelScale, tickColor, tickLenScale, halfTick, tickOuterScale, layeredRim, numberFontFamily, fontReady, redlineZone, numberInset, centerScreenScale, numbers, unitSubR])

  // ── per-frame dynamic draw ──
  useEffect(() => {
    const canvas = canvasRef.current!
    canvas.width = size * DPR
    canvas.height = size * DPR
    const c = canvas.getContext('2d')!

    const draw = () => {
      display.current += (target.current - display.current) * smoothing
      const v = display.current
      c.setTransform(DPR, 0, 0, DPR, 0, 0)
      c.clearRect(0, 0, size, size)
      if (staticRef.current) c.drawImage(staticRef.current, 0, 0, size, size)

      const R = size / 2
      const cx = R, cy = R
      const faceR = R - size * 0.06
      const ang = valToAngle(v)
      const inRedline = redlineStart !== undefined && v >= redlineStart

      const a0 = valToAngle(min)
      if (!bare && sweepFill) {
        // value = gradient wedge filling the swept arc, radiating out from behind
        // the centre knob (dim at the knob, bright toward the rim/needle)
        if (ang > a0 + 0.001) {
          // progressively redden as the revs climb toward the redline
          const top = redlineStart ?? max
          const t = Math.min(1, Math.max(0, (v - min) / (top - min)))
          const col = inRedline ? accent : mixHex(arcColor, accent, Math.pow(t, 1.3))
          const rIn = faceR * centerScreenScale * 0.9   // hidden under the knob
          const rOut = faceR * tickOuterScale - size * 0.008
          c.save()
          c.beginPath()
          c.arc(cx, cy, rOut, a0, ang)
          c.arc(cx, cy, rIn, ang, a0, true)
          c.closePath(); c.clip()
          const rg = c.createRadialGradient(cx, cy, rIn, cx, cy, rOut)
          rg.addColorStop(0, withA(col, 0.72))   // bright at the knob
          rg.addColorStop(0.3, withA(col, 0.4))
          rg.addColorStop(0.65, withA(col, 0.12))
          rg.addColorStop(1, withA(col, 0))       // fades out toward the rim
          c.globalCompositeOperation = 'lighter'
          c.fillStyle = rg
          c.fillRect(cx - rOut, cy - rOut, rOut * 2, rOut * 2)
          // bright lip riding the inner edge, just outside the knob
          c.globalCompositeOperation = 'source-over'
          c.beginPath(); c.arc(cx, cy, faceR * centerScreenScale * 1.02, a0, ang)
          c.lineWidth = size * 0.008; c.lineCap = 'round'; c.strokeStyle = withA(col, 0.9)
          c.shadowColor = col; c.shadowBlur = size * 0.025; c.stroke()
          c.restore()
        }
      } else if (!bare) {
        // illuminated progress arc (internal lighting that fills with value)
        c.beginPath()
        c.arc(cx, cy, faceR * 0.82, a0, ang)
        c.strokeStyle = inRedline ? accent : arcColor
        c.lineWidth = size * 0.012
        c.shadowColor = inRedline ? accent : arcColor
        c.shadowBlur = 14
        c.globalAlpha = 0.9
        c.stroke()
        c.globalAlpha = 1
        c.shadowBlur = 0
      }

      // needle
      if (!bare) {
      const needleLen = faceR * needleReach
      const tailLen = faceR * 0.2
      const ndx = Math.cos(ang), ndy = Math.sin(ang)
      // shadow
      c.save()
      c.translate(2, 3)
      c.beginPath()
      c.moveTo(cx - ndx * tailLen, cy - ndy * tailLen)
      c.lineTo(cx + ndx * needleLen, cy + ndy * needleLen)
      c.strokeStyle = 'rgba(0,0,0,0.45)'
      c.lineWidth = size * 0.018
      c.lineCap = 'round'
      c.stroke()
      c.restore()

      // needle body
      const ng = c.createLinearGradient(
        cx - ndx * tailLen, cy - ndy * tailLen,
        cx + ndx * needleLen, cy + ndy * needleLen,
      )
      ng.addColorStop(0, '#9aa0a8')
      ng.addColorStop(0.5, '#fefefe')
      ng.addColorStop(1, inRedline ? accent : '#ff5a3c')
      c.beginPath()
      c.moveTo(cx - ndx * tailLen, cy - ndy * tailLen)
      c.lineTo(cx + ndx * needleLen, cy + ndy * needleLen)
      c.strokeStyle = ng
      c.lineWidth = size * 0.016
      c.lineCap = 'round'
      c.shadowColor = inRedline ? accent : 'rgba(255,90,60,0.8)'
      c.shadowBlur = 12
      c.stroke()
      c.shadowBlur = 0
      }

      if (centerScreen) {
        // big centre disc — black thick rim + thin silver rim + black interior
        const scR = faceR * centerScreenScale
        const blk = c.createLinearGradient(cx, cy - scR, cx, cy + scR)
        blk.addColorStop(0, '#3a3d44'); blk.addColorStop(0.45, '#1a1c21')
        blk.addColorStop(0.75, '#0b0c0f'); blk.addColorStop(1, '#2a2d33')
        c.beginPath(); c.arc(cx, cy, scR, 0, Math.PI * 2); c.fillStyle = blk; c.fill()
        // thin silver finish ring
        const slv = c.createLinearGradient(cx, cy - scR, cx, cy + scR)
        slv.addColorStop(0, '#eef1f6'); slv.addColorStop(0.22, '#b3b9c3')
        slv.addColorStop(0.55, '#5e636c'); slv.addColorStop(1, '#2a2d33')
        c.beginPath(); c.arc(cx, cy, scR - size * 0.016, 0, Math.PI * 2); c.fillStyle = slv; c.fill()
        // completely black interior (km/h + gear overlay goes here)
        const inr = c.createRadialGradient(cx, cy - scR * 0.3, scR * 0.05, cx, cy, scR)
        inr.addColorStop(0, '#0c0d10'); inr.addColorStop(1, '#020203')
        c.beginPath(); c.arc(cx, cy, scR - size * 0.026, 0, Math.PI * 2); c.fillStyle = inr; c.fill()
        // soft inner top shadow for recessed depth
        c.save(); c.beginPath(); c.arc(cx, cy, scR - size * 0.026, 0, Math.PI * 2); c.clip()
        c.beginPath(); c.arc(cx, cy - size * 0.004, scR - size * 0.026, Math.PI, Math.PI * 2)
        c.lineWidth = size * 0.022; c.strokeStyle = 'rgba(0,0,0,0.55)'; c.stroke()
        c.restore()
      } else if (!bare) {
        // center hub (metallic cap)
        const hubR = size * 0.075
        const hub = c.createRadialGradient(cx - hubR * 0.3, cy - hubR * 0.3, hubR * 0.1, cx, cy, hubR)
        hub.addColorStop(0, '#6d727b')
        hub.addColorStop(0.5, '#33363c')
        hub.addColorStop(1, '#16181b')
        c.beginPath(); c.arc(cx, cy, hubR, 0, Math.PI * 2); c.fillStyle = hub; c.fill()
        c.lineWidth = 1; c.strokeStyle = 'rgba(0,0,0,0.6)'; c.stroke()
        c.beginPath(); c.arc(cx, cy, hubR * 0.4, 0, Math.PI * 2)
        c.fillStyle = inRedline ? accent : '#1d1f22'; c.fill()
      }

      // glass reflection (top sheen)
      const glass = c.createLinearGradient(0, 0, 0, size * 0.55)
      glass.addColorStop(0, 'rgba(255,255,255,0.16)')
      glass.addColorStop(1, 'rgba(255,255,255,0)')
      c.save()
      c.beginPath()
      c.ellipse(cx, cy - faceR * 0.35, faceR * 0.78, faceR * 0.5, 0, 0, Math.PI * 2)
      c.clip()
      c.fillStyle = glass
      c.fillRect(0, 0, size, size)
      c.restore()

      rafRef.current = requestAnimationFrame(draw)
    }
    rafRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(rafRef.current)
  }, [size, min, max, redlineStart, accent, startDeg, sweepDeg, smoothing, arcColor, needleReach, centerScreen, centerScreenScale, sweepFill, tickOuterScale, bare])

  return <canvas ref={canvasRef} style={{ width: size, height: size, display: 'block' }} />
})

export default Gauge
