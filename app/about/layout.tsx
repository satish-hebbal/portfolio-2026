import type { Metadata } from 'next';

// The page itself is a client component, so its metadata lives here
export const metadata: Metadata = {
  title: 'About - Satish Hebbal',
  description:
    'A designer who partners with startups and takes full ownership of the work: the screens, the thinking, the decisions, and the execution.',
  openGraph: {
    title: 'About - Satish Hebbal',
    description:
      'A designer who partners with startups and takes full ownership of the work: the screens, the thinking, the decisions, and the execution.',
    url: '/about',
    images: [{ url: '/images/og.png', width: 1200, height: 630 }],
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
