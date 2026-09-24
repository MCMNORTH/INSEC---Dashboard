/**
 * Centre d'alertes : les alertes sont recalculées à l'ouverture de la page, selon le rôle.
 */
import { and, between, eq, inArray, isNull, sql } from "drizzle-orm";
import type { Db } from "@/db";
import { affectationEnseignant, alertes, examens, inscriptions, piecesAdministratives, resultatsExamens, type User } from "@/db/schema";
import { montantEnRetard, resultatValide } from "@/lib/domain/calculs";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { formatDateAHeure, formatMru, formatNote } from "@/lib/format";

type AlerteInput = {
  cle: string;
  type: string;
  niveau: "info" | "warning" | "danger" | "success";
  titre: string;
  message: string;
  lien: string | null;
};

const JOUR = 86_400_000;

async function enregistrer(db: Db, userId: number, a: AlerteInput) {
  await db
    .insert(alertes)
    .values({ userId, ...a, active: true })
    .onConflictDoUpdate({
      target: [alertes.userId, alertes.cle],
      set: { type: a.type, niveau: a.niveau, titre: a.titre, message: a.message, lien: a.lien, active: true, updatedAt: new Date() },
    });
}

function alerteExamen(examen: { id: number; dateExamen: Date; salle: string | null; ue: { code: string } }, lien: string): AlerteInput {
  return {
    cle: `examen-${examen.id}`,
    type: "examen",
    niveau: "info",
    titre: "Examen à venir",
    message: `${examen.ue.code} — ${formatDateAHeure(examen.dateExamen)}${examen.salle ? ` (${examen.salle})` : ""}.`,
    lien,
  };
}

