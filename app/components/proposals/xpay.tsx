"use client";

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, useInView } from 'framer-motion';

const TEAL = '#1D9E75';
const TEAL_DARK = '#085041';
const TEAL_LIGHT = '#E1F5EE';

// ── Proposal navbar ───────────────────────────────────────────────────────────

function ProposalNav() {
  return (
    <nav
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        background: 'rgba(255,255,255,0.92)',
        backdropFilter: 'blur(8px)',
        borderBottom: '1px solid #f0f0f0',
        height: 48,
      }}
    >
      <div
        style={{
          maxWidth: 740,
          margin: '0 auto',
          padding: '0 clamp(20px, 5vw, 40px)',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <a
            href="/"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 28,
              height: 28,
              border: '1px solid #ddd',
              borderRadius: 6,
              color: '#111',
              textDecoration: 'none',
              transition: 'border-color 0.15s',
              flexShrink: 0,
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.borderColor = '#111'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.borderColor = '#ddd'; }}
            aria-label="Back"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
          <span className="xpay-nav-label">
            Product Designer / Application
          </span>
        </div>
        <a
          href="/"
          style={{
            fontSize: 12,
            fontWeight: 500,
            color: '#111',
            textDecoration: 'none',
            border: '1px solid #ddd',
            borderRadius: 6,
            padding: '5px 14px',
            letterSpacing: '0.01em',
            whiteSpace: 'nowrap',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            transition: 'border-color 0.15s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.borderColor = '#111'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.borderColor = '#ddd'; }}
        >
          <img src="/images/common/sa26-filled.svg" alt="" style={{ width: 14, height: 14, display: 'block', flexShrink: 0 }} />
          View my portfolio
        </a>
      </div>
    </nav>
  );
}

// ── Scroll progress bar ────────────────────────────────────────────────────────

function ScrollProgressBar() {
  const barRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const bar = barRef.current;
    if (!bar) return;
    let ticking = false;
    const update = () => {
      const total = document.documentElement.scrollHeight - window.innerHeight;
      const pct = total > 0 ? (window.scrollY / total) * 100 : 0;
      bar.style.width = `${pct}%`;
      ticking = false;
    };
    const handler = () => {
      if (!ticking) {
        requestAnimationFrame(update);
        ticking = true;
      }
    };
    window.addEventListener('scroll', handler, { passive: true });
    // Double rAF + timeout: rAF catches fast paints, timeout catches slow ones
    // (images, fonts) that inflate scrollHeight after the initial render.
    requestAnimationFrame(() => requestAnimationFrame(update));
    const t = setTimeout(update, 300);
    return () => { window.removeEventListener('scroll', handler); clearTimeout(t); };
  }, []);
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 3, zIndex: 9999, background: 'transparent' }}>
      <div
        ref={barRef}
        style={{
          height: '100%',
          width: '0%',
          background: 'linear-gradient(to right, #00FFFF 0%, #15E89D 50%, #56FFA1 76%, #04E573 100%)',
        }}
      />
    </div>
  );
}

// ── Section divider (* * *) ────────────────────────────────────────────────────

function DividerBreak() {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        gap: 16,
        padding: '40px 0 48px',
      }}
    >
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{ width: 4, height: 4, borderRadius: '50%', background: '#d1d5db' }}
        />
      ))}
    </div>
  );
}

// ── Shared primitives ──────────────────────────────────────────────────────────

const SectionLabel = ({ children, strong = false }: { children: React.ReactNode; strong?: boolean }) => (
  <p
    style={{
      fontFamily: 'FunnelDisplay, sans-serif',
      fontSize: strong ? 11 : 10,
      textTransform: 'uppercase',
      letterSpacing: '0.1em',
      color: strong ? '#4b5563' : '#9ca3af',
      fontWeight: strong ? 500 : 400,
      marginBottom: 12,
    }}
  >
    {children}
  </p>
);

const SectionHeading = ({ children }: { children: React.ReactNode }) => (
  <h2
    style={{
      fontFamily: 'SatishSans, sans-serif',
      fontSize: 'clamp(22px, 4vw, 28px)',
      fontWeight: 400,
      lineHeight: 1.35,
      color: '#111',
      marginBottom: 28,
    }}
  >
    {children}
  </h2>
);

