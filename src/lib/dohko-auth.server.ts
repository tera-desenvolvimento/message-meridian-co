/**
 * Autenticação do operador Dohko (Super Admin de plataforma).
 *
 * Separada do Supabase Auth: o operador entra com **código + senha**.
 * Emitimos um JWT HS256 assinado com `DOHKO_ADMIN_JWT_SECRET` (Web Crypto,
 * compatível com workers) e armazenamos em cookie httpOnly `dohko_session`.
 */

const TTL_SECONDS = 60 * 60 * 8; // 8h
const COOKIE_NAME = "dohko_session";

const enc = new TextEncoder();
const dec = new TextDecoder();

function b64urlEncode(bytes: ArrayBuffer | Uint8Array): string {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = "";
  for (let i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function getKey(): Promise<CryptoKey> {
  const secret = process.env.DOHKO_ADMIN_JWT_SECRET;
  if (!secret) throw new Error("DOHKO_ADMIN_JWT_SECRET ausente");
  return crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export interface DohkoClaims {
  role: "dohko_superadmin";
  iat: number;
  exp: number;
}

export async function signDohkoToken(): Promise<string> {
  const header = b64urlEncode(enc.encode(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const now = Math.floor(Date.now() / 1000);
  const payload: DohkoClaims = { role: "dohko_superadmin", iat: now, exp: now + TTL_SECONDS };
  const body = b64urlEncode(enc.encode(JSON.stringify(payload)));
  const signingInput = `${header}.${body}`;
  const key = await getKey();
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(signingInput));
  return `${signingInput}.${b64urlEncode(sig)}`;
}

export async function verifyDohkoToken(token: string | null | undefined): Promise<DohkoClaims | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [h, b, s] = parts;
  try {
    const key = await getKey();
    const ok = await crypto.subtle.verify(
      "HMAC",
      key,
      b64urlDecode(s) as unknown as BufferSource,
      enc.encode(`${h}.${b}`),
    );
    if (!ok) return null;
    const payload = JSON.parse(dec.decode(b64urlDecode(b))) as DohkoClaims;
    if (payload.role !== "dohko_superadmin") return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

/** Compara strings em tempo constante. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function checkDohkoCredentials(code: string, password: string): boolean {
  const expectedCode = process.env.DOHKO_ADMIN_CODE ?? "dohkochatadmin";
  const expectedPw = process.env.DOHKO_ADMIN_PASSWORD ?? "dohkochatadmin";
  return timingSafeEqual(code, expectedCode) && timingSafeEqual(password, expectedPw);
}

export function sessionCookieHeader(token: string): string {
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${TTL_SECONDS}`;
}

export function clearSessionCookieHeader(): string {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export function readSessionCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === COOKIE_NAME) return rest.join("=");
  }
  return null;
}

export async function requireDohkoAdmin(request: Request): Promise<DohkoClaims | Response> {
  const token = readSessionCookie(request.headers.get("cookie"));
  const claims = await verifyDohkoToken(token);
  if (!claims) return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { "content-type": "application/json" },
  });
  return claims;
}
