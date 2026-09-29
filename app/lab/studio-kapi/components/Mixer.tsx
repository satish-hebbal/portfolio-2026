'use client'

import { useCallback, useEffect, useRef } from 'react'
import s from '../studioKapi.module.css'
import type { Track } from '../audio/types'
import Knob from './Knob'
import { InstrumentIcon } from './InstrumentIcons'

interface Props {
  tracks: Track[]
  selectedTrackId: string | null
  masterVolume: number
  getTrackLevel: (id: string) => number
  getMasterLevel: () => number
  onSelect: (id: string) => void
  onVolume: (id: string, v: number) => void
  onPan: (id: string, v: number) => void
  onMute: (id: string) => void
  onSolo: (id: string) => void
  onMaster: (v: number) => void
}

const DEFAULT_VOL = 0.8
const FADER_PAD = 9
const clamp01 = (v: number) => Math.max(0, Math.min(1, v))
const toDb = (v: number) => (v <= 0.001 ? '−∞' : (20 * Math.log10(v)).toFixed(1))
// dB marks placed at their linear-gain position on the fader
const SCALE: [string, number][] = [['0', 1], ['6', 0.5], ['12', 0.25], ['24', 0.063], ['∞', 0]]
const panText = (v: number) => { const p = Math.round((v * 2 - 1) * 100); return p === 0 ? 'C' : `${p > 0 ? 'R' : 'L'}${Math.abs(p)}` }

// Hardware-style vertical fader: drag, scroll, double-click resets.
function Fader({ value, onChange, color }: { value: number; onChange: (v: number) => void; color: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const fromY = useCallback((y: number) => {
    const r = ref.current!.getBoundingClientRect()
    onChange(clamp01(1 - (y - r.top - FADER_PAD) / (r.height - FADER_PAD * 2)))
  }, [onChange])
  const pos = `calc(${FADER_PAD}px + ${value} * (100% - ${FADER_PAD * 2}px))`
  return (
    <div
      ref={ref} className={s.fader} style={{ ['--tc' as string]: color }}
      onPointerDown={(e) => { e.stopPropagation(); (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); fromY(e.clientY) }}
      onPointerMove={(e) => { if (e.buttons & 1) fromY(e.clientY) }}
      onDoubleClick={() => onChange(DEFAULT_VOL)}
      onWheel={(e) => onChange(clamp01(value - Math.sign(e.deltaY) * 0.02))}
      title="Drag, scroll, double-click to reset"
    >
      <span className={s.faderGroove} />
      <span className={s.faderFill} style={{ height: `calc(${value} * (100% - ${FADER_PAD * 2}px))`, bottom: FADER_PAD }} />
      <span className={s.faderCap} style={{ bottom: pos }} />
    </div>
  )
}

function FaderScale() {
  return (
    <div className={s.faderScale}>
      {SCALE.map(([label, g]) => (
        <span key={label} style={{ bottom: `calc(${FADER_PAD}px + ${g} * (100% - ${FADER_PAD * 2}px))` }}>{label}</span>
      ))}
    </div>
  )
}

export default function Mixer(p: Props) {
  // live meters: write straight to the DOM each frame (no React re-render)
  const meters = useRef(new Map<string, HTMLSpanElement>())
  const levelFn = useRef({ track: p.getTrackLevel, master: p.getMasterLevel })
  levelFn.current = { track: p.getTrackLevel, master: p.getMasterLevel }
  useEffect(() => {
    let raf = 0
    const tick = () => {
      meters.current.forEach((el, id) => {
        const l = id.startsWith('__master') ? levelFn.current.master() : levelFn.current.track(id)
        el.style.clipPath = `inset(${(1 - l) * 100}% 0 0 0)`
      })
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])
  const meterRef = (id: string) => (el: HTMLSpanElement | null) => { if (el) meters.current.set(id, el); else meters.current.delete(id) }

  return (
    <div className={s.mixer}>
      <div className={s.mixStrips}>
        {p.tracks.map((t) => (
          <div
            key={t.id}
            className={`${s.strip} ${p.selectedTrackId === t.id ? s.stripSel : ''} ${t.mixer.mute ? s.stripMuted : ''}`}
            style={{ ['--tc' as string]: t.color }}
            onClick={() => p.onSelect(t.id)}
          >
            <div className={s.stripTop}>
              <span className={s.stripIcon}><InstrumentIcon presetId={t.kind === 'audio' ? 'audio' : t.presetId} group={t.group} size={17} /></span>
              <span className={s.stripName} title={t.name}>{t.name}</span>
            </div>
            <div onClick={(e) => e.stopPropagation()}>
              <Knob value={(t.mixer.pan + 1) / 2} onChange={(v) => p.onPan(t.id, v * 2 - 1)} accent={t.color} bipolar size={34} display={panText} />
            </div>
            <div className={s.faderZone}>
              <FaderScale />
              <Fader value={t.mixer.volume} onChange={(v) => p.onVolume(t.id, v)} color={t.color} />
              <span className={s.chMeter}><span ref={meterRef(t.id)} className={s.chMeterFill} /></span>
            </div>
            <span className={s.dbRead}>{toDb(t.mixer.volume)}<small>dB</small></span>
            <div className={s.stripBtns}>
              <button className={`${s.msBtn} ${s.msMute} ${t.mixer.mute ? s.msOn : ''}`} onClick={(e) => { e.stopPropagation(); p.onMute(t.id) }} title="Mute">M</button>
              <button className={`${s.msBtn} ${s.msSolo} ${t.mixer.solo ? s.msOn : ''}`} onClick={(e) => { e.stopPropagation(); p.onSolo(t.id) }} title="Solo">S</button>
            </div>
          </div>
        ))}
      </div>

      <div className={`${s.strip} ${s.masterStrip}`} style={{ ['--tc' as string]: '#e7ebf2' }}>
        <div className={s.stripTop}>
          <span className={s.masterBadge}>OUT</span>
          <span className={s.stripName}>Master</span>
        </div>
        <div className={s.masterSpacer} />
        <div className={s.faderZone}>
          <FaderScale />
          <Fader value={p.masterVolume} onChange={p.onMaster} color="#e7ebf2" />
          <span className={s.chMeter}><span ref={meterRef('__masterL')} className={s.chMeterFill} /></span>
          <span className={s.chMeter}><span ref={meterRef('__masterR')} className={s.chMeterFill} /></span>
        </div>
        <span className={s.dbRead}>{toDb(p.masterVolume)}<small>dB</small></span>
        <div className={s.stripBtns}><span className={s.stereoTag}>L · R</span></div>
      </div>
    </div>
  )
}
