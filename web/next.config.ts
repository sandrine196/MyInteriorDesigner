import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      // Cloudflare R2 public bucket — renders and floor plans
      { protocol: "https", hostname: "*.r2.dev" },
      // Custom CDN domain if STORAGE_PUBLIC_URL points to a vanity domain
      { protocol: "https", hostname: "cdn.myinteriordesigner.co.uk" },
    ],
  },
};

export default nextConfig;
