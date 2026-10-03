/*
 * Dither effect settings: the one source of truth shared by both hero figures
 * and the temporary tuning panel.
 *
 * DEFAULTS are what visitors get. The panel only exists in development or with
 * ?dither in the URL, and only then are saved settings read back from
 * localStorage, so experiments never leak to the live site. To ship a look,
 * use "Copy as code" in the panel and paste it over DEFAULTS.
 */

export type DitherAlgo =
  | 'atkinson' | 'floyd-steinberg' | 'stucki' | 'burkes' | 'sierra-lite' | 'jarvis'
  | 'bayer2' | 'bayer4' | 'bayer8' | 'bayer16' | 'blue-noise' | 'white-noise'
  | 'halftone' | 'hatch' | 'crosshatch' | 'lines' | 'threshold' | 'amplitude'

export type DotShape = 'square' | 'circle' | 'diamond' | 'hline' | 'vline' | 'cross' | 'slash'
export type ScatterMode = 'random' | 'push' | 'pull' | 'swirl' | 'fall' | 'none'
export type EffectMode = 'lens' | 'always' | 'reveal'
export type Target = 'both' | 'abhay' | 'tejas'
export type HeroEffect = 'dither' | 'shader'

export interface DitherSettings {
  // which effect the hero figures use
  effect: HeroEffect
  // shader reveal (painting under the engraving)
  shNoise: number
  shNoiseScale: number
  shSoftness: number
  shGlow: number
  shGlowWidth: number
  shEdgeColor: string
  shDistort: number
  shDitherEdge: boolean
  shAnimate: boolean
  shSpeed: number
  shSwap: boolean
  // effect
  enabled: boolean
  mode: EffectMode
  target: Target
  // dither
  algo: DitherAlgo
  cell: number
  dotScale: number
  shape: DotShape
  errorAmount: number
  serpentine: boolean
  // tone
  contrast: number
  brightness: number
  gamma: number
  threshold: number
  invert: boolean
  // colour
  inkColor: string
  inkOpacity: number
  paper: boolean
  paperColor: string
  paperOpacity: number
  // pointer
  radius: number
  falloff: number
  erase: number
  alphaBoost: number
  // scatter
  scatter: ScatterMode
  throw: number
  jitter: number
  // trail
  trail: boolean
  healMs: number
  enterMs: number
  spacing: number
  maxStamps: number
  // rendering
  dprCap: number
}

// Shipped look: the "shad-a" preset tuned in the Dither Lab. The painting
// is revealed under the engraving through a ragged, flowing black-rimmed hole.
export const DEFAULTS: DitherSettings = {
  effect: 'shader',
  shNoise: 1.42,
  shNoiseScale: 4,
  shSoftness: 0.072,
  shGlow: 0.85,
  shGlowWidth: 0.11,
  shEdgeColor: '#000000',
  shDistort: 0.55,
  shDitherEdge: false,
  shAnimate: true,
  shSpeed: 1.2,
  shSwap: false,
  enabled: true,
  mode: 'lens',
  target: 'both',
  algo: 'atkinson',
  cell: 6,
  dotScale: 0.75,
  shape: 'square',
  errorAmount: 1,
  serpentine: false,
  contrast: 1.8,
  brightness: 0,
  gamma: 1,
  threshold: 0.5,
  invert: false,
  inkColor: '#0a0a0a',
  inkOpacity: 1,
  paper: false,
  paperColor: '#f4efe6',
  paperOpacity: 1,
  radius: 170,
  falloff: 1.2,
  erase: 1,
  alphaBoost: 2.5,
  scatter: 'random',
  throw: 0.35,
  jitter: 0,
  trail: true,
  healMs: 2200,
  enterMs: 180,
  spacing: 0.2,
  maxStamps: 40,
  dprCap: 2,
}

/** Settings that change the dithered grid itself and need it rebuilt. */
export const GRID_KEYS: (keyof DitherSettings)[] = [
  'algo', 'cell', 'errorAmount', 'serpentine', 'contrast', 'brightness', 'gamma', 'threshold', 'invert', 'dprCap',
]

const CURRENT_KEY = 'sa-dither-settings'
const PRESETS_KEY = 'sa-dither-presets'

export function panelAllowed(): boolean {
  if (typeof window === 'undefined') return false
  return process.env.NODE_ENV === 'development' || new URLSearchParams(window.location.search).has('dither')
}

// ── store ─────────────────────────────────────────────────────────────────────

type Listener = (s: DitherSettings, changed: (keyof DitherSettings)[]) => void

let current: DitherSettings = { ...DEFAULTS }
let loaded = false
const listeners = new Set<Listener>()

