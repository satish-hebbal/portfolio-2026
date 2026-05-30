"use client"

import { usePathname, useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import { gsap } from "gsap"
import { ScrollToPlugin } from "gsap/ScrollToPlugin"

// Register GSAP plugins
gsap.registerPlugin(ScrollToPlugin)

const navItems = [
  { name: "Work", href: "/work" },
  { name: "Unplug", href: "/unplugged" },
  { name: "Home", href: "/" },
  { name: "Lab", href: "/lab" },
  { name: "About", href: "/about" },
]

export default function Navbar() {
  const pathname = usePathname()
  const router = useRouter()
  const navRef = useRef<HTMLElement>(null)
  const [isMounted, setIsMounted] = useState(false)
  const [isLightPage, setIsLightPage] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  useEffect(() => {
    setIsLightPage(document.body.hasAttribute('data-light-page'))
    const observer = new MutationObserver(() => {
      setIsLightPage(document.body.hasAttribute('data-light-page'))
    })
    observer.observe(document.body, { attributes: true, attributeFilter: ['data-light-page'] })
    return () => observer.disconnect()
  }, [])

  // nav is white-text when on cassette2 dark mode (default) or toggled off light mode
  const showWhiteNav = pathname === '/lab/cassette2' && !isLightPage

  useEffect(() => {
    // Create the SVG displacement map for liquid glass effect
    const mapSvg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1">
        <radialGradient id="lensGradient">
          <stop offset="0%" stop-color="white" stop-opacity="1" />
          <stop offset="55%" stop-color="gray" stop-opacity="0.4" />
          <stop offset="80%" stop-color="black" stop-opacity="0.6" />
          <stop offset="100%" stop-color="white" stop-opacity="1" />
        </radialGradient>
        <rect width="1" height="1" fill="url(#lensGradient)" />
      </svg>
    `

    const encodedMap = encodeURIComponent(mapSvg)

    // Create and inject the filter SVG
    const filterSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
    filterSvg.style.position = "fixed"
    filterSvg.style.top = "-10000px"
    filterSvg.innerHTML = `
      <defs>
        <filter id="liquid-lens" x="-50%" y="-50%" width="200%" height="200%" color-interpolation-filters="sRGB">
          <feImage href="data:image/svg+xml;charset=utf-8,${encodedMap}" result="displacementMap" />
          <feDisplacementMap in="SourceGraphic" in2="displacementMap" scale="40" xChannelSelector="R" yChannelSelector="G" result="displaced" />
          <feGaussianBlur in="displaced" stdDeviation="3" result="blurred" />
          <feMorphology operator="dilate" radius="1" in="blurred" result="expanded" />
          <feComposite in="expanded" in2="SourceGraphic" operator="over" />
        </filter>
      </defs>
    `
    
    document.body.appendChild(filterSvg)
    
    // Animate navbar entrance
    if (navRef.current) {
      gsap.fromTo(navRef.current,
        { y: -100, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.8, ease: "back.out(1.7)", delay: 0.2 }
      )
    }
    
    return () => {
      if (filterSvg && filterSvg.parentNode) {
        filterSvg.parentNode.removeChild(filterSvg)
      }
    }
  }, [])

  const handleNavigation = (item: typeof navItems[0], e: React.MouseEvent) => {
    e.preventDefault()
    
    // Add click animation
    if (navRef.current) {
      gsap.to(navRef.current, {
        scale: 0.95,
        duration: 0.1,
        yoyo: true,
        repeat: 1,
        ease: "power2.inOut"
      })
    }

    if (item.name === "Work") {
      // Check if we're on a work page
      if (pathname.startsWith('/works/')) {
        // Navigate to home and scroll to work section
        navigateWithTransition('/', () => {
          setTimeout(() => {
            scrollToWorkSection()
          }, 500)
        })
      } else if (pathname === '/') {
        // Already on home, just scroll to work section
        scrollToWorkSection()
      } else {
        // Navigate to home and scroll to work
        navigateWithTransition('/', () => {
          setTimeout(() => {
            scrollToWorkSection()
          }, 500)
        })
      }
    } else if (item.name === "Unplug") {
      if (pathname === '/') {
        // Already on home, scroll to unplugged
        scrollToUnplugSection()
      } else {
        // Navigate to home and scroll to unplugged
        navigateWithTransition('/', () => {
          setTimeout(() => {
            scrollToUnplugSection()
          }, 500)
        })
      }
    } else if (item.name === "About") {
      navigateWithTransition('/about')
    } else if (item.name === "Home") {
      if (pathname !== '/') {
        navigateWithTransition('/')
      } else {
        // Already on home, scroll to top
        scrollToTop()
      }
    } else {
      // Handle other navigation items
      if (pathname !== item.href) {
        navigateWithTransition(item.href)
      }
    }
  }

  const navigateWithTransition = (href: string, callback?: () => void) => {
    // Page transition out
    gsap.to("main", {
      y: 50,
      opacity: 0,
      duration: 0.4,
      ease: "power2.inOut",
      onComplete: () => {
        router.push(href)
        if (callback) callback()
      }
    })
  }

  const scrollToTop = () => {
    gsap.to(window, {
      duration: 1.2,
      scrollTo: {
        y: 0,
        offsetY: 0
      },
      ease: "power2.inOut"
    })
  }

  const scrollToWorkSection = () => {
    // Find work section and scroll to it
    const workSection = document.querySelector('[data-section="work"]') ||
                       document.querySelector('.gallery-wrapper') ||
                       Array.from(document.querySelectorAll('h2')).find(el =>
                         el.textContent?.toLowerCase().includes('work')
                       )?.parentElement

    if (workSection) {
      gsap.to(window, {
        duration: 1.2,
        scrollTo: {
          y: workSection,
          offsetY: 100
        },
        ease: "power2.inOut"
      })
    }
  }

  const scrollToUnplugSection = () => {
    // Find unplugged section
    const unpluggedSection = document.querySelector('[data-section="unplugged"]') ||
                            // Try to find by text content containing "Unplug"
                            Array.from(document.querySelectorAll('h2, h3')).find(el => 
                              el.textContent?.toLowerCase().includes('unplugged')
                            )?.closest('div')

    if (unpluggedSection) {
      gsap.to(window, {
        duration: 1.2,
        scrollTo: {
          y: unpluggedSection,
          offsetY: 100
        },
        ease: "power2.inOut"
      })
    }
  }


  // Page transition in effect
  useEffect(() => {
    gsap.fromTo("main", 
      { 
        y: 50, 
        opacity: 0 
      },
      { 
        y: 0, 
        opacity: 1, 
        duration: 0.6,
        ease: "power2.out",
        delay: 0.1
      }
    )
  }, [pathname])
  
  return (
    <div className="fixed top-0 left-0 right-0 flex justify-center px-3 py-4 pointer-events-none" style={{ zIndex: 10005 }}>
      <nav
        ref={navRef}
        className={`flex items-center rounded-none py-1 relative transition-all duration-300 hover:shadow-lg pointer-events-auto w-full max-w-full md:w-auto justify-between md:justify-start ${
          isMounted
            ? "gap-1 md:gap-6 px-3 md:px-6"
            : "gap-1 px-3"
        }`}
        style={{
          background: showWhiteNav ? 'rgba(255,255,255,0.06)' : 'rgba(255, 255, 255, 0.08)',
          backdropFilter: 'url(#liquid-lens) blur(2px)',
          border: showWhiteNav ? '2px solid rgba(255,255,255,0.14)' : '2px solid rgb(212, 212, 216)',
          boxShadow: `
            inset 0 1px 0 rgba(255, 255, 255, 0.2),
            inset 0 -1px 0 rgba(255, 255, 255, 0.1),
            0 8px 24px rgba(0, 0, 0, 0.1)
          `
        }}
      >
        {/* Corner squares - half outside */}
        <div className={`absolute -top-1 -left-1 w-2 h-2 ${showWhiteNav ? 'bg-white/25' : 'bg-zinc-300'}`} />
        <div className={`absolute -top-1 -right-1 w-2 h-2 ${showWhiteNav ? 'bg-white/25' : 'bg-zinc-300'}`} />
        <div className={`absolute -bottom-1 -left-1 w-2 h-2 ${showWhiteNav ? 'bg-white/25' : 'bg-zinc-300'}`} />
        <div className={`absolute -bottom-1 -right-1 w-2 h-2 ${showWhiteNav ? 'bg-white/25' : 'bg-zinc-300'}`} />
        {navItems.map((item, index) => (
          <div key={item.name} className={`flex items-center ${isMounted ? "gap-1 md:gap-6" : "gap-1"}`}>
            <button
              onClick={(e) => handleNavigation(item, e)}
              className={`cursor-pointer font-light transition-all duration-300 relative hover:text-orange-500 hover:scale-105 ${
                isMounted ? "text-xs md:text-sm" : "text-sm"
              } ${
                (pathname === item.href) ||
                (item.name === "Work" && pathname.startsWith('/works/')) ||
                (item.name === "Home" && pathname === '/')
                  ? "text-orange-500"
                  : (item.name === "Unplug" && pathname.startsWith('/unplugged/'))
                    ? "text-orange-400"
                    : (pathname.startsWith('/unplugged/') || showWhiteNav)
                      ? "text-white"
                      : "text-zinc-700"
              }`}
              style={{ fontFamily: 'FunnelDisplay, sans-serif', fontWeight: '400' }}
            >
              {item.name === "Home" ? (
                <Image
                  src="/images/common/sa26-filled.svg"
                  alt="Home"
                  width={22}
                  height={22}
                  className={`transition-opacity duration-300 ${pathname === '/' ? 'opacity-100' : 'opacity-40 hover:opacity-70'}`}
                  style={(pathname.startsWith('/unplugged/') || showWhiteNav) ? { filter: 'invert(1)' } : {}}
                />
              ) : item.name}
            </button>
            {index < navItems.length - 1 && (
              <span className={`${showWhiteNav ? 'text-white/25' : 'text-zinc-300'} ${isMounted ? "text-[7px] md:text-[10px]" : "text-[10px]"}`}>•</span>
            )}
          </div>
        ))}
      </nav>
    </div>
  )
}