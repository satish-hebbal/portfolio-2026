import type { Metadata } from 'next';
import HsaasPrivate from '../../../components/works-pages/hsaasPrivate';
import MoreWorks from '../../../components/works-pages/MoreWorks';
import ScrollToTop from '../../../components/ui/ScrollToTop';

// Unlisted, branded version of the healthcare SaaS case study. Kept for portfolio
// reviews and interviews only. It is not linked from anywhere on the site, is
// noindex at both the meta and header level (see next.config.ts), and is
// disallowed in robots.ts. The public, de-branded twin lives at
// /works/healthcare-saas.
export const metadata: Metadata = {
  title: 'Case study (private)',
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
      'max-snippet': 0,
      'max-image-preview': 'none',
    },
  },
};

export default function HsaasPrivatePage() {
  return (
    <div className="bg-white min-h-screen">
      <HsaasPrivate />
      <MoreWorks current="/works/healthcare-saas" />
      <ScrollToTop />
    </div>
  );
}
