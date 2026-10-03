"use client"

import { useState } from 'react'
import Image from 'next/image'
import { copyText } from '@/lib/clipboard'

// Closes every case study the same way: what the work achieved, flush under
// the case study's bordered column as its last section, then the invitation
// to get in touch, at the point a reader is most convinced.

const EMAIL = 'satishdezn@gmail.com'
const font = { fontFamily: 'FunnelDisplay, sans-serif' }
const serif = { fontFamily: 'SatishSans, sans-serif' }

const Plus = ({ h, v = 'bottom' }: { h: 'left' | 'right'; v?: 'top' | 'bottom' }) => (
  <span
    aria-hidden="true"
    className="absolute select-none pointer-events-none"
    style={{
      [h]: 0, [v]: 0,
      transform: `translate(${h === 'left' ? '-50%' : '50%'}, ${v === 'top' ? '-50%' : '50%'})`,
      fontFamily: 'monospace', fontSize: '13px', lineHeight: 1, color: '#9ca3af', zIndex: 10,
    }}
  >+</span>
)

export default function CaseOutro({ headline, children }: { headline: string; children: React.ReactNode }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    if (await copyText(EMAIL)) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="px-4 md:px-0">
      {/* Outcome: the final section of the case study column */}
      <section className="relative max-w-5xl mx-auto border-l border-r border-b border-gray-200 px-6 md:px-10 pt-10 md:pt-12 pb-10 md:pb-12">
        <p className="text-[10px] uppercase tracking-widest mb-2 text-gray-500" style={font}>Outcome</p>
        <h2 className="text-2xl md:text-3xl font-light leading-snug text-black mb-4" style={serif}>{headline}</h2>
        <p className="text-sm text-gray-600 leading-relaxed max-w-2xl" style={font}>{children}</p>
        <Plus h="left" />
        <Plus h="right" />
      </section>

      {/* Let's talk */}
      <div className="max-w-5xl mx-auto mt-10 border border-gray-200 px-6 md:px-10 py-12 md:py-16 flex flex-col md:flex-row items-start md:items-center justify-between gap-8 relative overflow-visible">
        <Plus h="left" v="top" />
        <Plus h="right" v="top" />
        <Plus h="left" />
        <Plus h="right" />
        <div>
          <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-3" style={font}>Let&apos;s Work Together</p>
          <Image src="/images/common/sa26.svg" alt="" width={56} height={56} className="w-12 h-12 mb-4" />
          <h2 className="text-3xl md:text-4xl font-light text-gray-900 leading-snug" style={serif}>
            Great products happen{" "}<br />when the right people meet.
          </h2>
          <p className="text-sm text-gray-500 mt-3 max-w-md" style={font}>
            If you&apos;re building something and need a designer who goes all in, let&apos;s talk.
          </p>
        </div>
        <div className="flex flex-col gap-3 shrink-0 w-full md:w-auto">
          <a
            href={`mailto:${EMAIL}`}
            className="w-full flex items-center gap-3 px-5 py-3 bg-gray-900 border border-gray-900 text-white text-xs tracking-wide hover:bg-black transition-colors duration-200"
            style={font}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m2 7 10 7 10-7"/></svg>
            Say hello
          </a>
          <button
            type="button"
            onClick={copy}
            className="w-full flex items-center gap-3 px-5 py-3 border border-gray-200 text-gray-600 text-xs tracking-wide hover:border-gray-400 hover:text-gray-900 transition-colors duration-200 cursor-pointer"
            style={font}
            aria-label={copied ? 'Email copied' : `Copy ${EMAIL}`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><rect x="8" y="8" width="13" height="13" rx="1"/><path d="M16 8V4a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h4"/></svg>
            {copied ? 'Copied' : EMAIL}
          </button>
          <a
            href="https://www.linkedin.com/in/satish-hebbal/"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center gap-3 px-5 py-3 border border-gray-200 text-gray-600 text-xs tracking-wide hover:border-gray-400 hover:text-gray-900 transition-colors duration-200"
            style={font}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg>
            LinkedIn
          </a>
        </div>
      </div>
    </div>
  )
}
