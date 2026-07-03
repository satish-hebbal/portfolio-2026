// Studio-Kapi — instrument & FX preset catalog
import type { PresetDef, FxState, FxType, SynthParams } from './types'

export const SAMPLE_BASE = '/lab/studio-kapi/samples'

// Drum one-shots (bundled WAV files)
export const DRUM_SAMPLES: Record<string, string> = {
  kick: `${SAMPLE_BASE}/kick.wav`,
  'kick-808': `${SAMPLE_BASE}/kick-808.wav`,
  snare: `${SAMPLE_BASE}/snare.wav`,
  rim: `${SAMPLE_BASE}/rim.wav`,
  clap: `${SAMPLE_BASE}/clap.wav`,
  'hat-closed': `${SAMPLE_BASE}/hat-closed.wav`,
  'hat-open': `${SAMPLE_BASE}/hat-open.wav`,
  ride: `${SAMPLE_BASE}/ride.wav`,
  crash: `${SAMPLE_BASE}/crash.wav`,
  'tom-low': `${SAMPLE_BASE}/tom-low.wav`,
  'tom-high': `${SAMPLE_BASE}/tom-high.wav`,
  cowbell: `${SAMPLE_BASE}/cowbell.wav`,
  shaker: `${SAMPLE_BASE}/shaker.wav`,
  conga: `${SAMPLE_BASE}/conga.wav`,
}

// Piano sampler note->file map (Tone.Sampler interpolates the gaps)
export const PIANO_SAMPLES: Record<string, string> = {
  C2: `${SAMPLE_BASE}/piano-C2.wav`,
  C3: `${SAMPLE_BASE}/piano-C3.wav`,
  C4: `${SAMPLE_BASE}/piano-C4.wav`,
  C5: `${SAMPLE_BASE}/piano-C5.wav`,
  C6: `${SAMPLE_BASE}/piano-C6.wav`,
}

// Synth voice configs consumed by the engine factory
export interface SynthSpec {
  voice: 'mono' | 'poly' | 'fm' | 'am' | 'pluck' | 'duo'
  options: Record<string, unknown>
  defaultWave: string
}

export const SYNTH_SPECS: Record<string, SynthSpec> = {
  bass:   { voice: 'mono', defaultWave: 'sawtooth', options: { filter: { Q: 2, type: 'lowpass' } } },
  sub:    { voice: 'mono', defaultWave: 'sine', options: {} },
  reese:  { voice: 'mono', defaultWave: 'fatsawtooth', options: { oscillator: { count: 3, spread: 40 }, filter: { type: 'lowpass' } } },
  acid:   { voice: 'mono', defaultWave: 'square', options: { filter: { Q: 6, type: 'lowpass' } } },
  lead:   { voice: 'fm', defaultWave: 'sawtooth', options: { harmonicity: 2, modulationIndex: 6, modulation: { type: 'square' } } },
  supersaw: { voice: 'poly', defaultWave: 'fatsawtooth', options: { oscillator: { count: 5, spread: 40 } } },
  pluck:  { voice: 'pluck', defaultWave: 'sawtooth', options: { attackNoise: 1, dampening: 4000, resonance: 0.9 } },
  pad:    { voice: 'poly', defaultWave: 'fatsawtooth', options: { oscillator: { count: 3, spread: 30 } } },
  keys:   { voice: 'poly', defaultWave: 'triangle', options: {} },
  organ:  { voice: 'poly', defaultWave: 'sine', options: {} },
  bell:   { voice: 'fm', defaultWave: 'sine', options: { harmonicity: 3.01, modulationIndex: 14, modulation: { type: 'sine' } } },
  arp:    { voice: 'mono', defaultWave: 'square', options: {} },
  brass:  { voice: 'am', defaultWave: 'sawtooth', options: { harmonicity: 1.5 } },
  stab:   { voice: 'poly', defaultWave: 'square', options: {} },
  // Electronic / French house / Daft-Punk flavoured (pure synthesis, no samples)
  funkbass: { voice: 'mono', defaultWave: 'square', options: { filter: { Q: 4, type: 'lowpass' } } },
  disco:    { voice: 'poly', defaultWave: 'sawtooth', options: {} },
  hoover:   { voice: 'mono', defaultWave: 'fatsawtooth', options: { oscillator: { count: 3, spread: 60 }, filter: { Q: 3, type: 'lowpass' } } },
  prophet:  { voice: 'poly', defaultWave: 'fatsawtooth', options: { oscillator: { count: 2, spread: 20 } } },
  digibell: { voice: 'fm', defaultWave: 'sine', options: { harmonicity: 7, modulationIndex: 10, modulation: { type: 'sine' } } },
  // Keys
  fmep:   { voice: 'fm', defaultWave: 'sine', options: { harmonicity: 5, modulationIndex: 8, modulation: { type: 'sine' } } },
  clav:   { voice: 'poly', defaultWave: 'square', options: {} },
}

