'use client'

import { useEffect, useRef, useState } from 'react'
import { Trash2, Wand2, RotateCcw, Loader2, Check, Pencil, Download, Upload, FolderPlus, Circle, Square, Play, Pause, GripVertical } from 'lucide-react'
import s from '../studioKapi.module.css'
import RecWave from './RecWave'
import Menu from './Menu'
import VintageMic from './VintageMic'

export interface Take {
  id: string
  url: string
  name: string
  seconds?: number
  peaks?: number[]
  cleaned?: boolean
}

interface Props {
  isRecording: boolean
  permissionError: string | null
  takes: Take[]
  cleaningId: string | null
  onStart: () => void
  onStop: () => void
  onAdd: (take: Take) => void
  onDelete: (id: string) => void
  onRename: (id: string, name: string) => void
  onClean: (id: string, reductionDb: number, sensitivity: number) => void
  onRevert: (id: string) => void
  onImport: (files: FileList) => void
}

const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`
const BARS = 72

// downsample stored peaks to a fixed bar count for the card waveform
function bars(peaks: number[] | undefined): number[] {
  if (!peaks?.length) return Array.from({ length: BARS }, () => 0.08)
  const out: number[] = []
  const step = peaks.length / BARS
  let max = 0.0001
  for (let i = 0; i < BARS; i++) {
    let m = 0
    for (let j = Math.floor(i * step); j < Math.floor((i + 1) * step); j++) m = Math.max(m, peaks[j] ?? 0)
    out.push(m); max = Math.max(max, m)
  }
  return out.map((v) => Math.max(0.06, v / max))
}

// One take: play/pause, waveform with progress + click-to-seek, tools menu.
function TakeCard({ t, busy, open, onToggleClean, children, menu, editing, onRenameDone }: {
  t: Take; busy: boolean; open: boolean; onToggleClean: () => void; children?: React.ReactNode
  menu: React.ReactNode; editing: boolean; onRenameDone: (name: string) => void
}) {
  const audio = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const wave = bars(t.peaks)

  const toggle = () => {
    const a = audio.current
    if (!a) return
    if (a.paused) a.play(); else a.pause()
  }
  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const a = audio.current
    if (!a || !a.duration) return
    const r = e.currentTarget.getBoundingClientRect()
    a.currentTime = ((e.clientX - r.left) / r.width) * a.duration
    setProgress(a.currentTime / a.duration)
  }

  return (
    <div className={`${s.takeCard} ${open ? s.takeOpen : ''}`}>
      <div
        className={s.takeMain}
        draggable
        onDragStart={(e) => { e.dataTransfer.setData('application/x-studiokapi-take', t.id); e.dataTransfer.effectAllowed = 'copy' }}
        title="Drag into the Song timeline to arrange"
      >
        <GripVertical size={14} className={s.takeGrip} />
        <button className={`${s.takePlay} ${playing ? s.takePlaying : ''}`} onClick={toggle} title={playing ? 'Pause' : 'Play'}>
          {playing ? <Pause size={13} fill="currentColor" /> : <Play size={13} fill="currentColor" />}
        </button>
        <div className={s.takeBody}>
          <div className={s.takeTitleRow}>
            {editing ? (
              <input className={s.renameInput} defaultValue={t.name} autoFocus
                onBlur={(e) => onRenameDone(e.target.value.trim() || t.name)}
                onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') onRenameDone(t.name) }} />
            ) : (
              <span className={s.takeName}>{t.name}</span>
            )}
            {t.cleaned && <span className={s.cleanBadge}><Check size={9} /> clean</span>}
            <span className={s.takeTime}>{clock(t.seconds ?? 0)}</span>
          </div>
          <div className={s.takeWave} onClick={seek}>
            {wave.map((v, i) => (
              <span key={i} className={i / BARS < progress ? s.waveDone : ''} style={{ height: `${v * 100}%` }} />
            ))}
          </div>
        </div>
        <button className={`${s.iconSq} ${open ? s.iconSqOn : ''}`} onClick={onToggleClean} title="Noise reduction">
          {busy ? <Loader2 size={13} className={s.spin} /> : <Wand2 size={13} />}
        </button>
        {menu}
        <audio
          ref={audio} src={t.url} preload="metadata"
          onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
          onEnded={() => { setPlaying(false); setProgress(0) }}
          onTimeUpdate={(e) => { const a = e.currentTarget; if (a.duration) setProgress(a.currentTime / a.duration) }}
        />
      </div>
      {children}
    </div>
  )
}

export default function MicRecorder(p: Props) {
  const [openId, setOpenId] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [reduction, setReduction] = useState(18)
  const [sensitivity, setSensitivity] = useState(0.6)
  const [elapsed, setElapsed] = useState(0)
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // recording timer
  useEffect(() => {
    if (!p.isRecording) { setElapsed(0); return }
    const t0 = Date.now()
    const id = setInterval(() => setElapsed((Date.now() - t0) / 1000), 250)
    return () => clearInterval(id)
  }, [p.isRecording])

  const download = (t: Take) => {
    const a = document.createElement('a'); a.href = t.url; a.download = `${t.name}.wav`; document.body.appendChild(a); a.click(); a.remove()
  }

  return (
    <div className={s.panelStack}>
      <div className={`${s.recHero} ${p.isRecording ? s.recLive : ''}`}>
        <div className={s.recHeroTop}>
          <div className={s.micArt}><VintageMic size={70} recording={p.isRecording} /></div>
          <div className={s.recHeroText}>
            <span className={s.recTitle}>{p.isRecording ? 'Recording' : 'Record your voice'}</span>
            <span className={s.recSub}>{p.permissionError || (p.isRecording ? 'Sing, hum, beatbox. Press stop when done.' : 'Hit Play first to record in time with the beat.')}</span>
            <div className={s.recActions}>
              <button className={`${s.recBtn} ${p.isRecording ? s.recBtnStop : ''}`} onClick={p.isRecording ? p.onStop : p.onStart}>
                {p.isRecording ? <Square size={12} fill="currentColor" /> : <Circle size={11} fill="currentColor" />}
                {p.isRecording ? 'Stop' : 'Record'}
              </button>
              <span className={s.recClock}>
                {p.isRecording && <span className={s.recDot} />}
                {clock(elapsed)}
              </span>
            </div>
          </div>
        </div>
        <div className={s.recWaveWrap}><RecWave active={p.isRecording} /></div>
      </div>

      <div
        className={`${s.dropZone} ${dragOver ? s.dropOver : ''}`}
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files.length) p.onImport(e.dataTransfer.files) }}
      >
        <Upload size={15} />
        <span><b>Import audio</b> · drop files here or click to browse</span>
        <input ref={fileRef} type="file" accept="audio/*" multiple style={{ display: 'none' }}
          onChange={(e) => { if (e.target.files?.length) p.onImport(e.target.files); e.target.value = '' }} />
      </div>

      <div className={s.cardHead} style={{ padding: '4px 2px 0' }}>
        <span className={s.cardTitle}>Takes</span>
        <span className={s.cardHint}>{p.takes.length ? 'drag a take into Song mode' : 'your recordings show up here'}</span>
      </div>
      {p.takes.length === 0 && <div className={s.takesEmpty}>No takes yet</div>}
      <div className={s.takeList}>
        {p.takes.map((t) => {
          const busy = p.cleaningId === t.id
          const open = openId === t.id
          return (
            <TakeCard
              key={t.id} t={t} busy={busy} open={open}
              onToggleClean={() => setOpenId(open ? null : t.id)}
              editing={editing === t.id}
              onRenameDone={(name) => { p.onRename(t.id, name); setEditing(null) }}
              menu={
                <Menu items={[
                  { label: 'Rename', icon: <Pencil size={12} />, onClick: () => setEditing(t.id) },
                  { label: 'Add as channel', icon: <FolderPlus size={12} />, onClick: () => p.onAdd(t) },
                  { label: 'Download', icon: <Download size={12} />, onClick: () => download(t) },
                  { label: 'Delete', icon: <Trash2 size={12} />, onClick: () => p.onDelete(t.id), danger: true },
                ]} />
              }
            >
              {open && (
                <div className={s.denoisePanel}>
                  <div className={s.denoiseTitle}>Noise reduction</div>
                  <div className={s.denoiseRow}>
                    <label>Reduction <b>{reduction} dB</b></label>
                    <input type="range" min={6} max={30} step={1} value={reduction} onChange={(e) => setReduction(Number(e.target.value))} />
                  </div>
                  <div className={s.denoiseRow}>
                    <label>Sensitivity <b>{Math.round(sensitivity * 100)}</b></label>
                    <input type="range" min={0} max={1} step={0.05} value={sensitivity} onChange={(e) => setSensitivity(Number(e.target.value))} />
                  </div>
                  <div className={s.denoiseBtns}>
                    <button className={`${s.smallBtn} ${s.primary}`} disabled={busy} onClick={() => p.onClean(t.id, reduction, sensitivity)}>
                      {busy ? 'Cleaning…' : t.cleaned ? 'Clean again' : 'Clean noise'}
                    </button>
                    {t.cleaned && <button className={s.smallBtn} onClick={() => p.onRevert(t.id)}><RotateCcw size={12} /> Revert</button>}
                  </div>
                  <div className={s.denoiseHint}>Learns the background hiss from the quiet parts, then removes it.</div>
                </div>
              )}
            </TakeCard>
          )
        })}
      </div>
    </div>
  )
}
