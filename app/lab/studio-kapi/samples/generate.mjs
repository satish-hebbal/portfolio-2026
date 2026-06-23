// Studio-Kapi — sample generator
// Renders small CC0 one-shot WAV files (self-authored DSP, no external assets).
// Run: node app/lab/studio-kapi/samples/generate.mjs
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const SR = 44100
// Output to public/ so Next serves the files; this script lives in app/ as source.
const here = join(dirname(fileURLToPath(import.meta.url)), '../../../../public/lab/studio-kapi/samples')

// ─── WAV writer (16-bit PCM mono) ──────────────────────────────────────────
function writeWav(name, samples) {
  const n = samples.length
  const buf = Buffer.alloc(44 + n * 2)
  buf.write('RIFF', 0)
  buf.writeUInt32LE(36 + n * 2, 4)
  buf.write('WAVE', 8)
  buf.write('fmt ', 12)
  buf.writeUInt32LE(16, 16)
  buf.writeUInt16LE(1, 20)
  buf.writeUInt16LE(1, 22)
  buf.writeUInt32LE(SR, 24)
  buf.writeUInt32LE(SR * 2, 28)
  buf.writeUInt16LE(2, 32)
  buf.writeUInt16LE(16, 34)
  buf.write('data', 36)
  buf.writeUInt32LE(n * 2, 40)
  for (let i = 0; i < n; i++) {
    let s = Math.max(-1, Math.min(1, samples[i]))
    buf.writeInt16LE((s < 0 ? s * 0x8000 : s * 0x7fff) | 0, 44 + i * 2)
  }
  writeFileSync(join(here, name), buf)
  console.log('wrote', name, (n / SR).toFixed(2) + 's')
}

const env = (t, a, d) => (t < a ? t / a : Math.exp(-(t - a) / d))
const noise = () => Math.random() * 2 - 1
const soft = (x) => Math.tanh(x * 1.6)
const hp = () => { let prev = 0; return (n) => { const o = n - prev; prev = n; return o } }

// ─── Kicks ──────────────────────────────────────────────────────────────────
function kick() {
  const len = SR * 0.5, out = new Float32Array(len)
  for (let i = 0; i < len; i++) {
    const t = i / SR
    const f = 130 * Math.exp(-t * 38) + 45
    let s = Math.sin(2 * Math.PI * f * t) * env(t, 0.002, 0.12)
    s += noise() * env(t, 0, 0.006) * 0.4
    out[i] = soft(s * 1.2) * 0.9
  }
  return out
}
function kick808() {
  const len = SR * 0.9, out = new Float32Array(len)
  for (let i = 0; i < len; i++) {
    const t = i / SR
    const f = 220 * Math.exp(-t * 60) + 42
    let s = Math.sin(2 * Math.PI * f * t) * env(t, 0.003, 0.32)
    out[i] = soft(s * 1.3) * 0.92
  }
  return out
}

// ─── Snares / rim / clap ──────────────────────────────────────────────────────
function snare() {
  const len = SR * 0.3, out = new Float32Array(len)
  let lp = 0
  for (let i = 0; i < len; i++) {
    const t = i / SR
    const body = (Math.sin(2 * Math.PI * 180 * t) + Math.sin(2 * Math.PI * 330 * t)) * 0.5 * env(t, 0.001, 0.05)
    const n = noise(); lp += (n - lp) * 0.6
    const h = n - lp
    out[i] = soft(body * 0.6 + h * env(t, 0.001, 0.09) * 0.9) * 0.8
  }
  return out
}
function rim() {
  const len = SR * 0.12, out = new Float32Array(len)
  for (let i = 0; i < len; i++) {
    const t = i / SR
    const s = (Math.sin(2 * Math.PI * 1700 * t) + Math.sin(2 * Math.PI * 470 * t)) * 0.5
    out[i] = soft(s * env(t, 0.0004, 0.012) * 1.4) * 0.7
  }
  return out
}
function clap() {
  const len = SR * 0.3, out = new Float32Array(len)
  const bursts = [0, 0.01, 0.02, 0.035]
  const f = hp()
  for (let i = 0; i < len; i++) {
    const t = i / SR
    let amp = 0
    for (const b of bursts) if (t >= b) amp += Math.exp(-(t - b) / 0.012)
    if (t > 0.05) amp += Math.exp(-(t - 0.05) / 0.08) * 1.2
    out[i] = f(noise()) * Math.min(amp, 1.6) * 0.5
  }
  return out
}

