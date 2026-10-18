const configuredApiUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();

export const API_BASE_URL = (
  configuredApiUrl || "/api"
).replace(/\/+$/, "");

const DEFAULT_TIMEOUT_MS = 30_000;
const TRANSFER_TIMEOUT_MS = 120_000; // uploads and exports can legitimately take longer

export type User = {
  id: string;
  email: string;
  full_name: string | null;
  is_active: boolean;
  email_verified_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AuthResponse = {
  access_token: string;
  token_type: string;
  user?: User;
};

export type AccountBootstrap = {
  user: {
    id: string;
    email: string;
    full_name: string | null;
    email_verified: boolean;
    role: string;
  };
  organization: { id: string; name: string };
  subscription: {
    plan_code: string;
    plan_name: string;
    status: string;
    billing_provider: string | null;
    current_period_end: string | null;
  };
  usage: {
    reconciliation_runs_used: number;
    reconciliation_runs_limit: number;
    remaining_reconciliation_runs: number;
    files_uploaded: number;
    rows_processed: number;
    reset_at: string;
  };
  entitlements: {
    max_files_per_run: number;
    max_rows_per_file: number;
    max_users: number;
    max_client_workspaces: number;
    detailed_retention_days: number;
  };
  billing: {
    membership_linked: boolean;
    whop_status: string | null;
    pending_action: boolean;
  };
};

export type UploadedFile = {
  id: string;
  organization_id: string;
  uploaded_by_user_id: string;
  original_filename: string;
  stored_filename: string;
  file_type: string;
  row_count: number | null;
  status: string;
  created_at: string;
  updated_at: string;
};

export type FilePreview = {
  file_id: string;
  columns: string[];
  sample_rows: Record<string, unknown>[];
};

export type ColumnMapping = {
  date?: string | null;
  amount?: string | null;
  reference?: string | null;
  description?: string | null;
  customer_name?: string | null;
  currency?: string | null;
};

export type NormalizeResponse = {
  uploaded_file_id: string;
  status: "normalized" | "normalized_with_rejections" | "failed";
  total_rows: number;
  valid_rows: number;
  rejected_rows: number;
  rejected_examples: RejectedRecord[];
  message: string;
};

export type RejectedRecord = {
  id: string;
  uploaded_file_id: string;
  source_row_number: number;
  raw_data: Record<string, unknown>;
  rejection_reason: string;
  field_errors: Record<string, string> | null;
  created_at: string;
};

export type RejectedRecordsResponse = {
  uploaded_file_id: string;
  total_rejected: number;
  records: RejectedRecord[];
};

export type ReconciliationRun = {
  id: string;
  organization_id: string;
  created_by_user_id: string;
  file_a_id: string;
  file_b_id: string;
  status: string;
  created_at: string;
  updated_at: string;
};

export type NormalizedRecord = {
  id: string;
  transaction_date: string | null;
  amount: string | null;
  reference: string | null;
  description: string | null;
  customer_name: string | null;
};

export type MatchResult = {
  id: string;
  reconciliation_run_id: string;
  file_a_record_id: string | null;
  file_b_record_id: string | null;
  status: string;
  confidence_score: number;
  match_reason: string | null;
  amount_difference: string | null;
  date_difference_days: number | null;
  reference_similarity: number | null;
  description_similarity: number | null;
  created_at: string;
  reviewed_at: string | null;
  file_a_record: NormalizedRecord | null;
  file_b_record: NormalizedRecord | null;
};

export type ReconciliationResults = {
  run_id: string;
  status: string;
  green_matches: MatchResult[];
  yellow_possible_matches: MatchResult[];
  red_unmatched: MatchResult[];
  summary: {
    total_matches: number;
    green_count: number;
    yellow_count: number;
    red_count: number;
    approved_count: number;
    rejected_count: number;
  };
};

export type CurrentEntitlements = {
  plan: {
    code: string;
    name: string;
    monthly_price_usd: string;
    monthly_run_limit: number;
    max_files_per_run: number;
    max_rows_per_file: number;
    max_users: number;
    max_client_workspaces: number;
    detailed_retention_days: number;
    features: Record<string, unknown>;
  };
  usage: {
    period_start: string;
    period_end: string;
    reconciliation_runs_used: number;
    files_uploaded: number;
    rows_processed: number;
    exports_generated: number;
  };
  remaining_reconciliation_runs: number;
  remaining_file_capacity: number;
};

export type BillingStatus = {
  plan_code: string;
  plan_name: string;
  subscription_status: string;
  billing_provider: string | null;
  whop_linked: boolean;
  pending_whop_link: boolean;
  pending_reason: string | null;
  manage_url: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  message: string | null;
};

export class ApiError extends Error {
  status: number;
  fieldErrors?: Record<string, string>;
  /** Machine-readable reason from the API (e.g. "plan_limit_reached") or a client-side one
   *  ("timeout", "network_error", "session_expired", "invalid_response"). */
  code?: string;

  constructor(
    message: string,
    status: number,
    fieldErrors?: Record<string, string>,
    code?: string
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.fieldErrors = fieldErrors;
    this.code = code;
  }
}

export function getToken() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("novoriq_token");
}

