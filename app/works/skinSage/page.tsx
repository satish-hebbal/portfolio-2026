import SkinSage from '../../components/works-pages/skinSage';
import MoreWorks from '../../components/works-pages/MoreWorks';
import CaseOutro from '../../components/works-pages/CaseOutro';
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
      <CaseOutro headline="Live in two weeks, and people kept coming back.">
        V1 went live two weeks after kickoff, covering the skin assessment, doctor search, booking, checkout and the doctor&apos;s own dashboard. 73% of users returned after day 7.
      </CaseOutro>
      <MoreWorks current="/works/skinSage" />
      <ScrollToTop />
    </div>
  );
}
