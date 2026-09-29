// Studio-Kapi — track factory + ready-to-remix demo songs (original compositions
// plus arrangements of public-domain melodies)
import type { ProjectState, Track, Pattern, PatternData, RollNote, FxType, SynthParams, MixerState, Clip, ScaleState } from './types'
import { getPreset, defaultFxChain, defaultSynthFor } from './presets'

export const CLIP_COLORS = ['#5b7cfa', '#e0518a', '#27b8a6', '#e9913a', '#9b6cf0', '#3aa6e9']

const uid = () => Math.random().toString(36).slice(2, 10)
export const defaultMixer = (): MixerState => ({ volume: 0.8, pan: 0, mute: false, solo: false })

export function makeTrack(presetId: string, index: number, id: string = uid()): Track {
  const isAudio = presetId === 'audio'
  const preset = getPreset(presetId)
  return {
    id,
    name: isAudio ? `Voice ${index}` : preset?.label ?? presetId,
    kind: isAudio ? 'audio' : preset?.kind ?? 'instrument',
    presetId,
    color: isAudio ? '#8d9bb5' : preset?.color ?? '#888',
    group: isAudio ? 'Audio' : preset?.group ?? null,
    mixer: defaultMixer(),
    fx: defaultFxChain(),
    synth: isAudio ? defaultSynthFor('bass') : defaultSynthFor(presetId),
  }
}

// ─── tiny song DSL ────────────────────────────────────────────────────────────
// Ids are derived from the demo/pattern/track keys (never random) because the
// default demo is the SSR initial state and must hydrate identically.
interface TrackSpec {
  preset: string
  name?: string
  volume?: number
  pan?: number
  fx?: Partial<Record<FxType, [number, number, number]>>
  synth?: Partial<SynthParams>
}
interface PatternSpec {
  name: string
  length: number
  // drum hits as a grid string: 'x' = hit, anything else = rest ("x...x...")
  hits?: Record<string, string>
  // melodic notes as "step:note:len" tokens separated by spaces; len defaults to 1.
  // A chord is notes joined with '+': "0:C4+E4+G4:16"
  notes?: Record<string, string>
}
interface SongSpec {
  id: string
  name: string
  blurb: string
  bpm: number
  swing?: number
  scale?: ScaleState
  tracks: Record<string, TrackSpec>
  patterns: PatternSpec[]
  arrangement: string[]   // pattern names, played back to back in Song mode
  lead: string            // track key selected (and shown in the piano roll) on load
  start?: string          // pattern shown on load (defaults to the first)
  cover: DemoCover
}

// Card art for the demo picker
export type DemoScene = 'psych' | 'teentaal' | 'carnatic' | 'dholak' | 'mountain' | 'chip'
export interface DemoCover {
  scene: DemoScene   // illustrated cover drawn by components/DemoArt
  tags: string[]
}

function buildSong(spec: SongSpec): ProjectState {
  const tracks: Track[] = Object.entries(spec.tracks).map(([key, t]) => {
    const tr = makeTrack(t.preset, 0, `${spec.id}-${key}`)
    if (t.name) tr.name = t.name
    tr.mixer = { ...tr.mixer, volume: t.volume ?? tr.mixer.volume, pan: t.pan ?? 0 }
    if (t.synth) tr.synth = { ...tr.synth, ...t.synth }
    if (t.fx) tr.fx = tr.fx.map((f) => (t.fx![f.type] ? { ...f, enabled: true, k: t.fx![f.type]! } : f))
    return tr
  })

  const patterns: Pattern[] = spec.patterns.map((ps, pi) => {
    const pid = `${spec.id}-p${pi}`
    const data: Record<string, PatternData> = {}
    for (const [key, grid] of Object.entries(ps.hits ?? {})) {
      const g = grid.replace(/\s|\|/g, '')
      data[`${spec.id}-${key}`] = { steps: Array.from({ length: ps.length }, (_, i) => g[i % g.length] === 'x'), notes: [] }
    }
    for (const [key, line] of Object.entries(ps.notes ?? {})) {
      const notes: RollNote[] = []
      line.trim().split(/\s+/).forEach((tok, ti) => {
        const [step, chord, len] = tok.split(':')
        chord.split('+').forEach((n, ci) => notes.push({
          id: `${pid}-${key}-${ti}-${ci}`, step: Number(step), note: n, length: Number(len ?? 1), velocity: 0.9,
        }))
      })
      data[`${spec.id}-${key}`] = { steps: [], notes }
    }
    return { id: pid, name: ps.name, length: ps.length, data }
  })

  let pos = 0
  const clips: Clip[] = spec.arrangement.map((name, i) => {
    const pi = spec.patterns.findIndex((p) => p.name === name)
    const pat = patterns[pi]
    const clip: Clip = { id: `${spec.id}-c${i}`, lane: 0, type: 'pattern', refId: pat.id, start: pos, length: pat.length, offset: 0, name: pat.name, color: CLIP_COLORS[pi % CLIP_COLORS.length] }
    pos += pat.length
    return clip
  })

  return {
    bpm: spec.bpm, swing: spec.swing ?? 0, masterVolume: 0.85, metronome: false, mode: 'pattern',
    tracks, patterns,
    activePatternId: patterns[Math.max(0, spec.patterns.findIndex((p) => p.name === spec.start))].id,
    selectedTrackId: `${spec.id}-${spec.lead}`,
    arrangement: { lanes: 4, clips },
    scale: spec.scale,
  }
}

