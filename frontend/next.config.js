/** @type {import('next').NextConfig} */
const nextConfig = {
  // Frontend MUST NOT call Google APIs directly (spec §3)
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
