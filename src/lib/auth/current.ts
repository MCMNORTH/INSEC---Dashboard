import "server-only";
import { eq } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { forbidden, redirect } from "next/navigation";
import { cache } from "react";
import { getDb } from "@/db";
import { users, type User } from "@/db/schema";
import type { Ctx } from "@/lib/context";
import type { Role } from "@/lib/roles";
import { COOKIE_SESSION, lireSession } from "./token";

/** Utilisateur connecté (une seule requête SQL par rendu). Null si session absente, expirée ou révoquée. */
export const utilisateurCourant = cache(async (): Promise<User | null> => {
  const store = await cookies();
  const session = await lireSession(store.get(COOKIE_SESSION)?.value);
  if (!session) return null;
  const [user] = await getDb().select().from(users).where(eq(users.id, session.uid));
  if (!user || !user.active || user.sessionVersion !== session.v) return null;
  return user;
});

export async function exigerConnexion(): Promise<User> {
  const user = await utilisateurCourant();
  if (!user) redirect("/login");
  return user;
}

/** Équivalent du middleware `role:` Laravel : 403 si le rôle ne fait pas partie de la liste. */
export async function exigerRole(roles: readonly Role[]): Promise<User> {
  const user = await exigerConnexion();
  if (!(roles as readonly string[]).includes(user.role)) forbidden();
  return user;
}

async function metaRequete() {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
  return { ip, userAgent: h.get("user-agent") };
}

export async function adresseIp(): Promise<string> {
  return (await metaRequete()).ip ?? "inconnue";
}

/** Contexte de service pour un utilisateur autorisé. `route` sert au journal d'audit. */
export async function contexte(roles: readonly Role[] | null, route: string): Promise<Ctx & { user: NonNullable<Ctx["user"]> }> {
  const user = roles ? await exigerRole(roles) : await exigerConnexion();
  const meta = await metaRequete();
  return { db: getDb(), user: { id: user.id, name: user.name, role: user.role }, route, ...meta };
}

/** Contexte pour une action publique (formulaire d'admission). */
export async function contextePublic(route: string): Promise<Ctx> {
  const meta = await metaRequete();
  return { db: getDb(), user: null, route, ...meta };
}
