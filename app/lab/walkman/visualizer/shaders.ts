// Fragment shaders for the Walkman background. Each visualizer only writes
// `vec3 viz(vec2 uv, vec2 p)`; the shared prelude gives it the audio, the
// palette and noise, and the shared main applies the post effects (dither,
// grain, vignette) and the fade, so every effect works on every visualizer.
//
//   uv  0..1 screen coordinates (y up)
//   p   aspect-correct coordinates centred on the Walkman

export type VizId = 'aura' | 'pulse' | 'halftone' | 'vhs' | 'contours' | 'tunnel' | 'warp'

export const VS = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`

const PRELUDE = `
#ifdef GL_OES_standard_derivatives
#extension GL_OES_standard_derivatives : enable
#endif
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform float uLevel, uBass, uMid, uHigh, uBeat;
uniform float uTravel;              // distance flown forward: speed follows the music, motion never jumps
uniform sampler2D uAudio;          // 64x2: row 0 = 32 bands, row 1 = 64 waveform samples
uniform vec3 uC0, uC1, uC2, uC3;   // palette, dark → bright
uniform vec3 uBg;
uniform float uDark, uDither, uGrain, uVignette, uIntensity, uFade;
uniform vec2 uCenter;

float band(float x) { return texture2D(uAudio, vec2((clamp(x, 0.0, 1.0) * 31.0 + 0.5) / 64.0, 0.25)).r; }
float wave(float x) { return texture2D(uAudio, vec2((clamp(x, 0.0, 1.0) * 63.0 + 0.5) / 64.0, 0.75)).r * 2.0 - 1.0; }

// palette ramp c0 → c1 → c2 → c3, and a looping version
vec3 pal(float t) {
  t = clamp(t, 0.0, 1.0) * 3.0;
  if (t < 1.0) return mix(uC0, uC1, t);
  if (t < 2.0) return mix(uC1, uC2, t - 1.0);
  return mix(uC2, uC3, t - 2.0);
}
vec3 palc(float t) {
  t = fract(t) * 4.0;
  if (t < 1.0) return mix(uC0, uC1, smoothstep(0.0, 1.0, t));
  if (t < 2.0) return mix(uC1, uC2, smoothstep(0.0, 1.0, t - 1.0));
  if (t < 3.0) return mix(uC2, uC3, smoothstep(0.0, 1.0, t - 2.0));
  return mix(uC3, uC0, smoothstep(0.0, 1.0, t - 3.0));
}

float hash1(float n) { return fract(sin(n) * 43758.5453123); }
float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash2(i), hash2(i + vec2(1.0, 0.0)), u.x),
             mix(hash2(i + vec2(0.0, 1.0)), hash2(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * noise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; }
  return v;
}

// ordered (Bayer) dither thresholds
float bayer2(vec2 a) { a = floor(a); return fract(a.x / 2.0 + a.y * a.y * 0.75); }
float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }
float bayer8(vec2 a) { return bayer4(0.5 * a) * 0.25 + bayer2(a); }

