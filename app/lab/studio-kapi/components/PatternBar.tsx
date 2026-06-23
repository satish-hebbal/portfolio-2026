'use client'

import { useState } from 'react'
import { Plus, Pencil, Copy, Trash2 } from 'lucide-react'
import s from '../studioKapi.module.css'
import type { Pattern, DawMode } from '../audio/types'
import Menu from './Menu'

interface Props {
  patterns: Pattern[]
  activeId: string
  mode: DawMode
  onMode: (m: DawMode) => void
  onSelect: (id: string) => void
  onAdd: () => void
  onRename: (id: string, name: string) => void
  onDuplicate: (id: string) => void
  onDelete: (id: string) => void
}

export default function PatternBar(p: Props) {
  const [editing, setEditing] = useState<string | null>(null)

  return (
    <div className={s.patternBar}>
      <div className={s.modeSwitch}>
        <button className={`${s.modeBtn} ${p.mode === 'pattern' ? s.modeActive : ''}`} onClick={() => p.onMode('pattern')}>Pattern</button>
        <button className={`${s.modeBtn} ${p.mode === 'song' ? s.modeActive : ''}`} onClick={() => p.onMode('song')}>Song</button>
      </div>
      <span className={s.patternLabel}>Patterns</span>
      <div className={s.patternChips}>
        {p.patterns.map((pat) => (
          <div key={pat.id} className={`${s.patternChip} ${pat.id === p.activeId ? s.patternActive : ''}`} onClick={() => p.onSelect(pat.id)}>
            {editing === pat.id ? (
              <input
                className={s.renameInput}
                defaultValue={pat.name}
                autoFocus
                onClick={(e) => e.stopPropagation()}
                onBlur={(e) => { p.onRename(pat.id, e.target.value.trim() || pat.name); setEditing(null) }}
                onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEditing(null) }}
              />
            ) : (
              <span className={s.chipName}>{pat.name}</span>
            )}
            <Menu
              size={13}
              items={[
                { label: 'Rename', icon: <Pencil size={12} />, onClick: () => setEditing(pat.id) },
                { label: 'Duplicate', icon: <Copy size={12} />, onClick: () => p.onDuplicate(pat.id) },
                { label: 'Delete', icon: <Trash2 size={12} />, onClick: () => p.onDelete(pat.id), danger: true },
              ]}
            />
          </div>
        ))}
      </div>
      <button className={s.patternBtn} onClick={p.onAdd} title="New pattern"><Plus size={13} /></button>
    </div>
  )
}
