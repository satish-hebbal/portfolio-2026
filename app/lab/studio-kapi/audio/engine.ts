// Studio-Kapi — Tone.js audio engine (singleton)
import * as Tone from 'tone'
import type { Track, FxState, FxType, ProjectState, Pattern, SynthParams } from './types'
import { DRUM_SAMPLES, PIANO_SAMPLES, SYNTH_SPECS } from './presets'
import { audioBufferToWav } from './wav'

const SIXTEENTH_TICKS = () => Tone.getTransport().PPQ / 4
const clamp01 = (v: number) => Math.max(0, Math.min(1, v))
const logFreq = (v: number) => 80 * Math.pow(18000 / 80, clamp01(v)) // 80..18000 Hz

// Resolve per-lane mixer state (mute / solo / volume) for the arranger.
function laneAudibility(project: ProjectState) {
  const meta = project.arrangement.laneMeta ?? []
  const anySolo = meta.some((m) => m?.solo)
  return {
    audible: (lane: number) => {
      const m = meta[lane]
      if (m?.mute) return false
      if (anySolo) return !!m?.solo
      return true
    },
    gain: (lane: number) => {
      const m = meta[lane]
      return m ? m.volume : 1
    },
  }
}

// ─── instrument factory ───────────────────────────────────────────────────────
function makeInstrument(presetId: string, audioBuffer?: AudioBuffer): Tone.ToneAudioNode {
  if (DRUM_SAMPLES[presetId]) return new Tone.Player({ url: DRUM_SAMPLES[presetId], fadeOut: 0.01 })
  if (presetId === 'piano') return new Tone.Sampler({ urls: PIANO_SAMPLES, release: 0.8 })
  if (presetId === 'audio') return new Tone.Player({ url: audioBuffer, loop: false })
  const spec = SYNTH_SPECS[presetId]
  if (!spec) return new Tone.PolySynth(Tone.Synth)
  const o = spec.options as Record<string, unknown>
  switch (spec.voice) {
    case 'mono': return new Tone.MonoSynth(o)
    case 'fm': return new Tone.FMSynth(o)
    case 'am': return new Tone.AMSynth(o)
    case 'duo': return new Tone.DuoSynth(o)
    case 'pluck': return new Tone.PluckSynth(o)
    case 'poly':
    default: return new Tone.PolySynth(Tone.Synth, o)
  }
}

// Apply normalised synth macros to a live instrument + its dedicated filter.
function applySynthParams(inst: Tone.ToneAudioNode, filter: Tone.Filter, presetId: string, p: SynthParams) {
  filter.frequency.value = logFreq(p.cutoff)
  filter.Q.value = p.reso * 18

  if (inst instanceof Tone.Player) {
    inst.playbackRate = Math.pow(2, p.pitch) // +/- 1 octave
    inst.volume.value = Tone.gainToDb(p.gain)
    return
  }
  if (inst instanceof Tone.Sampler) {
    inst.volume.value = Tone.gainToDb(p.gain)
    return
  }
  const attack = 0.001 + p.attack * p.attack * 2
  const decay = 0.01 + p.decay * p.decay * 2
  const sustain = clamp01(p.sustain)
  const release = 0.01 + p.release * p.release * 3
  const detuneCents = p.detune * 100 + p.pitch * 1200
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyInst = inst as any
  try { anyInst.set({ envelope: { attack, decay, sustain, release } }) } catch {}
  try { anyInst.set({ oscillator: { type: p.wave } }) } catch {}
  try { anyInst.set({ detune: detuneCents }) } catch {}
  try { anyInst.set({ portamento: p.glide * 0.2 }) } catch {}
  try { anyInst.set({ volume: Tone.gainToDb(p.gain) }) } catch {}
}

