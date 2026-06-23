'use client'

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { MoreVertical } from 'lucide-react'
import s from '../studioKapi.module.css'

export interface MenuItem {
  label: string
  icon?: ReactNode
  onClick: () => void
  danger?: boolean
}

// Small 3-dot dropdown menu. The popover is rendered in a portal with fixed
// positioning so it always sits above neighbouring panels (channel rack, etc.)
// and is never clipped by an overflow:auto ancestor. Closes on outside click,
// selection, scroll, or resize.
export default function Menu({ items, size = 14 }: { items: MenuItem[]; size?: number }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; right: number }>({ top: 0, right: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)
  const popRef = useRef<HTMLDivElement>(null)

  const place = () => {
    const b = btnRef.current
    if (!b) return
    const r = b.getBoundingClientRect()
    setPos({ top: r.bottom + 4, right: window.innerWidth - r.right })
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

  return (
    <div className={s.menuWrap}>
      <button ref={btnRef} className={s.menuBtn} onClick={(e) => { e.stopPropagation(); setOpen((o) => !o) }} title="More">
        <MoreVertical size={size} />
      </button>
      {open && typeof document !== 'undefined' && createPortal(
        <div
          ref={popRef}
          className={s.menuPop}
          style={{ position: 'fixed', top: pos.top, right: pos.right }}
          onClick={(e) => e.stopPropagation()}
        >
          {items.map((it, i) => (
            <button key={i} className={`${s.menuItem} ${it.danger ? s.menuDanger : ''}`} onClick={() => { setOpen(false); it.onClick() }}>
              {it.icon && <span className={s.menuIcon}>{it.icon}</span>}
              {it.label}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  )
}
