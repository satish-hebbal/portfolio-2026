import type { Metadata } from 'next';

// The page itself is a client component, so its metadata lives here
export const metadata: Metadata = {
  title: 'Speedoo - Satish Hebbal',
  description:
    'A hyper-real instrument cluster with a fully synthesised engine you can rev.',
  openGraph: {
    title: 'Speedoo - Satish Hebbal',
    description:
      'A hyper-real instrument cluster with a fully synthesised engine you can rev.',
    url: '/lab/speedo',
    images: [{ url: '/images/og.png', width: 1200, height: 630 }],
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
