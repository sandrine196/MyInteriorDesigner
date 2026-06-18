import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";

export const metadata: Metadata = {
  title: "My Interior Designer — Affordable AI Interior Design for UK Homes",
  description: "Transform your empty room into your dream space. AI-powered room design with real furniture from top UK retailers in minutes. Upload your floor plan and see exactly how your furnished room will look.",
  openGraph: {
    title: "My Interior Designer — Affordable AI Interior Design for UK Homes",
    description: "Transform your empty room into your dream space. AI-powered room design with real furniture from top UK retailers in minutes.",
    url: "https://www.myinteriordesigner.co.uk",
  },
};

// ── Logo ──────────────────────────────────────────────────────────────────────
// MIDLogo.png            — beige/neutral background, for use on white/light bg
// MIDLogoPrussianBlue_Gold.png — Prussian Blue background, for dark bg

function Logo({ onDark = false, className = "" }: { onDark?: boolean; className?: string }) {
  return onDark ? (
    <Image
      src="/MIDLogoPrussianBlue_Gold.png"
      alt="My Interior Designer"
      width={200}
      height={140}
      className={className}
      priority
    />
  ) : (
    <Image
      src="/MIDLogo.png"
      alt="My Interior Designer"
      width={200}
      height={140}
      className={className}
      priority
    />
  );
}


// ── Header ────────────────────────────────────────────────────────────────────

function Header() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-b border-stone-200">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5" aria-label="My Interior Designer home">
          <Logo className="h-10 w-auto object-contain" />
          <span className="font-semibold text-[#062C3D] tracking-tight hidden sm:block">My Interior Designer</span>
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/login" className="text-sm text-stone-600 hover:text-stone-900 transition-colors px-3 py-2">
            Sign in
          </Link>
          <Link
            href="/register"
            className="bg-[#062C3D] hover:bg-[#051F2C] text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
          >
            Start free →
          </Link>
        </div>
      </div>
    </header>
  );
}

