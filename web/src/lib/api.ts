import { config } from "@/config/index";

const BASE = config.apiUrl;

function token(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("rv_token");
}

export function saveToken(t: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem("rv_token", t);
}

export function clearToken() {
  if (typeof window === "undefined") return;
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

export type User = { id: string; email: string; tier: "free" | "pro"; isAdmin?: boolean; marketingConsent: boolean };
export type AuthResponse = { token: string; user: User };

export const auth = {
  register: (email: string, password: string, marketingConsent = false) =>
    request<AuthResponse>("/auth/register", {
      method: "POST",
      auth: false,
      body: JSON.stringify({ email, password, marketingConsent }),
    }),
  login: (email: string, password: string) =>
    request<AuthResponse>("/auth/login", {
      method: "POST",
      auth: false,
      body: JSON.stringify({ email, password }),
    }),
  me: () => request<User>("/auth/me"),
  exportData: async (): Promise<Blob> => {
    const t = token();
    const headers: Record<string, string> = {};
    if (t) headers["Authorization"] = `Bearer ${t}`;
    const res = await fetch(`${BASE}/me/export`, { headers });
    if (!res.ok) throw new ApiError(res.status, "Export failed");
    return res.blob();
  },
  deleteAccount: () =>
    request<{ ok: boolean; message: string }>("/me/delete-account", { method: "DELETE" }),
  updateMarketingConsent: (consent: boolean) =>
    request<{ ok: boolean; marketingConsent: boolean }>("/me/marketing-consent", {
      method: "PATCH",
      body: JSON.stringify({ consent }),
    }),
  unsubscribe: (token: string) =>
    request<{ ok: boolean }>(`/unsubscribe?token=${encodeURIComponent(token)}`, { auth: false }),
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

export type FitResult = {
  fits: "perfect" | "tight" | "too_large";
  clearanceCm: number;
  message: string;
  recommendation: string;
};

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
  fitResult: FitResult | null;
};

export type ProductsParams = {
  q?: string;
  retailer?: string;
  retailers?: string[];
  category?: string;
  maxPrice?: number;
  limit?: number;
  projectId?: string;
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
    if (params.projectId) qs.set("projectId", params.projectId);
    return request<{ items: Product[] }>(`/products?${qs}`);
  },
  click: (id: string) =>
    request<{ url: string | null }>(`/products/${id}/click`, { method: "POST" }),
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

export type WallRole = "entrance" | "far" | "left" | "right";

export type DoorFeature = {
  type: "door";
  subtype: "single" | "double" | "sliding" | "bifold";
  widthCm: number;
  opensInward: boolean;
  hingeSide: "left" | "right";
};

export type WindowFeature = {
  type: "window";
  subtype: "single" | "double" | "triple" | "bay_angular" | "bow" | "box_bay";
  widthCm: number;
  heightCm: number;
  heightFromFloorCm: number;
  hasRadiatorBelow: boolean;
  projectionCm?: number;
  hasWindowSeat?: boolean;
};

export type FireplaceFeature = {
  type: "fireplace";
  subtype: "traditional" | "inset" | "freestanding" | "electric";
  chimneyBreastWidthCm?: number;
};

export type NothingFeature = { type: "nothing" };

export type WallFeature = DoorFeature | WindowFeature | FireplaceFeature | NothingFeature;

export type WallData = { features: WallFeature[] };

export type RoomFeatures = {
  walls: Record<WallRole, WallData>;
  roomShape: "rectangular";
};

export type RoomType =
  | "living_room"
  | "dining_room"
  | "living_dining"
  | "bedroom_primary"
  | "bedroom_secondary"
  | "home_office";

export type Project = {
  id: string;
  name: string;
  roomType: RoomType | null;
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
  roomFeatures: RoomFeatures | null;
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
  create: (name: string, roomType: RoomType) =>
    request<{ project: Project }>("/projects", {
      method: "POST",
      body: JSON.stringify({ name, roomType }),
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
  saveFeatures: (id: string, roomFeatures: RoomFeatures) =>
    request<{ project: Project }>(`/projects/${id}/features`, {
      method: "PATCH",
      body: JSON.stringify({ roomFeatures }),
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

export type CostEntry = {
  id: string; provider: string; plan: string; monthlyCostGbp: number;
  month: number; year: number; status: string; notes: string | null;
};

export type RevenueEntry = {
  id: string; source: string; type: string; amountGbp: number;
  month: number; year: number; notes: string | null;
};

export type FinancialSummaryMonth = {
  label: string; month: number; year: number;
  totalCost: number; totalRevenue: number; profit: number;
};

export type MarketingMetrics = {
  styleDistribution:    Array<{ style: string | null; count: number; pct: number }>;
  roomTypeDistribution: Array<{ roomType: string | null; count: number; pct: number }>;
  topProducts:          Array<{ productId: string; productName: string; retailer: string; clicks: number }>;
  retailerClicks:       Array<{ retailer: string; clicks: number }>;
  renderTrend:          Array<{ date: string; count: number }>;
};

export type ClientMetrics = {
  metrics: {
    totalUsers: number; newUsersThisMonth: number; activeThisMonth: number;
    totalRenders: number; avgRendersPerUser: number; reEngaged: number;
    returnRate7d: number; returnRate30d: number; clickThroughRate: number;
  };
  funnel: Array<{ stage: string; count: number }>;
  limitMonitor: { freeLimit: number; nearLimit: number; atLimit: number };
  limitTable: Array<{ email: string; tier: string; renders: number; limit: number; usagePct: number }>;
  top10: Array<{ rank: number; email: string; renderCount: number; joinedDaysAgo: number }>;
  registrationTrend: Array<{ date: string; count: number }>;
};

export type SystemStats = {
  tables: Array<{ name: string; count: number }>;
};

export type SystemHealth = {
  status: "ok" | "degraded";
  checks: Record<string, { status: string; responseMs?: number; detail?: string }>;
  timestamp: string;
};

export type BackupEntry = {
  filename: string; key: string; sizeMB: string; createdAt: string; formattedDate: string; method: string;
};

export type BackupStats = {
  totalBackups: number;
  latestBackup: BackupEntry | null;
  totalSizeMB: string;
  nextScheduled: string | null;
  method: string;
  storageLocation: string | null;
};

export const admin = {
  metrics:          () => request<AdminMetrics>("/admin/metrics"),
  exportUrl:        (type: "users" | "renders") => `${BASE}/admin/export/${type}`,

  costs: {
    list:   (month: number, year: number) =>
      request<{ entries: CostEntry[] }>(`/admin/costs?month=${month}&year=${year}`),
    create: (data: Omit<CostEntry, "id">) =>
      request<{ entry: CostEntry }>("/admin/costs", { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: Partial<CostEntry>) =>
      request<{ entry: CostEntry }>(`/admin/costs/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    remove: (id: string) =>
      request<{ ok: boolean }>(`/admin/costs/${id}`, { method: "DELETE" }),
  },

  revenues: {
    list:   (month: number, year: number) =>
      request<{ entries: RevenueEntry[] }>(`/admin/revenues?month=${month}&year=${year}`),
    create: (data: Omit<RevenueEntry, "id">) =>
      request<{ entry: RevenueEntry }>("/admin/revenues", { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: Partial<RevenueEntry>) =>
      request<{ entry: RevenueEntry }>(`/admin/revenues/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    remove: (id: string) =>
      request<{ ok: boolean }>(`/admin/revenues/${id}`, { method: "DELETE" }),
  },

  financialSummary: () =>
    request<{ summary: FinancialSummaryMonth[]; cumulativeProfit: number }>("/admin/financial-summary"),
  marketingMetrics: (range?: string) =>
    request<MarketingMetrics>(`/admin/marketing-metrics${range ? `?range=${range}` : ""}`),
  clientMetrics: (range?: string) =>
    request<ClientMetrics>(`/admin/client-metrics${range ? `?range=${range}` : ""}`),

  system: {
    stats:  () => request<SystemStats>("/admin/system/stats"),
    health: () => request<SystemHealth>("/admin/system/health"),
  },

  backups: {
    list:    () => request<{ backups: BackupEntry[]; error?: string }>("/admin/backups"),
    run:     () => request<{ success: boolean; filename: string; sizeMB: string; rowCount: number; backupsRetained: number; method: string }>("/admin/backups/run", { method: "POST" }),
    stats:   () => request<BackupStats>("/admin/backups/stats"),
    restore: (backupKey: string) => request<{ success: boolean; rowsRestored: number }>("/admin/backups/restore", { method: "POST", body: JSON.stringify({ backupKey, confirm: "RESTORE" }) }),
  },
};
