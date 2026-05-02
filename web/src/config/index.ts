// Centralised frontend config.
// All environment access goes through here so regional changes are one-line edits.

export const config = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000",

  // NEXT_PUBLIC_REGION signals which deployment the user is talking to.
  // Used to show region-specific UI (e.g. cookie consent banner in EU).
  region: process.env.NEXT_PUBLIC_REGION ?? "UK",

  features: {
    analytics: process.env.NEXT_PUBLIC_ENABLE_ANALYTICS !== "false",
    // EU deployments set NEXT_PUBLIC_COOKIE_CONSENT=true to show the consent banner.
    cookieConsent: process.env.NEXT_PUBLIC_COOKIE_CONSENT === "true",
  },

  stripe: {
    publishableKey: process.env.NEXT_PUBLIC_STRIPE_KEY,
  },
};
