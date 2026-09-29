'use client'

import s from '../studioKapi.module.css'
import type { Track, SynthParams } from '../audio/types'
import Knob from './Knob'
import TrackHeader from './TrackHeader'
import { SAMPLED } from '../audio/presets'

interface Props {
  track: Track | null
  onChange: (patch: Partial<SynthParams>) => void
  onPreview: () => void
}

const WAVES: { id: string; label: string; d: string }[] = [
  { id: 'sine', label: 'Sine', d: 'M2 12C5 2 9 2 12 12S19 22 22 12' },
  { id: 'triangle', label: 'Tri', d: 'M2 12L7 4L17 20L22 12' },
  { id: 'square', label: 'Square', d: 'M2 17V7H12V17H22V7' },
  { id: 'sawtooth', label: 'Saw', d: 'M2 17L12 7V17L22 7V17' },
  { id: 'fatsawtooth', label: 'Fat saw', d: 'M2 17L12 7V17L22 7V17M2 14L12 4V14L22 4' },
]

const pct = (v: number) => `${Math.round(v * 100)}`
const semis = (v: number) => `${v > 0 ? '+' : ''}${Math.round((v * 2 - 1) * 12)} st`
const secs = (sec: number) => (sec < 1 ? `${Math.round(sec * 1000)} ms` : `${sec.toFixed(2)} s`)
const atk = (v: number) => secs(0.001 + v * v * 2)
const dec = (v: number) => secs(0.01 + v * v * 2)
const rel = (v: number) => secs(0.01 + v * v * 3)
const hz = (v: number) => { const f = 80 * Math.pow(18000 / 80, v); return f >= 1000 ? `${(f / 1000).toFixed(1)}k` : `${Math.round(f)}` }

// ADSR (or attack/hold/release for recorded sounds) drawn from the knob values
function EnvelopeGraph({ sy, color, ar }: { sy: SynthParams; color: string; ar: boolean }) {
  const W = 300, H = 84, top = 10, base = H - 6
  const seg = (k: number) => 14 + k * 70
  const sus = ar ? 0.72 : sy.sustain
  const x1 = 4 + seg(sy.attack)
  const x2 = x1 + (ar ? 0 : seg(sy.decay))
  const x3 = x2 + (ar ? 110 : 64)
  const x4 = Math.min(W - 4, x3 + seg(sy.release))
  const ys = top + (1 - sus) * (base - top)
  const line = ar
    ? `M4 ${base}L${x1} ${top}C${x1 + 40} ${top + 4} ${x3 - 30} ${ys} ${x3} ${ys}L${x4} ${base}`
    : `M4 ${base}L${x1} ${top}L${x2} ${ys}L${x3} ${ys}L${x4} ${base}`
  const pts = ar ? [[x1, top], [x3, ys]] : [[x1, top], [x2, ys], [x3, ys]]
  return (
    <svg className={s.graph} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id="env-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={color} stopOpacity=".35" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((f) => <line key={f} x1="0" x2={W} y1={H * f} y2={H * f} className={s.graphGrid} />)}
      <path d={`${line}Z`} fill="url(#env-fill)" />
      <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      {pts.map(([x, y]) => <circle key={`${x}`} cx={x} cy={y} r="3.2" fill="#0c0d10" stroke={color} strokeWidth="1.6" vectorEffect="non-scaling-stroke" />)}
    </svg>
  )
}

