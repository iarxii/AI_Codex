const AUTH_STORAGE_KEYS = [
  "token",
  "ai_active_space",
  "ai_sidebar_tab",
];

const TOKEN_EXP_SKEW_SECONDS = 30;

type JwtPayload = {
  exp?: number;
};

function decodeJwtPayload(token: string): JwtPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2 || !parts[1]) return null;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    const decoded = atob(padded);
    return JSON.parse(decoded) as JwtPayload;
  } catch {
    return null;
  }
}

export function isTokenExpired(token: string): boolean {
  const payload = decodeJwtPayload(token);
  if (!payload?.exp) return false;
  const nowSeconds = Math.floor(Date.now() / 1000);
  return payload.exp <= nowSeconds + TOKEN_EXP_SKEW_SECONDS;
}

export function clearAuthSession(): void {
  for (const key of AUTH_STORAGE_KEYS) {
    localStorage.removeItem(key);
  }
}

export function getValidToken(): string | null {
  const token = localStorage.getItem("token");
  if (!token) return null;
  if (!isTokenExpired(token)) return token;
  clearAuthSession();
  return null;
}
