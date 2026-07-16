'use client'

import { useEffect, useRef } from 'react'
import { getEngine } from '../audio/engine'

// Real-time mic waveform, driven by the engine's analyser node.
export default function RecWave({ active }: { active: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const history = useRef<number[]>([])

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const engine = getEngine()
    let raf = 0
    const buf = new Uint8Array(engine.micFftSize)

    const draw = () => {
      const w = canvas.width, h = canvas.height
      ctx.clearRect(0, 0, w, h)

      if (active && engine.getMicWaveform(buf)) {
        // compute RMS of current frame -> push to scrolling history
        let sum = 0
        for (let i = 0; i < buf.length; i++) { const v = (buf[i] - 128) / 128; sum += v * v }
        const rms = Math.sqrt(sum / buf.length)
        history.current.push(rms)
        const maxBars = Math.floor(w / 4)
        if (history.current.length > maxBars) history.current.shift()
      }

      // scrolling bar history (right = newest)
      const bars = history.current
      const bw = 3, gap = 1
      const mid = h / 2
      for (let i = 0; i < bars.length; i++) {
        const x = w - (bars.length - i) * (bw + gap)
        const amp = Math.min(1, bars[i] * 3.2)
        const bh = Math.max(2, amp * h * 0.9)
        const grad = ctx.createLinearGradient(0, mid - bh / 2, 0, mid + bh / 2)
        grad.addColorStop(0, '#cfd4dd')
        grad.addColorStop(0.5, '#4dd2c0')
        grad.addColorStop(1, '#cfd4dd')
        ctx.fillStyle = grad
        ctx.fillRect(x, mid - bh / 2, bw, bh)
      }

      // center line
      ctx.strokeStyle = 'rgba(255,255,255,0.08)'
      ctx.beginPath(); ctx.moveTo(0, mid); ctx.lineTo(w, mid); ctx.stroke()

      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [active])

  useEffect(() => { if (!active) history.current = [] }, [active])

  return <canvas ref={ref} width={520} height={90} style={{ width: '100%', height: 90, display: 'block', borderRadius: 8 }} />
}
