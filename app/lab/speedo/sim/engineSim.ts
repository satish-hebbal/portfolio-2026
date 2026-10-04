// Engine + drivetrain physics simulation.
//
// Adapted from the model in markeasting/engine-audio (Engine / Drivetrain /
// Vehicle), simplified into a single stable integrator tuned for feel: a
// free-revving engine in neutral, an auto-clutch that bites off engine revs,
// a locked driveline in gear, vehicle mass with drag / rolling / braking, and
// a fuel-cut rev limiter that bounces off redline.
//
// On top of that, the things a real car does that a tach needle gives away:
//   - a start ritual: fuel-pump prime, starter crank (needle chugging ~250 rpm
//     on each compression), the catch, a flare past idle, then a warm-up idle
//     that eases down over several seconds
//   - an idle controller that actually holds idle, with a faint hunt
//   - timed gearshifts: clutch opens, ignition cut on upshifts (the "brap"),
//     a rev-matching throttle blip on downshifts, then the clutch bites again
//   - driveline shunt: the shafts wind up like a spring, so tip-in, lift-off,
//     shifts and the limiter all make the revs kick and settle
//   - an engine that stops in well under a second when the key is off
//
// Integrated in fixed sub-steps so it behaves the same at 30, 60 or 144 fps.

const clamp = (v: number, a: number, b: number) => Math.min(Math.max(v, a), b)
const RAD_TO_RPM = 60 / (2 * Math.PI)

export interface EnginePreset {
  name: string
  cylinders: number
  idle: number
  redline: number
  limiter: number
  peakTorqueNm: number
  peakRpm: number
  inertia: number // free-rev responsiveness (lower = snappier)
  finalDrive: number // axle ratio: sets where the rev limiter caps top speed
  grunt: number   // sound: low-end body / rumble (0..1)
  scream: number  // sound: aggressive high-rpm top end (0..1)
  noise: number   // sound: induction "air" hiss on throttle (0..1.5)
  turbo: number   // sound: twin-turbo whistle + blow-off (0..1)
  crackle: number // sound: overrun pops + upshift braps from the exhaust (0..1)
  shiftTime: number // s the clutch is open per gearshift
  crankTime: number // s on the starter before it catches
  ev?: boolean    // electric motor (sci-fi whine instead of combustion)
}

// ordered ascending: calm/low-power → aggressive/high-power, then electric.
// Top speed climbs across the lineup: the Inline-4 runs out of breath first,
// the V8 pulls a bit further, and the V10 screams to ~300 km/h. peakTorqueNm +
// finalDrive are tuned together so each engine actually drags itself to the rev
// limiter in top gear (verified in sim), so the V10 feels genuinely brutal.
export const PRESETS: EnginePreset[] = [
  { name: 'Inline-4',  cylinders: 4, idle: 950, redline: 8600, limiter: 8400, peakTorqueNm: 360, peakRpm: 6000, inertia: 0.18, finalDrive: 3.95, grunt: 0.75, scream: 0.93, noise: 0.32, turbo: 1.00, crackle: 0.45, shiftTime: 0.13, crankTime: 0.55 },
  { name: 'V8',        cylinders: 8, idle: 820, redline: 7200, limiter: 7000, peakTorqueNm: 620, peakRpm: 4600, inertia: 0.30, finalDrive: 2.92, grunt: 1.00, scream: 0.25, noise: 0.73, turbo: 1.00, crackle: 0.85, shiftTime: 0.16, crankTime: 0.8 },
  { name: 'V10',       cylinders: 10, idle: 1000, redline: 8800, limiter: 8600, peakTorqueNm: 860, peakRpm: 5800, inertia: 0.34, finalDrive: 3.04, grunt: 1.00, scream: 0.31, noise: 1.13, turbo: 0.89, crackle: 1.0, shiftTime: 0.08, crankTime: 0.65 },
  { name: 'EV',        cylinders: 1, idle: 1, redline: 12000, limiter: 11800, peakTorqueNm: 900, peakRpm: 3000, inertia: 0.12, finalDrive: 4.45, grunt: 0, scream: 0, noise: 0, turbo: 0, crackle: 0, shiftTime: 0, crankTime: 0, ev: true },
]