// ─── Hats / cymbals (filtered noise) ──────────────────────────────────────────
function hat(decay, gain) {
  const len = Math.floor(SR * (decay * 2.4 + 0.04)), out = new Float32Array(len)
  const f = hp()
  for (let i = 0; i < len; i++) {
    const t = i / SR
    out[i] = f(noise()) * env(t, 0.0005, decay) * gain
  }
  return out
}
function metalCymbal(decay, gain) {
  // ring-modulated square partials + noise for ride/crash shimmer
  const len = Math.floor(SR * (decay * 3 + 0.1)), out = new Float32Array(len)
  const f = hp()
  const ratios = [2, 3, 4.16, 5.43, 6.79, 8.21]
  for (let i = 0; i < len; i++) {
    const t = i / SR
    let s = 0
    for (const r of ratios) s += Math.sign(Math.sin(2 * Math.PI * 320 * r * t))
    s = (s / ratios.length) * 0.6 + f(noise()) * 0.7
    out[i] = soft(s * env(t, 0.001, decay)) * gain
  }
  return out
}

// ─── Toms ─────────────────────────────────────────────────────────────────────
function tom(freq) {
  const len = SR * 0.4, out = new Float32Array(len)
  for (let i = 0; i < len; i++) {
    const t = i / SR
    const f = freq * Math.exp(-t * 12) + freq * 0.6
    let s = Math.sin(2 * Math.PI * f * t) * env(t, 0.002, 0.16)
    s += noise() * env(t, 0, 0.004) * 0.2
    out[i] = soft(s * 1.1) * 0.85
  }
  return out
}

// ─── Cowbell / shaker / perc ──────────────────────────────────────────────────
function cowbell() {
  const len = SR * 0.25, out = new Float32Array(len)
  for (let i = 0; i < len; i++) {
    const t = i / SR
    const s = (Math.sign(Math.sin(2 * Math.PI * 540 * t)) + Math.sign(Math.sin(2 * Math.PI * 800 * t))) * 0.5
    out[i] = soft(s * env(t, 0.001, 0.12) * 0.9) * 0.55
  }
  return out
}
function shaker() {
  const len = SR * 0.12, out = new Float32Array(len)
  const f = hp()
  for (let i = 0; i < len; i++) {
    const t = i / SR
    const e = Math.min(t / 0.02, 1) * Math.exp(-(t) / 0.05)
    out[i] = f(noise()) * e * 0.5
  }
  return out
}
function conga(freq) {
  const len = SR * 0.3, out = new Float32Array(len)
  for (let i = 0; i < len; i++) {
    const t = i / SR
    const f = freq * Math.exp(-t * 6) + freq * 0.85
    out[i] = soft(Math.sin(2 * Math.PI * f * t) * env(t, 0.001, 0.1) * 1.1) * 0.7
  }
  return out
}

// ─── Piano-ish note (FM) ──────────────────────────────────────────────────────
function piano(freq) {
  const len = SR * 1.8, out = new Float32Array(len)
  for (let i = 0; i < len; i++) {
    const t = i / SR
    const modIdx = 2.2 * Math.exp(-t * 3)
    const mod = Math.sin(2 * Math.PI * freq * 3 * t) * modIdx
    let s = Math.sin(2 * Math.PI * freq * t + mod)
    s += Math.sin(2 * Math.PI * freq * 2 * t) * 0.15 * Math.exp(-t * 4)
    const e = (t < 0.004 ? t / 0.004 : Math.exp(-t * 1.5))
    out[i] = soft(s * e * 0.9) * 0.7
  }
  return out
}

const NOTE_F = { C2: 65.41, C3: 130.81, C4: 261.63, C5: 523.25, C6: 1046.5 }

// drums
writeWav('kick.wav', kick())
writeWav('kick-808.wav', kick808())
writeWav('snare.wav', snare())
writeWav('rim.wav', rim())
writeWav('clap.wav', clap())
writeWav('hat-closed.wav', hat(0.02, 0.55))
writeWav('hat-open.wav', hat(0.16, 0.45))
writeWav('ride.wav', metalCymbal(0.5, 0.4))
writeWav('crash.wav', metalCymbal(1.1, 0.45))
writeWav('tom-low.wav', tom(120))
writeWav('tom-high.wav', tom(220))
writeWav('cowbell.wav', cowbell())
writeWav('shaker.wav', shaker())
writeWav('conga.wav', conga(190))
// piano multisamples
for (const [name, f] of Object.entries(NOTE_F)) writeWav(`piano-${name}.wav`, piano(f))
console.log('done')
