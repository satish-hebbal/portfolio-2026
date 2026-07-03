'use client'

import { useEffect, useRef, useState } from 'react'
import {
  Plus, MousePointer2, Scissors, Copy, Trash2, CheckSquare, XSquare,
  ZoomIn, ZoomOut, Maximize2, PanelLeft, Grid2x2, AudioWaveform, Gauge, VolumeX,
  SlidersHorizontal, ChevronLeft, ChevronRight,
} from 'lucide-react'
import s from '../studioKapi.module.css'
import type { Clip, Pattern, LaneMeta } from '../audio/types'
import type { Take } from './MicRecorder'

const LANE_H = 56
const RULER_H = 24
const HEAD_W = 172       // lane-header (mixer) column width
const SNAP = 4           // beat snap for moving/dropping
const MINPX = 1
const MAXPX = 48

type Tool = 'select' | 'blade'
const uid = () => Math.random().toString(36).slice(2, 10)
const clampPx = (v: number) => Math.max(MINPX, Math.min(MAXPX, v))
const gainToDbNum = (g: number) => (g <= 0.0001 ? -60 : 20 * Math.log10(g))
const dbToGain = (db: number) => (db <= -60 ? 0 : Math.min(1.5, Math.pow(10, db / 20)))
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

// Filled, mirrored waveform (looks like a real audio envelope, not bars).
function ClipWave({ peaks }: { peaks?: number[] }) {
  if (!peaks || !peaks.length) return null
  const n = peaks.length
  const w = Math.max(1, n - 1)
  let d = 'M0,50'
  for (let i = 0; i < n; i++) { const h = Math.max(0.6, peaks[i] * 46); d += ` L${i},${(50 - h).toFixed(1)}` }
  for (let i = n - 1; i >= 0; i--) { const h = Math.max(0.6, peaks[i] * 46); d += ` L${i},${(50 + h).toFixed(1)}` }
  d += ' Z'
  return (
    <svg className={s.clipWave} viewBox={`0 0 ${w} 100`} preserveAspectRatio="none" aria-hidden>
      <path d={d} fill="rgba(10,14,20,0.5)" />
      <line x1={0} y1={50} x2={w} y2={50} stroke="rgba(10,14,20,0.28)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

interface Props {
  patterns: Pattern[]
  takes: Take[]
  clips: Clip[]
  lanes: number
  laneMeta?: LaneMeta[]
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
  onClipGain: (id: string, gain: number) => void
  onClipMute: (id: string) => void
  onClipFade: (id: string, side: 'in' | 'out', steps: number) => void
  onClipRate: (id: string, rate: number) => void
  onLaneField: <K extends keyof LaneMeta>(lane: number, key: K, value: LaneMeta[K]) => void
  onLaneMute: (lane: number) => void
  onLaneSolo: (lane: number) => void
}

export default function Arranger(p: Props) {
  const lanesRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const laneInnerRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ grabStep: number; startLane: number; orig: Record<string, { start: number; lane: number }> } | null>(null)
  const resize = useRef<{ id: string; startLen: number; grabStep: number; maxLen: number } | null>(null)
  const resizeL = useRef<{ id: string; startStep: number; startOffset: number; startLen: number; grabStep: number } | null>(null)
  const fade = useRef<{ id: string; side: 'in' | 'out'; start: number; len: number } | null>(null)
  const marquee = useRef<{ x0: number; y0: number } | null>(null)

  const [tool, setTool] = useState<Tool>('select')
  const [selected, setSelected] = useState<string[]>([])
  const [box, setBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  const [bladeX, setBladeX] = useState<number | null>(null)
  const [ctx, setCtx] = useState<{ x: number; y: number; clipId: string | null; atStep: number } | null>(null)
  const [inspect, setInspect] = useState<{ id: string; x: number; y: number } | null>(null)
  const [editingLane, setEditingLane] = useState<number | null>(null)
  const [px, setPx] = useState(12)
  const [paletteOpen, setPaletteOpen] = useState(true)
  const [headsOpen, setHeadsOpen] = useState(true)
  const scrub = useRef(false)
  const zoom = (dir: number) => setPx((v) => clampPx(Math.round(v + dir)))

  const songLen = Math.max(64, ...p.clips.map((c) => c.start + c.length)) + 16
  const width = songLen * px
  const usedMax = p.clips.reduce((m, c) => Math.max(m, c.lane), -1)
  const lanes = Math.max(p.lanes, usedMax + 2)
  const bars = Math.ceil(songLen / 16)
  const stepSec = 60 / p.bpm / 4
  const anySolo = (p.laneMeta ?? []).some((m) => m?.solo)

  const laneName = (l: number) => p.laneMeta?.[l]?.name || p.clips.find((c) => c.lane === l)?.name || `Track ${l + 1}`
  const laneVol = (l: number) => p.laneMeta?.[l]?.volume ?? 0.9

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

  const fitToWindow = () => {
    const w = scrollRef.current?.clientWidth ?? 800
    setPx(Math.max(0.5, Math.min(MAXPX, (w - 8) / songLen)))
  }

  // keep the lane-header column vertically aligned with the scrolling lanes
  const syncHeadScroll = () => {
    const st = scrollRef.current?.scrollTop ?? 0
    if (laneInnerRef.current) laneInnerRef.current.style.transform = `translateY(${-st}px)`
  }

  // Ctrl/Cmd + wheel = zoom (native non-passive listener so preventDefault works)
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        setPx((v) => clampPx(Math.round(v + (e.deltaY < 0 ? 2 : -2))))
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  // close context menu / inspector on any outside interaction / escape
  useEffect(() => {
    if (!ctx && !inspect) return
    const close = () => { setCtx(null); setInspect(null) }
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('pointerdown', close)
    window.addEventListener('keydown', onEsc)
    return () => { window.removeEventListener('pointerdown', close); window.removeEventListener('keydown', onEsc) }
  }, [ctx, inspect])

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
    if (fade.current) {
      const f = fade.current
      const pos = pxToStep(e.clientX)
      if (f.side === 'in') p.onClipFade(f.id, 'in', Math.max(0, Math.min(f.len, Math.round(pos - f.start))))
      else p.onClipFade(f.id, 'out', Math.max(0, Math.min(f.len, Math.round(f.start + f.len - pos))))
      return
    }
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
  const onClipUp = () => { drag.current = null; resize.current = null; resizeL.current = null; fade.current = null }

  const onResizeDown = (e: React.PointerEvent, clip: Clip) => {
    e.preventDefault(); e.stopPropagation()
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    resize.current = { id: clip.id, startLen: clip.length, grabStep: pxToStep(e.clientX), maxLen: clip.type === 'audio' ? (sourceSteps(clip) - clip.offset) / (clip.rate ?? 1) : Infinity }
  }
  const onResizeLDown = (e: React.PointerEvent, clip: Clip) => {
    e.preventDefault(); e.stopPropagation()
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    resizeL.current = { id: clip.id, startStep: clip.start, startOffset: clip.offset, startLen: clip.length, grabStep: pxToStep(e.clientX) }
  }
  const onFadeDown = (e: React.PointerEvent, clip: Clip, side: 'in' | 'out') => {
    e.preventDefault(); e.stopPropagation()
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    fade.current = { id: clip.id, side, start: clip.start, len: clip.length }
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
      const clip = p.clips.find((c) => c.id === ctx.clipId)
      const items = [
        { label: 'Clip settings…', icon: <SlidersMini />, fn: () => setInspect({ id: ctx.clipId!, x: ctx.x, y: ctx.y }) },
        { label: clip?.mute ? 'Unmute clip' : 'Mute clip', icon: <VolumeX size={12} />, fn: () => p.onClipMute(ctx.clipId!) },
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

  const inspClip = inspect ? p.clips.find((c) => c.id === inspect.id) : null

  return (
    <div className={s.arranger}>
      {/* palette */}
      <div className={`${s.arrPalette} ${paletteOpen ? '' : s.collapsed}`}>
        <div className={s.sectionLabel}>Patterns</div>
        {p.patterns.map((pat) => (
          <div key={pat.id} className={s.paletteChip} draggable
            onDragStart={(e) => { e.dataTransfer.setData('application/x-studiokapi-pattern', pat.id); e.dataTransfer.effectAllowed = 'copy' }}>
            <Grid2x2 size={14} className={s.paletteIcon} />
            <span className={s.paletteChipName}>{pat.name}</span>
          </div>
        ))}
        <div className={s.sectionLabel} style={{ marginTop: 14 }}>Voice takes</div>
        {p.takes.length === 0 && <div className={s.paletteEmpty}>Record in the Record tab</div>}
        {p.takes.map((t) => (
          <div key={t.id} className={`${s.paletteChip} ${s.paletteTake}`} draggable
            onDragStart={(e) => { e.dataTransfer.setData('application/x-studiokapi-take', t.id); e.dataTransfer.effectAllowed = 'copy' }}>
            <AudioWaveform size={14} className={`${s.paletteIcon} ${s.paletteIconTake}`} />
            <span className={s.paletteChipName}>{t.name}</span>
          </div>
        ))}
        <div className={s.paletteHint}>Drag onto a lane →</div>
      </div>

      {/* timeline */}
      <div className={s.arrTimeline} onContextMenu={(e) => e.preventDefault()}>
        <div className={s.arrToolbar}>
          <button className={`${s.toolBtn} ${s.paletteToggle} ${paletteOpen ? s.toolOn : ''}`} onClick={() => setPaletteOpen((o) => !o)} title="Show / hide patterns panel"><PanelLeft size={14} /></button>
          <button className={`${s.toolBtn} ${headsOpen ? s.toolOn : ''}`} onClick={() => setHeadsOpen((o) => !o)} title="Show / hide track mixer"><SlidersHorizontal size={14} /></button>
          <button className={`${s.toolBtn} ${tool === 'select' ? s.toolActive : ''}`} onClick={() => setTool('select')} title="Select / move (V)"><MousePointer2 size={14} /></button>
          <button className={`${s.toolBtn} ${tool === 'blade' ? s.toolActive : ''}`} onClick={() => setTool('blade')} title="Blade tool · click a clip to cut (B)"><Scissors size={14} /></button>
          <span className={s.toolHint}>{tool === 'blade' ? 'Click a clip to cut it' : selected.length ? `${selected.length} selected · Del · double-click for settings` : 'Drag to select · double-click a clip for volume & speed'}</span>
          <div className={s.zoomGroup}>
            <button className={s.toolBtn} onClick={fitToWindow} title="Fit whole song to window"><Maximize2 size={14} /></button>
            <button className={s.toolBtn} onClick={() => zoom(-3)} title="Zoom out (Ctrl+scroll)"><ZoomOut size={14} /></button>
            <button className={s.toolBtn} onClick={() => zoom(3)} title="Zoom in (Ctrl+scroll)"><ZoomIn size={14} /></button>
          </div>
        </div>

        <div className={s.arrMain}>
          {/* collapsed: a slim tab to reopen the mixer */}
          {!headsOpen && (
            <button className={s.headsReopen} onClick={() => setHeadsOpen(true)} title="Show track mixer">
              <ChevronRight size={13} />
            </button>
          )}
          {/* lane mixer headers */}
          {headsOpen && (
          <div className={s.laneHeads} style={{ width: HEAD_W }}>
            <button className={s.laneHeadCorner} style={{ height: RULER_H }} onClick={() => setHeadsOpen(false)} title="Collapse track mixer">
              Tracks <ChevronLeft size={12} />
            </button>
            <div className={s.laneHeadsClip}>
              <div ref={laneInnerRef} className={s.laneHeadsInner}>
                {Array.from({ length: lanes }).map((_, l) => {
                  const meta = p.laneMeta?.[l]
                  const muted = !!meta?.mute || (anySolo && !meta?.solo)
                  return (
                    <div key={l} className={`${s.laneHead} ${muted ? s.laneMuted : ''}`} style={{ height: LANE_H }}>
                      <div className={s.laneHeadTop}>
                        {editingLane === l ? (
                          <input className={s.renameInput} defaultValue={laneName(l)} autoFocus
                            onBlur={(e) => { p.onLaneField(l, 'name', e.target.value.trim() || laneName(l)); setEditingLane(null) }}
                            onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEditingLane(null) }} />
                        ) : (
                          <span className={s.laneHeadName} onDoubleClick={() => setEditingLane(l)} title="Double-click to rename">{laneName(l)}</span>
                        )}
                        <div className={s.laneHeadBtns}>
                          <button className={`${s.laneMs} ${meta?.mute ? s.laneMOn : ''}`} onClick={() => p.onLaneMute(l)} title="Mute lane">M</button>
                          <button className={`${s.laneMs} ${meta?.solo ? s.laneSOn : ''}`} onClick={() => p.onLaneSolo(l)} title="Solo lane">S</button>
                        </div>
                      </div>
                      <input className={s.laneVol} type="range" min={0} max={1} step={0.01} value={laneVol(l)}
                        onChange={(e) => p.onLaneField(l, 'volume', Number(e.target.value))} title="Lane volume" />
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
          )}

          <div ref={scrollRef} className={s.arrScroll} onScroll={syncHeadScroll} onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
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
                {(() => {
                  const gridStep = px >= 7 ? SNAP : 16 // show beats when zoomed in, bars only when far out
                  const count = Math.ceil(songLen / gridStep) + 1
                  return Array.from({ length: count }).map((_, i) => {
                    const step = i * gridStep
                    const isBar = step % 16 === 0
                    return <div key={i} className={`${s.arrGridline} ${isBar ? s.arrGridlineBar : ''}`} style={{ left: step * px, height: lanes * LANE_H }} />
                  })
                })()}
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
                      const rate = clip.rate ?? 1
                      const a = Math.floor((clip.offset / src) * peaks.length)
                      const b2 = Math.ceil(((clip.offset + clip.length * rate) / src) * peaks.length)
                      wavePeaks = peaks.slice(Math.max(0, a), Math.min(peaks.length, b2))
                    }
                  }
                  const isSel = selected.includes(clip.id)
                  const cw = Math.max(2, clip.length * px - 2)
                  const ch = LANE_H - 8
                  const isAudio = clip.type === 'audio'
                  const fInPx = (clip.fadeIn ?? 0) * px
                  const fOutPx = (clip.fadeOut ?? 0) * px
                  const showHandles = isAudio && isSel && px >= 3
                  return (
                    <div
                      key={clip.id}
                      className={`${s.clip} ${isAudio ? s.clipAudio : ''} ${isSel ? s.clipSelected : ''} ${clip.mute ? s.clipMuted : ''} ${tool === 'blade' ? s.clipBlade : ''}`}
                      style={{ left: clip.start * px, top: clip.lane * LANE_H + 4, width: cw, height: ch, background: clip.color }}
                      onPointerDown={(e) => onClipDown(e, clip)}
                      onPointerMove={onClipMove}
                      onPointerUp={onClipUp}
                      onDoubleClick={(e) => { e.stopPropagation(); setInspect({ id: clip.id, x: e.clientX, y: e.clientY }) }}
                      onContextMenu={(e) => openCtx(e, clip.id)}
                    >
                      {isAudio && <ClipWave peaks={wavePeaks} />}
                      {isAudio && (fInPx > 0 || fOutPx > 0) && (
                        <svg className={s.fadeSvg} width={cw} height={ch} aria-hidden>
                          {fInPx > 0 && <polygon points={`0,0 ${Math.min(fInPx, cw)},0 0,${ch}`} className={s.fadeShade} />}
                          {fOutPx > 0 && <polygon points={`${cw},0 ${Math.max(0, cw - fOutPx)},0 ${cw},${ch}`} className={s.fadeShade} />}
                        </svg>
                      )}
                      <span className={s.clipName}>{clip.mute && <VolumeX size={10} className={s.clipMuteIcon} />}{clip.name}{clip.rate && clip.rate !== 1 ? ` · ${Math.round(clip.rate * 100)}%` : ''}</span>
                      {isAudio && <span className={`${s.clipResize} ${s.clipResizeL}`} onPointerDown={(e) => onResizeLDown(e, clip)} onPointerMove={onClipMove} onPointerUp={onClipUp} />}
                      <span className={s.clipResize} onPointerDown={(e) => onResizeDown(e, clip)} onPointerMove={onClipMove} onPointerUp={onClipUp} />
                      {showHandles && (
                        <>
                          <span className={s.fadeHandle} style={{ left: Math.min(fInPx, cw - 4) }} onPointerDown={(e) => onFadeDown(e, clip, 'in')} onPointerMove={onClipMove} onPointerUp={onClipUp} title="Fade in" />
                          <span className={`${s.fadeHandle} ${s.fadeHandleR}`} style={{ left: Math.max(4, cw - fOutPx) - 8 }} onPointerDown={(e) => onFadeDown(e, clip, 'out')} onPointerMove={onClipMove} onPointerUp={onClipUp} title="Fade out" />
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
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

      {inspect && inspClip && (
        <div className={s.clipInspect}
          style={{ position: 'fixed', left: Math.min(inspect.x, (typeof window !== 'undefined' ? window.innerWidth : 1200) - 268), top: Math.min(inspect.y, (typeof window !== 'undefined' ? window.innerHeight : 800) - 250) }}
          onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()} onContextMenu={(e) => e.preventDefault()}>
          <div className={s.inspTitle}><AudioWaveform size={12} /> {inspClip.name}</div>

          <div className={s.inspRow}>
            <label>Volume
              <span className={s.inspField}>
                <input className={s.inspNum} type="number" min={-60} max={3.5} step={0.5}
                  value={Number(gainToDbNum(inspClip.gain ?? 1).toFixed(1))}
                  onChange={(e) => { const v = parseFloat(e.target.value); if (Number.isFinite(v)) p.onClipGain(inspClip.id, dbToGain(clamp(v, -60, 3.5))) }} />
                <em>dB</em>
              </span>
            </label>
            <input type="range" min={0} max={1.5} step={0.01} value={inspClip.gain ?? 1} onChange={(e) => p.onClipGain(inspClip.id, Number(e.target.value))} />
          </div>

          {inspClip.type === 'audio' && (
            <div className={s.inspRow}>
              <label><Gauge size={11} /> Speed
                <span className={s.inspField}>
                  <input className={s.inspNum} type="number" min={25} max={400} step={1}
                    value={Math.round((inspClip.rate ?? 1) * 100)}
                    onChange={(e) => { const v = parseFloat(e.target.value); if (Number.isFinite(v)) p.onClipRate(inspClip.id, clamp(v, 25, 400) / 100) }} />
                  <em>%</em>
                </span>
              </label>
              <input type="range" min={0.5} max={2} step={0.01} value={inspClip.rate ?? 1} onChange={(e) => p.onClipRate(inspClip.id, Number(e.target.value))} />
              <div className={s.inspHelp}>~{Math.round(p.bpm * (inspClip.rate ?? 1))} BPM feel</div>
              <div className={s.inspMini}>
                <button onClick={() => p.onClipRate(inspClip.id, 1)}>Reset</button>
                <button onClick={() => p.onClipRate(inspClip.id, (inspClip.rate ?? 1) * 2)}>×2</button>
                <button onClick={() => p.onClipRate(inspClip.id, (inspClip.rate ?? 1) / 2)}>÷2</button>
              </div>
            </div>
          )}

          {inspClip.type === 'audio' && (
            <div className={s.inspRow2}>
              <div className={s.inspHalf}>
                <label>Fade in
                  <span className={s.inspField}>
                    <input className={s.inspNum} type="number" min={0} max={(inspClip.length * stepSec).toFixed(2)} step={0.05}
                      value={Number(((inspClip.fadeIn ?? 0) * stepSec).toFixed(2))}
                      onChange={(e) => { const v = parseFloat(e.target.value); if (Number.isFinite(v)) p.onClipFade(inspClip.id, 'in', clamp(Math.round(v / stepSec), 0, inspClip.length)) }} />
                    <em>s</em>
                  </span>
                </label>
                <input type="range" min={0} max={Math.max(8, Math.round(inspClip.length / 2))} step={1} value={inspClip.fadeIn ?? 0} onChange={(e) => p.onClipFade(inspClip.id, 'in', Number(e.target.value))} />
              </div>
              <div className={s.inspHalf}>
                <label>Fade out
                  <span className={s.inspField}>
                    <input className={s.inspNum} type="number" min={0} max={(inspClip.length * stepSec).toFixed(2)} step={0.05}
                      value={Number(((inspClip.fadeOut ?? 0) * stepSec).toFixed(2))}
                      onChange={(e) => { const v = parseFloat(e.target.value); if (Number.isFinite(v)) p.onClipFade(inspClip.id, 'out', clamp(Math.round(v / stepSec), 0, inspClip.length)) }} />
                    <em>s</em>
                  </span>
                </label>
                <input type="range" min={0} max={Math.max(8, Math.round(inspClip.length / 2))} step={1} value={inspClip.fadeOut ?? 0} onChange={(e) => p.onClipFade(inspClip.id, 'out', Number(e.target.value))} />
              </div>
            </div>
          )}

          <div className={s.inspBtns}>
            <button className={`${s.smallBtn} ${inspClip.mute ? s.primary : ''}`} onClick={() => p.onClipMute(inspClip.id)}><VolumeX size={12} /> {inspClip.mute ? 'Muted' : 'Mute'}</button>
            <button className={s.smallBtn} onClick={() => p.onDuplicateClip(inspClip.id)}><Copy size={12} /> Duplicate</button>
            <button className={`${s.smallBtn} ${s.inspDanger}`} onClick={() => { p.onDeleteClips([inspClip.id]); setInspect(null) }}><Trash2 size={12} /></button>
          </div>
        </div>
      )}
    </div>
  )
}

function SlidersMini() {
  return <Gauge size={12} />
}
