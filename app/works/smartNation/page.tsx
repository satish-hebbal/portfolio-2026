import SmartNation from '../../components/works-pages/smartNation';
import MoreWorks from '../../components/works-pages/MoreWorks';
import CaseOutro from '../../components/works-pages/CaseOutro';
import ScrollToTop from '../../components/ui/ScrollToTop';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Smart Nation, Smart Home IoT - Satish Hebbal',
  description:
    'Brand, product, and motion design for a smart home IoT startup. 280+ units installed across 40+ spaces. Shipped in 3 months.',
  openGraph: {
    title: 'Smart Nation, Smart Home IoT - Satish Hebbal',
    description:
      'Brand, product, and motion design for a smart home IoT startup. 280+ units installed across 40+ spaces. Shipped in 3 months.',
    url: '/works/smartNation',
    images: [{ url: '/images/og.png', width: 1200, height: 630 }],
  },
};

export default function SmartNationPage() {
  return (
    <div className="bg-white min-h-screen">
      <SmartNation />
      <CaseOutro headline="Shipped in three months, now live in 40+ spaces.">
        From first sketch to a live product: brand, app, switch interface, packaging and print. 280+ smart switches now run across homes, offices and commercial spaces.
      </CaseOutro>
      <MoreWorks current="/works/smartNation" />
      <ScrollToTop />
    </div>
  );
}