"use client"

/*
 * Temporary tuning panel for the hero dither effect.
 *
 * Shows only in development or with ?dither in the URL. Every change applies
 * live and is saved to this browser automatically. Shift+D hides and shows it.
 * When a look is settled, "Copy as code" gives a DEFAULTS block to paste into
 * ./settings.ts, and this component can be removed.
 */

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  BUILT_IN_PRESETS, DEFAULTS, asCode, deleteUserPreset, getSettings, getUserPresets,
  panelAllowed, saveUserPreset, setSettings, subscribe, type DitherSettings,
} from './settings'

type Ctl =
  | { key: keyof DitherSettings; label: string; type: 'range'; min: number; max: number; step: number; hint?: string }
  | { key: keyof DitherSettings; label: string; type: 'select'; options: string[]; hint?: string }
  | { key: keyof DitherSettings; label: string; type: 'toggle'; hint?: string }
  | { key: keyof DitherSettings; label: string; type: 'color'; hint?: string }

const SECTIONS: { title: string; controls: Ctl[] }[] = [
  {
    title: 'Effect',
    controls: [
      { key: 'enabled', label: 'Enabled', type: 'toggle' },
      { key: 'mode', label: 'Mode', type: 'select', options: ['lens', 'always', 'reveal'], hint: 'lens: dots under the pointer · always: figure fully dithered · reveal: dithered, pointer shows the engraving' },
      { key: 'target', label: 'Figures', type: 'select', options: ['both', 'abhay', 'tejas'] },
    ],
  },
  {
    title: 'Dither',
    controls: [
      { key: 'algo', label: 'Algorithm', type: 'select', options: ['atkinson', 'floyd-steinberg', 'stucki', 'burkes', 'sierra-lite', 'jarvis', 'bayer2', 'bayer4', 'bayer8', 'bayer16', 'blue-noise', 'white-noise', 'halftone', 'hatch', 'crosshatch', 'lines', 'threshold', 'amplitude'], hint: 'First six diffuse error; the rest are threshold patterns; amplitude sizes each dot by tone' },
      { key: 'cell', label: 'Cell size', type: 'range', min: 2, max: 20, step: 1 },
      { key: 'dotScale', label: 'Dot size', type: 'range', min: 0.2, max: 1.6, step: 0.05 },
      { key: 'shape', label: 'Dot shape', type: 'select', options: ['square', 'circle', 'diamond', 'hline', 'vline', 'cross', 'slash'] },
      { key: 'errorAmount', label: 'Error diffusion', type: 'range', min: 0, max: 1.2, step: 0.05, hint: 'Diffusion algorithms only' },
      { key: 'serpentine', label: 'Serpentine scan', type: 'toggle', hint: 'Diffusion algorithms only' },
    ],
  },
  {
    title: 'Tone',
    controls: [
      { key: 'contrast', label: 'Contrast', type: 'range', min: 0.2, max: 4, step: 0.05 },
      { key: 'brightness', label: 'Brightness', type: 'range', min: -0.6, max: 0.6, step: 0.01, hint: 'Positive adds ink' },
      { key: 'gamma', label: 'Gamma', type: 'range', min: 0.2, max: 3, step: 0.05 },
      { key: 'threshold', label: 'Threshold', type: 'range', min: 0.1, max: 0.9, step: 0.01 },
      { key: 'invert', label: 'Invert', type: 'toggle' },
    ],
  },
  {
    title: 'Colour',
    controls: [
      { key: 'inkColor', label: 'Ink', type: 'color' },
      { key: 'inkOpacity', label: 'Ink opacity', type: 'range', min: 0.05, max: 1, step: 0.05 },
      { key: 'paper', label: 'Paper fill', type: 'toggle', hint: 'Colours the blank cells inside the figure' },
      { key: 'paperColor', label: 'Paper', type: 'color' },
      { key: 'paperOpacity', label: 'Paper opacity', type: 'range', min: 0.05, max: 1, step: 0.05 },
    ],
  },
  {
    title: 'Pointer',
    controls: [
      { key: 'radius', label: 'Radius', type: 'range', min: 20, max: 420, step: 5 },
      { key: 'falloff', label: 'Edge falloff', type: 'range', min: 0.5, max: 6, step: 0.1, hint: 'Higher is a tighter core' },
      { key: 'erase', label: 'Engraving erase', type: 'range', min: 0, max: 1, step: 0.05 },
      { key: 'alphaBoost', label: 'Dot fade-in', type: 'range', min: 0.5, max: 8, step: 0.1 },
    ],
  },
  {
    title: 'Scatter',
    controls: [
      { key: 'scatter', label: 'Direction', type: 'select', options: ['random', 'push', 'pull', 'swirl', 'fall', 'none'] },
      { key: 'throw', label: 'Throw', type: 'range', min: 0, max: 2.5, step: 0.05, hint: 'Share of the radius' },
      { key: 'jitter', label: 'Jitter', type: 'range', min: 0, max: 12, step: 0.5, hint: 'Live boil in px; keeps animating while hovered' },
    ],
  },
  {
    title: 'Trail',
    controls: [
      { key: 'trail', label: 'Trail', type: 'toggle' },
      { key: 'healMs', label: 'Heal time (ms)', type: 'range', min: 0, max: 4000, step: 50 },
      { key: 'enterMs', label: 'Grow-in (ms)', type: 'range', min: 0, max: 1200, step: 10 },
      { key: 'spacing', label: 'Trail spacing', type: 'range', min: 0.05, max: 1, step: 0.05 },
      { key: 'maxStamps', label: 'Trail length', type: 'range', min: 1, max: 120, step: 1 },
    ],
  },
  {
    title: 'Rendering',
    controls: [
      { key: 'dprCap', label: 'Pixel ratio cap', type: 'range', min: 1, max: 3, step: 0.5, hint: 'Lower is faster and softer' },
    ],
  },
]