// ─── effect factory + live params ─────────────────────────────────────────────
function makeFxNode(type: FxType): Tone.ToneAudioNode {
  switch (type) {
    case 'eq': return new Tone.EQ3()
    case 'filter': return new Tone.Filter({ type: 'lowpass' })
    case 'distortion': return new Tone.Distortion()
    case 'bitcrush': return new Tone.BitCrusher(8)
    case 'chorus': return new Tone.Chorus().start()
    case 'phaser': return new Tone.Phaser()
    case 'delay': return new Tone.FeedbackDelay()
    case 'reverb': return new Tone.Reverb()
    case 'compressor': return new Tone.Compressor()
  }
}

function setFxParams(node: Tone.ToneAudioNode, type: FxType, k: [number, number, number]) {
  const [a, b, c] = k
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const n = node as any
  switch (type) {
    case 'eq': n.low.value = (a - 0.5) * 24; n.mid.value = (b - 0.5) * 24; n.high.value = (c - 0.5) * 24; break
    case 'filter': n.frequency.value = logFreq(a); n.Q.value = b * 18; break
    case 'distortion': n.distortion = a; n.wet.value = b; break
    case 'bitcrush': n.bits.value = Math.max(1, Math.round(16 - a * 14)); n.wet.value = b; break
    case 'chorus': n.depth = a; n.frequency.value = 0.3 + b * 6; n.wet.value = c; break
    case 'phaser': n.frequency.value = 0.2 + a * 8; n.octaves = 1 + b * 5; n.wet.value = c; break
    case 'delay': n.delayTime.value = 0.03 + a * 0.6; n.feedback.value = b * 0.9; n.wet.value = c; break
    case 'reverb': n.decay = 0.3 + a * 8; n.preDelay = b * 0.1; n.wet.value = c; break
    case 'compressor': n.threshold.value = -60 + a * 60; n.ratio.value = 1 + b * 19; break
  }
}

interface LiveTrack {
  instrument: Tone.ToneAudioNode
  filter: Tone.Filter
  channel: Tone.Channel
  fxNodes: { type: FxType; node: Tone.ToneAudioNode }[]
  presetId: string
}

class KapiEngine {
  private started = false
  private live = new Map<string, LiveTrack>()
  private master: Tone.Channel | null = null
  private meter: Tone.Meter | null = null
  private click: Tone.Synth | null = null
  private repeatId: number | null = null
  private project: ProjectState | null = null
  private audioBuffers = new Map<string, AudioBuffer>()
  private takeBuffers = new Map<string, AudioBuffer>()
  private mediaRecorder: MediaRecorder | null = null
  private micChunks: Blob[] = []
  private micStream: MediaStream | null = null
  private micAnalyser: AnalyserNode | null = null
  private micSource: MediaStreamAudioSourceNode | null = null

  onStep: ((step: number) => void) | null = null

  private ensureMaster() {
    if (this.master) return
    this.master = new Tone.Channel().toDestination()
    this.meter = new Tone.Meter({ smoothing: 0.8 })
    this.master.connect(this.meter)
    this.click = new Tone.Synth({
      oscillator: { type: 'square' },
      envelope: { attack: 0.001, decay: 0.03, sustain: 0, release: 0.01 },
      volume: -10,
    }).toDestination()
  }

  async start() {
    this.ensureMaster()
    if (this.started) return
    await Tone.start()
    this.started = true
  }
  get isStarted() { return this.started }

  // Strictly increasing trigger time — avoids Tone's "start time must be
  // strictly greater than previous start time" when previews fire same-tick.
  private lastTrigger = 0
  private safeNow(): number {
    const t = Math.max(Tone.now(), this.lastTrigger + 0.0005)
    this.lastTrigger = t
    return t
  }

  private activePattern(): Pattern | undefined {
    return this.project?.patterns.find((p) => p.id === this.project!.activePatternId)
  }
  private patternData(pat: Pattern | undefined, trackId: string) {
    return pat?.data[trackId] ?? { steps: [], notes: [] }
  }

