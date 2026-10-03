import type { Metadata } from 'next';

// The page itself is a client component, so its metadata lives here
export const metadata: Metadata = {
  title: 'Color Memo - Satish Hebbal',
  description:
    'A game that tests how sharp your color memory really is.',
  openGraph: {
    title: 'Color Memo - Satish Hebbal',
    description:
      'A game that tests how sharp your color memory really is.',
    url: '/lab/color',
    images: [{ url: '/images/og.png', width: 1200, height: 630 }],
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
