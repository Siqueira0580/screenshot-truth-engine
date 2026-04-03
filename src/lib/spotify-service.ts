const SPOTIFY_CLIENT_ID = "85638dde0472442cb6f7e4be8bec56d2";
const SPOTIFY_REDIRECT_URI = `${window.location.origin}/spotify-callback`;
const SPOTIFY_SCOPES = "user-read-private user-read-email playlist-modify-public playlist-modify-private";

// PKCE helpers
function generateRandomString(length: number): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("").slice(0, length);
}

async function sha256(plain: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  return crypto.subtle.digest("SHA-256", encoder.encode(plain));
}

function base64urlencode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let str = "";
  bytes.forEach((b) => (str += String.fromCharCode(b)));
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// ─── Token Storage ──────────────────────────────────────────────
function saveTokenData(data: { access_token: string; refresh_token?: string; expires_in?: number }) {
  sessionStorage.setItem("spotify_access_token", data.access_token);
  if (data.refresh_token) {
    sessionStorage.setItem("spotify_refresh_token", data.refresh_token);
  }
  if (data.expires_in) {
    const expiresAt = Date.now() + data.expires_in * 1000 - 60_000; // 1 min buffer
    sessionStorage.setItem("spotify_expires_at", String(expiresAt));
  }
}

// ─── Auth ───────────────────────────────────────────────────────
export async function startSpotifyAuth() {
  clearSpotifyToken();

  const codeVerifier = generateRandomString(128);
  const hashed = await sha256(codeVerifier);
  const codeChallenge = base64urlencode(hashed);

  sessionStorage.setItem("spotify_code_verifier", codeVerifier);
  sessionStorage.setItem("spotify_return_path", window.location.pathname + window.location.search);

  const params = new URLSearchParams({
    client_id: SPOTIFY_CLIENT_ID,
    response_type: "code",
    redirect_uri: SPOTIFY_REDIRECT_URI,
    scope: SPOTIFY_SCOPES,
    code_challenge_method: "S256",
    code_challenge: codeChallenge,
  });

  window.location.href = `https://accounts.spotify.com/authorize?${params.toString()}`;
}

export async function exchangeSpotifyCode(code: string): Promise<string> {
  const codeVerifier = sessionStorage.getItem("spotify_code_verifier");
  if (!codeVerifier) throw new Error("Code verifier not found");

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: SPOTIFY_CLIENT_ID,
      grant_type: "authorization_code",
      code,
      redirect_uri: SPOTIFY_REDIRECT_URI,
      code_verifier: codeVerifier,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    console.error("[Spotify] Token exchange failed:", err);
    throw new Error(err.error_description || "Failed to exchange code");
  }

  const data = await res.json();
  saveTokenData(data);
  sessionStorage.removeItem("spotify_code_verifier");
  console.log("[Spotify] Token obtained successfully, scopes:", data.scope);
  return data.access_token;
}

// ─── Refresh Token ──────────────────────────────────────────────
async function refreshAccessToken(): Promise<string> {
  const refreshToken = sessionStorage.getItem("spotify_refresh_token");
  if (!refreshToken) {
    throw new Error("SPOTIFY_EXPIRED");
  }

  console.log("[Spotify] Refreshing access token...");
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: SPOTIFY_CLIENT_ID,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) {
    console.error("[Spotify] Refresh failed, clearing tokens");
    clearSpotifyToken();
    throw new Error("SPOTIFY_EXPIRED");
  }

  const data = await res.json();
  saveTokenData(data);
  console.log("[Spotify] Token refreshed successfully");
  return data.access_token;
}

async function getValidToken(): Promise<string> {
  const expiresAt = sessionStorage.getItem("spotify_expires_at");
  const token = sessionStorage.getItem("spotify_access_token");

  if (token && expiresAt && Date.now() < Number(expiresAt)) {
    return token;
  }

  // Token expired or missing — try refresh
  return refreshAccessToken();
}

export function getSpotifyToken(): string | null {
  return sessionStorage.getItem("spotify_access_token");
}

export function getSpotifyTokenStatus(): { connected: boolean; expiresAt: number | null; remainingMs: number | null } {
  const token = sessionStorage.getItem("spotify_access_token");
  const expiresAtStr = sessionStorage.getItem("spotify_expires_at");
  if (!token) return { connected: false, expiresAt: null, remainingMs: null };
  const expiresAt = expiresAtStr ? Number(expiresAtStr) : null;
  const remainingMs = expiresAt ? Math.max(0, expiresAt - Date.now()) : null;
  return { connected: true, expiresAt, remainingMs };
}

export async function ensureValidToken(): Promise<string | null> {
  try {
    return await getValidToken();
  } catch {
    clearSpotifyToken();
    return null;
  }
}

export function clearSpotifyToken() {
  sessionStorage.removeItem("spotify_access_token");
  sessionStorage.removeItem("spotify_refresh_token");
  sessionStorage.removeItem("spotify_expires_at");
}

