// Wires the procedural engine synth to live sim params.
// Lazily creates the AudioContext on first user gesture (autoplay rule).
//
// Two playback paths:
//   - AudioWorklet on secure contexts (https / localhost) — runs off-thread.
//   - ScriptProcessorNode fallback when AudioWorklet is unavailable, e.g. a
//     phone hitting the dev server over http on the LAN (insecure context),
//     where `ctx.audioWorklet` is undefined.

interface DspLike {
  setParams(d: Record<string, number | boolean>): void
  render(L: Float32Array, R: Float32Array, n: number): void
}

export class EngineAudio {
  private ctx: AudioContext | null = null
  private worklet: AudioWorkletNode | null = null
  private script: ScriptProcessorNode | null = null
  private dsp: DspLike | null = null
  private master: GainNode | null = null
  private ready = false
  private starting = false
  private songEnv = 1 // 0..1 note-articulation envelope for the melody player
  muted = false

  get isReady() { return this.ready }

  // master gain = base level × song envelope, so the melody player can pulse
  // notes without fighting the mute state
  private applyGain(tc = 0.012) {
    if (this.master && this.ctx) {
      const base = this.muted ? 0 : 0.9
      this.master.gain.setTargetAtTime(base * this.songEnv, this.ctx.currentTime, tc)
    }
  }

  // called by the melody player each frame: 1 = note sounding, 0 = gap between notes
  setSongGain(env: number) {
    this.songEnv = env
    this.applyGain(0.008)
  }

  async start(): Promise<boolean> {
    if (this.ready || this.starting) return this.ready
    this.starting = true
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (!Ctx) return false
      const ctx = new Ctx()
      const master = ctx.createGain()
      master.gain.value = this.muted ? 0 : 0.9
      master.connect(ctx.destination)

      // Resume while still inside the user gesture (mobile browsers are strict),
      // before any awaits on fetch / addModule.
      if (ctx.state === 'suspended') await ctx.resume()

      // Prefer AudioWorklet (off main thread). Only exists in secure contexts.
      if (ctx.audioWorklet) {
        try {
          await ctx.audioWorklet.addModule('/lab/speedo/engine-processor.js')
          const node = new AudioWorkletNode(ctx, 'engine-processor', { outputChannelCount: [2] })
          node.connect(master)
          this.worklet = node
        } catch (err) {
          console.warn('AudioWorklet unavailable, using ScriptProcessor fallback', err)
        }
      }

      // Fallback: ScriptProcessorNode running the same DSP on the main thread.
      if (!this.worklet) {
        const mod = await loadDsp()
        const dsp = new mod.EngineDSP(ctx.sampleRate) as DspLike
        const node = ctx.createScriptProcessor(1024, 0, 2)
        node.onaudioprocess = (e) => {
          const out = e.outputBuffer
          dsp.render(out.getChannelData(0), out.getChannelData(1), out.length)
        }
        node.connect(master)
        this.dsp = dsp
        this.script = node
      }

      this.ctx = ctx
      this.master = master
      this.ready = true
      return true
    } catch (err) {
      console.error('Engine audio failed to start', err)
      return false
    } finally {
      this.starting = false
    }
  }

  setMuted(muted: boolean) {
    this.muted = muted
    this.applyGain(0.03)
  }

  setCylinders(cylinders: number) {
    this.worklet?.port.postMessage({ cylinders })
    this.dsp?.setParams({ cylinders })
  }

  // push the per-engine sound character (cylinders + tuning)
  setVoice(v: { cylinders: number; grunt: number; scream: number; noise: number; turbo: number; ev: number; redline: number }) {
    this.worklet?.port.postMessage(v)
    this.dsp?.setParams(v)
  }

  setRunning(running: boolean) {
    this.worklet?.port.postMessage({ running })
    this.dsp?.setParams({ running })
  }

  update(rpm: number, throttle: number, load: number) {
    this.worklet?.port.postMessage({ rpm, throttle, load })
    this.dsp?.setParams({ rpm, throttle, load })
  }

  dispose() {
    try {
      this.worklet?.port.postMessage({ running: false })
      this.worklet?.disconnect()
      if (this.script) this.script.onaudioprocess = null
      this.script?.disconnect()
      this.master?.disconnect()
      this.ctx?.close()
    } catch { /* noop */ }
    this.ctx = null
    this.worklet = null
    this.script = null
    this.dsp = null
    this.master = null
    this.ready = false
  }
}

// Load the shared DSP class on the main thread. Fetch the module text and
// evaluate it directly — avoids the bundler trying to resolve the public path
// and works regardless of dynamic-import handling.
async function loadDsp(): Promise<{ EngineDSP: new (sr: number) => DspLike }> {
  const res = await fetch('/lab/speedo/engine-dsp.js')
  const text = (await res.text()).replace(/export\s+class\s+EngineDSP/, 'class EngineDSP')
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
  const factory = new Function(`${text}\nreturn EngineDSP;`) as () => new (sr: number) => DspLike
  return { EngineDSP: factory() }
}
