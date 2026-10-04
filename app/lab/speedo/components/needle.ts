// Needle physics shared by the canvas gauges.
//
// A damped spring instead of a per-frame lerp: frame-rate independent (the
// same on a 60 Hz laptop and a 120 Hz phone), and slightly under-damped like
// a real stepper-motor needle, so it lands with a hint of settle rather than
// gliding in. `smoothing` keeps its old meaning (per-frame fraction at 60 fps)
// and maps to the spring's stiffness.

export interface NeedleState { pos: number; vel: number; last: number }

// `floor` is the stop pin: the needle can settle past a target, but never below zero
export function stepNeedle(n: NeedleState, target: number, smoothing: number, now: number, floor = -Infinity) {
  const dt = n.last ? Math.min(0.05, (now - n.last) / 1000) : 1 / 60
  n.last = now
  const w = -Math.log(1 - Math.min(0.95, smoothing)) * 60 * 1.9 // rad/s
  const zeta = 0.74
  const steps = Math.max(1, Math.ceil((dt * w) / 0.35))
  const h = dt / steps
  for (let i = 0; i < steps; i++) {
    n.vel += (w * w * (target - n.pos) - 2 * zeta * w * n.vel) * h
    n.pos += n.vel * h
    if (n.pos < floor) { n.pos = floor; n.vel = 0 }
  }
  return n.pos
}