export function setToken(token: string) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem("novoriq_token", token);
  }
}

export function clearToken() {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem("novoriq_token");
  }
}

type ErrorPayload = {
  detail?: string | Record<string, unknown> | Array<{ msg?: string }>;
  message?: string;
  code?: string;
};

function extractCode(payload: ErrorPayload | null): string | undefined {
  if (!payload) return undefined;
  if (typeof payload.code === "string") return payload.code;
  const detail = payload.detail;
  if (detail && typeof detail === "object" && !Array.isArray(detail)) {
    const code = detail.code ?? detail.error_code;
    if (typeof code === "string") return code;
  }
  return undefined;
}

async function parseError(
  response: Response,
  path: string
): Promise<{ message: string; code?: string }> {
  const status = response.status;

  // Body is best-effort. Proxies and rate limiters often answer with plain text or HTML, and the
  // friendly status-based messages below must still apply in that case (they previously only
  // applied when the body happened to be valid JSON).
  let payload: ErrorPayload | null = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  const code = extractCode(payload);

  if (status === 409 && path === "/auth/register") {
    return { message: "An account with this email already exists. Log in or use another email.", code };
  }
  if (status === 401 && path === "/auth/login") {
    return { message: "Email or password is incorrect.", code };
  }
  if (status === 401 && path !== "/auth/register") {
    return { message: "Your session has expired. Please log in again.", code: code ?? "session_expired" };
  }
  if (status === 429) {
    return { message: "Too many attempts. Please wait before trying again.", code };
  }
  if (status >= 500 && path === "/auth/register") {
    return { message: "Something went wrong while creating your workspace. Please try again.", code };
  }
  if (status >= 500) {
    return { message: "Something went wrong. Please try again.", code };
  }

  if (payload) {
    if (typeof payload.detail === "string") return { message: payload.detail, code };
    if (Array.isArray(payload.detail)) {
      return { message: payload.detail.map((item) => item.msg ?? "Invalid field").join(", "), code };
    }
    if (payload.detail && typeof payload.detail === "object") {
      const message = payload.detail.message;
      if (typeof message === "string") return { message, code };
      return { message: "The server could not complete this request. Please try again.", code };
    }
    if (payload.message) return { message: payload.message, code };
  }
  return { message: response.statusText || "Request failed", code };
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: init.signal ?? controller.signal });
  } catch (err) {
    if (init.signal?.aborted) throw err; // the caller cancelled on purpose (e.g. React Query)
    if (controller.signal.aborted) {
      throw new ApiError("The request timed out. Please try again.", 0, undefined, "timeout");
    }
    throw new ApiError(
      "Novoriq could not reach the server. Please try again shortly.",
      0,
      undefined,
      "network_error"
    );
  } finally {
    clearTimeout(timer);
  }
}

