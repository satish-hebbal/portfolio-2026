import type { Metadata } from 'next';
import XPayProposal from '../../components/proposals/xpay';
import ScrollToTop from '../../components/ui/ScrollToTop';

export const metadata: Metadata = {
  title: 'xPay - Satish Hebbal',
  description: 'A product problem found in xPay, and what I\'d ship to fix it.',
};

export default function XPayProposalPage() {
  return (
    <div className="bg-white min-h-screen">
      <XPayProposal />
      <ScrollToTop />
    </div>
  );
}
