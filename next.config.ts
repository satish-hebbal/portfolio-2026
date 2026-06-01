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
    ]
  },
};

export default nextConfig;
