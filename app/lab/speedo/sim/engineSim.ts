// Engine + drivetrain physics simulation.
//
// Adapted from the model in markeasting/engine-audio (Engine / Drivetrain /
// Vehicle), simplified into a single stable integrator tuned for feel: a
// free-revving engine in neutral, an auto-clutch that bites off engine revs,
// a locked driveline in gear, vehicle mass with drag / rolling / braking, and
// a fuel-cut rev limiter that bounces off redline.

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
  grunt: number   // sound: low-end body / rumble (0..1)
  scream: number  // sound: aggressive high-rpm top end (0..1)
  noise: number   // sound: induction "air" hiss on throttle (0..1.5)
  turbo: number   // sound: twin-turbo whistle + blow-off (0..1)
  ev?: boolean    // electric motor (sci-fi whine instead of combustion)
}

// ordered ascending: calm/low-power → aggressive/high-power, then electric
export const PRESETS: EnginePreset[] = [
  { name: 'Inline-4',  cylinders: 4, idle: 950, redline: 8600, limiter: 8400, peakTorqueNm: 250, peakRpm: 6000, inertia: 0.18, grunt: 0.75, scream: 0.93, noise: 0.32, turbo: 1.00 },
  { name: 'V8',        cylinders: 8, idle: 820, redline: 7200, limiter: 7000, peakTorqueNm: 430, peakRpm: 4600, inertia: 0.30, grunt: 1.00, scream: 0.25, noise: 0.73, turbo: 1.00 },
  { name: 'V10',       cylinders: 10, idle: 1000, redline: 8800, limiter: 8600, peakTorqueNm: 400, peakRpm: 5800, inertia: 0.26, grunt: 1.00, scream: 0.31, noise: 1.13, turbo: 0.89 },
  { name: 'EV',        cylinders: 1, idle: 1, redline: 12000, limiter: 11800, peakTorqueNm: 520, peakRpm: 3000, inertia: 0.12, grunt: 0, scream: 0, noise: 0, turbo: 0, ev: true },
]

const GEARS = [3.4, 2.36, 1.85, 1.47, 1.24, 1.07]
const FINAL_DRIVE = 3.44
const WHEEL_RADIUS = 0.31 // m
const MASS = 1320 // kg

export interface SimState {
  rpm: number
  speedKmh: number
  gear: number // 0 = neutral, 1..6
  throttle: number // applied (after limiter)
  brake: number
  atLimiter: boolean
  preset: EnginePreset
}

export class EngineSim {
  preset: EnginePreset = PRESETS[0]

  // pedal inputs (0..1), set by UI
  gasInput = 0
  brakeInput = 0

  ignition = false // engine on/off
  gear = 0
  rpm = this.preset.idle
  freeRpm = this.preset.idle
  speedMs = 0 // m/s
  throttle = 0
  private throttleCmd = 0
  private fuelCut = false

  setPreset(p: EnginePreset) {
    this.preset = p
    this.rpm = p.idle
    this.freeRpm = p.idle
    this.speedMs = 0
    this.gear = 0
  }

  shiftUp() { if (this.gear < GEARS.length) this.gear += 1 }
  shiftDown() { if (this.gear > 0) this.gear -= 1 }
  setGear(g: number) { this.gear = clamp(Math.round(g), 0, GEARS.length) }

  private torqueAt(rpm: number): number {
    const { peakTorqueNm, peakRpm, redline } = this.preset
    // bell curve: full at peak, tapers toward idle and redline
    const spread = redline * 0.9
    const f = 1 - Math.pow((rpm - peakRpm) / spread, 2)
    return peakTorqueNm * clamp(f, 0.25, 1)
  }

  // free engine integration (no driveline load) in rpm/s
  private integrateFree(rpm: number, throttle: number, dt: number): number {
    const { idle, redline } = this.preset
    const Tdrive = throttle * this.torqueAt(rpm) * 1.1
    const Tfric = 0.0045 * rpm + 9
    const Tidle = rpm < idle ? (idle - rpm) * 0.06 : 0
    const Tnet = Tdrive - Tfric + Tidle
    const domega = Tnet / this.preset.inertia // rad/s^2
    const next = rpm + domega * RAD_TO_RPM * dt
    return clamp(next, 180, redline + 250)
  }

