import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "For Estate Agents & Developers — Virtual Staging & Buyer Gifts",
  description: "Partner with My Interior Designer. Offer AI virtual staging and free design sessions to every buyer — at no cost to you. Grow your referral income while delighting clients.",
  openGraph: {
    title: "For Estate Agents & Developers — Virtual Staging & Buyer Gifts",
    description: "Partner with My Interior Designer. Offer AI virtual staging and free design sessions to every buyer — at no cost to you.",
    url: "https://www.myinteriordesigner.co.uk/agents",
  },
};

export default function AgentsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
