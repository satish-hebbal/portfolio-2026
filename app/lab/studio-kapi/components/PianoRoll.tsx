'use client'

import s from '../studioKapi.module.css'
import type { Track, RollNote } from '../audio/types'

interface Props {
  track: Track | null
  notes: RollNote[]
  steps: number
  currentStep: number
  onToggleNote: (step: number, note: string) => void
  onPreview: (note: string) => void
}

const SEMITONES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const PITCHES: string[] = []
for (const oct of [6, 5, 4, 3, 2]) {
  for (let i = 11; i >= 0; i--) PITCHES.push(`${SEMITONES[i]}${oct}`)
}
const isBlack = (n: string) => n.includes('#')

export default function PianoRoll(p: Props) {
  if (!p.track || p.track.kind !== 'instrument') {
    return <div className={s.empty}>Select an instrument channel, then open its piano roll.</div>
  }
  const noteAt = (step: number, note: string) => p.notes.find((n) => n.step === step && n.note === note)

  return (
    <div className={s.roll}>
      <div className={s.rollHint}>{p.track.name} · click cells to place notes · click a key to audition</div>
      <div className={s.rollGridWrap}>
        <div className={s.rollGrid}>
          {PITCHES.map((pitch) => (
            <div key={pitch} className={s.rollRow}>
              <div className={`${s.rollKey} ${isBlack(pitch) ? s.black : ''}`} onClick={() => p.onPreview(pitch)}>
                {pitch}
              </div>
              {Array.from({ length: p.steps }).map((_, step) => {
                const n = noteAt(step, pitch)
                return (
                  <div
                    key={step}
                    className={`${s.rollCell} ${isBlack(pitch) ? s.black : ''} ${step % 4 === 0 ? s.cellBeat : ''} ${n ? s.on : ''} ${p.currentStep === step ? s.playhead : ''}`}
                    style={n ? { ['--vel' as string]: n.velocity } : undefined}
                    onClick={() => p.onToggleNote(step, pitch)}
                  />
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
