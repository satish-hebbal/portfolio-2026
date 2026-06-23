'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import s from './studioKapi.module.css'
import { getEngine } from './audio/engine'
import { getPreset, defaultFxChain, defaultSynthFor } from './audio/presets'
import type { ProjectState, Track, FxType, MixerState, SynthParams, Pattern, PatternData, Clip, DawMode } from './audio/types'
import { downloadBlob, audioBufferToWav } from './audio/wav'
import { denoiseBuffer } from './audio/denoise'
import Transport from './components/Transport'
import ChannelRack from './components/ChannelRack'
import PianoRoll from './components/PianoRoll'
import Mixer from './components/Mixer'
import FXRack from './components/FXRack'
import SynthEditor from './components/SynthEditor'
import PatternBar from './components/PatternBar'
import Arranger from './components/Arranger'
import MicRecorder, { Take } from './components/MicRecorder'
import RotateGate from './components/RotateGate'

type DockTab = 'mixer' | 'synth' | 'fx' | 'roll' | 'rec'
type RichTake = Take & {
  blob: Blob; seconds: number
  buffer?: AudioBuffer; origBuffer?: AudioBuffer
  origUrl?: string; origPeaks?: number[]; origBlob?: Blob
}

const CLIP_COLORS = ['#5b7cfa', '#e0518a', '#27b8a6', '#e9913a', '#9b6cf0', '#3aa6e9']

function computePeaks(buffer: AudioBuffer, n = 240): number[] {
  const ch = buffer.getChannelData(0)
  const block = Math.floor(ch.length / n) || 1
  const peaks: number[] = []
  for (let i = 0; i < n; i++) {
    let max = 0
    for (let j = 0; j < block; j++) { const v = Math.abs(ch[i * block + j] || 0); if (v > max) max = v }
    peaks.push(max)
  }
  return peaks
}

const uid = () => Math.random().toString(36).slice(2, 10)
const defaultMixer = (): MixerState => ({ volume: 0.8, pan: 0, mute: false, solo: false })
const emptyData = (): PatternData => ({ steps: [], notes: [] })

function makeTrack(presetId: string, index: number): Track {
  const isAudio = presetId === 'audio'
  const preset = getPreset(presetId)
  return {
    id: uid(),
    name: isAudio ? `Voice ${index}` : preset?.label ?? presetId,
    kind: isAudio ? 'audio' : preset?.kind ?? 'instrument',
    presetId,
    color: isAudio ? '#8d9bb5' : preset?.color ?? '#888',
    group: isAudio ? 'Audio' : preset?.group ?? null,
    mixer: defaultMixer(),
    fx: defaultFxChain(),
    synth: isAudio ? defaultSynthFor('bass') : defaultSynthFor(presetId),
  }
}

const note = (step: number, n: string, length = 1): { id: string; step: number; note: string; length: number; velocity: number } =>
  ({ id: uid(), step, note: n, length, velocity: 0.9 })

function seedProject(): ProjectState {
  const kick = makeTrack('kick', 0)
  const snare = makeTrack('snare', 0)
  const hat = makeTrack('hat-closed', 0)
  const bass = makeTrack('bass', 0)
  const data: Record<string, PatternData> = {
    [kick.id]: { steps: [true, false, false, false, true, false, false, false, true, false, false, false, true, false, false, false], notes: [] },
    [snare.id]: { steps: [false, false, false, false, true, false, false, false, false, false, false, false, true, false, false, false], notes: [] },
    [hat.id]: { steps: Array.from({ length: 16 }, (_, i) => i % 2 === 0), notes: [] },
    [bass.id]: { steps: [], notes: [note(0, 'C3', 2), note(6, 'C3'), note(8, 'D#3', 2), note(14, 'A#2')] },
  }
  const pattern: Pattern = { id: uid(), name: 'Pat 1', length: 16, data }
  return {
    bpm: 120, swing: 0, masterVolume: 0.85, metronome: false, mode: 'pattern',
    tracks: [kick, snare, hat, bass], patterns: [pattern], activePatternId: pattern.id,
    selectedTrackId: kick.id,
    arrangement: { lanes: 4, clips: [
      { id: uid(), lane: 0, type: 'pattern', refId: pattern.id, start: 0, length: 32, offset: 0, name: 'Pat 1', color: CLIP_COLORS[0] },
    ] },
  }
}

