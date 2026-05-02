import Link from "next/link";
import Image from "next/image";

// ── Shared icon ───────────────────────────────────────────────────────────────

function LogoMark({ size = 7 }: { size?: number }) {
  const px = size * 4;
  return (
    <div
      className="rounded-lg bg-sage-600 flex items-center justify-center flex-shrink-0"
      style={{ width: px, height: px }}
    >
      <svg width={px * 0.55} height={px * 0.55} viewBox="0 0 14 14" fill="none" className="text-white">
        <rect x="1" y="5" width="5" height="8" rx="1" fill="currentColor" fillOpacity="0.85" />
        <rect x="8" y="2" width="5" height="11" rx="1" fill="currentColor" />
      </svg>
    </div>
  );
}

// ── Header ────────────────────────────────────────────────────────────────────

function Header() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-b border-stone-200">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <LogoMark size={7} />
          <span className="font-semibold text-stone-900 tracking-tight">My Interior Designer</span>
        </Link>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="text-sm text-stone-600 hover:text-stone-900 transition-colors px-3 py-2"
          >
            Sign in
          </Link>
          <Link
            href="/register"
            className="bg-stone-900 hover:bg-stone-800 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
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
    <section className="pt-32 pb-20 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Text */}
          <div>
            <div className="inline-flex items-center gap-2 bg-sage-50 border border-sage-200 text-sage-700 text-xs font-medium px-3 py-1.5 rounded-full mb-6">
              <span className="w-1.5 h-1.5 bg-sage-500 rounded-full" />
              Whether you've just moved in or refreshing your style
            </div>
            <h1 className="text-5xl font-bold text-stone-900 leading-tight tracking-tight mb-5">
              Transform any room<br />
              <span className="text-sage-600">with AI</span>
            </h1>
            <p className="text-lg text-stone-600 leading-relaxed mb-8 max-w-md">
              Upload your floor plan, get AI-generated rooms with real furniture from your favourite shops, then buy what you love.
            </p>
            <div className="flex flex-wrap gap-4 items-center">
              <Link
                href="/register"
                className="bg-stone-900 hover:bg-stone-800 text-white text-base font-medium px-6 py-3 rounded-xl transition-colors"
              >
                Start designing for free →
              </Link>
              <Link href="/login" className="text-sm text-stone-500 hover:text-stone-800 transition-colors">
                Already have an account? Sign in
              </Link>
            </div>
            <p className="text-sm text-stone-400 mt-4">5 free renders every month · No credit card needed</p>
          </div>

          {/* Hero render preview */}
          <div className="relative">
            <div className="bg-white rounded-3xl border border-stone-200 shadow-2xl shadow-stone-200/60 overflow-hidden">
              <div className="relative h-80">
                <Image
                  src="https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800&q=80&auto=format&fit=crop"
                  alt="Scandi minimalist living room render"
                  fill
                  className="object-cover"
                  priority
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between">
                  <div>
                    <span className="block text-white/80 text-xs mb-1">AI render · Scandi Minimalist</span>
                    <span className="bg-white/90 backdrop-blur-sm text-xs font-medium text-stone-800 px-3 py-1.5 rounded-full shadow-sm">
                      Living Room · £1,240 total
                    </span>
                  </div>
                  <span className="bg-sage-600/90 backdrop-blur-sm text-xs font-semibold text-white px-2.5 py-1.5 rounded-full flex items-center gap-1.5">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                    Ready
                  </span>
                </div>
              </div>
            </div>
            <div className="absolute -top-6 -right-6 w-32 h-32 bg-sage-100 rounded-full -z-10 blur-3xl opacity-70" />
            <div className="absolute -bottom-6 -left-6 w-40 h-40 bg-stone-100 rounded-full -z-10 blur-3xl" />
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Example Renders Gallery ───────────────────────────────────────────────────

