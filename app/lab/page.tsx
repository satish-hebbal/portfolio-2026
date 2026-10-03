import Link from 'next/link'
import LabHeader from './LabHeader'
import { CardContainer, CardBody, CardItem } from '@/components/ui/3d-card'
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'The Lab - Satish Hebbal',
  description:
    'Tools and experiments: a mini music studio, a mockup tool, a colour memory game, a hardware-style QR generator, an instrument cluster, and a YouTube Walkman.',
  openGraph: {
    title: 'The Lab - Satish Hebbal',
    description:
      'Tools and experiments: a mini music studio, a mockup tool, a colour memory game, a hardware-style QR generator, an instrument cluster, and a YouTube Walkman.',
    url: '/lab',
    images: [{ url: '/images/og.png', width: 1200, height: 630 }],
  },
};

const ArrowBtn = ({ light = false, external = false }: { light?: boolean; external?: boolean }) => (
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
      {external
        ? <path d="M7 17L17 7M17 7H8M17 7V16" />
        : <path d="M5 12h14M13 6l6 6-6 6" />}
    </svg>
  </div>
)

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <div className="mb-4 mt-2">
    <span style={{
      fontFamily: 'SatishSans, sans-serif', fontSize: '0.8rem', fontWeight: 500,
      letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(0,0,0,0.55)',
    }}>
      {children}
    </span>
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

        .discontinued-dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: #a8a29e;
          display: block;
          flex-shrink: 0;
        }

        /* Datagini: pixel dot grid in the brand green, fading in from the top-right */
        .datagini-grid {
          position: absolute;
          inset: 0;
          pointer-events: none;
          background-image: radial-gradient(rgba(22,163,74,0.28) 1px, transparent 1.2px);
          background-size: 7px 7px;
          -webkit-mask-image: radial-gradient(120% 90% at 100% 0%, #000 0%, transparent 62%);
          mask-image: radial-gradient(120% 90% at 100% 0%, #000 0%, transparent 62%);
        }
        .datagini-thumb-wrap {
          position: absolute;
          bottom: -6px;
          right: 72px;
          width: 112px;
          pointer-events: none;
        }
        .datagini-thumb-wrap img {
          display: block;
          width: 100%;
          image-rendering: pixelated;
        }
        /* two-frame blink: closed-eye frame flashes briefly each loop */
        @keyframes gini-blink {
          0%, 92%, 100% { opacity: 0; }
          94%, 97%      { opacity: 1; }
        }
        .datagini-blink {
          position: absolute;
          inset: 0;
          animation: gini-blink 3.6s steps(1, end) infinite;
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
        .speedo-thumb-wrap {
          position: absolute;
          bottom: -58px;
          right: -44px;
          width: 320px;
          height: 320px;
          pointer-events: none;
        }
        .studio-kapi-thumb-wrap {
          position: absolute;
          bottom: -50px;
          right: -80px;
          width: 280px;
          height: 280px;
          pointer-events: none;
        }
        .ribbit-thumb-wrap {
          position: absolute;
          bottom: -26px;
          right: -34px;
          width: 300px;
          pointer-events: none;
          /* fade the top-left edges into the card so the artwork has no hard seam */
          -webkit-mask-image: linear-gradient(118deg, transparent 0%, #000 34%);
          mask-image: linear-gradient(118deg, transparent 0%, #000 34%);
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
          .speedo-thumb-wrap {
            right: -15px;
            bottom: -45px;
            width: 210px;
            height: 210px;
          }
          .studio-kapi-thumb-wrap {
            right: -80px;
            bottom: -40px;
            width: 220px;
            height: 220px;
          }
          .ribbit-thumb-wrap {
            right: -30px;
            bottom: -20px;
            width: 240px;
          }
          .datagini-thumb-wrap {
            right: 68px;
            width: 96px;
          }
        }
      `}</style>

      <LabHeader />

      <div>
        <SectionLabel>Tools I got tired of not having</SectionLabel>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* Studio-Kapi */}
          <Link href="/lab/studio-kapi" style={{ textDecoration: 'none', display: 'block' }}>
            <CardContainer containerClassName="w-full p-0" className="w-full">
              <CardBody className="w-full h-[220px] relative border border-gray-200 overflow-hidden px-6 py-8"
                style={{ background: 'linear-gradient(135deg, #f4f1ff 0%, #ffffff 60%)', borderRadius: 0 }}>
                <CardItem translateZ={50} className="block"
                  style={{ fontFamily: 'SatishSans, sans-serif', fontSize: '1.5rem', fontWeight: 300, letterSpacing: '-0.01em', color: '#111' }}>
                  Studio-Kapi
                </CardItem>
                <CardItem translateZ={60} as="p" className="block mt-3 text-balance"
                  style={{ fontSize: '0.75rem', color: 'rgba(0,0,0,0.55)', letterSpacing: '0.02em', lineHeight: 1.5, maxWidth: '60%' }}>
                  A mini music studio: program beats, play instruments, record &amp; layer your voice
                </CardItem>
                <CardItem translateZ={110} className="studio-kapi-thumb-wrap">
                  <img loading="lazy" decoding="async" src="/images/lab/studio-kapi-tumbnail.webp" alt="Studio Kapi Preview"
                    style={{ width: '100%', height: '100%', objectFit: 'contain', opacity: 0.92 }} />
                </CardItem>
                <CardItem translateZ={30} className="absolute" style={{ bottom: 20, right: 20, zIndex: 10 }}>
                  <ArrowBtn />
                </CardItem>
              </CardBody>
            </CardContainer>
          </Link>

          {/* Ribbit */}
          <a href="https://ribbit.satishhebbal.design/" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', display: 'block' }}>
            <CardContainer containerClassName="w-full p-0" className="w-full">
              <CardBody className="w-full h-[220px] relative border border-gray-200 overflow-hidden px-6 py-8"
                style={{ background: 'linear-gradient(135deg, #eafaf0 0%, #ffffff 60%)', borderRadius: 0 }}>
                <CardItem translateZ={50} className="block"
                  style={{ fontFamily: 'SatishSans, sans-serif', fontSize: '1.5rem', fontWeight: 300, letterSpacing: '-0.01em', color: '#111' }}>
                  Ribbit
                </CardItem>
                <CardItem translateZ={60} as="p" className="block mt-3 text-balance"
                  style={{ fontSize: '0.75rem', color: 'rgba(0,0,0,0.55)', letterSpacing: '0.02em', lineHeight: 1.5, maxWidth: '52%' }}>
                  A fast, no-fuss mockup tool for sketching UI ideas
                </CardItem>
                <CardItem translateZ={110} className="ribbit-thumb-wrap">
                  <img loading="lazy" decoding="async" src="/images/lab/ribbit.webp" alt="Ribbit Preview"
                    style={{ width: '100%', height: '100%', objectFit: 'contain', opacity: 0.95 }} />
                </CardItem>
                <CardItem translateZ={30} className="absolute" style={{ bottom: 20, right: 20, zIndex: 10 }}>
                  <ArrowBtn external />
                </CardItem>
              </CardBody>
            </CardContainer>
          </a>


        </div>
      </div>

      <div className="mt-14">
        <SectionLabel>Just to keep my pen sharp</SectionLabel>
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
                <CardItem translateZ={60} as="p" className="block mt-3 text-balance"
                  style={{ fontSize: '0.75rem', color: 'rgba(0,0,0,0.55)', letterSpacing: '0.02em', lineHeight: 1.5 }}>
                  A game that tests how sharp your color memory really is
                </CardItem>
                <CardItem translateZ={100} className="absolute" style={{ bottom: -45, right: -45 }}>
                  <img loading="lazy" decoding="async" src="/images/HomeImages/color-wheel.webp" alt=""
                    className="color-wheel-spin"
                    style={{ width: 160, height: 160, objectFit: 'contain', pointerEvents: 'none', opacity: 0.92 }} />
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
                style={{ background: 'linear-gradient(135deg, #f3f3f3 0%, #ffffff 60%)', borderRadius: 0 }}>
                <CardItem translateZ={50} className="block"
                  style={{ fontFamily: 'SatishSans, sans-serif', fontSize: '1.5rem', fontWeight: 300, letterSpacing: '-0.01em', color: '#1a1a1a' }}>
                  QR Device
                </CardItem>
                <CardItem translateZ={60} as="p" className="qr-card-desc block mt-3"
                  style={{ fontSize: '0.75rem', color: 'rgba(0,0,0,0.55)', letterSpacing: '0.02em', lineHeight: 1.5 }}>
                  A hardware-style QR generator with gradients, textures &amp; sound
                </CardItem>
                <CardItem translateZ={110} className="qr-thumb-wrap">
                  <img loading="lazy" decoding="async" src="/images/lab/qr-device-thumnail.webp" alt=""
                    style={{ width: '100%', opacity: 0.92, transform: 'rotate(4deg)' }} />
                </CardItem>
                <CardItem translateZ={30} className="absolute" style={{ bottom: 20, right: 20, zIndex: 1 }}>
                  <ArrowBtn />
                </CardItem>
              </CardBody>
            </CardContainer>
          </Link>
  
          {/* Speedoo */}
          <Link href="/lab/speedo" style={{ textDecoration: 'none', display: 'block' }}>
            <CardContainer containerClassName="w-full p-0" className="w-full">
              <CardBody className="w-full h-[220px] relative border border-gray-200 overflow-hidden px-6 py-8"
                style={{ background: 'linear-gradient(135deg, #f5f7fa 0%, #ffffff 60%)', borderRadius: 0 }}>
                <CardItem translateZ={50} className="block"
                  style={{ fontFamily: 'SatishSans, sans-serif', fontSize: '1.5rem', fontWeight: 300, letterSpacing: '-0.01em', color: '#111' }}>
                  Speedoo
                </CardItem>
                <CardItem translateZ={60} as="p" className="block mt-3 text-balance"
                  style={{ fontSize: '0.75rem', color: 'rgba(0,0,0,0.55)', letterSpacing: '0.02em', lineHeight: 1.5, maxWidth: '58%' }}>
                  A hyper-real instrument cluster with a fully synthesised engine you can rev
                </CardItem>
                <CardItem translateZ={110} className="speedo-thumb-wrap">
                  <img loading="lazy" decoding="async" src="/images/lab/tumbnail-speedoo.webp" alt="Speedoo Preview"
                    style={{ width: '100%', height: '100%', objectFit: 'contain', opacity: 0.92 }} />
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
                <CardItem translateZ={60} as="p" className="block mt-3 text-balance"
                  style={{ fontSize: '0.75rem', color: 'rgba(0,0,0,0.55)', letterSpacing: '0.02em', lineHeight: 1.5 }}>
                  What if you could listen to any YouTube track on a vintage Walkman?
                </CardItem>
                <CardItem translateZ={110} className="walkman-thumb-wrap">
                  <img loading="lazy" decoding="async" src="/images/lab/walkman-card.webp" alt=""
                    style={{ width: '100%', height: '100%', objectFit: 'contain', transform: 'rotate(-45deg)', opacity: 0.92 }} />
                </CardItem>
                <CardItem translateZ={30} className="absolute" style={{ bottom: 20, right: 20, zIndex: 1 }}>
                  <ArrowBtn />
                </CardItem>
              </CardBody>
            </CardContainer>
          </Link>
  
        </div>
      </div>

      {/* Retired work sits last, under its own label, so the live tools lead */}
      <div className="mt-14">
        <SectionLabel>Retired</SectionLabel>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Datagini */}
          <a href="https://datagini.satishhebbal.design/" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', display: 'block' }}>
            <CardContainer containerClassName="w-full p-0" className="w-full">
              <CardBody className="w-full h-[220px] relative border border-gray-200 overflow-hidden px-6 py-8"
                style={{ background: 'linear-gradient(135deg, #f5f5f4 0%, #fafaf9 55%, #ecfdf3 100%)', borderRadius: 0 }}>
                <div className="datagini-grid" />
                <CardItem translateZ={50} className="block"
                  style={{ fontFamily: 'SatishSans, sans-serif', fontSize: '1.5rem', fontWeight: 300, letterSpacing: '-0.01em', color: '#1c1917' }}>
                  Datagini
                </CardItem>
                <CardItem translateZ={60} as="p" className="block mt-3 text-balance"
                  style={{ fontSize: '0.75rem', color: 'rgba(28,25,23,0.55)', letterSpacing: '0.02em', lineHeight: 1.5, maxWidth: '52%' }}>
                  A tool for turning raw data into something useful
                </CardItem>
                <CardItem translateZ={40} className="absolute" style={{ top: 20, right: 20, zIndex: 2 }}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '0.6rem', fontWeight: 500,
                    letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(28,25,23,0.5)',
                    background: 'rgba(255,255,255,0.8)', border: '1px solid rgba(28,25,23,0.08)',
                    borderRadius: '999px', padding: '4px 10px', whiteSpace: 'nowrap',
                  }}>
                    <span className="discontinued-dot" />
                    Discontinued
                  </span>
                </CardItem>
                <CardItem translateZ={110} className="datagini-thumb-wrap">
                  <img loading="lazy" decoding="async" src="/images/lab/datagini-gini-f1.webp" alt="Gini, the Datagini mascot, perched on a database" />
                  <img loading="lazy" decoding="async" src="/images/lab/datagini-gini-f2.webp" alt="" className="datagini-blink" />
                </CardItem>
                <CardItem translateZ={30} className="absolute" style={{ bottom: 20, right: 20, zIndex: 1 }}>
                  <ArrowBtn external />
                </CardItem>
              </CardBody>
            </CardContainer>
          </a>
        </div>
      </div>
    </div>
  )
}