const GEARS = [3.4, 2.36, 1.85, 1.47, 1.24, 1.07]
const WHEEL_RADIUS = 0.31 // m
const MASS = 1320 // kg
const STEP = 1 / 240 // s, fixed integration sub-step
const PRIME_TIME = 1.3 // s of fuel-pump prime before the starter engages (needles sweep meanwhile)
const CLUTCH_BITE = 0.09 // s for the clutch to close again after a shift

export type Stage = 'off' | 'prime' | 'crank' | 'run'
// one-shot moments the cluster / audio react to (drained by the page each frame)
export type SimEvent = 'click' | 'crank' | 'catch' | 'shift-up' | 'shift-down' | 'deny' | 'cut' | 'stop'

export interface SimState {
  rpm: number
  speedKmh: number
  gear: number // 0 = neutral, 1..6
  throttle: number // applied (after limiter / shift cut / blip)
  brake: number
  atLimiter: boolean
  preset: EnginePreset
  stage: Stage
  combusting: boolean // fuel + spark: false while priming, cranking or key-off
  clutch: number // 0 open .. 1 closed
}

// friction + pumping losses, Nm, for a ~2 L engine. Pumping (a closed
// throttle choking the engine) is why revs drop fast when you lift, and why it
// brakes the car. Bigger engines lose proportionally more (see lossScale).
const frictionAt = (rpm: number) => 0.0045 * rpm + 9
const pumpingAt = (rpm: number, throttle: number) => (1 - throttle) * (0.009 * rpm + 6)

export class EngineSim {
  preset: EnginePreset = PRESETS[0]

  // pedal inputs (0..1), set by UI
  gasInput = 0
  brakeInput = 0

  gear = 0
  rpm = 0
  freeRpm = 0
  speedMs = 0 // m/s
  throttle = 0
  stage: Stage = 'off'
  clutch = 1
  events: SimEvent[] = []

  private ign = false
  private throttleCmd = 0
  private fuelCut = false
  private cutT = 0 // s the current fuel cut has lasted
  private onT = 1 // s since the last fuel cut released
  private stageT = 0
  private runT = 0 // s since the engine caught (drives flare + warm-up idle)
  private crankPhase = 0 // compression strokes while on the starter
  private crankSpin = 0
  private shiftT = 0 // s of open clutch left in the current shift
  private shiftDir = 0
  private t = 0
  private acc = 0 // leftover frame time not yet integrated
  // driveline wind-up: a damped spring between flywheel and wheels, driven by
  // the torque going through it. Its velocity reads as a ±rpm wobble.
  private wind = 0
  private windV = 0
  private rpmOut = 0 // rpm as the tach sees it (physics + shunt)

  get ignition() { return this.ign }
  set ignition(on: boolean) {
    if (on === this.ign) return
    this.ign = on
    if (!on) { this.stage = 'off'; this.shiftT = 0; return }
    this.events.push('click')
    if (this.preset.ev || this.rpm > 300) {
      // EVs are just "ready"; a still-spinning engine bump-restarts without the starter
      this.stage = 'run'
      this.runT = 30
      this.freeRpm = Math.max(this.rpm, this.preset.idle)
    } else {
      this.stage = 'prime'
      this.stageT = 0
    }
  }

  // seconds from the key until the engine has caught and is idling
  get secondsToRunning() {
    if (this.stage === 'run' || this.preset.ev) return 0.3
    return PRIME_TIME + this.preset.crankTime + 0.7
  }

  setPreset(p: EnginePreset) {
    this.preset = p
    this.rpm = this.ign ? p.idle : 0
    this.freeRpm = this.rpm
    this.rpmOut = this.rpm
    this.speedMs = 0
    this.gear = 0
    this.shiftT = 0
    this.clutch = 1
    this.wind = this.windV = 0
    if (this.ign) { this.stage = 'run'; this.runT = 30 }
  }

