"use client";
import { useEffect, useState } from "react";
import { products as api, type Product } from "@/lib/api";
import ProductLink from "@/components/ProductLink";

const RETAILERS = [
  { value: "", label: "All retailers" },
  { value: "john_lewis", label: "John Lewis" },
  { value: "wayfair", label: "Wayfair" },
  { value: "habitat", label: "Habitat" },
  { value: "made", label: "Made.com" },
] as const;

export default function ProductsPage() {
  const [items, setItems] = useState<Product[]>([]);
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [retailer, setRetailer] = useState<"" | "john_lewis" | "wayfair" | "habitat" | "made">("");
  const [loading, setLoading] = useState(false);

  // Debounce the search query by 300 ms to avoid a request on every keystroke
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(timer);
  }, [q]);

  useEffect(() => {
    setLoading(true);
    api.list({ q: debouncedQ || undefined, retailer: retailer || undefined, limit: 50 })
      .then((r) => setItems(r.items))
      .finally(() => setLoading(false));
  }, [debouncedQ, retailer]);

  return (
    <div>
      {/* Placeholder catalogue notice */}
      <div className="mb-6 flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 text-sm text-amber-800">
        <svg className="w-4 h-4 mt-0.5 flex-shrink-0 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd" />
        </svg>
        <span>
          <strong>Product images are illustrative.</strong> Real furniture from John Lewis, Wayfair, Habitat & Made.com is coming when affiliate partnerships go live.
        </span>
      </div>

      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-stone-900 tracking-tight">Browse furniture</h1>
        <p className="text-stone-500 mt-1 text-sm">Curated pieces from John Lewis, Wayfair, Habitat & Made.com.</p>
      </div>

      <div className="flex gap-3 mb-6 flex-wrap">
        <input
          type="search"
          placeholder="Search sofas, tables, rugs…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="flex-1 min-w-48 border border-stone-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sage-500 focus:border-transparent placeholder:text-stone-400"
        />
        <select
          value={retailer}
          onChange={(e) => setRetailer(e.target.value as typeof retailer)}
          className="border border-stone-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sage-500 focus:border-transparent bg-white text-stone-700"
        >
          {RETAILERS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <li key={i} className="bg-white rounded-2xl border border-stone-200 overflow-hidden animate-pulse">
              <div className="w-full h-48 bg-stone-100" />
              <div className="p-4">
                <div className="h-4 bg-stone-100 rounded w-3/4 mb-2" />
                <div className="h-3 bg-stone-100 rounded w-1/2 mb-4" />
                <div className="h-8 bg-stone-100 rounded-xl" />
              </div>
            </li>
          ))}
        </ul>
      ) : items.length === 0 ? (
        <div className="text-center py-16 px-4">
          <div className="w-14 h-14 bg-stone-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 15.803 7.5 7.5 0 0016.803 15.803z" />
            </svg>
          </div>
          <p className="text-stone-700 font-medium mb-1">No products found</p>
          <p className="text-stone-400 text-sm">Try a different search term or retailer filter.</p>
        </div>
      ) : (
        <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {items.map((p) => (
            <li key={p.id} className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden flex flex-col hover:shadow-md hover:border-stone-300 transition-all group">
              {p.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.imageUrl}
                  alt={p.title}
                  className="w-full h-48 object-contain bg-stone-50"
                />
              ) : (
                <div className="w-full h-48 bg-stone-50 flex items-center justify-center">
                  <svg className="w-10 h-10 text-stone-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                  </svg>
                </div>
              )}
              <div className="p-4 flex flex-col flex-1">
                <p className="font-medium text-stone-900 text-sm leading-snug mb-2">{p.title}</p>
                <div className="flex items-center justify-between text-xs text-stone-400 mb-1">
                  <span className="capitalize">{p.retailer.replace("_", " ")}</span>
                  {p.priceGbp != null && (
                    <span className="font-semibold text-stone-900 text-base">£{p.priceGbp}</span>
                  )}
                </div>
                {p.dimensionsRaw && (
                  <p className="text-xs text-stone-400 mb-3">{p.dimensionsRaw}</p>
                )}
                {p.productUrl && (
                  <ProductLink
                    id={p.id}
                    href={p.affiliateUrl ?? p.productUrl}
                    className="mt-auto inline-flex items-center justify-center gap-1.5 bg-stone-900 hover:bg-stone-800 text-white rounded-xl px-4 py-2 text-xs font-medium transition-colors"
                  >
                    Shop now →
                  </ProductLink>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
