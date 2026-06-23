'use client'

import s from '../studioKapi.module.css'
import type { Track, FxType } from '../audio/types'
import { FX_META } from '../audio/presets'
import Knob from './Knob'

interface Props {
  track: Track | null
  onToggle: (type: FxType) => void
  onChange: (type: FxType, index: number, value: number) => void
}

export default function FXRack(p: Props) {
  if (!p.track) return <div className={s.empty}>Select a channel to edit its effects.</div>
  return (
    <div className={s.fxList}>
      <div className={s.rollHint}>{p.track.name} · effects chain</div>
      {p.track.fx.map((fx) => {
        const meta = FX_META[fx.type]
        return (
          <div key={fx.type} className={`${s.fxCard} ${fx.enabled ? s.fxOn : ''}`}>
            <div className={s.fxHead}>
              <span className={s.fxName}>{meta.label}</span>
              <button
                className={`${s.fxToggle} ${fx.enabled ? s.on : ''}`}
                onClick={() => p.onToggle(fx.type)}
                aria-label={`Toggle ${meta.label}`}
              />
            </div>
            <div className={`${s.fxKnobs} ${fx.enabled ? s.on : ''}`}>
              {meta.knobs.slice(0, meta.count).map((label, i) => (
                <Knob
                  key={label}
                  value={fx.k[i]}
                  onChange={(v) => p.onChange(fx.type, i, v)}
                  label={label}
                  accent={p.track!.color}
                  size={42}
                  bipolar={fx.type === 'eq'}
                  display={(v) => `${Math.round(v * 100)}`}
                />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
