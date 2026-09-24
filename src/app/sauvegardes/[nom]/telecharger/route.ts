import { notFound } from "next/navigation";
import { auditManuel } from "@/lib/audit";
import { contexte } from "@/lib/auth/current";
import { NotFoundError } from "@/lib/errors";
import { telechargement } from "@/lib/http";
import { SUPER_ADMIN } from "@/lib/roles";
import { lireSauvegarde } from "@/lib/services/sauvegardes";

export async function GET(_: Request, { params }: RouteContext<"/sauvegardes/[nom]/telecharger">) {
  const ctx = await contexte(SUPER_ADMIN, "backups.download");
  const nom = decodeURIComponent((await params).nom);
  try {
    const contenu = await lireSauvegarde(ctx.db, nom);
    await auditManuel(ctx.db, ctx, "download", `Téléchargement de la sauvegarde ${nom}`);
    return telechargement(contenu, nom, "application/zip");
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    throw e;
  }
}
