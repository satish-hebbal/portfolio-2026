'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import s from '../studioKapi.module.css'
import type { Track, RollNote } from '../audio/types'

interface Props {
  track: Track | null
  notes: RollNote[]
  steps: number
  currentStep: number
  onChange: (notes: RollNote[]) => void
  onPreview: (note: string) => void
}

const SEMITONES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const PITCHES: string[] = []
for (const oct of [6, 5, 4, 3, 2]) {
  for (let i = 11; i >= 0; i--) PITCHES.push(`${SEMITONES[i]}${oct}`)
}
const PITCH_INDEX = new Map(PITCHES.map((p, i) => [p, i]))
const isBlack = (n: string) => n.includes('#')

const ROW_H = 21
const COL_W = 28
const KEY_W = 50
const RESIZE_EDGE = 7
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
const uid = () => Math.random().toString(36).slice(2, 10)

type Mode = 'move' | 'resize' | 'marquee' | 'place'
interface Gesture {
  mode: Mode
  ids: string[]            // notes being moved/resized
  orig: RollNote[]         // snapshot of those notes at gesture start
  grabId?: string          // the note clicked (for click-to-remove)
  additive?: boolean       // shift-click: keep selection toggle, never remove on click
  startStep: number
  startPitch: number
  dStep: number
  dPitch: number
  dLen: number
  curStep: number          // marquee live corner
  curPitch: number
  moved: boolean
}

