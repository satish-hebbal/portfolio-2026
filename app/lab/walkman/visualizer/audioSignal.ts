// What the background visualizers listen to.
//
// The YouTube player lives in a cross-origin iframe, so its audio can't be
// tapped directly. Three sources, best first:
//
//   - 'track': the song analysed ahead of time (scripts/walkman_analyse.py):
//     real loudness, spectrum and beats, played back in sync with the
//     player's clock. No prompt, no share bar.
//
//   - 'auto': a musical model clocked to the player's own timeline. It knows
//     when the tape plays, pauses, seeks and how loud it is, and fakes a groove
//     (kick, snare, hats, phrase swells) at a tempo seeded from the video id.
//   - 'live': the viewer shares this tab's audio once (getDisplayMedia), and an
//     AnalyserNode reads the real song: true amplitude, spectrum and beats.
//
// Both produce the same features every frame, so every visualizer works with either.

export const BANDS = 32
export const WAVE = 64

export interface AudioFeatures {
  level: number   // overall loudness, 0..1
  bass: number
  mid: number
  high: number
  beat: number    // 1 on a detected/scheduled beat, decaying
  bands: Float32Array // BANDS log-spaced spectrum, 0..1
  wave: Float32Array  // WAVE samples of the waveform, -1..1
}

export interface PlayerClock {
  playing: boolean
  time: number    // seconds into the track
  volume: number  // 0..1 (0 when muted)
  seed: string    // video id: picks the tempo + groove
}

export type LiveStatus = 'off' | 'starting' | 'on' | 'denied' | 'no-audio' | 'unsupported'
export type TrackStatus = 'none' | 'loading' | 'ready' | 'unavailable'

// a pre-analysed song: per frame, level, beat flag and BANDS band levels (all u8)
interface TrackAnalysis { id: string; fps: number; frames: number; data: Uint8Array }
const STRIDE = 2 + BANDS

function parseAnalysis(id: string, buf: ArrayBuffer): TrackAnalysis | null {
  if (buf.byteLength < 12) return null
  const head = new DataView(buf)
  if (String.fromCharCode(head.getUint8(0), head.getUint8(1), head.getUint8(2), head.getUint8(3)) !== 'WMA1') return null
  const fps = head.getFloat32(4, true), frames = head.getUint32(8, true)
  if (!(fps > 0) || buf.byteLength < 12 + frames * STRIDE) return null
  return { id, fps, frames, data: new Uint8Array(buf, 12, frames * STRIDE) }
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)

function hash(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return (h >>> 0) / 4294967295
}

// smooth value noise in 1D, for organic drift in the auto groove
function vnoise(x: number, seed: number) {
  const i = Math.floor(x), f = x - i
  const r = (n: number) => { const s = Math.sin((n + seed * 113.1) * 127.1) * 43758.5453; return s - Math.floor(s) }
  const u = f * f * (3 - 2 * f)
  return r(i) * (1 - u) + r(i + 1) * u
}

export class AudioSignal {
  readonly f: AudioFeatures = {
    level: 0, bass: 0, mid: 0, high: 0, beat: 0,
    bands: new Float32Array(BANDS), wave: new Float32Array(WAVE),
  }

  liveStatus: LiveStatus = 'off'
  onLiveStatus?: (s: LiveStatus) => void
  trackStatus: TrackStatus = 'none'
  onTrackStatus?: (s: TrackStatus) => void
  useTrack = true // the panel's "Song" vs "Auto" choice

  private track: TrackAnalysis | null = null
  private trackReq = ''
  private clockT = 0       // smoothed playhead (the player reports it in coarse steps)
  private lastReported = -1
  private lastPos = -1

  private ctx: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private stream: MediaStream | null = null
  private freq: Uint8Array<ArrayBuffer> | null = null
  private time: Uint8Array<ArrayBuffer> | null = null
  private bandEdges: number[] = []
  private peak = 0.25        // adaptive gain: tracks recent loudness
  private fluxAvg = 0
  private lastBass = 0
  private sinceBeat = 1
  private lastBeatIdx = -1

  get isLive() { return this.liveStatus === 'on' }

