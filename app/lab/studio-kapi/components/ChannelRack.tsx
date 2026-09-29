'use client'

import { useEffect, useRef, useState } from 'react'
import { Plus, Trash2, Piano, SlidersHorizontal, X, Volume2, VolumeX, Headphones, ChevronLeft, ChevronRight } from 'lucide-react'
import s from '../studioKapi.module.css'
import type { Track, PatternData } from '../audio/types'
import { PRESETS, PRESET_GROUPS, REAL_GROUPS, SAMPLE_CREDITS } from '../audio/presets'
import Menu from './Menu'
import { InstrumentIcon } from './InstrumentIcons'

interface Props {
  tracks: Track[]
  data: Record<string, PatternData>
  selectedTrackId: string | null
  currentStep: number
  steps: number
  onSelect: (id: string) => void
  onToggleStep: (trackId: string, step: number) => void
  onMute: (id: string) => void
  onSolo: (id: string) => void
  onOpenRoll: (id: string) => void
  onOpenSynth: (id: string) => void
  onDelete: (id: string) => void
  onAdd: (presetId: string) => void
  onPreview: (track: Track) => void
}

function stepIsOn(track: Track, d: PatternData | undefined, i: number) {
  if (!d) return false
  return track.kind === 'drum' ? !!d.steps[i] : d.notes.some((n) => n.step === i)
}

// narrowest a pad may get before the rack switches to one bar (16 steps) at a time
const MIN_PAD = 15
const BAR = 16

