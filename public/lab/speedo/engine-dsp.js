/*
 * Shared procedural engine-sound DSP.
 *
 * Single source of truth used by BOTH playback paths:
 *   - engine-processor.js (AudioWorklet) on secure contexts (https / localhost)
 *   - a ScriptProcessorNode fallback for insecure contexts (e.g. a phone
 *     hitting the dev server over http on the LAN), where AudioWorklet is
 *     undefined.
 *
 * A per-cylinder firing pulse train excites a bank of resonant filters
 * (exhaust body), layered with induction noise, a sub rumble for idle lope
 * and decel pops on overrun. Driven live from the physics sim.
 */

export class EngineDSP {
  constructor(sampleRate) {
    this.sr = sampleRate

    // live params (smoothed toward targets)
    this.rpm = 850;  this.rpmT = 850
    this.thr = 0;    this.thrT = 0
    this.load = 0;   this.loadT = 0
    this.cyl = 8
    this.running = true

    // per-engine voice character (smoothed)
    this.grunt = 0.5;  this.gruntT = 0.5    // low-end body / rumble
    this.scream = 0.4; this.screamT = 0.4   // aggressive high-rpm top end
    this.noiseAmt = 1; this.noiseAmtT = 1   // induction "air" hiss on throttle
    this.turbo = 0; this.turboT = 0         // twin-turbo amount (0 = none)
    this.ev = 0                             // electric mode (sci-fi motor whine)
    this.redline = 8500                     // per-engine, for correct rpm scaling
    this.evPhase = 0; this.evPhase2 = 0; this.evPhase3 = 0; this.evPhase4 = 0

    // turbo state
    this.boost = 0          // current boost pressure (0..1)
    this.whPhase = 0        // spool-whistle oscillators (two = "twin")
    this.whPhase2 = 0
    this.bov = 0            // blow-off envelope
    this.bovLfo = 0         // flutter LFO ("tutututu")
    this.bovNlp = 0         // blow-off noise lowpass
    this.bovArmed = true    // re-arms on throttle, fires once on lift

    // firing state
    this.phase = 0
    this.cylIdx = 0
    this.subPhase = 0
    this.sawPhase = 0
    this.cylGain = new Float32Array(12)
    for (let i = 0; i < 12; i++) this.cylGain[i] = 0.8 + Math.random() * 0.4

    // state-variable resonators (Chamberlin)
    this.r1l = 0; this.r1b = 0
    this.r2l = 0; this.r2b = 0
    this.r3l = 0; this.r3b = 0
    this.r4l = 0; this.r4b = 0   // high "scream" formant
    this.lp = 0     // master tone lowpass
    this.nlp = 0    // induction noise lowpass
    this.pop = 0    // decel pop env
    this.dcx = 0; this.dcy = 0 // dc blocker
    this.amp = 0    // startup ramp (avoid click)
  }

  setParams(d) {
    if (d.rpm !== undefined) this.rpmT = d.rpm
    if (d.throttle !== undefined) this.thrT = d.throttle
    if (d.load !== undefined) this.loadT = d.load
    if (d.cylinders !== undefined) this.cyl = d.cylinders
    if (d.running !== undefined) this.running = d.running
    if (d.grunt !== undefined) this.gruntT = d.grunt
    if (d.scream !== undefined) this.screamT = d.scream
    if (d.noise !== undefined) this.noiseAmtT = d.noise
    if (d.turbo !== undefined) this.turboT = d.turbo
    if (d.ev !== undefined) this.ev = d.ev
    if (d.redline !== undefined) this.redline = d.redline
  }

