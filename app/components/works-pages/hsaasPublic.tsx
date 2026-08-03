"use client";

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';

const ACCENT = '#1F9E6F';

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

export default function HsaasPublic() {
  const [mounted, setMounted] = useState(false);
  const [activeSection, setActiveSection] = useState('hs-brief');
  const [hoveredStat, setHoveredStat] = useState<string | null>(null);
  const onboardingScrollRef = useRef<HTMLDivElement>(null);
  const [onboardingSlide, setOnboardingSlide] = useState(0);
  const reviewScrollRef = useRef<HTMLDivElement>(null);
  const [reviewSlide, setReviewSlide] = useState(0);

  const scrollOnboarding = (dir: number) => {
    const el = onboardingScrollRef.current; if (!el) return;
    const next = onboardingSlide + dir;
    if (next < 0 || next > 1) return;
    el.scrollTo({ left: next * el.offsetWidth, behavior: 'smooth' });
    setOnboardingSlide(next);
  };

  const sections = [
    { id: 'hs-brief', label: 'Overview' },
    { id: 'hs-02',    label: 'Onboarding' },

    { id: 'hs-05',    label: 'Channel Store' },
    { id: 'hs-06',    label: 'Channel Dashboard' },
    { id: 'hs-08',    label: 'Landing Page' },
    { id: 'hs-ds',    label: 'Design System' },
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
    { value: '$350+', label: 'MRR', sub: 'Within weeks of launch' },
    { value: '3 Weeks',  label: 'Turnaround', sub: 'From first session to V1 live' },
    { value: '96%',     label: 'Onboarding Completion Rate', sub: '' },
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
          <div
            className="w-10 h-10 md:w-12 md:h-12 flex items-center justify-center overflow-hidden"
            style={{ background: '#1F9E6F', borderRadius: '10px' }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.6" strokeLinecap="round" className="w-6 h-6 md:w-7 md:h-7" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </div>
          <h1 className="text-2xl md:text-4xl font-light tracking-tight" style={{ fontFamily: 'SatishSans, sans-serif' }}>
            Healthcare SaaS
          </h1>
          <Image src="/images/common/sa26.svg" alt="SA" width={40} height={40} className="w-8 h-8 md:w-10 md:h-10 object-contain opacity-20" />
          <Plus h="left" />
          <Plus h="right" />
        </div>

        {/* ── Project Meta ────────────────────────────────────────────── */}
        <div id="hs-brief" className="relative overflow-visible border-b border-gray-200">
          <div className="relative flex flex-wrap md:flex-nowrap items-stretch gap-0 border-b border-gray-200">
            {[
              { label: 'Company',     value: 'Confidential, US' },
              { label: 'Role',        value: 'Product Designer' },
              { label: 'Deliverable', value: 'Zero to V1' },
            ].map((item, i) => (
              <div key={item.label} className={`flex items-center gap-2 px-6 md:px-8 py-3 ${i === 1 ? 'border-l border-gray-200' : ''} ${i === 2 ? 'w-full md:w-auto border-t md:border-t-0 md:border-l border-gray-200' : ''}`}>
                <span className="text-[9px] uppercase tracking-widest text-gray-400 shrink-0" style={{ fontFamily: 'FunnelDisplay, sans-serif' }}>{item.label}</span>
                <span className="text-[11px] text-gray-700" style={{ fontFamily: 'FunnelDisplay, sans-serif' }}>{item.value}</span>
              </div>
            ))}
            <div className="flex items-center gap-2 w-full md:w-auto pl-6 md:pl-8 pr-6 py-3 border-t md:border-t-0 md:border-l border-gray-200">
              <span className="text-[9px] uppercase tracking-widest text-gray-400 shrink-0" style={{ fontFamily: 'FunnelDisplay, sans-serif' }}>Scope</span>
              <div className="flex gap-2">
                {['End to End Product UI/UX', 'Logo Design', 'Visual Design'].map((tag) => (
                  <span key={tag} className="text-[9px] px-2 py-0.5 border border-gray-200 text-gray-500 whitespace-nowrap" style={{ fontFamily: 'FunnelDisplay, sans-serif' }}>{tag}</span>
                ))}
              </div>
            </div>
          </div>

          {/* Hero image — edge to edge */}
          <div className="relative overflow-visible border-b border-gray-200">
            <Image
              src="/images/WorkImages/hsaasImages/hs-hero.png"
              alt="Healthcare SaaS product design"
              width={2000}
              height={900}
              className="w-full h-auto object-cover"
            />
          </div>

          {/* Overview — full width brief */}
          <div className="px-6 md:px-10 py-6 md:py-8">
            <SectionLabel>The Brief</SectionLabel>
            <SectionHeading>One profile. Everywhere patients search.</SectionHeading>
            <p className="text-sm text-gray-500 leading-relaxed" style={{ fontFamily: 'FunnelDisplay, sans-serif' }}>
              This is a subscription SaaS built for independent US physicians: doctors who are clinically excellent but completely invisible online.
              Most solo practitioners have no presence across the 40+ platforms patients use to find care, and the manual fix is brutal. Create an account on each platform, upload credentials, write a bio. Dozens of hours they don&apos;t have, repeated every time something changes.
              <br /><br />
              The co-founder came in with a clear problem and a one-line brief: let a doctor fill out one form, and handle everything else on their behalf. Every listing, every update, every patient inquiry forwarded to their inbox.
              <br /><br />
              I was brought in to design the entire product from scratch. In three weeks I delivered the full onboarding flow, credential verification, a channel distribution marketplace, and subscription and pricing UI. The scope covered what the doctor interacts with directly: building their profile, selecting their channels, and managing their plan. Inbox and patient inquiry tracking are out of scope for V1. All incoming messages are forwarded straight to the doctor&apos;s email, so no in-app messaging surface was needed. End-to-end product design, logo mark, and visual identity. Shipped as V1.
            </p>
          </div>
        </div>


        {/* ── KPI strip ───────────────────────────────────────────────── */}
        <div className="relative border-b border-gray-200">
          <div className="grid grid-cols-3">
            {stats.map((s, i) => {
              const hovered = hoveredStat === s.value;
              return (
                <div
                  key={s.value}
                  className="relative overflow-hidden cursor-default"
                  style={{ borderRight: i < stats.length - 1 ? '1px solid #e5e7eb' : 'none' }}
                  onMouseEnter={() => setHoveredStat(s.value)}
                  onMouseLeave={() => setHoveredStat(null)}
                >
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      background: 'radial-gradient(ellipse 160% 120% at 50% 120%, rgba(31,158,111,0.18) 0%, transparent 70%)',
                      opacity: hovered ? 1 : 0,
                      transition: 'opacity 0.25s ease',
                    }}
                  />
                  <div className="relative px-6 md:px-8 py-4 md:py-5">
                    <p
                      className="text-2xl md:text-3xl font-light mb-0.5 transition-colors duration-200"
                      style={{ fontFamily: 'SatishSans, sans-serif', color: hovered ? ACCENT : '#111' }}
                    >
                      {s.value}
                    </p>
                    <p className="text-[9px] uppercase tracking-widest text-gray-400 mb-1" style={{ fontFamily: 'FunnelDisplay, sans-serif' }}>{s.label}</p>
                    <p className="text-[10px] text-gray-400" style={{ fontFamily: 'FunnelDisplay, sans-serif' }}>{s.sub}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Onboarding ──────────────────────────────────────────────── */}
        <div id="hs-02" className="relative overflow-visible border-b border-gray-200">
          <Plus h="left"  v="top" />
          <Plus h="right" v="top" />
          <div className="px-6 md:px-10 py-4 md:py-6">
            <SectionLabel>Onboarding Flow</SectionLabel>
            <SectionHeading>A doctor fills out one profile. We take it everywhere.</SectionHeading>
          </div>
          <div className="border-t border-gray-200">
            <Image
              src="/images/WorkImages/hsaasImages/hs-form.png"
              alt="basic information form"
              width={1600}
              height={900}
              className="w-full h-auto object-cover"
            />
          </div>
          <div className="border-t border-gray-200 px-6 md:px-10 py-4 md:py-5">
            <p className="text-xs text-gray-400 leading-relaxed" style={{ fontFamily: 'FunnelDisplay, sans-serif' }}>
              Doctors fill in their license details, insurance types, and specialty step by step. Each section is simple and focused, so nothing feels overwhelming.
            </p>
          </div>
          <div className="relative border-t border-gray-200">
            {/* Left button — outside left border */}
            <button
              onClick={() => scrollOnboarding(-1)}
              disabled={onboardingSlide === 0}
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-9 h-9 flex items-center justify-center z-10 transition-all duration-200 rounded-[4px]"
              style={{
                left: 0,
                background: onboardingSlide === 0 ? 'white' : ACCENT,
                color: onboardingSlide === 0 ? '#d1d5db' : 'white',
                border: `1.5px solid ${onboardingSlide === 0 ? '#d1d5db' : ACCENT}`,
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            {/* Right button — outside right border */}
            <button
              onClick={() => scrollOnboarding(1)}
              disabled={onboardingSlide === 1}
              className="absolute top-1/2 -translate-y-1/2 translate-x-1/2 w-9 h-9 flex items-center justify-center z-10 transition-all duration-200 rounded-[4px]"
              style={{
                right: 0,
                background: onboardingSlide === 1 ? 'white' : ACCENT,
                color: onboardingSlide === 1 ? '#d1d5db' : 'white',
                border: `1.5px solid ${onboardingSlide === 1 ? '#d1d5db' : ACCENT}`,
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
            <div
              ref={onboardingScrollRef}
              className="overflow-x-hidden"
              style={{ scrollbarWidth: 'none' }}
            >
              <div className="flex">
                <Image
                  src="/images/WorkImages/hsaasImages/hs-profile-1.png"
                  alt="onboarding profile creation"
                  width={1200}
                  height={800}
                  className="h-auto block w-full flex-shrink-0"
                />
                <Image
                  src="/images/WorkImages/hsaasImages/hs-profile-2.png"
                  alt="service selection"
                  width={1200}
                  height={800}
                  className="h-auto block w-full flex-shrink-0"
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── Onboarding cont. — Review + Submitted ───────────────────── */}
        <div className="relative overflow-visible border-b border-gray-200">
          <Plus h="left"  v="top" />
          <Plus h="right" v="top" />
          <div className="px-6 md:px-10 py-4 md:py-5">
            <p className="text-xs text-gray-400 leading-relaxed" style={{ fontFamily: 'FunnelDisplay, sans-serif' }}>
              Once all sections are done, the doctor reviews everything in one place before submitting. After submission, the operations team verifies the profile within 48 hours.
            </p>
          </div>
          <div className="relative border-t border-gray-200">
            {/* Left button */}
            <button
              onClick={() => {
                const el = reviewScrollRef.current; if (!el) return;
                const next = reviewSlide - 1; if (next < 0) return;
                el.scrollTo({ left: next * el.offsetWidth, behavior: 'smooth' });
                setReviewSlide(next);
              }}
              disabled={reviewSlide === 0}
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-9 h-9 flex items-center justify-center z-10 transition-all duration-200 rounded-[4px]"
              style={{
                left: 0,
                background: reviewSlide === 0 ? 'white' : ACCENT,
                color: reviewSlide === 0 ? '#d1d5db' : 'white',
                border: `1.5px solid ${reviewSlide === 0 ? '#d1d5db' : ACCENT}`,
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            {/* Right button */}
            <button
              onClick={() => {
                const el = reviewScrollRef.current; if (!el) return;
                const next = reviewSlide + 1; if (next > 1) return;
                el.scrollTo({ left: next * el.offsetWidth, behavior: 'smooth' });
                setReviewSlide(next);
              }}
              disabled={reviewSlide === 1}
              className="absolute top-1/2 -translate-y-1/2 translate-x-1/2 w-9 h-9 flex items-center justify-center z-10 transition-all duration-200 rounded-[4px]"
              style={{
                right: 0,
                background: reviewSlide === 1 ? 'white' : ACCENT,
                color: reviewSlide === 1 ? '#d1d5db' : 'white',
                border: `1.5px solid ${reviewSlide === 1 ? '#d1d5db' : ACCENT}`,
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
            <div ref={reviewScrollRef} className="overflow-x-hidden" style={{ scrollbarWidth: 'none' }}>
              <div className="flex">
                <Image src="/images/WorkImages/hsaasImages/hs-profile-3.png" alt="profile review" width={1200} height={800} className="h-auto block w-full flex-shrink-0" />
                <Image src="/images/WorkImages/hsaasImages/hs-profile-4.png" alt="profile submitted" width={1200} height={800} className="h-auto block w-full flex-shrink-0" />
              </div>
            </div>
          </div>
        </div>

        {/* ── Channel Store ────────────────────────────────────────────── */}
        <div id="hs-05" className="relative overflow-visible border-b border-gray-200">
          <Plus h="left"  v="top" />
          <Plus h="right" v="top" />
          <div className="px-6 md:px-10 py-4 md:py-6">
            <SectionLabel>Channel Store</SectionLabel>
            <SectionHeading>The product&apos;s most distinctive screen.</SectionHeading>
          </div>
          <div className="border-t border-gray-200">
            <Image
              src="/images/WorkImages/hsaasImages/hs-channel-store.png"
              alt="Channel Store — Standard, Premium, Upcoming tiers"
              width={2000}
              height={1200}
              className="w-full h-auto object-cover"
            />
          </div>
        </div>

        {/* ── Subscriptions ───────────────────────────────────────────── */}
        <div id="hs-06" className="relative overflow-visible border-b border-gray-200">
          <Plus h="left"  v="top" />
          <Plus h="right" v="top" />
          <div className="px-6 md:px-10 py-4 md:py-6">
            <SectionLabel>Channel Dashboard</SectionLabel>
            <SectionHeading>Pick your channels. We handle the rest.</SectionHeading>
            <p className="text-xs text-gray-400 leading-relaxed max-w-2xl" style={{ fontFamily: 'FunnelDisplay, sans-serif' }}>
              Choose a plan, select the channels you want to appear on, and the platform creates your profiles across each one automatically, sending you a live link for each as it goes live.
            </p>
          </div>
          <div className="border-t border-gray-200">
            <Image
              src="/images/WorkImages/hsaasImages/hs-pricing.png"
              alt="subscription and pricing plans"
              width={2000}
              height={1200}
              className="w-full h-auto object-cover"
            />
          </div>
        </div>

        {/* ── Dashboard ───────────────────────────────────────────────── */}
        <div id="hs-07" className="relative overflow-visible border-b border-gray-200">
          <Plus h="left"  v="top" />
          <Plus h="right" v="top" />
          <div className="px-6 md:px-10 flex items-center" style={{ minHeight: '80px' }}>
            <SectionLabel>Subscription UI</SectionLabel>
          </div>
          <div className="border-t border-gray-200">
            <Image
              src="/images/WorkImages/hsaasImages/hs-dashboard.png"
              alt="post-signup dashboard"
              width={2000}
              height={1200}
              className="w-full h-auto object-cover"
            />
          </div>
        </div>

        {/* ── Marketing Site ──────────────────────────────────────────── */}
        <div id="hs-08" className="relative overflow-visible border-b border-gray-200">
          <Plus h="left"  v="top" />
          <Plus h="right" v="top" />
          <div className="px-6 md:px-10 py-4 md:py-6">
            <SectionLabel>Landing Page</SectionLabel>
            <SectionHeading>A landing page that explains the product and gets doctors to sign up.</SectionHeading>
          </div>
          <div className="border-t border-gray-200">
            <Image
              src="/images/WorkImages/hsaasImages/hs-landing.png"
              alt="marketing site"
              width={2000}
              height={1200}
              className="w-full h-auto object-cover"
            />
          </div>
        </div>

        {/* ── Design System ───────────────────────────────────────────── */}
        <div id="hs-ds" className="relative overflow-visible border-b border-gray-200">
          <Plus h="left"  v="top" />
          <Plus h="right" v="top" />
          <div className="px-6 md:px-10 py-4 md:py-6">
            <SectionLabel>Design System</SectionLabel>
            <SectionHeading>Color and Type.</SectionHeading>
          </div>

          {/* Colour palette */}
          <div className="border-t border-gray-200 px-6 md:px-10 py-6 md:py-8">
            <p className="text-[9px] uppercase tracking-widest text-gray-400 mb-5" style={{ fontFamily: 'CarmenSans, sans-serif' }}>Colour Palette</p>
            <div className="flex flex-wrap gap-3">
              {[
                { hex: '#1F9E6F', name: 'Primary Green' },
                { hex: '#145C42', name: 'Deep Green'  },
                { hex: '#F0FAF5', name: 'Mint Tint'   },
                { hex: '#111111', name: 'Near Black'  },
                { hex: '#6B7280', name: 'Body Grey'   },
                { hex: '#F4F4F0', name: 'Surface'     },
                { hex: '#FFFFFF', name: 'White'       },
              ].map((c) => (
                <div
                  key={c.hex}
                  className="flex items-center gap-3 px-3 py-2"
                  style={{
                    background: '#F9F9F7',
                    border: '1px solid #E5E7EB',
                    borderRadius: '999px',
                  }}
                >
                  <span
                    className="shrink-0"
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      background: c.hex,
                      border: c.hex === '#FFFFFF' || c.hex === '#F4F4F0' || c.hex === '#F0FAF5' ? '1px solid #E5E7EB' : 'none',
                      display: 'block',
                    }}
                  />
                  <span
                    className="text-xs tracking-wide whitespace-nowrap text-gray-600"
                    style={{ fontFamily: 'monospace' }}
                  >
                    {c.hex}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Typography */}
          <div className="border-t border-gray-200 px-6 md:px-10 py-6 md:py-8">
            <p className="text-[9px] uppercase tracking-widest text-gray-400 mb-6" style={{ fontFamily: 'CarmenSans, sans-serif' }}>Typography</p>
            <p className="text-4xl md:text-5xl font-light leading-tight text-black" style={{ fontFamily: 'CarmenSans, sans-serif' }}>Carmen Sans</p>
            <p className="text-base text-gray-400 mt-3" style={{ fontFamily: 'CarmenSans, sans-serif', letterSpacing: '0.12em' }}>
              ABCDEFGHIJKLMNOPQRSTUVWXYZ &nbsp;&nbsp; abcdefghijklmnopqrstuvwxyz &nbsp;&nbsp; 0123456789
            </p>
          </div>

          {/* Type scale */}
          <div className="border-t border-gray-200 px-6 md:px-10 py-6 md:py-8">
            <p className="text-[9px] uppercase tracking-widest text-gray-400 mb-5" style={{ fontFamily: 'FunnelDisplay, sans-serif' }}>Type Scale</p>
            <div className="flex flex-col gap-4">
              {[
                { label: 'H1',    size: 'text-5xl',                          sample: 'Grow your practice',          tracking: '-0.02em' },
                { label: 'H2',    size: 'text-3xl',                          sample: 'One profile. Everywhere.',     tracking: '-0.01em' },
                { label: 'Body',  size: 'text-sm',                           sample: 'Built for independent US physicians who need to be visible across every platform patients use to find care.', tracking: '0em' },
              ].map((t) => (
                <div key={t.label} className="flex items-baseline gap-6">
                  <span className="text-[9px] uppercase tracking-widest text-gray-300 w-10 shrink-0" style={{ fontFamily: 'CarmenSans, sans-serif' }}>{t.label}</span>
                  <p
                    className={`${t.size} font-light text-black leading-snug`}
                    style={{ fontFamily: 'CarmenSans, sans-serif', letterSpacing: t.tracking }}
                  >
                    {t.sample}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <Plus h="left"  v="bottom" />
        <Plus h="right" v="bottom" />
      </div>
    </div>
  );
}