  // ─── per-track graph ──────────────────────────────────────────────────────
  private rebuildChain(lt: LiveTrack, fx: FxState[]) {
    lt.instrument.disconnect()
    lt.filter.disconnect()
    lt.fxNodes.forEach((f) => f.node.dispose())
    lt.fxNodes = fx.filter((f) => f.enabled).map((f) => {
      const node = makeFxNode(f.type)
      setFxParams(node, f.type, f.k)
      return { type: f.type, node }
    })
    const chain: Tone.ToneAudioNode[] = [lt.instrument, lt.filter, ...lt.fxNodes.map((f) => f.node), lt.channel]
    for (let i = 0; i < chain.length - 1; i++) chain[i].connect(chain[i + 1])
  }

  ensureTrack(track: Track) {
    this.ensureMaster()
    if (!this.master) return
    let lt = this.live.get(track.id)
    if (lt && lt.presetId !== track.presetId) { this.removeTrack(track.id); lt = undefined }
    if (!lt) {
      const instrument = makeInstrument(track.presetId, this.audioBuffers.get(track.id))
      const filter = new Tone.Filter({ type: 'lowpass', frequency: 18000 })
      const channel = new Tone.Channel().connect(this.master)
      lt = { instrument, filter, channel, fxNodes: [], presetId: track.presetId }
      this.live.set(track.id, lt)
      this.rebuildChain(lt, track.fx)
    }
    this.applyMixer(track)
    this.applySynth(track)
  }

  removeTrack(id: string) {
    const lt = this.live.get(id)
    if (!lt) return
    lt.fxNodes.forEach((f) => f.node.dispose())
    lt.instrument.dispose(); lt.filter.dispose(); lt.channel.dispose()
    this.live.delete(id)
  }

  applyMixer(track: Track) {
    const lt = this.live.get(track.id)
    if (!lt) return
    lt.channel.volume.value = track.mixer.volume <= 0.001 ? -Infinity : Tone.gainToDb(track.mixer.volume)
    lt.channel.pan.value = track.mixer.pan
    lt.channel.mute = track.mixer.mute
    lt.channel.solo = track.mixer.solo
  }

  applySynth(track: Track) {
    const lt = this.live.get(track.id)
    if (!lt) return
    applySynthParams(lt.instrument, lt.filter, track.presetId, track.synth)
  }

  rebuildFx(track: Track) {
    const lt = this.live.get(track.id)
    if (lt) this.rebuildChain(lt, track.fx)
  }

  // Reconcile every track's FX chain (used after undo/redo restores state).
  rebuildAllFx(project: ProjectState) {
    for (const t of project.tracks) this.rebuildFx(t)
  }

  tweakFx(track: Track) {
    const lt = this.live.get(track.id)
    if (!lt) return
    for (const f of lt.fxNodes) {
      const st = track.fx.find((x) => x.type === f.type)
      if (st) setFxParams(f.node, f.type, st.k)
    }
  }

  // ─── sequencing ───────────────────────────────────────────────────────────
  private songLength(project: ProjectState): number {
    const end = project.arrangement.clips.reduce((m, c) => Math.max(m, c.start + c.length), 0)
    return Math.max(end, 16)
  }

  sync(project: ProjectState) {
    this.ensureMaster()
    this.project = project
    const T = Tone.getTransport()
    T.bpm.value = project.bpm
    T.swing = project.swing
    T.swingSubdivision = '16n'
    if (this.master) this.master.volume.value = project.masterVolume <= 0.001 ? -Infinity : Tone.gainToDb(project.masterVolume)
    const len = project.mode === 'song' ? this.songLength(project) : (this.activePattern()?.length ?? 16)
    T.loop = true
    T.loopStart = 0
    T.loopEnd = `${len * SIXTEENTH_TICKS()}i`
    project.tracks.forEach((t) => this.ensureTrack(t))
    for (const id of this.live.keys()) if (!project.tracks.find((t) => t.id === id)) this.removeTrack(id)
    if (this.repeatId === null) this.scheduleLoop()
  }

