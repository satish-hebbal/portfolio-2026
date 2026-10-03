"use client"
import { usePathname } from "next/navigation"
import Navbar from "./navbar"

// Rendered on the server too, so the nav is in the first paint instead of
// popping in after hydration
export default function NavbarClient() {
  const pathname = usePathname()
  if (pathname?.startsWith('/proposals') || pathname?.startsWith('/lab/studio-kapi') || pathname?.startsWith('/lab/speedo')) return null
  return <Navbar />
}
