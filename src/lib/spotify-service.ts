const SPOTIFY_CLIENT_ID = "85638dde0472442cb6f7e4be8bec56d2";
const SPOTIFY_REDIRECT_URI = `${window.location.origin}/spotify-callback`;
const SPOTIFY_SCOPES = "playlist-modify-public playlist-modify-private";

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

// ─── Auth ───────────────────────────────────────────────────────
export async function startSpotifyAuth() {
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
    const err = await res.json();
    throw new Error(err.error_description || "Failed to exchange code");
  }

  const data = await res.json();
  sessionStorage.setItem("spotify_access_token", data.access_token);
  sessionStorage.removeItem("spotify_code_verifier");
  return data.access_token;
}

export function getSpotifyToken(): string | null {
  return sessionStorage.getItem("spotify_access_token");
}

export function clearSpotifyToken() {
  sessionStorage.removeItem("spotify_access_token");
}

// ─── API helpers ────────────────────────────────────────────────
async function spotifyFetch(endpoint: string, options: RequestInit = {}) {
  const token = getSpotifyToken();
  if (!token) throw new Error("Not authenticated with Spotify");

  const res = await fetch(`https://api.spotify.com/v1${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (res.status === 401) {
    clearSpotifyToken();
    throw new Error("SPOTIFY_EXPIRED");
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Spotify API error ${res.status}`);
  }

  // Some endpoints return 201 with body
  if (res.status === 204) return null;
  return res.json();
}

export async function getSpotifyUserId(): Promise<string> {
  const data = await spotifyFetch("/me");
  return data.id;
}

export interface SpotifySearchResult {
  uri: string;
  name: string;
  artist: string;
}

export async function searchSpotifyTrack(title: string, artist?: string): Promise<SpotifySearchResult | null> {
  const q = artist ? `track:${title} artist:${artist}` : title;
  const data = await spotifyFetch(`/search?q=${encodeURIComponent(q)}&type=track&limit=1`);
  const track = data?.tracks?.items?.[0];
  if (!track) return null;
  return {
    uri: track.uri,
    name: track.name,
    artist: track.artists?.map((a: any) => a.name).join(", ") || "",
  };
}

export async function createSpotifyPlaylist(userId: string, name: string, description?: string): Promise<string> {
  const data = await spotifyFetch(`/users/${userId}/playlists`, {
    method: "POST",
    body: JSON.stringify({
      name,
      description: description || "Criado pelo SmartCifra",
      public: false,
    }),
  });
  return data.id;
}

export async function addTracksToPlaylist(playlistId: string, uris: string[]) {
  // Spotify allows max 100 per request
  for (let i = 0; i < uris.length; i += 100) {
    const batch = uris.slice(i, i + 100);
    await spotifyFetch(`/playlists/${playlistId}/tracks`, {
      method: "POST",
      body: JSON.stringify({ uris: batch }),
    });
  }
}