  render(L, R, n) {
    const sr = this.sr
    const redline = this.redline || 8500
    const TAU = 6.28318530718

    for (let i = 0; i < n; i++) {
      // smooth params (per-sample, avoids zipper noise)
      this.rpm += (this.rpmT - this.rpm) * 0.0035
      this.thr += (this.thrT - this.thr) * 0.004
      this.load += (this.loadT - this.load) * 0.004
      this.grunt += (this.gruntT - this.grunt) * 0.002
      this.scream += (this.screamT - this.scream) * 0.002
      this.noiseAmt += (this.noiseAmtT - this.noiseAmt) * 0.002
      this.turbo += (this.turboT - this.turbo) * 0.002

      const rpm = this.rpm
      const thr = this.thr
      const grunt = this.grunt
      const scream = this.scream
      const turbo = this.turbo
      const rpmNorm = Math.min(1, rpm / redline)
      // how hard it screams: ramps in steeply toward redline, opens with throttle
      const screamAmt = scream * (0.2 + 0.8 * rpmNorm * rpmNorm) * (0.45 + 0.55 * thr)

      // ── ELECTRIC: warm motor hum (no combustion) ──
      // Built around a deep fundamental with only octave-related partials, so it
      // reads as a smooth hum that rises with revs. The old perfect-fifth layer
      // (f0 * 1.5) was what gave it that feline / vocal "meow"; it's gone.
      if (this.ev) {
        const f0 = 64 + rpmNorm * 1300                  // deeper base = hum, not whine
        this.evPhase  += f0 / sr;            if (this.evPhase  >= 1) this.evPhase  -= 1
        this.evPhase2 += (f0 * 2.004) / sr;  if (this.evPhase2 >= 1) this.evPhase2 -= 1  // octave, tiny detune = slow chorus
        this.evPhase3 += (f0 * 3) / sr;      if (this.evPhase3 >= 1) this.evPhase3 -= 1  // gentle presence, fades in up high
        // sub one octave below the fundamental — the body of the hum
        this.subPhase += (f0 * 0.5) / sr;    if (this.subPhase >= 1) this.subPhase -= 1
        const tone =
          Math.sin(TAU * this.evPhase)  * 0.62 +
          Math.sin(TAU * this.evPhase2) * 0.26 * (0.5 + 0.5 * thr) +
          Math.sin(TAU * this.evPhase3) * 0.09 * rpmNorm * rpmNorm  // only bites near top speed
        const subHum = Math.sin(TAU * this.subPhase) * 0.5 * (0.6 + 0.4 * rpmNorm)
        // faint inverter shimmer — whispers in only at high revs, never glassy
        this.nlp += 0.5 * ((Math.random() * 2 - 1) - this.nlp)
        const shimmer = this.nlp * 0.022 * rpmNorm * rpmNorm * (0.4 + 0.6 * thr)
        let sig = tone * (0.3 + 0.5 * thr) + subHum * 0.6 + shimmer
        // one-pole lowpass rounds off the top so it hums; opens a touch with speed
        const evCut = 0.10 + 0.32 * rpmNorm + 0.08 * thr
        this.lp += evCut * (sig - this.lp)
        sig = this.lp * 0.82 + sig * 0.18
        sig = Math.tanh(sig * 1.3)
        const yEv = sig - this.dcx + 0.997 * this.dcy
        this.dcx = sig; this.dcy = yEv
        const tgtEv = this.running ? 1 : 0
        this.amp += (tgtEv - this.amp) * 0.0008
        const oEv = yEv * 0.55 * this.amp
        L[i] = oEv
        R[i] = oEv * 0.95 + (Math.random() * 2 - 1) * 0.003 * this.amp
        continue
      }

      // firing frequency: 4-stroke fires cyl/2 times per revolution
      const fire = (rpm / 60) * (this.cyl / 2)
      const inc = fire / sr

      this.phase += inc
      if (this.phase >= 1) {
        this.phase -= 1
        this.cylIdx = (this.cylIdx + 1) % this.cyl
        if (thr < 0.12 && rpm > 3200 && Math.random() < 0.18) this.pop = 1
      }

      // combustion pulse (shaped burst per firing) — sharper when screaming
      // (a tighter pulse is richer in high harmonics)
      const duty = 0.42 - 0.16 * scream
      let exc = 0
      if (this.phase < duty) {
        const ss = Math.sin(Math.PI * this.phase / duty)
        exc = Math.pow(ss, 2 + scream * 2.5)
      }
      const intensity = (0.34 + 0.66 * thr) * (0.55 + 0.45 * rpmNorm)
      exc *= this.cylGain[this.cylIdx] * intensity

      // resonator bank (exhaust / body formants), drifting up with rpm
      const drift = 1 + 0.18 * rpmNorm
      const f1 = 2 * Math.sin(Math.PI * Math.min(0.49, (95 * drift) / sr))
      const f2 = 2 * Math.sin(Math.PI * Math.min(0.49, (230 * drift) / sr))
      const f3 = 2 * Math.sin(Math.PI * Math.min(0.49, (640 * drift) / sr))
      const f4 = 2 * Math.sin(Math.PI * Math.min(0.49, (1650 * drift) / sr))

      this.r1l += f1 * this.r1b
      const h1 = exc - this.r1l - 0.22 * this.r1b
      this.r1b += f1 * h1

      this.r2l += f2 * this.r2b
      const h2 = exc - this.r2l - 0.28 * this.r2b
      this.r2b += f2 * h2

      this.r3l += f3 * this.r3b
      const h3 = exc - this.r3l - 0.5 * this.r3b
      this.r3b += f3 * h3

      // high "scream" formant — only audible up high / on throttle
      this.r4l += f4 * this.r4b
      const h4 = exc - this.r4l - 0.32 * this.r4b
      this.r4b += f4 * h4

      // grunt boosts the low-end body + sub; scream adds the high formant
      const body = this.r1b * (1.0 + 0.7 * grunt) + this.r2b * 0.75 + this.r3b * 0.4
      const scr = this.r4b * screamAmt * 1.5

      // metallic top-end howl (band-limited-ish saw at a high harmonic of firing)
      this.sawPhase += (fire * 4) / sr
      if (this.sawPhase >= 1) this.sawPhase -= 1
      const howl = (2 * this.sawPhase - 1) * screamAmt * 0.18

      // induction / turbulence noise — brighter + louder when screaming
      const white = Math.random() * 2 - 1
      const ncut = 0.05 + 0.5 * thr + 0.25 * rpmNorm + 0.28 * screamAmt
      this.nlp += ncut * (white - this.nlp)
      const noise = this.nlp * (0.12 + 0.5 * thr) * (0.4 + 0.6 * rpmNorm) * (1 + 0.7 * scream * rpmNorm) * this.noiseAmt

      // decel pops
      let popSig = 0
      if (this.pop > 0.001) {
        popSig = (Math.random() * 2 - 1) * this.pop * 0.6
        this.pop *= 0.86
      }

      // sub rumble (half firing freq = lope) — grunt deepens it
      this.subPhase += (fire * 0.5) / sr
      if (this.subPhase >= 1) this.subPhase -= 1
      const sub = Math.sin(2 * Math.PI * this.subPhase) * (0.18 + 0.12 * (1 - thr)) * (0.5 + 0.5 * rpmNorm) * (0.7 + 1.0 * grunt)

      // ── twin-turbo ──────────────────────────────────────────────
      // boost builds with revs + throttle (spool lag on, quick bleed off)
      const boostTarget = turbo > 0.001 ? thr * (0.18 + 0.82 * rpmNorm) : 0
      this.boost += (boostTarget - this.boost) * (boostTarget > this.boost ? 0.00004 : 0.00022)
      // blow-off valve: arm on throttle, fire once when you lift while boosted
      if (this.thrT > 0.5) this.bovArmed = true
      if (this.thrT < 0.16 && this.boost > 0.3 && this.bovArmed) { this.bov = 1; this.bovArmed = false }
      if (this.bov > 0.01) this.boost *= 0.9994 // dump pressure on blow-off

      // spool whistle — two slightly detuned oscillators (twin), pitch rises with boost
      const whFreq = 1700 + this.boost * 5800
      this.whPhase += whFreq / sr; if (this.whPhase >= 1) this.whPhase -= 1
      this.whPhase2 += (whFreq * 1.013) / sr; if (this.whPhase2 >= 1) this.whPhase2 -= 1
      const whistle = (Math.sin(6.28318 * this.whPhase) + 0.6 * Math.sin(6.28318 * this.whPhase2)) *
        Math.pow(this.boost, 1.7) * 0.13 * turbo

      // blow-off "pshhh" + flutter ("tutututu")
      let bovSig = 0
      if (this.bov > 0.001) {
        this.bovLfo += 30 / sr; if (this.bovLfo >= 1) this.bovLfo -= 1
        const flutter = Math.pow(0.5 + 0.5 * Math.sin(6.28318 * this.bovLfo), 2)
        this.bovNlp += 0.4 * ((Math.random() * 2 - 1) - this.bovNlp)
        bovSig = this.bovNlp * this.bov * (0.35 + 0.65 * flutter) * 0.55 * turbo
        this.bov *= 0.99955 // decay over ~0.4s
      }

      // mix + master tone lowpass (opens with throttle, brighter when screaming)
      let sig = body * 1.6 + noise + popSig + sub + scr + howl
      const tone = 0.18 + 0.55 * thr + 0.22 * rpmNorm + 0.28 * screamAmt
      this.lp += Math.min(0.98, tone) * (sig - this.lp)
      sig = this.lp * 0.7 + sig * 0.3

      // turbo sits on top, full brightness (not dulled by the engine tone filter)
      sig += whistle + bovSig

      sig = Math.tanh(sig * 1.4)

      // dc blocker
      const y = sig - this.dcx + 0.997 * this.dcy
      this.dcx = sig
      this.dcy = y

      // startup ramp / shutdown
      const target = this.running ? 1 : 0
      this.amp += (target - this.amp) * 0.0008
      const o = y * 0.5 * this.amp

      L[i] = o
      R[i] = o * 0.94 + (Math.random() * 2 - 1) * 0.004 * this.amp
    }
  }
}
