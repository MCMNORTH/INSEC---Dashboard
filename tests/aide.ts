import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { anneesAcademiques, etudiants, formations, inscriptions, users } from "@/db/schema";
import { hacher } from "@/lib/auth/password";
import type { Ctx } from "@/lib/context";
import type { Notification } from "@/lib/mail";

export const boiteMail: Notification[] = [];

let compteur = 0;

export async function creerUtilisateur(role: string, extra: Partial<typeof users.$inferInsert> = {}) {
  compteur++;
  const [u] = await getDb()
    .insert(users)
    .values({
      name: `${role} ${compteur}`,
      email: `${role}${compteur}@insec.test`,
      password: await hacher("motdepasse-solide"),
      role,
      ...extra,
    })
    .returning();
  return u;
}

export function ctx(user?: { id: number; name: string; role: string } | null): Ctx {
  return {
    db: getDb(),
    user: user ? { id: user.id, name: user.name, role: user.role } : null,
    ip: "203.0.113.7",
    userAgent: "vitest",
    route: "test",
  };
}

export async function formation(code: "DGC" | "DSGC") {
  const [f] = await getDb().select().from(formations).where(eq(formations.code, code));
  return f;
}

export async function premiereAnnee() {
  const [a] = await getDb().select().from(anneesAcademiques).orderBy(anneesAcademiques.id).limit(1);
  return a;
}

export async function uesDe(code: "DGC" | "DSGC", annee: number) {
  const f = await formation(code);
  return getDb().query.ues.findMany({ where: (u, { and, eq }) => and(eq(u.formationId, f.id), eq(u.anneeParcours, annee)) });
}

export async function etudiantInscrit(email = "mariam@example.com", options: { anneeParcours?: number } = {}) {
  const db = getDb();
  const [e] = await db.insert(etudiants).values({ nom: "Ba", prenom: "Mariam", email, statutEtudiant: "Actif" }).returning();
  const f = await formation("DGC");
  const a = await premiereAnnee();
  const [i] = await db
    .insert(inscriptions)
    .values({ idEtudiant: e.id, idFormation: f.id, idAnneeAcademique: a.id, anneeParcours: options.anneeParcours ?? 1 })
    .returning();
  return { etudiant: e, inscription: i, formation: f, annee: a };
}