  // Per-tick map of the last scheduled time for each node, so overlapping
  // clips never trigger the same voice at an equal time (Tone forbids it).
  private tickFired = new Map<Tone.ToneAudioNode, number>()
  private nextTime(node: Tone.ToneAudioNode, time: number): number {
    const last = this.tickFired.get(node)
    const t = last !== undefined && time <= last ? last + 0.002 : time
    this.tickFired.set(node, t)
    return t
  }

  // Trigger every track's hits for one pattern at a given local step.
  private firePatternStep(pat: Pattern | undefined, localStep: number, time: number, sixteenthSec: number) {
    if (!pat || !this.project) return
    for (const track of this.project.tracks) {
      const lt = this.live.get(track.id)
      if (!lt) continue
      const d = this.patternData(pat, track.id)
      if (track.kind === 'drum') {
        const pl = lt.instrument as Tone.Player
        if (d.steps[localStep] && pl.loaded) { try { pl.start(this.nextTime(pl, time)) } catch {} }
      } else if (track.kind === 'instrument') {
        const inst = lt.instrument as Tone.Sampler | Tone.PolySynth
        const ready = !(inst instanceof Tone.Sampler) || inst.loaded
        if (!ready) continue
        for (const n of d.notes) {
          if (n.step === localStep) {
            try { inst.triggerAttackRelease(n.note, sixteenthSec * n.length * 0.95, this.nextTime(inst, time), n.velocity) } catch {}
          }
        }
      }
    }
  }

  private scheduleLoop() {
    this.repeatId = Tone.getTransport().scheduleRepeat((time) => {
      const proj = this.project
      if (!proj) return
      this.tickFired.clear()
      const sixteenthSec = Tone.Time('16n').toSeconds()
      const songMode = proj.mode === 'song'
      const len = songMode ? this.songLength(proj) : (this.activePattern()?.length ?? 16)
      // derive the step from the SCHEDULED time (exact grid), not the live
      // transport position — reading live ticks during the lookahead window
      // occasionally rounds to the wrong step and drops/doubles a beat.
      const pos = Math.round(Tone.getTransport().getTicksAtTime(time) / SIXTEENTH_TICKS())
      const step = ((pos % len) + len) % len

      if (proj.metronome && this.click && step % 4 === 0) {
        this.click.triggerAttackRelease(step === 0 ? 'C6' : 'C5', '32n', time)
      }

      if (songMode) {
        const la = laneAudibility(proj)
        for (const clip of proj.arrangement.clips) {
          if (clip.type !== 'pattern') continue
          if (step < clip.start || step >= clip.start + clip.length) continue
          if (clip.mute || !la.audible(clip.lane)) continue
          const pat = proj.patterns.find((p) => p.id === clip.refId)
          if (!pat) continue
          const local = (((step - clip.start + clip.offset) % pat.length) + pat.length) % pat.length
          this.firePatternStep(pat, local, time, sixteenthSec)
        }
      } else {
        this.firePatternStep(this.activePattern(), step, time, sixteenthSec)
      }

      if (this.onStep) Tone.getDraw().schedule(() => this.onStep && this.onStep(step), time)
    }, '16n')
  }

  // Pattern-mode recorded audio channels loop with the pattern.
  private syncAudioPlayers() {
    if (!this.project) return
    for (const track of this.project.tracks) {
      if (track.kind !== 'audio') continue
      const lt = this.live.get(track.id)
      if (!lt) continue
      const p = lt.instrument as Tone.Player
      p.unsync()
      if (p.loaded && this.project.mode === 'pattern') p.sync().start(0)
    }
  }

