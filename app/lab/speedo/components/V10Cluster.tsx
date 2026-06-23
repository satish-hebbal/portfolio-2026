'use client'

import { CSSProperties, RefObject, useEffect, useState } from 'react'
import s from '../speedo.module.css'
import Gauge, { GaugeHandle } from './Gauge'

interface Theme { glow: string; arc: string; redline: string; tick: string; screen: string; mode: string }

interface Props {
  theme: Theme
  powered: boolean
  intro: boolean
  tachMax: number
  redlineStart: number
  gearLabel: string
  tachRef: RefObject<GaugeHandle | null>
  speedNumRef: RefObject<HTMLSpanElement | null>
  gearElRef: RefObject<HTMLDivElement | null>
  tempLadderRef: RefObject<HTMLDivElement | null>
  powerRef: RefObject<HTMLSpanElement | null>
  torqueRef: RefObject<HTMLSpanElement | null>
  powerGaugeRef: RefObject<GaugeHandle | null>
  torqueGaugeRef: RefObject<GaugeHandle | null>
  gDotRef: RefObject<HTMLDivElement | null>
  gTopRef: RefObject<HTMLSpanElement | null>
  gBotRef: RefObject<HTMLSpanElement | null>
  rangeRef: RefObject<HTMLSpanElement | null>
}

