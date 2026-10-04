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
 *
 * What makes it read as a real engine rather than a buzz:
 *   - no two combustions are identical: every firing gets its own small
 *     timing + strength wobble (most at idle, almost none under load)
 *   - firing intervals follow each engine's layout, so a cross-plane V8 lopes
 *   - V engines split their banks left/right like a dual exhaust
 *   - real overrun bangs and upshift braps (resonant bursts, not clicks)
 *   - the start ritual: relay click, fuel-pump whine, starter chug, the catch
 *   - the car around it: wind, tyre roar and drivetrain whine with road speed
 */

// firing-interval multipliers per cylinder count (mean 1). Even-fire engines
// get only a whisper of mechanical tolerance; the cross-plane V8 gets the
// uneven bank-to-bank pulse spacing that makes its burble.
const PATTERNS = {
  4: [1.012, 0.988, 1.006, 0.994],
  6: [1.02, 0.98, 1.012, 0.988, 1.006, 0.994],
  8: [1.10, 0.90, 1.06, 0.94, 0.90, 1.10, 0.94, 1.06],
  10: [1.03, 0.97, 1.02, 0.98, 1.0, 1.0, 0.97, 1.03, 0.98, 1.02],
}
const EVEN = [1]

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
    this.crackle = 0.6                      // overrun bangs + upshift braps
    this.ev = 0                             // electric mode (sci-fi motor whine)
    this.redline = 8500                     // per-engine, for correct rpm scaling
    this.evPhase = 0; this.evPhase2 = 0; this.evPhase3 = 0; this.evPhase4 = 0

    // drivetrain + car (from the sim)
    this.speed = 0; this.speedT = 0         // km/h
    this.gear = 0
    this.combust = 1; this.combustT = 1     // 0 = compression only (cranking / key off)
    this.crankAmt = 0; this.crankT = 0      // starter motor engaged
    this.primeAmt = 0; this.primeT = 0      // fuel pump priming

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
    this.interval = 1       // this firing's length relative to an even interval
    this.fireAmp = 1        // this firing's strength
    this.cylGain = new Float32Array(12)
    this.seed = 0x2f6b9e1d
    for (let i = 0; i < 12; i++) this.cylGain[i] = 0.8 + (this.rand() * 0.5 + 0.5) * 0.4

    // state-variable resonators (Chamberlin), [low, band] pairs:
    // 0..7 = left bank formants 1-4, 8..15 = right bank
    this.sv = new Float64Array(16)
    this.f1 = 0; this.f2 = 0; this.f3 = 0; this.f4 = 0 // coefficients, refreshed per block
    this.blk = 0
    this.lpL = 0; this.lpR = 0  // master tone lowpass
    this.lp = 0                 // EV tone lowpass
    this.nlp = 0    // induction noise lowpass
    this.pop = 0    // overrun fizz env
    this.dcxL = 0; this.dcyL = 0; this.dcxR = 0; this.dcyR = 0 // dc blockers
    this.dcx = 0; this.dcy = 0
    this.amp = 0    // startup ramp (avoid click)

    // overrun bangs: unburnt fuel lighting off in the exhaust after a lift
    this.armed = false; this.liftT = 9
    this.bang = 0; this.bangF = 0.03; this.bangPan = 0; this.bl = 0; this.bb = 0
    this.bangQ = 0; this.bangGap = 0; this.bangLvl = 1
    this.bangDecay = Math.exp(-1 / (sampleRate * 0.022))

    // starter + pump + one-shots
    this.stPhase = 0; this.stPhase2 = 0; this.stLp = 0
    this.pumpPh = 0
    this.click = 0; this.clickPh = 0; this.clickDecay = Math.exp(-1 / (sampleRate * 0.007))
    this.thunk = 0; this.thunkPh = 0; this.thunkLp = 0; this.thunkDecay = Math.exp(-1 / (sampleRate * 0.11))
    this.beepT = -1; this.beepPh = 0

    // road layer
    this.wL = 0; this.wL2 = 0; this.wR = 0; this.wR2 = 0
    this.rd = 0; this.rd2 = 0
    this.gust = 0
    this.whinePh = 0
  }

  // xorshift32, uniform in [-1, 1): far cheaper than Math.random per sample
  rand() {
    let x = this.seed
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5
    this.seed = x | 0
    return this.seed / 2147483648
  }

  fireBang(level) {
    this.bang = level
    const f = 130 + (this.rand() * 0.5 + 0.5) * 230 // each bang has its own pitch
    this.bangF = 2 * Math.sin(Math.PI * f / this.sr)
    this.bangPan = this.rand() * 0.45
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
    if (d.crackle !== undefined) this.crackle = d.crackle
    if (d.ev !== undefined) this.ev = d.ev
    if (d.redline !== undefined) this.redline = d.redline
    if (d.speed !== undefined) this.speedT = d.speed
    if (d.gear !== undefined) this.gear = d.gear
    if (d.combust !== undefined) this.combustT = d.combust
    if (d.crank !== undefined) this.crankT = d.crank
    if (d.prime !== undefined) this.primeT = d.prime
    switch (d.event) {
      case 'click': this.click = 1; break
      // ignition cut on an upshift: a quick 2-3 bang "brap"
      case 'brap': if (this.crackle > 0) { this.bangQ = 2 + (this.rand() > 0.2 ? 1 : 0); this.bangGap = 0; this.bangLvl = 0.6 + 0.4 * this.crackle } break
      // bouncing off the limiter now and then spits one
      case 'cut': if (this.crackle > 0 && this.rand() > 0.35) { this.bangQ = 1; this.bangGap = 0; this.bangLvl = 0.35 + 0.3 * this.crackle } break
      case 'stop': this.thunk = 1; this.thunkPh = 0; break
      case 'deny': this.beepT = 0; break
    }
  }

  render(L, R, n) {
    const sr = this.sr
    const dt = 1 / sr
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
      this.speed += (this.speedT - this.speed) * 0.0005
      this.combust += (this.combustT - this.combust) * 0.003
      this.crankAmt += (this.crankT - this.crankAmt) * 0.0015
      this.primeAmt += (this.primeT - this.primeAmt) * 0.0006

      const rpm = this.rpm
      const thr = this.thr
      const grunt = this.grunt
      const scream = this.scream
      const turbo = this.turbo
      const rpmNorm = Math.min(1, rpm / redline)
      // how hard it screams: ramps in steeply toward redline, opens with throttle
      const screamAmt = scream * (0.2 + 0.8 * rpmNorm * rpmNorm) * (0.45 + 0.55 * thr)

      let outL = 0
      let outR = 0

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
        this.nlp += 0.5 * (this.rand() - this.nlp)
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
        outL = oEv
        outR = oEv * 0.95 + this.rand() * 0.003 * this.amp
      } else {
        const combust = this.combust

        // resonator coefficients drift slowly with rpm: refresh every 32 samples
        if (this.blk-- <= 0) {
          this.blk = 31
          const drift = 1 + 0.18 * rpmNorm
          this.f1 = 2 * Math.sin(Math.PI * Math.min(0.49, (95 * drift) / sr))
          this.f2 = 2 * Math.sin(Math.PI * Math.min(0.49, (230 * drift) / sr))
          this.f3 = 2 * Math.sin(Math.PI * Math.min(0.49, (640 * drift) / sr))
          this.f4 = 2 * Math.sin(Math.PI * Math.min(0.49, (1650 * drift) / sr))
        }

        // overrun window: arms under load, then runs ~1.6 s after you lift
        if (this.thrT > 0.5 && rpmNorm > 0.45) { this.armed = true; this.liftT = 0 }
        else if (this.armed && this.thrT < 0.12) { this.liftT += dt; if (this.liftT > 1.6) this.armed = false }

        // firing frequency: 4-stroke fires cyl/2 times per revolution
        const fire = (rpm / 60) * (this.cyl / 2)
        this.phase += fire / sr / this.interval
        if (this.phase >= 1) {
          this.phase -= 1
          this.cylIdx = (this.cylIdx + 1) % this.cyl
          // every combustion is a little different: loose at idle, tight on load
          const slack = (1 - thr) * (1 - rpmNorm)
          const pat = PATTERNS[this.cyl] || EVEN
          const uneven = 1 - 0.6 * rpmNorm // the V8 lope smooths out as it revs
          this.interval = 1 + (pat[this.cylIdx % pat.length] - 1) * uneven + (0.004 + 0.03 * slack) * this.rand()
          this.fireAmp = this.cylGain[this.cylIdx] * (1 + (0.05 + 0.22 * slack) * this.rand())
          if (combust > 0.5 && thr < 0.12 && rpm > 3200 && this.rand() < -0.64) this.pop = 1 // fizz, p ≈ 0.18
          // overrun bangs, a handful per second, thinning out as the window closes
          if (this.armed && this.thrT < 0.12 && combust > 0.5 && this.bang < 0.05 && fire > 1) {
            const perSec = this.crackle * 7 * (1 - this.liftT / 1.6)
            if (this.rand() * 0.5 + 0.5 < perSec / fire) this.fireBang(0.45 + 0.4 * (this.rand() * 0.5 + 0.5))
          }
        }

        // combustion pulse (shaped burst per firing) — sharper when screaming
        // (a tighter pulse is richer in high harmonics)
        const duty = 0.42 - 0.16 * scream
        let exc = 0
        if (this.phase < duty) {
          const ss = Math.sin(Math.PI * this.phase / duty)
          exc = Math.pow(ss, 2 + scream * 2.5)
        }
        const fired = (0.34 + 0.66 * thr) * (0.55 + 0.45 * rpmNorm) * this.fireAmp
        // no fuel / spark: just air being squeezed, a soft round push per stroke
        const squeezed = 0.3 * this.cylGain[this.cylIdx]
        exc *= fired * combust + squeezed * (1 - combust)

        // V engines: alternate firings go down the left and right pipes
        const side = this.cyl >= 6 ? ((this.cylIdx & 1) ? 0.2 : -0.2) : 0
        const xL = exc * (1 + side)
        const xR = exc * (1 - side)

        // resonator bank (exhaust / body formants), one per bank
        const S = this.sv
        const f1 = this.f1, f2 = this.f2, f3 = this.f3, f4 = this.f4
        let h
        S[0] += f1 * S[1]; h = xL - S[0] - 0.22 * S[1]; S[1] += f1 * h
        S[2] += f2 * S[3]; h = xL - S[2] - 0.28 * S[3]; S[3] += f2 * h
        S[4] += f3 * S[5]; h = xL - S[4] - 0.5 * S[5]; S[5] += f3 * h
        S[6] += f4 * S[7]; h = xL - S[6] - 0.32 * S[7]; S[7] += f4 * h
        S[8] += f1 * S[9]; h = xR - S[8] - 0.22 * S[9]; S[9] += f1 * h
        S[10] += f2 * S[11]; h = xR - S[10] - 0.28 * S[11]; S[11] += f2 * h
        S[12] += f3 * S[13]; h = xR - S[12] - 0.5 * S[13]; S[13] += f3 * h
        S[14] += f4 * S[15]; h = xR - S[14] - 0.32 * S[15]; S[15] += f4 * h

        // grunt boosts the low-end body + sub; scream adds the high formant
        const bodyL = S[1] * (1.0 + 0.7 * grunt) + S[3] * 0.75 + S[5] * 0.4
        const bodyR = S[9] * (1.0 + 0.7 * grunt) + S[11] * 0.75 + S[13] * 0.4
        const scrL = S[7] * screamAmt * 1.5
        const scrR = S[15] * screamAmt * 1.5

        // metallic top-end howl (band-limited-ish saw at a high harmonic of firing)
        this.sawPhase += (fire * 4) / sr
        if (this.sawPhase >= 1) this.sawPhase -= 1
        const howl = (2 * this.sawPhase - 1) * screamAmt * 0.18 * (0.15 + 0.85 * combust)

        // induction / turbulence noise — brighter + louder when screaming
        const white = this.rand()
        const ncut = 0.05 + 0.5 * thr + 0.25 * rpmNorm + 0.28 * screamAmt
        this.nlp += ncut * (white - this.nlp)
        const noise = this.nlp * (0.12 + 0.5 * thr) * (0.4 + 0.6 * rpmNorm) * (1 + 0.7 * scream * rpmNorm) * this.noiseAmt

        // overrun fizz
        let popSig = 0
        if (this.pop > 0.001) {
          popSig = this.rand() * this.pop * 0.5
          this.pop *= 0.86
        }

        // queued braps fire in a quick ragged burst
        if (this.bangQ > 0) {
          this.bangGap -= dt
          if (this.bangGap <= 0) {
            this.fireBang(this.bangLvl * (0.75 + 0.25 * (this.rand() * 0.5 + 0.5)))
            this.bangQ--
            this.bangGap = 0.026 + 0.03 * (this.rand() * 0.5 + 0.5)
          }
        }
        // a bang: noise burst ringing a low resonance, the "crack" of the exhaust
        let bangSig = 0
        if (this.bang > 0.002) {
          const x = this.rand() * this.bang
          this.bl += this.bangF * this.bb; h = x - this.bl - 0.3 * this.bb; this.bb += this.bangF * h
          bangSig = (this.bb * 1.5 + x * 0.6) * 1.1
          this.bang *= this.bangDecay
        }

        // sub rumble (half firing freq = lope) — grunt deepens it
        this.subPhase += (fire * 0.5) / sr
        if (this.subPhase >= 1) this.subPhase -= 1
        const sub = Math.sin(TAU * this.subPhase) * (0.18 + 0.12 * (1 - thr)) * (0.5 + 0.5 * rpmNorm) * (0.7 + 1.0 * grunt)

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
        const whistle = (Math.sin(TAU * this.whPhase) + 0.6 * Math.sin(TAU * this.whPhase2)) *
          Math.pow(this.boost, 1.7) * 0.13 * turbo

        // blow-off "pshhh" + flutter ("tutututu")
        let bovSig = 0
        if (this.bov > 0.001) {
          this.bovLfo += 30 / sr; if (this.bovLfo >= 1) this.bovLfo -= 1
          const flutter = Math.pow(0.5 + 0.5 * Math.sin(TAU * this.bovLfo), 2)
          this.bovNlp += 0.4 * (this.rand() - this.bovNlp)
          bovSig = this.bovNlp * this.bov * (0.35 + 0.65 * flutter) * 0.55 * turbo
          this.bov *= 0.99955 // decay over ~0.4s
        }

        // mix + master tone lowpass (opens with throttle, brighter when screaming)
        const shared = noise + popSig + sub + howl
        let sigL = bodyL * 1.6 + shared + scrL + bangSig * (1 - this.bangPan)
        let sigR = bodyR * 1.6 + shared + scrR + bangSig * (1 + this.bangPan)
        const tone = Math.min(0.98, 0.18 + 0.55 * thr + 0.22 * rpmNorm + 0.28 * screamAmt)
        this.lpL += tone * (sigL - this.lpL)
        this.lpR += tone * (sigR - this.lpR)
        sigL = this.lpL * 0.7 + sigL * 0.3
        sigR = this.lpR * 0.7 + sigR * 0.3

        // turbo sits on top, full brightness (not dulled by the engine tone filter)
        sigL = Math.tanh((sigL + whistle + bovSig) * 1.4)
        sigR = Math.tanh((sigR + whistle + bovSig) * 1.4)

        // dc blockers
        const yL = sigL - this.dcxL + 0.997 * this.dcyL
        this.dcxL = sigL; this.dcyL = yL
        const yR = sigR - this.dcxR + 0.997 * this.dcyR
        this.dcxR = sigR; this.dcyR = yR

        // startup ramp / shutdown; a stopped crank makes no sound at all
        const target = this.running ? 1 : 0
        this.amp += (target - this.amp) * 0.0008
        const g = 0.5 * this.amp * Math.min(1, rpm / 120)
        outL = yL * g
        outR = yR * g + this.rand() * 0.003 * this.amp

        // starter motor: a whirring pinion that labours on every compression
        if (this.crankAmt > 0.002) {
          const stF = 40 + rpm * 1.9
          this.stPhase += stF / sr; if (this.stPhase >= 1) this.stPhase -= 1
          this.stPhase2 += (stF * 2.71) / sr; if (this.stPhase2 >= 1) this.stPhase2 -= 1
          const raw = (2 * this.stPhase - 1) * 0.6 + Math.sin(TAU * this.stPhase2) * 0.35 + this.rand() * 0.15
          this.stLp += 0.22 * (raw - this.stLp)
          const labour = 1 - 0.55 * Math.pow(Math.sin(Math.PI * this.phase), 2)
          const st = this.stLp * 0.075 * this.crankAmt * labour
          outL += st
          outR += st * 0.92
        }
      }

      // ── the car around the engine (EV + combustion) ──
      const v = this.speed
      if (v > 0.5) {
        const vN = Math.min(1.3, v / 250)
        // wind: decorrelated left/right noise, two soft poles, brightening with speed
        this.gust += (0.00002) * (this.rand() * 40 - this.gust)
        const wc = 0.025 + 0.11 * vN
        this.wL += wc * (this.rand() - this.wL); this.wL2 += wc * (this.wL - this.wL2)
        this.wR += wc * (this.rand() - this.wR); this.wR2 += wc * (this.wR - this.wR2)
        const wind = vN * vN * 0.9 * (0.88 + 0.12 * Math.tanh(this.gust))
        // tyre roar: dark rumble that comes in early and grows steadily
        this.rd += 0.012 * (this.rand() - this.rd); this.rd2 += 0.03 * (this.rd - this.rd2)
        const road = this.rd2 * 2.2 * Math.pow(vN, 1.1)
        // drivetrain whine: pitch follows road speed, louder when driven
        this.whinePh += (v * 8.5) / sr; if (this.whinePh >= 1) this.whinePh -= 1
        const whine = this.gear > 0
          ? Math.sin(TAU * this.whinePh) * 0.007 * (0.3 + 0.7 * thr) * Math.min(1, v / 30)
          : 0
        outL += this.wL2 * wind + road + whine
        outR += this.wR2 * wind + road * 0.96 + whine
      }

      // fuel pump priming: a thin electric whine from the back of the car
      if (this.primeAmt > 0.002) {
        this.pumpPh += 186 / sr; if (this.pumpPh >= 1) this.pumpPh -= 1
        const pump = (Math.sin(TAU * this.pumpPh) + 0.35 * Math.sin(TAU * 3 * this.pumpPh)) * 0.013 * this.primeAmt
        outL += pump * 0.8
        outR += pump
      }

      // ignition relay click
      if (this.click > 0.002) {
        this.clickPh += 2300 / sr; if (this.clickPh >= 1) this.clickPh -= 1
        const c = (this.rand() * 0.6 + Math.sin(TAU * this.clickPh) * 0.5) * this.click * 0.22
        outL += c; outR += c * 0.85
        this.click *= this.clickDecay
      }

      // the engine rocking to rest on its mounts as it stops
      if (this.thunk > 0.002) {
        this.thunkPh += 46 / sr; if (this.thunkPh >= 1) this.thunkPh -= 1
        this.thunkLp += 0.02 * (this.rand() - this.thunkLp)
        const th = (Math.sin(TAU * this.thunkPh) * 0.9 + this.thunkLp * 3) * this.thunk * 0.3
        outL += th; outR += th
        this.thunk *= this.thunkDecay
      }

      // gearbox says no: two soft cabin chimes
      if (this.beepT >= 0) {
        this.beepT += dt
        const on = this.beepT < 0.07 || (this.beepT > 0.13 && this.beepT < 0.2)
        if (on) {
          this.beepPh += 1760 / sr; if (this.beepPh >= 1) this.beepPh -= 1
          const b = Math.sin(TAU * this.beepPh) * 0.05
          outL += b; outR += b
        }
        if (this.beepT > 0.2) this.beepT = -1
      }

      // gentle soft clip: transparent at normal levels, rounds off a pile-up of
      // engine + wind + a bang at full speed instead of hard clipping
      L[i] = Math.tanh(outL * 1.1) * 0.91
      R[i] = Math.tanh(outR * 1.1) * 0.91
    }
  }
}
