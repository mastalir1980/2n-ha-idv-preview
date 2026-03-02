// ---------------------------------------------------------------------------
// API client – thin wrappers around fetch() for server endpoints
// ---------------------------------------------------------------------------

export interface PublicConfig {
  haBaseUrl: string;
  selectedEntityIds: string[];
}

export interface HaEntity {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown> & {
    friendly_name?: string;
  };
  last_changed: string;
  last_updated: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const msg =
      (body as any)?.error ?? (body as any)?.detail ?? `HTTP ${res.status}`;
    throw new ApiError(res.status, msg);
  }
  return body as T;
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export function getConfig(): Promise<PublicConfig> {
  return request<PublicConfig>("/api/config");
}

export function saveConfig(data: {
  haBaseUrl?: string;
  token?: string;
  selectedEntityIds?: string[];
}): Promise<PublicConfig> {
  return request<PublicConfig>("/api/config", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export function saveSelected(
  selectedEntityIds: string[]
): Promise<PublicConfig> {
  return request<PublicConfig>("/api/selected", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ selectedEntityIds }),
  });
}

// ---------------------------------------------------------------------------
// HA proxy
// ---------------------------------------------------------------------------

export function getStates(): Promise<HaEntity[]> {
  return request<HaEntity[]>("/api/ha/states");
}

export function callService(
  domain: string,
  service: string,
  body: Record<string, unknown>
): Promise<unknown> {
  return request<unknown>(`/api/ha/services/${domain}/${service}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