async function request<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const headers = new Headers(init.headers);
  const token = getToken();
  const hasFormData =
    typeof FormData !== "undefined" && init.body instanceof FormData;
  const hasBody = init.body !== undefined && init.body !== null;

  // Only declare a JSON body when there is one (a Content-Type on bodiless GETs forces needless CORS preflights).
  if (hasBody && !hasFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetchWithTimeout(
    `${API_BASE_URL}${path}`,
    { ...init, headers },
    hasFormData ? TRANSFER_TIMEOUT_MS : DEFAULT_TIMEOUT_MS
  );

  if (!response.ok) {
    const { message, code } = await parseError(response, path);
    throw new ApiError(message, response.status, undefined, code);
  }

  if (response.status === 204) return undefined as T;

  // Read as text first: an empty body or an HTML page (for example a misconfigured /api proxy
  // answering 200 with index.html) must produce a clear error, not a raw JSON SyntaxError.
  const text = await response.text();
  if (!text) return undefined as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ApiError(
      "The server sent an unexpected response. Please try again.",
      response.status,
      undefined,
      "invalid_response"
    );
  }
}

async function download(path: string): Promise<Blob> {
  const headers = new Headers();
  const token = getToken();

  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetchWithTimeout(
    `${API_BASE_URL}${path}`,
    { headers },
    TRANSFER_TIMEOUT_MS
  );

  if (!response.ok) {
    const { message, code } = await parseError(response, path);
    throw new ApiError(message, response.status, undefined, code);
  }

  return response.blob();
}

export const api = {
  register: (payload: {
    full_name?: string;
    email: string;
    password: string;
    organization_name: string;
  }) =>
    request<AuthResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  login: (payload: { email: string; password: string }) =>
    request<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  me: () => request<User>("/auth/me"),
  getAccountBootstrap: () => request<AccountBootstrap>("/account/bootstrap"),

  requestEmailVerification: (payload: { email: string }) =>
    request<{ status: string }>("/auth/request-email-verification", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  verifyEmail: (payload: { token: string }) =>
    request<{ status: string }>("/auth/verify-email", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  listFiles: () => request<UploadedFile[]>("/files"),

  uploadFile: (payload: {
    file: File;
    prohibitedDataAcknowledged: boolean;
  }) => {
    const formData = new FormData();
    formData.append("file", payload.file);
    formData.append(
      "prohibited_data_acknowledged",
      String(payload.prohibitedDataAcknowledged)
    );
    return request<UploadedFile>("/files/upload", {
      method: "POST",
      body: formData,
    });
  },

  getCurrentEntitlements: () =>
    request<CurrentEntitlements>("/billing/current"),

  getBillingStatus: () => request<BillingStatus>("/billing/status"),

  syncWhopAccess: () =>
    request<BillingStatus>("/billing/sync-whop-access", {
      method: "POST",
    }),

  deleteFile: (fileId: string) =>
    request<void>(`/files/${fileId}`, { method: "DELETE" }),

  previewFile: (fileId: string) =>
    request<FilePreview>(`/files/${fileId}/preview`),

  normalizeFile: (fileId: string, mapping: ColumnMapping) =>
    request<NormalizeResponse>(`/files/${fileId}/normalize`, {
      method: "POST",
      body: JSON.stringify(mapping),
    }),

  getRejectedRecords: (fileId: string) =>
    request<RejectedRecordsResponse>(`/files/${fileId}/rejected-records`),

  listRuns: () => request<ReconciliationRun[]>("/reconciliation-runs"),

  createRun: (payload: { file_a_id: string; file_b_id: string }) =>
    request<ReconciliationRun>("/reconciliation-runs", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  getRun: (runId: string) =>
    request<ReconciliationRun>(`/reconciliation-runs/${runId}`),

  runMatching: (runId: string) =>
    request<ReconciliationResults>(`/reconciliation-runs/${runId}/run`, {
      method: "POST",
    }),

  getReconciliationResults: (runId: string) =>
    request<ReconciliationResults>(`/reconciliation-runs/${runId}/results`),

  approveMatch: (matchId: string) =>
    request<{ id: string; status: string; reviewed_at: string }>(
      `/match-results/${matchId}/approve`,
      { method: "POST" }
    ),

  rejectMatch: (matchId: string) =>
    request<{ id: string; status: string; reviewed_at: string }>(
      `/match-results/${matchId}/reject`,
      { method: "POST" }
    ),

  exportReconciliationRun: (runId: string) =>
    download(`/reconciliation-runs/${runId}/export`),

  deleteReconciliationRun: (runId: string) =>
    request<void>(`/reconciliation-runs/${runId}`, {
      method: "DELETE",
    }),
};