import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  return [
    {
      url: siteUrl,
      lastModified: new Date(),
    },
    {
      url: `${siteUrl}/adventure`,
      lastModified: new Date(),
    },
    {
      url: `${siteUrl}/children`,
      lastModified: new Date(),
    },
    {
      url: `${siteUrl}/parents`,
      lastModified: new Date(),
    },
    {
      url: `${siteUrl}/teachers`,
      lastModified: new Date(),
    },
  ];
}
