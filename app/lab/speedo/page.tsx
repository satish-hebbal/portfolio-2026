'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { ArrowLeft, Volume2, VolumeX, Smartphone, Info, Music } from 'lucide-react'
import s from './speedo.module.css'
import Gauge, { GaugeHandle } from './components/Gauge'
import ArcMeter, { ArcMeterHandle } from './components/ArcMeter'
import { GaugeV8Handle } from './components/GaugeV8'
import V8Cluster from './components/V8Cluster'
import V10Cluster from './components/V10Cluster'
import EVCluster from './components/EVCluster'
import StartButton from './components/StartButton'
import { EngineSim, PRESETS } from './sim/engineSim'
import { EngineAudio } from './sim/engineAudio'
import { buildSong, type SongNote } from './sim/song'

const GEAR_LABEL = (g: number) => (g === 0 ? 'N' : String(g))

// key guide shown after the engine starts
const CONTROLS: { k: string; fn: string; wide?: boolean }[] = [
  { k: 'W', fn: 'throttle' },
  { k: 'S', fn: 'brake' },
  { k: 'E', fn: 'shift up' },
  { k: 'Q', fn: 'shift down' },
  { k: 'SPACE', fn: 'start / stop engine', wide: true },
]

// blend two hex colours (t: 0 → a, 1 → b) → 6-digit hex
const mixHex = (a: string, b: string, t: number) => {
  const pa = parseInt(a.replace('#', ''), 16), pb = parseInt(b.replace('#', ''), 16)
  const r = Math.round(((pa >> 16) & 255) + (((pb >> 16) & 255) - ((pa >> 16) & 255)) * t)
  const g = Math.round(((pa >> 8) & 255) + (((pb >> 8) & 255) - ((pa >> 8) & 255)) * t)
  const bl = Math.round((pa & 255) + ((pb & 255) - (pa & 255)) * t)
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1)
}

// dev-only: live engine-voice tuner panel (set true to bring it back)
const SHOW_TUNER = false

type Voice = { grunt: number; scream: number; noise: number; turbo: number }
const voicePayload = (p: (typeof PRESETS)[number], v: Voice) => ({
  cylinders: p.cylinders, grunt: v.grunt, scream: v.scream, noise: v.noise, turbo: v.turbo,
  ev: p.ev ? 1 : 0, redline: p.redline,
})

// per-engine UI theme — ascending aggression, EV = sci-fi
const THEMES: Record<string, { glow: string; arc: string; redline: string; tick: string; screen: string; mode: string }> = {
  'Inline-4': { glow: '#36a8ff', arc: '#5cc8ff', redline: '#ff5a3c', tick: '#dfe6ee', screen: '#bfe0ff', mode: 'ECO' },
  'V8':       { glow: '#ff9d2f', arc: '#ffc24d', redline: '#ff3b2a', tick: '#f1ebdf', screen: '#ffdca6', mode: 'SPORT+' },
  'V10':      { glow: '#ff4a24', arc: '#ff7a3c', redline: '#ff1f1f', tick: '#f6ece6', screen: '#ffc2b0', mode: 'RACE' },
  'EV':       { glow: '#8a6cff', arc: '#5ce0ff', redline: '#b06cff', tick: '#e9e6ff', screen: '#cfc6ff', mode: 'VOLT' },
}

