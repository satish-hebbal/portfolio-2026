import Link from 'next/link'
import LabHeader from './LabHeader'
import { CardContainer, CardBody, CardItem } from '@/components/ui/3d-card'

const ArrowBtn = ({ light = false }: { light?: boolean }) => (
  <div style={{
    width: 30, height: 30, borderRadius: '50%',
    background: light ? 'rgba(255,255,255,0.15)' : '#efefef',
    border: light ? '1px solid rgba(255,255,255,0.2)' : 'none',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: light ? 'none' : 'inset 2px 2px 4px rgba(0,0,0,0.18), inset -1px -1px 3px rgba(255,255,255,0.9)',
  }}>
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke={light ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)'}
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  </div>
)

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
          animation-play-state: paused;
        }
        .color-wheel-card:hover .color-wheel-spin {
          animation-play-state: running;
        }

        /* Thumbnail positioning — CSS classes so media queries can override */
        .walkman-thumb-wrap {
          position: absolute;
          top: -70px;
          right: -45px;
          width: 250px;
          height: 250px;
          pointer-events: none;
        }
        .qr-thumb-wrap {
          position: absolute;
          bottom: 16px;
          right: 10px;
          width: 200px;
          pointer-events: none;
        }
        .qr-card-desc {
          max-width: 55%;
        }

        @media (max-width: 767px) {
          /* Center thumbnails at bottom on mobile */
          .walkman-thumb-wrap {
            top: auto;
            right: auto;
            left: -20px;
            bottom: -75px;
            width: 200px;
            height: 200px;
            margin: 0;
          }
          .walkman-thumb-wrap img {
            transform: rotate(-14deg) !important;
          }
          .qr-thumb-wrap {
            right: 0;
            left: 0;
            bottom: -75px;
            width: 170px;
            margin: 0 auto;
          }
          /* Full-width text on mobile */
          .qr-card-desc {
            max-width: 100%;
          }
        }
      `}</style>

      <LabHeader />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Color Memo */}
        <Link href="/lab/color" className="color-wheel-card" style={{ textDecoration: 'none', display: 'block' }}>
          <CardContainer containerClassName="w-full p-0" className="w-full">
            <CardBody className="w-full h-[220px] relative border border-gray-200 overflow-hidden px-6 py-8"
              style={{ background: 'linear-gradient(135deg, #fff8ee 0%, #ffffff 60%)', borderRadius: 0 }}>
              <CardItem translateZ={50} className="block"
                style={{ fontFamily: 'SatishSans, sans-serif', fontSize: '1.5rem', fontWeight: 300, letterSpacing: '-0.01em', color: '#111' }}>
                Color Memo
              </CardItem>
              <CardItem translateZ={60} as="p" className="block mt-3"
                style={{ fontSize: '0.75rem', color: 'rgba(0,0,0,0.4)', letterSpacing: '0.02em', lineHeight: 1.5 }}>
                A game that tests how sharp<br />your color memory really is
              </CardItem>
              <CardItem translateZ={100} className="absolute" style={{ bottom: -45, right: -45 }}>
                <img src="/images/HomeImages/color-wheel.webp" alt=""
                  className="color-wheel-spin"
                  style={{ width: 160, height: 160, objectFit: 'contain', pointerEvents: 'none', opacity: 0.92 }} />
              </CardItem>
              <CardItem translateZ={30} className="absolute" style={{ bottom: 20, right: 20, zIndex: 1 }}>
                <ArrowBtn />
              </CardItem>
            </CardBody>
          </CardContainer>
        </Link>

        {/* YT Walkman */}
        <Link href="/lab/walkman" style={{ textDecoration: 'none', display: 'block' }}>
          <CardContainer containerClassName="w-full p-0" className="w-full">
            <CardBody className="walkman-card-body w-full h-[220px] relative border border-gray-200 overflow-hidden px-6 py-8"
              style={{ background: 'linear-gradient(135deg, #eef4ff 0%, #ffffff 60%)', borderRadius: 0 }}>
              <CardItem translateZ={50} className="block"
                style={{ fontFamily: 'SatishSans, sans-serif', fontSize: '1.5rem', fontWeight: 300, letterSpacing: '-0.01em', color: '#111' }}>
                YT Walkman
              </CardItem>
              <CardItem translateZ={60} as="p" className="block mt-3"
                style={{ fontSize: '0.75rem', color: 'rgba(0,0,0,0.4)', letterSpacing: '0.02em', lineHeight: 1.5 }}>
                What if you could listen to any<br />YouTube track on a vintage Walkman?
              </CardItem>
              <CardItem translateZ={110} className="walkman-thumb-wrap">
                <img src="/images/lab/walkman-thumnail.png" alt=""
                  style={{ width: '100%', height: '100%', objectFit: 'contain', transform: 'rotate(-45deg)', opacity: 0.92 }} />
              </CardItem>
              <CardItem translateZ={30} className="absolute" style={{ bottom: 20, right: 20, zIndex: 1 }}>
                <ArrowBtn />
              </CardItem>
            </CardBody>
          </CardContainer>
        </Link>

        {/* QR Device */}
        <Link href="/lab/qr-device" style={{ textDecoration: 'none', display: 'block' }}>
          <CardContainer containerClassName="w-full p-0" className="w-full">
            <CardBody className="qr-card-body w-full h-[220px] relative border border-gray-200 overflow-hidden px-6 py-8"
              style={{ background: 'linear-gradient(135deg, #e8e8e8 0%, #ffffff 60%)', borderRadius: 0 }}>
              <CardItem translateZ={50} className="block"
                style={{ fontFamily: 'SatishSans, sans-serif', fontSize: '1.5rem', fontWeight: 300, letterSpacing: '-0.01em', color: '#1a1a1a' }}>
                QR Device
              </CardItem>
              <CardItem translateZ={60} as="p" className="qr-card-desc block mt-3"
                style={{ fontSize: '0.75rem', color: 'rgba(0,0,0,0.4)', letterSpacing: '0.02em', lineHeight: 1.5 }}>
                A hardware-style QR generator with gradients, textures &amp; sound
              </CardItem>
              <CardItem translateZ={110} className="qr-thumb-wrap">
                <img src="/images/lab/qr-device-thumnail.png" alt=""
                  style={{ width: '100%', opacity: 0.92, transform: 'rotate(4deg)' }} />
              </CardItem>
              <CardItem translateZ={30} className="absolute" style={{ bottom: 20, right: 20, zIndex: 1 }}>
                <ArrowBtn />
              </CardItem>
            </CardBody>
          </CardContainer>
        </Link>

      </div>
    </div>
  )
}