  // ─── per-lane arranger channels (live mute / solo / volume) ─────────────────
  private laneChannels = new Map<number, Tone.Channel>()
  private laneChannel(lane: number): Tone.Channel {
    let ch = this.laneChannels.get(lane)
    if (!ch && this.master) { ch = new Tone.Channel().connect(this.master); this.laneChannels.set(lane, ch) }
    return ch!
  }
  // Reflect lane mixer state onto the persistent channels — takes effect live,
  // even mid-playback. Solo is emulated with mute (Tone's channel-solo bus would
  // also mute master), so soloing a lane silences the non-soloed lanes only.
  applyLaneMix(project: ProjectState) {
    this.ensureMaster()
    if (!this.master) return
    const meta = project.arrangement.laneMeta ?? []
    const anySolo = meta.some((m) => m?.solo)
    const laneCount = Math.max(project.arrangement.lanes, ...project.arrangement.clips.map((c) => c.lane + 1), 1)
    for (let l = 0; l < laneCount; l++) {
      const ch = this.laneChannel(l)
      if (!ch) continue
      const m = meta[l]
      const vol = m ? m.volume : 0.9
      ch.volume.value = vol <= 0.001 ? -Infinity : Tone.gainToDb(vol)
      ch.mute = !!(m?.mute) || (anySolo && !m?.solo)
    }
  }

  // Song-mode audio clips: place each take's player at its clip start.
  private arrPlayers: (Tone.Player | Tone.GrainPlayer)[] = []
  private clearArrPlayers() { this.arrPlayers.forEach((p) => p.dispose()); this.arrPlayers = [] }
  private buildArrPlayers() {
    this.clearArrPlayers()
    if (!this.project || !this.master) return
    const stepSec = 60 / this.project.bpm / 4
    for (const clip of this.project.arrangement.clips) {
      if (clip.type !== 'audio') continue
      if (clip.mute) continue                 // lane mute is handled live on the channel
      const buf = this.takeBuffers.get(clip.refId)
      if (!buf) continue
      const rate = clip.rate ?? 1
      const gain = clip.gain ?? 1
      // rate === 1 → plain Player (cleanest); otherwise GrainPlayer time-stretches
      // pitch-preserved so tracks with different BPMs can be matched.
      const p: Tone.Player | Tone.GrainPlayer = rate === 1
        ? new Tone.Player(buf)
        : new Tone.GrainPlayer({ url: buf, grainSize: 0.12, overlap: 0.05, playbackRate: rate })
      if (p instanceof Tone.Player) { p.fadeIn = (clip.fadeIn ?? 0) * stepSec; p.fadeOut = (clip.fadeOut ?? 0) * stepSec }
      p.volume.value = gain <= 0.001 ? -Infinity : Tone.gainToDb(gain)
      p.connect(this.laneChannel(clip.lane))
      // duration is the OUTPUT length; the cropped source region starts at offset
      p.sync().start(`${clip.start * SIXTEENTH_TICKS()}i`, clip.offset * stepSec, clip.length * stepSec)
      this.arrPlayers.push(p)
    }
  }

  private cursorTicks = 0
  // Move the transport play position (scrub). Works while playing or stopped.
  seek(step: number) {
    this.cursorTicks = Math.max(0, step) * SIXTEENTH_TICKS()
    const T = Tone.getTransport()
    if (T.state === 'started') T.ticks = this.cursorTicks
    if (this.onStep) this.onStep(Math.round(step))
  }
  getPositionStep(): number { return Tone.getTransport().ticks / SIXTEENTH_TICKS() }

  async play() {
    await this.start()
    this.syncAudioPlayers()
    if (this.project?.mode === 'song') { this.buildArrPlayers(); this.applyLaneMix(this.project) }
    Tone.getTransport().start(undefined, `${this.cursorTicks}i`)
  }
  stop() { Tone.getTransport().stop(); Tone.getTransport().position = 0; this.cursorTicks = 0; this.clearArrPlayers(); if (this.onStep) this.onStep(-1) }
  get isPlaying() { return Tone.getTransport().state === 'started' }
  setBpm(bpm: number) { Tone.getTransport().bpm.value = bpm }

