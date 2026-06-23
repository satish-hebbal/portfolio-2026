'use client'

import { useEffect, useRef, useState } from 'react'
import { Plus, MousePointer2, Scissors, Copy, Trash2, CheckSquare, XSquare, ZoomIn, ZoomOut, PanelLeft } from 'lucide-react'
import s from '../studioKapi.module.css'
import type { Clip, Pattern } from '../audio/types'
import type { Take } from './MicRecorder'

const LANE_H = 56
const RULER_H = 24
const SNAP = 4         // beat snap for moving/dropping

type Tool = 'select' | 'blade'
const uid = () => Math.random().toString(36).slice(2, 10)

function ClipWave({ peaks }: { peaks?: number[] }) {
  if (!peaks || !peaks.length) return null
  const n = peaks.length
  return (
    <svg className={s.clipWave} viewBox={`0 0 ${n} 100`} preserveAspectRatio="none" aria-hidden>
      {peaks.map((v, i) => {
        const h = Math.max(1.5, v * 92)
        return <rect key={i} x={i + 0.1} y={50 - h / 2} width={0.8} height={h} rx={0.3} fill="rgba(10,14,20,0.55)" />
      })}
    </svg>
  )
}

interface Props {
  patterns: Pattern[]
  takes: Take[]
  clips: Clip[]
  lanes: number
  bpm: number
  playhead: number
  onSeek: (step: number) => void
  onMoveClips: (updates: { id: string; start: number; lane: number }[]) => void
  onResizeClip: (id: string, length: number) => void
  onTrimClip: (id: string, start: number, offset: number, length: number) => void
  onSplitClip: (id: string, atStep: number) => void
  onDuplicateClip: (id: string) => void
  onAddClips: (clips: Clip[]) => void
  onAddPatternClip: (patternId: string, lane: number, start: number) => void
  onAddTakeClip: (takeId: string, lane: number, start: number) => void
  onImportFiles: (files: FileList, lane: number, start: number) => void
  onDeleteClips: (ids: string[]) => void
  onAddLane: () => void
}

