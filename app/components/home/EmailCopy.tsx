"use client"

import { useState } from 'react'
import { copyText } from '@/lib/clipboard'

const EMAIL = 'satishdezn@gmail.com'

const CopyIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" height="16px" viewBox="0 -960 960 960" width="16px" fill="#6b7280">
    <path d="M358.27-260q-28.44 0-48.35-19.92Q290-299.83 290-328.27v-455.38q0-28.44 19.92-48.36 19.91-19.91 48.35-19.91h335.38q28.44 0 48.36 19.91 19.91 19.92 19.91 48.36v455.38q0 28.44-19.91 48.35Q722.09-260 693.65-260H358.27Zm0-55.96h335.38q4.62 0 8.46-3.85 3.85-3.84 3.85-8.46v-455.38q0-4.62-3.85-8.47-3.84-3.84-8.46-3.84H358.27q-4.62 0-8.46 3.84-3.85 3.85-3.85 8.47v455.38q0 4.62 3.85 8.46 3.84 3.85 8.46 3.85ZM226.35-128.08q-28.44 0-48.36-19.92-19.91-19.91-19.91-48.35v-511.34h55.96v511.34q0 4.62 3.85 8.46 3.84 3.85 8.46 3.85h391.34v55.96H226.35Zm119.61-187.88v-480 480Z"/>
  </svg>
)

const TickIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" height="16px" viewBox="0 -960 960 960" width="16px" fill="white">
    <path d="M382.81-258.69 175.08-466.42l40.04-40.04 167.69 167.88 362.27-362.27 39.84 40.04-402.11 402.12Z"/>
  </svg>
)

const Plus = ({ h, v }: { h: 'left' | 'right'; v: 'top' | 'bottom' }) => (
  <span
    className="absolute select-none pointer-events-none"
    style={{
      [h]: 0, [v]: 0,
      transform: `translate(${h === 'left' ? '-50%' : '50%'}, ${v === 'top' ? 'calc(-50% - 1px)' : '50%'})`,
      fontFamily: 'monospace', fontSize: '13px', lineHeight: 1, color: '#9ca3af', zIndex: 10,
    }}
  >+</span>
)

export default function EmailCopy() {
  const [copied, setCopied] = useState(false)

  const handleClick = async () => {
    await copyText(EMAIL)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div
      className="relative border cursor-pointer transition-colors duration-300"
      style={{
        fontFamily: 'FunnelDisplay, sans-serif',
        background: copied ? '#111' : 'white',
        borderColor: copied ? '#111' : '#e5e7eb',
        overflow: 'visible',
        WebkitTapHighlightColor: 'transparent',
      }}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      aria-label={`Copy email address ${EMAIL}`}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick() } }}
    >
      <Plus h="left"  v="top" />
      <Plus h="right" v="top" />
      <Plus h="left"  v="bottom" />
      <Plus h="right" v="bottom" />

      <div className={`flex items-center transition-opacity duration-200 ${copied ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
        <span className="pl-4 pr-2 py-2 text-xs text-gray-500 select-none">{EMAIL}</span>
        <span aria-hidden="true" className="pl-2 pr-4 py-2 shrink-0 flex items-center justify-center">
          <CopyIcon />
        </span>
      </div>

      <div aria-live="polite" className={`absolute inset-0 flex items-center justify-center gap-2 text-white text-xs transition-opacity duration-200 ${copied ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <TickIcon /> Copied
      </div>
    </div>
  )
}
