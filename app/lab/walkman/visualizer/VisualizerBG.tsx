'use client'

// Full-screen WebGL layer behind the Walkman. One fragment shader per
// visualizer (compiled lazily, cached), fed every frame with the audio
// features as uniforms + a 64×2 texture (spectrum and waveform).
//
// Cheap by design: renders at a fraction of screen resolution (per-visualizer
// scale), stops drawing entirely when faded out, and rAF pauses in hidden tabs.

import { useEffect, useRef } from 'react'
import { AudioSignal, BANDS, WAVE } from './audioSignal'
import { VS, buildFrag, VIZ_SCALE, VIZ_PIXELATED, type VizId } from './shaders'
import type { VizSettings } from './vizConfig'

type RGB = [number, number, number]

// turn a colour's hue by `deg`, keeping its lightness. `minSat` lifts greys and
// washed-out colours so there's a hue to turn at all (Mono, pale album art)
function rotateHue([r, g, b]: RGB, deg: number, minSat = 0): RGB {
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min
  const l = Math.min(0.82, Math.max(0.18, (max + min) / 2)) // keep clear of pure black / white
  const s0 = d < 1e-5 ? 0 : d / Math.max(1e-5, 1 - Math.abs(2 * ((max + min) / 2) - 1))
  const s = Math.max(minSat, Math.min(1, s0))
  let h = d < 1e-5 ? 0 : max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  h = (h * 60 + deg) % 360
  if (h < 0) h += 360
  const k = (n: number) => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))
  return [f(0), f(8), f(4)]
}

interface Props {
  settings: VizSettings
  palette: RGB[]
  darkBg: boolean
  bg: RGB // the room colour the visualizer fades into
  videoId: string | null
  hasTrack: boolean
  signal: AudioSignal
}

const UNIFORMS = ['uRes', 'uTime', 'uLevel', 'uBass', 'uMid', 'uHigh', 'uBeat', 'uAudio', 'uC0', 'uC1', 'uC2', 'uC3',
  'uBg', 'uDark', 'uDither', 'uGrain', 'uVignette', 'uIntensity', 'uFade', 'uCenter', 'uTravel'] as const
type Uni = Record<(typeof UNIFORMS)[number], WebGLUniformLocation | null>

