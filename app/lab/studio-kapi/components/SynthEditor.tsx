'use client'

import s from '../studioKapi.module.css'
import type { Track, SynthParams } from '../audio/types'
import Knob from './Knob'

interface Props {
  track: Track | null
  onChange: (patch: Partial<SynthParams>) => void
}

const WAVES = [
  { id: 'sawtooth', label: 'Saw' },
  { id: 'square', label: 'Sqr' },
  { id: 'triangle', label: 'Tri' },
  { id: 'sine', label: 'Sine' },
  { id: 'fatsawtooth', label: 'Fat' },
]

const pct = (v: number) => `${Math.round(v * 100)}`
const semis = (v: number) => `${v > 0 ? '+' : ''}${Math.round(v * 12)}`
const ms = (v: number) => `${Math.round((0.001 + v * v * 2) * 1000)}`

export default function SynthEditor({ track, onChange }: Props) {
  if (!track) return <div className={s.empty}>Select a channel to shape its sound.</div>
  const sy = track.synth
  const isDrum = track.kind === 'drum'
  const isSampler = track.presetId === 'piano' || track.kind === 'audio'
  const accent = track.color

  return (
    <div className={s.synthEd}>
      <div className={s.rollHint}>{track.name} · sound design</div>

      {!isDrum && !isSampler && (
        <div className={s.synthSection}>
          <div className={s.sectionLabel}>Oscillator</div>
          <div className={s.waveRow}>
            {WAVES.map((w) => (
              <button
                key={w.id}
                className={`${s.waveBtn} ${sy.wave === w.id ? s.waveActive : ''}`}
                onClick={() => onChange({ wave: w.id })}
              >{w.label}</button>
            ))}
          </div>
        </div>
      )}

      {!isDrum && !isSampler && (
        <div className={s.synthSection}>
          <div className={s.sectionLabel}>Envelope</div>
          <div className={s.knobRowWide}>
            <Knob value={sy.attack} onChange={(v) => onChange({ attack: v })} label="Attack" accent={accent} display={ms} />
            <Knob value={sy.decay} onChange={(v) => onChange({ decay: v })} label="Decay" accent={accent} display={ms} />
            <Knob value={sy.sustain} onChange={(v) => onChange({ sustain: v })} label="Sustain" accent={accent} display={pct} />
            <Knob value={sy.release} onChange={(v) => onChange({ release: v })} label="Release" accent={accent} display={ms} />
          </div>
        </div>
      )}

      <div className={s.synthSection}>
        <div className={s.sectionLabel}>Filter</div>
        <div className={s.knobRowWide}>
          <Knob value={sy.cutoff} onChange={(v) => onChange({ cutoff: v })} label="Cutoff" accent={accent} display={pct} />
          <Knob value={sy.reso} onChange={(v) => onChange({ reso: v })} label="Reso" accent={accent} display={pct} />
          {!isDrum && !isSampler && (
            <Knob value={(sy.detune + 1) / 2} onChange={(v) => onChange({ detune: v * 2 - 1 })} label="Detune" accent={accent} bipolar display={(v) => `${Math.round((v * 2 - 1) * 100)}`} />
          )}
          {!isDrum && !isSampler && (
            <Knob value={sy.glide} onChange={(v) => onChange({ glide: v })} label="Glide" accent={accent} display={pct} />
          )}
        </div>
      </div>

      <div className={s.synthSection}>
        <div className={s.sectionLabel}>{isDrum ? 'Sample' : 'Output'}</div>
        <div className={s.knobRowWide}>
          {(isDrum) && (
            <Knob value={(sy.pitch + 1) / 2} onChange={(v) => onChange({ pitch: v * 2 - 1 })} label="Pitch" accent={accent} bipolar display={semis} />
          )}
          <Knob value={sy.gain} onChange={(v) => onChange({ gain: v })} label="Gain" accent={accent} display={pct} />
        </div>
      </div>
    </div>
  )
}
