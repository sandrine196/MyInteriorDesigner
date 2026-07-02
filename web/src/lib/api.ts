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

// ── Agent session token (separate from user token) ────────────────────────────

const AGENT_TOKEN_KEY = "mid_agent_token";

export function getAgentToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(AGENT_TOKEN_KEY);
}

export function saveAgentToken(t: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(AGENT_TOKEN_KEY, t);
}

export function clearAgentToken() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(AGENT_TOKEN_KEY);
}

function agentRequest<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const headers = new Headers(opts.headers);
  // Don't set Content-Type for FormData — browser sets it with the multipart boundary
  if (opts.body != null && !(opts.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  const t = getAgentToken();
  if (t) headers.set("Authorization", `Bearer ${t}`);
  return request<T>(path, { ...opts, headers, auth: false });
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

export type User = { id: string; email: string; tier: "free" | "pro"; isAdmin?: boolean; marketingConsent: boolean; emailVerified: boolean };
export type AuthResponse = { token: string; user: User; firstProjectId?: string };

export const auth = {
  register: (email: string, password: string, marketingConsent = false, referredBy?: string, phone_number?: string, cfTurnstileToken?: string) =>
    request<AuthResponse>("/auth/register", {
      method: "POST",
      auth: false,
      body: JSON.stringify({ email, password, marketingConsent, ...(referredBy ? { referredBy } : {}), ...(phone_number ? { phone_number } : {}), ...(cfTurnstileToken ? { cfTurnstileToken } : {}) }),
    }),
  login: (email: string, password: string) =>
    request<AuthResponse>("/auth/login", {
      method: "POST",
      auth: false,
      body: JSON.stringify({ email, password }),
    }),
  me: () => request<User>("/auth/me"),
  verifyEmail: (token: string) =>
    request<{ verified: boolean }>(`/auth/verify-email?token=${encodeURIComponent(token)}`, { method: "GET", auth: false }),
  resendVerification: () =>
    request<{ sent: boolean }>("/auth/resend-verification", { method: "POST" }),
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
  fits: "perfect" | "tight" | "too_large" | "unknown";
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
  category: string | null;
  styleTags: string[];
  widthMm: number | null;
  depthMm: number | null;
  heightMm: number | null;
  fitResult: FitResult | null;
};

export type Render = {
  id: string;
  status: "pending" | "done" | "failed";
  prompt: string;
  imageUrl: string | null;
  alternativeImageUrl?: string | null;
  floorPlanInterpretation?: string | null;
  selectedRender?: number | null;
  errorMessage: string | null;
  products: RenderProduct[];
};

export type WallRole = "entrance" | "far" | "left" | "right";

export type DoorFeature = {
  type: "door";
  subtype: "single" | "double" | "sliding" | "bifold" | "sliding_patio" | "pocket";
  widthCm: number;
  opensInward: boolean;
  hingeSide: "left" | "right";
  leadsTo?: "garden" | "balcony" | "hallway" | "unknown";
  isGlazed?: boolean;
  floorToCeiling?: boolean;
};

export type WindowFeature = {
  type: "window";
  subtype: "single" | "double" | "triple" | "bay_angular" | "bow" | "box_bay" | "sash" | "floor_to_ceiling";
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
  | "home_office"
  | "bathroom"
  | "kitchen";

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
  floorPlanAnalysis: FloorPlanAnalysis | null;
  createdAt: string;
  renders: Render[];
};

export type FloorPlanAnalysis = {
  overallDescription: string;
  shapeDescription: string;
  dimensions: {
    lengthM: number;
    widthM: number;
    printedMeasurements: string;
    imperialMeasurements?: string;
    usableAreaM2: number;
  };
  openings: Array<{
    description: string;
    type: "door" | "window" | "patio_doors" | "french_doors" | "bifold_doors";
    approximateWidthM?: number;
    wall?: string;
    isGlazed?: boolean;
    keepClearCm?: number;
    isLightSource?: boolean;
  }>;
  specialFeatures: Array<{
    description: string;
    type: "fireplace" | "chimney_breast" | "staircase" | "alcove" | "built_in_storage" | "radiator" | "other";
    wall?: string;
    corner?: string;
    approximateSize?: string;
    keepClearCm?: number;
    isFocalPoint?: boolean;
  }>;
  lightingSources: string[];
  furniturePlacementNotes: string[];
  recommendedCamera: {
    shootFromWall: string;
    facingWall: string;
    focalPoint: string;
    reasoning: string;
  };
  wallAnalysis?: Record<string, string>;
  limitations: string;
  confidence: number;
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
    return request<{
      floorPlanKey: string;
      floorPlanUrl: string;
      floorPlanAnalysis: FloorPlanAnalysis | null;
      roomLengthMm: number | null;
      roomWidthMm: number | null;
    }>(`/projects/${id}/floor-plan`, {
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

export type RedesignMetrics = {
  funnel: {
    redesign_started:          number;
    redesign_completed:        number;
    redesign_try_another_style: number;
    redesign_signup_clicked:   number;
    redesign_limit_hit:        number;
  };
  completionRate:  number;
  signupRate:      number;
  totalSessions:   number;
  totalRedesigns:  number;
  totalRestages:   number;
  styleBreakdown:  Record<string, number>;
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
  top10: Array<{ rank: number; email: string; renderCount: number; joinedDaysAgo: number; lastLoginDaysAgo: number | null; emailVerified: boolean }>;
  recentLogins: Array<{ email: string; tier: string; lastLoginDaysAgo: number; lastLoginAt: string; renderCount: number; emailVerified: boolean }>;
  unverifiedCount: number;
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

export type LiveCostDataSource = "live_api" | "calculated" | "manual" | "error";

export type LiveCosts = {
  period: string;
  costs: { gemini: number; reve: number; railway: number; r2: number; resend: number; vercel: number; total: number };
  currency: "USD";
  renders: { total: number; regular: number; staging: number };
  dataSource: { gemini: LiveCostDataSource; reve: LiveCostDataSource; railway: LiveCostDataSource; r2: LiveCostDataSource; resend: LiveCostDataSource; vercel: LiveCostDataSource };
  errors: Record<string, string>;
  fetchedAt: string;
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
  liveCosts: (period?: "month" | "week" | "today") =>
    request<LiveCosts>(`/admin/live-costs${period ? `?period=${period}` : ""}`),
  marketingMetrics: (range?: string) =>
    request<MarketingMetrics>(`/admin/marketing-metrics${range ? `?range=${range}` : ""}`),
  redesignMetrics: (range?: string) =>
    request<RedesignMetrics>(`/admin/redesign-metrics${range ? `?range=${range}` : ""}`),
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
  reve: {
    status: () => request<{ ok: boolean; outOfCredits: boolean; rateLimited: boolean; lastErrorAt: string | null }>("/admin/reve-status"),
  },
  products: {
    sources:      () => request<{ sources: ProductSourceStats[] }>("/admin/products/sources"),
    importRaft:   () => request<{ success: boolean; imported: number; updated: number; skipped: number; total: number; withDimensions: number; stylesAssigned: number; firstError?: string }>("/admin/products/import/raft", { method: "POST" }),
    assignStyles:  () => request<{ success: boolean; processed: number; skipped: number; byStyle: Record<string, number> }>("/admin/products/assign-styles", { method: "POST" }),
    dbCheck:       () => request<{ total: number; byRetailer: { retailer: string; source: string | null; _count: { _all: number } }[]; databaseUrl: string }>("/admin/products/db-check"),
    recategorise:  () => request<{ success: boolean; processed: number; skipped: number; byCategory: Record<string, number> }>("/admin/products/recategorise", { method: "POST" }),
  },
  users: {
    list: () => request<Array<{ id: string; email: string; tier: string; suspended: boolean; emailVerified: boolean; createdAt: string; lastLoginAt: string | null; lastLoginIp: string | null; location: { country: string; countryCode: string; city: string } | null; projectCount: number; projects: { name: string; roomType: string | null; renderCount: number; latestRenderUrl: string | null }[] }>>("/admin/users"),
    setSuspended: (id: string, suspended: boolean) => request<{ id: string; suspended: boolean }>(`/admin/users/${id}/suspend`, { method: "PATCH", body: JSON.stringify({ suspended }) }),
    delete: (id: string) => request<{ ok: boolean }>(`/admin/users/${id}`, { method: "DELETE" }),
  },
  agents: {
    list:         () => request<{ agents: Array<{ id: string; name: string; agencyName: string; email: string; referralCode: string; status: string; clientsReferred: number; designsCreated: number; createdAt: string; lastLoginAt: string | null; lastLoginIp: string | null; location: { country: string; countryCode: string; city: string } | null }> }>("/admin/agents"),
    updateStatus: (id: string, status: string) => request<{ ok: boolean; status: string }>(`/admin/agents/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
    delete: (id: string) => request<{ ok: boolean }>(`/admin/agents/${id}`, { method: "DELETE" }),
  },
  impersonate: {
    list: () => request<{
      users:  Array<{ id: string; email: string; tier: string; isAdmin: boolean; createdAt: string }>;
      agents: Array<{ id: string; name: string; agencyName: string; email: string; status: string; referralCode: string }>;
    }>("/admin/impersonate/list"),
    asUser:  (userId: string)  => request<{ token: string; email: string }>("/admin/impersonate/user",  { method: "POST", body: JSON.stringify({ userId }) }),
    asAgent: (agentId: string) => request<{ token: string; email: string; name: string }>("/admin/impersonate/agent", { method: "POST", body: JSON.stringify({ agentId }) }),
  },
};

// ── Agents ────────────────────────────────────────────────────────────────────

export type AgentRegistration = {
  name: string;
  agencyName: string;
  email: string;
  phone?: string;
  phone_number?: string;
};

export type AgentDashboard = {
  name: string;
  agencyName: string;
  referralCode: string;
  referralUrl: string;
  clientsReferred: number;
  designsCreated: number;
  status: string;
  qrDataUrl: string;
};

export type StagingResult = {
  ok: boolean;
  imageUrl: string;
  emptyRoomUrl?: string; // furnished rooms only — the cleared room before staging
  mock: boolean;
};

export const agents = {
  register: (data: AgentRegistration) =>
    request<{ ok: boolean; agent: { id: string; name: string; agencyName: string; referralCode: string; referralUrl: string; dashboardUrl: string } }>(
      "/agents/register",
      { method: "POST", auth: false, body: JSON.stringify(data) }
    ),
  requestMagicLink: (email: string) =>
    request<{ ok: boolean }>(
      "/agents/magic-link",
      { method: "POST", auth: false, body: JSON.stringify({ email }) }
    ),
  exchangeMagicToken: (token: string) =>
    request<{ ok: boolean; token: string; agent: { name: string; agencyName: string; referralCode: string; status: string } }>(
      `/agents/auth?token=${encodeURIComponent(token)}`,
      { auth: false }
    ),
  dashboard: () =>
    agentRequest<AgentDashboard>("/agents/dashboard"),
  staging: (photo: File, brief: string, isFurnished: boolean) => {
    const form = new FormData();
    form.append("photo", photo);
    form.append("brief", brief);
    form.append("isFurnished", isFurnished.toString());
    return agentRequest<StagingResult>("/agents/staging", { method: "POST", body: form });
  },
};

// ── Redesign (public, no login) ───────────────────────────────────────────────

export type RedesignResult = {
  success:          boolean;
  stagedImageUrl:   string;
  emptyRoomUrl:     string;
};

export type RestageResult = {
  success:           boolean;
  stagedImageUrl:    string;
  restagesRemaining: number;
};

export const redesign = {
  // Session is managed via httpOnly cookie — browser sends it automatically with credentials: 'include'
  full: (photo: File, style: string): Promise<RedesignResult> => {
    const form = new FormData();
    form.append("photo", photo);
    form.append("style", style);
    return fetch(`${BASE}/redesign`, {
      method: "POST",
      credentials: "include",
      body: form,
    }).then(async (res) => {
      const data = await res.json();
      if (!res.ok) throw new ApiError(res.status, data.message ?? data.error ?? "Request failed");
      return data as RedesignResult;
    });
  },
  restage: (style: string): Promise<RestageResult> => {
    return fetch(`${BASE}/redesign/restage`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ style }),
    }).then(async (res) => {
      const data = await res.json();
      if (!res.ok) throw new ApiError(res.status, data.message ?? data.error ?? "Request failed");
      return data as RestageResult;
    });
  },
};

export interface ProductSourceStats {
  retailer:       string;
  label:          string;
  via:            string;
  total:          number;
  inStock:        number;
  withDimensions: number;
  byCategory:     Record<string, number>;
  lastSyncAt:     string | null;
  configured:     boolean;
}
