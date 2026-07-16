'use client'

import { useEffect, useRef } from 'react'
import { ArrowRight, Grid3x3, Mic, SlidersHorizontal, Music4 } from 'lucide-react'
import s from '../studioKapi.module.css'

// "Sunset Glow" palette — drifting diamond blobs form the mesh.
const MESH: { color: string; ax: number; ay: number; drift: number }[] = [
  { color: '#f94144', ax: 0.18, ay: 0.20, drift: 0.10 },
  { color: '#f3722c', ax: 0.72, ay: 0.14, drift: 0.09 },
  { color: '#f8961e', ax: 0.85, ay: 0.60, drift: 0.11 },
  { color: '#f9c74f', ax: 0.50, ay: 0.48, drift: 0.08 },
  { color: '#90be6d', ax: 0.20, ay: 0.82, drift: 0.10 },
  { color: '#43aa8b', ax: 0.62, ay: 0.88, drift: 0.12 },
  { color: '#577590', ax: 0.90, ay: 0.30, drift: 0.09 },
]

// Diamond-blob mesh gradient + flowing sound-wave lines, all on one canvas
// (ElevenLabs-style depth). Diamonds are rotated squares under a heavy blur, so
// the color falloff is diamond-shaped rather than the circular CSS radial.
function WaveField() {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    let w = 0, h = 0, raf = 0, running = true

    const resize = () => {
      const r = canvas.getBoundingClientRect()
      w = r.width; h = r.height
      canvas.width = Math.max(1, Math.round(w * dpr))
      canvas.height = Math.max(1, Math.round(h * dpr))
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    resize()

    const diamond = (cx: number, cy: number, r: number, rot: number) => {
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot)
      ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(r, 0); ctx.lineTo(0, r); ctx.lineTo(-r, 0); ctx.closePath()
      ctx.fill(); ctx.restore()
    }

    const draw = (t: number) => {
      // ── diamond mesh ─────────────────────────────────────────────
      ctx.globalCompositeOperation = 'source-over'
      ctx.fillStyle = '#f4903a'
      ctx.fillRect(0, 0, w, h)
      ctx.filter = `blur(${Math.min(w, h) * 0.12}px)`
      ctx.globalAlpha = 0.9
      const r = Math.min(w, h) * 0.52
      for (let i = 0; i < MESH.length; i++) {
        const b = MESH[i]
        const cx = (b.ax + Math.sin(t * 0.00022 * (1 + b.drift) + i * 1.3) * b.drift) * w
        const cy = (b.ay + Math.cos(t * 0.00019 * (1 + b.drift) + i * 0.9) * b.drift) * h
        ctx.fillStyle = b.color
        diamond(cx, cy, r, t * 0.00012 + i)
      }
      ctx.filter = 'none'; ctx.globalAlpha = 1

      // ── flowing sound-wave lines (soft-light over the mesh) ──────
      ctx.globalCompositeOperation = 'soft-light'
      ctx.lineWidth = 1.15
      const LINES = 18
      for (let i = 0; i < LINES; i++) {
        const p = i / (LINES - 1)
        const baseY = h * (0.08 + p * 0.84)
        const swell = Math.sin(p * Math.PI)
        const amp = h * (0.015 + 0.06 * swell)
        const freq = 1.3 + p * 1.4
        const phase = t * 0.0007 * (0.5 + p * 1.1) + i * 0.55
        ctx.beginPath()
        for (let x = 0; x <= w; x += 5) {
          const nx = x / w
          const y = baseY
            + Math.sin(nx * Math.PI * freq + phase) * amp
            + Math.sin(nx * Math.PI * freq * 2.4 + phase * 1.6) * amp * 0.32
          if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
        }
        ctx.strokeStyle = `rgba(255,255,255,${0.5 + 0.4 * swell})`
        ctx.stroke()
      }
      ctx.globalCompositeOperation = 'source-over'

      if (running && !reduce) raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => { running = false; cancelAnimationFrame(raf); ro.disconnect() }
  }, [])
  return <canvas ref={ref} className={s.introWaves} aria-hidden />
}

// Launch card shown once per browser (like the splash on Photoshop / Blender):
// artwork on the left, a short "what this is" pitch + Continue on the right.
export default function IntroSplash({ onClose }: { onClose: () => void }) {
  // Esc dismisses, matching the Continue button.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const features: { icon: React.ReactNode; text: string }[] = [
    { icon: <Grid3x3 size={15} />, text: 'Sequence beats on the step grid and piano roll' },
    { icon: <SlidersHorizontal size={15} />, text: 'Shape each channel with the synth, FX and mixer' },
    { icon: <Mic size={15} />, text: 'Record your voice, clean it up and drop it in' },
    { icon: <Music4 size={15} />, text: 'Arrange patterns into a song, then export a WAV' },
  ]

  return (
    <div className={s.introOverlay} onClick={onClose}>
      <div className={s.introCard} onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Welcome to Studio-Kapi">
        <div className={s.introArt}>
          <WaveField />
          <div className={s.introArtGlow} />
          <img src="/lab/studio-kapi/img-assets/studio-kapi-icon-logo.svg" alt="" className={s.introMascot} />
          <img src="/lab/studio-kapi/img-assets/kapi-studio-icon.svg" alt="Studio Kapi" className={s.introWordmark} />
        </div>

        <div className={s.introBody}>
          <h2 className={s.introTitle}>Welcome to Studio-Kapi</h2>
          <p className={s.introLead}>
            A pocket DAW that runs right in your browser. Build a track from scratch, no install needed.
          </p>

          <ul className={s.introList}>
            {features.map((f, i) => (
              <li key={i} className={s.introItem}>
                <span className={s.introItemIcon}>{f.icon}</span>
                {f.text}
              </li>
            ))}
          </ul>

          <div className={s.introFoot}>
            <button className={s.introBtn} onClick={onClose} autoFocus>
              Continue <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
