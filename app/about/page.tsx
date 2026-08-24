"use client";

import Image from "next/image";
import { useState } from "react";

const companies: {
  src: string;
  name: string;
  year: string;
  shadow: string;
  tags: { label: string; rotate: number; x: number }[];
}[] = [
  { src: "/images/inAbout/Abhi.svg",       name: "Abhiyantrik",  year: "2025",           shadow: "rgba(99, 102, 241, 0.22)",  tags: [{ label: "IoT", rotate: -9, x: -26 }, { label: "Smart Home", rotate: 6, x: 28 }] },
  { src: "/images/inAbout/hsaas.svg",      name: "Healthcare SaaS", year: "2025-26",    shadow: "rgba(52, 211, 153, 0.28)",  tags: [{ label: "SaaS", rotate: -7, x: -26 }, { label: "Health", rotate: 5, x: 30 }] },
  { src: "/images/inAbout/SS.svg",         name: "SkinSage",     year: "2026",           shadow: "rgba(34, 197, 94, 0.28)",   tags: [{ label: "AI", rotate: -6, x: -24 }, { label: "MedTech", rotate: 8, x: 30 }] },
  { src: "/images/inAbout/fuellstack.svg", name: "Fuellstack",   year: "2025 - Present", shadow: "rgba(220, 88, 20, 0.25)",   tags: [{ label: "Design/Dev Agency", rotate: -7, x: 0 }] },
  { src: "/images/inAbout/LV.svg",         name: "LogicVeda",    year: "2025",           shadow: "rgba(109, 84, 224, 0.25)",  tags: [{ label: "EdTech", rotate: 7, x: 0 }] },
  { src: "/images/inAbout/Storuage.svg",   name: "Storuage",     year: "2025 - Present", shadow: "rgba(245, 158, 11, 0.28)",  tags: [{ label: "IoT", rotate: -6, x: -28 }, { label: "Smart Kitchen", rotate: 5, x: 34 }] },
  { src: "/images/inAbout/Wagwan.svg",     name: "Wagwan",       year: "2025-26",        shadow: "rgba(239, 68, 68, 0.25)",   tags: [{ label: "Social", rotate: -7, x: -22 }, { label: "Events", rotate: 6, x: 24 }] },
];

