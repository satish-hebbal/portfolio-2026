// Studio-Kapi — instrument & FX preset catalog
import type { PresetDef, PresetGroup, FxState, FxType, SynthParams } from './types'

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
  // real recorded percussion (see samples/fetch-real.mjs + SAMPLE_CREDITS)
  ...Object.fromEntries([
    'tabla-dha', 'tabla-dhin', 'tabla-na', 'tabla-tin', 'tabla-tun', 'tabla-ge', 'tabla-ke', 'tabla-te',
    'dholak-bass', 'dholak-treble', 'mridangam-thom', 'mridangam-nam', 'mridangam-dheem', 'morsing',
  ].map((id) => [id, `${SAMPLE_BASE}/real/perc/${id}.wav`])),
}

// Piano sampler note->file map (Tone.Sampler interpolates the gaps)
export const PIANO_SAMPLES: Record<string, string> = {
  C2: `${SAMPLE_BASE}/piano-C2.wav`,
  C3: `${SAMPLE_BASE}/piano-C3.wav`,
  C4: `${SAMPLE_BASE}/piano-C4.wav`,
  C5: `${SAMPLE_BASE}/piano-C5.wav`,
  C6: `${SAMPLE_BASE}/piano-C6.wav`,
}

// Real recorded melodic instruments -> Tone.Sampler (it repitches between the
// sampled notes). attack/release are the defaults the envelope knobs start at.
export interface SampledSpec { dir: string; notes: string[]; attack: number; release: number }
const sampled = (dir: string, notes: string, attack = 0.005, release = 0.6): SampledSpec =>
  ({ dir, notes: notes.split(' '), attack, release })

export const SAMPLED: Record<string, SampledSpec> = {
  sitar: sampled('sitar', 'C#3 E3', 0.002, 1.2),
  santoor: sampled('santoor', 'C4 D#4 F4 G4', 0.002, 1.4),
  sarangi: sampled('sarangi', 'C4 G#4', 0.12, 0.6),
  bansuri: sampled('bansuri', 'E4 E5', 0.08, 0.5),
  tanpura: sampled('tanpura', 'A#2 E3', 0.2, 2.5),
  harmonium: sampled('harmonium', 'C2 E2 G#2 C3 E3 G#3 C4 E4 G#4 C5', 0.04, 0.3),
  violin: sampled('violin', 'G3 C4 E4 A4 C5 E5 A5 C6', 0.06, 0.5),
  cello: sampled('cello', 'C2 E2 A2 C3 E3 A3 C4 E4', 0.06, 0.6),
  flute: sampled('flute', 'C4 E4 A4 C5 E5 A5 C6', 0.05, 0.4),
  'guitar-acoustic': sampled('guitar-acoustic', 'E2 A2 D3 G3 B3 E4 A4', 0.002, 1.0),
  'guitar-nylon': sampled('guitar-nylon', 'E2 A2 D3 G3 B3 E4 A4 E5', 0.002, 1.0),
  'guitar-electric': sampled('guitar-electric', 'E2 A2 C3 D#3 F#3 A3 C4 D#4 F#4 A4 C5', 0.002, 0.7),
  'bass-electric': sampled('bass-electric', 'E1 G1 A#1 C#2 E2 G2 A#2 C#3 E3 G3', 0.002, 0.25),
  harp: sampled('harp', 'D2 F2 A2 C3 E3 G3 B3 D4 F4 A4 C5 E5', 0.002, 1.5),
  sax: sampled('sax', 'C#3 E3 G3 A#3 C#4 E4 G4 A#4 C#5 E5', 0.03, 0.3),
  trumpet: sampled('trumpet', 'F3 A3 C4 D#4 F4 G4 A#4 D5 F5', 0.02, 0.3),
  xylophone: sampled('xylophone', 'G4 C5 G5 C6 G6 C7', 0.001, 1.0),
}

