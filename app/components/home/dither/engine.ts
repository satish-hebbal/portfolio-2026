/*
 * Turns a hero figure into a 1-bit cell grid.
 *
 * Two families, as in the Mockup Studio dither engine this is adapted from:
 * error diffusion walks the grid and pushes each cell's rounding error onto
 * cells it hasn't visited yet; ordered dithering compares each cell against a
 * fixed threshold pattern and never looks at its neighbours. "amplitude" is
 * neither: every cell is kept and its tone becomes the dot size, which is how
 * a real halftone screen works.
 */

import type { DitherSettings } from './settings'

export interface Grid {
  w: number
  h: number
  cell: number
  /** ink cells: top-left in CSS px, tone 0..1, and two fixed hashes for scatter */
  x: Float32Array
  y: Float32Array
  tone: Float32Array
  ha: Float32Array
  hb: Float32Array
  count: number
  /** inside-the-silhouette cells left blank, for the optional paper fill */
  px: Float32Array
  py: Float32Array
  paperCount: number
}

export function hash2(x: number, y: number, salt: number): number {
  let h = (x * 374761393 + y * 668265263 + salt * 2246822519) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  h = h ^ (h >>> 16)
  return ((h >>> 0) % 100000) / 100000
}

type Kernel = [dx: number, dy: number, w: number][]
const k = (rows: [number, number, number][], div: number): Kernel => rows.map(([dx, dy, w]) => [dx, dy, w / div])

const KERNELS: Record<string, Kernel> = {
  'floyd-steinberg': k([[1, 0, 7], [-1, 1, 3], [0, 1, 5], [1, 1, 1]], 16),
  // passes on six eighths of the error; the lost quarter keeps whites clean
  atkinson: k([[1, 0, 1], [2, 0, 1], [-1, 1, 1], [0, 1, 1], [1, 1, 1], [0, 2, 1]], 8),
  stucki: k([[1, 0, 8], [2, 0, 4], [-2, 1, 2], [-1, 1, 4], [0, 1, 8], [1, 1, 4], [2, 1, 2], [-2, 2, 1], [-1, 2, 2], [0, 2, 4], [1, 2, 2], [2, 2, 1]], 42),
  burkes: k([[1, 0, 8], [2, 0, 4], [-2, 1, 2], [-1, 1, 4], [0, 1, 8], [1, 1, 4], [2, 1, 2]], 32),
  'sierra-lite': k([[1, 0, 2], [-1, 1, 1], [0, 1, 1]], 4),
  jarvis: k([[1, 0, 7], [2, 0, 5], [-2, 1, 3], [-1, 1, 5], [0, 1, 7], [1, 1, 5], [2, 1, 3], [-2, 2, 1], [-1, 2, 3], [0, 2, 5], [1, 2, 3], [2, 2, 1]], 48),
}

/** Bayer matrix of side 2^n, built by the standard recursion, normalised to 0..1. */
const bayerCache = new Map<number, Float32Array>()
function bayer(size: number): Float32Array {
  const hit = bayerCache.get(size)
  if (hit) return hit
  let m = [[0, 2], [3, 1]]
  while (m.length < size) {
    const n = m.length
    const next = Array.from({ length: n * 2 }, () => new Array<number>(n * 2).fill(0))
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const v = m[y][x] * 4
      next[y][x] = v; next[y][x + n] = v + 2; next[y + n][x] = v + 3; next[y + n][x + n] = v + 1
    }
    m = next
  }
  const out = new Float32Array(size * size)
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) out[y * size + x] = (m[y][x] + 0.5) / (size * size)
  bayerCache.set(size, out)
  return out
}

/** Cheap blue noise: white noise high-passed three times, then re-ranked to a uniform spread. */
let blueCache: Float32Array | null = null
function blueNoise(size = 64): Float32Array {
  if (blueCache) return blueCache
  const n = size * size
  let f = new Float32Array(n)
  for (let i = 0; i < n; i++) f[i] = hash2(i % size, (i / size) | 0, 7)
  const at = (a: Float32Array, x: number, y: number) => a[((y + size) % size) * size + ((x + size) % size)]
  for (let pass = 0; pass < 3; pass++) {
    const next = new Float32Array(n)
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      let sum = 0
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) sum += at(f, x + dx, y + dy)
      next[y * size + x] = f[y * size + x] - sum / 25
    }
    f = next
  }
  const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => f[a] - f[b])
  const out = new Float32Array(n)
  for (let r = 0; r < n; r++) out[order[r]] = (r + 0.5) / n
  blueCache = out
  return out
}

