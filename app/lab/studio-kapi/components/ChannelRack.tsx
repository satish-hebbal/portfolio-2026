'use client'

import { useState } from 'react'
import {
  Plus, Trash2, Piano, SlidersHorizontal, X, Volume2, VolumeX, Headphones,
  Drum, Disc3, Bell, Waves, Zap, Sparkles, Music, Layers, Wind, AudioWaveform, Hand, Mic,
  type LucideIcon,
} from 'lucide-react'
import s from '../studioKapi.module.css'
import type { Track, PatternData, PresetDef } from '../audio/types'
import { PRESETS } from '../audio/presets'
import Menu from './Menu'

// icon per instrument (falls back to a per-group icon, then a generic note)
const PRESET_ICON: Record<string, LucideIcon> = {
  'hat-closed': Disc3, 'hat-open': Disc3, ride: Disc3, crash: Disc3, disco: Disc3,
  clap: Hand, cowbell: Bell, bell: Bell, digibell: Bell,
  bass: Waves, sub: Waves, reese: Waves, acid: Waves, funkbass: Waves,
  supersaw: AudioWaveform, lead: Zap, stab: Zap, pad: Layers, hoover: Wind,
  pluck: Music, arp: Sparkles, prophet: Sparkles,
}
const GROUP_ICON: Record<string, LucideIcon> = {
  Drums: Drum, '808 & Perc': Drum, Bass: Waves, Synth: Zap, Electronic: Sparkles, Keys: Piano,
}
function pickIcon(id: string, group?: string | null): LucideIcon {
  return PRESET_ICON[id] ?? GROUP_ICON[group ?? ''] ?? Music
}
function IconFor({ preset }: { preset: PresetDef }) {
  const Icon = pickIcon(preset.id, preset.group)
  return <Icon size={15} />
}

interface Props {
  tracks: Track[]
  data: Record<string, PatternData>
  selectedTrackId: string | null
  currentStep: number
  steps: number
  onSelect: (id: string) => void
  onToggleStep: (trackId: string, step: number) => void
  onMute: (id: string) => void
  onSolo: (id: string) => void
  onOpenRoll: (id: string) => void
  onOpenSynth: (id: string) => void
  onDelete: (id: string) => void
  onAdd: (presetId: string) => void
  onPreview: (track: Track) => void
}

const GROUPS = ['Drums', '808 & Perc', 'Bass', 'Synth', 'Electronic', 'Keys'] as const

function stepIsOn(track: Track, d: PatternData | undefined, i: number) {
  if (!d) return false
  return track.kind === 'drum' ? !!d.steps[i] : d.notes.some((n) => n.step === i)
}

