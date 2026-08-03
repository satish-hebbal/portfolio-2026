import type { Metadata } from 'next';
import HsaasPublic from '../../components/works-pages/hsaasPublic';
import MoreWorks from '../../components/works-pages/MoreWorks';
import ScrollToTop from '../../components/ui/ScrollToTop';

export const metadata: Metadata = {
  title: 'Healthcare SaaS, Zero to V1 - Satish Hebbal',
  description:
    'End to end product design for a subscription SaaS that gets independent US physicians visible across every platform patients use to find care. Onboarding, channel marketplace, and subscription UI shipped in three weeks.',
  openGraph: {
    title: 'Healthcare SaaS, Zero to V1 - Satish Hebbal',
    description:
      'End to end product design for a subscription SaaS built for independent US physicians. Onboarding, channel marketplace, and subscription UI shipped in three weeks.',
    url: '/works/healthcare-saas',
    type: 'article',
  },
};

export default function HealthcareSaasPage() {
  return (
    <div className="bg-white min-h-screen">
      <HsaasPublic />
      <MoreWorks current="/works/healthcare-saas" />
      <ScrollToTop />
    </div>
  );
}