export default function PianoRoll(p: Props) {
  const { notes, steps, onChange, onPreview } = p
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [drag, setDrag] = useState<Gesture | null>(null)
  const dragRef = useRef<Gesture | null>(null)
  const surfaceRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const notesRef = useRef(notes)
  notesRef.current = notes
  const selRef = useRef(sel)
  selRef.current = sel

  // keep selection valid if notes change underneath us (undo, track switch)
  useEffect(() => {
    setSel((prev) => {
      const live = new Set(notes.map((n) => n.id))
      const next = new Set([...prev].filter((id) => live.has(id)))
      return next.size === prev.size ? prev : next
    })
  }, [notes])

  // center the view around C4 on first mount
  useEffect(() => {
    const wrap = scrollRef.current
    if (!wrap) return
    const c4 = PITCH_INDEX.get('C4') ?? 0
    wrap.scrollTop = c4 * ROW_H - wrap.clientHeight / 2 + ROW_H
  }, [])

  const isInstrument = !!p.track && p.track.kind === 'instrument'

  const cellFrom = useCallback((clientX: number, clientY: number) => {
    const rect = surfaceRef.current!.getBoundingClientRect()
    const step = clamp(Math.floor((clientX - rect.left) / COL_W), 0, steps - 1)
    const pitch = clamp(Math.floor((clientY - rect.top) / ROW_H), 0, PITCHES.length - 1)
    return { step, pitch }
  }, [steps])

  // note occupying a given cell (accounts for note length)
  const noteAtCell = useCallback((step: number, pitchIdx: number): RollNote | undefined => {
    const pitch = PITCHES[pitchIdx]
    return notesRef.current.find((n) => n.note === pitch && step >= n.step && step < n.step + n.length)
  }, [])

  const commit = useCallback((g: Gesture) => {
    if (g.mode === 'move') {
      // clamp the delta so the whole selection stays in-bounds (keeps shape)
      let ds = g.dStep, dp = g.dPitch
      let minStep = Infinity, maxEnd = -Infinity, minP = Infinity, maxP = -Infinity
      for (const n of g.orig) {
        const idx = PITCH_INDEX.get(n.note); if (idx === undefined) continue
        minStep = Math.min(minStep, n.step); maxEnd = Math.max(maxEnd, n.step + n.length)
        minP = Math.min(minP, idx); maxP = Math.max(maxP, idx)
      }
      ds = clamp(ds, -minStep, steps - maxEnd)
      dp = clamp(dp, -minP, PITCHES.length - 1 - maxP)
      if (ds === 0 && dp === 0) return
      const moved = new Map(g.orig.map((n) => {
        const idx = (PITCH_INDEX.get(n.note) ?? 0) + dp
        return [n.id, { ...n, step: n.step + ds, note: PITCHES[idx] }]
      }))
      onChange(notesRef.current.map((n) => moved.get(n.id) ?? n))
    } else if (g.mode === 'resize') {
      if (g.dLen === 0) return
      const ids = new Set(g.ids)
      onChange(notesRef.current.map((n) =>
        ids.has(n.id) ? { ...n, length: clamp(n.length + g.dLen, 1, steps - n.step) } : n))
    }
  }, [onChange, steps])

  const endGesture = useCallback(() => {
    const g = dragRef.current
    dragRef.current = null
    setDrag(null)
    if (!g) return
    if (g.mode === 'place' && !g.moved) {
      // simple click on empty cell -> add a note, audition it
      const pitch = PITCHES[g.startPitch]
      const exists = noteAtCell(g.startStep, g.startPitch)
      if (!exists) {
        const nn: RollNote = { id: uid(), step: g.startStep, note: pitch, length: 1, velocity: 0.9 }
        onChange([...notesRef.current, nn])
        setSel(new Set([nn.id]))
        onPreview(pitch)
      }
    } else if (g.mode === 'move' || g.mode === 'resize') {
      if (g.moved) commit(g)
      else if (!g.additive && g.grabId) {
        // click on a note without dragging -> remove it (toggle off)
        const id = g.grabId
        onChange(notesRef.current.filter((n) => n.id !== id))
        setSel((prev) => { const next = new Set(prev); next.delete(id); return next })
      }
    }
  }, [commit, noteAtCell, onChange, onPreview])

  // window listeners drive the active gesture so dragging works outside the grid
  useEffect(() => {
    if (!drag) return
    const onMove = (e: PointerEvent) => {
      const g = dragRef.current
      if (!g) return
      const { step, pitch } = cellFrom(e.clientX, e.clientY)
      const next: Gesture = { ...g }
      if (step !== g.startStep || pitch !== g.startPitch) next.moved = true
      if (g.mode === 'move') { next.dStep = step - g.startStep; next.dPitch = pitch - g.startPitch }
      else if (g.mode === 'resize') { next.dLen = step - g.startStep }
      else if (g.mode === 'place' || g.mode === 'marquee') {
        next.mode = 'marquee'; next.curStep = step; next.curPitch = pitch
        // live marquee selection
        const sMin = Math.min(g.startStep, step), sMax = Math.max(g.startStep, step)
        const pMin = Math.min(g.startPitch, pitch), pMax = Math.max(g.startPitch, pitch)
        const hit = new Set<string>()
        for (const n of notesRef.current) {
          const idx = PITCH_INDEX.get(n.note); if (idx === undefined) continue
          if (idx >= pMin && idx <= pMax && n.step <= sMax && n.step + n.length - 1 >= sMin) hit.add(n.id)
        }
        setSel(hit)
      }
      dragRef.current = next
      setDrag(next)
    }
    const onUp = () => endGesture()
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp) }
  }, [drag, cellFrom, endGesture])

  // keyboard: delete selection, escape to clear
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement
      if (el && (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA')) return
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (!selRef.current.size) return
        e.preventDefault()
        const ids = selRef.current
        onChange(notesRef.current.filter((n) => !ids.has(n.id)))
        setSel(new Set())
      } else if (e.key === 'Escape') {
        setSel(new Set())
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onChange])

  const onSurfaceDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return
    const { step, pitch } = cellFrom(e.clientX, e.clientY)
    const hit = noteAtCell(step, pitch)

    if (hit) {
      onPreview(hit.note)
      // selection: shift toggles, plain click keeps group if already selected
      let workingIds: string[]
      const additive = e.shiftKey
      if (additive) {
        const next = new Set(selRef.current)
        next.has(hit.id) ? next.delete(hit.id) : next.add(hit.id)
        setSel(next); workingIds = [...next]
      } else if (selRef.current.has(hit.id)) {
        workingIds = [...selRef.current]
      } else {
        setSel(new Set([hit.id])); workingIds = [hit.id]
      }
      const rect = surfaceRef.current!.getBoundingClientRect()
      const noteRightX = (hit.step + hit.length) * COL_W
      const localX = e.clientX - rect.left
      const mode: Mode = localX >= noteRightX - RESIZE_EDGE ? 'resize' : 'move'
      const orig = notesRef.current.filter((n) => workingIds.includes(n.id))
      const g: Gesture = { mode, ids: mode === 'resize' ? [hit.id] : workingIds, orig: mode === 'resize' ? [hit] : orig,
        grabId: hit.id, additive,
        startStep: step, startPitch: pitch, dStep: 0, dPitch: 0, dLen: 0, curStep: step, curPitch: pitch, moved: false }
      dragRef.current = g; setDrag(g)
    } else {
      // empty cell: pending place that becomes a marquee on drag
      if (!e.shiftKey) setSel(new Set())
      const g: Gesture = { mode: 'place', ids: [], orig: [], startStep: step, startPitch: pitch,
        dStep: 0, dPitch: 0, dLen: 0, curStep: step, curPitch: pitch, moved: false }
      dragRef.current = g; setDrag(g)
    }
  }, [cellFrom, noteAtCell, onPreview])

  const onSurfaceDouble = useCallback((e: React.MouseEvent) => {
    const { step, pitch } = cellFrom(e.clientX, e.clientY)
    const hit = noteAtCell(step, pitch)
    if (hit) onChange(notesRef.current.filter((n) => n.id !== hit.id))
  }, [cellFrom, noteAtCell, onChange])

  // ─── render ────────────────────────────────────────────────────────────
  const gridH = PITCHES.length * ROW_H
  const gridW = KEY_W + steps * COL_W

  const renderNotes = useMemo(() => {
    return notes.map((n) => {
      let idx = PITCH_INDEX.get(n.note)
      if (idx === undefined) return null
      let step = n.step, len = n.length
      if (drag && drag.ids.includes(n.id)) {
        if (drag.mode === 'move') { step += drag.dStep; idx += drag.dPitch }
        else if (drag.mode === 'resize') len = Math.max(1, len + drag.dLen)
      }
      idx = clamp(idx, 0, PITCHES.length - 1)
      step = clamp(step, 0, steps - 1)
      len = clamp(len, 1, steps - step)
      return (
        <div
          key={n.id}
          className={`${s.rollNote} ${sel.has(n.id) ? s.sel : ''}`}
          style={{ left: KEY_W + step * COL_W, top: idx * ROW_H, width: len * COL_W - 2, opacity: 0.55 + n.velocity * 0.45 }}
        />
      )
    })
  }, [notes, drag, sel, steps])

  const marquee = drag && drag.mode === 'marquee' ? (() => {
    const sMin = Math.min(drag.startStep, drag.curStep), sMax = Math.max(drag.startStep, drag.curStep)
    const pMin = Math.min(drag.startPitch, drag.curPitch), pMax = Math.max(drag.startPitch, drag.curPitch)
    return { left: KEY_W + sMin * COL_W, top: pMin * ROW_H, width: (sMax - sMin + 1) * COL_W, height: (pMax - pMin + 1) * ROW_H }
  })() : null

  if (!isInstrument) {
    return <div className={s.empty}>Select an instrument channel, then open its piano roll.</div>
  }

  return (
    <div className={s.roll}>
      <div className={s.rollHint}>
        {p.track!.name} · click to add · drag to select · drag a note to move · drag its right edge to resize · double-click or Delete to remove
      </div>
      <div className={s.rollGridWrap} ref={scrollRef}>
        <div className={s.rollGrid} style={{ width: gridW, height: gridH, position: 'relative' }}>
          {PITCHES.map((pitch, r) => (
            <div key={pitch} className={s.rollRow} style={{ position: 'absolute', top: r * ROW_H, left: 0, right: 0, height: ROW_H }}>
              <div className={`${s.rollKey} ${isBlack(pitch) ? s.black : ''}`} onClick={() => onPreview(pitch)}>
                {pitch}
              </div>
              {Array.from({ length: steps }).map((_, step) => (
                <div
                  key={step}
                  className={`${s.rollCell} ${isBlack(pitch) ? s.black : ''} ${step % 4 === 0 ? s.cellBeat : ''} ${p.currentStep === step ? s.playhead : ''}`}
                />
              ))}
            </div>
          ))}

          {renderNotes}
          {marquee && <div className={s.marquee} style={marquee} />}

          <div
            ref={surfaceRef}
            className={s.rollSurface}
            style={{ position: 'absolute', left: KEY_W, top: 0, width: steps * COL_W, height: gridH }}
            onPointerDown={onSurfaceDown}
            onDoubleClick={onSurfaceDouble}
          />
        </div>
      </div>
    </div>
  )
}