export default function ChannelRack(p: Props) {
  const [picking, setPicking] = useState(false)

  return (
    <div className={s.rack}>
      <div className={s.panelHead}>
        <span className={s.panelTitle}>Channel Rack</span>
        <span className={s.panelHint}>{p.tracks.length} channels</span>
      </div>

      <div className={s.rackScroll}>
        {p.tracks.map((track) => {
          const d = p.data[track.id]
          const RowIcon = track.kind === 'audio' ? Mic : pickIcon(track.presetId, track.group)
          const selectPreview = () => { p.onSelect(track.id); p.onPreview(track) }
          return (
            <div key={track.id} className={`${s.trackRow} ${p.selectedTrackId === track.id ? s.selected : ''}`}>
              <span
                className={s.trackIcon}
                style={{ color: track.color, background: `${track.color}1f`, boxShadow: `inset 0 0 0 1px ${track.color}44` }}
                onClick={selectPreview}
              >
                <RowIcon size={14} />
              </span>
              <div className={s.trackInfo} onClick={selectPreview}>
                <span className={s.trackName}>{track.name}</span>
                <span className={s.trackPreset}>{track.kind === 'audio' ? 'recording' : track.presetId}</span>
              </div>
              {/* desktop: inline buttons */}
              <div className={`${s.trackBtns} ${s.deskOnly}`}>
                <button className={`${s.miniBtn} ${s.mute} ${track.mixer.mute ? s.active : ''}`} onClick={() => p.onMute(track.id)} title="Mute">M</button>
                <button className={`${s.miniBtn} ${s.solo} ${track.mixer.solo ? s.active : ''}`} onClick={() => p.onSolo(track.id)} title="Solo">S</button>
                <button className={s.miniBtn} onClick={() => { p.onSelect(track.id); p.onOpenSynth(track.id) }} title="Sound design"><SlidersHorizontal size={11} /></button>
                {track.kind === 'instrument' ? (
                  <button className={`${s.miniBtn} ${s.roll}`} onClick={() => p.onOpenRoll(track.id)} title="Piano roll"><Piano size={12} /></button>
                ) : (
                  <span className={s.miniBtn} style={{ visibility: 'hidden' }} aria-hidden />
                )}
                <button className={s.miniBtn} onClick={() => p.onDelete(track.id)} title="Delete"><Trash2 size={11} /></button>
              </div>
              {/* mobile: consolidated 3-dot menu (saves space for the steps) */}
              <div className={s.mobileOnly}>
                <Menu items={[
                  { label: 'Sound design', icon: <SlidersHorizontal size={12} />, onClick: () => { p.onSelect(track.id); p.onOpenSynth(track.id) } },
                  ...(track.kind === 'instrument' ? [{ label: 'Piano roll', icon: <Piano size={12} />, onClick: () => p.onOpenRoll(track.id) }] : []),
                  { label: track.mixer.mute ? 'Unmute' : 'Mute', icon: track.mixer.mute ? <VolumeX size={12} /> : <Volume2 size={12} />, onClick: () => p.onMute(track.id) },
                  { label: track.mixer.solo ? 'Unsolo' : 'Solo', icon: <Headphones size={12} />, onClick: () => p.onSolo(track.id) },
                  { label: 'Delete', icon: <Trash2 size={12} />, onClick: () => p.onDelete(track.id), danger: true },
                ]} />
              </div>

              {track.kind === 'audio' ? (
                <div className={s.steps} style={{ alignItems: 'center', color: 'var(--dim)', fontSize: 11, paddingLeft: 8 }}>
                  Loops with the pattern
                </div>
              ) : (
                <div className={s.steps}>
                  {Array.from({ length: p.steps }).map((_, i) => (
                    <div
                      key={i}
                      className={`${s.step} ${i % 4 === 0 ? s.stepBeat : ''} ${stepIsOn(track, d, i) ? s.on : ''} ${p.currentStep === i ? s.playhead : ''}`}
                      style={{ ['--trackColor' as string]: track.color }}
                      onClick={() => p.onToggleStep(track.id, i)}
                    />
                  ))}
                </div>
              )}
            </div>
          )
        })}

        <button className={s.addTrack} onClick={() => setPicking(true)}>
          <Plus size={15} /> Add channel
        </button>
      </div>

      {picking && (
        <div className={s.pickerOverlay} onClick={() => setPicking(false)}>
          <div className={s.picker} onClick={(e) => e.stopPropagation()}>
            <div className={s.pickerHead}>
              <span className={s.panelTitle}>Choose an instrument</span>
              <button className={s.miniBtn} onClick={() => setPicking(false)}><X size={13} /></button>
            </div>
            {GROUPS.map((g) => (
              <div key={g} className={s.pickerGroup}>
                <div className={s.pickerGroupLabel}>{g}</div>
                <div className={s.pickerGrid}>
                  {PRESETS.filter((pr) => pr.group === g).map((pr) => (
                    <button key={pr.id} className={s.presetChip} onClick={() => { p.onAdd(pr.id); setPicking(false) }}>
                      <span className={s.presetIcon} style={{ color: pr.color, background: `${pr.color}1f`, boxShadow: `inset 0 0 0 1px ${pr.color}44` }}>
                        <IconFor preset={pr} />
                      </span>
                      {pr.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