export default function Arranger(p: Props) {
  const lanesRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ grabStep: number; startLane: number; orig: Record<string, { start: number; lane: number }> } | null>(null)
  const resize = useRef<{ id: string; startLen: number; grabStep: number; maxLen: number } | null>(null)
  const resizeL = useRef<{ id: string; startStep: number; startOffset: number; startLen: number; grabStep: number } | null>(null)
  const marquee = useRef<{ x0: number; y0: number } | null>(null)

  const [tool, setTool] = useState<Tool>('select')
  const [selected, setSelected] = useState<string[]>([])
  const [box, setBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  const [bladeX, setBladeX] = useState<number | null>(null)
  const [ctx, setCtx] = useState<{ x: number; y: number; clipId: string | null; atStep: number } | null>(null)
  const [px, setPx] = useState(12)
  const [paletteOpen, setPaletteOpen] = useState(true)
  const scrub = useRef(false)
  const zoom = (dir: number) => setPx((v) => Math.max(4, Math.min(48, Math.round(v + dir))))

  const songLen = Math.max(64, ...p.clips.map((c) => c.start + c.length)) + 16
  const width = songLen * px
  const usedMax = p.clips.reduce((m, c) => Math.max(m, c.lane), -1)
  const lanes = Math.max(p.lanes, usedMax + 2)
  const bars = Math.ceil(songLen / 16)
  const stepSec = 60 / p.bpm / 4

  const sourceSteps = (clip: Clip) => {
    const t = p.takes.find((x) => x.id === clip.refId)
    return t && t.seconds ? Math.max(1, Math.round(t.seconds / stepSec)) : Infinity
  }
  const rect = () => lanesRef.current?.getBoundingClientRect()
  const pxToStep = (clientX: number) => { const r = rect(); return r ? (clientX - r.left) / px : 0 }
  const localX = (clientX: number) => { const r = rect(); return r ? clientX - r.left : 0 }
  const localY = (clientY: number) => { const r = rect(); return r ? clientY - r.top : 0 }
  const laneAt = (clientY: number) => Math.max(0, Math.min(lanes - 1, Math.floor(localY(clientY) / LANE_H)))
  const snap = (v: number) => Math.max(0, Math.round(v / SNAP) * SNAP)

  // Ctrl/Cmd + wheel = zoom (native non-passive listener so preventDefault works)
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        setPx((v) => Math.max(4, Math.min(48, Math.round(v + (e.deltaY < 0 ? 2 : -2)))))
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  // close context menu on any outside interaction / escape
  useEffect(() => {
    if (!ctx) return
    const close = () => setCtx(null)
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setCtx(null) }
    window.addEventListener('pointerdown', close)
    window.addEventListener('keydown', onEsc)
    return () => { window.removeEventListener('pointerdown', close); window.removeEventListener('keydown', onEsc) }
  }, [ctx])

  // delete selected with keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT')) return
      if ((e.key === 'Delete' || e.key === 'Backspace') && selected.length) { e.preventDefault(); p.onDeleteClips(selected); setSelected([]) }
      else if (e.key === 'v' || e.key === 'V') setTool('select')
      else if (e.key === 'b' || e.key === 'B') setTool('blade')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selected, p])

  // ─── clip interactions ──────────────────────────────────────────────────────
  const onClipDown = (e: React.PointerEvent, clip: Clip) => {
    if (e.button !== 0) return
    e.preventDefault(); e.stopPropagation()
    if (tool === 'blade') { p.onSplitClip(clip.id, Math.round(pxToStep(e.clientX))); return }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)

    // Alt + drag = duplicate the grabbed clip(s) in place, then drag the copies
    if (e.altKey) {
      const group = selected.includes(clip.id) ? selected : [clip.id]
      const dup = p.clips.filter((c) => group.includes(c.id)).map((c) => ({ ...c, id: uid() }))
      p.onAddClips(dup)
      setSelected(dup.map((d) => d.id))
      const origAlt: Record<string, { start: number; lane: number }> = {}
      dup.forEach((d) => { origAlt[d.id] = { start: d.start, lane: d.lane } })
      drag.current = { grabStep: pxToStep(e.clientX), startLane: laneAt(e.clientY), orig: origAlt }
      return
    }

    let sel = selected
    if (e.shiftKey) { sel = selected.includes(clip.id) ? selected.filter((x) => x !== clip.id) : [...selected, clip.id] }
    else if (!selected.includes(clip.id)) { sel = [clip.id] }
    setSelected(sel)
    const group = sel.includes(clip.id) ? sel : [clip.id]
    const orig: Record<string, { start: number; lane: number }> = {}
    for (const c of p.clips) if (group.includes(c.id)) orig[c.id] = { start: c.start, lane: c.lane }
    drag.current = { grabStep: pxToStep(e.clientX), startLane: laneAt(e.clientY), orig }
  }

  const onClipMove = (e: React.PointerEvent) => {
    if (resize.current) {
      const r = resize.current
      p.onResizeClip(r.id, Math.max(SNAP, Math.min(r.maxLen, snap(r.startLen + (pxToStep(e.clientX) - r.grabStep)))))
      return
    }
    if (resizeL.current) {
      const r = resizeL.current
      let delta = Math.round((pxToStep(e.clientX) - r.grabStep) / SNAP) * SNAP
      delta = Math.max(-r.startOffset, Math.min(r.startLen - SNAP, delta))
      p.onTrimClip(r.id, r.startStep + delta, r.startOffset + delta, r.startLen - delta)
      return
    }
    if (!drag.current) return
    const d = drag.current
    // snap the movement (may be negative — clamp only the final start at 0)
    const delta = Math.round((pxToStep(e.clientX) - d.grabStep) / SNAP) * SNAP
    const laneDelta = laneAt(e.clientY) - d.startLane
    p.onMoveClips(Object.entries(d.orig).map(([id, o]) => ({ id, start: Math.max(0, o.start + delta), lane: Math.max(0, o.lane + laneDelta) })))
  }
  const onClipUp = () => { drag.current = null; resize.current = null; resizeL.current = null }

  const onResizeDown = (e: React.PointerEvent, clip: Clip) => {
    e.preventDefault(); e.stopPropagation()
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    resize.current = { id: clip.id, startLen: clip.length, grabStep: pxToStep(e.clientX), maxLen: clip.type === 'audio' ? sourceSteps(clip) - clip.offset : Infinity }
  }
  const onResizeLDown = (e: React.PointerEvent, clip: Clip) => {
    e.preventDefault(); e.stopPropagation()
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    resizeL.current = { id: clip.id, startStep: clip.start, startOffset: clip.offset, startLen: clip.length, grabStep: pxToStep(e.clientX) }
  }

  // ─── marquee selection (empty lane area) ─────────────────────────────────────
  const onLanesDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || tool !== 'select') return
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    marquee.current = { x0: localX(e.clientX), y0: localY(e.clientY) }
    if (!e.shiftKey) setSelected([])
    setBox({ x: marquee.current.x0, y: marquee.current.y0, w: 0, h: 0 })
  }
  const onLanesMove = (e: React.PointerEvent) => {
    if (tool === 'blade') setBladeX(Math.round(pxToStep(e.clientX)) * px)
    if (!marquee.current) return
    const x1 = localX(e.clientX), y1 = localY(e.clientY)
    const { x0, y0 } = marquee.current
    setBox({ x: Math.min(x0, x1), y: Math.min(y0, y1), w: Math.abs(x1 - x0), h: Math.abs(y1 - y0) })
  }
  const onLanesUp = () => {
    if (!marquee.current || !box) { marquee.current = null; setBox(null); return }
    const rx0 = box.x, rx1 = box.x + box.w, ry0 = box.y, ry1 = box.y + box.h
    const hits = p.clips.filter((c) => {
      const cl = c.start * px, cr = (c.start + c.length) * px, ct = c.lane * LANE_H, cb = ct + LANE_H
      return cl < rx1 && cr > rx0 && ct < ry1 && cb > ry0
    }).map((c) => c.id)
    setSelected((prev) => Array.from(new Set([...(box.w > 3 ? prev : []), ...hits])))
    marquee.current = null; setBox(null)
  }

  // ─── drop (palette items + OS files) ─────────────────────────────────────────
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const start = snap(pxToStep(e.clientX)); const lane = laneAt(e.clientY)
    if (e.dataTransfer.files?.length) { p.onImportFiles(e.dataTransfer.files, lane, start); return }
    const patId = e.dataTransfer.getData('application/x-studiokapi-pattern')
    const takeId = e.dataTransfer.getData('application/x-studiokapi-take')
    if (patId) p.onAddPatternClip(patId, lane, start)
    else if (takeId) p.onAddTakeClip(takeId, lane, start)
  }

  const openCtx = (e: React.MouseEvent, clipId: string | null) => {
    e.preventDefault(); e.stopPropagation()
    if (clipId && !selected.includes(clipId)) setSelected([clipId])
    setCtx({ x: e.clientX, y: e.clientY, clipId, atStep: Math.round(pxToStep(e.clientX)) })
  }

  const ctxItems = () => {
    if (!ctx) return []
    if (ctx.clipId) {
      const items = [
        { label: 'Split here', icon: <Scissors size={12} />, fn: () => p.onSplitClip(ctx.clipId!, ctx.atStep) },
        { label: 'Duplicate', icon: <Copy size={12} />, fn: () => p.onDuplicateClip(ctx.clipId!) },
        { label: 'Delete', icon: <Trash2 size={12} />, fn: () => { p.onDeleteClips([ctx.clipId!]); setSelected((s2) => s2.filter((x) => x !== ctx.clipId)) }, danger: true },
      ]
      if (selected.length > 1) items.push({ label: `Delete selected (${selected.length})`, icon: <Trash2 size={12} />, fn: () => { p.onDeleteClips(selected); setSelected([]) }, danger: true })
      return items
    }
    return [
      { label: 'Select all', icon: <CheckSquare size={12} />, fn: () => setSelected(p.clips.map((c) => c.id)) },
      { label: 'Clear selection', icon: <XSquare size={12} />, fn: () => setSelected([]) },
      { label: 'Add lane', icon: <Plus size={12} />, fn: () => p.onAddLane() },
    ]
  }

  return (
    <div className={s.arranger}>
      {/* palette */}
      <div className={`${s.arrPalette} ${paletteOpen ? '' : s.collapsed}`}>
        <div className={s.sectionLabel}>Patterns</div>
        {p.patterns.map((pat) => (
          <div key={pat.id} className={s.paletteChip} draggable
            onDragStart={(e) => { e.dataTransfer.setData('application/x-studiokapi-pattern', pat.id); e.dataTransfer.effectAllowed = 'copy' }}>
            {pat.name}
          </div>
        ))}
        <div className={s.sectionLabel} style={{ marginTop: 14 }}>Voice takes</div>
        {p.takes.length === 0 && <div className={s.paletteEmpty}>Record in the Record tab</div>}
        {p.takes.map((t) => (
          <div key={t.id} className={`${s.paletteChip} ${s.paletteTake}`} draggable
            onDragStart={(e) => { e.dataTransfer.setData('application/x-studiokapi-take', t.id); e.dataTransfer.effectAllowed = 'copy' }}>
            {t.name}
          </div>
        ))}
        <div className={s.paletteHint}>Drag onto a lane →</div>
      </div>

      {/* timeline */}
      <div className={s.arrTimeline} onContextMenu={(e) => e.preventDefault()}>
        <div className={s.arrToolbar}>
          <button className={`${s.toolBtn} ${s.paletteToggle} ${paletteOpen ? s.toolActive : ''}`} onClick={() => setPaletteOpen((o) => !o)} title="Show / hide patterns panel"><PanelLeft size={14} /></button>
          <button className={`${s.toolBtn} ${tool === 'select' ? s.toolActive : ''}`} onClick={() => setTool('select')} title="Select / move (V)"><MousePointer2 size={14} /></button>
          <button className={`${s.toolBtn} ${tool === 'blade' ? s.toolActive : ''}`} onClick={() => setTool('blade')} title="Blade — click a clip to cut (B)"><Scissors size={14} /></button>
          <span className={s.toolHint}>{tool === 'blade' ? 'Click a clip to cut it' : selected.length ? `${selected.length} selected · Del to remove` : 'Drag a box to select · right-click for options'}</span>
          <div className={s.zoomGroup}>
            <button className={s.toolBtn} onClick={() => zoom(-3)} title="Zoom out (Ctrl+scroll)"><ZoomOut size={14} /></button>
            <button className={s.toolBtn} onClick={() => zoom(3)} title="Zoom in (Ctrl+scroll)"><ZoomIn size={14} /></button>
          </div>
        </div>

        <div ref={scrollRef} className={s.arrScroll} onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
          <div className={s.arrInner} style={{ width }}>
            <div
              className={s.arrRuler} style={{ width, height: RULER_H }}
              onPointerDown={(e) => { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); scrub.current = true; p.onSeek(Math.max(0, Math.round(pxToStep(e.clientX)))) }}
              onPointerMove={(e) => { if (scrub.current) p.onSeek(Math.max(0, Math.round(pxToStep(e.clientX)))) }}
              onPointerUp={() => { scrub.current = false }}
            >
              {Array.from({ length: bars }).map((_, b) => (
                <div key={b} className={s.arrBar} style={{ left: b * 16 * px, width: 16 * px }}>{b + 1}</div>
              ))}
              <div className={s.arrPlayheadHandle} style={{ left: p.playhead * px }} />
            </div>
            <div
              ref={lanesRef}
              className={`${s.arrLanes} ${tool === 'blade' ? s.bladeMode : ''}`}
              style={{ width, height: lanes * LANE_H }}
              onPointerDown={onLanesDown}
              onPointerMove={onLanesMove}
              onPointerUp={onLanesUp}
              onPointerLeave={() => setBladeX(null)}
              onContextMenu={(e) => openCtx(e, null)}
            >
              {Array.from({ length: lanes }).map((_, l) => (
                <div key={l} className={s.arrLane} style={{ top: l * LANE_H, height: LANE_H, width }} />
              ))}
              {Array.from({ length: bars }).map((_, b) => (
                <div key={b} className={s.arrGridline} style={{ left: b * 16 * px, height: lanes * LANE_H }} />
              ))}
              <div className={s.arrPlayhead} style={{ left: p.playhead * px, height: lanes * LANE_H }} />
              {box && <div className={s.marquee} style={{ left: box.x, top: box.y, width: box.w, height: box.h }} />}
              {tool === 'blade' && bladeX != null && (
                <div className={s.bladeGuide} style={{ left: bladeX, height: lanes * LANE_H }}><Scissors size={12} className={s.bladeGuideIcon} /></div>
              )}

              {p.clips.map((clip) => {
                let wavePeaks: number[] | undefined
                if (clip.type === 'audio') {
                  const peaks = p.takes.find((t) => t.id === clip.refId)?.peaks
                  if (peaks && peaks.length) {
                    const src = sourceSteps(clip)
                    const a = Math.floor((clip.offset / src) * peaks.length)
                    const b2 = Math.ceil(((clip.offset + clip.length) / src) * peaks.length)
                    wavePeaks = peaks.slice(Math.max(0, a), Math.min(peaks.length, b2))
                  }
                }
                const isSel = selected.includes(clip.id)
                return (
                  <div
                    key={clip.id}
                    className={`${s.clip} ${clip.type === 'audio' ? s.clipAudio : ''} ${isSel ? s.clipSelected : ''} ${tool === 'blade' ? s.clipBlade : ''}`}
                    style={{ left: clip.start * px, top: clip.lane * LANE_H + 4, width: clip.length * px - 2, height: LANE_H - 8, background: clip.color }}
                    onPointerDown={(e) => onClipDown(e, clip)}
                    onPointerMove={onClipMove}
                    onPointerUp={onClipUp}
                    onContextMenu={(e) => openCtx(e, clip.id)}
                  >
                    {clip.type === 'audio' && <ClipWave peaks={wavePeaks} />}
                    <span className={s.clipName}>{clip.name}</span>
                    {clip.type === 'audio' && <span className={`${s.clipResize} ${s.clipResizeL}`} onPointerDown={(e) => onResizeLDown(e, clip)} onPointerMove={onClipMove} onPointerUp={onClipUp} />}
                    <span className={s.clipResize} onPointerDown={(e) => onResizeDown(e, clip)} onPointerMove={onClipMove} onPointerUp={onClipUp} />
                  </div>
                )
              })}
            </div>
          </div>
        </div>
        <button className={s.addLane} onClick={p.onAddLane}><Plus size={13} /> Add lane</button>
      </div>

      {ctx && (
        <div className={s.menuPop} style={{ position: 'fixed', left: ctx.x, top: ctx.y, right: 'auto', zIndex: 200 }} onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()} onContextMenu={(e) => e.preventDefault()}>
          {ctxItems().map((it, i) => (
            <button key={i} className={`${s.menuItem} ${it.danger ? s.menuDanger : ''}`} onClick={() => { setCtx(null); it.fn() }}>
              <span className={s.menuIcon}>{it.icon}</span>{it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
