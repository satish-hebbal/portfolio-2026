import Image from "next/image"
import Loader from "./components/layout/Loader"
import WorkGallery from "./components/home/workGallery"
import MouseColorBloom from "./components/home/MouseColorBloom"
import ParallaxImages from "./components/home/ParallaxImages"
import EmailSection from "./components/home/EmailSection"
import UnpluggedGallery from "./components/home/unpluggedGallery"
import VisualIdentityGallery from "./components/home/visualIdentityGallery"
import ProposalsGallery from "./components/home/proposalsGallery"
import PageBranches from "./components/home/PageBranches"
import ParallaxMobile from "./components/home/ParallaxMobile"
import Pillars from "./components/home/Pillars"
import LabTeaser from "./components/home/labTeaser"


export default function Home() {
  return (
    <div className="bg-white relative overflow-x-clip">

      <Loader />
      <PageBranches />
      <ParallaxMobile />

      {/* Pillars frame the first fold and scroll away with it (see Pillars) */}
      <Pillars />

      <div className="max-w-5xl mx-auto px-6 md:px-10">

        {/* First fold — name + description, full viewport height */}
        <MouseColorBloom />
        <div className="relative min-h-[calc(100vh-120px)] flex flex-col justify-center items-center text-center gap-6 overflow-hidden md:overflow-visible">

          <ParallaxImages />

          {/* Text isolated above the bloom layer so color blend doesn't affect it */}
          <div className="relative flex flex-col items-center gap-6 md:bg-white md:px-6 md:py-4" style={{ zIndex: 5 }}>
            <Image
              src="/images/common/sa26.svg"
              alt="SA26"
              width={48}
              height={48}
              className="opacity-50"
              style={{ marginBottom: '70px' }}
            />
            <h1 className="text-4xl md:text-5xl tracking-tight text-black">
              <span style={{ fontFamily: 'SatishCapsSans, sans-serif', fontSize: '1.5em' }}>S</span><span style={{ fontFamily: 'SatishSans, sans-serif', marginLeft: '4px' }}>atish </span>
              <span style={{ fontFamily: 'SatishCapsSans, sans-serif', fontSize: '1.5em' }}>H</span><span style={{ fontFamily: 'SatishSans, sans-serif', marginLeft: '4px' }}>ebbal</span>
            </h1>
            <p
              className="text-sm md:text-base text-gray-500 leading-relaxed max-w-md"
              style={{ fontFamily: 'FunnelDisplay, sans-serif', fontWeight: '300' }}
            >
              I design what early-stage startups need to exist. Brand, product, and system. From first brief to live product.
            </p>
          </div>

          {/* Email box — absolutely anchored to bottom of first fold, not part of centered group */}
          <div className="absolute bottom-28 md:bottom-20 left-0 right-0 flex justify-center items-center" style={{ zIndex: 5 }}>
            <EmailSection />
          </div>
        </div>

        {/* Work section */}
        <div id="work" data-section="work">
          <WorkGallery />
        </div>

        {/* Visual Identity section */}
        <div data-section="visual-identity">
          <VisualIdentityGallery />
        </div>

        {/* Design Proposals section */}
        <div data-section="proposals">
          <ProposalsGallery />
        </div>

        {/* Unplugged section */}
        <div id="unplugged" data-section="unplugged">
          <UnpluggedGallery />
        </div>

        {/* Lab section */}
        <div id="lab" data-section="lab">
          <LabTeaser />
        </div>

      </div>


    </div>
  )
}
