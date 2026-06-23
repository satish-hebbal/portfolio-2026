'use client'

import { Power } from 'lucide-react'
import s from '../speedo.module.css'

interface Props {
  variant: 'gate' | 'top'
  on?: boolean            // engine running -> green dome
  onClick: () => void
  ariaLabel?: string
  tooltip?: string        // custom hover tooltip
}

// Realistic engine start/stop push-button: chrome bezel, glossy domed face,
// hex texture, LED indicator. Big "START ENGINE" for the popup, compact for
// the top bar.
export default function StartButton({ variant, on = false, onClick, ariaLabel, tooltip }: Props) {
  return (
    <button
      type="button"
      className={`${s.seBtn} ${variant === 'gate' ? s.seGate : s.seTop}`}
      onClick={onClick}
      aria-label={ariaLabel ?? (on ? 'Stop engine' : 'Start engine')}
    >
      {tooltip && <span className={s.seTip} role="tooltip">{tooltip}</span>}
      <span className={s.seBezel}>
        <span className={`${s.seFace} ${on ? s.seOn : ''}`}>
          <span className={s.seLed} />
          {variant === 'gate' ? (
            <span className={s.seLabel}>
              <b>{on ? 'STOP' : 'START'}</b>
              <i>ENGINE</i>
            </span>
          ) : (
            <Power className={s.seGlyph} size={18} strokeWidth={2.6} />
          )}
        </span>
      </span>
    </button>
  )
}
