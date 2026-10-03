"use client";

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import CaseMeta from './CaseMeta';

const ACCENT = '#4E6CFF';

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

export default function SkillRadius() {
  const [mounted, setMounted] = useState(false);
  const [activeSection, setActiveSection] = useState('sr-brief');

  const sections = [
    { id: 'sr-brief',     label: 'Overview' },
    { id: 'sr-course',    label: 'Course' },
    { id: 'sr-lessons',   label: 'Lessons' },
    { id: 'sr-notes',     label: 'Notes' },
    { id: 'sr-quiz',      label: 'Quiz' },
    { id: 'sr-dashboard', label: 'Dashboard' },
    { id: 'sr-auth',      label: 'Auth' },
    { id: 'sr-logo',      label: 'Logo' },
    { id: 'sr-ds',        label: 'Design System' },
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
          <div className="w-10 h-10 md:w-12 md:h-12 flex items-center justify-center overflow-hidden">
            <Image
              src="/images/WorkImages/skillradius/SR-logo.svg"
              alt="SkillRadius logo"
              width={48}
              height={48}
              className="w-full h-full object-contain"
            />
          </div>
          <h1 className="text-2xl md:text-4xl font-light tracking-tight" style={{ fontFamily: 'SatishSans, sans-serif' }}>
            SkillRadius
          </h1>
          <Image src="/images/common/sa26.svg" alt="SA" width={40} height={40} className="w-8 h-8 md:w-10 md:h-10 object-contain opacity-20" />
          <Plus h="left" />
          <Plus h="right" />
        </div>

        {/* ── Brief ───────────────────────────────────────────────────── */}
        <div id="sr-brief" className="relative overflow-visible border-b border-gray-200">

          <CaseMeta
            items={[
              { label: 'Company',     value: 'SkillRadius' },
              { label: 'Role',        value: 'Product Designer' },
              { label: 'Deliverable', value: 'Zero to V1' },
            ]}
            scope={['UI/UX Design', 'Visual Design', 'Logo Design']}
            status="Ongoing Project"
          />

          {/* SR-01 — full-width cover */}
          <div className="w-full border-b border-gray-200">
            <Image
              src="/images/WorkImages/skillradius/SR-01.png"
              alt="SkillRadius cover"
              width={1600}
              height={900}
              className="w-full h-auto block"
            />
          </div>

          {/* Brief content */}
          <div className="px-6 md:px-10 py-8 md:py-12">
            <SectionLabel>The Brief</SectionLabel>
            <SectionHeading>An LMS where the structure of every lesson is the guarantee that you will actually master the skill.</SectionHeading>
            <p className="text-sm text-gray-500 leading-relaxed mb-4" style={{ fontFamily: 'FunnelDisplay, sans-serif' }}>
              Most learning platforms are built around content volume. SkillRadius is built around outcomes. The platform targets college students and early-career job seekers who need to learn a real, in-demand skill end-to-end, not just watch a few videos and hope for the best.
            </p>
            <p className="text-sm text-gray-500 leading-relaxed" style={{ fontFamily: 'FunnelDisplay, sans-serif' }}>
              The brief covered the full student experience: course discovery, structured lesson modules (video, notes, and quiz), progress tracking, and a public landing page. Certifications and a proctored exam platform are in progress and not included in this case study.
            </p>
          </div>
        </div>

        {/* ── Course Details & Enrolment (SR-02) ──────────────────────── */}
        <div id="sr-course" className="relative border-b border-gray-200">
          <Plus h="left" v="top" />
          <Plus h="right" v="top" />
          <div className="px-6 md:px-10 pt-10 pb-6">
            <SectionLabel>Course Details</SectionLabel>
            <SectionHeading>Everything you will learn, before you pay.</SectionHeading>
            <p className="text-sm text-gray-500 leading-relaxed" style={{ fontFamily: 'FunnelDisplay, sans-serif' }}>
              The course detail page reflects what you will learn, resources available in the course, certification details, all module and subunit breakdowns, and instructor info. Enrolment is integrated with Razorpay.
            </p>
          </div>
          <div className="w-full">
            <Image
              src="/images/WorkImages/skillradius/SR-02.png"
              alt="SkillRadius course details and enrolment"
              width={1600}
              height={900}
              className="w-full h-auto block"
            />
          </div>
        </div>

        {/* ── Video Lessons (SR-03) ────────────────────────────────────── */}
        <div id="sr-lessons" className="relative border-b border-gray-200">
          <Plus h="left" v="top" />
          <Plus h="right" v="top" />
          <div className="px-6 md:px-10 pt-10 pb-6">
            <SectionLabel>Video Lessons</SectionLabel>
            <SectionHeading>Master one module, then the next.</SectionHeading>
            <p className="text-sm text-gray-500 leading-relaxed" style={{ fontFamily: 'FunnelDisplay, sans-serif' }}>
              Each module is a complete unit combining video lessons, notes, resources, and a quiz. The quiz at the end of every module validates what the learner just covered, so they master one module fully before moving to the next. No skipping ahead, no gaps.
            </p>
          </div>
          <div className="w-full">
            <Image
              src="/images/WorkImages/skillradius/SR-03.png"
              alt="SkillRadius video lessons structure"
              width={1600}
              height={900}
              className="w-full h-auto block"
            />
          </div>
        </div>

        {/* ── Notes (SR-04) ────────────────────────────────────────────── */}
        <div id="sr-notes" className="relative border-b border-gray-200">
          <Plus h="left" v="top" />
          <Plus h="right" v="top" />
          <div className="px-6 md:px-10 pt-10 pb-6">
            <SectionLabel>Notes</SectionLabel>
            <SectionHeading>Read it instead of rewatching it.</SectionHeading>
            <p className="text-sm text-gray-500 leading-relaxed" style={{ fontFamily: 'FunnelDisplay, sans-serif' }}>
              Notes lesson view. Written content alongside the video so students can read, reference, and revisit key concepts without rewatching.
            </p>
          </div>
          <div className="w-full">
            <Image
              src="/images/WorkImages/skillradius/SR-04.png"
              alt="SkillRadius notes lesson"
              width={1600}
              height={900}
              className="w-full h-auto block"
            />
          </div>
        </div>

        {/* ── Quiz (SR-05) ─────────────────────────────────────────────── */}
        <div id="sr-quiz" className="relative border-b border-gray-200">
          <Plus h="left" v="top" />
          <Plus h="right" v="top" />
          <div className="px-6 md:px-10 pt-10 pb-6">
            <SectionLabel>Quiz</SectionLabel>
            <SectionHeading>Every module ends with proof.</SectionHeading>
            <p className="text-sm text-gray-500 leading-relaxed" style={{ fontFamily: 'FunnelDisplay, sans-serif' }}>
              End-of-module quiz to reinforce and validate what was just learned. Immediate feedback keeps students engaged rather than guessing.
            </p>
          </div>
          <div className="w-full">
            <Image
              src="/images/WorkImages/skillradius/SR-05.png"
              alt="SkillRadius quiz"
              width={1600}
              height={900}
              className="w-full h-auto block"
            />
          </div>
        </div>

        {/* ── Dashboard (SR-06) ────────────────────────────────────────── */}
        <div id="sr-dashboard" className="relative border-b border-gray-200">
          <Plus h="left" v="top" />
          <Plus h="right" v="top" />
          <div className="px-6 md:px-10 pt-10 pb-6">
            <SectionLabel>Dashboard</SectionLabel>
            <SectionHeading>How far you have come, and what is left.</SectionHeading>
            <p className="text-sm text-gray-500 leading-relaxed" style={{ fontFamily: 'FunnelDisplay, sans-serif' }}>
              Student dashboard showing enrolled courses, completion progress, and upcoming modules. A clear view of how far you have come and what is left.
            </p>
          </div>
          <div className="w-full">
            <Image
              src="/images/WorkImages/skillradius/SR-06.png"
              alt="SkillRadius student dashboard"
              width={1600}
              height={900}
              className="w-full h-auto block"
            />
          </div>
        </div>

        {/* ── Auth artwork (SR-07 + SR-08) ─────────────────────────────── */}
        <div id="sr-auth" className="relative border-b border-gray-200">
          <Plus h="left" v="top" />
          <Plus h="right" v="top" />
          <div className="px-6 md:px-10 pt-10 pb-6">
            <SectionLabel>Sign Up and Login</SectionLabel>
            <SectionHeading>A welcome, not a form.</SectionHeading>
            <p className="text-sm text-gray-500 leading-relaxed" style={{ fontFamily: 'FunnelDisplay, sans-serif' }}>
              Auth screens with custom artwork. Sign up and login designed to feel welcoming rather than transactional.
            </p>
          </div>
          <div className="w-full">
            <Image
              src="/images/WorkImages/skillradius/SR-07.png"
              alt="SkillRadius auth artwork"
              width={1600}
              height={900}
              className="w-full h-auto block"
            />
          </div>
          <div className="w-full border-t border-gray-200">
            <Image
              src="/images/WorkImages/skillradius/SR-08.png"
              alt="SkillRadius auth screens"
              width={1600}
              height={900}
              className="w-full h-auto block"
            />
          </div>
        </div>

        {/* ── Logo (SR-09) ─────────────────────────────────────────────── */}
        <div id="sr-logo" className="relative border-b border-gray-200">
          <Plus h="left" v="top" />
          <Plus h="right" v="top" />
          <div className="px-6 md:px-10 pt-8 pb-4">
            <SectionLabel>Logo Design</SectionLabel>
            <SectionHeading>A radius that points up.</SectionHeading>
            <p className="text-sm text-gray-500 leading-relaxed" style={{ fontFamily: 'FunnelDisplay, sans-serif' }}>
              The mark is built on a circle, the geometric form of a radius, anchoring the brand name in shape. Within it, the negative space traces an R, but the stem breaks into an upward arrow, a trajectory rather than a letter. The circle is never closed at the top: a deliberate opening that reads as potential, not completion. Together the form says the same thing the platform does: you are somewhere on the radius of your skill, and the direction is up.
            </p>
          </div>
          <div className="w-full">
            <Image
              src="/images/WorkImages/skillradius/SR-09.png"
              alt="SkillRadius logo design"
              width={1600}
              height={900}
              className="w-full h-auto block"
            />
          </div>
        </div>

        {/* ── Design System ───────────────────────────────────────────── */}
        <div id="sr-ds" className="relative border-b border-gray-200">
          <Plus h="left" v="top" />
          <Plus h="right" v="top" />

          <div className="px-6 md:px-10 pt-10 pb-6">
            <SectionLabel>Design System</SectionLabel>
            <SectionHeading>Color and Type.</SectionHeading>
          </div>

          {/* Color */}
          <div className="px-6 md:px-10 pb-8">
            <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-5" style={{ fontFamily: 'FunnelDisplay, sans-serif' }}>Color</p>
            <div className="flex flex-wrap gap-3 justify-center">
              {[
                { hex: '#3C5AC7' },
                { hex: '#6D83D9' },
                { hex: '#9FAEEA' },
                { hex: '#D1D8F4' },
                { hex: '#FFFFFF' },
                { hex: '#000000' },
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
            <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-8" style={{ fontFamily: 'FunnelDisplay, sans-serif' }}>Typography · Instrument Sans</p>
            <div className="flex flex-col divide-y divide-gray-100">
              {[
                { size: '2.5rem',   mobileSize: '1.5rem',   weight: 600, sample: 'Learn the skill. Get the job.',      label: 'Display',   usage: 'Landing page hero' },
                { size: '1.75rem',  mobileSize: '1.25rem',  weight: 500, sample: 'Your Courses',                       label: 'Heading 1', usage: 'Screen & page titles' },
                { size: '1.25rem',  mobileSize: '1.1rem',   weight: 500, sample: 'Module 3: Advanced Hooks',           label: 'Heading 2', usage: 'Section & card headers' },
                { size: '1rem',     mobileSize: '0.9rem',   weight: 400, sample: 'Pick up where you left off.',        label: 'Body',      usage: 'Descriptions, lesson copy' },
                { size: '0.875rem', mobileSize: '0.875rem', weight: 500, sample: 'Enroll Now',                         label: 'Button',    usage: 'CTAs and action labels' },
                { size: '0.75rem',  mobileSize: '0.75rem',  weight: 400, sample: '12 lessons · 4.5 hrs · Beginner',   label: 'Caption',   usage: 'Course meta and tags' },
                { size: '0.625rem', mobileSize: '0.625rem', weight: 600, sample: 'CERTIFICATION IN PROGRESS',         label: 'Label',     usage: 'Badges, status chips', upper: true },
              ].map((t) => (
                <div key={t.label} className="flex items-baseline justify-between gap-4 py-4 flex-wrap md:flex-nowrap">
                  <p
                    className="text-gray-800 flex-1 min-w-0"
                    style={{
                      fontFamily: 'InstrumentSans, sans-serif',
                      fontSize: `clamp(${t.mobileSize}, 3vw, ${t.size})`,
                      fontWeight: t.weight,
                      textTransform: t.upper ? 'uppercase' : undefined,
                      letterSpacing: t.upper ? '0.12em' : undefined,
                      lineHeight: 1.3,
                    }}
                  >
                    {t.sample}
                  </p>
                  <div className="flex items-center gap-4 shrink-0 mt-1 md:mt-0">
                    <span className="text-[10px] uppercase tracking-widest text-gray-400 w-20 text-right hidden md:block" style={{ fontFamily: 'FunnelDisplay, sans-serif' }}>{t.label}</span>
                    <span className="text-[11px] text-gray-400 md:w-44 text-right" style={{ fontFamily: 'FunnelDisplay, sans-serif' }}>{t.usage}</span>
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
