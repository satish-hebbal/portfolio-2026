import CornerTable from '../../components/unplugged-pages/corner-table';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'The Corner Table - Satish Hebbal',
  description:
    'Built a corner table from scratch: cut, assembled, painted, and finished. A hands-on experiment in furniture making with zero prior woodworking experience.',
  openGraph: {
    title: 'The Corner Table - Satish Hebbal',
    description:
      'Built a corner table from scratch: cut, assembled, painted, and finished. A hands-on experiment in furniture making with zero prior woodworking experience.',
    url: '/unplugged/table',
    images: [{ url: '/images/og.png', width: 1200, height: 630 }],
  },
};

export default function CornerTablePage() {
  return <CornerTable />;
}