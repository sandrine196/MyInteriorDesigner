import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import CookieBanner from "@/components/CookieBanner";

const geist = Geist({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "My Interior Designer — Affordable AI Interior Design",
  description: "Your affordable interior designer, powered by AI. Upload your floor plan, choose real furniture, get a photorealistic room render.",
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
