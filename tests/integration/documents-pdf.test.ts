import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { getDb } from "@/db";
import { journalAudit, piecesAdministratives } from "@/db/schema";
import { deposerPiece, modifierPiece, telechargerPiece } from "@/lib/services/documents";
import { pdfAttestation, pdfConvocation, pdfRecu, pdfReleve } from "@/lib/services/pdf";
import { ajouterVersement } from "@/lib/services/finances";
import { creerUtilisateur, ctx, etudiantInscrit } from "../aide";

const PDF_MINIMAL = new TextEncoder().encode("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF");

describe("Documents administratifs et PDF", () => {
  it("dépose, valide et télécharge une pièce (téléchargement tracé)", async () => {
    const admin = await creerUtilisateur("admin");
    const { etudiant } = await etudiantInscrit();
    await deposerPiece(ctx(admin), etudiant.id, {
      type: "Pièce d’identité",
      fichier: new File([PDF_MINIMAL], "carte-identité.pdf", { type: "application/pdf" }),
      date_expiration: "2030-01-01",
      note: "",
    });
    const [p] = await getDb().select().from(piecesAdministratives);
    expect(p.statut).toBe("À vérifier");
    expect(p.mimeType).toBe("application/pdf");
    expect(p.chemin).toMatch(new RegExp(`^dossiers/${etudiant.id}/[0-9a-f]{40}\\.pdf$`));

    await modifierPiece(ctx(admin), p.id, { statut: "Validé", note: "Conforme" });
    const { contenu, piece } = await telechargerPiece(ctx(admin), p.id);
    expect(Buffer.from(contenu).toString()).toContain("%PDF");
    expect(piece.statut).toBe("Validé");
    const traces = await getDb().select().from(journalAudit).where(eq(journalAudit.action, "download"));
    expect(traces).toHaveLength(1);
  });

  it("refuse un fichier qui n’est ni un PDF ni une image, même renommé", async () => {
    const admin = await creerUtilisateur("admin");
    const { etudiant } = await etudiantInscrit();
    const faux = new File([new TextEncoder().encode("MZ exécutable")], "photo.png", { type: "image/png" });
    await expect(deposerPiece(ctx(admin), etudiant.id, { type: "Photo", fichier: faux })).rejects.toThrow("PDF, un JPG ou un PNG");
    const gros = new File([new Uint8Array(4 * 1024 * 1024 + 1)], "gros.pdf");
    await expect(deposerPiece(ctx(admin), etudiant.id, { type: "Autre", fichier: gros })).rejects.toThrow("4 Mo");
    expect(await getDb().select().from(piecesAdministratives)).toHaveLength(0);
  });

  it("génère de vrais PDF (attestation, relevé, reçu, convocation introuvable → erreur)", async () => {
    const admin = await creerUtilisateur("admin");
    const { inscription } = await etudiantInscrit();
    const attestation = await pdfAttestation(getDb(), inscription.id);
    expect(attestation.contenu.subarray(0, 5).toString()).toBe("%PDF-");
    expect(attestation.nom).toBe(`attestation-inscription-${inscription.id}.pdf`);
    const releve = await pdfReleve(getDb(), inscription.id);
    expect(releve.contenu.subarray(0, 5).toString()).toBe("%PDF-");
    const { versement } = await ajouterVersement(ctx(admin), inscription.id, {
      montant: "5000",
      date_versement: "2026-09-20",
      statut: "Validée",
      mode_paiement: "Mobile Money",
    });
    const recu = await pdfRecu(getDb(), versement.id);
    expect(recu.contenu.subarray(0, 5).toString()).toBe("%PDF-");
    await expect(pdfConvocation(getDb(), 999, 999)).rejects.toThrow("introuvable");
  });
});