function FadeIn({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  return (
    <motion.div
      ref={ref}
      initial={{ y: 20, opacity: 0 }}
      animate={inView ? { y: 0, opacity: 1 } : {}}
      transition={{ duration: 0.6, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      {children}
    </motion.div>
  );
}

// ── Status bar (shared) ────────────────────────────────────────────────────────

function PhoneStatusBar({ dark = false }: { dark?: boolean }) {
  const fg = dark ? '#e5e7eb' : '#1a1a1a';
  const pillBg = dark ? '#2d2d2d' : '#0d0d0d';
  return (
    <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px 8px', flexShrink: 0 }}>
      <span style={{ fontFamily: 'system-ui, sans-serif', fontSize: '11px', fontWeight: 600, color: fg }}>9:41</span>
      {/* Pill centered absolutely so it's always in the middle regardless of side widths */}
      <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', top: 12, width: 80, height: 22, background: pillBg, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#555' }} />
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: dark ? '#444' : '#222' }} />
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <svg width="12" height="8" viewBox="0 0 12 8" fill="none">
          <rect x="0" y="4" width="2" height="4" rx="0.5" fill={fg} opacity="0.5"/>
          <rect x="3" y="2.5" width="2" height="5.5" rx="0.5" fill={fg} opacity="0.6"/>
          <rect x="6" y="1" width="2" height="7" rx="0.5" fill={fg} opacity="0.7"/>
          <rect x="9" y="0" width="2" height="8" rx="0.5" fill={fg} opacity="0.9"/>
        </svg>
        <svg width="14" height="10" viewBox="0 0 24 18" fill="none">
          <path d="M12 4.5C14.8 4.5 17.3 5.6 19.2 7.4L21 5.6C18.7 3.4 15.5 2 12 2S5.3 3.4 3 5.6L4.8 7.4C6.7 5.6 9.2 4.5 12 4.5Z" fill={fg} opacity="0.5"/>
          <path d="M12 8.5C13.9 8.5 15.6 9.3 16.8 10.6L18.6 8.8C16.9 7.1 14.6 6 12 6S7.1 7.1 5.4 8.8L7.2 10.6C8.4 9.3 10.1 8.5 12 8.5Z" fill={fg} opacity="0.7"/>
          <path d="M12 12.5C13 12.5 13.9 12.9 14.5 13.6L16.3 11.8C15.2 10.7 13.7 10 12 10S8.8 10.7 7.7 11.8L9.5 13.6C10.1 12.9 11 12.5 12 12.5Z" fill={fg} opacity="0.9"/>
          <circle cx="12" cy="16" r="1.5" fill={fg}/>
        </svg>
        <svg width="18" height="10" viewBox="0 0 22 11" fill="none">
          <rect x="0.5" y="0.5" width="18" height="10" rx="2.5" stroke={fg} strokeOpacity="0.5" strokeWidth="1"/>
          <rect x="2" y="2" width="14" height="7" rx="1.5" fill={fg}/>
          <path d="M20 3.5V7.5C20.8 7.2 21.5 6.2 21.5 5.5C21.5 4.8 20.8 3.8 20 3.5Z" fill={fg} opacity="0.5"/>
        </svg>
      </div>
    </div>
  );
}

// ── Phone frame shell ──────────────────────────────────────────────────────────

function PhoneFrame({
  children,
  glowColor,
  maxWidth = 270,
}: {
  children: React.ReactNode;
  glowColor?: string;
  maxWidth?: number;
}) {
  return (
    <div
      style={{
        background: '#0d0d0d',
        borderRadius: '52px',
        maxWidth,
        width: '100%',
        padding: '10px',
        boxShadow: glowColor
          ? `0 28px 56px ${glowColor}33, 0 8px 20px rgba(0,0,0,0.18)`
          : '0 20px 40px rgba(0,0,0,0.12)',
      }}
    >
      <div
        style={{
          borderRadius: '44px',
          overflow: 'hidden',
          height: 540,
          display: 'flex',
          flexDirection: 'column',
          background: '#ffffff',
        }}
      >
        {children}
      </div>
    </div>
  );
}

// ── Email copy button ──────────────────────────────────────────────────────────

