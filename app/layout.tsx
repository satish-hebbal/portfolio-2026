import type { Metadata } from "next"
import { Analytics } from "@vercel/analytics/next"
import { Inter } from "next/font/google"
import "./globals.css"
import NavbarClient from "./components/layout/NavbarClient"
import SmoothScroll from "./components/layout/SmoothScroll"
import ScrollReset from "./components/layout/ScrollReset"
import Footer from "./components/layout/footer"
import PostHogProvider from "./components/layout/PostHogProvider"

const inter = Inter({ subsets: ["latin"] })

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
  ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Satish Hebbal - Portfolio",
  description: "Product designer crafting thoughtful digital experiences. Specialising in interface design, interaction, and design systems.",
  icons: {
    icon: '/images/common/sa26-white.svg',
  },
  openGraph: {
    title: "Satish Hebbal - Portfolio",
    description: "Product designer crafting thoughtful digital experiences. Specialising in interface design, interaction, and design systems.",
    url: siteUrl,
    siteName: "Satish Hebbal",
    images: [
      {
        url: '/images/og.png',
        width: 1200,
        height: 630,
        alt: "Satish Hebbal - Portfolio",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Satish Hebbal - Portfolio",
    description: "Product designer crafting thoughtful digital experiences. Specialising in interface design, interaction, and design systems.",
    images: ['/images/og.png'],
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className} suppressHydrationWarning>
        <PostHogProvider>
          <SmoothScroll />
          <ScrollReset />
          <NavbarClient />
          <main>
            {children}
            <Analytics />
          </main>
          <Footer />
        </PostHogProvider>
      </body>
    </html>
  )
}
