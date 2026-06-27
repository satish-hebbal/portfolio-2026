// "Happy Birthday" played on the engine itself.
//
// Every engine's pitch is a pure function of rpm, so a musical note is just a
// specific rpm. We convert each melody note to a frequency, then to the rpm that
// makes the engine sing that note, choosing a single octave shift so the whole
// tune fits inside the engine's usable rev range.

import type { EnginePreset } from './engineSim'

// melody as { MIDI note, beats }. Classic Happy Birthday in C.
const G4 = 67, A4 = 69, B4 = 71, C5 = 72, D5 = 74, E5 = 76, F5 = 77, G5 = 79
const MELODY: { midi: number; beats: number }[] = [
  { midi: G4, beats: 0.5 }, { midi: G4, beats: 0.5 }, { midi: A4, beats: 1 }, { midi: G4, beats: 1 }, { midi: C5, beats: 1 }, { midi: B4, beats: 2 },
  { midi: G4, beats: 0.5 }, { midi: G4, beats: 0.5 }, { midi: A4, beats: 1 }, { midi: G4, beats: 1 }, { midi: D5, beats: 1 }, { midi: C5, beats: 2 },
  { midi: G4, beats: 0.5 }, { midi: G4, beats: 0.5 }, { midi: G5, beats: 1 }, { midi: E5, beats: 1 }, { midi: C5, beats: 1 }, { midi: B4, beats: 1 }, { midi: A4, beats: 2 },
  { midi: F5, beats: 0.5 }, { midi: F5, beats: 0.5 }, { midi: E5, beats: 1 }, { midi: C5, beats: 1 }, { midi: D5, beats: 1 }, { midi: C5, beats: 2 },
]

const BEAT = 0.52 // seconds per beat (~115 bpm)
const midiToFreq = (m: number) => 440 * Math.pow(2, (m - 69) / 12)

// the rpm that makes this engine voice a given frequency
function freqToRpm(p: EnginePreset, f: number): number {
  // EV hum is f0 = 64 + rpmNorm * 1300 (see engine-dsp.js); invert it
  if (p.ev) return ((f - 64) / 1300) * p.redline
  // combustion fundamental = firing frequency = (rpm/60) * (cyl/2)
  return (f * 120) / p.cylinders
}

export interface SongNote { rpm: number; dur: number }

// build the playable note list (rpm + duration) for a given engine
export function buildSong(p: EnginePreset): SongNote[] {
  const lo = Math.max(p.idle * 1.15, 1)
  const hi = p.limiter * 0.92
  const freqs = MELODY.map((n) => midiToFreq(n.midi))

  // pick the single octave shift k that best fits the whole tune in [lo, hi]
  let bestK = 0
  let bestOver = Infinity
  for (let k = -3; k <= 3; k++) {
    const rpms = freqs.map((f) => freqToRpm(p, f * Math.pow(2, k)))
    const mn = Math.min(...rpms)
    const mx = Math.max(...rpms)
    const over = Math.max(0, mx - hi) + Math.max(0, lo - mn)
    if (over < bestOver) { bestOver = over; bestK = k }
  }

  const shift = Math.pow(2, bestK)
  return MELODY.map((n) => ({
    rpm: Math.min(hi, Math.max(lo * 0.8, freqToRpm(p, midiToFreq(n.midi) * shift))),
    dur: n.beats * BEAT,
  }))
}

export const songDuration = (notes: SongNote[]) => notes.reduce((t, n) => t + n.dur, 0)