  async preview(track: Track, note = 'C4', velocity = 0.9) {
    await this.start()
    this.ensureTrack(track)
    const lt = this.live.get(track.id)
    if (!lt) return
    if (track.kind === 'drum') {
      const pl = lt.instrument as Tone.Player
      if (pl.loaded) pl.start(this.safeNow())
    } else if (track.kind === 'instrument') {
      const inst = lt.instrument as Tone.Sampler | Tone.PolySynth
      if (!(inst instanceof Tone.Sampler) || inst.loaded) inst.triggerAttackRelease(note, '8n', this.safeNow(), velocity)
    }
  }

  getLevel(): number {
    if (!this.meter) return -Infinity
    const v = this.meter.getValue()
    return typeof v === 'number' ? v : v[0]
  }

  // ─── mic ──────────────────────────────────────────────────────────────────
  async startMic() {
    await this.start()
    if (!this.micStream) this.micStream = await navigator.mediaDevices.getUserMedia({ audio: true })
    // live waveform analyser tap (not connected to output -> no monitoring feedback)
    if (!this.micAnalyser) {
      const ctx = Tone.getContext().rawContext as AudioContext
      this.micSource = ctx.createMediaStreamSource(this.micStream)
      this.micAnalyser = ctx.createAnalyser()
      this.micAnalyser.fftSize = 1024
      this.micSource.connect(this.micAnalyser)
    }
    this.micChunks = []
    this.mediaRecorder = new MediaRecorder(this.micStream)
    this.mediaRecorder.ondataavailable = (e) => { if (e.data.size) this.micChunks.push(e.data) }
    this.mediaRecorder.start()
  }

  // Fill a Uint8Array with the live mic time-domain waveform (0..255, 128=silence).
  getMicWaveform(buf: Uint8Array): boolean {
    if (!this.micAnalyser) return false
    this.micAnalyser.getByteTimeDomainData(buf)
    return true
  }
  get micFftSize() { return this.micAnalyser?.fftSize ?? 1024 }
  registerTake(id: string, buffer: AudioBuffer) { this.takeBuffers.set(id, buffer) }
  get rawContext(): BaseAudioContext { return Tone.getContext().rawContext as BaseAudioContext }
  stopMic(): Promise<Blob> {
    return new Promise((resolve) => {
      if (!this.mediaRecorder) return resolve(new Blob())
      this.mediaRecorder.onstop = () => resolve(new Blob(this.micChunks, { type: 'audio/webm' }))
      this.mediaRecorder.stop()
    })
  }
  async decodeBlob(blob: Blob): Promise<AudioBuffer> {
    const arr = await blob.arrayBuffer()
    return Tone.getContext().rawContext.decodeAudioData(arr.slice(0))
  }
  registerAudioBuffer(trackId: string, buffer: AudioBuffer) { this.audioBuffers.set(trackId, buffer) }
  getAudioBuffer(trackId: string): AudioBuffer | undefined { return this.audioBuffers.get(trackId) }