// ── Hero ──────────────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section
      className="pt-16 min-h-screen flex items-center"
      style={{ background: "linear-gradient(135deg, #062C3D 0%, #0D3F52 100%)" }}
    >
      <div className="max-w-6xl mx-auto px-6 py-20 w-full">
        <div className="grid lg:grid-cols-[1fr_420px] gap-14 items-center">

          {/* ── Left: text ── */}
          <div>
            {/* Logo in hero */}
            <div className="mb-10">
              <Logo onDark className="h-16 w-auto" />
            </div>

            <h1 className="text-4xl sm:text-5xl font-bold text-white leading-tight tracking-tight mb-5">
              Transform your empty room<br />
              into your{" "}
              <span style={{ color: "#D4A574" }}>dream space</span>
            </h1>

            <p className="text-lg text-blue-100/80 leading-relaxed mb-10 max-w-lg">
              AI-powered room design with real furniture in minutes. Upload your floor plan,
              choose your style, and see exactly how your furnished room will look before
              you buy anything.
            </p>

            {/* ── Instant redesign — lowest-friction entry point ────── */}
            <div className="mb-8 rounded-2xl overflow-hidden" style={{ background: "rgba(212,165,116,0.12)", border: "1px solid rgba(212,165,116,0.35)" }}>
              <div className="px-6 pt-6 pb-5">
                <div className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-widest rounded-full px-2.5 py-1 mb-3"
                  style={{ background: "rgba(212,165,116,0.2)", color: "#D4A574" }}>
                  FREE · NO SIGN UP NEEDED
                </div>
                <h2 className="text-xl font-bold text-white leading-snug mb-1.5">
                  Curious what your room could look like?
                </h2>
                <p className="text-blue-100/70 text-sm mb-4">
                  Upload a photo and see it redesigned in 40 seconds
                </p>
                <Link
                  href="/redesign"
                  className="inline-flex items-center gap-2 font-semibold px-5 py-3 rounded-xl text-sm transition-all active:scale-95 shadow-md hover:shadow-lg"
                  style={{ background: "#D4A574", color: "#1B3050" }}
                >
                  Try it now →
                </Link>
              </div>
            </div>

            {/* Two-path CTA */}
            <div className="grid sm:grid-cols-2 gap-4 mb-10">
              {/* Homeowner card */}
              <div className="bg-white/10 border border-white/20 rounded-2xl p-5 flex flex-col gap-3 hover:bg-white/15 transition-colors">
                <span className="text-2xl">🏠</span>
                <div>
                  <h3 className="text-white font-semibold text-base mb-1">I&apos;m a homeowner</h3>
                  <p className="text-blue-100/70 text-sm leading-relaxed">
                    Design your new space and shop furniture that fits perfectly
                  </p>
                </div>
                <Link
                  href="/register"
                  className="inline-flex items-center justify-center font-semibold px-5 py-2.5 rounded-xl text-sm transition-all shadow-md hover:shadow-lg active:scale-95 mt-auto"
                  style={{ background: "#D4A574", color: "#1B3050" }}
                >
                  Design my room →
                </Link>
              </div>

              {/* Agent card */}
              <div className="bg-white/10 border border-white/20 rounded-2xl p-5 flex flex-col gap-3 hover:bg-white/15 transition-colors">
                <span className="text-2xl">🏢</span>
                <div>
                  <h3 className="text-white font-semibold text-base mb-1">I&apos;m an estate agent or developer</h3>
                  <p className="text-blue-100/70 text-sm leading-relaxed">
                    Help your clients visualise their new home before they move in
                  </p>
                </div>
                <Link
                  href="/agents"
                  className="inline-flex items-center justify-center font-semibold px-5 py-2.5 rounded-xl text-sm transition-all border border-white/40 text-white hover:bg-white/10 active:scale-95 mt-auto"
                >
                  Partner with us →
                </Link>
              </div>
            </div>

            {/* Trust indicators */}
            <div className="flex flex-wrap gap-6 text-sm text-white/60">
              {[
                { icon: "⚡", label: "2 min average time" },
                { icon: "🛍", label: "6 top UK retailers" },
              ].map(({ icon, label }) => (
                <span key={label} className="flex items-center gap-2">
                  <span className="text-[#D4A574]">{icon}</span>
                  {label}
                </span>
              ))}
            </div>
          </div>

          {/* ── Right: room cards grid ── */}
          <div className="hidden lg:grid grid-cols-[1fr_160px] gap-3 h-[440px]">

            {/* Large living room card */}
            <div className="bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col">
              <div className="flex-1 relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="https://images.unsplash.com/photo-1618220179428-22790b461013?w=800&q=80&auto=format&fit=crop" alt="Modern Scandi living room" className="w-full h-full object-cover" />
                <span
                  className="absolute top-3 left-3 text-xs font-bold px-2.5 py-1 rounded-full tracking-widest"
                  style={{ background: "#062C3D", color: "#D4A574" }}
                >
                  MODERN
                </span>
              </div>
              <div className="p-4 border-t border-stone-100">
                <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Living Room</p>
                <p className="text-sm font-bold text-stone-900 mt-0.5">Scandi Minimalist</p>
                <p className="text-xs text-stone-400 mt-0.5">Est. total: £1,240</p>
              </div>
            </div>

            {/* Right column: 2 small cards stacked */}
            <div className="flex flex-col gap-3">
              <div className="bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col flex-1">
                <div className="relative flex-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&q=80&auto=format&fit=crop" alt="Contemporary kitchen" className="w-full h-full object-cover" />
                  <span
                    className="absolute top-2 left-2 text-xs font-bold px-2 py-0.5 rounded-full tracking-widest"
                    style={{ background: "#062C3D", color: "#D4A574", fontSize: "9px" }}
                  >
                    CLASSIC
                  </span>
                </div>
                <div className="px-3 py-2 border-t border-stone-100">
                  <p className="text-xs font-semibold text-stone-900 truncate">Kitchen</p>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col flex-1">
                <div className="relative flex-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=400&q=80&auto=format&fit=crop" alt="Cosy bedroom" className="w-full h-full object-cover" />
                  <span
                    className="absolute top-2 left-2 text-xs font-bold px-2 py-0.5 rounded-full tracking-widest"
                    style={{ background: "#062C3D", color: "#D4A574", fontSize: "9px" }}
                  >
                    COZY
                  </span>
                </div>
                <div className="px-3 py-2 border-t border-stone-100">
                  <p className="text-xs font-semibold text-stone-900 truncate">Bedroom</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Features ──────────────────────────────────────────────────────────────────

