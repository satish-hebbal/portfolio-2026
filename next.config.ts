import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/lab/cassette2',
        headers: [
          {
            key: 'Permissions-Policy',
            value: 'autoplay=*',
          },
        ],
      },
    ]
  },
};

export default nextConfig;
