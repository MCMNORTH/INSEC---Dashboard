/** Génération des PDF à partir des données de la base. */
import { renderToBuffer } from "@react-pdf/renderer";
import { eq } from "drizzle-orm";
import type { Db } from "@/db";
import { inscriptions, resultatsExamens, versements } from "@/db/schema";
import { creditsValides, resultatValide } from "@/lib/domain/calculs";
import { NotFoundError } from "@/lib/errors";
import { formatDate, formatDateAHeure, formatDateHeure, formatMru, formatNote } from "@/lib/format";
import { Attestation, Convocation, Recu, Releve } from "@/pdf/modeles";

const pad = (n: number) => String(n).padStart(6, "0");

export async function pdfAttestation(db: Db, inscriptionId: number) {
  const i = await db.query.inscriptions.findFirst({
    where: eq(inscriptions.id, inscriptionId),
    with: { etudiant: true, formation: true, annee: true, inscriptionUes: { with: { ue: true } } },
  });
  if (!i) throw new NotFoundError("Inscription introuvable.");
  const ues = i.inscriptionUes.map((x) => x.ue).sort((a, b) => a.ordre - b.ordre).map((u) => u.code);
  const contenu = await renderToBuffer(
    Attestation({
      nom: i.etudiant.nom,
      prenom: i.etudiant.prenom,
      email: i.etudiant.email,
      numeroIntec: i.numeroInscriptionIntec,
      formationLibelle: i.formation.libelle ?? i.formation.nom,
      formationCode: i.formation.code ?? i.formation.nom,
      anneeParcours: i.anneeParcours,
      annee: i.annee.libelle,
      ues,
      date: formatDate(new Date()),
      reference: `INS-${pad(i.id)}`,
    }),
  );
  return { contenu, nom: `attestation-inscription-${i.id}.pdf` };
}

export async function pdfReleve(db: Db, inscriptionId: number) {
  const i = await db.query.inscriptions.findFirst({
    where: eq(inscriptions.id, inscriptionId),
    with: { etudiant: true, formation: true, annee: true, resultats: { with: { examen: { with: { ue: true } } } } },
  });
  if (!i) throw new NotFoundError("Inscription introuvable.");
  const lignes = [...i.resultats]
    .sort((a, b) => a.examen.dateExamen.getTime() - b.examen.dateExamen.getTime())
    .map((r) => ({
      ue: `${r.examen.ue.code} · ${r.examen.ue.libelle}`,
      session: r.examen.session,
      date: formatDate(r.examen.dateExamen),
      note: r.note !== null ? `${formatNote(r.note)}/${formatNote(r.examen.noteSur)}` : r.presence,
      resultat: resultatValide(r, r.examen) ? "Validée" : "Non validée",
    }));
  const contenu = await renderToBuffer(
    Releve({
      nom: i.etudiant.nom,
      prenom: i.etudiant.prenom,
      formationCode: i.formation.code ?? i.formation.nom,
      annee: i.annee.libelle,
      anneeParcours: i.anneeParcours,
      numeroIntec: i.numeroInscriptionIntec,
      lignes,
      credits: creditsValides(i.resultats),
      genereLe: formatDateHeure(new Date()),
    }),
  );
  return { contenu, nom: `releve-notes-${i.id}.pdf` };
}

export async function pdfConvocation(db: Db, examenId: number, resultatId: number) {
  const r = await db.query.resultatsExamens.findFirst({
    where: eq(resultatsExamens.id, resultatId),
    with: {
      inscription: { with: { etudiant: true, formation: true } },
      examen: { with: { ue: true, annee: true } },
    },
  });
  if (!r || r.examenId !== examenId) throw new NotFoundError("Convocation introuvable.");
  const contenu = await renderToBuffer(
    Convocation({
      nom: r.inscription.etudiant.nom,
      prenom: r.inscription.etudiant.prenom,
      formationCode: r.inscription.formation.code ?? r.inscription.formation.nom,
      numeroIntec: r.inscription.numeroInscriptionIntec,
      ue: `${r.examen.ue.code} · ${r.examen.ue.libelle}`,
      session: r.examen.session,
      date: formatDateAHeure(r.examen.dateExamen),
      salle: r.examen.salle,
      annee: r.examen.annee.libelle,
      numero: `CONV-${pad(r.id)}`,
      genereLe: formatDate(new Date()),
    }),
  );
  return { contenu, nom: `convocation-examen-${r.id}.pdf` };
}

export async function pdfRecu(db: Db, versementId: number) {
  const v = await db.query.versements.findFirst({
    where: eq(versements.id, versementId),
    with: { inscription: { with: { etudiant: true, formation: true, annee: true } } },
  });
  if (!v) throw new NotFoundError("Versement introuvable.");
  const contenu = await renderToBuffer(
    Recu({
      numero: v.numeroRecu,
      date: formatDate(v.dateVersement),
      statut: v.statut,
      etudiant: `${v.inscription.etudiant.nom.toUpperCase()} ${v.inscription.etudiant.prenom}`,
      formation: `${v.inscription.formation.code ?? v.inscription.formation.nom} · ${v.inscription.annee.libelle}`,
      montant: formatMru(v.montant),
      mode: v.modePaiement,
      reference: v.reference,
      inscriptionId: v.inscriptionId,
    }),
  );
  return { contenu, nom: `recu-${v.numeroRecu ?? v.id}.pdf` };
}
