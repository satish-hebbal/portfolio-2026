"use client"
import dynamic from "next/dynamic"
import { usePathname } from "next/navigation"

const Navbar = dynamic(() => import("./navbar"), { ssr: false })

export default function NavbarClient() {
  const pathname = usePathname()
  if (pathname?.startsWith('/proposals') || pathname?.startsWith('/lab/studio-kapi') || pathname?.startsWith('/lab/speedo')) return null
  return <Navbar />
}