// grid string with hits at the given steps, e.g. on(8, 0, 3) -> "x..x...."
const on = (len: number, ...steps: number[]) => Array.from({ length: len }, (_, i) => (steps.includes(i) ? 'x' : '.')).join('')

// ─── the songs ────────────────────────────────────────────────────────────────
const SONGS: SongSpec[] = [
  {
    id: 'psych',
    name: 'Psych Groove',
    blurb: 'Dreamy guitar arpeggios, a chorus-soaked bass line and phased pads in E Dorian. Swap the guitar for a sitar and see what happens.',
    bpm: 104, swing: 0.12,
    scale: { id: 'minpenta', root: 4, lock: false },
    tracks: {
      kick: { preset: 'kick', volume: 0.85 },
      snare: { preset: 'snare', volume: 0.7, fx: { reverb: [0.45, 0.1, 0.35] } },
      hat: { preset: 'hat-closed', volume: 0.45, pan: 0.2 },
      ohat: { preset: 'hat-open', volume: 0.4, pan: 0.2 },
      bass: { preset: 'bass-electric', volume: 0.85, fx: { chorus: [0.5, 0.25, 0.45], compressor: [0.45, 0.4, 0] } },
      gtr: { preset: 'guitar-electric', name: 'Arp Guitar', volume: 0.6, pan: -0.25, fx: { phaser: [0.2, 0.55, 0.45], delay: [0.45, 0.35, 0.25], reverb: [0.5, 0.2, 0.3] } },
      pad: { preset: 'prophet', name: 'Dream Pad', volume: 0.38, pan: 0.15, fx: { phaser: [0.12, 0.6, 0.5], reverb: [0.7, 0.2, 0.45] } },
    },
    patterns: [
      {
        name: 'Verse', length: 32,
        hits: {
          kick: 'x.....x.x..x....',
          snare: '....x.......x...',
          hat: 'x.x.x.x.x.x.x...',
          ohat: '..............x.',
        },
        notes: {
          bass: '0:E2:3 3:E2 6:D2:2 8:E2:2 11:G2 12:A2:2 14:B2:2 16:A1:3 19:A1 22:C#2:2 24:E2:2 27:G2 28:A2:2 30:G2:2',
          gtr: '0:E4:2 2:B3:2 4:G4:2 6:B3:2 8:D4:2 10:B3:2 12:G4:2 14:F#4:2 16:A3:2 18:E4:2 20:C#4:2 22:E4:2 24:G4:2 26:E4:2 28:C#4:2 30:E4:2',
          pad: '0:G3+B3+D4+F#4:16 16:A3+C#4+E4+G4:16',
        },
      },
      {
        name: 'Chorus', length: 32,
        hits: {
          kick: 'x.....x.x.....x.',
          snare: '....x.......x..x',
          hat: 'xxxxxxxxxxxxxx..',
          ohat: '..............x.',
        },
        notes: {
          bass: '0:C2:3 3:C2 6:G2:2 8:C3:2 11:B2 12:G2:2 14:E2:2 16:D2:3 19:D2 22:A2:2 24:D3:2 27:C3 28:A2:2 30:F#2:2',
          gtr: '0:C4:2 2:G4:2 4:E4:2 6:G4:2 8:B4:2 10:G4:2 12:E4:2 14:G4:2 16:D4:2 18:A4:2 20:F#4:2 22:A4:2 24:B4:2 26:A4:2 28:F#4:2 30:A4:2',
          pad: '0:G3+B3+C4+E4:16 16:F#3+A3+B3+D4:16',
        },
      },
    ],
    arrangement: ['Verse', 'Verse', 'Chorus', 'Chorus', 'Verse', 'Chorus'],
    lead: 'gtr',
    cover: { scene: 'psych', tags: ['Psych pop', 'E Dorian', '104 BPM'] },
  },
  {
    id: 'teentaal',
    name: 'Teentaal Evening',
    blurb: 'Raga Yaman over a 16-beat tabla theka (Dha Dhin Dhin Dha), with sitar, bansuri, harmonium and a tanpura drone. Scale lock keeps every note inside the raga.',
    bpm: 70,
    scale: { id: 'yaman', root: 0, lock: true },
    tracks: {
      dha: { preset: 'tabla-dha', volume: 0.8, fx: { reverb: [0.3, 0.05, 0.18] } },
      dhin: { preset: 'tabla-dhin', volume: 0.75, fx: { reverb: [0.3, 0.05, 0.18] } },
      tin: { preset: 'tabla-tin', volume: 0.75, fx: { reverb: [0.3, 0.05, 0.18] } },
      na: { preset: 'tabla-na', name: 'Tabla Ta', volume: 0.75, fx: { reverb: [0.3, 0.05, 0.18] } },
      tanpura: { preset: 'tanpura', volume: 0.5, fx: { reverb: [0.6, 0.1, 0.35] } },
      sitar: { preset: 'sitar', volume: 0.75, pan: -0.1, fx: { reverb: [0.55, 0.15, 0.3] } },
      bansuri: { preset: 'bansuri', volume: 0.6, pan: 0.15, fx: { reverb: [0.6, 0.2, 0.35] } },
      harmonium: { preset: 'harmonium', volume: 0.3, pan: 0.2 },
    },
    // one step = half a matra; 32 steps = one 16-matra teentaal cycle
    patterns: [
      {
        name: 'Sthayi', length: 32,
        // theka: Dha Dhin Dhin Dha | Dha Dhin Dhin Dha | Dha Tin Tin Ta | Ta Dhin Dhin Dha
        hits: {
          dha: on(32, 0, 6, 8, 14, 16, 30),
          dhin: on(32, 2, 4, 10, 12, 26, 28),
          tin: on(32, 18, 20),
          na: on(32, 22, 24),
        },
        notes: {
          tanpura: '0:G2:8 8:C3:8 16:C3:8 24:C2:8',
          sitar: '0:B3:2 2:D4:2 4:E4:4 8:D4:2 10:E4:2 12:F#4:2 14:G4:4 18:F#4:2 20:E4:2 22:D4:2 24:E4:2 26:D4:2 28:C4:4',
          harmonium: '0:C4+G4:16 16:C4+G4:16',
        },
      },
      {
        name: 'Antara', length: 32,
        // same theka with a half-matra Dhin pickup into sam
        hits: {
          dha: on(32, 0, 6, 8, 14, 16, 30),
          dhin: on(32, 2, 4, 10, 12, 26, 28, 29),
          tin: on(32, 18, 20),
          na: on(32, 22, 24),
        },
        notes: {
          tanpura: '0:G2:8 8:C3:8 16:C3:8 24:C2:8',
          bansuri: '0:E4:2 2:G4:2 4:A4:2 6:B4:2 8:C5:6 14:B4:2 16:A4:2 18:G4:2 20:F#4:2 22:E4:2 24:D4:2 26:E4:2 28:C4:4',
          sitar: '8:C4:2 12:E4:2 16:G4:2 24:E4:2 28:C4:4',
          harmonium: '0:E4+B4:16 16:C4+G4:16',
        },
      },
    ],
    arrangement: ['Sthayi', 'Sthayi', 'Antara', 'Antara', 'Sthayi'],
    lead: 'sitar',
    cover: { scene: 'teentaal', tags: ['Hindustani', 'Teentaal · 16 beats', 'Raga Yaman'] },
  },
  {
    id: 'adi',
    name: 'Carnatic Adi Talam',
    blurb: 'Raga Mohanam in an 8-beat Adi talam: mridangam, morsing twangs, violin and flute answering each other over a tanpura.',
    bpm: 90,
    scale: { id: 'bhupali', root: 0, lock: true },
    tracks: {
      thom: { preset: 'mridangam-thom', volume: 0.85 },
      nam: { preset: 'mridangam-nam', volume: 0.65 },
      dheem: { preset: 'mridangam-dheem', volume: 0.7 },
      morsing: { preset: 'morsing', volume: 0.4, pan: 0.2 },
      tanpura: { preset: 'tanpura', volume: 0.45, fx: { reverb: [0.6, 0.1, 0.35] } },
      violin: { preset: 'violin', volume: 0.6, pan: -0.2, fx: { reverb: [0.5, 0.15, 0.3] } },
      flute: { preset: 'flute', volume: 0.55, pan: 0.2, fx: { reverb: [0.55, 0.15, 0.3] } },
    },
    // 32 steps = one 8-beat Adi talam cycle (a beat every 4 steps)
    patterns: [
      {
        name: 'Pallavi', length: 32,
        hits: {
          dheem: 'x...............x...............',
          thom: '......x.....x.........x.....x...',
          nam: '..x.x...x.x...x...x.x...x.x...x.',
          morsing: '..x...x...x...x...x...x...x...x.',
        },
        notes: {
          tanpura: '0:G2:8 8:C3:8 16:C3:8 24:C2:8',
          violin: '0:G4:4 4:A4:2 6:G4:2 8:E4:4 12:D4:2 14:E4:2 16:G4:4 20:E4:2 22:D4:2 24:C4:8',
        },
      },
      {
        name: 'Anupallavi', length: 32,
        hits: {
          dheem: 'x.......x.......x.......x.......',
          thom: '......x.....x.........x.....x...',
          nam: '..x.x.x.x.x.x.x...x.x.x.x.x.x.x.',
          morsing: '..x...x...x...x...x...x...x...x.',
        },
        notes: {
          tanpura: '0:G2:8 8:C3:8 16:C3:8 24:C2:8',
          flute: '0:C5:2 2:D5:2 4:E5:4 8:D5:2 10:C5:2 12:A4:4 16:G4:2 18:A4:2 20:C5:4 24:A4:2 26:G4:2 28:E4:4',
          violin: '0:C4:8 8:D4:8 16:E4:8 24:G4:8',
        },
      },
    ],
    arrangement: ['Pallavi', 'Pallavi', 'Anupallavi', 'Anupallavi', 'Pallavi'],
    lead: 'violin',
    cover: { scene: 'carnatic', tags: ['Carnatic', 'Adi talam · 8 beats', 'Raga Mohanam'] },
  },
  {
    id: 'dholak',
    name: 'Dholak Shaadi',
    blurb: 'A bouncy wedding-style dholak chaal with santoor sparkles, harmonium chords and a sarangi line in Raga Kafi.',
    bpm: 96, swing: 0.2,
    scale: { id: 'kafi', root: 2, lock: true },
    tracks: {
      dbass: { preset: 'dholak-bass', volume: 0.85 },
      dtreb: { preset: 'dholak-treble', volume: 0.7, pan: 0.1 },
      shaker: { preset: 'shaker', volume: 0.35, pan: -0.2 },
      clap: { preset: 'clap', volume: 0.45, fx: { reverb: [0.35, 0.05, 0.2] } },
      bass: { preset: 'bass-electric', volume: 0.75 },
      harmonium: { preset: 'harmonium', volume: 0.4, pan: -0.15 },
      santoor: { preset: 'santoor', volume: 0.6, pan: 0.2, fx: { delay: [0.35, 0.3, 0.2], reverb: [0.5, 0.1, 0.25] } },
      sarangi: { preset: 'sarangi', volume: 0.55, pan: -0.1, fx: { reverb: [0.55, 0.15, 0.3] } },
    },
    patterns: [
      {
        name: 'Chaal', length: 32,
        hits: {
          dbass: 'x..x..x.x..x..x.',
          dtreb: '..x.x..x..x.x..x',
          shaker: 'x.x.x.x.x.x.x.x.',
          clap: '....x.......x...',
        },
        notes: {
          bass: '0:D2:3 3:D2 6:A1:2 8:D2:3 11:F2 12:A2:2 14:C3:2 16:C2:3 19:C2 22:G1:2 24:C2:3 27:E2 28:G2:2 30:A2:2',
          harmonium: '0:D4+F4+A4:6 8:D4+F4+A4:6 16:C4+E4+G4:6 24:C4+E4+G4:6',
          santoor: '0:D5:2 2:A4:2 4:F4:2 6:A4:2 8:D5:2 10:E5:2 12:F5:2 14:E5:2 16:C5:2 18:G4:2 20:E4:2 22:G4:2 24:C5:2 26:D5:2 28:E5:2 30:D5:2',
        },
      },
      {
        name: 'Sarangi', length: 32,
        hits: {
          dbass: 'x..x..x.x..x..x.',
          dtreb: '..x.x..x..x.x.xx',
          shaker: 'x.x.x.x.x.x.x.x.',
          clap: '....x.......x...',
        },
        notes: {
          bass: '0:D2:3 3:D2 6:A1:2 8:D2:3 11:F2 12:A2:2 14:C3:2 16:C2:3 19:C2 22:G1:2 24:C2:3 27:E2 28:G2:2 30:A2:2',
          harmonium: '0:D4+F4+A4:6 8:D4+F4+A4:6 16:C4+E4+G4:6 24:C4+E4+G4:6',
          sarangi: '0:A4:6 6:G4:2 8:F4:4 12:E4:4 16:G4:6 22:F4:2 24:E4:4 28:D4:4',
        },
      },
    ],
    arrangement: ['Chaal', 'Chaal', 'Sarangi', 'Sarangi', 'Chaal'],
    lead: 'santoor',
    cover: { scene: 'dholak', tags: ['Folk', 'Dholak chaal', 'Raga Kafi'] },
  },
  {
    id: 'mountain',
    name: 'Mountain King House',
    blurb: 'Grieg’s “In the Hall of the Mountain King” (1875) reworked as filtered French house: disco chord stabs, a funk bass riding the famous riff and four on the floor.',
    bpm: 124, swing: 0.08,
    scale: { id: 'minor', root: 11, lock: false },
    tracks: {
      kick: { preset: 'kick', volume: 0.9 },
      clap: { preset: 'clap', volume: 0.6, fx: { reverb: [0.35, 0.05, 0.2] } },
      ohat: { preset: 'hat-open', volume: 0.4, pan: 0.15 },
      hat: { preset: 'hat-closed', volume: 0.3, pan: -0.15 },
      bass: { preset: 'funkbass', volume: 0.8 },
      stabs: { preset: 'disco', name: 'Disco Stabs', volume: 0.5, fx: { filter: [0.55, 0.35, 0], phaser: [0.15, 0.5, 0.35] } },
      lead: { preset: 'prophet', name: 'Riff Lead', volume: 0.5, pan: 0.1, fx: { delay: [0.3, 0.3, 0.2], reverb: [0.4, 0.1, 0.2] } },
    },
    // 32 steps = 2 bars; the riff moves in 8th notes (2 steps each)
    patterns: [
      {
        name: 'Intro', length: 32,
        hits: {
          kick: 'x...x...x...x...',
          hat: 'x.x.x.x.x.x.x.x.',
          ohat: '..x...x...x...x.',
        },
        notes: {
          stabs: '2:B3+D4+F#4 6:B3+D4+F#4 10:B3+D4+F#4 14:B3+D4+F#4 18:C#4+F4+G#4 22:C#4+F4+G#4 26:C4+E4+G4 30:C4+E4+G4',
        },
      },
      {
        name: 'Riff A', length: 32,
        hits: {
          kick: 'x...x...x...x...',
          clap: '....x.......x...',
          hat: 'xxxxxxxxxxxxxxxx',
          ohat: '..x...x...x...x.',
        },
        notes: {
          bass: '0:B2 2:C#3 4:D3 6:E3 8:F#3 10:D3 12:F#3:3 16:F3 18:C#3 20:F3:3 24:E3 26:C3 28:E3:3',
          lead: '0:B4 2:C#5 4:D5 6:E5 8:F#5 10:D5 12:F#5:3 16:F5 18:C#5 20:F5:3 24:E5 26:C5 28:E5:3',
          stabs: '2:B3+D4+F#4 6:B3+D4+F#4 10:B3+D4+F#4 14:B3+D4+F#4 18:C#4+F4+G#4 22:C#4+F4+G#4 26:C4+E4+G4 30:C4+E4+G4',
        },
      },
      {
        name: 'Riff B', length: 32,
        hits: {
          kick: 'x...x...x...x...',
          clap: '....x.......x..x',
          hat: 'xxxxxxxxxxxxxxxx',
          ohat: '..x...x...x...x.',
        },
        notes: {
          bass: '0:B2 2:C#3 4:D3 6:E3 8:F#3 10:D3 12:F#3 14:B3 16:A3 18:F#3 20:D3 22:F#3 24:A3:6',
          lead: '0:B4 2:C#5 4:D5 6:E5 8:F#5 10:D5 12:F#5 14:B5 16:A5 18:F#5 20:D5 22:F#5 24:A5:6',
          stabs: '2:B3+D4+F#4 6:B3+D4+F#4 10:B3+D4+F#4 14:B3+D4+F#4 18:D4+F#4+A4 22:D4+F#4+A4 26:D4+F#4+A4 30:D4+F#4+A4',
        },
      },
    ],
    arrangement: ['Intro', 'Riff A', 'Riff B', 'Riff A', 'Riff B', 'Riff B'],
    lead: 'lead',
    start: 'Riff A',
    cover: { scene: 'mountain', tags: ['French house', 'Grieg, 1875', '124 BPM'] },
  },
  {
    id: 'korobeiniki',
    name: 'Korobeiniki 8-bit',
    blurb: 'The Russian folk song everyone knows from falling-block games, as square-wave chiptune. Speed it up, swap the lead for a sitar, make it yours.',
    bpm: 150,
    scale: { id: 'minor', root: 9, lock: false },
    tracks: {
      kick: { preset: 'kick', volume: 0.75 },
      snare: { preset: 'snare', volume: 0.55 },
      hat: { preset: 'hat-closed', volume: 0.3 },
      lead: { preset: 'arp', name: 'Square Lead', volume: 0.55, synth: { wave: 'square', sustain: 0.6, release: 0.15, cutoff: 0.9 } },
      bass: { preset: 'bass', name: 'Chip Bass', volume: 0.6, synth: { wave: 'triangle', cutoff: 0.8, reso: 0 } },
    },
    // quarter note = 4 steps; 32 steps = 2 bars
    patterns: [
      {
        name: 'Theme 1', length: 32,
        hits: { kick: 'x.......x.......', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.' },
        notes: {
          lead: '0:E5:4 4:B4:2 6:C5:2 8:D5:4 12:C5:2 14:B4:2 16:A4:4 20:A4:2 22:C5:2 24:E5:4 28:D5:2 30:C5:2',
          bass: '0:E2:2 2:E3:2 4:E2:2 6:E3:2 8:E2:2 10:E3:2 12:E2:2 14:E3:2 16:A2:2 18:A3:2 20:A2:2 22:A3:2 24:A2:2 26:A3:2 28:A2:2 30:A3:2',
        },
      },
      {
        name: 'Theme 2', length: 32,
        hits: { kick: 'x.......x.......', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.' },
        notes: {
          lead: '0:B4:6 6:C5:2 8:D5:4 12:E5:4 16:C5:4 20:A4:4 24:A4:8',
          bass: '0:G#2:2 2:G#3:2 4:G#2:2 6:G#3:2 8:E2:2 10:E3:2 12:E2:2 14:E3:2 16:A2:2 18:A3:2 20:A2:2 22:A3:2 24:A2:2 26:A3:2 28:B2:2 30:C3:2',
        },
      },
    ],
    arrangement: ['Theme 1', 'Theme 2', 'Theme 1', 'Theme 2'],
    lead: 'lead',
    cover: { scene: 'chip', tags: ['Chiptune', 'Russian folk, 1861', '150 BPM'] },
  },
]

export const DEMOS = SONGS.map((s) => ({ id: s.id, name: s.name, blurb: s.blurb, cover: s.cover, build: () => buildSong(s) }))
export const DEFAULT_DEMO_ID = 'psych'
export const seedProject = (): ProjectState => buildSong(SONGS.find((s) => s.id === DEFAULT_DEMO_ID)!)