function EmailCopyButton() {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText('satishdezn@gmail.com');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={copy}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7,
        fontFamily: 'FunnelDisplay, sans-serif',
        fontSize: 13,
        fontWeight: 500,
        color: copied ? TEAL : '#111',
        border: `1px solid ${copied ? TEAL + '60' : '#e5e7eb'}`,
        borderRadius: 10,
        padding: '10px 16px',
        background: copied ? TEAL_LIGHT : '#fff',
        cursor: 'pointer',
        transition: 'all 0.15s',
        outline: 'none',
      }}
    >
      {copied ? (
        <>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 6l3 3 5-5" stroke={TEAL} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Copied!
        </>
      ) : (
        <>
          satishdezn@gmail.com
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
            <rect x="9" y="9" width="13" height="13" rx="2" stroke="#9ca3af" strokeWidth="1.8"/>
            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" stroke="#9ca3af" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
        </>
      )}
    </button>
  );
}

// ── BEFORE phone ───────────────────────────────────────────────────────────────

function BeforePhone() {
  const body = { fontFamily: 'FunnelDisplay, system-ui, sans-serif' };
  return (
    <div className="flex flex-col items-center gap-4">
      <SectionLabel>Current experience</SectionLabel>
      <PhoneFrame>
        <div style={{ background: '#f6f6f6', flexShrink: 0 }}>
          <PhoneStatusBar />
        </div>
        <div
          style={{
            flex: 1,
            background: '#f6f6f6',
            padding: '14px 16px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            filter: 'saturate(0.3)',
          }}
        >
          <div style={{ borderBottom: '1px solid #ddd', paddingBottom: 12 }}>
            <img
              src="/images/proposals/Xpay/Xpay-bw-logo.png"
              alt="xPay"
              style={{ height: 18, width: 'auto', display: 'block', marginBottom: 8 }}
            />
            <div style={{ ...body, fontSize: 15, fontWeight: 600, color: '#444', marginBottom: 3 }}>
              Installment Payment
            </div>
            <div style={{ ...body, fontSize: 10, color: '#aaa', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Confirm your order
            </div>
          </div>
          <div style={{ background: '#ececec', borderRadius: 10, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 9 }}>
            {[
              { label: 'Order total', value: '₹12,000' },
              { label: 'Plan', value: '6 months' },
              { label: 'First charge today', value: '₹2,000' },
            ].map(({ label, value }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ ...body, fontSize: 11, color: '#777' }}>{label}</span>
                <span style={{ ...body, fontSize: 11, fontWeight: 600, color: '#444' }}>{value}</span>
              </div>
            ))}
          </div>
          <div style={{ background: '#e4e4e4', borderRadius: 8, padding: '10px 12px' }}>
            <div style={{ ...body, fontSize: 9.5, color: '#aaa', lineHeight: 1.5 }}>
              An authorization hold of ₹10,000 will be placed on your card as per the applicable payment terms and conditions.
            </div>
          </div>
          <div style={{ flex: 1 }} />
          <div style={{ background: '#c0c0c0', borderRadius: 9999, padding: '13px', textAlign: 'center' }}>
            <span style={{ ...body, fontSize: 13, fontWeight: 600, color: '#fff' }}>Confirm Payment</span>
          </div>
        </div>
      </PhoneFrame>
      <p
        style={{
          fontFamily: 'FunnelDisplay, sans-serif',
          fontSize: 11,
          color: '#bbb',
          fontStyle: 'italic',
          textAlign: 'center',
          maxWidth: 220,
          lineHeight: 1.5,
        }}
      >
        Authorization hold buried in fine print. Customer has no context.
      </p>
    </div>
  );
}

// ── AFTER phone ────────────────────────────────────────────────────────────────