export default function About() {
  const [hovered, setHovered] = useState<number | null>(null);
  const [imageHovered, setImageHovered] = useState(false);
  const [logoHovered, setLogoHovered] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText('satishdezn@gmail.com');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-white min-h-screen pt-24 pb-12" style={{ fontFamily: "FunnelDisplay, sans-serif" }}>
    <style>{`
      @keyframes football-spin {
        from { transform: rotate(0deg); }
        to   { transform: rotate(360deg); }
      }
      @keyframes key-click {
        0%, 100% { transform: scale(1); }
        10%       { transform: scale(0.65); }
        22%       { transform: scale(1.1); }
        30%       { transform: scale(1); }
      }
      @keyframes saw-motion {
        0%   { transform: translateY(0px) rotate(0deg); }
        50%  { transform: translateY(-11px) rotate(5deg); }
        100% { transform: translateY(0px) rotate(0deg); }
      }
      @keyframes pen-sway {
        0%   { transform: translateX(-8px); }
        50%  { transform: translateX(8px); }
        100% { transform: translateX(-8px); }
      }
      @keyframes brush-tilt {
        0%   { transform: rotate(-10deg); }
        50%  { transform: rotate(42deg); }
        100% { transform: rotate(-10deg); }
      }
    `}</style>
    <style>{`
      @media (max-width: 767px) {
        .himg-pen    { top: -16px !important; left: 10px !important; right: auto !important; }
        .himg-enter  { top: 2px !important; right: 10px !important; left: auto !important; }
        .himg-tab    { top: 2px !important; right: 48px !important; left: auto !important; }
        .himg-ball   { top: calc(44% - 20px) !important; left: 10px !important; right: auto !important; }
        .himg-saw    { top: calc(70% - 20px) !important; right: 10px !important; left: auto !important; }
        .himg-brush  { bottom: 10px !important; left: 10px !important; right: auto !important; }
      }
    `}</style>
      <div className="max-w-3xl mx-auto px-6 md:px-10">

        {/* ── Logo ─────────────────────────────────────────────── */}
        <div className="mb-6 mt-2 flex justify-center md:hidden">
        <div style={{ position: "relative", display: "inline-block" }}>
          <Image
            src="/images/HomeImages/Satish-logo-kannada.svg"
            alt="Satish in Kannada"
            width={70}
            height={26}
            style={{
              opacity: logoHovered ? 0 : 1,
              transition: "opacity 0.15s ease",
              position: "relative",
              filter: "brightness(0) opacity(0.5)",
            }}
          />
          <Image
            src="/images/HomeImages/satish-logo-english.svg"
            alt="Satish"
            width={70}
            height={26}
            style={{
              opacity: logoHovered ? 1 : 0,
              transition: "opacity 0.15s ease",
              position: "absolute",
              top: 0,
              left: 0,
              filter: "brightness(0) opacity(0.5)",
            }}
          />
        </div>
        </div>

        {/* ── Section 1: intro + photo ─────────────────────────── */}
        <div className="flex flex-col md:flex-row md:items-end gap-10 md:gap-16 mb-10">
          <div className="flex-1 order-2 md:order-1">
            <p
              className="text-2xl md:text-3xl leading-snug text-gray-800 mb-6"
              style={{ fontFamily: "SatishSans, serif", fontWeight: 400 }}
            >
              I'm a designer who partners with startups and takes full ownership of the work.
            </p>
            <p className="text-base text-gray-500 leading-relaxed">
              Not just the screens, but the thinking, the decisions, and the execution. I come in early, when things are undefined, and stay until they ship.
            </p>
          </div>

          <div
            className="flex-shrink-0 flex justify-center md:justify-end md:pt-4 order-1 md:order-2"
            style={{ position: "relative" }}
            onMouseEnter={() => setImageHovered(true)}
            onMouseLeave={() => setImageHovered(false)}
            onClick={() => setLogoHovered(prev => !prev)}
          >
            {/* Text chips */}
            {[
              { label: "UI/UX Designer",      top: "28px",   left: "5px",    rotate: -8,  delay: 0,    duration: "0.55s" },
              { label: "Developer",           top: "28px",   right: "5px",   rotate: 5,   delay: 0.07, duration: "0.45s" },
              { label: "Vibe Coder",          top: "48px",   right: "8px",   rotate: -4,  delay: 0.09, duration: "0.5s"  },
              { label: "Attacking Midfielder",top: "48%",    left: "-8px",   rotate: -6,  delay: 0.12, duration: "0.6s"  },
              { label: "Carpenter",           top: "70%",    right: "-6px",  rotate: -7,  delay: 0.05, duration: "0.5s"  },
              { label: "Craftsman",           top: "79%",    right: "-2px",  rotate: 5,   delay: 0.06, duration: "0.52s" },
              { label: "Artist",              bottom: "-20px",left: "15px",   rotate: -5,  delay: 0.1,  duration: "0.48s" },
            ].map((chip, i) => (
              <div
                key={`chip-${i}`}
                style={{
                  position: "absolute",
                  top: chip.top, bottom: chip.bottom,
                  left: chip.left, right: chip.right,
                  transform: `rotate(${chip.rotate}deg) scale(${imageHovered ? 1 : 0.2})`,
                  opacity: imageHovered ? 1 : 0,
                  transition: `transform ${chip.duration} cubic-bezier(0.34, 1.56, 0.64, 1) ${chip.delay}s, opacity 0.18s ease ${chip.delay}s`,
                  background: "white",
                  border: "1px solid #e5e7eb",
                  borderRadius: "20px",
                  padding: "4px 10px",
                  fontSize: "11px",
                  fontFamily: "FunnelDisplay, sans-serif",
                  color: "#374151",
                  whiteSpace: "nowrap",
                  pointerEvents: "none",
                  boxShadow: "0 2px 10px rgba(0,0,0,0.09)",
                  zIndex: 10,
                }}
              >
                {chip.label}
              </div>
            ))}

            {/* Floating images — each near its related chip */}
            {[
              {
                src: "/images/satish-image-hover-images/pen-tool.png",
                size: 34, top: "16px", left: "-36px", rotate: -14, delay: 0.04, duration: "0.6s",
                animation: "pen-sway 1.6s ease-in-out infinite", cls: "himg-pen",
              },
              {
                src: "/images/satish-image-hover-images/enter-button.png",
                size: 32, top: "16px", right: "-36px", rotate: 8, delay: 0.03, duration: "0.42s",
                animation: "key-click 2.2s ease-in-out infinite", cls: "himg-enter",
              },
              {
                src: "/images/satish-image-hover-images/TAB-button.png",
                size: 30, top: "40px", right: "-38px", rotate: -6, delay: 0.06, duration: "0.5s",
                animation: "key-click 2.2s ease-in-out 1.1s infinite", cls: "himg-tab",
              },
              {
                src: "/images/satish-image-hover-images/football.png",
                size: 38, top: "44%", left: "-44px", rotate: 0, delay: 0.09, duration: "0.55s",
                animation: "football-spin 3s linear infinite", cls: "himg-ball",
              },
              {
                src: "/images/satish-image-hover-images/wood-saw.png",
                size: 36, top: "68%", right: "-42px", rotate: 0, delay: 0.07, duration: "0.58s",
                animation: "saw-motion 0.38s ease-in-out infinite", cls: "himg-saw",
              },
              {
                src: "/images/satish-image-hover-images/burshes.png",
                size: 36, bottom: "-28px", left: "-24px", rotate: 0, delay: 0.11, duration: "0.52s",
                animation: "brush-tilt 1.1s ease-in-out infinite", cls: "himg-brush",
              },
            ].map((img, i) => (
              <div
                key={`img-${i}`}
                className={img.cls}
                style={{
                  position: "absolute",
                  top: img.top, bottom: img.bottom,
                  left: img.left, right: img.right,
                  transform: `rotate(${img.rotate}deg) scale(${imageHovered ? 1 : 0.1})`,
                  opacity: imageHovered ? 1 : 0,
                  transition: `transform ${img.duration} cubic-bezier(0.34, 1.56, 0.64, 1) ${img.delay}s, opacity 0.15s ease ${img.delay}s`,
                  pointerEvents: "none",
                  zIndex: 10,
                }}
              >
                <div style={{ animation: img.animation }}>
                  <Image src={img.src} alt="" width={img.size} height={img.size} style={{ width: img.size, height: img.size, objectFit: "contain", display: "block" }} />
                </div>
              </div>
            ))}

            <Image
              src="/images/HomeImages/Satish-about.png"
              alt="Satish"
              width={260}
              height={320}
              className="object-cover"
              style={{ maxWidth: '260px', width: '100%', position: "relative", zIndex: 1 }}
            />
          </div>
        </div>

        {/* ── Section 2: full-width description ───────────────── */}
        <div className="mb-20">
          <p className="text-base text-gray-500 leading-relaxed">
            Across IoT interfaces, AI interfaces, SaaS products, learning management systems, event management tools, and health platforms, I've worked on some of the most diverse product challenges a designer can get. That range is deliberate. It keeps the thinking sharp, the approach adaptable, and the work honest.
          </p>
        </div>

        {/* ── Experience timeline ──────────────────────────────── */}
        <div className="mb-20">
          <p
            className="text-xl md:text-2xl text-gray-700 leading-snug mb-10"
            style={{ fontFamily: "SatishSans, serif", fontWeight: 400 }}
          >
            I've helped startups take their digital products from idea to launch. These are some of the companies I've partnered with.
          </p>
          <div className="grid grid-cols-4 justify-items-center gap-8 md:gap-12 pb-4">
            {companies.map((co, i) => {
              const isHovered = hovered === i;
              return (
                <div
                  key={i}
                  className="flex flex-col items-center gap-3 flex-shrink-0"
                  onMouseEnter={() => setHovered(i)}
                  onMouseLeave={() => setHovered(null)}
                >
                  {/* Logo + chips wrapper */}
                  <div style={{ position: "relative", display: "flex", justifyContent: "center", width: "60px", height: "60px" }}>

                    {/* Chips — behind logo, pop up on hover */}
                    {co.tags.map((tag, ti) => (
                      <div
                        key={ti}
                        style={{
                          position: "absolute",
                          bottom: isHovered ? "68px" : "20px",
                          left: "50%",
                          transform: `translateX(calc(-50% + ${tag.x}px)) rotate(${tag.rotate}deg)`,
                          opacity: isHovered ? 1 : 0,
                          transition: `bottom 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) ${ti * 0.06}s, opacity 0.2s ease ${ti * 0.06}s`,
                          zIndex: 0,
                          background: "white",
                          border: "1px solid #e5e7eb",
                          borderRadius: "20px",
                          padding: "3px 8px",
                          fontSize: "10px",
                          fontFamily: "FunnelDisplay, sans-serif",
                          color: "#374151",
                          whiteSpace: "nowrap",
                          pointerEvents: "none",
                          boxShadow: "0 1px 4px rgba(0,0,0,0.07)",
                        }}
                      >
                        {tag.label}
                      </div>
                    ))}

                    {/* Logo box */}
                    <div
                      style={{
                        position: "relative",
                        zIndex: 1,
                        width: "60px",
                        height: "60px",
                        background: "#f3f4f6",
                        border: "1px solid #e5e7eb",
                        borderRadius: "30%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        overflow: "hidden",
                        boxShadow: isHovered ? `inset 0 -14px 20px 4px ${co.shadow}` : "none",
                        transition: "box-shadow 0.3s ease",
                      }}
                    >
                      <Image src={co.src} alt={co.name} width={60} height={60} className="w-full h-full object-contain" />
                    </div>
                  </div>

                  <span className="text-[11px] text-gray-500" style={{ fontFamily: "FunnelDisplay, sans-serif" }}>{co.name}</span>
                  <span className="text-[10px] text-gray-300 text-center" style={{ fontFamily: "FunnelDisplay, sans-serif" }}>{co.year}</span>
                </div>
              );
            })}

            {/* 8th tile: contracts not listed above */}
            <div className="flex flex-col items-center gap-3 flex-shrink-0">
              <div style={{ position: "relative", display: "flex", justifyContent: "center", width: "60px", height: "60px" }}>
                <div
                  style={{
                    width: "60px",
                    height: "60px",
                    background: "#f9fafb",
                    border: "1px dashed #d1d5db",
                    borderRadius: "30%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: "FunnelDisplay, sans-serif",
                    fontSize: "17px",
                    color: "#9ca3af",
                    letterSpacing: "-0.02em",
                  }}
                >
                  5+
                </div>
              </div>
              <span className="text-[11px] text-gray-500" style={{ fontFamily: "FunnelDisplay, sans-serif" }}>Contracts</span>
            </div>
          </div>
        </div>

        {/* ── Toolkit ──────────────────────────────────────────── */}
        <div className="mb-20">
          <p
            className="text-xl md:text-2xl text-gray-700 leading-snug mb-2"
            style={{ fontFamily: "SatishSans, serif", fontWeight: 400 }}
          >
            My Toolkit
          </p>
          <p className="text-sm text-gray-400 mb-10" style={{ fontFamily: "FunnelDisplay, sans-serif" }}>
            Tools I use to design, build, and ship every day.
          </p>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-10">

            {/* Design & Animations */}
            <div>
              <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-5" style={{ fontFamily: "FunnelDisplay, sans-serif" }}>Design & Animations</p>
              <div className="flex flex-col gap-4">
                {[
                  { name: "Figma",         src: "/images/ToolsIcons/figma-icon.svg" },
                  { name: "Photoshop",     src: "/images/ToolsIcons/adobe-photoshop-icon.svg" },
                  { name: "Blender",       src: "/images/ToolsIcons/blender-icon.svg" },
                  { name: "Rive",          src: "/images/ToolsIcons/Rive_rive_square_1.png" },
                  { name: "After Effects", src: "/images/ToolsIcons/adobe-after-effects-icon.svg" },
                ].map((tool) => (
                  <div key={tool.name} className="flex items-center gap-3">
                    <div className="w-9 h-9 flex-shrink-0 flex items-center justify-center">
                      <Image src={tool.src} alt={tool.name} width={36} height={36} className="w-full h-full object-contain" />
                    </div>
                    <span className="text-sm text-gray-700" style={{ fontFamily: "FunnelDisplay, sans-serif" }}>{tool.name}</span>
                  </div>
                ))}
                <p className="text-xs text-gray-400 mt-1" style={{ fontFamily: "FunnelDisplay, sans-serif" }}>
                  + dozens of online tools
                </p>
              </div>
            </div>

            {/* Development + AI combined on mobile */}
            <div className="flex flex-col gap-10 md:contents">

            <div>
              <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-5" style={{ fontFamily: "FunnelDisplay, sans-serif" }}>Development</p>
              <div className="flex flex-col gap-4">
                {[
                  { name: "Cursor", src: "/images/ToolsIcons/cursor-ai-code-icon.svg" },
                  { name: "GitHub", src: "/images/ToolsIcons/github-icon.svg" },
                ].map((tool) => (
                  <div key={tool.name} className="flex items-center gap-3">
                    <div className="w-9 h-9 flex-shrink-0 flex items-center justify-center">
                      <Image src={tool.src} alt={tool.name} width={36} height={36} className="w-full h-full object-contain" />
                    </div>
                    <span className="text-sm text-gray-700" style={{ fontFamily: "FunnelDisplay, sans-serif" }}>{tool.name}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* AI & Assistive */}
            <div>
              <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-5" style={{ fontFamily: "FunnelDisplay, sans-serif" }}>AI & Assistive Tools</p>
              <div className="flex flex-col gap-4">
                {[
                  { name: "Claude Code",   src: "/images/ToolsIcons/claude-ai-icon.svg" },
                  { name: "ChatGPT",       src: "/images/ToolsIcons/chatgpt-icon.svg" },
                  { name: "Google Gemini", src: "/images/ToolsIcons/google-gemini-icon.svg" },
                ].map((tool) => (
                  <div key={tool.name} className="flex items-center gap-3">
                    <div className="w-9 h-9 flex-shrink-0 flex items-center justify-center">
                      <Image src={tool.src} alt={tool.name} width={36} height={36} className="w-full h-full object-contain" />
                    </div>
                    <span className="text-sm text-gray-700" style={{ fontFamily: "FunnelDisplay, sans-serif" }}>{tool.name}</span>
                  </div>
                ))}
              </div>
            </div>

            </div>{/* closes mobile wrapper */}

          </div>
        </div>

        {/* ── Closing CTA ──────────────────────────────────────── */}
        <div className="text-center">
          <p
            className="text-2xl md:text-3xl text-gray-700 leading-snug mb-8"
            style={{ fontFamily: "SatishSans, serif", fontWeight: 400 }}
          >
            If you're building something and need a designer who takes ownership end to end, let's talk.
          </p>
          <div className="inline-flex items-stretch gap-0">
            <a
              href="mailto:satishdezn@gmail.com"
              className="inline-flex items-center gap-2 px-6 py-3 border border-gray-200 text-sm text-gray-500 hover:border-gray-400 hover:text-gray-800 transition-all duration-200"
              style={{ fontFamily: "FunnelDisplay, sans-serif", letterSpacing: "0.05em" }}
            >
              say hello
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M2.5 7h9M8 3.5l3.5 3.5L8 10.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </a>
            <div
              className="flex items-center px-5 border border-l-0 border-gray-200 text-sm text-gray-400 select-all cursor-pointer"
              style={{ fontFamily: "FunnelDisplay, sans-serif", letterSpacing: "0.03em" }}
            >
              satishdezn@gmail.com
              <button
                onClick={handleCopy}
                className="ml-2 text-gray-300 hover:text-gray-600 transition-colors duration-200 flex-shrink-0 cursor-pointer"
                title="Copy email"
              >
                {copied ? (
                  <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M2 7l3.5 3.5L12 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                ) : (
                  <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><rect x="5" y="5" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.2"/><path d="M9 5V3a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1v5a1 1 0 0 0 1 1h2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
                )}
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
