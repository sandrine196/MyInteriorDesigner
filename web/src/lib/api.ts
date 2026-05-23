import { config } from "@/config/index";

const BASE = config.apiUrl;

function token(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("rv_token");
}

export function saveToken(t: string) {
  localStorage.setItem("rv_token", t);
}

export function clearToken() {
  localStorage.removeItem("rv_token");
}

async function request<T>(
  path: string,
  opts: RequestInit & { auth?: boolean } = {}
): Promise<T> {
  const { auth = true, ...rest } = opts;
  const headers = new Headers(rest.headers);
  if (rest.body != null && !(rest.body instanceof FormData)) {
    headers.set("Content-Type", headers.get("Content-Type") ?? "application/json");
  }
  if (auth) {
    const t = token();
    if (t) headers.set("Authorization", `Bearer ${t}`);
  }
  const res = await fetch(`${BASE}${path}`, { ...rest, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, (body as { error?: string }).error ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// ── Auth ─────────────────────────────────────────────────────────────────────

export type User = { id: string; email: string; tier: "free" | "pro"; isAdmin?: boolean };
export type AuthResponse = { token: string; user: User };

export const auth = {
  register: (email: string, password: string) =>
    request<AuthResponse>("/auth/register", {
      method: "POST",
      auth: false,
      body: JSON.stringify({ email, password }),
    }),
  login: (email: string, password: string) =>
    request<AuthResponse>("/auth/login", {
      method: "POST",
      auth: false,
      body: JSON.stringify({ email, password }),
    }),
  me: () => request<User>("/auth/me"),
  exportData: () =>
    request<Blob>("/me/export", { headers: { Accept: "application/json" } }),
  deleteAccount: () =>
    request<{ ok: boolean; message: string }>("/me/delete-account", { method: "DELETE" }),
  requestReset: (email: string) =>
    request<{ message: string }>("/auth/request-reset", {
      method: "POST",
      auth: false,
      body: JSON.stringify({ email }),
    }),
  resetPassword: (token: string, password: string) =>
    request<{ message: string }>("/auth/reset-password", {
      method: "POST",
      auth: false,
      body: JSON.stringify({ token, password }),
    }),
};

// ── Products ─────────────────────────────────────────────────────────────────

export type Product = {
  id: string;
  retailer: string;
  title: string;
  imageUrl: string | null;
  productUrl: string | null;
  affiliateUrl: string | null;
  widthMm: number | null;
  depthMm: number | null;
  heightMm: number | null;
  dimensionsRaw: string | null;
  priceGbp: number | null;
  category: string | null;
  styleTags: string[];
};

export type ProductsParams = {
  q?: string;
  retailer?: string;
  retailers?: string[];
  category?: string;
  maxPrice?: number;
  limit?: number;
};

export const products = {
  list: (params: ProductsParams = {}) => {
    const qs = new URLSearchParams();
    if (params.q) qs.set("q", params.q);
    if (params.retailers?.length) qs.set("retailers", params.retailers.join(","));
    else if (params.retailer) qs.set("retailer", params.retailer);
    if (params.category) qs.set("category", params.category);
    if (params.maxPrice != null) qs.set("maxPrice", String(params.maxPrice));
    if (params.limit) qs.set("limit", String(params.limit));
    return request<{ items: Product[] }>(`/products?${qs}`);
  },
};

// ── Projects ─────────────────────────────────────────────────────────────────

export type RenderProduct = {
  id: string;
  title: string;
  retailer: string;
  priceGbp: number | null;
  imageUrl: string;
  productUrl: string;
  affiliateUrl: string | null;
};

export type Render = {
  id: string;
  status: "pending" | "done" | "failed";
  prompt: string;
  imageUrl: string | null;
  errorMessage: string | null;
  products: RenderProduct[];
};

export type Project = {
  id: string;
  name: string;
  floorPlanKey: string | null;
  floorPlanUrl: string | null;
  roomLengthMm: number | null;
  roomWidthMm: number | null;
  ceilingHeightMm: number | null;
  budgetMin: number | null;
  budgetMax: number | null;
  preferredRetailers: string[];
  designStyle: string | null;
  wallColorPalette: string | null;
  flooringType: string | null;
  createdAt: string;
  renders: Render[];
};

export type ProjectSetup = {
  budgetMin: number | null;
  budgetMax: number | null;
  preferredRetailers: string[];
  designStyle: string | null;
  wallColorPalette: string | null;
  flooringType: string | null;
};

export const projects = {
  list: () => request<{ projects: Project[] }>("/projects"),
  get: (id: string) => request<{ project: Project }>(`/projects/${id}`),
  create: (name: string) =>
    request<{ project: Project }>("/projects", {
      method: "POST",
      body: JSON.stringify({ name }),
    }),
  updateSetup: (id: string, data: ProjectSetup) =>
    request<{ project: Project }>(`/projects/${id}/setup`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  setDimensions: (
    id: string,
    dims: { roomLengthMm: number; roomWidthMm: number; ceilingHeightMm: number }
  ) =>
    request<{ project: Project }>(`/projects/${id}`, {
      method: "PATCH",
      body: JSON.stringify(dims),
    }),
  uploadFloorPlan: (id: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return request<{ floorPlanKey: string; floorPlanUrl: string }>(`/projects/${id}/floor-plan`, {
      method: "POST",
      body: form,
    });
  },
  createRender: (id: string, prompt: string, productIds: string[]) =>
    request<{ render: Render }>(`/projects/${id}/renders`, {
      method: "POST",
      body: JSON.stringify({ prompt, productIds }),
    }),
  deleteRender: (projectId: string, renderId: string) =>
    request<{ ok: boolean }>(`/projects/${projectId}/renders/${renderId}`, {
      method: "DELETE",
    }),
  delete: (id: string) =>
    request<{ ok: boolean }>(`/projects/${id}`, { method: "DELETE" }),
};

// ── Usage ────────────────────────────────────────────────────────────────────

export type Usage = {
  tier: string;
  freeLimit: number;
  usedThisMonth: number;
  remaining: number | null;
};

export const usage = {
  get: () => request<Usage>("/me/usage"),
};

// ── Admin ─────────────────────────────────────────────────────────────────────

export type AdminMetrics = {
  users: { total: number; free: number; pro: number };
  newSignups7d: number;
  totalRenders: number;
  activeUsers7d: number;
  mrr: number;
  estimatedGeminiCosts: number;
  revenuePerUser: number;
  costPerRender: number;
  designStyleDistribution: Array<{ style: string; count: number }>;
  retailerDistribution: Array<{ retailer: string; count: number }>;
  averageBudget: number | null;
  rendersPerUser: number;
  topUsers: Array<{ id: string; email: string; tier: string; renderCount: number; createdAt: string }>;
  recentSignups: Array<{ id: string; email: string; tier: string; createdAt: string }>;
  recentRenders: Array<{ id: string; status: string; imageUrl: string | null; prompt: string; createdAt: string; projectName: string; userEmail: string }>;
  signupsPerDay: Array<{ date: string; count: number }>;
  rendersPerDay: Array<{ date: string; count: number }>;
};

export const admin = {
  metrics: () => request<AdminMetrics>("/admin/metrics"),
  exportUrl: (type: "users" | "renders") => `${BASE}/admin/export/${type}`,
};
