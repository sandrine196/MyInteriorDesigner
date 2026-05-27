import Link from "next/link";
import Image from "next/image";

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

// ── Room illustrations ────────────────────────────────────────────────────────

function LivingRoomIllustration() {
  return (
    <svg viewBox="0 0 280 180" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      {/* Wall */}
      <rect width="280" height="180" fill="#F0EDE8" />
      {/* Floor */}
      <rect y="122" width="280" height="58" fill="#E2D5C0" />
      {/* Baseboard */}
      <rect y="119" width="280" height="5" fill="#D4C9B5" />
      {/* Window */}
      <rect x="96" y="14" width="88" height="60" rx="2" fill="#C8DDE8" />
      <rect x="96" y="14" width="88" height="60" rx="2" fill="none" stroke="#D4C9B5" strokeWidth="3" />
      <line x1="140" y1="14" x2="140" y2="74" stroke="#D4C9B5" strokeWidth="2" />
      <line x1="96" y1="44" x2="184" y2="44" stroke="#D4C9B5" strokeWidth="2" />
      {/* Curtains */}
      <rect x="88" y="8" width="14" height="78" rx="5" fill="#C8B89A" opacity="0.8" />
      <rect x="178" y="8" width="14" height="78" rx="5" fill="#C8B89A" opacity="0.8" />
      {/* Art piece */}
      <rect x="24" y="22" width="54" height="70" rx="3" fill="white" stroke="#D4C9B5" strokeWidth="2" />
      <rect x="30" y="28" width="42" height="58" rx="2" fill="#B0C4B8" />
      <ellipse cx="51" cy="57" rx="14" ry="14" fill="#89A899" />
      {/* Rug */}
      <ellipse cx="140" cy="138" rx="94" ry="14" fill="#C8B89A" opacity="0.45" />
      {/* Sofa back */}
      <rect x="46" y="91" width="188" height="19" rx="6" fill="#7A6650" />
      {/* Sofa body */}
      <rect x="46" y="104" width="188" height="32" rx="6" fill="#8B7560" />
      {/* Cushions */}
      <rect x="52" y="107" width="56" height="23" rx="5" fill="#C8B49A" />
      <rect x="112" y="107" width="56" height="23" rx="5" fill="#BFB09A" />
      <rect x="172" y="107" width="56" height="23" rx="5" fill="#C8B49A" />
      {/* Sofa arms */}
      <rect x="40" y="96" width="12" height="38" rx="5" fill="#6E5A46" />
      <rect x="228" y="96" width="12" height="38" rx="5" fill="#6E5A46" />
      {/* Coffee table top */}
      <rect x="88" y="142" width="104" height="16" rx="4" fill="#C4A87A" />
      <rect x="91" y="144" width="98" height="11" rx="3" fill="#D4BC90" />
      {/* Table legs */}
      <rect x="94" y="156" width="5" height="10" rx="2" fill="#B09060" />
      <rect x="181" y="156" width="5" height="10" rx="2" fill="#B09060" />
      {/* Plant */}
      <rect x="10" y="110" width="7" height="18" rx="2" fill="#9B8868" />
      <ellipse cx="13" cy="105" rx="20" ry="22" fill="#5B7A5B" />
      <ellipse cx="4" cy="112" rx="13" ry="16" fill="#4E6E4E" />
      {/* Floor lamp */}
      <rect x="250" y="88" width="4" height="40" fill="#C4B09A" />
      <ellipse cx="252" cy="88" rx="16" ry="7" fill="#EDE8E0" stroke="#C4B09A" strokeWidth="2" />
    </svg>
  );
}

