/*
 * Shader reveal: the painted figure lives under the engraving, and the
 * pointer burns a hole through the engraving to show it.
 *
 * One WebGL fragment shader does it all. The pointer and its trail arrive as
 * up to MAX_POINTS (x, y, strength) uniforms; each pixel takes the strongest
 * of their soft discs, adds fbm noise so the edge is ragged like burnt or
 * bleeding paper, and thresholds that field. The band right at the threshold
 * gets an edge colour (gold leaf by default), and inside the hole the painting
 * is nudged by the same noise so it looks wet.
 *
 * Like the dither, the canvas only exists while something is happening: at
 * rest the plain <img> is showing and no frames are drawn. With "animate
 * edge" on, the noise keeps flowing only while the pointer is over a figure.
 */

import { getSettings, subscribe, type DitherSettings } from './settings'
import { onScrollFrame } from '@/lib/motion'

const MAX_POINTS = 48
const easeOut = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3)

const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`

const FRAG = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uTop;
uniform sampler2D uBottom;
uniform vec2 uSize;
uniform vec3 uPts[${MAX_POINTS}];
uniform int uCount;
uniform float uRadius;
uniform float uFalloff;
uniform float uNoise;
uniform float uNoiseScale;
uniform float uSoft;
uniform float uGlow;
uniform float uGlowWidth;
uniform vec3 uEdgeColor;
uniform float uDistort;
uniform float uDitherEdge;
uniform float uTime;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * vnoise(p); p *= 2.03; a *= 0.5; }
  return v;
}
// 4x4 Bayer threshold, for the dithered edge
float bayer4(vec2 c) {
  vec2 p = mod(floor(c), 4.0);
  float i = p.x + p.y * 4.0;
  if (i < 1.0) return 0.0 / 16.0; if (i < 2.0) return 8.0 / 16.0; if (i < 3.0) return 2.0 / 16.0; if (i < 4.0) return 10.0 / 16.0;
  if (i < 5.0) return 12.0 / 16.0; if (i < 6.0) return 4.0 / 16.0; if (i < 7.0) return 14.0 / 16.0; if (i < 8.0) return 6.0 / 16.0;
  if (i < 9.0) return 3.0 / 16.0; if (i < 10.0) return 11.0 / 16.0; if (i < 11.0) return 1.0 / 16.0; if (i < 12.0) return 9.0 / 16.0;
  if (i < 13.0) return 15.0 / 16.0; if (i < 14.0) return 7.0 / 16.0; if (i < 15.0) return 13.0 / 16.0; return 5.0 / 16.0;
}

void main() {
  // figure-local CSS px, y down, to match the pointer coordinates
  vec2 p = vec2(vUv.x, 1.0 - vUv.y) * uSize;

  float m = 0.0;
  for (int i = 0; i < ${MAX_POINTS}; i++) {
    if (i >= uCount) break;
    vec3 s = uPts[i];
    float d = distance(p, s.xy) / uRadius;
    m = max(m, s.z * pow(clamp(1.0 - d * d, 0.0, 1.0), uFalloff));
  }

  vec2 np = p / 100.0 * uNoiseScale;
  float n = fbm(np + vec2(uTime * 0.13, -uTime * 0.09));
  float field = m + (n - 0.5) * uNoise;
  const float T = 0.5;

  float reveal;
  if (uDitherEdge > 0.5) {
    // ordered dither across the soft band instead of a smooth fade
    float t = clamp((field - (T - uSoft)) / max(2.0 * uSoft, 0.0001), 0.0, 1.0);
    reveal = step(bayer4(gl_FragCoord.xy / 2.0), t);
  } else {
    reveal = smoothstep(T - uSoft, T + uSoft, field);
  }

  // inside the hole the paint looks wet: nudged by the same noise
  vec2 warp = (vec2(fbm(np * 1.7 + 3.1), fbm(np * 1.7 - 7.3)) - 0.5) * uDistort * 0.02 * reveal;
  vec4 top = texture2D(uTop, vUv);
  vec4 bot = texture2D(uBottom, vUv + warp);

  vec4 col = mix(top, bot, reveal);

  // the burning rim, only where there is figure to burn
  float ring = (1.0 - smoothstep(0.0, uGlowWidth, abs(field - T))) * step(0.001, m);
  float body = max(top.a, bot.a);
  col.rgb += uEdgeColor * ring * uGlow * body;
  col.a = max(col.a, ring * uGlow * body);

  gl_FragColor = col;
}`

