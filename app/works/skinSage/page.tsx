import SkinSage from '../../components/works-pages/skinSage';
import MoreWorks from '../../components/works-pages/MoreWorks';
import ScrollToTop from '../../components/ui/ScrollToTop';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'SkinSage, Skincare App - Satish Hebbal',
  description:
    'Designed the full product for a personalised skincare app: skin assessment, dermatologist consultation, and AI routine builder. 73% day-7 retention.',
  openGraph: {
    title: 'SkinSage, Skincare App - Satish Hebbal',
    description:
      'Designed the full product for a personalised skincare app: skin assessment, dermatologist consultation, and AI routine builder. 73% day-7 retention.',
    url: '/works/skinSage',
    images: [{ url: '/images/og.png', width: 1200, height: 630 }],
  },
};

export default function SkinSagePage() {
  return (
    <div className="bg-white min-h-screen">
      <SkinSage />
      <MoreWorks current="/works/skinSage" />
      <ScrollToTop />
    </div>
  );
}
