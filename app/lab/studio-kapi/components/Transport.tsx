'use client'

import { Play, Square, Circle, Download, Loader2, Bell, BellOff, Undo2, Redo2, ArrowLeft } from 'lucide-react'
import s from '../studioKapi.module.css'
import Knob from './Knob'
import Select from './Select'

interface Props {
  bpm: number
  steps: number
  swing: number
  metronome: boolean
  isPlaying: boolean
  isRecording: boolean
  level: number
  exporting: boolean
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  onPlay: () => void
  onStop: () => void
  onRecordClick: () => void
  onBpm: (v: number) => void
  onSteps: (v: number) => void
  onSwing: (v: number) => void
  onToggleMetro: () => void
  onExport: () => void
}

export default function Transport(p: Props) {
  return (
    <div className={s.topbar}>
      <a href="/lab" className={s.backLink} title="Back to Lab">
        <ArrowLeft size={15} />
        <span className={s.backSa} role="img" aria-label="SA" />
        Lab
      </a>
      <div className={s.brand}>
        <img src="/lab/studio-kapi/img-assets/kapi-studio-icon.svg" alt="Studio-Kapi" className={s.brandLogo} />
      </div>

      <div className={s.transportGroup}>
        <button className={`${s.tbtn} ${s.play} ${p.isPlaying ? s.active : ''}`} onClick={p.isPlaying ? p.onStop : p.onPlay} title="Play / Stop (Space)">
          {p.isPlaying ? <Square size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" />}
        </button>
        <button className={`${s.tbtn} ${s.rec} ${p.isRecording ? s.active : ''}`} onClick={p.onRecordClick} title="Record voice (R)">
          <Circle size={14} fill="currentColor" />
        </button>
        <button className={`${s.tbtn} ${p.metronome ? s.on : ''}`} onClick={p.onToggleMetro} title="Metronome (M)">
          {p.metronome ? <Bell size={14} /> : <BellOff size={14} />}
        </button>
        <span className={s.vsep} />
        <button className={s.tbtn} onClick={p.onUndo} disabled={!p.canUndo} title="Undo (Ctrl+Z)"><Undo2 size={15} /></button>
        <button className={s.tbtn} onClick={p.onRedo} disabled={!p.canRedo} title="Redo (Ctrl+Shift+Z)"><Redo2 size={15} /></button>
      </div>

      <span className={s.vsep} />

      <div className={s.readouts}>
        <div className={s.field}>
          <span className={s.fieldLabel}>Tempo</span>
          <input className={s.bpmInput} type="number" min={40} max={240} value={p.bpm}
            onChange={(e) => p.onBpm(Math.max(40, Math.min(240, Number(e.target.value) || 0)))} />
        </div>
        <div className={s.field}>
          <span className={s.fieldLabel}>Steps</span>
          <Select
            className={s.stepsInput}
            title="Steps per bar"
            value={p.steps}
            onChange={p.onSteps}
            options={[
              { value: 8, label: '8' },
              { value: 16, label: '16' },
              { value: 32, label: '32' },
            ]}
          />
        </div>
        <div className={s.field}>
          <span className={s.fieldLabel}>Swing</span>
          <Knob value={p.swing} onChange={p.onSwing} size={30} />
        </div>
      </div>

      <div className={s.spacer} />

      <div className={s.meterWrap}>
        <span className={s.fieldLabel}>Master</span>
        <div className={s.meterBar}><div className={s.meterFill} style={{ width: `${Math.round(p.level * 100)}%` }} /></div>
      </div>

      <button className={s.exportBtn} onClick={p.onExport} disabled={p.exporting}>
        {p.exporting ? <Loader2 size={15} className={s.spin} /> : <Download size={15} />}
        {p.exporting ? 'Rendering' : 'Export WAV'}
      </button>
    </div>
  )
}
