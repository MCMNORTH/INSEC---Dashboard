/**
 * Jeton de session signé (JWT HS256) stocké dans un cookie httpOnly.
 * Ce module n'importe que `jose` : il peut être utilisé dans proxy.ts.
 */
import { jwtVerify, SignJWT } from "jose";

export const COOKIE_SESSION = "insec_session";

export type SessionPayload = { uid: number; v: number; iat?: number; exp?: number };

/** Durée d'inactivité avant expiration (minutes), 120 par défaut comme l'ancienne application. */
export function dureeSessionMinutes(): number {
  return Number(process.env.SESSION_LIFETIME ?? 120);
}

function cle(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET doit contenir au moins 32 caractères.");
  }
  return new TextEncoder().encode(secret);
}

export async function signerSession(uid: number, version: number): Promise<string> {
  return new SignJWT({ uid, v: version })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${dureeSessionMinutes()}m`)
    .sign(cle());
}

export async function lireSession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, cle(), { algorithms: ["HS256"] });
    if (typeof payload.uid !== "number" || typeof payload.v !== "number") return null;
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export function optionsCookie(maxAgeSecondes = dureeSessionMinutes() * 60) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSecondes,
  };
}
