// Studio-Kapi — shared types

export type TrackKind = 'drum' | 'instrument' | 'audio'

// Effect slots available on every track's FX chain (order = signal flow)
export type FxType =
  | 'eq' | 'filter' | 'distortion' | 'bitcrush'
  | 'chorus' | 'phaser' | 'delay' | 'reverb' | 'compressor'

export interface FxState {
  type: FxType
  enabled: boolean
  // up to three normalised 0..1 knobs, interpreted per-effect by the engine
  k: [number, number, number]
}

export interface MixerState {
  volume: number // 0..1
  pan: number    // -1..1
  mute: boolean
  solo: boolean
}

// Synth/instrument macro controls (normalised 0..1 unless noted)
export interface SynthParams {
  wave: string      // oscillator type
  attack: number
  decay: number
  sustain: number
  release: number
  cutoff: number    // filter cutoff
  reso: number      // filter resonance
  detune: number    // -1..1 -> +/- semitones spread
  glide: number     // portamento
  gain: number      // instrument output trim
  pitch: number     // -1..1 -> +/- 12 semitones (drum sample / mono pitch)
}

// A note in the piano roll
export interface RollNote {
  id: string
  step: number
  note: string
  length: number
  velocity: number // 0..1
}

// A channel/instrument definition (persists across patterns)
export interface Track {
  id: string
  name: string
  kind: TrackKind
  presetId: string
  color: string
  group: string | null     // group label for colour-coded grouping
  mixer: MixerState
  fx: FxState[]
  synth: SynthParams
  audioUrl?: string
}

// Per-pattern note/step data, keyed by track id
export interface PatternData {
  steps: boolean[]
  notes: RollNote[]
}

export interface Pattern {
  id: string
  name: string
  length: number                     // steps in this pattern
  data: Record<string, PatternData>  // trackId -> data
}

// ─── Arranger / song mode ────────────────────────────────────────────────
export type ClipType = 'pattern' | 'audio'

export interface Clip {
  id: string
  lane: number
  type: ClipType
  refId: string     // patternId (pattern clip) or takeId (audio clip)
  start: number     // absolute position in 16th steps
  length: number    // visible length in 16th steps
  offset: number    // steps trimmed from the source start (crop in-point)
  name: string
  color: string
}

export interface Arrangement {
  lanes: number
  clips: Clip[]
}

export type DawMode = 'pattern' | 'song'

export interface ProjectState {
  bpm: number
  swing: number          // 0..1
  masterVolume: number   // 0..1
  metronome: boolean
  mode: DawMode
  tracks: Track[]
  patterns: Pattern[]
  activePatternId: string
  selectedTrackId: string | null
  arrangement: Arrangement
}

export interface PresetDef {
  id: string
  label: string
  kind: TrackKind
  color: string
  group: 'Drums' | '808 & Perc' | 'Bass' | 'Synth' | 'Keys'
}
