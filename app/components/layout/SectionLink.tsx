"use client"

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { scrollToSection } from '@/lib/motion'

type Props = Omit<React.ComponentProps<typeof Link>, 'href'> & {
  // a home page section id such as "work"; omit for a plain route link
  section?: string
  href: string
}

// A real link (prefetch, cmd-click, crawlable) that, when it points at a home
// page section and we are already on the home page, glides there through Lenis
// instead of letting the browser jump. From any other page it navigates to
// /#section and ScrollReset finishes the scroll once the home page is mounted.
export default function SectionLink({ section, href, onClick, ...rest }: Props) {
  const pathname = usePathname()

  return (
    <Link
      href={href}
      scroll={section ? false : undefined}
      onClick={(e) => {
        onClick?.(e)
        if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
        if (pathname === '/' && section) {
          e.preventDefault()
          scrollToSection(section)
        }
      }}
      {...rest}
    />
  )
}
