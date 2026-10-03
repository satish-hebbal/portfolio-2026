import type { Metadata } from 'next';
import HsaasPublic from '../../components/works-pages/hsaasPublic';
import MoreWorks from '../../components/works-pages/MoreWorks';
import CaseOutro from '../../components/works-pages/CaseOutro';
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
    images: [{ url: '/images/og.png', width: 1200, height: 630 }],
    type: 'article',
  },
};

export default function HealthcareSaasPage() {
  return (
    <div className="bg-white min-h-screen">
      <HsaasPublic />
      <CaseOutro headline="V1 in three weeks, paying customers within weeks.">
        Onboarding, credential verification, the channel marketplace and the subscription UI shipped as V1 in three weeks. The product reached $350+ MRR within weeks of launch.
      </CaseOutro>
      <MoreWorks current="/works/healthcare-saas" />
      <ScrollToTop />
    </div>
  );
}
