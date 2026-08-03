/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Suppress hydration warnings in development
  onDemandEntries: {
    maxInactiveAge: 25 * 1000,
    pagesBufferLength: 2,
  },
  // Proxy backend API calls through Next.js to avoid CORS issues.
  async rewrites() {
    const backendUrl =
      process.env.NEXT_PUBLIC_BACKEND_URL ||
      'https://dual-scanning-modes.onrender.com';
    return [
      {
        source: '/proxy/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
  // Prevent browsers caching the HTML page document — forces them to always
  // fetch the latest deployment manifest so old chunk hashes never cause
  // ChunkLoadError crashes after a new deploy.
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
          },
        ],
      },
      // Static assets (JS/CSS chunks) may still be cached by hash
      {
        source: '/_next/static/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
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
