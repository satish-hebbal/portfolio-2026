import type { VizId } from './shaders'

export type PaletteId = 'album' | 'walkman' | 'lcd' | 'sunset' | 'riso' | 'mono'

export interface VizSettings {
  viz: VizId | 'off'
  palette: PaletteId
  dither: boolean
  grain: boolean
  vignette: boolean
  intensity: number // 0..1
  idle: boolean     // keep it running with no tape playing
  source: 'song' | 'auto' // follow the song's analysis when there is one, or the auto groove
  remix: boolean          // colours drift endlessly around the wheel instead of holding one palette
}

export const DEFAULT_SETTINGS: VizSettings = {
  viz: 'warp', palette: 'lcd', dither: false, grain: true, vignette: true, intensity: 0.85, idle: false, source: 'song', remix: false,
}

export const VIZ_LIST: { id: VizId; name: string; blurb: string }[] = [
  { id: 'aura', name: 'Aura', blurb: 'liquid colour that swells with the song' },
  { id: 'pulse', name: 'Pulse', blurb: '1-bit dithered shockwaves on the beat' },
  { id: 'halftone', name: 'Halftone', blurb: 'a printed radial equaliser' },
  { id: 'vhs', name: 'VHS', blurb: 'tape stripes, scope line, wobble' },
  { id: 'contours', name: 'Contours', blurb: 'a topographic map that breathes' },
  { id: 'tunnel', name: 'Tunnel', blurb: 'an endless tube of blocks rushing past' },
  { id: 'warp', name: 'Warp', blurb: 'flying through stars into deep space' },
]

type RGB = [number, number, number]
const hex = (h: string): RGB => {
  const n = parseInt(h.slice(1), 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

export const PALETTES: { id: PaletteId; name: string; colors: string[] }[] = [
  { id: 'album', name: 'Album', colors: [] }, // from the cover art
  { id: 'walkman', name: 'Walkman', colors: ['#06204a', '#0b3e88', '#2f6fd6', '#9ec5ff'] },
  { id: 'lcd', name: 'LCD', colors: ['#002a18', '#00804a', '#00ff88', '#c8ffe6'] },
  { id: 'sunset', name: 'Sunset', colors: ['#3b0f6b', '#c8227a', '#ff6b3d', '#ffd36b'] },
  { id: 'riso', name: 'Riso', colors: ['#1d3fbb', '#ff48b0', '#ffe800', '#00a95c'] },
  { id: 'mono', name: 'Mono', colors: ['#2a2a2a', '#6b6b6b', '#b5b5b5', '#f2f2f2'] },
]

const lum = ([r, g, b]: RGB) => 0.2126 * r + 0.7152 * g + 0.0722 * b

// album colours: drop the dullest, lift saturation a touch so the cover sings
function fromAlbum(glows: { r: number; g: number; b: number }[]): RGB[] | null {
  if (!glows.length) return null
  const cols = glows.slice(0, 4).map((c) => {
    const rgb: RGB = [c.r / 255, c.g / 255, c.b / 255]
    const l = lum(rgb)
    return rgb.map((v) => Math.min(1, Math.max(0, l + (v - l) * 1.25))) as RGB
  })
  while (cols.length < 4) cols.push(cols[cols.length - 1])
  return cols
}

// the ramp the shaders read runs from "close to the background" to "most
// contrast against it", so the same palette reads on black and on white
export function resolvePalette(id: PaletteId, darkBg: boolean, glows: { r: number; g: number; b: number }[]): RGB[] {
  const album = id === 'album' ? fromAlbum(glows) : null
  let cols: RGB[] = album ?? (PALETTES.find((p) => p.id === (id === 'album' ? 'walkman' : id))!.colors.map(hex))
  if (id === 'mono' && !darkBg) cols = ['#e6e6e6', '#a8a8a8', '#5a5a5a', '#141414'].map(hex)
  return [...cols].sort((a, b) => (darkBg ? lum(a) - lum(b) : lum(b) - lum(a)))
}

const KEY = 'walkman:viz'

export function loadSettings(): VizSettings {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return DEFAULT_SETTINGS
    const s = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } as VizSettings
    if (s.viz !== 'off' && !VIZ_LIST.some((v) => v.id === s.viz)) s.viz = DEFAULT_SETTINGS.viz
    if (!PALETTES.some((p) => p.id === s.palette)) s.palette = DEFAULT_SETTINGS.palette
    // every visit starts by following the song; auto groove is a per-visit choice
    s.source = 'song'
    return s
  } catch { return DEFAULT_SETTINGS }
}

export function saveSettings(s: VizSettings) {
  try { localStorage.setItem(KEY, JSON.stringify(s)) } catch { /* private mode: settings last this visit */ }
}

// ── album theme: the page takes its colour from the cover ──

export type ThemeMode = 'light' | 'dark' | 'album'

// a rich, mid-dark room colour from the cover's most vivid colour: never
// washed out, never black, dark enough that light text and the visualizer read
export function albumBackground(glows: { r: number; g: number; b: number }[]): [number, number, number] | null {
  const c = glows[0]
  if (!c) return null
  const r = c.r / 255, g = c.g / 255, b = c.b / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  let h = 0
  const d = max - min
  if (d > 0) {
    if (max === r) h = ((g - b) / d) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h *= 60
    if (h < 0) h += 360
  }
  const l0 = (max + min) / 2
  const s0 = d === 0 ? 0 : d / (1 - Math.abs(2 * l0 - 1))
  const s = Math.min(0.62, Math.max(0.28, s0)), l = 0.3
  // hsl → rgb
  const k = (n: number) => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)]
}

const THEME_KEY = 'walkman:theme'
export function loadTheme(): ThemeMode {
  try { const t = localStorage.getItem(THEME_KEY); if (t === 'light' || t === 'dark' || t === 'album') return t } catch {}
  return 'dark' // first visit: night, so the warp field glows
}
export function saveTheme(t: ThemeMode) {
  try { localStorage.setItem(THEME_KEY, t) } catch { /* private mode */ }
}