export default function SpeedoPage() {
  // Render the immersive cluster in a portal on document.body. The global
  // navbar leaves a transform on <main> (GSAP page transition) which would
  // otherwise trap our position:fixed root inside a 0-height ancestor.
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  const [started, setStarted] = useState(false)
  const [showControls, setShowControls] = useState(false) // key-guide popup after start
  const [engineOn, setEngineOn] = useState(false)
  const [lit, setLit] = useState(false) // backlight/glow powered (fades in/out)
  const [intro, setIntro] = useState(false) // startup self-test: glitch logo on the screen
  const [muted, setMuted] = useState(false)
  const [songOn, setSongOn] = useState(false) // Happy Birthday melody playing

  // melody-player state (drives audio rpm directly while playing)
  const songRef = useRef<{ playing: boolean; notes: SongNote[]; t0: number }>({ playing: false, notes: [], t0: 0 })

  // power sequence state machine (drives gauge sweep + audio spin-down)
  const phaseRef = useRef<'off' | 'startup' | 'running' | 'shutdown'>('off')
  const phaseStartRef = useRef(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const edgeGlowRef = useRef<HTMLDivElement>(null) // red "on the limit" edge vignette
  const [presetIdx, setPresetIdx] = useState(0)
  const [gear, setGear] = useState(0)

  // TEMP sound tuner — live per-engine voice (grunt / scream)
  const [voices, setVoices] = useState<Record<string, { grunt: number; scream: number; noise: number; turbo: number }>>(() =>
    Object.fromEntries(PRESETS.map((p) => [p.name, { grunt: p.grunt, scream: p.scream, noise: p.noise, turbo: p.turbo }])),
  )
  const voicesRef = useRef(voices)
  voicesRef.current = voices
  // safe accessor — falls back to the preset's own values if an override is missing
  const voiceOf = (p: (typeof PRESETS)[number]): Voice =>
    voicesRef.current[p.name] ?? { grunt: p.grunt, scream: p.scream, noise: p.noise, turbo: p.turbo }

  const simRef = useRef<EngineSim | null>(null)
  const audioRef = useRef<EngineAudio | null>(null)
  const tachRef = useRef<GaugeHandle>(null)
  const speedoRef = useRef<GaugeHandle>(null)
  const tempMeterRef = useRef<ArcMeterHandle>(null)
  const fuelMeterRef = useRef<ArcMeterHandle>(null)
  // V8 cluster has its own dial set (only one cluster mounts at a time)
  const v8TachRef = useRef<GaugeV8Handle>(null)
  const v8SpeedoRef = useRef<GaugeV8Handle>(null)
  const v8TempRef = useRef<GaugeV8Handle>(null)
  const v8FuelRef = useRef<GaugeV8Handle>(null)
  const v10TempLadderRef = useRef<HTMLDivElement>(null) // V10 left-panel coolant-temp ladder
  const v10PowerRef = useRef<HTMLSpanElement>(null)
  const v10TorqueRef = useRef<HTMLSpanElement>(null)
  const v10PowerGaugeRef = useRef<GaugeHandle>(null)
  const v10TorqueGaugeRef = useRef<GaugeHandle>(null)
  const v10GDotRef = useRef<HTMLDivElement>(null)
  const v10GTopRef = useRef<HTMLSpanElement>(null)
  const v10GBotRef = useRef<HTMLSpanElement>(null)

  // hot DOM refs (updated every frame without React re-render)
  const speedNumRef = useRef<HTMLSpanElement>(null)
  const gearElRef = useRef<HTMLDivElement>(null)
  const brakeTellRef = useRef<HTMLDivElement>(null)
  const shiftTellRef = useRef<HTMLDivElement>(null)
  const odoRef = useRef<HTMLSpanElement>(null)
  const avgRef = useRef<HTMLSpanElement>(null)
  const rangeRef = useRef<HTMLSpanElement>(null)
  // EV cluster refs
  const evBattRef = useRef<HTMLSpanElement>(null)
  const evBattFillRef = useRef<HTMLSpanElement>(null)
  const evPowerRef = useRef<HTMLSpanElement>(null)
  const evFramesRef = useRef<HTMLDivElement>(null)

  // pedal input refs
  const gasDown = useRef(false)
  const brakeDown = useRef(false)
  const [gasPressed, setGasPressed] = useState(false)
  const [brakePressed, setBrakePressed] = useState(false)

  // lazily create sim/audio
  if (!simRef.current) simRef.current = new EngineSim()
  if (!audioRef.current) audioRef.current = new EngineAudio()

  const preset = PRESETS[presetIdx]
  const tachMax = Math.ceil(preset.redline / 1000) * 1000
  const theme = THEMES[preset.name] ?? THEMES.V8
  const isV8 = preset.name === 'V8'
  const isV10 = preset.name === 'V10'
  const isEV = preset.name === 'EV'

  // ── main simulation + render loop ──
  useEffect(() => {
    let raf = 0
    let last = performance.now()
    let odo = 0
    let temp = 0.42 // coolant temp 0..1, warms with load, cools at idle
    let fuel = 0.74 // tank level 0..1, drains while the engine runs under load
    let tripDist = 0 // km since start (for average speed)
    let tripTime = 0 // s the engine has been running
    let lastTempIdx = -1 // last lit pill on the V10 temp ladder
    let lastSpeedMs = 0 // for the V10 G-meter (longitudinal g)
    let gSmooth = 0
    let evPhase = 0 // EV tunnel: marches inward, faster with speed
    const loop = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now
      const sim = simRef.current!
      sim.gasInput = gasDown.current ? 1 : 0
      sim.brakeInput = brakeDown.current ? 1 : 0
      sim.update(dt)
      const st = sim.getState()

      // ── melody player: resolve the note being sung right now, so both the
      // tach needle and the audio land on its exact rpm (feels live) ──
      let songRpm = -1 // -1 = not playing
      let songSounding = false
      const song = songRef.current
      if (song.playing) {
        const t = (now - song.t0) / 1000
        if (t < 0) { songRpm = preset.idle; songSounding = false }
        else {
          let acc = 0, idx = 0
          for (; idx < song.notes.length; idx++) {
            if (t < acc + song.notes[idx].dur) break
            acc += song.notes[idx].dur
          }
          if (idx >= song.notes.length) {
            song.playing = false
            audioRef.current?.setSongGain(1)
            setSongOn(false)
          } else {
            songRpm = song.notes[idx].rpm
            songSounding = (t - acc) < song.notes[idx].dur * 0.78
          }
        }
      }

      // ── power sequence: gauge self-test sweep on start, spin-down on stop ──
      let tachVal = st.rpm
      let speedoVal = st.speedKmh
      const phase = phaseRef.current
      if (phase === 'startup') {
        const el = now - phaseStartRef.current
        let frac = 0
        if (el < 600) frac = el / 600              // needles rise to full
        else if (el < 880) frac = 1                // hold pegged
        else if (el < 1550) frac = 1 - (el - 880) / 670 // sweep back down
        else { phaseRef.current = 'running'; frac = -1; setIntro(false) } // needle home → show info
        if (frac >= 0) { tachVal = frac * tachMax; speedoVal = frac * 260 }
      } else if (phase === 'shutdown') {
        // needles follow the engine's natural rpm decay; once stopped, silence
        if (st.rpm <= 1) {
          phaseRef.current = 'off'
          audioRef.current?.setRunning(false)
        }
      }

      // while a song plays, the tach needle jumps to the rpm of each note so you
      // can watch the melody being played on the gauge in real time
      if (songRpm >= 0) tachVal = songRpm

      tachRef.current?.setValue(tachVal)
      speedoRef.current?.setValue(speedoVal)
      v8TachRef.current?.setValue(tachVal / 1000) // V8 tach dial is in ×1000
      v8SpeedoRef.current?.setValue(speedoVal)

      // edges redden as the engine is pushed hard — near the redline (any gear)
      // or at high speed. every engine gets this "on the limit" glow. we write
      // opacity straight onto the vignette's own layer (cheap, GPU-composited)
      // rather than mutating a root CSS var, which would force a style recalc of
      // the whole cluster subtree every frame and tank the fps at speed.
      {
        const revF = Math.max(0, (st.rpm / preset.redline - 0.82) / 0.18) // 82%→redline
        const spdF = Math.max(0, (speedoVal - 150) / 90)                  // 150→240 km/h
        const f = Math.pow(Math.min(1, Math.max(revF, spdF)), 0.8)
        if (edgeGlowRef.current) edgeGlowRef.current.style.opacity = (f * 0.85).toFixed(3)
        // V8 also blends its dial backlight halos toward red as it intensifies.
        // these do read the root CSS vars, but only in V8 mode (lighter subtree).
        if (isV8 && rootRef.current) {
          rootRef.current.style.setProperty('--glowI', f.toFixed(3))
          rootRef.current.style.setProperty('--glow', mixHex(theme.glow, theme.redline, f))
        }
      }

      if (speedNumRef.current) speedNumRef.current.textContent = String(Math.round(speedoVal))
      odo += (st.speedKmh / 3.6) * dt / 1000
      if (odoRef.current) odoRef.current.textContent = (590 + odo).toFixed(1)

      // coolant temperature: target tracks engine load (rpm / throttle); heats
      // faster than it cools, so it climbs under sustained revs and eases at idle
      const running = simRef.current!.ignition
      const load = running ? Math.min(1, Math.max(st.rpm / preset.redline, st.throttle)) : 0
      const tempTarget = (running ? 0.46 : 0.3) + 0.42 * load
      temp += (tempTarget - temp) * Math.min(1, (tempTarget > temp ? 0.22 : 0.1) * dt)
      tempMeterRef.current?.setValue(temp)
      v8TempRef.current?.setValue(temp)
      // V10 left-panel: light the pill nearest the current temp (top=hot 130)
      if (v10TempLadderRef.current) {
        const pills = v10TempLadderRef.current.children
        const n = pills.length
        const idx = Math.min(n - 1, Math.max(0, Math.round((1 - temp) * (n - 1))))
        if (idx !== lastTempIdx) {
          // fill sequentially: the active pill and everything below it light up
          for (let i = 0; i < n; i++) pills[i].classList.toggle(s.v10pillOn, i >= idx)
          lastTempIdx = idx
        }
      }

      // fuel burn: idle draw + extra under throttle/revs (engine running only)
      if (running) fuel = Math.max(0, fuel - (0.0006 + 0.006 * st.throttle * load) * dt)
      fuelMeterRef.current?.setValue(fuel)
      v8FuelRef.current?.setValue(fuel)

      // ── V10 inner-screen readouts (cheap DOM writes) ──
      // power %: rises with revs under throttle; torque %: tracks engine load
      const powerPct = running ? Math.round(Math.min(100, (st.rpm / preset.redline) * (0.25 + 0.75 * st.throttle) * 100)) : 0
      const torquePct = running ? Math.round(Math.min(100, load * 100)) : 0
      if (v10PowerRef.current) v10PowerRef.current.textContent = String(powerPct)
      if (v10TorqueRef.current) v10TorqueRef.current.textContent = String(torquePct)
      v10PowerGaugeRef.current?.setValue(powerPct)
      v10TorqueGaugeRef.current?.setValue(torquePct)
      // G-meter: longitudinal g from acceleration (lateral stays 0)
      const curMs = st.speedKmh / 3.6
      const gRaw = dt > 0 ? (curMs - lastSpeedMs) / dt / 9.81 : 0
      lastSpeedMs = curMs
      gSmooth += (gRaw - gSmooth) * 0.12
      if (v10GDotRef.current) {
        const gy = Math.max(-16, Math.min(16, gSmooth * 11)) // accel → dot back/down
        v10GDotRef.current.style.transform = `translate(-50%, calc(-50% + ${gy.toFixed(1)}px))`
      }
      // labels: bottom = acceleration g (pushed back), top = braking g (thrown forward)
      const gMag = Math.min(2, Math.abs(gSmooth))
      if (v10GBotRef.current) v10GBotRef.current.textContent = (gSmooth > 0 ? gMag : 0).toFixed(1)
      if (v10GTopRef.current) v10GTopRef.current.textContent = (gSmooth < 0 ? gMag : 0).toFixed(1)

      // ── EV cluster readouts: battery % (reuses fuel as charge) + motor kW ──
      if (evBattRef.current) evBattRef.current.textContent = String(Math.round(fuel * 100))
      if (evBattFillRef.current) evBattFillRef.current.style.width = (fuel * 100).toFixed(1) + '%'
      if (evPowerRef.current) {
        const kw = running
          ? st.throttle > 0.02 ? Math.round((powerPct / 100) * 250)              // drawing power
          : st.brake > 0.02 && st.speedKmh > 2 ? -Math.round(Math.min(70, st.speedKmh * 0.85)) // regen
          : 0
          : 0
        evPowerRef.current.textContent = kw > 0 ? '+' + kw : String(kw)
      }

      // ── EV tunnel: sharp rectangles marching toward the centre. The faster
      // you go, the quicker they recede and the brighter they glow, so it reads
      // as an infinite mirror pulling you inward. ──
      if (isEV && evFramesRef.current) {
        const v = Math.max(0, speedoVal)
        // idle drift + a march that quickens steeply toward top speed
        evPhase += (0.05 + Math.pow(Math.min(1, v / 220), 0.85) * 1.5) * dt
        evPhase -= Math.floor(evPhase)
        const intensity = Math.min(1, v / 150) // glow ramps to full by ~150 km/h
        const kids = evFramesRef.current.children
        const N = kids.length
        for (let k = 0; k < N; k++) {
          const el = kids[k] as HTMLElement
          const p = (evPhase + k / N) % 1            // 0 = born at the rim, 1 = gone at centre
          const scale = 1 - p                        // shrinks inward toward the vanishing point
          // fade in just off the rim, fade out into the centre
          const fade = Math.min(1, p / 0.14) * Math.min(1, (1 - p) / 0.22)
          el.style.transform = `scale(${scale.toFixed(4)})`
          // lines actually dim a touch as speed climbs, so the fast motion stays calm
          el.style.opacity = (fade * (0.3 - 0.1 * intensity)).toFixed(3)
        }
        // soft glow that eases in only slightly with speed (kept gentle to avoid flicker)
        evFramesRef.current.style.setProperty('--evGlow', (0.12 + intensity * 0.23).toFixed(3))
      }

      // ── trip computer: average speed + estimated range ──
      if (running) {
        tripTime += dt
        tripDist += (st.speedKmh / 3600) * dt
        const avg = tripTime > 1 ? (tripDist / (tripTime / 3600)) : 0
        if (avgRef.current) avgRef.current.textContent = String(Math.round(avg))
        // ~580 km on a full tank, scaled by current fuel level
        if (rangeRef.current) rangeRef.current.textContent = String(Math.round(fuel * 580))
      }

      if (gearElRef.current) gearElRef.current.classList.toggle(s.limit, st.atLimiter)
      if (brakeTellRef.current) brakeTellRef.current.classList.toggle(s.lit, st.brake > 0.05)
      if (shiftTellRef.current) shiftTellRef.current.classList.toggle(s.lit, st.rpm > preset.redline * 0.9)

      // drive the audio: melody notes while a song plays (pulsing the gain
      // between notes so repeats re-articulate), otherwise the live engine
      if (songRpm >= 0) {
        audioRef.current?.update(songRpm, songSounding ? 0.85 : 0, 0)
        audioRef.current?.setSongGain(songSounding ? 1 : 0)
      } else {
        audioRef.current?.update(st.rpm, st.throttle, st.brake)
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [preset])

  useEffect(() => () => audioRef.current?.dispose(), [])

  const beginStartup = useCallback(async () => {
    // kick the visual sequence off immediately (gauge sweep + glow fade-in)
    phaseStartRef.current = performance.now()
    phaseRef.current = 'startup'
    simRef.current!.ignition = true
    setStarted(true)
    setEngineOn(true)
    setLit(true)
    setIntro(true) // glitch logo while the needles sweep out and back
    await audioRef.current?.start()
    audioRef.current?.setVoice(voicePayload(preset, voiceOf(preset)))
    audioRef.current?.setRunning(true)
  }, [preset])

  const beginShutdown = useCallback(() => {
    phaseStartRef.current = performance.now()
    phaseRef.current = 'shutdown'
    simRef.current!.ignition = false // engine spins down naturally
    setEngineOn(false)
    setLit(false)
    setIntro(false)
    // a song can't play on a dead engine
    if (songRef.current.playing) { songRef.current.playing = false; audioRef.current?.setSongGain(1); setSongOn(false) }
    // keep audio "running" so it pitches down with the falling rpm; the loop
    // calls setRunning(false) for a clean cut once the engine reaches 0 rpm
  }, [])

  const toggleEngine = useCallback(() => {
    const p = phaseRef.current
    if (p === 'off' || p === 'shutdown') beginStartup()
    else beginShutdown()
  }, [beginStartup, beginShutdown])

  const toggleMute = useCallback(() => {
    setMuted((m) => { audioRef.current?.setMuted(!m); return !m })
  }, [])

  const stopSong = useCallback(() => {
    songRef.current.playing = false
    audioRef.current?.setSongGain(1)
    setSongOn(false)
  }, [])

  // play (or stop) Happy Birthday on the currently-selected engine
  const toggleSong = useCallback(async () => {
    if (songRef.current.playing) { stopSong(); return }
    // make sure the engine is running so there's a voice to play it on
    if (phaseRef.current === 'off' || phaseRef.current === 'shutdown') {
      await beginStartup()
    } else if (!audioRef.current?.isReady) {
      await audioRef.current?.start()
    }
    songRef.current = { playing: true, notes: buildSong(preset), t0: performance.now() + 250 }
    setSongOn(true)
  }, [preset, beginStartup, stopSong])

  const choosePreset = useCallback((i: number) => {
    // switching engines mid-song would mix tunings — stop it
    if (songRef.current.playing) { songRef.current.playing = false; audioRef.current?.setSongGain(1); setSongOn(false) }
    setPresetIdx(i)
    const p = PRESETS[i]
    simRef.current?.setPreset(p)
    audioRef.current?.setVoice(voicePayload(p, voiceOf(p)))
    // EVs are single-speed: default to Drive (driveline engaged) so the car
    // pulls on throttle immediately and the cluster reads "D" instead of "N"
    const initGear = p.ev ? 1 : 0
    simRef.current?.setGear(initGear)
    setGear(initGear)
  }, [])

  // TEMP: live-tune the current engine's sound
  const setVoiceParam = useCallback((param: 'grunt' | 'scream' | 'noise' | 'turbo', val: number) => {
    setVoices((prev) => {
      const base = prev[preset.name] ?? { grunt: preset.grunt, scream: preset.scream, noise: preset.noise, turbo: preset.turbo }
      const nextVoice = { ...base, [param]: val }
      audioRef.current?.setVoice(voicePayload(preset, nextVoice))
      return { ...prev, [preset.name]: nextVoice }
    })
  }, [preset])
  const logVoices = useCallback(() => {
    // eslint-disable-next-line no-console
    console.log('ENGINE VOICES\n' + JSON.stringify(voicesRef.current, null, 2))
  }, [])

  const shiftUp = useCallback(() => {
    simRef.current?.shiftUp()
    setGear(simRef.current!.gear)
  }, [])
  const shiftDown = useCallback(() => {
    simRef.current?.shiftDown()
    setGear(simRef.current!.gear)
  }, [])

  // ── keyboard controls ──
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.repeat) return
      const k = e.key
      if (k === 'ArrowUp' || k === 'w' || k === 'W') { gasDown.current = true; setGasPressed(true); e.preventDefault() }
      else if (k === 'ArrowDown' || k === 's' || k === 'S') { brakeDown.current = true; setBrakePressed(true); e.preventDefault() }
      else if (k === ' ') { toggleEngine(); e.preventDefault() }
      else if (k === 'ArrowRight' || k === 'e' || k === 'E') { shiftUp(); e.preventDefault() }
      else if (k === 'ArrowLeft' || k === 'q' || k === 'Q') { shiftDown(); e.preventDefault() }
    }
    const up = (e: KeyboardEvent) => {
      const k = e.key
      if (k === 'ArrowUp' || k === 'w' || k === 'W') { gasDown.current = false; setGasPressed(false) }
      else if (k === 'ArrowDown' || k === 's' || k === 'S') { brakeDown.current = false; setBrakePressed(false) }
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up) }
  }, [shiftUp, shiftDown, toggleEngine])

  const pressGas = (v: boolean) => { gasDown.current = v; setGasPressed(v) }
  const pressBrake = (v: boolean) => { brakeDown.current = v; setBrakePressed(v) }

  if (!mounted) return null

  return createPortal(
    <div ref={rootRef} className={`${s.root} ${lit ? '' : s.dim}`} style={{ '--glow': theme.glow, '--screen': theme.screen, '--edge': theme.redline } as React.CSSProperties}>
      <div ref={edgeGlowRef} className={s.edgeGlow} aria-hidden />
      <div className={s.topbar}>
        <span className={s.topRail} aria-hidden />
        <Link href="/lab" className={s.backLink} aria-label="Back to Lab">
          <span className={s.backIcon}><ArrowLeft size={15} strokeWidth={2.4} /></span>
          <span className={s.backSa} role="img" aria-label="SA" />
          <span className={s.backText}>Lab</span>
        </Link>
        <div className={`${s.brand} ${engineOn ? s.brandLit : ''}`}>
          <span className={s.brandWrap}>
            <img className={s.brandLogo} src="/lab/speedo/img-assets/speedo-sim-logo.svg" alt="Speedoo Simulation" />
            <span className={s.brandShine} aria-hidden />
          </span>
        </div>
        <div className={s.topRight}>
          <div className={`${s.engineBar} ${engineOn ? s.on : ''}`}>
            <span className={s.engineLabel}>{engineOn ? 'ENGINE ON' : 'ENGINE OFF'}</span>
            <span className={s.engineSocket}>
              <StartButton variant="top" on={engineOn} onClick={toggleEngine}
                tooltip="Hold the spacebar to start or turn off the engine"
                ariaLabel={engineOn ? 'Turn engine off' : 'Turn engine on'} />
            </span>
          </div>
          <span className={s.barLink} aria-hidden />
          <div className={`${s.soundBar} ${!muted && started ? s.on : ''}`}>
            <button className={s.barIcon} onClick={() => setShowControls(true)} aria-label="Controls" title="Controls">
              <Info size={14} />
            </button>
            <button className={`${s.barIcon} ${s.soundIcon}`} onClick={toggleMute}
              aria-label="Mute" title={muted ? 'Sound off' : 'Sound on'}>
              {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
            </button>
            <button className={`${s.barIcon} ${s.songIcon} ${songOn ? s.songOn : ''}`} onClick={toggleSong}
              aria-label="Play Happy Birthday on the engine" title={songOn ? 'Stop melody' : 'Play Happy Birthday on this engine'}>
              <Music size={14} />
            </button>
          </div>
        </div>
      </div>

      <div className={s.stage}>
        <div className={`${s.cluster} ${isV10 ? s.clusterV10 : ''}`}>
          {isV10 ? (
            <V10Cluster theme={theme} powered={lit} intro={intro}
              tachMax={tachMax} redlineStart={preset.limiter} gearLabel={GEAR_LABEL(gear)}
              tachRef={tachRef} speedNumRef={speedNumRef} gearElRef={gearElRef}
              tempLadderRef={v10TempLadderRef} powerRef={v10PowerRef} torqueRef={v10TorqueRef}
              powerGaugeRef={v10PowerGaugeRef} torqueGaugeRef={v10TorqueGaugeRef}
              gDotRef={v10GDotRef} gTopRef={v10GTopRef} gBotRef={v10GBotRef} rangeRef={rangeRef} />
          ) : isV8 ? (
            <V8Cluster
              tachMax={tachMax} theme={theme} presetName={preset.name} gear={gear} gearLabel={GEAR_LABEL(gear)}
              powered={lit} intro={intro}
              tachRef={v8TachRef} speedoRef={v8SpeedoRef} tempRef={v8TempRef} fuelRef={v8FuelRef}
              gearElRef={gearElRef} odoRef={odoRef} speedNumRef={speedNumRef}
              shiftTellRef={shiftTellRef} brakeTellRef={brakeTellRef}
              avgRef={avgRef} rangeRef={rangeRef}
            />
          ) : isEV ? (
            <EVCluster theme={theme} powered={lit} gearLabel={GEAR_LABEL(gear)}
              speedNumRef={speedNumRef} battRef={evBattRef} battFillRef={evBattFillRef}
              powerRef={evPowerRef} rangeRef={rangeRef} framesRef={evFramesRef} />
          ) : (
          <div className={s.binnacle}>
            <div className={s.hood} />
            <div className={s.podRow}>
              {/* LEFT POD — tachometer */}
              <div className={`${s.pod} ${s.podLeft}`}>
                <span className={s.podRing} />
                <Gauge key={`tach-${presetIdx}`} ref={tachRef} size={330} min={0} max={tachMax}
                  majorStep={1000} minorPerMajor={4} labelDivisor={1000}
                  unitSub="x1000 r/min" redlineStart={preset.limiter}
                  accent={theme.redline} arcColor={theme.arc} tickColor={theme.tick} smoothing={0.22} />
              </div>

              {/* CENTER — info LCD */}
              <div className={s.lcd}>
                <div className={`${s.arcMeter} ${s.arcLeft}`}>
                  <ArcMeter ref={tempMeterRef} side="left" kind="temp" value={0.46} topLabel="H" bottomLabel="C"
                    glow={theme.arc} icon={<ThermoIcon />} />
                </div>
                <div className={`${s.arcMeter} ${s.arcRight}`}>
                  <ArcMeter ref={fuelMeterRef} side="right" kind="fuel" value={0.74} topLabel="F" bottomLabel="E"
                    glow={theme.arc} icon={<FuelIcon />} />
                </div>
                <div className={s.lcdTop}>
                  <span className={s.lcdBrand}>{preset.name}</span>
                  <span className={s.lcdMode}>{theme.mode}</span>
                </div>
                <div ref={gearElRef} className={s.lcdGear}>{GEAR_LABEL(gear)}</div>
                <div className={s.lcdOdo}>ODO <span ref={odoRef}>590.0</span> km</div>
                <div className={s.lcdWarn}>
                  <span className={`${s.tell} ${s.amber} ${s.lit}`} title="ABS"><WarnIcon kind="abs" /></span>
                  <span ref={shiftTellRef} className={`${s.tell} ${s.amber}`} title="Engine"><WarnIcon kind="engine" /></span>
                  <span ref={brakeTellRef} className={`${s.tell} ${s.red}`} title="Brake"><WarnIcon kind="brake" /></span>
                  <span className={`${s.tell} ${s.red}`} title="Oil"><WarnIcon kind="oil" /></span>
                  <span className={`${s.tell} ${s.green} ${s.lit}`} title="Battery"><WarnIcon kind="batt" /></span>
                </div>
              </div>

              {/* RIGHT POD — speedometer */}
              <div className={`${s.pod} ${s.podRight}`}>
                <span className={s.podRing} />
                <Gauge ref={speedoRef} size={330} min={0} max={260} majorStep={20} minorPerMajor={2}
                  smoothing={0.12} accent={theme.redline} arcColor={theme.arc} tickColor={theme.tick} labelScale={0.68} />
                <div className={s.speedDigital}>
                  <div className={s.speedNum}><span ref={speedNumRef}>0</span></div>
                  <div className={s.speedUnit}>KM / H</div>
                </div>
              </div>
            </div>
          </div>
          )}
        </div>
      </div>

      {/* paddle shifters + pedals */}
      <div className={s.ctlLeft}>
        <button className={`${s.paddle} ${s.paddleDown}`} onClick={shiftDown} aria-label="Shift down">
          <span className={s.paddleSlot} />
          <span className={s.paddleSign}>–</span>
        </button>
        <button
          className={`${s.pedal} ${s.brake} ${brakePressed ? s.pressed : ''}`}
          onContextMenu={(e) => e.preventDefault()}
          onPointerDown={(e) => { e.preventDefault(); pressBrake(true) }}
          onPointerUp={() => pressBrake(false)} onPointerLeave={() => pressBrake(false)} onPointerCancel={() => pressBrake(false)}
        >
          <span className={s.pedalFill} style={{ height: brakePressed ? '100%' : '0%' }} />
          <span className={s.pedalLabel}>BRAKE</span>
        </button>
      </div>

      <div className={s.ctlRight}>
        <button className={`${s.paddle} ${s.paddleUp}`} onClick={shiftUp} aria-label="Shift up">
          <span className={s.paddleSlot} />
          <span className={s.paddleSign}>+</span>
        </button>
        <button
          className={`${s.pedal} ${s.gas} ${gasPressed ? s.pressed : ''}`}
          onContextMenu={(e) => e.preventDefault()}
          onPointerDown={(e) => { e.preventDefault(); pressGas(true) }}
          onPointerUp={() => pressGas(false)} onPointerLeave={() => pressGas(false)} onPointerCancel={() => pressGas(false)}
        >
          <span className={s.pedalFill} style={{ height: gasPressed ? '100%' : '0%' }} />
          <span className={s.pedalLabel}>GAS</span>
        </button>
      </div>

      {/* engine selector — dashboard switch cluster, flush to bottom edge */}
      <div className={s.engineCluster}>
        <div className={s.engineHead}>
          <svg className={s.engineScrew} width="16" height="16" viewBox="0 0 24 24" aria-hidden>
            <defs>
              <radialGradient id="screwHead" cx="38%" cy="32%" r="75%">
                <stop offset="0" stopColor="#f2f5f9" />
                <stop offset="0.5" stopColor="#b3b9c1" />
                <stop offset="1" stopColor="#565b64" />
              </radialGradient>
            </defs>
            <circle cx="12" cy="12" r="10" fill="url(#screwHead)" stroke="#2e323a" strokeWidth="1" />
            <circle cx="12" cy="12" r="9.2" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="0.6" />
            <g transform="rotate(30 12 12)">
              <rect x="3.5" y="10.5" width="17" height="3" rx="1.3" fill="#23272d" />
              <rect x="3.5" y="10.2" width="17" height="1" rx="0.5" fill="rgba(255,255,255,0.3)" />
            </g>
          </svg>
          <span className={s.engineLabel}>ENGINE</span>
        </div>
        <div className={s.presetRow}>
          {PRESETS.map((p, i) => (
            <button key={p.name} className={`${s.presetBtn} ${i === presetIdx ? s.active : ''}`} onClick={() => choosePreset(i)}>
              <span className={s.presetTxt}>{p.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* TEMP sound tuner — adjust grunt/scream live per engine (hidden for now) */}
      {SHOW_TUNER && (
      <div className={s.tunePanel}>
        {(() => {
          const tv = voices[preset.name] ?? { grunt: preset.grunt, scream: preset.scream, noise: preset.noise, turbo: preset.turbo }
          return (
            <>
              <div className={s.tuneHead}>SOUND TUNER · {preset.name}{preset.ev ? ' (EV)' : ''}</div>
              <div className={s.tuneRow}>
                <span>Grunt</span>
                <input type="range" min={0} max={1} step={0.01} value={tv.grunt}
                  onChange={(e) => setVoiceParam('grunt', parseFloat(e.target.value))} />
                <b>{tv.grunt.toFixed(2)}</b>
              </div>
              <div className={s.tuneRow}>
                <span>Scream</span>
                <input type="range" min={0} max={1} step={0.01} value={tv.scream}
                  onChange={(e) => setVoiceParam('scream', parseFloat(e.target.value))} />
                <b>{tv.scream.toFixed(2)}</b>
              </div>
              <div className={s.tuneRow}>
                <span>Air/Hiss</span>
                <input type="range" min={0} max={1.5} step={0.01} value={tv.noise}
                  onChange={(e) => setVoiceParam('noise', parseFloat(e.target.value))} />
                <b>{tv.noise.toFixed(2)}</b>
              </div>
              <div className={s.tuneRow}>
                <span>Turbo</span>
                <input type="range" min={0} max={1} step={0.01} value={tv.turbo}
                  onChange={(e) => setVoiceParam('turbo', parseFloat(e.target.value))} />
                <b>{tv.turbo.toFixed(2)}</b>
              </div>
            </>
          )
        })()}
        <div className={s.tuneHint}>rev with W · lift off boost for blow-off</div>
        <button className={s.tuneLog} onClick={logVoices}>Log all values → console</button>
      </div>
      )}

      {!started && (
        <div className={s.gate}>
          <img className={s.gateLogo} src="/lab/speedo/img-assets/speedo-sim-logo.svg" alt="Speedoo" />
          <div className={s.gateSub}>
            A hyper-real instrument cluster with a fully synthesised engine. Every rev, gearchange and bounce off the
            limiter is generated live from a physics model. Hold the gas, work the gears, listen.
          </div>
          <StartButton variant="gate" onClick={beginStartup} ariaLabel="Start engine" />
          <div className={s.gateKeys}>
            {CONTROLS.map((c) => (
              <div className={s.gateKey} key={c.k}>
                <span className={`${s.keyMini} ${c.wide ? s.keyMiniWide : ''}`}>{c.k}</span>
                <span className={s.gateKeyFn}>{c.fn}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {started && showControls && (
        <div className={s.controls} onClick={() => setShowControls(false)}>
          <div className={s.controlsCard} onClick={(e) => e.stopPropagation()}>
            <div className={s.controlsTitle}>controls</div>
            <div className={s.keyStage}>
              {/* keys laid out like a real keyboard: Q W E / S / SPACE */}
              <span className={`${s.key} ${s.kQ}`}>Q</span>
              <span className={`${s.key} ${s.kW}`}>W</span>
              <span className={`${s.key} ${s.kE}`}>E</span>
              <span className={`${s.key} ${s.kS}`}>S</span>
              <span className={`${s.key} ${s.keyWide} ${s.kSpace}`}>SPACE</span>

              <span className={`${s.func} ${s.fThrottle}`}>throttle</span>
              <span className={`${s.func} ${s.fDown}`}>shift down</span>
              <span className={`${s.func} ${s.fUp}`}>shift up</span>
              <span className={`${s.func} ${s.fBrake}`}>brake</span>
              <span className={`${s.func} ${s.fHand}`}>start / stop engine</span>

              {[s.aThrottle, s.aDown, s.aUp, s.aBrake, s.aHand].map((cls, i) => (
                <svg key={i} className={`${s.parr} ${cls}`} viewBox="0 0 70 28" aria-hidden>
                  <g stroke="#828a95" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 14 L53 14" />
                    <path d="M44 7 L55 14 L44 21" />
                  </g>
                </svg>
              ))}
            </div>
            <button className={s.controlsBtn} onClick={() => setShowControls(false)}>let’s drive</button>
          </div>
        </div>
      )}

      <div className={s.rotate}>
        <Smartphone size={52} strokeWidth={1.4} />
        <div style={{ fontSize: 18, fontWeight: 600, color: '#fff' }}>Rotate your device</div>
        <div style={{ fontSize: 13, color: '#9aa1b0', maxWidth: 260, lineHeight: 1.5 }}>
          Speedoo needs landscape space to lay out the full instrument cluster and controls.
        </div>
      </div>
    </div>,
    document.body,
  )
}

// ─── LCD glyphs ───
function ThermoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 14.76V5a2 2 0 0 0-4 0v9.76a4 4 0 1 0 4 0z" />
      <line x1="12" y1="9" x2="12" y2="15" />
    </svg>
  )
}

function FuelIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="3" width="9" height="18" rx="1" />
      <line x1="4.5" y1="11" x2="12.5" y2="11" />
      <path d="M13 8h3.2a2 2 0 0 1 2 2v5.5a1.5 1.5 0 0 0 3 0V9l-2.6-2.6" />
    </svg>
  )
}

function WarnIcon({ kind }: { kind: 'abs' | 'engine' | 'brake' | 'oil' | 'batt' }) {
  switch (kind) {
    case 'abs':
      return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="12" cy="12" r="9" /><text x="12" y="15" fontSize="7" textAnchor="middle" fill="currentColor" stroke="none">ABS</text></svg>
    case 'engine':
      return <svg viewBox="0 0 24 24" fill="currentColor"><path d="M5 9h2V7h3v2h4l2 2h3v5h-2v2h-4v-2H8l-3-3z" /></svg>
    case 'brake':
      return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="12" cy="12" r="8" /><text x="12" y="15.5" fontSize="9" fontWeight="700" textAnchor="middle" fill="currentColor" stroke="none">!</text><path d="M2.5 12h2.5M19 12h2.5" /></svg>
    case 'oil':
      return <svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 14c4 0 5-3 9-3l8 3v2H3z" /><circle cx="6.5" cy="11" r="1.4" /></svg>
    case 'batt':
      return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="3" y="8" width="18" height="9" rx="1.5" /><path d="M7 8V6h3v2M14 8V6h3v2M7.5 12.5h2M15.5 12.5h2M16.5 11.5v2" /></svg>
    default:
      return null
  }
}
