'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Check } from 'lucide-react'
import s from '../studioKapi.module.css'

interface Props {
  value: number
  options: { value: number; label: string }[]
  onChange: (v: number) => void
  className?: string
  title?: string
}

// Custom styled dropdown replacing the native <select>. The list is rendered in
// a portal with fixed positioning so it matches the studio theme and is never
// clipped by an overflow ancestor. Closes on outside click, scroll, or resize.
export default function Select({ value, options, onChange, className, title }: Props) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)
  const popRef = useRef<HTMLDivElement>(null)

  const place = () => {
    const b = btnRef.current
    if (!b) return
    const r = b.getBoundingClientRect()
    setPos({ top: r.bottom + 4, left: r.left, width: r.width })
  }

  useLayoutEffect(() => {
    if (open) place()
  }, [open])

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node
      if (btnRef.current?.contains(t) || popRef.current?.contains(t)) return
      setOpen(false)
    }
    const close = () => setOpen(false)
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [open])

  const current = options.find((o) => o.value === value)

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className={`${s.selectBtn} ${className ?? ''} ${open ? s.selectOpen : ''}`}
        title={title}
        onClick={() => setOpen((o) => !o)}
      >
        <span className={s.selectValue}>{current?.label ?? value}</span>
        <ChevronDown size={13} className={`${s.selectChevron} ${open ? s.selectChevronUp : ''}`} />
      </button>
      {open && typeof document !== 'undefined' && createPortal(
        <div
          ref={popRef}
          className={s.selectPop}
          style={{ position: 'fixed', top: pos.top, left: pos.left, minWidth: pos.width }}
        >
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              className={`${s.selectItem} ${o.value === value ? s.selectItemActive : ''}`}
              onClick={() => { onChange(o.value); setOpen(false) }}
            >
              <span>{o.label}</span>
              {o.value === value && <Check size={13} className={s.selectCheck} />}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </>
  )
}
