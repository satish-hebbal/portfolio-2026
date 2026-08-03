import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
    ]
  },
};

export default nextConfig;