const EXAMPLE_RENDERS = [
  {
    image: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=900&q=80&auto=format&fit=crop",
    room: "Living Room",
    style: "Scandi Minimalist",
    cost: "£1,240",
    alt: "Scandi minimalist living room with neutral tones and clean lines",
  },
  {
    image: "https://images.unsplash.com/photo-1586023492125-27b2c045efd3?w=900&q=80&auto=format&fit=crop",
    room: "Bedroom",
    style: "Modern Industrial",
    cost: "£980",
    alt: "Modern industrial bedroom with dark tones and exposed materials",
  },
  {
    image: "https://images.unsplash.com/photo-1513694203523-f8571b371e17?w=900&q=80&auto=format&fit=crop",
    room: "Living Room",
    style: "Cosy Traditional",
    cost: "£2,100",
    alt: "Cosy traditional living room with warm tones and classic furniture",
  },
  {
    image: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=900&q=80&auto=format&fit=crop",
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
            className="hidden sm:inline-flex items-center gap-2 text-sm font-medium text-sage-700 hover:text-sage-900 transition-colors flex-shrink-0"
          >
            Design yours →
          </Link>
        </div>
      </div>

      {/* Scroll carousel */}
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
                className="mt-3 block text-center text-xs font-medium text-sage-700 hover:text-sage-900 bg-sage-50 hover:bg-sage-100 border border-sage-200 rounded-lg py-2 transition-colors"
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

// ── Features ──────────────────────────────────────────────────────────────────

const FEATURES = [
  {
    title: "See Before You Buy",
    desc: "Get photorealistic AI renders of your room with real furniture placed exactly as it would look.",
    icon: (
      <svg className="w-5 h-5 text-sage-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    title: "Real Furniture, Real Prices",
    desc: "Shop from IKEA, Wayfair, John Lewis and more — with live prices and one-click buying.",
    icon: (
      <svg className="w-5 h-5 text-sage-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007z" />
      </svg>
    ),
  },
  {
    title: "Stay on Budget",
    desc: "Set your budget and we'll filter furniture to what you can actually afford. No nasty surprises.",
    icon: (
      <svg className="w-5 h-5 text-sage-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    title: "Free to Try",
    desc: "Get 5 free AI renders every month. No credit card required to get started today.",
    icon: (
      <svg className="w-5 h-5 text-sage-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
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
              <div className="w-10 h-10 bg-sage-100 rounded-xl flex items-center justify-center mb-4">
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
  { n: 1, title: "Tell us your style & budget", desc: "Choose your design aesthetic and set a budget so we show you furniture you can actually afford." },
  { n: 2, title: "Upload your floor plan", desc: "A quick photo of your room's floor plan is all we need. Hand-drawn is fine." },
  { n: 3, title: "Choose furniture you love", desc: "Browse real pieces from IKEA, Wayfair, John Lewis and more, filtered by your taste and budget." },
  { n: 4, title: "Get your AI render", desc: "Our AI places your chosen furniture in your room and generates a photorealistic design." },
  { n: 5, title: "Buy with one click", desc: "Love the look? Buy each piece directly from the retailer. What you see is what you get." },
];

function HowItWorks() {
  return (
    <section className="py-20 bg-stone-50">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-14">
          <h2 className="text-3xl font-bold text-stone-900 tracking-tight mb-3">How it works</h2>
          <p className="text-stone-500 text-sm">From floor plan to furniture order in five simple steps.</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-6 lg:gap-4">
          {STEPS.map((s, i) => (
            <div key={s.n} className="relative">
              {i < STEPS.length - 1 && (
                <div className="hidden lg:block absolute top-8 left-[calc(50%+2rem)] right-[-50%] h-px bg-stone-300" />
              )}
              <div className="text-center">
                <div className="w-16 h-16 bg-white border-2 border-stone-200 rounded-2xl flex items-center justify-center mx-auto mb-4 relative z-10 shadow-sm">
                  <span className="text-2xl font-bold text-sage-600">{s.n}</span>
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
            className="inline-flex items-center gap-2 bg-stone-900 hover:bg-stone-800 text-white font-medium px-6 py-3 rounded-xl transition-colors"
          >
            Get started for free →
          </Link>
        </div>
      </div>
    </section>
  );
}

// ── Pricing ───────────────────────────────────────────────────────────────────

function Pricing() {
  const freeFeatures = [
    "5 AI renders per month",
    "All 8 design styles",
    "Full furniture catalogue",
    "Budget filtering",
    "One-click shopping links",
  ];
  const proFeatures = [
    "Unlimited AI renders",
    "Priority generation",
    "Everything in Free",
    "Early access to new features",
  ];

  return (
    <section className="py-20 bg-white" id="pricing">
      <div className="max-w-3xl mx-auto px-6">
        <div className="text-center mb-14">
          <h2 className="text-3xl font-bold text-stone-900 tracking-tight mb-3">Simple, honest pricing</h2>
          <p className="text-stone-500 text-sm">Start free. Upgrade when you need more.</p>
        </div>
        <div className="grid sm:grid-cols-2 gap-5">
          <div className="bg-sage-50 border-2 border-sage-200 rounded-3xl p-8 flex flex-col">
            <span className="inline-flex self-start bg-sage-100 text-sage-700 text-xs font-semibold px-2.5 py-1 rounded-full mb-3">
              Most popular
            </span>
            <h3 className="text-2xl font-bold text-stone-900 mb-1">Free</h3>
            <p className="text-stone-500 text-sm mb-6">Perfect for getting started</p>
            <div className="mb-8">
              <span className="text-5xl font-bold text-stone-900">£0</span>
              <span className="text-stone-400 ml-1 text-sm">/ month</span>
            </div>
            <ul className="space-y-3 mb-8 flex-1">
              {freeFeatures.map((f) => (
                <li key={f} className="flex items-center gap-2.5 text-sm text-stone-700">
                  <svg className="w-4 h-4 text-sage-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  {f}
                </li>
              ))}
            </ul>
            <Link
              href="/register"
              className="block text-center bg-sage-600 hover:bg-sage-700 text-white font-medium py-3 rounded-xl transition-colors"
            >
              Start for free →
            </Link>
          </div>

          <div className="bg-stone-900 rounded-3xl p-8 flex flex-col">
            <div className="h-7 mb-3" />
            <h3 className="text-2xl font-bold text-white mb-1">Pro</h3>
            <p className="text-stone-400 text-sm mb-6">For anyone who loves great design</p>
            <div className="mb-8">
              <span className="text-5xl font-bold text-white">£9.99</span>
              <span className="text-stone-400 ml-1 text-sm">/ month</span>
            </div>
            <ul className="space-y-3 mb-8 flex-1">
              {proFeatures.map((f) => (
                <li key={f} className="flex items-center gap-2.5 text-sm text-stone-300">
                  <svg className="w-4 h-4 text-sage-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  {f}
                </li>
              ))}
            </ul>
            <Link
              href="/register"
              className="block text-center bg-white hover:bg-stone-100 text-stone-900 font-medium py-3 rounded-xl transition-colors"
            >
              Get started →
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Footer ────────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer className="bg-stone-900 py-14 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row items-start justify-between gap-10 mb-10">
          <div className="max-w-xs">
            <div className="flex items-center gap-2.5 mb-3">
              <LogoMark size={7} />
              <span className="font-semibold text-white tracking-tight">My Interior Designer</span>
            </div>
            <p className="text-stone-400 text-sm leading-relaxed">
              Your affordable interior designer, powered by AI.
            </p>
            <p className="text-stone-600 text-xs mt-2">MyInteriorDesigner.co.uk</p>
          </div>
          <div className="flex gap-12 text-sm text-stone-400">
            <div className="space-y-3">
              <p className="text-stone-500 text-xs font-semibold uppercase tracking-wider">Product</p>
              <Link href="/register" className="block hover:text-white transition-colors">Get started</Link>
              <Link href="/login" className="block hover:text-white transition-colors">Sign in</Link>
              <a href="#pricing" className="block hover:text-white transition-colors">Pricing</a>
            </div>
            <div className="space-y-3">
              <p className="text-stone-500 text-xs font-semibold uppercase tracking-wider">Legal</p>
              <a href="#" className="block hover:text-white transition-colors">Privacy policy</a>
              <a href="#" className="block hover:text-white transition-colors">Terms of service</a>
            </div>
          </div>
        </div>
        <div className="border-t border-stone-800 pt-6 text-xs text-stone-600">
          © {new Date().getFullYear()} MyInteriorDesigner.co.uk · All rights reserved
        </div>
      </div>
    </footer>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <div className="bg-stone-50 min-h-screen">
      <Header />
      <main>
        <Hero />
        <ExampleGallery />
        <Features />
        <HowItWorks />
        <Pricing />
      </main>
      <Footer />
    </div>
  );
}
