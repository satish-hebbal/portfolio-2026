'use client'

import { useRef, useState } from 'react'
import { Trash2, GripVertical, Wand2, RotateCcw, Loader2, Check, Pencil, Download, Upload, FolderPlus, Circle, Square } from 'lucide-react'
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

export default function MicRecorder(p: Props) {
  const [openId, setOpenId] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [reduction, setReduction] = useState(18)
  const [sensitivity, setSensitivity] = useState(0.6)
  const fileRef = useRef<HTMLInputElement>(null)

  const download = (t: Take) => {
    const a = document.createElement('a'); a.href = t.url; a.download = `${t.name}.wav`; document.body.appendChild(a); a.click(); a.remove()
  }

  return (
    <div className={s.recPanel}>
      <div className={s.recBig}>
        <div className={s.recGlow} />
        <div className={s.micArt}><VintageMic recording={p.isRecording} /></div>
        <div className={s.recHead}>
          <div className={s.recTitle}>{p.isRecording ? 'Recording…' : 'Record your voice'}</div>
          <div className={s.recSub}>{p.permissionError || 'Press Play first to record in time, then layer or clean takes.'}</div>
        </div>
        <button
          className={`${s.recBtn} ${p.isRecording ? s.recBtnStop : ''}`}
          onClick={p.isRecording ? p.onStop : p.onStart}
        >
          {p.isRecording ? <Square size={14} fill="currentColor" /> : <Circle size={13} fill="currentColor" />}
          {p.isRecording ? 'Stop' : 'Record'}
        </button>
        <div className={s.recWaveWrap}><RecWave active={p.isRecording} /></div>
      </div>

      <div className={s.recImportRow}>
        <button className={s.smallBtn} onClick={() => fileRef.current?.click()}><Upload size={13} /> Import audio</button>
        <input ref={fileRef} type="file" accept="audio/*" multiple style={{ display: 'none' }}
          onChange={(e) => { if (e.target.files?.length) p.onImport(e.target.files); e.target.value = '' }} />
        <span className={s.recImportHint}>or drag files onto the Song timeline</span>
      </div>

      <div className={s.takeList}>
        {p.takes.length === 0 && <div className={s.empty} style={{ marginTop: 10 }}>No takes yet.</div>}
        {p.takes.map((t) => {
          const busy = p.cleaningId === t.id
          return (
            <div key={t.id} className={s.takeWrap}>
              <div
                className={s.take}
                draggable
                onDragStart={(e) => { e.dataTransfer.setData('application/x-studiokapi-take', t.id); e.dataTransfer.effectAllowed = 'copy' }}
                title="Drag into the Song timeline to arrange"
              >
                <GripVertical size={14} style={{ color: 'var(--dim)', cursor: 'grab', flexShrink: 0 }} />
                {editing === t.id ? (
                  <input className={s.renameInput} defaultValue={t.name} autoFocus
                    onClick={(e) => e.stopPropagation()}
                    onBlur={(e) => { p.onRename(t.id, e.target.value.trim() || t.name); setEditing(null) }}
                    onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEditing(null) }} />
                ) : (
                  <span className={s.takeName}>
                    {t.name}
                    {t.cleaned && <span className={s.cleanBadge}><Check size={9} /> clean</span>}
                  </span>
                )}
                <audio className={s.takeAudio} src={t.url} controls />
                <button className={`${s.smallBtn} ${openId === t.id ? s.smallActive : ''}`} onClick={() => setOpenId(openId === t.id ? null : t.id)} title="Noise reduction">
                  {busy ? <Loader2 size={13} className={s.spin} /> : <Wand2 size={13} />}
                </button>
                <Menu
                  items={[
                    { label: 'Rename', icon: <Pencil size={12} />, onClick: () => setEditing(t.id) },
                    { label: 'Add as channel', icon: <FolderPlus size={12} />, onClick: () => p.onAdd(t) },
                    { label: 'Download', icon: <Download size={12} />, onClick: () => download(t) },
                    { label: 'Delete', icon: <Trash2 size={12} />, onClick: () => p.onDelete(t.id), danger: true },
                  ]}
                />
              </div>

              {openId === t.id && (
                <div className={s.denoisePanel}>
                  <div className={s.denoiseTitle}>Noise Reduction · spectral gating</div>
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
                      {busy ? 'Cleaning…' : t.cleaned ? 'Re-clean' : 'Clean noise'}
                    </button>
                    {t.cleaned && <button className={s.smallBtn} onClick={() => p.onRevert(t.id)}><RotateCcw size={12} /> Revert</button>}
                  </div>
                  <div className={s.denoiseHint}>Estimates the noise floor from the quietest parts, then gates it out per frequency.</div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
