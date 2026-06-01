import Link from 'next/link'
import LabHeader from './LabHeader'

export default function Lab() {
  return (
    <div
      className="bg-white min-h-screen px-8 pt-28 md:pt-36 pb-16 max-w-5xl mx-auto"
      style={{ fontFamily: 'FunnelDisplay, sans-serif' }}
    >
      <style>{`
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .color-wheel-spin {
          animation: spin-slow 12s linear infinite;
        }
        .walkman-thumb {
          position: absolute;
          top: -70px;
          right: -45px;
          width: 250px;
          height: 250px;
          object-fit: contain;
          pointer-events: none;
          opacity: 0.92;
          transform: rotate(-45deg) scale(1);
          transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .group:hover .walkman-thumb {
          transform: rotate(-30deg) scale(1.12);
        }
        .walkman-card {
          border: 1px solid #e5e7eb;
          transition: border-color 0.2s ease;
        }
        .walkman-card:hover {
          border-color:rgb(147, 185, 243);
        }
        @media (max-width: 767px) {
          .walkman-thumb {
            width: 160px;
            height: 160px;
            top: -45px;
            right: -30px;
            transform: rotate(5deg) scale(1);
          }
          .group:hover .walkman-thumb {
            transform: rotate(20deg) scale(1.12);
          }
        }
      `}</style>

      <LabHeader />

      {/* Two-column grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link
          href="/lab/color"
          className="group relative border border-gray-200 px-6 py-8 hover:border-gray-900 transition-colors duration-200 overflow-hidden"
          style={{ background: '#ffffff', textDecoration: 'none', borderRadius: '0 16px 0 16px', boxShadow: 'inset 8px 0 24px -8px rgba(255,222,184,0.8)' }}
        >
          <div
            className="text-2xl font-light tracking-tight mb-3 text-black"
            style={{ fontFamily: 'SatishSans, sans-serif', letterSpacing: '-0.01em' }}
          >
            Color
          </div>
          <div className="text-xs mb-8" style={{ color: 'rgba(0,0,0,0.4)', letterSpacing: '0.02em', lineHeight: '1.5' }}>
            How good is your color memory?
          </div>

          {/* Revolving color wheel — bottom right, half visible */}
          <img
            src="/images/HomeImages/color-wheel.webp"
            alt=""
            className="color-wheel-spin"
            style={{
              position: 'absolute',
              bottom: '-45px',
              right: '-45px',
              width: '160px',
              height: '160px',
              objectFit: 'contain',
              pointerEvents: 'none',
            }}
          />

          <div className="absolute bottom-5 right-5" style={{ zIndex: 1, width: '30px', height: '30px', borderRadius: '50%', background: '#efefef', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'inset 2px 2px 4px rgba(0,0,0,0.18), inset -1px -1px 3px rgba(255,255,255,0.9)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(0,0,0,0.5)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </div>
        </Link>

        <Link
          href="/lab/walkman"
          className="group walkman-card relative px-6 py-8 overflow-hidden"
          style={{ background: '#ffffff', textDecoration: 'none', borderRadius: '0 16px 0 16px', boxShadow: 'inset 8px 0 24px -8px rgba(103,151,210,0.4)' }}
        >
          <div
            className="text-2xl font-light tracking-tight mb-3 text-black"
            style={{ fontFamily: 'SatishSans, sans-serif', letterSpacing: '-0.01em' }}
          >
            YT Walkman
          </div>
          <div className="text-xs mb-8" style={{ color: 'rgba(0,0,0,0.4)', letterSpacing: '0.02em', lineHeight: '1.5' }}>
            What if you could listen to any<br />YouTube track on a vintage Walkman?
          </div>

          <img
            src="/images/lab/walkman-thumnail.png"
            alt=""
            className="walkman-thumb"
          />

          <div className="absolute bottom-5 right-5" style={{ zIndex: 1, width: '30px', height: '30px', borderRadius: '50%', background: '#efefef', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'inset 2px 2px 4px rgba(0,0,0,0.18), inset -1px -1px 3px rgba(255,255,255,0.9)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(0,0,0,0.5)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </div>
        </Link>
      </div>
    </div>
  )
}