const mono: React.CSSProperties = { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' }

export default function DitherPanel() {
  const [allowed, setAllowed] = useState(false)
  const [open, setOpen] = useState(true)
  const [hidden, setHidden] = useState(false)
  const [s, setS] = useState<DitherSettings>(DEFAULTS)
  const [userPresets, setUserPresets] = useState<Record<string, Partial<DitherSettings>>>({})
  const [presetName, setPresetName] = useState('')
  const [importText, setImportText] = useState('')
  const [toast, setToast] = useState('')

  useEffect(() => {
    if (!panelAllowed()) return
    setAllowed(true)
    setS(getSettings())
    setUserPresets(getUserPresets())
    const un = subscribe((next) => setS(next))
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return
      if (e.shiftKey && e.key.toLowerCase() === 'd') setHidden((h) => !h)
    }
    window.addEventListener('keydown', onKey)
    return () => { un(); window.removeEventListener('keydown', onKey) }
  }, [])

  if (!allowed) return null

  const flash = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 1600) }
  const copy = async (text: string, msg: string) => {
    try { await navigator.clipboard.writeText(text); flash(msg) } catch { flash('Copy blocked by the browser') }
  }
  const apply = (p: Partial<DitherSettings>) => setSettings({ ...DEFAULTS, ...p })

  if (hidden) {
    return createPortal(
      <button
        onClick={() => setHidden(false)}
        className="fixed bottom-4 right-4 border border-gray-300 bg-white px-3 py-2 text-xs text-gray-700 hover:border-gray-900"
        style={{ zIndex: 10010, ...mono }}
      >
        Dither lab
      </button>,
      document.body,
    )
  }

  const btn = 'border border-gray-300 bg-white px-2 py-1 text-[11px] text-gray-700 hover:border-gray-900 hover:text-gray-900 transition-colors'

  // portalled to <body> so no transformed ancestor can trap the fixed panel
  return createPortal(
    <div
      // keep the pointer over the panel from dissolving the figure behind it
      onMouseMove={(e) => e.stopPropagation()}
      className="fixed top-20 right-4 w-[300px] max-h-[calc(100vh-6rem)] flex flex-col border border-gray-300 bg-white/95 shadow-xl text-gray-800"
      style={{ zIndex: 10010, fontFamily: 'FunnelDisplay, sans-serif', backdropFilter: 'blur(6px)' }}
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200">
        <span className="text-xs font-medium tracking-wide" style={mono}>DITHER LAB</span>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-400" style={mono}>shift+D</span>
          <button className={btn} onClick={() => setOpen((o) => !o)}>{open ? 'Collapse' : 'Expand'}</button>
          <button className={btn} onClick={() => setHidden(true)} aria-label="Hide panel">×</button>
        </div>
      </div>

      {open && (
        <div className="overflow-y-auto px-3 py-3 flex flex-col gap-5" style={{ overscrollBehavior: 'contain' }} data-lenis-prevent>
          {/* presets */}
          <section className="flex flex-col gap-2">
            <h3 className="text-[10px] uppercase tracking-widest text-gray-400" style={mono}>Presets</h3>
            <div className="flex flex-wrap gap-1">
              {Object.entries(BUILT_IN_PRESETS).map(([n, p]) => (
                <button key={n} className={btn} onClick={() => { apply(p); flash(`Loaded ${n}`) }}>{n}</button>
              ))}
            </div>
            {Object.keys(userPresets).length > 0 && (
              <div className="flex flex-col gap-1 pt-1">
                {Object.entries(userPresets).map(([n, p]) => (
                  <div key={n} className="flex items-center justify-between gap-2">
                    <button className={`${btn} flex-1 text-left`} onClick={() => { apply(p); flash(`Loaded ${n}`) }}>{n}</button>
                    <button className={btn} onClick={() => { deleteUserPreset(n); setUserPresets(getUserPresets()) }} aria-label={`Delete ${n}`}>Delete</button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-1">
              <input
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                placeholder="Preset name"
                className="flex-1 min-w-0 border border-gray-300 px-2 py-1 text-[11px] outline-none focus:border-gray-900"
              />
              <button
                className={btn}
                onClick={() => {
                  const n = presetName.trim() || `Preset ${Object.keys(userPresets).length + 1}`
                  saveUserPreset(n, s)
                  setUserPresets(getUserPresets())
                  setPresetName('')
                  flash(`Saved "${n}"`)
                }}
              >
                Save preset
              </button>
            </div>
          </section>

          {SECTIONS.map((sec) => (
            <section key={sec.title} className="flex flex-col gap-2">
              <h3 className="text-[10px] uppercase tracking-widest text-gray-400" style={mono}>{sec.title}</h3>
              {sec.controls.map((c) => (
                <Control key={c.key} c={c} value={s[c.key]} onChange={(v) => setSettings({ [c.key]: v } as Partial<DitherSettings>)} />
              ))}
            </section>
          ))}

          {/* export */}
          <section className="flex flex-col gap-2 pb-1">
            <h3 className="text-[10px] uppercase tracking-widest text-gray-400" style={mono}>Save and export</h3>
            <p className="text-[11px] text-gray-500 leading-snug">Changes save to this browser automatically. Copy as code to ship a look.</p>
            <div className="flex flex-wrap gap-1">
              <button className={btn} onClick={() => copy(JSON.stringify(s, null, 2), 'Settings copied as JSON')}>Copy JSON</button>
              <button className={btn} onClick={() => copy(asCode(s), 'DEFAULTS block copied')}>Copy as code</button>
              <button className={btn} onClick={() => { apply({}); flash('Reset to defaults') }}>Reset</button>
            </div>
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder="Paste settings JSON to import"
              rows={3}
              className="border border-gray-300 px-2 py-1 text-[10px] outline-none focus:border-gray-900 resize-y"
              style={mono}
            />
            <button
              className={btn}
              onClick={() => {
                try {
                  apply(JSON.parse(importText))
                  setImportText('')
                  flash('Imported')
                } catch {
                  flash('That isn’t valid JSON')
                }
              }}
            >
              Import
            </button>
          </section>
        </div>
      )}

      {toast && (
        <div className="absolute -top-9 right-0 bg-gray-900 text-white text-[11px] px-3 py-1.5" style={mono} role="status">{toast}</div>
      )}
    </div>,
    document.body,
  )
}

function Control({ c, value, onChange }: { c: Ctl; value: unknown; onChange: (v: unknown) => void }) {
  const id = `dither-${c.key}`
  const label = (
    <label htmlFor={id} className="text-[11px] text-gray-600 shrink-0" title={c.hint}>
      {c.label}{c.hint ? <span className="text-gray-300"> ⓘ</span> : null}
    </label>
  )

  if (c.type === 'range') {
    const v = value as number
    return (
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center justify-between">
          {label}
          <input
            type="number"
            value={v}
            min={c.min}
            max={c.max}
            step={c.step}
            onChange={(e) => { const n = parseFloat(e.target.value); if (!Number.isNaN(n)) onChange(n) }}
            className="w-16 border border-gray-200 px-1 text-right text-[11px] outline-none focus:border-gray-900"
            style={{ ...mono, fontVariantNumeric: 'tabular-nums' }}
            aria-label={`${c.label} value`}
          />
        </div>
        <input id={id} type="range" min={c.min} max={c.max} step={c.step} value={v} onChange={(e) => onChange(parseFloat(e.target.value))} className="w-full accent-gray-900" />
      </div>
    )
  }
  if (c.type === 'select') {
    return (
      <div className="flex items-center justify-between gap-2">
        {label}
        <select id={id} value={value as string} onChange={(e) => onChange(e.target.value)} className="min-w-0 flex-1 max-w-[160px] border border-gray-200 bg-white px-1 py-0.5 text-[11px] outline-none focus:border-gray-900">
          {c.options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>
    )
  }
  if (c.type === 'toggle') {
    return (
      <div className="flex items-center justify-between">
        {label}
        <input id={id} type="checkbox" checked={value as boolean} onChange={(e) => onChange(e.target.checked)} className="accent-gray-900" />
      </div>
    )
  }
  return (
    <div className="flex items-center justify-between">
      {label}
      <input id={id} type="color" value={value as string} onChange={(e) => onChange(e.target.value)} className="h-6 w-10 border border-gray-200 bg-white p-0" />
    </div>
  )
}
