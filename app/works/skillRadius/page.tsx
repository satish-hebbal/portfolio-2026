import SkillRadius from '../../components/works-pages/skillRadius';
import MoreWorks from '../../components/works-pages/MoreWorks';
import CaseOutro from '../../components/works-pages/CaseOutro';
import ScrollToTop from '../../components/ui/ScrollToTop';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'SkillRadius, Learning Platform - Satish Hebbal',
  description:
    'Designed the full product for a job-skill learning platform: courses, video lessons, notes, quizzes, and dashboard. Zero to V1, end to end.',
  openGraph: {
    title: 'SkillRadius, Learning Platform - Satish Hebbal',
    description:
      'Designed the full product for a job-skill learning platform: courses, video lessons, notes, quizzes, and dashboard. Zero to V1, end to end.',
    url: '/works/skillRadius',
    images: [{ url: '/images/og.png', width: 1200, height: 630 }],
  },
};

export default function SkillRadiusPage() {
  return (
    <div className="bg-white min-h-screen">
      <SkillRadius />
      <CaseOutro headline="The learning core is designed. Certifications are next.">
        Course discovery, structured modules with video, notes and quizzes, progress tracking and the landing page are designed end to end. Certifications and a proctored exam platform are in progress.
      </CaseOutro>
      <MoreWorks current="/works/skillRadius" />
      <ScrollToTop />
    </div>
  );
}
