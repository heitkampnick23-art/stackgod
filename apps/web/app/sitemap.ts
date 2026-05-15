import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://stakgod.com';
  const now = new Date();
  return [
    { url: base + '/',           lastModified: now, changeFrequency: 'weekly',  priority: 1.0 },
    { url: base + '/showcase',   lastModified: now, changeFrequency: 'weekly',  priority: 0.9 },
    { url: base + '/templates',  lastModified: now, changeFrequency: 'weekly',  priority: 0.9 },
    { url: base + '/discover',   lastModified: now, changeFrequency: 'daily',   priority: 0.9 },
    { url: base + '/pricing',    lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: base + '/docs',       lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: base + '/support',    lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: base + '/changelog',  lastModified: now, changeFrequency: 'daily',   priority: 0.6 },
  ];
}
