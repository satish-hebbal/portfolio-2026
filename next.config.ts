import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Belt and braces for the Walkman's dev-only analysis route: it never reads
  // project files in production, so none of them belong in its function.
  outputFileTracingExcludes: {
    '/api/walkman-analysis': ['public/**', 'app/**', '.cache/**', 'scripts/**', '*.png', 'README.md'],
  },
  async headers() {
    return [
      {
        source: '/lab/walkman',
        headers: [
          {
            key: 'Permissions-Policy',
            value: 'autoplay=*',
          },
        ],
      },
      // Unlisted case study routes. The header is the load-bearing part: it is
      // sent on every response including the images, which a meta tag in the
      // document head cannot cover. noimageindex is what keeps the screenshots
      // out of Google Images.
      {
        source: '/works/private/:path*',
        headers: [
          {
            key: 'X-Robots-Tag',
            value: 'noindex, nofollow, noimageindex, noarchive',
          },
        ],
      },
      // The public healthcare case study is de-branded in text, but its
      // screenshots still show the client's wordmark, and image search reads
      // text inside images. Keep these files out of image indexes while the
      // page itself stays indexed. Both the raw files and the optimizer URLs
      // that next/image actually serves need the header.
      {
        source: '/images/WorkImages/hsaasImages/:path*',
        headers: [
          {
            key: 'X-Robots-Tag',
            value: 'noimageindex, noarchive',
          },
        ],
      },
      {
        source: '/_next/image',
        has: [
          {
            type: 'query',
            key: 'url',
            value: '.*hsaasImages.*',
          },
        ],
        headers: [
          {
            key: 'X-Robots-Tag',
            value: 'noimageindex, noarchive',
          },
        ],
      },
    ]
  },
};

export default nextConfig;
