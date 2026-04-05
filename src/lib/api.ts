import {
  buildQueryString,
  getLocalStorage,
  httpStatusToToolError,
  log,
  ToolError,
  waitUntil,
} from '@opentabs-dev/plugin-sdk';

const API_BASE = 'https://api.airbase.in';

const currencyFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

// --- Auth helpers ---

export function isAuthenticated(): boolean {
  return getLocalStorage('id_token') !== null;
}

export async function waitForAuth(): Promise<boolean> {
  try {
    await waitUntil(() => isAuthenticated(), { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

function getReadHeaders(): Record<string, string> {
  const token = getLocalStorage('id_token');
  const company = getLocalStorage('currentCompany');
  if (!token || !company) {
    throw ToolError.auth('Not authenticated — please log in to Airbase');
  }
  return {
    Authorization: `Bearer ${token}`,
    'X-Airbase-Client': 'web-app',
    'X-Airbase-Company': company,
    'X-Airbase-Portal': 'customer',
  };
}

function addSardineToken(headers: Record<string, string>): Record<string, string> {
  const sardine = getLocalStorage('sardine_session_token');
  if (sardine) {
    headers['X-Airbase-Sardine-Token'] = `${new Date().toISOString()}--${sardine}`;
  }
  return headers;
}

function getWriteHeaders(): Record<string, string> {
  const headers = getReadHeaders();
  headers['Content-Type'] = 'application/json';
  return addSardineToken(headers);
}

function getUploadHeaders(): Record<string, string> {
  return addSardineToken(getReadHeaders());
}

// --- Request helpers ---

function buildUrl(
  path: string,
  params?: Record<string, string | number | boolean | (string | number | boolean)[] | undefined>,
): string {
  const qs = params ? buildQueryString(params) : '';
  return `${API_BASE}${path}${qs ? `?${qs}` : ''}`;
}

async function handleResponse<T>(response: Response, path: string): Promise<T> {
  if (!response.ok) {
    throw httpStatusToToolError(response, `Airbase API error: ${response.status} on ${path}`);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

// Uses fetch directly instead of the SDK's fetchJSON/fetchFromPage because those
// always set credentials:'include', which Brave browser blocks on cross-origin
// requests. Airbase uses Bearer token auth so cookies are not needed.
export async function airbaseGet<T>(
  path: string,
  params?: Record<string, string | number | boolean | (string | number | boolean)[] | undefined>,
): Promise<T> {
  const url = buildUrl(path, params);
  const response = await fetch(url, {
    headers: getReadHeaders(),
    signal: AbortSignal.timeout(30_000),
  });
  return handleResponse<T>(response, path);
}

export async function airbasePost<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: getWriteHeaders(),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
  return handleResponse<T>(response, path);
}

export async function airbasePatch<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'PATCH',
    headers: getWriteHeaders(),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
  return handleResponse<T>(response, path);
}

export async function airbaseUpload<T>(path: string, formData: FormData): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: getUploadHeaders(),
    body: formData,
    signal: AbortSignal.timeout(60_000),
  });
  return handleResponse<T>(response, path);
}

export async function airbaseDelete(path: string): Promise<void> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'DELETE',
    headers: getWriteHeaders(),
    signal: AbortSignal.timeout(30_000),
  });
  await handleResponse<void>(response, path);
}

/**
 * Airbase bulk endpoints return either a plain array or `{ expense_report_items: [...] }`.
 * This normalizes both shapes to a plain array.
 */
export function extractBulkItems<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result;
  if (result && typeof result === 'object' && 'expense_report_items' in result) {
    return (result as { expense_report_items: T[] }).expense_report_items ?? [];
  }
  return [];
}

// --- Formatting helpers ---

export function formatCents(cents: number, symbol = '$'): string {
  return `${symbol}${currencyFormatter.format(cents / 100)}`;
}

export function getCurrentUserId(): number {
  const idStr = getLocalStorage('apc_user_id');
  if (idStr) return Number(idStr);
  throw ToolError.auth('User ID not found — please log in to Airbase');
}

// --- Shared approval helpers ---

export interface ApprovalPolicyResponse {
  spend_type: string;
  approval_policy: {
    id: number;
    type: string;
    value: { id: number; first_name: string; last_name: string; email: string };
  }[];
  watchers: {
    id: number;
    type: string;
    value: { id: number; first_name: string; last_name: string; email: string };
  }[];
}

export async function getDefaultDepartmentTag(): Promise<number | undefined> {
  const userId = getLocalStorage('apc_user_id');
  if (!userId) return undefined;
  try {
    const defaults = await airbaseGet<{ department: { id: number } | null }>(
      `/customer/user/${userId}/default_gl_tags/`,
    );
    return defaults.department?.id;
  } catch {
    log.warn('Could not fetch default GL tags');
    return undefined;
  }
}

export async function getApprovalPolicy(params: {
  type: string;
  cost: number;
  spend_limit_window: string;
  service_id: number;
  subsidiary_id: number;
  department_tag_id?: number;
}): Promise<ApprovalPolicyResponse> {
  const queryParams: Record<string, string | number | boolean | undefined> = {
    type: params.type,
    cost: params.cost,
    admin_request: false,
    spend_limit_window: params.spend_limit_window,
    service_id: params.service_id,
    subsidiary_id: params.subsidiary_id,
  };
  if (params.department_tag_id) {
    queryParams.line_level_tag = params.department_tag_id;
  }
  return airbaseGet<ApprovalPolicyResponse>('/customer/approval_policy/search/', queryParams);
}
