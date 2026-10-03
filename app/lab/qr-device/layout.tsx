import type { Metadata } from 'next';

// The page itself is a client component, so its metadata lives here
export const metadata: Metadata = {
  title: 'QR Device - Satish Hebbal',
  description:
    'A hardware-style QR generator with gradients, textures and sound.',
  openGraph: {
    title: 'QR Device - Satish Hebbal',
    description:
      'A hardware-style QR generator with gradients, textures and sound.',
    url: '/lab/qr-device',
    images: [{ url: '/images/og.png', width: 1200, height: 630 }],
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