  // ─── export (offline render -> WAV) ───────────────────────────────────────
  async exportWav(project: ProjectState, bars = 2): Promise<Blob> {
    const songMode = project.mode === 'song'
    const sixteenthSec = 60 / project.bpm / 4
    const pat = project.patterns.find((p) => p.id === project.activePatternId)
    const patLen = pat?.length ?? 16
    const songLen = this.songLength(project)
    const totalSteps = songMode ? songLen : patLen * bars
    const duration = totalSteps * sixteenthSec + 2.5

    const fireStep = (
      insts: Map<string, Tone.ToneAudioNode>, p: Pattern | undefined, local: number, t: number,
    ) => {
      if (!p) return
      for (const track of project.tracks) {
        const inst = insts.get(track.id)
        if (!inst) continue
        const d = p.data[track.id] ?? { steps: [], notes: [] }
        if (track.kind === 'drum') {
          if (d.steps[local] && inst instanceof Tone.Player) inst.start(t)
        } else if (track.kind === 'instrument') {
          for (const n of d.notes) if (n.step === local) (inst as Tone.PolySynth).triggerAttackRelease(n.note, sixteenthSec * n.length * 0.95, t, n.velocity)
        }
      }
    }

    const rendered = await Tone.Offline(async () => {
      const master = new Tone.Channel({
        volume: project.masterVolume <= 0.001 ? -Infinity : Tone.gainToDb(project.masterVolume),
      }).toDestination()

      const insts = new Map<string, Tone.ToneAudioNode>()
      for (const track of project.tracks) {
        const inst = makeInstrument(track.presetId, this.audioBuffers.get(track.id))
        const filter = new Tone.Filter({ type: 'lowpass', frequency: 18000 })
        applySynthParams(inst, filter, track.presetId, track.synth)
        const fxNodes = track.fx.filter((f) => f.enabled).map((f) => { const node = makeFxNode(f.type); setFxParams(node, f.type, f.k); return node })
        const ch = new Tone.Channel({
          volume: track.mixer.volume <= 0.001 ? -Infinity : Tone.gainToDb(track.mixer.volume),
          pan: track.mixer.pan, mute: track.mixer.mute,
        }).connect(master)
        const chain = [inst, filter, ...fxNodes, ch]
        for (let i = 0; i < chain.length - 1; i++) chain[i].connect(chain[i + 1])
        insts.set(track.id, inst)
      }

      await Tone.loaded()

      if (songMode) {
        const la = laneAudibility(project)
        for (const clip of project.arrangement.clips) {
          if (clip.mute || !la.audible(clip.lane)) continue
          if (clip.type === 'pattern') {
            const p = project.patterns.find((x) => x.id === clip.refId)
            if (!p) continue
            for (let s = clip.start; s < clip.start + clip.length; s++) fireStep(insts, p, (((s - clip.start + clip.offset) % p.length) + p.length) % p.length, s * sixteenthSec)
          } else {
            const buf = this.takeBuffers.get(clip.refId)
            if (!buf) continue
            const rate = clip.rate ?? 1
            const gain = (clip.gain ?? 1) * la.gain(clip.lane)
            const p: Tone.Player | Tone.GrainPlayer = rate === 1
              ? new Tone.Player(buf)
              : new Tone.GrainPlayer({ url: buf, grainSize: 0.12, overlap: 0.05, playbackRate: rate })
            if (p instanceof Tone.Player) { p.fadeIn = (clip.fadeIn ?? 0) * sixteenthSec; p.fadeOut = (clip.fadeOut ?? 0) * sixteenthSec }
            p.volume.value = gain <= 0.001 ? -Infinity : Tone.gainToDb(gain)
            p.connect(master).start(clip.start * sixteenthSec, clip.offset * sixteenthSec, clip.length * sixteenthSec)
          }
        }
      } else {
        // pattern audio channels
        for (const track of project.tracks) {
          if (track.kind !== 'audio') continue
          const inst = insts.get(track.id)
          if (inst instanceof Tone.Player) for (let b = 0; b < bars; b++) inst.start(b * patLen * sixteenthSec)
        }
        for (let b = 0; b < bars; b++) for (let s = 0; s < patLen; s++) fireStep(insts, pat, s, (b * patLen + s) * sixteenthSec)
      }
    }, duration, 2)

    return audioBufferToWav(rendered.get() as unknown as AudioBuffer)
  }

  dispose() {
    if (this.repeatId !== null) Tone.getTransport().clear(this.repeatId)
    this.repeatId = null
    Tone.getTransport().stop()
    this.clearArrPlayers()
    this.laneChannels.forEach((ch) => ch.dispose()); this.laneChannels.clear()
    for (const id of [...this.live.keys()]) this.removeTrack(id)
    this.meter?.dispose(); this.master?.dispose(); this.click?.dispose()
    this.micStream?.getTracks().forEach((t) => t.stop())
    this.micAnalyser = null; this.micSource = null
    this.micStream = null; this.started = false; this.master = null
  }
}

let _engine: KapiEngine | null = null
export function getEngine(): KapiEngine {
  if (!_engine) _engine = new KapiEngine()
  return _engine
}
export type { KapiEngine }
