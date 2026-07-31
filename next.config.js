/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Suppress hydration warnings in development
  onDemandEntries: {
    maxInactiveAge: 25 * 1000,
    pagesBufferLength: 2,
  },
  // Proxy backend API calls through Next.js to avoid CORS issues.
  // The browser hits /proxy/api/*, Next.js forwards server-side to the
  // Render backend. No cross-origin preflight is ever triggered.
  async rewrites() {
    const backendUrl =
      process.env.NEXT_PUBLIC_BACKEND_URL ||
      'http://localhost:3001';
    return [
      {
        source: '/proxy/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
  // Suppress specific console warnings during build
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Suppress EventSource polyfill warnings
      config.resolve.fallback = {
        ...config.resolve.fallback,
        net: false,
        tls: false,
        fs: false,
      };
    }
    return config;
  },
}

module.exports = nextConfig
