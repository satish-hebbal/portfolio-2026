"use client";

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import CaseMeta from './CaseMeta';

const ACCENT = '#3098FF';

const Plus = ({ h, v = 'bottom' }: { h: 'left' | 'right'; v?: 'top' | 'bottom' }) => (
  <span
    className="absolute select-none pointer-events-none"
    style={{
      [h]: 0,
      [v]: 0,
      transform: `translate(${h === 'left' ? '-50%' : '50%'}, ${v === 'top' ? '-50%' : '50%'})`,
      fontFamily: 'monospace',
      fontSize: '13px',
      lineHeight: 1,
      color: '#9ca3af',
      zIndex: 10,
    }}
  >+</span>
);

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <p className="text-[10px] uppercase tracking-widest mb-2" style={{ fontFamily: 'FunnelDisplay, sans-serif', color: '#9ca3af' }}>
    {children}
  </p>
);

const SectionHeading = ({ children }: { children: React.ReactNode }) => (
  <h2 className="text-2xl md:text-3xl font-light leading-snug text-black mb-4" style={{ fontFamily: 'SatishSans, sans-serif' }}>
    {children}
  </h2>
);


export default function SkinSage() {
  const [mounted, setMounted] = useState(false);
  const [activeSection, setActiveSection] = useState('ss-brief');
  const [hoveredStat, setHoveredStat] = useState<string | null>(null);

  const sections = [
    { id: 'ss-brief',       label: 'Overview' },
    { id: 'ss-02',          label: 'Assessment' },
    { id: 'ss-search',      label: 'Search' },
    { id: 'ss-booking',     label: 'Booking' },
    { id: 'ss-checkout',    label: 'Checkout' },
    { id: 'ss-appointment', label: 'Appointment' },
    { id: 'ss-doctor',      label: 'Doctor View' },
    { id: 'ss-landing',     label: 'Landing' },
    { id: 'ss-ds',          label: 'Design System' },
  ];

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActiveSection(entry.target.id);
        });
      },
      { rootMargin: '-30% 0px -60% 0px' }
    );
    sections.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const prev = document.documentElement.style.background;
    document.documentElement.style.background = 'white';
    document.body.style.background = 'white';
    return () => {
      document.documentElement.style.background = prev;
      document.body.style.background = '';
    };
  }, []);

  const stats = [
    { value: '2 Weeks', label: 'Turnaround', sub: 'From kickoff to V1 live' },
    { value: '73%',     label: 'Day-7 Retention',     sub: 'Users returned after day 7' },
    { value: '100+',    label: 'Verified Doctors',    sub: 'Searchable by specialty, price and slot' },
  ];

  return (
    <div className="bg-white min-h-screen mt-16 px-4 md:px-0">

      {/* ── Sticky sidebar ──────────────────────────────────────────── */}
      {mounted && createPortal(
        <>
          <div
            className="hidden xl:block fixed z-[9998] pointer-events-none"
            style={{
              top: 'calc(50% - 175px)',
              bottom: 'calc(50% - 175px)',
              left: 0,
              width: '32px',
              border: '1px solid #d1d5db',
              borderLeft: 'none',
              borderTopRightRadius: '16px',
              borderBottomRightRadius: '16px',
            }}
          />
          <nav
            className="hidden xl:flex fixed z-[9999]"
            style={{ top: '50%', transform: 'translateY(-50%)', left: '26px' }}
          >
            <div className="flex flex-col">
              {sections.map((s) => {
                const isActive = activeSection === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => {
                      const el = document.getElementById(s.id);
                      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }}
                    style={{ fontFamily: 'FunnelDisplay, sans-serif' }}
                    className="cursor-pointer flex items-center gap-3 py-[6px] text-left group relative"
                  >
                    <span
                      className="shrink-0 flex items-center justify-center transition-all duration-300 relative z-10 bg-white"
                      style={{ width: '11px', height: '11px' }}
                    >
                      {isActive ? (
                        <span style={{ width: '7px', height: '7px', background: ACCENT, display: 'block' }} />
                      ) : (
                        <span
                          style={{ fontFamily: 'monospace', fontSize: '11px', lineHeight: 1, color: '#9ca3af', display: 'block' }}
                          className="group-hover:text-gray-500 transition-colors duration-200"
                        >+</span>
                      )}
                    </span>
                    <span
                      className={`text-[9px] uppercase tracking-[0.15em] transition-all duration-200 whitespace-nowrap ${
                        isActive ? 'font-semibold' : 'text-gray-400 group-hover:text-gray-600'
                      }`}
                      style={isActive ? { color: ACCENT } : {}}
                    >
                      {s.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </nav>
        </>,
        document.body
      )}

      <div className="relative overflow-visible max-w-5xl mx-auto border-l border-r border-t border-gray-200">
        <Plus h="left"  v="top" />
        <Plus h="right" v="top" />

        {/* ── Project Header ──────────────────────────────────────────── */}
        <div className="relative overflow-visible flex items-center justify-between px-6 md:px-10 py-4 border-b border-gray-200 bg-white">
          {/* App icon placeholder — replace with actual SkinSage logo when ready */}
          <div
            className="w-10 h-10 md:w-12 md:h-12 flex items-center justify-center overflow-hidden"
            style={{ background: 'white', borderRadius: '10px', boxShadow: 'inset 0 0 24px 8px rgba(48,152,255,0.35)' }}
          >
            <Image
              src="/images/WorkImages/skinSageImages/SS-logo-s.svg"
              alt="SkinSage logo"
              width={40}
              height={40}
              className="w-7 h-7 md:w-8 md:h-8 object-contain"
            />
          </div>
          <h1 className="text-2xl md:text-4xl font-light tracking-tight" style={{ fontFamily: 'SatishSans, sans-serif' }}>
            SkinSage
          </h1>
          <Image src="/images/common/sa26.svg" alt="SA" width={40} height={40} className="w-8 h-8 md:w-10 md:h-10 object-contain opacity-20" />
          <Plus h="left" />
          <Plus h="right" />
        </div>

        {/* ── Brief ───────────────────────────────────────────────────── */}
        <div id="ss-brief" className="relative overflow-visible border-b border-gray-200">

          <CaseMeta
            items={[
              { label: 'Company',     value: 'SkinSage' },
              { label: 'Role',        value: 'Product Designer' },
              { label: 'Deliverable', value: 'Zero to V1' },
            ]}
            scope={['UI/UX', 'Mobile', 'Responsive', 'Product Features']}
          />

          {/* SS-01 — full-width cover image */}
          <div className="w-full border-b border-gray-200">
            <Image
              src="/images/WorkImages/skinSageImages/SS-01B.png"
              alt="SkinSage cover"
              width={1600}
              height={900}
              className="w-full h-auto block"
            />
          </div>

          {/* Brief content — full width */}
          <div className="border-b border-gray-200 px-6 md:px-10 py-8 md:py-12">
            <SectionLabel>The Brief</SectionLabel>
            <SectionHeading>Your skin, understood. Your routine, built for you.</SectionHeading>
            <p className="text-sm text-gray-500 leading-relaxed mb-4" style={{ fontFamily: 'FunnelDisplay, sans-serif' }}>
              Most skincare advice is generic. SkinSage set out to change that by asking the right questions upfront and building a fully personalised routine from the answers. The brief was to design an experience that felt expert, not clinical, and personal, not overwhelming.
            </p>
            <p className="text-sm text-gray-500 leading-relaxed" style={{ fontFamily: 'FunnelDisplay, sans-serif' }}>
              Scope covered the onboarding assessment, personalised product recommendations, routine tracker, and the public-facing landing page. The focus was on clarity and trust at every step.
            </p>
          </div>

          {/* KPI strip */}
          <div className="flex flex-wrap md:flex-nowrap border-b border-gray-200">
            {stats.map((s, i) => (
              <div
                key={s.label}
                onMouseEnter={() => setHoveredStat(s.label)}
                onMouseLeave={() => setHoveredStat(null)}
                className={`flex-1 min-w-[33%] px-6 md:px-8 py-5 flex flex-col gap-1 transition-colors duration-200 ${i > 0 ? 'border-l border-gray-200' : ''}`}
                style={{ background: hoveredStat === s.label ? ACCENT : 'transparent' }}
              >
                <span
                  className="text-xl md:text-2xl font-light transition-colors duration-200"
                  style={{ fontFamily: 'SatishSans, sans-serif', color: hoveredStat === s.label ? 'white' : 'black' }}
                >
                  {s.value}
                </span>
                <span
                  className="text-[10px] uppercase tracking-widest transition-colors duration-200"
                  style={{ fontFamily: 'FunnelDisplay, sans-serif', color: hoveredStat === s.label ? 'rgba(255,255,255,0.85)' : '#9ca3af' }}
                >
                  {s.label}
                </span>
                <span
                  className="text-[10px] transition-colors duration-200"
                  style={{ fontFamily: 'FunnelDisplay, sans-serif', color: hoveredStat === s.label ? 'rgba(255,255,255,0.7)' : '#c4c4c4' }}
                >
                  {s.sub}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Skin Assessment / Onboarding ────────────────────────────── */}
        <div id="ss-02" className="relative border-b border-gray-200">
          <Plus h="left" v="top" />
          <Plus h="right" v="top" />

          <div className="px-6 md:px-10 pt-10 pb-6">
            <SectionLabel>Skin Assessment</SectionLabel>
            <SectionHeading>Know your skin before building your routine.</SectionHeading>
            <p className="text-sm text-gray-500 leading-relaxed" style={{ fontFamily: 'FunnelDisplay, sans-serif' }}>
              The assessment guides users through a short series of questions about their skin, lifestyle, and concerns. Based on the responses, SkinSage generates a skin health diagnosis. If an issue is detected, the app creates a case and surfaces the best-matched doctors on the platform for that specific condition.
            </p>
          </div>

          {/* SS-02 */}
          <div className="w-full border-t border-gray-200">
            <Image
              src="/images/WorkImages/skinSageImages/SS-02.png"
              alt="Skin assessment screens"
              width={1600}
              height={900}
              className="w-full h-auto block"
            />
          </div>

          {/* SS-03 */}
          <div className="w-full border-t border-gray-200">
            <Image
              src="/images/WorkImages/skinSageImages/SS-03.png"
              alt="SkinSage screen 03"
              width={1600}
              height={900}
              className="w-full h-auto block"
            />
          </div>

          {/* SS-04 */}
          <div id="ss-search" className="border-t border-gray-200 px-6 md:px-10 pt-10 pb-6">
            <SectionLabel>Search</SectionLabel>
            <SectionHeading>Find the right dermatologist in one pass.</SectionHeading>
            <p className="text-sm text-gray-500 leading-relaxed" style={{ fontFamily: 'FunnelDisplay, sans-serif' }}>
              Search across 100+ dermatologist-verified doctors. Filter by specialty, price per session, and availability to find the right fit.
            </p>
          </div>
          <div className="w-full">
            <Image
              src="/images/WorkImages/skinSageImages/SS-04.png"
              alt="SkinSage doctor search"
              width={1600}
              height={900}
              className="w-full h-auto block"
            />
          </div>

          {/* SS-05 */}
          <div id="ss-booking" className="border-t border-gray-200 px-6 md:px-10 pt-10 pb-6">
            <SectionLabel>Booking</SectionLabel>
            <SectionHeading>See the doctor, pick a time, done.</SectionHeading>
            <p className="text-sm text-gray-500 leading-relaxed" style={{ fontFamily: 'FunnelDisplay, sans-serif' }}>
              View a doctor's full profile, then book a session by selecting a date and time that works.
            </p>
          </div>
          <div className="w-full">
            <Image
              src="/images/WorkImages/skinSageImages/SS-05.png"
              alt="SkinSage doctor profile and booking"
              width={1600}
              height={900}
              className="w-full h-auto block"
            />
          </div>

          {/* SS-06 */}
          <div id="ss-checkout" className="border-t border-gray-200 px-6 md:px-10 pt-10 pb-6">
            <SectionLabel>Checkout</SectionLabel>
            <SectionHeading>Clear terms before anyone pays.</SectionHeading>
            <p className="text-sm text-gray-500 leading-relaxed" style={{ fontFamily: 'FunnelDisplay, sans-serif' }}>
              Checkout screen and terms confirmation before the session is confirmed.
            </p>
          </div>
          <div className="w-full">
            <Image
              src="/images/WorkImages/skinSageImages/SS-06.png"
              alt="SkinSage checkout and T&C"
              width={1600}
              height={900}
              className="w-full h-auto block"
            />
          </div>

          {/* SS-07 */}
          <div id="ss-appointment" className="border-t border-gray-200 px-6 md:px-10 pt-10 pb-6">
            <SectionLabel>Appointment</SectionLabel>
            <SectionHeading>The doctor walks in already briefed.</SectionHeading>
            <p className="text-sm text-gray-500 leading-relaxed" style={{ fontFamily: 'FunnelDisplay, sans-serif' }}>
              Your upcoming appointment, with a pre-consultation summary generated by AI to help the doctor prepare.
            </p>
          </div>
          <div className="w-full">
            <Image
              src="/images/WorkImages/skinSageImages/SS-07.png"
              alt="SkinSage appointment pre-consultation"
              width={1600}
              height={900}
              className="w-full h-auto block"
            />
          </div>

          {/* SS-08 */}
          <div id="ss-doctor" className="border-t border-gray-200 px-6 md:px-10 pt-10 pb-6">
            <SectionLabel>Doctor View</SectionLabel>
            <SectionHeading>The other side of the consultation.</SectionHeading>
            <p className="text-sm text-gray-500 leading-relaxed" style={{ fontFamily: 'FunnelDisplay, sans-serif' }}>
              The doctor's side: view patient appointments, record session outcomes, and track earnings.
            </p>
          </div>
          <div className="w-full">
            <Image
              src="/images/WorkImages/skinSageImages/SS-08.png"
              alt="SkinSage doctor dashboard"
              width={1600}
              height={900}
              className="w-full h-auto block"
            />
          </div>

          {/* SSL-1 & SSL-2 — Landing page */}
          <div id="ss-landing" className="border-t border-gray-200 px-6 md:px-10 pt-10 pb-6">
            <SectionLabel>Landing Page</SectionLabel>
            <SectionHeading>The product promise, in one scroll.</SectionHeading>
            <p className="text-sm text-gray-500 leading-relaxed" style={{ fontFamily: 'FunnelDisplay, sans-serif' }}>
              Landing page designed to communicate the product promise and convert visitors.
            </p>
          </div>
          <div className="w-full">
            <Image
              src="/images/WorkImages/skinSageImages/SSL-1.png"
              alt="SkinSage landing page 1"
              width={1600}
              height={900}
              className="w-full h-auto block"
            />
          </div>
          <div className="w-full border-t border-gray-200">
            <Image
              src="/images/WorkImages/skinSageImages/SSL-2.png"
              alt="SkinSage landing page 2"
              width={1600}
              height={900}
              className="w-full h-auto block"
            />
          </div>
        </div>

        {/* ── Design System ───────────────────────────────────────────── */}
        <div id="ss-ds" className="relative border-b border-gray-200">
          <Plus h="left" v="top" />
          <Plus h="right" v="top" />

          <div className="px-6 md:px-10 pt-10 pb-6">
            <SectionLabel>Design System</SectionLabel>
            <SectionHeading>Color and Type.</SectionHeading>
          </div>

          {/* Color */}
          <div className="px-6 md:px-10 pb-8">
            <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-5" style={{ fontFamily: 'FunnelDisplay, sans-serif' }}>Color</p>
            <div className="flex flex-wrap gap-3">
              {[
                { hex: '#3A7D7D' },
                { hex: '#5FA8A8' },
                { hex: '#A8D5CF' },
                { hex: '#D6EDE9' },
                { hex: '#152D3D' },
                { hex: '#4490D5' },
                { hex: '#82BBE8' },
                { hex: '#C0DCF3' },
                { hex: '#E3E3E3' },
              ].map((c) => (
                <div
                  key={c.hex}
                  className="flex items-center gap-3 px-3 py-2"
                  style={{ background: '#F9F9F7', border: '1px solid #E5E7EB', borderRadius: '999px' }}
                >
                  <span style={{ width: '28px', height: '28px', borderRadius: '50%', background: c.hex, display: 'block', flexShrink: 0 }} />
                  <span className="text-[11px] text-gray-500" style={{ fontFamily: 'monospace' }}>{c.hex}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Typography */}
          <div className="px-6 md:px-10 pb-10 border-t border-gray-200 pt-8">
            <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-8" style={{ fontFamily: 'FunnelDisplay, sans-serif' }}>Typography · Montserrat</p>
            <div className="flex flex-col divide-y divide-gray-100">
              {[
                { size: '2.5rem',  weight: 300, sample: 'Your skin, understood.',      label: 'Display',    usage: 'Landing page hero' },
                { size: '1.75rem', weight: 400, sample: 'Build your routine.',          label: 'Heading 1',  usage: 'Screen titles' },
                { size: '1.25rem', weight: 500, sample: 'Skin Assessment',              label: 'Heading 2',  usage: 'Section & card headers' },
                { size: '1rem',    weight: 400, sample: 'Answer a few quick questions.', label: 'Body',       usage: 'Descriptions, onboarding copy' },
                { size: '0.875rem',weight: 500, sample: 'View Doctor Profile',          label: 'Button',     usage: 'CTAs, action labels' },
                { size: '0.75rem', weight: 400, sample: 'Available today · 3 slots',    label: 'Caption',    usage: 'Meta info, availability tags' },
                { size: '0.625rem',weight: 600, sample: 'DERMATOLOGIST',                label: 'Label',      usage: 'Badges, specialty chips', upper: true },
              ].map((t) => (
                <div key={t.label} className="flex items-baseline justify-between gap-4 py-4 flex-wrap md:flex-nowrap">
                  <p
                    className="text-gray-800 flex-1 min-w-0"
                    style={{
                      fontFamily: 'Montserrat, sans-serif',
                      fontSize: t.size,
                      fontWeight: t.weight,
                      textTransform: t.upper ? 'uppercase' : undefined,
                      letterSpacing: t.upper ? '0.12em' : undefined,
                      lineHeight: 1.2,
                    }}
                  >
                    {t.sample}
                  </p>
                  <div className="flex items-center gap-4 shrink-0 mt-1 md:mt-0">
                    <span className="text-[10px] uppercase tracking-widest text-gray-400 w-20 text-right hidden md:block" style={{ fontFamily: 'FunnelDisplay, sans-serif' }}>{t.label}</span>
                    <span className="text-[11px] text-gray-400 w-44 text-right" style={{ fontFamily: 'FunnelDisplay, sans-serif' }}>{t.usage}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