  shiftUp() {
    if (this.gear >= GEARS.length) return
    const from = this.gear
    this.gear += 1
    this.beginShift(from, 1)
  }

  shiftDown() {
    if (this.gear === 0) return
    const to = this.gear - 1
    // the gearbox refuses a downshift that would throw the engine past the limiter
    if (to > 0 && !this.preset.ev && this.lockedRpm(to) > this.preset.limiter + 150) {
      this.events.push('deny')
      return
    }
    const from = this.gear
    this.gear = to
    if (to > 0) this.beginShift(from, -1)
  }

  setGear(g: number) { this.gear = clamp(Math.round(g), 0, GEARS.length) }

  private beginShift(from: number, dir: number) {
    // pulling away from neutral uses the launch clutch below; EVs have one gear
    if (from === 0 || this.preset.ev || this.stage !== 'run') return
    this.shiftT = this.preset.shiftTime
    this.shiftDir = dir
    this.clutch = 0
    // an upshift under load cuts the ignition: unburnt fuel lights off in the exhaust
    if (dir > 0 && this.throttleCmd > 0.4 && this.rpm > this.preset.redline * 0.45) this.events.push('shift-up')
    if (dir < 0) this.events.push('shift-down')
  }

  private lockedRpm(gear: number) {
    if (gear <= 0) return 0
    return (this.speedMs / WHEEL_RADIUS) * GEARS[gear - 1] * this.preset.finalDrive * RAD_TO_RPM
  }

  // losses grow with displacement, and so does rotating mass: scaling them
  // together keeps a V8 dropping revs about as briskly as the Inline-4
  private get lossScale() { return this.preset.ev ? 1 : this.preset.inertia / 0.18 }
  private friction(rpm: number) { return frictionAt(rpm) * this.lossScale }
  private pumping(rpm: number, throttle: number) { return this.preset.ev ? 0 : pumpingAt(rpm, throttle) * this.lossScale }

  private torqueAt(rpm: number): number {
    const { peakTorqueNm, peakRpm, redline } = this.preset
    // bell curve: full at peak, tapers toward idle and redline
    const spread = redline * 0.9
    const f = 1 - Math.pow((rpm - peakRpm) / spread, 2)
    return peakTorqueNm * clamp(f, 0.25, 1)
  }

  // where the idle controller is aiming: flares on the catch, sits high while
  // cold, and hunts very slightly the way a real idle valve does
  private idleTarget(): number {
    const { idle, ev } = this.preset
    if (ev) return idle
    const flare = idle * 0.75 * (1 - Math.exp(-this.runT / 0.07)) * Math.exp(-this.runT / 0.5)
    const warm = idle * 0.24 * Math.exp(-this.runT / 9)
    const hunt = idle * 0.011 * (Math.sin(this.t * 1.7) * 0.6 + Math.sin(this.t * 0.63 + 1) * 0.4)
    return idle + flare + warm + hunt
  }

  // free engine integration (no driveline load)
  private integrateFree(rpm: number, throttle: number, dt: number, idleT: number): number {
    const { redline } = this.preset
    const pump = this.pumping(rpm, throttle)
    const Tdrive = throttle * this.torqueAt(rpm) * 1.1
    // idle controller: feed-forward the losses at the target plus a P term, so
    // it settles on idle instead of sagging below it
    const Tidle = Math.max(0, this.friction(idleT) + this.pumping(idleT, 0) + 0.2 * this.lossScale * (idleT - rpm))
    const Tnet = Tdrive + Tidle - this.friction(rpm) - pump
    const domega = Tnet / this.preset.inertia // rad/s^2
    const next = rpm + domega * RAD_TO_RPM * dt
    return clamp(next, 180, redline + 250)
  }