// low-pass response for the cutoff / resonance knobs (same mapping as the engine)
function FilterGraph({ cutoff, reso, color }: { cutoff: number; reso: number; color: string }) {
  const W = 300, H = 84
  const fc = 80 * Math.pow(18000 / 80, cutoff)
  const Q = Math.max(0.55, reso * 18)
  const pts: string[] = []
  for (let i = 0; i <= 60; i++) {
    const f = 20 * Math.pow(1000, i / 60)                  // 20 Hz .. 20 kHz
    const r = f / fc
    const mag = 1 / Math.sqrt((1 - r * r) ** 2 + (r / Q) ** 2)
    const db = Math.max(-36, Math.min(24, 20 * Math.log10(mag)))
    pts.push(`${(i / 60) * W} ${H * 0.62 - (db / 36) * (H * 0.55)}`)
  }
  const line = `M${pts.join('L')}`
  return (
    <svg className={s.graph} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id="flt-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={color} stopOpacity=".3" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient>
      </defs>
      {[0.2, 0.4, 0.6, 0.8].map((f) => <line key={f} y1="0" y2={H} x1={W * f} x2={W * f} className={s.graphGrid} />)}
      <path d={`${line}L${W} ${H}L0 ${H}Z`} fill="url(#flt-fill)" />
      <path d={line} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className={s.card}>
      <header className={s.cardHead}>
        <span className={s.cardTitle}>{title}</span>
        {hint && <span className={s.cardHint}>{hint}</span>}
      </header>
      {children}
    </section>
  )
}

export default function SynthEditor({ track, onChange, onPreview }: Props) {
  if (!track) return <div className={s.empty}>Select a channel to shape its sound.</div>
  const sy = track.synth
  const c = track.color
  const isDrum = track.kind === 'drum'
  const isRecorded = !!SAMPLED[track.presetId]
  const isSynth = !isDrum && !isRecorded && track.presetId !== 'piano' && track.kind !== 'audio'

  return (
    <div className={s.panelStack}>
      <TrackHeader track={track} section="sound design" onPreview={onPreview} />

      {isSynth && (
        <Section title="Oscillator" hint="the raw tone">
          <div className={s.waveRow}>
            {WAVES.map((w) => (
              <button key={w.id} className={`${s.waveBtn} ${sy.wave === w.id ? s.waveActive : ''}`} style={{ ['--tc' as string]: c }} onClick={() => onChange({ wave: w.id })}>
                <svg viewBox="0 0 24 24" width="26" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={w.d} /></svg>
                {w.label}
              </button>
            ))}
          </div>
          <div className={s.knobGrid}>
            <Knob value={(sy.detune + 1) / 2} onChange={(v) => onChange({ detune: v * 2 - 1 })} label="Detune" accent={c} bipolar display={(v) => `${Math.round((v * 2 - 1) * 100)}`} />
            <Knob value={sy.glide} onChange={(v) => onChange({ glide: v })} label="Glide" accent={c} display={pct} />
          </div>
        </Section>
      )}

      {(isSynth || isRecorded) && (
        <Section title="Envelope" hint={isSynth ? 'how each note rises and fades' : 'fade in, and the tail after you let go'}>
          <EnvelopeGraph sy={sy} color={c} ar={isRecorded} />
          <div className={s.knobGrid}>
            <Knob value={sy.attack} onChange={(v) => onChange({ attack: v })} label="Attack" accent={c} display={atk} />
            {isSynth && <Knob value={sy.decay} onChange={(v) => onChange({ decay: v })} label="Decay" accent={c} display={dec} />}
            {isSynth && <Knob value={sy.sustain} onChange={(v) => onChange({ sustain: v })} label="Sustain" accent={c} display={pct} />}
            <Knob value={sy.release} onChange={(v) => onChange({ release: v })} label="Release" accent={c} display={rel} />
          </div>
        </Section>
      )}

      <Section title="Filter" hint="darker ↔ brighter">
        <FilterGraph cutoff={sy.cutoff} reso={sy.reso} color={c} />
        <div className={s.knobGrid}>
          <Knob value={sy.cutoff} onChange={(v) => onChange({ cutoff: v })} label="Cutoff" accent={c} display={(v) => `${hz(v)} Hz`} />
          <Knob value={sy.reso} onChange={(v) => onChange({ reso: v })} label="Resonance" accent={c} display={pct} />
        </div>
      </Section>

      <Section title={isDrum ? 'Tune & level' : 'Output'}>
        <div className={s.knobGrid}>
          {isDrum && <Knob value={(sy.pitch + 1) / 2} onChange={(v) => onChange({ pitch: v * 2 - 1 })} label="Pitch" accent={c} bipolar display={semis} />}
          <Knob value={sy.gain} onChange={(v) => onChange({ gain: v })} label="Gain" accent={c} display={pct} />
        </div>
      </Section>
    </div>
  )
}