// note -> url map for a sampled instrument (file names use 's' for sharps)
export function sampledUrls(id: string): Record<string, string> {
  const spec = SAMPLED[id]
  if (!spec) return {}
  return Object.fromEntries(spec.notes.map((n) => [n, `${SAMPLE_BASE}/real/${spec.dir}/${n.replace('#', 's')}.mp3`]))
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
  // Indian classical: melodic (real recordings)
  { id: 'sitar', label: 'Sitar', kind: 'instrument', color: '#f0a33a', group: 'Indian', hint: 'Plucked, buzzy strings with a ringing halo' },
  { id: 'santoor', label: 'Santoor', kind: 'instrument', color: '#f6c85f', group: 'Indian', hint: 'Hammered strings, sparkly like rain' },
  { id: 'sarangi', label: 'Sarangi', kind: 'instrument', color: '#e2725b', group: 'Indian', hint: 'Bowed and singing, very close to a voice' },
  { id: 'bansuri', label: 'Bansuri', kind: 'instrument', color: '#8bc34a', group: 'Indian', hint: 'Breathy bamboo flute' },
  { id: 'harmonium', label: 'Harmonium', kind: 'instrument', color: '#d4a373', group: 'Indian', hint: 'Reed organ, great for chords and bhajans' },
  { id: 'tanpura', label: 'Tanpura', kind: 'instrument', color: '#c9a86a', group: 'Indian', hint: 'Drone. Hold one long note on Sa' },
  // Tabla bols (one channel per stroke)
  { id: 'tabla-dha', label: 'Tabla Dha', kind: 'drum', color: '#e8833a', group: 'Tabla', hint: 'Both drums together, the big accent' },
  { id: 'tabla-dhin', label: 'Tabla Dhin', kind: 'drum', color: '#ef9a52', group: 'Tabla', hint: 'Both drums, ringing' },
  { id: 'tabla-na', label: 'Tabla Na', kind: 'drum', color: '#f4b860', group: 'Tabla', hint: 'Sharp ring on the small drum' },
  { id: 'tabla-tin', label: 'Tabla Tin', kind: 'drum', color: '#f7cd78', group: 'Tabla', hint: 'Soft ring on the small drum' },
  { id: 'tabla-tun', label: 'Tabla Tun', kind: 'drum', color: '#e6b450', group: 'Tabla', hint: 'Open, sustained small-drum tone' },
  { id: 'tabla-ge', label: 'Tabla Ge', kind: 'drum', color: '#c7652e', group: 'Tabla', hint: 'Deep bass from the big drum' },
  { id: 'tabla-ke', label: 'Tabla Ke', kind: 'drum', color: '#a8582f', group: 'Tabla', hint: 'Flat slap on the big drum' },
  { id: 'tabla-te', label: 'Tabla Te', kind: 'drum', color: '#d99a6c', group: 'Tabla', hint: 'Quick dry tap, for fast rolls' },
  // Other Indian percussion
  { id: 'dholak-bass', label: 'Dholak Bass', kind: 'drum', color: '#d9534f', group: 'Indian Perc', hint: 'Folk and wedding groove, low side' },
  { id: 'dholak-treble', label: 'Dholak Treble', kind: 'drum', color: '#e57373', group: 'Indian Perc', hint: 'Folk and wedding groove, high side' },
  { id: 'mridangam-thom', label: 'Mridangam Thom', kind: 'drum', color: '#b5651d', group: 'Indian Perc', hint: 'Carnatic drum, bass stroke' },
  { id: 'mridangam-nam', label: 'Mridangam Nam', kind: 'drum', color: '#d2883a', group: 'Indian Perc', hint: 'Carnatic drum, sharp ringing stroke' },
  { id: 'mridangam-dheem', label: 'Mridangam Dheem', kind: 'drum', color: '#c47a35', group: 'Indian Perc', hint: 'Carnatic drum, both heads' },
  { id: 'morsing', label: 'Morsing', kind: 'drum', color: '#9e9d24', group: 'Indian Perc', hint: 'Jaw harp twang from Carnatic music' },
  // Band (real recordings)
  { id: 'guitar-acoustic', label: 'Acoustic Guitar', kind: 'instrument', color: '#c49a6c', group: 'Band' },
  { id: 'guitar-nylon', label: 'Nylon Guitar', kind: 'instrument', color: '#d7b48a', group: 'Band' },
  { id: 'guitar-electric', label: 'Electric Guitar', kind: 'instrument', color: '#e05d5d', group: 'Band' },
  { id: 'bass-electric', label: 'Bass Guitar', kind: 'instrument', color: '#6d5bd0', group: 'Band' },
  { id: 'sax', label: 'Saxophone', kind: 'instrument', color: '#e0b04a', group: 'Band' },
  { id: 'trumpet', label: 'Trumpet', kind: 'instrument', color: '#f2c14e', group: 'Band' },
  // Orchestra (real recordings)
  { id: 'violin', label: 'Violin', kind: 'instrument', color: '#b5734a', group: 'Orchestra' },
  { id: 'cello', label: 'Cello', kind: 'instrument', color: '#8d5a3b', group: 'Orchestra' },
  { id: 'flute', label: 'Flute', kind: 'instrument', color: '#9ad0c2', group: 'Orchestra' },
  { id: 'harp', label: 'Harp', kind: 'instrument', color: '#d8c38a', group: 'Orchestra' },
  { id: 'xylophone', label: 'Xylophone', kind: 'instrument', color: '#f08bb0', group: 'Orchestra' },
  // Drums
  { id: 'kick', label: 'Kick', kind: 'drum', color: '#ef5350', group: 'Drums' },
  { id: 'snare', label: 'Snare', kind: 'drum', color: '#4db6e8', group: 'Drums' },
  { id: 'rim', label: 'Rim', kind: 'drum', color: '#37c2a8', group: 'Drums' },
  { id: 'clap', label: 'Clap', kind: 'drum', color: '#e46a9b', group: 'Drums' },
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
  { id: 'brass', label: 'Brass', kind: 'instrument', color: '#e6c34a', group: 'Synth' },
  { id: 'stab', label: 'Stab', kind: 'instrument', color: '#b57be0', group: 'Synth' },
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

// picker order: real instruments first, then the synth/electronic kit
export const PRESET_GROUPS: PresetGroup[] = [
  'Indian', 'Tabla', 'Indian Perc', 'Band', 'Orchestra',
  'Drums', '808 & Perc', 'Bass', 'Synth', 'Electronic', 'Keys',
]
export const REAL_GROUPS = new Set<PresetGroup>(['Indian', 'Tabla', 'Indian Perc', 'Band', 'Orchestra'])

// Attribution for the recorded samples (CC BY requires it; CC0 credited as thanks)
export const SAMPLE_CREDITS: { what: string; who: string; license: string; url: string }[] = [
  { what: 'Tabla bols', who: 'ajaysm', license: 'CC BY 4.0', url: 'https://freesound.org/people/ajaysm/packs/10737/' },
  { what: 'Bansuri', who: 'sankalp', license: 'CC BY 4.0', url: 'https://freesound.org/people/sankalp/sounds/179695/' },
  { what: 'Harmonium, violin, cello, flute, guitars, bass, harp, sax, trumpet, xylophone', who: 'Nicholaus Brosowsky (tonejs-instruments)', license: 'CC BY 3.0', url: 'https://github.com/nbrosowsky/tonejs-instruments' },
  { what: 'Mridangam and morsing', who: 'ajaysm', license: 'CC0', url: 'https://freesound.org/people/ajaysm/sounds/194579/' },
  { what: 'Sitar', who: 'zgump', license: 'CC0', url: 'https://freesound.org/people/zgump/sounds/87435/' },
  { what: 'Santoor', who: 'nsmusic', license: 'CC0', url: 'https://freesound.org/s/258090/' },
  { what: 'Sarangi', who: 'Freesound (deleted user)', license: 'CC0', url: 'https://freesound.org/s/167023/' },
  { what: 'Tanpura', who: 'luckylittleraven, iluppai', license: 'CC0', url: 'https://freesound.org/s/416606/' },
  { what: 'Dholak', who: 'curesforbrokenhearts', license: 'CC0', url: 'https://freesound.org/people/curesforbrokenhearts/sounds/536872/' },
]

// ─── scales & ragas (piano-roll helper) ──────────────────────────────────────
// Ragas are simplified to their note sets (aaroh/avaroh differences ignored).
export const SCALES: { id: string; label: string; steps: number[]; raga?: boolean }[] = [
  { id: 'major', label: 'Major (bright)', steps: [0, 2, 4, 5, 7, 9, 11] },
  { id: 'minor', label: 'Minor (moody)', steps: [0, 2, 3, 5, 7, 8, 10] },
  { id: 'penta', label: 'Pentatonic (never wrong)', steps: [0, 2, 4, 7, 9] },
  { id: 'minpenta', label: 'Minor pentatonic', steps: [0, 3, 5, 7, 10] },
  { id: 'blues', label: 'Blues', steps: [0, 3, 5, 6, 7, 10] },
  { id: 'dorian', label: 'Dorian (dreamy)', steps: [0, 2, 3, 5, 7, 9, 10] },
  { id: 'yaman', label: 'Raga Yaman (evening)', steps: [0, 2, 4, 6, 7, 9, 11], raga: true },
  { id: 'bhupali', label: 'Raga Bhupali / Mohanam', steps: [0, 2, 4, 7, 9], raga: true },
  { id: 'bhairav', label: 'Raga Bhairav (dawn)', steps: [0, 1, 4, 5, 7, 8, 11], raga: true },
  { id: 'kafi', label: 'Raga Kafi (folk, Holi)', steps: [0, 2, 3, 5, 7, 9, 10], raga: true },
  { id: 'hamsadhwani', label: 'Raga Hamsadhwani', steps: [0, 2, 4, 7, 11], raga: true },
  { id: 'bhairavi', label: 'Raga Bhairavi', steps: [0, 1, 3, 5, 7, 8, 10], raga: true },
  { id: 'malkauns', label: 'Raga Malkauns (night)', steps: [0, 3, 5, 8, 10], raga: true },
]
// sargam syllable for each semitone above Sa (lowercase = komal, 'Ma' = tivra)
export const SARGAM = ['Sa', 're', 'Re', 'ga', 'Ga', 'ma', 'Ma', 'Pa', 'dha', 'Dha', 'ni', 'Ni']

export function defaultSynthFor(presetId: string): SynthParams {
  const spec = SYNTH_SPECS[presetId]
  const base: SynthParams = { ...DEFAULT_SYNTH, wave: spec?.defaultWave ?? 'sawtooth' }
  const smp = SAMPLED[presetId]
  // sampled instruments: open filter, envelope knobs start at the instrument's natural attack/release
  if (smp) return { ...base, cutoff: 1, reso: 0, attack: attackToKnob(smp.attack), release: releaseToKnob(smp.release) }
  return { ...base, ...(SYNTH_DEFAULT_OVERRIDES[presetId] ?? {}) }
}

// knob <-> seconds mapping shared with the engine (attack = 0.001 + k²·2, release = 0.01 + k²·3)
export const knobToAttack = (k: number) => 0.001 + k * k * 2
export const knobToRelease = (k: number) => 0.01 + k * k * 3
const attackToKnob = (sec: number) => Math.sqrt(Math.max(0, sec - 0.001) / 2)
const releaseToKnob = (sec: number) => Math.sqrt(Math.max(0, sec - 0.01) / 3)

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