  // resistive forces only (drag + rolling + brakes), for any time the wheels aren't driven
  private coast(dt: number) {
    if (this.speedMs <= 0.05) { this.speedMs = Math.max(0, this.speedMs - this.brakeInput * dt); return }
    const Fdrag = 0.5 * 1.2 * 0.62 * 2.2 * this.speedMs * this.speedMs
    const Froll = 0.014 * MASS * 9.81
    const Fbrake = this.brakeInput * MASS * 9.0
    this.speedMs -= (Fdrag + Froll + Fbrake) / MASS * dt
    if (this.speedMs < 0) this.speedMs = 0
  }

  update(dt: number) {
    this.acc += Math.min(dt, 0.1)
    while (this.acc >= STEP) {
      this.step(STEP)
      this.acc -= STEP
    }
  }

  private step(h: number) {
    const { idle, limiter, cylinders, inertia } = this.preset
    this.t += h

    // ── key off: no fuel, no spark. Compression + friction stop the crank fast ──
    if (this.stage === 'off') {
      this.throttle = 0
      this.throttleCmd = 0
      this.fuelCut = false
      this.clutch = 1
      if (this.rpm > 0) {
        const Tstop = this.friction(this.rpm) + this.pumping(this.rpm, 0) + 24 * this.lossScale
        this.rpm -= (Tstop / inertia) * RAD_TO_RPM * h
        if (this.rpm < 45) { this.rpm = 0; this.events.push('stop') }
      }
      this.freeRpm = this.rpmOut = this.rpm
      this.wind = this.windV = 0
      this.coast(h)
      return
    }

    // ── fuel pump primes, needles do their self-test, nothing turns yet ──
    if (this.stage === 'prime') {
      this.stageT += h
      this.throttle = 0
      this.rpm = this.freeRpm = this.rpmOut = 0
      this.coast(h)
      if (this.stageT >= PRIME_TIME) { this.stage = 'crank'; this.stageT = 0; this.crankPhase = 0; this.crankSpin = 0; this.events.push('crank') }
      return
    }

    // ── on the starter: ~250 rpm, sagging on every compression stroke ──
    if (this.stage === 'crank') {
      this.stageT += h
      this.throttle = 0
      this.crankSpin += (255 - this.crankSpin) * Math.min(1, h * 9)
      this.crankPhase += (this.crankSpin / 60) * (cylinders / 2) * h
      const sag = Math.pow(Math.sin(Math.PI * (this.crankPhase % 1)), 4)
      this.rpm = this.freeRpm = this.rpmOut = this.crankSpin * (1 - 0.2 * sag)
      this.coast(h)
      if (this.stageT >= this.preset.crankTime) {
        this.stage = 'run'
        this.runT = 0
        this.events.push('catch')
      }
      return
    }

    // ── running ──
    this.runT += h
    const idleT = this.idleTarget()

    // smooth pedal -> throttle command
    this.throttleCmd += (this.gasInput - this.throttleCmd) * Math.min(1, h * 9)
    let throttle = this.throttleCmd

    // fuel-cut limiter. In neutral it bounces off a hysteresis band; in gear the
    // revs are tied to the car, so the cut is timed and the driveline shunt
    // supplies the bounce, the way a tach needle flutters on a real limiter.
    const inGear = this.gear > 0 && this.clutch > 0.5 && this.shiftT <= 0
    if (!this.fuelCut && this.rpmOut >= limiter && (!inGear || this.onT > 0.03)) {
      this.fuelCut = true
      this.cutT = 0
      if (!this.preset.ev) this.events.push('cut')
    }
    if (this.fuelCut) {
      this.cutT += h
      const released = inGear ? (this.rpmOut < limiter - 90 || this.cutT > 0.11) : this.rpmOut < limiter - 220
      if (released) { this.fuelCut = false; this.onT = 0 }
    } else {
      this.onT += h
    }
    if (this.fuelCut) throttle = 0

    let Tengine = 0 // torque going through the driveline, for the shunt spring

    if (this.shiftT > 0) {
      // ── mid-shift: clutch open, wheels unpowered ──
      this.shiftT -= h
      const target = this.lockedRpm(this.gear)
      // upshift: ignition cut lets revs fall toward the next gear.
      // downshift: blip the throttle to match revs for the lower gear.
      throttle = this.shiftDir > 0 ? 0 : clamp((target - this.freeRpm) / 500, 0, 1)
      this.freeRpm = this.integrateFree(this.freeRpm, throttle, h, idleT)
      this.rpm = this.freeRpm
      this.coast(h)
      if (this.shiftT <= 0) this.clutch = 0.001
    } else if (this.gear === 0) {
      // neutral: engine free-revs, car coasts
      this.freeRpm = this.integrateFree(this.freeRpm, throttle, h, idleT)
      this.rpm = this.freeRpm
      this.coast(h)
    } else {
      this.freeRpm = this.integrateFree(this.freeRpm, throttle, h, idleT)
      if (this.clutch < 1) this.clutch = Math.min(1, this.clutch + h / CLUTCH_BITE)

      const totalRatio = GEARS[this.gear - 1] * this.preset.finalDrive
      const lockedRpm = this.lockedRpm(this.gear)

      // clutch: bites as engine revs above idle; locks once wheel speed sustains revs
      const driveEngage = clamp((this.rpm - idle * 0.85) / (idle * 1.1), 0, 1) * this.clutch
      const rpmEngage = clamp((lockedRpm - idle * 0.7) / (idle * 0.7), 0, 1) * this.clutch

      // engine rpm = blend of free-rev and driveline-locked
      this.rpm = this.freeRpm * (1 - rpmEngage) + lockedRpm * rpmEngage
      this.freeRpm = this.rpm // keep them coherent so lifting throttle decays from current

      // wheel forces. Engine braking is the engine's own losses (a little
      // more for feel), not an arbitrary drag, so lifting off coasts believably
      const engineBraking = (1 - throttle) * (this.friction(this.rpm) + this.pumping(this.rpm, 0)) * 1.3
      Tengine = (throttle * this.torqueAt(this.rpm) - engineBraking) * driveEngage
      const Twheel = Tengine * totalRatio
      const Fdrive = Twheel / WHEEL_RADIUS

      // resistive forces only oppose motion
      const moving = this.speedMs > 0.05
      const Fdrag = 0.5 * 1.2 * 0.62 * 2.2 * this.speedMs * this.speedMs
      const Froll = 0.014 * MASS * 9.81
      const Fbrake = this.brakeInput * MASS * 9.0
      const Fnet = Fdrive - (moving ? Fdrag + Froll + Fbrake : 0)

      this.speedMs += Fnet / MASS * h
      if (this.speedMs < 0) this.speedMs = 0
    }
    this.throttle = throttle

    // driveline shunt: softer (slower, bigger) in the low gears
    if (this.gear > 0 && !this.preset.ev) {
      const ratio = GEARS[this.gear - 1]
      const w = 2 * Math.PI * (2.6 + 4.4 * (1 - (ratio - 1.07) / (3.4 - 1.07)))
      const zeta = 0.22
      this.windV += (w * w * (Tengine - this.wind) - 2 * zeta * w * this.windV) * h
      this.wind += this.windV * h
      const k = 0.9 * Math.sqrt(ratio / 3.4)
      this.rpmOut = this.rpm + clamp((k * this.windV) / w, -260, 260) * this.clutch
    } else {
      this.wind += (0 - this.wind) * Math.min(1, h * 10)
      this.windV = 0
      this.rpmOut = this.rpm
    }
  }

  getState(): SimState {
    return {
      rpm: Math.max(0, this.rpmOut),
      speedKmh: this.speedMs * 3.6,
      gear: this.gear,
      throttle: this.throttle,
      brake: this.brakeInput,
      atLimiter: this.fuelCut,
      preset: this.preset,
      stage: this.stage,
      combusting: this.stage === 'run' && !this.preset.ev,
      clutch: this.clutch,
    }
  }
}