/** Threshold for the ordered family at grid cell (x, y). */
function orderedThreshold(algo: string, x: number, y: number): number {
  switch (algo) {
    case 'bayer2': return bayer(2)[(y % 2) * 2 + (x % 2)]
    case 'bayer4': return bayer(4)[(y % 4) * 4 + (x % 4)]
    case 'bayer8': return bayer(8)[(y % 8) * 8 + (x % 8)]
    case 'bayer16': return bayer(16)[(y % 16) * 16 + (x % 16)]
    case 'blue-noise': return blueNoise()[(y % 64) * 64 + (x % 64)]
    case 'white-noise': return hash2(x, y, 11)
    case 'halftone': {
      // dot screen rotated 45° so it doesn't line up with the grid into a plaid
      const s = 6
      const u = (x + y) % s, v = (x - y + s * 1000) % s
      const dx = u / s - 0.5, dy = v / s - 0.5
      return Math.min(1, Math.sqrt(dx * dx + dy * dy) * 2.4)
    }
    case 'hatch': return ((x + y * 2) % 5) / 5
    case 'crosshatch': return Math.min(((x + y) % 6) / 6, ((x - y + 600) % 6) / 6) * 1.6
    case 'lines': return (y % 4) / 4
    default: return 0.5 // threshold
  }
}

/** Tone for one source pixel, through every tone control, 0 = paper, 1 = full ink. */
function shapeTone(lum: number, alpha: number, s: DitherSettings): number {
  let t = (1 - lum) * alpha
  t = (t - 0.5) * s.contrast + 0.5 + s.brightness
  t = Math.min(1, Math.max(0, t))
  t = Math.pow(t, s.gamma)
  return s.invert ? 1 - t : t
}

export function buildGrid(img: HTMLImageElement, w: number, h: number, s: DitherSettings): Grid {
  const cell = Math.max(1, Math.round(s.cell))
  const cols = Math.ceil(w / cell), rows = Math.ceil(h / cell)
  const c = document.createElement('canvas')
  c.width = cols; c.height = rows
  const cx = c.getContext('2d', { willReadFrequently: true })!
  cx.drawImage(img, 0, 0, cols, rows)
  const px = cx.getImageData(0, 0, cols, rows).data

  const N = cols * rows
  const tone = new Float32Array(N)
  const inside = new Uint8Array(N)
  for (let i = 0; i < N; i++) {
    const a = px[i * 4 + 3] / 255
    if (a < 0.15) continue
    inside[i] = 1
    const lum = (0.2126 * px[i * 4] + 0.7152 * px[i * 4 + 1] + 0.0722 * px[i * 4 + 2]) / 255
    tone[i] = shapeTone(lum, a, s)
  }

  const on = new Uint8Array(N)
  const kernel = KERNELS[s.algo]
  if (s.algo === 'amplitude') {
    for (let i = 0; i < N; i++) if (inside[i] && tone[i] > 0.04) on[i] = 1
  } else if (kernel) {
    const work = tone.slice()
    for (let y = 0; y < rows; y++) {
      const rtl = s.serpentine && y % 2 === 1
      for (let step = 0; step < cols; step++) {
        const x = rtl ? cols - 1 - step : step
        const i = y * cols + x
        if (!inside[i]) continue
        const v = work[i]
        const bit = v >= s.threshold ? 1 : 0
        on[i] = bit
        const err = (v - bit) * s.errorAmount
        for (const [dx, dy, wgt] of kernel) {
          const nx = x + (rtl ? -dx : dx), ny = y + dy
          if (nx < 0 || nx >= cols || ny >= rows) continue
          const j = ny * cols + nx
          // only into the silhouette, or error leaks out as stray dots
          if (inside[j]) work[j] += err * wgt
        }
      }
    }
  } else {
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const i = y * cols + x
      if (!inside[i]) continue
      // threshold slider shifts the whole mask; 0.5 leaves it centred
      const t = orderedThreshold(s.algo, x, y) + (s.threshold - 0.5)
      on[i] = tone[i] >= t ? 1 : 0
    }
  }

  let count = 0, paperCount = 0
  for (let i = 0; i < N; i++) if (on[i]) count++; else if (inside[i]) paperCount++
  const g: Grid = {
    w, h, cell,
    x: new Float32Array(count), y: new Float32Array(count), tone: new Float32Array(count),
    ha: new Float32Array(count), hb: new Float32Array(count), count,
    px: new Float32Array(paperCount), py: new Float32Array(paperCount), paperCount,
  }
  let a = 0, b = 0
  for (let i = 0; i < N; i++) {
    const col = i % cols, row = (i / cols) | 0
    if (on[i]) {
      g.x[a] = col * cell; g.y[a] = row * cell; g.tone[a] = tone[i]
      g.ha[a] = hash2(col, row, 31); g.hb[a] = hash2(col, row, 32)
      a++
    } else if (inside[i]) {
      g.px[b] = col * cell; g.py[b] = row * cell
      b++
    }
  }
  return g
}
