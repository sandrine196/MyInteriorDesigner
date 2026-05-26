"use client";
import { useEffect, useState } from "react";

const KEY = "cookie-consent";

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(KEY) !== "accepted") {
      setVisible(true);
    }
  }, []);

  function dismiss() {
    localStorage.setItem(KEY, "accepted");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-between gap-4 flex-wrap px-5 py-4 shadow-lg"
      style={{ background: "#062C3D", borderTop: "1px solid #1B4965" }}
    >
      <p className="text-sm text-stone-300 leading-relaxed max-w-xl">
        We use essential cookies to keep you logged in. No tracking or advertising cookies are used.{" "}
        <a
          href="/privacy#cookies"
          className="underline underline-offset-2 text-stone-400 hover:text-white transition-colors"
        >
          Learn more
        </a>
      </p>
      <button
        onClick={dismiss}
        className="shrink-0 px-5 py-2 rounded-lg text-sm font-medium text-white transition-colors"
        style={{ background: "#1B4965" }}
      >
        Got it
      </button>
    </div>
  );
}
