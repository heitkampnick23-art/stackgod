import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: ['/dashboard', '/build', '/login'] },
    ],
    sitemap: 'https://stakgod.com/sitemap.xml',
    host: 'https://stakgod.com',
  };
}