// ─── Core API caller ────────────────────────────────────────────
async function spotifyFetch(endpoint: string, options: RequestInit = {}, retryCount = 0): Promise<any> {
  let token = await getValidToken();

  const url = `https://api.spotify.com/v1${endpoint}`;
  console.log(`[Spotify API] ${options.method || "GET"} ${url}`);

  const doFetch = (t: string) =>
    fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${t}`,
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });

  let res = await doFetch(token);

  // If 401, try one refresh and retry
  if (res.status === 401) {
    console.warn("[Spotify API] 401 – tentando refresh...");
    try {
      token = await refreshAccessToken();
      res = await doFetch(token);
    } catch {
      clearSpotifyToken();
      throw new Error("SPOTIFY_EXPIRED");
    }
  }

  if (res.status === 401) {
    clearSpotifyToken();
    throw new Error("SPOTIFY_EXPIRED");
  }

  // Handle rate limiting (429) with retry
  if (res.status === 429 && retryCount < 3) {
    const retryAfter = parseInt(res.headers.get("Retry-After") || "2", 10);
    console.warn(`[Spotify API] 429 Rate limited – aguardando ${retryAfter}s (tentativa ${retryCount + 1}/3)`);
    await new Promise((r) => setTimeout(r, retryAfter * 1000));
    return spotifyFetch(endpoint, options, retryCount + 1);
  }

  // 403 on /me means auth issue; on other endpoints it may be permissions on that specific resource
  if (res.status === 403) {
    // Only treat as auth failure for profile/playlist-creation endpoints
    const isAuthCritical = endpoint === "/me" || (options.method === "POST" && endpoint.includes("/playlists"));
    if (isAuthCritical) {
      console.error("[Spotify API] 403 Forbidden on critical endpoint – re-auth needed.");
      clearSpotifyToken();
      throw new Error("SPOTIFY_FORBIDDEN");
    }
    // For search/other endpoints, just throw a regular error (don't clear token)
    console.warn(`[Spotify API] 403 on ${endpoint} – skipping (non-fatal).`);
    throw new Error(`Spotify 403 on ${endpoint}`);
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    console.error(`[Spotify API] Error ${res.status}:`, err);
    throw new Error(err.error?.message || `Spotify API error ${res.status}`);
  }

  if (res.status === 204) return null;
  return res.json();
}

// ─── Step 1: Get User ID ────────────────────────────────────────
export async function getSpotifyUserId(): Promise<string> {
  console.log("[Spotify] PASSO 1: Obtendo perfil do utilizador...");
  const data = await spotifyFetch("/me");
  if (!data?.id) {
    throw new Error("Não foi possível obter o perfil do utilizador do Spotify.");
  }
  console.log(`[Spotify] User ID: ${data.id}, Display: ${data.display_name}`);
  return data.id;
}

// ─── Step 2: Create Playlist ────────────────────────────────────
export async function createSpotifyPlaylist(userId: string, name: string, description?: string): Promise<string> {
  console.log(`[Spotify] PASSO 2: Criando playlist "${name}" para user ${userId}...`);
  const data = await spotifyFetch(`/users/${userId}/playlists`, {
    method: "POST",
    body: JSON.stringify({
      name,
      description: description || "Gerado automaticamente pelo SmartCifra",
      public: false,
    }),
  });
  if (!data?.id) {
    throw new Error("Não foi possível criar a playlist no seu perfil.");
  }
  console.log(`[Spotify] Playlist criada: ${data.id} (${data.external_urls?.spotify})`);
  return data.id;
}

// ─── Step 3: Search tracks ──────────────────────────────────────
export function sanitizeSearchQuery(text: string): string {
  return text
    .replace(/\(.*?\)|\[.*?\]/g, "")
    .replace(/-/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export interface SpotifySearchResult {
  uri: string;
  name: string;
  artist: string;
}

export async function searchSpotifyTrack(title: string, artist?: string): Promise<SpotifySearchResult | null> {
  const cleanTitle = sanitizeSearchQuery(title);
  const cleanArtist = artist ? sanitizeSearchQuery(artist) : "";
  const q = (cleanTitle + (cleanArtist ? " " + cleanArtist : "")).trim();

  console.log(`[Spotify] PASSO 3 – Buscando: "${q}" (original: "${title}" / "${artist || ""}")`);

  const data = await spotifyFetch(`/search?q=${encodeURIComponent(q)}&type=track&limit=1`);
  const track = data?.tracks?.items?.[0];
  if (!track) {
    console.log(`[Spotify] Nenhum resultado para: "${q}"`);
    return null;
  }
  console.log(`[Spotify] Encontrado: ${track.name} – ${track.artists?.[0]?.name} (${track.uri})`);
  return {
    uri: track.uri,
    name: track.name,
    artist: track.artists?.map((a: any) => a.name).join(", ") || "",
  };
}

// ─── Step 4: Add tracks to playlist ─────────────────────────────
export async function addTracksToPlaylist(playlistId: string, uris: string[]) {
  console.log(`[Spotify] PASSO 4: Adicionando ${uris.length} faixa(s) à playlist ${playlistId}...`);
  // Spotify allows max 100 per request
  for (let i = 0; i < uris.length; i += 100) {
    const batch = uris.slice(i, i + 100);
    await spotifyFetch(`/playlists/${playlistId}/tracks`, {
      method: "POST",
      body: JSON.stringify({ uris: batch }),
    });
    console.log(`[Spotify] Batch ${Math.floor(i / 100) + 1} adicionado (${batch.length} faixas)`);
  }
}
