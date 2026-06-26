// Studio-Kapi — spectral-gating noise reduction (Audacity-style)
//
// Algorithm (mirrors Audacity's Noise Reduction effect):
//  1. STFT the signal (Hann window, 75% overlap).
//  2. Estimate a per-frequency noise floor from the quietest frames
//     (mean + std of log-magnitude) — auto noise profile, no manual selection.
//  3. Threshold each bin: mask = magnitude(dB) > noiseMean + sensitivity*noiseStd.
//  4. Smooth the mask over frequency and time to avoid "musical noise".
//  5. Scale the mask by the reduction amount, apply to the spectrum, ISTFT.

const N = 2048
const HOP = 512
const HALF = N / 2

export interface DenoiseOpts {
  reductionDb: number  // how much to attenuate noise (6..30)
  sensitivity: number  // 0..1 -> threshold aggressiveness
}

// In-place iterative radix-2 Cooley-Tukey FFT.
function fft(re: Float32Array, im: Float32Array, inverse = false) {
  const n = re.length
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) { const tr = re[i]; re[i] = re[j]; re[j] = tr; const ti = im[i]; im[i] = im[j]; im[j] = ti }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (inverse ? 2 : -2) * Math.PI / len
    const wlR = Math.cos(ang), wlI = Math.sin(ang)
    for (let i = 0; i < n; i += len) {
      let wR = 1, wI = 0
      for (let k = 0; k < len / 2; k++) {
        const a = i + k, b = a + len / 2
        const vR = re[b] * wR - im[b] * wI
        const vI = re[b] * wI + im[b] * wR
        re[b] = re[a] - vR; im[b] = im[a] - vI
        re[a] += vR; im[a] += vI
        const nwR = wR * wlR - wI * wlI
        wI = wR * wlI + wI * wlR; wR = nwR
      }
    }
  }
  if (inverse) for (let i = 0; i < n; i++) { re[i] /= n; im[i] /= n }
}

function hann(n: number) {
  const w = new Float32Array(n)
  for (let i = 0; i < n; i++) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1))
  return w
}

// Morphological dilation (max) of the mask over frequency then time. Using max
// rather than a mean grows the "keep" regions, so narrowband signal (a vocal
// harmonic) is protected instead of eroded, while isolated noise stays gated.
function smooth(mask: Float32Array[], bins: number, fRad: number, tRad: number) {
  const nF = mask.length
  for (let f = 0; f < nF; f++) {
    const copy = mask[f].slice()
    for (let k = 0; k < bins; k++) {
      let mx = 0
      for (let d = -fRad; d <= fRad; d++) { const kk = k + d; if (kk >= 0 && kk < bins && copy[kk] > mx) mx = copy[kk] }
      mask[f][k] = mx
    }
  }
  const cols = mask.map((g) => g.slice())
  for (let f = 0; f < nF; f++) {
    for (let k = 0; k < bins; k++) {
      let mx = 0
      for (let d = -tRad; d <= tRad; d++) { const ff = f + d; if (ff >= 0 && ff < nF && cols[ff][k] > mx) mx = cols[ff][k] }
      mask[f][k] = mx
    }
  }
}

export function denoiseChannel(input: Float32Array, opts: DenoiseOpts): Float32Array {
  const len = input.length
  if (len < N * 2) return input.slice()
  const win = hann(N)
  // zero-pad both ends by one window so every original sample is fully
  // overlapped (prevents COLA edge amplification on reconstruction).
  const PAD = N
  const work = new Float32Array(len + 2 * PAD)
  work.set(input, PAD)
  const wlen = work.length
  const nFrames = Math.floor((wlen - N) / HOP) + 1
  const re = new Float32Array(N), im = new Float32Array(N)

  // pass 1 — magnitudes
  const mags: Float32Array[] = []
  for (let f = 0; f < nFrames; f++) {
    const off = f * HOP
    for (let i = 0; i < N; i++) { re[i] = work[off + i] * win[i]; im[i] = 0 }
    fft(re, im)
    const m = new Float32Array(HALF + 1)
    for (let k = 0; k <= HALF; k++) m[k] = Math.hypot(re[k], im[k])
    mags.push(m)
  }

  // Auto noise profile: take the lowest-energy frames as "noise-only", then
  // compute per-bin mean + std of log-magnitude across just those frames.
  const energy = mags.map((m) => { let e = 0; for (let k = 0; k <= HALF; k++) e += m[k] * m[k]; return e })
  const maxE = Math.max(...energy)
  // candidate frames only (skip the silent zero-padding frames), lowest 30%
  const candidates = Array.from(energy.keys()).filter((f) => energy[f] > maxE * 1e-4).sort((a, b) => energy[a] - energy[b])
  const noiseCount = Math.max(3, Math.floor(candidates.length * 0.3))
  const noiseFrames = candidates.slice(0, noiseCount)

  // Statistics in the LINEAR magnitude domain (stable; the log domain blows up
  // for near-zero bins and destabilises the threshold).
  const thresh = new Float32Array(HALF + 1)
  const nStd = 1.0 + opts.sensitivity * 3
  for (let k = 0; k <= HALF; k++) {
    let mean = 0
    for (const f of noiseFrames) mean += mags[f][k]
    mean /= noiseFrames.length
    let v = 0
    for (const f of noiseFrames) { const d = mags[f][k] - mean; v += d * d }
    thresh[k] = mean + nStd * Math.sqrt(v / noiseFrames.length)
  }

  const propDecrease = 1 - Math.pow(10, -opts.reductionDb / 20)

  // binary mask -> dilated -> scaled gain
  const gains: Float32Array[] = []
  for (let f = 0; f < nFrames; f++) {
    const g = new Float32Array(HALF + 1)
    for (let k = 0; k <= HALF; k++) g[k] = mags[f][k] > thresh[k] ? 1 : 0
    gains.push(g)
  }
  smooth(gains, HALF + 1, 1, 1)
  for (let f = 0; f < nFrames; f++)
    for (let k = 0; k <= HALF; k++) gains[f][k] = gains[f][k] + (1 - gains[f][k]) * (1 - propDecrease)

  // pass 2 — apply gain and overlap-add
  const out = new Float32Array(wlen)
  const norm = new Float32Array(wlen)
  for (let f = 0; f < nFrames; f++) {
    const off = f * HOP
    for (let i = 0; i < N; i++) { re[i] = work[off + i] * win[i]; im[i] = 0 }
    fft(re, im)
    for (let k = 0; k <= HALF; k++) {
      const gg = gains[f][k]
      re[k] *= gg; im[k] *= gg
      if (k > 0 && k < HALF) { re[N - k] *= gg; im[N - k] *= gg }
    }
    fft(re, im, true)
    for (let i = 0; i < N; i++) { out[off + i] += re[i] * win[i]; norm[off + i] += win[i] * win[i] }
  }
  for (let i = 0; i < wlen; i++) if (norm[i] > 1e-6) out[i] /= norm[i]
  return out.slice(PAD, PAD + len)
}

// Denoise a whole AudioBuffer (all channels) into a new buffer.
export function denoiseBuffer(buffer: AudioBuffer, ctx: BaseAudioContext, opts: DenoiseOpts): AudioBuffer {
  const out = ctx.createBuffer(buffer.numberOfChannels, buffer.length, buffer.sampleRate)
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    out.copyToChannel(denoiseChannel(buffer.getChannelData(c), opts), c)
  }
  return out
}
