import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/projects/", "/agent-dashboard/", "/admin/", "/agent-auth/", "/unsubscribe/"],
      },
    ],
    sitemap: "https://www.myinteriordesigner.co.uk/sitemap.xml",
  };
}
