import type { Metadata } from "next";
import { desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { journalEmails } from "@/db/schema";
import { SelectFiltre } from "@/components/selecteur";
import { EnTete, Pagination, pageDepuis, param } from "@/components/ui";
import { exigerRole } from "@/lib/auth/current";
import { formatDateHeure } from "@/lib/format";
import { ADMINS } from "@/lib/roles";

export const metadata: Metadata = { title: "Communications" };

const PAR_PAGE = 30;
const STATUTS: [string, string, string][] = [
  ["Envoyé", "text-green-700", "bg-green-50"],
  ["Échec", "text-red-700", "bg-red-50"],
  ["En attente", "text-amber-700", "bg-amber-50"],
];

export default async function Communications({ searchParams }: PageProps<"/communications">) {
  await exigerRole(ADMINS);
  const sp = await searchParams;
  const statut = param(sp.statut);
  const page = pageDepuis(sp.page);
  const db = getDb();
  const filtre = statut ? eq(journalEmails.statut, statut) : undefined;
  const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(journalEmails).where(filtre);
  const journaux = await db
    .select()
    .from(journalEmails)
    .where(filtre)
    .orderBy(desc(journalEmails.createdAt), desc(journalEmails.id))
    .limit(PAR_PAGE)
    .offset((page - 1) * PAR_PAGE);
  const stats = Object.fromEntries(
    (
      await db
        .select({ statut: journalEmails.statut, total: sql<number>`count(*)::int` })
        .from(journalEmails)
        .groupBy(journalEmails.statut)
    ).map((s) => [s.statut, s.total]),
  );

  return (
    <>
      <EnTete surtitre="Traçabilité" titre="Communications par e-mail" />
      {!process.env.SMTP_HOST && (
        <div className="mb-5 rounded-lg bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800">
          Aucun serveur SMTP n’est configuré : les e-mails sont journalisés « En attente » mais ne partent pas. Renseignez SMTP_HOST et
          les variables associées dans Vercel.
        </div>
      )}
      <section className="grid grid-cols-3 gap-4 mb-6">
        {STATUTS.map(([s, texte, fond]) => (
          <div key={s} className={`${fond} border border-white rounded-xl p-4`}>
            <p className={`text-2xl font-bold ${texte}`}>{stats[s] ?? 0}</p>
            <p className="text-sm text-gray-500">{s}</p>
          </div>
        ))}
      </section>
      <div className="mb-4">
        <SelectFiltre nom="statut" libelle="Statut" valeur={statut} vide="Tous les statuts" options={STATUTS.map(([s]) => ({ valeur: s, libelle: s }))} />
      </div>
      <div className="bg-white border rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500">
            <tr>
              <th className="text-left p-4">Date</th>
              <th className="text-left p-4">Destinataire</th>
              <th className="text-left p-4">Type / sujet</th>
              <th className="text-left p-4">Statut</th>
            </tr>
          </thead>
          <tbody>
            {journaux.length ? (
              journaux.map((j) => (
                <tr key={j.id} className="border-t">
                  <td className="p-4 whitespace-nowrap">{formatDateHeure(j.createdAt)}</td>
                  <td className="p-4">
                    <strong>{j.nomDestinataire || "—"}</strong>
                    <span className="block text-xs text-gray-400">{j.destinataire}</span>
                  </td>
                  <td className="p-4">
                    <span className="text-xs text-gray-400">{j.type}</span>
                    <span className="block">{j.sujet}</span>
                  </td>
                  <td className="p-4">
                    <span
                      className={`rounded-full px-3 py-1 text-xs ${
                        j.statut === "Envoyé" ? "bg-green-100 text-green-700" : j.statut === "Échec" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {j.statut}
                    </span>
                    {j.erreur && (
                      <span title={j.erreur} className="ml-2 text-red-500 cursor-help">
                        ⓘ<span className="sr-only">{j.erreur}</span>
                      </span>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="p-10 text-center text-gray-400">
                  Aucun e-mail enregistré.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="mt-5">
        <Pagination page={page} total={total} parPage={PAR_PAGE} chemin="/communications" params={{ statut }} />
      </div>
    </>
  );
}
