import type { Metadata } from 'next';

// The page itself is a client component, so its metadata lives here
export const metadata: Metadata = {
  title: 'YT Walkman - Satish Hebbal',
  description:
    'What if you could listen to any YouTube track on a vintage Walkman?',
  openGraph: {
    title: 'YT Walkman - Satish Hebbal',
    description:
      'What if you could listen to any YouTube track on a vintage Walkman?',
    url: '/lab/walkman',
    images: [{ url: '/images/og.png', width: 1200, height: 630 }],
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
