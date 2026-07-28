/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Suppress hydration warnings in development
  onDemandEntries: {
    maxInactiveAge: 25 * 1000,
    pagesBufferLength: 2,
  },
  // Handle external API calls gracefully
  async rewrites() {
    return [
      // Add any API rewrites here if needed
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