// Default synth macro values, tuned per preset where useful
export const DEFAULT_SYNTH: SynthParams = {
  wave: 'sawtooth',
  attack: 0.04, decay: 0.3, sustain: 0.5, release: 0.35,
  cutoff: 0.7, reso: 0.15, detune: 0, glide: 0, gain: 0.85, pitch: 0,
}

export const SYNTH_DEFAULT_OVERRIDES: Record<string, Partial<SynthParams>> = {
  bass:   { attack: 0.01, decay: 0.25, sustain: 0.4, release: 0.3, cutoff: 0.45 },
  sub:    { attack: 0.02, decay: 0.3, sustain: 0.8, release: 0.4, cutoff: 0.3 },
  reese:  { attack: 0.02, decay: 0.4, sustain: 0.7, release: 0.5, cutoff: 0.4, detune: 0.3 },
  acid:   { attack: 0.005, decay: 0.18, sustain: 0.2, release: 0.2, cutoff: 0.5, reso: 0.6 },
  lead:   { attack: 0.01, decay: 0.2, sustain: 0.5, release: 0.3, cutoff: 0.8 },
  supersaw: { attack: 0.05, decay: 0.3, sustain: 0.7, release: 0.5, cutoff: 0.85, detune: 0.4 },
  pluck:  { attack: 0.005, decay: 0.2, sustain: 0.0, release: 0.3, cutoff: 0.8 },
  pad:    { attack: 0.6, decay: 0.5, sustain: 0.8, release: 0.7, cutoff: 0.7, detune: 0.25 },
  keys:   { attack: 0.01, decay: 0.4, sustain: 0.3, release: 0.4 },
  organ:  { attack: 0.02, decay: 0.1, sustain: 0.9, release: 0.2 },
  bell:   { attack: 0.001, decay: 0.6, sustain: 0.0, release: 0.6, cutoff: 1 },
  arp:    { attack: 0.005, decay: 0.12, sustain: 0.2, release: 0.18, cutoff: 0.75 },
  brass:  { attack: 0.06, decay: 0.2, sustain: 0.7, release: 0.3, cutoff: 0.7 },
  stab:   { attack: 0.005, decay: 0.18, sustain: 0.1, release: 0.2, cutoff: 0.8 },
  funkbass: { attack: 0.008, decay: 0.2, sustain: 0.35, release: 0.2, cutoff: 0.5, reso: 0.35 },
  disco:    { attack: 0.005, decay: 0.25, sustain: 0.1, release: 0.25, cutoff: 0.7 },
  hoover:   { attack: 0.02, decay: 0.3, sustain: 0.8, release: 0.4, cutoff: 0.55, detune: 0.5, glide: 0.3 },
  prophet:  { attack: 0.04, decay: 0.4, sustain: 0.6, release: 0.5, cutoff: 0.75, detune: 0.15 },
  digibell: { attack: 0.001, decay: 0.7, sustain: 0.0, release: 0.7, cutoff: 1 },
  fmep:   { attack: 0.005, decay: 0.6, sustain: 0.25, release: 0.5, cutoff: 0.85 },
  clav:   { attack: 0.004, decay: 0.18, sustain: 0.15, release: 0.15, cutoff: 0.8, reso: 0.2 },
}