export default function VisualizerBG({ settings, palette, darkBg, bg, videoId, hasTrack, signal }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // latest props for the render loop, without restarting it
  const live = useRef({ settings, palette, darkBg, bg, videoId, hasTrack })
  live.current = { settings, palette, darkBg, bg, videoId, hasTrack }

  useEffect(() => {
    const canvas = canvasRef.current!
    let gl: WebGLRenderingContext | null = null
    let buf: WebGLBuffer | null = null
    let tex: WebGLTexture | null = null
    const programs = new Map<VizId, { prog: WebGLProgram; u: Uni }>()
    const audioBytes = new Uint8Array(64 * 2)
    const cols: RGB[] = live.current.palette.map((c) => [...c] as RGB)
    const roomCur: RGB = [...live.current.bg] as RGB
    let raf = 0
    let last = performance.now()
    let fade = 0
    let travel = 0 // forward distance for the tunnel / warp, integrated so speed changes stay smooth
    let remixAngle = 0 // how far the remix has turned the colour wheel
    let lost = false
    let size = { w: 0, h: 0, scale: 0 }

    const init = () => {
      gl = canvas.getContext('webgl', { antialias: false, alpha: false, depth: false, stencil: false, preserveDrawingBuffer: false, powerPreference: 'low-power' })
      if (!gl) return false
      gl.getExtension('OES_standard_derivatives')
      programs.clear()
      buf = gl.createBuffer()
      gl.bindBuffer(gl.ARRAY_BUFFER, buf)
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW) // one big triangle
      tex = gl.createTexture()
      gl.bindTexture(gl.TEXTURE_2D, tex)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, 64, 2, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, audioBytes)
      size = { w: 0, h: 0, scale: 0 }
      return true
    }

    const compile = (id: VizId) => {
      if (!gl) return null
      const cached = programs.get(id)
      if (cached) return cached
      const sh = (type: number, src: string) => {
        const s = gl!.createShader(type)!
        gl!.shaderSource(s, src)
        gl!.compileShader(s)
        if (!gl!.getShaderParameter(s, gl!.COMPILE_STATUS)) { console.warn(`[walkman viz] ${id}:`, gl!.getShaderInfoLog(s)); return null }
        return s
      }
      const vs = sh(gl.VERTEX_SHADER, VS), fs = sh(gl.FRAGMENT_SHADER, buildFrag(id))
      if (!vs || !fs) return null
      const prog = gl.createProgram()!
      gl.attachShader(prog, vs); gl.attachShader(prog, fs)
      gl.bindAttribLocation(prog, 0, 'aPos')
      gl.linkProgram(prog)
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { console.warn('[walkman viz] link', gl.getProgramInfoLog(prog)); return null }
      const u = Object.fromEntries(UNIFORMS.map((n) => [n, gl!.getUniformLocation(prog, n)])) as Uni
      const entry = { prog, u }
      programs.set(id, entry)
      return entry
    }

    const resize = (id: VizId) => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
      const scale = VIZ_SCALE[id] * dpr
      const w = Math.max(2, Math.round(window.innerWidth * scale))
      const h = Math.max(2, Math.round(window.innerHeight * scale))
      if (w !== size.w || h !== size.h || scale !== size.scale) {
        canvas.width = w; canvas.height = h
        size = { w, h, scale }
      }
    }

    const readClock = () => {
      const p = window.ytPlayer
      const playing = p?.getPlayerState?.() === 1
      const muted = p?.isMuted?.() ?? false
      return {
        playing,
        time: p?.getCurrentTime?.() ?? 0,
        volume: muted ? 0 : (p?.getVolume?.() ?? 100) / 100,
        seed: live.current.videoId ?? '',
      }
    }

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame)
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const { settings: s, palette, darkBg, bg: room, hasTrack } = live.current
      const clock = readClock()
      signal.update(dt, clock)

      // fade: full while playing, softer when paused, gone without a tape (unless idle mode)
      const target = s.viz === 'off' ? 0 : clock.playing ? 1 : hasTrack ? 0.55 : s.idle ? 0.6 : 0
      fade += (target - fade) * Math.min(1, dt * (target > fade ? 1.6 : 2.4))
      canvas.style.opacity = fade < 0.004 ? '0' : '1'
      if (fade < 0.004 || s.viz === 'off' || lost || !gl) return

      const id = s.viz as VizId
      const entry = compile(id)
      if (!entry) return
      resize(id)
      canvas.style.imageRendering = VIZ_PIXELATED[id] || s.dither ? 'pixelated' : 'auto'

      // ease palette changes (new album art crossfades instead of snapping).
      // Remix: the palette's hues keep turning, one slow lap of the colour wheel
      // a minute, each colour a little out of step with the others
      remixAngle += s.remix ? dt * 15 : 0 // a lap of the wheel about every 24 s
      for (let i = 0; i < 4; i++) {
        const base = palette[i] ?? [0, 0, 0]
        const target = s.remix ? rotateHue(base, remixAngle + i * 28 + Math.sin(remixAngle * 0.04 + i) * 24, 0.55) : base
        for (let k = 0; k < 3; k++) cols[i][k] += (target[k] - cols[i][k]) * Math.min(1, dt * 2)
      }
      // the room colour eases too, in step with the page background's fade
      for (let k = 0; k < 3; k++) roomCur[k] += (room[k] - roomCur[k]) * Math.min(1, dt * 4)

      const f = signal.f
      for (let i = 0; i < BANDS; i++) audioBytes[i] = Math.round(Math.min(1, f.bands[i]) * 255)
      for (let i = 0; i < WAVE; i++) audioBytes[64 + i] = Math.round((Math.max(-1, Math.min(1, f.wave[i])) * 0.5 + 0.5) * 255)

      const g = gl, u = entry.u
      g.viewport(0, 0, size.w, size.h)
      g.useProgram(entry.prog)
      g.bindBuffer(g.ARRAY_BUFFER, buf)
      g.enableVertexAttribArray(0)
      g.vertexAttribPointer(0, 2, g.FLOAT, false, 0, 0)
      g.activeTexture(g.TEXTURE0)
      g.bindTexture(g.TEXTURE_2D, tex)
      g.texSubImage2D(g.TEXTURE_2D, 0, 0, 0, 64, 2, g.LUMINANCE, g.UNSIGNED_BYTE, audioBytes)
      g.uniform1i(u.uAudio, 0)
      g.uniform2f(u.uRes, size.w, size.h)
      g.uniform1f(u.uTime, now / 1000)
      g.uniform1f(u.uLevel, f.level)
      g.uniform1f(u.uBass, f.bass)
      g.uniform1f(u.uMid, f.mid)
      g.uniform1f(u.uHigh, f.high)
      g.uniform1f(u.uBeat, f.beat)
      travel += dt * (0.18 + 1.1 * f.level + 0.6 * f.beat)
      g.uniform1f(u.uTravel, travel)
      g.uniform3fv(u.uC0, cols[0]); g.uniform3fv(u.uC1, cols[1]); g.uniform3fv(u.uC2, cols[2]); g.uniform3fv(u.uC3, cols[3])
      g.uniform3f(u.uBg, roomCur[0], roomCur[1], roomCur[2])
      g.uniform1f(u.uDark, darkBg ? 1 : 0)
      g.uniform1f(u.uDither, s.dither ? 1 : 0)
      g.uniform1f(u.uGrain, s.grain ? 1 : 0)
      g.uniform1f(u.uVignette, s.vignette ? 1 : 0)
      g.uniform1f(u.uIntensity, s.intensity)
      g.uniform1f(u.uFade, fade)
      g.uniform2f(u.uCenter, 0.5, 0.56) // where the Walkman floats
      g.drawArrays(g.TRIANGLES, 0, 3)
    }

    const onLost = (e: Event) => { e.preventDefault(); lost = true }
    const onRestored = () => { lost = !init() }
    canvas.addEventListener('webglcontextlost', onLost)
    canvas.addEventListener('webglcontextrestored', onRestored)

    if (init()) raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      canvas.removeEventListener('webglcontextlost', onLost)
      canvas.removeEventListener('webglcontextrestored', onRestored)
      gl?.getExtension('WEBGL_lose_context')?.loseContext()
    }
  }, [signal])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      style={{
        position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 0,
        pointerEvents: 'none', opacity: 0, transition: 'opacity 0.4s ease',
      }}
    />
  )
}