type Point = { x: number; y: number; t: number }

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const sh = gl.createShader(type)!
  gl.shaderSource(sh, src)
  gl.compileShader(sh)
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh) ?? 'shader compile failed')
  return sh
}

const hexToRgb = (hex: string): [number, number, number] => {
  const v = parseInt(hex.replace('#', ''), 16)
  return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255]
}

/**
 * Attach the reveal to a figure wrapper. Returns a cleanup function, or null
 * when WebGL isn't available (the figure then just stays an <img>).
 */
export function attachShaderReveal(
  wrap: HTMLDivElement,
  canvas: HTMLCanvasElement,
  name: 'abhay' | 'tejas',
  paintedSrc: string,
): (() => void) | null {
  const gl = canvas.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false })
  if (!gl) return null

  let prog: WebGLProgram
  try {
    prog = gl.createProgram()!
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT))
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG))
    gl.linkProgram(prog)
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) ?? 'link failed')
  } catch (e) {
    console.warn('[shader reveal]', e)
    return null
  }
  gl.useProgram(prog)

  const buf = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buf)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
  const aPos = gl.getAttribLocation(prog, 'aPos')
  gl.enableVertexAttribArray(aPos)
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)

  const u = (n: string) => gl.getUniformLocation(prog, n)
  const U = {
    top: u('uTop'), bottom: u('uBottom'), size: u('uSize'), pts: u('uPts'), count: u('uCount'),
    radius: u('uRadius'), falloff: u('uFalloff'), noise: u('uNoise'), noiseScale: u('uNoiseScale'),
    soft: u('uSoft'), glow: u('uGlow'), glowWidth: u('uGlowWidth'), edgeColor: u('uEdgeColor'),
    distort: u('uDistort'), ditherEdge: u('uDitherEdge'), time: u('uTime'),
  }

  const makeTex = (unit: number) => {
    const t = gl.createTexture()!
    gl.activeTexture(gl.TEXTURE0 + unit)
    gl.bindTexture(gl.TEXTURE_2D, t)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    return t
  }
  const upload = (unit: number, tex: WebGLTexture, img: HTMLImageElement) => {
    gl.activeTexture(gl.TEXTURE0 + unit)
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img)
  }
  const engravingTex = makeTex(0)
  const paintingTex = makeTex(1)

  let img: HTMLImageElement | null = null
  let painted: HTMLImageElement | null = null
  let ready = false
  let frame = 0
  let pointer: { x: number; y: number } | null = null
  let head: { x: number; y: number } | null = null
  let dropped = { x: 0, y: 0 }
  let enteredAt = 0
  let stamps: Point[] = []
  let showing = false
  const ptsArray = new Float32Array(MAX_POINTS * 3)
  const t0 = performance.now()

  const active = (s: DitherSettings) => s.enabled && s.effect === 'shader' && (s.target === 'both' || s.target === name)

  const show = (on: boolean) => {
    if (on === showing || !img) return
    showing = on
    canvas.style.visibility = on ? 'visible' : 'hidden'
    img.style.visibility = on ? 'hidden' : 'visible'
  }

  const bindTextures = () => {
    if (!img || !painted) return
    const s = getSettings()
    // swap puts the painting on top and the engraving underneath
    upload(0, engravingTex, s.shSwap ? painted : img)
    upload(1, paintingTex, s.shSwap ? img : painted)
  }

  const setup = () => {
    img = wrap.querySelector('img')
    if (!img || !img.complete || !img.naturalWidth || !painted?.complete || !painted.naturalWidth) return
    const w = wrap.clientWidth, h = wrap.clientHeight
    if (!w || !h) return
    const dpr = Math.min(window.devicePixelRatio || 1, getSettings().dprCap)
    canvas.width = Math.round(w * dpr)
    canvas.height = Math.round(h * dpr)
    gl.viewport(0, 0, canvas.width, canvas.height)
    bindTextures()
    ready = true
  }

  painted = new Image()
  painted.decoding = 'async'
  painted.onload = setup
  painted.src = paintedSrc

  const toLocal = (px: number, py: number) => {
    const t = getComputedStyle(wrap.parentElement!).transform
    const m = new DOMMatrix(t === 'none' ? undefined : t)
    const theta = Math.atan2(m.b, m.a)
    const r = wrap.getBoundingClientRect()
    const dx = px - (r.left + r.width / 2), dy = py - (r.top + r.height / 2)
    const cos = Math.cos(-theta), sin = Math.sin(-theta)
    return { x: dx * cos - dy * sin + wrap.clientWidth / 2, y: dx * sin + dy * cos + wrap.clientHeight / 2 }
  }

  const track = (now: number, s: DitherSettings) => {
    const w = wrap.clientWidth, h = wrap.clientHeight
    const p = pointer ? toLocal(pointer.x, pointer.y) : null
    const near = p && p.x > -s.radius && p.y > -s.radius && p.x < w + s.radius && p.y < h + s.radius
    if (!p || !near) {
      if (head && s.trail) stamps.push({ x: head.x, y: head.y, t: now })
      head = null
      return
    }
    if (!head) { enteredAt = now; dropped = p }
    else if (s.trail && Math.hypot(p.x - dropped.x, p.y - dropped.y) >= s.radius * s.spacing) {
      stamps.push({ x: dropped.x, y: dropped.y, t: now })
      dropped = p
    }
    // the shader has a fixed number of slots; keep the newest
    const cap = Math.min(s.maxStamps, MAX_POINTS - 1)
    while (stamps.length > cap) stamps.shift()
    head = p
  }

  const draw = (now: number) => {
    frame = 0
    const s = getSettings()
    if (!ready) return
    if (!active(s)) { stamps = []; head = null; show(false); return }
    track(now, s)
    stamps = s.trail ? stamps.filter((p) => now - p.t <= s.healMs) : []

    let n = 0
    for (const p of stamps) {
      const a = 1 - easeOut((now - p.t) / Math.max(1, s.healMs))
      if (a <= 0.01) continue
      ptsArray[n * 3] = p.x; ptsArray[n * 3 + 1] = p.y; ptsArray[n * 3 + 2] = a
      n++
    }
    if (head) {
      ptsArray[n * 3] = head.x; ptsArray[n * 3 + 1] = head.y
      ptsArray[n * 3 + 2] = s.enterMs > 0 ? easeOut((now - enteredAt) / s.enterMs) : 1
      n++
    }
    if (!n) { show(false); return }
    show(true)

    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.uniform1i(U.top, 0)
    gl.uniform1i(U.bottom, 1)
    gl.uniform2f(U.size, wrap.clientWidth, wrap.clientHeight)
    gl.uniform3fv(U.pts, ptsArray)
    gl.uniform1i(U.count, n)
    gl.uniform1f(U.radius, s.radius)
    gl.uniform1f(U.falloff, s.falloff)
    gl.uniform1f(U.noise, s.shNoise)
    gl.uniform1f(U.noiseScale, s.shNoiseScale)
    gl.uniform1f(U.soft, s.shSoftness)
    gl.uniform1f(U.glow, s.shGlow)
    gl.uniform1f(U.glowWidth, s.shGlowWidth)
    gl.uniform3fv(U.edgeColor, hexToRgb(s.shEdgeColor))
    gl.uniform1f(U.distort, s.shDistort)
    gl.uniform1f(U.ditherEdge, s.shDitherEdge ? 1 : 0)
    gl.uniform1f(U.time, s.shAnimate ? ((now - t0) / 1000) * s.shSpeed : 0)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)

    const entering = head && now - enteredAt < s.enterMs
    const flowing = s.shAnimate && s.shSpeed > 0 && head
    if (stamps.length || entering || flowing) frame = requestAnimationFrame(draw)
  }

  const kick = () => { if (!frame && ready) frame = requestAnimationFrame(draw) }
  const onMove = (e: MouseEvent) => { pointer = { x: e.clientX, y: e.clientY }; kick() }
  const onLeave = () => { pointer = null; kick() }

  const imgEl = wrap.querySelector('img')
  if (imgEl && !imgEl.complete) imgEl.addEventListener('load', setup, { once: true })
  else setup()

  let resizeTimer: ReturnType<typeof setTimeout> | undefined
  const onResize = () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(setup, 150) }
  const unSub = subscribe((_, changed) => {
    if (changed.includes('shSwap') && ready) bindTextures()
    if (changed.includes('dprCap')) setup()
    kick()
  })

  window.addEventListener('mousemove', onMove, { passive: true })
  document.documentElement.addEventListener('mouseleave', onLeave)
  window.addEventListener('resize', onResize)
  const unScroll = onScrollFrame(() => { if (pointer) kick() })

  return () => {
    window.removeEventListener('mousemove', onMove)
    document.documentElement.removeEventListener('mouseleave', onLeave)
    window.removeEventListener('resize', onResize)
    imgEl?.removeEventListener('load', setup)
    unSub()
    unScroll()
    clearTimeout(resizeTimer)
    if (frame) cancelAnimationFrame(frame)
    painted!.onload = null
    gl.getExtension('WEBGL_lose_context')?.loseContext()
  }
}
