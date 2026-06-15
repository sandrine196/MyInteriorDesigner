import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Agent Dashboard",
  description: "Manage your virtual staging projects and client designs.",
  robots: { index: false, follow: false },
};

export default function AgentDashboardLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