  // fetch the analysis for a song: shipped file first, then the on-demand route
  async loadTrack(id: string | null) {
    if (!id) { this.trackReq = ''; this.track = null; this.setTrackStatus('none'); return }
    if (this.track?.id === id || this.trackReq === id) return
    this.trackReq = id
    this.track = null
    this.setTrackStatus('loading')
    for (const url of [`/lab/walkman/analysis/${id}.wma`, `/api/walkman-analysis?id=${id}`]) {
      try {
        const res = await fetch(url)
        if (this.trackReq !== id) return // a newer song took over
        if (!res.ok) continue
        const parsed = parseAnalysis(id, await res.arrayBuffer())
        if (this.trackReq !== id) return
        if (parsed) { this.track = parsed; this.lastPos = -1; this.setTrackStatus('ready'); return }
      } catch { /* try the next source */ }
    }
    if (this.trackReq === id) this.setTrackStatus('unavailable')
  }

  private setTrackStatus(s: TrackStatus) {
    this.trackStatus = s
    this.onTrackStatus?.(s)
  }

  static liveSupported() {
    return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getDisplayMedia
  }

  // ask the browser to share this tab's audio (one prompt; pick "this tab" + "share audio")
  async startLive(): Promise<LiveStatus> {
    if (!AudioSignal.liveSupported()) return this.setStatus('unsupported')
    this.setStatus('starting')
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
        // Chrome / Brave hints: offer the current tab first, keep the song audible
        preferCurrentTab: true,
        selfBrowserSurface: 'include',
        systemAudio: 'include',
        suppressLocalAudioPlayback: false,
      } as DisplayMediaStreamOptions)
      // we only want the sound
      stream.getVideoTracks().forEach((t) => t.stop())
      if (!stream.getAudioTracks().length) { stream.getTracks().forEach((t) => t.stop()); return this.setStatus('no-audio') }

      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      const ctx = new Ctx()
      const src = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 2048
      analyser.smoothingTimeConstant = 0.6
      src.connect(analyser) // not to the speakers: the tab already plays it
      this.ctx = ctx
      this.analyser = analyser
      this.stream = stream
      this.freq = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount))
      this.time = new Uint8Array(new ArrayBuffer(analyser.fftSize))
      // log-spaced band edges, 32 Hz .. 14 kHz
      const nyq = ctx.sampleRate / 2
      this.bandEdges = Array.from({ length: BANDS + 1 }, (_, i) => {
        const hz = 32 * Math.pow(14000 / 32, i / BANDS)
        return Math.min(analyser.frequencyBinCount - 1, Math.round((hz / nyq) * analyser.frequencyBinCount))
      })
      stream.getAudioTracks()[0].addEventListener('ended', () => this.stopLive())
      return this.setStatus('on')
    } catch (err) {
      return this.setStatus((err as Error).name === 'NotAllowedError' ? 'denied' : 'off')
    }
  }

  stopLive() {
    this.stream?.getTracks().forEach((t) => t.stop())
    this.ctx?.close().catch(() => {})
    this.stream = null
    this.ctx = null
    this.analyser = null
    if (this.liveStatus === 'on' || this.liveStatus === 'starting') this.setStatus('off')
  }

  private setStatus(s: LiveStatus) {
    this.liveStatus = s
    this.onLiveStatus?.(s)
    return s
  }

  update(dt: number, clock: PlayerClock) {
    // the player reports its time in steps; run our own clock and steer it
    if (clock.playing) {
      this.clockT += dt
      if (clock.time !== this.lastReported) {
        const err = clock.time - this.clockT
        this.clockT = Math.abs(err) > 0.35 ? clock.time : this.clockT + err * 0.3
        this.lastReported = clock.time
      }
    } else {
      this.clockT = clock.time
      this.lastReported = clock.time
    }

    if (this.analyser && this.freq && this.time) this.readLive(dt, clock)
    else if (this.useTrack && this.track && this.track.id === clock.seed) this.readTrack(dt, clock)
    else this.readAuto(dt, clock)
  }

  // ── pre-analysed song, read at the playhead ──
  private readTrack(dt: number, clock: PlayerClock) {
    const f = this.f, tr = this.track!
    if (!clock.playing) {
      for (let b = 0; b < BANDS; b++) f.bands[b] *= Math.exp(-dt * 3)
      for (let i = 0; i < WAVE; i++) f.wave[i] *= Math.exp(-dt * 4)
      this.ease(0, 0, 0, 0, f.beat * Math.exp(-dt * 6), dt)
      this.lastPos = -1
      return
    }
    const pos = Math.max(0, Math.min(tr.frames - 1.001, (this.clockT + 0.04) * tr.fps)) // + a hair of output latency
    const i0 = Math.floor(pos), fr = pos - i0
    const at = (i: number, k: number) => tr.data[i * STRIDE + k] / 255
    const lerp = (k: number) => at(i0, k) * (1 - fr) + at(i0 + 1, k) * fr

    // a beat flag between the last frame we read and this one fires the pulse
    let beat = f.beat * Math.exp(-dt * 7)
    if (this.lastPos >= 0 && pos > this.lastPos && pos - this.lastPos < tr.fps) {
      for (let i = Math.floor(this.lastPos) + 1; i <= i0; i++) if (tr.data[i * STRIDE + 1] > 0) { beat = 1; break }
    }
    this.lastPos = pos

    for (let b = 0; b < BANDS; b++) {
      const v = lerp(2 + b)
      f.bands[b] += (v - f.bands[b]) * Math.min(1, dt * (v > f.bands[b] ? 30 : 10))
    }
    const avg = (a0: number, a1: number) => { let s = 0; for (let i = a0; i < a1; i++) s += f.bands[i]; return s / (a1 - a0) }
    const bass = avg(0, 6), mid = avg(6, 18), high = avg(18, BANDS)
    const level = lerp(0) * (0.55 + 0.45 * clock.volume)
    const t = this.clockT
    for (let i = 0; i < WAVE; i++) {
      const x = i / WAVE
      f.wave[i] = (Math.sin(x * 12.6 + t * 9) * bass + Math.sin(x * 41 + t * 23) * mid * 0.5 + Math.sin(x * 97 - t * 31) * high * 0.3) * level
    }
    this.ease(level, bass, mid, high, beat, dt)
  }

  // ── real audio ──
  private readLive(dt: number, clock: PlayerClock) {
    const a = this.analyser!, fq = this.freq!, td = this.time!
    a.getByteFrequencyData(fq)
    a.getByteTimeDomainData(td)
    const f = this.f

    let rms = 0
    for (let i = 0; i < td.length; i++) { const v = (td[i] - 128) / 128; rms += v * v }
    rms = Math.sqrt(rms / td.length)
    // adaptive gain so quiet and loud masters both fill the range
    this.peak = Math.max(rms, this.peak * Math.exp(-dt / 6), 0.04)
    const level = clamp01(rms / this.peak)

    let bandMax = 0
    const raw = new Array<number>(BANDS)
    for (let b = 0; b < BANDS; b++) {
      const lo = this.bandEdges[b], hi = Math.max(lo + 1, this.bandEdges[b + 1])
      let s = 0
      for (let i = lo; i < hi; i++) s += fq[i]
      // tilt up the highs a little: they're naturally much quieter
      raw[b] = (s / (hi - lo) / 255) * (1 + b / BANDS * 0.6)
      bandMax = Math.max(bandMax, raw[b])
    }
    for (let b = 0; b < BANDS; b++) {
      const v = clamp01(raw[b] / Math.max(0.35, bandMax))
      f.bands[b] += (v - f.bands[b]) * (v > f.bands[b] ? 0.6 : 0.18)
    }
    for (let i = 0; i < WAVE; i++) f.wave[i] = (td[Math.floor((i / WAVE) * td.length)] - 128) / 128 / Math.max(0.15, this.peak * 1.6)

    const avg = (a0: number, a1: number) => { let s = 0; for (let i = a0; i < a1; i++) s += f.bands[i]; return s / (a1 - a0) }
    const bass = avg(0, 6), mid = avg(6, 18), high = avg(18, BANDS)

    // beat: a jump in bass energy well above its running average
    const flux = Math.max(0, bass - this.lastBass)
    this.lastBass = bass
    this.fluxAvg += (flux - this.fluxAvg) * Math.min(1, dt * 3)
    this.sinceBeat += dt
    let beat = f.beat * Math.exp(-dt * 7)
    if (flux > this.fluxAvg * 2.2 + 0.035 && this.sinceBeat > 0.18 && bass > 0.3) { beat = 1; this.sinceBeat = 0 }

    this.ease(level * (clock.playing ? 1 : 0.2), bass, mid, high, beat, dt)
  }

  // ── auto groove, clocked to the player ──
  private readAuto(dt: number, clock: PlayerClock) {
    const f = this.f
    const seed = hash(clock.seed || 'walkman')
    if (!clock.playing || clock.volume <= 0) {
      for (let b = 0; b < BANDS; b++) f.bands[b] *= Math.exp(-dt * 3)
      for (let i = 0; i < WAVE; i++) f.wave[i] *= Math.exp(-dt * 4)
      this.ease(0, 0, 0, 0, f.beat * Math.exp(-dt * 6), dt)
      return
    }
    const bpm = 84 + Math.round(seed * 44) // 84..128, stable per song
    const t = clock.time
    const beats = (t * bpm) / 60
    const ph = beats - Math.floor(beats)
    const beatIdx = Math.floor(beats)
    const bar = Math.floor(beats / 4)
    // a song breathes: verses, builds, drops, every 8 bars or so
    const section = 0.55 + 0.45 * vnoise(bar / 8, seed)
    const kick = Math.exp(-ph * 9) * (beatIdx % 4 === 3 && seed > 0.5 ? 0.7 : 1)
    const snarePh = ((beats + 1) % 2) / 2 // beats 2 and 4
    const snare = Math.exp(-snarePh * 2 * 11) * 0.9
    const hatPh = (beats * 2) % 1
    const hat = Math.exp(-hatPh * 16) * (0.5 + 0.5 * vnoise(t * 3, seed + 1))
    const swell = 0.5 + 0.5 * Math.sin((t * Math.PI * 2 * bpm) / 60 / 16 + seed * 6)

    const bass = clamp01((0.25 + kick * 0.85) * section)
    const mid = clamp01((0.2 + snare * 0.6 + swell * 0.25) * section)
    const high = clamp01((0.12 + hat * 0.55 + snare * 0.2) * section)
    const level = clamp01((bass * 0.5 + mid * 0.35 + high * 0.15) * (0.6 + 0.4 * clock.volume))

    let beat = f.beat * Math.exp(-dt * 6)
    if (beatIdx !== this.lastBeatIdx) { this.lastBeatIdx = beatIdx; beat = 0.75 + 0.25 * (beatIdx % 4 === 0 ? 1 : 0) }

    for (let b = 0; b < BANDS; b++) {
      const x = b / (BANDS - 1)
      const shape = bass * Math.exp(-x * 7) + mid * Math.exp(-Math.pow((x - 0.4) / 0.22, 2)) * 0.9 + high * Math.exp(-Math.pow((x - 0.8) / 0.2, 2)) * 0.8
      const wobble = 0.65 + 0.35 * vnoise(t * 2.3 + b * 1.7, seed)
      const v = clamp01(shape * wobble * 1.25)
      f.bands[b] += (v - f.bands[b]) * (v > f.bands[b] ? 0.55 : 0.15)
    }
    for (let i = 0; i < WAVE; i++) {
      const x = i / WAVE
      f.wave[i] = (Math.sin(x * 12.6 + t * 9) * bass + Math.sin(x * 41 + t * 23) * mid * 0.5 + Math.sin(x * 97 - t * 31) * high * 0.3) * level
    }
    this.ease(level, bass, mid, high, beat, dt)
  }

  private ease(level: number, bass: number, mid: number, high: number, beat: number, dt: number) {
    const f = this.f
    const k = (up: number, down: number, cur: number, tgt: number) => cur + (tgt - cur) * Math.min(1, dt * (tgt > cur ? up : down))
    f.level = k(18, 5, f.level, level)
    f.bass = k(22, 6, f.bass, bass)
    f.mid = k(16, 5, f.mid, mid)
    f.high = k(24, 8, f.high, high)
    f.beat = beat
  }
}
