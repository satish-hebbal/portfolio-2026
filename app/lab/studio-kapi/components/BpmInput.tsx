'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronUp, ChevronDown } from 'lucide-react'
import s from '../studioKapi.module.css'

interface Props {
  value: number
  min?: number
  max?: number
  onChange: (v: number) => void
}

export default function BpmInput({ value, min = 40, max = 240, onChange }: Props) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(String(value))
  useEffect(() => { if (!editing) setText(String(value)) }, [value, editing])

  const clamp = (v: number) => Math.max(min, Math.min(max, v))
  const set = (v: number) => onChange(clamp(Math.round(v)))

  // vertical drag to scrub
  const drag = useRef<{ y: number; start: number } | null>(null)
  const onPointerDown = (e: React.PointerEvent) => {
    if (editing) return
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    drag.current = { y: e.clientY, start: value }
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return
    set(drag.current.start + (drag.current.y - e.clientY) / 3)
  }
  const onPointerUp = () => { drag.current = null }

  // press-and-hold repeat on the steppers
  const hold = useRef<ReturnType<typeof setInterval> | null>(null)
  const startHold = (dir: number) => {
    set(value + dir)
    let v = clamp(value + dir)
    let delay = 320
    const tick = () => {
      v = clamp(v + dir); onChange(v)
      delay = Math.max(40, delay * 0.8)
      hold.current = setTimeout(tick, delay)
    }
    hold.current = setTimeout(tick, delay)
  }
  const stopHold = () => { if (hold.current) { clearTimeout(hold.current); hold.current = null } }
  useEffect(() => () => stopHold(), [])

  const commitText = () => {
    const n = Number(text)
    if (Number.isFinite(n)) set(n)
    setEditing(false)
  }

  return (
    <div className={s.bpmControl} title="Drag, scroll, or type to set tempo">
      <div
        className={s.bpmValue}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onDoubleClick={() => setEditing(true)}
        onWheel={(e) => set(value + (e.deltaY < 0 ? 1 : -1))}
      >
        {editing ? (
          <input
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={commitText}
            onKeyDown={(e) => { if (e.key === 'Enter') commitText(); if (e.key === 'Escape') setEditing(false) }}
          />
        ) : (
          value
        )}
      </div>
      <div className={s.bpmSteppers}>
        <button className={s.bpmStep} onPointerDown={() => startHold(1)} onPointerUp={stopHold} onPointerLeave={stopHold} title="Tempo up">
          <ChevronUp size={12} />
        </button>
        <button className={s.bpmStep} onPointerDown={() => startHold(-1)} onPointerUp={stopHold} onPointerLeave={stopHold} title="Tempo down">
          <ChevronDown size={12} />
        </button>
      </div>
    </div>
  )
}
