/*
 * AudioWorklet wrapper around the shared engine DSP. Used on secure contexts
 * (https / localhost). On insecure contexts AudioWorklet is unavailable and
 * engineAudio.ts falls back to a ScriptProcessorNode running the same DSP.
 */
import { EngineDSP } from './engine-dsp.js'

class EngineProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this.dsp = new EngineDSP(sampleRate)
    this.port.onmessage = (e) => this.dsp.setParams(e.data)
  }

  process(_inputs, outputs) {
    const out = outputs[0]
    if (!out || !out[0]) return true
    this.dsp.render(out[0], out[1] || out[0], out[0].length)
    return true
  }
}

registerProcessor('engine-processor', EngineProcessor)
