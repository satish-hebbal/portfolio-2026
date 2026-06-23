'use client'

import s from '../studioKapi.module.css'
import type { Track } from '../audio/types'
import Knob from './Knob'
import LEDMeter from './LEDMeter'

interface Props {
  tracks: Track[]
  selectedTrackId: string | null
  masterVolume: number
  level: number
  onSelect: (id: string) => void
  onVolume: (id: string, v: number) => void
  onPan: (id: string, v: number) => void
  onMute: (id: string) => void
  onSolo: (id: string) => void
  onMaster: (v: number) => void
}

function Strip({ name, color, selected, volume, pan, mute, solo, onSelect, onVolume, onPan, onMute, onSolo }: {
  name: string; color: string; selected: boolean; volume: number; pan: number; mute: boolean; solo: boolean
  onSelect: () => void; onVolume: (v: number) => void; onPan: (v: number) => void; onMute: () => void; onSolo: () => void
}) {
  return (
    <div className={`${s.channelStrip} ${selected ? s.selected : ''}`} onClick={onSelect}>
      <span className={s.stripName} style={{ color }}>{name}</span>
      <Knob value={(pan + 1) / 2} onChange={(v) => onPan(v * 2 - 1)} label="Pan" accent={color} bipolar size={36}
        display={(v) => { const p = Math.round((v * 2 - 1) * 100); return p === 0 ? 'C' : `${p > 0 ? 'R' : 'L'}${Math.abs(p)}` }} />
      <div className={s.fader} onClick={(e) => e.stopPropagation()}>
        <input type="range" min={0} max={1} step={0.01} value={volume} onChange={(e) => onVolume(Number(e.target.value))} />
      </div>
      <div className={s.stripBtns}>
        <button className={`${s.miniBtn} ${s.mute} ${mute ? s.active : ''}`} onClick={(e) => { e.stopPropagation(); onMute() }}>M</button>
        <button className={`${s.miniBtn} ${s.solo} ${solo ? s.active : ''}`} onClick={(e) => { e.stopPropagation(); onSolo() }}>S</button>
      </div>
    </div>
  )
}

export default function Mixer(p: Props) {
  return (
    <div className={s.mixer}>
      {p.tracks.map((t) => (
        <Strip
          key={t.id}
          name={t.name} color={t.color} selected={p.selectedTrackId === t.id}
          volume={t.mixer.volume} pan={t.mixer.pan} mute={t.mixer.mute} solo={t.mixer.solo}
          onSelect={() => p.onSelect(t.id)}
          onVolume={(v) => p.onVolume(t.id, v)} onPan={(v) => p.onPan(t.id, v)}
          onMute={() => p.onMute(t.id)} onSolo={() => p.onSolo(t.id)}
        />
      ))}

      <div className={`${s.channelStrip} ${s.masterStrip}`}>
        <span className={s.stripName} style={{ color: '#ff7a45' }}>Master</span>
        <LEDMeter level={p.level} height={120} width={10} />
        <div className={s.fader}>
          <input type="range" min={0} max={1} step={0.01} value={p.masterVolume} onChange={(e) => p.onMaster(Number(e.target.value))} />
        </div>
        <div className={s.stripBtns}><span className={s.masterDb}>OUT</span></div>
      </div>
    </div>
  )
}