function KitchenIllustration() {
  return (
    <svg viewBox="0 0 280 180" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      {/* Wall */}
      <rect width="280" height="180" fill="#EEE8DC" />
      {/* Floor */}
      <rect y="130" width="280" height="50" fill="#D8CCBA" />
      <rect y="127" width="280" height="5" fill="#C8BC9A" />
      {/* Tiles on wall (subtle) */}
      {[0,1,2,3,4,5,6].map((i) => [0,1,2,3].map((j) => (
        <rect key={`${i}-${j}`} x={i*40} y={j*32+2} width="39" height="31" rx="0"
          fill="none" stroke="#DDD5C5" strokeWidth="0.5" />
      )))}
      {/* Upper cabinets */}
      <rect x="14" y="18" width="252" height="64" rx="4" fill="#3A3028" />
      <rect x="18" y="22" width="108" height="56" rx="3" fill="#4A3E32" />
      <rect x="132" y="22" width="130" height="56" rx="3" fill="#4A3E32" />
      {/* Cabinet handles */}
      <rect x="68" y="48" width="8" height="4" rx="2" fill="#C4A87A" />
      <rect x="180" y="48" width="8" height="4" rx="2" fill="#C4A87A" />
      {/* Counter */}
      <rect x="14" y="100" width="252" height="14" rx="3" fill="#F0EAE0" stroke="#D4C9B5" strokeWidth="1" />
      {/* Counter body */}
      <rect x="14" y="113" width="252" height="20" rx="2" fill="#4A3E32" />
      {/* Sink */}
      <rect x="100" y="103" width="80" height="8" rx="2" fill="#D4D0CA" stroke="#C4BFB8" strokeWidth="1" />
      <ellipse cx="140" cy="107" rx="12" ry="3" fill="#C0BCB5" />
      {/* Tap */}
      <rect x="136" y="94" width="8" height="10" rx="2" fill="#C8C4BE" />
      {/* Hob / burners */}
      <ellipse cx="56" cy="108" rx="14" ry="5" fill="#3A3028" />
      <ellipse cx="56" cy="108" rx="9" ry="3" fill="#4A3E32" />
      {/* Stools */}
      <rect x="50" y="122" width="28" height="8" rx="3" fill="#8B7560" />
      <rect x="55" y="130" width="4" height="20" rx="2" fill="#7A6650" />
      <rect x="67" y="130" width="4" height="20" rx="2" fill="#7A6650" />
      <rect x="50" y="148" width="28" height="3" rx="1" fill="#6E5A46" />

      <rect x="120" y="122" width="28" height="8" rx="3" fill="#8B7560" />
      <rect x="125" y="130" width="4" height="20" rx="2" fill="#7A6650" />
      <rect x="137" y="130" width="4" height="20" rx="2" fill="#7A6650" />
      <rect x="120" y="148" width="28" height="3" rx="1" fill="#6E5A46" />

      <rect x="190" y="122" width="28" height="8" rx="3" fill="#8B7560" />
      <rect x="195" y="130" width="4" height="20" rx="2" fill="#7A6650" />
      <rect x="207" y="130" width="4" height="20" rx="2" fill="#7A6650" />
      <rect x="190" y="148" width="28" height="3" rx="1" fill="#6E5A46" />
      {/* Pendant lights */}
      <line x1="90" y1="0" x2="90" y2="70" stroke="#C4A87A" strokeWidth="2" />
      <ellipse cx="90" cy="73" rx="16" ry="8" fill="#F0E8D0" stroke="#C4A87A" strokeWidth="2" />
      <line x1="190" y1="0" x2="190" y2="70" stroke="#C4A87A" strokeWidth="2" />
      <ellipse cx="190" cy="73" rx="16" ry="8" fill="#F0E8D0" stroke="#C4A87A" strokeWidth="2" />
    </svg>
  );
}

