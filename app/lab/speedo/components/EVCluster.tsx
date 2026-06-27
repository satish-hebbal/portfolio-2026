'use client'

import { CSSProperties, RefObject } from 'react'
import s from '../speedo.module.css'

interface Theme { glow: string; arc: string; redline: string; tick: string; screen: string; mode: string }

interface Props {
  theme: Theme
  powered: boolean
  gearLabel: string
  speedNumRef: RefObject<HTMLSpanElement | null>
  battRef: RefObject<HTMLSpanElement | null>
  battFillRef: RefObject<HTMLSpanElement | null>
  powerRef: RefObject<HTMLSpanElement | null>
  rangeRef: RefObject<HTMLSpanElement | null>
  framesRef: RefObject<HTMLDivElement | null>
}

// Minimal EV cluster: an infinite tunnel of sharp rectangles drawn continuously
// toward the centre vanishing point. The march speeds up and glows brighter with
// km/h (driven per-frame in page.tsx), so it feels like being pulled inward.
const FRAMES = 11

export default function EVCluster({ theme, powered, gearLabel, speedNumRef, battRef, battFillRef, powerRef, rangeRef, framesRef }: Props) {
  return (
    <div className={`${s.ev} ${powered ? s.evOn : ''}`}
      style={{ '--glow': theme.glow, '--arc': theme.arc } as CSSProperties}>
      {/* sharp rectangles marching inward toward the vanishing point */}
      <div ref={framesRef} className={s.evFrames} aria-hidden>
        {Array.from({ length: FRAMES }).map((_, i) => (
          <span key={i} className={s.evFrame} style={{ '--i': i } as CSSProperties} />
        ))}
      </div>

      <div className={s.evGrid}>
        {/* LEFT — power delivered to the motor */}
        <div className={`${s.evSide} ${s.evLeft}`}>
          <span className={s.evSideLabel}>POWER</span>
          <div className={s.evSideValue}><b ref={powerRef}>0</b><i>kW</i></div>
          <span className={s.evSideSub}>TO MOTOR</span>
        </div>

        {/* CENTER — speed */}
        <div className={s.evCenter}>
          <div className={s.evSpeed}><span ref={speedNumRef}>0</span></div>
          <div className={s.evUnit}>km/h</div>
          <div className={s.evMode}>{gearLabel === 'N' ? 'N' : gearLabel === 'R' ? 'R' : 'D'}</div>
        </div>

        {/* RIGHT — battery */}
        <div className={`${s.evSide} ${s.evRight}`}>
          <span className={s.evSideLabel}>BATTERY</span>
          <div className={s.evSideValue}><b ref={battRef}>74</b><i>%</i></div>
          <div className={s.evBatt}><span ref={battFillRef} className={s.evBattFill} /></div>
          <span className={s.evSideSub}>RANGE <b ref={rangeRef}>429</b> km</span>
        </div>
      </div>
    </div>
  )
}