function AfterPhone() {
  const body = { fontFamily: 'FunnelDisplay, system-ui, sans-serif' };
  return (
    <div className="flex flex-col items-center gap-4">
      <SectionLabel>What I'd ship</SectionLabel>
      <motion.div
        style={{ width: '100%', display: 'flex', justifyContent: 'center' }}
        initial={{ y: 16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.7, delay: 0.15, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
        <PhoneFrame glowColor={TEAL}>
          <div style={{ background: '#fff', flexShrink: 0 }}>
            <PhoneStatusBar />
          </div>
          <div
            style={{
              flex: 1,
              background: '#fff',
              padding: '12px 16px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              overflowY: 'auto',
            }}
          >
            {/* Header — logo left, secure badge right */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <img
                src="/images/proposals/Xpay/xpay-logo.webp"
                alt="xPay"
                style={{ height: 16, width: 'auto', display: 'block' }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <svg width="9" height="10" viewBox="0 0 24 26" fill="none">
                  <rect x="2" y="10" width="20" height="14" rx="3" stroke="#9ca3af" strokeWidth="2" />
                  <path d="M7 10V7a5 5 0 0110 0v3" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" />
                </svg>
                <span style={{ ...body, fontSize: 9, color: '#9ca3af' }}>Secure checkout</span>
              </div>
            </div>

            {/* Page title */}
            <div>
              <div style={{ ...body, fontSize: 16, fontWeight: 700, color: '#111', lineHeight: 1.2 }}>Confirm your plan</div>
              <div style={{ ...body, fontSize: 10, color: '#9ca3af', marginTop: 2 }}>Review before completing your purchase</div>
            </div>

            {/* Order summary */}
            <div style={{ background: '#f8f9fa', borderRadius: 10, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { label: 'Order total', value: '₹12,000' },
                { label: 'Plan selected', value: '6 months' },
              ].map(({ label, value }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ ...body, fontSize: 11, color: '#6b7280' }}>{label}</span>
                  <span style={{ ...body, fontSize: 11, fontWeight: 600, color: '#111' }}>{value}</span>
                </div>
              ))}
              <div style={{ height: 1, background: '#e5e7eb' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ ...body, fontSize: 11, color: '#6b7280' }}>Monthly EMI</span>
                <span style={{ ...body, fontSize: 12, fontWeight: 700, color: TEAL }}>₹2,000 / month</span>
              </div>
            </div>

            {/* Charge breakdown label */}
            <div style={{ ...body, fontSize: 9, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Today's charge
            </div>

            {/* Charged today */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: -4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: TEAL_LIGHT, borderRadius: 10, border: `1px solid ${TEAL}30` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={TEAL} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <path d="M9 12.75 11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 0 1-1.043 3.296 3.745 3.745 0 0 1-3.296 1.043A3.745 3.745 0 0 1 12 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 0 1-3.296-1.043 3.745 3.745 0 0 1-1.043-3.296A3.745 3.745 0 0 1 3 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 0 1 1.043-3.296 3.746 3.746 0 0 1 3.296-1.043A3.746 3.746 0 0 1 12 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 0 1 3.296 1.043 3.746 3.746 0 0 1 1.043 3.296A3.745 3.745 0 0 1 21 12Z" />
                  </svg>
                  <span style={{ ...body, fontSize: 11, fontWeight: 600, color: TEAL_DARK }}>Charged today</span>
                </div>
                <span style={{ ...body, fontSize: 13, fontWeight: 700, color: TEAL_DARK }}>₹2,000</span>
              </div>
              {/* Auth hold card with embedded explanation */}
              <div style={{ borderRadius: 10, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: '#fafafa' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                      <path d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                    </svg>
                    <span style={{ ...body, fontSize: 11, color: '#6b7280' }}>Auth hold (released after EMI 1)</span>
                  </div>
                  <span style={{ ...body, fontSize: 13, fontWeight: 600, color: '#374151' }}>₹10,000</span>
                </div>
                <div style={{ background: TEAL_LIGHT, padding: '8px 12px', display: 'flex', gap: 7, alignItems: 'flex-start' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
                    <circle cx="12" cy="12" r="10" stroke={TEAL} strokeWidth="2" />
                    <path d="M12 8v4M12 16h.01" stroke={TEAL} strokeWidth="2.2" strokeLinecap="round" />
                  </svg>
                  <p style={{ ...body, fontSize: 10, color: TEAL_DARK, lineHeight: 1.5, margin: 0 }}>
                    This hold is a security check, not a charge. It releases automatically after your first EMI settles.
                  </p>
                </div>
              </div>
            </div>

            {/* CTA */}
            <div style={{ marginTop: 'auto' }}>
              <div style={{ background: 'linear-gradient(to right, #00C8C8 0%, #0DBF82 50%, #30CC78 76%, #02A85F 100%)', borderRadius: 9999, padding: '13px', textAlign: 'center' }}>
                <span style={{ ...body, fontSize: 14, fontWeight: 600, color: '#fff', letterSpacing: '0.01em' }}>
                  Confirm payment
                </span>
              </div>
            </div>
          </div>
        </PhoneFrame>
      </motion.div>
      <p
        style={{
          fontFamily: 'FunnelDisplay, sans-serif',
          fontSize: 11,
          color: '#9ca3af',
          fontStyle: 'italic',
          textAlign: 'center',
          maxWidth: 220,
          lineHeight: 1.5,
        }}
      >
        Plain language at the right moment. Customer understands. Payment goes through.
      </p>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

const bodyText: React.CSSProperties = {
  fontFamily: 'FunnelDisplay, sans-serif',
  fontSize: 18,
  color: '#292929',
  lineHeight: 1.68,
};

export default function XPayProposal() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    const prevDoc = document.documentElement.style.background;
    const prevBody = document.body.style.background;
    document.documentElement.style.background = 'white';
    document.body.style.background = 'white';

    return () => {
      document.documentElement.style.background = prevDoc;
      document.body.style.background = prevBody;
    };
  }, []);

  return (
    <div className="bg-white min-h-screen">
      <style>{`
        .xpay-hero-row { display: flex; align-items: center; justify-content: space-between; gap: 24px; }
        .xpay-coin { width: 220px; height: auto; flex-shrink: 0; display: block; }
        .xpay-byline { display: flex; align-items: center; gap: 10px; flex-wrap: nowrap; }
        .xpay-byline-meta { display: flex; align-items: center; flex-wrap: wrap; gap: 2px 6px; }
        .xpay-contact-row { display: flex; gap: 12px; justify-content: space-between; }
        .xpay-nav-label { font-size: 11px; font-weight: 500; letter-spacing: 0.08em; color: #888; text-transform: uppercase; white-space: nowrap; }
        @media (max-width: 600px) {
          .xpay-hero-row { flex-direction: column-reverse; align-items: flex-start; gap: 16px; }
          .xpay-coin { display: none !important; }
          .xpay-byline { flex-wrap: wrap; gap: 8px; }
          .xpay-byline-meta { gap: 2px 4px; }
          .xpay-contact-row { flex-direction: column; gap: 10px; }
          .xpay-nav-label { display: none; }
        }
      `}</style>
      {mounted && createPortal(
        <>
          <ProposalNav />
          <ScrollProgressBar />
        </>,
        document.body
      )}
      {mounted && <div
        style={{
          maxWidth: 740,
          margin: '0 auto',
          padding: 'clamp(80px, 10vw, 120px) clamp(20px, 5vw, 40px) 80px',
        }}
      >

        {/* ── 1. HEADER ─────────────────────────────────────────────────── */}
        <header style={{ marginBottom: 64 }}>
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            <div className="xpay-hero-row">
              {/* Left: text */}
              <div style={{ flex: 1 }}>
                {/* Company name */}
                <img
                  src="/images/proposals/Xpay/xpay-logo.webp"
                  alt="xPay"
                  style={{ height: 40, width: 'auto', marginBottom: 16, display: 'block' }}
                />

                {/* Subtitle */}
                <p
                  style={{
                    fontFamily: 'FunnelDisplay, sans-serif',
                    fontSize: 'clamp(16px, 4vw, 20px)',
                    color: '#6b7280',
                    lineHeight: 1.5,
                    marginBottom: 32,
                    maxWidth: 480,
                  }}
                >
                  A problem I found in your product.<br />And what I'd ship to fix it.
                </p>

                {/* Byline — Medium style */}
                <div className="xpay-byline">
              <img
                src="/images/common/satish-avatar.webp"
                alt="Satish Hebbal"
                style={{
                  outline: '0.5px solid rgb(173, 173, 173)',
                  outlineOffset: 0,
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  objectFit: 'cover',
                  flexShrink: 0,
                }}
              />
              <div className="xpay-byline-meta">
                <span style={{ fontFamily: 'FunnelDisplay, sans-serif', fontSize: 13, color: '#111', fontWeight: 500 }}>
                  Satish Hebbal
                </span>
                <span style={{ fontFamily: 'FunnelDisplay, sans-serif', fontSize: 13, color: '#9ca3af' }}>·</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="#9ca3af" style={{ width: 13, height: 13, flexShrink: 0 }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
                  </svg>
                  <span style={{ fontFamily: 'FunnelDisplay, sans-serif', fontSize: 13, color: '#9ca3af' }}>Apr 13, 2026</span>
                </span>
                <span style={{ fontFamily: 'FunnelDisplay, sans-serif', fontSize: 13, color: '#9ca3af' }}>·</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="#9ca3af" style={{ width: 13, height: 13, flexShrink: 0 }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
                  </svg>
                  <span style={{ fontFamily: 'FunnelDisplay, sans-serif', fontSize: 13, color: '#9ca3af' }}>3 min read</span>
                </span>
              </div>
            </div>{/* end byline */}
              </div>{/* end left text */}

              {/* Right: coin image */}
              <img
                src="/images/proposals/Xpay/coin-xpay.webp"
                alt=""
                className="xpay-coin"
              />
            </div>{/* end hero flex row */}

            {/* Rule below header */}
            <div style={{ height: 1, background: '#f0f0f0', marginTop: 32 }} />
          </motion.div>
        </header>

        {/* ── 2. THE PROBLEM ────────────────────────────────────────────── */}
        <section id="xp-problem" style={{ marginBottom: 0, scrollMarginTop: 80 }}>
          <FadeIn>
            <SectionLabel>The problem</SectionLabel>
            <SectionHeading>
              Card Installments creates a support ticket before the payment even settles.
            </SectionHeading>

            <p style={{ ...bodyText, marginBottom: 28 }}>
              xPay's own documentation lists "<a href="https://docs.xpaycheckout.com/faqs/x-pay-card-installments" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'underline', textDecorationColor: '#1D9E75' }}>I see a large pending charge on my card</a>" as a recurring customer complaint.
            </p>
            <p style={{ ...bodyText, marginBottom: 28 }}>
              When a customer picks Card Installments, xPay places an authorization hold on the full remaining balance while only charging the first installment. The customer sees a large mysterious hold on their bank app, panics, and either calls their bank or raises a dispute.
            </p>

            {/* Screenshot */}
            <figure style={{ margin: '40px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <div style={{
                  background: 'linear-gradient(to bottom, #111 0%, transparent 100%)',
                  padding: 5,
                  borderRadius: '32px 32px 0 0',
                  maxWidth: 320,
                  width: '100%',
                }}>
                  <img
                    src="/images/proposals/Xpay/Xpay-problem-screenshot.png"
                    alt="Bank app showing two pending charges with no explanation"
                    style={{ width: '100%', borderRadius: '27px 27px 0 0', display: 'block' }}
                  />
                </div>
              </div>
              <figcaption
                style={{
                  fontFamily: 'FunnelDisplay, sans-serif',
                  fontSize: 13,
                  color: '#9ca3af',
                  fontStyle: 'italic',
                  textAlign: 'center',
                  marginTop: 12,
                  lineHeight: 1.5,
                }}
              >
                What the customer actually sees: two pending charges, no explanation.
              </figcaption>
            </figure>

            <p style={{ ...bodyText, marginBottom: 0 }}>
              A successful payment becomes a chargeback. The problem isn't the mechanic. It's the silence around it.
            </p>
          </FadeIn>
        </section>

        <DividerBreak />

        {/* ── 3 & 4. BEFORE / AFTER ─────────────────────────────────────── */}
        <section id="xp-screens" style={{ marginBottom: 0, scrollMarginTop: 80 }}>
          <FadeIn>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '48px 40px',
                justifyItems: 'center',
                alignItems: 'start',
              }}
            >
              <BeforePhone />
              <AfterPhone />
            </div>
          </FadeIn>
        </section>

        <DividerBreak />

        {/* ── 5. REASONING ──────────────────────────────────────────────── */}
        <section id="xp-reasoning" style={{ marginBottom: 0, scrollMarginTop: 80 }}>

          {/* Reason 1 */}
          <FadeIn>
            <div style={{ marginBottom: 48 }}>
              <SectionLabel strong>Why this screen exists</SectionLabel>
              <p style={bodyText}>
                The authorization hold mechanic is technically necessary: card networks require it to guarantee the full balance is collectable before splitting payments. But it's completely invisible to the customer. That gap between what xPay does and what the customer understands is where support cost lives. One screen, placed at the right moment, closes it.
              </p>
            </div>
          </FadeIn>

          {/* Reason 2 */}
          <FadeIn delay={0.05}>
            <div style={{ marginBottom: 48 }}>
              <SectionLabel strong>Why plain language over legal copy</SectionLabel>
              <p style={bodyText}>
                The current notice likely says "authorization hold", a term most consumers don't know and don't trust. Replacing it with "security check that releases automatically" removes the anxiety without removing the accuracy. The bank still sees the hold. The customer stops panicking. No legal change required.
              </p>
            </div>
          </FadeIn>

          {/* Reason 3 */}
          <FadeIn delay={0.1}>
            <div>
              <SectionLabel strong>The business case</SectionLabel>
              <p style={bodyText}>
                Fewer disputes means a lower chargeback rate, which means better standing with card networks. Higher EMI conversion because customers aren't scared off at the final step. This one screen sits at the intersection of revenue and ops cost. It's not a UX fix for its own sake.
              </p>
            </div>
          </FadeIn>
        </section>

        {/* ── After business case image ─────────────────────────────────── */}
        <FadeIn>
          <figure style={{ margin: '48px 0 0' }}>
            <img
              src="/images/proposals/Xpay/xpay-banner.webp"
              loading="lazy"
              decoding="async"
              width={1600}
              height={434}
              alt="xPay product detail"
              style={{ width: '100%', height: 'auto', borderRadius: 12 }}
            />
          </figure>
        </FadeIn>

        <div style={{ height: 48 }} />

        {/* ── 6. CLOSING ────────────────────────────────────────────────── */}
        <section id="xp-closing" style={{ scrollMarginTop: 80 }}>
          <FadeIn>
            <p
              style={{
                fontFamily: 'SatishSans, sans-serif',
                fontSize: 'clamp(18px, 5vw, 22px)',
                color: '#111',
                marginBottom: 10,
                lineHeight: 1.3,
              }}
            >
              This is how I think about product problems.
            </p>
            <p
              style={{
                fontFamily: 'FunnelDisplay, sans-serif',
                fontSize: 17,
                color: '#9ca3af',
                marginBottom: 36,
                lineHeight: 1.6,
              }}
            >
              If it resonates, I'm applying for the Product Designer role at xPay.
            </p>
            <div className="xpay-contact-row">
              {/* Email button with copy */}
              <EmailCopyButton />
              {/* LinkedIn button */}
              <a
                href="https://www.linkedin.com/in/satish-hebbal/"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 7,
                  fontFamily: 'FunnelDisplay, sans-serif',
                  fontSize: 13,
                  fontWeight: 500,
                  color: '#111',
                  textDecoration: 'none',
                  border: '1px solid #e5e7eb',
                  borderRadius: 10,
                  padding: '10px 16px',
                  transition: 'border-color 0.15s, background 0.15s',
                  background: '#fff',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#0a66c2'; e.currentTarget.style.background = '#fafafa'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.background = '#fff'; }}
              >
                <img src="/images/HomeImages/social/linkedin.svg" alt="LinkedIn" style={{ width: 14, height: 14, display: 'block' }} />
                LinkedIn
              </a>

              {/* Portfolio link button */}
              <a
                href="https://satishhebbal.design"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 7,
                  fontFamily: 'FunnelDisplay, sans-serif',
                  fontSize: 13,
                  fontWeight: 500,
                  color: '#111',
                  textDecoration: 'none',
                  border: '1px solid #e5e7eb',
                  borderRadius: 10,
                  padding: '10px 16px',
                  transition: 'border-color 0.15s, background 0.15s',
                  background: '#fff',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#111'; e.currentTarget.style.background = '#fafafa'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.background = '#fff'; }}
              >
                satishhebbal.design
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                  <path d="M2 10L10 2M10 2H4M10 2V8" stroke="#111" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </a>
            </div>
          </FadeIn>
        </section>

      </div>}
    </div>
  );
}