export default function ChannelRack(p: Props) {
  const [picking, setPicking] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [stepsW, setStepsW] = useState(0)
  const [page, setPage] = useState(0)

  // measure the pad lane (all rows share one width) to decide fit vs. paging
  useEffect(() => {
    const wrap = scrollRef.current
    if (!wrap) return
    const measure = () => {
      const lane = wrap.querySelector<HTMLElement>('[data-steps]')
      if (lane) setStepsW(lane.clientWidth)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(wrap)
    return () => ro.disconnect()
  }, [p.tracks.length])

  const paged = p.steps > BAR && stepsW > 0 && stepsW / p.steps < MIN_PAD
  const pages = paged ? Math.ceil(p.steps / BAR) : 1
  const curPage = Math.min(page, pages - 1)
  // follow the playhead across bars while playing
  useEffect(() => {
    if (paged && p.currentStep >= 0) setPage(Math.floor(p.currentStep / BAR))
  }, [paged, p.currentStep])
  const first = paged ? curPage * BAR : 0
  const count = paged ? Math.min(BAR, p.steps - first) : p.steps
  const dense = !paged && p.steps > BAR

  return (
    <div className={s.rack}>
      <div className={s.panelHead}>
        <span className={s.panelTitle}>Channel Rack</span>
        {paged && (
          <div className={s.barPager}>
            <button className={s.barArrow} disabled={curPage === 0} onClick={() => setPage(curPage - 1)} title="Previous bar"><ChevronLeft size={13} /></button>
            {Array.from({ length: pages }).map((_, i) => {
              const live = p.currentStep >= 0 && Math.floor(p.currentStep / BAR) === i
              return (
                <button key={i} className={`${s.barTab} ${i === curPage ? s.barTabActive : ''}`} onClick={() => setPage(i)}>
                  Bar {i + 1}{live && <span className={s.barLive} />}
                </button>
              )
            })}
            <button className={s.barArrow} disabled={curPage === pages - 1} onClick={() => setPage(curPage + 1)} title="Next bar"><ChevronRight size={13} /></button>
          </div>
        )}
        <span className={s.panelHint}>{p.tracks.length} channels</span>
      </div>

      <div className={s.rackScroll} ref={scrollRef}>
        {p.tracks.map((track) => {
          const d = p.data[track.id]
          const selectPreview = () => { p.onSelect(track.id); p.onPreview(track) }
          return (
            <div key={track.id} className={`${s.trackRow} ${p.selectedTrackId === track.id ? s.selected : ''}`}>
              <span
                className={s.trackIcon}
                style={{ color: track.color, background: `${track.color}1f`, boxShadow: `inset 0 0 0 1px ${track.color}44` }}
                onClick={selectPreview}
              >
                <InstrumentIcon presetId={track.kind === 'audio' ? 'audio' : track.presetId} group={track.group} size={17} />
              </span>
              <div className={s.trackInfo} onClick={selectPreview}>
                <span className={s.trackName}>{track.name}</span>
                <span className={s.trackPreset}>{track.kind === 'audio' ? 'recording' : track.presetId}</span>
              </div>
              {/* desktop: inline buttons */}
              <div className={`${s.trackBtns} ${s.deskOnly}`}>
                <button className={`${s.miniBtn} ${s.mute} ${track.mixer.mute ? s.active : ''}`} onClick={() => p.onMute(track.id)} title="Mute">M</button>
                <button className={`${s.miniBtn} ${s.solo} ${track.mixer.solo ? s.active : ''}`} onClick={() => p.onSolo(track.id)} title="Solo">S</button>
                <button className={s.miniBtn} onClick={() => { p.onSelect(track.id); p.onOpenSynth(track.id) }} title="Sound design"><SlidersHorizontal size={11} /></button>
                {track.kind === 'instrument' ? (
                  <button className={`${s.miniBtn} ${s.roll}`} onClick={() => p.onOpenRoll(track.id)} title="Piano roll"><Piano size={12} /></button>
                ) : (
                  <span className={s.miniBtn} style={{ visibility: 'hidden' }} aria-hidden />
                )}
                <button className={s.miniBtn} onClick={() => p.onDelete(track.id)} title="Delete"><Trash2 size={11} /></button>
              </div>
              {/* mobile: consolidated 3-dot menu (saves space for the steps) */}
              <div className={s.mobileOnly}>
                <Menu items={[
                  { label: 'Sound design', icon: <SlidersHorizontal size={12} />, onClick: () => { p.onSelect(track.id); p.onOpenSynth(track.id) } },
                  ...(track.kind === 'instrument' ? [{ label: 'Piano roll', icon: <Piano size={12} />, onClick: () => p.onOpenRoll(track.id) }] : []),
                  { label: track.mixer.mute ? 'Unmute' : 'Mute', icon: track.mixer.mute ? <VolumeX size={12} /> : <Volume2 size={12} />, onClick: () => p.onMute(track.id) },
                  { label: track.mixer.solo ? 'Unsolo' : 'Solo', icon: <Headphones size={12} />, onClick: () => p.onSolo(track.id) },
                  { label: 'Delete', icon: <Trash2 size={12} />, onClick: () => p.onDelete(track.id), danger: true },
                ]} />
              </div>

              {track.kind === 'audio' ? (
                <div className={s.steps} style={{ alignItems: 'center', color: 'var(--dim)', fontSize: 11, paddingLeft: 8 }}>
                  Loops with the pattern
                </div>
              ) : (
                <div className={`${s.steps} ${dense ? s.stepsDense : ''}`} data-steps>
                  {Array.from({ length: count }).map((_, k) => {
                    const i = first + k
                    return (
                      <div
                        key={i}
                        className={`${s.step} ${i % 4 === 0 ? s.stepBeat : ''} ${i % BAR === 0 && k > 0 ? s.stepBar : ''} ${stepIsOn(track, d, i) ? s.on : ''} ${p.currentStep === i ? s.playhead : ''}`}
                        style={{ ['--trackColor' as string]: track.color }}
                        onClick={() => p.onToggleStep(track.id, i)}
                      />
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}

        <button className={s.addTrack} onClick={() => setPicking(true)}>
          <Plus size={15} /> Add channel
        </button>
      </div>

      {picking && (
        <div className={s.pickerOverlay} onClick={() => setPicking(false)}>
          <div className={s.picker} onClick={(e) => e.stopPropagation()}>
            <div className={s.pickerHead}>
              <span className={s.panelTitle}>Choose an instrument</span>
              <button className={s.miniBtn} onClick={() => setPicking(false)}><X size={13} /></button>
            </div>
            {PRESET_GROUPS.map((g) => (
              <div key={g} className={s.pickerGroup}>
                <div className={s.pickerGroupLabel}>
                  {g}{REAL_GROUPS.has(g) && <span className={s.realTag}>real recordings</span>}
                </div>
                <div className={s.pickerGrid}>
                  {PRESETS.filter((pr) => pr.group === g).map((pr) => (
                    <button key={pr.id} className={s.presetChip} title={pr.hint} onClick={() => { p.onAdd(pr.id); setPicking(false) }}>
                      <span className={s.presetIcon} style={{ color: pr.color, background: `${pr.color}1f`, boxShadow: `inset 0 0 0 1px ${pr.color}44` }}>
                        <InstrumentIcon presetId={pr.id} group={pr.group} size={26} />
                      </span>
                      <span className={s.chipText}>
                        {pr.label}
                        {pr.hint && <small className={s.chipHint}>{pr.hint}</small>}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <details className={s.credits}>
              <summary>Sample credits</summary>
              <ul>
                {SAMPLE_CREDITS.map((c) => (
                  <li key={c.what}>
                    {c.what}: <a href={c.url} target="_blank" rel="noreferrer">{c.who}</a> ({c.license})
                  </li>
                ))}
              </ul>
            </details>
          </div>
        </div>
      )}
    </div>
  )
}
