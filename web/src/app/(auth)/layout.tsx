import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1">{children}</div>
      <footer className="py-4 px-6 text-center">
        <nav className="flex justify-center gap-5 text-xs text-white/50">
          <Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
          <Link href="/terms" className="hover:text-white transition-colors">Terms of Service</Link>
          <a href="mailto:hello@myinteriordesigner.co.uk" className="hover:text-white transition-colors">Contact Us</a>
        </nav>
      </footer>
    </div>
  );
}