export const PRESETS: PresetDef[] = [
  // Drums
  { id: 'kick', label: 'Kick', kind: 'drum', color: '#ef5350', group: 'Drums' },
  { id: 'snare', label: 'Snare', kind: 'drum', color: '#ff9800', group: 'Drums' },
  { id: 'rim', label: 'Rim', kind: 'drum', color: '#ffa726', group: 'Drums' },
  { id: 'clap', label: 'Clap', kind: 'drum', color: '#ff7043', group: 'Drums' },
  { id: 'hat-closed', label: 'Closed Hat', kind: 'drum', color: '#ffd54f', group: 'Drums' },
  { id: 'hat-open', label: 'Open Hat', kind: 'drum', color: '#cddc39', group: 'Drums' },
  { id: 'ride', label: 'Ride', kind: 'drum', color: '#dce775', group: 'Drums' },
  { id: 'crash', label: 'Crash', kind: 'drum', color: '#e6ee9c', group: 'Drums' },
  // 808 & perc
  { id: 'kick-808', label: '808', kind: 'drum', color: '#ec407a', group: '808 & Perc' },
  { id: 'tom-low', label: 'Tom Low', kind: 'drum', color: '#ab47bc', group: '808 & Perc' },
  { id: 'tom-high', label: 'Tom High', kind: 'drum', color: '#ba68c8', group: '808 & Perc' },
  { id: 'cowbell', label: 'Cowbell', kind: 'drum', color: '#26a69a', group: '808 & Perc' },
  { id: 'shaker', label: 'Shaker', kind: 'drum', color: '#66bb6a', group: '808 & Perc' },
  { id: 'conga', label: 'Conga', kind: 'drum', color: '#9ccc65', group: '808 & Perc' },
  // Bass
  { id: 'bass', label: 'Bass', kind: 'instrument', color: '#7e57c2', group: 'Bass' },
  { id: 'sub', label: 'Sub Bass', kind: 'instrument', color: '#5c6bc0', group: 'Bass' },
  { id: 'reese', label: 'Reese', kind: 'instrument', color: '#7986cb', group: 'Bass' },
  { id: 'acid', label: 'Acid', kind: 'instrument', color: '#9575cd', group: 'Bass' },
  // Synth
  { id: 'lead', label: 'Lead', kind: 'instrument', color: '#26c6da', group: 'Synth' },
  { id: 'supersaw', label: 'Supersaw', kind: 'instrument', color: '#00bcd4', group: 'Synth' },
  { id: 'pluck', label: 'Pluck', kind: 'instrument', color: '#66bb6a', group: 'Synth' },
  { id: 'pad', label: 'Pad', kind: 'instrument', color: '#42a5f5', group: 'Synth' },
  { id: 'bell', label: 'Bell', kind: 'instrument', color: '#ec407a', group: 'Synth' },
  { id: 'arp', label: 'Arp', kind: 'instrument', color: '#ab47bc', group: 'Synth' },
  { id: 'brass', label: 'Brass', kind: 'instrument', color: '#ffa726', group: 'Synth' },
  { id: 'stab', label: 'Stab', kind: 'instrument', color: '#ff7043', group: 'Synth' },
  // Electronic / French house
  { id: 'funkbass', label: 'Funk Bass', kind: 'instrument', color: '#5e35b1', group: 'Electronic' },
  { id: 'disco', label: 'Disco Stab', kind: 'instrument', color: '#d81b60', group: 'Electronic' },
  { id: 'hoover', label: 'Hoover', kind: 'instrument', color: '#3949ab', group: 'Electronic' },
  { id: 'prophet', label: 'Prophet', kind: 'instrument', color: '#00897b', group: 'Electronic' },
  { id: 'digibell', label: 'Digi Bell', kind: 'instrument', color: '#00acc1', group: 'Electronic' },
  // Keys
  { id: 'keys', label: 'E-Keys', kind: 'instrument', color: '#90a4ae', group: 'Keys' },
  { id: 'fmep', label: 'FM Rhodes', kind: 'instrument', color: '#8d6e63', group: 'Keys' },
  { id: 'clav', label: 'Clavinet', kind: 'instrument', color: '#a1887f', group: 'Keys' },
  { id: 'organ', label: 'Organ', kind: 'instrument', color: '#a1887f', group: 'Keys' },
  { id: 'piano', label: 'Piano', kind: 'instrument', color: '#bdbdbd', group: 'Keys' },
]

export const getPreset = (id: string) => PRESETS.find((p) => p.id === id)

export function defaultSynthFor(presetId: string): SynthParams {
  const spec = SYNTH_SPECS[presetId]
  const base: SynthParams = { ...DEFAULT_SYNTH, wave: spec?.defaultWave ?? 'sawtooth' }
  return { ...base, ...(SYNTH_DEFAULT_OVERRIDES[presetId] ?? {}) }
}

// ─── FX metadata ───────────────────────────────────────────────────────────
export const FX_ORDER: FxType[] = ['eq', 'filter', 'distortion', 'bitcrush', 'chorus', 'phaser', 'delay', 'reverb', 'compressor']

export const FX_META: Record<FxType, { label: string; knobs: string[]; count: number; defaults: [number, number, number] }> = {
  eq:         { label: 'EQ', knobs: ['Low', 'Mid', 'High'], count: 3, defaults: [0.5, 0.5, 0.5] },
  filter:     { label: 'Filter', knobs: ['Cutoff', 'Reso'], count: 2, defaults: [0.7, 0.2, 0] },
  distortion: { label: 'Distortion', knobs: ['Drive', 'Wet'], count: 2, defaults: [0.4, 0.5, 0] },
  bitcrush:   { label: 'Bitcrush', knobs: ['Bits', 'Wet'], count: 2, defaults: [0.4, 0.5, 0] },
  chorus:     { label: 'Chorus', knobs: ['Depth', 'Rate', 'Wet'], count: 3, defaults: [0.5, 0.3, 0.6] },
  phaser:     { label: 'Phaser', knobs: ['Rate', 'Depth', 'Wet'], count: 3, defaults: [0.3, 0.5, 0.5] },
  delay:      { label: 'Delay', knobs: ['Time', 'Feedback', 'Wet'], count: 3, defaults: [0.4, 0.4, 0.4] },
  reverb:     { label: 'Reverb', knobs: ['Decay', 'PreDelay', 'Wet'], count: 3, defaults: [0.5, 0.2, 0.4] },
  compressor: { label: 'Compressor', knobs: ['Thresh', 'Ratio'], count: 2, defaults: [0.5, 0.4, 0.3] },
}

export const defaultFxChain = (): FxState[] =>
  FX_ORDER.map((type) => ({ type, enabled: false, k: [...FX_META[type].defaults] as [number, number, number] }))