// live HH:MM clock (cheap — re-renders once a minute)
function useClock() {
  const [t, setT] = useState('--:--')
  useEffect(() => {
    const tick = () => {
      const d = new Date()
      setT(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`)
    }
    tick()
    const id = setInterval(tick, 15000)
    return () => clearInterval(id)
  }, [])
  return t
}

/*
 * V10 — fully digital cluster (Audi R8 virtual-cockpit style).
 * Body shapes laid out; the inner screen now hosts the RPM dial.
 * We reuse the Inline-4 RPM meter (the existing Gauge) here and will
 * tweak it toward the R8 look. Remaining screen content (speed, gear,
 * G-meter, power/torque, rails, bottom strip) comes next — see
 * v10-screen-spec.md.
 */
export default function V10Cluster({ theme, powered, tachMax, redlineStart, gearLabel, tachRef, speedNumRef, gearElRef, tempLadderRef, powerRef, torqueRef, powerGaugeRef, torqueGaugeRef, gDotRef, gTopRef, gBotRef, rangeRef }: Props) {
  const clock = useClock()
  return (
    <div className={`${s.v10cluster} ${powered ? s.v10on : ''}`}>
      {/* OUTER BODY — grey housing with lit shading + thin silver edge */}
      <svg className={s.v10outer} viewBox="0 0 1533 525" fill="none" aria-hidden preserveAspectRatio="none">
        <defs>
          {/* dark top + dark bottom, a shine band through the middle that reads on
              the exposed left/right flanks (centre is hidden by the screen) */}
          <linearGradient id="v10bodyFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#070809" />
            <stop offset="0.46" stopColor="#1b1d23" />
            <stop offset="0.68" stopColor="#363943" />
            <stop offset="0.85" stopColor="#16181d" />
            <stop offset="1" stopColor="#060708" />
          </linearGradient>
          {/* left→right darkening: fades the far flanks toward the inner-body
              colour so the housing reads with depth (transparent through middle) */}
          <linearGradient id="v10bodySide" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#050507" stopOpacity="0.92" />
            <stop offset="0.16" stopColor="#050507" stopOpacity="0" />
            <stop offset="0.84" stopColor="#050507" stopOpacity="0" />
            <stop offset="1" stopColor="#050507" stopOpacity="0.92" />
          </linearGradient>
          {/* thin silver boulder edge — lit from above */}
          <linearGradient id="v10bodyEdge" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#d2d7df" />
            <stop offset="0.35" stopColor="#888e98" />
            <stop offset="0.7" stopColor="#3a3d44" />
            <stop offset="1" stopColor="#5a5e66" />
          </linearGradient>
        </defs>
        <path d="M168.419 108.844C208.419 68.3438 382 -0.00165552 766.001 0V0.00390625C1151.5 0.00390625 1324 68.3819 1364 108.882C1466 196.482 1573 427.882 1517 482.382C1476.03 524.121 1254.25 521.149 1107.61 524.504C1097.72 524.73 1088.04 522.104 1079.07 517.912C1015.86 488.367 941.442 498.272 766.001 495.002C590.563 498.272 516.505 488.335 453.351 517.872C444.385 522.066 434.703 524.692 424.807 524.466C278.171 521.11 56.386 524.082 15.4195 482.344C-40.5805 427.844 66.4195 196.444 168.419 108.844Z"
          fill="url(#v10bodyFill)" />
        <path d="M168.419 108.844C208.419 68.3438 382 -0.00165552 766.001 0V0.00390625C1151.5 0.00390625 1324 68.3819 1364 108.882C1466 196.482 1573 427.882 1517 482.382C1476.03 524.121 1254.25 521.149 1107.61 524.504C1097.72 524.73 1088.04 522.104 1079.07 517.912C1015.86 488.367 941.442 498.272 766.001 495.002C590.563 498.272 516.505 488.335 453.351 517.872C444.385 522.066 434.703 524.692 424.807 524.466C278.171 521.11 56.386 524.082 15.4195 482.344C-40.5805 427.844 66.4195 196.444 168.419 108.844Z"
          fill="url(#v10bodySide)" stroke="url(#v10bodyEdge)" strokeWidth="3" />
      </svg>

      {/* INDICATOR / MENU BAR — bezel frame + recessed glass screen */}
      <svg className={s.v10menu} viewBox="0 0 664 72" fill="none" aria-hidden preserveAspectRatio="none">
        <defs>
          <path id="v10menuPath" d="M655.315 0C661.35 0 665.613 5.80408 663.156 11.3159C653.967 31.9286 634.012 60.5135 602.432 65.5C564.432 71.5 406.265 72 331.932 71.5C257.598 72 99.4316 71.5 61.4316 65.5C29.8507 60.5135 9.89638 31.9286 0.707607 11.3159C-1.74948 5.80407 2.51315 0 8.54786 0H655.315Z" />
          {/* outer bezel frame — metallic, lit from above */}
          <linearGradient id="v10menuBezel" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#41454c" />
            <stop offset="0.5" stopColor="#20242a" />
            <stop offset="1" stopColor="#0b0c0f" />
          </linearGradient>
          {/* recessed screen — dark glass */}
          <linearGradient id="v10menuScreen" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#15181d" />
            <stop offset="0.5" stopColor="#0a0b0e" />
            <stop offset="1" stopColor="#050607" />
          </linearGradient>
          {/* glassy top reflection */}
          <linearGradient id="v10menuGloss" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="rgba(255,255,255,0.12)" />
            <stop offset="0.42" stopColor="rgba(255,255,255,0.02)" />
            <stop offset="0.55" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
          {/* inner shadow — carves the screen into the bezel */}
          <filter id="v10menuInset" x="-20%" y="-40%" width="140%" height="180%">
            <feComponentTransfer in="SourceAlpha"><feFuncA type="table" tableValues="1 0" /></feComponentTransfer>
            <feGaussianBlur stdDeviation="6" />
            <feOffset dx="0" dy="2" result="ofb" />
            <feFlood floodColor="#000000" floodOpacity="0.7" />
            <feComposite in2="ofb" operator="in" />
            <feComposite in2="SourceAlpha" operator="in" />
            <feMerge><feMergeNode in="SourceGraphic" /><feMergeNode /></feMerge>
          </filter>
        </defs>
        {/* bezel */}
        <use href="#v10menuPath" fill="url(#v10menuBezel)" />
        {/* recessed glass screen, scaled in from the bezel */}
        <g transform="translate(39.8 4.3) scale(0.88)">
          <use href="#v10menuPath" fill="url(#v10menuScreen)" filter="url(#v10menuInset)" />
          <use href="#v10menuPath" fill="url(#v10menuGloss)" />
        </g>
      </svg>

      {/* the five fine indicators live ON the menu module */}
      <div className={s.v10menuTells}>
        <span className={`${s.v10tell} ${s.v10green}`} title="Left turn">{TurnArrow('left')}</span>
        <span className={`${s.v10tell} ${s.v10amber} ${s.on}`} title="ABS">ABS</span>
        <span className={`${s.v10tell} ${s.v10blue}`} title="High beam">{BeamIcon()}</span>
        <span className={`${s.v10tell} ${s.v10red}`} title="Brake">{'(P)'}</span>
        <span className={`${s.v10tell} ${s.v10green}`} title="Right turn">{TurnArrow('right')}</span>
      </div>

      {/* INNER BODY — the main black screen */}
      <svg className={s.v10inner} viewBox="0 0 1126 417" fill="none" aria-hidden preserveAspectRatio="none">
        <path d="M561.666 0.133783C680.5 -1.19952 943.501 6.66457 1021.5 59.4645C1119 125.465 1132.5 308.967 1123.5 350.967C1114.15 394.597 989.119 406.043 918.418 415.519C911.503 416.446 904.514 416.127 897.73 414.497L849.835 402.987C845.627 401.975 841.313 401.464 836.984 401.464L563 401.465V401.467L288.859 401.451C284.529 401.451 280.214 401.962 276.004 402.973L228.111 414.482C221.326 416.112 214.338 416.431 207.422 415.505C136.722 406.028 11.6905 394.582 2.34122 350.953C-6.65869 308.952 6.84155 125.451 104.341 59.4508C182.341 6.65082 442.833 -1.19955 561.666 0.133783Z" />
      </svg>

      {/* FUEL MODULE — angled side panel, right (holds the shared defs) */}
      <svg className={s.v10fuel} viewBox="0 0 158 193" fill="none" aria-hidden preserveAspectRatio="none">
        <defs>
          {/* soft radial vignette — gentle depth, darker toward the edges, no rim */}
          <radialGradient id="v10modFill" cx="50%" cy="40%" r="78%">
            <stop offset="0" stopColor="#0e0f13" />
            <stop offset="0.65" stopColor="#0a0b0e" />
            <stop offset="1" stopColor="#060708" />
          </radialGradient>
          {/* very soft directional inner shadow — feathered, low opacity, gathers
              on the top inner wall (light from above). Not a border. */}
          <filter id="v10modInset" x="-30%" y="-30%" width="160%" height="160%">
            <feComponentTransfer in="SourceAlpha"><feFuncA type="table" tableValues="1 0" /></feComponentTransfer>
            <feGaussianBlur stdDeviation="14" />
            <feOffset dx="0" dy="5" result="ofb" />
            <feFlood floodColor="#000000" floodOpacity="0.38" />
            <feComposite in2="ofb" operator="in" />
            <feComposite in2="SourceAlpha" operator="in" />
            <feMerge><feMergeNode in="SourceGraphic" /><feMergeNode /></feMerge>
          </filter>
        </defs>
        <path d="M75.8865 0.430835C56.6999 -1.75287 29.3792 4.80712 10.6042 10.1549C3.3584 12.2187 -1.084 19.4455 0.229208 26.8641C8.82999 75.4523 24.2331 152.505 28.9832 160.909C35.4832 172.409 126.983 200.409 151.983 190.909C175.195 182.088 113.925 40.9399 88.633 7.58706C85.5396 3.50774 80.9732 1.00978 75.8865 0.430835Z"
          fill="url(#v10modFill)" filter="url(#v10modInset)" />
      </svg>

      {/* FUEL MODULE — mirrored twin, left */}
      <svg className={`${s.v10fuel} ${s.v10fuelLeft}`} viewBox="0 0 158 193" fill="none" aria-hidden preserveAspectRatio="none">
        <path d="M75.8865 0.430835C56.6999 -1.75287 29.3792 4.80712 10.6042 10.1549C3.3584 12.2187 -1.084 19.4455 0.229208 26.8641C8.82999 75.4523 24.2331 152.505 28.9832 160.909C35.4832 172.409 126.983 200.409 151.983 190.909C175.195 182.088 113.925 40.9399 88.633 7.58706C85.5396 3.50774 80.9732 1.00978 75.8865 0.430835Z"
          fill="url(#v10modFill)" filter="url(#v10modInset)" />
      </svg>

      {/* ── LEFT PANEL — coolant temperature ── */}
      <div className={`${s.v10side} ${s.v10sideLeft}`}>
        <div className={s.v10col}>
          <span className={s.v10tHot}>130</span>
          <span className={s.v10tNum}>&deg;C</span>
          <span className={s.v10tNum}>90</span>
          <span className={s.v10ico}><CoolantIcon /></span>
          <span className={s.v10tNum}>50</span>
        </div>
        {/* level pills — the active one lights up (driven by the sim coolant temp) */}
        <div ref={tempLadderRef} className={s.v10ladder}>
          <i className={s.v10pill} /><i className={s.v10pill} /><i className={s.v10pill} />
          <i className={s.v10pill} /><i className={s.v10pill} /><i className={s.v10pill} />
        </div>
      </div>

      {/* ── RIGHT PANEL — fuel / drive (R8 reference) ── */}
      <div className={`${s.v10side} ${s.v10sideRight}`}>
        <div className={s.v10col}>
          <span className={s.v10fNum}>1/1</span>
          <span className={s.v10fNum}>1/2</span>
          <span className={s.v10ico}><FuelIcon /><span className={s.v10fArrow}>&#9656;</span></span>
          <span className={s.v10fR}>R</span>
        </div>
        <div className={s.v10ladder}>
          <i className={s.v10pill} /><i className={s.v10pill} />
          <i className={`${s.v10pill} ${s.v10pillOn}`} /><i className={`${s.v10pill} ${s.v10pillOn}`} />
          <i className={`${s.v10pill} ${s.v10pillOn}`} /><i className={`${s.v10pill} ${s.v10pillOn}`} />
        </div>
      </div>

      {/* ── SCREEN CONTENT — sits over the inner-body panel ── */}
      <div className={s.v10screen}>
        {/* top status bar */}
        <div className={s.v10top}>
          <span className={s.v10src}><SignalIcon /> GALAXY</span>
          <span className={s.v10range}><FuelIcon /> <b><span ref={rangeRef}>120</span> km</b> <BattIcon /></span>
        </div>

        {/* divider bars between the G-meter / dial / power-torque zones */}
        <svg className={s.v10dividers} viewBox="0 0 1000 360" fill="none" preserveAspectRatio="none" aria-hidden>
          <path d="M255 30 V330" stroke="url(#v10divG)" strokeWidth="2.4" />
          <path d="M745 30 V330" stroke="url(#v10divG)" strokeWidth="2.4" />
          <defs>
            <linearGradient id="v10divG" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="rgba(170,180,195,0)" />
              <stop offset="0.5" stopColor="rgba(170,180,195,0.65)" />
              <stop offset="1" stopColor="rgba(170,180,195,0)" />
            </linearGradient>
          </defs>
        </svg>

        {/* LEFT — G meter */}
        <div className={s.v10gmeter}>
          <div className={s.v10gTitle}>G meter</div>
          <span className={`${s.v10gVal} ${s.v10gT}`} ref={gTopRef}>0.0</span>
          <div className={s.v10gCircle}>
            {/* same outer dial shell as Power / Torque */}
            <Gauge bare size={126} min={0} max={100} majorStep={25} minorPerMajor={5}
              numbers={false} layeredRim tickLenScale={0.55} tickOuterScale={0.95}
              centerScreen centerScreenScale={0.72}
              accent={theme.redline} arcColor={theme.arc} tickColor={theme.tick} />
            {/* crosshair target inside the centre screen */}
            <svg viewBox="0 0 100 100" className={s.v10gSvg} aria-hidden>
              <g stroke="rgba(150,162,178,0.45)" fill="none">
                <circle cx="50" cy="50" r="46" strokeWidth="1.4" />
                <circle cx="50" cy="50" r="26" strokeWidth="1.1" stroke="rgba(150,162,178,0.3)" />
              </g>
              <g stroke="rgba(150,162,178,0.35)" strokeWidth="1.1">
                <line x1="4" y1="50" x2="96" y2="50" />
                <line x1="50" y1="4" x2="50" y2="96" />
              </g>
            </svg>
            <div ref={gDotRef} className={s.v10gDot} />
          </div>
          <span className={`${s.v10gVal} ${s.v10gL}`}>0.0</span>
          <span className={`${s.v10gVal} ${s.v10gR}`}>0.0</span>
          <span className={`${s.v10gVal} ${s.v10gB}`} ref={gBotRef}>0.0</span>
        </div>

        {/* RIGHT — Power & Torque (mini-dials sharing the main dial DNA) */}
        <div className={s.v10pt}>
          <PtDial label="Power" gaugeRef={powerGaugeRef} valueRef={powerRef} theme={theme} />
          <PtDial label="Torque" gaugeRef={torqueGaugeRef} valueRef={torqueRef} theme={theme} />
        </div>

        {/* trips — just under the dial, above the rule */}
        <div className={s.v10trips}>
          <span className={s.v10trip}>230<i>km</i></span>
          <span className={s.v10trip}>50.5<i>km</i></span>
        </div>

        {/* mask everything below the rule line so the dial is cut off there */}
        <div className={s.v10belowMask} aria-hidden />

        {/* full-width rule that the dial sits over, with segmented bar ends */}
        <div className={s.v10rule}>
          <span className={s.v10ruleSeg} />
          <span className={s.v10ruleSeg} />
        </div>

        {/* bottom row — clock + outside temp (centre) */}
        <div className={s.v10bottom}>
          <span className={s.v10mid}>
            <span className={s.v10clock}>{clock}</span>
            <span className={s.v10otemp}>+29.0<i>&deg;C</i></span>
          </span>
        </div>

        {/* metallic accent line passing behind the RPM dial — fades to 0 at both ends */}
        <div className={s.v10dialLine} aria-hidden />
        {/* second line, raised — custom SVG with a slight bend/plateau in the middle */}
        <svg className={s.v10dialLineUp} viewBox="0 0 1000 24" preserveAspectRatio="none" fill="none" aria-hidden>
          <defs>
            <linearGradient id="v10lineUpG" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="rgba(210,220,235,0)" />
              <stop offset="0.2" stopColor="rgba(120,132,150,0.30)" />
              <stop offset="0.38" stopColor="rgba(165,178,196,0.60)" />
              <stop offset="0.5" stopColor="rgba(242,247,255,0.92)" />
              <stop offset="0.62" stopColor="rgba(165,178,196,0.60)" />
              <stop offset="0.8" stopColor="rgba(120,132,150,0.30)" />
              <stop offset="1" stopColor="rgba(210,220,235,0)" />
            </linearGradient>
          </defs>
          <path d="M0 18 L370 18 Q412 18 438 15 L562 15 Q588 18 630 18 L1000 18"
            stroke="url(#v10lineUpG)" strokeWidth="2" strokeLinejoin="round" />
        </svg>

        <div className={s.v10tach}>
          {/* backlight glow behind the dial: even radial + wide elliptical spread */}
          <div className={s.v10glow} style={{ '--gl': theme.glow } as CSSProperties} aria-hidden />
          <Gauge ref={tachRef} size={340} min={0} max={tachMax}
            majorStep={1000} minorPerMajor={10} labelDivisor={1000} tickLenScale={0.7} halfTick
            tickOuterScale={0.97} layeredRim numberFontFamily="ProRacingSlant"
            needleReach={0.95} centerScreen centerScreenScale={0.6} sweepFill
            redlineZone numberInset={0.1}
            unitSub="x1000 r/min" unitSubR={0.7} redlineStart={redlineStart}
            accent={theme.redline} arcColor={theme.arc} tickColor={theme.tick} smoothing={0.22} />
          {/* dim "asleep" logo shown in the centre screen when the engine is off */}
          <img src="/images/common/sa26-white.svg" alt="" aria-hidden className={s.v10offLogo} />
          {/* centre-screen readout — functional km/h + current gear */}
          <div className={s.v10hub}>
            <div className={s.v10unit}>km/h</div>
            <div className={s.v10speed}><span ref={speedNumRef}>0</span></div>
            <div ref={gearElRef} className={`${s.v10gear} ${gearLabel === 'N' ? s.v10gearN : s.v10gearDrive}`}>{gearLabel}</div>
            <div className={s.v10mode}>{theme.mode}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

// small Power / Torque dial — same renderer as the main tach (shared DNA)
function PtDial({ label, gaugeRef, valueRef, theme }: {
  label: string; gaugeRef: RefObject<GaugeHandle | null>; valueRef: RefObject<HTMLSpanElement | null>; theme: Theme
}) {
  return (
    <div className={s.v10ptItem}>
      <div className={s.v10ptLabel}>{label}</div>
      <div className={s.v10ptDial}>
        <Gauge ref={gaugeRef} size={126} min={0} max={100} majorStep={25} minorPerMajor={5}
          numbers={false} layeredRim tickLenScale={0.55} tickOuterScale={0.95}
          needleReach={0.96} centerScreen centerScreenScale={0.72} sweepFill
          accent={theme.redline} arcColor={theme.arc} tickColor={theme.tick} smoothing={0.18} />
        <div className={s.v10ptInner}>
          <b><span ref={valueRef}>0</span></b>
        </div>
      </div>
    </div>
  )
}

function SignalIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 3a9 9 0 0 0-9 9h2a7 7 0 0 1 14 0h2a9 9 0 0 0-9-9z" opacity="0.85" />
      <circle cx="12" cy="13" r="2.4" /><rect x="11" y="13" width="2" height="8" rx="1" />
    </svg>
  )
}
function BattIcon() {
  return (
    <svg width="15" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
      <rect x="3" y="8" width="18" height="10" rx="1.5" /><path d="M7 8V6h3v2M14 8V6h3v2" />
      <path d="M21 9l-18 9" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  )
}
function TurnArrow(dir: 'left' | 'right') {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"
      style={{ transform: dir === 'right' ? 'scaleX(-1)' : undefined }} aria-hidden>
      <path d="M14 4l-8 8 8 8v-5h6v-6h-6z" />
    </svg>
  )
}
function BeamIcon() {
  return (
    <svg width="19" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M3 7h7a6 6 0 010 10H3a8 8 0 000-10z" opacity=".9" />
      <path d="M14 8h6M14 12h6M14 16h6" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  )
}

// coolant-temperature glyph (thermometer dipping into waves)
function CoolantIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 3v9.5a3 3 0 1 0 3 0V3a1.5 1.5 0 0 0-3 0z" />
      <path d="M3 19c1.2 0 1.2-1.2 2.4-1.2S6.6 19 7.8 19M15 19c1.2 0 1.2-1.2 2.4-1.2S18.6 19 19.8 19" />
    </svg>
  )
}

// fuel-pump glyph
function FuelIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="4" y="3" width="9" height="18" rx="1" />
      <line x1="4.5" y1="11" x2="12.5" y2="11" />
      <path d="M13 8h3.2a2 2 0 0 1 2 2v5.5a1.5 1.5 0 0 0 3 0V9l-2.6-2.6" />
    </svg>
  )
}
