import type { Metadata } from "next";
import { getDb } from "@/db";
import { BoutonAction } from "@/components/bouton-action";
import { Flash } from "@/components/flash";
import { Restauration } from "@/components/restauration";
import { EnTete } from "@/components/ui";
import { exigerRole } from "@/lib/auth/current";
import { formatDateHeureSecondes } from "@/lib/format";
import { SUPER_ADMIN } from "@/lib/roles";
import { listerSauvegardes } from "@/lib/services/sauvegardes";
import { getStockage } from "@/lib/storage";
import { actionCreerSauvegarde, actionRestaurer, actionVerifierSauvegarde } from "./actions";

export const metadata: Metadata = { title: "Sauvegardes" };

export default async function Sauvegardes() {
  await exigerRole(SUPER_ADMIN);
  const db = getDb();
  const sauvegardes = await listerSauvegardes(db);
  const enBase = getStockage(db).pilote === "database";

  return (
    <>
      <EnTete
        surtitre="Continuité d’activité"
        titre="Sauvegardes et restauration"
        description="Base de données, dossiers étudiants et contrôle d’intégrité dans une archive unique."
      >
        <BoutonAction action={actionCreerSauvegarde} className="bg-insec text-white rounded-lg px-4 py-2 text-sm font-semibold">
          <i className="fa-solid fa-plus mr-2" aria-hidden />
          Créer une sauvegarde
        </BoutonAction>
      </EnTete>
      <Flash />
      {enBase && (
        <div className="mb-5 rounded-lg bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800">
          Les archives sont actuellement stockées dans la même base PostgreSQL que les données. Pour vous protéger d’une perte de la base,
          configurez un stockage S3 externe (STORAGE_DRIVER=s3) ou téléchargez régulièrement une archive.
        </div>
      )}
      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white border rounded-xl p-4">
          <p className="text-xs text-gray-400">Planification</p>
          <p className="font-semibold text-insec mt-1">Tous les jours vers 02:00 (UTC)</p>
        </div>
        <div className="bg-white border rounded-xl p-4">
          <p className="text-xs text-gray-400">Conservation</p>
          <p className="font-semibold text-insec mt-1">30 jours</p>
        </div>
        <div className="bg-white border rounded-xl p-4">
          <p className="text-xs text-gray-400">Protection</p>
          <p className="font-semibold text-insec mt-1">SHA-256 + mot de passe</p>
        </div>
      </div>
      <div className="space-y-3">
        {sauvegardes.length ? (
          sauvegardes.map((b) => (
            <article key={b.nom} className="bg-white border rounded-xl p-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-semibold text-insec break-all">{b.nom}</h2>
                    <span className={`text-xs rounded-full px-2 py-1 ${b.integrite ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                      {b.integrite ? "Intègre" : "À vérifier"}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    {formatDateHeureSecondes(b.cree_le)} · {(b.taille / 1024).toFixed(1).replace(".", ",")} Ko · {b.documents} document(s) ·{" "}
                    {b.motif}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <BoutonAction action={actionVerifierSauvegarde} champs={{ nom: b.nom }} className="border rounded-lg px-3 py-2 text-xs font-semibold text-gray-600">
                    Vérifier
                  </BoutonAction>
                  <a href={`/sauvegardes/${encodeURIComponent(b.nom)}/telecharger`} className="border rounded-lg px-3 py-2 text-xs font-semibold text-gray-600">
                    Télécharger
                  </a>
                </div>
              </div>
              <div className="mt-3">
                <Restauration action={actionRestaurer.bind(null, b.nom)} />
              </div>
            </article>
          ))
        ) : (
          <div className="bg-white border rounded-xl p-10 text-center text-gray-400">Aucune sauvegarde disponible.</div>
        )}
      </div>
    </>
  );
}
