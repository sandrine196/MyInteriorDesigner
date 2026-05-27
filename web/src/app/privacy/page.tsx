import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — My Interior Designer",
  description: "How My Interior Designer collects, uses, and protects your personal data under UK GDPR.",
};

const UPDATED = "26 May 2026";

function H2({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="text-xl font-bold text-stone-900 mt-12 mb-4 scroll-mt-24">
      {children}
    </h2>
  );
}
function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="text-base font-semibold text-stone-800 mt-6 mb-2">{children}</h3>;
}
function P({ children }: { children: React.ReactNode }) {
  return <p className="text-stone-600 leading-relaxed mb-3">{children}</p>;
}
function UL({ children }: { children: React.ReactNode }) {
  return <ul className="list-disc pl-6 space-y-1.5 text-stone-600 mb-4">{children}</ul>;
}
function Table({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto mb-6">
      <table className="w-full text-sm border-collapse">{children}</table>
    </div>
  );
}
function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="text-left px-4 py-2.5 bg-stone-100 border border-stone-200 font-semibold text-stone-700 text-xs uppercase tracking-wide">
      {children}
    </th>
  );
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-2.5 border border-stone-200 text-stone-600 align-top">{children}</td>;
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="border-b border-stone-200 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-sm text-stone-500 hover:text-stone-900 transition-colors">
            ← Back to My Interior Designer
          </Link>
          <span className="text-xs text-stone-400">Last updated: {UPDATED}</span>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold text-stone-900 mb-2">Privacy Policy</h1>
        <p className="text-stone-500 mb-2">Last updated: {UPDATED}</p>
        <P>
          This Privacy Policy explains how My Interior Designer (&ldquo;we&rdquo;, &ldquo;us&rdquo;,
          &ldquo;our&rdquo;) collects, uses, and protects your personal data when you use our
          service at myinteriordesigner.co.uk. We are committed to protecting your privacy in
          compliance with the UK General Data Protection Regulation (UK GDPR) and the Data
          Protection Act 2018.
        </P>

        {/* TOC */}
        <nav className="bg-stone-50 rounded-xl p-5 mb-10 border border-stone-200">
          <p className="text-xs font-semibold uppercase tracking-wider text-stone-400 mb-3">Contents</p>
          <ol className="space-y-1.5 text-sm text-stone-600 list-decimal pl-4">
            {[
              ["#controller", "Data Controller"],
              ["#data-collected", "What Data We Collect"],
              ["#legal-basis", "Legal Basis for Processing"],
              ["#processors", "Data Processors & International Transfers"],
              ["#retention", "Retention Periods"],
              ["#rights", "Your Rights Under UK GDPR"],
              ["#ai", "AI & Automated Processing"],
              ["#security", "Security"],
              ["#cookies", "Cookie Policy"],
              ["#children", "Children"],
              ["#changes", "Changes to This Policy"],
              ["#complaints", "How to Complain"],
              ["#contact", "Contact Us"],
            ].map(([href, label]) => (
              <li key={href}>
                <a href={href} className="hover:text-stone-900 hover:underline transition-colors">
                  {label}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        {/* 1. Data Controller */}
        <H2 id="controller">1. Data Controller</H2>
        <P>
          The data controller responsible for your personal data is:
        </P>
        <div className="bg-stone-50 rounded-xl p-5 border border-stone-200 mb-4 text-sm text-stone-700 space-y-1">
          <p className="font-semibold">My Interior Designer</p>
          <p>Trading as MyInteriorDesigner.co.uk</p>
          <p>Email: <a href="mailto:hello@myinteriordesigner.co.uk" className="underline">hello@myinteriordesigner.co.uk</a></p>
          <p className="pt-1 border-t border-stone-200 mt-2">ICO Registration Number: <strong>CSN9872434</strong></p>
          <p className="text-stone-500">Registered with the Information Commissioner&apos;s Office under the Data Protection Act 2018</p>
        </div>

        {/* 2. Data Collected */}
        <H2 id="data-collected">2. What Data We Collect</H2>

        <H3>Account data</H3>
        <UL>
          <li>Email address (required for registration and login)</li>
          <li>Password (stored as a one-way bcrypt hash — we never have access to your plaintext password)</li>
          <li>Account tier (free or pro) and subscription status</li>
          <li>Marketing consent preference and the date it was set</li>
          <li>Account creation date</li>
        </UL>

        <H3>Project and design data</H3>
        <UL>
          <li>Floor plan images you upload</li>
          <li>Room dimensions and features you describe</li>
          <li>Design preferences (style, budget, preferred retailers, wall colours, flooring)</li>
          <li>Project names and room types</li>
          <li>AI-generated room render images</li>
          <li>The prompts used to generate renders</li>
        </UL>

        <H3>Usage data</H3>
        <UL>
          <li>Products you click on (retailer, product name) and when</li>
          <li>In-app analytics events (e.g. render created, project opened)</li>
          <li>IP address and basic device/browser information collected automatically by our hosting infrastructure</li>
          <li>Date and time of requests</li>
        </UL>

        <H3>Communications</H3>
        <UL>
          <li>Emails you send to us</li>
          <li>Password reset requests</li>
        </UL>

        <P>
          We do <strong>not</strong> collect payment card details directly. If we introduce paid
          plans in future, payments will be handled by a PCI-DSS compliant third party.
        </P>

        {/* 3. Legal Basis */}
        <H2 id="legal-basis">3. Legal Basis for Processing</H2>
        <P>We only process your personal data where we have a lawful basis to do so.</P>
        <Table>
          <thead>
            <tr>
              <Th>Data</Th>
              <Th>Legal Basis</Th>
              <Th>Why</Th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <Td>Email, password, account tier</Td>
              <Td><strong>Contract</strong> (Art. 6(1)(b))</Td>
              <Td>Necessary to provide the service you signed up for</Td>
            </tr>
            <tr>
              <Td>Floor plans, room data, render images</Td>
              <Td><strong>Contract</strong> (Art. 6(1)(b))</Td>
              <Td>Core functionality — generating your room designs requires this data</Td>
            </tr>
            <tr>
              <Td>Usage data, analytics events, product clicks</Td>
              <Td><strong>Legitimate interests</strong> (Art. 6(1)(f))</Td>
              <Td>Improving service quality, understanding feature usage, detecting abuse. Our interests are not overridden by your rights; this data is used in aggregate form and you can request deletion at any time.</Td>
            </tr>
            <tr>
              <Td>Marketing emails (design tips, offers)</Td>
              <Td><strong>Consent</strong> (Art. 6(1)(a))</Td>
              <Td>You opted in during registration or in account settings. You can withdraw consent at any time via the unsubscribe link in any email or in Account Settings.</Td>
            </tr>
            <tr>
              <Td>Transactional emails (render ready, password reset, account deletion)</Td>
              <Td><strong>Contract</strong> (Art. 6(1)(b))</Td>
              <Td>Necessary to deliver the service and respond to your requests</Td>
            </tr>
          </tbody>
        </Table>

        {/* 4. Processors */}
        <H2 id="processors">4. Data Processors & International Transfers</H2>
        <P>
          We use the following trusted third-party service providers (&ldquo;data processors&rdquo;) to
          operate our service. All US-based providers are covered by Standard Contractual Clauses
          (SCCs) as a safeguard for international transfers of personal data from the UK.
        </P>
        <Table>
          <thead>
            <tr>
              <Th>Provider</Th>
              <Th>Purpose</Th>
              <Th>Location</Th>
              <Th>Transfer Safeguard</Th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <Td>Railway</Td>
              <Td>Backend application hosting and PostgreSQL database</Td>
              <Td>United States</Td>
              <Td>Standard Contractual Clauses</Td>
            </tr>
            <tr>
              <Td>Vercel</Td>
              <Td>Frontend application hosting</Td>
              <Td>United States</Td>
              <Td>Standard Contractual Clauses</Td>
            </tr>
            <tr>
              <Td>Cloudflare R2</Td>
              <Td>File storage (floor plans, render images, database backups)</Td>
              <Td>United States</Td>
              <Td>Standard Contractual Clauses</Td>
            </tr>
            <tr>
              <Td>Google Gemini</Td>
              <Td>AI image generation — your floor plan and room description are sent to Google&apos;s API to generate renders</Td>
              <Td>United States</Td>
              <Td>Standard Contractual Clauses</Td>
            </tr>
            <tr>
              <Td>Resend</Td>
              <Td>Transactional and marketing email delivery</Td>
              <Td>United States</Td>
              <Td>Standard Contractual Clauses</Td>
            </tr>
          </tbody>
        </Table>
        <P>
          We do not sell your personal data to any third party. We do not use your data for
          advertising on other platforms.
        </P>

        {/* 5. Retention */}
        <H2 id="retention">5. Retention Periods</H2>
        <Table>
          <thead>
            <tr>
              <Th>Data</Th>
              <Th>Retention period</Th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <Td>Account data (email, preferences)</Td>
              <Td>Until you delete your account</Td>
            </tr>
            <tr>
              <Td>Floor plan images</Td>
              <Td>Until the project is deleted</Td>
            </tr>
            <tr>
              <Td>Generated render images</Td>
              <Td>Until you delete them or delete your account</Td>
            </tr>
            <tr>
              <Td>Usage analytics and product click data</Td>
              <Td>2 years from collection, then automatically deleted</Td>
            </tr>
            <tr>
              <Td>Database backups</Td>
              <Td>Rolling 30-day window — older backups are automatically pruned</Td>
            </tr>
            <tr>
              <Td>Email logs (via Resend)</Td>
              <Td>As per Resend&apos;s retention policy (typically 90 days)</Td>
            </tr>
          </tbody>
        </Table>

        {/* 6. Rights */}
        <H2 id="rights">6. Your Rights Under UK GDPR</H2>
        <P>You have the following rights regarding your personal data:</P>
        <Table>
          <thead>
            <tr>
              <Th>Right</Th>
              <Th>What it means</Th>
              <Th>How to exercise</Th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <Td><strong>Right of access</strong></Td>
              <Td>Obtain a copy of all personal data we hold about you</Td>
              <Td>Account Settings → Download My Data (instant ZIP download)</Td>
            </tr>
            <tr>
              <Td><strong>Right to rectification</strong></Td>
              <Td>Correct inaccurate or incomplete data</Td>
              <Td>Email <a href="mailto:hello@myinteriordesigner.co.uk" className="underline">hello@myinteriordesigner.co.uk</a></Td>
            </tr>
            <tr>
              <Td><strong>Right to erasure</strong></Td>
              <Td>Have all your data permanently deleted (&ldquo;right to be forgotten&rdquo;)</Td>
              <Td>Account Settings → Privacy → Delete My Account (immediate)</Td>
            </tr>
            <tr>
              <Td><strong>Right to restrict processing</strong></Td>
              <Td>Ask us to stop processing your data while a dispute is resolved</Td>
              <Td>Email <a href="mailto:hello@myinteriordesigner.co.uk" className="underline">hello@myinteriordesigner.co.uk</a></Td>
            </tr>
            <tr>
              <Td><strong>Right to data portability</strong></Td>
              <Td>Receive your data in a structured, machine-readable format</Td>
              <Td>Account Settings → Download My Data (JSON + images ZIP)</Td>
            </tr>
            <tr>
              <Td><strong>Right to object</strong></Td>
              <Td>Object to processing based on legitimate interests (usage analytics)</Td>
              <Td>Email <a href="mailto:hello@myinteriordesigner.co.uk" className="underline">hello@myinteriordesigner.co.uk</a></Td>
            </tr>
            <tr>
              <Td><strong>Rights related to automated decision-making</strong></Td>
              <Td>Not to be subject to solely automated decisions with significant effects</Td>
              <Td>See Section 7 below — no significant automated decisions are made</Td>
            </tr>
            <tr>
              <Td><strong>Right to withdraw consent</strong></Td>
              <Td>Withdraw marketing consent at any time without affecting prior processing</Td>
              <Td>Unsubscribe link in any email, or Account Settings → Email Preferences</Td>
            </tr>
          </tbody>
        </Table>
        <P>
          We will respond to any data rights request within <strong>one calendar month</strong> as
          required by UK GDPR. For complex requests we may extend this by a further two months and
          will notify you if so.
        </P>

        {/* 7. AI */}
        <H2 id="ai">7. AI & Automated Processing</H2>
        <P>
          My Interior Designer uses <strong>Google Gemini</strong> to generate AI room renders.
          When you create a render, we send your floor plan image and room description (style,
          dimensions, furniture choices) to Google&apos;s Gemini API. Google processes this data
          solely to generate the image and does not retain it for training purposes under our
          agreement.
        </P>
        <P>
          <strong>Automated decision-making:</strong> The AI generates a design image based on
          your inputs. This is a <em>creative tool</em>, not a decision that significantly affects
          your legal rights or circumstances. You are free to regenerate renders, modify your
          inputs, or ignore the result entirely. No significant automated decisions about you as
          a person are made.
        </P>
        <P>
          <strong>Floor plan data:</strong> Your floor plan image may contain information about
          your home. We transmit it to Google only for render generation and store it in
          Cloudflare R2 for as long as your project exists. We recommend you do not upload floor
          plans containing information beyond what is necessary for design purposes.
        </P>

        {/* 8. Security */}
        <H2 id="security">8. Security</H2>
        <P>
          We take reasonable technical and organisational measures to protect your personal data,
          including:
        </P>
        <UL>
          <li>Passwords are hashed using bcrypt — we cannot read your password</li>
          <li>All data in transit is encrypted via TLS/HTTPS</li>
          <li>Authentication uses short-lived JWTs (7-day expiry)</li>
          <li>Rate limiting on all API endpoints to prevent brute-force attacks</li>
          <li>Daily automated database backups retained for 30 days</li>
          <li>Access to production systems is restricted to authorised personnel only</li>
          <li>Floor plan and render images are stored in private Cloudflare R2 storage</li>
        </UL>
        <P>
          No system is completely secure. If you discover a security vulnerability, please
          contact us at <a href="mailto:hello@myinteriordesigner.co.uk" className="underline">
          hello@myinteriordesigner.co.uk</a> before disclosing it publicly.
        </P>

        {/* 9. Cookies */}
        <H2 id="cookies">9. Cookie Policy</H2>
        <P>
          We use <strong>essential cookies only</strong>. We do not use tracking cookies,
          advertising cookies, or any third-party analytics cookies.
        </P>
        <Table>
          <thead>
            <tr>
              <Th>Cookie / Storage key</Th>
              <Th>Purpose</Th>
              <Th>Type</Th>
              <Th>Expiry</Th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <Td><code>rv_token</code> (localStorage)</Td>
              <Td>Stores your authentication JWT to keep you logged in</Td>
              <Td>Essential</Td>
              <Td>7 days or until you sign out</Td>
            </tr>
            <tr>
              <Td><code>cookie-consent</code> (localStorage)</Td>
              <Td>Remembers that you dismissed the cookie notice</Td>
              <Td>Essential</Td>
              <Td>Persistent (until you clear browser storage)</Td>
            </tr>
          </tbody>
        </Table>
        <P>
          Because we only use strictly necessary cookies, we do not require your consent to set
          them under PECR. You can clear your browser&apos;s localStorage at any time via your
          browser settings, which will sign you out.
        </P>

        {/* 10. Children */}
        <H2 id="children">10. Children</H2>
        <P>
          Our service is not directed at children under 13. We do not knowingly collect personal
          data from children. If you believe a child has provided us with their data, please
          contact us at <a href="mailto:hello@myinteriordesigner.co.uk" className="underline">
          hello@myinteriordesigner.co.uk</a> and we will delete it promptly.
        </P>

        {/* 11. Changes */}
        <H2 id="changes">11. Changes to This Policy</H2>
        <P>
          We may update this Privacy Policy from time to time. We will notify registered users
          by email of any material changes and update the &ldquo;last updated&rdquo; date at the
          top of this page. Continued use of the service after notification constitutes
          acceptance of the revised policy.
        </P>

        {/* 12. Complaints */}
        <H2 id="complaints">12. How to Complain</H2>
        <P>
          If you are unhappy with how we handle your personal data, please contact us first at{" "}
          <a href="mailto:hello@myinteriordesigner.co.uk" className="underline">
          hello@myinteriordesigner.co.uk</a>. We will investigate and respond within 30 days.
        </P>
        <P>
          You also have the right to lodge a complaint with the UK&apos;s data protection
          supervisory authority:
        </P>
        <div className="bg-stone-50 rounded-xl p-5 border border-stone-200 text-sm text-stone-700 space-y-1 mb-4">
          <p className="font-semibold">Information Commissioner&apos;s Office (ICO)</p>
          <p>Website: <a href="https://ico.org.uk" target="_blank" rel="noopener noreferrer" className="underline">ico.org.uk</a></p>
          <p>Helpline: 0303 123 1113</p>
        </div>

        {/* 13. Contact */}
        <H2 id="contact">13. Contact Us</H2>
        <P>
          For any privacy-related queries or to exercise your data rights, contact us at:
        </P>
        <div className="bg-stone-50 rounded-xl p-5 border border-stone-200 text-sm text-stone-700 space-y-1 mb-8">
          <p className="font-semibold">My Interior Designer — Privacy Enquiries</p>
          <p>Email: <a href="mailto:hello@myinteriordesigner.co.uk" className="underline">hello@myinteriordesigner.co.uk</a></p>
        </div>

        <div className="border-t border-stone-200 pt-6 mt-12">
          <div className="flex flex-wrap gap-4 text-sm text-stone-500">
            <Link href="/terms" className="hover:text-stone-900 underline transition-colors">Terms of Service</Link>
            <a href="mailto:hello@myinteriordesigner.co.uk" className="hover:text-stone-900 underline transition-colors">Contact Us</a>
            <Link href="/" className="hover:text-stone-900 underline transition-colors">Back to My Interior Designer</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
