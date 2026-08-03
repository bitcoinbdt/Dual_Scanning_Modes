import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/pricing', '/signup', '/agent'],
        disallow: [
          '/admin',
          '/admin/',
          '/api/',
          '/auth/',
          '/credits',
        ],
      },
    ],
    sitemap: 'https://scanner.coinxera.com/sitemap.xml',
    host: 'https://scanner.coinxera.com',
  };
}