float aaWidth(float v) {
#ifdef GL_OES_standard_derivatives
  return fwidth(v);
#else
  return 0.02;
#endif
}
`

const MAIN = `
void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 p = (uv - uCenter) * vec2(uRes.x / uRes.y, 1.0);
  vec3 col = viz(uv, p);

  float vig = smoothstep(0.35, 1.25, length((uv - 0.5) * vec2(uRes.x / uRes.y, 1.0)));
  col = mix(col, uBg, vig * uVignette * 0.85);
  col = mix(uBg, col, uIntensity * uFade);

  if (uGrain > 0.5) col += (hash2(gl_FragCoord.xy + fract(uTime * 7.0) * 113.0) - 0.5) * 0.07;
  if (uDither > 0.5) {
    float levels = 4.0;
    col = floor(col * levels + bayer8(gl_FragCoord.xy)) / levels;
  }
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`

// ── 1. Aura: liquid colour, domain-warped and swelling with the song ──
const AURA = `
vec3 viz(vec2 uv, vec2 p) {
  float t = uTime * (0.05 + 0.09 * uLevel);
  vec2 q = p * 0.9;
  vec2 w = vec2(fbm(q + vec2(0.0, t)), fbm(q + vec2(5.2, 1.3) - t));
  vec2 r = vec2(fbm(q + 2.4 * w + vec2(1.7, 9.2) + t * 1.4), fbm(q + 2.4 * w + vec2(8.3, 2.8) - t));
  float n = fbm(q + (1.6 + 2.2 * uBass) * r);
  float d = length(p);
  // a halo hugging the Walkman, breathing with the bass, flaring on beats
  float glow = exp(-d * d * (3.2 - 2.0 * uBass)) * (0.3 + 0.8 * uLevel) + uBeat * 0.3 * exp(-d * 2.2);
  vec3 c = pal(clamp(n * 1.3 - 0.15 + glow * 0.4, 0.0, 1.0));
  float m = smoothstep(0.42, 0.85, n + glow * 0.45);
  return mix(uBg, c, clamp(m * (0.35 + 0.55 * uLevel) + glow * 0.3, 0.0, 1.0));
}
`

// ── 2. Pulse: 1-bit dithered shockwaves; the rings' shape is the spectrum ──
const PULSE = `
vec3 viz(vec2 uv, vec2 p) {
  float d = length(p);
  float a = abs(atan(p.x, p.y)) / 3.14159;          // 0 above the Walkman, 1 below, mirrored left/right
  float bAng = band(a);
  float bRad = band(d * 1.2);
  float rd = d - 0.07 * bAng * (0.4 + uLevel);           // spectrum bends the rings
  float rings = 0.5 + 0.5 * sin(rd * 46.0 - uTime * (1.5 + 5.0 * uLevel));
  float shock = exp(-abs(d - (1.0 - uBeat) * 1.15) * 16.0) * uBeat;
  float core = exp(-d * 2.6) * (0.25 + 0.9 * uBass);
  float field = bRad * smoothstep(1.3, 0.1, d) * (0.35 + 0.65 * rings) * (0.4 + 0.8 * uLevel) + shock + core;
  field += (noise(p * 3.0 + uTime * 0.2) - 0.5) * 0.12;
  float on = step(bayer8(gl_FragCoord.xy), clamp(field, 0.0, 1.0));
  vec3 ink = pal(0.35 + 0.6 * clamp(field, 0.0, 1.0));
  return mix(uBg, ink, on);
}
`

// ── 3. Halftone: a print-style radial equaliser of dots around the Walkman ──
const HALFTONE = `
vec3 viz(vec2 uv, vec2 p) {
  float cs = max(7.0, uRes.y / 62.0);
  vec2 cell = floor(gl_FragCoord.xy / cs);
  vec2 cc = (cell + 0.5) * cs;
  vec2 local = gl_FragCoord.xy - cc;
  vec2 cp = (cc / uRes - uCenter) * vec2(uRes.x / uRes.y, 1.0);
  float d = length(cp);
  float x = abs(atan(cp.x, cp.y)) / 3.14159;        // bass on top, treble below, mirrored left / right
  float b = band(x);
  float r0 = 0.3 + 0.04 * uBass;
  float ring = r0 + 0.05 + b * 0.45 * (0.5 + 0.7 * uLevel);
  float body = smoothstep(ring + 0.015, ring - 0.03, d) * smoothstep(r0 - 0.05, r0 + 0.02, d);
  float halo = exp(-max(0.0, d - ring) * 10.0) * 0.4 * uLevel;
  float ambient = 0.18 * (0.3 + uLevel) * (0.5 + 0.5 * sin(d * 18.0 - uTime * 2.5 - uBeat * 2.0));
  float size = clamp(max(body * (0.55 + 0.45 * b) + halo, ambient * smoothstep(1.4, 0.2, d)), 0.0, 1.0);
  float rad = size * cs * 0.52;
  float dotMask = smoothstep(rad + 0.9, rad - 0.9, length(local));
  vec3 c = pal(0.15 + 0.85 * (x * 0.7 + body * 0.3));
  return mix(uBg, c, dotMask);
}
`

// ── 4. VHS: drifting palette stripes, the waveform as a scope line, tape wobble ──
const VHS = `
vec3 tape(vec2 uv) {
  float y = uv.y + wave(uv.x) * 0.03 * uLevel;
  vec3 c = palc(y * 1.4 - uTime * 0.035 + uBass * 0.05);
  float stripes = 0.86 + 0.14 * smoothstep(0.35, 0.65, fract(y * 18.0 - uTime * 0.4));
  vec3 base = mix(uBg, c * stripes, 0.5 + 0.35 * uLevel);
  float scope = exp(-abs(uv.y - 0.5 - wave(uv.x) * 0.2 * (0.25 + uLevel)) * (140.0 - 60.0 * uLevel));
  // blended, not added, so the line reads on white as well as on black
  vec3 ink = mix(uC3, vec3(1.0), 0.3 * uDark);
  return mix(base, ink, clamp(scope * (0.5 + 0.7 * uLevel), 0.0, 1.0));
}
vec3 viz(vec2 uv, vec2 p) {
  float line = floor(uv.y * 120.0);
  float jitter = (hash1(line + floor(uTime * 24.0) * 7.0) - 0.5) * 0.014 * (uBeat * 1.4 + uHigh * 0.25);
  float tb = fract(uTime * 0.06);
  float track = smoothstep(0.035, 0.0, abs(uv.y - tb));
  vec2 u2 = uv + vec2(jitter + track * 0.025, 0.0);
  float ab = 0.003 + 0.012 * uBeat + 0.004 * uBass;
  vec3 col = vec3(tape(u2 + vec2(ab, 0.0)).r, tape(u2).g, tape(u2 - vec2(ab, 0.0)).b);
  col *= 0.9 + 0.1 * sin(gl_FragCoord.y * 1.7);
  col += track * (hash2(gl_FragCoord.xy + uTime) - 0.5) * 0.25;
  return col;
}
`

// ── 5. Contours: a topographic map that breathes; bass raises the ground ──
const CONTOURS = `
vec3 viz(vec2 uv, vec2 p) {
  float t = uTime * 0.04;
  float d = length(p);
  float h = fbm(p * 1.6 + vec2(t, -t * 0.7));
  h += (uBass * 0.35 + uBeat * 0.12) * exp(-d * 2.4);
  h += band(d) * 0.12 * uLevel;
  float v = h * 24.0;
  float fw = max(aaWidth(v), 0.0005);
  float dist = abs(fract(v) - 0.5);
  float major = step(4.5, mod(floor(v), 5.0));
  float width = 0.6 + major * 0.9 + uLevel * 1.2;
  float l = 1.0 - smoothstep(0.0, fw * (1.0 + width), 0.5 - dist);
  vec3 c = pal(clamp(h * 1.4 - 0.2, 0.0, 1.0));
  vec3 base = mix(uBg, pal(clamp(h, 0.0, 1.0)), 0.08 + 0.1 * uLevel);
  return mix(base, c, l * (0.55 + 0.45 * uLevel));
}
`

// ── 6. Tunnel: an endless tube of blocks rushing past, into the vanishing point ──
const TUNNEL = `
vec3 viz(vec2 uv, vec2 p) {
  float r = length(p) + 1e-4;
  float a = atan(p.y, p.x) / 6.28318 + 0.5;            // 0..1 around the tube
  float z = 0.32 / r + uTravel;                         // depth: near at the edges, far at the centre
  float N = 22.0;
  vec2 g = vec2(a * N, z * 3.0);
  vec2 id = vec2(mod(floor(g.x), N), floor(g.y));
  vec2 f = fract(g);
  // bevelled blocks with dark seams between them
  vec2 e = smoothstep(vec2(0.0), vec2(0.1), f) * smoothstep(vec2(0.0), vec2(0.1), 1.0 - f);
  // far away the blocks get smaller than a pixel: let their seams melt into an
  // even tone there instead of shimmering
  float block = mix(0.6, e.x * e.y, smoothstep(0.06, 0.32, r));
  float rnd = hash2(id);
  // each column around the ring follows a frequency band (mirrored, so it's symmetric)
  float b = band(abs(id.x / N - 0.5) * 2.0);
  float lit = smoothstep(0.55, 1.0, rnd + b * 0.75 * (0.4 + uLevel));
  // a pulse that rushes outward on every beat
  float pulse = uBeat * exp(-abs(fract(z * 0.5 - uTravel * 0.5) - 0.5) * 18.0);
  // the far end fades into the room colour: the infinity
  float fog = smoothstep(0.04, 0.55, r);
  vec3 c = pal(clamp(0.25 + rnd * 0.35 + lit * 0.4, 0.0, 1.0));
  float shade = block * (0.22 + 0.78 * lit + pulse * 0.6) * fog;
  return mix(uBg, c, clamp(shade * (0.6 + 0.4 * uLevel), 0.0, 1.0));
}
`

// ── 7. Warp: flying through a field of stars; faster music, longer streaks ──
const WARP = `
vec3 viz(vec2 uv, vec2 p) {
  vec2 dir = normalize(p + 1e-5);
  float speed = 1.0 + 5.0 * uLevel + 4.0 * uBeat;
  vec3 col = vec3(0.0);
  for (int i = 0; i < 5; i++) {
    float fi = float(i);
    float depth = fract(uTravel * 0.22 + fi * 0.2);     // 0 = far away, 1 = flying past
    float scale = mix(22.0, 1.4, depth);
    vec2 q = p * scale + vec2(fi * 7.31, fi * 3.17);
    vec2 id = floor(q);
    vec2 d = fract(q) - 0.5 - (vec2(hash2(id), hash2(id + 17.1)) - 0.5) * 0.7;
    // stretch each star along the line out from the centre: a streak
    float along = dot(d, dir), across = d.x * dir.y - d.y * dir.x;
    float stretch = 1.0 + speed * depth * depth * 3.0;
    float star = exp(-across * across * 1400.0 - along * along * 1400.0 / (stretch * stretch));
    float here = step(0.45, hash2(id + 3.7));           // not every cell holds a star
    float fade = smoothstep(0.0, 0.35, depth) * smoothstep(1.0, 0.8, depth);
    col += pal(0.6 + 0.4 * hash2(id + 9.1)) * star * here * fade * (0.5 + depth);
  }
  // a soft glow at the vanishing point that swells with the bass
  col += pal(0.85) * exp(-length(p) * 4.0) * (0.06 + 0.25 * uBass);
  float m = clamp(max(col.r, max(col.g, col.b)), 0.0, 1.0);
  return mix(uBg, col / max(m, 1e-3), clamp(m * 1.3, 0.0, 1.0));
}
`

const BODIES: Record<VizId, string> = { aura: AURA, pulse: PULSE, halftone: HALFTONE, vhs: VHS, contours: CONTOURS, tunnel: TUNNEL, warp: WARP }

export const buildFrag = (id: VizId) => PRELUDE + BODIES[id] + MAIN

// render-buffer scale per visualizer: soft fields render small and upscale
// smoothly; the dithered one renders small on purpose for chunky pixels
export const VIZ_SCALE: Record<VizId, number> = { aura: 0.35, pulse: 0.42, halftone: 1, vhs: 0.6, contours: 0.8, tunnel: 0.55, warp: 0.65 }
export const VIZ_PIXELATED: Record<VizId, boolean> = { aura: false, pulse: true, halftone: false, vhs: false, contours: false, tunnel: false, warp: false }