export async function synchroniserAlertes(db: Db, user: User, now = new Date()) {
  await db
    .update(alertes)
    .set({ active: false })
    .where(and(eq(alertes.userId, user.id), isNull(alertes.archiveeAt)));

  const role = user.role;
  const aEnregistrer: AlerteInput[] = [];

  if (["admin", "super_admin", "finance"].includes(role)) {
    const actives = await db.query.inscriptions.findMany({
      where: eq(inscriptions.statut, "active"),
      with: { etudiant: true, echeances: true, versements: true },
    });
    for (const i of actives) {
      const retard = montantEnRetard(i);
      if (retard > 0) {
        aEnregistrer.push({
          cle: `retard-paiement-${i.id}`,
          type: "finance",
          niveau: "danger",
          titre: "Paiement en retard",
          message: `${i.etudiant.prenom} ${i.etudiant.nom} présente un retard de ${formatMru(retard)}.`,
          lien: "/finances",
        });
      }
    }
  }

  if (["admin", "super_admin"].includes(role)) {
    const pieces = await db.query.piecesAdministratives.findMany({
      where: inArray(piecesAdministratives.statut, ["À vérifier", "Rejeté"]),
      with: { etudiant: true },
    });
    for (const p of pieces) {
      const rejete = p.statut === "Rejeté";
      aEnregistrer.push({
        cle: `document-${p.id}-${p.statut}`,
        type: "document",
        niveau: rejete ? "danger" : "warning",
        titre: rejete ? "Document rejeté à régulariser" : "Document à vérifier",
        message: `${p.type} — ${p.etudiant.prenom} ${p.etudiant.nom}.`,
        lien: `/etudiants/${p.etudiantId}/documents`,
      });
    }
    const proches = await db.query.examens.findMany({
      where: and(eq(examens.statut, "Planifié"), between(examens.dateExamen, now, new Date(now.getTime() + 7 * JOUR))),
      with: { ue: true },
    });
    for (const e of proches) aEnregistrer.push(alerteExamen(e, `/examens/${e.id}`));
  }

  if (role === "etudiant" && user.etudiantId) {
    const mesInscriptions = await db.query.inscriptions.findMany({
      where: eq(inscriptions.idEtudiant, user.etudiantId),
      with: { echeances: true, versements: true },
    });
    for (const i of mesInscriptions) {
      const retard = montantEnRetard(i);
      if (retard > 0) {
        aEnregistrer.push({
          cle: `mon-retard-${i.id}`,
          type: "finance",
          niveau: "danger",
          titre: "Échéance de paiement dépassée",
          message: `Votre montant en retard est de ${formatMru(retard)}.`,
          lien: "/portail/etudiant",
        });
      }
    }
    const ids = mesInscriptions.map((i) => i.id);
    if (ids.length) {
      const resultats = await db.query.resultatsExamens.findMany({
        where: inArray(resultatsExamens.inscriptionId, ids),
        with: { examen: { with: { ue: true } } },
      });
      for (const r of resultats) {
        const d = r.examen.dateExamen.getTime();
        if (r.examen.statut === "Planifié" && d >= now.getTime() && d <= now.getTime() + 14 * JOUR) {
          aEnregistrer.push(alerteExamen(r.examen, "/portail/etudiant"));
        }
        if (r.note !== null) {
          aEnregistrer.push({
            cle: `resultat-${r.id}-${Math.floor(r.updatedAt.getTime() / 1000)}`,
            type: "resultat",
            niveau: resultatValide(r, r.examen) ? "success" : "warning",
            titre: "Résultat publié",
            message: `${r.examen.ue.code} : ${formatNote(r.note)}/${formatNote(r.examen.noteSur)}.`,
            lien: "/portail/etudiant",
          });
        }
      }
    }
    const rejetees = await db
      .select()
      .from(piecesAdministratives)
      .where(and(eq(piecesAdministratives.etudiantId, user.etudiantId), eq(piecesAdministratives.statut, "Rejeté")));
    for (const p of rejetees) {
      aEnregistrer.push({
        cle: `mon-document-${p.id}`,
        type: "document",
        niveau: "danger",
        titre: "Document à remplacer",
        message: `${p.type}${p.note ? ` : ${p.note}` : " a été rejeté."}`,
        lien: "/portail/etudiant",
      });
    }
  }

  if (role === "enseignant" && user.enseignantId) {
    const ueIds = (
      await db
        .select({ ueId: affectationEnseignant.ueId })
        .from(affectationEnseignant)
        .where(eq(affectationEnseignant.enseignantId, user.enseignantId))
    ).map((a) => a.ueId);
    if (ueIds.length) {
      const proches = await db.query.examens.findMany({
        where: and(
          inArray(examens.ueId, ueIds),
          eq(examens.statut, "Planifié"),
          between(examens.dateExamen, now, new Date(now.getTime() + 14 * JOUR)),
        ),
        with: { ue: true },
      });
      for (const e of proches) aEnregistrer.push(alerteExamen(e, "/portail/enseignant"));
    }
  }

  for (const a of aEnregistrer) await enregistrer(db, user.id, a);
}

export async function nombreNonLues(db: Db, userId: number): Promise<number> {
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(alertes)
    .where(and(eq(alertes.userId, userId), eq(alertes.active, true), isNull(alertes.lueAt), isNull(alertes.archiveeAt)));
  return n;
}

async function alerteDe(db: Db, userId: number, alerteId: number) {
  const [a] = await db.select().from(alertes).where(eq(alertes.id, alerteId));
  if (!a) throw new NotFoundError("Alerte introuvable.");
  if (a.userId !== userId) throw new ForbiddenError();
  return a;
}

export async function lireAlerte(db: Db, userId: number, alerteId: number): Promise<string | null> {
  const a = await alerteDe(db, userId, alerteId);
  await db.update(alertes).set({ lueAt: new Date() }).where(eq(alertes.id, a.id));
  return a.lien;
}

export async function archiverAlerte(db: Db, userId: number, alerteId: number) {
  const a = await alerteDe(db, userId, alerteId);
  await db
    .update(alertes)
    .set({ archiveeAt: new Date(), lueAt: a.lueAt ?? new Date() })
    .where(eq(alertes.id, a.id));
}

export async function toutLire(db: Db, userId: number) {
  await db
    .update(alertes)
    .set({ lueAt: new Date() })
    .where(and(eq(alertes.userId, userId), eq(alertes.active, true), isNull(alertes.archiveeAt)));
}
