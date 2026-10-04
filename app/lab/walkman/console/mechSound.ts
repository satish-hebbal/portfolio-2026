// Tiny synthesized mechanical sounds for the console: knob detents, key
// presses, lever snaps. No files, a few ms of filtered
// noise each, quiet. The AudioContext is created on the first interaction.

type Kind = 'detent' | 'key' | 'lever'

let ctx: AudioContext | null = null

function audio() {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const C = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!C) return null
    ctx = new C()
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  return ctx
}

// [band-pass Hz, Q, length s, gain] per layer; a click is noise through a resonance
const RECIPES: Record<Kind, [number, number, number, number][]> = {
  detent: [[3800, 6, 0.012, 0.12], [1400, 4, 0.02, 0.05]],
  key: [[2600, 3, 0.018, 0.14], [420, 2, 0.05, 0.12]],
  lever: [[3200, 5, 0.01, 0.12], [900, 3, 0.04, 0.1], [180, 1.5, 0.07, 0.12]],
}

export function mech(kind: Kind, delay = 0) {
  const a = audio()
  if (!a) return
  const t0 = a.currentTime + delay
  for (const [hz, q, len, gain] of RECIPES[kind]) {
    const n = Math.ceil(a.sampleRate * len)
    const buf = a.createBuffer(1, n, a.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 4)
    const src = a.createBufferSource()
    src.buffer = buf
    const bp = a.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = hz * (0.94 + Math.random() * 0.12) // never quite the same twice
    bp.Q.value = q
    const g = a.createGain()
    g.gain.value = gain
    src.connect(bp).connect(g).connect(a.destination)
    src.start(t0)
  }
}
