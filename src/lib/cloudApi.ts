import { HttpError } from "./errors";

const GOLOGIN_API_BASE_URL = "https://api.gologin.com";

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
      `GoLogin profile lookup failed with status ${response.status}.`,
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
