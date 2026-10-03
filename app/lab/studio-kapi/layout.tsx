import type { Metadata } from 'next';

// The page itself is a client component, so its metadata lives here
export const metadata: Metadata = {
  title: 'Studio-Kapi - Satish Hebbal',
  description:
    'A mini music studio: program beats, play instruments, record and layer your voice.',
  openGraph: {
    title: 'Studio-Kapi - Satish Hebbal',
    description:
      'A mini music studio: program beats, play instruments, record and layer your voice.',
    url: '/lab/studio-kapi',
    images: [{ url: '/images/og.png', width: 1200, height: 630 }],
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
