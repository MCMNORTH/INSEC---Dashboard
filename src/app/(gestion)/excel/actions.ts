"use server";

import { type EtatFormulaire, tenter } from "@/lib/actions";
import { auditManuel } from "@/lib/audit";
import { contexte } from "@/lib/auth/current";
import { ADMINS } from "@/lib/roles";
import { importerEtudiants } from "@/lib/services/excel";

export async function actionImporter(_: EtatFormulaire, fd: FormData): Promise<EtatFormulaire> {
  const ctx = await contexte(ADMINS, "excel.importer");
  const res = await tenter(() => importerEtudiants(ctx, fd.get("fichier"), fd.get("mode")));
  if (!res.ok) return res.etat;
  const r = res.valeur;
  await auditManuel(ctx.db, ctx, "import", "Import Excel des étudiants", null, {
    créés: r.crees,
    mis_à_jour: r.misAJour,
    ignorés: r.ignores,
    erreurs: r.erreurs.length,
  });
  return { erreurs: [], donnees: r };
}
