import { HttpError } from "./errors";

const GOLOGIN_API_BASE_URL = "https://api.gologin.com";

export type CloudApiRequestOptions = {
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
};

function buildApiUrl(path: string, query?: CloudApiRequestOptions["query"]): string {
  const url = new URL(path.startsWith("http") ? path : `${GOLOGIN_API_BASE_URL}${path}`);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

async function readPayload(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return undefined;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function formatApiErrorDetail(payload: unknown): string | undefined {
  if (!payload) {
    return undefined;
  }
  if (typeof payload === "string") {
    return payload.slice(0, 500);
  }
  if (typeof payload === "object") {
    const value = payload as Record<string, unknown>;
    for (const key of ["message", "error", "reason"]) {
      if (typeof value[key] === "string" && value[key].length > 0) {
        return value[key].slice(0, 500);
      }
    }
    return JSON.stringify(value).slice(0, 500);
  }
  return String(payload).slice(0, 500);
}

export async function gologinApiRequest<T>(
  token: string,
  method: string,
  path: string,
  options: CloudApiRequestOptions = {},
): Promise<T> {
  const hasBody = options.body !== undefined;
  const response = await fetch(buildApiUrl(path, options.query), {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(hasBody ? { "Content-Type": "application/json" } : {}),
    },
    body: hasBody ? JSON.stringify(options.body) : undefined,
  });

  const payload = await readPayload(response);
  if (!response.ok) {
    const detail = formatApiErrorDetail(payload);
    throw new HttpError(
      `GoLogin API ${method} ${path} failed with status ${response.status}.`,
      response.status,
      detail,
    );
  }

  return payload as T;
}

export function asObjectPayload(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

export async function validateCloudToken(token: string): Promise<{ ok: true } | { ok: false; status?: number; detail: string }> {
  const response = await fetch(`${GOLOGIN_API_BASE_URL}/browser/v2`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (response.ok) {
    return { ok: true };
  }

  const body = await response.text();
  return {
    ok: false,
    status: response.status,
    detail: body.slice(0, 300) || `status ${response.status}`,
  };
}

export async function getProfile(profileId: string, token: string): Promise<{ id: string; name?: string } | null> {
  const response = await fetch(`${GOLOGIN_API_BASE_URL}/browser/${encodeURIComponent(profileId)}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const body = await response.text();
    throw new HttpError(
      `Gologin profile lookup failed with status ${response.status}.`,
      response.status,
      body.slice(0, 300),
    );
  }

  const data = (await response.json()) as { id?: string; name?: string };
  return {
    id: data.id ?? profileId,
    name: data.name,
  };
}
