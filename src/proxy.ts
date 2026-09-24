import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_SESSION, lireSession, optionsCookie, signerSession } from "@/lib/auth/token";

const PUBLICS = ["/login", "/forgot-password", "/verify-email-code", "/reset-password", "/admission", "/health", "/api/cron"];

function estPublic(chemin: string): boolean {
  return PUBLICS.some((p) => chemin === p || chemin.startsWith(`${p}/`));
}

/**
 * Filtre d'entrée : redirige vers la connexion quand la session est absente ou expirée,
 * et prolonge la session (expiration glissante) quand l'utilisateur est actif.
 * Les contrôles de rôle sont faits dans chaque page et chaque action.
 */
export async function proxy(request: NextRequest) {
  const chemin = request.nextUrl.pathname;
  if (estPublic(chemin)) return NextResponse.next();

  const session = await lireSession(request.cookies.get(COOKIE_SESSION)?.value);
  if (!session) {
    if (chemin === "/") return NextResponse.redirect(new URL("/login", request.url));
    const url = new URL("/login", request.url);
    if (request.method === "GET") url.searchParams.set("next", chemin + request.nextUrl.search);
    const res = NextResponse.redirect(url);
    res.cookies.delete(COOKIE_SESSION);
    return res;
  }

  const res = NextResponse.next();
  const age = Date.now() / 1000 - (session.iat ?? 0);
  if (age > 300) {
    res.cookies.set(COOKIE_SESSION, await signerSession(session.uid, session.v), optionsCookie());
  }
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|logo-insec.png|robots.txt).*)"],
};
