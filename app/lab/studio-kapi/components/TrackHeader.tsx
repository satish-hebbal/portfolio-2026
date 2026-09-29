'use client'

// Selected-channel header shared by the Synth and FX panels: who you're editing,
// what kind of sound source it is, and a quick audition button.
import { Play } from 'lucide-react'
import s from '../studioKapi.module.css'
import type { Track } from '../audio/types'
import { SAMPLED, REAL_GROUPS, getPreset } from '../audio/presets'
import { InstrumentIcon } from './InstrumentIcons'

export function sourceLabel(t: Track): string {
  if (t.kind === 'audio') return 'Recorded take'
  if (t.kind === 'drum') {
    const g = getPreset(t.presetId)?.group
    return g && REAL_GROUPS.has(g) ? 'Recorded one-shot' : 'Drum one-shot'
  }
  if (SAMPLED[t.presetId]) return 'Recorded instrument'
  if (t.presetId === 'piano') return 'Sampled piano'
  return 'Synthesizer'
}

export default function TrackHeader({ track, section, onPreview }: { track: Track; section: string; onPreview?: () => void }) {
  return (
    <div className={s.trackHeader} style={{ ['--tc' as string]: track.color }}>
      <span className={s.thIcon}>
        <InstrumentIcon presetId={track.kind === 'audio' ? 'audio' : track.presetId} group={track.group} size={22} />
      </span>
      <span className={s.thText}>
        <span className={s.thName}>{track.name}</span>
        <span className={s.thMeta}>{sourceLabel(track)} · {section}</span>
      </span>
      {onPreview && track.kind !== 'audio' && (
        <button className={s.thPreview} onClick={onPreview} title="Play a preview note">
          <Play size={12} fill="currentColor" /> Hear it
        </button>
      )}
    </div>
  )
}
