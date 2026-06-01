'use client'
import { useEffect, useRef } from 'react'

interface RGB { r: number; g: number; b: number }
interface Props { colors: RGB[]; darkBg: boolean }

// ── Vertex: fullscreen quad ──────────────────────────────────────────────────
const VS = `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`

// ── Fragment: domain-warped fbm (IQ-style) with album palette ────────────────
// 3 calls to fbm(), each 3 octaves = ~27 gradient-noise evals per pixel.
const FS = `
precision mediump float;
uniform float u_time;
uniform vec2  u_res;
uniform vec3  u_c0;
uniform vec3  u_c1;
uniform vec3  u_c2;
uniform float u_dark;

vec2 h2(vec2 p) {
  p = vec2(dot(p,vec2(127.1,311.7)), dot(p,vec2(269.5,183.3)));
  return fract(sin(p)*43758.5453);
}
float noise(vec2 p) {
  vec2 i=floor(p), f=fract(p), u=f*f*(3.-2.*f);
  return mix(
    mix(dot(h2(i),           f),           dot(h2(i+vec2(1,0)), f-vec2(1,0)), u.x),
    mix(dot(h2(i+vec2(0,1)), f-vec2(0,1)), dot(h2(i+vec2(1,1)), f-vec2(1,1)), u.x),
    u.y);
}
float fbm(vec2 p) {
  float v=0., a=0.5;
  for(int i=0;i<3;i++){ v+=a*noise(p); p=p*2.1+vec2(0.47,0.83); a*=0.5; }
  return v;
}
void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  float t  = u_time * 0.09;
  vec2 q = vec2(fbm(uv*2.0 + t),
                fbm(uv*2.0 + vec2(1.7, 9.2) + t*0.76));
  float f = 0.5 + 0.5 * fbm(uv*1.6 + 1.9*q + t*0.19);
  vec3 col = mix(u_c0, u_c1, smoothstep(0.18, 0.58, f));
       col = mix(col,  u_c2, smoothstep(0.54, 0.94, f));
  vec2 ctr = uv - 0.5;
  col *= 1.0 - smoothstep(0.28, 0.92, dot(ctr,ctr) * 4.2);
  float strength = u_dark > 0.5 ? 0.50 : 0.09;
  gl_FragColor = vec4(col * strength, 1.0);
}
`

function compileShader(gl: WebGLRenderingContext, type: number, src: string) {
  const s = gl.createShader(type)!
  gl.shaderSource(s, src)
  gl.compileShader(s)
  return s
}

const DEFAULT_DARK  = [[0.08, 0.04, 0.22], [0.02, 0.16, 0.28], [0.20, 0.04, 0.14]] as const
const DEFAULT_LIGHT = [[0.80, 0.74, 0.92], [0.72, 0.84, 0.94], [0.90, 0.80, 0.76]] as const

export default function WalkmanShaderBG({ colors, darkBg }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const colorsRef = useRef(colors)
  const darkRef   = useRef(darkBg)

  useEffect(() => { colorsRef.current = colors }, [colors])
  useEffect(() => { darkRef.current   = darkBg  }, [darkBg])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const gl = canvas.getContext('webgl', {
      antialias: false, alpha: false, depth: false, stencil: false,
    })
    if (!gl) return

    const vs   = compileShader(gl, gl.VERTEX_SHADER,   VS)
    const fs   = compileShader(gl, gl.FRAGMENT_SHADER, FS)
    const prog = gl.createProgram()!
    gl.attachShader(prog, vs)
    gl.attachShader(prog, fs)
    gl.linkProgram(prog)
    gl.useProgram(prog)

    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1,  1, -1,  -1, 1,  1, 1]),
      gl.STATIC_DRAW
    )
    const aPos = gl.getAttribLocation(prog, 'a_pos')
    gl.enableVertexAttribArray(aPos)
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)

    const uTime = gl.getUniformLocation(prog, 'u_time')
    const uRes  = gl.getUniformLocation(prog, 'u_res')
    const uC0   = gl.getUniformLocation(prog, 'u_c0')
    const uC1   = gl.getUniformLocation(prog, 'u_c1')
    const uC2   = gl.getUniformLocation(prog, 'u_c2')
    const uDark = gl.getUniformLocation(prog, 'u_dark')

    function resize() {
      canvas!.width  = canvas!.offsetWidth
      canvas!.height = canvas!.offsetHeight
      gl!.viewport(0, 0, canvas!.width, canvas!.height)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    let raf = 0
    let prevTime = 0
    const FRAME_MS  = 1000 / 24
    const startTime = performance.now()

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick)
      if (now - prevTime < FRAME_MS) return
      prevTime = now

      const t    = (now - startTime) / 1000
      const cols = colorsRef.current
      const dark = darkRef.current
      const def  = dark ? DEFAULT_DARK : DEFAULT_LIGHT

      const pick = (i: number): [number, number, number] => {
        const c = cols[i] ?? cols[0]
        return c ? [c.r / 255, c.g / 255, c.b / 255] : def[i] as [number, number, number]
      }

      gl!.uniform1f(uTime, t)
      gl!.uniform2f(uRes, canvas!.width, canvas!.height)
      gl!.uniform3fv(uC0, pick(0))
      gl!.uniform3fv(uC1, pick(1))
      gl!.uniform3fv(uC2, pick(2))
      gl!.uniform1f(uDark, dark ? 1.0 : 0.0)
      gl!.drawArrays(gl!.TRIANGLE_STRIP, 0, 4)
    }

    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      gl.deleteProgram(prog)
      gl.deleteBuffer(buf)
      gl.deleteShader(vs)
      gl.deleteShader(fs)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        zIndex: 0,
        display: 'block',
        pointerEvents: 'none',
      }}
    />
  )
}