  update(dt: number) {
    const { idle, limiter } = this.preset
    dt = Math.min(dt, 0.05)

    // engine off: revs fall to zero, car just coasts / brakes
    if (!this.ignition) {
      this.throttle = 0
      this.throttleCmd = 0
      this.fuelCut = false
      this.rpm += (0 - this.rpm) * Math.min(1, dt * 2.2)
      if (this.rpm < 15) this.rpm = 0
      this.freeRpm = this.rpm
      if (this.speedMs > 0.05) {
        const Fdrag = 0.5 * 1.2 * 0.62 * 2.2 * this.speedMs * this.speedMs
        const Froll = 0.014 * MASS * 9.81
        const Fbrake = this.brakeInput * MASS * 9.0
        this.speedMs -= (Fdrag + Froll + Fbrake) / MASS * dt
        if (this.speedMs < 0) this.speedMs = 0
      }
      return
    }

    // smooth pedal -> throttle command
    this.throttleCmd += (this.gasInput - this.throttleCmd) * Math.min(1, dt * 9)
    let throttle = this.throttleCmd

    // fuel-cut limiter with hysteresis (creates the bounce off redline)
    if (this.rpm >= limiter) this.fuelCut = true
    if (this.fuelCut && this.rpm < limiter - 350) this.fuelCut = false
    if (this.fuelCut) throttle = 0
    this.throttle = throttle

    // free engine rpm (used for neutral + clutch slip)
    this.freeRpm = this.integrateFree(this.freeRpm, throttle, dt)

    const brake = this.brakeInput

    if (this.gear === 0) {
      // neutral: engine free-revs, car coasts
      this.rpm = this.freeRpm
      const Fdrag = 0.5 * 1.2 * 0.62 * 2.2 * this.speedMs * this.speedMs * Math.sign(this.speedMs)
      const Froll = 0.014 * MASS * 9.81 * Math.sign(this.speedMs)
      const Fbrake = brake * MASS * 9.0 * Math.sign(this.speedMs)
      this.speedMs += (-(Fdrag + Froll + Fbrake)) / MASS * dt
      if (this.speedMs < 0) this.speedMs = 0
    } else {
      const totalRatio = GEARS[this.gear - 1] * FINAL_DRIVE
      const wheelOmega = this.speedMs / WHEEL_RADIUS
      const lockedRpm = wheelOmega * totalRatio * RAD_TO_RPM

      // clutch: bites as engine revs above idle; locks once wheel speed sustains revs
      const driveEngage = clamp((this.rpm - idle * 0.85) / (idle * 1.1), 0, 1)
      const rpmEngage = clamp((lockedRpm - idle * 0.7) / (idle * 0.7), 0, 1)

      // engine rpm = blend of free-rev and driveline-locked
      this.rpm = this.freeRpm * (1 - rpmEngage) + lockedRpm * rpmEngage
      this.freeRpm = this.rpm // keep them coherent so lifting throttle decays from current

      // wheel forces
      const engineBraking = (1 - throttle) * 55 * (this.rpm / 1000)
      const Twheel = (throttle * this.torqueAt(this.rpm) - engineBraking) * totalRatio * driveEngage
      const Fdrive = Twheel / WHEEL_RADIUS

      // resistive forces only oppose motion
      const moving = this.speedMs > 0.05
      const Fdrag = 0.5 * 1.2 * 0.62 * 2.2 * this.speedMs * this.speedMs
      const Froll = 0.014 * MASS * 9.81
      const Fbrake = brake * MASS * 9.0
      const Fnet = Fdrive - (moving ? Fdrag + Froll + Fbrake : 0)

      this.speedMs += Fnet / MASS * dt
      if (this.speedMs < 0) this.speedMs = 0
    }
  }

  getState(): SimState {
    return {
      rpm: this.rpm,
      speedKmh: this.speedMs * 3.6,
      gear: this.gear,
      throttle: this.throttle,
      brake: this.brakeInput,
      atLimiter: this.fuelCut,
      preset: this.preset,
    }
  }
}
