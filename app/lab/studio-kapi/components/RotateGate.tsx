'use client'

import { Smartphone } from 'lucide-react'
import s from '../studioKapi.module.css'

// Shown only on small portrait screens (CSS media query controls visibility).
export default function RotateGate() {
  return (
    <div className={s.rotate}>
      <Smartphone size={56} className={s.rotateIcon} strokeWidth={1.4} />
      <div style={{ fontSize: 18, fontWeight: 600, color: '#fff' }}>Rotate your device</div>
      <div style={{ fontSize: 13, color: '#9aa1b0', maxWidth: 260, lineHeight: 1.5 }}>
        Studio-Kapi needs landscape space to lay out the channels, mixer and piano roll. Turn your phone sideways to start producing.
      </div>
    </div>
  )
}
