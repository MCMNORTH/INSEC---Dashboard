import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { etudiants, piecesAdministratives } from "@/db/schema";
import { auditManuel, creer, modifier } from "@/lib/audit";
import type { Ctx } from "@/lib/context";
import { NotFoundError, ValidationError, parse } from "@/lib/errors";
import { getStockage } from "@/lib/storage";
import { STATUTS_PIECE, TYPES_PIECE, dateJourOptionnelle, parmi, texteOptionnel } from "@/lib/validation";

/**
 * Taille maximale d'une pièce. Vercel limite le corps d'une requête à 4,5 Mo :
 * on garde une marge pour les autres champs du formulaire.
 */
export const TAILLE_MAX_PIECE = 4 * 1024 * 1024;

/** Type réel du fichier d'après sa signature binaire (on ne fait pas confiance au navigateur). */
export function detecterType(octets: Uint8Array): { mime: string; ext: string } | null {
  const debut = (sig: number[]) => sig.every((b, i) => octets[i] === b);
  if (debut([0x25, 0x50, 0x44, 0x46])) return { mime: "application/pdf", ext: "pdf" };
  if (debut([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { mime: "image/png", ext: "png" };
  if (debut([0xff, 0xd8, 0xff])) return { mime: "image/jpeg", ext: "jpg" };
  return null;
}

const pieceSchema = z.object({
  type: parmi("type", TYPES_PIECE),
  date_expiration: dateJourOptionnelle("date d’expiration"),
  note: texteOptionnel("note", 1000),
});

export async function deposerPiece(ctx: Ctx, etudiantId: number, input: Record<string, unknown>) {
  const data = parse(pieceSchema, input);
  const fichier = input.fichier;
  if (!(fichier instanceof File) || fichier.size === 0) throw new ValidationError(["Le fichier est obligatoire."]);
  if (fichier.size > TAILLE_MAX_PIECE) throw new ValidationError(["Le fichier ne doit pas dépasser 4 Mo."]);
  const extension = fichier.name.split(".").pop()?.toLowerCase() ?? "";
  const octets = new Uint8Array(await fichier.arrayBuffer());
  const type = detecterType(octets);
  if (!type || !["pdf", "jpg", "jpeg", "png"].includes(extension)) {
    throw new ValidationError(["Le fichier doit être un PDF, un JPG ou un PNG."]);
  }

  const [etudiant] = await ctx.db.select({ id: etudiants.id }).from(etudiants).where(eq(etudiants.id, etudiantId));
  if (!etudiant) throw new NotFoundError("Étudiant introuvable.");

  const chemin = `dossiers/${etudiantId}/${randomBytes(20).toString("hex")}.${type.ext}`;
  await getStockage(ctx.db).ecrire(chemin, octets, type.mime);
  try {
    await ctx.db.transaction((tx) =>
      creer(tx, ctx, piecesAdministratives, "PieceAdministrative", {
        etudiantId,
        type: data.type,
        nomOriginal: fichier.name.slice(0, 255),
        chemin,
        mimeType: type.mime,
        taille: fichier.size,
        dateExpiration: data.date_expiration,
        note: data.note,
      }),
    );
  } catch (e) {
    await getStockage(ctx.db).supprimer(chemin).catch(() => undefined);
    throw e;
  }
}

export async function modifierPiece(ctx: Ctx, pieceId: number, input: unknown): Promise<number> {
  const data = parse(z.object({ statut: parmi("statut", STATUTS_PIECE), note: texteOptionnel("note", 1000) }), input);
  const res = await ctx.db.transaction((tx) =>
    modifier(tx, ctx, piecesAdministratives, "PieceAdministrative", pieceId, { statut: data.statut, note: data.note }),
  );
  if (!res) throw new NotFoundError("Pièce introuvable.");
  return res.etudiantId;
}

/** Lecture d'une pièce pour téléchargement, tracée dans le journal d'audit. */
export async function telechargerPiece(ctx: Ctx, pieceId: number) {
  const [piece] = await ctx.db.select().from(piecesAdministratives).where(eq(piecesAdministratives.id, pieceId));
  if (!piece) throw new NotFoundError("Pièce introuvable.");
  const contenu = await getStockage(ctx.db).lire(piece.chemin);
  if (!contenu) throw new NotFoundError("Fichier introuvable dans le stockage.");
  await auditManuel(ctx.db, ctx, "download", `Téléchargement du document ${piece.nomOriginal}`, {
    modele: "PieceAdministrative",
    id: piece.id,
  }, { type: piece.type, etudiant_id: piece.etudiantId });
  return { piece, contenu };
}
