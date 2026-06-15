import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import CookieBanner from "@/components/CookieBanner";

const geist = Geist({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: "My Interior Designer — AI Room Design for UK Homes",
    template: "%s | My Interior Designer",
  },
  description: "AI-powered interior design for UK homeowners. Upload your floor plan, choose real furniture from top UK retailers, and get a photorealistic room render in minutes.",
  metadataBase: new URL("https://www.myinteriordesigner.co.uk"),
  openGraph: {
    type: "website",
    locale: "en_GB",
    url: "https://www.myinteriordesigner.co.uk",
    siteName: "My Interior Designer",
    title: "My Interior Designer — AI Room Design for UK Homes",
    description: "AI-powered interior design for UK homeowners. Upload your floor plan, choose real furniture from top UK retailers, and get a photorealistic room render in minutes.",
    images: [{ url: "/og-image.jpg", width: 1200, height: 630, alt: "My Interior Designer — AI room design for UK homes" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "My Interior Designer — AI Room Design for UK Homes",
    description: "AI-powered interior design for UK homeowners. Upload your floor plan, choose real furniture from top UK retailers, and get a photorealistic room render in minutes.",
    images: ["/og-image.jpg"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${geist.className} bg-stone-50 text-stone-900 antialiased`}>
        {children}
        <CookieBanner />
      </body>
    </html>
  );
}