export default function StudioKapiPage() {
  const [project, setProject] = useState<ProjectState>(seedProject)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentStep, setCurrentStep] = useState(-1)
  const [dock, setDock] = useState<DockTab>('mixer')
  const [isRecording, setIsRecording] = useState(false)
  const [permissionError, setPermissionError] = useState<string | null>(null)
  const [takes, setTakes] = useState<RichTake[]>([])
  const [exporting, setExporting] = useState(false)
  const [level, setLevel] = useState(0)
  const [playhead, setPlayhead] = useState(0)
  const [octave, setOctave] = useState(4)
  const [cleaningId, setCleaningId] = useState<string | null>(null)
  const [dockWidth, setDockWidth] = useState(408)
  const dockDrag = useRef(false)
  const takeCount = useRef(0)
  const octaveRef = useRef(4)
  octaveRef.current = octave

  const engine = getEngine()

  // ─── undo / redo history ──────────────────────────────────────────────────────
  const past = useRef<ProjectState[]>([])
  const future = useRef<ProjectState[]>([])
  const committed = useRef<ProjectState>(project) // last snapshot recorded in history
  const commitTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const timeTravel = useRef(false)
  const [, setHistVer] = useState(0)

  // coalesce rapid edits (drags) into a single history entry
  useEffect(() => {
    if (timeTravel.current) { timeTravel.current = false; committed.current = project; return }
    if (project === committed.current) return
    clearTimeout(commitTimer.current)
    commitTimer.current = setTimeout(() => {
      past.current.push(committed.current)
      if (past.current.length > 120) past.current.shift()
      future.current = []
      committed.current = project
      setHistVer((v) => v + 1)
    }, 350)
  }, [project])

  const restore = useCallback((snap: ProjectState) => {
    timeTravel.current = true
    committed.current = snap
    setProject(snap)
    setHistVer((v) => v + 1)
    setTimeout(() => engine.rebuildAllFx(snap), 0)
  }, [engine])

  const undo = useCallback(() => {
    clearTimeout(commitTimer.current)
    if (project !== committed.current) { future.current.push(project); restore(committed.current); return }
    if (!past.current.length) return
    future.current.push(committed.current)
    restore(past.current.pop()!)
  }, [project, restore])

  const redo = useCallback(() => {
    clearTimeout(commitTimer.current)
    if (!future.current.length) return
    past.current.push(committed.current)
    restore(future.current.pop()!)
  }, [restore])

  const canUndo = past.current.length > 0 || project !== committed.current
  const canRedo = future.current.length > 0

  const activePattern = project.patterns.find((p) => p.id === project.activePatternId) ?? project.patterns[0]
  const activeData = activePattern?.data ?? {}
  const selected = project.tracks.find((t) => t.id === project.selectedTrackId) ?? null

  // A leftover transform on <main> (from a previous page's GSAP animation) turns
  // it into the containing block for our position:fixed root, collapsing it to
  // 0 height on client-side navigation (white screen). Clear it while mounted.
  useEffect(() => {
    const main = document.querySelector('main') as HTMLElement | null
    if (!main) return
    const prev = { transform: main.style.transform, willChange: main.style.willChange }
    main.style.transform = 'none'
    main.style.willChange = 'auto'
    return () => { main.style.transform = prev.transform; main.style.willChange = prev.willChange }
  }, [])

  useEffect(() => { engine.sync(project) }, [project, engine])
  useEffect(() => { engine.onStep = (st) => setCurrentStep(st); return () => { engine.onStep = null } }, [engine])
  useEffect(() => {
    if (!isPlaying) { setLevel(0); return }
    let raf = 0
    const tick = () => {
      setLevel(Math.max(0, Math.min(1, (engine.getLevel() + 60) / 60)))
      setPlayhead(engine.getPositionStep())
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [isPlaying, engine])
  useEffect(() => () => engine.dispose(), [engine])

  // ─── pattern data mutation ──────────────────────────────────────────────────
  const updateData = useCallback((trackId: string, fn: (d: PatternData) => PatternData) => {
    setProject((pr) => ({
      ...pr,
      patterns: pr.patterns.map((p) =>
        p.id !== pr.activePatternId ? p : { ...p, data: { ...p.data, [trackId]: fn(p.data[trackId] ?? emptyData()) } }),
    }))
  }, [])

  const patchTrack = useCallback((id: string, fn: (t: Track) => Track) => {
    setProject((pr) => ({ ...pr, tracks: pr.tracks.map((t) => (t.id === id ? fn(t) : t)) }))
  }, [])

  const selectTrack = useCallback((id: string) => setProject((pr) => ({ ...pr, selectedTrackId: id })), [])

  const toggleStep = useCallback((id: string, i: number) => {
    const track = project.tracks.find((t) => t.id === id)
    if (!track) return
    updateData(id, (d) => {
      if (track.kind === 'drum') {
        const steps = [...d.steps]; steps[i] = !steps[i]; return { ...d, steps }
      }
      const exists = d.notes.some((n) => n.step === i)
      const notes = exists ? d.notes.filter((n) => n.step !== i) : [...d.notes, note(i, 'C4')]
      return { ...d, notes }
    })
  }, [project.tracks, updateData])

  const toggleNote = useCallback((step: number, n: string) => {
    if (!project.selectedTrackId) return
    updateData(project.selectedTrackId, (d) => {
      const exists = d.notes.some((x) => x.step === step && x.note === n)
      const notes = exists ? d.notes.filter((x) => !(x.step === step && x.note === n)) : [...d.notes, note(step, n)]
      return { ...d, notes }
    })
  }, [project.selectedTrackId, updateData])

  const addTrack = useCallback((presetId: string) => {
    setProject((pr) => {
      const t = makeTrack(presetId, pr.tracks.filter((x) => x.kind === 'audio').length + 1)
      return { ...pr, tracks: [...pr.tracks, t], selectedTrackId: t.id }
    })
    setDock('synth')
  }, [])

  const deleteTrack = useCallback((id: string) => {
    engine.removeTrack(id)
    setProject((pr) => {
      const tracks = pr.tracks.filter((t) => t.id !== id)
      const patterns = pr.patterns.map((p) => { const data = { ...p.data }; delete data[id]; return { ...p, data } })
      return { ...pr, tracks, patterns, selectedTrackId: pr.selectedTrackId === id ? tracks[0]?.id ?? null : pr.selectedTrackId }
    })
  }, [engine])

  // ─── mixer / synth / fx ──────────────────────────────────────────────────────
  const setMixerField = useCallback(<K extends keyof MixerState>(id: string, key: K, value: MixerState[K]) => {
    patchTrack(id, (t) => ({ ...t, mixer: { ...t.mixer, [key]: value } }))
  }, [patchTrack])
  const toggleMute = useCallback((id: string) => patchTrack(id, (t) => ({ ...t, mixer: { ...t.mixer, mute: !t.mixer.mute } })), [patchTrack])
  const toggleSolo = useCallback((id: string) => patchTrack(id, (t) => ({ ...t, mixer: { ...t.mixer, solo: !t.mixer.solo } })), [patchTrack])

  const changeSynth = useCallback((patch: Partial<SynthParams>) => {
    const id = project.selectedTrackId
    if (!id) return
    patchTrack(id, (t) => ({ ...t, synth: { ...t.synth, ...patch } }))
  }, [project.selectedTrackId, patchTrack])

  const toggleFx = useCallback((type: FxType) => {
    const id = project.selectedTrackId
    if (!id) return
    setProject((pr) => {
      const tracks = pr.tracks.map((t) => t.id !== id ? t : { ...t, fx: t.fx.map((f) => f.type === type ? { ...f, enabled: !f.enabled } : f) })
      const nt = tracks.find((t) => t.id === id)
      if (nt) engine.rebuildFx(nt)
      return { ...pr, tracks }
    })
  }, [project.selectedTrackId, engine])

  const changeFx = useCallback((type: FxType, index: number, value: number) => {
    const id = project.selectedTrackId
    if (!id) return
    setProject((pr) => {
      const tracks = pr.tracks.map((t) => t.id !== id ? t : {
        ...t, fx: t.fx.map((f) => f.type === type ? { ...f, k: f.k.map((kv, i) => (i === index ? value : kv)) as [number, number, number] } : f),
      })
      const nt = tracks.find((t) => t.id === id)
      if (nt) engine.tweakFx(nt)
      return { ...pr, tracks }
    })
  }, [project.selectedTrackId, engine])

  const setSteps = useCallback((n: number) => {
    setProject((pr) => ({
      ...pr,
      patterns: pr.patterns.map((p) => p.id !== pr.activePatternId ? p : {
        ...p, length: n,
        data: Object.fromEntries(Object.entries(p.data).map(([k, d]) => [k, { steps: d.steps.slice(0, n), notes: d.notes.filter((x) => x.step < n) }])),
      }),
    }))
  }, [])

  // ─── patterns ────────────────────────────────────────────────────────────────
  const addPattern = useCallback(() => {
    setProject((pr) => {
      const p: Pattern = { id: uid(), name: `Pat ${pr.patterns.length + 1}`, length: activePattern?.length ?? 16, data: {} }
      return { ...pr, patterns: [...pr.patterns, p], activePatternId: p.id }
    })
  }, [activePattern])
  const renamePattern = useCallback((id: string, name: string) => {
    setProject((pr) => ({ ...pr, patterns: pr.patterns.map((p) => p.id === id ? { ...p, name } : p) }))
  }, [])
  const duplicatePatternById = useCallback((id: string) => {
    setProject((pr) => {
      const cur = pr.patterns.find((x) => x.id === id)
      if (!cur) return pr
      const data: Record<string, PatternData> = {}
      for (const [k, d] of Object.entries(cur.data)) data[k] = { steps: [...d.steps], notes: d.notes.map((n) => ({ ...n, id: uid() })) }
      const np: Pattern = { id: uid(), name: `${cur.name} copy`, length: cur.length, data }
      return { ...pr, patterns: [...pr.patterns, np], activePatternId: np.id }
    })
  }, [])
  const deletePattern = useCallback((id: string) => {
    setProject((pr) => {
      if (pr.patterns.length <= 1) return pr
      const patterns = pr.patterns.filter((p) => p.id !== id)
      return { ...pr, patterns, activePatternId: pr.activePatternId === id ? patterns[0].id : pr.activePatternId }
    })
  }, [])

  // ─── arrangement (song) ──────────────────────────────────────────────────────
  const setMode = useCallback((mode: DawMode) => { setProject((pr) => ({ ...pr, mode })); engine.stop(); setIsPlaying(false); setCurrentStep(-1) }, [engine])
  const patchArr = useCallback((fn: (a: ProjectState['arrangement']) => ProjectState['arrangement']) => {
    setProject((pr) => ({ ...pr, arrangement: fn(pr.arrangement) }))
  }, [])
  const addPatternClip = useCallback((patternId: string, lane: number, start: number) => {
    const pat = project.patterns.find((p) => p.id === patternId); if (!pat) return
    patchArr((a) => ({ ...a, clips: [...a.clips, { id: uid(), lane, type: 'pattern', refId: patternId, start, length: pat.length, offset: 0, name: pat.name, color: CLIP_COLORS[a.clips.length % CLIP_COLORS.length] }] }))
  }, [project.patterns, patchArr])
  const addTakeClip = useCallback((takeId: string, lane: number, start: number) => {
    const take = takes.find((t) => t.id === takeId); if (!take) return
    const stepSec = 60 / project.bpm / 4
    const length = Math.max(4, Math.round(take.seconds / stepSec))
    patchArr((a) => ({ ...a, clips: [...a.clips, { id: uid(), lane, type: 'audio', refId: takeId, start, length, offset: 0, name: take.name, color: '#8d9bb5' }] }))
  }, [takes, project.bpm, patchArr])
  const resizeClip = useCallback((id: string, length: number) => patchArr((a) => ({ ...a, clips: a.clips.map((c) => c.id === id ? { ...c, length } : c) })), [patchArr])
  const trimClip = useCallback((id: string, start: number, offset: number, length: number) => patchArr((a) => ({ ...a, clips: a.clips.map((c) => c.id === id ? { ...c, start, offset, length } : c) })), [patchArr])
  const splitClip = useCallback((id: string, atStep: number) => patchArr((a) => {
    const c = a.clips.find((x) => x.id === id)
    if (!c || atStep <= c.start || atStep >= c.start + c.length) return a
    const leftLen = atStep - c.start
    const left = { ...c, length: leftLen }
    const right = { ...c, id: uid(), start: atStep, offset: c.offset + leftLen, length: c.length - leftLen }
    return { ...a, clips: [...a.clips.filter((x) => x.id !== id), left, right] }
  }), [patchArr])
  const duplicateClip = useCallback((id: string) => patchArr((a) => {
    const c = a.clips.find((x) => x.id === id)
    if (!c) return a
    return { ...a, clips: [...a.clips, { ...c, id: uid(), start: c.start + c.length }] }
  }), [patchArr])
  const moveClips = useCallback((updates: { id: string; start: number; lane: number }[]) => patchArr((a) => ({
    ...a, clips: a.clips.map((c) => { const u = updates.find((x) => x.id === c.id); return u ? { ...c, start: u.start, lane: u.lane } : c }),
  })), [patchArr])
  const deleteClips = useCallback((ids: string[]) => patchArr((a) => ({ ...a, clips: a.clips.filter((c) => !ids.includes(c.id)) })), [patchArr])
  const addClips = useCallback((clips: Clip[]) => patchArr((a) => ({ ...a, clips: [...a.clips, ...clips] })), [patchArr])
  const addLane = useCallback(() => patchArr((a) => ({ ...a, lanes: a.lanes + 1 })), [patchArr])

  // ─── transport ───────────────────────────────────────────────────────────────
  const play = useCallback(async () => { await engine.play(); setIsPlaying(true) }, [engine])
  const stop = useCallback(() => { engine.stop(); setIsPlaying(false); setCurrentStep(-1); setPlayhead(0) }, [engine])
  const seek = useCallback((step: number) => { engine.seek(step); setPlayhead(step) }, [engine])
  const togglePlay = useCallback(() => { if (engine.isPlaying) stop(); else play() }, [engine, play, stop])
  const preview = useCallback((track: Track) => { engine.preview(track) }, [engine])
  const previewNote = useCallback((n: string) => { if (selected) engine.preview(selected, n) }, [engine, selected])

  // ─── mic ─────────────────────────────────────────────────────────────────────
  const startRec = useCallback(async () => {
    try { setPermissionError(null); await engine.start(); await engine.startMic(); setIsRecording(true) }
    catch { setPermissionError('Microphone permission denied.') }
  }, [engine])
  const stopRec = useCallback(async () => {
    const blob = await engine.stopMic(); setIsRecording(false)
    if (!blob.size) return
    takeCount.current += 1
    const id = uid()
    try {
      const buffer = await engine.decodeBlob(blob)
      engine.registerTake(id, buffer)
      const url = URL.createObjectURL(blob)
      const peaks = computePeaks(buffer)
      setTakes((ts) => [...ts, {
        id, url, name: `Voice ${takeCount.current}`, blob, seconds: buffer.duration, peaks,
        buffer, origBuffer: buffer, origUrl: url, origPeaks: peaks, origBlob: blob, cleaned: false,
      }])
    } catch {
      setTakes((ts) => [...ts, { id, url: URL.createObjectURL(blob), name: `Voice ${takeCount.current}`, blob, seconds: 2 }])
    }
  }, [engine])
  const onRecordClick = useCallback(() => { setDock('rec'); if (isRecording) stopRec(); else startRec() }, [isRecording, startRec, stopRec])
  const addTakeAsTrack = useCallback(async (take: Take) => {
    const rich = takes.find((t) => t.id === take.id)
    if (!rich) return
    const buffer = await engine.decodeBlob(rich.blob)
    setProject((pr) => {
      const t = makeTrack('audio', pr.tracks.filter((x) => x.kind === 'audio').length + 1)
      t.name = take.name; t.audioUrl = take.url
      engine.registerAudioBuffer(t.id, buffer)
      return { ...pr, tracks: [...pr.tracks, t], selectedTrackId: t.id }
    })
  }, [engine, takes])
  const deleteTake = useCallback((id: string) => {
    setTakes((ts) => { const t = ts.find((x) => x.id === id); if (t) URL.revokeObjectURL(t.url); return ts.filter((x) => x.id !== id) })
  }, [])

  // ─── noise reduction (Audacity-style spectral gating) ─────────────────────────
  const cleanTake = useCallback(async (id: string, reductionDb: number, sensitivity: number) => {
    const t = takes.find((x) => x.id === id)
    if (!t || !t.origBuffer) return
    setCleaningId(id)
    await new Promise((r) => setTimeout(r, 20)) // let the spinner paint before heavy DSP
    try {
      const cleaned = denoiseBuffer(t.origBuffer, engine.rawContext, { reductionDb, sensitivity })
      const blob = audioBufferToWav(cleaned)
      const url = URL.createObjectURL(blob)
      engine.registerTake(id, cleaned)
      setTakes((ts) => ts.map((x) => x.id === id ? { ...x, url, blob, peaks: computePeaks(cleaned), buffer: cleaned, cleaned: true } : x))
    } finally { setCleaningId(null) }
  }, [takes, engine])

  // ─── audio import (file picker + drag-drop) ───────────────────────────────────
  const decodeFileToTake = useCallback(async (file: File): Promise<RichTake | null> => {
    if (!file.type.startsWith('audio')) return null
    try {
      const arr = await file.arrayBuffer()
      const buffer = await (engine.rawContext as AudioContext).decodeAudioData(arr.slice(0))
      const id = uid()
      engine.registerTake(id, buffer)
      const blob = new Blob([arr], { type: file.type || 'audio/*' })
      const url = URL.createObjectURL(blob)
      const peaks = computePeaks(buffer)
      const name = (file.name.replace(/\.[^.]+$/, '') || 'Audio').slice(0, 22)
      const take: RichTake = { id, url, name, blob, seconds: buffer.duration, peaks, buffer, origBuffer: buffer, origUrl: url, origPeaks: peaks, origBlob: blob, cleaned: false }
      setTakes((ts) => [...ts, take])
      return take
    } catch { return null }
  }, [engine])

  const importToTakes = useCallback(async (files: FileList) => { for (const f of Array.from(files)) await decodeFileToTake(f) }, [decodeFileToTake])

  const importToTimeline = useCallback(async (files: FileList, lane: number, start: number) => {
    let i = 0
    for (const f of Array.from(files)) {
      const take = await decodeFileToTake(f)
      if (!take) continue
      const length = Math.max(4, Math.round(take.seconds / (60 / project.bpm / 4)))
      patchArr((a) => ({ ...a, clips: [...a.clips, { id: uid(), lane: lane + i, type: 'audio', refId: take.id, start, length, offset: 0, name: take.name, color: '#8d9bb5' }] }))
      i++
    }
  }, [decodeFileToTake, project.bpm, patchArr])

  const renameTake = useCallback((id: string, name: string) => setTakes((ts) => ts.map((t) => t.id === id ? { ...t, name } : t)), [])

  const revertTake = useCallback((id: string) => {
    const t = takes.find((x) => x.id === id)
    if (!t || !t.origBuffer) return
    engine.registerTake(id, t.origBuffer)
    setTakes((ts) => ts.map((x) => x.id === id ? { ...x, url: x.origUrl ?? x.url, blob: x.origBlob ?? x.blob, peaks: x.origPeaks ?? x.peaks, buffer: x.origBuffer, cleaned: false } : x))
  }, [takes, engine])

  const exportWav = useCallback(async () => {
    setExporting(true)
    try { downloadBlob(await engine.exportWav(project), 'studio-kapi-mix.wav') } finally { setExporting(false) }
  }, [engine, project])

  const toggleMetro = useCallback(() => setProject((pr) => ({ ...pr, metronome: !pr.metronome })), [])

  // resizable dock divider
  const onDividerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault(); (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); dockDrag.current = true
  }, [])
  const onDividerMove = useCallback((e: React.PointerEvent) => {
    if (!dockDrag.current) return
    setDockWidth(Math.max(300, Math.min(820, window.innerWidth - e.clientX)))
  }, [])
  const onDividerUp = useCallback(() => { dockDrag.current = false }, [])

  // ─── keyboard shortcuts + computer-keyboard piano ────────────────────────────
  const KEYMAP: Record<string, [string, number]> = {
    a: ['C', 0], w: ['C#', 0], s: ['D', 0], e: ['D#', 0], d: ['E', 0], f: ['F', 0],
    t: ['F#', 0], g: ['G', 0], y: ['G#', 0], h: ['A', 0], u: ['A#', 0], j: ['B', 0], k: ['C', 1],
  }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement
      const typing = el && (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA')
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') { e.preventDefault(); exportWav(); return }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return }
      if (typing) return
      if (e.code === 'Space') { e.preventDefault(); togglePlay(); return }
      if (e.repeat) return
      const key = e.key.toLowerCase()
      if (key === 'r') { onRecordClick(); return }
      if (key === 'm') { toggleMetro(); return }
      if (key === 'z') { setOctave((o) => Math.max(1, o - 1)); return }
      if (key === 'x') { setOctave((o) => Math.min(7, o + 1)); return }
      const m = KEYMAP[key]
      if (m && selected) { previewNote(`${m[0]}${octaveRef.current + m[1]}`) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [togglePlay, onRecordClick, toggleMetro, exportWav, previewNote, selected, undo, redo])

  const dockTabs: { id: DockTab; label: string }[] = [
    { id: 'mixer', label: 'Mixer' }, { id: 'synth', label: 'Synth' },
    { id: 'fx', label: 'FX' }, { id: 'roll', label: 'Roll' }, { id: 'rec', label: 'Rec' },
  ]

  return (
    <div className={s.root}>
      <Transport
        bpm={project.bpm} steps={activePattern?.length ?? 16} swing={project.swing} metronome={project.metronome}
        isPlaying={isPlaying} isRecording={isRecording} level={level} exporting={exporting}
        canUndo={canUndo} canRedo={canRedo} onUndo={undo} onRedo={redo}
        onPlay={play} onStop={stop} onRecordClick={onRecordClick}
        onBpm={(v) => { setProject((pr) => ({ ...pr, bpm: v })); engine.setBpm(v) }}
        onSteps={setSteps} onSwing={(v) => setProject((pr) => ({ ...pr, swing: v }))}
        onToggleMetro={toggleMetro} onExport={exportWav}
      />

      <PatternBar
        patterns={project.patterns} activeId={project.activePatternId} mode={project.mode} onMode={setMode}
        onSelect={(id) => setProject((pr) => ({ ...pr, activePatternId: id }))}
        onAdd={addPattern} onRename={renamePattern} onDuplicate={duplicatePatternById} onDelete={deletePattern}
      />

      <div className={s.body}>
        {project.mode === 'pattern' ? (
          <ChannelRack
            tracks={project.tracks} data={activeData} selectedTrackId={project.selectedTrackId}
            currentStep={currentStep} steps={activePattern?.length ?? 16}
            onSelect={selectTrack} onToggleStep={toggleStep} onMute={toggleMute} onSolo={toggleSolo}
            onOpenRoll={(id) => { selectTrack(id); setDock('roll') }}
            onOpenSynth={(id) => { selectTrack(id); setDock('synth') }}
            onDelete={deleteTrack} onAdd={addTrack} onPreview={preview}
          />
        ) : (
          <Arranger
            patterns={project.patterns} takes={takes} clips={project.arrangement.clips}
            lanes={project.arrangement.lanes} bpm={project.bpm} playhead={playhead} onSeek={seek}
            onMoveClips={moveClips} onResizeClip={resizeClip} onTrimClip={trimClip}
            onSplitClip={splitClip} onDuplicateClip={duplicateClip} onAddClips={addClips}
            onAddPatternClip={addPatternClip} onAddTakeClip={addTakeClip}
            onImportFiles={importToTimeline}
            onDeleteClips={deleteClips} onAddLane={addLane}
          />
        )}

        <div className={s.divider} onPointerDown={onDividerDown} onPointerMove={onDividerMove} onPointerUp={onDividerUp} title="Drag to resize">
          <span className={s.dividerGrip} />
        </div>

        <div className={s.dock} style={{ flex: `0 0 ${dockWidth}px` }}>
          <div className={s.panelHead}>
            <div className={s.tabs}>
              {dockTabs.map((tab) => (
                <button key={tab.id} className={`${s.tab} ${dock === tab.id ? s.active : ''}`} onClick={() => setDock(tab.id)}>{tab.label}</button>
              ))}
            </div>
            <span className={s.panelHint}>oct {octave} · z/x</span>
          </div>
          <div className={s.dockBody}>
            {dock === 'mixer' && (
              <Mixer
                tracks={project.tracks} selectedTrackId={project.selectedTrackId}
                masterVolume={project.masterVolume} level={level}
                onSelect={selectTrack} onVolume={(id, v) => setMixerField(id, 'volume', v)} onPan={(id, v) => setMixerField(id, 'pan', v)}
                onMute={toggleMute} onSolo={toggleSolo} onMaster={(v) => setProject((pr) => ({ ...pr, masterVolume: v }))}
              />
            )}
            {dock === 'synth' && <SynthEditor track={selected} onChange={changeSynth} />}
            {dock === 'fx' && <FXRack track={selected} onToggle={toggleFx} onChange={changeFx} />}
            {dock === 'roll' && (
              <PianoRoll track={selected} notes={selected ? activeData[selected.id]?.notes ?? [] : []}
                steps={activePattern?.length ?? 16} currentStep={currentStep} onToggleNote={toggleNote} onPreview={previewNote} />
            )}
            {dock === 'rec' && (
              <MicRecorder isRecording={isRecording} permissionError={permissionError} takes={takes}
                cleaningId={cleaningId} onClean={cleanTake} onRevert={revertTake} onRename={renameTake} onImport={importToTakes}
                onStart={startRec} onStop={stopRec} onAdd={addTakeAsTrack} onDelete={deleteTake} />
            )}
          </div>
        </div>
      </div>

      <RotateGate />
    </div>
  )
}
