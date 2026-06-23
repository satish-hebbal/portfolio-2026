'use client'

import { RefObject } from 'react'
import s from '../speedo.module.css'
import GaugeV8, { GaugeV8Handle } from './GaugeV8'

interface Theme { glow: string; arc: string; redline: string; tick: string; screen: string; mode: string }

interface Props {
  tachMax: number
  theme: Theme
  presetName: string
  gear: number
  gearLabel: string
  powered: boolean
  intro: boolean
  tachRef: RefObject<GaugeV8Handle | null>
  speedoRef: RefObject<GaugeV8Handle | null>
  tempRef: RefObject<GaugeV8Handle | null>
  fuelRef: RefObject<GaugeV8Handle | null>
  gearElRef: RefObject<HTMLDivElement | null>
  odoRef: RefObject<HTMLSpanElement | null>
  speedNumRef: RefObject<HTMLSpanElement | null>
  shiftTellRef: RefObject<HTMLSpanElement | null>
  brakeTellRef: RefObject<HTMLSpanElement | null>
  avgRef: RefObject<HTMLSpanElement | null>
  rangeRef: RefObject<HTMLSpanElement | null>
}

export default function V8Cluster({
  tachMax, theme, presetName, gearLabel, powered, intro,
  tachRef, speedoRef, tempRef, fuelRef,
  gearElRef, odoRef, speedNumRef, shiftTellRef, brakeTellRef, avgRef, rangeRef,
}: Props) {
  return (
    <div className={s.v8cluster}>
      {/* trim cap along the top edge of the hood */}
      <img src="/lab/speedo/img-assets/hood-cap.svg" alt="" aria-hidden className={s.v8HoodCap} />
      {/* top rail — only the turn-signal arrows, spread to the corners */}
      <div className={s.v8Rail}>
        <span className={`${s.v8Tell} ${s.v8Green}`} title="Left">{Arrow('left')}</span>
        <span className={`${s.v8Tell} ${s.v8Green}`} title="Right">{Arrow('right')}</span>
      </div>

      <div className={s.v8wrap}>
        <div className={s.v8deck}>
          {/* LEFT big — KM/H, angled inward */}
          <div className={`${s.v8pod} ${s.v8Left}`}>
            <img src="/lab/speedo/img-assets/kmph-guage-cap.svg" alt="" aria-hidden className={s.v8KmphCap} />
            <GaugeV8 ref={speedoRef} size={326} min={0} max={260} majorStep={20} minorPerMajor={4}
              startDeg={90} sweepDeg={260} labelScale={0.48} rimWidth={0.058} powered={powered} warnStart={160}
              numberFontFamily="Siegra" tickLenScale={0.68} numberInset={0.085}
              accent={theme.redline} arcColor={theme.arc} tickColor={theme.tick} smoothing={0.12} />
            <div className={s.v8SpeedDigital}>
              <b><span ref={speedNumRef}>0</span></b><i>KM/H</i>
            </div>
          </div>

          {/* CENTER big — RPM with LCD screen sector (bottom-right), pushed forward */}
          <div className={`${s.v8pod} ${s.v8Center}`}>
            <img src="/lab/speedo/img-assets/RPM-guage-cap.svg" alt="" aria-hidden className={s.v8RpmCap} />
            <GaugeV8 ref={tachRef} size={384} min={0} max={tachMax / 1000} majorStep={1}
              minorPerMajor={5} redlineStart={(tachMax / 1000) - 1.4}
              startDeg={122} sweepDeg={236} screenDeg={[2, 118]} labelScale={0.86} rimWidth={0.058} powered={powered}
              numberFontFamily="Siegra"
              accent={theme.redline} arcColor={theme.arc} tickColor={theme.tick} smoothing={0.22} />
            <div className={s.v8TachUnit}>×1000 r/min</div>
            {/* digital screen overlay sitting in the dial's bottom-right sector */}
            <div className={s.v8Screen}>
              {intro ? (
                <div className={s.v8Intro}>
                  <div className={s.v8IntroLogo}>
                    <img src="/images/common/sa26-white.svg" alt="" />
                    <img src="/images/common/sa26-white.svg" alt="" aria-hidden className={s.v8GlitchA} />
                    <img src="/images/common/sa26-white.svg" alt="" aria-hidden className={s.v8GlitchB} />
                  </div>
                </div>
              ) : (
                <>
                  <div className={s.v8ScreenTop}>
                    <span>{presetName}</span><span className={s.v8Mode}>{theme.mode}</span>
                  </div>
                  <div className={s.v8Trip}>
                    <div className={s.v8TripRow}><i>AVG</i><b><span ref={avgRef}>0</span> km/h</b></div>
                    <div className={s.v8TripRow}><i>RANGE</i><b><span ref={rangeRef}>429</span> km</b></div>
                    <div className={s.v8TripRow}><i>ODO</i><b><span ref={odoRef}>590.0</span> km</b></div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* RIGHT — gear over fuel (stacked), temp centred to their right; all
              share the same canvas rim, thicker */}
          <div className={`${s.v8pod} ${s.v8Right}`}>
            <div className={s.v8RightCol}>
              <div className={`${s.v8Gauge} ${s.v8GearDial}`}>
                <GaugeV8 bare size={132} min={0} max={1} majorStep={1} minorPerMajor={1}
                  rimWidth={0.12} accent={theme.redline} arcColor={theme.arc} tickColor={theme.tick} />
                <div className={`${s.v8GearScreen} ${gearLabel === 'N' ? s.v8GearN : s.v8GearDrive}`}>
                  <div ref={gearElRef} className={s.v8GearBig}>{gearLabel}</div>
                </div>
                <span className={s.v8MiniCap}>GEAR</span>
              </div>
              <div className={s.v8Gauge}>
                <GaugeV8 ref={fuelRef} size={132} min={0} max={1} majorStep={0.25} minorPerMajor={1}
                  numbers={false} startDeg={130} sweepDeg={140} rimWidth={0.12} powered={powered}
                  accent={theme.redline} arcColor={theme.arc} tickColor={theme.tick} smoothing={0.1} />
                <span className={`${s.v8MiniLabel} ${s.v8LabelC}`}>E</span>
                <span className={`${s.v8MiniLabel} ${s.v8LabelH}`}>F</span>
                <span className={s.v8MiniCap}>FUEL</span>
              </div>
            </div>
            <div className={`${s.v8Gauge} ${s.v8TempDial}`}>
              <GaugeV8 ref={tempRef} size={132} min={0} max={1} majorStep={0.25} minorPerMajor={1}
                redlineStart={0.84} numbers={false} startDeg={130} sweepDeg={140} rimWidth={0.12} powered={powered}
                accent={theme.redline} arcColor={theme.arc} tickColor={theme.tick} smoothing={0.1} />
              <span className={`${s.v8MiniLabel} ${s.v8LabelC}`}>C</span>
              <span className={`${s.v8MiniLabel} ${s.v8LabelH}`}>H</span>
              <span className={s.v8MiniCap}>TEMP</span>
            </div>
          </div>
        </div>
      </div>

      {/* the rest of the tells sit BELOW the main dial */}
      <div className={s.v8RailBottom}>
        <span className={`${s.v8Tell} ${s.v8Amber}`} title="ABS">ABS</span>
        <span ref={shiftTellRef} className={`${s.v8Tell} ${s.v8Amber}`} title="Shift">{Bolt()}</span>
        <span className={`${s.v8Tell} ${s.v8Blue}`} title="Beam">{Beam()}</span>
        <span ref={brakeTellRef} className={`${s.v8Tell} ${s.v8Red}`} title="Brake">{'(P)'}</span>
      </div>
    </div>
  )
}

function Arrow(dir: 'left' | 'right') {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"
      style={{ transform: dir === 'right' ? 'scaleX(-1)' : undefined }}>
      <path d="M14 4l-8 8 8 8v-5h6v-6h-6z" />
    </svg>
  )
}
function Bolt() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2L4 14h6l-1 8 9-12h-6z" /></svg>
}
function Beam() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M3 7h7a6 6 0 010 10H3a8 8 0 000-10z" opacity=".9" /><path d="M14 8h6M14 12h6M14 16h6" stroke="currentColor" strokeWidth="1.6" /></svg>
}