const readJSON = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}
const writeJSON = (key: string, value: unknown) => {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* storage full or blocked */ }
}

export function getSettings(): DitherSettings {
  if (!loaded && typeof window !== 'undefined') {
    loaded = true
    if (panelAllowed()) current = { ...DEFAULTS, ...readJSON<Partial<DitherSettings>>(CURRENT_KEY, {}) }
  }
  return current
}

export function setSettings(patch: Partial<DitherSettings>) {
  const prev = getSettings()
  const changed = (Object.keys(patch) as (keyof DitherSettings)[]).filter((k) => prev[k] !== patch[k])
  if (!changed.length) return
  current = { ...prev, ...patch }
  if (panelAllowed()) writeJSON(CURRENT_KEY, current)
  listeners.forEach((l) => l(current, changed))
}

export function subscribe(l: Listener): () => void {
  listeners.add(l)
  return () => { listeners.delete(l) }
}

// ── presets ───────────────────────────────────────────────────────────────────

// The dither presets were tuned against the original dither defaults, so they
// carry that baseline with them instead of inheriting the shipped shader look.
const DITHER_BASE: Partial<DitherSettings> = {
  effect: 'dither', cell: 4, contrast: 1.25, radius: 120, falloff: 2, healMs: 900, shDistort: 0,
}
const SHADER_BASE: Partial<DitherSettings> = { effect: 'shader', shNoise: 0.35, shNoiseScale: 1.6, shSoftness: 0.04, shSpeed: 0.5, shDistort: 0 }

export const BUILT_IN_PRESETS: Record<string, Partial<DitherSettings>> = {
  'shad-a (shipped)': {},
  'Dust': { ...DITHER_BASE },
  'Engraver': { ...DITHER_BASE, algo: 'hatch', cell: 3, dotScale: 1, shape: 'square', scatter: 'swirl', throw: 0.25, contrast: 1.4 },
  'Newsprint': { ...DITHER_BASE, algo: 'amplitude', cell: 7, shape: 'circle', dotScale: 1.1, scatter: 'push', throw: 0.5, contrast: 1.2 },
  'Game Boy': { ...DITHER_BASE, algo: 'bayer4', cell: 6, dotScale: 1, shape: 'square', inkColor: '#0f380f', paper: true, paperColor: '#9bbc0f', scatter: 'none', mode: 'reveal' },
  'Pixel storm': { ...DITHER_BASE, algo: 'floyd-steinberg', cell: 5, scatter: 'random', throw: 1.2, jitter: 2, healMs: 1800, radius: 160 },
  'Gravity': { ...DITHER_BASE, algo: 'atkinson', cell: 4, scatter: 'fall', throw: 0.9, healMs: 1400, radius: 130 },
  'Full dither': { ...DITHER_BASE, mode: 'always', algo: 'blue-noise', cell: 3, dotScale: 0.9, scatter: 'push', throw: 0.4 },
  'Gold leaf reveal': { ...SHADER_BASE, radius: 150, falloff: 1.6, healMs: 1400, shNoise: 0.4, shGlow: 1, shGlowWidth: 0.05, shEdgeColor: '#d4a24c' },
  'Ink bleed reveal': { ...SHADER_BASE, radius: 170, falloff: 1.2, healMs: 2200, shNoise: 0.7, shNoiseScale: 2.6, shGlow: 0.3, shEdgeColor: '#1a1a1a', shDistort: 0.5 },
  'Dither reveal': { ...SHADER_BASE, radius: 140, falloff: 2, shDitherEdge: true, shSoftness: 0.12, shGlow: 0, shNoise: 0.25 },
  'Bronze seal': { ...DITHER_BASE, algo: 'crosshatch', cell: 4, inkColor: '#8a5a2b', scatter: 'pull', throw: 0.3, radius: 140 },
}

export function getUserPresets(): Record<string, Partial<DitherSettings>> {
  return readJSON(PRESETS_KEY, {})
}
export function saveUserPreset(name: string, s: DitherSettings) {
  writeJSON(PRESETS_KEY, { ...getUserPresets(), [name]: s })
}
export function deleteUserPreset(name: string) {
  const all = getUserPresets()
  delete all[name]
  writeJSON(PRESETS_KEY, all)
}

/** The current settings as a DEFAULTS block, ready to paste into this file. */
export function asCode(s: DitherSettings): string {
  const body = (Object.keys(DEFAULTS) as (keyof DitherSettings)[])
    .map((k) => `  ${k}: ${JSON.stringify(s[k]).replace(/"/g, "'")},`)
    .join('\n')
  return `export const DEFAULTS: DitherSettings = {\n${body}\n}\n`
}
