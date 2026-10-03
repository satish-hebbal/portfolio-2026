import AbhiyantrikWebsite from '../../components/works-pages/abhiyantrikWebsite';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Abhiyantrik Website - Satish Hebbal',
  description:
    'Web design, development, and creative direction for the Abhiyantrik Solutions website, with interactive smart switch and MCB demos.',
  openGraph: {
    title: 'Abhiyantrik Website - Satish Hebbal',
    description:
      'Web design, development, and creative direction for the Abhiyantrik Solutions website, with interactive smart switch and MCB demos.',
    url: '/works/abhiyantrikWebsite',
    images: [{ url: '/images/og.png', width: 1200, height: 630 }],
  },
};

export default function AbhiyantrikWebsitePage() {
  return <AbhiyantrikWebsite />;
}