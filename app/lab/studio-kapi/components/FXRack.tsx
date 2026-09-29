'use client'

import { SlidersVertical, Funnel, Flame, Grid3x3, AudioLines, Orbit, Repeat, Cloud, ChevronsDownUp, type LucideIcon } from 'lucide-react'
import s from '../studioKapi.module.css'
import type { Track, FxType } from '../audio/types'
import { FX_META } from '../audio/presets'
import Knob from './Knob'
import TrackHeader from './TrackHeader'

interface Props {
  track: Track | null
  onToggle: (type: FxType) => void
  onChange: (type: FxType, index: number, value: number) => void
  onPreview: () => void
}

const FX_INFO: Record<FxType, { icon: LucideIcon; about: string }> = {
  eq: { icon: SlidersVertical, about: 'Shape the bass, mids and treble' },
  filter: { icon: Funnel, about: 'Sweep the tone darker or brighter' },
  distortion: { icon: Flame, about: 'Grit, crunch and fuzz' },
  bitcrush: { icon: Grid3x3, about: 'Lo-fi, retro game-console crunch' },
  chorus: { icon: AudioLines, about: 'Thickens one sound into many voices' },
  phaser: { icon: Orbit, about: 'A swirling, jet-like sweep' },
  delay: { icon: Repeat, about: 'Echoes that repeat in time' },
  reverb: { icon: Cloud, about: 'Places the sound in a room or hall' },
  compressor: { icon: ChevronsDownUp, about: 'Evens out the loud and soft parts' },
}

const readout = (type: FxType) => (v: number) =>
  type === 'eq' ? `${v >= 0.5 ? '+' : ''}${((v - 0.5) * 24).toFixed(1)} dB` : `${Math.round(v * 100)}`

export default function FXRack(p: Props) {
  if (!p.track) return <div className={s.empty}>Select a channel to edit its effects.</div>
  const c = p.track.color
  const active = p.track.fx.filter((f) => f.enabled)

  return (
    <div className={s.panelStack}>
      <TrackHeader track={p.track} section="effects" onPreview={p.onPreview} />

      {/* signal flow: what the sound passes through, in order */}
      <div className={s.chain} style={{ ['--tc' as string]: c }}>
        <span className={s.chainEnd}>In</span>
        {active.length === 0 && <span className={s.chainEmpty}>dry, no effects yet</span>}
        {active.map((f) => {
          const Icon = FX_INFO[f.type].icon
          return (
            <span key={f.type} className={s.chainStep}>
              <span className={s.chainWire} />
              <span className={s.chainChip}><Icon size={12} />{FX_META[f.type].label}</span>
            </span>
          )
        })}
        <span className={s.chainWire} />
        <span className={s.chainEnd}>Out</span>
      </div>

      <div className={s.fxList}>
        {p.track.fx.map((fx) => {
          const meta = FX_META[fx.type]
          const info = FX_INFO[fx.type]
          const Icon = info.icon
          return (
            <div key={fx.type} className={`${s.fxRow} ${fx.enabled ? s.fxOn : ''}`} style={{ ['--tc' as string]: c }}>
              <button className={s.fxHead} onClick={() => p.onToggle(fx.type)} aria-pressed={fx.enabled}>
                <span className={s.fxIcon}><Icon size={16} /></span>
                <span className={s.fxText}>
                  <span className={s.fxName}>{meta.label}</span>
                  <span className={s.fxAbout}>{info.about}</span>
                </span>
                <span className={`${s.fxToggle} ${fx.enabled ? s.on : ''}`} aria-hidden />
              </button>
              {fx.enabled && (
                <div className={s.fxKnobs}>
                  {meta.knobs.slice(0, meta.count).map((label, i) => (
                    <Knob key={label} value={fx.k[i]} onChange={(v) => p.onChange(fx.type, i, v)}
                      label={label} accent={c} size={40} bipolar={fx.type === 'eq'} display={readout(fx.type)} />
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
