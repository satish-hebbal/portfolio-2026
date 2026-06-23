# V10 Digital Cluster — Screen Content Spec

Reference: Audi R8 virtual cockpit. Everything below lives **inside the inner-body
screen** (our main black panel). Items the real car shows on the housing strips
(coolant column on far left, gear-gate on far right) are pulled INTO our inner
screen as left/right rail columns, since the inner body is our single screen.

Layout model: the inner screen is one wide panel. Think of it as
`[ left rail | LEFT pod | CENTER dial | RIGHT pod | right rail ]`
with a **top status bar** spanning the width and a **bottom data strip** spanning
the width.

---

## 1. Top status bar  (spans full width, inside indicator-menu region)
- **Left:** signal/antenna icon + source name `GALAXY` — left-aligned.
- **Right:** fuel-pump icon + range `120 km`, then a divider, then a
  battery/charge-state icon (crossed = not charging) — right-aligned.

## 2. CENTER — main tachometer dial (the hero)
- Circular RPM dial, numbers **1–10** (`1/min x1000` caption near top inside ring).
- Tick marks between numbers; **red redline arc** over the 9–10 sector.
- **Red needle** sweeping from lower-left; `OFF` label at the needle's rest point
  (bottom-left) when engine off.
- Center hub stack (vertically centered):
  - `R8` brand badge (red) — top → replace with our `V10` mark.
  - `km/h` unit (small, above the number).
  - **Big speed number** `0` (largest glyph on the screen).
  - **Gear** `P` below the number.
  - `DYNAMIC` drive-mode label (red) at the bottom of the hub → our mode = `RACE`.

## 3. LEFT pod — G-meter
- Title `G meter` (top, centered over the widget).
- Circular target/crosshair graphic with concentric rings + center dot
  (dot moves with lateral/longitudinal g).
- Four `0.0` readouts (red) at top / left / right / bottom of the circle.

## 4. RIGHT pod — Power & Torque
- Two small circular gauges, side by side.
- Labels `Power` (left) and `Torque` (right) above each.
- Each: `%` caption + big `0` in the center, small red tick at the bottom of the arc.

## 5. Left rail — coolant temperature column (far left, vertical)
- Vertical scale marks `130 / 90 / 50` with `°C`; `130` in red (hot end, top).
- Coolant/thermometer icon at the bottom.
- A small fill/needle indicating current temp.

## 6. Right rail — gear-gate / drive selector (far right, vertical)
- Stacked gate positions: `1/1`, `1/2`, … (current ratio highlighted).
- Small fuel-pump glyph mid-column.
- `R` (reverse) at the bottom, red.

## 7. Bottom data strip  (spans full width, below the center dial)
- **Left:** odometer/trip `230 km`.
- **Right of that:** trip `50.5 km`.
- **Center-left:** clock `15:20`.
- **Center-right:** outside temp `+29.0 °C`.
- **Far-left corner:** oil-temp `--- °C` with oil-can icon + small segment bar.
- **Far-right corner:** transmission/gearbox temp `--- °C` with cog icon + segment bar.

---

## Live data we already have (from EngineSim) to feed these
- speed (km/h) → center big number
- rpm → tach needle + redline behaviour
- gear → center gear glyph (P/N/R/1..n)
- coolant temp (0..1) → left rail column
- fuel (0..1) → range `xxx km` (top-right) — we compute range already
- throttle/load → Power & Torque % readouts (derive)
- odo / avg / trip → bottom strip
- drive mode → `RACE` (from THEMES[V10].mode)
- shift / brake / abs tells → fold into status bar or bottom corners

## Build order (proposed)
1. Center tach dial + hub (speed, gear, mode).  ← hero, do first
2. Top status bar (source, range, charge).
3. Left G-meter + Right Power/Torque pods.
4. Left coolant rail + right gear-gate rail.
5. Bottom data strip (odo, trip, clock, temps).