const FEATURES = [
  {
    title: "See Before You Buy",
    desc: "Get photorealistic AI renders of your room with real furniture placed exactly as it would look.",
    icon: (
      <svg className="w-5 h-5 text-[#062C3D]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    title: "Real Furniture, Real Prices",
    desc: "Shop from top UK retailers — Wayfair, John Lewis, Made.com, Habitat, Muji and more.",
    icon: (
      <svg className="w-5 h-5 text-[#062C3D]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007z" />
      </svg>
    ),
  },
  {
    title: "Stay on Budget",
    desc: "Set your budget and we filter furniture to what you can actually afford. No hidden costs. No surprises.",
    icon: (
      <svg className="w-5 h-5 text-[#062C3D]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
];

function Features() {
  return (
    <section className="py-20 bg-white">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-14">
          <h2 className="text-3xl font-bold text-stone-900 tracking-tight mb-3">
            Everything you need to design your home
          </h2>
          <p className="text-stone-500 max-w-xl mx-auto text-sm leading-relaxed">
            Professional interior design made affordable and accessible for everyone — right from your phone or laptop.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {FEATURES.map((f) => (
            <div key={f.title} className="bg-stone-50 rounded-2xl p-6 border border-stone-100">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ background: "#E5F0F4" }}>
                {f.icon}
              </div>
              <h3 className="font-semibold text-stone-900 mb-2 text-sm">{f.title}</h3>
              <p className="text-xs text-stone-500 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── How It Works ──────────────────────────────────────────────────────────────

const STEPS = [
  { n: 1, title: "Choose your style and set your budget", desc: "Pick your design aesthetic and tell us what you can spend. We'll only show furniture you can afford." },
  { n: 2, title: "Upload your floor plan", desc: "A quick photo of your floor plan is all we need. Hand-drawn works perfectly." },
  { n: 3, title: "Pick furniture or let AI choose for you", desc: "Browse real pieces from top UK retailers, or switch to Auto and let our AI curate the perfect selection." },
  { n: 4, title: "See your furnished room in seconds", desc: "Our AI places the furniture in your room and generates a photorealistic design you can actually visualise." },
  { n: 5, title: "Buy what you love with affiliate links", desc: "Love the look? Buy each piece directly from the retailer. What you see is exactly what you get." },
];

function HowItWorks() {
  return (
    <section className="py-20 bg-stone-50" id="how-it-works">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-14">
          <h2 className="text-3xl font-bold text-stone-900 tracking-tight mb-3">How it works</h2>
          <p className="text-stone-500 text-sm">From floor plan to furnished room in five simple steps.</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-6 lg:gap-4">
          {STEPS.map((s, i) => (
            <div key={s.n} className="relative">
              {i < STEPS.length - 1 && (
                <div className="hidden lg:block absolute top-8 left-[calc(50%+2rem)] right-[-50%] h-px bg-stone-300" />
              )}
              <div className="text-center">
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 relative z-10 shadow-sm border-2"
                  style={{ background: "white", borderColor: "#D4A574" }}
                >
                  <span className="text-2xl font-bold" style={{ color: "#062C3D" }}>{s.n}</span>
                </div>
                <h3 className="font-semibold text-stone-900 text-sm mb-2 leading-snug">{s.title}</h3>
                <p className="text-xs text-stone-500 leading-relaxed">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="text-center mt-12">
          <Link
            href="/register"
            className="inline-flex items-center gap-2 font-semibold px-6 py-3 rounded-xl text-sm transition-all hover:opacity-90"
            style={{ background: "#062C3D", color: "white" }}
          >
            Get started for free →
          </Link>
        </div>
      </div>
    </section>
  );
}

// ── Social Proof ──────────────────────────────────────────────────────────────

const USE_CASES = [
  {
    icon: "🏠",
    title: "New homeowners",
    desc: "Furnishing from scratch and not sure where to start? We help you see exactly what your rooms will look like — before spending a penny.",
  },
  {
    icon: "🔨",
    title: "Renovators",
    desc: "Visualise your new layout before committing to expensive furniture. Change styles instantly until it feels exactly right.",
  },
  {
    icon: "📐",
    title: "Renters maximising space",
    desc: "Small rooms, big ideas. See what actually fits and what actually works in your space before you buy.",
  },
  {
    icon: "🏡",
    title: "Estate agents",
    desc: "Show buyers what a property could look like furnished. Turn empty rooms into aspirational spaces that sell faster.",
  },
];

function SocialProof() {
  return (
    <section className="py-20 bg-white">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-14">
          <h2 className="text-3xl font-bold text-stone-900 tracking-tight mb-3">
            Join homeowners transforming their spaces
          </h2>
          <p className="text-stone-500 text-sm max-w-md mx-auto leading-relaxed">
            Whether you&apos;re starting from scratch or just refreshing a room, My Interior Designer fits right in.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {USE_CASES.map((u) => (
            <div
              key={u.title}
              className="rounded-2xl p-6 border border-stone-100"
              style={{ background: "#EEF6F8" }}
            >
              <span className="text-2xl mb-4 block">{u.icon}</span>
              <h3 className="font-semibold text-stone-900 text-sm mb-2">{u.title}</h3>
              <p className="text-xs text-stone-500 leading-relaxed">{u.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Example Renders Gallery ───────────────────────────────────────────────────

const EXAMPLE_RENDERS = [
  {
    image: "https://images.unsplash.com/photo-1600210492493-0946911123ea?w=900&q=80&auto=format&fit=crop",
    room: "Living Room",
    style: "Scandi Minimalist",
    cost: "£1,240",
    alt: "Scandi minimalist living room with pale wood, linen sofa and natural light",
  },
  {
    image: "https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=900&q=80&auto=format&fit=crop",
    room: "Bedroom",
    style: "Modern Luxury",
    cost: "£1,850",
    alt: "Modern luxury bedroom with upholstered headboard and warm lighting",
  },
  {
    image: "https://pub-34e2ea5097aa43cd9debc68d21a08e4d.r2.dev/assets/hero-cosy-traditional-living-room.jpg",
    room: "Living Room",
    style: "Cosy Traditional",
    cost: "£2,100",
    alt: "Cosy traditional British living room with warm tones and classic furniture",
  },
  {
    image: "https://images.unsplash.com/photo-1556911220-bff31c812dba?w=900&q=80&auto=format&fit=crop",
    room: "Kitchen",
    style: "Contemporary",
    cost: "£3,450",
    alt: "Contemporary kitchen with clean surfaces and modern appliances",
  },
];

function ExampleGallery() {
  return (
    <section className="py-20 bg-stone-50 overflow-hidden">
      <div className="max-w-6xl mx-auto px-6 mb-10">
        <div className="flex items-end justify-between gap-6">
          <div>
            <h2 className="text-3xl font-bold text-stone-900 tracking-tight mb-3">
              Real rooms, real furniture
            </h2>
            <p className="text-stone-500 text-sm max-w-md leading-relaxed">
              Every render uses actual pieces from UK retailers — with live prices so you know exactly what it costs to recreate the look.
            </p>
          </div>
          <Link
            href="/register"
            className="hidden sm:inline-flex items-center gap-2 text-sm font-medium transition-colors flex-shrink-0"
            style={{ color: "#062C3D" }}
          >
            Design yours →
          </Link>
        </div>
      </div>
      <div className="flex gap-5 overflow-x-auto snap-x snap-mandatory pl-6 pr-6 pb-4 scrollbar-hide">
        {EXAMPLE_RENDERS.map((r) => (
          <article
            key={r.style}
            className="snap-start flex-shrink-0 w-72 sm:w-80 bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden group"
          >
            <div className="relative h-52 overflow-hidden">
              <Image
                src={r.image}
                alt={r.alt}
                fill
                className="object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
              <span className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm text-xs font-semibold text-stone-700 px-2.5 py-1 rounded-full">
                {r.style}
              </span>
            </div>
            <div className="p-4">
              <p className="text-xs font-medium text-stone-400 uppercase tracking-wide mb-1">{r.room}</p>
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-stone-900">Total cost: {r.cost}</p>
              </div>
              <Link
                href="/register"
                className="mt-3 block text-center text-xs font-medium rounded-lg py-2 transition-colors border"
                style={{ color: "#062C3D", background: "#E5F0F4", borderColor: "#AECFDB" }}
              >
                Create yours →
              </Link>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

// ── About ─────────────────────────────────────────────────────────────────────

function About() {
  return (
    <section className="py-16 bg-stone-50 border-t border-stone-100" id="about">
      <div className="max-w-2xl mx-auto px-6 text-center">
        <h2 className="text-2xl font-bold text-stone-900 tracking-tight mb-4">
          About MyInteriorDesigner
        </h2>
        <p className="text-stone-500 text-sm leading-relaxed mb-6">
          MyInteriorDesigner is an AI-powered interior design tool for UK homeowners.
          Upload your floor plan, choose your style, and let our AI generate beautiful
          room designs with furniture recommendations that fit your space.
        </p>
        <p className="text-sm text-stone-400">Built with love in the UK 🇬🇧</p>
      </div>
    </section>
  );
}

// ── Footer ────────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer className="py-14 px-6" style={{ background: "#062C3D" }}>
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row items-start justify-between gap-10 mb-10">
          <div className="max-w-xs">
            <Logo onDark className="h-20 w-auto mb-4" />
            <p className="text-blue-200/70 text-sm leading-relaxed">
              Your affordable interior designer, powered by AI.
            </p>
            <p className="text-blue-300/40 text-xs mt-2">MyInteriorDesigner.co.uk</p>
          </div>
          <div className="flex gap-12 text-sm text-blue-200/60">
            <div className="space-y-3">
              <p className="text-blue-200/40 text-xs font-semibold uppercase tracking-wider">Product</p>
              <Link href="/register" className="block hover:text-white transition-colors">Get started</Link>
              <Link href="/login" className="block hover:text-white transition-colors">Sign in</Link>
            </div>
            <div className="space-y-3">
              <p className="text-blue-200/40 text-xs font-semibold uppercase tracking-wider">Legal</p>
              <Link href="/privacy" className="block hover:text-white transition-colors">Privacy policy</Link>
              <Link href="/terms" className="block hover:text-white transition-colors">Terms of service</Link>
              <a href="mailto:hello@myinteriordesigner.co.uk" className="block hover:text-white transition-colors">Contact us</a>
            </div>
          </div>
        </div>
        <div className="border-t border-white/10 pt-6 text-xs text-blue-200/30">
          © {new Date().getFullYear()} MyInteriorDesigner.co.uk · All rights reserved · ICO Registered: 00014236119
        </div>
      </div>
    </footer>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "My Interior Designer",
  applicationCategory: "LifestyleApplication",
  operatingSystem: "Web",
  url: "https://www.myinteriordesigner.co.uk",
  description: "AI-powered interior design tool for UK homeowners. Upload your floor plan, choose real furniture, and get photorealistic room renders.",
  offers: { "@type": "Offer", price: "0", priceCurrency: "GBP" },
  author: { "@type": "Organization", name: "My Interior Designer", url: "https://www.myinteriordesigner.co.uk" },
  areaServed: { "@type": "Country", name: "United Kingdom" },
};

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Header />
      <main>
        <Hero />
        <Features />
        <HowItWorks />
        <SocialProof />
        <ExampleGallery />
        <About />
      </main>
      <Footer />
    </div>
  );
}