function BedroomIllustration() {
  return (
    <svg viewBox="0 0 280 180" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      {/* Wall */}
      <rect width="280" height="180" fill="#F5F0F0" />
      {/* Floor */}
      <rect y="128" width="280" height="52" fill="#E8DED0" />
      <rect y="125" width="280" height="5" fill="#D8CEBC" />
      {/* Window */}
      <rect x="96" y="12" width="88" height="56" rx="2" fill="#C8DDE8" />
      <rect x="96" y="12" width="88" height="56" rx="2" fill="none" stroke="#D4C9B5" strokeWidth="3" />
      <line x1="140" y1="12" x2="140" y2="68" stroke="#D4C9B5" strokeWidth="2" />
      <line x1="96" y1="40" x2="184" y2="40" stroke="#D4C9B5" strokeWidth="2" />
      {/* Curtains */}
      <rect x="88" y="6" width="14" height="76" rx="5" fill="#D4BCBC" opacity="0.7" />
      <rect x="178" y="6" width="14" height="76" rx="5" fill="#D4BCBC" opacity="0.7" />
      {/* Headboard */}
      <rect x="50" y="78" width="180" height="40" rx="10" fill="#8B7060" />
      <rect x="58" y="86" width="74" height="24" rx="6" fill="#A08070" />
      <rect x="138" y="86" width="74" height="24" rx="6" fill="#A08070" />
      {/* Bed base */}
      <rect x="44" y="112" width="192" height="30" rx="6" fill="#7A6050" />
      {/* Mattress */}
      <rect x="48" y="110" width="184" height="28" rx="5" fill="#F0EAE5" />
      {/* Pillows */}
      <rect x="58" y="113" width="68" height="18" rx="8" fill="white" stroke="#EAE0D8" strokeWidth="1.5" />
      <rect x="154" y="113" width="68" height="18" rx="8" fill="white" stroke="#EAE0D8" strokeWidth="1.5" />
      {/* Duvet fold */}
      <rect x="48" y="125" width="184" height="13" rx="0" fill="#E8DDD5" />
      <path d="M 48 125 Q 140 132 232 125" fill="none" stroke="#D4C9BC" strokeWidth="1" />
      {/* Nightstands */}
      <rect x="10" y="112" width="32" height="28" rx="4" fill="#A08870" />
      <rect x="14" y="116" width="24" height="14" rx="2" fill="#B09880" />
      <rect x="238" y="112" width="32" height="28" rx="4" fill="#A08870" />
      <rect x="242" y="116" width="24" height="14" rx="2" fill="#B09880" />
      {/* Bedside lamp */}
      <rect x="24" y="98" width="4" height="16" fill="#C4B09A" />
      <ellipse cx="26" cy="97" rx="14" ry="6" fill="#F0E8DC" stroke="#C4B09A" strokeWidth="1.5" />
      <rect x="250" y="98" width="4" height="16" fill="#C4B09A" />
      <ellipse cx="252" cy="97" rx="14" ry="6" fill="#F0E8DC" stroke="#C4B09A" strokeWidth="1.5" />
      {/* Rug */}
      <ellipse cx="140" cy="152" rx="90" ry="12" fill="#D4BCBC" opacity="0.4" />
    </svg>
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

            {/* CTAs */}
            <div className="flex flex-wrap gap-4 items-center mb-10">
              <Link
                href="/register"
                className="inline-flex items-center gap-2 font-semibold px-7 py-3.5 rounded-xl text-sm transition-all shadow-lg hover:shadow-xl active:scale-95"
                style={{ background: "#D4A574", color: "#1B3050" }}
              >
                Start designing for free →
              </Link>
              <a
                href="#how-it-works"
                className="inline-flex items-center gap-2 font-medium px-6 py-3.5 rounded-xl text-sm border border-white/30 text-white hover:bg-white/10 transition-colors"
              >
                See how it works
              </a>
            </div>

            {/* Trust indicators */}
            <div className="flex flex-wrap gap-6 text-sm text-white/60">
              {[
                { icon: "✦", label: "5 free renders/month" },
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
                <LivingRoomIllustration />
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
                  <KitchenIllustration />
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
                  <BedroomIllustration />
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
  {
    title: "Free to Try",
    desc: "Get 5 free AI renders every month. No credit card required to get started today.",
    icon: (
      <svg className="w-5 h-5 text-[#062C3D]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
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
          <div className="rounded-3xl p-8 flex flex-col border-2" style={{ background: "#E5F0F4", borderColor: "#AECFDB" }}>
            <span className="inline-flex self-start text-xs font-semibold px-2.5 py-1 rounded-full mb-3" style={{ background: "#C5E0EB", color: "#062C3D" }}>
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
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} style={{ color: "#062C3D" }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  {f}
                </li>
              ))}
            </ul>
            <Link
              href="/register"
              className="block text-center font-medium py-3 rounded-xl transition-all hover:opacity-90 text-white"
              style={{ background: "#062C3D" }}
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
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} style={{ color: "#D4A574" }}>
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
              <a href="#pricing" className="block hover:text-white transition-colors">Pricing</a>
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
          © {new Date().getFullYear()} MyInteriorDesigner.co.uk · All rights reserved · ICO Registered: CSN9872434
        </div>
      </div>
    </footer>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      <Header />
      <main>
        <Hero />
        <Features />
        <HowItWorks />
        <SocialProof />
        <ExampleGallery />
        <Pricing />
      </main>
      <Footer />
    </div>
  );
}
